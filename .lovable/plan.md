

## Diagnostic complet : causes profondes des bugs

### Problemes identifies

**1. Le bouton "Enregistrer" du profil ne fait rien (semble ne rien retourner)**

Le code dans `Profil.tsx` ligne 37 fait `if (!profile) return;` au debut de `handleSave`. Or le profil est charge de maniere asynchrone APRES que `loading=false` dans `useAuth`. Quand la page Profil monte, `profile` peut encore etre `null` pendant une fraction de seconde. Si le profil n'a jamais fini de charger (ex: erreur reseau silencieuse), le bouton ne fera jamais rien.

En realite, en verifiant la base de donnees, **ton profil a bien ete mis a jour** (poste=admin, district=Lyon). Donc le bouton fonctionne, mais le **toast de confirmation ne s'affiche pas**. C'est un probleme d'affichage du toast, pas de sauvegarde.

**Note importante sur le champ "Poste"** : Le champ `poste` dans la table `profiles` est juste un label d'affichage. Il ne donne aucun droit admin. Les vrais droits admin viennent de la table `user_roles` -- et tu as deja le role admin la-dedans. Donc tout est correct cote securite.

**2. Dashboard bloque sur "Chargement..." (cause principale)**

Le `Index.tsx` a son propre etat `loading` (ligne 60) initialise a `true`. L'effet de chargement des dossiers (ligne 62) depend de `user?.id`. Le probleme est une **condition de course** :

- `ProtectedRoute` attend que `useAuth().loading` soit `false`, puis rend `Index`
- `Index` monte et lance son effet avec `user?.id`
- Mais `user` vient du contexte Auth qui peut avoir un delai entre `setUser` et le re-render de `Index`

Le vrai probleme : si la requete `supabase.from("dossiers").select("*")` echoue silencieusement (timeout, erreur reseau), le `catch` log l'erreur mais le composant affiche une liste vide -- pas "Chargement...". Donc si tu vois "Chargement..." indefiniment, c'est que **l'effet ne se declenche jamais** ou que `user` est `null` au moment ou l'effet s'execute.

La cause racine : dans `useAuth`, le `onAuthStateChange` et `initializeAuth` peuvent creer une course. Si `initializeAuth` se resout en premier et met `loading=false` AVANT que `onAuthStateChange` ait fire, `user` peut etre `null` quand `Index` monte.

### Plan de correction

**A. Corriger le hook useAuth pour eliminer la course**

Dans `useAuth.tsx` :
- S'assurer que `user` est toujours defini AVANT de mettre `loading=false`
- Simplifier : ne pas dupliquer la logique session dans `onAuthStateChange` ET `initializeAuth` -- utiliser `onAuthStateChange` comme source de verite unique, et `getSession` juste comme initialisation
- Retirer le `emergencyUnlock` timeout (masque le vrai probleme)
- Ajouter un `console.log` temporaire pour debugger si besoin

**B. Corriger le Profil pour feedback garanti**

Dans `Profil.tsx` :
- Ajouter un feedback visuel meme si `profile` est null (afficher un message d'erreur au lieu de silently return)
- Verifier que le toast fonctionne en ajoutant un `console.log` dans le handler

**C. Corriger le Dashboard pour resilience**

Dans `Index.tsx` :
- Ajouter un timeout de securite sur le loading propre au dashboard
- Si `user` est disponible mais le fetch echoue, afficher un message d'erreur avec bouton "Reessayer" au lieu de rester sur "Chargement..."

### Modifications fichiers

1. **`src/hooks/useAuth.tsx`** -- Refactoring complet :
   - `onAuthStateChange` gere tous les changements de session et met `loading=false`
   - `getSession()` appele une seule fois au montage, sans toucher a `loading` directement (laisse `onAuthStateChange` le faire)
   - Profil charge dans un `useEffect` separe reactif a `user?.id`

2. **`src/pages/Index.tsx`** -- Ajouter :
   - Guard : si pas de `user` apres montage, afficher "Aucun dossier" au lieu de "Chargement..."
   - Message d'erreur si le fetch echoue

3. **`src/pages/Profil.tsx`** -- Ajouter :
   - Log d'erreur + toast d'avertissement si `profile` est null au moment du clic sur Enregistrer

