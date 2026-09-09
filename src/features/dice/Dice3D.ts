/**
 * Classe principale pour un dé 3D
 * Combine physique et rendu
 */

import { DicePhysics } from './DicePhysics';
import type { Vector2D } from './DicePhysics';
import type { DicePhysicsConfig, DiceVisualConfig } from './DiceConfig';
import type { TableBounds, TableBorderConfig } from '../board/camera/table.config';
import { randomBetween } from './random';
import { toCssMatrix3d } from './quaternion';
import { DICE_FACES } from './dice-faces';

export type DiceType = 'normal' | 'godPower';

export interface DiceFallEvent {
  diceType: DiceType;
}

export class Dice3D {
  private physics: DicePhysics;
  private element: HTMLElement;
  private cubeElement: HTMLElement | null = null; // Référence au cube interne
  private config: DicePhysicsConfig;
  private visualConfig: DiceVisualConfig;
  private type: DiceType;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private onFallCallback: ((event: DiceFallEvent) => void) | null = null;
  private onRollEndCallback: ((result: number) => void) | null = null;

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
    // Conteneur externe (pour positionnement ET zone cliquable élargie)
    // Le wrapper doit être plus grand que le cube pour éviter la troncature en 3D
    const wrapperSize = this.config.size * 2.5; // 2.5x la taille du dé pour avoir plus de marge
    const wrapper = document.createElement('div');
    wrapper.className = `dice-3d dice-${this.type}`;
    // z-index au-dessus des tuiles (sans z-index) et des pions (100) : le dé
    // est posé SUR le plateau, il doit rester attrapable en toutes circonstances
    // Pas de `perspective` ici : elle créerait un contexte 3D isolé, coupant le
    // dé de la profondeur du plateau — il serait rendu à plat, comme détaché
    // de la scène. Le dé hérite de la perspective du viewport, comme les cases.
    wrapper.style.cssText = `
      position: absolute;
      width: ${wrapperSize}px;
      height: ${wrapperSize}px;
      cursor: grab;
      user-select: none;
      touch-action: none;
      transform-style: preserve-3d;
      z-index: 200;
    `;

    // Cube interne (pour rotation 3D) - taille réelle du dé, centré dans le wrapper
    const cube = document.createElement('div');
    cube.className = 'dice-cube';
    const offset = (wrapperSize - this.config.size) / 2;
    cube.style.cssText = `
      position: absolute;
      left: ${offset}px;
      top: ${offset}px;
      width: ${this.config.size}px;
      height: ${this.config.size}px;
      transform-style: preserve-3d;
      -webkit-transform-style: preserve-3d;
    `;

    // Créer les 6 faces à partir de la géométrie définie dans dice-faces.ts :
    // la même source décrit la position CSS de chaque face et sa normale, donc
    // la face affichée ne peut plus diverger de la valeur calculée.
    const halfSize = this.config.size / 2;

    for (const { value, cssRotation } of DICE_FACES) {
      const face = document.createElement('div');
      face.className = `dice-face face-${value}`;
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
      face.appendChild(this.createDots(value));

      // Tourner la face puis la pousser vers l'extérieur du cube
      face.style.transform = `${cssRotation} translateZ(${halfSize}px)`;

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

    // Les points suivent la taille du dé plutôt qu'une valeur fixe : sur un
    // grand dé, des points figés à 8px seraient perdus au milieu de la face.
    const dotSize = Math.max(this.visualConfig.dotSize, Math.round(this.config.size * 0.17));

    const pattern = patterns[value - 1];
    pattern.forEach((hasDot) => {
      const cell = document.createElement('div');
      if (hasDot) {
        cell.style.cssText = `
          width: ${dotSize}px;
          height: ${dotSize}px;
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
  public roll(startingFace?: number): Promise<number> {
    if (!this.cubeElement) {
      return Promise.resolve(1);
    }

    // L'orientation de départ est tirée par la physique (distribution uniforme
    // sur la sphère) : inutile d'en imposer une ici, cela écraserait la sienne.
    this.physics.throw(startingFace);
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

    const isRolling = this.physics.isRolling();
    const state = this.physics.getState();

    if (isRolling) {
      this.physics.update(deltaTime);
      this.updatePosition();

      // Vérifier si le dé est tombé hors de la table
      // (seulement si un côté n'a pas de bordure)
      const hasFallen = this.physics.checkFall();
      if (hasFallen && this.onFallCallback) {
        // Arrêter l'animation
        this.animationFrameId = null;
        // Notifier de la chute
        this.onFallCallback({ diceType: this.type });
        return;
      }

      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      // Le dé s'est arrêté, appeler le callback
      this.animationFrameId = null;

      // IMPORTANT : Mettre à jour la position visuelle une dernière fois
      // pour appliquer la rotation finale après alignToValue()
      this.updatePosition();

      if (this.onRollEndCallback) {
        this.onRollEndCallback(state.currentValue);
      }
    }
  };

  /**
   * Met à jour la position et la rotation du dé dans le DOM
   */
  private updatePosition(): void {
    if (!this.cubeElement) return;

    const state = this.physics.getState();

    // Positionner le wrapper (centré sur la position du dé)
    // Le wrapper fait 2.5x la taille du dé, donc on décale de wrapperSize/2
    const wrapperSize = this.config.size * 2.5;
    this.element.style.left = `${state.position.x - wrapperSize / 2}px`;
    this.element.style.top = `${state.position.y - wrapperSize / 2 - state.height}px`;

    // Même redressement que les cases (rotateX(40deg) dans board-camera.css) :
    // il compense la perspective du viewport. Avec le signe opposé, le dé
    // subissait cette perspective au lieu de la compenser, et s'affichait
    // écrasé. Appliqué AVANT l'orientation dans la chaîne CSS (donc APRÈS dans
    // l'espace), sinon la face lue par la physique ne serait pas celle vue.
    const sceneTiltX = 40;

    // Léger décalage de POINT DE VUE (pas d'orientation) : vu pile de face, un
    // cube se lit comme un carré plat. Ces quelques degrés révèlent deux faces
    // latérales et donnent son volume au dé, sans toucher à la face du dessus
    // ni donc à la valeur lue par la physique.
    const viewYaw = 18;
    const viewPitch = -12;

    // Échelle basée sur la hauteur (perspective)
    const scale = 1 + (state.height / 400); // Le dé grossit légèrement quand il monte

    // L'orientation vient du quaternion de la physique : c'est la même donnée
    // qui sert à lire la valeur, donc l'affichage ne peut plus la contredire.
    this.cubeElement.style.transform = `
      scale(${scale})
      rotateX(${sceneTiltX}deg)
      rotateY(${viewYaw}deg)
      rotateX(${viewPitch}deg)
      ${toCssMatrix3d(state.orientation)}
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

    // Calculer le delta AVANT de mettre à jour lastDragPos
    const deltaX = currentPos.x - this.lastDragPos.x;
    const deltaY = currentPos.y - this.lastDragPos.y;

    // Calculer la vélocité (pour l'effet de lancer)
    if (deltaTime > 0) {
      this.dragVelocity = {
        x: deltaX / (deltaTime / 1000),
        y: deltaY / (deltaTime / 1000)
      };
    }

    // Déplacer visuellement le dé (sans affecter la physique)
    const state = this.physics.getState();
    state.position.x += deltaX;
    state.position.y += deltaY;

    this.element.style.left = `${state.position.x - this.config.size / 2}px`;
    this.element.style.top = `${state.position.y - this.config.size / 2}px`;

    // Mettre à jour pour le prochain frame
    this.lastDragPos = currentPos;
    this.dragStartTime = performance.now();
  };

  /**
   * Gère la fin du drag (lancer le dé ou le poser)
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

    // Calculer la distance et la vitesse du drag
    const dragDistance = this.dragStartPos && this.lastDragPos
      ? Math.sqrt(
          Math.pow(this.lastDragPos.x - this.dragStartPos.x, 2) +
          Math.pow(this.lastDragPos.y - this.dragStartPos.y, 2)
        )
      : 0;

    const speed = Math.sqrt(
      this.dragVelocity.x ** 2 + this.dragVelocity.y ** 2
    );

    // Si le drag était très faible (< 15px) ET vitesse très faible, c'est une "pose"
    // Le joueur a juste levé et reposé le dé sans bouger
    if (dragDistance < 15 && speed < 50) {
      // Reposer le dé à sa position actuelle
      const state = this.physics.getState();
      this.element.style.left = `${state.position.x - this.config.size / 2}px`;
      this.element.style.top = `${state.position.y - this.config.size / 2}px`;

      // Réinitialiser l'état du drag
      this.dragStartPos = null;
      this.lastDragPos = null;
      this.dragVelocity = { x: 0, y: 0 };
      return;
    }

    // Sinon, c'est un vrai lancer !
    // Lancer le dé avec la vélocité calculée
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
    // Amplifier la vélocité pour un lancer plus dynamique
    const finalVelocity = {
      x: velocity.x * 0.8,
      y: velocity.y * 0.8
    };

    // Donner une hauteur initiale et une vitesse verticale pour simuler un vrai lancer
    // Plus le drag est rapide, plus le dé monte haut
    const dragSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    const verticalVelocity = Math.min(800, 400 + dragSpeed * 0.5); // Vitesse vers le haut

    // Ajouter une rotation aléatoire - toujours forte pour bien voir le dé tourner
    // Rotation minimum de 1.0, jusqu'à 2.0 pour les lancers rapides
    const rotationFactor = Math.max(1.0, Math.min(2.0, 1.0 + dragSpeed / 1000));
    const angularVelocity = {
      x: randomBetween(this.config.rotationSpeedMin, this.config.rotationSpeedMax) * rotationFactor * (Math.random() > 0.5 ? 1 : -1),
      y: randomBetween(this.config.rotationSpeedMin, this.config.rotationSpeedMax) * rotationFactor * (Math.random() > 0.5 ? 1 : -1)
    };

    // Le résultat n'est pas décidé ici : il sera lu sur la face du dessus
    // quand le dé s'immobilisera.
    this.physics.throwWithVelocity(finalVelocity, verticalVelocity, angularVelocity);

    this.startAnimation();
  }

  /**
   * Définit le callback appelé quand le dé tombe hors de la table
   */
  public setOnFall(callback: (event: DiceFallEvent) => void): void {
    this.onFallCallback = callback;
  }

  /**
   * Définit le callback appelé quand le dé s'arrête de rouler
   */
  public setOnRollEnd(callback: (result: number) => void): void {
    this.onRollEndCallback = callback;
  }

  /**
   * Configure les limites de la table pour les rebonds et la détection de chute
   */
  public setTableBounds(bounds: TableBounds, borders: TableBorderConfig): void {
    this.physics.setTableBounds(bounds, borders);
  }

  /**
   * Réinitialise l'état de chute du dé
   */
  public resetFall(): void {
    this.physics.resetFall();
  }

  /**
   * Définit la position du dé
   */
  public setPosition(x: number, y: number): void {
    const state = this.physics.getState();
    state.position.x = x;
    state.position.y = y;
    this.updatePosition();
  }

  /**
   * Position actuelle du dé dans le repère du plateau
   */
  public getPosition(): Vector2D {
    const { position } = this.physics.getState();
    return { x: position.x, y: position.y };
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
   * Vérifie si le dé est visible
   */
  public isVisible(): boolean {
    return this.element.style.display !== 'none';
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
