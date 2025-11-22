/**
 * Point d'entrée du module Dice
 * Exporte toutes les classes et configurations nécessaires
 */

export { Dice3D, type DiceType } from './Dice3D';
export { DicePhysics, type Vector2D, type DiceState } from './DicePhysics';
export { DiceManager, type DiceRollResult } from './DiceManager';
export {
  DEFAULT_DICE_CONFIG,
  DEFAULT_VISUAL_CONFIG,
  GOD_POWER_VISUAL_CONFIG,
  THROW_PRESETS,
  type DicePhysicsConfig,
  type DiceVisualConfig
} from './DiceConfig';
