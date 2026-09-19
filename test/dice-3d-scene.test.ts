import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { Dice3DScene } from '@/features/board/scene3d/dice-3d-scene';
import { DICE_FACES, readTopFace, settleOrientation } from '@/features/dice/dice-faces';
import {
  IDENTITY,
  fromAxisAngle,
  multiply,
  normalize,
  type Quaternion,
} from '@/features/dice/quaternion';

/**
 * 3D-44 — le dé affiché montre la face que la physique annonce.
 *
 * La conversion de repère est l'endroit exact où vivaient les anciens
 * défauts : la physique travaille en Y vers le BAS (convention CSS héritée),
 * Three.js en Y vers le HAUT. Se tromper de signe donne un dé qui roule
 * correctement mais affiche l'opposé — et comme 1+6, 2+5 et 3+4 font 7, le
 * chiffre affiché reste plausible. C'est ce qui rend le défaut si difficile à
 * repérer à l'œil et si facile à vérifier par le calcul.
 */

function seeded(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/** La face effectivement tournée vers le haut de l'écran, dans la scène. */
function faceShownUpward(die: Dice3DScene): number {
  const body = die.group.getObjectByName('die')!;
  body.updateMatrixWorld(true);

  let best = -Infinity;
  let value = 0;

  for (const face of DICE_FACES) {
    // La normale telle que la physique la décrit, convertie en Y-haut.
    const local = new Vector3(face.normal.x, -face.normal.y, face.normal.z);
    const world = local.applyQuaternion(body.quaternion);

    // Le haut de la scène Three.js, sans ambiguïté.
    if (world.y > best) {
      best = world.y;
      value = face.value;
    }
  }

  return value;
}

describe('3D-44 — le rendu et la physique disent la même chose', () => {
  it('affiche vers le haut la face que la physique lit', () => {
    const die = new Dice3DScene();
    const random = seeded(31337);

    for (let trial = 0; trial < 600; trial++) {
      let q: Quaternion = IDENTITY;
      q = normalize(multiply(fromAxisAngle({ x: 0, y: 1, z: 0 }, random() * Math.PI * 2), q));
      q = normalize(multiply(fromAxisAngle({ x: 1, y: 0, z: 0 }, random() * Math.PI * 2), q));
      q = normalize(multiply(fromAxisAngle({ x: 0, y: 0, z: 1 }, random() * Math.PI * 2), q));

      const settled = settleOrientation(q);
      die.setOrientation(settled);

      // Ce que le jeu annonce, et ce que le joueur voit : le même chiffre.
      expect(faceShownUpward(die)).toBe(readTopFace(settled));
    }

    die.dispose();
  });

  it('n\'affiche jamais la face opposée', () => {
    // Le symptôme d'un signe inversé dans la conversion de repère. Il mérite
    // son propre test parce qu'il est plausible à l'œil : les faces opposées
    // d'un dé totalisent 7, donc le chiffre affiché reste crédible.
    const die = new Dice3DScene();
    const random = seeded(4242);

    for (let trial = 0; trial < 300; trial++) {
      let q: Quaternion = IDENTITY;
      q = normalize(multiply(fromAxisAngle({ x: 1, y: 0, z: 0 }, random() * Math.PI * 2), q));
      q = normalize(multiply(fromAxisAngle({ x: 0, y: 0, z: 1 }, random() * Math.PI * 2), q));

      const settled = settleOrientation(q);
      die.setOrientation(settled);

      const read = readTopFace(settled);

      expect(faceShownUpward(die)).not.toBe(7 - read);
    }

    die.dispose();
  });

  it('grave les six faces avec le bon nombre de points', () => {
    const die = new Dice3DScene();

    for (const face of DICE_FACES) {
      const pips = die.group.getObjectByName('die')!.children.filter(
        child => child.name === `pip-${face.value}`
      );

      // Une face qui porte le mauvais nombre de points affiche un chiffre
      // faux quoi que dise la physique.
      expect(pips.length).toBe(face.value);
    }

    die.dispose();
  });

  it('pose les points sur leur face, pas ailleurs', () => {
    const die = new Dice3DScene();
    const body = die.group.getObjectByName('die')!;

    for (const face of DICE_FACES) {
      const normal = new Vector3(face.normal.x, -face.normal.y, face.normal.z);

      for (const pip of body.children.filter(c => c.name === `pip-${face.value}`)) {
        // Le point doit se trouver du côté de sa face, à sa surface.
        const along = pip.position.dot(normal);

        expect(along).toBeGreaterThan(Dice3DScene.halfSize * 0.98);
      }
    }

    die.dispose();
  });
});
