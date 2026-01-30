# Jeedom Community AI Helper

Bienvenue sur la documentation de **Jeedom Community AI Helper**, une extension de navigateur conçue pour améliorer votre expérience sur le forum de la communauté Jeedom.

Cette extension analyse les discussions, génère des résumés concis et vous aide à rédiger des réponses pertinentes en s'appuyant sur l'intelligence artificielle de Google Gemini.

## Table des matières
1. [Fonctionnalités principales](#fonctionnalités-principales)
2. [Installation](#installation)
3. [Configuration](#configuration)
    - [Obtenir une clé API Gemini](#1-obtenir-une-clé-api-gemini)
    - [Configurer l'extension](#2-configurer-lextension)
4. [Comment l'utiliser](#comment-lutiliser)
    - [Analyser une discussion (Popup)](#1-analyser-une-discussion-popup)
    - [Interagir avec les blocs de code](#2-interagir-avec-les-blocs-de-code)
    - [Rechercher le sujet sur le forum](#3-rechercher-le-sujet-sur-le-forum)
5. [Fonctionnalités de l'éditeur](#fonctionnalités-de-léditeur)
    - [Génération de réponse complète](#1-génération-de-réponse-complète)
    - [Reformulation de texte](#2-reformulation-de-texte)
    - [Correction orthographique](#3-correction-orthographique)
    - [Insertion de paragraphes](#4-insertion-de-paragraphes)
6. [Concepts clés](#concepts-clés)
    - [Les Personas](#1-les-personas)
    - [Les Liens par Tag](#2-les-liens-par-tag)
7. [Gestion des Réponses Rapides](#gestion-des-réponses-rapides)
    - [Création et gestion des paragraphes](#1-création-et-gestion-des-paragraphes)
    - [Paragraphes par défaut](#2-paragraphes-par-défaut)
    - [Import et Export des paragraphes](#3-import-et-export-des-paragraphes)
8. [Gestion avancée des configurations](#gestion-avancée-des-configurations)
    - [Gestion des Personas](#1-gestion-des-personas)
    - [Gestion des Liens par Tag](#2-gestion-des-liens-par-tag)
    - [Modèles d'IA par fonctionnalité](#3-modèles-dia-par-fonctionnalité)
    - [Visibilité des boutons d'action](#4-visibilité-des-boutons-daction)
9. [Fonctionnalités supplémentaires](#fonctionnalités-supplémentaires)
10. [Crédits](#crédits)

---

## Fonctionnalités principales

- **Analyse de discussion** : Ouvrez un sujet du forum et obtenez un résumé en un clic (problématique, solution, résumé des échanges).
- **Génération et reformulation de réponses** : Créez ou reformulez des réponses directement dans l'éditeur du forum en utilisant des styles prédéfinis (personas).
- **Réponses pré-enregistrées** : Gérez une bibliothèque de paragraphes pour les insérer rapidement dans vos messages. Définissez des paragraphes de début et de fin par défaut pour automatiser la rédaction.
- **Correction Orthographique et Grammaticale** : Utilisez l'API de LanguageTool pour corriger le texte de vos réponses.
- **Analyse de Blocs de Code** : Obtenez des explications, des vérifications, des optimisations ou des commentaires pour n'importe quel bloc de code sur le forum.
- **Configuration avancée** :
    - **Personas personnalisables** : Définissez le ton, le style et le modèle d'IA pour chaque type de réponse.
    - **Enrichissement contextuel** : Fournissez à l'IA des liens vers des documentations spécifiques grâce aux "Liens par Tag".
    - **Sélection de modèle d'IA** : Attribuez des modèles Gemini spécifiques (Flash, Pro) pour différentes tâches (résumé, explication de code, etc.).
    - **Interface personnalisable** : Choisissez les boutons d'action à afficher dans la barre d'outils de l'éditeur.
- **Interface intégrée et intuitive** : L'extension ajoute ses fonctionnalités directement dans l'interface du forum pour une expérience fluide et non intrusive.

---

## Installation

## Installation

**Note Importante :** Pour assurer une compatibilité maximale avec les navigateurs Chromium (Chrome, Edge, Brave, etc.) et Firefox, cette extension utilise le `Manifest V2` avec des scripts d'arrière-plan classiques.

1.  **Téléchargez le code** : Clonez ou téléchargez le contenu du dossier `jeedom-community-ai-helper` sur votre ordinateur.
2.  **Ouvrez le gestionnaire d'extensions de votre navigateur** :
    *   Pour Chrome/Edge/Brave : Tapez `chrome://extensions` ou `edge://extensions` dans la barre d'adresse.
    *   Pour Firefox : Tapez `about:addons` dans la barre d'adresse et allez dans l'onglet "Extensions", puis cliquez sur l'icône en forme de roue dentée (⚙️) et choisissez "Déboguer les modules complémentaires" (vous devrez peut-être activer les outils de développement pour les extensions via `about:debugging#/runtime/this-firefox`).
3.  **Activez le mode développeur** :
    *   Pour Chrome/Edge/Brave : Cochez l'interrupteur "Mode développeur" (souvent en haut à droite).
    *   Pour Firefox : Aucune activation spécifique n'est requise pour charger un module complémentaire temporaire.
4.  **Chargez l'extension** :
    *   Pour Chrome/Edge/Brave : Cliquez sur le bouton "Charger l'extension non empaquetée" (ou "Load unpacked").
    *   Pour Firefox : Cliquez sur "Charger un module complémentaire temporaire..." (ou "Load Temporary Add-on...").
    *   Dans les deux cas, sélectionnez le dossier `jeedom-community-ai-helper` que vous avez téléchargé à l'étape 1. Pour Firefox, vous pouvez sélectionner n'importe quel fichier à l'intérieur du dossier (par exemple, `manifest.json`).
5.  **Vérifiez l'installation** : L'icône de l'extension (un logo Jeedom) devrait apparaître dans votre barre d'outils.

**Note sur l'installation temporaire pour Firefox** : Les modules complémentaires temporaires sont désinstallés à la fermeture de Firefox. Pour une installation permanente, l'extension doit être signée et soumise à Mozilla Add-ons.

---

## Configuration

Avant la première utilisation, une configuration est nécessaire.

### 1. Obtenir une clé API Gemini

L'extension utilise l'API de Google Gemini. Vous devez posséder votre propre clé API.

1. Allez sur le site [Google AI Studio](https://aistudio.google.com/).
2. Connectez-vous avec votre compte Google.
3. Cliquez sur **"Get API key"** puis sur **"Create API key in new project"**.
4. Copiez la clé qui est générée.

### 2. Configurer l'extension

1. Faites un clic droit sur l'icône de l'extension dans votre barre d'outils et sélectionnez **"Options"**.
2. **Clé API Gemini** : Collez la clé API que vous venez de copier. C'est le seul paramètre obligatoire.
3. **Personas** : L'extension vient avec 4 personas par défaut. Vous pouvez les modifier, les supprimer ou en créer de nouvelles.
4. **Apparence des réponses** : Cochez la case si vous autorisez l'IA à utiliser des emojis pour rendre les réponses plus conviviales.
5. **Modèles d'IA et Liens par Tag** : Configurez des options avancées pour un contrôle plus fin.
6. **Enregistrez** : Cliquez sur "ENREGISTRER TOUS LES PARAMÈTRES".

---

## Comment l'utiliser

### 1. Analyser une discussion (Popup)

1. **Rendez-vous sur un sujet** du forum `community.jeedom.com`.
2. **Ouvrez le popup** : Cliquez sur l'icône de l'extension dans la barre d'outils. Une analyse se lance, vous présentant :
   - La problématique initiale.
   - La solution si elle est marquée sur le forum.
   - Un résumé des échanges.
   - Les tags et catégories du sujet.
3. **Copier le contenu** : Chaque section du résumé dispose d'un bouton pour copier son contenu dans le presse-papiers.

### 2. Interagir avec les blocs de code

1.  Lorsque vous consultez un sujet contenant des blocs de code (`<pre><code>...</code></pre>`), survolez le bloc avec votre souris.
2.  Des boutons contextuels apparaîtront en haut à droite du bloc :
    *   **Expliquer** : Pour obtenir une explication de l'IA sur la fonction du code.
    *   **Vérifier** : Pour que l'IA détecte les erreurs ou propose des améliorations.
    *   **Optimiser** : Pour obtenir une version plus performante du code.
    *   **Commenter** : Pour que l'IA ajoute des commentaires explicatifs au code.
3.  Les résultats s'affichent dans une fenêtre modale, avec un bouton pour copier facilement la réponse.

### 3. Rechercher le sujet sur le forum

1.  **Ouvrez le popup** de l'extension sur un sujet du forum.
2.  Dans l'en-tête, cliquez sur l'icône de recherche (![Rechercher](./images/search-icon.svg)).
3.  Un nouvel onglet s'ouvrira avec les résultats de recherche sur le forum pour le titre du sujet actuel.

---

## Fonctionnalités de l'éditeur

Lorsque vous ouvrez l'éditeur de réponse sur le forum, une nouvelle barre d'outils apparaît avec plusieurs fonctionnalités IA. Vous pouvez choisir les boutons à afficher depuis la page d'options (voir la section [Visibilité des boutons d'action](#4-visibilité-des-boutons-daction)).

### 1. Génération de réponse complète

- **Icône** : !["Persona"](./images/rephrase-icon.svg)
- **Fonctionnement** : Cliquez sur ce bouton pour ouvrir un menu listant toutes vos personas. Sélectionnez-en une pour que l'IA analyse l'intégralité de la discussion et rédige une proposition de réponse complète.

### 2. Reformulation de texte

- **Icône** : !["Reformuler"](./images/rephrase-icon.svg)
- **Fonctionnement** : Écrivez ou collez du texte dans l'éditeur, puis cliquez sur ce bouton. Un menu de personas s'ouvrira pour vous permettre de choisir le style de reformulation souhaité. L'IA remplacera alors votre texte par la version reformulée.

### 3. Correction orthographique

- **Icône** : !["Vérifier l'orthographe"](./images/spell-check-icon.svg)
- **Fonctionnement** : Cliquez sur ce bouton pour lancer une correction orthographique et grammaticale du texte présent dans l'éditeur. La correction est effectuée via l'API externe de **LanguageTool**.

### 4. Insertion de paragraphes

- **Icône** : Une icône représentant un document ou une liste.
- **Fonctionnement** : Cliquez sur ce bouton pour afficher la liste de vos paragraphes pré-enregistrés. Un clic sur un élément de la liste l'insérera directement dans l'éditeur, à l'emplacement de votre curseur.

---

## Concepts clés

### 1. Les Personas

Les personas sont au cœur de l'extension. Elles permettent de guider l'IA pour générer des réponses adaptées à chaque situation. Une persona est définie par :
- **Nom** : Un nom pour la reconnaître (ex: "Débogueur de code").
- **Instructions personnalisées** : Le guide principal pour l'IA. Soyez précis sur ce que vous attendez. *Exemple : "Tu es un expert du protocole Z-Wave. Analyse le problème et propose des étapes de débogage claires."*
- **Ton** : Le style général (amical, professionnel, humoristique, etc.).
- **Longueur** : La taille souhaitée de la réponse (courte, moyenne, détaillée).
- **Langue** : La langue de la réponse.
- **Modèle d'IA** : Choisissez entre les modèles Gemini, du plus rapide (`Flash`) au plus puissant (`Pro`).

### 2. Les Liens par Tag

Cette fonctionnalité puissante permet de donner à l'IA un contexte documentaire très précis.

- **Principe** : Vous associez un "tag" du forum (ex: `plugin-zwavejs`) à une ou plusieurs URL (documentation, code source, articles...).
- **Fonctionnement** : Lorsqu'un sujet possède ce tag, les liens que vous avez configurés sont automatiquement ajoutés au prompt de l'IA. L'IA peut alors consulter ces sources pour construire une réponse plus fiable et documentée.
- **Configuration** :
  - Sur la page d'options, entrez un nom de tag et une liste de liens au format `description|url`.
  - *Exemple* :
    - **Nom du tag** : `plugin-frigate`
    - **Liens** : `Doc|https://sagitaz.github.io/plugin-frigate/, Code|https://github.com/sagitaz/plugin-frigate`
- **Raccourci** : Si vous cliquez sur un tag depuis le popup de l'extension et qu'il n'est pas encore configuré, la page d'options s'ouvrira automatiquement avec le nom du tag pré-rempli.

---

## Gestion des Réponses Rapides

Pour accélérer la rédaction de messages répétitifs, l'extension intègre un gestionnaire de paragraphes pré-enregistrés.

### 1. Création et gestion des paragraphes
Sur la page d'options, vous trouverez une section "Réponses pré-enregistrées" où vous pouvez :
- **Ajouter** un nouveau paragraphe avec un titre (pour le reconnaître) et son contenu.
- **Modifier** un paragraphe existant.
- **Supprimer** un paragraphe dont vous n'avez plus besoin.

### 2. Paragraphes par défaut
Pour automatiser encore plus la création de vos messages, vous pouvez définir :
- **Un paragraphe de début par défaut** : Ce texte (par exemple, "Bonjour,") sera automatiquement inséré à l'ouverture de l'éditeur de réponse.
- **Un paragraphe de fin par défaut** : Ce texte sera inséré à la fin de votre message.

Laissez le champ sur "Aucun" pour désactiver cette fonctionnalité.

### 3. Import et Export des paragraphes
Comme pour les Personas, vous pouvez facilement sauvegarder et partager vos listes de paragraphes :
- **Export** : Crée un fichier `.json` contenant tous vos paragraphes.
- **Import** : Charge une configuration de paragraphes depuis un fichier `.json`.

---

## Gestion avancée des configurations

La page d'options offre des fonctionnalités pour gérer et personnaliser finement votre expérience.

### 1. Gestion des Personas
- **Import / Export** : Sauvegardez et partagez vos configurations de personas grâce aux boutons d'import et d'export. Les personas sont exportées dans un fichier `.json`.
- **Réorganisation** : Modifiez l'ordre d'affichage de vos personas directement dans la liste en utilisant le **glisser-déposer (drag-and-drop)**.
- **Test rapide** : Utilisez le bouton **"Tester ce Persona"** dans l'éditeur de persona pour générer un aperçu de réponse et ajuster vos instructions sans quitter la page d'options.

### 2. Gestion des Liens par Tag
- **Import / Export** : Tout comme les personas, vous pouvez exporter vos configurations de liens dans un fichier `.json` pour les sauvegarder ou les partager.

### 3. Modèles d'IA par fonctionnalité
Pour un contrôle total, la section **"Modèles d'IA par Fonctionnalité"** vous permet d'assigner un modèle d'IA spécifique à chaque tâche :
- Résumé de Discussion
- Explication de Code
- Vérification de Code
- Optimisation de Code
- Ajout de Commentaires au Code
- Reformulation de Texte

Si "Défaut" est sélectionné, le modèle utilisé sera celui de la persona active, ou un modèle de base si aucune n'est active.

### 4. Visibilité des boutons d'action
Dans la section "Visibilité des boutons d'action", vous pouvez cocher ou décocher les fonctionnalités que vous souhaitez voir apparaître dans la barre d'outils de l'éditeur. Cela vous permet de garder une interface épurée avec uniquement les outils que vous utilisez.

---

## Fonctionnalités supplémentaires

- **Cache intelligent** : Le résumé d'une discussion est mis en cache pour un affichage instantané. Le cache est automatiquement invalidé si de nouvelles réponses sont publiées dans le sujet. Un bouton "Rafraîchir" dans le popup permet de forcer une nouvelle analyse.
- **Support du mode sombre** : L'interface de l'extension (menus, modales) s'adapte automatiquement au thème clair ou sombre du forum.
- **Collecte de tags** : L'extension mémorise tous les tags que vous croisez sur le forum pour vous fournir des suggestions d'autocomplétion lorsque vous configurez de nouveaux "Liens par Tag".

---

## Crédits

Développé par **Noodom**.

[![Faire un don via PayPal](images/paypal.svg)](https://paypal.me/noodomfr)


