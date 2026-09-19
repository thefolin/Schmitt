import {
  Group,
  Mesh,
  MeshLambertMaterial,
  BoxGeometry,
  CircleGeometry,
  Vector3,
  Color,
} from 'three';
import { DICE_FACES } from '@/features/dice/dice-faces';
import type { Quaternion } from '@/features/dice/quaternion';

/**
 * Le dé, dans la MÊME scène et sous la MÊME caméra que le plateau.
 *
 * C'est le juge de paix de la refonte. Les quatre défauts successifs du dé en
 * CSS venaient tous de la même racine : l'inclinaison de la scène était
 * dupliquée entre `board-camera.css`, `board.renderer.camera.ts` et
 * `Dice3D.ts`, et il fallait compter sur les développeurs pour les garder
 * synchronisées. Une inclinaison codée à 40° quand la scène était passée à
 * 58°, un lacet appliqué au mauvais endroit de la chaîne, un dé sans
 * l'écrasement du plateau — trois symptômes, une seule cause.
 *
 * Ici il n'y a plus deux représentations à accorder : le dé est un objet de la
 * scène, la caméra le voit comme elle voit les cases. Le désaccord face lue /
 * face vue ne peut plus exister par construction.
 *
 * La GÉOMÉTRIE DES FACES n'est pas redéfinie : elle vient de `dice-faces.ts`,
 * qui reste la source de vérité unique. Redéclarer ici quelle face porte quel
 * chiffre recréerait exactement le problème qu'on est en train de supprimer.
 */

/** Arête du dé, en unités monde. Un peu plus petit qu'une case. */
const DIE_SIZE = 86;

/** Rayon d'un point, proportionné à l'arête comme sur un vrai dé. */
const PIP_RADIUS = DIE_SIZE * 0.082;

/** Écart des points par rapport au centre d'une face. */
const PIP_SPREAD = DIE_SIZE * 0.23;

const DIE_COLOR = 0xf4f1e8;
const PIP_COLOR = 0x1b2436;

/**
 * Disposition des points, en unités de `PIP_SPREAD` depuis le centre.
 *
 * Reprend la disposition d'un dé réel : les valeurs impaires ont un point
 * central, les paires n'en ont pas.
 */
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export class Dice3DScene {
  readonly group = new Group();

  private readonly body: Mesh;

  constructor() {
    this.body = new Mesh(
      new BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE),
      new MeshLambertMaterial({ color: new Color(DIE_COLOR) })
    );
    this.body.name = 'die';
    this.group.add(this.body);

    this.addPips();
  }

  /**
   * Oriente le dé d'après la physique.
   *
   * La physique travaille dans un repère Y vers le BAS (convention CSS
   * héritée), Three.js dans un repère Y vers le HAUT. La conversion se fait
   * ICI, en un seul endroit : c'est elle qu'on aurait autrefois dupliquée.
   */
  public setOrientation(orientation: Quaternion): void {
    // Inverser l'axe Y d'un repère revient à changer le signe des composantes
    // x et z du quaternion, la composante y et le scalaire restant tels quels.
    this.body.quaternion.set(-orientation.x, orientation.y, -orientation.z, orientation.w);
  }

  /** Pose le dé à un endroit du plateau. */
  public setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Demi-arête, pour poser le dé sur une surface sans l'y enfoncer. */
  public static get halfSize(): number {
    return DIE_SIZE / 2;
  }

  /**
   * Grave les points sur les six faces.
   *
   * L'association face ↔ valeur vient de `DICE_FACES` : la même table que
   * celle dont la physique se sert pour lire le résultat. C'est ce qui rend
   * impossible qu'une face affiche un chiffre et que le jeu en annonce un
   * autre.
   */
  private addPips(): void {
    const geometry = new CircleGeometry(PIP_RADIUS, 16);
    const material = new MeshLambertMaterial({ color: new Color(PIP_COLOR) });

    for (const face of DICE_FACES) {
      const layout = PIP_LAYOUTS[face.value];
      if (!layout) continue;

      // La normale de la face, convertie du repère Y-bas de la physique vers
      // le repère Y-haut de Three.js.
      const normal = { x: face.normal.x, y: -face.normal.y, z: face.normal.z };

      for (const [u, v] of layout) {
        const pip = new Mesh(geometry, material);

        // Le disque est créé dans le plan XY, sa normale sur +Z : on le
        // tourne pour qu'il repose à plat sur la face.
        pip.quaternion.setFromUnitVectors(
          new Vector3(0, 0, 1),
          new Vector3(normal.x, normal.y, normal.z)
        );

        const offsets = this.pipOffsets(normal, u * PIP_SPREAD, v * PIP_SPREAD);

        // Très légèrement au-dessus de la face, pour ne pas s'y enfoncer.
        const lift = DIE_SIZE / 2 + 0.4;
        pip.position.set(
          normal.x * lift + offsets.x,
          normal.y * lift + offsets.y,
          normal.z * lift + offsets.z
        );

        pip.name = `pip-${face.value}`;
        this.body.add(pip);
      }
    }
  }

  /** Décale un point dans le plan de sa face. */
  private pipOffsets(
    normal: { x: number; y: number; z: number },
    u: number,
    v: number
  ): { x: number; y: number; z: number } {
    // Deux directions perpendiculaires à la normale, choisies de façon stable.
    const helper = Math.abs(normal.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };

    const right = {
      x: helper.y * normal.z - helper.z * normal.y,
      y: helper.z * normal.x - helper.x * normal.z,
      z: helper.x * normal.y - helper.y * normal.x,
    };
    const up = {
      x: normal.y * right.z - normal.z * right.y,
      y: normal.z * right.x - normal.x * right.z,
      z: normal.x * right.y - normal.y * right.x,
    };

    return {
      x: right.x * u + up.x * v,
      y: right.y * u + up.y * v,
      z: right.z * u + up.z * v,
    };
  }

  /** Libère géométries et matériaux. */
  public dispose(): void {
    this.group.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(m => m.dispose());
      else material.dispose();
    });
  }
}
