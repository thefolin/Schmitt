# 🏗️ Application Layer - Architecture en Oignon

## ✅ Phase 2 Complétée

L'Application Layer orchestre la logique métier du Domain Layer. Elle agit comme un pont entre le domaine pur et les couches externes (Infrastructure, Presentation).

---

## 📂 Structure Créée

```
src/application/
├── dto/                    # Data Transfer Objects
│   └── GameDTO.ts         # DTOs pour l'interface
├── services/              # Services applicatifs
│   ├── EventBus.ts       # Pub/Sub pour événements
│   └── TurnManager.ts    # Gestion du flux des tours
├── use-cases/            # Cas d'utilisation
│   ├── StartGameUseCase.ts      # Démarrer une partie
│   └── ExecuteActionUseCase.ts  # Exécuter une action
└── poc-application.ts    # POC pour tester la couche
```

---

## 🎯 Composants

### 1. DTOs (Data Transfer Objects)

**Fichier**: [GameDTO.ts](../src/application/dto/GameDTO.ts)

Les DTOs convertissent les entités Domain en objets simples pour les couches externes.

```typescript
interface GameStateDTO {
  id: string;
  gameDefinitionId: string;
  phase: string;
  turnNumber: number;
  currentPlayerIndex: number;
  players: PlayerDTO[];
  board: { size: number; tiles: TileDTO[] };
}
```

**Pourquoi ?**
- ✅ Découplage : Les couches externes ne dépendent pas des entités Domain
- ✅ Sérialisation : Facile à envoyer en JSON (API, localStorage)
- ✅ Stabilité : Les changements internes du Domain n'affectent pas l'interface

---

### 2. EventBus (Service)

**Fichier**: [EventBus.ts](../src/application/services/EventBus.ts)

Système Pub/Sub pour la communication découplée entre composants.

```typescript
const eventBus = new EventBus();

// S'abonner à un événement
eventBus.subscribe('TURN_STARTED', (event) => {
  console.log(`Tour ${event.data.turnNumber} démarré`);
});

// S'abonner à TOUS les événements
eventBus.subscribeAll((event) => {
  console.log(`[${event.type}] ${JSON.stringify(event.data)}`);
});

// Publier un événement
await eventBus.publish({
  type: 'TURN_STARTED',
  timestamp: Date.now(),
  data: { turnNumber: 1 }
});
```

**Événements émis** :
- `GAME_CREATED` : Partie créée
- `GAME_STARTED` : Partie démarrée
- `TURN_STARTED` : Tour démarré
- `TURN_ENDED` : Tour terminé
- `ACTION_*` : Action exécutée (ROLL_DICE, MOVE_PLAYER, etc.)
- `PLAYER_MOVED` : Joueur déplacé
- `RULE_APPLIED` : Règle appliquée

**Avantages** :
- ✅ Découplage : Les composants communiquent sans se connaître
- ✅ Extensibilité : Facile d'ajouter des listeners (UI, audio, analytics)
- ✅ Traçabilité : Tous les événements peuvent être loggés/audités

---

### 3. TurnManager (Service)

**Fichier**: [TurnManager.ts](../src/application/services/TurnManager.ts)

Gère le flux des tours : START → ACTION → EFFECT → END

```typescript
const turnManager = new TurnManager(game, ruleEngine, eventBus);

// Flux complet d'un tour avec dé
const events = await turnManager.executeDiceTurn(6);

// Ou étape par étape
await turnManager.startTurn();
await turnManager.executePlayerAction('ROLL_DICE', { diceResult: 6 });
await turnManager.applyRules({ diceRoll: 6 });
await turnManager.endTurn();
```

**Phases d'un tour** :
1. **START** : Début du tour, événement `TURN_STARTED`
2. **ACTION** : Action du joueur (lancer dé, utiliser faveur)
3. **EFFECT** : Application des règles de la case
4. **END** : Fin du tour, passage au joueur suivant

**Avantages** :
- ✅ Centralisation : Toute la logique de tour au même endroit
- ✅ Cohérence : Garantit que les étapes sont toujours respectées
- ✅ Réutilisabilité : Utilisable par tous les Use Cases

---

### 4. Use Cases

#### StartGameUseCase

**Fichier**: [StartGameUseCase.ts](../src/application/use-cases/StartGameUseCase.ts)

Orchestre la création et le démarrage d'une partie.

```typescript
const startGameUseCase = new StartGameUseCase(eventBus);

const result = await startGameUseCase.execute(gameDefinition, {
  gameDefinitionId: 'schmitt-odyssee',
  players: [
    { id: 'p1', name: 'Alice', color: '#FF6B6B' },
    { id: 'p2', name: 'Bob', color: '#4ECDC4' }
  ]
});

if (result.success) {
  console.log(result.gameState); // GameStateDTO
}
```

**Flux** :
1. Créer l'entité `Game`
2. Ajouter les joueurs
3. Créer le plateau
4. Charger les règles
5. Démarrer le jeu
6. Initialiser le premier tour
7. Retourner le `GameStateDTO`

---

#### ExecuteActionUseCase

**Fichier**: [ExecuteActionUseCase.ts](../src/application/use-cases/ExecuteActionUseCase.ts)

Gère les actions des joueurs.

```typescript
const executeActionUseCase = new ExecuteActionUseCase(eventBus);

const result = await executeActionUseCase.execute(game, ruleEngine, {
  type: 'ROLL_DICE',
  playerId: 'p1',
  payload: { diceResult: 6 }
});

if (result.success) {
  console.log(`${result.events.length} événements générés`);
  console.log(result.gameState); // État mis à jour
}
```

**Actions supportées** :
- `ROLL_DICE` : Lancer le dé (flux complet avec TurnManager)
- `MOVE_PLAYER` : Déplacer manuellement un joueur
- `USE_POWER` : Utiliser une faveur des dieux
- `END_TURN` : Terminer le tour manuellement
- `CUSTOM` : Action personnalisée

**Avantages** :
- ✅ Validation : Vérifie que c'est le bon joueur
- ✅ Traçabilité : Retourne tous les événements générés
- ✅ Gestion d'erreurs : Retourne success + errors

---

## 🧪 Tester l'Application Layer

### Interface Web

```bash
npm run dev
```

Ouvrir [http://localhost:3000/index-poc-application.html](http://localhost:3000/index-poc-application.html)

Cliquer sur **"▶️ Lancer le POC Application Layer"**

### Sortie Attendue

```
🎮 POC - Application Layer

📡 Création de l'EventBus...
✅ EventBus créé et écouteurs enregistrés

📋 Chargement de la définition de jeu...
✅ Schmitt Odyssée v1.0.0 chargé

🚀 Utilisation de StartGameUseCase...
   📢 [GAME_CREATED] {...}
   📢 [GAME_STARTED] {...}
   📢 [TURN_STARTED] {...}
✅ Partie Schmitt Odyssée démarrée avec 2 joueurs
   • ID: game_123...
   • Phase: PLAYING
   • Joueurs: Alice, Bob
   • Plateau: 7 cases

========== ACTIONS ==========

🎲 Action 1 - Alice lance le dé...
   📢 [ACTION_ROLL_DICE] {...}
   📢 [PLAYER_MOVED] {...}
   📢 [RULE_APPLIED] {...}
✅ Action réussie, 5 événements générés
   🍺 Alice: 2 gorgée(s)

🎲 Action 2 - Bob lance le dé...
   📢 [ACTION_ROLL_DICE] {...}
   📢 [PLAYER_MOVED] {...}
   📢 [RULE_APPLIED] {...}
✅ Action réussie, 5 événements générés
   🍺 Alice: 3 gorgée(s)
   🍺 Bob: 1 gorgée(s)

========== RÉSUMÉ ==========

📊 État final de l'Application Layer:
   • EventBus: 1 handler(s)
   • StartGameUseCase: ✅ Testé
   • ExecuteActionUseCase: ✅ Testé
   • TurnManager: ✅ Testé (via ExecuteAction)

✅ POC Application Layer réussi ! 🎉
```

---

## 🎓 Patterns Utilisés

### 1. Use Case Pattern
Chaque cas d'utilisation métier = 1 classe dédiée

**Avantages** :
- ✅ Single Responsibility Principle
- ✅ Testabilité (mock facile)
- ✅ Clarté du code (1 fichier = 1 fonctionnalité)

### 2. DTO Pattern
Objets simples pour transfert de données

**Avantages** :
- ✅ Découplage Domain ↔ Présentation
- ✅ Sérialisation facile (JSON)
- ✅ Validation d'interface

### 3. Pub/Sub Pattern (EventBus)
Communication découplée par événements

**Avantages** :
- ✅ Extensibilité (nouveaux listeners sans modifier le code)
- ✅ Traçabilité (audit log)
- ✅ Découplage (composants indépendants)

### 4. Service Pattern
Services réutilisables pour orchestration

**Avantages** :
- ✅ Réutilisation (même service dans plusieurs Use Cases)
- ✅ Centralisation de la logique complexe
- ✅ Testabilité

---

## 📊 Flux de Données

```
User Action (UI)
      ↓
Use Case (ExecuteActionUseCase)
      ↓
Service (TurnManager)
      ↓
Domain Entities (Game, Player, Rules)
      ↓
EventBus → publish events
      ↓
DTO Conversion
      ↓
Return to UI (GameStateDTO)
```

---

## 🚀 Prochaines Étapes

### Phase 3 : Migration Complète de Schmitt Odyssée
- [ ] Migrer les 23 cases
- [ ] Migrer les 12 faveurs des dieux
- [ ] Créer les règles complexes en TypeScript
- [ ] Tester le jeu complet

### Phase 4 : Infrastructure + Presentation
- [ ] GameRepository (localStorage, IndexedDB)
- [ ] API Adapters (si backend)
- [ ] Renderers (Canvas2D, CSS3D)
- [ ] GameController (UI → Use Cases)

### Phase 5 : Nouveaux Jeux
- [ ] Schmitt Valhalla
- [ ] Jeu de l'Oie générique
- [ ] Dominion-like deck builder

---

## 📚 Fichiers Importants

| Fichier | Description |
|---------|-------------|
| [GameDTO.ts](../src/application/dto/GameDTO.ts) | DTOs pour transfert de données |
| [EventBus.ts](../src/application/services/EventBus.ts) | Système Pub/Sub |
| [TurnManager.ts](../src/application/services/TurnManager.ts) | Gestion du flux des tours |
| [StartGameUseCase.ts](../src/application/use-cases/StartGameUseCase.ts) | Démarrer une partie |
| [ExecuteActionUseCase.ts](../src/application/use-cases/ExecuteActionUseCase.ts) | Exécuter une action |
| [poc-application.ts](../src/application/poc-application.ts) | POC pour tester |

---

**Phase 2 Application Layer : ✅ Complétée !**

Vous avez maintenant un système d'orchestration complet pour votre moteur de jeu. 🎉
