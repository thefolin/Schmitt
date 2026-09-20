/**
 * Les deux dés de la FAVEUR DES DIEUX, dans la scène du plateau.
 *
 * Quentin : « les 2 dés n'apparaissent pas quand on tombe dessus ».
 *
 * Le dé du tour reste ce qu'il est : un seul dé, une seule physique, la
 * chaîne « la face vue est celle dont on avance » qu'on ne touche pas. Le
 * temple en demande DEUX, et c'est un objet distinct — deux corps
 * indépendants, lancés ensemble, lus quand les deux se sont arrêtés.
 *
 * `DicePhysics` ne gère que les collisions avec les BORDS : deux dés peuvent
 * se traverser. C'est déjà le cas du jeu qui tourne, où les deux dés de la
 * faveur s'ignorent. On les lance depuis deux points écartés pour que le cas
 * reste rare à l'œil, plutôt que d'ajouter une physique que personne n'a
 * demandée.
 */

import { Dice3DScene } from './dice-3d-scene';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG, rollingSpinRate } from './dice-world-config';
import type { DiceArena } from './dice-arena';
import type { ThrowRequest } from './dice-gesture';
import { collideBodies, collideWithFixed, type MovingBody, type FixedBody } from './collisions';
import { DIE_EDGE } from './dice-world-config';

/**
 * Le corps d'un dé, vu d'au-dessus, tel que les chocs le voient.
 *
 * Le rayon est la DEMI-DIAGONALE de la face plutôt que la demi-arête : un
 * cube qui tourne présente tantôt sa face, tantôt son coin. Prendre la
 * demi-arête laisserait les coins se traverser ; prendre la demi-diagonale
 * fait se toucher les dés un peu tôt, ce qui est le défaut le moins visible
 * des deux.
 */
function bodyOf(physics: DicePhysics): MovingBody {
  const state = physics.getState();

  return {
    x: state.position.x,
    z: state.position.y,
    height: state.height,
    vx: state.velocity.x,
    vz: state.velocity.y,
    radius: (DIE_EDGE * Math.SQRT2) / 2,
  };
}

/** Reporte un corps corrigé dans l'état de la physique. */
function applyBody(physics: DicePhysics, body: MovingBody): void {
  const state = physics.getState();

  state.position.x = body.x;
  state.position.y = body.z;
  state.velocity.x = body.vx;
  state.velocity.y = body.vz;
}

/**
 * Écart entre les deux points de lancer, en fraction de la largeur de l'aire.
 *
 * Assez pour que les deux dés partent de côtés différents et se croisent
 * rarement ; pas au point de les lancer dans les coins, où ils rebondiraient
 * aussitôt sur deux murs.
 */
const LAUNCH_SPREAD = 0.22;

/** Un dé de faveur : son corps physique et son rendu. */
interface FavorDie {
  physics: DicePhysics;
  view: Dice3DScene;
}

export class FavorDice {
  private readonly dice: FavorDie[] = [];
  private frame: number | null = null;

  constructor(
    private readonly arena: DiceArena,
    /**
     * Les pions à heurter, relus à chaque image.
     *
     * Une FONCTION et non une liste figée : les pions marchent, et un
     * obstacle mémorisé au lancer resterait là où le pion n'est plus.
     */
    private readonly obstacles: () => FixedBody[] = () => []
  ) {
    const midX = (arena.minX + arena.maxX) / 2;
    const midZ = (arena.minZ + arena.maxZ) / 2;
    const width = arena.maxX - arena.minX;
    const height = arena.maxZ - arena.minZ;

    for (const side of [-1, 1]) {
      const physics = new DicePhysics(
        WORLD_DICE_CONFIG,
        { x: midX + side * width * LAUNCH_SPREAD, y: midZ },
        { width, height }
      );

      // Les mêmes bords que le dé du tour : l'aire épouse le plateau, et un
      // dé de faveur ne doit pas davantage tomber dans le vide.
      physics.setTableBounds(
        { minX: arena.minX, maxX: arena.maxX, minY: arena.minZ, maxY: arena.maxZ },
        { top: true, right: true, bottom: true, left: true }
      );

      const view = new Dice3DScene();
      view.setVisible(false);

      this.dice.push({ physics, view });
    }
  }

  /** Les deux rendus, à ajouter au monde. */
  public get views(): Dice3DScene[] {
    return this.dice.map(die => die.view);
  }

  /** Un lancer est-il en cours ? */
  public get rolling(): boolean {
    return this.frame !== null;
  }

  /** Montre ou cache les deux dés. */
  public setVisible(visible: boolean): void {
    for (const die of this.dice) die.view.setVisible(visible);
  }

  /**
   * POSE les deux dés sur le plateau, en attente du geste du joueur.
   *
   * Indispensable depuis que le joueur les lance lui-même : leur position
   * n'était fixée QUE pendant l'animation du lancer. Des dés jamais lancés
   * restaient donc à l'origine du monde, hors du plateau et l'un dans
   * l'autre — le joueur n'avait rien à attraper.
   *
   * Ils sont posés à leurs deux points de lancer, écartés l'un de l'autre :
   * deux dés qu'on voit séparément, et qu'on peut viser du doigt.
   */
  /**
   * Replace les deux physiques autour d'un point, en gardant leur écart.
   *
   * `DicePhysics` n'a pas de méthode pour se repositionner, et c'est un
   * module partagé avec le rendu CSS de `main` : on reconstruit plutôt que
   * d'y toucher. Deux objets par tirage n'ont rien d'une boucle serrée.
   */
  private relocate(centre: { x: number; z: number }): void {
    const width = this.arena.maxX - this.arena.minX;
    const height = this.arena.maxZ - this.arena.minZ;

    this.dice.forEach((die, index) => {
      const side = index === 0 ? -1 : 1;

      // L'écart est CONSERVÉ : deux dés posés l'un sur l'autre se
      // traverseraient, `DicePhysics` ne gérant que les bords.
      const x = Math.min(
        Math.max(centre.x + side * width * LAUNCH_SPREAD * 0.5, this.arena.minX),
        this.arena.maxX
      );
      const z = Math.min(Math.max(centre.z, this.arena.minZ), this.arena.maxZ);

      const fresh = new DicePhysics(WORLD_DICE_CONFIG, { x, y: z }, { width, height });

      fresh.setTableBounds(
        { minX: this.arena.minX, maxX: this.arena.maxX, minY: this.arena.minZ, maxY: this.arena.maxZ },
        { top: true, right: true, bottom: true, left: true }
      );

      die.physics = fresh;
    });
  }

  public rest(): void {
    for (const die of this.dice) {
      const start = die.physics.getState().position;

      die.view.setPosition(start.x, Dice3DScene.halfSize, start.y);
    }
  }

  /**
   * Lance les deux dés et rend la main quand les DEUX se sont arrêtés.
   *
   * Les deux faces sont lues sur la physique, comme celle du dé du tour :
   * c'est la face posée sur le dessus, pas un tirage séparé. Annoncer une
   * faveur qui ne correspond pas aux dés posés sur la table rejouerait le
   * défaut que toute la refonte supprime.
   */
  public roll(
    done: (a: number, b: number) => void,
    request?: ThrowRequest,
    from?: { x: number; z: number }
  ): void {
    if (this.frame !== null) return;

    // La VISIBILITÉ n'est pas décidée ici : `dice-on-stage` en est seul juge,
    // parce qu'elle concerne aussi le dé du tour, qui doit s'effacer pendant
    // la faveur. La régler des deux côtés a déjà donné trois dés à l'écran.
    //
    // LE GESTE DU JOUEUR, quand il y en a un. Quentin : « les 2 dés ne
    // doivent PAS se lancer automatiquement, le joueur doit les lancer
    // lui-même ». Les deux dés partent du MÊME geste : c'est une seule
    // poignée qu'on jette.
    //
    // La même vitesse pour les deux ne les rend PAS identiques, et je l'ai
    // mesuré avant de compliquer : `beginRoll` tire une orientation de départ
    // au hasard pour chaque dé, indépendamment. Deux dés lancés à vitesse
    // égale donnent 16,7 % de doubles — exactement le taux de deux dés
    // honnêtes. J'avais d'abord ajouté un écart de trajectoire pour éviter
    // des dés collés ; il ne corrigeait rien qui existait, et il est retiré.
    // Les dés partent D'OÙ ILS ONT ÉTÉ LÂCHÉS. Depuis qu'ils suivent le
    // doigt, ils ne sont plus à leurs points de départ : relancer de là les
    // ferait sauter en arrière au moment du jet. Leur ÉCART est conservé —
    // c'est une poignée qu'on jette, pas deux dés empilés.
    if (from) this.relocate(from);

    for (const die of this.dice) {
      if (request) {
        die.physics.throwWithVelocity(
          request.velocity,
          request.verticalVelocity,
          { x: 0, y: 0 }
        );
      } else {
        die.physics.throw();
      }
    }

    const step = (): void => {
      let moving = false;

      for (const die of this.dice) {
        const state = die.physics.update(16);

        this.applyRolling(state);

        die.view.setOrientation(state.orientation);
        die.view.setPosition(
          state.position.x,
          Dice3DScene.halfSize + Math.max(0, state.height),
          state.position.y
        );

        if (state.isRolling) moving = true;
        else if (state.hasFallen) die.physics.resetFall();
      }

      // LES DEUX DÉS SE TOUCHENT. `DicePhysics` ne gère que les bords : sans
      // cette passe, ils se traversaient sans se voir. Le choc est résolu
      // APRÈS le pas de simulation, comme le roulement, pour ne pas toucher
      // au module partagé avec le rendu CSS de `main`.
      this.resolveContact();

      // LES PIONS FONT OBSTACLE aux dés de faveur aussi : ils roulent sur le
      // même plateau que le dé du tour.
      this.resolvePawns();

      if (moving) {
        this.frame = requestAnimationFrame(step);
        return;
      }

      this.frame = null;
      done(
        this.dice[0].physics.getState().currentValue,
        this.dice[1].physics.getState().currentValue
      );
    };

    this.frame = requestAnimationFrame(step);
  }

  /**
   * Fait se heurter les deux dés, et repose leur rendu si besoin.
   *
   * L'état de `DicePhysics` est mutable — c'est déjà ce dont le roulement se
   * sert pour imposer la rotation — donc corriger position et vitesse ici
   * suffit : le pas suivant repartira de la situation corrigée.
   */
  private resolveContact(): void {
    const [first, second] = this.dice;
    if (!first || !second) return;

    const a = bodyOf(first.physics);
    const b = bodyOf(second.physics);

    if (!collideBodies(a, b)) return;

    applyBody(first.physics, a);
    applyBody(second.physics, b);

    // Le rendu suit la correction dans la même image : sans cela les dés
    // s'interpénétreraient visiblement pendant une image avant de se
    // séparer, ce qui se voit comme un clignotement.
    first.view.setPosition(a.x, first.view.group.position.y, a.z);
    second.view.setPosition(b.x, second.view.group.position.y, b.z);
  }

  /** Fait rebondir chaque dé sur les pions posés. */
  private resolvePawns(): void {
    const obstacles = this.obstacles();
    if (obstacles.length === 0) return;

    for (const die of this.dice) {
      const body = bodyOf(die.physics);

      let touched = false;
      for (const obstacle of obstacles) {
        if (collideWithFixed(body, obstacle)) touched = true;
      }

      if (!touched) continue;

      applyBody(die.physics, body);
      die.view.setPosition(body.x, die.view.group.position.y, body.z);
    }
  }

  /**
   * Fait rouler le dé dans le sens de sa course.
   *
   * Même liaison que pour le dé du tour : un cube d'arête `a` qui avance de
   * `v` sans glisser bascule à `2·v/a`. Sans elle on voit un cube qui tourne
   * en glissant.
   */
  private applyRolling(state: ReturnType<DicePhysics['update']>): void {
    if (state.height > 0.5) return;

    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    if (speed < 1) return;

    const rate = rollingSpinRate(speed);

    state.spin.x = (-state.velocity.y / speed) * rate;
    state.spin.z = (state.velocity.x / speed) * rate;
    state.spin.y *= 0.9;
  }

  public dispose(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const die of this.dice) die.view.dispose();
  }
}
