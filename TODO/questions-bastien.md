# Questions à poser à Bastien

Ces 4 points bloquent des issues du board. Sans réponse, le développement
inventerait une règle ou un texte — et produirait un correctif que Bastien
rejetterait au test suivant.

Message prêt à copier-coller dans WhatsApp ci-dessous.

---

## Message

> Salut Bastien ! J'ai repris tous tes retours du 18/09, c'est en cours de
> correction. J'ai 4 questions pour être sûr de faire les choses comme tu
> les veux :
>
> **1. L'écran SCHMITT** — tu m'avais écrit « Retirer 1 joueur sur la case :
> joueur 1 ». Je veux être sûr : tu veux que je *supprime* la phrase
oui 
> « 1 joueur sur la case : Joueur 1 » qui ne veut rien dire, ou tu veux que
> j'affiche ce texte-là ? delete
>
> **2. La case MOUTON** — tu as écrit « surtout que ce n'est plus mouton? ».
> La case affiche des masques de théâtre 🎭 mais s'appelle « MOUTON » dans le
> jeu. Elle s'appelle comment au vrai Schmitt ?
>Elle s'appel copie smplement 
> **3. Le défi du Schmitt à la fin** — tu m'as dit qu'il manquait pour les
> perdants. Tu peux me redonner la règle exacte ? Qui fait quoi, et qu'est-ce
> qui s'affiche à l'écran ?

Le défis dus scmit c'est tous les joeurs sauf le joeur qui a gagne doivent lancer les dés 
Si ils ne font pas de double il boivent le plus grand dés révele 
Si non le joeur qui arrivent a faire un double donne le dées en gorge a une personne mais pas au gagnant le gagant ne peut pas prendre 
Exemple joeur 1 : fait sur le premier dées 5 et le deuxieme 2 
le joeur 1 prendra 5 gorger 
LE joeur 2 fait double 2 
Il peut discribuer 2 gorgé au joeur 1 
LE joeur 3 a gagne alors il ne fait rien 

>
> **4. Une photo du plateau** — tu m'avais dit que le plateau ne ressemble pas
> au vrai. Tu peux m'envoyer une photo du plateau physique ? Ça me permettra
> de lister précisément ce qui cloche.
> Il y a ybe refinte 
> Et une dernière chose sur le POULET 🐔 : dans le code, la règle dit que si
> un **autre** joueur passe sur une case Poulet entre tes deux passages, ton
> rang repart à zéro (tu redeviens Petit Poulet au lieu de passer Gros).
> C'est bien la règle du vrai Schmitt, ou le rang doit rester acquis ?
il ya uen refonte du coup on verra par la suite 
---

## Pourquoi chaque question

| Question | Issue | Ce qui est bloqué |
|---|---|---|
| 1. Formulation écran SCHMITT | [#18](https://github.com/thefolin/Schmitt/issues/18) | Sa phrase a deux lectures opposées |
| 2. Nom de la case Mouton | [#23](https://github.com/thefolin/Schmitt/issues/23) | Le nom affiché contredit l'icône 🎭 |
| 3. Défi des perdants | [#28](https://github.com/thefolin/Schmitt/issues/28) | Règle inconnue, écran de fin incomplet |
| 4. Photo du plateau | [#12](https://github.com/thefolin/Schmitt/issues/12) | Aucun écart concret identifiable |
| 5. Règle du Poulet | [#24](https://github.com/thefolin/Schmitt/issues/24) (fermée) | Confirme que la fermeture était justifiée |

La question 5 est la plus importante des cinq : elle valide — ou invalide —
la décision de fermer #24. Si Bastien répond que le rang doit rester acquis,
alors `setChicken()` applique une règle fausse et #24 doit être rouverte.
