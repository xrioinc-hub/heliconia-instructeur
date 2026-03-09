

## Probleme identifié

Quand tu fais **Imprimer → Enregistrer en PDF**, c'est le layout d'impression (`#print-layout` dans `Rapport.tsx`) qui est utilisé. Ce layout affiche actuellement un **carré bleu avec des initiales** (lignes 340-345 de `Rapport.tsx`), pas le logo du District de Lyon.

Le logo est déjà correctement intégré dans l'export ZIP (`exportZip.ts`), mais **pas dans le layout d'impression**.

## Plan

### 1. Remplacer le carré bleu par le vrai logo dans le layout d'impression

**Fichier : `src/pages/Rapport.tsx`**
- Importer `districtLyonLogo` depuis `@/assets/district-lyon-logo.png`
- Remplacer le bloc `pv-logo-box` (lignes 340-345) : remplacer le `<div className="pv-logo-inner">` avec les initiales par une balise `<img>` qui affiche le logo du district

### 2. Adapter le CSS d'impression pour le logo image

**Fichier : `src/index.css`**
- Modifier `.pv-logo-inner` (lignes 165-179) : retirer le fond bleu, la couleur blanche, le texte centré, et le mettre en mode image (object-fit, dimensions adaptées ~72px de haut)

### Résultat
Le PDF généré via Imprimer affichera le logo du District de Lyon et du Rhône (lion rouge/doré) au lieu du carré bleu "L".

