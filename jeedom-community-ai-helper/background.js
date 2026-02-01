const devApi = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Fonctions utilitaires mutualisées
 */

async function getSettings(keys = ['apiKey', 'personas', 'modelSettings']) {
    const result = await devApi.storage.local.get(keys);
    if (!result.apiKey) throw new Error(`La clé API Gemini n'est pas configurée.`);
    return result;
}

function getPersona(personas, personaId) {
    if (!personas || personas.length === 0) throw new Error('Aucune persona n\'est configurée.');
    const persona = personas.find(p => p.id === personaId);
    if (!persona) throw new Error(`Persona avec l'ID ${personaId} non trouvée.`);
    return persona;
}

function getModel(modelSettings, type, persona, personas) {
    let model = 'gemini-1.5-flash-latest';
    if (modelSettings && modelSettings[type] && modelSettings[type] !== 'default') {
        model = modelSettings[type];
    } else if (persona && persona.model) {
        model = persona.model;
    } else if (personas && personas.length > 0) {
        model = personas[0].model;
    }
    if (!model) throw new Error(`Aucun modèle d'IA n'est configuré.`);
    return model;
}

async function callGemini(model, apiKey, prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error(`Réponse invalide de l'IA.`);
    }
    return data.candidates[0].content.parts[0].text;
}

function cleanHtml(text) {
    return text.replace(/```html|```/g, '').trim();
}

/**
 * Gestion des messages
 */

devApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let sendResponseAsync = sendResponse;

    const handleAction = async () => {
        try {
            switch (request.type) {
                case 'generateReply': {
                    const { apiKey, enableIcons, tagLinkMappings, personas, modelSettings } = await getSettings(['apiKey', 'enableIcons', 'tagLinkMappings', 'personas', 'modelSettings']);
                    const persona = getPersona(personas, request.personaId);
                    const model = getModel(modelSettings, 'generateReply', persona, personas);

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

                    const prompt = `
                        Tâche : Tu es un assistant IA, expert Jeedom qui aide à rédiger des réponses pour un forum sur la domotique Jeedom.
                        Discussion : ${request.title || 'Non disponible'} (${request.categories?.join(' > ') || 'Non disponible'})
                        ${documentationContext}
                        Contexte : ${request.context}
                        Instructions Persona "${persona.name}" : ${persona.customPrompt}
                        Règles : Ton ${persona.tone}, Longueur ${persona.length}, Langue ${persona.language}. ${enableIcons ? 'Emojis autorisés.' : ''}

                        Règles générales :
                        - Analyse interne cachée. Rédige une réponse cohérente et utile.
                        - Uniquement le texte à insérer, sans préambule superflu.
                        - Sources : https://github.com/jeedom/core, https://docs.jeedom.com, https://community.jeedom.com

                        Réponse suggérée :`;

                    const text = await callGemini(model, apiKey, prompt);
                    devApi.storage.local.set({ lastUsedPersonaId: request.personaId });
                    sendResponseAsync({ text: text.trim() });
                    break;
                }

                case 'rephraseText': {
                    const { apiKey, personas, modelSettings } = await getSettings();
                    const persona = getPersona(personas, request.personaId);
                    const model = getModel(modelSettings, 'rephraseText', persona, personas);

                    const prompt = `
                        Tâche : Reformule le texte suivant en respectant les instructions.
                        Texte : ${request.text}
                        Instructions Persona "${persona.name}" : ${persona.tone}, ${persona.length}, ${persona.language}, ${persona.customPrompt}
                        Règle : Réponse UNIQUEMENT avec le texte reformulé, sans préambule.
                        Texte reformulé :`;

                    const text = await callGemini(model, apiKey, prompt);
                    sendResponseAsync({ text: text.trim() });
                    break;
                }

                case 'summarizeDiscussion': {
                    const { apiKey, personas, modelSettings } = await getSettings();
                    const model = getModel(modelSettings, 'summarizeDiscussion', null, personas);

                    const prompt = `
                        Analyse cette discussion Jeedom (Titre: ${request.data.title}, Catégories: ${request.data.categories.join(' > ')})
                        Premier Post: ${request.data.firstPost}
                        Solution: ${request.data.solutionPost || "Aucun"}
                        Texte complet: ${request.data.fullText}

                        Retourne UNIQUEMENT un objet JSON :
                        {
                          "title": "${request.data.title}",
                          "problem": "Résumé concis du problème.",
                          "solution": "Résumé de la solution.",
                          "summary": "Résumé factuel en listes à puces."
                        }`;

                    const text = await callGemini(model, apiKey, prompt);
                    const jsonMatch = text.match(/\{.*\}/s);
                    if (jsonMatch) {
                        sendResponseAsync({ summary: JSON.parse(jsonMatch[0]) });
                    } else {
                        throw new Error("Réponse JSON invalide.");
                    }
                    break;
                }

                case 'testPersona': {
                    const { apiKey } = await getSettings(['apiKey']);
                    const persona = request.persona;
                    const prompt = `
                        Tâche : Répond à "Explique-moi simplement ce qu'est un scénario Jeedom" avec la persona "${persona.name}".
                        Règles : Ton ${persona.tone}, Longueur ${persona.length}, Langue ${persona.language}, ${persona.customPrompt}
                        Règle : UNIQUEMENT le texte de réponse.
                        Réponse :`;

                    let text = await callGemini(persona.model || 'gemini-1.5-flash-latest', apiKey, prompt);
                    text = text.trim();
                    if (persona.prefix) text = persona.prefix + '\n\n' + text;
                    if (persona.suffix) text = text + '\n\n' + persona.suffix;
                    sendResponseAsync({ text });
                    break;
                }

                case 'explainCode':
                case 'verifyCode':
                case 'optimizeCode':
                case 'commentCode': {
                    const { apiKey, personas, modelSettings } = await getSettings();
                    const model = getModel(modelSettings, request.type, null, personas);

                    let prompt = '';
                    if (request.type === 'explainCode') {
                        prompt = `Explique clairement ce code Jeedom en HTML (<b>, <ul>, <pre><code>) :\n${request.code}`;
                    } else if (request.type === 'verifyCode') {
                        prompt = `Analyse les erreurs de ce code Jeedom en HTML. Si aucune erreur, réponds "<p>Aucune erreur détectée.</p>". Sinon liste les problèmes en <ul> :\n${request.code}`;
                    } else if (request.type === 'optimizeCode') {
                        prompt = `Optimise ce code Jeedom (performance, lisibilité) en HTML (<b>, <ul>, <pre><code>) :\n${request.code}`;
                    } else if (request.type === 'commentCode') {
                        prompt = `Ajoute des commentaires au code suivant et retourne-le en HTML (<pre><code>) :\n${request.code}`;
                    }

                    const text = await callGemini(model, apiKey, prompt);
                    sendResponseAsync({ text: cleanHtml(text) });
                    break;
                }
            }
        } catch (error) {
            sendResponseAsync({ error: error.message });
        }
    };

    handleAction();
    return true;
});
