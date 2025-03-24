/**
 * Configuration du jeu Phaser.
 * @type {Object}
 */
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: 0xffffff,
    scene: {
        preload: preload,
        create: create,
        update: update,
    },
};

/**
 * Instance du jeu Phaser.
 * @type {Phaser.Game}
 */
const game = new Phaser.Game(config);

/**
 * Liste des joueurs.
 * @type {Array<Object>}
 */
let players = [];

/**
 * Index du joueur actuel.
 * @type {number}
 */
let currentPlayerIndex = 0;

/**
 * Résultat du dernier lancer de dé.
 * @type {number|null}
 */
let diceResult = null;

/**
 * Liste des cases du plateau.
 * @type {Array<Object>}
 */
let boardTiles = [];

/**
 * Nombre total de cases sur le plateau.
 * @type {number}
 */
const numTiles = 23;

/**
 * Taille d'une case du plateau.
 * @type {number}
 */
const tileSize = 50;

/**
 * Élément HTML pour afficher les logs.
 * @type {HTMLElement}
 */
let logList;

/**
 * Joueur qui possède le pouvoir du Schmitt.
 * @type {Object|null}
 */
let schmittPowerHolder = null;

/**
 * Indique si les joueurs retournent à la case START.
 * @type {boolean}
 */
let reverseMode = false;

/**
 * Indique si le déplacement manuel est autorisé.
 * @type {boolean}
 */
let allowManualMove = false;

/** titles tableau (config) qui récupérer a partir du json  */
let titles = [];
// Charger les données JSON pour initialiser les propriétés des cases

/**
 * Indique si un joueur est en train de se déplacer.
 * @type {boolean}
 */
let isPlayerMoving = false;


/**
 * Précharge les assets nécessaires au jeu.
 */
function preload() {
    // Charger le fichier JSON
    this.load.json('powerData', 'data/power.json');



    // Vérifier si le fichier JSON est chargé
    this.load.on('filecomplete-json-powerData', (key, type, data) => {
        console.log("JSON chargé avec succès :", data);
        if (data && data.tiles) {
            data.tiles.forEach(tile => {
                this.load.image(`tile-${tile.id}`, tile.image); // Charger l'image avec une clé unique
            });
        }

        const powerData = data
        if (powerData && powerData.tiles) {
            titles = powerData.tiles.map(tile => ({
                id: tile.id,
                name: tile.name || `Tile ${tile.id}`,
                effect: tile.effect || null,
                image: tile.image || null,
            }));
        }


    });
    // Vérifier les images après le chargement
    this.load.on('complete', () => {
        // console.log("Images chargées :", Object.keys(this.textures.list));
    });
}
/**
 * Crée les éléments du jeu (plateau, joueurs, etc.).
 * @param {Phaser.Scene} scene - La scène Phaser.
 */
function create() {
    createBoard(this);
    btnPlateauPlayer(this);

    document.getElementById("rollDiceButton").addEventListener("click", rollDice);

    document.getElementById("validateMoveButton").addEventListener("click", () => {
        if (isPlayerMoving) {
            logAction("Veuillez attendre que le déplacement soit terminé.");
            return;
        }
        allowManualMove = false;
        movePlayer(this, players[currentPlayerIndex], diceResult);
        document.getElementById("validateMoveButton").disabled = true;
    });



    logList = document.getElementById("logList");
}

/**
 * Crée le plateau de jeu en forme de serpent.
 * @param {Phaser.Scene} scene - La scène Phaser.
 */
function createBoard(scene) {
    const margin = 100; // Marge pour le plateau
    const tilesPerRow = 6; // Nombre de cases par ligne
    const powerData = scene.cache.json.get('powerData'); // Récupérer les données JSON

    afficherBoutonDeplacementManuel(false);

    for (let i = 0; i < numTiles; i++) {
        // Calculer la position de la case
        const row = Math.floor(i / tilesPerRow); // Ligne actuelle
        const col = i % tilesPerRow; // Colonne actuelle

        // Alterner la direction des lignes pour créer l'effet "serpent"
        const x = margin + (row % 2 === 0 ? col : tilesPerRow - 1 - col) * (tileSize + 10);
        const y = margin + row * (tileSize + 10);

        // Trouver l'image correspondante dans le JSON
        const tileData = powerData.tiles.find(tile => tile.id === i);

        if (tileData) {
            // Ajouter une image si elle est définie dans le JSON
            scene.add.image(x, y, `tile-${tileData.id}`).setDisplaySize(tileSize, tileSize);
        } else {
            // Ajouter un rectangle par défaut si aucune image n'est définie
            scene.add.rectangle(x, y, tileSize, tileSize, 0xf4f4f4).setStrokeStyle(1, 0x000000);
        }

        // Ajouter un texte pour les cases START et FINISH ou les indices
        scene.add.text(x - 10, y - 10, i === 0 ? "START" : i === numTiles - 1 ? "FINISH" : i, {
            fontSize: 12,
            color: "#000",
        });

        // Ajouter la case au tableau des cases
        boardTiles.push({ x, y, tileData });
    }
}

/**
 * Affiche ou masque le bouton de déplacement manuel.
 * @param {boolean} afficher - Indique si le bouton doit être affiché (true) ou masqué (false).
 */
function afficherBoutonDeplacementManuel(afficher) {
    const boutonDeplacementManuel = document.getElementById("manualMove");
    boutonDeplacementManuel.style.display = afficher ? "block" : "none";
}

/**
 * Gère les interactions de l'interface utilisateur pour la configuration des joueurs 
 * et le démarrage du jeu, ainsi que les actions de jeu telles que le déplacement 
 * et le passage de tour.
 *
 * @function btnPlateauPlayer
 * @param {Object} scene - La scène du jeu où les joueurs et les actions seront gérés.
 *
 * @description
 * - Permet d'ajouter des joueurs avec un nom et une couleur, en affichant la liste des joueurs ajoutés.
 * - Démarre le jeu une fois qu'au moins un joueur est ajouté.
 * - Gère les actions de jeu comme le déplacement d'un joueur vers une case spécifique 
 *   et le passage du tour au joueur suivant.
 *
 * @listens click#addPlayerButton - Ajoute un joueur à la liste des joueurs.
 * @listens click#startGameButton - Démarre le jeu si des joueurs sont ajoutés.
 * @listens click#moveToTileButton - Déplace un joueur vers une case spécifique.
 * @listens click#passTurnButton - Passe le tour au joueur suivant.
 *
 * @requires createPlayers - Fonction pour créer les joueurs dans la scène.
 * @requires afficherBoutonDeplacementManuel - Fonction pour afficher ou masquer le bouton de déplacement manuel.
 * @requires movePlayerToTile - Fonction pour déplacer un joueur vers une case spécifique.
 * @requires passTurn - Fonction pour passer le tour au joueur suivant.
 * @requires logAction - Fonction pour enregistrer ou afficher des messages d'action.
 */
function btnPlateauPlayer(scene) {
    const playersData = [];
    document.getElementById("addPlayerButton").addEventListener("click", () => {
        const name = document.getElementById("playerName").value;
        const color = document.getElementById("playerColor").value;

        if (name && color) {
            playersData.push({ name, color });

            // Afficher la liste des joueurs ajoutés
            const playerList = document.getElementById("playerList");
            const listItem = document.createElement("li");
            listItem.textContent = `${name} (${color})`;
            playerList.appendChild(listItem);

            // Réinitialiser les champs
            document.getElementById("playerName").value = "";
            document.getElementById("playerColor").value = "#ff0000";
            // Ajouter un input color désactivé pour afficher la couleur du joueur
            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = color;
            colorInput.disabled = true;
            listItem.appendChild(colorInput);
        }

    });

    document.getElementById("startGameButton").addEventListener("click", () => {
        if (playersData.length > 0) {
            createPlayers(scene, playersData);
            document.getElementById("playerForm").style.display = "none"; // Masquer le formulaire
            afficherBoutonDeplacementManuel(true);

        } else {
            alert("Ajoutez au moins un joueur avant de démarrer le jeu !");
        }
    });


    document.getElementById("moveToTileButton").addEventListener("click", () => {
        const targetTile = parseInt(document.getElementById("targetTileInput").value, 10);
        if (!isNaN(targetTile)) {
            movePlayerToTile(this, players[currentPlayerIndex], targetTile);
        } else {
            logAction("Veuillez entrer un numéro de case valide.");
        }
    });

    document.getElementById("passTurnButton").addEventListener("click", () => {
        logAction(`${players[currentPlayerIndex].name} a passé son tour.`);
        passTurn(this);
    });


}

/**
 * Crée plusieurs joueurs à partir d'une liste de noms et de couleurs.
 * @param {Phaser.Scene} scene - La scène Phaser.
 * @param {Array<Object>} playersData - Liste des joueurs avec leurs noms et couleurs.
 * Exemple : [{ name: "Alice", color: "#FF5733" }, { name: "Bastien", color: "#33FF57" }]
 */
function createPlayers(scene, playersData) {
    playersData.forEach(playerData => {
        const { name, color } = playerData;

        // Convertir la couleur hexadécimale en nombre
        const colorNumber = Phaser.Display.Color.HexStringToColor(color).color;
        // Ajouter le joueur au jeu
        addPlayer(scene, name, colorNumber);

        // Ajouter un log pour indiquer que le joueur a été créé
        logAction(`Le joueur "${name}" a été créé avec la couleur ${color}.`);
    });
}

/**
 * Ajoute un joueur au jeu.
 * @param {Phaser.Scene} scene - La scène Phaser.
 * @param {string} name - Nom du joueur.
 * @param {number} color - Couleur du joueur (en hexadécimal).
 */
function addPlayer(scene, name, color) {
    const sprite = scene.add.circle(boardTiles[0].x, boardTiles[0].y, 15, color);
    const playerNumber = players.length + 1; // Numéro du joueur
    const text = scene.add.text(boardTiles[0].x - 5, boardTiles[0].y - 5, playerNumber, {
        fontSize: '12px',
        color: '#ffffff',
    }).setOrigin(0.5);

    players.push({ name, color, position: 0, sprite, text });
}

/**
 * Lance le dé et met à jour le résultat.
 */
function rollDice() {
    diceResult = Phaser.Math.Between(1, 6);
    document.getElementById("diceResult").textContent = diceResult;
    logAction(`${players[currentPlayerIndex].name} a lancé un ${diceResult}`);
    allowManualMove = true;
    document.getElementById("validateMoveButton").disabled = false;
}

/**
 * Déplace un joueur en fonction de la valeur du dé.
 * @param {Phaser.Scene} scene - La scène Phaser.
 * @param {Object} player - Le joueur à déplacer.
 * @param {number} diceValue - Valeur du dé.
 */
function movePlayer(scene, player, diceValue) {
    console.log(`Déplacement normal : ${player.name} avance de ${diceValue} cases.`);
    let newPosition = reverseMode
        ? player.position - diceValue
        : player.position + diceValue;

    // Gérer les limites du plateau
    if (newPosition < 0) {
        newPosition = 0;
    } else if (newPosition >= numTiles) {
        newPosition = numTiles - 1;
    }

    player.position = newPosition;

    // Mettre à jour la position et vérifier les effets de la case
    updatePlayerPosition(scene, player);
    checkTileEffect(scene, player);
}
/**
 * Met à jour la position d'un joueur sur le plateau.
 * @param {Phaser.Scene} scene - La scène Phaser.
 * @param {Object} player - Le joueur à mettre à jour.
 */

/**
 * Met à jour la position d'un joueur sur le plateau.
 * Si plusieurs joueurs sont sur la même case, ils sont légèrement décalés.
 * @param {Phaser.Scene} scene - La scène Phaser.
 * @param {Object} player - Le joueur à mettre à jour.
 */
function updatePlayerPosition(scene, player) {
    const { x, y } = boardTiles[player.position];

    // Calculer un décalage visible pour les joueurs sur la même case
    const playersOnSameTile = players.filter(p => p.position === player.position);
    const offsetIndex = playersOnSameTile.indexOf(player);
    const offset = 20; // Décalage visible entre les joueurs
    const angle = (Math.PI * 2 / playersOnSameTile.length) * offsetIndex; // Angle pour répartir en cercle
    const offsetX = Math.cos(angle) * offset;
    const offsetY = Math.sin(angle) * offset;

    scene.tweens.add({
        targets: player.sprite,
        x: x + offsetX,
        y: y + offsetY,
        duration: 500,
        onUpdate: () => {
            // Mettre à jour la position du texte pour qu'il suive le sprite
            player.text.setPosition(player.sprite.x, player.sprite.y);
        },
        onComplete: () => {
            if (!allowManualMove) {
                endTurn(scene);
            }
        },
    });
}

/**
 * Vérifie les effets des cases spéciales.
 * @param {Phaser.Scene} scene - La scène Phaser.
 * @param {Object} player - Le joueur à vérifier.
 */
function checkTileEffect(scene, player) {
    // detection de la fin de la premier partie 1 
    if (!reverseMode && player.position === numTiles - 1) {
        if (!schmittPowerHolder) {
            schmittPowerHolder = player;
            logAction(`${player.name} ${player.position} a obtenu le pouvoir du Schmitt !`);
            reverseMode = true;
            logAction("Tous les joueurs retournent à la case START !");
        }

    }
    // detection de la fin de la deuxieme partie 2
    else if (reverseMode && player.position === 0) {
        logAction(`${player.name} - casse ${player.position} a gagné la partie en atteignant la case START avec le pouvoir du Schmitt !`);
        resetGame(scene);
    }
    console.log("position joeur", player.position);

    const tile = titles.find(t => t.id === player.position);
    console.log("tile", tile);

    if (tile && tile.effect) {
        switch (tile.id) {
            case 2:
            case 9:
            case 13:
            case 20:
                logAction(`${player.name} - case ${player.position}: ${tile.effect}`);
                const moveValue = tile.id === 13 || tile.id === 20 ? (reverseMode ? 2 : -2) : (reverseMode ? -2 : 2);

                // Bloquer les actions pendant le déplacement
                isPlayerMoving = true;

                setTimeout(() => {
                    movePlayer(scene, player, moveValue);

                    // Attendre que le déplacement soit terminé avant de terminer le tour
                    setTimeout(() => {
                        logAction(`${player.name} a terminé son tour.`);
                        isPlayerMoving = false;
                        endTurn(scene); // Terminer le tour
                    }, 1000); // Temps pour terminer le déplacement
                }, 1500); // Temps avant de commencer le déplacement
                break;

            default:
                logAction(`${player.name} - case ${player.position}: ${tile.effect}`);
                break;
        }
    } else {
        logAction(`${player.name} - case ${player.position} est sur une case normale.`);
    }

}


/**
 * Déplace un joueur vers une case spécifique.
 * @param {Phaser.Scene} scene - La scène Phaser.
 * @param {Object} player - Le joueur à déplacer.
 * @param {number} targetPosition - La position cible choisie par le joueur.
 */
function movePlayerToTile(scene, player, targetPosition) {
    console.log(`Déplacement manuel : ${player.name} se déplace vers la case ${targetPosition}.`);

    // Vérifier que la position cible est valide
    if (targetPosition < 0 || targetPosition >= numTiles) {
        logAction("Position invalide. Veuillez choisir une case valide.");
        return;
    }

    player.position = targetPosition;

    // Mettre à jour la position et vérifier les effets de la case
    updatePlayerPosition(scene, player);
    checkTileEffect(scene, player);
}


/**
 * Permet à un joueur de passer son tour.
 * @param {Phaser.Scene} scene - La scène Phaser.
 */
function passTurn(scene) {
    logAction(`${players[currentPlayerIndex].name} a passé son tour.`);
    endTurn(scene);
}


/**
 * Termine le tour actuel et passe au joueur suivant.
 * @param {Phaser.Scene} scene - La scène Phaser.
 */
function endTurn(scene) {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    document.getElementById("currentPlayer").textContent = currentPlayerIndex + 1;
    diceResult = null;
    document.getElementById("diceResult").textContent = "--";
}

/**
 * Ajoute un message au journal des actions.
 * @param {string} message - Le message à ajouter.
 */
function logAction(message) {
    const logItem = document.createElement("li");
    logItem.textContent = message;
    logList.appendChild(logItem);
    logList.scrollTop = logList.scrollHeight;
}

/**
 * Réinitialise le jeu.
 * @param {Phaser.Scene} scene - La scène Phaser.
 */
function resetGame(scene) {
    logAction("Réinitialisation du jeu.");
    players.forEach((player) => {
        player.position = 0;
        updatePlayerPosition(scene, player);
    });
    currentPlayerIndex = 0;
    schmittPowerHolder = null;
    reverseMode = false;
    document.getElementById("currentPlayer").textContent = 1;
}

/**
 * Met à jour les éléments du jeu en continu (si nécessaire).
 */
function update() {
    // Mises à jour continues (si nécessaire)
}