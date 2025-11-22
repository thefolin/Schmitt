/**
 * Gestionnaire de dés
 * Gère plusieurs dés et leurs interactions
 */

import { Dice3D, type DiceType } from './Dice3D';
import {
  DEFAULT_DICE_CONFIG,
  DEFAULT_VISUAL_CONFIG,
  GOD_POWER_VISUAL_CONFIG,
  type DicePhysicsConfig,
  type DiceVisualConfig
} from './DiceConfig';

export interface DiceRollResult {
  normalDice?: number;
  godPowerDice?: number;
  total: number;
}

export class DiceManager {
  private container: HTMLElement;
  private normalDice: Dice3D | null = null;
  private godPowerDice: Dice3D | null = null;
  private physicsConfig: DicePhysicsConfig;

  constructor(containerId: string, customPhysicsConfig?: Partial<DicePhysicsConfig>) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this.container = container;
    this.physicsConfig = { ...DEFAULT_DICE_CONFIG, ...customPhysicsConfig };

    this.init();
  }

  /**
   * Initialise le gestionnaire
   */
  private init(): void {
    // Créer le dé normal au centre-bas de l'écran
    const centerX = this.container.clientWidth / 2;
    const bottomY = this.container.clientHeight - 150;

    this.normalDice = new Dice3D(
      this.container,
      'normal',
      this.physicsConfig,
      DEFAULT_VISUAL_CONFIG,
      { x: centerX, y: bottomY }
    );

    // Le dé des pouvoirs des dieux sera créé à la demande
  }

  /**
   * Lance le dé normal
   */
  public async rollNormalDice(targetValue?: number): Promise<number> {
    if (!this.normalDice) return 1;

    // Cacher le dé des pouvoirs si visible
    if (this.godPowerDice) {
      this.godPowerDice.hide();
    }

    this.normalDice.show();
    return await this.normalDice.roll(targetValue);
  }

  /**
   * Lance les deux dés (normal + pouvoir des dieux)
   */
  public async rollBothDice(
    normalTarget?: number,
    godPowerTarget?: number
  ): Promise<DiceRollResult> {
    // Créer le dé des pouvoirs s'il n'existe pas
    if (!this.godPowerDice) {
      const leftX = this.container.clientWidth / 2 - 80;
      const bottomY = this.container.clientHeight - 150;

      this.godPowerDice = new Dice3D(
        this.container,
        'godPower',
        this.physicsConfig,
        GOD_POWER_VISUAL_CONFIG,
        { x: leftX, y: bottomY }
      );
    }

    // Repositionner le dé normal à droite
    const rightX = this.container.clientWidth / 2 + 80;
    const bottomY = this.container.clientHeight - 150;

    // Afficher les deux dés
    this.normalDice?.show();
    this.godPowerDice.show();

    // Lancer les deux dés en parallèle
    const [normalValue, godPowerValue] = await Promise.all([
      this.normalDice?.roll(normalTarget) || Promise.resolve(1),
      this.godPowerDice.roll(godPowerTarget)
    ]);

    return {
      normalDice: normalValue,
      godPowerDice: godPowerValue,
      total: normalValue + godPowerValue
    };
  }

  /**
   * Cache tous les dés
   */
  public hideAll(): void {
    this.normalDice?.hide();
    this.godPowerDice?.hide();
  }

  /**
   * Affiche le dé normal
   */
  public showNormalDice(): void {
    this.normalDice?.show();
    this.godPowerDice?.hide();
  }

  /**
   * Définit le callback appelé lors du clic sur le dé normal
   */
  public setNormalDiceOnClick(callback: () => void): void {
    this.normalDice?.setOnClick(callback);
  }

  /**
   * Définit le callback appelé lors du clic sur le dé des pouvoirs
   */
  public setGodPowerDiceOnClick(callback: () => void): void {
    this.godPowerDice?.setOnClick(callback);
  }

  /**
   * Met à jour la configuration physique
   */
  public updatePhysicsConfig(config: Partial<DicePhysicsConfig>): void {
    this.physicsConfig = { ...this.physicsConfig, ...config };
    // Note: Les dés existants garderont leur ancienne config
    // Pour appliquer la nouvelle config, il faudrait les recréer
  }

  /**
   * Vérifie si des dés sont en mouvement
   */
  public isAnyDiceRolling(): boolean {
    return (
      (this.normalDice?.isRolling() || false) ||
      (this.godPowerDice?.isRolling() || false)
    );
  }

  /**
   * Nettoie les ressources
   */
  public destroy(): void {
    this.normalDice?.destroy();
    this.godPowerDice?.destroy();
  }
}
