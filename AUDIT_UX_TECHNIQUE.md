# Thaldera Codex | Audit UX, cartographie et performance
**Base analysée :** v53, commit `e6495244385f363193c50e359ad90374a9763278`  
**Correctifs livrés :** v54  
**Périmètre :** fonctionnement du codex, interface, réseau de fiches, images et atlas. Aucun changement de lore.

## Inventaire vérifié
- **783 fiches** : 389 PNJ, 258 lieux, 52 villes, 8 continents/plans, 5 régions, 3 factions, 3 PJ et autres entrées.
- **616 fichiers image**, dont 599 WebP ; **725 usages visuels** représentant 498 chemins distincts.
- **0 référence vers une image absente**, **0 parent inconnu**, **0 relation vers un ID absent**, **0 lieu référencé absent**.
- **8 polygones territoriaux** : aucun sommet hors plage normalisée [0,1], aucun label explicite situé hors de son polygone.
- **0 identifiant de carte inconnu** parmi les fiches associées à une carte parente.
- **118 images sans référence dans les fiches**, dont **60 fichiers dans des dossiers PNJ**. Ces fichiers ne sont pas automatiquement des personnages manquants. Plusieurs sont des versions alternatives ou des doublons historiques.
- **6 fichiers portrait partagés** par plusieurs fiches distinctes, vraisemblablement des images de groupes ou de personnages associés. À valider en contexte avant toute modification.

## Problèmes de la v53 et correctifs v54
| Priorité | Problème | Action appliquée |
| --- | --- | --- |
| Haute | Chaque fiche pouvait rescanner tout le réseau pour retrouver les relations entrantes | Index inversé `REVERSE_REL` construit une seule fois |
| Haute | Recherche répétée de PNJ présents dans les lieux | Index `NPC_AT`, dédoublonnage et tri stabilisé |
| Haute | Reconstruction répétée des collections de villes, lieux et voyages | Cache par identifiant et type de collection |
| Haute | Plusieurs calculs de scène identiques pour le panneau et la carte | Cache borné des scènes calculées |
| Haute | Cartes haute résolution chargées immédiatement sur ordinateur | Chargement progressif uniquement au zoom, **fichiers originaux conservés** |
| Haute | Recalcul forcé de layout lors des gestes de déplacement cartographique | Suppression du flush à chaque mouvement |
| Haute | Gestionnaires globaux conservés après la destruction de cartes empilées | Gestion par `AbortController` et nettoyage |
| Haute | Navigation asynchrone pouvant afficher une ancienne carte après un clic rapide | Vérification de jeton de navigation pour carte et pile |
| Moyenne | Lissage automatique déformant les sommets territoriaux | Trait exact des sommets ; traitement pair-impair pour les sous-contours |
| Moyenne | Navigation trop dépendante des points sur la carte | Explorateur transversal avec filtres continent, territoire et type de fiche |
| Moyenne | Pas de commandes cartographiques visibles | Zoom avant, arrière et retour au cadrage de la fiche |
| Moyenne | Points dorés encombrants et traits trop lumineux | Marqueurs plus discrets, hiérarchie carte/texte, réduction des halos |
| Moyenne | Images de fiches enfants chargées comme fonds CSS | Images HTML avec décodage asynchrone et chargement différé |
| Moyenne | Galeries changeant de visuel automatiquement | Navigation manuelle, pagination au clavier |
| Moyenne | Hiérarchie de lecture et contrastes irréguliers | Contrastes secondaires, panneaux, cartes et focus améliorés |
| Faible | Chargement de polices extérieures non préconnecté vers le domaine de fichiers | Préconnexion à `fonts.gstatic.com` |

## Limites et points de validation
1. **Géographie :** la correction du lissage garantit que le navigateur respecte les sommets stockés. Elle ne garantit pas que ces sommets aient été tracés exactement sur les frontières peintes de la carte. Le placement des **165 points possédant un champ `pos`** doit être contrôlé avec les cartes sources. Aucun déplacement arbitraire n'a été effectué.
2. **Fonds et portraits :** les images référencées existent. Une image historiquement erronée ou un personnage sans fiche ne peuvent pas être identifiés avec certitude par comparaison de chemins. Contrôle humain nécessaire pour les 60 candidats non référencés et les 6 images partagées.
3. **Images des PNJ :** 175 fiches de PNJ ne déclarent pas de portrait principal ou de forme illustrée. Elles peuvent être volontairement textuelles.
4. **Performance :** les améliorations sont fondées sur l'analyse statique. Aucune réduction chiffrée de temps de chargement, LCP ou INP n'est revendiquée sans test du site déployé sur ordinateur et mobile.
5. **Architecture :** l'application reste volontairement sans étape de build et utilise un seul script principal. Un découpage en modules et un manifeste de recherche séparé peuvent être envisagés si le volume des fiches augmente substantiellement.

## Maintenance et publication
- `python3 tools/check_data.py` vérifie les fiches, parents et relations.
- `python3 tools/audit_assets.py` contrôle les références visuelles, coordonnées hors carte et dresse l'inventaire des images PNJ sans fiche référente.
- `node --check assets/app.js` vérifie la syntaxe JS.
- Le workflow GitHub Actions `codex-quality.yml` exécutera ces vérifications à chaque push et pull request.
- Les images existantes ne sont ni recompressées, ni redimensionnées, ni supprimées.

## Validation visuelle recommandée
- Test smartphone : arrivée sur une fiche par URL, explorer, sélection du continent, navigation depuis la carte, ouverture et fermeture des quêtes.
- Test sur ordinateur : contours Istra/Thaldera, cadrage des régions, 8 polygones, marqueurs de villes et de lieux, transitions rapides de cartes.
- Validation de cohérence des illustrations : portrait principal, forme contextuelle, arrière-plan de ville, lieu et personnage, sans modifier le texte.

## Complément v55
Le zoom haute résolution est désormais accessible sur les écrans tactiles également, sans dégrader les assets. Les cartes inférieures des villes à plusieurs plans utilisent le chargement différé, et les commandes inactives sont masquées derrière les galeries et plans empilés.
