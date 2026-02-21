// Détection automatique de l'API disponible
const devApi = typeof browser !== 'undefined' ? browser : chrome;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

// État global de l'extension
let personas = [];
let paragraphs = [];
let lastUsedPersonaId = null;
let defaultOpeningParagraphId = null;
let defaultClosingParagraphId = null;
let processedEditorIds = new Set();
let showSpellCheckButton = true;
let showRephraseButton = true;
let showPersonaButton = true;
let showParagraphsButton = true;

// --- Utilitaires pour les éléments DOM ---
function createSvgElement(pathD, viewBox = "0 -960 960 960") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("height", "24");
    svg.setAttribute("width", "24");
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("fill", "currentColor");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
}

function createSpinnerSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.style.background = "none";
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "50");
    circle.setAttribute("cy", "50");
    circle.setAttribute("r", "32");
    circle.setAttribute("stroke-width", "8");
    circle.setAttribute("stroke", "#93dbe9");
    circle.setAttribute("stroke-dasharray", "50.265 50.265");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke-linecap", "round");
    const animate = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
    animate.setAttribute("attributeName", "transform");
    animate.setAttribute("type", "rotate");
    animate.setAttribute("repeatCount", "indefinite");
    animate.setAttribute("dur", "1s");
    animate.setAttribute("values", "0 50 50;360 50 50");
    circle.appendChild(animate);
    svg.appendChild(circle);
    return svg;
}

// SVG pour les icônes
const USER_ICON_D = "m480-120-58-125-125-58 125-58 58-125 58 125 125 58-125 58-58 125ZM200-200l-58-125-125-58 125-58 58-125 58 125 125 58-125 58-58 125Zm560 0-58-125-125-58 125-58 58-125 58 125 125 58-125 58-58 125Z";
const SPELL_ICON_D = "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v200h-80v-200H200v560h240v80H200Zm520-40-56-56 103-104-103-104 56-56 160 160-160 160ZM280-600h320v-80H280v80Zm0 160h160v-80H280v80Z";
const REPHRASE_ICON_D = "M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80ZM120-80q-33 0-56.5-23.5T40-160v-640q0-33 23.5-56.5T120-880h520l280 280v520q0 33-23.5 56.5T840-80H120Zm540-550v-170H120v640h720v-470H660Zm-20 170h170L640-630v170Z";
const PARA_ICON_D = "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h400v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 0v-560 560Z";

// --- Communication ---
devApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ping') {
        sendResponse({ status: 'pong' });
        return true;
    }

    if (request.type === 'getDiscussionData') {
        (async () => {
            const settings = await devApi.storage.local.get(['maxDiscussionSize', 'forceLoadAllPosts']);
            const limit = settings.maxDiscussionSize || 30000; // Limite par défaut
            const shouldForceScroll = settings.forceLoadAllPosts !== undefined ? settings.forceLoadAllPosts : true;

            if (shouldForceScroll) {
                let lastVisiblePost = null;
                const postsBeforeLoad = document.querySelectorAll('.topic-post');
                for (let i = postsBeforeLoad.length - 1; i >= 0; i--) {
                    const post = postsBeforeLoad[i];
                    const rect = post.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom >= 0) {
                        lastVisiblePost = post;
                        break;
                    }
                }

                async function loadAllPosts() {
                    console.log('[AI-HELPER-DEBUG] Démarrage de loadAllPosts (scroll vers le haut)...');
                    let postCount = 0;
                    let currentPostCount = document.querySelectorAll('.topic-post').length; // Compteur de posts après le scroll
                    let iteration = 1;
                    console.log(`[AI-HELPER-DEBUG] Itération ${iteration}: ${currentPostCount} posts trouvés initialement.`);

                    while (currentPostCount > postCount) {
                        postCount = currentPostCount;
                        console.log(`[AI-HELPER-DEBUG] Itération ${iteration}: Scroll vers le HAUT...`);
                        window.scrollTo(0, 0);

                        console.log(`[AI-HELPER-DEBUG] Itération ${iteration}: Attente de 2 secondes...`);
                        // TODO : MutationObserver.
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        currentPostCount = document.querySelectorAll('.topic-post').length; // Recompter les posts
                        iteration++;
                        console.log(`[AI-HELPER-DEBUG] Itération ${iteration}: ${currentPostCount} posts trouvés maintenant (précédemment ${postCount}).`);
                    }
                    console.log('[AI-HELPER-DEBUG] Fin de loadAllPosts. Le nombre de posts est stable.');
                }

                await loadAllPosts(); // Exécuter le chargement de tous les posts

                if (lastVisiblePost) {
                    console.log('[AI-HELPER-DEBUG] Retour au dernier post visible avant le chargement.');
                    lastVisiblePost.scrollIntoView({ behavior: 'auto', block: 'end' });
                }
            }

            const firstPost = document.querySelector('.topic-post:first-of-type');
            const solutionPost = document.querySelector('.accepted-text')?.closest('.topic-post');

            const posts = Array.from(document.querySelectorAll('.topic-post .cooked'));
            let fullText = '';
            const separator = '\n\n---\n\n';
            let includedPostsCount = 0;
            let currentFullTextLength = 0;

            for (const post of posts) {
                const postText = post.innerText;
                const potentialLength = currentFullTextLength + postText.length + (includedPostsCount > 0 ? separator.length : 0);
                if (potentialLength > limit) {
                    console.log(`[AI-HELPER-DEBUG] Limite maxDiscussionSize atteinte (${limit} caractères). Arrêt de l'ajout des posts.`);
                    break;
                }
                if (includedPostsCount > 0) {
                    fullText += separator;
                }
                fullText += postText;
                currentFullTextLength = fullText.length;
                includedPostsCount++;
            }

            console.log(`[AI-HELPER-DEBUG] Construction du fullText terminée.`);
            console.log(`[AI-HELPER-DEBUG] Posts total disponibles (après chargement): ${posts.length}`);
            console.log(`[AI-HELPER-DEBUG] Posts inclus dans fullText: ${includedPostsCount}`);
            console.log(`[AI-HELPER-DEBUG] Longueur finale du fullText: ${fullText.length} caractères.`);
            console.log(`[AI-HELPER-DEBUG] Limite maxDiscussionSize utilisée: ${limit} caractères.`);

            // Préparer les données à envoyer
            const data = {
                title: document.querySelector('a.fancy-title')?.innerText.trim(), // Titre de la discussion
                categories: Array.from(document.querySelectorAll('.topic-category .badge-category__name')).map(c => c.innerText), // Catégories
                tags: Array.from(document.querySelectorAll('.list-tags .discourse-tag')).map(t => t.innerText), // Tags
                firstPost: firstPost?.querySelector('.cooked')?.innerText, // Contenu du premier post
                solutionPost: solutionPost?.querySelector('.cooked')?.innerText.trim() || null, // Contenu du post solution (s'il existe)
                fullText: fullText, // Texte complet de la discussion (tronqué si nécessaire)
                postCount: document.querySelectorAll('.topic-post').length, // Nombre total de posts détectés
                originalPosterUsername: firstPost?.querySelector('.topic-meta-data .names span')?.innerText.trim(), // Nom d'utilisateur de l'auteur original
                originalPosterAvatar: firstPost?.querySelector('.post-avatar .avatar')?.src, // Avatar de l'auteur original
                solutionAuthorUsername: solutionPost?.querySelector('.topic-meta-data .names span')?.innerText.trim(), // Nom d'utilisateur de l'auteur de la solution
                solutionAuthorAvatar: solutionPost?.querySelector('.post-avatar .avatar')?.src, // Avatar de l'auteur de la solution
                solutionLink: solutionPost ? new URL(solutionPost.querySelector('.post-date a').href).pathname : null // Lien vers la solution
            };

            if (data.tags.length > 0) {
                devApi.storage.local.get('allKnownTags', (result) => {
                    const knownTags = new Set(result.allKnownTags || []);
                    data.tags.forEach(tag => knownTags.add(tag));
                    devApi.storage.local.set({ allKnownTags: Array.from(knownTags).sort() });
                });
            }

            sendResponse(data);
        })();
        return true;
    }

    if (request.type === 'insertText') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;
            const value = activeElement.value;
            activeElement.value = value.substring(0, start) + request.text + value.substring(end);
            activeElement.selectionStart = activeElement.selectionEnd = start + request.text.length;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            sendResponse({ status: 'success' });
        } else {
            sendResponse({ status: 'error', message: 'No active text input field found.' });
        }
        return true;
    }
});

function initialize() {
    devApi.storage.local.get(['personas', 'lastUsedPersonaId', 'paragraphs', 'defaultOpeningParagraphId', 'defaultClosingParagraphId',
        'showSpellCheckButton', 'showRephraseButton', 'showPersonaButton', 'showParagraphsButton'], (result) => {
        personas = result.personas || [];
        paragraphs = result.paragraphs || [];
        lastUsedPersonaId = result.lastUsedPersonaId;
        defaultOpeningParagraphId = result.defaultOpeningParagraphId || null;
        defaultClosingParagraphId = result.defaultClosingParagraphId || null;
        showSpellCheckButton = result.showSpellCheckButton !== undefined ? result.showSpellCheckButton : true;
        showRephraseButton = result.showRephraseButton !== undefined ? result.showRephraseButton : true;
        showPersonaButton = result.showPersonaButton !== undefined ? result.showPersonaButton : true;
        showParagraphsButton = result.showParagraphsButton !== undefined ? result.showParagraphsButton : true;
        findAndAddButtons();
    });
}

function findAndAddButtons() {
    if (personas.length === 0 && paragraphs.length === 0) return;
    const toolbars = document.querySelectorAll('.d-editor-button-bar:not(.ai-processed)');

    toolbars.forEach(toolbar => {
        if (toolbar.querySelector('.ai-controls-container')) {
            toolbar.classList.add('ai-processed');
            return;
        }

        const container = document.createElement('div');
        container.className = 'ai-controls-container';
        container.style.cssText = 'display: inline-flex; align-items: center; gap: 5px; margin-left: 10px; position: relative;';

        if (showSpellCheckButton) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-default spell-check-button';
            btn.appendChild(createSvgElement(SPELL_ICON_D));
            btn.title = 'Corriger l\'orthographe';
            btn.addEventListener('click', (e) => { e.preventDefault(); handleSpellCheckClick(btn); });
            container.appendChild(btn);
        }

        if (showRephraseButton) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-default rephrase-button';
            btn.appendChild(createSvgElement(REPHRASE_ICON_D));
            btn.title = 'Reformuler la réponse par IA';

            const menu = document.createElement('div');
            menu.className = 'persona-menu hidden';
            personas.forEach(persona => {
                const item = document.createElement('div');
                item.className = 'persona-menu-item';
                item.textContent = persona.name;
                item.addEventListener('click', (e) => {
                    e.stopPropagation(); e.preventDefault();
                    menu.classList.add('hidden');
                    handleRephraseClick(btn, persona.id);
                });
                menu.appendChild(item);
            });

            btn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                document.querySelectorAll('.persona-menu').forEach(m => m.classList.add('hidden'));
                menu.classList.toggle('hidden');
            });
            container.appendChild(btn);
            container.appendChild(menu);
        }

        if (showPersonaButton) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-default persona-button';
            btn.appendChild(createSvgElement(USER_ICON_D));
            btn.title = 'Génération automatique par IA';

            const menu = document.createElement('div');
            menu.className = 'persona-menu hidden';
            personas.forEach(persona => {
                const item = document.createElement('div');
                item.className = 'persona-menu-item';
                item.textContent = persona.name;
                item.addEventListener('click', (e) => {
                    e.stopPropagation(); e.preventDefault();
                    menu.classList.add('hidden');
                    handleAiButtonClick(btn, persona.id);
                });
                menu.appendChild(item);
            });

            btn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                document.querySelectorAll('.persona-menu').forEach(m => m.classList.add('hidden'));
                menu.classList.toggle('hidden');
            });
            container.appendChild(btn);
            container.appendChild(menu);
        }

        if (showParagraphsButton) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-default paragraphs-button';
            btn.appendChild(createSvgElement(PARA_ICON_D));
            btn.title = 'Insérer un paragraphe pré-enregistré';

            const menu = document.createElement('div');
            menu.className = 'persona-menu hidden';
            if (paragraphs.length > 0) {
                paragraphs.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'persona-menu-item';
                    item.textContent = p.title;
                    item.addEventListener('click', (e) => {
                        e.stopPropagation(); e.preventDefault();
                        menu.classList.add('hidden');
                        insertReply(p.content);
                    });
                    menu.appendChild(item);
                });
            } else {
                const item = document.createElement('div');
                item.className = 'persona-menu-item';
                item.textContent = 'Aucun paragraphe configuré.';
                item.style.cssText = 'font-style: italic; color: #888;';
                menu.appendChild(item);
            }

            btn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                document.querySelectorAll('.persona-menu').forEach(m => m.classList.add('hidden'));
                menu.classList.toggle('hidden');
            });
            container.appendChild(btn);
            container.appendChild(menu);
        }

        toolbar.appendChild(container);
        toolbar.classList.add('ai-processed');
    });
}

async function handleSpellCheckClick(button) {
    const editor = document.querySelector('.d-editor-input');
    if (!editor || !editor.value) return;

    const originalIcon = Array.from(button.childNodes);
    button.replaceChildren(createSpinnerSvg());
    button.disabled = true;

    try {
        const params = new URLSearchParams();
        params.append('text', editor.value);
        params.append('language', 'fr');

        const response = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', body: params });
        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();
        let text = editor.value;
        let offset = 0;

        data.matches.forEach(match => {
            if (match.replacements.length > 0) {
                const repl = match.replacements[0].value;
                text = text.substring(0, match.offset + offset) + repl + text.substring(match.offset + offset + match.length);
                offset += repl.length - match.length;
            }
        });

        editor.value = text;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
        console.error(error);
        button.title = `Erreur: ${error.message}`;
    } finally {
        button.replaceChildren(...originalIcon);
        button.disabled = false;
    }
}

async function handleRephraseClick(button, personaId) {
    const editor = document.querySelector('.d-editor-input');
    if (!editor || !editor.value) return;

    const originalIcon = Array.from(button.childNodes);
    button.replaceChildren(createSpinnerSvg());
    button.disabled = true;

    try {
        const persona = personas.find(p => p.id === personaId);
        if (!persona) throw new Error("Persona non trouvée.");

        devApi.runtime.sendMessage({ type: 'rephraseText', text: editor.value, personaId: persona.id }, (response) => {
            if (response.error) throw new Error(response.error);
            let finalText = response.text;
            if (persona.prefix) finalText = persona.prefix + '\n\n' + finalText;
            if (persona.suffix) finalText = finalText + '\n\n' + persona.suffix;
            insertReply(finalText);
            devApi.storage.local.set({ lastUsedPersonaId: persona.id });
            button.replaceChildren(...originalIcon);
            button.disabled = false;
        });
    } catch (error) {
        console.error(error);
        button.replaceChildren(...originalIcon);
        button.disabled = false;
    }
}

function handleAiButtonClick(button, personaId) {
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return;

    const originalIcon = Array.from(button.childNodes);
    button.replaceChildren(createSpinnerSvg());
    button.disabled = true;

    const context = Array.from(document.querySelectorAll('.topic-post .cooked')).map(p => p.innerText).join('\n\n---\n\n');
    const tags = Array.from(document.querySelectorAll('.list-tags .discourse-tag')).map(t => t.innerText);
    const title = document.querySelector('a.fancy-title')?.innerText.trim();
    const categories = Array.from(document.querySelectorAll('.topic-category .badge-category__name')).map(c => c.innerText);

    devApi.runtime.sendMessage({
        type: 'generateReply', personaId: personaId, context, tags, title, categories
    }, (response) => {
        button.replaceChildren(...originalIcon);
        button.disabled = false;
        if (response.error) {
            console.error(response.error);
        } else {
            let finalText = response.text;
            if (persona.prefix) finalText = persona.prefix + '\n\n' + finalText;
            if (persona.suffix) finalText = finalText + '\n\n' + persona.suffix;
            insertReply(finalText);
        }
    });
}

function insertReply(text) {
    const editor = document.querySelector('.d-editor-input');
    if (editor) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + text.length;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

document.addEventListener('click', () => {
    document.querySelectorAll('.persona-menu').forEach(menu => menu.classList.add('hidden'));
});

function runObserver() {
    findAndAddButtons();
    processCodeBlocks();
    processEditors();
}

initialize();
const observer = new MutationObserver(runObserver);
observer.observe(document.body, { childList: true, subtree: true });

function createCodeAiModal() {
    if (document.getElementById('code-ai-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'code-ai-modal';
    modal.className = 'code-ai-modal hidden';

    const content = document.createElement('div');
    content.className = 'code-ai-modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header-buttons';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'code-ai-modal-copy';
    copyBtn.className = 'code-ai-modal-button';
    copyBtn.title = 'Copier le contenu';
    const copySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    copySvg.setAttribute("width", "18"); copySvg.setAttribute("height", "18"); copySvg.setAttribute("viewBox", "0 0 24 24");
    copySvg.setAttribute("fill", "none"); copySvg.setAttribute("stroke", "currentColor");
    copySvg.setAttribute("stroke-width", "2");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "9");
    rect.setAttribute("y", "9");
    rect.setAttribute("width", "13");
    rect.setAttribute("height", "13");
    rect.setAttribute("rx", "2");
    rect.setAttribute("ry", "2");
    copySvg.appendChild(rect);
    copyBtn.appendChild(copySvg);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'code-ai-modal-close';
    closeBtn.className = 'code-ai-modal-button';
    closeBtn.textContent = '×';

    header.appendChild(copyBtn);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.id = 'code-ai-modal-body';

    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    document.body.appendChild(modal);

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyModalContentToClipboard(copyBtn);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

function showCodeAiModal(content, isHtml = true) {
    const modal = document.getElementById('code-ai-modal');
    const body = document.getElementById('code-ai-modal-body');
    body.replaceChildren();
    if (isHtml) {
        renderRichText(body, content);
    } else {
        body.textContent = content;
    }
    modal.classList.remove('hidden');
}

function renderRichText(container, html) {
    const temp = document.createElement('div');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    container.replaceChildren(...Array.from(doc.body.childNodes));
}

function handleCodeActionClick(action, button, codeElement) {
    const code = codeElement.innerText;
    if (!code) return;

    const originalIcon = Array.from(button.childNodes);
    button.replaceChildren(createSpinnerSvg());
    button.disabled = true;

    showCodeAiModal("Analyse en cours...", false);

    devApi.runtime.sendMessage({
        type: action,
        code: code
    }, (response) => {
        if (response.error) {
            showCodeAiModal(`Erreur: ${response.error}`, false);
        } else {
            showCodeAiModal(response.text, true);
        }
        button.replaceChildren(...originalIcon);
        button.disabled = false;
    });
}

function copyModalContentToClipboard(button) {
    const text = document.getElementById('code-ai-modal-body').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const original = Array.from(button.childNodes);
        button.textContent = 'Copié !';
        setTimeout(() => {
            button.replaceChildren(...original);
        }, 1500);
    });
}

function processCodeBlocks() {
    const blocks = document.querySelectorAll('pre:not(.ai-code-processed)');
    blocks.forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        pre.classList.add('ai-code-processed');
        pre.style.position = 'relative';

        const container = document.createElement('div');
        container.className = 'code-action-buttons';

        const actions = [{
            id: 'explain',
            title: 'Expliquer',
            iconD: SPELL_ICON_D,
            action: 'explainCode'
        }, {
            id: 'verify',
            title: 'Vérifier',
            iconD: REPHRASE_ICON_D,
            action: 'verifyCode'
        }, {
            id: 'optimize',
            title: 'Optimiser',
            iconD: REPHRASE_ICON_D,
            action: 'optimizeCode'
        }, {
            id: 'comment',
            title: 'Commenter',
            iconD: SPELL_ICON_D,
            action: 'commentCode'
        }];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = `btn btn-default code-action-btn code-action-${a.id}`;
            btn.title = a.title;
            btn.appendChild(createSvgElement(a.iconD));
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCodeActionClick(a.action, btn, code);
            });
            container.appendChild(btn);
        });
        pre.appendChild(container);
    });
}
createCodeAiModal();

function processEditors() {
    const editors = document.querySelectorAll('.d-editor-input');
    editors.forEach(editor => {
        const id = editor.id || `editor-${Math.random().toString(36).substring(2, 9)}`;
        editor.id = id;
        if (processedEditorIds.has(id)) return;

        if (editor.value.trim() === '') {
            let text = '';
            const open = paragraphs.find(p => p.title === defaultOpeningParagraphId);
            const close = paragraphs.find(p => p.title === defaultClosingParagraphId);
            if (open) text += open.content.trim();
            if (open && close) text += '\n\n';
            if (close) text += close.content.trim();
            if (text) {
                editor.value = text;
                editor.dispatchEvent(new Event('input', {
                    bubbles: true
                }));
            }
        }
        processedEditorIds.add(id);
    });
}

const style = document.createElement('style');
style.textContent = `
    .persona-menu { position: absolute; background-color: white; border: 1px solid #ddd; border-radius: 4px; z-index: 1000; min-width: 150px; color: #222; }
    .persona-menu-item { padding: 10px; cursor: pointer; }
    .persona-menu-item:hover { background-color: #f5f5f5; }
    .hidden { display: none; }
    .dark-scheme .persona-menu { background-color: #333; border-color: #555; color: #ddd; }
    .dark-scheme .persona-menu-item:hover { background-color: #4a4a4a; }
    .code-action-buttons { position: absolute; bottom: 5px; right: 5px; display: flex; gap: 5px; opacity: 0; transition: opacity 0.2s; background-color: rgba(255, 255, 255, 0.8); padding: 4px; border-radius: 4px; }
    pre:hover .code-action-buttons { opacity: 1; }
    .dark-scheme .code-action-buttons { background-color: rgba(50, 50, 50, 0.8); }
    .code-action-btn { padding: 2px 5px; line-height: 1; }
    .code-action-btn svg { width: 16px; height: 16px; }
    .code-ai-modal { position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .code-ai-modal-content { background-color: #fefefe; margin: auto; padding: 20px; border: 1px solid #888; border-radius: 5px; width: 80%; max-width: 600px; position: relative; color: #222; line-height: 1.6; overflow-wrap: break-word; }
    .dark-scheme .code-ai-modal-content { background-color: #333; border-color: #555; color: #ddd; }
    .modal-header-buttons { position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; z-index: 2001; }
    .code-ai-modal-button { background: none; border: none; cursor: pointer; font-size: 20px; color: #aaa; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }
    .code-ai-modal-button:hover { background-color: rgba(0, 0, 0, 0.1); color: #555; }
    .dark-scheme .code-ai-modal-button { color: #888; }
`;
document.head.appendChild(style);
