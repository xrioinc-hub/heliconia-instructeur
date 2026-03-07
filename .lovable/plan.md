

## Plateforme Instructeur Football — Plan d'implémentation

### Vue d'ensemble
Application complète d'aide à l'instruction disciplinaire pour le football amateur français. Authentification, gestion de dossiers, upload de documents, et génération de rapports par IA (GPT-4o via votre propre clé OpenAI).

---

### Phase 1 — Base de données & Authentification (Lovable Cloud)

- **Activer Lovable Cloud** et créer les tables : `profiles`, `dossiers`, `parties`, `documents`, `user_roles`
- **RLS** sur toutes les tables : un utilisateur ne voit que ses propres dossiers ; les admins voient tout (via `has_role()` security definer)
- **Auth email/mot de passe** avec pages login/inscription
- **Trigger** auto-création du profil à l'inscription
- **Bucket Storage** `dossier-documents` pour les fichiers uploadés

---

### Phase 2 — Layout & Navigation

- **Sidebar** à gauche : Dashboard, Mes dossiers, Nouveau dossier, Profil
- **Header** : icône ⚽ + "Instructeur", district/ligue de l'utilisateur, bouton déconnexion
- **Palette** : vert football `#2D7A4F`, fond `#F9FAFB`, texte `#374151`
- **Responsive** pour tablette

---

### Phase 3 — Dashboard (`/`)

- Statistiques : dossiers en cours / rapports générés / clos
- Tableau des dossiers récents avec badges colorés (statut + gravité)
- Alertes deadline (badge rouge "URGENT" si < 24h)
- Filtres : statut, type d'incident, gravité, période
- Recherche par référence ou nom d'équipe
- Bouton "Nouveau dossier" bien visible

---

### Phase 4 — Création / Édition de dossier (`/dossier/nouveau`, `/dossier/:id/edit`)

- **Colonne gauche (40%)** : formulaire infos match, parties impliquées (ajout via modal, cartes supprimables), contexte supplémentaire
- **Colonne droite (60%)** : zone drag & drop pour documents (PDF, DOC, DOCX, TXT), sélection du type de document, bouton "Générer le rapport"
- **Numérotation automatique** : `INS-2025-XXXX`
- **Deadlines automatiques** : défense = date match + 48h, instruction = création + 42 jours
- **Extraction texte** côté frontend : `pdfjs-dist` pour PDF, `mammoth` pour DOCX, FileReader pour TXT
- Upload vers Supabase Storage + stockage du texte extrait en base

---

### Phase 5 — Génération IA (Edge Function `generate-instruction`)

- Edge function recevant les données du dossier + textes extraits
- Appel GPT-4o avec le prompt système disciplinaire complet (votre clé OpenAI stockée en secret Supabase)
- Gestion du dépassement : si > 100 000 caractères, troncature intelligente (priorité rapport arbitre > feuille match)
- Parse de la gravité dans la réponse IA → mise à jour automatique du champ `gravite`
- Rapport Markdown sauvegardé dans `rapport_ia`

---

### Phase 6 — Page Rapport (`/dossier/:id/rapport`)

- **Colonne gauche (35%)** : récapitulatif dossier, parties, documents, deadlines avec compte à rebours
- **Colonne droite (65%)** : rendu Markdown du rapport, avertissement "aide à l'instruction", boutons Copier / Exporter PDF / Régénérer
- Boutons "Modifier le dossier" et "Marquer comme clos"

---

### Phase 7 — Profil (`/profil`)

- Formulaire : prénom, nom, district, ligue, poste
- Sauvegarde dans la table `profiles`

---

### Règles de sécurité

- Clé OpenAI uniquement dans les secrets Supabase, jamais côté client
- RLS stricte : isolation par `user_id`, admin via `user_roles`
- Pas de suppression de dossier, uniquement clôture

