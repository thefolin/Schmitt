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

  constructor(private readonly arena: DiceArena) {
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
   * Lance les deux dés et rend la main quand les DEUX se sont arrêtés.
   *
   * Les deux faces sont lues sur la physique, comme celle du dé du tour :
   * c'est la face posée sur le dessus, pas un tirage séparé. Annoncer une
   * faveur qui ne correspond pas aux dés posés sur la table rejouerait le
   * défaut que toute la refonte supprime.
   */
  public roll(done: (a: number, b: number) => void): void {
    if (this.frame !== null) return;

    // La VISIBILITÉ n'est pas décidée ici : `dice-on-stage` en est seul juge,
    // parce qu'elle concerne aussi le dé du tour, qui doit s'effacer pendant
    // la faveur. La régler des deux côtés a déjà donné trois dés à l'écran.
    for (const die of this.dice) die.physics.throw();

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
