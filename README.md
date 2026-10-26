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
