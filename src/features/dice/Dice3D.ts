/**
 * Classe principale pour un dé 3D
 * Combine physique et rendu
 */

import { DicePhysics } from './DicePhysics';
import type { Vector2D } from './DicePhysics';
import type { DicePhysicsConfig, DiceVisualConfig } from './DiceConfig';

export type DiceType = 'normal' | 'godPower';

export class Dice3D {
  private physics: DicePhysics;
  private element: HTMLElement;
  private cubeElement: HTMLElement | null = null; // Référence au cube interne
  private config: DicePhysicsConfig;
  private visualConfig: DiceVisualConfig;
  private type: DiceType;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private onClickCallback: (() => void) | null = null;

  // Drag-to-throw state
  private isDragging: boolean = false;
  private dragStartPos: Vector2D | null = null;
  private dragStartTime: number = 0;
  private lastDragPos: Vector2D | null = null;
  private dragVelocity: Vector2D = { x: 0, y: 0 };
  private container: HTMLElement;

  constructor(
    container: HTMLElement,
    type: DiceType,
    physicsConfig: DicePhysicsConfig,
    visualConfig: DiceVisualConfig,
    initialPosition: Vector2D
  ) {
    this.type = type;
    this.config = physicsConfig;
    this.visualConfig = visualConfig;
    this.container = container;

    // Créer l'élément DOM
    this.element = this.createDiceElement();
    container.appendChild(this.element);

    // Initialiser la physique
    const bounds = {
      width: container.clientWidth,
      height: container.clientHeight
    };
    this.physics = new DicePhysics(physicsConfig, initialPosition, bounds);

    // Position initiale
    this.updatePosition();

    // Ajouter les event listeners pour le drag-to-throw
    this.element.addEventListener('mousedown', this.handleDragStart);
    this.element.addEventListener('touchstart', this.handleDragStart, { passive: false });
    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('touchmove', this.handleDragMove, { passive: false });
    document.addEventListener('mouseup', this.handleDragEnd);
    document.addEventListener('touchend', this.handleDragEnd);
  }

  /**
   * Crée l'élément DOM du dé
   */
  private createDiceElement(): HTMLElement {
    // Conteneur externe (pour positionnement)
    const wrapper = document.createElement('div');
    wrapper.className = `dice-3d dice-${this.type}`;
    wrapper.style.cssText = `
      position: absolute;
      width: ${this.config.size}px;
      height: ${this.config.size}px;
      cursor: grab;
      user-select: none;
      touch-action: none;
      perspective: 1000px;
    `;

    // Cube interne (pour rotation 3D)
    const cube = document.createElement('div');
    cube.className = 'dice-cube';
    cube.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      -webkit-transform-style: preserve-3d;
    `;

    // Créer les 6 faces
    const halfSize = this.config.size / 2;

    for (let i = 1; i <= 6; i++) {
      const face = document.createElement('div');
      face.className = `dice-face face-${i}`;
      face.style.cssText = `
        position: absolute;
        width: ${this.config.size}px;
        height: ${this.config.size}px;
        left: 0;
        top: 0;
        background: ${this.visualConfig.faceColor};
        border: 2px solid ${this.visualConfig.faceBorderColor};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          inset 0 0 10px rgba(0, 0, 0, 0.15),
          inset -2px -2px 8px rgba(0, 0, 0, 0.1),
          inset 2px 2px 8px rgba(255, 255, 255, 0.3);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      `;

      // Ajouter les points
      face.appendChild(this.createDots(i));

      // Positionner chaque face dans l'espace 3D pour former un cube
      // Chaque face doit être tournée puis déplacée vers l'extérieur
      switch (i) {
        case 1: // Face avant
          face.style.transform = `rotateY(0deg) translateZ(${halfSize}px)`;
          break;
        case 2: // Face arrière
          face.style.transform = `rotateY(180deg) translateZ(${halfSize}px)`;
          break;
        case 3: // Face gauche
          face.style.transform = `rotateY(-90deg) translateZ(${halfSize}px)`;
          break;
        case 4: // Face droite
          face.style.transform = `rotateY(90deg) translateZ(${halfSize}px)`;
          break;
        case 5: // Face haut
          face.style.transform = `rotateX(90deg) translateZ(${halfSize}px)`;
          break;
        case 6: // Face bas
          face.style.transform = `rotateX(-90deg) translateZ(${halfSize}px)`;
          break;
      }

      cube.appendChild(face);
    }

    wrapper.appendChild(cube);

    // Garder une référence au cube pour les transformations
    this.cubeElement = cube;

    return wrapper;
  }

  /**
   * Crée les points pour une face
   */
  private createDots(value: number): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: grid;
      grid-template: repeat(3, 1fr) / repeat(3, 1fr);
      gap: 4px;
      width: 80%;
      height: 80%;
    `;

    // Patterns de points pour chaque valeur
    const patterns = [
      [false, false, false, false, true, false, false, false, false], // 1
      [true, false, false, false, false, false, false, false, true],  // 2
      [true, false, false, false, true, false, false, false, true],   // 3
      [true, false, true, false, false, false, true, false, true],    // 4
      [true, false, true, false, true, false, true, false, true],     // 5
      [true, false, true, true, false, true, true, false, true]       // 6
    ];

    const pattern = patterns[value - 1];
    pattern.forEach((hasDot) => {
      const cell = document.createElement('div');
      if (hasDot) {
        cell.style.cssText = `
          width: ${this.visualConfig.dotSize}px;
          height: ${this.visualConfig.dotSize}px;
          background: ${this.visualConfig.dotColor};
          border-radius: 50%;
          margin: auto;
          box-shadow:
            0 2px 4px rgba(0, 0, 0, 0.3),
            inset 0 -1px 2px rgba(0, 0, 0, 0.5);
        `;
      }
      container.appendChild(cell);
    });

    return container;
  }

  /**
   * Lance le dé
   */
  public roll(targetValue?: number): Promise<number> {
    if (!this.cubeElement) {
      return Promise.resolve(1);
    }

    // Donner une rotation initiale aléatoire pour plus de réalisme
    const initialRotation = {
      x: Math.random() * 360,
      y: Math.random() * 360
    };

    // Appliquer la rotation initiale au cube interne
    this.cubeElement.style.transform = `
      rotateX(${initialRotation.x}deg)
      rotateY(${initialRotation.y}deg)
    `;

    this.physics.throw(targetValue);
    this.startAnimation();

    return new Promise((resolve) => {
      const checkRoll = () => {
        if (!this.physics.isRolling()) {
          resolve(this.physics.getValue());
        } else {
          requestAnimationFrame(checkRoll);
        }
      };
      checkRoll();
    });
  }

  /**
   * Démarre l'animation
   */
  private startAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.lastTimestamp = performance.now();
    this.animate();
  }

  /**
   * Boucle d'animation
   */
  private animate = (): void => {
    const now = performance.now();
    const deltaTime = now - this.lastTimestamp;
    this.lastTimestamp = now;

    if (this.physics.isRolling()) {
      this.physics.update(deltaTime);
      this.updatePosition();
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.animationFrameId = null;
    }
  };

  /**
   * Met à jour la position et la rotation du dé dans le DOM
   */
  private updatePosition(): void {
    if (!this.cubeElement) return;

    const state = this.physics.getState();

    // Positionner le wrapper (ajusté par la hauteur pour donner l'illusion de profondeur)
    this.element.style.left = `${state.position.x - this.config.size / 2}px`;
    this.element.style.top = `${state.position.y - this.config.size / 2 - state.height}px`;

    // Vue isométrique améliorée : rotation de base + rotation du lancer
    // Rotation de base pour voir 3 faces simultanément (isométrique)
    const baseRotationX = -35;  // Inclinaison vers l'avant (augmentée pour mieux voir les faces)
    const baseRotationY = 45;   // Rotation à 45° pour vue en coin
    const baseRotationZ = 0;    // Pas de rotation Z de base

    // Échelle basée sur la hauteur (perspective)
    const scale = 1 + (state.height / 400); // Le dé grossit légèrement quand il monte

    // Appliquer la rotation 3D au cube interne
    // IMPORTANT: L'ordre des transformations est crucial pour le rendu 3D correct
    this.cubeElement.style.transform = `
      translateZ(0)
      scale(${scale})
      rotateX(${baseRotationX + state.rotation.x}deg)
      rotateY(${baseRotationY + state.rotation.y}deg)
      rotateZ(${baseRotationZ + (state.rotation.x * 0.2)}deg)
    `;

    // Ombre dynamique basée sur la hauteur appliquée au wrapper
    // Plus le dé est haut, plus l'ombre est large et floue
    const shadowDistance = 10 + (state.height * 0.3);
    const shadowBlur = this.visualConfig.shadowBlur + (state.height * 0.2);
    const shadowOpacity = Math.max(0.1, 0.4 - (state.height / 500));

    this.element.style.filter = `drop-shadow(0 ${shadowDistance}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity}))`;
  }

  /**
   * Gère le début du drag (attraper le dé)
   */
  private handleDragStart = (e: MouseEvent | TouchEvent): void => {
    // Ne pas permettre de drag si le dé est déjà en mouvement
    if (this.physics.isRolling()) {
      return;
    }

    e.preventDefault();
    e.stopPropagation(); // Empêcher la propagation vers la caméra
    this.isDragging = true;
    this.dragStartTime = performance.now();

    // Obtenir la position du curseur/touch
    const pos = this.getEventPosition(e);
    this.dragStartPos = pos;
    this.lastDragPos = pos;

    // Feedback visuel
    this.element.style.cursor = 'grabbing';
    // Note: On n'applique plus de scale ici car le scale est géré dans updatePosition
  };

  /**
   * Gère le mouvement pendant le drag
   */
  private handleDragMove = (e: MouseEvent | TouchEvent): void => {
    if (!this.isDragging || !this.dragStartPos || !this.lastDragPos) {
      return;
    }

    e.preventDefault();
    e.stopPropagation(); // Empêcher la propagation vers la caméra

    const currentPos = this.getEventPosition(e);
    const deltaTime = performance.now() - this.dragStartTime;

    // Calculer la vélocité (pour l'effet de lancer)
    if (deltaTime > 0) {
      this.dragVelocity = {
        x: (currentPos.x - this.lastDragPos.x) / (deltaTime / 1000),
        y: (currentPos.y - this.lastDragPos.y) / (deltaTime / 1000)
      };
    }

    this.lastDragPos = currentPos;
    this.dragStartTime = performance.now();

    // Déplacer visuellement le dé (sans affecter la physique)
    const state = this.physics.getState();
    const newX = state.position.x + (currentPos.x - this.lastDragPos.x);
    const newY = state.position.y + (currentPos.y - this.lastDragPos.y);

    this.element.style.left = `${newX - this.config.size / 2}px`;
    this.element.style.top = `${newY - this.config.size / 2}px`;
  };

  /**
   * Gère la fin du drag (lancer le dé)
   */
  private handleDragEnd = (e: MouseEvent | TouchEvent): void => {
    if (!this.isDragging) {
      return;
    }

    e.preventDefault();
    e.stopPropagation(); // Empêcher la propagation vers la caméra
    this.isDragging = false;

    // Restaurer le curseur
    this.element.style.cursor = 'grab';

    // Si le drag était trop faible, considérer comme un clic
    const dragDistance = this.dragStartPos && this.lastDragPos
      ? Math.sqrt(
          Math.pow(this.lastDragPos.x - this.dragStartPos.x, 2) +
          Math.pow(this.lastDragPos.y - this.dragStartPos.y, 2)
        )
      : 0;

    if (dragDistance < 5) {
      // C'était un clic, pas un drag
      if (this.onClickCallback) {
        this.onClickCallback();
      }
      return;
    }

    // Lancer le dé avec la vélocité calculée
    const speed = Math.sqrt(
      this.dragVelocity.x ** 2 + this.dragVelocity.y ** 2
    );

    // Limiter la vitesse
    const maxSpeed = this.config.velocityMax;
    const minSpeed = this.config.velocityMin;
    const clampedSpeed = Math.max(minSpeed, Math.min(maxSpeed, speed));

    // Lancer le dé
    this.rollWithVelocity(this.dragVelocity);

    // Réinitialiser l'état du drag
    this.dragStartPos = null;
    this.lastDragPos = null;
    this.dragVelocity = { x: 0, y: 0 };
  };

  /**
   * Obtient la position d'un événement (mouse ou touch)
   */
  private getEventPosition(e: MouseEvent | TouchEvent): Vector2D {
    if ('touches' in e && e.touches.length > 0) {
      const rect = this.container.getBoundingClientRect();
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if ('clientX' in e) {
      const rect = this.container.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  }

  /**
   * Lance le dé avec une vélocité personnalisée
   */
  private rollWithVelocity(velocity: Vector2D): void {
    // Mettre à jour la physique avec la vélocité de drag
    const state = this.physics.getState();
    state.velocity = velocity;
    state.isRolling = true;
    state.height = 100;
    state.verticalVelocity = 0;

    // Ajouter une rotation aléatoire
    state.angularVelocity = {
      x: this.randomBetween(this.config.rotationSpeedMin, this.config.rotationSpeedMax) * (Math.random() > 0.5 ? 1 : -1),
      y: this.randomBetween(this.config.rotationSpeedMin, this.config.rotationSpeedMax) * (Math.random() > 0.5 ? 1 : -1)
    };

    // Valeur aléatoire
    state.currentValue = Math.floor(Math.random() * 6) + 1;

    this.startAnimation();
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Définit le callback appelé lors du clic sur le dé
   */
  public setOnClick(callback: () => void): void {
    this.onClickCallback = callback;
  }

  /**
   * Affiche ou cache le dé
   */
  public show(): void {
    this.element.style.display = 'block';
  }

  public hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Vérifie si le dé est en mouvement
   */
  public isRolling(): boolean {
    return this.physics.isRolling();
  }

  /**
   * Obtient la valeur actuelle
   */
  public getValue(): number {
    return this.physics.getValue();
  }

  /**
   * Nettoie le dé
   */
  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Nettoyer tous les event listeners
    this.element.removeEventListener('mousedown', this.handleDragStart);
    this.element.removeEventListener('touchstart', this.handleDragStart);
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('touchmove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
    document.removeEventListener('touchend', this.handleDragEnd);

    this.element.remove();
  }
}
