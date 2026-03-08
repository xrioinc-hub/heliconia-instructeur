

## Plan: Rapport interactif avec feedback instructeur et édition directe

### Ce qui va changer

**1. Édition directe du rapport (style Google Docs)**
- Remplacer le rendu `<ReactMarkdown>` par un `<textarea>` éditable contenant le Markdown brut du rapport
- Ajouter un toggle "Aperçu / Édition" pour basculer entre le mode édition (textarea) et le mode lecture (ReactMarkdown)
- Le contenu édité est stocké dans un state local `editedRapport`
- Bouton "Sauvegarder" pour persister les modifications dans la base (champ `rapport_ia` du dossier)
- Le bouton PDF et Copier utilisent `editedRapport` (et non `dossier.rapport_ia`), donc les modifications manuelles sont prises en compte à l'impression

**2. Feedback instructeur pour que l'IA ajuste le rapport**
- Ajouter une zone de saisie (textarea) sous le rapport : "Votre décision / retour"
- Bouton "Appliquer mes modifications via l'IA"
- Appel à une nouvelle invocation de `generate-instruction` (ou un nouvel edge function dédié `revise-instruction`) qui envoie :
  - Le rapport actuel
  - Le feedback de l'instructeur
  - Le contexte du dossier
- L'IA retourne une version révisée du rapport intégrant la décision de l'instructeur
- Le rapport révisé remplace le contenu affiché et est sauvegardé

### Détails techniques

**Frontend (`src/pages/Rapport.tsx`)**
- Nouveaux states : `editedRapport`, `isEditing`, `feedback`, `revising`
- Initialisation de `editedRapport` depuis `dossier.rapport_ia` au chargement
- Mode édition : `<textarea>` plein écran avec le Markdown brut
- Mode aperçu : `<ReactMarkdown>` comme actuellement
- Les boutons Copier/PDF utilisent `editedRapport`
- Section feedback : textarea + bouton qui appelle l'edge function de révision

**Backend (nouvel edge function `supabase/functions/revise-instruction/index.ts`)**
- Reçoit : `rapport_actuel`, `feedback_instructeur`, `dossier_id`
- Prompt système dédié : "Tu es un assistant juridique. Voici le rapport d'instruction actuel et le retour de l'instructeur. Modifie le rapport pour intégrer ses remarques tout en conservant la structure et les citations réglementaires."
- Utilise le Lovable AI Gateway (`google/gemini-3-flash-preview`) pour éviter la dépendance à OpenAI pour cette fonctionnalité secondaire
- Retourne le rapport révisé

**Config (`supabase/config.toml`)**
- Ajouter l'entrée pour `revise-instruction` avec `verify_jwt = false`

### Flux utilisateur
1. L'instructeur clique "Générer le rapport" → l'IA produit le rapport
2. Il lit le rapport en mode aperçu
3. Option A : Il bascule en mode "Édition" et modifie directement le Markdown → sauvegarde
4. Option B : Il écrit son feedback dans la zone dédiée (ex: "J'ai décidé de 3 matchs de suspension pour le joueur X") → clique "Appliquer" → l'IA régénère en tenant compte de sa décision
5. Il clique PDF → le document imprimé reflète toutes ses modifications

