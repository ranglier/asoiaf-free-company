# Écarts entre les règles écrites et Foundry

Suivi ouvert le 2026-11-02 (système v0.27.10). But : pouvoir appliquer toutes les règles écrites à la table sans blocage, pas tout automatiser. Règles de référence : `docs/regles-bataille.md`, `docs/regles-compagnie.md`.

Dans Foundry, le MJ peut modifier à la main sur les fiches l'état, l'encaissement, les désorganisations et les ralliements d'une troupe, ainsi que la Cohésion et les ressources de la Compagnie. Les fenêtres de mêlée et de tir ont des champs +B, −D et ±. Le MJ déplace les jetons à tout moment.

## A. S'appliquent à la main, rien à faire
- Ligne de vue, cible invisible (−1D), embuscade (+1B) : le MJ cache les jetons et ajoute les dés dans la fenêtre. Depuis la v0.28 : avec l'option Brouillard de guerre par case, Foundry calcule la vue et cache les ennemis ; le +1B d'embuscade est codé (v0.28.5). Restent *à la main* : la Charge, l'Attaque ou le tir à l'aveugle sur une case non vue (−1D), et l'exception à « au contact, on ne charge que l'ennemi touché » (test d'officier).
- Pont à une unité par tour, fuite des déroutes, case prise par le vainqueur, troupe détruite retirée : le MJ déplace ou retire les jetons. Le Bilan garde les pertes d'une troupe retirée.
- Pas de Charge (marais, pluie, Désorganisée) : Foundry avertit ; le MJ change l'ordre en Attaquer (il n'a pas de limite de contre-ordres).
- Officier qui mène trop de troupes : avertissement.
- Actions des PJ (première ligne, tir avec l'unité, Lire le champ, Porter un ordre, exploit, action libre) : test sur la fiche du PJ, puis dés reportés dans la fenêtre de mêlée ou de tir.
- Cohésion après une victoire ou une défaite, discours du chef : jet à part, puis valeur modifiée sur la fiche de Compagnie.

## B. Applicables, mais Foundry fait autrement par défaut (risque d'erreur à la table)
| Point | Ce que fait Foundry | Proposition |
|---|---|---|
| Tirs simultanés | Pertes appliquées tout de suite : une troupe mise en déroute avant son tir ne tire plus. Contournement : décocher « Appliquer les pertes tout de suite » à chaque tir, puis cliquer les boutons. | Décocher la case par défaut pour les tirs. |
| Une action par PJ et par tour | Réglé en v0.27.13 : compteur d'actions dans la fenêtre Bataille. | — |
| Léger ignore le malus des bois | La cavalerie légère a −1D dans les bois. Contournement : saisir −1 dans le champ −D. | Choisir : corriger le code ou retirer la phrase de la règle. |
| Cohésion de départ au maximum | Laissée à 0 après la création guidée. | Corriger (bug). |
| Achat d'un service en Richesse | Prix affiché, Richesse non débitée. | Débiter à l'achat, avec confirmation. |

## C. Règle écrite incomplète, ou qui s'appuie sur quelque chose qui n'existe pas
| Point | Problème | À trancher |
|---|---|---|
| Points d'initiative et points de plan | Aucun compteur ; le contre-ordre « coûte 2 points d'initiative ou 1 point de plan ». | Les garder (suivi sur papier, ou un compteur dans la fenêtre Bataille) ou les retirer et laisser le contre-ordre gratuit, un par troupe et par tour. |
| Se replier « limite les pertes » | Pas de chiffre. | Combien : 1 état de moins ? Léger : aucune perte ? |
| Flanc de Manœuvrer au tour suivant | Foundry efface les ordres en fin de tour : plus personne ne sait qui a manœuvré. | Garder (Foundry affiche « a manœuvré au tour précédent ») ou retirer. |
| Bleus : test à la première perte | Qui lance, contre quoi, et le test consomme-t-il l'unique ralliement des Bleus ? | Préciser. |
| Mutinerie | « Test de Mutinerie chaque mois » en crise, sans test défini. | Définir le test et ses effets, ou la laisser au récit. |
| Ordre du mois | Règle : événement puis action. Foundry : action puis événement, avec les valeurs du début du mois. | Aligner la règle sur Foundry ou l'inverse. |

## Décisions
- 2026-11-02, Léger et bois : toute cavalerie, légère comprise, a le malus des bois. Règle écrite corrigée, Foundry inchangé.
- 2026-11-02, Cohésion de départ : corrigée en v0.27.11 (3 × Autorité à la création guidée).
- 2026-11-02, Mutinerie : au récit, rien à définir. Règle écrite corrigée.
- 2026-11-02, Ordre du mois : événement avant l'action. Codé en v0.27.11 ; l'événement compte la Cohésion laissée par les revenus et l'entretien. Le repos sans solde payée est annoncé sans effet sur la carte.
- 2026-11-02, tirs simultanés : pertes des tirs en attente jusqu'au dernier tir du tour (ou la première mêlée, ou la fin de tour). Codé en v0.27.12.
- 2026-11-02, Se replier : un état de moins en mêlée, au moins un ; Léger sans minimum. Codé en v0.27.12.
- 2026-11-02, trait Bleus : retiré (règle et Foundry, v0.27.12).
- 2026-11-02, matrice d'équilibre de Jules : on est assez proche, rien à changer pour l'instant.
- 2026-11-02, une action par PJ : compteur dans la fenêtre Bataille (une action de bataille ou 3 rounds de scène individuelle par tour), codé en v0.27.13 ; durée d'un tour de bataille : 3 rounds individuels, à l'essai.
- 2026-11-02, module Carousel Combat Tracker : la barre de bataille passe sous le carrousel ; initiative du combat individuel branchée (Agilité, Vivacité), v0.27.13.
- 2026-11-02, flanc de Manœuvrer : retiré de la règle (« le flanc est déjà trop fort »).
- 2026-11-02, achat de service : la Richesse reste à débiter à la main.
- 2026-11-02, Course sous les tirs : −1D au tireur contre une troupe qui Court, codé en v0.27.14 puis retiré en v0.27.15 (trop fort, décision de Jules).
- 2026-11-02, points d'initiative et de plan : une seule réserve, les points de plan, sans plafond ; points d'initiative retirés ; contre-ordre = 1 point de plan ou Porter un ordre. Réserve dans la fenêtre Bataille (v0.27.15), dépenses annoncées dans le chat.
- 2026-11-02 (soir), décisions de Jules après les batteries F, G, H et C, codées en v0.28 à v0.28.7 : brouillard de guerre par case (option), identification à 3 cases, nuit, tir à l'aveugle (à la main), plus de portée divisée par deux en brouillard, flanc limité à +1B (plus une option), +1B d'embuscade, case d'un allié qui part, charge qui se rabat, échanges de cases, contact (ni Manœuvrer ni Course ; Se replier en fin de tour ; relève). Gardés tels quels : Commander, village, infanterie lourde.
- Plus aucun écart ouvert en bataille. Reste côté Compagnie : discours du chef, victoire et défaite (Cohésion à la main), achat de service à la main.
