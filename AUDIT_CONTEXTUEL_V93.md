# Codex Thaldera — réqualification contextuelle des 72 fiches (v93)

**30 octobre 2026.** Base: audit V92, `data/*.json`, inventaire réel des images GitHub et inspection des documents originaux (Havre Noir, Camont et Corvalis/Lunsk notamment).

L’absence de champ `galerie` **ne prouve pas** qu’un média est absent des sources. Il faut chercher un nom alternatif, une image dans le dossier régional, un visuel publié sur la fiche du lieu parent et les illustrations intégrées aux PDF. Une image d’un autre endroit ne doit jamais être choisie par simple ressemblance de nom.

## Résultats vérifiés

| Verdict | Nombre |
|---|---:|
| Corrigé et publié (4) | 4 |
| Illustration dans PDF, fichier à importer (3) | 3 |
| Source PDF partielle / plan tactique (4) | 4 |
| Fiche géographique, absence acceptable provisoirement (22) | 22 |
| Lieu secondaire, présence visuelle à confirmer (16) | 16 |
| Décor spécifique à retrouver dans les sources (23) | 23 |
| **Total** | **72** |

## Classification exhaustive des 72 identifiants

### Corrigé et publié (4)

`tzakar`, `uruzal`, `ascenseur-nord-est`, `ascenseur-sud`.

### Illustration dans PDF, fichier à importer (3)

`rocher-aux-noeuds`, `salle-des-cartes`, `marteau-du-brise-pavois`.

### Source PDF partielle / plan tactique (4)

`ruelle-des-cordages`, `cale-aux-vivres`, `dortoir-des-lapides`, `pont-de-parade`.

### Fiche géographique, absence acceptable provisoirement (22)

`tzalanar`, `valedorn`, `audierne`, `port-daman`, `port-gorash`, `ungar-keras`, `khardun`, `urnak`, `pont-taurin`, `port-suuren`, `la-rencontre`, `helios`, `sol-novem`, `solarius`, `teravane`, `grisecroix`, `dusenberg`, `einsenmarch`, `holstein`, `rottenwald`, `altenheim`, `altenmarkt`.

### Lieu secondaire, présence visuelle à confirmer (16)

`tour-du-pentacle-lunsk`, `scierie-lunsk`, `herboristerie-la-sous-corolle`, `garnison-leyenmil`, `reserve-du-vent-gris`, `auberge-du-moulin`, `longue-vue`, `garnison-obaline`, `cathedrale-de-gond`, `jardins-suspendus-corvalis`, `ambassade-du-dominion`, `ambassade-d-altera`, `ambassade-de-rivegard`, `caserne-roshen-buru`, `ecurie-roshen-buru`, `pavillon-des-diplomates`.

### Décor spécifique à retrouver dans les sources (23)

`enclos-port-blanc`, `marche-aux-bestiaux`, `cercle-des-eleveurs`, `officine`, `boulangerie-rossi`, `la-faille-d-agran`, `atelier-de-drisuun`, `epave-de-l-astariel`, `chapelle-de-l-orphelinat`, `catacombes-de-kord`, `camp-de-vespera`, `village-monastique-ile-aux-moines`, `grande-cathedrale-ile-aux-moines`, `souterrains-ile-aux-moines`, `maison-lenach`, `magistrat-seiran-vale`, `pont-miren`, `pillier`, `palais-miren-buru`, `maison-sokabei`, `domaine-kaben`, `maison-de-the`, `temple-de-tako-alvaki`.

## Corrections effectivement poussées

- `tzakar` : paysages `paysages/tzakar/arrivee.webp` et `paysages/tzakar/rue.webp`.
- `uruzal` : paysages `paysages/uruzal/arrivee.webp` et `paysages/uruzal/rue.webp`.
- `ascenseur-nord-est` : image du système des ascenseurs `roshen-buru/ascenseur.webp` ; `ascenseur-sud` : `roshen-buru/ascenseur-2.webp`. Il s'agit d'une illustration contextuelle de l'installation commune, non de preuves que les deux cabines représentées sont distinctes.

## Illustration retrouvée, mais pas encore importée

- Havre Noir p. 2, `rocher-aux-noeuds` (819 × 360 px).
- Havre Noir p. 21, `salle-des-cartes` (858 × 377 px, image de bureau, pertinence finale à vérifier).
- Camont p. 2, `marteau-du-brise-pavois` (682 × 320 px, navire de la traversée).
- Havre Noir p. 8 : visuel sombre de la page Ruelle des Cordages, pas de représentation extérieure certaine.
- Havre Noir p. 22, p. 25, p. 26 : images à dominante carte tactique, **ne pas les intégrer comme paysages cinématiques par défaut**.

**Important :** les images extraites dans une archive de travail ne sont pas automatiquement des fichiers présents dans GitHub. Ne jamais ajouter un chemin JSON avant d'avoir importé le binaire correspondant.

## Erreurs de correspondance explicitement écartées

- `scierie-lunsk` ≠ `paysages/tzakar/scierie.webp` (autre ville).
- `epave-de-l-astariel` ≠ `paysages/agran/epave-du-grauwacht.webp` (autre navire).
- `palais-miren-buru` ≠ `palais-kovacz/siharen/tsuren/uramei` (autres clans et fonctions).
- `temple-de-tako-alvaki` ≠ `temple-de-melora.webp` et `temple-du-tenraku-ceremonie.webp` (autres temples).
- `pont-miren` ≠ `corvalis/course-de-miren.webp` (homonymie).
- `atelier-de-drisuun` : le fichier `img/pnj/agran-drisuun.webp` est un **portrait**, et ne prouve pas la présence d’un paysage autonome. Vérifier le média source intitulé « Agran - Drisuun ».
- `chapelle-de-l-orphelinat` : les visuels de l’orphelinat existent, mais pas de pièce explicitement attribuée à la chapelle.
- `maison-de-the` de Roshen Buru ≠ `auberge.webp` ; la base des joueurs mérite un vrai paysage si la source existe.

## Méthode pour les prochains imports

1. Normaliser les accents, tirets et articles dans le nom de la fiche et ses alias.
2. Comparer les noms du lieu, du PNJ principal, de la scène et de l’événement, en respectant le **répertoire géographique**.
3. Consulter le contexte des fiches parentes et les apparitions dans les PDF.
4. Séparer **portrait PNG**, **landscape**, **battlemaps** et **cartes géographiques**.
5. Marquer un résultat « exact », « contextuel », « source partielle » ou « non démontré ».
6. Ne pousser dans les données que les appariements vérifiés. Les autres restent dans l’audit Excel v93 avec leurs justifications.
