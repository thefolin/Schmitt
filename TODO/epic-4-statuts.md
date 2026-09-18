# EPIC-4 — Les statuts persistants des joueurs

**Objectif** : un statut qui dure plusieurs tours (Poulet, pouvoir d'un dieu)
doit être **visible sur le pion** et **évoluer correctement**.

---

## SCH-16 — Devenir Gros Poulet quand on l'est déjà

**En tant que** Petit Poulet retombant sur la case Poulet
**je veux** devenir Gros Poulet
**afin que** la progression du statut suive la règle.

**Contexte** — Capture `00000039` (14:38:43).
« Le joueur était déjà petit poulet 🐤 il devrait devenir gros poulet 🐔. »
(14:39:43)

Le pion rouge est sur la case Poulet (case 5) alors qu'il portait déjà le
statut Petit Poulet : le passage au niveau supérieur n'a pas lieu. La
distinction est importante — le Gros Poulet **distribue** au lieu de boire
(cf. annonce de version du 13/09).

**Critères d'acceptation**
- [ ] Un joueur sans statut qui atteint la case Poulet devient Petit Poulet 🐤
- [ ] Un Petit Poulet qui y retombe devient Gros Poulet 🐔
- [ ] Le comportement d'un Gros Poulet qui y retombe est défini (à confirmer avec Bastien)
- [ ] Le Gros Poulet distribue là où le Petit Poulet boit
- [ ] Test automatisé sur la transition

**Priorité** : 🔴 Bloquant — règle du jeu non respectée

---

## SCH-17 — Repérer le Poulet sur le plateau

**En tant que** joueur
**je veux** un symbole permanent à côté du pion du Poulet
**afin de** savoir qui boit sur les 3 et les 6 sans le demander.

**Contexte** — Captures `00000023` (14:20:50) et `00000039` (14:38:43).
- « Ajouter un symbole a côté du pion qui est le petit/gros poulet 🐔 » (14:21:24)
- « ajouter un logo permanent à côté du joueur 🐔 » (14:39:43)

Demande formulée **deux fois** à 18 minutes d'intervalle : aucun pion ne
porte de marque, impossible de savoir qui est Poulet.

**Critères d'acceptation**
- [ ] Badge affiché en permanence à côté du pion concerné
- [ ] 🐤 pour le Petit Poulet, 🐔 pour le Gros Poulet — visuellement distincts
- [ ] Le badge suit le pion lors des déplacements
- [ ] Le badge ne masque pas l'icône de la case
- [ ] Lisible à la taille d'affichage sur téléphone

**Priorité** : 🟠 Important — demandé deux fois

---

## SCH-18 — Repérer les porteurs de pouvoir divin

**En tant que** joueur
**je veux** identifier sur le plateau qui détient un pouvoir de dieu
**afin de** anticiper ce qui peut m'arriver.

**Contexte** — Captures `00000035` (14:30:54) et `00000047` (14:48:44) : un
petit éclair ⚡ marque le porteur du pouvoir de Zeus. Le mécanisme existe
donc déjà, mais il est discret et n'a pas été généralisé.

Story **déduite** du besoin exprimé en SCH-17 (badge permanent) appliqué aux
autres statuts — **non demandée explicitement par Bastien**, à valider avec
lui avant développement.

**Critères d'acceptation**
- [ ] Chaque pouvoir détenu est signalé par un badge sur le pion
- [ ] Même traitement visuel que les badges Poulet (SCH-17)
- [ ] Le badge disparaît quand le pouvoir est consommé
- [ ] Plusieurs badges sur un même pion restent lisibles

**Priorité** : 🟡 Confort — à valider avec Bastien
