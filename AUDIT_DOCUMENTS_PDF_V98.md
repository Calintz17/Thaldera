# Audit comparatif Documents : sources PDF vs Codex

Date : 30 octobre 2026. Inventaire GitHub branche `main` et PDF de campagne disponibles dans ce projet.

## Bilan vérifié

- **44 ensembles documentaires** répertoriés dans `data/documents.json`.
- **57 images WebP** référencées, toutes présentes dans `img/props/`.
- **0 image orpheline / 0 référence cassée** parmi ces 57 images.
- **61 images supposées dans les PDF** : nombre **non confirmé** sur les fichiers accessibles. Un PDF de scénario compte aussi des scènes, personnages, cartes, objets et des mentions narratives de documents : compter les images intégrées n’établit pas le nombre de props.
- **61 − 57 = 4**, et non 3. Aucun des quatre fichiers supplémentaires ne peut être identifié avec certitude à ce stade.

## Couverture des sources, par degré de preuve

| Niveau | Images dans le Codex | Signification |
|---|---:|---|
| A | 7 | Documents reproduits en pages illustrées dans un PDF disponible ; correspondance narrative et ordre des pages, identité binaire non vérifiée |
| B | 2 | Document explicitement cité dans un PDF, sans page autonome reproduite |
| C | 10 | Scénario accessible, association contextuelle ; image source exacte non démontrée |
| D | 38 | PDF complet de la région non fourni parmi les fichiers consultés |
| **Total** | **57** | |

## Matrice exhaustive des 44 collections (57 images)

| Région | Document du Codex | Images | Correspondance PDF | Preuve |
|---|---|---:|---|---|
| Agran | `agran-astariel-journal` (Journal de bord de l'Astariel) | 3 | D — PDF de scénario correspondant non disponible | — |
| Agran | `agran-ordre-imperial` (Ordre de mission impérial) | 1 | D — PDF de scénario correspondant non disponible | — |
| Steppes rouges | `brakka-journal-mesa` (Journal non traduit du monastère) | 1 | D — PDF de scénario correspondant non disponible | — |
| Camont | `camont-lettre-graham` (Lettre des coffres de Graham) | 1 | C — scène d'origine dans PDF, pièce non visible | p. 17–19 |
| Cap Cornes | `cap-cornes-liste-oni` (Liste trouvée sur l'Oni aux Masques) | 1 | D — PDF de scénario correspondant non disponible | — |
| Keras Tauroc | `keras-livre-hematome` (Extrait du livre de combat d'Hématome) | 1 | D — PDF de scénario correspondant non disponible | — |
| Keras Tauroc | `keras-lettre-ferox` (Lettre trouvée chez Ferox) | 1 | D — PDF de scénario correspondant non disponible | — |
| Keras Tauroc | `keras-lettre-cornua` (Lettre reçue au Cornua Fracta) | 1 | D — PDF de scénario correspondant non disponible | — |
| Kazad Marunn | `khazad-bibliotheque` (Documents de la Bibliothèque Enfouie) | 2 | A — 7 feuillets visibles dans PDF | p. 33–38, 40 |
| Kazad Marunn | `khazad-donjon` (Documents du donjon d'Aram Sharûn) | 5 | A — 7 feuillets visibles dans PDF | p. 33–38, 40 |
| Le Vesper | `vesper-agent` (Lettre d'un agent de l'Aile d'Argent) | 1 | B — mention textuelle dans PDF | p. 24 |
| Île aux Moines | `ile-moines-journal-septim` (Extrait du journal de frère Septim) | 1 | D — PDF de scénario correspondant non disponible | — |
| Île aux Moines | `ile-moines-lettre-berger` (Lettre trouvée parmi les affaires du Berger) | 1 | D — PDF de scénario correspondant non disponible | — |
| Obaline | `obaline-avis-ira` (Avis de recherche : Ira Malden) | 1 | C — mentions d’avis sans identification individuelle | p. 38 |
| Obaline | `obaline-avis-philippa` (Avis de recherche : Philippa) | 1 | C — mentions d’avis sans identification individuelle | p. 38 |
| Obaline | `obaline-avis-varsha` (Avis de recherche : Varsha) | 1 | C — mentions d’avis sans identification individuelle | p. 38 |
| Obaline | `obaline-avis-lenach` (Avis de recherche : Lenach) | 1 | B — affiche mentionnée dans PDF | p. 43 |
| Obaline | `obaline-lettre-chasseur` (Lettre portée par un chasseur du Dominion) | 1 | C — scénario présent, pièce non reproduite | p. 38–51 |
| Obaline | `obaline-propagande-dominion` (Propagande du Dominion) | 1 | C — scénario présent, pièce non reproduite | p. 38–51 |
| Port Doëlan | `port-flyer-ether` (Affiche du Comptoir de l'Éther) | 1 | D — PDF de scénario correspondant non disponible | — |
| Port Doëlan | `port-flyer-valkur` (Affiche du temple de Valkur) | 1 | D — PDF de scénario correspondant non disponible | — |
| Port Doëlan | `port-flyer-mobilisation` (Appel à la mobilisation) | 1 | D — PDF de scénario correspondant non disponible | — |
| Port Doëlan | `port-flyer-spezza` (Affiche publique à la gloire de Spezza) | 1 | D — PDF de scénario correspondant non disponible | — |
| Port Doëlan | `port-lettre-matthias` (Lettre de mission de Matthias Holbrekt) | 1 | D — PDF de scénario correspondant non disponible | — |
| Port Doëlan | `port-plan-vespera` (Plan d'action de Vespera) | 1 | D — PDF de scénario correspondant non disponible | — |
| Port Doëlan | `port-registres-titan` (Registres internes de Titan Inc.) | 3 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-avis-officiel` (Avis officiel à la population) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-avis-ako` (Avis de disparition : Ako) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-avis-tobiya` (Avis de disparition : Tobiya) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-journal-protectrice` (Extrait du journal de la Protectrice) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-flyer-sumeren` (Affiche de la boutique de Sumeren Daïko) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-flyer-oren` (Affiche de la boutique d'Oren Sidaï) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-lettre-brodek` (Lettre de Brodek Kovacz au magistrat) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-lettre-konya` (Lettre adressée à Konya Sokabeï) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-parchemin-psa84` (Parchemin PSA-84) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-rapport-uramei` (Rapport d'enquête sur les Urameï) | 2 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-liste-tobiya` (Liste de missions de Tobiya) | 1 | D — PDF de scénario correspondant non disponible | — |
| Temple Brumeux | `temple-brumeux-journal-septim` (Extrait du journal de frère Septim) | 1 | D — PDF de scénario correspondant non disponible | — |
| Voros | `voros-affiche-jericho` (Affiche de Jericho) | 1 | C — scénario présent, pièce non reproduite | p. 71–77 |
| Voros | `voros-lettre-skrell` (Lettre de Lavande à Skrell) | 1 | C — scénario présent, pièce non reproduite | p. 71–77 |
| Voros | `voros-lettre-village` (Lettre du village abandonné) | 2 | C — scénario présent, pièce non reproduite | p. 71–77 |
| Île aux Moines | `ile-moines-journal-augustus` (Extraits du journal de frère Augustus) | 3 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-menace-inconnue` (Lettre de menace retrouvée à Roshen Buru) | 1 | D — PDF de scénario correspondant non disponible | — |
| Roshen Buru | `roshen-rapport-cloture-019` (Rapport de clôture, dossier 019-08) | 1 | D — PDF de scénario correspondant non disponible | — |

## Mentions de pièces dans les PDF, sans page autonome dans le catalogue

Ces éléments sont des **pistes de documents** et **pas des images manquantes confirmées**. Le PDF les décrit en texte, sans fournir nécessairement une illustration exportable :

| Scénario et page | Pièce décrite | Situation dans le Codex | Vérification nécessaire |
|---|---|---|---|
| Creux d'Azur / Vesper p. 21 | Lettre des druides de l'équilibre tordu, découverte dans la mine | Aucun document éponyme dans `data/documents.json` | Confirmer l'existence d'un handout visuel destiné aux joueurs |
| Havre Noir p. 9 | Copie des registres du port, bureau d'Arvik Denholm | Aucun handout distinct catalogué | Pièce récupérable sous condition dans le scénario, ne pas présumer son acquisition |
| Havre Noir p. 9 | Notes du scribe Arvik Denholm | Aucun handout distinct catalogué | Déterminer si une page illustrée a été créée |
| Havre Noir p. 28 | Registres du Gratte-papier et éventuelle note personnelle | Aucun handout distinct catalogué | Plusieurs découvertes conditionnelles ; vérifier ce qui fut réellement obtenu par les joueurs |

Un autre objet est évoqué à Camont (p. 21 : « Lettre des Épingles »), également sans document autonome référencé. Il renforce la nécessité de ne pas transformer toute mention narrative en « image manquante ».

## Contrôle visuel spécifique : Kazad Marunn

Le PDF `Khazad-Marûn PDF.pdf` contient les pages documentaires **33, 34, 35, 36, 37, 38 et 40**, soit **7 pages**. Le Codex a **2 pages `khazad-bibliotheque`** et **5 pages `khazad-donjon`**, soit **7 images**. Correspondance comptable et contextuelle cohérente. L'identité visuelle parfaite entre images du dépôt et pages PDF n'a pas été vérifiée pixel à pixel.

## Conclusion

L'inventaire GitHub est complet **pour les 57 images importées**. Les PDF disponibles ne constituent pas un jeu de référence couvrant les 44 collections : plusieurs campagnes ne sont pas représentées (Roshen Buru, Port Doëlan, Keras Tauroc, Agran et autres). L'écart supposé à 61 ne peut pas être attribué à quatre images précises sans la source contenant ces 61 pages, ou un manifeste établi par le MJ. Ne pas inventer des documents ni les publier sur la seule base de notes de scénario conditionnelles.
