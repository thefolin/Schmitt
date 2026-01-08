/**
 * POC (Proof of Concept) - Version Browser
 * Test du Domain Layer avec Schmitt Odyssée
 */

import { Game } from './entities/Game';
import { Player } from './entities/Player';
import { GameDefinition } from './definitions/GameDefinition';
import { RuleEngine } from './rules/RuleEngine';
import { GameContext } from './rules/GameContext';

// Configuration Schmitt en ligne (au lieu d'import JSON)
const schmittConfig = {
  "id": "schmitt-odyssee",
  "name": "Schmitt Odyssée",
  "version": "1.0.0",
  "type": "linear-board",
  "settings": {
    "minPlayers": 2,
    "maxPlayers": 8,
    "boardSize": 23,
    "hasDice": true,
    "diceCount": 1,
    "diceSides": 6
  },
  "resources": [
    {
      "id": "drinks",
      "name": "Gorgées",
      "icon": "🍺",
      "initial": 0
    }
  ],
  "board": {
    "layout": "serpentine",
    "tiles": [
      { "id": 0, "type": "start", "name": "START", "icon": "🏁" },
      { "id": 1, "type": "everyone_drinks", "name": "TOURNÉE GÉNÉRALE", "icon": "🍻" },
      { "id": 2, "type": "forward_2", "name": "AVANCEZ DE 2", "icon": "⏩" },
      { "id": 3, "type": "drink_2", "name": "BUVEZ 2 GORGÉES", "icon": "🍺" },
      { "id": 4, "type": "power", "name": "FAVEUR DES DIEUX", "icon": "⚡" },
      { "id": 5, "type": "chicken", "name": "PETIT POULET", "icon": "🐔" },
      { "id": 22, "type": "finish", "name": "FINISH", "icon": "🏆" }
    ]
  },
  "rules": [
    {
      "id": "drink_2",
      "name": "Buvez 2 gorgées",
      "priority": 100,
      "conditions": [
        {
          "type": "OnPlayerLandsOn",
          "params": { "position": 3 }
        }
      ],
      "effects": [
        {
          "type": "AddResource",
          "params": {
            "resourceId": "drinks",
            "amount": 2,
            "target": "current_player"
          }
        },
        {
          "type": "Notification",
          "params": {
            "message": "boit 2 gorgées",
            "icon": "🍺"
          }
        }
      ]
    },
    {
      "id": "everyone_drinks",
      "name": "Tournée générale",
      "priority": 100,
      "conditions": [
        {
          "type": "OnPlayerLandsOn",
          "params": { "position": 1 }
        }
      ],
      "effects": [
        {
          "type": "AddResource",
          "params": {
            "resourceId": "drinks",
            "amount": 1,
            "target": "all_players"
          }
        },
        {
          "type": "Notification",
          "params": {
            "message": "Tout le monde boit !",
            "icon": "🍻"
          }
        }
      ]
    },
    {
      "id": "forward_2",
      "name": "Avancez de 2 cases",
      "priority": 100,
      "conditions": [
        {
          "type": "OnPlayerLandsOn",
          "params": { "position": 2 }
        }
      ],
      "effects": [
        {
          "type": "MovePlayer",
          "params": {
            "steps": 2
          }
        },
        {
          "type": "Notification",
          "params": {
            "message": "avance de 2 cases",
            "icon": "⏩"
          }
        }
      ]
    }
  ]
};

/**
 * Test du moteur avec Schmitt Odyssée
 */
export async function testGameEngine() {
  console.log('🎮 POC - Moteur de Jeu Universel\n');

  // 1. Charger la définition du jeu
  console.log('📋 Chargement de Schmitt Odyssée...');
  const gameDefinition = GameDefinition.fromJSON(schmittConfig);
  console.log(`✅ Jeu chargé: ${gameDefinition.name} v${gameDefinition.version}\n`);

  // 2. Créer une partie
  console.log('🎲 Création d\'une nouvelle partie...');
  const game = new Game('game_001', gameDefinition.id);

  // 3. Ajouter des joueurs
  const alice = new Player('p1', 'Alice', '#FF6B6B');
  const bob = new Player('p2', 'Bob', '#4ECDC4');

  game.addPlayer(alice);
  game.addPlayer(bob);
  console.log(`✅ ${game.players.length} joueurs ajoutés: ${game.players.map(p => p.name).join(', ')}\n`);

  // 4. Créer le plateau
  console.log('🗺️  Création du plateau...');
  const board = gameDefinition.createBoard();
  game.setBoard(board);
  console.log(`✅ Plateau créé: ${board.size} cases\n`);

  // 5. Charger les règles
  console.log('📜 Chargement des règles...');
  const ruleEngine = new RuleEngine();
  const rules = gameDefinition.createRules();
  ruleEngine.registerRules(rules);
  console.log(`✅ ${rules.length} règles chargées\n`);

  // 6. Démarrer le jeu
  console.log('🚀 Démarrage de la partie...\n');
  game.start();

  // 7. Simulation de tours
  console.log('========== SIMULATION ==========\n');

  // Tour 1 : Alice lance le dé et obtient 3 (case DRINK_2)
  console.log('🎲 Tour 1 - Alice lance le dé...');
  alice.moveBy(3);
  console.log(`   Alice se déplace en position ${alice.position.index}`);

  // Appliquer les règles de la case
  const context1: GameContext = {
    game,
    currentPlayer: alice,
    triggerData: { diceRoll: 3 }
  };

  const appliedRules1 = await ruleEngine.executeApplicableRules(context1);
  console.log(`   ✨ ${appliedRules1.length} règle(s) appliquée(s)`);
  console.log(`   🍺 Alice a maintenant ${alice.getResource('drinks')} gorgée(s)\n`);

  // Tour 2 : Bob lance le dé et obtient 1 (case EVERYONE_DRINKS)
  game.nextTurn();
  console.log('🎲 Tour 2 - Bob lance le dé...');
  bob.moveBy(1);
  console.log(`   Bob se déplace en position ${bob.position.index}`);

  const context2: GameContext = {
    game,
    currentPlayer: bob,
    triggerData: { diceRoll: 1 }
  };

  const appliedRules2 = await ruleEngine.executeApplicableRules(context2);
  console.log(`   ✨ ${appliedRules2.length} règle(s) appliquée(s)`);
  console.log(`   🍺 Alice: ${alice.getResource('drinks')} gorgée(s)`);
  console.log(`   🍺 Bob: ${bob.getResource('drinks')} gorgée(s)\n`);

  // Tour 3 : Alice avance encore
  game.nextTurn();
  console.log('🎲 Tour 3 - Alice lance le dé...');
  alice.moveBy(2);
  console.log(`   Alice se déplace en position ${alice.position.index}`);

  const context3: GameContext = {
    game,
    currentPlayer: alice,
    triggerData: { diceRoll: 2 }
  };

  await ruleEngine.executeApplicableRules(context3);
  console.log(`   Alice est maintenant en position ${alice.position.index}\n`);

  // 8. Sauvegarder l'état
  console.log('💾 Sauvegarde de l\'état...');
  const savedState = game.toJSON();
  console.log('✅ Partie sauvegardée\n');

  // 9. Charger l'état
  console.log('📥 Restauration de l\'état...');
  const restoredGame = Game.fromJSON(savedState);
  console.log(`✅ Partie restaurée: ${restoredGame.players.length} joueurs, tour ${restoredGame.turnNumber}\n`);

  // Résumé
  console.log('========== RÉSUMÉ ==========\n');
  console.log(`📊 État final:`);
  console.log(`   • Tour: ${game.turnNumber}`);
  console.log(`   • Joueur actuel: ${game.currentPlayer.name}`);
  console.log(`   • Alice: position ${alice.position.index}, ${alice.getResource('drinks')} gorgée(s)`);
  console.log(`   • Bob: position ${bob.position.index}, ${bob.getResource('drinks')} gorgée(s)`);
  console.log('\n✅ POC réussi ! Le moteur fonctionne. 🎉\n');
}
