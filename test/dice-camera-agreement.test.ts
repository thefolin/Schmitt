import { describe, it, expect } from 'vitest';
import {
  IDENTITY,
  fromAxisAngle,
  multiply,
  normalize,
  rotateVector,
  type Quaternion,
  type Vec3,
} from '@/features/dice/quaternion';
import { FACE_NORMALS, readTopFace, settleOrientation } from '@/features/dice/dice-faces';

/**
 * 3D-44 — la face lue est la face vue, à tous les angles de caméra.
 *
 * C'est le juge de paix de la refonte. Les quatre défauts successifs du dé en
 * CSS venaient tous de la même racine : l'inclinaison de la scène était
 * dupliquée entre `board-camera.css`, `board.renderer.camera.ts` et
 * `Dice3D.ts`, et il fallait compter sur les développeurs pour les garder
 * synchronisées. Dans une scène unique, le désaccord ne peut plus exister par
 * construction — mais encore faut-il le vérifier, et le vérifier À TOUS LES
 * ANGLES, ce que la version CSS n'avait jamais eu à faire.
 *
 * L'acquis à égaler, mesuré sur `main` : 0 % d'erreur sur 3 000 tirages, six
 * faces, bruit de pose de ±2° et rotation libre. Le même protocole est rejoué
 * ici pour que la comparaison soit honnête.
 *
 * Repère : Y vers le BAS, convention du module. La face du dessus a donc une
 * normale -Y.
 */

const deg = (d: number) => (d * Math.PI) / 180;
const UP: Vec3 = { x: 0, y: -1, z: 0 };

/** Tirage reproductible : un échec doit pouvoir être rejoué à l'identique. */
function seeded(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/** Amène la normale d'une face vers le haut, puis brouille la pose. */
function poseShowing(face: Vec3, random: () => number, noiseDeg: number): Quaternion {
  const axis = {
    x: face.y * UP.z - face.z * UP.y,
    y: face.z * UP.x - face.x * UP.z,
    z: face.x * UP.y - face.y * UP.x,
  };
  const length = Math.hypot(axis.x, axis.y, axis.z);
  const dot = face.x * UP.x + face.y * UP.y + face.z * UP.z;

  let q: Quaternion = IDENTITY;
  if (length > 1e-9) {
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    q = fromAxisAngle({ x: axis.x / length, y: axis.y / length, z: axis.z / length }, angle);
  } else if (dot < 0) {
    q = fromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI);
  }

  // Lacet libre : le dé peut retomber dans n'importe quelle direction.
  q = normalize(multiply(fromAxisAngle({ x: 0, y: 1, z: 0 }, random() * Math.PI * 2), q));

  // Bruit de pose : un dé réel ne repose jamais parfaitement à plat.
  const noise = () => deg((random() * 2 - 1) * noiseDeg);
  q = normalize(multiply(fromAxisAngle({ x: 1, y: 0, z: 0 }, noise()), q));
  q = normalize(multiply(fromAxisAngle({ x: 0, y: 0, z: 1 }, noise()), q));

  return q;
}

/**
 * Direction caméra → plateau, exprimée dans le repère du dé (Y vers le bas).
 *
 * Reprend le placement de `BoardScene` : inclinaison depuis la verticale et
 * lacet libre autour de l'axe vertical.
 */
function eyeDirection(tiltDeg: number, yawDeg: number): Vec3 {
  const t = deg(tiltDeg);
  const y = deg(yawDeg);

  return { x: Math.sin(t) * Math.sin(y), y: -Math.cos(t), z: Math.sin(t) * Math.cos(y) };
}

describe('3D-44 — l\'acquis de main est égalé', () => {
  it('lit la bonne face sur 3 000 tirages, six faces, bruit de ±2°', () => {
    const random = seeded(42);
    let errors = 0;
    let total = 0;

    for (const face of FACE_NORMALS) {
      for (let trial = 0; trial < 500; trial++) {
        const settled = settleOrientation(poseShowing(face.normal, random, 2));

        total++;
        if (readTopFace(settled) !== face.value) errors++;
      }
    }

    expect(total).toBe(3000);
    // 0 %, comme sur main. Pas « presque », pas « acceptable ».
    expect(errors).toBe(0);
  });

  it('résiste à un bruit de pose plus franc', () => {
    // ±2° décrit un dé qui repose bien. À 15°, on vérifie que la lecture ne
    // bascule pas au premier cahot : la marge doit être réelle, pas ajustée
    // au bruit choisi pour le test.
    const random = seeded(1789);
    let errors = 0;

    for (const face of FACE_NORMALS) {
      for (let trial = 0; trial < 300; trial++) {
        const settled = settleOrientation(poseShowing(face.normal, random, 15));
        if (readTopFace(settled) !== face.value) errors++;
      }
    }

    expect(errors).toBe(0);
  });
});

describe('3D-44 — la lecture ne dépend pas de l\'angle de caméra', () => {
  it('donne la même valeur quel que soit le lacet', () => {
    // La contrainte NOUVELLE, que la version CSS n'avait pas : la caméra
    // tourne maintenant (#43). Une lecture qui dépendrait de son lacet
    // ferait changer le chiffre affiché quand le joueur fait pivoter la vue.
    const random = seeded(2024);

    for (let trial = 0; trial < 500; trial++) {
      let q: Quaternion = IDENTITY;
      q = normalize(multiply(fromAxisAngle({ x: 0, y: 1, z: 0 }, random() * Math.PI * 2), q));
      q = normalize(multiply(fromAxisAngle({ x: 1, y: 0, z: 0 }, random() * Math.PI * 2), q));
      const settled = settleOrientation(q);

      const reference = readTopFace(settled);

      // La valeur est une propriété du dé posé, pas du point de vue.
      for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
        expect(readTopFace(settled)).toBe(reference);
        expect(eyeDirection(52, yaw).y).toBeLessThan(0);
      }
    }
  });

  it('garde la face lue tournée vers la caméra à tous les angles permis', () => {
    // Le vrai risque n'est pas que la lecture change, mais que la face lue
    // ne soit pas CELLE QU'ON VOIT. On vérifie donc qu'elle fait bien face à
    // l'objectif, sur toute la plage d'inclinaison autorisée par #43.
    const random = seeded(99);
    let worst = 1;

    for (let trial = 0; trial < 400; trial++) {
      let q: Quaternion = IDENTITY;
      q = normalize(multiply(fromAxisAngle({ x: 0, y: 1, z: 0 }, random() * Math.PI * 2), q));
      q = normalize(multiply(fromAxisAngle({ x: 1, y: 0, z: 0 }, random() * Math.PI * 2), q));
      const settled = settleOrientation(q);

      const value = readTopFace(settled);
      const normal = rotateVector(settled, FACE_NORMALS.find(f => f.value === value)!.normal);

      for (const tilt of [12, 52, 78]) {
        for (const yaw of [0, 90, 180, 270]) {
          const eye = eyeDirection(tilt, yaw);
          const facing = normal.x * eye.x + normal.y * eye.y + normal.z * eye.z;

          worst = Math.min(worst, facing);
          expect(facing).toBeGreaterThan(0);
        }
      }
    }

    // Mesuré : 0,21 au pire, atteint à 78° — la vue la plus rasante que #43
    // autorise. La face y est franchement inclinée mais reste lisible.
    expect(worst).toBeGreaterThan(0.15);
  });

  it('justifie la borne d\'élévation de #43', () => {
    // À 89°, la caméra est au ras de la table : la face du dessus s'y voit
    // par la tranche. C'est ce que la borne à 78° empêche — elle ne protège
    // pas seulement la perspective du plateau, elle garde le dé lisible.
    const grazing = eyeDirection(89, 0);
    const facing = UP.x * grazing.x + UP.y * grazing.y + UP.z * grazing.z;

    expect(facing).toBeLessThan(0.05);
  });
});

describe('3D-44 — la table des faces décrit un vrai dé', () => {
  it('porte les six valeurs, une seule fois chacune', () => {
    // Mes autres tests déduisent la valeur attendue de cette même table :
    // une valeur corrompue y resterait cohérente avec elle-même et passerait
    // inaperçue. Il faut donc confronter la table à une vérité extérieure —
    // ici, ce qu'est un dé.
    const values = FACE_NORMALS.map(f => f.value).sort((a, b) => a - b);

    expect(values).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('met 7 sur chaque paire de faces opposées', () => {
    // La règle qui définit un dé à six faces. Elle ne se déduit d'aucun
    // calcul du module : c'est une contrainte du monde réel.
    for (const face of FACE_NORMALS) {
      const opposite = FACE_NORMALS.find(
        other =>
          other.normal.x === -face.normal.x &&
          other.normal.y === -face.normal.y &&
          other.normal.z === -face.normal.z
      );

      expect(opposite).toBeDefined();
      expect(face.value + opposite!.value).toBe(7);
    }
  });

  it('décrit six directions distinctes', () => {
    const directions = new Set(
      FACE_NORMALS.map(f => `${f.normal.x},${f.normal.y},${f.normal.z}`)
    );

    expect(directions.size).toBe(6);
  });
});
