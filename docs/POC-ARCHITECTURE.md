# 🎮 POC - Architecture en Oignon (Clean Architecture)

## ✅ Ce qui a été créé

### Domain Layer (Logique Métier Pure)

#### Entités
- **[Game.ts](../src/domain/entities/Game.ts)** : Agrégat racine, représente une partie
- **[Player.ts](../src/domain/entities/Player.ts)** : Joueur avec position et ressources
- **[Board.ts](../src/domain/entities/Board.ts)** : Plateau de jeu
- **[Tile.ts](../src/domain/entities/Tile.ts)** : Case/Espace du jeu

#### Value Objects
- **[Position.ts](../src/domain/value-objects/Position.ts)** : Position (linéaire ou coordonnées)
- **[GamePhase.ts](../src/domain/value-objects/GamePhase.ts)** : Phase du jeu (SETUP, PLAYING, etc.)

#### Système de Règles
- **[Rule.ts](../src/domain/rules/Rule.ts)** : Règle = Conditions + Effets
- **[Condition.ts](../src/domain/rules/Condition.ts)** : Conditions (quand une règle s'applique)
- **[Effect.ts](../src/domain/rules/Effect.ts)** : Effets (actions de la règle)
- **[RuleEngine.ts](../src/domain/rules/RuleEngine.ts)** : Moteur d'exécution des règles
- **[GameContext.ts](../src/domain/rules/GameContext.ts)** : Contexte d'exécution

#### Définitions
- **[GameDefinition.ts](../src/domain/definitions/GameDefinition.ts)** : Chargeur de configuration JSON

### Configuration de Jeu

- **[game.json](../src/games/schmitt-odyssee/game.json)** : Configuration Schmitt Odyssée
  - 7 cases configurées
  - 3 règles simples (JSON)

### POC

- **[poc.ts](../src/domain/poc.ts)** : Démonstration du moteur
- **[index-poc.html](../index-poc.html)** : Interface web pour tester le POC

---

## 🚀 Tester le POC

### Option 1 : Interface Web (Recommandé)

```bash
# Démarrer le serveur de développement
npm run dev

# Ouvrir dans le navigateur
open http://localhost:3000/index-poc.html
```

Cliquez sur **"▶️ Lancer le POC"** pour voir la simulation.

### Option 2 : Console

```bash
# Compiler et exécuter
npx ts-node src/domain/poc.ts
```

---

## 📋 Ce que fait le POC

Le POC simule une partie de Schmitt Odyssée :

1. **Charge la configuration** depuis `game.json`
2. **Crée une partie** avec 2 joueurs (Alice, Bob)
3. **Crée le plateau** (7 cases)
4. **Charge les règles** (3 règles JSON)
5. **Simule 3 tours** :
   - Tour 1 : Alice sur case 3 → règle "drink_2" → +2 gorgées
   - Tour 2 : Bob sur case 1 → règle "everyone_drinks" → +1 gorgée pour tous
   - Tour 3 : Alice avance encore
6. **Sauvegarde et restaure** l'état de la partie

### Sortie attendue

```
🎮 POC - Moteur de Jeu Universel

📋 Chargement de Schmitt Odyssée...
✅ Jeu chargé: Schmitt Odyssée v1.0.0

🎲 Création d'une nouvelle partie...
✅ 2 joueurs ajoutés: Alice, Bob

🗺️  Création du plateau...
✅ Plateau créé: 7 cases

📜 Chargement des règles...
✅ 3 règles chargées

🚀 Démarrage de la partie...

========== SIMULATION ==========

🎲 Tour 1 - Alice lance le dé...
   Alice se déplace en position 3
   ✨ 1 règle(s) appliquée(s)
   🍺 Alice a maintenant 2 gorgée(s)

🎲 Tour 2 - Bob lance le dé...
   Bob se déplace en position 1
   ✨ 1 règle(s) appliquée(s)
   🍺 Alice: 3 gorgée(s)
   🍺 Bob: 1 gorgée(s)

========== RÉSUMÉ ==========

📊 État final:
   • Tour: 2
   • Joueur actuel: Alice
   • Alice: position 5, 3 gorgée(s)
   • Bob: position 1, 1 gorgée(s)

✅ POC réussi ! Le moteur fonctionne. 🎉
```

---

## 🎯 Concepts Démontrés

### 1. **Système de Règles Générique**

Les règles sont définies en JSON, pas en code :

```json
{
  "id": "drink_2",
  "name": "Buvez 2 gorgées",
  "conditions": [
    { "type": "OnPlayerLandsOn", "params": { "position": 3 } }
  ],
  "effects": [
    { "type": "AddResource", "params": { "resourceId": "drinks", "amount": 2 } }
  ]
}
```

**Avantages** :
- ✅ Pas besoin de coder pour chaque règle
- ✅ Modifiable par un game designer
- ✅ Testable indépendamment

### 2. **Séparation Domain / Infrastructure**

Le Domain Layer ne dépend de **rien** :
- ❌ Pas de DOM
- ❌ Pas de Canvas
- ❌ Pas de localStorage
- ✅ Juste de la logique pure

**Avantage** : Testable facilement, réutilisable partout.

### 3. **Configuration vs Code**

- **Configuration** (JSON) : Pour les règles simples
- **Code** (TypeScript) : Pour les règles complexes (faveurs des dieux, etc.)

### 4. **Sérialisation / Persistance**

Tous les objets ont des méthodes `toJSON()` et `fromJSON()` :

```typescript
const savedGame = game.toJSON();
const restoredGame = Game.fromJSON(savedGame);
```

**Avantage** : Sauvegarde/Chargement facile.

---

## 🏗️ Prochaines Étapes

### Phase 1 : Domain (Complété ✅)
- ✅ Entités de base
- ✅ Système de règles
- ✅ GameDefinition
- ✅ POC fonctionnel

### Phase 2 : Application Layer (À venir)
- Use Cases (StartGameUseCase, ExecuteActionUseCase)
- Services (TurnManager, EventBus)
- DTOs

### Phase 3 : Migration Schmitt
- Toutes les 23 cases
- Toutes les 12 faveurs des dieux
- Règles complexes en TypeScript

### Phase 4 : Infrastructure + Presentation
- Repositories (LocalStorage, JSON)
- Renderers (Canvas2D, CSS3D, Camera)
- GameController

---

## 📚 Fichiers Importants

| Fichier | Description |
|---------|-------------|
| [src/domain/entities/Game.ts](../src/domain/entities/Game.ts) | Agrégat racine |
| [src/domain/rules/Rule.ts](../src/domain/rules/Rule.ts) | Système de règles |
| [src/domain/rules/RuleEngine.ts](../src/domain/rules/RuleEngine.ts) | Moteur d'exécution |
| [src/domain/definitions/GameDefinition.ts](../src/domain/definitions/GameDefinition.ts) | Loader JSON |
| [src/games/schmitt-odyssee/game.json](../src/games/schmitt-odyssee/game.json) | Config Schmitt |
| [src/domain/poc.ts](../src/domain/poc.ts) | Démonstration |

---

## 🎓 Apprendre Plus

- **Clean Architecture** : [The Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- **Domain-Driven Design** : [DDD Reference](https://www.domainlanguage.com/ddd/reference/)
- **SOLID Principles** : [SOLID](https://en.wikipedia.org/wiki/SOLID)

---

**Le POC est fonctionnel ! Vous pouvez maintenant créer de nouveaux jeux en quelques jours au lieu de mois.** 🚀
