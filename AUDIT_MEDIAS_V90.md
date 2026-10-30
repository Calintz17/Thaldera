# Thaldera Codex : audit médias et fiches v90
**30 octobre 2026**. Constat sur la branche `main`, documents de campagne et inventaire d'images. Ce rapport distingue les corrections réellement déployées, les défauts toujours ouverts et les fichiers à remplacer.

## Corrections dans le code
- Toutes les galeries utilisent un **cadre de paysage 4:3 à dimensions constantes** : le fichier source est contenu sans déformation et sans variation de taille d'une diapositive à l'autre. Aucune ressource originale n'est modifiée.
- Les portraits/« cutouts » sont redimensionnés sur la zone utile du paysage, avec un plafond plus bas (environ 25 % de réduction des dimensions maximales). L'ancrage s'effectue sur le cadre, pas sur les dimensions de la source. Les contraintes restent adaptées au mobile.
- Les fiches de lieux/personnages sans illustration propre ne reprennent plus arbitrairement le premier paysage de leur **ville**. En particulier, la Course de Mirenne ne doit plus servir d'image de fond sur toutes les fiches de Corvalis.
- La navigation des anciennes URL Bourre-Piff, Seravine, Tilda et Cleff redirige vers leurs fiches canoniques après fusion.
- Le réseau d'un PNJ classe les **personnes** en alliés/ennemis/autres liens ; villes, organisations et factions passent dans « Lieux et factions ».

## Rattachements corrigés et absences constatées
| Fiche ou secteur | État actuel du dépôt | Intervention / suite |
|---|---|---|
| Aile d'Avalon, Voros | Illustration `img/paysages/lunsk/aile-d-avalon.webp` disponible mais non attribuée | **Corrigé** : paysage relié à la fiche de l'Aile d'Avalon |
| Vieux garde de la villa Graham, Camont | Portrait `img/pnj/camont-garde-de-la-salle-des-coffres.webp` disponible mais non attribué | **Corrigé** : portrait relié à la fiche |
| Creux d'Azur / Outreterre | **0 paysage** propre au lieu ou à la ville dans le catalogue GitHub ; le PDF source comporte des scènes illustrées | **À importer** depuis les originaux, après contrôle de résolution et validation de correspondance |
| Carte de l'Outreterre | Placeholder explicite dans le catalogue | En attente de la carte fournie ultérieurement par le MJ |
| Corvalis | Seulement deux paysages dans `img/paysages/corvalis/` : `course-de-miren.webp` et `faveur-de-waukeen.webp` | Fallback inadéquat corrigé ; importer les autres illustrations de scènes (PDF source), avec validation visuelle |
| La sous-corolle, Lunsk | Aucune galerie personnelle ; aucun fichier du dépôt correspondant à ce nom | Illustration à retrouver dans les sources originales |
| Chez Mezzek, Lunsk | `entrepot-de-mezzek.webp` lié à `repaire-de-mezzek` | Rattachement déjà correct |
| Bourpif, Solkah + Seravine, Irna + Tilda + Cleff | Identifiants et fiches en double / groupe éclaté | **Corrigé** : une seule fiche par groupe, anciens alias et notes conservés |
| Mika | Fiche sans média utile, liée à Teka | Fiche retirée à la demande du MJ ; relation résiduelle Teka supprimée |

**Important** : le PDF `Creux d'azur, Vesper, Malquessar PDF.pdf` comporte des illustrations de Creux d'Azur, notamment la ville, le salon funéraire, la forge, la Chope Fendue, la ruelle/cage et le temple. Le PDF `Corvalis, Lumenlid,Obaline,Lunsk,Voros PDF.pdf` comporte des scènes de Corvalis et de l'Aile d'Avalon. Un visuel intégré dans un PDF n'est **pas** pour autant un fichier autonome haute résolution déjà présent dans GitHub. La réimportation doit privilégier les originaux plutôt qu'une extraction basse résolution.

## Inventaire des images potentiellement pixellisées
Le script `python3 tools/audit_visual_assets.py` calcule un facteur d'agrandissement sur des surfaces indicatives **960 × 720 px pour un paysage** et **440 × 560 px pour un asset/personnage**.

À la dernière exécution de GitHub Actions : **133 paysages** et **103 portraits/assets** référencés demanderaient un agrandissement de plus de 10 % pour remplir ces surfaces. Ceci est un indicateur technique, pas une évaluation perceptive de la qualité. Le redimensionnement de l'interface peut réduire l'agrandissement réel.

### Priorité haute de remplacement
| Fichier | Source | Agrandissement indicatif |
|---|---|---|
| `img/paysages/port-doelan/crique.webp` | 540 × 360 px | ×1,78 |
| `img/pnj/agran-kel-assistant-de-peraalys.webp` | 191 × 230 px | ×2,30 |
| `img/pnj/saoren.webp` | 132 × 307 px | ×1,82 |
| `img/pnj/agran-fragment-de-nyrrh.webp` | 283 × 282 px | ×1,55 |
| `img/pnj/monstre-du-gibet.webp` | 289 × 309 px | ×1,52 |

### Priorité intermédiaire
- Nombreux paysages des steppes rouges en **720 × 480 px**, agrandissement indicatif ×1,33.
- Nombreux paysages de Roshen Buru en **720 × 540 px**, agrandissement indicatif ×1,33.
- Portraits Orik (303 × 383), Dogrun (305 × 385), homme de main de Ferox 2 (280 × 398), Drisuun (244 × 400) et Shoba (278 × 401), agrandissement indicatif entre ×1,40 et ×1,45.
- La liste complète classée des 30 premiers paysages et des 30 premiers portraits est désormais publiée dans les logs du workflow `Codex integrity`.

## Incohérences non corrigées sans preuve
- Le rattachement exact de toutes les illustrations au bon lieu exige une comparaison visuelle complète des médias du PowerPoint/PDF avec leurs noms de fichiers. Ne jamais remplir un lieu avec une illustration d'un autre endroit.
- L'arbre surnommé « du Landonext », les « Sept », « Kadim » et certains noms de PNJ relevés oralement ne sont pas rattachables de manière certaine aux identifiants actuellement présents. Ne pas créer de personnage, supprimer un autre personnage ou modifier son statut sur une simple ressemblance de nom.
- **Arlo Brisemousse** (Malquessar) est distinct d'un éventuel **Arlo du Voile** : aucune modification de son état n'a été effectuée.
- Les contenus présents uniquement dans les sources n'ont pas été importés dans le dépôt au cours de ce lot : ils restent dans la liste de travail.

## Validation technique
Le workflow GitHub Actions `Codex integrity` est passé avec succès après les fusions, modifications de statuts, associations d'images et correction des relations orphelines. Il contrôle les identifiants, les relations, la navigation, les ressources liées, la syntaxe JavaScript et l'inventaire de résolution. Aucun test de rendu visuel multi-écrans ni de perception du flou n'est assimilé à cette validation automatique.

### Remplacement recommandé
Conserver le ratio original des illustrations si possible, privilégier des paysages natifs d'au moins **1 280 × 960 px**, idéalement **1 600 × 1 200 px**, et des portraits suffisamment grands pour l'affichage prévu, idéalement **700 px ou plus sur le côté court** lorsque la découpe le permet. Remplacer le fichier existant sans modifier son chemin pour préserver les relations et les fiches.
