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

## Atlas Nocturne v57
L'interface de jeu est définie dans `assets/arcane-theme.css`.
Les noms et marqueurs d'atlas sont positionnés à l'écran, indépendamment
de l'agrandissement de la carte, pour éviter les textes flous.
Les villes des factions sont de nouveau affichées sur la carte du continent,
y compris Port Doëlan. Test de régression : `node tests/navigation.test.cjs`.

Rapport de relecture sans modification de lore : `AUDIT_REPETITIONS.md`.


## Résumés de parties
La nouvelle page `resumes/` affiche les séances jouées depuis `data/parties.json`, au format liste cliquable et panneau de lecture. Le fichier est vide jusqu'à réception de comptes rendus authentiques. Il ne faut jamais déduire les séances jouées des scénarios écrits.

Exemple d'entrée dans le tableau `parties` :
```json
{"titre":"Partie 1 : titre validé","date":"À renseigner","resume":"Résumé destiné aux joueurs, sans secrets MJ.","liens":[{"id":"port-doelan","label":"Port Doëlan"}]}
```
Conserver l'ordre chronologique. Réserver les notes MJ, révélations secrètes et scénarios non joués aux documents privés.
