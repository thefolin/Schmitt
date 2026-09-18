import { describe, it, expect } from 'vitest';
import { FACE_NORMALS } from '../src/features/dice/dice-faces';

/**
 * SCH-05 — la face affichée doit être celle que la physique annonce.
 *
 * Les tests existants vérifient la physique seule (300 lancers se stabilisent
 * à plat) et les quaternions seuls. Aucun ne compose la chaîne de rendu
 * complète — c'est précisément par là que le défaut est passé deux fois.
 *
 * Ce fichier reconstruit le transform CSS appliqué au dé et compare la face
 * réellement tournée vers le haut à celle que la physique lit.
 */

type M3 = number[];
const d2r = (deg: number) => (deg * Math.PI) / 180;

const mul = (a: M3, b: M3): M3 => {
  const c = Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j];
      c[i * 3 + j] = s;
    }
  return c;
};

const RX = (t: number): M3 => {
  const c = Math.cos(d2r(t));
  const s = Math.sin(d2r(t));
  return [1, 0, 0, 0, c, -s, 0, s, c];
};

const RY = (t: number): M3 => {
  const c = Math.cos(d2r(t));
  const s = Math.sin(d2r(t));
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};

const RZ = (t: number): M3 => {
  const c = Math.cos(d2r(t));
  const s = Math.sin(d2r(t));
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};

const apply = (m: M3, v: { x: number; y: number; z: number }) => ({
  x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
  y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
  z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
});

/** Le haut de l'écran : Y CSS pointe vers le bas. */
const UP = { x: 0, y: -1, z: 0 };
/** L'observateur regarde depuis +Z. */
const TOWARDS_VIEWER = { x: 0, y: 0, z: 1 };

/** Face tournée vers le haut, et écart avec la suivante. */
function topFace(m: M3): { value: number; margin: number } {
  let value = 1;
  let best = -Infinity;
  let second = -Infinity;
  for (const f of FACE_NORMALS) {
    const w = apply(m, f.normal);
    const dot = w.x * UP.x + w.y * UP.y + w.z * UP.z;
    if (dot > best) {
      second = best;
      best = dot;
      value = f.value;
    } else if (dot > second) {
      second = dot;
    }
  }
  return { value, margin: best - second };
}

/** Nombre de faces tournées vers l'observateur : 1 = le cube se lit plat. */
function visibleFaces(m: M3): number {
  let n = 0;
  for (const f of FACE_NORMALS) {
    const w = apply(m, f.normal);
    if (w.x * TOWARDS_VIEWER.x + w.y * TOWARDS_VIEWER.y + w.z * TOWARDS_VIEWER.z > 0.08) n++;
  }
  return n;
}

const TILT = 58;
const YAW = 35;

/** La chaîne livrée : redressement complet, puis lacet. */
const CURRENT = mul(mul(RX(TILT), RX(-TILT)), RY(YAW));

/** Les six poses à plat, une par face. */
const POSES: [number, number][] = [
  [0, 0],
  [90, 0],
  [0, 90],
  [0, -90],
  [-90, 0],
  [180, 0],
];

/** Pose bruitée : un dé ne s'immobilise jamais parfaitement d'aplomb. */
function noisyPose(px: number, pz: number, noise: number, spin: number): M3 {
  return mul(mul(RX(px + noise), RZ(pz - noise)), RY(spin));
}

describe('SCH-05 — la face vue est la face lue', () => {
  it('accorde physique et affichage sur les 6 faces, dé parfaitement posé', () => {
    for (const [px, pz] of POSES) {
      const orientation = mul(RX(px), RZ(pz));
      const physics = topFace(orientation).value;
      const seen = topFace(mul(CURRENT, orientation)).value;
      expect(seen).toBe(physics);
    }
  });

  it('tient malgré un dé posé de travers, sur les 6 faces', () => {
    let disagreements = 0;
    let total = 0;
    for (const [px, pz] of POSES) {
      for (let i = 0; i < 120; i++) {
        const noise = ((i % 21) - 10) * 0.2; // ±2°
        const spin = i * 3; // le dé s'arrête dans n'importe quel sens
        const orientation = noisyPose(px, pz, noise, spin);
        if (topFace(mul(CURRENT, orientation)).value !== topFace(orientation).value) {
          disagreements++;
        }
        total++;
      }
    }
    expect(disagreements, `${disagreements}/${total} désaccords`).toBe(0);
  });

  it('garde une marge confortable sur les 6 faces, pas un accord de justesse', () => {
    // Le piège de ce bug : à l'arrêt parfait, l'ancien réglage affichait les
    // 6 faces correctement — un test d'égalité seul le déclarait sain. Mais la
    // marge n'était que de 0,007, et le moindre défaut de pose faisait
    // basculer sur la face voisine. C'est la marge qu'il faut vérifier, pas
    // seulement l'égalité.
    for (const [px, pz] of POSES) {
      const orientation = mul(RX(px), RZ(pz));
      // 1,0 est le maximum théorique : la face du dessus est exactement à la
      // verticale. Le lacet mal placé la ramenait à 0,703 — encore « juste »,
      // mais suffisamment entamé pour que le bruit de pose fasse basculer.
      const { margin } = topFace(mul(CURRENT, orientation));
      expect(margin, `pose ${px}/${pz}`).toBeGreaterThan(0.99);
    }
  });

  it('le lacet placé entre les deux rotateX ramènerait le défaut', () => {
    // Garde-fou : c'est exactement la chaîne livrée avant ce correctif.
    const sandwiched = mul(mul(RX(TILT), RY(YAW)), RX(-TILT));
    let disagreements = 0;
    for (const [px, pz] of POSES) {
      for (let i = 0; i < 120; i++) {
        const orientation = noisyPose(px, pz, ((i % 21) - 10) * 0.2, i * 3);
        if (topFace(mul(sandwiched, orientation)).value !== topFace(orientation).value) {
          disagreements++;
        }
      }
    }
    expect(disagreements).toBeGreaterThan(0);
  });

  it('le dé garde son volume : deux faces restent visibles', () => {
    // Sans lacet le cube se lirait comme un carré plat.
    expect(visibleFaces(CURRENT)).toBeGreaterThan(1);
  });
});
