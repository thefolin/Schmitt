# 🎮 Plan d'Architecture - Moteur de Jeu de Société Universel

## 🎯 Vision

Créer un **moteur générique** permettant de développer rapidement différents types de jeux de société :
- **Jeux de plateau** : Schmitt Odyssée, Schmitt Valhalla, Monopoly
- **Jeux à grille** : Échecs, Dames, Morpion
- **Jeux de cartes** : Dominion, La Vallée des Marchands
- **Configuration** : JSON/YAML + TypeScript pour règles complexes

## 📊 Architecture en Oignon (Clean Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Web    │  │  Mobile  │  │  Canvas  │  │   CLI    │   │
│  │   DOM    │  │Capacitor │  │  2D/3D   │  │  Tests   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼────────────┼──────────────┼──────────────┼──────────┘
        │            │              │              │
┌───────▼────────────▼──────────────▼──────────────▼──────────┐
│               APPLICATION LAYER                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Game Engine Orchestrator                          │     │
│  │  • LoadGameUseCase(gameId)                         │     │
│  │  • StartGameUseCase(players, config)               │     │
│  │  • ExecuteActionUseCase(playerId, action)          │     │
│  │  • ProcessTurnUseCase()                            │     │
│  │  • ApplyRuleUseCase(ruleId, context)               │     │
│  │  • CheckVictoryUseCase()                           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Domain Services                                   │     │
│  │  • RuleEngine (interprète les règles)             │     │
│  │  • TurnManager (gestion des tours)                │     │
│  │  • EventBus (pub/sub pour événements)             │     │
│  │  • VictoryConditionEvaluator                      │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                   DOMAIN LAYER (CORE)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ENTITIES (Objets métier riches)                   │     │
│  │  • Game (agrégat racine)                           │     │
│  │  • Player (joueur)                                 │     │
│  │  • Board (plateau)                                 │     │
│  │  • Tile/Cell/Space (espace du jeu)                │     │
│  │  • Card (carte)                                    │     │
│  │  • Deck (paquet de cartes)                         │     │
│  │  • Piece (pion, jeton)                             │     │
│  │  • Resource (monnaie, points)                      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  VALUE OBJECTS                                      │     │
│  │  • Position (x, y ou index)                        │     │
│  │  • DiceResult (valeur, type)                       │     │
│  │  • ActionType (Move, Draw, Trade, etc.)            │     │
│  │  • GamePhase (Setup, Playing, GameOver)            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  RULES (Système de règles générique)               │     │
│  │  • Rule (interface)                                │     │
│  │  • Condition (trigger)                             │     │
│  │  • Effect (action)                                 │     │
│  │  • RuleChain (composition de règles)               │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  GAME DEFINITIONS (Configurations)                 │     │
│  │  • GameDefinition (JSON/YAML loader)               │     │
│  │  • BoardLayout                                     │     │
│  │  • TileConfigurations                              │     │
│  │  • CardDefinitions                                 │     │
│  │  • VictoryConditions                               │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│              INFRASTRUCTURE LAYER                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │  REPOSITORIES (Persistence)                        │     │
│  │  • GameRepository (save/load games)                │     │
│  │  • GameDefinitionRepository (load configs)         │     │
│  │  • PlayerProfileRepository                         │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  EXTERNAL SERVICES                                 │     │
│  │  • RandomNumberService (Math.random)               │     │
│  │  • SoundService (Web Audio)                        │     │
│  │  • NotificationService (Capacitor)                 │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Structure de Fichiers Proposée

```
src/
├── domain/                          # 🟢 COUCHE DOMAINE (Pure)
│   ├── entities/
│   │   ├── core/
│   │   │   ├── Game.ts              # Agrégat racine
│   │   │   ├── Player.ts
│   │   │   ├── GameState.ts
│   │   │   └── Resource.ts
│   │   ├── board/
│   │   │   ├── Board.ts
│   │   │   ├── Tile.ts
│   │   │   ├── Cell.ts
│   │   │   └── Piece.ts
│   │   └── card/
│   │       ├── Card.ts
│   │       ├── Deck.ts
│   │       └── Hand.ts
│   │
│   ├── value-objects/
│   │   ├── Position.ts
│   │   ├── DiceResult.ts
│   │   ├── ActionType.ts
│   │   └── GamePhase.ts
│   │
│   ├── rules/
│   │   ├── Rule.ts                  # Interface de base
│   │   ├── Condition.ts             # Quand une règle s'applique
│   │   ├── Effect.ts                # Que fait la règle
│   │   ├── RuleChain.ts             # Composition
│   │   └── RuleEngine.ts            # Interpréteur
│   │
│   ├── definitions/
│   │   ├── GameDefinition.ts        # Charge JSON → Game
│   │   ├── BoardLayout.ts
│   │   ├── TileConfig.ts
│   │   └── VictoryCondition.ts
│   │
│   └── interfaces/
│       ├── IGameRepository.ts
│       ├── IRandomService.ts
│       └── IEventBus.ts
│
├── application/                     # 🔵 COUCHE APPLICATION
│   ├── use-cases/
│   │   ├── LoadGameUseCase.ts       # Charger un jeu (Schmitt, Dominion)
│   │   ├── StartGameUseCase.ts      # Démarrer une partie
│   │   ├── ExecuteActionUseCase.ts  # Action joueur (Move, Draw, Trade)
│   │   ├── ProcessTurnUseCase.ts    # Gérer un tour
│   │   ├── ApplyRuleUseCase.ts      # Appliquer une règle
│   │   └── CheckVictoryUseCase.ts   # Vérifier victoire
│   │
│   ├── services/
│   │   ├── TurnManager.ts           # Gestion des tours
│   │   ├── EventBus.ts              # Pub/Sub événements
│   │   ├── VictoryEvaluator.ts      # Évaluation victoire
│   │   └── ActionValidator.ts       # Validation actions
│   │
│   └── dto/
│       ├── CreateGameDto.ts
│       ├── PlayerActionDto.ts
│       └── GameStateDto.ts
│
├── infrastructure/                  # 🟡 COUCHE INFRASTRUCTURE
│   ├── repositories/
│   │   ├── LocalStorageGameRepository.ts
│   │   ├── JsonGameDefinitionRepository.ts
│   │   └── CapacitorPreferencesRepository.ts
│   │
│   ├── services/
│   │   ├── MathRandomService.ts
│   │   ├── WebAudioSoundService.ts
│   │   └── CapacitorNotificationService.ts
│   │
│   └── loaders/
│       ├── JsonLoader.ts            # Charge les configs JSON
│       └── RuleCompiler.ts          # Compile règles JSON → Code
│
├── presentation/                    # 🟣 COUCHE PRÉSENTATION
│   ├── controllers/
│   │   ├── GameController.ts        # Orchestre Use Cases ↔ UI
│   │   └── EditorController.ts
│   │
│   ├── renderers/
│   │   ├── board/
│   │   │   ├── BoardRenderer.ts     # Interface
│   │   │   ├── Canvas2DRenderer.ts
│   │   │   ├── CSS3DRenderer.ts
│   │   │   └── CameraRenderer.ts
│   │   ├── card/
│   │   │   └── CardRenderer.ts
│   │   └── ui/
│   │       ├── ModalRenderer.ts
│   │       └── NotificationRenderer.ts
│   │
│   └── main/
│       ├── main.ts                  # Point d'entrée générique
│       └── game-loader.ts           # Charge un jeu spécifique
│
└── games/                           # 🎮 DÉFINITIONS DE JEUX
    ├── schmitt-odyssee/
    │   ├── game.json                # Config du jeu
    │   ├── rules/
    │   │   ├── tile-effects.json    # Règles simples (JSON)
    │   │   └── god-favors.ts        # Règles complexes (Code)
    │   └── assets/
    │       └── tiles.json
    │
    ├── schmitt-valhalla/
    │   ├── game.json
    │   └── rules/
    │
    ├── dominion/
    │   ├── game.json
    │   └── cards/
    │       ├── base-set.json
    │       └── card-effects.ts
    │
    └── chess/
        ├── game.json
        └── rules/
            └── move-rules.ts
```

---

## 🧩 Système de Règles Générique

### Concept Central : **Rule = Condition + Effect**

```typescript
// domain/rules/Rule.ts
export interface Rule {
  id: string;
  name: string;
  conditions: Condition[];
  effects: Effect[];
  priority: number;
}

// domain/rules/Condition.ts
export interface Condition {
  type: 'OnEvent' | 'PlayerAt' | 'HasCard' | 'Custom';
  params: Record<string, any>;
  evaluate(context: GameContext): boolean;
}

// domain/rules/Effect.ts
export interface Effect {
  type: 'Move' | 'Draw' | 'GainPoints' | 'Custom';
  params: Record<string, any>;
  execute(context: GameContext): void;
}
```

### Exemple : Case "DRINK_2" de Schmitt

**Configuration JSON** :
```json
{
  "id": "drink_2",
  "name": "BUVEZ 2 GORGÉES",
  "conditions": [
    {
      "type": "OnPlayerLandsOn",
      "params": { "tileId": 3 }
    }
  ],
  "effects": [
    {
      "type": "AddDrinks",
      "params": { "amount": 2, "target": "current_player" }
    }
  ]
}
```

**Code TypeScript équivalent** :
```typescript
// games/schmitt-odyssee/rules/tile-effects.ts
export const DRINK_2_RULE: Rule = {
  id: 'drink_2',
  name: 'BUVEZ 2 GORGÉES',
  conditions: [
    new OnPlayerLandsOnCondition({ tileId: 3 })
  ],
  effects: [
    new AddDrinksEffect({ amount: 2, target: 'current_player' })
  ],
  priority: 100
};
```

### Exemple : Règle Complexe (Faveur d'Aphrodite)

**Code TypeScript** (règle trop complexe pour JSON) :
```typescript
// games/schmitt-odyssee/rules/god-favors.ts
export class AphroditeRule extends Rule {
  constructor() {
    super({
      id: 'aphrodite',
      name: 'Aphrodite - Deux adversaires font un bisou',
      conditions: [
        new GodFavorRolledCondition({ sum: 5 })
      ],
      effects: [], // Custom logic
      priority: 200
    });
  }

  async execute(context: GameContext): Promise<void> {
    const [dice1, dice2] = context.diceResults;

    // Sélection de 2 adversaires
    const opponents = await context.ui.selectPlayers({
      count: 2,
      exclude: context.currentPlayer,
      message: 'Choisissez 2 adversaires pour le bisou'
    });

    // Déplacements
    opponents[0].move(dice1.value);
    opponents[1].move(dice2.value);

    // Notification
    context.ui.showNotification(
      `💋 ${opponents[0].name} et ${opponents[1].name} font un bisou !`
    );
  }
}
```

---

## 📝 Exemple de Définition de Jeu (JSON)

### Schmitt Odyssée

```json
{
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

  "board": {
    "layout": "serpentine",
    "tiles": [
      { "id": 0, "type": "start", "name": "START", "icon": "🏁" },
      { "id": 1, "type": "everyone_drinks", "name": "TOURNÉE", "icon": "🍻" },
      { "id": 2, "type": "forward_2", "name": "AVANCEZ", "icon": "⏩" },
      { "id": 3, "type": "drink_2", "name": "BUVEZ 2", "icon": "🍺" }
      // ... 19 autres cases
    ]
  },

  "rules": [
    { "file": "rules/tile-effects.json" },
    { "file": "rules/god-favors.ts" }
  ],

  "victory": {
    "type": "reach_position",
    "params": { "position": 22 }
  },

  "resources": [
    { "id": "drinks", "name": "Gorgées", "icon": "🍺", "initial": 0 }
  ]
}
```

### Dominion (Jeu de Cartes)

```json
{
  "id": "dominion",
  "name": "Dominion",
  "version": "1.0.0",
  "type": "deck-building",

  "settings": {
    "minPlayers": 2,
    "maxPlayers": 4,
    "hasDice": false
  },

  "cards": {
    "supply": [
      {
        "id": "copper",
        "name": "Cuivre",
        "type": "treasure",
        "cost": 0,
        "value": 1,
        "count": 60
      },
      {
        "id": "village",
        "name": "Village",
        "type": "action",
        "cost": 3,
        "effects": [
          { "type": "DrawCards", "params": { "count": 1 } },
          { "type": "AddActions", "params": { "count": 2 } }
        ],
        "count": 10
      }
    ]
  },

  "rules": [
    { "file": "rules/turn-structure.json" },
    { "file": "rules/card-effects.ts" }
  ],

  "victory": {
    "type": "most_points",
    "params": { "resource": "victory_points" }
  }
}
```

---

## 🔄 Workflow : Créer un Nouveau Jeu

### Étape 1 : Créer la Définition (30 min)

```bash
# Créer le dossier du jeu
mkdir -p src/games/mon-jeu-custom

# Créer la config
cat > src/games/mon-jeu-custom/game.json << 'EOF'
{
  "id": "mon-jeu-custom",
  "name": "Mon Jeu Custom",
  "type": "linear-board",
  "settings": { ... },
  "board": { ... },
  "rules": [ ... ]
}
EOF
```

### Étape 2 : Définir les Règles Simples (JSON)

```json
// src/games/mon-jeu-custom/rules/basic-rules.json
[
  {
    "id": "win_game",
    "conditions": [
      { "type": "PlayerAt", "params": { "position": 20 } }
    ],
    "effects": [
      { "type": "DeclareWinner", "params": { "player": "current" } }
    ]
  },
  {
    "id": "lose_turn",
    "conditions": [
      { "type": "PlayerAt", "params": { "position": 10 } }
    ],
    "effects": [
      { "type": "SkipTurns", "params": { "count": 1 } }
    ]
  }
]
```

### Étape 3 : Implémenter les Règles Complexes (TypeScript)

```typescript
// src/games/mon-jeu-custom/rules/special-effects.ts
import { Rule, GameContext } from '@domain/rules';

export class TeleportRule extends Rule {
  constructor() {
    super({
      id: 'teleport',
      name: 'Téléportation',
      conditions: [
        new OnPlayerLandsOnCondition({ tileId: 15 })
      ]
    });
  }

  async execute(context: GameContext): Promise<void> {
    const targetTile = await context.ui.selectTile({
      message: 'Choisissez une case de destination'
    });

    context.currentPlayer.teleportTo(targetTile.id);
    context.ui.showNotification(`✨ Téléportation vers ${targetTile.name}!`);
  }
}

export const SPECIAL_RULES = [
  new TeleportRule(),
  // ... autres règles
];
```

### Étape 4 : Lancer le Jeu (10 min)

```typescript
// Charger et démarrer
const gameEngine = new GameEngine();
await gameEngine.loadGame('mon-jeu-custom');
await gameEngine.startGame(['Alice', 'Bob']);

// Le moteur gère tout automatiquement !
```

---

## 🏗️ Plan de Migration (Phases)

### Phase 1 : Fondations du Moteur (4 semaines)

**Objectif** : Créer le Domain Layer avec système de règles générique

**Livrables** :
- ✅ Entités de base (Game, Player, Board, Tile, Card)
- ✅ Système de règles (Rule, Condition, Effect, RuleEngine)
- ✅ GameDefinition (chargeur JSON)
- ✅ Tests unitaires (80%+ coverage)

**Fichiers créés** :
- `src/domain/entities/*.ts` (~15 fichiers)
- `src/domain/rules/*.ts` (~8 fichiers)
- `src/domain/definitions/*.ts` (~5 fichiers)

### Phase 2 : Application Layer (3 semaines)

**Objectif** : Créer les Use Cases et Services

**Livrables** :
- ✅ 6 Use Cases principaux
- ✅ TurnManager, EventBus, VictoryEvaluator
- ✅ ActionValidator
- ✅ Tests d'intégration

**Fichiers créés** :
- `src/application/use-cases/*.ts` (~7 fichiers)
- `src/application/services/*.ts` (~4 fichiers)

### Phase 3 : Migration Schmitt (3 semaines)

**Objectif** : Migrer Schmitt Odyssée sur le nouveau moteur

**Livrables** :
- ✅ `src/games/schmitt-odyssee/game.json`
- ✅ Toutes les règles (tile effects, god favors)
- ✅ Schmitt fonctionne avec le moteur
- ✅ Zero régression

**Workflow** :
1. Créer `game.json`
2. Convertir les 23 cases en règles
3. Migrer les 12 faveurs des dieux
4. Tester E2E

### Phase 4 : Infrastructure + Presentation (2 semaines)

**Objectif** : Repositories et Renderers

**Livrables** :
- ✅ LocalStorageRepository
- ✅ JsonGameDefinitionRepository
- ✅ Renderers modulaires (Canvas2D, CSS3D, Camera)
- ✅ GameController léger

**Résultat** :
- `main-camera.ts` : 1350L → ~100L
- Code réutilisable pour tous les jeux

### Phase 5 : Nouveaux Jeux (2 semaines)

**Objectif** : Valider le moteur avec de nouveaux jeux

**Livrables** :
- ✅ Jeu de l'Oie (simple, validation rapide)
- ✅ Schmitt Valhalla (similaire à Odyssée)
- ✅ Début Dominion (jeu de cartes, validation règles complexes)

**Workflow** :
- Chaque jeu = 1 fichier `game.json` + règles
- Temps par jeu : **2-3 jours** au lieu de 2 semaines !

### Phase 6 : Éditeur Visuel (3 semaines)

**Objectif** : Interface pour créer des jeux sans coder

**Livrables** :
- ✅ Éditeur de plateau (drag & drop)
- ✅ Éditeur de règles (UI pour conditions/effets)
- ✅ Export JSON
- ✅ Preview en temps réel

---

## 📊 Métriques de Succès

| Métrique | Avant | Après |
|----------|-------|-------|
| Temps pour créer un jeu | 2 mois | **2-3 jours** |
| Lignes de code par jeu | ~2000L | **~200L** (config + règles) |
| Code dupliqué | 40% | <5% |
| Testabilité | Impossible | 80%+ coverage |
| Support multi-plateforme | Manuel | Automatique |

---

## 🎯 Exemple Concret : Ajouter un Nouveau Jeu

### Schmitt Valhalla (inspiré du lien)

```json
// src/games/schmitt-valhalla/game.json
{
  "id": "schmitt-valhalla",
  "name": "Schmitt Valhalla",
  "type": "linear-board",
  "settings": {
    "minPlayers": 2,
    "maxPlayers": 8,
    "boardSize": 30,
    "theme": "viking"
  },
  "board": {
    "layout": "serpentine",
    "tiles": [
      { "id": 0, "type": "start", "name": "ASGARD", "icon": "⚔️" },
      { "id": 5, "type": "odin_blessing", "name": "BÉNÉDICTION ODIN", "icon": "👁️" },
      { "id": 10, "type": "thor_hammer", "name": "MARTEAU DE THOR", "icon": "🔨" },
      { "id": 15, "type": "loki_trick", "name": "RUSE DE LOKI", "icon": "🎭" },
      { "id": 29, "type": "finish", "name": "VALHALLA", "icon": "🏆" }
    ]
  },
  "rules": [
    { "file": "rules/norse-effects.ts" }
  ],
  "resources": [
    { "id": "mead", "name": "Hydromel", "icon": "🍯" },
    { "id": "glory", "name": "Gloire", "icon": "⭐" }
  ]
}
```

**Temps de développement** : 1-2 jours au lieu de 1 mois !

---

## 🚀 Prochaines Étapes

1. **Valider ce plan** avec vous (30 min)
2. **Créer un POC** sur 1 Use Case simple (1 jour)
3. **Démarrer Phase 1** : Fondations du Domain (4 semaines)

**Timeline totale** : **3 mois** pour un moteur complet et robuste

---

**Questions ?**
- Voulez-vous commencer par Phase 1 dès maintenant ?
- Y a-t-il des règles spécifiques de Schmitt Valhalla à prioriser ?
- Préférez-vous un POC sur Schmitt Odyssée d'abord ?
