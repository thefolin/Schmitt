import { Condition, ConditionFactory } from './Condition';
import { Effect, EffectFactory } from './Effect';
import { GameContext } from './GameContext';

/**
 * Rule (Règle du jeu)
 * Pattern Specification : Rule = Conditions AND Effects
 */
export class Rule {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly conditions: Condition[],
    public readonly effects: Effect[],
    public readonly priority: number = 100
  ) {}

  /**
   * Vérifie si toutes les conditions sont remplies
   */
  canApply(context: GameContext): boolean {
    return this.conditions.every(condition => condition.evaluate(context));
  }

  /**
   * Exécute tous les effets de la règle
   */
  async apply(context: GameContext): Promise<void> {
    if (!this.canApply(context)) {
      throw new Error(`Rule ${this.id} conditions not met`);
    }

    for (const effect of this.effects) {
      await effect.execute(context);
    }
  }

  /**
   * Crée une règle depuis JSON
   */
  static fromJSON(data: any): Rule {
    const conditions = data.conditions.map((c: any) => ConditionFactory.fromJSON(c));
    const effects = data.effects.map((e: any) => EffectFactory.fromJSON(e));

    return new Rule(
      data.id,
      data.name,
      conditions,
      effects,
      data.priority ?? 100
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      conditions: this.conditions.map(c => ({ type: c.type, params: c.params })),
      effects: this.effects.map(e => ({ type: e.type, params: e.params })),
      priority: this.priority
    };
  }
}
