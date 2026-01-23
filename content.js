// État global pour conserver les personas et la dernière persona utilisée
let personas = [];
let lastUsedPersonaId = null;

// Icônes SVG
const userIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m480-120-58-125-125-58 125-58 58-125 58 125 125 58-125 58-58 125ZM200-200l-58-125-125-58 125-58 58-125 58 125 125 58-125 58-58 125Zm560 0-58-125-125-58 125-58 58-125 58 125 125 58-125 58-58 125Z"/></svg>`;
const spinnerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width="18" height="18" style="background: none;"><circle cx="50" cy="50" r="32" stroke-width="8" stroke="#93dbe9" stroke-dasharray="50.26548245743669 50.26548245743669" fill="none" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" keyTimes="0;1" values="0 50 50;360 50 50"></animateTransform></circle></svg>`;
const spellCheckIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v200h-80v-200H200v560h240v80H200Zm520-40-56-56 103-104-103-104 56-56 160 160-160 160ZM280-600h320v-80H280v80Zm0 160h160v-80H280v80Z"/></svg>`;
const rephraseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80ZM120-80q-33 0-56.5-23.5T40-160v-640q0-33 23.5-56.5T120-880h520l280 280v520q0 33-23.5 56.5T840-80H120Zm540-550v-170H120v640h720v-470H660Zm-20 170h170L640-630v170Z"/></svg>`;


// --- Logique de communication avec le script d'arrière-plan ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Répond au "ping" du popup pour confirmer que le script est actif
    if (request.type === 'ping') {
        sendResponse({ status: 'pong' });
        return true;
    }

    // Fournit les données de la discussion au popup pour le résumé
    if (request.type === 'getDiscussionData') {
        const firstPost = document.querySelector('.topic-post:first-of-type');
        const solutionPost = document.querySelector('.accepted-text')?.closest('.topic-post');

        const data = {
            title: document.querySelector('a.fancy-title')?.innerText.trim(),
            categories: Array.from(document.querySelectorAll('.topic-category .badge-category__name')).map(c => c.innerText),
            tags: Array.from(document.querySelectorAll('.list-tags .discourse-tag')).map(t => t.innerText),
            firstPost: firstPost?.querySelector('.cooked')?.innerText,
            solutionPost: solutionPost?.querySelector('.cooked')?.innerText.trim() || null,
            fullText: Array.from(document.querySelectorAll('.topic-post .cooked')).map(p => p.innerText).join('\n\n---\n\n'),
            postCount: document.querySelectorAll('.topic-post').length,

            // --- Données ajoutées ---
            originalPosterUsername: firstPost?.querySelector('.topic-meta-data .names span')?.innerText.trim(),
            originalPosterAvatar: firstPost?.querySelector('.post-avatar .avatar')?.src,
            solutionAuthorUsername: solutionPost?.querySelector('.topic-meta-data .names span')?.innerText.trim(),
            solutionAuthorAvatar: solutionPost?.querySelector('.post-avatar .avatar')?.src,
            solutionLink: solutionPost ? new URL(solutionPost.querySelector('.post-date a').href).pathname : null
        };
        
        // Collecte les tags pour la fonctionnalité d'autocomplétion
        if (data.tags.length > 0) {
            chrome.storage.local.get('allKnownTags', (result) => {
                const knownTags = new Set(result.allKnownTags || []);
                data.tags.forEach(tag => knownTags.add(tag));
                chrome.storage.local.set({ allKnownTags: Array.from(knownTags).sort() });
            });
        }

        sendResponse(data);
        return true;
    }
});

// --- Initialisation et création de l'interface utilisateur ---

// Initialise l'extension en récupérant les données depuis le stockage
function initialize() {
    chrome.storage.local.get(['personas', 'lastUsedPersonaId'], (result) => {
        if (result.personas && result.personas.length > 0) {
            personas = result.personas;
            lastUsedPersonaId = result.lastUsedPersonaId;
            findAndAddButtons();
        }
    });
}

// Cherche les barres d'outils de l'éditeur et y ajoute les boutons
function findAndAddButtons() {
    if (personas.length === 0) return;

    const toolbars = document.querySelectorAll('.d-editor-button-bar:not(.ai-processed)');

    toolbars.forEach(toolbar => {
        if (toolbar.querySelector('.ai-controls-container')) {
            toolbar.classList.add('ai-processed');
            return;
        }

        const container = document.createElement('div');
        container.className = 'ai-controls-container';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.gap = '5px';
        container.style.marginLeft = '10px';
        container.style.position = 'relative';

        // --- Bouton de correction orthographique ---
        const spellCheckButton = document.createElement('button');
        spellCheckButton.className = 'btn btn-default spell-check-button';
        spellCheckButton.innerHTML = spellCheckIconSvg;
        spellCheckButton.title = 'Corriger l\'orthographe';
        spellCheckButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleSpellCheckClick(spellCheckButton);
        });

        // --- Bouton de reformulation (avec menu) ---
        const rephraseButton = document.createElement('button');
        rephraseButton.className = 'btn btn-default rephrase-button';
        rephraseButton.innerHTML = rephraseIconSvg;
        rephraseButton.title = 'Reformuler la réponse par IA';

        const rephraseMenu = document.createElement('div');
        rephraseMenu.className = 'persona-menu hidden';

        personas.forEach(persona => {
            const menuItem = document.createElement('div');
            menuItem.className = 'persona-menu-item';
            menuItem.textContent = persona.name;
            menuItem.dataset.id = persona.id;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                rephraseMenu.classList.add('hidden');
                handleRephraseClick(rephraseButton, persona.id);
            });
            rephraseMenu.appendChild(menuItem);
        });

        rephraseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Fermer les autres menus au cas où
            document.querySelectorAll('.persona-menu').forEach(menu => menu.classList.add('hidden'));
            rephraseMenu.classList.toggle('hidden');
        });

        // --- Bouton de génération automatique (avec menu) ---
        const personaButton = document.createElement('button');
        personaButton.className = 'btn btn-default persona-button';
        personaButton.innerHTML = userIconSvg;
        personaButton.title = 'Génération automatique par IA';
        
        const personaMenu = document.createElement('div');
        personaMenu.className = 'persona-menu hidden';

        personas.forEach(persona => {
            const menuItem = document.createElement('div');
            menuItem.className = 'persona-menu-item';
            menuItem.textContent = persona.name;
            menuItem.dataset.id = persona.id;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                personaMenu.classList.add('hidden');
                handleAiButtonClick(personaButton, persona.id);
            });
            personaMenu.appendChild(menuItem);
        });

        personaButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Fermer les autres menus au cas où
            document.querySelectorAll('.persona-menu').forEach(menu => menu.classList.add('hidden'));
            personaMenu.classList.toggle('hidden');
        });

        // --- Ajout des éléments au DOM ---
        container.appendChild(spellCheckButton);
        container.appendChild(rephraseButton);
        container.appendChild(rephraseMenu);
        container.appendChild(personaButton);
        container.appendChild(personaMenu);
        
        toolbar.appendChild(container);
        toolbar.classList.add('ai-processed');
    });
}

// Gère la correction orthographique
async function handleSpellCheckClick(button) {
    const editorTextarea = document.querySelector('.d-editor-input');
    if (!editorTextarea || !editorTextarea.value) return;

    button.innerHTML = spinnerSvg;
    button.disabled = true;

    try {
        const text = editorTextarea.value;
        const params = new URLSearchParams();
        params.append('text', text);
        params.append('language', 'fr');

        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            body: params,
        });

        if (!response.ok) {
            throw new Error(`Erreur API : ${response.statusText}`);
        }

        const data = await response.json();
        let correctedText = text;
        let offset = 0;

        data.matches.forEach(match => {
            if (match.replacements.length > 0) {
                const originalFragment = correctedText.substring(match.offset + offset, match.offset + offset + match.length);
                const newFragment = match.replacements[0].value;
                correctedText = correctedText.substring(0, match.offset + offset) + newFragment + correctedText.substring(match.offset + offset + match.length);
                offset += newFragment.length - originalFragment.length;
            }
        });

        editorTextarea.value = correctedText;
        editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));

    } catch (error) {
        console.error('Erreur de correction orthographique:', error);
        button.title = `Erreur: ${error.message}`;
    } finally {
        button.innerHTML = spellCheckIconSvg;
        button.disabled = false;
    }
}

// Gère la reformulation du texte
async function handleRephraseClick(button, personaId) {
    const editorTextarea = document.querySelector('.d-editor-input');
    if (!editorTextarea || !editorTextarea.value) return;

    button.innerHTML = spinnerSvg;
    button.disabled = true;

    try {
        const textToRephrase = editorTextarea.value;
        const persona = personas.find(p => p.id === personaId);

        if (!persona) {
            throw new Error("Persona non trouvée.");
        }

        chrome.runtime.sendMessage({
            type: 'rephraseText',
            text: textToRephrase,
            personaId: persona.id
        }, (response) => {
            if (chrome.runtime.lastError || response.error) {
                console.error('Erreur de reformulation:', chrome.runtime.lastError || response.error);
                button.title = `Erreur: ${response.error || chrome.runtime.lastError.message}`;
            } else {
                insertReply(response.text);
                // Mettre à jour la dernière persona utilisée
                chrome.storage.local.set({ lastUsedPersonaId: persona.id });
            }
            button.innerHTML = rephraseIconSvg;
            button.disabled = false;
        });

    } catch (error) {
        console.error('Erreur de reformulation:', error);
        button.title = `Erreur: ${error.message}`;
        button.innerHTML = rephraseIconSvg;
        button.disabled = false;
    }
}

// Gère la génération de la réponse IA
function handleAiButtonClick(button, personaId) {
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return;

    button.innerHTML = spinnerSvg;
    button.disabled = true;
    button.title = `Génération avec : ${persona.name}`;

    chrome.storage.local.set({ lastUsedPersonaId: persona.id });

    const posts = Array.from(document.querySelectorAll('.topic-post .cooked')).map(p => p.innerText).join('\n\n---\n\n');
    const tags = Array.from(document.querySelectorAll('.list-tags .discourse-tag')).map(t => t.innerText);
    const title = document.querySelector('a.fancy-title')?.innerText.trim();
    const categories = Array.from(document.querySelectorAll('.topic-category .badge-category__name')).map(c => c.innerText);

    chrome.runtime.sendMessage({
        type: 'generateReply',
        personaId: personaId,
        context: posts, tags, title, categories
    }, (response) => {
        button.innerHTML = userIconSvg;
        button.disabled = false;
        if (response.error) {
            console.error('Erreur de l\'API Gemini:', response.error);
            button.title = `Erreur - ${response.error}`;
        } else {
            insertReply(response.text);
        }
    });
}

// Insère le texte généré dans l'éditeur
function insertReply(text) {
    const editorTextarea = document.querySelector('.d-editor-input');
    if (editorTextarea) {
        editorTextarea.value = text;
        editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        console.error('Impossible de trouver l\'éditeur de réponse.');
    }
}

// Ferme les menus en cliquant à l'extérieur
document.addEventListener('click', () => {
    document.querySelectorAll('.persona-menu').forEach(menu => menu.classList.add('hidden'));
});

// --- Logique d'exécution ---
function runObserver() {
    findAndAddButtons();
    processCodeBlocks();
}

initialize();
const observer = new MutationObserver(runObserver);
observer.observe(document.body, { childList: true, subtree: true });

// --- MODALE ET ANALYSE DE CODE ---

// Crée une modale unique pour afficher les résultats de l'IA
function createCodeAiModal() {
    if (document.getElementById('code-ai-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'code-ai-modal';
    modal.className = 'code-ai-modal hidden';
    modal.innerHTML = `
        <div class="code-ai-modal-content">
            <div class="modal-header-buttons">
                <button id="code-ai-modal-copy" class="code-ai-modal-button" title="Copier le contenu">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <button id="code-ai-modal-close" class="code-ai-modal-button">&times;</button>
            </div>
            <div id="code-ai-modal-body"></div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('code-ai-modal-close').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('code-ai-modal-copy').addEventListener('click', (e) => {
        e.stopPropagation();
        copyModalContentToClipboard(e.currentTarget);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

function showCodeAiModal(content) {
    const modal = document.getElementById('code-ai-modal');
    const body = document.getElementById('code-ai-modal-body');
    body.innerHTML = content;
    modal.classList.remove('hidden');
}

// Gère le clic sur un bouton d'action de code
function handleCodeActionClick(action, button, codeElement) {
    const code = codeElement.innerText;
    if (!code) return;

    button.innerHTML = spinnerSvg;
    button.disabled = true;

    showCodeAiModal(`<div style="text-align: center;">${spinnerSvg} Analyse en cours...</div>`);

    chrome.runtime.sendMessage({ type: action, code: code }, (response) => {
        if (chrome.runtime.lastError || response.error) {
            console.error(`Erreur pour l'action ${action}:`, chrome.runtime.lastError || response.error);
            showCodeAiModal(`<div style="color: red;">Erreur: ${response.error || chrome.runtime.lastError.message}</div>`);
        } else {
            showCodeAiModal(response.text);
        }
        button.innerHTML = button.dataset.originalContent;
        button.disabled = false;
    });
}

// Fonction pour copier le contenu de la modale
function copyModalContentToClipboard(button) {
    const contentToCopy = document.getElementById('code-ai-modal-body').innerText;
    navigator.clipboard.writeText(contentToCopy).then(() => {
        const originalText = button.innerHTML;
        const originalTitle = button.title;
        button.innerHTML = 'Copié !';
        button.title = 'Contenu copié !';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.title = originalTitle;
        }, 1500);
    }).catch(err => {
        console.error('Erreur lors de la copie:', err);
        const originalText = button.innerHTML;
        const originalTitle = button.title;
        button.innerHTML = 'Erreur !';
        button.title = 'Erreur lors de la copie !';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.title = originalTitle;
        }, 1500);
    });
}

// Trouve les blocs de code et ajoute les boutons
function processCodeBlocks() {
    const codeBlocks = document.querySelectorAll('pre:not(.ai-code-processed)');
    if (codeBlocks.length === 0) return;

    codeBlocks.forEach(preElement => {
        const codeElement = preElement.querySelector('code');
        if (!codeElement) return;

        preElement.classList.add('ai-code-processed');
        preElement.style.position = 'relative';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'code-action-buttons';

        const actions = [
            { id: 'explain', title: 'Expliquer ce code', icon: spellCheckIconSvg, action: 'explainCode' },
            { id: 'verify', title: 'Vérifier ce code', icon: rephraseIconSvg, action: 'verifyCode' },
            { id: 'optimize', title: 'Optimiser ce code', icon: rephraseIconSvg, action: 'optimizeCode' },
            { id: 'comment', title: 'Commenter ce code', icon: spellCheckIconSvg, action: 'commentCode' }
        ];

        actions.forEach(({ id, title, icon, action }) => {
            const button = document.createElement('button');
            button.className = `btn btn-default code-action-btn code-action-${id}`;
            button.title = title;
            button.innerHTML = icon;
            button.dataset.originalContent = icon;
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCodeActionClick(action, button, codeElement);
            });
            buttonContainer.appendChild(button);
        });

        preElement.appendChild(buttonContainer);
    });
}
createCodeAiModal();


// --- STYLES ---
const style = document.createElement('style');
style.textContent = `
    .persona-menu {
        position: absolute;
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        z-index: 1000;
        min-width: 150px;
        color: #222;
    }
    .persona-menu-item {
        padding: 10px;
        cursor: pointer;
    }
    .persona-menu-item:hover {
        background-color: #f5f5f5;
    }
    .hidden { display: none; }

    /* Styles pour le mode sombre */
    .dark-scheme .persona-menu {
        background-color: #333;
        border-color: #555;
        color: #ddd;
    }
    .dark-scheme .persona-menu-item:hover {
        background-color: #4a4a4a;
    }

    /* Styles pour les boutons d'action sur le code */
    .code-action-buttons {
        position: absolute;
        top: 5px;
        right: 5px;
        display: flex;
        gap: 5px;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
        background-color: rgba(255, 255, 255, 0.8);
        padding: 4px;
        border-radius: 4px;
    }
    pre:hover .code-action-buttons {
        opacity: 1;
    }
    .dark-scheme .code-action-buttons {
        background-color: rgba(50, 50, 50, 0.8);
    }
    .code-action-btn {
        padding: 2px 5px;
        line-height: 1;
    }
    .code-action-btn svg {
        width: 16px;
        height: 16px;
    }

    /* Styles pour la modale */
    .code-ai-modal {
        position: fixed;
        z-index: 2000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .code-ai-modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 20px;
        border: 1px solid #888;
        border-radius: 5px;
        width: 80%;
        max-width: 600px;
        position: relative;
        color: #222;
        line-height: 1.6;
        overflow-wrap: break-word;
    }
     .dark-scheme .code-ai-modal-content {
        background-color: #333;
        border-color: #555;
        color: #ddd;
    }
    .code-ai-modal-close {
        color: #aaa;
        position: absolute;
        top: 5px;
        right: 15px;
        font-size: 28px;
        font-weight: bold;
        background: none;
        border: none;
        cursor: pointer;
    }
    .dark-scheme .code-ai-modal-close {
        color: #888;
    }
    .code-ai-modal-close:hover,
    .code-ai-modal-close:focus {
        color: #555;
        text-decoration: none;
    }
    .dark-scheme .code-ai-modal-close:hover,
    .dark-scheme .code-ai-modal-close:focus {
        color: #ccc;
    }
    #code-ai-modal-body ul {
        padding-left: 20px;
        margin-top: 10px;
    }
    #code-ai-modal-body li {
        margin-bottom: 8px;
    }
    #code-ai-modal-body pre {
        white-space: pre-wrap;
        word-wrap: break-word;
    }

    /* Styles pour l'en-tête de la modale et les boutons */
    .modal-header-buttons {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 5px;
        z-index: 2001;
    }
    .code-ai-modal-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
        color: #aaa;
        padding: 5px;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s, color 0.2s;
    }
    .code-ai-modal-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
        color: #555;
    }
    .dark-scheme .code-ai-modal-button {
        color: #888;
    }
    .dark-scheme .code-ai-modal-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #ccc;
    }
    /* Style spécifique pour l'icône du bouton de copie */
    #code-ai-modal-copy svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
    }
`;
document.head.appendChild(style);