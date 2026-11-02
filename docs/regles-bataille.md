# Règles de bataille (v0.4, à jour du système v0.28.7)

Règles maison de combat de masse pour « L'Éveil du Titan ». Issues du brainstorming et du premier test sur papier du 2026-10-29 (scénario « Le gué des Terres disputées »), revues avec Jules (v0.2 : terrains, météo, ligne de vue, ordre Attaquer, pertes cumulées, limite des ralliements, reconnaissance par une unité), puis codées dans Foundry et ajustées aux tests (v0.3 : relecture du 2026-11-02, système v0.27.10 ; v0.4 : ligne de vue, brouillard de guerre, nuit, identification, embuscade, tir à l'aveugle, flanc limité, contact et relève, 2026-11-02, systèmes v0.28 à v0.28.7, après les batteries F, G, H et C dans `tests/resultats/`).

**Légende** : *(à la main)* = règle valable, mais Foundry ne l'applique pas : le MJ la joue. *(avertissement)* = Foundry prévient sans bloquer. *(non codé, à trancher)* = la règle écrite et le code divergent : à décider avec Jules.

## Principes

- Fluide : peu de jets par tour, tout le monde agit en même temps.
- Chaque PJ agit et peut briller à chaque tour, au commandement ou dans la mêlée.
- Visuel : carte en hexagones, jetons d'unités placés et déplacés par les joueurs.
- Le cœur du système est de deviner l'adversaire (ordres secrets et ordres gagnants) ; l'équipement des unités (traits) rend chaque affrontement différent.
- Côté MJ, pas de comptabilité : l'ennemi n'a ni points de plan ni points d'initiative ; sa préparation passe par la fiction (pièges, embuscade, terrain choisi, prévus dans le scénario). Un adversaire coriace peut recevoir des contre-ordres.
- L'improvisation des joueurs a sa place : action libre et compétences de remplacement.

## 1. Échelle et carte

- Carte en hexagones. **Une unité par case.** Un PJ accompagne une unité ou se tient seul sur une case.
- **Escarmouche** : toute la bataille est sur la carte.
- **Bataille rangée** : la Compagnie tient un secteur de la carte ; le reste de l'armée alliée est une **jauge générale** que le MJ fait évoluer, influencée par le résultat du secteur (et inversement : une aile alliée qui cède peut faire entrer des ennemis dans le secteur).
- Terrain (une ligne par terrain, dix au maximum pour rester lisible) :

| Terrain | Effet |
|---|---|
| Colline, crête | +1B en défense et au tir contre un adversaire plus bas ; charger vers le haut : −1D. Aucun effet si les deux unités sont sur la colline. |
| Bois | −1D à la cavalerie ; couvert contre les tirs (+3). |
| Marais | Déplacement −1 (une case de marais coûte 2), pas de Charge *(avertissement)*, −1D à la cavalerie. |
| Rivière | Infranchissable, sauf gué ou pont. |
| Gué | L'attaquant qui traverse a −1D ; le défenseur a +1B. Cavalerie : −1D. |
| Pont | Comme un gué, mais une seule unité peut le traverser par tour *(à la main)*. |
| Route | Déplacement +1 si l'unité Manœuvre le long de la route. |
| Village, ferme | Couvert (+3), +1B pour Tenir, −1D à la cavalerie. |
| Obstacles (haies, pieux, fossé) | Une charge qui traverse a −1D ; couvert léger contre les tirs (+1). |
| Ruines, fortifications | Couvert (+3) ; le trait Défenseurs s'y applique. |

- **Météo** (pour toute la bataille) : pluie (−1D au tir, pas de Charge dans la boue *(avertissement)*) ; brouillard (vue limitée à 2 cases *(à la main, ou automatique avec l'option Brouillard de guerre par case)*, Lire le champ plus difficile ; la portée n'est plus divisée par deux depuis la v0.28.4, décision de Jules du 2026-11-02 : au-delà de la vue, on tire à l'aveugle).
- Dans Foundry, un terrain se reconnaît au type choisi dans le panneau des terrains, sinon au nom de la région (« Bois », « Gué »…).

### Ligne de vue

Règles revues avec Jules le 2026-11-02 sur un banc d'essai interactif, puis codées telles quelles.

- On voit une case si la ligne droite entre les centres des deux cases ne traverse aucune case qui bloque la vue. Les unités ne bloquent pas la vue. Une unité au contact est toujours vue.
- **Vue symétrique** : si A voit B, B voit A. Exception : le bois (ci-dessous), où l'on voit dehors plus loin qu'on n'est vu.
- **Colline, crête** : on ne voit pas derrière, sauf si l'on est dessus. Du sommet, on voit tout ce qu'un autre obstacle ne cache pas, sauf l'angle mort : le pied d'une autre colline, caché par celle-ci. Le pied de sa propre colline reste visible. Entre une colline et la plaine, la vue se juge depuis la colline, dans les deux sens.
- **Bois** :
  - de l'extérieur, on ne voit que la lisière (1 case de profondeur) ;
  - depuis une case de lisière, on voit à 2 cases dans le bois, et normalement dehors ;
  - plus au fond, on voit à 2 cases dans le bois et 1 case dehors (soit jusqu'à 3 cases).
- **Village, ferme, ruines** : bloquent la vue au-delà.
- **De jour, pas de limite de distance** : seul le terrain coupe la vue (décision de Jules, 2026-11-02 : une carte couverte fait l'incertitude ; une plaine nue n'en a pas, et c'est voulu).
- **Brouillard** : vue limitée à 2 cases.
- **Nuit** (décision de Jules, 2026-11-02, après banc d'essai) : en plus de la ligne de vue, une troupe ne voit que les cases qui la touchent (éclaireurs : 2 cases). Elle voit à toute distance une **case éclairée** (feux de camp, village, torches), et jusqu'à 3 cases une troupe qui a **combattu ou tiré** ce tour (bruit, éclats). Une troupe sur une case éclairée se fait donc repérer de loin. L'identification et l'embuscade ne changent pas. Dans Foundry : case « Nuit » de la fenêtre Bataille (MJ), case « Éclairé de nuit » d'une région dans le panneau des terrains (pour un simple feu : un Repère sans effet).
- Ne bloquent pas : marais, haies, rivière, gué, pont, route.
- **Repérer n'est pas identifier** (une seule distance, 3 cases, décision de Jules du 2026-11-02 ; 4 cases avant) :
  - jusqu'à 3 cases, une unité vue est identifiée à l'œil : genre d'unité, état apparent, traits visibles. Jamais l'entraînement ;
  - au-delà, elle reste une « troupe inconnue » : sa position seulement, ni type, ni état, ni nom ;
  - Lire le champ (1 degré) l'identifie, même lointaine (section 7).
- **Éclaireurs** : voient 1 case plus loin dans un bois (2 depuis l'extérieur, 3 depuis l'intérieur) et identifient à 4 cases.
- **Conséquences** : il faut voir sa cible pour Lire le champ (sauf reconnaissance d'avant bataille), et pour Tirer normalement. **Tir à l'aveugle** (décision de Jules, 2026-11-02) : on peut tirer sur une case qu'on ne voit pas, à portée, avec −1D ; si la case est vide, le tir est perdu ; s'il y a une troupe, le MJ résout le tir lui-même *(à la main)*. Une unité qui se déplace sans sortir des zones invisibles (par exemple au fond d'un bois) reste cachée. On peut Charger ou Attaquer une case qu'on ne voit pas, avec −1D ; si elle est vide, l'ordre est perdu *(à la main : Foundry ne laisse viser qu'une troupe vue)*.

### Embuscade

Trois façons d'être en embuscade, qui se cumulent :
- **Point de plan « Embuscade »** (avant le déploiement, section 4) : une unité est déployée cachée, n'importe où, et reste invisible jusqu'à sa première action, même dans une case que l'ennemi voit. Dans Foundry, le MJ cache le jeton à la main (il sort alors du brouillard) et le montre quand l'unité agit.
- **En lisière d'un bois** : une unité postée en lisière qui n'a pas encore agi (ni combattu, ni tiré, ni bougé depuis la révélation) n'est repérée qu'à 2 cases ou moins ; des éclaireurs, seulement au contact. Calculé par Foundry avec le brouillard de guerre.
- **Frapper en premier** : une unité cachée à sa cible qui agit en premier (Charger, Attaquer ou Tirer) gagne +1B à cette action (codé en v0.28.5 : troupe cachée au moment de la révélation, par le brouillard de guerre ou par le MJ, qui n'a encore jamais agi et qui Charge, Attaque ou Tire).

Dans tous les cas, une unité au contact est vue, et une unité qui a agi n'est plus en embuscade.

### Vue et brouillard dans Foundry

- Dans Foundry :
  - **option « Brouillard de guerre par case »** (fenêtre Bataille, paramètres ; à l'essai, désactivée par défaut). Foundry calcule ce que voit la Compagnie :
    - les cases non vues sont assombries (légèrement pour le MJ) ;
    - les troupes ennemies hors de vue sont cachées, et réapparaissent dès qu'elles sont vues ;
    - une troupe non identifiée (au-delà de 3 cases, 4 pour des éclaireurs) s'affiche en « ? », y compris dans la fenêtre Bataille et dans les cartes publiques.
  - Le MJ garde la main par le menu du jeton ennemi :
    - **Identifier** (Lire le champ réussi) ;
    - cacher ou montrer à la main : le jeton sort du brouillard, et **Rendre au brouillard** l'y remet.
    - Un ennemi déjà caché par le MJ quand le brouillard s'active reste à sa main. Une troupe de la Compagnie cachée par le MJ (réserve) ne compte pas pour la vue.
  - Sans l'option : la ligne de vue se juge *à la main*. Le MJ cache ou montre les jetons ; une troupe cachée n'apparaît pas dans la carte publique des ordres et ne se trahit pas dans les tracés de mouvement des joueurs.
  - La nuit est gérée (v0.28.3), avec l'option.

## 2. Les unités

Chaque unité a :

- un **type** (catalogue de la Compagnie) qui lui donne ses **traits** (section 3) ;
- un **entraînement** qui donne sa **réserve d'encaissement** et ses rangs de compétence :

| Entraînement | Rangs à placer | Encaissement (par bataille) |
|---|---|---|
| Bleus | 1 | 0 |
| Entraînés | 3 | 1 |
| Vétérans | 5 | 2 |
| Élite | 7 | 3 |

- des **compétences** (révisé le 2026-10-31, après le test à deux joueurs) : toutes à 2, plus les rangs de l'entraînement répartis sur les trois **compétences clés** du type (table « Types d'unités » des règles de la Compagnie). Le rang principal ne change pas (Entraînés 3, Vétérans 4, Élite 5). Le seul rang d'un Bleu va à sa dernière compétence clé : son métier reste à 2. **Corps à corps** sert en mêlée, **Tir** au tir (**Athlétisme** pour les armes de jet) ; les autres servent aux jets demandés par le MJ. Des archers vétérans ont donc 4D au tir et 2D en mêlée.

- une **Discipline** (celle du livre et du catalogue : une difficulté, plus elle est basse, mieux c'est) : c'est la **difficulté pour la rallier ou la réorganiser** ;
- un **état** :

| État | Effet |
|---|---|
| Fraîche | Aucun. |
| Éprouvée | Pas de malus, mais ne peut plus utiliser sa réserve d'encaissement. |
| Désorganisée | −1D à tous ses tests ; ne peut plus Charger *(avertissement)*. |
| En déroute | Ne fait que fuir (2 cases vers son bord) jusqu'à être ralliée. La fuite se joue *à la main* : la carte de fin de tour la rappelle. Elle sort des mêlées prévues ; on peut encore lui tirer dessus. |
| Détruite | Retirée de la carte *(à la main)*. Retirée, elle reste comptée au Bilan (v0.27.10). |

- **Ralliements** (révisé le 2026-10-31) : l'action Rallier d'un officier se teste toujours contre la **Discipline** de l'unité et chaque réussite, quel que soit l'état de départ, consomme le compteur : au plus **encaissement + 1 fois par bataille** (bleus 1, entraînés 2, vétérans 3, élite 4). Au-delà, plus de ralliement possible. La réorganisation (Tenir sans combat) ne consomme pas le compteur et ne fait jamais sortir de la déroute.
- **Compteur de désorganisations** : chaque passage à Désorganisée ou pire est compté (+5 % de pertes en fin de bataille, section 8). Si les pertes cumulées (état actuel + passages) atteignent 70 %, l'unité est **brisée** : retirée de la carte, comptée Détruite.

- **Encaissement** : chaque point dépensé annule la perte d'un état (une fois par point et par bataille). C'est le joueur qui possède la troupe qui choisit ; sans joueur connecté, ou sans réponse en 60 secondes, le MJ choisit.
- **Nouvelle bataille** (bouton de la fenêtre Bataille, v0.27.10) : ordres, officiers et tour sont effacés ; encaissement, ralliements et Indéfectible repartent à neuf. Les états et le compteur de désorganisations ne changent pas.
- **Déplacement** : infanterie 1 case, Léger +1, Monté 3 (2 en Armure lourde) ; minimum 1.
- L'état touche **tous les tests de l'unité**, quel que soit celui qui lance (officier PJ ou rang de l'unité).

## 3. Les traits

Déduits du type d'unité (deux types au plus, section 3 bis). Améliorations d'équipement : section 3 bis.

| Trait | Effet |
|---|---|
| Armure lourde | Perd 1 état de moins quand elle perd une mêlée de 2 degrés ou plus. Tirs contre elle : difficulté +3. Déplacement −1 (minimum 1). |
| Boucliers | Tirs contre elle : difficulté +3. Avec Tenir : mur de boucliers, insensible au Choc. |
| Choc | +1B quand elle Charge une troupe qui ne Tient pas (décision de Jules, 2026-11-02, v0.28.8 : sans cela, Choc n'avait plus d'effet avec Tenir brise l'élan). Option Tenir brise l'élan décochée : annule aussi le bonus de Tenir de l'adversaire (sauf Piques ou mur de boucliers). |
| Choc lourd | Si elle gagne une Charge contre une troupe qui ne Tient pas, l'adversaire perd 1 état de plus. Pas de +1B (décision de Jules, 2026-11-02). Option décochée : annule aussi le bonus de Tenir, comme Choc, et l'état de plus joue aussi contre une troupe qui Tient. |
| Piques | +1D contre la cavalerie. Une cavalerie qui les charge alors qu'elles Tiennent a −1D. |
| Monté | Déplacement 3 (2 en Armure lourde). −1D dans les bois et à la traversée d'un gué. |
| Léger | Déplacement +1 avec Manœuvrer et Course. En se repliant, peut ne perdre aucun état (voir Se replier). Le malus des bois ne touche que la cavalerie, légère comprise (décision de Jules, 2026-11-02). |
| Tir (portée X) | Peut recevoir l'ordre Tirer. Arcs : portée 4. Arbalètes : portée 3. |
| Perforant | Ignore le +3 donné par Armure lourde et Boucliers. |
| Rechargement | Après avoir tiré, ne peut pas Tirer au tour suivant (imposé par le système). |
| Armes de jet | Volée : +1B quand l'unité Charge, et +1B quand elle Tient et se fait charger. Peut Tirer à portée 1-2. Pas Perforant. |
| Frondes (variante) | Tir portée 3, sans effet sur l'Armure lourde. |
| Indéfectible | Annule sa première déroute de la bataille. |
| Éclaireurs | +1B pour Lire le champ et pour la reconnaissance. Vue : 1 case de plus dans un bois (2 depuis l'extérieur, 3 depuis l'intérieur), identifient à 4 cases au lieu de 3 ; postés en lisière sans avoir agi, ils ne sont repérés qu'au contact (section 1). |
| Défenseurs | +1B pour Tenir dans une fortification. |

Correspondance avec le catalogue (première version) :

| Type | Traits |
|---|---|
| Infanterie lourde | Armure lourde, Boucliers |
| Garde personnelle | Armure lourde, Boucliers, Indéfectible |
| Chevaliers errants | Armure lourde |
| Infanterie légère | Léger, Armes de jet |
| Pillards | Léger, Armes de jet |
| Éclaireurs | Léger, Éclaireurs |
| Marins | Léger |
| Garnison | Boucliers, Défenseurs |
| Piquiers | Piques |
| Archers | Tir (portée 4) |
| Arbalétriers | Tir (portée 3), Perforant, Rechargement |
| Cavalerie légère | Monté, Léger, Choc |
| Cavalerie lourde | Monté, Armure lourde, Choc lourd |
| Volontaires | Léger |
| Soutien | Non combattant |
| Combattants spécialisés, navires, Spéciale | Aucun |

Types du catalogue de la Maison : Cavalerie (Monté, Armure lourde, Choc lourd) ; Infanterie (Boucliers) ; Croisés (Indéfectible) ; Guérilleros (Léger, Armes de jet) ; Criminels (Léger) ; Paysans conscrits, Ingénieurs, Mercenaires, Navires de guerre (aucun). Armure lourde exclut Léger ; une arme de tir remplace Armes de jet.

Trait **Bleus** (« à la première perte d'état, test de ralliement ou déroute ») retiré le 2026-11-02 (décision de Jules) : l'entraînement Bleus suffit à les rendre fragiles (aucun encaissement, un seul ralliement, Discipline haute, dés de bonus plafonnés à 2).

## 3 bis. Customisation des troupes (validée par Jules le 2026-10-31, codée en v0.24.0)

**Deux types au maximum** (Infanterie légère + Arbalétriers). Puissance : somme des deux. Effectif : selon l'entraînement. Discipline : le moins bon modificateur. Compétences clés : 3 au choix parmi celles des deux types. Traits cumulés, sauf : Armure lourde et Léger s'excluent ; une arme de tir remplace Armes de jet. Hommes : ceux du type le moins nombreux. Symbole : type principal.

**Compagnie des Cendres :**

| Unité | Puissance | Discipline | Corps à corps | Tir | Déplacement | Traits |
|---|---|---|---|---|---|---|
| Infanterie lourde, entraînée | 2 | 7 | 3 | 2 | 1 | Armure lourde, Boucliers |
| Infanterie légère + arbalétriers, entraînée | 4 | 8 | 3 | 3 | 2 | Léger, Arbalètes, Perforant, Rechargement |
| Éclaireurs + archers, entraînés | 3 | 9 | 2 | 3 | 2 | Léger, Éclaireurs, Arcs |
| Chevaliers errants + cavalerie lourde, vétérans (20 hommes) | 10 | 0 | 4 | 2 | 2 | Monté, Armure lourde, Choc lourd |

**Améliorations d'équipement** (livre, chapitre 10 : 1 point de Richesse dépensé définitivement par amélioration, chacune une seule fois par unité). En règles maison : Armure, +1 encaissement par bataille ; Armes de mêlée, +1B en mêlée ; Armes de tir, +1B au tir.

**Décision de Jules (2026-11-01) :** un jeton par bataillon, découpage libre sans limite liée aux officiers (un bloc peut rester sans officier), surnombre activé. Question d'origine : un bataillon de 5 unités se déploie aujourd'hui en un seul jeton de 500 hommes, qui lance les mêmes dés qu'une unité de 100. Pistes : un jeton par unité ; un jeton par bataillon, plus fort selon sa taille ; ou bataillon découpé librement en jetons, avec un bonus de taille plafonné.

## 4. Avant la bataille

Les tests se font sur les fiches et la narration reste *à la main*. Foundry tient la réserve de points de plan (fenêtre Bataille, v0.27.15).

1. **Reconnaissance** (éclaireur PJ : Vigilance, Discrétion ou Survie ; service Guide ; ou **unité spécialisée** : éclaireurs ou cavalerie légère, avec son rang de test, +1B pour le trait Éclaireurs). Chaque degré révèle une unité ennemie avant le déploiement, ou un secret du terrain (second gué, marais, sentier). Échec : rien ; échec grave : fausse information donnée par le MJ, et une unité de reconnaissance a été accrochée : elle commence la bataille Éprouvée.
2. **Plan de bataille** : le chef fait un test d'Art militaire (Stratégie). Difficulté 12 ; −3 si la reconnaissance a réussi ; +3 si l'ennemi est inconnu. Chaque degré donne **1 point de plan**, sans plafond (décision de Jules, 2026-11-02). Si les joueurs décrivent un plan cohérent, le MJ peut accorder 1 point de plus.
3. **Points de plan** : une seule réserve pour la Compagnie (les points d'initiative sont retirés, décision de Jules du 2026-11-02). Un point par effet, perdus en fin de bataille. L'ennemi n'en a pas : un adversaire coriace reçoit des contre-ordres du MJ. Dans Foundry : le MJ ajoute ou retire des points, le MJ et les joueurs les dépensent dans la fenêtre Bataille, et chaque dépense est annoncée dans le chat ; « Nouvelle bataille » remet la réserve à zéro.
   - avant le déploiement : **Préparer le terrain** (pieux ou fossé sur une case), **Embuscade** (une unité déployée cachée, invisible jusqu'à sa première action, +1B à cette action ; section 1, Embuscade), **Choisir le champ** (déployer après l'ennemi) ;
   - pendant la bataille : **Comme prévu** (+1B au test d'un groupe), **Signal convenu** (un contre-ordre), **Réserve** (une unité mise en réserve au déploiement entre en jeu).
   - **Réserve, conditions** : l'unité a été déclarée en réserve au déploiement ; elle entre au plus tôt au tour 2 ; par son propre bord de carte ou par un passage que la reconnaissance a révélé. Le MJ refuse si ce n'est pas crédible.
4. **Déploiement** : les joueurs placent leurs jetons dans leur zone ; le MJ place les siens (éventuellement cachés).

## 5. Le tour de bataille

Une bataille dure en général 3 à 5 tours (ou jusqu'à l'objectif du scénario).

1. **Ordres secrets** : un ordre **par troupe** (révisé le 2026-10-29 : les groupes à ordre commun étaient peu lisibles sur la carte), avec sa cible pour Charger, Attaquer et Tirer. Chaque troupe peut avoir un **officier** (PJ ou PNJ) : la troupe lance toujours sa propre compétence, l'officier ne lui donne des dés de bonus que s'il choisit l'action **Commander** après la révélation : **+1B dès 1 degré, +2B dès 3 degrés** (révisé le 2026-11-01, section 6). Option décochée : bonus fixe de 1 dé par tranche de 2 rangs d'Art militaire, Tactiques comptant comme des rangs, au moins 1. Un officier mène au plus **1 + ses dés de bonus en Commandement** troupes *(avertissement)*. **Mouvements** : Manœuvrer et Se replier se déclarent avec leur case d'arrivée ; Charger et Attaquer rejoignent leur cible (case d'arrivée au choix). Tout est secret et les jetons ne bougent qu'à la révélation.
2. **Révélation** simultanée, puis **contre-ordres** éventuels (voir plus bas).
3. **Actions des PJ** (section 7) : chaque PJ ou officier a, par tour, **soit une action de bataille, soit une scène individuelle de 3 rounds** (voir « Durée d'un tour »). Un PJ peut se déplacer d'une case pour rejoindre une unité sans y consacrer son action. Deux PJ peuvent agir sur la même unité.
4. **Mouvements** (joués à la révélation dans Foundry : manœuvres et replis, sauf les replis au contact qui attendent la fin du tour, puis charges et attaques vers la position réelle de leur cible ; une case prise ou un ennemi arrête l'unité ; deux unités visent la même case : la plus rapide l'obtient, à égalité personne, et l'autre s'arrête avant). Décisions de Jules du 2026-11-02 (v0.28.3) :
   - on peut viser la case d'un allié : s'il la quitte ce tour, on y entre ; sinon, on s'arrête avant (une ligne peut avancer d'un bloc) ;
   - une charge ou une attaque dont la case d'arrivée choisie est prise (par un allié arrivé avant) prend la case libre la plus proche au contact de sa cible.
   - **Contact** (décisions de Jules du 2026-11-02, v0.28.7) :
     - une troupe est **au contact** si elle touche une troupe ennemie active au début du tour (au moment des ordres) ;
     - au contact, elle peut Tenir, Attaquer, Charger, Tirer ou Se replier, mais ni Manœuvrer ni Courir : elle ne rompt le contact qu'en **Se repliant** (Foundry refuse ces ordres à un joueur ; le MJ est prévenu et peut passer outre) ;
     - **Se replier au contact** : la troupe reste sur sa case pendant les tirs et les mêlées du tour ; ceux qui l'attaquent la combattent là, avec l'avantage du repli ; elle recule d'une case à la fin du tour, si elle n'est pas en déroute. Un ennemi qui Tient ne la frappe pas ;
     - **Relève** : une troupe alliée qui n'est pas au contact peut viser en Manœuvrant la case de la troupe qui se replie ; elle y entre à la fin du tour, après les mêlées (les deux échangent leurs places si celle qui se replie recule dans sa case). Si la troupe qui se replie est détruite, la relève entre dans la case libérée ; si elle est en déroute, la relève n'a pas lieu ;
     - **Échange de cases** hors du contact : deux troupes alliées (ou plus, en cercle) qui visent chacune la case de l'autre bougent ensemble, à la révélation (v0.28.6) ;
     - Attaquer garde son mouvement (sert à aborder une ligne qui Tient sans lui offrir l'ordre gagnant).
     - **Au contact, on ne charge ou n'attaque que l'ennemi qu'on touche** (décision de Jules, 2026-11-02 ; Foundry ne le bloque pas). **Exception, arbitrée par le MJ** *(à la main)* : l'officier de la troupe peut tenter de la faire rompre le contact pour charger un autre ennemi. C'est son action de bataille du tour (pas de Commander en plus) : test d'Art militaire (Tactiques) contre la difficulté de Commander (Discipline + 3 + effectif + moral). Réussite : la troupe rompt le contact et charge. Échec : elle reste au contact et Tient (décision de Jules : pas d'attaque gratuite sur un échec). Le MJ peut refuser si la fiction ne s'y prête pas (troupe encerclée, ennemi trop loin, terrain).
5. **Tirs** (simultanés) : chacun tire avec son état d'avant la volée. Dans Foundry (v0.27.12), les tirs se résolvent un par un mais leurs pertes attendent le dernier tir du tour, puis s'appliquent ensemble (encaissement compris). Elles s'appliquent aussi avant la première mêlée ou à la fin du tour si le MJ a sauté un tir. Décocher « Appliquer les pertes tout de suite » donne un bouton à cliquer, sans attente.
6. **Mêlées**.
7. **Fin de tour** : les troupes qui se repliaient au contact reculent et les relèves prennent leur place (Foundry le fait seul, carte « rompt le contact ») ; une unité qui a Tenu sans être engagée ni touchée **se réorganise** (remonte d'un état, sauf En déroute) ; les unités en déroute fuient *(à la main)*.

**Contre-ordre** : après la révélation, une troupe remplace son ordre (ou sa cible) avant la résolution. Coûte 1 point de plan (« Signal convenu ») ou l'action Porter un ordre d'un PJ. Un seul contre-ordre par troupe et par tour ; pas de contre-ordre en réponse à un contre-ordre. Dans Foundry : un contre-ordre par troupe et par tour (le MJ n'a pas de limite) ; le coût se paie *à la main*, en dépensant le point dans la fenêtre Bataille ou en cochant l'action du PJ. Le mouvement du nouvel ordre se joue aussitôt.

**Dans Foundry** : clic droit sur une troupe → ordre (un ordre offensif demande ensuite de cliquer sur la troupe visée), officier, ralliement. Pastille d'ordre sur le jeton et flèche vers la cible : visibles du commandant et du MJ avant la révélation, de tous après. Une barre, juste au-dessus de la barre de raccourcis, donne la phase du tour ; le MJ y révèle les ordres, résout le prochain engagement (tirs d'abord) et termine le tour, sans ouvrir la fenêtre Bataille. Le contre-ordre se donne au clic droit.
- Avant la révélation, un joueur ne déplace pas ses jetons : ils bougent tous à la révélation (case « Déploiement libre » des paramètres pour le déploiement).
- Les ordres sont portés par le jeton : une même troupe posée sur deux scènes a des ordres distincts (v0.27.10).
- Fin de tour : demande confirmation si les ordres ne sont pas révélés, s'il reste des engagements ou si une fenêtre de résolution est ouverte (v0.27.10).
- Le MJ actif doit afficher la scène de la bataille : sinon, le mouvement d'un contre-ordre, le découpage et les ordres du livre sont refusés avec un message (v0.27.10).
- **Actions des PJ** (v0.27.13) : panneau de la fenêtre Bataille, une ligne par PJ (personnage d'un joueur) et par officier d'une troupe de la scène. Commander et Rallier se comptent seuls ; les autres actions se choisissent dans la liste puis « Agir » ; « Round » compte un round de scène individuelle (3 au plus). Un joueur qui a déjà agi est arrêté (bouton Commander grisé, message) ; le MJ reçoit une confirmation et peut faire une exception, ou effacer la ligne. Le compteur repart à zéro en fin de tour. Les joueurs ne voient pas les officiers des seules troupes ennemies.
- **Carrousel de combat** (module Carousel Combat Tracker, v0.27.13) : quand il s'affiche en haut de l'écran pendant un combat, la barre de bataille passe dessous.

### Durée d'un tour

Un tour de bataille dure **3 rounds individuels** (réponse de Jules aux joueurs, à l'essai, 2026-11-02). Un PJ qui fait quelque chose de précis pendant la bataille, en dehors de ses ordres (duel, escalade, prise d'étendard), joue jusqu'à 3 rounds de combat individuel pendant que la bataille avance d'un tour ; il renonce alors à son action de bataille. Repère d'échelle : à pied, 3 rounds de déplacement (4 m par round dans le livre français) font environ 12 m, soit à peu près une case de 10 m, comme l'infanterie en un tour. L'initiative du combat individuel est un test d'Agilité, avec les dés de bonus de Vivacité (codée en v0.27.13 pour le Combat Tracker et le carrousel ; bouton Initiative sur les fiches de PJ et de PNJ en v0.27.14).

## 6. Ordres, tir et mêlée

| Ordre | Effet |
|---|---|
| Charger | Se déplace et attaque avec élan une unité au contact. Profite de Choc, Choc lourd et Volée ; subit les malus de charge (montée, obstacles ; interdit dans le marais et pour une unité Désorganisée). |
| Attaquer | Se déplace au contact et combat méthodiquement, sans élan. Pas d'ordre gagnant ; ni bonus d'élan ni malus de charge. Sert aussi à poursuivre un combat déjà engagé. |
| Tenir | Reste sur place et défend ; se réorganise s'il n'est pas engagé. |
| Tirer | Unités avec Tir ou Armes de jet : tire sur une cible à portée. |
| Manœuvrer | Se déplace sans attaquer. Cavalerie et Léger : +1 case. Le long d'une route : +1 case. (Le +1B de flanc au tour suivant est retiré : le flanc est déjà assez fort, décision de Jules, 2026-11-02.) |
| Course | Va sur une case, une de plus que Manœuvrer, sans combattre. Essoufflée : −1D si on l'attaque en mêlée ce tour. |
| Se replier | Recule d'une case (au contact d'un ennemi : en fin de tour, après les tirs et les mêlées ; c'est le seul ordre qui rompt le contact, section 5). Si elle perd une mêlée : un état de moins, au moins un ; Léger : un état de moins, sans minimum (elle échappe aux défaites d'un degré). Après l'Armure lourde. Décision de Jules, 2026-11-02, codé en v0.27.12. Les tirs ne sont pas concernés. |

**Ordres gagnants** (révisé le 2026-11-01, v0.27.5, à l'essai : Tirer n'a plus de bonus contre Tenir) : Charger bat Tirer, Tenir bat Charger. L'ordre gagnant donne +1B. Attaquer est neutre (ni bonus ni malus) ; une unité qui Charge ou Attaque est « en mouvement » face aux tirs.

**Tir** : test de la compétence de l'unité, plus les dés de bonus de son officier s'il a commandé, contre **9**. Une cible hors de portée après les mouvements annule le tir (v0.27.4).
- Il faut voir la cible (ligne de vue). Avec l'option Brouillard de guerre par case, Foundry ne laisse viser qu'une troupe visible ; sans elle, *(à la main)*. Tir à l'aveugle sur une case non vue : −1D, résolu par le MJ *(à la main)*, section 1.
- +3 si la cible a Armure lourde ou Boucliers (sauf Perforant) ; couvert du terrain : +3 (bois, village, ruines) ou +1 (obstacles) ; pluie : −1D ; tireur Désorganisé : −1D.
- +1B depuis une colline, contre une cible qui n'y est pas. Amélioration Armes de tir : +1B.
- Pertes : **1 état au maximum**, sauf si la cible est prise de flanc (au contact d'un allié du tireur), en mouvement (Charger, Attaquer, Manœuvrer ou Course) ou Désorganisée : alors 1 état par degré. Mesuré sur 10 400 tirs (2026-11-02) : une touche fait perdre 1,13 état en moyenne contre une troupe qui Tient, 1,19 contre une troupe en mouvement.
- Rechargement : pas de tir au tour qui suit un tir.

**Mêlée** : test d'opposition entre les deux camps, chacun avec la compétence de son unité, plus les dés de bonus de son officier s'il a commandé.
- Bonus : ordre gagnant (+1B), **flanc : +1B si au moins une autre unité alliée est au contact de l'adversaire, quel que soit leur nombre** (décision de Jules du 2026-11-02, v0.28.5 ; avant, +1B par unité), embuscade (+1B), terrain, traits, PJ en première ligne (+1B par degré), points de plan.
- Malus : état (Désorganisée −1D), terrain (gué), traits.
- Plafond : les dés de bonus ne peuvent pas dépasser le nombre de dés de test.
- Une unité en déroute ne combat plus et sort des mêlées prévues ; on peut encore lui tirer dessus.
- Résultat : le perdant perd **1 état par degré d'écart** (4 degrés au plus, encaissement possible ; Choc lourd et Armure lourde ajustent d'un état) ; le vainqueur prend ou garde la case disputée *(à la main)*. Égalité : le défenseur garde la case, aucune perte.
- Deux troupes qui se visent l'une l'autre (Charger ou Attaquer) : une seule mêlée règle les deux engagements.
- Amélioration Armes de mêlée : +1B. Course : −1D à la troupe essoufflée.

**Options validées par Jules le 2026-11-01** (v0.27.0, actives par défaut, à décocher dans les paramètres de la bataille) :
- **Test d'officier** : c'est l'action Commander (section 7), choisie après la révélation. Art militaire (Tactiques en dés de bonus) contre la Discipline de la troupe + 3, +1 par tranche de 100 hommes au-delà des 100 premiers, et le moral de la Compagnie. +1B dès 1 degré, +2B dès 3 degrés. Sans ce test, aucun bonus : l'officier peut préférer une autre action. Il doit le faire avant le jet de sa troupe. Remplace le bonus fixe. Une fenêtre permet de choisir une autre compétence ou spécialité (le MJ juge si elle convient), d'ajouter des dés de bonus, de malus, un modificateur et de changer la difficulté (v0.27.2, demande de Jules).
- **Entraînement en dés de bonus** : au-delà de 3D, le rang devient des dés de bonus (vétéran 3D+1B, élite 3D+2B) ; un Bleu a 2D+1B sur ses compétences clés. Le plafond de bonus reste égal au nombre de dés de test. Les tests à la demande de la fiche de troupe lancent les mêmes dés (v0.27.3).
- **Jet unique de la cible** : une troupe attaquée par plusieurs lance une fois par tour ; les mêmes dés servent contre chaque attaquant, avec les modificateurs propres à chacun.

**Surnombre** (décision de Jules le 2026-11-01, v0.27.5) : +1B à 1,5 contre 1 et +2B à 3 contre 1, en **hommes** et non plus en Puissance. Une unité montée compte pour **200 hommes**. Le prix de la cavalerie lourde passe de 3 à 5 de Puissance, soit 10 pour les chevaliers errants à cheval.

**Tenir brise l'élan** (décision de Jules le 2026-11-02, v0.27.9, option active par défaut) : une charge contre une troupe qui Tient perd Choc, Choc lourd et volée. Seuls les boucliers et les piques en tirent +1B ; les autres troupes sont à armes égales. Décochée : toute troupe qui Tient a +1B contre une charge, sauf Choc de cavalerie.

**Découpage** (v0.27.7) : l'encaissement se partage au prorata des unités, arrondi au profit du bloc d'origine. **Flanc** : limité à +1B, ce n'est plus une option (décision de Jules, 2026-11-02, v0.28.5).

**Village et infanterie lourde** (décisions de Jules, 2026-11-02, après les batteries) : une troupe qui Tient dans un village est très dure à déloger, et c'est voulu : un bâtiment est une position solide. Les joueurs ont d'autres moyens que les règles écrites (incendier le village, action libre, exploit). L'infanterie lourde est lente : c'est un vrai choix entre une troupe lourde et une troupe mobile ; rien à changer.

**Course** (ordre à l'essai, décision de Jules le 2026-11-01, v0.27.8) : la troupe se déplace d'une case de plus que Manœuvrer, sans combattre. Elle est en mouvement face aux tirs et, essoufflée, a −1D si on l'attaque en mêlée ce tour. Pas de malus au tir : un −1D au tireur, essayé en v0.27.14, a été retiré en v0.27.15 (trop fort : contre une troupe en armure ou avec boucliers, des archers entraînés passaient de 38 % à 7 % de touches). Pas de test d'Athlétisme : un jet de plus par troupe et par tour coûterait trop. Remplace l'option Manœuvre rapide (v0.27.6).

**Moral de la Compagnie** (Cohésion, demande de Jules le 2026-11-01, v0.27.1) : il s'applique à la Discipline des troupes de la Compagnie, donc aux tests contre elle (Commander, Rallier, ordres en règles du livre). La Discipline étant une difficulté, le « +2 Discipline » des règles de la Compagnie la **baisse** : bon moral −2, solide −1, tensions 0, grogne +1, crise +2.

**Points d'initiative** : retirés le 2026-11-02 (décision de Jules). Ils dataient de l'ancien Commander, qui donne maintenant directement des dés de bonus ; leurs usages (+1B, contre-ordre) passent par les points de plan.

## 7. Les actions des PJ

**Une action de bataille par PJ et par tour**, ou une scène individuelle de 3 rounds à la place (section 5, « Durée d'un tour »). Un officier qui mène plusieurs troupes n'en commande donc qu'une par tour. Foundry tient le compteur (panneau « Actions des PJ »), le MJ peut faire une exception.

| Action | Test | Effet |
|---|---|---|
| Commander | Art militaire (Tactiques), contre la Discipline de la troupe + 3 + effectif | Officier de la troupe : +1B dès 1 degré, +2B dès 3 degrés à ses jets du tour (section 6). Sans ce test, aucun bonus. |
| Rallier | Art militaire (Commandement), contre la Discipline de l'unité | L'unité remonte d'un état. |
| Combattre en première ligne | Corps à corps (ou autre arme), contre la Défense passive de la cible | +1B par degré au test de l'unité ce tour (dans le plafond). Échec : le PJ s'expose (blessure, désarmé, isolé). N'importe quel PJ, officier de l'unité ou non. |
| Tirer avec l'unité | Tir, contre la Défense passive de la cible | +1B par degré au tir de l'unité ce tour (dans le plafond). N'importe quel PJ, officier de l'unité ou non. |
| Lire le champ | Art militaire (Tactiques) ou Vigilance (Observation) | Voir ci-dessous. |
| Porter un ordre | Équitation ou Athlétisme | Rejoint un groupe à 3 cases au plus : contre-ordre gratuit, ou déplacement de 3 cases. |
| Exploit | Selon la scène | Objectif proposé par le MJ ou le joueur (champion, étendard, pont, officier ennemi). Effets : échelle de l'action libre. |
| Action libre | Compétence et difficulté fixées par le MJ | Idée du joueur ; effets selon l'échelle ci-dessous. |

**Échelle de l'action libre et des exploits** (repères indicatifs : le MJ juge selon la fiction ; une réussite apporte toujours quelque chose de concret) :
- 1 degré, petit avantage : +1B à une unité alliée ou −1D à une unité ennemie, ce tour.
- 2 degrés, avantage net : une unité remonte ou perd un état ; une unité ennemie est déplacée d'une case ; un trait est annulé pour un tour.
- 3 degrés ou plus, coup d'éclat : un groupe ennemi en déroute, un objectif pris, l'officier ennemi hors de combat.
- Échec : le PJ s'expose (blessure, capture, isolé) ou l'unité qu'il accompagne perd un état, au choix du MJ.

**Lire le champ** (vise une unité) :
- Sans jet, à 3 cases ou moins (4 pour des éclaireurs) : ce qui se voit à l'œil (genre d'unité, état apparent, traits visibles). Jamais l'entraînement.
- 1 degré : l'unité est identifiée, même lointaine (type, état, traits visibles).
- 2 degrés : au choix, l'ordre du tour suivant de son groupe ou son entraînement.
- 3 degrés ou plus : les deux, ou un second groupe, ou les unités cachées d'un secteur.
- Avec Vigilance (Observation) : ce qui se voit (type, état, traits, unités cachées, entraînement à 2 degrés), jamais les ordres. Tactiques lit les intentions.

**Compétences de remplacement** : pour toute action, le joueur peut proposer une autre compétence s'il la justifie ; le MJ accepte, éventuellement avec une portée réduite.

**Spécialités d'Art militaire** : Tactiques pendant le combat (engagements, Lire le champ) ; Commandement pour la tenue des hommes (Rallier, contre-ordres, taille des groupes) ; Stratégie avant et autour de la bataille (reconnaissance, plan, sièges, campagne).

## 8. Après la bataille

- **Pertes** = pourcentage de l'état final + **5 % par passage à Désorganisée ou pire** pendant la bataille, plafonné à 70 % (hommes et coûts, donc Effectif et Puissance de la Compagnie) :

| État final | Pertes |
|---|---|
| Fraîche | aucune |
| Éprouvée | 10 % |
| Désorganisée | 25 % |
| En déroute | 40 % |
| Détruite | 70 % (le reste rejoint la Compagnie plus tard ou est prisonnier) |

- **Report sur la Compagnie : manuel, à l'appréciation du MJ** (décision de Jules, 2026-11-01). Le Bilan donne les pertes ; rien n'est retiré automatiquement.
- **Cohésion** : victoire +1d6 × 3, défaite −1d6 × 3 ; lourdes pertes, chef blessé ou capturé −5 à −15 (règles de la Compagnie).
- **Renommée, butin, prisonniers** : au jugement du MJ.
- **PJ** : blessures et lésions selon les règles normales.
- **Expérience des unités** : à définir (le catalogue a déjà une valeur d'expérience par entraînement).

## 9. Sièges (esquisse)

- **Investissement**, mois par mois (branché sur la fin de mois) : blocus, Ravitaillement des deux camps, maladie et usure.
- **Engins de siège** : dépense de Puissance pour faire baisser la Défense de la place.
- **Assaut** : bataille sur des cases spéciales (murs, brèche, porte, cour) ; le défenseur reçoit des dés de bonus selon les fortifications (trait Défenseurs).
- **Sorties** du défenseur : petites batailles.

## 10. Comparaison avec le livre (chapitre 10, « Warfare »)

| | Livre | Ces règles |
|---|---|---|
| Ordres | Donnés l'un après l'autre selon l'initiative ; chaque ordre demande un test d'Art militaire contre la Discipline de l'unité (sinon elle répète son ordre précédent) ; +3 par ordre supplémentaire à la même unité. | Un ordre secret par troupe, révélé en même temps ; pas de test d'obéissance (le test d'officier Commander ne donne que des dés de bonus). |
| Liste d'ordres | Une dizaine (Attack, Charge, Defend, Move, Withdraw, Organize, Ready, Rally, Regroup), plus des ordres avancés ; ordres permanents. | Sept ordres (Charger et Attaquer distingués comme Charge et Attack, plus Course) ; le ralliement et la réorganisation passent par les PJ ou Tenir. |
| Contre-jeu | Pas de triangle : Defend remplace la Défense par un test d'Agilité (bonus de bouclier), Charge ajoute +2 dégâts. | Ordres gagnants (Charger, Tirer, Tenir), modulés par les traits. |
| Combat | Chaque unité attaque (Combat ou Tir contre la Défense), dégâts × degrés, réduits par l'armure, retirés de la Santé. | Un test d'opposition par engagement ; états et encaissement. |
| Discipline | Difficulté des ordres. | Difficulté du ralliement (même valeur). |
| PJ | Phases d'actions de joueurs ; les PJ rattachés encaissent une part des dégâts. | Une action par PJ et par tour ; action libre. |
| Moins de jets ? | Un test par ordre et un par attaque. | Un test par engagement et un par PJ. |

À garder en tête du livre : l'ordre **Ready** (attente conditionnelle, « tirez s'ils traversent le gué »), qui pourrait compléter Tenir.

## 11. Aide-mémoire (une page)

**Préparation** : reconnaissance (1 unité ou 1 secret par degré) → plan (Stratégie, 12, 1 point de plan par degré, sans plafond) → déploiement. Contre-ordre : 1 point de plan ou Porter un ordre.

**Tour** : 1. ordres secrets (un par troupe) → 2. révélation, contre-ordres, mouvements → 3. actions des PJ (Commander avant le jet de sa troupe) → 4. tirs → 5. mêlées → 6. fin de tour (replis au contact et relèves ; Tenir sans combat : remonte d'un état ; déroutes fuient).

**Ordres** : Charger (bouge et attaque avec élan) · Attaquer (bouge et combat sans élan, neutre) · Tenir (défend, se réorganise) · Tirer (à portée, en vue) · Manœuvrer (bouge ; cavalerie et Léger +1 case) · Course (une case de plus, −1D en mêlée ce tour) · Se replier (recule d'une case ; perd un état de moins en mêlée, au moins un, Léger sans minimum). **Au contact** d'un ennemi : ni Manœuvrer ni Course ; on ne charge ou n'attaque que l'ennemi qu'on touche (exception : test d'officier, MJ) ; Se replier recule en fin de tour, après les mêlées ; une troupe fraîche peut venir prendre sa place (relève). Hors contact, deux alliés peuvent échanger leurs cases.

**Ordres gagnants** : Charger > Tirer, Tenir > Charger (+1B au gagnant). Attaquer : neutre. Tenir brise l'élan : contre une troupe qui Tient, la charge perd Choc et volée ; seuls boucliers et piques gardent +1B. Choc : +1B à une charge contre une troupe qui ne Tient pas.

**Vue** : symétrique sauf le bois ; colline (on ne voit pas derrière sauf dessus ; du sommet, angle mort au pied d'une autre colline) ; bois (de dehors, la lisière ; de la lisière, 2 cases dedans et dehors normalement ; du fond, 2 cases dedans et 1 dehors) ; village et ruines bloquent ; de jour pas de limite de distance ; brouillard 2 cases ; nuit : cases voisines (éclaireurs 2), case éclairée à toute distance, troupe qui combat ou tire à 3. Identifiée à 3 cases (éclaireurs 4). Embuscade : point de plan (cachée jusqu'à sa première action), en lisière (repérée à 2 cases tant qu'elle n'a pas agi), frapper caché en premier (+1B). Cible invisible (charge ou tir à l'aveugle sur une case) : −1D, perdu si la case est vide.

**Pertes finales** : état final (0, 10, 25, 40, 70 %) + 5 % par désorganisation, maximum 70 % (unité brisée). **Ralliements depuis la déroute** : encaissement + 1 par bataille.

**Tir** : contre 9 (+3 armure lourde ou boucliers, sauf Perforant ; +3 bois, village, ruines ; +1 obstacles) ; il faut voir la cible, sinon tir à l'aveugle sur une case (−1D, MJ) ; 1 état maximum sauf cible de flanc, en mouvement ou désorganisée.

**Mêlée** : opposition ; +1B par ordre gagnant, flanc (+1B au plus, quel que soit le nombre d'alliés au contact), embuscade, PJ (par degré), terrain, traits ; perdant −1 état par degré ; égalité : le défenseur garde la case.

**États** : Fraîche → Éprouvée (plus d'encaissement) → Désorganisée (−1D, pas de charge) → En déroute (fuit) → Détruite.

**Actions des PJ** (une par tour, ou 3 rounds de scène individuelle) : Commander · Rallier (contre Discipline) · Combattre en première ligne · Tirer avec l'unité · Lire le champ · Porter un ordre · Exploit · Action libre (1 degré petit avantage, 2 avantage net, 3+ coup d'éclat ; échec : le PJ s'expose).

**Compétences** : 2 + rangs de l'entraînement sur les 3 compétences clés du type. **Officier** : action Commander, contre la Discipline + 3 + effectif + moral : +1B dès 1 degré, +2B dès 3 degrés. **Encaissement** : 0, 1, 2, 3.

**Symboles des jetons** (cadre bleu : Compagnie ; rouge : ennemis) : croix = infanterie ; croix et cadre en pointillés = infanterie légère ; croix et trait vertical = piquiers ; arc = archers ; arc et trait horizontal = arbalétriers ; diagonale = cavalerie légère ; bande claire en bas = lourd (infanterie ou cavalerie) ; diagonale et point = éclaireurs ; plus = soutien ; vague = navires. Une unité mixte prend le symbole de son dernier type.

## 12. À tester et questions ouvertes

- Le plafond de pertes au tir (1 état) : suffisant ou trop faible ? Les tireurs battent l'infanterie 2 fois sur 3 sur un terrain ouvert (batterie de nuit, S4). Le malus de tir contre une troupe en Course a été essayé puis retiré (v0.27.15).
- Plus aucun point *(non codé, à trancher)* dans ce document (2026-11-02). Suivi dans `docs/ecarts-regles-foundry.md`.
- La taille des groupes (1 + dés de bonus en Commandement) dans une grande bataille.
- Les pourcentages de pertes et leur effet sur la Compagnie sur plusieurs batailles.
- L'expérience des unités après la bataille.
- L'ordre Ready du livre.
- Deuxième test : sur le VTT, scénario plus ouvert (plusieurs passages, cavalerie ennemie libre de manœuvrer). Batteries par agents du 2026-11-02 faites (`tests/resultats/bilan-brouillard.md`, `bilan-brouillard-2.md`, `bilan-flanc.md`, `bilan-contact.md`) ; prochaine étape : la table du 09/11.
- Peu éprouvés par les batteries : l'échange de cases, la relève sous forte pression, la retraite combattante (une seule partie, perdue), le +1B d'embuscade en bataille.
- Règles encore à l'essai, à juger à la table : Tirer sans bonus contre Tenir, Course, 3 rounds individuels par tour, brouillard de guerre par case (option).
- À coder : la Charge, l'Attaque ou le Tir sur une case qu'on ne voit pas.
- Commander (mesuré le 2026-11-02 sur les officiers des batteries F et G, troupes entraînées de 100 à 300 hommes, difficulté 11 à 13) : la réussite dépend surtout de l'officier, de 3 % (Art militaire 2D) à 90-96 % (4D+1B ou 4D+2B) ; +2B (3 degrés) n'arrive presque jamais (0 à 9 %). Décision de Jules (2026-11-02) : on garde tel quel ; Art militaire 2 est le rang d'une personne sans formation, ses échecs sont normaux.
