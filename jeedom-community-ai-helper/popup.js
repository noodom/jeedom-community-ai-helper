// Détection automatique de l'API disponible
const devApi = typeof browser !== 'undefined' ? browser : chrome;

// --- Assistant pour le formatage du temps ---
function formatTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const seconds = Math.floor((now - past) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return `d'il y a ${Math.floor(interval)} an(s)`;
    interval = seconds / 2592000;
    if (interval > 1) return `d'il y a ${Math.floor(interval)} mois`;
    interval = seconds / 86400;
    if (interval > 1) return `d'il y a ${Math.floor(interval)} jour(s)`;
    interval = seconds / 3600;
    if (interval > 1) return `d'il y a ${Math.floor(interval)} heure(s)`;
    interval = seconds / 60;
    if (interval > 1) return `d'il y a ${Math.floor(interval)} minute(s)`;
    return "d'il y a quelques secondes";
}

// --- Fonctions UI ---
function setLoading(message) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `<div class="loading"><div class="loading-spinner"></div>${message}</div>`;
}

function setError(message) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `<div class="loading">${message}</div>`;
    document.getElementById('search-topic').style.display = 'none';
}

// --- Fonction Principale ---
async function runAnalysis(forceRefresh = false) {
    const mainContent = document.getElementById('main-content');
    const footerBar = document.getElementById('footer-bar');
    const cacheInfo = document.getElementById('cache-info');
    const refreshButton = document.getElementById('refresh-summary');
    document.getElementById('search-topic').style.display = 'none';

    footerBar.style.display = 'none';
    setLoading('Analyse de la discussion en cours...');

    const tabs = await devApi.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab || !activeTab.url || !activeTab.url.startsWith('https://community.jeedom.com/t/')) {
        setError("Cette page n'est pas une discussion du forum Jeedom.");
        return;
    }
    
    // Ping le script de contenu pour s'assurer qu'il est prêt
    try {
        const ping = await devApi.tabs.sendMessage(activeTab.id, { type: 'ping' });
        if (ping.status !== 'pong') throw new Error('Pong non reçu.');
    } catch (e) {
        setError(`Impossible de communiquer avec la page. Essayez d'actualiser l'onglet.`);
        return;
    }

    // Récupérer les données de la page (y compris le nombre de messages)
    const dataResponse = await devApi.tabs.sendMessage(activeTab.id, { type: 'getDiscussionData' });
    if (!dataResponse || !dataResponse.title) {
        setError(`Erreur lors de la récupération des données: ${devApi.runtime.lastError?.message || 'Réponse invalide.'}`);
        return;
    }
    
    // --- LOGIQUE DE CACHE ---
    const cacheKey = activeTab.url;
    if (!forceRefresh) {
        const cachedResult = await devApi.storage.local.get(cacheKey);
        const cachedData = cachedResult[cacheKey];

        if (cachedData && cachedData.postCount === dataResponse.postCount) {
            populatePopup(cachedData);
            
            cacheInfo.textContent = `Cache utilisé (${formatTimeAgo(cachedData.timestamp)})`;
            footerBar.style.display = 'flex';
            refreshButton.onclick = () => runAnalysis(true);
            return;
        }
    }
    
    // --- APPEL API (si cache manquant) ---
    setLoading("Données récupérées. Génération du résumé par l'IA...");
    devApi.runtime.sendMessage({ type: 'summarizeDiscussion', data: dataResponse }, (summaryResponse) => {
        if (devApi.runtime.lastError || summaryResponse.error) {
            let errorMessage = summaryResponse.error || devApi.runtime.lastError.message;
            if (String(errorMessage).includes('429')) {
                errorMessage = 'Vous avez atteint la limite de requêtes pour l\'API Gemini. Veuillez patienter avant de réessayer.';
            }
            setError(`Erreur de l'IA: ${errorMessage}`);
            return;
        }

        const finalData = { ...summaryResponse.summary, ...dataResponse };
        populatePopup(finalData);

        // Sauvegarder le nouveau résultat dans le cache
        const dataToCache = { ...finalData, timestamp: Date.now(), postCount: dataResponse.postCount };
        devApi.storage.local.set({ [cacheKey]: dataToCache }, () => {
            console.log("Nouveau résumé sauvegardé dans le cache.");
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    runAnalysis();
});

function populatePopup(data) {
    const mainContent = document.getElementById('main-content');
    // Clear only analysis content
    mainContent.innerHTML = '';


    // --- En-tête (Titre et informations sur l'auteur) ---
    const titleSection = document.createElement('div');
    titleSection.style.marginBottom = '15px';

    const titleEl = document.createElement('h2');
    titleEl.style.fontSize = '16px';
    titleEl.style.marginTop = '0';
    titleEl.textContent = data.title;

    if (data.solutionLink) {
        titleEl.innerHTML += ' <span title="Résolu" style="color:var(--jeedom-green); font-size: 18px;">✔</span>';
    }
    titleSection.appendChild(titleEl);

    mainContent.appendChild(titleSection);

    // --- Catégories et Tags ---
    const tagsWrapper = document.createElement('div');
    tagsWrapper.style.marginBottom = '15px';

    if (data.categories && data.categories.length > 0) {
        const categoriesContainer = document.createElement('div');
        categoriesContainer.className = 'tags-container';
        data.categories.forEach(cat => {
            const catEl = document.createElement('span');
            catEl.textContent = cat;
            catEl.style.backgroundColor = '#2e3d4c'; // Thème sombre de Jeedom pour les catégories
            categoriesContainer.appendChild(catEl);
        });
        tagsWrapper.appendChild(categoriesContainer);
    }

    if (data.tags && data.tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        data.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.textContent = tag;
            tagEl.style.cursor = 'pointer';
            tagEl.title = 'Cliquez pour configurer ce tag';
            tagEl.addEventListener('click', () => handleTagClick(tag));
            tagsContainer.appendChild(tagEl);
        });
        tagsWrapper.appendChild(tagsContainer);
    }
    mainContent.appendChild(tagsWrapper);

    // --- Sections dépliables ---
    const createCollapsibleSection = (title, content, isOpen = false, linkInfo = null, customClass = '') => {
        if (!content) return null;

        const details = document.createElement('details');
        details.open = isOpen;

        const summaryEl = document.createElement('summary');
        summaryEl.innerHTML = `<span>${title}</span> <button class="copy-button" title="Copier le résumé" style="background: none; border: none; cursor: pointer; color: var(--jeedom-text-color); margin-left: 5px; vertical-align: middle;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
        details.appendChild(summaryEl);

        const copyButton = summaryEl.querySelector('.copy-button');
        if (copyButton) {
            copyButton.addEventListener('click', (event) => {
                event.stopPropagation();
                copyToClipboard(content, copyButton);
            });
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content ' + customClass;

        if (linkInfo && linkInfo.author) {
            const authorDiv = document.createElement('div');
            authorDiv.className = 'author-line';
            authorDiv.style.marginBottom = '10px';
            authorDiv.style.fontSize = '12px';
            const authorPrefix = title === 'SOLUTION RETENUE' ? 'Solution par' : 'par';
            authorDiv.innerHTML = `${authorPrefix} <img src="${linkInfo.avatar}" class="avatar" style="width:16px; height:16px; border-radius:50%; vertical-align:middle;"> <b>${linkInfo.author}</b>`;
            contentDiv.appendChild(authorDiv);
        }

        const textNode = document.createElement('div');
        // Convertir le markdown simple ou les listes en HTML
        textNode.innerHTML = formatSummaryContent(content);
        contentDiv.appendChild(textNode);

        if (linkInfo && linkInfo.url) {
            const link = document.createElement('a');
            link.href = `https://community.jeedom.com${linkInfo.url}`;
            link.target = '_blank';
            link.textContent = 'Voir le message original';
            link.style.display = 'inline-block';
            link.style.marginTop = '10px';
            link.style.fontSize = '11px';
            link.style.color = 'var(--jeedom-green)';
            link.style.textDecoration = 'none';
            link.style.fontWeight = 'bold';
            contentDiv.appendChild(link);
        }
        details.appendChild(contentDiv);
        return details;
    };

    const problemSection = createCollapsibleSection('PROBLÉMATIQUE', data.problem, true, { author: data.originalPosterUsername, avatar: data.originalPosterAvatar }, 'problem-text');
    if (problemSection) mainContent.appendChild(problemSection);

    const solutionSection = createCollapsibleSection('SOLUTION RETENUE', data.solution, true, { url: data.solutionLink, author: data.solutionAuthorUsername, avatar: data.solutionAuthorAvatar }, 'solution-text');
    if (solutionSection) mainContent.appendChild(solutionSection);

    const summarySection = createCollapsibleSection('RÉSUMÉ DES ÉCHANGES', data.summary);
    if (summarySection) mainContent.appendChild(summarySection);

    // Activer le bouton de recherche
    const searchButton = document.getElementById('search-topic');
    if (searchButton && data.title) {
        searchButton.style.display = 'flex'; // Utiliser flex pour centrer le SVG
        searchButton.onclick = () => {
            const query = encodeURIComponent(data.title);
            devApi.tabs.create({ url: `https://community.jeedom.com/search?q=${query}` });
        };
    }
}

function formatSummaryContent(content) {
    if (!content) return '';

    let textContent = content;
    if (Array.isArray(textContent)) {
        textContent = textContent.join('\n');
    } else if (typeof textContent !== 'string') {
        textContent = String(textContent);
    }

    // Gestion basique des listes à puces si l'IA en renvoie
    return textContent
        .replace(/\n/g, '<br>')
        .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>')
        .replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>')
        .replace(/<\/ul><ul>/g, '');
}

function copyToClipboard(text, button) {
    if (!navigator.clipboard) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        showCopyFeedback(button, 'Copié !');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback(button, 'Copié !');
    }).catch(err => {
        console.error('Erreur lors de la copie:', err);
        showCopyFeedback(button, 'Erreur !', 'red');
    });
}

function showCopyFeedback(button, message, color = 'var(--jeedom-green)') {
    const originalContent = button.innerHTML;
    const originalTitle = button.title;
    const originalColor = button.style.color;

    button.innerHTML = message;
    button.title = message;
    button.style.color = color;

    setTimeout(() => {
        button.innerHTML = originalContent;
        button.title = originalTitle;
        button.style.color = originalColor;
    }, 1500);
}

function handleTagClick(tagName) {
    devApi.storage.local.get(['tagLinkMappings'], (result) => {
        const tagLinkMappings = result.tagLinkMappings || [];
        const tagExists = tagLinkMappings.some(mapping => mapping.tag === tagName);

        if (!tagExists) {
            devApi.storage.local.set({ tagToPrepopulate: tagName }, () => {
                devApi.runtime.openOptionsPage();
            });
        } else {
            devApi.runtime.openOptionsPage();
        }
    });
}
