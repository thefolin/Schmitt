import { Rule } from './Rule';
import { GameContext } from './GameContext';

/**
 * RuleEngine (Moteur de règles)
 * Gère l'enregistrement et l'exécution des règles
 */
export class RuleEngine {
  private rules: Map<string, Rule> = new Map();

  /**
   * Enregistre une règle
   */
  registerRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Enregistre plusieurs règles
   */
  registerRules(rules: Rule[]): void {
    rules.forEach(rule => this.registerRule(rule));
  }

  /**
   * Récupère une règle par ID
   */
  getRule(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Récupère toutes les règles
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Trouve toutes les règles applicables dans le contexte donné
   */
  findApplicableRules(context: GameContext): Rule[] {
    return this.getAllRules()
      .filter(rule => rule.canApply(context))
      .sort((a, b) => b.priority - a.priority); // Ordre de priorité décroissant
  }

  /**
   * Exécute toutes les règles applicables
   */
  async executeApplicableRules(context: GameContext): Promise<Rule[]> {
    const applicableRules = this.findApplicableRules(context);

    for (const rule of applicableRules) {
      await rule.apply(context);
    }

    return applicableRules;
  }

  /**
   * Exécute une règle spécifique par ID
   */
  async executeRule(ruleId: string, context: GameContext): Promise<void> {
    const rule = this.getRule(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    await rule.apply(context);
  }

  /**
   * Vide toutes les règles
   */
  clear(): void {
    this.rules.clear();
  }
}
