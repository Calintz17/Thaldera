# Audit des assets et des fiches, Thaldera Codex v88

## Champ de vérification

État du dépôt vérifié le 29 octobre 2026, après l'import P1/P2 de Claude.
**788 fiches**, dont 394 PNJ et 258 lieux, et **945 WebP**.
Cette vérification porte sur les chemins d'assets, les dimensions décodées,
les relations entre les fiches, les galeries et leur moteur d'affichage.

## Intégrité des ressources

- **1 037 références visuelles**, correspondant à **795 chemins uniques** dans les fiches
  et composants (portraits, formes, fonds, galeries, blasons et cartes).
- **Aucune image référencée manquante** ; **aucune image référencée illisible**.
- **952 ressources décodables** détectées par le contrôle des dimensions.
- **109 portraits non attribués directement** et **33 paysages non attribués**.
  Cela comprend des variantes historiques et des assets de futures zones
  (en particulier Tzakar et Uruzal) : ne pas créer automatiquement de fiches.
- **43 PNJ sans portrait attribué** : les fiches restent accessibles avec le
  fallback de silhouette. Aucun fichier orphelin n'a une association exacte
  suffisamment certaine pour autoriser un rattachement automatique.
- **83 lieux sans galerie personnelle** : leurs scènes utilisent, lorsque
  possible, les paysages de leur parent et les portraits des PNJ présents.

## Images à surveiller (sans dégradation ni compression)

La petite dimension n'est pas une image cassée. Le contrôle utilise des
seuils indicatifs et non des exigences de format :
- **7 portraits** dont le plus petit côté est inférieur à 220 px :
  assistant de Peraalys à Agran, Lukas à Leyenmil, Madame Ari,
  Madame Lucrèce, Olyssane à Roshen Buru, Saoren et Sera.
- **5 fonds** dont la largeur est inférieure à 640 px :
  quatre illustrations à Lumenlid (Arène, Épreuve de Severin,
  Étudiant, Visite de Lyrianne) et la Crique de Port Doëlan.
- Aucun panorama référencé présentant un ratio extrême supérieur à 4,2:1.

La galerie limite désormais l'agrandissement au lieu de pousser les petites
sources à une taille disproportionnée. Les portraits transparents sont
dimensionnés avec des limites en hauteur et en largeur, sans déformation.

## Rattachements géographiques

- Parents, lieux, relations et identifiants valides : **0 lien invalide**.
- Outreterre déverrouillée. **Creux d'Azur** est déplacé sous **L'Outreterre**
  conformément au texte existant de sa fiche et à la demande du MJ.
- Les cinq décalages entre *branche d'origine* et *lieu actuel* sont conservés :
  Ink et les voyageurs du Vesper (Borim, Dogrun, Thram, Orik).
  Leur parcours explique ce classement. Les reclasser sur un simple test
  parent/lieu ferait disparaître de l'information.
- Aucun vrai fond de Creux d'Azur ni aucune carte de l'Outreterre
  n'a été repéré dans les 300 nouveaux assets. Le blason existant sert
  donc de visuel d'entrée, identifié comme blason et non comme une carte.
  Une carte noire de remplacement reste indiquée comme « en préparation ».

## Carousel des personnages à plusieurs formes

- Les images précédentes, courantes et suivantes sont préchargées,
  de même que les portraits transparents correspondants.
- Le portrait est conservé dans le DOM à travers les changements de forme,
  pour éviter les réapparitions et saccades à chaque diapositive.
- La taille est bornée et s'adapte à la fenêtre ; l'alignement au paysage
  est recalculé à chaque diapositive et au redimensionnement.
- Le glissement horizontal sur écran tactile navigue entre les formes.
  Le défilement vertical du document reste indépendant.
- Les carrousels sans personnage ne conservent plus un portrait obsolète.

## Limites de l'audit

Les emplacements cartographiques purement artistiques et la pertinence
narrative des 142 assets orphelins nécessitent une vérification manuelle
et des décisions du MJ. Les contrôles automatisés ne prouvent pas
l'exactitude d'une illustration par rapport au personnage représenté.
Aucun asset n'a été supprimé, compressé ou associé à un personnage
sans preuve explicite.

**Contrôles reproductibles :**
`python3 tools/audit_assets.py`,
`python3 tools/audit_visual_assets.py`,
`node tests/navigation.test.cjs` et la suite WebKit iPhone.
