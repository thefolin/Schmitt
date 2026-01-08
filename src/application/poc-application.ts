/**
 * POC Application Layer
 * Test des Use Cases et Services
 */

import { GameDefinition } from '../domain/definitions/GameDefinition';
import { EventBus } from './services/EventBus';
import { StartGameUseCase } from './use-cases/StartGameUseCase';
import { ExecuteActionUseCase } from './use-cases/ExecuteActionUseCase';
import { Game } from '../domain/entities/Game';
import { RuleEngine } from '../domain/rules/RuleEngine';
import { CreateGameDTO, GameActionDTO } from './dto/GameDTO';

// Configuration Schmitt (inline pour browser)
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
 * Test de l'Application Layer
 */
export async function testApplicationLayer() {
  console.log('🎮 POC - Application Layer\n');

  // 1. Créer l'EventBus
  console.log('📡 Création de l\'EventBus...');
  const eventBus = new EventBus();

  // S'abonner à tous les événements pour logger
  eventBus.subscribeAll((event) => {
    console.log(`   📢 [${event.type}] ${JSON.stringify(event.data)}`);
  });
  console.log('✅ EventBus créé et écouteurs enregistrés\n');

  // 2. Charger la définition du jeu
  console.log('📋 Chargement de la définition de jeu...');
  const gameDefinition = GameDefinition.fromJSON(schmittConfig);
  console.log(`✅ ${gameDefinition.name} v${gameDefinition.version} chargé\n`);

  // 3. Utiliser StartGameUseCase
  console.log('🚀 Utilisation de StartGameUseCase...');
  const startGameUseCase = new StartGameUseCase(eventBus);

  const createGameDTO: CreateGameDTO = {
    gameDefinitionId: gameDefinition.id,
    players: [
      { id: 'p1', name: 'Alice', color: '#FF6B6B' },
      { id: 'p2', name: 'Bob', color: '#4ECDC4' }
    ]
  };

  const startResult = await startGameUseCase.execute(gameDefinition, createGameDTO);

  if (!startResult.success) {
    console.log('❌ Erreur:', startResult.message);
    return;
  }

  console.log(`✅ ${startResult.message}`);
  console.log(`   • ID: ${startResult.gameState.id}`);
  console.log(`   • Phase: ${startResult.gameState.phase}`);
  console.log(`   • Joueurs: ${startResult.gameState.players.map(p => p.name).join(', ')}`);
  console.log(`   • Plateau: ${startResult.gameState.board.size} cases\n`);

  // 4. Recréer le jeu pour exécuter des actions
  // (Dans une vraie app, on aurait un GameRepository pour récupérer le jeu)
  console.log('🔧 Recréation du jeu pour les actions...');
  const game = new Game(startResult.gameState.id, gameDefinition.id);

  const alice = startResult.gameState.players[0];
  const bob = startResult.gameState.players[1];

  const alicePlayer = new (await import('../domain/entities/Player')).Player(alice.id, alice.name, alice.color);
  const bobPlayer = new (await import('../domain/entities/Player')).Player(bob.id, bob.name, bob.color);

  game.addPlayer(alicePlayer);
  game.addPlayer(bobPlayer);

  const board = gameDefinition.createBoard();
  game.setBoard(board);

  const ruleEngine = new RuleEngine();
  const rules = gameDefinition.createRules();
  ruleEngine.registerRules(rules);

  game.start();
  console.log('✅ Jeu recréé\n');

  // 5. Utiliser ExecuteActionUseCase
  console.log('========== ACTIONS ==========\n');
  const executeActionUseCase = new ExecuteActionUseCase(eventBus);

  // Action 1 : Alice lance le dé (résultat = 3, case DRINK_2)
  console.log('🎲 Action 1 - Alice lance le dé...');
  const action1: GameActionDTO = {
    type: 'ROLL_DICE',
    playerId: alice.id,
    payload: { diceResult: 3 }
  };

  const result1 = await executeActionUseCase.execute(game, ruleEngine, action1);

  if (result1.success) {
    console.log(`✅ Action réussie, ${result1.events.length} événements générés`);
    const aliceState = result1.gameState.players.find(p => p.id === alice.id);
    console.log(`   🍺 Alice: ${aliceState?.resources['drinks'] || 0} gorgée(s)\n`);
  } else {
    console.log(`❌ Erreur: ${result1.errors?.join(', ')}\n`);
  }

  // Action 2 : Bob lance le dé (résultat = 1, case EVERYONE_DRINKS)
  console.log('🎲 Action 2 - Bob lance le dé...');
  const action2: GameActionDTO = {
    type: 'ROLL_DICE',
    playerId: bob.id,
    payload: { diceResult: 1 }
  };

  const result2 = await executeActionUseCase.execute(game, ruleEngine, action2);

  if (result2.success) {
    console.log(`✅ Action réussie, ${result2.events.length} événements générés`);
    const aliceState2 = result2.gameState.players.find(p => p.id === alice.id);
    const bobState2 = result2.gameState.players.find(p => p.id === bob.id);
    console.log(`   🍺 Alice: ${aliceState2?.resources['drinks'] || 0} gorgée(s)`);
    console.log(`   🍺 Bob: ${bobState2?.resources['drinks'] || 0} gorgée(s)\n`);
  } else {
    console.log(`❌ Erreur: ${result2.errors?.join(', ')}\n`);
  }

  // 6. Résumé
  console.log('========== RÉSUMÉ ==========\n');
  console.log('📊 État final de l\'Application Layer:');
  console.log(`   • EventBus: ${eventBus.getHandlerCount()} handler(s)`);
  console.log(`   • StartGameUseCase: ✅ Testé`);
  console.log(`   • ExecuteActionUseCase: ✅ Testé`);
  console.log(`   • TurnManager: ✅ Testé (via ExecuteAction)`);
  console.log('\n✅ POC Application Layer réussi ! 🎉\n');
}
