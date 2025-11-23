/**
 * Moteur physique pour les dés
 * Gère les mouvements, rotations, collisions et gravité
 */

import type { DicePhysicsConfig } from './DiceConfig';

export interface Vector2D {
  x: number;
  y: number;
}

export interface DiceState {
  position: Vector2D;
  velocity: Vector2D;
  rotation: Vector2D; // x = rotationX, y = rotationY
  angularVelocity: Vector2D;
  height: number; // Hauteur (axe Z) pour la simulation de chute
  verticalVelocity: number; // Vitesse verticale
  isRolling: boolean;
  currentValue: number;
  hasFallen: boolean; // Indique si le dé est tombé hors de la table
}

export class DicePhysics {
  private state: DiceState;
  private config: DicePhysicsConfig;
  private bounds: { width: number; height: number };
  private tableBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  private tableBorders: { top: boolean; right: boolean; bottom: boolean; left: boolean } | null = null;
  private lastUpdate: number = 0;

  constructor(
    config: DicePhysicsConfig,
    initialPosition: Vector2D,
    bounds: { width: number; height: number }
  ) {
    this.config = config;
    this.bounds = bounds;
    this.state = {
      position: { ...initialPosition },
      velocity: { x: 0, y: 0 },
      rotation: { x: 0, y: 0 },
      angularVelocity: { x: 0, y: 0 },
      height: 0,
      verticalVelocity: 0,
      isRolling: false,
      currentValue: 1,
      hasFallen: false
    };
  }

  /**
   * Lance le dé avec une force aléatoire
   */
  public throw(targetValue?: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = this.randomBetween(this.config.velocityMin, this.config.velocityMax);

    this.state.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };

    this.state.angularVelocity = {
      x: this.randomBetween(this.config.rotationSpeedMin, this.config.rotationSpeedMax) * (Math.random() > 0.5 ? 1 : -1),
      y: this.randomBetween(this.config.rotationSpeedMin, this.config.rotationSpeedMax) * (Math.random() > 0.5 ? 1 : -1)
    };

    // Lancer le dé en l'air
    this.state.height = 100; // Commence à 100px de hauteur
    this.state.verticalVelocity = 0;

    this.state.isRolling = true;
    this.state.currentValue = targetValue || Math.floor(Math.random() * 6) + 1;
    this.lastUpdate = performance.now();
  }

  /**
   * Lance le dé avec une vélocité personnalisée (pour drag-and-drop)
   */
  public throwWithVelocity(velocity: Vector2D, verticalVelocity: number, angularVelocity: Vector2D, targetValue?: number): void {
    this.state.velocity = { ...velocity };
    this.state.angularVelocity = { ...angularVelocity };
    this.state.height = 50;
    this.state.verticalVelocity = verticalVelocity;
    this.state.isRolling = true;
    this.state.hasFallen = false;
    this.state.currentValue = targetValue || Math.floor(Math.random() * 6) + 1;
    this.lastUpdate = performance.now();
  }

  /**
   * Met à jour la physique du dé
   */
  public update(deltaTime: number): DiceState {
    if (!this.state.isRolling) {
      return this.state;
    }

    // Convertir deltaTime en secondes
    const dt = deltaTime / 1000;

    // === PHYSIQUE VERTICALE (hauteur) ===
    // Appliquer la gravité
    this.state.verticalVelocity += this.config.gravity * dt;
    this.state.height -= this.state.verticalVelocity * dt;

    // Rebond sur le sol
    if (this.state.height <= 0) {
      this.state.height = 0;
      this.state.verticalVelocity = -this.state.verticalVelocity * this.config.bounce;

      // Arrêter les petits rebonds
      if (Math.abs(this.state.verticalVelocity) < 50) {
        this.state.verticalVelocity = 0;
        this.state.height = 0;
      }
    }

    // === PHYSIQUE HORIZONTALE ===
    // Appliquer la friction (seulement si au sol)
    if (this.state.height === 0) {
      this.state.velocity.x *= this.config.friction;
      this.state.velocity.y *= this.config.friction;
      this.state.angularVelocity.x *= this.config.friction;
      this.state.angularVelocity.y *= this.config.friction;
    }

    // Mettre à jour la position
    this.state.position.x += this.state.velocity.x * dt;
    this.state.position.y += this.state.velocity.y * dt;

    // Mettre à jour la rotation
    this.state.rotation.x += this.state.angularVelocity.x * dt;
    this.state.rotation.y += this.state.angularVelocity.y * dt;

    // Normaliser les rotations
    this.state.rotation.x = this.state.rotation.x % 360;
    this.state.rotation.y = this.state.rotation.y % 360;

    // Gérer les collisions avec les bords
    this.handleBoundsCollision();

    // Vérifier si le dé doit s'arrêter
    const speed = Math.sqrt(
      this.state.velocity.x ** 2 + this.state.velocity.y ** 2
    );

    if (speed < this.config.stopThreshold && this.state.height === 0) {
      this.stop();
    }

    return this.state;
  }

  /**
   * Gère les collisions avec les bords de la table
   * Si tableBounds est défini, utilise les bordures de la table
   * Sinon utilise les bounds du container
   */
  private handleBoundsCollision(): void {
    const halfSize = this.config.size / 2;

    // Si on a une table configurée, utiliser ses limites
    if (this.tableBounds && this.tableBorders) {
      // Bord gauche
      if (this.tableBorders.left && this.state.position.x - halfSize < this.tableBounds.minX) {
        this.state.position.x = this.tableBounds.minX + halfSize;
        this.state.velocity.x *= -this.config.bounce;
      }

      // Bord droit
      if (this.tableBorders.right && this.state.position.x + halfSize > this.tableBounds.maxX) {
        this.state.position.x = this.tableBounds.maxX - halfSize;
        this.state.velocity.x *= -this.config.bounce;
      }

      // Bord haut
      if (this.tableBorders.top && this.state.position.y - halfSize < this.tableBounds.minY) {
        this.state.position.y = this.tableBounds.minY + halfSize;
        this.state.velocity.y *= -this.config.bounce;
      }

      // Bord bas
      if (this.tableBorders.bottom && this.state.position.y + halfSize > this.tableBounds.maxY) {
        this.state.position.y = this.tableBounds.maxY - halfSize;
        this.state.velocity.y *= -this.config.bounce;
      }
    } else {
      // Fallback : utiliser les bounds du container
      // Bord gauche
      if (this.state.position.x - halfSize < 0) {
        this.state.position.x = halfSize;
        this.state.velocity.x *= -this.config.bounce;
      }

      // Bord droit
      if (this.state.position.x + halfSize > this.bounds.width) {
        this.state.position.x = this.bounds.width - halfSize;
        this.state.velocity.x *= -this.config.bounce;
      }

      // Bord haut
      if (this.state.position.y - halfSize < 0) {
        this.state.position.y = halfSize;
        this.state.velocity.y *= -this.config.bounce;
      }

      // Bord bas
      if (this.state.position.y + halfSize > this.bounds.height) {
        this.state.position.y = this.bounds.height - halfSize;
        this.state.velocity.y *= -this.config.bounce;
      }
    }
  }

  /**
   * Arrête le dé
   */
  private stop(): void {
    this.state.isRolling = false;
    this.state.velocity = { x: 0, y: 0 };
    this.state.angularVelocity = { x: 0, y: 0 };

    // Aligner la rotation pour afficher la valeur correctement
    console.log('🎲 Avant alignement - rotation:', this.state.rotation, 'valeur:', this.state.currentValue);
    this.alignToValue(this.state.currentValue);
    console.log('🎲 Après alignement - rotation:', this.state.rotation);
  }

  /**
   * Aligne le dé pour afficher une valeur spécifique sur le dessus
   * IMPORTANT: La vue est isométrique avec baseRotationX=-35 et baseRotationY=45
   * Les rotations ci-dessous COMPENSENT cette vue de base pour montrer la bonne face
   */
  private alignToValue(value: number): void {
    // Construction du cube (dans Dice3D.ts ligne 139-158) :
    // Face 1 (valeur 1) = AVANT   → rotateY(0deg) translateZ
    // Face 2 (valeur 2) = ARRIÈRE → rotateY(180deg) translateZ
    // Face 3 (valeur 3) = GAUCHE  → rotateY(-90deg) translateZ
    // Face 4 (valeur 4) = DROITE  → rotateY(90deg) translateZ
    // Face 5 (valeur 5) = HAUT    → rotateX(90deg) translateZ
    // Face 6 (valeur 6) = BAS     → rotateX(-90deg) translateZ
    //
    // Vue isométrique de base : rotateX(-35) rotateY(45)
    // Pour voir une face "vers le haut" dans cette vue, on doit composer les rotations
    const rotations = [
      { x: 35, y: -45 },    // Valeur 1 : Annuler la vue iso + amener face AVANT vers haut
      { x: 35, y: 135 },    // Valeur 2 : Annuler la vue iso + amener face ARRIÈRE vers haut
      { x: 35, y: 45 },     // Valeur 3 : Amener face GAUCHE vers haut (compense base)
      { x: 35, y: -135 },   // Valeur 4 : Amener face DROITE vers haut
      { x: -55, y: -45 },   // Valeur 5 : Face HAUT visible (compense baseRotationX=-35 pour avoir 0 total)
      { x: 125, y: -45 }    // Valeur 6 : Face BAS vers haut (rotation 180 + compense base)
    ];

    const targetRotation = rotations[value - 1];
    this.state.rotation = { ...targetRotation };
  }

  /**
   * Retourne l'état actuel
   */
  public getState(): DiceState {
    return { ...this.state };
  }

  /**
   * Vérifie si le dé est en mouvement
   */
  public isRolling(): boolean {
    return this.state.isRolling;
  }

  /**
   * Obtient la valeur actuelle du dé
   */
  public getValue(): number {
    return this.state.currentValue;
  }

  /**
   * Définit les limites de la zone de jeu
   */
  public setBounds(bounds: { width: number; height: number }): void {
    this.bounds = bounds;
  }

  /**
   * Configure les limites de la table pour les rebonds et la détection de chute
   * @param tableBounds Limites de la table
   * @param borders Configuration des bordures (true = bordure présente)
   */
  public setTableBounds(
    tableBounds: { minX: number; maxX: number; minY: number; maxY: number },
    borders: { top: boolean; right: boolean; bottom: boolean; left: boolean }
  ): void {
    this.tableBounds = tableBounds;
    this.tableBorders = borders;
  }

  /**
   * Vérifie si le dé est tombé hors de la table
   * Seulement si un côté n'a PAS de bordure
   */
  public checkFall(): boolean {
    if (!this.tableBounds || !this.tableBorders) return false;

    const halfSize = this.config.size / 2;
    const centerX = this.state.position.x;
    const centerY = this.state.position.y;

    // Vérifier chaque côté seulement s'il n'y a PAS de bordure
    if (!this.tableBorders.left && centerX - halfSize < this.tableBounds.minX) {
      this.state.hasFallen = true;
      return true;
    }
    if (!this.tableBorders.right && centerX + halfSize > this.tableBounds.maxX) {
      this.state.hasFallen = true;
      return true;
    }
    if (!this.tableBorders.top && centerY - halfSize < this.tableBounds.minY) {
      this.state.hasFallen = true;
      return true;
    }
    if (!this.tableBorders.bottom && centerY + halfSize > this.tableBounds.maxY) {
      this.state.hasFallen = true;
      return true;
    }

    return false;
  }

  /**
   * Réinitialise l'état de chute
   */
  public resetFall(): void {
    this.state.hasFallen = false;
  }

  /**
   * Utilitaire: nombre aléatoire entre min et max
   */
  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
