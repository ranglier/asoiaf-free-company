# ASOIAF Free Company : Règles — plan détaillé du chapitre « Batailles »

Plan de travail, 2026-11-02. Source des règles : `docs/regles-bataille.md` (v0.4, système v0.28.7). Ce plan sert à valider le contenu avant la mise en page ; rien de ce fichier n'ira tel quel dans le livret.

## Le document complet

**ASOIAF Free Company : Règles**, un seul document, en chapitres :

- Ouverture : couverture, sommaire, « Comment lire ce livret » (les encadrés, les renvois au livre de base, le module Foundry qui va avec).
- **Chapitre 1 : Batailles** (ce plan).
- Chapitre 2 : La Compagnie (fin de mois, Cohésion, catalogue, services), plus tard.
- Chapitre 3 : Sièges, plus tard.
- Annexes communes : glossaire, index, aide-mémoire détachables.

Principes de rédaction :

- Ton neutre et direct, phrases courtes, présent de l'indicatif. On dit « la troupe », « le MJ », « le joueur ».
- Une règle = ce qu'elle fait, puis comment on l'applique, puis un exemple.
- Vocabulaire du livre français : compétence, Corps à corps, Art militaire, dés de malus, dés de bonus, degrés.
- Pas de texte recopié du livre de base ni d'un wiki ; on renvoie au livre pour les tests de compétence.
- Exemples tirés de batailles du canon, transposées avec nos règles (une transposition pour expliquer, pas un récit fidèle).
- Ni numéros de version ni dates de décision dans le livret (ils restent dans `docs/regles-bataille.md`, qui devient le document de conception).

## Les éléments de mise en page

| Élément | Usage |
|---|---|
| **Exemple** (encadré) | Une règle appliquée avec de vrais chiffres, tiré d'une bataille du canon. |
| **Dans Foundry** (encadré court) | Où cliquer, ce que le module fait seul, ce qu'il laisse au MJ. Deux ou trois lignes. |
| **Arbitré par le MJ** (pastille) | Règle que le module n'applique pas : le MJ la joue. |
| **Conseil** (encadré) | Comment bien jouer une règle, côté joueur ou MJ. |
| **Schéma** | Carte en hexagones, pour ce qui se comprend mal en texte. |
| **Tableau de référence** | Tout ce qu'on consulte en jeu : modificateurs, états, traits, terrains. |

## Les batailles du canon utilisées

| Bataille | Époque | Ce qu'elle illustre | Où dans le chapitre |
|---|---|---|---|
| La bataille du Champ d'Herberouge, dite bataille d'Herberouge (196 après la Conquête) : les Dents de Freux, archers de Brynden Rivers, dit Freuxsanglant, en haut de Crête-en-Pleurs, face à Daemon Feunoyr ; la fuite d'Aegor Rivers, dit Aigracier, qui fondera la Compagnie Dorée | Rébellion Feunoyr | Colline, tir depuis la hauteur, angle mort, flanc | 4 (vue), 7 (tir) |
| La bataille du Trident (283), au gué des Rubis : l'ost de Robert et celui de Rhaegar | Rébellion de Robert | Gué, Tenir le passage, ordres gagnants | 4 (terrain), 7 (mêlée) |
| La bataille des Cloches (283), à Pierremoûtier : Robert blessé caché dans la ville, Jon Connington qui fouille les maisons, l'arrivée de Stark et Tully | Rébellion de Robert | Village, troupe cachée, combat dans les rues, relève | 4 (village), 6 (contact) |
| Le Bois-aux-Murmures (298) : Jaime Lannister attiré dans une vallée boisée | Guerre des Cinq Rois | Embuscade en lisière, frapper caché en premier | 5 (embuscade) |
| L'attaque de nuit près de Yunkaï (299) : les Corbeaux Tempête changent de camp, l'armée yunkaïie est surprise ; les Puînés sont dans le camp d'en face | Essos | Nuit, feux de camp, mercenaires | 4 (nuit), 8 (PJ : Lire le champ) |
| La conquête de Dorne par Daeron Ier (157 à 161) : par les Osseux, aussi appelés Voie de Pierre, à l'est des marches de Dorne, et des sentiers de montagne pour contourner les tours de guet ; puis la guérilla dornienne | Conquête de Dorne | Reconnaissance, plan de bataille, retraite et harcèlement | 5 (avant la bataille), 6 (repli) |

Noms français confirmés par Jules le 2026-11-02 (faits vérifiés sur A Wiki of Ice and Fire). Les Dents de Freux tiraient du haut de Crête-en-Pleurs.

## Chapitre 1 : Batailles

### 1.1 Introduction (1 page)
- Ce que couvrent ces règles : des batailles de quelques centaines à quelques milliers d'hommes, où la Compagnie tient un secteur.
- Le principe : ordres secrets donnés en même temps, puis révélés ; deviner l'adversaire compte plus que les dés.
- L'échelle : une case ≈ 10 m ; un tour ≈ 3 rounds de combat individuel ; une troupe ≈ 100 hommes par unité.
- Escarmouche ou bataille rangée (jauge générale de l'armée alliée).
- Ce qu'il faut : le livre de base (tests), le module Foundry, ce livret.
- **Dans Foundry** : où se trouve la fenêtre Bataille.

### 1.2 Les dés en bref (1 page)
- Test : D, dés de bonus (B), dés de malus, difficulté, degrés de réussite (rappel, renvoi au livre).
- Plafond : jamais plus de dés de bonus que de dés de test.
- Test d'opposition (la mêlée).
- **Tableau** : degrés de réussite.
- **Exemple** : un test de troupe 3D+1B contre 9.

### 1.3 Les troupes (4 à 5 pages)
- La fiche de troupe, case par case (**schéma** : une fiche annotée).
- Type et traits ; **tableau** des traits ; **tableau** des types du catalogue.
- Deux types au plus, améliorations d'équipement.
- Entraînement : rangs, encaissement, Discipline ; **tableau**.
- Compétences : toutes à 2, plus les rangs sur les compétences clés ; Corps à corps, Tir, Athlétisme.
- Entraînement en dés de bonus (vétéran 3D+1B, élite 3D+2B, bleus 2D+1B).
- États : Fraîche, Éprouvée, Désorganisée, En déroute, Détruite ; **tableau** des effets.
- Encaissement, ralliements, compteur de désorganisations.
- Hommes, unités, Puissance ; une unité montée compte pour 200 hommes.
- **Exemple** : la Compagnie Dorée à ses débuts (une troupe d'exilés vétérans), transposée en fiche.
- **Dans Foundry** : la fiche de troupe, le mode édition, le jeton et ses marques (état, officier, ordre).

### 1.4 Le champ de bataille (5 à 6 pages)
- La carte en hexagones ; une troupe par case.
- **Tableau** des terrains : colline, bois, marais, rivière, gué, pont, route, village, obstacles, ruines.
- Météo : pluie, brouillard.
- **La vue** :
  - le principe : une ligne droite entre deux centres de cases ;
  - ce qui bloque : bois, colline, village, ruines ; ce qui ne bloque pas ;
  - de jour, pas de limite de distance ;
  - **schéma** bois (de dehors, de la lisière, du fond) ;
  - **schéma** colline (au sommet, angle mort au pied d'une autre colline) ;
  - vue symétrique, sauf le bois.
- La nuit : cases voisines, cases éclairées, troupe qui combat ; **schéma** de nuit avec feux de camp.
- Repérer et identifier : 3 cases, éclaireurs 4 ; ce que veut dire « troupe inconnue ».
- **Exemples** : la bataille d'Herberouge (Crête-en-Pleurs, le tir vers le bas) ; le Trident (le gué des Rubis) ; la bataille des Cloches à Pierremoûtier (la ville qui cache) ; l'attaque de nuit près de Yunkaï (les feux du camp).
- **Dans Foundry** : le panneau des terrains, le brouillard de guerre par case, la nuit, les cases éclairées, ce que voit le joueur et ce que voit le MJ.

### 1.5 Avant la bataille (2 à 3 pages)
- Reconnaissance (PJ, service Guide, unité d'éclaireurs) ; échec grave.
- Plan de bataille : test d'Art militaire (Stratégie), points de plan.
- Les usages des points de plan : préparer le terrain, embuscade, choisir le champ, comme prévu, signal convenu, réserve.
- Déploiement.
- **L'embuscade** : point de plan, lisière d'un bois, frapper caché en premier (+1B) ; **schéma** de lisière.
- **Exemples** : Daeron Ier par les Osseux (reconnaissance, sentiers de montagne) ; le Bois-aux-Murmures (l'embuscade).
- **Dans Foundry** : la réserve de points de plan, cacher un jeton, l'embuscade calculée par le brouillard.

### 1.6 Le tour de bataille (5 à 6 pages)
- **Schéma** : la séquence du tour, en une ligne illustrée.
- Ordres secrets : un par troupe ; **tableau** des sept ordres.
- Ordres gagnants (Charger bat Tirer, Tenir bat Charger), Attaquer neutre, Tenir brise l'élan.
- Révélation, contre-ordres (point de plan ou Porter un ordre).
- Mouvements : simultanés ; case visée par deux troupes ; case d'un allié qui part ; charge qui se rabat ; échange de cases.
- **Le contact** : ordres permis, Se replier en fin de tour, relève ; **schéma** de repli et de relève ; exception de l'officier (arbitré par le MJ).
- Tirs (simultanés), mêlées, fin de tour (replis, réorganisation, déroutes).
- **Exemples** : la bataille des Cloches (relève dans les rues) ; la retraite dornienne (repli, arrière-garde).
- **Dans Foundry** : donner un ordre au clic droit, la barre du tour, la révélation, ce que fait le module à la fin du tour.

### 1.7 Le combat (5 à 6 pages) — chapitre témoin pour la mise en page
- Le tir, pas à pas : cible vue, portée, difficulté (9, +3 armure ou boucliers, couvert), dés, pertes (1 état au plus, sauf cible de flanc, en mouvement ou désorganisée), rechargement ; tir à l'aveugle (arbitré par le MJ).
- La mêlée, pas à pas : test d'opposition, jet unique de la cible attaquée par plusieurs, pertes par degré, encaissement, case disputée, égalité.
- **Tableau** des modificateurs de mêlée (attaquant / défenseur) : ordre gagnant, flanc (+1B au plus), surnombre, embuscade, terrain, traits, Choc, piques, volée, état, essoufflé.
- **Tableau** des modificateurs de tir.
- Ralliement et réorganisation ; déroute et fuite.
- **Exemples** : la bataille d'Herberouge (les Dents de Freux sur Crête-en-Pleurs) ; le Trident (mêlée au gué des Rubis, Tenir).
- **Dans Foundry** : la fenêtre de résolution, les champs +B, −D, ±, l'encaissement demandé au joueur, la carte de chat.

### 1.8 Les PJ dans la bataille (3 pages)
- Une action par tour, ou une scène individuelle de 3 rounds.
- **Tableau** des actions : Commander, Rallier, Combattre en première ligne, Tirer avec l'unité, Lire le champ, Porter un ordre, Exploit, Action libre.
- Commander (difficulté, +1B, +2B) et l'officier sans formation.
- Lire le champ (ce qu'on apprend selon les degrés).
- L'échelle de l'action libre ; compétences de remplacement ; spécialités d'Art militaire.
- **Exemple** : l'attaque de nuit près de Yunkaï (Lire le champ, négocier avec des mercenaires en pleine bataille).
- **Dans Foundry** : le panneau Actions des PJ, le bouton Commander.

### 1.9 Après la bataille (1 page)
- Pertes : état final et désorganisations ; **tableau**.
- Conséquences pour la Compagnie (renvoi au chapitre 2) ; Cohésion ; butin, prisonniers, renommée.
- **Dans Foundry** : le Bilan.

### 1.10 Le chapitre du MJ (3 à 4 pages)
- Construire une bataille : objectif, carte couverte ou ouverte, départs, durée (6 à 8 tours).
- Jouer l'ennemi sans comptabilité ; contre-ordres d'un adversaire coriace.
- Ce que le MJ arbitre : tir et charge à l'aveugle, sortie du contact par un officier, action libre, village en feu.
- Ce qui rend une bataille intéressante (enseignements des batteries de tests, sans chiffres) : un objectif à tenir, une carte qui cache, des troupes variées.
- **Conseil** : préparer une bataille dans Foundry en dix minutes.

### 1.11 Annexes du chapitre
- Un tour complet commenté (2 pages), sur une carte réelle.
- Fiche de troupe vierge.
- Aide-mémoire recto-verso (la page 11 de `regles-bataille.md`, remise en forme).

Volume estimé : 35 à 45 pages A4.

## Chapitre témoin et propositions de style

Le chapitre 1.7 « Le combat » sera mis en page en trois styles, mêmes textes et mêmes schémas :

- **A, parchemin** : dans l'esprit des fiches Foundry, papier vieilli, titres ornés, couleurs sombres.
- **B, manuel moderne** : fond clair, très lisible, encadrés colorés, mise en page aérée.
- **C, sobre** : noir et blanc, deux colonnes, fait pour l'impression.

Fabrication : source HTML et CSS dans `docs/livret/`, schémas en SVG, PDF produit par Edge en mode sans interface (rien à installer).
