// Détection automatique de l'API disponible
const devApi = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
    // --- 0. Modèles d'IA disponibles ---
    const AVAILABLE_MODELS = [
        { value: 'gemini-3-flash', label: '3 Flash' },
        { value: 'gemini-3-pro', label: '3 Pro' },
        { value: 'gemini-2.5-flash', label: '2.5 Flash' },
        { value: 'gemini-2.5-pro', label: '2.5 Pro' },
        { value: 'gemini-2.5-flash-lite', label: '2.5 Flash Lite' }
    ];

    // --- 1. Éléments du DOM ---
    const manifest = devApi.runtime.getManifest();
    document.getElementById('extension-version').textContent = manifest.version;

    // Paramètres globaux
    const apiKeyInput = document.getElementById('apiKey');
    const enableIconsCheckbox = document.getElementById('enableIcons');
    const showSpellCheckButtonCheckbox = document.getElementById('show-spell-check-button');
    const showRephraseButtonCheckbox = document.getElementById('show-rephrase-button');
    const showPersonaButtonCheckbox = document.getElementById('show-persona-button');
    const showParagraphsButtonCheckbox = document.getElementById('show-paragraphs-button');

    // Interface des Personas
    const personaListDiv = document.getElementById('persona-list');
    const addPersonaBtn = document.getElementById('add-persona-btn');
    const personaEditorDiv = document.getElementById('persona-editor');
    const personaEditorTitle = document.getElementById('persona-editor-title');
    const personaIdInput = document.getElementById('persona-id');
    const personaNameInput = document.getElementById('persona-name');
    const personaCustomPromptInput = document.getElementById('persona-customPrompt');
    const personaPrefixInput = document.getElementById('persona-prefix');
    const personaSuffixInput = document.getElementById('persona-suffix');
    const personaToneInput = document.getElementById('persona-tone');
    const personaLengthInput = document.getElementById('persona-length');
    const personaLanguageInput = document.getElementById('persona-language');
    const personaModelInput = document.getElementById('persona-model');
    const savePersonaBtn = document.getElementById('save-persona-btn');
    const cancelPersonaBtn = document.getElementById('cancel-persona-btn');
    const deletePersonaBtn = document.getElementById('delete-persona-btn');
    const exportPersonasBtn = document.getElementById('export-personas-btn');
    const importPersonasBtn = document.getElementById('import-personas-btn');
    const importFileInput = document.getElementById('import-file');

    // Modèles par fonctionnalité
    const modelSummarizeDiscussionSelect = document.getElementById('model-summarizeDiscussion');
    const modelExplainCodeSelect = document.getElementById('model-explainCode');
    const modelVerifyCodeSelect = document.getElementById('model-verifyCode');
    const modelOptimizeCodeSelect = document.getElementById('model-optimizeCode');
    const modelCommentCodeSelect = document.getElementById('model-commentCode');
    const modelRephraseTextSelect = document.getElementById('model-rephraseText');


    // Interface des liens par tag
    const tagLinksListDiv = document.getElementById('tag-links-list');
    const newTagNameInput = document.getElementById('new-tag-name');
    const newTagLinksInput = document.getElementById('new-tag-links');
    const addTagBtn = document.getElementById('add-tag-btn');
    const cancelTagEditBtn = document.getElementById('cancel-tag-edit-btn');
    const testPersonaBtn = document.getElementById('test-persona-btn');
    const personaPreviewResult = document.getElementById('persona-preview-result');
    const exportTagLinksBtn = document.getElementById('export-tag-links-btn');
    const importTagLinksBtn = document.getElementById('import-tag-links-btn');
    const importTagLinksFile = document.getElementById('import-tag-links-file');

    // Interface des paragraphes pré-enregistrés
    const paragraphsListDiv = document.getElementById('paragraphs-list');
    const newParagraphTitleInput = document.getElementById('new-paragraph-title');
    const newParagraphContentInput = document.getElementById('new-paragraph-content');
    const addParagraphBtn = document.getElementById('add-paragraph-btn');
    const cancelParagraphEditBtn = document.getElementById('cancel-paragraph-edit-btn');
    const exportParagraphsBtn = document.getElementById('export-paragraphs-btn');
    const importParagraphsBtn = document.getElementById('import-paragraphs-btn');
    const importParagraphsFile = document.getElementById('import-paragraphs-file');
    const defaultOpeningParagraphSelect = document.getElementById('default-opening-paragraph');
    const defaultClosingParagraphSelect = document.getElementById('default-closing-paragraph');

    // Général
    const saveButton = document.getElementById('save');
    const statusDiv = document.getElementById('status');


    // --- 2. État de l'application ---
    let personas = [];
    let tagLinkMappings = [];
    let currentEditingPersonaId = null;
    let editingTagIndex = -1;
    let allKnownTags = [];
    let autocompleteCurrentFocus = -1;
    let paragraphs = [];
    let editingParagraphIndex = -1;

    // --- Assistant pour les messages de statut ---
    function showStatusMessage(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? 'red' : 'green';
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    }


    // --- 3. Logique d'autocomplétion pour les Tags ---
    function initAutocomplete(inp, arr) {
        inp.addEventListener("input", function(e) {
            let a, b, i, val = this.value;
            closeAllLists();
            if (!val) { return false; }
            autocompleteCurrentFocus = -1;
            a = document.createElement("DIV");
            a.setAttribute("id", this.id + "autocomplete-list");
            a.setAttribute("class", "autocomplete-items");
            this.parentNode.appendChild(a);

            for (i = 0; i < arr.length; i++) {
                if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
                    b = document.createElement("DIV");
                    
                    const strong = document.createElement("strong");
                    strong.textContent = arr[i].substr(0, val.length);
                    b.appendChild(strong);

                    b.appendChild(document.createTextNode(arr[i].substr(val.length)));
                    
                    const inputHidden = document.createElement("input");
                    inputHidden.type = "hidden";
                    inputHidden.value = arr[i];
                    b.appendChild(inputHidden);

                    b.addEventListener("click", function(e) {
                        inp.value = this.getElementsByTagName("input")[0].value;
                        closeAllLists();
                    });
                    a.appendChild(b);
                }
            }
        });

        inp.addEventListener("keydown", function(e) {
            let x = document.getElementById(this.id + "autocomplete-list");
            if (x) x = x.getElementsByTagName("div");
            if (e.keyCode == 40) {
                autocompleteCurrentFocus++;
                addActive(x);
            } else if (e.keyCode == 38) {
                autocompleteCurrentFocus--;
                addActive(x);
            } else if (e.keyCode == 13) {
                e.preventDefault();
                if (autocompleteCurrentFocus > -1) {
                    if (x) x[autocompleteCurrentFocus].click();
                }
            } else if (e.keyCode == 27) {
                closeAllLists();
            }
        });

        function addActive(x) {
            if (!x) return false;
            removeActive(x);
            if (autocompleteCurrentFocus >= x.length) autocompleteCurrentFocus = 0;
            if (autocompleteCurrentFocus < 0) autocompleteCurrentFocus = (x.length - 1);
            x[autocompleteCurrentFocus].classList.add("autocomplete-active");
        }

        function removeActive(x) {
            for (let i = 0; i < x.length; i++) {
                x[i].classList.remove("autocomplete-active");
            }
        }

        function closeAllLists(elmnt) {
            const x = document.getElementsByClassName("autocomplete-items");
            for (let i = 0; i < x.length; i++) {
                if (elmnt != x[i] && elmnt != inp) {
                    x[i].parentNode.removeChild(x[i]);
                }
            }
        }
        document.addEventListener("click", function (e) {
            closeAllLists(e.target);
        });
    }


    // --- 4. Logique des Personas ---

    // Fonctions d'export/import des Personas
    function exportPersonas() {
        const dataStr = JSON.stringify(personas, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jeedom_ai_personas.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatusMessage('Personas exportées avec succès !');
    }

    function importPersonas(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    throw new Error('Le fichier JSON doit contenir un tableau de personas.');
                }

                const validPersonas = importedData.filter(p => p.id && p.name && p.customPrompt); // Validation basique
                if (validPersonas.length === 0 && importedData.length > 0) {
                    throw new Error('Aucune persona valide trouvée dans le fichier.');
                }

                // Fusionner ou remplacer ? Pour simplifier, remplacement ou ajout si nouvel ID.
                // Une logique plus complexe pourrait demander à l'utilisateur ou fusionner par ID.
                validPersonas.forEach(importedPersona => {
                    const existingIndex = personas.findIndex(p => p.id === importedPersona.id);
                    if (existingIndex > -1) {
                        personas[existingIndex] = importedPersona; // Remplacer existant
                    } else {
                        personas.push(importedPersona); // Ajouter nouveau
                    }
                });

                // S'assurer que les ID sont uniques pour les nouvelles personas qui pourraient entrer en conflit
                personas = personas.map(p => {
                    if (!p.id || typeof p.id !== 'string') {
                        return { ...p, id: Date.now().toString() + Math.random().toString(36).substring(2, 9) };
                    }
                    return p;
                });

                // Filtrer les doublons basés sur l'ID après une potentielle réaffectation
                const uniquePersonas = [];
                const ids = new Set();
                personas.forEach(p => {
                    if (!ids.has(p.id)) {
                        uniquePersonas.push(p);
                        ids.add(p.id);
                    }
                });
                personas = uniquePersonas;


                renderPersonaList();
                showStatusMessage('Personas importées avec succès !');
            } catch (error) {
                showStatusMessage(`Erreur lors de l'importation: ${error.message}`, true);
            }
        };
        reader.readAsText(file);
    }

    function renderPersonaList() {
        personaListDiv.replaceChildren();
        personas.forEach(persona => {
            const item = document.createElement('div');
            item.className = 'persona-list-item';
            item.textContent = persona.name;
            item.dataset.id = persona.id;
            item.draggable = true;
            if (persona.id === currentEditingPersonaId) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => loadPersonaIntoEditor(persona.id));

            item.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', persona.id);
                e.currentTarget.classList.add('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.types.includes('text/plain')) {
                    const draggingId = e.dataTransfer.getData('text/plain');
                    if (draggingId !== persona.id) {
                        e.currentTarget.classList.add('drag-over');
                    }
                }
            });

            item.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');

                const draggedPersonaId = e.dataTransfer.getData('text/plain');
                const droppedOnPersonaId = persona.id;

                if (draggedPersonaId === droppedOnPersonaId) return;

                const draggedIndex = personas.findIndex(p => p.id === draggedPersonaId);
                const droppedOnIndex = personas.findIndex(p => p.id === droppedOnPersonaId);

                if (draggedIndex === -1 || droppedOnIndex === -1) return;

                const [draggedPersona] = personas.splice(draggedIndex, 1);
                personas.splice(droppedOnIndex, 0, draggedPersona);

                renderPersonaList();
                saveSettings(false);
            });

            item.addEventListener('dragend', (e) => {
                e.stopPropagation();
                e.currentTarget.classList.remove('dragging');
                document.querySelectorAll('.persona-list-item').forEach(el => el.classList.remove('drag-over'));
            });

            personaListDiv.appendChild(item);
        });
    }

    function showPersonaEditor(show = true) {
        personaEditorDiv.classList.toggle('hidden', !show);
        if (!show) {
            personaPreviewResult.style.display = 'none';
            personaPreviewResult.textContent = '';
        }
    }

    function loadPersonaIntoEditor(personaId) {
        const persona = personas.find(p => p.id === personaId);
        if (!persona) return;

        currentEditingPersonaId = persona.id;
        personaEditorTitle.textContent = `Modifier: ${persona.name}`;
        personaIdInput.value = persona.id;
        personaNameInput.value = persona.name;
        personaCustomPromptInput.value = persona.customPrompt;
        personaPrefixInput.value = persona.prefix || '';
        personaSuffixInput.value = persona.suffix || '';
        personaToneInput.value = persona.tone;
        personaLengthInput.value = persona.length;
        personaLanguageInput.value = persona.language;
        personaModelInput.value = persona.model;

        deletePersonaBtn.classList.remove('hidden');
        renderPersonaList();
        showPersonaEditor(true);
    }

    function clearAndShowEditor() {
        currentEditingPersonaId = null;
        personaEditorTitle.textContent = 'Nouvelle Persona';
        personaIdInput.value = '';
        personaNameInput.value = '';
        personaCustomPromptInput.value = 'Réponds de manière utile et amicale.';
        personaPrefixInput.value = '';
        personaSuffixInput.value = '';
        personaToneInput.value = 'amical et serviable';
        personaLengthInput.value = 'moyenne (quelques phrases)';
        personaLanguageInput.value = 'Français';
        personaModelInput.value = 'gemini-2.5-flash-lite';

        deletePersonaBtn.classList.add('hidden');
        renderPersonaList();
        showPersonaEditor(true);
    }

    function saveCurrentPersona() {
        const name = personaNameInput.value.trim();
        if (!name) {
            alert('Le nom de la persona est obligatoire.');
            return;
        }

        const personaData = {
            id: currentEditingPersonaId || Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name: name,
            customPrompt: personaCustomPromptInput.value,
            prefix: personaPrefixInput.value,
            suffix: personaSuffixInput.value,
            tone: personaToneInput.value,
            length: personaLengthInput.value,
            language: personaLanguageInput.value,
            model: personaModelInput.value
        };

        if (currentEditingPersonaId) {
            const index = personas.findIndex(p => p.id === currentEditingPersonaId);
            personas[index] = personaData;
        } else {
            personas.push(personaData);
        }

        currentEditingPersonaId = null;
        showPersonaEditor(false);
        renderPersonaList();
    }

    function deleteCurrentPersona() {
        if (!currentEditingPersonaId) return;
        if (confirm(`Êtes-vous sûr de vouloir supprimer la persona "${personas.find(p=>p.id === currentEditingPersonaId).name}" ?`)) {
            personas = personas.filter(p => p.id !== currentEditingPersonaId);
            currentEditingPersonaId = null;
            showPersonaEditor(false);
            renderPersonaList();
        }
    }

    function handleTestPersona() {
        const currentPersona = {
            name: personaNameInput.value.trim(),
            customPrompt: personaCustomPromptInput.value,
            prefix: personaPrefixInput.value,
            suffix: personaSuffixInput.value,
            tone: personaToneInput.value,
            length: personaLengthInput.value,
            language: personaLanguageInput.value,
            model: personaModelInput.value
        };

        personaPreviewResult.style.display = 'block';
        personaPreviewResult.style.color = '#333';
        personaPreviewResult.textContent = 'Génération de l\'aperçu...';

        devApi.runtime.sendMessage({
            type: 'testPersona',
            persona: currentPersona
        }, (response) => {
            if (devApi.runtime.lastError || response.error) {
                personaPreviewResult.style.color = 'red';
                personaPreviewResult.textContent = `Erreur: ${response.error || devApi.runtime.lastError.message}`;
            } else {
                personaPreviewResult.style.color = '#333';
                personaPreviewResult.textContent = response.text;
            }
        });
    }

    // --- 5. Logique des Liens par Tag ---
    function exportTagLinks() {
        const dataStr = JSON.stringify(tagLinkMappings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jeedom_ai_tag_links.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatusMessage('Liens par tag exportés avec succès !');
    }

    function importTagLinks(event) {
        const file = event.target.files[0];
        if (!file) {
            console.log('Aucun fichier sélectionné pour l\'importation.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    throw new Error('Le fichier JSON doit contenir un tableau de mappings de liens par tag.');
                }

                const validTagLinks = importedData.filter(m => m.tag && Array.isArray(m.links) && m.links.every(l => l.description && l.url)); // Validation basique
                if (validTagLinks.length === 0 && importedData.length > 0) {
                    throw new Error('Aucun lien par tag valide trouvé dans le fichier.');
                }

                // Pour simplifier, remplacer l'existant ou ajouter un nouveau.
                // Une logique plus complexe pourrait demander à l'utilisateur ou fusionner par nom de tag.
                validTagLinks.forEach(importedMapping => {
                    const existingIndex = tagLinkMappings.findIndex(m => m.tag === importedMapping.tag);
                    if (existingIndex > -1) {
                        tagLinkMappings[existingIndex] = importedMapping;
                    } else {
                        tagLinkMappings.push(importedMapping);
                    }
                });

                renderTagLinkList();
                showStatusMessage('Liens par tag importés avec succès !');
            } catch (error) {
                showStatusMessage(`Erreur lors de l'importation: ${error.message}`, true);
            }
        };
        reader.readAsText(file);
    }

    function renderTagLinkList() {
        tagLinkMappings.sort((a, b) => a.tag.localeCompare(b.tag));
        tagLinksListDiv.replaceChildren();
        tagLinkMappings.forEach((mapping, index) => {
            const item = document.createElement('div');
            item.className = 'tag-list-item';

            const tagNameSpan = document.createElement('span');
            tagNameSpan.className = 'tag-name';
            tagNameSpan.textContent = mapping.tag;
            item.appendChild(tagNameSpan);

            const tagLinksSpan = document.createElement('span');
            tagLinksSpan.className = 'tag-links';
            if (Array.isArray(mapping.links)) {
                mapping.links.forEach((link, lIndex) => {
                    const a = document.createElement('a');
                    a.href = link.url;
                    a.target = '_blank';
                    a.textContent = link.description;
                    tagLinksSpan.appendChild(a);
                    if (lIndex < mapping.links.length - 1) {
                        tagLinksSpan.appendChild(document.createTextNode(', '));
                    }
                });
            }
            item.appendChild(tagLinksSpan);

            const editButton = document.createElement('button');
            editButton.className = 'edit-tag-btn';
            editButton.dataset.index = index;
            editButton.textContent = 'Modifier';
            item.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-tag-btn';
            deleteButton.dataset.index = index;
            deleteButton.textContent = 'Supprimer';
            item.appendChild(deleteButton);
            tagLinksListDiv.appendChild(item);
        });

        document.querySelectorAll('.delete-tag-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.dataset.index, 10);
                if (confirm('Êtes-vous sûr de vouloir supprimer ce lien par tag ?')) {
                    tagLinkMappings.splice(indexToRemove, 1);
                    renderTagLinkList();
                }
            });
        });

        document.querySelectorAll('.edit-tag-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const indexToEdit = parseInt(e.target.dataset.index, 10);
                const tagToEdit = tagLinkMappings[indexToEdit];
                newTagNameInput.value = tagToEdit.tag;
                newTagLinksInput.value = tagToEdit.links.map(link => `${link.description}|${link.url}`).join(', ');
                addTagBtn.textContent = 'Mettre à jour';
                cancelTagEditBtn.classList.remove('hidden');
                editingTagIndex = indexToEdit;
            });
        });
    }

    function saveTagLink() {
        const tag = newTagNameInput.value.trim();
        const linksInput = newTagLinksInput.value.trim();
        if (!tag || !linksInput) return;

        const parsedLinks = linksInput.split(',').map(linkStr => {
            const parts = linkStr.trim().split('|');
            if (parts.length === 2) {
                return { description: parts[0].trim(), url: parts[1].trim() };
            } else if (parts.length === 1) {
                const url = parts[0].trim();
                return { description: url, url: url };
            }
            return null;
        }).filter(link => link && link.url);

        if (parsedLinks.length === 0) {
            alert('Veuillez entrer au moins une URL valide au format description|url.');
            return;
        }

        if (editingTagIndex !== -1) {
            tagLinkMappings[editingTagIndex] = { tag, links: parsedLinks };
            editingTagIndex = -1;
            addTagBtn.textContent = 'Ajouter';
            cancelTagEditBtn.classList.add('hidden');
        } else {
            if (tagLinkMappings.some(m => m.tag === tag)) {
                alert('Ce tag existe déjà.');
                return;
            }
            tagLinkMappings.push({ tag, links: parsedLinks });
        }
        newTagNameInput.value = '';
        newTagLinksInput.value = '';
        renderTagLinkList();
    }

    // --- 6. Logique des paragraphes pré-enregistrés ---
    function renderParagraphsList() {
        paragraphs.sort((a, b) => a.title.localeCompare(b.title));
        paragraphsListDiv.replaceChildren();
        paragraphs.forEach((paragraph, index) => {
            const item = document.createElement('div');
            item.className = 'paragraph-list-item';

            const paragraphTitleSpan = document.createElement('span');
            paragraphTitleSpan.className = 'paragraph-title';
            paragraphTitleSpan.textContent = paragraph.title;
            item.appendChild(paragraphTitleSpan);

            const paragraphContentSpan = document.createElement('span');
            paragraphContentSpan.className = 'paragraph-content';
            paragraphContentSpan.textContent = paragraph.content;
            item.appendChild(paragraphContentSpan);

            const editButton = document.createElement('button');
            editButton.className = 'edit-paragraph-btn';
            editButton.dataset.index = index;
            editButton.textContent = 'Modifier';
            item.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-paragraph-btn';
            deleteButton.dataset.index = index;
            deleteButton.textContent = 'Supprimer';
            item.appendChild(deleteButton);
            paragraphsListDiv.appendChild(item);
        });

        document.querySelectorAll('.delete-paragraph-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.dataset.index, 10);
                if (confirm('Êtes-vous sûr de vouloir supprimer ce paragraphe ?')) {
                    paragraphs.splice(indexToRemove, 1);
                    renderParagraphsList();
                }
            });
        });

        document.querySelectorAll('.edit-paragraph-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const indexToEdit = parseInt(e.target.dataset.index, 10);
                const paragraphToEdit = paragraphs[indexToEdit];
                newParagraphTitleInput.value = paragraphToEdit.title;
                newParagraphContentInput.value = paragraphToEdit.content;
                addParagraphBtn.textContent = 'Mettre à jour le paragraphe';
                cancelParagraphEditBtn.classList.remove('hidden');
                editingParagraphIndex = indexToEdit;
            });
        });
    }

    function populateDefaultParagraphSelects() {
        [defaultOpeningParagraphSelect, defaultClosingParagraphSelect].forEach(selectElement => {
            selectElement.replaceChildren();
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Aucun';
            selectElement.appendChild(defaultOption);
            paragraphs.forEach(paragraph => {
                const option = document.createElement('option');
                option.value = paragraph.title;
                option.textContent = paragraph.title;
                selectElement.appendChild(option);
            });
        });
    }

    function saveParagraph() {
        const title = newParagraphTitleInput.value.trim();
        const content = newParagraphContentInput.value.trim();
        if (!title || !content) return;

        if (editingParagraphIndex !== -1) {
            paragraphs[editingParagraphIndex] = { title, content };
            editingParagraphIndex = -1;
            addParagraphBtn.textContent = 'Ajouter le paragraphe';
            cancelParagraphEditBtn.classList.add('hidden');
        } else {
            if (paragraphs.some(p => p.title === title)) {
                alert('Ce titre de paragraphe existe déjà.');
                return;
            }
            paragraphs.push({ title, content });
        }
        newParagraphTitleInput.value = '';
        newParagraphContentInput.value = '';
        renderParagraphsList();
    }

    function cancelEditParagraph() {
        newParagraphTitleInput.value = '';
        newParagraphContentInput.value = '';
        editingParagraphIndex = -1;
        addParagraphBtn.textContent = 'Ajouter le paragraphe';
        cancelParagraphEditBtn.classList.add('hidden');
    }

    function exportParagraphs() {
        const dataStr = JSON.stringify(paragraphs, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jeedom_ai_paragraphs.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatusMessage('Paragraphes exportés avec succès !');
    }

    function importParagraphs(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    throw new Error('Le fichier JSON doit contenir un tableau de paragraphes.');
                }
                const validParagraphs = importedData.filter(p => p.title && p.content);
                validParagraphs.forEach(importedParagraph => {
                    const existingIndex = paragraphs.findIndex(p => p.title === importedParagraph.title);
                    if (existingIndex > -1) {
                        paragraphs[existingIndex] = importedParagraph;
                    } else {
                        paragraphs.push(importedParagraph);
                    }
                });
                renderParagraphsList();
                showStatusMessage('Paragraphes importés avec succès !');
            } catch (error) {
                showStatusMessage(`Erreur lors de l'importation: ${error.message}`, true);
            }
        };
        reader.readAsText(file);
    }

    // --- 8. Sauvegarde/Chargement Principal ---

    function populateModelSelects() {
        const selects = document.querySelectorAll('.ai-model-select');
        selects.forEach(select => {
            select.querySelectorAll('option:not([value="default"])').forEach(option => option.remove());
            AVAILABLE_MODELS.forEach(model => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.label;
                select.appendChild(option);
            });
        });
    }

    function loadSettings() {
        const keysToLoad = [
            'apiKey', 'enableIcons', 'personas', 'tagLinkMappings', 'paragraphs', 'tagToPrepopulate', 'allKnownTags', 'modelSettings',
            'defaultOpeningParagraphId', 'defaultClosingParagraphId',
            'showSpellCheckButton', 'showRephraseButton', 'showPersonaButton', 'showParagraphsButton'
        ];

        devApi.storage.local.get(keysToLoad, (result) => {
            populateModelSelects();

            if (result.apiKey) apiKeyInput.value = result.apiKey;
            enableIconsCheckbox.checked = result.enableIcons !== undefined ? result.enableIcons : true;

            showSpellCheckButtonCheckbox.checked = result.showSpellCheckButton !== undefined ? result.showSpellCheckButton : true;
            showRephraseButtonCheckbox.checked = result.showRephraseButton !== undefined ? result.showRephraseButton : true;
            showPersonaButtonCheckbox.checked = result.showPersonaButton !== undefined ? result.showPersonaButton : true;
            showParagraphsButtonCheckbox.checked = result.showParagraphsButton !== undefined ? result.showParagraphsButton : true;


            // Chargement des personas
            if (result.personas && result.personas.length > 0) {
                personas = result.personas;
            } else {
                // Créer un jeu de personas par défaut si aucun n'existe
                personas = [
                    {
                        id: 'default-1',
                        name: 'Aide Amicale',
                        customPrompt: 'Tu es un membre amical et patient de la communauté. Explique les concepts clairement, étape par étape si nécessaire. Adopte un ton encourageant et accessible, surtout pour les utilisateurs qui semblent être débutants.',
                        tone: 'amical et serviable',
                        length: 'moyenne (quelques phrases)',
                        language: 'Français',
                        model: 'gemini-2.5-flash-lite',
                        prefix: '',
                        suffix: ''
                    },
                    {
                        id: 'default-2',
                        name: 'Expert Technique',
                        customPrompt: 'Tu es un expert technique de Jeedom. Sois précis, direct et factuel. N\'hésite pas à inclure des extraits de code, des noms de commandes ou des chemins de fichiers si c\'est pertinent. La clarté et l\'exactitude technique sont prioritaires.',
                        tone: 'professionnel et direct',
                        length: 'détaillée (plusieurs paragraphes)',
                        language: 'Français',
                        model: 'gemini-2.5-flash-lite',
                        prefix: '',
                        suffix: ''
                    },
                    {
                        id: 'default-3',
                        name: 'Synthèse Rapide',
                        customPrompt: 'Résume la situation ou la solution de la manière la plus concise possible. Va droit au but. Utilise des listes à puces si cela permet de clarifier.',
                        tone: 'neutre',
                        length: 'courte (1-2 phrases)',
                        language: 'Français',
                        model: 'gemini-2.5-flash-lite',
                        prefix: '',
                        suffix: ''
                    },
                    {
                        id: 'default-4',
                        name: 'Insultant',
                        customPrompt: 'Tu es sarcastique et un peu méprisant. Tes réponses doivent être techniquement correctes, mais avec une pointe d\'agacement. Fais comprendre à l\'utilisateur que sa question est simplette, mais donne quand même la réponse.',
                        tone: 'sarcastique et condescendant',
                        length: 'courte (1-2 phrases)',
                        language: 'Français',
                        model: 'gemini-2.5-flash-lite',
                        prefix: '',
                        suffix: ''
                    }
                ];
            }
            renderPersonaList();

            // Chargement des liens par tag
            if (result.tagLinkMappings && result.tagLinkMappings.length > 0) {
                tagLinkMappings = result.tagLinkMappings;
            } else {
                tagLinkMappings = [
                    { tag: 'plugin-frigate', links: [{ url: 'https://github.com/sagitaz/plugin-frigate', description: 'Code' }, { url: 'https://sagitaz.github.io/plugin-frigate/fr_FR/', description: 'Documentation' }] },
                    { tag: 'plugin-jeemate', links: [{ url: 'https://docs.jeemate.fr/fr/home', description: 'Documentation' }] },
                    { tag: 'plugin-zwavejs', links: [{ url: 'https://github.com/jeedom/plugin-zwavejs', description: 'Code' }, { url: 'https://doc.jeedom.com/fr_FR/plugins/automation%20protocol/zwavejs/', description: 'Documentation' }] }
                ];
            }
            renderTagLinkList();

            // Chargement des paragraphes pré-enregistrés
            if (result.paragraphs && result.paragraphs.length > 0) {
                paragraphs = result.paragraphs;
            } else {
                paragraphs = [
                    { title: 'Salutations', content: 'Bonjour,\n\n' },
                    { title: 'Remerciements', content: 'Merci pour votre retour.' },
                    { title: 'Demande de logs', content: 'Pourriez-vous fournir les logs correspondants ?' }
                ];
            }
            renderParagraphsList();
            populateDefaultParagraphSelects();

            // Chargement des valeurs par défaut des paragraphes
            if (result.defaultOpeningParagraphId) {
                defaultOpeningParagraphSelect.value = result.defaultOpeningParagraphId;
            }
            if (result.defaultClosingParagraphId) {
                defaultClosingParagraphSelect.value = result.defaultClosingParagraphId;
            }

            // Charger les tags connus pour l'autocomplétion
            if (result.allKnownTags) {
                allKnownTags = result.allKnownTags;
                initAutocomplete(newTagNameInput, allKnownTags);
            }

            // Chargement des modèles par fonctionnalité
            if (result.modelSettings) {
                modelSummarizeDiscussionSelect.value = result.modelSettings.summarizeDiscussion || 'default';
                modelExplainCodeSelect.value = result.modelSettings.explainCode || 'default';
                modelVerifyCodeSelect.value = result.modelSettings.verifyCode || 'default';
                modelOptimizeCodeSelect.value = result.modelSettings.optimizeCode || 'default';
                modelCommentCodeSelect.value = result.modelSettings.commentCode || 'default';
                modelRephraseTextSelect.value = result.modelSettings.rephraseText || 'default';
            }

            // Pré-remplir le champ de tag si un tag a été cliqué depuis le popup
            if (result.tagToPrepopulate) {
                newTagNameInput.value = result.tagToPrepopulate;
                devApi.storage.local.remove('tagToPrepopulate');
            }
        });
    }

    function saveSettings(showStatus = true) {
        if (!apiKeyInput.value) {
            showStatusMessage('Erreur: La clé API est requise.', true);
            return;
        }
        devApi.storage.local.set({
            apiKey: apiKeyInput.value,
            enableIcons: enableIconsCheckbox.checked,
            personas: personas,
            tagLinkMappings: tagLinkMappings,
            paragraphs: paragraphs,
            modelSettings: {
                summarizeDiscussion: modelSummarizeDiscussionSelect.value,
                explainCode: modelExplainCodeSelect.value,
                verifyCode: modelVerifyCodeSelect.value,
                optimizeCode: modelOptimizeCodeSelect.value,
                commentCode: modelCommentCodeSelect.value,
                rephraseText: modelRephraseTextSelect.value
            },
            defaultOpeningParagraphId: defaultOpeningParagraphSelect.value,
            defaultClosingParagraphId: defaultClosingParagraphSelect.value,
            showSpellCheckButton: showSpellCheckButtonCheckbox.checked,
            showRephraseButton: showRephraseButtonCheckbox.checked,
            showPersonaButton: showPersonaButtonCheckbox.checked,
            showParagraphsButton: showParagraphsButtonCheckbox.checked
        }, () => {
            if (showStatus) {
                showStatusMessage('Paramètres enregistrés !');
            }
        });
    }

    function cancelEditTagLink() {
        newTagNameInput.value = '';
        newTagLinksInput.value = '';
        editingTagIndex = -1;
        addTagBtn.textContent = 'Ajouter';
        cancelTagEditBtn.classList.add('hidden');
    }

    // --- 9. Écouteurs d'Événements ---
    addPersonaBtn.addEventListener('click', clearAndShowEditor);
    savePersonaBtn.addEventListener('click', saveCurrentPersona);
    cancelPersonaBtn.addEventListener('click', () => showPersonaEditor(false));
    deletePersonaBtn.addEventListener('click', deleteCurrentPersona);
    exportPersonasBtn.addEventListener('click', exportPersonas);
    importPersonasBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importPersonas);
    
    // Import/Export des liens par Tag
    exportTagLinksBtn.addEventListener('click', exportTagLinks);
    importTagLinksBtn.addEventListener('click', () => importTagLinksFile.click());
    importTagLinksFile.addEventListener('change', importTagLinks);
    addTagBtn.addEventListener('click', saveTagLink);
    cancelTagEditBtn.addEventListener('click', cancelEditTagLink);

    // Paragraphes pré-enregistrés
    addParagraphBtn.addEventListener('click', saveParagraph);
    cancelParagraphEditBtn.addEventListener('click', cancelEditParagraph);
    exportParagraphsBtn.addEventListener('click', exportParagraphs);
    importParagraphsBtn.addEventListener('click', () => importParagraphsFile.click());
    importParagraphsFile.addEventListener('change', importParagraphs);

    saveButton.addEventListener('click', saveSettings);
    testPersonaBtn.addEventListener('click', handleTestPersona);

    // Écouter les changements depuis d'autres parties de l'extension, comme le popup
    devApi.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.tagToPrepopulate) {
            const newValue = changes.tagToPrepopulate.newValue;
            if (newValue) {
                newTagNameInput.value = newValue;
                newTagNameInput.focus();
                devApi.storage.local.remove('tagToPrepopulate');
            }
        }
        // Mettre à jour les tags pour l'autocomplétion s'ils changent
        if (namespace === 'local' && changes.allKnownTags) {
            allKnownTags = changes.allKnownTags.newValue || [];
            initAutocomplete(newTagNameInput, allKnownTags);
        }
    });

    // --- 10. Chargement Initial ---
    loadSettings();
});