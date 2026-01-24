chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let sendResponseAsync = sendResponse;

    if (request.type === 'generateReply') {
        (async () => {
            try {
                const result = await chrome.storage.local.get(['apiKey', 'enableIcons', 'tagLinkMappings', 'personas', 'modelSettings']);
                const { apiKey, enableIcons, tagLinkMappings, personas, modelSettings } = result;

                if (!apiKey) { throw new Error('La clé API Gemini n\'est pas configurée.'); }
                if (!personas || personas.length === 0) { throw new Error('Aucune persona n\'est configurée.'); }

                const persona = personas.find(p => p.id === request.personaId);
                if (!persona) { throw new Error(`Persona avec l\'ID ${request.personaId} non trouvée.`); }

                let model = 'gemini-1.5-flash-latest'; // Modèle de secours par défaut
                if (modelSettings && modelSettings.generateReply && modelSettings.generateReply !== 'default') {
                    model = modelSettings.generateReply;
                } else {
                    model = persona.model;
                }
                if (!model) { throw new Error('Aucun modèle d\'IA n\'est configuré.'); }

                // --- Construction du contexte de la documentation ---
                let documentationContext = '';
                if (tagLinkMappings && Array.isArray(tagLinkMappings) && request.tags) {
                    const relevantLinks = [];
                    tagLinkMappings.forEach(mapping => {
                        if (request.tags.includes(mapping.tag)) {
                            mapping.links.forEach(link => {
                                relevantLinks.push(`- ${link.description}: ${link.url}`);
                            });
                        }
                    });
                    if (relevantLinks.length > 0) {
                        documentationContext = `Considère les ressources documentaires et contenu du code lié au post suivants pour enrichir ta réponse :\n${relevantLinks.join('\n')}\n\n`;
                    }
                }

                const fullReplyPrompt = `
                    Tâche : Tu es un assistant IA, expert Jeedom qui aide à rédiger des réponses pour un forum sur la domotique Jeedom.

                    Informations sur la discussion :
                    - Titre : ${request.title || 'Non disponible'}
                    - Catégories : ${request.categories && request.categories.length > 0 ? request.categories.join(' > ') : 'Non disponible'}

                    ${documentationContext}
                    Contexte de la discussion (plusieurs posts) : 
                    ${request.context}

                    Instructions de l'utilisateur (depuis la persona "${persona.name}") : ${persona.customPrompt}

                    Règles de génération :
                    - Ton à adopter : ${persona.tone}.
                    - Longueur de la réponse : ${persona.length}.
                    - Langue de la réponse : ${persona.language}.
                    ${enableIcons ? `- Tu peux inclure des emojis dans la réponse si tu estimes que c'est utile.` : ''}

                    Règles générales :
                    - Ton processus de pensée interne peut inclure une analyse structurée (identification du problème, résumé des solutions, évaluation du contexte, plan de réponse), MAIS CETTE ANALYSE NE DOIT PAS APPARAÎTRE DANS LA RÉPONSE FINALE.
                    - Rédige une réponse cohérente, pertinente et utile.
                    - La réponse doit être uniquement le texte à insérer dans l'éditeur, sans préambule ni salutation superflue.
                    - Recherche dans le code si nécessaire : https://github.com/jeedom/core pour le core de Jeedom, https://docs.jeedom.com pour la documentation de jeedom et https://community.jeedom.com pour les autres posts de community jeedom

                    Réponse suggérée :`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: fullReplyPrompt }] }] })
                });

                if (!response.ok) { throw new Error(`Erreur HTTP ! statut : ${response.status}`); }
                const data = await response.json();
                sendResponseAsync({ text: data.candidates[0].content.parts[0].text.trim() });

                chrome.storage.local.set({ lastUsedPersonaId: request.personaId });
            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'rephraseText') {
        (async () => {
            try {
                const { apiKey, personas, modelSettings } = await chrome.storage.local.get(['apiKey', 'personas', 'modelSettings']);
                if (!apiKey) { throw new Error('La clé API Gemini n\'est pas configurée.'); }
                if (!personas || personas.length === 0) { throw new Error('Aucune persona n\'est configurée.'); }

                const persona = personas.find(p => p.id === request.personaId);
                if (!persona) { throw new Error(`Persona avec l\'ID ${request.personaId} non trouvée.`); }
                
                let model = 'gemini-1.5-flash-latest'; // Modèle de secours par défaut
                if (modelSettings && modelSettings.rephraseText && modelSettings.rephraseText !== 'default') {
                    model = modelSettings.rephraseText;
                } else {
                    model = persona.model;
                }
                if (!model) { throw new Error('Aucun modèle d\'IA n\'est configuré.'); }

                const rephrasePrompt = `
                    Tâche : Tu es un expert en communication. Reformule le texte suivant en respectant les instructions de la persona.

                    Texte à reformuler :
                    --- TEXTE ORIGINAL ---
                    ${request.text}
                    --- FIN TEXTE ORIGINAL ---

                    Instructions de la persona "${persona.name}" :
                    - Ton à adopter : ${persona.tone}
                    - Longueur de la réponse : ${persona.length}
                    - Langue de la réponse : ${persona.language}
                    - Instructions personnalisées : ${persona.customPrompt}

                    Règles de génération :
                    - La réponse doit être UNIQUEMENT le texte reformulé.
                    - Ne pas ajouter de préambule, de salutations, ou de commentaires.

                    Texte reformulé :`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: rephrasePrompt }] }] })
                });

                if (!response.ok) { throw new Error(`Erreur HTTP ! statut : ${response.status}`); }
                const data = await response.json();
                sendResponseAsync({ text: data.candidates[0].content.parts[0].text.trim() });

            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'summarizeDiscussion') {
        (async () => {
            try {
                const result = await chrome.storage.local.get(['apiKey', 'personas', 'modelSettings']);
                const { apiKey, personas, modelSettings } = result;

                if (!apiKey) { throw new Error('La clé API Gemini n\'est pas configurée.'); }
                
                let model = 'gemini-1.5-flash-latest'; // Modèle de secours par défaut
                if (modelSettings && modelSettings.summarizeDiscussion && modelSettings.summarizeDiscussion !== 'default') {
                    model = modelSettings.summarizeDiscussion;
                } else if (personas && personas.length > 0) {
                    model = personas[0].model;
                }
                if (!model) { throw new Error('Aucun modèle d\'IA n\'est configuré.'); }
                

                const summaryPrompt = `
                    Tu es un expert technique qui analyse des discussions de forum sur la domotique Jeedom.
                    Voici les données de la discussion:
                    Titre: ${request.data.title}
                    Catégories: ${request.data.categories.join(' > ')}
                    Tags: ${request.data.tags.join(', ')}
                    Premier Post: ${request.data.firstPost}
                    Solution: ${request.data.solutionPost || "Aucun"}
                    Discussion complète: ${request.data.fullText}

                    Ta tâche est de retourner UNIQUEMENT un objet JSON valide avec la structure suivante:
                    {
                      "title": "${request.data.title}",
                      "problem": "Un résumé concis du problème initial.",
                      "solution": "Un résumé de la solution proposée.",
                      "summary": "Un résumé neutre et factuel de l'ensemble des échanges, utilisant des listes à puces."
                    }`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: summaryPrompt }] }] })
                });

                if (!response.ok) { throw new Error(`Erreur HTTP ! statut : ${response.status}`); }
                const data = await response.json();
                
                const textResponse = data.candidates[0].content.parts[0].text;
                const jsonMatch = textResponse.match(/\{.*\}/s);
                if (jsonMatch) {
                    sendResponseAsync({ summary: JSON.parse(jsonMatch[0]) });
                } else {
                    throw new Error("La réponse de l'IA n'était pas un JSON valide.");
                }
            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'testPersona') {
        (async () => {
            try {
                const { apiKey } = await chrome.storage.local.get('apiKey');
                if (!apiKey) { throw new Error('La clé API Gemini n\'est pas configurée.'); }

                const persona = request.persona;

                const testPrompt = `
                    Tâche : Tu es un assistant IA. Tu dois répondre à une question de test en te basant sur la persona fournie.

                    Question de test :
                    "Explique-moi simplement ce qu'est un scénario Jeedom."

                    Instructions de la persona "${persona.name}" :
                    - Ton à adopter : ${persona.tone}
                    - Longueur de la réponse : ${persona.length}
                    - Langue de la réponse : ${persona.language}
                    - Instructions personnalisées : ${persona.customPrompt}

                    Règles de génération :
                    - La réponse doit être UNIQUEMENT le texte de la réponse.
                    - Ne pas ajouter de préambule, de salutations, ou de commentaires.

                    Texte de réponse :`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${persona.model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: testPrompt }] }] })
                });

                if (!response.ok) { throw new Error(`Erreur HTTP ! statut : ${response.status}`); }
                const data = await response.json();
                let testText = data.candidates[0].content.parts[0].text.trim();
                if (persona.prefix) {
                    testText = persona.prefix + '\n\n' + testText;
                }
                if (persona.suffix) {
                    testText = testText + '\n\n' + persona.suffix;
                }
                sendResponseAsync({ text: testText });

            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'explainCode') {
        (async () => {
            try {
                const { apiKey, personas, modelSettings } = await chrome.storage.local.get(['apiKey', 'personas', 'modelSettings']);
                if (!apiKey) throw new Error('La clé API Gemini n\'est pas configurée.');
                
                let model = 'gemini-1.5-flash-latest'; // Modèle de secours par défaut
                if (modelSettings && modelSettings.explainCode && modelSettings.explainCode !== 'default') {
                    model = modelSettings.explainCode;
                } else if (personas && personas.length > 0) {
                    model = personas[0].model;
                }
                if (!model) { throw new Error('Aucun modèle d\'IA n\'est configuré.'); }

                const explainPrompt = `
                En tant qu'expert du développement sur la plateforme de domotique Jeedom, explique clairement et simplement ce que fait le bloc de code suivant.
                Si le code contient une erreur évidente, signale-la.
                L'explication doit être concise et facile à comprendre pour un utilisateur qui n'est pas forcément un développeur expert.
                
                **Formate ta réponse en HTML.** Utilise des balises comme '<b>' pour le gras, '<ul>' et '<li>' pour les listes, et '<pre><code>' pour les blocs de code.

                Code à analyser :
                ---
                ${request.code}
                ---
                
                Explication (en HTML) :`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: explainPrompt }] }] })
                });
                if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
                const data = await response.json();
                const textResponse = data.candidates[0].content.parts[0].text;
                const cleanedText = textResponse.replace(/```html|```/g, '').trim();
                sendResponseAsync({ text: cleanedText });
            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'verifyCode') {
        (async () => {
            try {
                const { apiKey, personas, modelSettings } = await chrome.storage.local.get(['apiKey', 'personas', 'modelSettings']);
                if (!apiKey) throw new Error('La clé API Gemini n\'est pas configurée.');
                
                let model = 'gemini-1.5-flash-latest'; // Modèle de secours par défaut
                if (modelSettings && modelSettings.verifyCode && modelSettings.verifyCode !== 'default') {
                    model = modelSettings.verifyCode;
                } else if (personas && personas.length > 0) {
                    model = personas[0].model;
                }
                if (!model) { throw new Error('Aucun modèle d\'IA n\'est configuré.'); }

                const verifyPrompt = `
                En tant qu'expert en débogage sur la plateforme de domotique Jeedom, analyse le bloc de code suivant.
                Recherche les erreurs de syntaxe, les erreurs de logique courantes dans un contexte Jeedom, les mauvaises pratiques ou les problèmes de performance potentiels.

                Si tu ne trouves aucune erreur, réponds UNIQUEMENT par la phrase : "<p>Aucune erreur évidente n'a été détectée.</p>"
                Sinon, liste les problèmes trouvés en utilisant une liste HTML ('<ul>' et '<li>'). Explique chaque problème et en suggérant une correction si possible, en utilisant '<b>' pour mettre en évidence les points importants et '<pre><code>' pour les extraits de code.

                **La réponse doit être entièrement au format HTML.**

                Code à analyser :
                ---
                ${request.code}
                ---

                Analyse (en HTML) :`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: verifyPrompt }] }] })
                });
                if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
                const data = await response.json();
                const textResponse = data.candidates[0].content.parts[0].text;
                const cleanedText = textResponse.replace(/```html|```/g, '').trim();
                sendResponseAsync({ text: cleanedText });
            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'optimizeCode') {
        (async () => {
            try {
                const { apiKey, personas, modelSettings } = await chrome.storage.local.get(['apiKey', 'personas', 'modelSettings']);
                if (!apiKey) throw new Error('La clé API Gemini n\'est pas configurée.');
                
                let model = 'gemini-1.5-flash-latest'; // Modèle de secours par défaut
                if (modelSettings && modelSettings.optimizeCode && modelSettings.optimizeCode !== 'default') {
                    model = modelSettings.optimizeCode;
                } else if (personas && personas.length > 0) {
                    model = personas[0].model;
                }
                if (!model) { throw new Error('Aucun modèle d\'IA n\'est configuré.'); }

                const optimizePrompt = `
                En tant qu'expert en optimisation de code sur la plateforme de domotique Jeedom, analyse le bloc de code suivant.
                Identifie les opportunités d'amélioration de performance, de lisibilité et de bonnes pratiques.
                Propose des optimisations concrètes et explique les avantages de chaque changement.

                **La réponse doit être entièrement au format HTML descriptif, SANS aucun JavaScript exécutable.**
                Utilise des balises comme '<b>' pour le gras, '<ul>' et '<li>' pour les listes, et '<pre><code>' pour les blocs de code.
                Mets en évidence le code original et le code optimisé à l'intérieur de balises <pre><code>.

                Code à optimiser :
                ---
                ${request.code}
                ---

                Optimisation (en HTML) :`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: optimizePrompt }] }] })
                });
                if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
                const data = await response.json();
                const textResponse = data.candidates[0].content.parts[0].text;
                const cleanedText = textResponse.replace(/```html|```/g, '').trim();
                sendResponseAsync({ text: cleanedText });
            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'commentCode') {
        (async () => {
            try {
                const { apiKey, personas, modelSettings } = await chrome.storage.local.get(['apiKey', 'personas', 'modelSettings']);
                if (!apiKey) throw new Error('La clé API Gemini n\'est pas configurée.');
                
                let model = 'gemini-1.5-flash-latest'; // Modèle de secours par défaut
                if (modelSettings && modelSettings.commentCode && modelSettings.commentCode !== 'default') {
                    model = modelSettings.commentCode;
                } else if (personas && personas.length > 0) {
                    model = personas[0].model;
                }
                if (!model) { throw new Error('Aucun modèle d\'IA n\'est configuré.'); }

                const commentPrompt = `
                En tant qu'expert en développement sur la plateforme de domotique Jeedom, ajoute des commentaires pertinents et clairs au bloc de code suivant.
                Les commentaires doivent expliquer le but des sections complexes, les choix de conception importants et toute logique non évidente.
                Les commentaires doivent suivre les conventions de langage du code fourni (par exemple, // pour JavaScript/PHP, # pour Python, -- pour SQL, etc.).

                **La réponse doit être le code entièrement commenté, formaté en HTML** en utilisant une balise <pre><code>.

                Code à commenter :
                ---
                ${request.code}
                ---

                Code commenté (en HTML) :`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: commentPrompt }] }] })
                });
                if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
                const data = await response.json();
                const textResponse = data.candidates[0].content.parts[0].text;
                const cleanedText = textResponse.replace(/```html|```/g, '').trim();
                sendResponseAsync({ text: cleanedText });
            } catch (error) {
                sendResponseAsync({ error: error.message });
            }
        })();
        return true;
    }
});