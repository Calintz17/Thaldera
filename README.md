# Thaldera

- `/` : Codex des joueurs (application sans build, données dans `data/`).
- `/factions/` : page historique des factions et blasons (conservée telle quelle).

## Données
Chaque fiche est un objet JSON (voir `data/roshen-buru.json`). Deux voix :
- bloc `portee: "groupe"` : « vous » (ce que le groupe sait)
- bloc `portee: "harfang"` : « tu » (ce que sait Harfang seul)

Une fiche n'apparaît que si elle a un bloc visible pour la vue choisie.
Les secrets du MJ ne vont jamais ici (dépôt public). Vérification : `python3 tools/check_data.py`.

## Images
`python3 tools/optimize_images.py <source> <cible> --type pnj|paysage`, puis placer dans
`img/<region>/<ville>/pnj/<id-de-la-fiche>.webp`.

## Audit technique
L'explorateur donne accès aux régions, villes, lieux et personnages sans devoir parcourir les cartes.
Sur les cartes de continents, les contours conservent désormais les sommets exacts des polygones
définis dans les données. Les fichiers haute résolution restent inchangés et se chargent au zoom.

Contrôles supplémentaires : `python3 tools/audit_assets.py`.
Ce rapport liste les références manquantes, les images PNJ non utilisées et les coordonnées hors
carte. Un portrait non utilisé ne prouve pas qu'un personnage doit être publié : vérifier la
fiche et les éventuelles formes avant tout rattachement.

Les coordonnées cartographiques sont relatives à chaque carte (0–1). Pour relever des points,
ouvrir le site avec `?edit` et utiliser Alt + clic (point) ou Shift + deux clics (zone).
Les retouches géographiques précises nécessitent une comparaison visuelle avec la carte source.

## Contrôles continus
Le workflow GitHub Actions `Codex integrity` exécute les contrôles à chaque push.
Diagnostic et limites dans `AUDIT_UX_TECHNIQUE.md`.
