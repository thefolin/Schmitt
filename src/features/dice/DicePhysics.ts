/**
 * Moteur physique pour les dés
 * Gère les mouvements, rotations, collisions et gravité
 */

import type { DicePhysicsConfig } from './DiceConfig';
import { randomBetween } from './random';
import {
  IDENTITY,
  fromAxisAngle,
  multiply,
  normalize,
  slerp,
  type Quaternion,
  type Vec3,
} from './quaternion';
import { readTopFace, faceAlignment, settleOrientation } from './dice-faces';

export interface Vector2D {
  x: number;
  y: number;
}

export interface DiceState {
  position: Vector2D;
  velocity: Vector2D;
  rotation: Vector2D; // conservé pour l'ombre/le scale ; l'orientation fait foi
  angularVelocity: Vector2D;
  /** Orientation réelle du cube. C'est elle qui détermine la face visible. */
  orientation: Quaternion;
  /** Vitesse angulaire 3D en radians/s, autour des trois axes. */
  spin: Vec3;
  height: number; // Hauteur (axe Z) pour la simulation de chute
  verticalVelocity: number; // Vitesse verticale
  isRolling: boolean;
  currentValue: number;
  hasFallen: boolean; // Indique si le dé est tombé hors de la table
  /** Phase de repos : le dé bascule doucement à plat sur sa face finale. */
  settling: boolean;
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
      orientation: { ...IDENTITY },
      spin: { x: 0, y: 0, z: 0 },
      height: 0,
      verticalVelocity: 0,
      isRolling: false,
      currentValue: 1,
      hasFallen: false,
      settling: false
    };
  }

  /**
   * Applique la rotation accumulée pendant `dt` à l'orientation du cube.
   * On compose des quaternions plutôt que d'additionner des angles : c'est ce
   * qui permet des culbutes sur trois axes sans gimbal lock.
   */
  private integrateSpin(dt: number): void {
    const { spin } = this.state;
    const speed = Math.hypot(spin.x, spin.y, spin.z);
    if (speed < 1e-6) return;

    const axis = { x: spin.x / speed, y: spin.y / speed, z: spin.z / speed };
    const delta = fromAxisAngle(axis, speed * dt);
    this.state.orientation = normalize(multiply(delta, this.state.orientation));
  }

  /**
   * Couple communiqué par un lancer : un dé lancé vif culbute beaucoup, un
   * lancer mou tourne à peine. L'axe principal est perpendiculaire au
   * déplacement (le dé roule dans le sens où il part), avec une composante
   * aléatoire pour que deux lancers identiques ne se ressemblent jamais.
   */
  private spinFromThrow(velocity: Vector2D, strength: number): Vec3 {
    const speed = Math.hypot(velocity.x, velocity.y);
    const base = this.config.rotationSpeedMin * (Math.PI / 180);
    const range = (this.config.rotationSpeedMax - this.config.rotationSpeedMin) * (Math.PI / 180);
    const magnitude = (base + Math.random() * range) * strength;

    // Axe de roulement : perpendiculaire à la direction du lancer
    const dir = speed > 1e-6
      ? { x: velocity.x / speed, y: velocity.y / speed }
      : { x: 1, y: 0 };

    const wobble = () => (Math.random() - 0.5) * magnitude * 0.6;

    return {
      x: -dir.y * magnitude + wobble(),
      y: wobble(),
      z: dir.x * magnitude + wobble(),
    };
  }

  /**
   * Lance le dé avec une force aléatoire
   */
  public throw(startingFace?: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(this.config.velocityMin, this.config.velocityMax);

    this.state.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };

    this.beginRoll(this.state.velocity, 1, startingFace);
    this.state.height = 100; // Commence à 100px de hauteur
    this.state.verticalVelocity = 0;
  }

  /**
   * Lance le dé avec une vélocité personnalisée (pour drag-and-drop).
   * Le couple de rotation est proportionnel à la vigueur du geste.
   */
  public throwWithVelocity(velocity: Vector2D, verticalVelocity: number, _angularVelocity: Vector2D, startingFace?: number): void {
    const speed = Math.hypot(velocity.x, velocity.y);
    const strength = Math.max(0.6, Math.min(2, speed / this.config.velocityMax));

    this.beginRoll(velocity, strength, startingFace);
    this.state.height = 50;
    this.state.verticalVelocity = verticalVelocity;
  }

  /**
   * Amorce commune à tous les lancers : oriente le cube au départ et lui
   * communique son couple. La valeur finale n'est PAS décidée ici — elle sera
   * lue sur la face tournée vers le haut quand le dé s'immobilisera.
   */
  private beginRoll(velocity: Vector2D, strength: number, startingFace?: number): void {
    this.state.velocity = { ...velocity };
    this.state.spin = this.spinFromThrow(velocity, strength);
    this.state.orientation = startingFace
      ? this.orientationShowing(startingFace)
      : this.randomOrientation();

    this.state.isRolling = true;
    this.state.settling = false;
    this.state.hasFallen = false;
    this.state.currentValue = readTopFace(this.state.orientation);
    this.lastUpdate = performance.now();
  }

  private randomOrientation(): Quaternion {
    // Rotation uniforme sur la sphère (méthode de Shoemake) : sans ça,
    // certaines orientations de départ seraient privilégiées.
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
    const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
    return normalize({
      w: s1 * Math.sin(2 * Math.PI * u2),
      x: s1 * Math.cos(2 * Math.PI * u2),
      y: s2 * Math.sin(2 * Math.PI * u3),
      z: s2 * Math.cos(2 * Math.PI * u3),
    });
  }

  /**
   * Oriente le cube pour qu'une valeur donnée soit sur le dessus AU DÉPART.
   * Le dé roule ensuite librement : ce n'est donc pas le résultat final.
   */
  private orientationShowing(value: number): Quaternion {
    for (let i = 0; i < 200; i++) {
      const candidate = settleOrientation(this.randomOrientation());
      if (readTopFace(candidate) === value) return candidate;
    }
    return IDENTITY;
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
      const impactSpeed = Math.abs(this.state.verticalVelocity);
      this.state.verticalVelocity = -this.state.verticalVelocity * this.config.bounce;

      // À chaque impact, le dé frotte sur la table : il perd de la vitesse
      // horizontale et de la rotation. Sans ça il rebondit sans jamais ralentir.
      if (impactSpeed > 50) {
        this.state.velocity.x *= 0.85;
        this.state.velocity.y *= 0.85;
        this.state.spin.x *= 0.7;
        this.state.spin.y *= 0.7;
        this.state.spin.z *= 0.7;

        // Un cube ne retombe jamais parfaitement à plat : le choc sur une arête
        // le fait repartir de travers. C'est cette irrégularité qui rend la
        // chute crédible.
        const kick = impactSpeed * 0.012;
        this.state.spin.x += (Math.random() - 0.5) * kick;
        this.state.spin.y += (Math.random() - 0.5) * kick;
        this.state.spin.z += (Math.random() - 0.5) * kick;
      }

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
      this.state.spin.x *= this.config.friction;
      this.state.spin.y *= this.config.friction;
      this.state.spin.z *= this.config.friction;
    }

    // Mettre à jour la position
    this.state.position.x += this.state.velocity.x * dt;
    this.state.position.y += this.state.velocity.y * dt;

    // Faire tourner le cube selon sa vitesse angulaire 3D
    this.integrateSpin(dt);

    // Gérer les collisions avec les bords
    this.handleBoundsCollision();

    const speed = Math.hypot(this.state.velocity.x, this.state.velocity.y);
    const spinSpeed = Math.hypot(this.state.spin.x, this.state.spin.y, this.state.spin.z);

    // Le dé ne s'immobilise que posé ET sans rebond en cours : sans la
    // vérification verticale, il pouvait se figer en plein bond (height === 0
    // est vrai à l'instant précis du rebond).
    const isResting = this.state.height === 0 && Math.abs(this.state.verticalVelocity) < 1;

    if (isResting && speed < this.config.stopThreshold && spinSpeed < 0.6) {
      this.settleOntoFace(dt);
    }

    return this.state;
  }

  /**
   * Fin de course : le dé a perdu son énergie mais repose rarement à plat.
   * Il bascule alors doucement sur son arête jusqu'à retomber sur une face,
   * exactement comme un dé réel qui hésite avant de se fixer. La valeur n'est
   * jamais forcée : elle découle de la face vers laquelle il bascule.
   */
  private settleOntoFace(dt: number): void {
    const alignment = faceAlignment(this.state.orientation);

    // Déjà à plat : le dé est fixé
    if (alignment > 0.999) {
      this.stop();
      return;
    }

    this.state.settling = true;

    // Plus le dé est de travers, plus il bascule vite : il « tombe » sur sa
    // face au lieu de glisser linéairement vers elle.
    const tipSpeed = 6 + (1 - alignment) * 10;
    const t = Math.min(1, tipSpeed * dt);

    this.state.orientation = slerp(
      this.state.orientation,
      settleOrientation(this.state.orientation),
      t
    );

    this.state.velocity.x *= 0.8;
    this.state.velocity.y *= 0.8;
    this.state.spin = { x: 0, y: 0, z: 0 };
  }

  /**
   * Gère les collisions avec les bords de la table
   * Si tableBounds est défini, utilise les bordures de la table
   * Sinon utilise les bounds du container
   */
  private handleBoundsCollision(): void {
    const halfSize = this.config.size / 2;

    // Limites effectives : celles de la table si configurée, sinon le container.
    // Un côté sans bordure ne renvoie pas le dé (il tombe : voir checkFall).
    const limits = this.tableBounds && this.tableBorders
      ? {
        minX: this.tableBounds.minX, maxX: this.tableBounds.maxX,
        minY: this.tableBounds.minY, maxY: this.tableBounds.maxY,
        walls: this.tableBorders
      }
      : {
        minX: 0, maxX: this.bounds.width,
        minY: 0, maxY: this.bounds.height,
        walls: { top: true, right: true, bottom: true, left: true }
      };

    if (limits.walls.left && this.state.position.x - halfSize < limits.minX) {
      this.state.position.x = limits.minX + halfSize;
      this.bounceOffWall('x');
    }
    if (limits.walls.right && this.state.position.x + halfSize > limits.maxX) {
      this.state.position.x = limits.maxX - halfSize;
      this.bounceOffWall('x');
    }
    if (limits.walls.top && this.state.position.y - halfSize < limits.minY) {
      this.state.position.y = limits.minY + halfSize;
      this.bounceOffWall('y');
    }
    if (limits.walls.bottom && this.state.position.y + halfSize > limits.maxY) {
      this.state.position.y = limits.maxY - halfSize;
      this.bounceOffWall('y');
    }
  }

  /**
   * Rebond contre un mur : inverse la vitesse sur l'axe touché et communique
   * une part de l'impact à la rotation, pour que le choc se voie à l'écran.
   */
  private bounceOffWall(axis: 'x' | 'y'): void {
    const impactSpeed = Math.abs(this.state.velocity[axis]);
    this.state.velocity[axis] *= -this.config.bounce;

    // L'axe de rotation affecté est perpendiculaire au mur touché
    const spinAxis = axis === 'x' ? 'y' : 'x';
    this.state.angularVelocity[spinAxis] += impactSpeed * 1.5 * (Math.random() > 0.5 ? 1 : -1);
    this.state.angularVelocity[axis] *= 0.8;
  }

  /**
   * Arrête le dé
   */
  private stop(): void {
    this.state.isRolling = false;
    this.state.settling = false;
    this.state.velocity = { x: 0, y: 0 };
    this.state.angularVelocity = { x: 0, y: 0 };
    this.state.spin = { x: 0, y: 0, z: 0 };

    // Poser le dé parfaitement à plat, sans changer la face visible
    this.state.orientation = settleOrientation(this.state.orientation);

    // Le résultat est LU sur le dé, pas imposé : c'est la face réellement
    // tournée vers le haut qui fait foi, comme avec un vrai dé.
    this.state.currentValue = readTopFace(this.state.orientation);
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
}
