# Compagnie : décisions de règles prises pendant le développement

Complément au document de règles maison de la Compagnie (document privé, qui reste la référence). On note ici les points tranchés en codant le système.

## 2026-10-29

- **Organisation de base et effective.** L'Organisation saisie (de base) donne l'espace des services (3 points par tranche de 10, +1 par rang d'Ingéniosité du chef). Les bonus d'Organisation des services (Charpentier +2, Équipe de charpentiers +3, Guilde des travailleurs du bois +5, Contremaître +1, Aides de camp +2, Sénéchaux +3, Cuisinier de campagne +2) s'ajoutent à l'**Organisation effective**, qui sert à l'entretien du ravitaillement et aux tests d'événements. Ils n'agrandissent pas l'espace (évite la boucle services → Organisation → espace → services). Les bonus conditionnels (Transport logistique « en voyage », « +X par mois ») restent des rappels.
- **Prix et entretien des services.** Achat en Richesse : petit 3, moyen 6, grand 9. Entretien **uniquement en Ravitaillement**, selon la taille : petit 5, moyen 10, grand 15 par mois (remplace l'entretien 1/2/3 en Richesse et les 5 de ravitaillement par service).
- **Formule d'entretien mensuel du ravitaillement** : Effectif / 2 + entretien des services − 5 par tranche de 10 d'Organisation effective. L'exemple du document (60 Effectif, 30 Organisation, 3 petits services) donne toujours 30.
- **Unités vétéranes et élites** : recrutement direct ou par l'expérience, à la discrétion du MJ. Les troupes entraînées demandent des Sergents d'entraînement ou des Maîtres d'armes (rappel, non bloquant).
- **Discipline** : jamais sous Élémentaire (0), comme dans le livre de base.

## Révision des règles (discussion du 2026-10-29, codée de v0.7.0 à v0.13.1)

État relu sur le code v0.27.10 le 2026-11-02. Presque tout est codé conforme. Écarts restants :
- **Cohésion de départ** : corrigée en v0.27.11, la création guidée la met au maximum.
- **Mutinerie** : au récit, rien à définir (décision du 2026-11-02). La carte de fin de mois rappelle le risque au palier crise.
- **Ordre du mois** : événement avant l'action (décision du 2026-11-02), codé en v0.27.11. L'événement tient compte de la Cohésion laissée par les revenus et l'entretien du mois ; le repos (+5) vient après.
- **Discours du chef** (+1 par degré, une fois par mois) : non codé, à la main.
- **Victoire et défaite** (±1d6 × 3 Cohésion) : non codées, à la main sur la fiche.
- **Achat d'un service** : le prix s'affiche, mais la Richesse n'est pas débitée.
- **Contrats** : aide de jeu sans jet (besoins mensuels et conseils) ; la grille indicative de paie n'existe pas.
- **Conversion** : la 2e ligne du dialogue est toujours au taux précipité ; la Cohésion n'est pas recalculée si l'Autorité baisse.
- **Paliers de Cohésion** : leur effet sur la Discipline ne s'applique qu'en bataille, pas à la Discipline affichée des unités.
- **Repos +5** : seulement si la solde est payée ; l'absence de combat n'est pas vérifiée.
- **Sang des Asshaïs** : les Sangs sont du texte libre ; aucune donnée dans le système.

- **Contrats** : mélange « le MJ fixe » et « négociation ». Le MJ fixe l'employeur, la durée et la paie de base ; un test de Persuasion (Marchandage) du négociateur améliore (degrés de réussite) ou dégrade (échec : clause défavorable) les conditions. Négociateur et Porte-parole s'y appliquent. Grille indicative de paie à prévoir (Renommée, danger).
- **Butin et pillage** : rapportent en plus du contrat. Pillage : −1 disposition des habitants de la région (règle existante). **Rupture de contrat ou trahison d'un employeur : −1d6 Renommée.** Exactions : au jugement du MJ, avec le modèle de l'événement « Cruauté » (+1d6 Renommée, −1d6 Autorité).
- **Solde** : comprise dans le Ravitaillement (vivres et solde). Si le Ravitaillement ne couvre pas l'entretien du mois, solde impayée : **Cohésion −10 % de son maximum** (−5 % avec cantiniers ou cuisinier de campagne, v0.29.0) ; au deuxième mois impayé consécutif, **désertions (−1d6 Effectif)** puis risque de **Mutinerie**, joué au récit.
- **Partage du butin** : le capitaine choisit la part distribuée aux hommes (de 0 à tout le butin ; chaque point distribué = +1 Cohésion), le reste va en caisse (Richesse). Révisé le 2026-10-29 (au lieu du tout ou rien), à rééquilibrer après quelques mois de jeu si besoin.
- **Cohésion** : moral au quotidien, plafonné par l'Autorité (maximum = 3 × Autorité) ; valeur de départ = maximum.
  - Baisse : solde impayée −10 % du maximum par mois ; défaite −1d6 × 3 ; lourdes pertes, chef blessé ou capturé −5 à −15 (MJ) ; ordre impopulaire (MJ).
  - Hausse : butin distribué +1 par point de Richesse distribué ; victoire +1d6 × 3 ; mois de repos payé sans combat +5 ; discours du chef (test de Persuasion) +1 par degré, une fois par mois.
  - Paliers : 85-100 % bon moral (+2 Discipline) ; 60-84 % solide (+1) ; 40-59 % tensions (RP) ; 20-39 % grogne (−1 Discipline, désertions possibles) ; 0-19 % crise (−2 Discipline, risque de Mutinerie joué au récit, Autorité du chef menacée).
- **Échelle Effectif / Puissance (option A)** : coûts inchangés. Effectif = hommes disponibles ; le coût d'une unité de 100 hommes dépend de l'entraînement (Bleu 1, Entraîné 2, Vétéran 3, Élite 4 : encadrement, expérience, remplaçants). Puissance = équipement et moyens ; une unité à plusieurs types additionne les coûts de ses types. Vérifié sur une compagnie de test (1 020 hommes en unités pour 23 d'Effectif).
- **Affichage des hommes** : hommes en unités (somme des unités) + réserve (Effectif non investi) × 40 personnes, ex. « ≈ 1 260 personnes, dont 1 020 en armes ».
- **Nombre d'unités** : l'objet Unité reçoit un multiplicateur (bataillon de N unités) qui multiplie hommes et coûts.
- **Mois de la Compagnie** : boucle en 4 temps validée (revenus, entretien et effets mensuels des services, événement, une action de compagnie). **Le test d'événement de compagnie est facultatif, à l'appréciation du MJ** (désactivé par défaut).
- **Actions de compagnie** (recruter, entraîner, acheter un service, convertir, se reposer, chercher un contrat) : validées, **optionnelles**.
- **Services État-major et Culte** : réorientés vers les tests de la Compagnie (négociation et recherche de contrat pour l'état-major ; discours du chef et Cohésion pour le culte) **et** conservent leur bonus aux tests d'événements.
- **Table d'événements de compagnie** : à réadapter à partir de la table 6-18 du livre (en discussion).
- **Test d'événement de compagnie** : test de Statut (Intendance) de l'intendant ou du trésorier, + modificateurs d'Organisation effective, de Cohésion et des services.
- **Table d'événements de compagnie** (échelle régulière, validée) : 5 ou moins Désastre (−1d6 sur deux ressources) ; 6-8 Calamité (−1d6 sur une ressource) ; 9-11 Déclin (−1d6 Cohésion ou −1 sur une ressource) ; **12-19 Mois calme** ; 20-24 Croissance (+1 sur une ressource) ; 25-29 Bienfait (+1d6 sur une ressource) ; 30 et plus Aubaine (+1d6 sur deux ressources). Le MJ choisit les ressources et raconte. Option : **relancer** le test (tout résultat, pas seulement un mois calme), au choix du MJ.
  - Modificateur d'Organisation effective : 0-9 −5 ; 10-19 −2 ; 20-29 +0 ; 30-39 +1 ; 40+ +3.
  - Modificateur de Cohésion : crise −5 ; grogne −2 ; tensions 0 ; solide +1 ; bon moral +3.
- **Sang des Asshaïs** : −1D aux tests de Persuasion, sauf l'Intimidation qui gagne +1B (remplace −2 / +2).
- **Sangs** : le mélange dés de bonus / modificateurs fixes est conservé (saveur de chaque Sang).
- **Ancienneté** : 1d6 (ou choix) : 1 Antique, 2 Très ancienne, 3 Ancienne, 4 Bien établie, 5 Récente, 6 Fraîche ; l'ancienne colonne « Résultat » est supprimée.
- **Conversion des ressources** : Renommée → Autorité 1:1 (précipité 2:1) ; Effectif → Puissance 1:1 (2:1) ; Puissance → Renommée, Autorité ou Effectif 1:1 (2:1) ; Richesse → n'importe quelle ressource 2:1 (3:1) ; Richesse → Ravitaillement 1:5 ; Autorité et Organisation non convertibles.
- **Origines** : modificateurs inchangés (Soldats et Fanatiques à −20 en Richesse, voulu).

**Discussion de révision terminée le 2026-10-29.** Codée ensuite, sauf les écarts listés en tête de section.

## 2026-11-03 : services qui limitent les pertes (v0.29.0)

Les réductions de pertes du catalogue n'avaient aucune prise : rien ne chiffrait les maladies ni les pertes d'Autorité au combat. Elles sont rebranchées sur ce qui existe : le Bilan de bataille, les événements du mois et la Cohésion.

| Service | Effet sur les pertes | Effet conservé |
|---|---|---|
| Petit hôpital de campagne | Bilan : un quart des pertes de chaque troupe rendu ; événements du mois : pertes d'Effectif −2 | |
| Maîtres équestres | Bilan : un quart des pertes des troupes montées rendu (cumul avec l'hôpital : la moitié) | −1 Puissance à l'achat d'unités montées |
| Soigneurs | Événements du mois : pertes d'Effectif −1 | |
| Maître forgeron / Guilde des armuriers | Événements du mois : pertes de Puissance −1 / −2 | +1 / +2 Puissance par mois |
| Cantiniers / Cuisinier de campagne | Événements du mois : pertes d'Autorité −1 ; solde impayée −5 % de Cohésion au lieu de −10 % | Cuisinier : +2 Organisation |
| Aumôniers / Congrégation | Défaite ou coup dur (lourdes pertes, chef blessé ou capturé) : 3 / 6 de Cohésion perdus en moins | +1 / +2 aux tests d'événements |

- **Garde-fous** : une perte d'événement réduite ne descend jamais sous 1 ; le culte n'ôte jamais plus de la moitié d'une perte de Cohésion ; un seul service compte par catégorie (le meilleur), pour les pertes comme pour l'Organisation, le bonus aux tests d'événements et les effets mensuels (v0.29.1, le catalogue refuse aussi un second service d'une catégorie) ; les désertions ne sont pas réduites. Le Déclin (−1 sur une ressource) ne se réduit pas.
- **Dans Foundry** : le Bilan applique les soins et affiche les pertes sans eux, ainsi que la réduction du culte ; la carte d'événement rappelle les réductions sur Désastre, Calamité et Déclin (le MJ applique l'événement) ; la fin de mois applique la solde impayée à −5 %.

## 2026-11-03 : cavalerie et Cohésion (v0.30.0)

- **Cavalerie** : la cavalerie légère coûtait autant que l'infanterie lourde (2 Puissance, même entretien), comptait 200 hommes au surnombre et allait deux fois plus vite. Prix : cavalerie légère 3 Puissance, cavalerie lourde 6. **Fourrage** : +2 Ravitaillement par mois et par unité montée, ajoutés à l'entretien. À revoir après une batterie à Puissance égale ; autre levier possible : le surnombre de la cavalerie légère.
- **La Cohésion suit l'Autorité** : chaque point d'Autorité gagné ajoute 3 de Cohésion, chaque point perdu en retire 3 (le maximum vaut 3 × Autorité). Avant, le Prévôt et les Officiers disciplinaires faisaient monter le maximum sans la Cohésion, et le palier baissait.
