# Relecture éditoriale : répétitions entre blocs de PNJ

Date : 28 octobre 2026. Périmètre : **389 fiches PNJ et 3 fiches PJ**,
champs résumé, introduction, ce que le groupe sait, historique, chronologie.
Les textes, les faits et le lore sont conservés intégralement.

## Résultat
Le rapprochement lexical automatique à seuil modéré signale **63 paires candidates**
dans plusieurs dizaines de fiches, sans en déduire que les 63 sont des erreurs.
La répétition peut être utile si un résumé présente le personnage puis une section
développe ce même fait avec des informations supplémentaires.

### Répétitions à consolider en priorité, après validation éditoriale
| Fiche | Sections | Observation |
|---|---|---|
| Seravine | Résumé / connu 1 | Serpent venimeux, intelligence et origine du nom répétés |
| La Nubbé | Résumé / connu 1 | Description physique initiale presque reprise à l'identique |
| Irna | Connu 1 / connu 3 | Même justification du vol dans deux points distincts |
| Draven Corbéal | Résumé / connu 2 | Opportunisme et condition du voyage vers Port Lagon repris |
| Cleff | Résumé / connu 1 | Enfant et sac volé, avec Irna et Tilda, très proches |
| Filver Brandepoix | Résumé / connu 2 | Prisonnier et accusation contre le Passeur de Camont répétés |
| Korrash | Résumé / connu 3 | Alliance financière avec Spezza et expansion vers l'Ouest |
| Vitiosa | Résumé / connu 3 | Nature démoniaque et attitude envers le groupe reprises |
| Thaal | Connu 2 / connu 5 | Présage des braises répété dans plusieurs formulations |
| Sorenka | Connu 7 / histoire 4 | Même issue du combat contre les doubles racontée deux fois |

### Répétitions contextuelles probablement volontaires
- **Absalom** : des événements figurent à la fois dans `histoire` et dans
  `etapes` (Keras Tauroc ; Temple du Tenraku). La chronologie permet de
  suivre son évolution ; une déduplication mécanique serait contre-productive.
- **Vespera Merigold** : récit de sa transition à Port Doëlan repris dans une
  étape de parcours, utile pour situer le moment de l'intrigue.
- Plusieurs fiches de personnages mineurs répètent le métier, le lieu ou
  l'apparence entre résumé et connu. C'est parfois le fonctionnement voulu d'un codex.

## Suggestion UX (aucune modification narrative)
Présenter le **résumé en en-tête** puis les informations et événements dans des sections
distinctes. Les chronologies et réseaux de relations restent accessibles même si un fait
est mentionné dans deux rubriques.

## Méthode
L'outil `python3 tools/audit_repetitions.py` relève les candidats par
recouvrement de mots. Il ne mesure pas la proximité sémantique complète ;
une revue humaine reste nécessaire pour accepter un changement de texte.
