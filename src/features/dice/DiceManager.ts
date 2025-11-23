/**
 * Gestionnaire de dés
 * Gère plusieurs dés et leurs interactions
 */

import { Dice3D, type DiceType, type DiceFallEvent } from './Dice3D';
import {
  DEFAULT_DICE_CONFIG,
  DEFAULT_VISUAL_CONFIG,
  GOD_POWER_VISUAL_CONFIG,
  type DicePhysicsConfig,
  type DiceVisualConfig
} from './DiceConfig';
import type { TableBounds, TableBorderConfig } from '../board/camera/table.config';

export interface DiceRollResult {
  normalDice?: number;
  godPowerDice?: number;
  total: number;
}

export class DiceManager {
  private container: HTMLElement;
  private worldContainer: HTMLElement | null = null;
  private normalDice: Dice3D | null = null;
  private godPowerDice: Dice3D | null = null;
  private physicsConfig: DicePhysicsConfig;

  // Stocker les callbacks pour les appliquer aux dés créés plus tard
  private onDiceRollEndCallback: ((result: number, diceType: 'normal' | 'godPower') => void) | null = null;
  private onDiceFallCallback: ((event: DiceFallEvent) => void) | null = null;
  private tableBounds: TableBounds | null = null;
  private tableBorders: TableBorderConfig | null = null;

  constructor(containerId: string, customPhysicsConfig?: Partial<DicePhysicsConfig>) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this.container = container;

    // Trouver le world container (où sont les cases du plateau)
    this.worldContainer = container.querySelector('.board-camera-world');
    if (!this.worldContainer) {
      console.warn('World container not found, dice will be attached to main container');
      this.worldContainer = container;
    }

    this.physicsConfig = { ...DEFAULT_DICE_CONFIG, ...customPhysicsConfig };

    this.init();
  }

  /**
   * Initialise le gestionnaire
   */
  private init(): void {
    // Créer le dé normal à une position initiale temporaire
    // La vraie position sera calculée après que la table soit configurée
    const initialX = 400;
    const initialY = 400;

    this.normalDice = new Dice3D(
      this.worldContainer!,
      'normal',
      this.physicsConfig,
      DEFAULT_VISUAL_CONFIG,
      { x: initialX, y: initialY }
    );

    // Le dé des pouvoirs des dieux sera créé à la demande
  }

  /**
   * Positionne le(s) dé(s) au centre de la table
   */
  public positionDiceInTable(tableBounds: TableBounds): void {
    if (!this.normalDice) return;

    // Calculer le centre de la table
    const centerX = (tableBounds.minX + tableBounds.maxX) / 2;
    const centerY = (tableBounds.minY + tableBounds.maxY) / 2;

    console.log('🎲 Positionnement du/des dé(s) au centre de la table:', { centerX, centerY });

    // Si les deux dés sont visibles, les positionner côte à côte
    if (this.godPowerDice && this.godPowerDice.isVisible()) {
      // Espacer les dés de 80px
      const spacing = 80;
      this.normalDice.setPosition(centerX - spacing / 2, centerY);
      this.godPowerDice.setPosition(centerX + spacing / 2, centerY);
    } else {
      // Sinon, centrer le dé normal uniquement
      this.normalDice.setPosition(centerX, centerY);
    }
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
      // Positionner à côté du dé normal dans le world
      const leftX = 120;
      const bottomY = 200;

      this.godPowerDice = new Dice3D(
        this.worldContainer!,
        'godPower',
        this.physicsConfig,
        GOD_POWER_VISUAL_CONFIG,
        { x: leftX, y: bottomY }
      );
    }

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
   * Affiche les deux dés (normal + pouvoir des dieux)
   */
  public showBothDice(): void {
    // Créer le dé des pouvoirs s'il n'existe pas
    if (!this.godPowerDice && this.worldContainer) {
      // Positionner à côté du dé normal
      const leftX = 120;
      const bottomY = 200;

      this.godPowerDice = new Dice3D(
        this.worldContainer,
        'godPower',
        this.physicsConfig,
        GOD_POWER_VISUAL_CONFIG,
        { x: leftX, y: bottomY }
      );

      // Appliquer les callbacks stockés au nouveau dé
      if (this.onDiceRollEndCallback) {
        this.godPowerDice.setOnRollEnd((result) => this.onDiceRollEndCallback!(result, 'godPower'));
      }
      if (this.onDiceFallCallback) {
        this.godPowerDice.setOnFall(this.onDiceFallCallback);
      }
      if (this.tableBounds && this.tableBorders) {
        this.godPowerDice.setTableBounds(this.tableBounds, this.tableBorders);
      }
    }

    this.normalDice?.show();
    this.godPowerDice?.show();
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
   * Définit le callback appelé quand un dé tombe hors de la table
   */
  public setOnDiceFall(callback: (event: DiceFallEvent) => void): void {
    this.onDiceFallCallback = callback;
    this.normalDice?.setOnFall(callback);
    this.godPowerDice?.setOnFall(callback);
  }

  /**
   * Définit le callback appelé quand un dé s'arrête de rouler
   */
  public setOnDiceRollEnd(callback: (result: number, diceType: 'normal' | 'godPower') => void): void {
    this.onDiceRollEndCallback = callback;
    this.normalDice?.setOnRollEnd((result) => callback(result, 'normal'));
    this.godPowerDice?.setOnRollEnd((result) => callback(result, 'godPower'));
  }

  /**
   * Configure les limites de la table pour la détection de chute
   */
  public setTableBounds(bounds: TableBounds, borders: TableBorderConfig): void {
    this.tableBounds = bounds;
    this.tableBorders = borders;
    this.normalDice?.setTableBounds(bounds, borders);
    this.godPowerDice?.setTableBounds(bounds, borders);
  }

  /**
   * Réinitialise l'état de chute des dés
   */
  public resetDiceFall(): void {
    this.normalDice?.resetFall();
    this.godPowerDice?.resetFall();
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
   * Obtient la position du dé normal dans le world
   */
  public getNormalDicePosition(): { x: number; y: number } | null {
    if (!this.normalDice) return null;
    const state = this.normalDice.getValue();
    // On retourne une position approximative basée sur la config initiale
    return { x: 200, y: 200 };
  }

  /**
   * Nettoie les ressources
   */
  public destroy(): void {
    this.normalDice?.destroy();
    this.godPowerDice?.destroy();
  }
}
