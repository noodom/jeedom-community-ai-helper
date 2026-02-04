const devApi = typeof browser !== 'undefined' ? browser : chrome;

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

function setLoading(message) {
    const mainContent = document.getElementById('main-content');
    mainContent.replaceChildren(); // Safe alternative to innerHTML = ''

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';

    const spinnerDiv = document.createElement('div');
    spinnerDiv.className = 'loading-spinner';
    loadingDiv.appendChild(spinnerDiv);

    const messageNode = document.createTextNode(message);
    loadingDiv.appendChild(messageNode);

    mainContent.appendChild(loadingDiv);
}

function setError(message) {
    const mainContent = document.getElementById('main-content');
    mainContent.replaceChildren();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'loading';
    errorDiv.textContent = message;

    mainContent.appendChild(errorDiv);
    document.getElementById('search-topic').style.display = 'none';
}

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
    
    try {
        const ping = await devApi.tabs.sendMessage(activeTab.id, { type: 'ping' });
        if (ping.status !== 'pong') throw new Error('Pong non reçu.');
    } catch (e) {
        setError(`Impossible de communiquer avec la page. Essayez d'actualiser l'onglet.`);
        return;
    }

    const dataResponse = await devApi.tabs.sendMessage(activeTab.id, { type: 'getDiscussionData' });
    if (!dataResponse || !dataResponse.title) {
        setError(`Erreur lors de la récupération des données: ${devApi.runtime.lastError?.message || 'Réponse invalide.'}`);
        return;
    }
    
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

        const dataToCache = { ...finalData, timestamp: Date.now(), postCount: dataResponse.postCount };
        devApi.storage.local.set({ [cacheKey]: dataToCache });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    runAnalysis();
});

function populatePopup(data) {
    const mainContent = document.getElementById('main-content');
    mainContent.replaceChildren();

    const titleSection = document.createElement('div');
    titleSection.style.marginBottom = '15px';

    const titleEl = document.createElement('h2');
    titleEl.style.fontSize = '16px';
    titleEl.style.marginTop = '0';
    titleEl.textContent = data.title;

    if (data.solutionLink) {
        const solvedSpan = document.createElement('span');
        solvedSpan.title = 'Résolu';
        solvedSpan.style.color = 'var(--jeedom-green)';
        solvedSpan.style.fontSize = '18px';
        solvedSpan.textContent = ' ✔';
        titleEl.appendChild(solvedSpan);
    }
    titleSection.appendChild(titleEl);
    mainContent.appendChild(titleSection);

    const tagsWrapper = document.createElement('div');
    tagsWrapper.style.marginBottom = '15px';

    if (data.categories && data.categories.length > 0) {
        const categoriesContainer = document.createElement('div');
        categoriesContainer.className = 'tags-container';
        data.categories.forEach(cat => {
            const catEl = document.createElement('span');
            catEl.textContent = cat;
            catEl.style.backgroundColor = '#2e3d4c';
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

    const createCollapsibleSection = (title, content, isOpen = false, linkInfo = null, customClass = '') => {
        if (!content) return null;

        const details = document.createElement('details');
        details.open = isOpen;

        const summaryEl = document.createElement('summary');
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        summaryEl.appendChild(titleSpan);

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.title = 'Copier le résumé';
        copyButton.style.cssText = 'background: none; border: none; cursor: pointer; color: var(--jeedom-text-color); margin-left: 5px; vertical-align: middle;';

        // Use SVG element directly
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "12");
        svg.setAttribute("height", "12");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", "9"); rect.setAttribute("y", "9"); rect.setAttribute("width", "13"); rect.setAttribute("height", "13"); rect.setAttribute("rx", "2"); rect.setAttribute("ry", "2");
        svg.appendChild(rect);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
        svg.appendChild(path);

        copyButton.appendChild(svg);
        summaryEl.appendChild(copyButton);
        details.appendChild(summaryEl);

        copyButton.addEventListener('click', (event) => {
            event.stopPropagation();
            copyToClipboard(content, copyButton);
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content ' + customClass;

        if (linkInfo && linkInfo.author) {
            const authorDiv = document.createElement('div');
            authorDiv.className = 'author-line';
            authorDiv.style.marginBottom = '10px';
            authorDiv.style.fontSize = '12px';
            const authorPrefix = title === 'SOLUTION RETENUE' ? 'Solution par' : 'par';
            
            authorDiv.appendChild(document.createTextNode(`${authorPrefix} `));

            const avatarImg = document.createElement('img');
            avatarImg.src = linkInfo.avatar;
            avatarImg.className = 'avatar';
            avatarImg.style.cssText = 'width:16px; height:16px; border-radius:50%; vertical-align:middle;';
            authorDiv.appendChild(avatarImg);

            const authorNameBold = document.createElement('b');
            authorNameBold.textContent = ` ${linkInfo.author}`;
            authorDiv.appendChild(authorNameBold);
            contentDiv.appendChild(authorDiv);
        }

        const textNode = document.createElement('div');
        renderFormattedText(textNode, content);
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

    const searchButton = document.getElementById('search-topic');
    if (searchButton && data.title) {
        searchButton.style.display = 'flex';
        searchButton.onclick = () => {
            const query = encodeURIComponent(data.title);
            devApi.tabs.create({ url: `https://community.jeedom.com/search?q=${query}` });
        };
    }
}

function renderFormattedText(container, content) {
    container.replaceChildren();
    if (!content) return;

    let textContent = content;
    if (Array.isArray(textContent)) {
        textContent = textContent.join('\n');
    } else if (typeof textContent !== 'string') {
        textContent = String(textContent);
    }

    const lines = textContent.split('\n');
    let currentList = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            if (!currentList) {
                currentList = document.createElement('ul');
                container.appendChild(currentList);
            }
            const li = document.createElement('li');
            li.textContent = trimmed.substring(2);
            currentList.appendChild(li);
        } else if (trimmed !== '') {
            currentList = null;
            const p = document.createElement('p');
            p.textContent = trimmed;
            container.appendChild(p);
        } else {
            currentList = null;
        }
    });
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
    const originalContent = Array.from(button.childNodes);
    const originalTitle = button.title;
    const originalColor = button.style.color;

    button.replaceChildren(document.createTextNode(message));
    button.title = message;
    button.style.color = color;

    setTimeout(() => {
        button.replaceChildren(...originalContent);
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
