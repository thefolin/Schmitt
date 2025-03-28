# 🎲 Schmitt Odyssée - Jeu de Plateau Interactif

Bienvenue dans **Schmitt Odyssée**, un jeu de plateau interactif développé avec **Phaser.js**. Ce projet est une adaptation numérique des règles du célèbre jeu de société, avec des fonctionnalités personnalisées et des visuels immersifs.

Jeux de plateau : 
[Schmitt Odyssée - web](https://thefolin.github.io/Schmitt).


---

## 📖 Description

Schmitt Odyssée est un jeu de plateau où les joueurs avancent sur un parcours en lançant des dés. Chaque case peut contenir des effets spéciaux, des défis ou des surprises. Le but est d'atteindre la case finale tout en respectant les règles du jeu.

Les règles originales du jeu sont disponibles sur ce site magnifique : [Schmitt Odyssée](https://unoff31.wixsite.com/schmittodyssee?fbclid=IwAR0IWmnOIjkXfmU2zZKiXerVHv4QUvO_EiCL9CXgGllWyld6eUs_WR4A0gQ).

---

## 🚀 Fonctionnalités

- 🎲 **Lancer de dés** : Chaque joueur peut lancer un dé pour avancer sur le plateau.
- 🖼️ **Plateau interactif** : Les cases du plateau sont personnalisées avec des images et des effets spéciaux.
- 👥 **Gestion des joueurs** : Ajoutez plusieurs joueurs avec des noms et des couleurs personnalisés.
- 🔄 **Effets de cases** : Certaines cases déclenchent des événements spéciaux (bonus, malus, etc.).
- 📜 **Journal des actions** : Suivez les actions des joueurs grâce à un journal interactif.

---

## 📂 Structure du Projet

- **`index.html`** : Point d'entrée principal du projet.
- **`game.js`** : Contient la logique principale du jeu (Phaser.js).
- **`data/power.json`** : Fichier JSON contenant les données des cases (images, effets, etc.).
- **`data/img/`** : Dossier contenant les images utilisées pour les cases du plateau.
- **`style.css`** : Styles pour l'interface utilisateur.

---

## 🛠️ Installation et Lancement

### Prérequis
- **Python 3** (pour lancer un serveur local).
- Un navigateur moderne (Chrome, Firefox, etc.).

### Étapes
1. Clonez le projet :
    ```bash
    git clone https://github.com/votre-repo/schmitt-odyssee.git
    cd schmitt-odyssee
    ```

2. Lancez un serveur local :
    ```bash
    python3 -m http.server
    ```

3. Accédez au jeu dans votre navigateur :
    [http://localhost:8000](http://localhost:8000)

---

## 🖼️ Aperçu

### Plateau de jeu
![Plateau de jeu](data/img/image.png)

---

## 📜 Règles du Jeu

1. Chaque joueur lance un dé à son tour.
2. Avancez sur le plateau en fonction du résultat du dé.
3. Respectez les effets des cases spéciales :
    - **Case START** : Point de départ.
    - **Case FINISH** : Arrivée, le premier joueur à y arriver gagne.
    - **Cases spéciales** : Déclenchent des événements (bonus, malus, etc.).
4. Le joueur qui atteint la case finale en premier remporte la partie.

---

## 📅 Historique des Mises à Jour

- **22/03/2025** : Initialisation du projet par Quentin Hamon.
- **23/03/2025** : Ajout des fonctionnalités interactives :
    - Implémentation de la logique de lancer de dés.
    - Gestion des déplacements des joueurs sur le plateau.
    - Ajout des effets spéciaux pour les cases (bonus, malus, etc.).
    - Création du journal des actions pour suivre les événements du jeu.
    - Intégration des visuels interactifs pour les cases du plateau.
    - Gestion des tours des joueurs avec vérification des règles.
    - Ajout de la logique de fin de partie (détection du gagnant).

## 🤝 Contribuer

Les contributions sont les bienvenues ! Si vous souhaitez améliorer le projet :

1. Forkez le dépôt.
2. Créez une branche pour vos modifications :
    ```bash
    git checkout -b feature/ma-nouvelle-fonctionnalite
    ```
3. Faites une Pull Request.

---

## 📝 Licence

Ce projet est sous licence MIT. Vous êtes libre de l'utiliser, de le modifier et de le partager.

---

## 💡 Remerciements

Un grand merci à tous les contributeurs et à la communauté Phaser.js pour leur soutien et leurs ressources.