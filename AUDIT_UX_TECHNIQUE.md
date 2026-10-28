# Thaldera : audit UX, architecture et données
État du dépôt étudié : v53 à v55, 28 octobre 2026. Livraison corrective v56.

## Périmètre
Audit statique du code, des fichiers JSON, des polygones, des chemins de ressources,
de la navigation, des affichages prévus sur mobile et de l'architecture des assets.
Le lore et les textes narratifs ne sont pas réécrits.

### Volume
- 783 fiches : 389 PNJ, 258 lieux, 52 villes, 8 continents, 5 régions, 3 factions et autres entrées.
- 4 catalogues de données JSON chargés au démarrage.
- Plus de 600 ressources graphiques ; cartes originales WebP préservées.
- 60 images dans des répertoires PNJ sans référence directe dans les données JSON analysées.
  Plusieurs fichiers sont des anciennes copies/variantes et ne prouvent pas l'absence d'une fiche.

## Correctifs livrés (v54 à v56)
### Performance
- Index inversé des relations et du rattachement des PNJ aux lieux, contre les scans répétés des 783 fiches.
- Cache des collections et des scènes cartographiques.
- Chargement différé des galeries, des plans de cartes inactifs et des vignettes.
- Carte de résolution intermédiaire initiale, puis version originale au zoom ; images originales inchangées.
- Nettoyage des écouteurs temporaires des plans empilés.

### Navigation
- Explorateur global par continent, région, type de fiche et recherche.
- Recherche clavier / ; fil d'Ariane et liens entre fiches conservés.
- PNJ d'une ville/région maintenant retrouvés aussi par le lieu déclaré, même si
  leur parent hiérarchique est un clan ou une organisation.
- Galerie commandée par le joueur, boutons de navigation accessibles.

### Cartographie et direction artistique
- Tracé des régions selon les sommets JSON exacts ; suppression de l'arrondi Bézier qui dépassait les frontières.
- Gestion des trous géographiques des polygones ; contours lumineux rendus plus discrets.
- Points différenciés et allégés, contrôles de zoom, contrastes et navigation mobile renforcés.
- Palette de manuscrit dark fantasy conservée (Cinzel / EB Garamond, or discret).

## Risques résiduels à traiter par inspection visuelle
1. Coordonnées de Camont (0,477 ; 0,683) : le point apparaît hors du polygone
   Consortium, d'après le test géométrique. Vérifier son placement sur la carte mère.
2. Coordonnées de Leyenmil (0,320 ; 0,665) : très proche, mais extérieure au
   polygone Altéra. Comparaison avec la carte mère requise.
3. Les 60 portraits PNJ orphelins doivent être rapprochés des fiches existantes
   avant toute création ou remplacement : exemples de variantes historiques,
   de doublons et de portraits sans fiche certaine.
4. Les fonds illustrés peuvent être techniquement valides mais artistiquement incohérents.
   Cela nécessite une revue humaine des images de lieux et de leurs associations.
5. Aucun score Lighthouse ni temps de chargement réel n'a été relevé.
   Les gains sont fondés sur l'analyse du code, sans métrique de performance mesurée.
6. Les 4 catalogues JSON sont toujours chargés au premier affichage.
   Un prochain lot pourra introduire un index léger et charger les fiches par zone à la demande
   après vérification de la recherche globale, des liens et des secrets MJ.
7. Les contours des cartes doivent être vérifiés à l'image, car préserver
   les sommets corrige les déformations du rendu, pas les coordonnées originales mal relevées.

## Vérification reproductible
- `python3 tools/check_data.py` : intégrité, identifiants, relations, champs interdits.
- `python3 tools/audit_assets.py` : références d'images, parents, coordonnées,
  liste des portraits non utilisés, positions cartographiques suspectes.
- `node --check assets/app.js` : syntaxe du moteur sans étape de compilation.
- GitHub Actions exécute ces contrôles à chaque push et pull request.

## Principes de gouvernance
- Ne jamais associer un portrait « orphelin » à un PNJ sur simple ressemblance de nom.
- Ne jamais déplacer un point de carte sans comparaison sur le bon fond cartographique.
- Ne jamais réduire la résolution ni réécrire le lore pour gagner de la vitesse.
- Vérifier les parcours sur ordinateur et mobile avant de déclarer les améliorations
  visuelles entièrement validées.
