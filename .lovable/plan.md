

## Plan: Export ZIP du dossier (PDF récapitulatif + pièces jointes)

### Objectif
Ajouter un bouton "Exporter ZIP" sur la page Rapport qui génère et télécharge un fichier ZIP contenant :
1. Un **PDF récapitulatif** du dossier (infos match, parties, rapport d'instruction)
2. Toutes les **pièces jointes** uploadées dans le dossier

### Approche technique

**Nouvelle dépendance** : `jszip` (génération ZIP côté client) — pas besoin de backend.

**Le PDF** : On réutilise la logique `window.print()` existante mais en la transformant en un vrai fichier PDF via l'API native du navigateur. Concrètement, on génère le PDF en déclenchant un print-to-PDF via un iframe caché, ou plus simplement on utilise le contenu Markdown converti en un blob HTML stylisé qu'on ajoute au ZIP. Alternative plus robuste : générer le PDF avec une bibliothèque comme `jspdf` + `html2canvas`, mais ça alourdit. L'approche la plus pragmatique : créer un fichier HTML auto-suffisant avec le récapitulatif complet, que l'utilisateur pourra convertir/imprimer en PDF.

**Approche retenue** : Générer dans le ZIP :
- `rapport-instruction-{reference}.html` — fichier HTML complet et stylisé (imprimable en PDF depuis le navigateur), contenant toutes les données du dossier + le rapport IA
- Les pièces jointes téléchargées depuis le storage bucket `dossier-documents`

### Modifications

**1. Installer `jszip`**

**2. `src/pages/Rapport.tsx`**
- Ajouter un bouton "Exporter ZIP" (icône `Archive`)
- Nouvelle fonction `exportZip()` :
  - Créer une instance JSZip
  - Générer le HTML récapitulatif (infos match, parties, rapport markdown converti en HTML)
  - L'ajouter au ZIP sous `rapport-instruction-{ref}.html`
  - Pour chaque document du dossier ayant un `storage_path`, télécharger le fichier via `supabase.storage.from('dossier-documents').download(path)` et l'ajouter au ZIP dans un sous-dossier `pieces-jointes/`
  - Déclencher le téléchargement du ZIP via `URL.createObjectURL`

### Flux utilisateur
1. Clic sur "Exporter ZIP"
2. Loader pendant le téléchargement des pièces jointes
3. Le navigateur télécharge `dossier-{reference}.zip` contenant le rapport HTML + les pièces jointes

