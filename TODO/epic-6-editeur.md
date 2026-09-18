# EPIC-6 — Éditeur de plateau

> « L'éditeur est simple d'utilisation 👍 » — Bastien, 14:50:02

Le seul retour **positif** de la session : l'ergonomie de l'éditeur est
validée. Mais son résultat n'est pas utilisé.

---

## SCH-22 — Jouer le plateau que j'ai créé

**En tant que** joueur ayant composé un plateau dans l'éditeur
**je veux** que la partie utilise mes cases dans mon ordre
**afin que** l'éditeur serve à quelque chose.

**Contexte** — Capture `00000047` (14:48:44).
« Par contre il joue les cases du vrai schmitt... et pas du tout celle dans
l'ordre que j'ai sélectionné dans l'édition. » (14:50:02)

La capture montre un plateau édité de 6 cases (START, ×2 rouge, ×2 vert,
×4 rouge, ×2 vert, carte dorée) avec des numéros d'origine non contigus
(0, 3, 6, 15, 19, 22) — les index du plateau standard sont conservés, ce qui
suggère que le plateau édité n'est pas réindexé ni transmis au moteur de jeu.

Quentin a confirmé le 18/09 à 16:03 : « C'est en cours ça. Je dois
retravailler la disposition de l'ordre. »

**Critères d'acceptation**
- [ ] La partie se joue sur les cases sélectionnées dans l'éditeur, dans l'ordre choisi
- [ ] Les cases sont réindexées de façon contiguë (0, 1, 2…)
- [ ] La dernière case du plateau édité donne le pouvoir du Schmitt, le retour se fait vers START
- [ ] Les cases flèche restent orientées correctement sur un plateau édité (SCH-02, SCH-03)
- [ ] Un plateau édité survit à un redémarrage de l'application
- [ ] Test automatisé sur un plateau personnalisé court

**Priorité** : 🔴 Bloquant — fonctionnalité sans effet

**Note** : l'ergonomie est validée par Bastien, ne pas la remettre en cause
en corrigeant le fond.
