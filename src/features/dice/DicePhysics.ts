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
}

export class DicePhysics {
  private state: DiceState;
  private config: DicePhysicsConfig;
  private bounds: { width: number; height: number };
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
      currentValue: 1
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
   * Gère les collisions avec les bords
   */
  private handleBoundsCollision(): void {
    const halfSize = this.config.size / 2;

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

  /**
   * Arrête le dé
   */
  private stop(): void {
    this.state.isRolling = false;
    this.state.velocity = { x: 0, y: 0 };
    this.state.angularVelocity = { x: 0, y: 0 };

    // Aligner la rotation pour afficher la valeur correctement
    this.alignToValue(this.state.currentValue);
  }

  /**
   * Aligne le dé pour afficher une valeur spécifique
   */
  private alignToValue(value: number): void {
    // Rotation pour chaque face (approximation)
    const rotations = [
      { x: 0, y: 0 },      // Face 1
      { x: 180, y: 0 },    // Face 2
      { x: 0, y: 90 },     // Face 3
      { x: 0, y: -90 },    // Face 4
      { x: -90, y: 0 },    // Face 5
      { x: 90, y: 0 }      // Face 6
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
   * Utilitaire: nombre aléatoire entre min et max
   */
  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
