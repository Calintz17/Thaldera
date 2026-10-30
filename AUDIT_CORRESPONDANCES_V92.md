# Thaldera | rapprochement des paysages et des portraits (v92)
Date : 30 octobre 2026.

## Défaut de l'ancien audit
Un lieu sans `galerie` individuelle ne prouve **pas** qu'aucun paysage existe dans les sources.
L'audit V91 mélangeait : (1) image déjà présente sous un autre nom, (2) illustration dans un PDF source non convertie en fichier web, (3) illustration légitimement absente, (4) carte géographique inexistante et (5) contenu encore non joué.

## Rattachements confirmés et appliqués dans `data/`
- Assemblage, Havre Noir : quatre paysages `assemblage-*.webp`.
- Atelier Sahrim, Kazad Marunn : `atelier-de-poterie.webp`.
- Demeure de la Suuraal, Agran : `la-suuraal.webp`.
- Capitainerie d'Azuren Kai : `capitainerie.webp`.
- Quartiers de Neryn Yosa : `neryn-yosa.webp`.
- Domaine Siharen : `palais-siharen.webp`.
- Chez Capella : `chambre-de-bonne-capella.webp`.
- Île aux Moines : `traversee-de-la-jungle.webp` (scène d'accès, pas une carte).
- Écoles de l'Éloquence, de la Vaillance, de la Création et du Savoir (Lumenlid) : les illustrations de leurs épreuves et cours.
- Zélote de Lolth : `img/pnj/zeloth-de-lolth.webp` déjà dans le dépôt.
- Orant des Failles : `img/pnj/agran-uruukaysal.webp` déjà dans le dépôt.

**Précaution :** l'auberge Copperworth n'est pas identifiée avec certitude comme l'auberge du Moulin ; cette association provisoire a été annulée.

## Illustrations effectivement retrouvées dans les PDF, non encore transférées dans GitHub
L'archive de livraison `Thaldera_media_reconciled_v92.zip` fournie dans la conversation contient **29 fichiers** :
- Creux d'Azur : neuf scènes (camp, caravane, ville, funérarium, forge, boucherie, Chope Fendue, ruelle, temple), pages 3, 5 à 12 du PDF `Creux d'azur, Vesper, Malquessar`.
- Corvalis : dix scènes pour neuf lieux (portes, Ganimède, Omen, Lavande/Tour du Pentacle, quartier de Durnan, théâtre, deux salons du palais, Augustine, Greenwood), pages 7, 9 à 17 du PDF `Corvalis, Lumenlid,Obaline,Lunsk,Voros`.
- Pyrrah : la taverne de la Griffe, les Thermes Solaires, le sanctuaire de l'Incarnat, pages 11, 20 et 22 du PDF `Pyrrah`.
- Camont : arrivée sur les quais, page 4 du PDF `Camont`.
- Six portraits fournis par le MJ : Soren, Porteur de Hallebarde, Faucheuse d'Échos, Démon des Mains, Tembo et Urrak.

L'archive fournit les chemins attendus `img/`, une liste `media_manifest.json` et `apply_media.py` qui établit les liaisons **après** copie des fichiers dans une copie du dépôt. Les PNG transparents conservent leur alpha ; les JPEG conservent leurs fonds originaux. Les illustrations PDF parfois réduites à 680–980 px de large méritent un remplacement par les originaux lorsque ceux-ci existent.

**Important :** les fichiers binaires de cette archive n'ont pas été transférés sur GitHub. Ne jamais inscrire leurs chemins comme références actives tant que leurs fichiers n'ont pas été copiés dans le dépôt : cela casserait la vérification d'intégrité.

## Traitement des décisions MJ
15 fiches secondaires désignées comme superflues ont été retirées du catalogue public ; leurs relations structurées ont été épurées. 9 PNJ sont explicitement conservés sans image. Les deux portraits déjà au dépôt ont été rattachés.

## Cas encore ouverts
- Atelier de Drisuun, Agran : `img/pnj/agran-drisuun.webp` existe (portrait), mais **aucun paysage autonome correspondant** n'est présent dans `img/paysages/agran/` à la date du contrôle. Le nom `Agran - Drisuun` communiqué par le MJ est un alias source valide à rechercher dans les archives d'origine ; ne pas confondre l'image du PNJ avec le décor.
- Sous-Corolle de Lunsk, certains lieux d'Havre Noir, les scènes non converties de Corvalis/Creux et plusieurs lieux futurs doivent être catégorisés individuellement ; éviter le recyclage de paysages génériques.
- Les cartes ne se confondent pas avec les paysages : l'Outreterre et Kazad Marunn sont sans plan dédié ; Valedorn n'a pas encore de carte par choix narratif.
- Aucun portrait/logo ne doit être inventé pour combler une absence validée par le MJ.

## Audit consultable
Le fichier `Audit_Codex_Thaldera_V92_correspondances.xlsx` fourni dans la conversation est l'inventaire de travail ; il distingue les 12 fiches de lieu corrigées dans GitHub, les 21 fiches de lieu retrouvées dans les PDF et les 72 autres lignes nécessitant une décision de rapprochement ou une confirmation d'absence (et non pas 72 pertes prouvées).

Les contrôles d'intégrité restent actifs : `python3 tools/check_data.py`, `python3 tools/audit_visual_assets.py` et `node tests/navigation.test.cjs`.
