import { describe, it, expect } from 'vitest';
import {
  IDENTITY,
  fromAxisAngle,
  multiply,
  normalize,
  rotateVector,
  slerp,
  toCssMatrix3d,
} from '@/features/dice/quaternion';
import {
  DICE_FACES,
  FACE_NORMALS,
  readTopFace,
  faceAlignment,
  settleOrientation,
} from '@/features/dice/dice-faces';

const X = { x: 1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 };
const Z = { x: 0, y: 0, z: 1 };
const deg = (d: number) => (d * Math.PI) / 180;

describe('quaternion', () => {
  it('l\'identité ne change pas un vecteur', () => {
    const v = rotateVector(IDENTITY, { x: 1, y: 2, z: 3 });
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.y).toBeCloseTo(2, 6);
    expect(v.z).toBeCloseTo(3, 6);
  });

  it('une rotation de 90° autour de X envoie +Z sur -Y', () => {
    const q = fromAxisAngle(X, deg(90));
    const v = rotateVector(q, Z);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(-1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('une rotation de 90° autour de Y envoie +Z sur +X', () => {
    const q = fromAxisAngle(Y, deg(90));
    const v = rotateVector(q, Z);
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('quatre quarts de tour ramènent au point de départ', () => {
    const quarter = fromAxisAngle(X, deg(90));
    let q = IDENTITY;
    for (let i = 0; i < 4; i++) q = multiply(quarter, q);

    const v = rotateVector(q, Z);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.y).toBeCloseTo(0, 5);
    expect(v.z).toBeCloseTo(1, 5);
  });

  it('la composition n\'est pas commutative (comme les rotations réelles)', () => {
    const a = fromAxisAngle(X, deg(90));
    const b = fromAxisAngle(Y, deg(90));

    const ab = rotateVector(multiply(a, b), Z);
    const ba = rotateVector(multiply(b, a), Z);

    const identical =
      Math.abs(ab.x - ba.x) < 1e-6 &&
      Math.abs(ab.y - ba.y) < 1e-6 &&
      Math.abs(ab.z - ba.z) < 1e-6;
    expect(identical).toBe(false);
  });

  it('la rotation préserve la norme des vecteurs', () => {
    const q = normalize(multiply(fromAxisAngle(X, deg(37)), fromAxisAngle(Y, deg(113))));
    const v = rotateVector(q, { x: 3, y: -4, z: 12 });
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(13, 6);
  });

  it('normalize ramène un quaternion sur la sphère unité', () => {
    const q = normalize({ w: 3, x: 4, y: 0, z: 0 });
    expect(Math.hypot(q.w, q.x, q.y, q.z)).toBeCloseTo(1, 9);
  });

  it('normalize protège du quaternion nul', () => {
    expect(normalize({ w: 0, x: 0, y: 0, z: 0 })).toEqual(IDENTITY);
  });

  describe('slerp', () => {
    it('renvoie les extrémités en t=0 et t=1', () => {
      const a = IDENTITY;
      const b = fromAxisAngle(X, deg(90));

      const start = slerp(a, b, 0);
      expect(start.w).toBeCloseTo(a.w, 6);

      const end = slerp(a, b, 1);
      expect(end.w).toBeCloseTo(b.w, 6);
      expect(end.x).toBeCloseTo(b.x, 6);
    });

    it('à mi-chemin, donne bien la demi-rotation', () => {
      const half = slerp(IDENTITY, fromAxisAngle(X, deg(90)), 0.5);
      const expected = fromAxisAngle(X, deg(45));
      expect(half.w).toBeCloseTo(expected.w, 6);
      expect(half.x).toBeCloseTo(expected.x, 6);
    });

    it('reste unitaire tout au long de l\'interpolation', () => {
      const a = fromAxisAngle(X, deg(20));
      const b = fromAxisAngle(Y, deg(160));
      for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const q = slerp(a, b, t);
        expect(Math.hypot(q.w, q.x, q.y, q.z)).toBeCloseTo(1, 6);
      }
    });

    it('emprunte le chemin le plus court même si les signes s\'opposent', () => {
      const a = IDENTITY;
      const b = { w: -1, x: 0, y: 0, z: 0 }; // même orientation, signe opposé
      const mid = slerp(a, b, 0.5);
      // Le résultat doit rester proche de l'identité, pas partir à 180°
      expect(Math.abs(mid.w)).toBeCloseTo(1, 5);
    });
  });

  it('toCssMatrix3d produit une matrice CSS à 16 composantes', () => {
    const css = toCssMatrix3d(fromAxisAngle(Y, deg(30)));
    expect(css.startsWith('matrix3d(')).toBe(true);
    expect(css.slice('matrix3d('.length, -1).split(',')).toHaveLength(16);
  });
});

describe('géométrie du cube', () => {
  /**
   * Garde-fou central : la normale déclarée de chaque face doit correspondre à
   * sa transformation CSS. Si les deux divergent, le dé annonce un chiffre et
   * en affiche un autre — le bug exact qui avait motivé cette refonte.
   */
  it('chaque normale correspond à la rotation CSS de sa face', () => {
    const rotX = (v: typeof Z, d: number) => {
      const t = deg(d), c = Math.cos(t), s = Math.sin(t);
      return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
    };
    const rotY = (v: typeof Z, d: number) => {
      const t = deg(d), c = Math.cos(t), s = Math.sin(t);
      return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
    };

    for (const face of DICE_FACES) {
      const match = face.cssRotation.match(/rotate([XY])\((-?\d+)deg\)/);
      expect(match, `rotation CSS illisible : ${face.cssRotation}`).not.toBeNull();

      const [, axis, angle] = match!;
      // Une face est un plan tourné vers +Z avant sa rotation propre
      const actual = axis === 'X' ? rotX(Z, Number(angle)) : rotY(Z, Number(angle));

      expect(actual.x).toBeCloseTo(face.normal.x, 6);
      expect(actual.y).toBeCloseTo(face.normal.y, 6);
      expect(actual.z).toBeCloseTo(face.normal.z, 6);
    }
  });

  it('décrit exactement 6 faces, une par valeur', () => {
    expect(DICE_FACES).toHaveLength(6);
    expect(DICE_FACES.map(f => f.value).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('lecture de la face du dé', () => {
  it('les 6 faces sont définies avec des normales unitaires', () => {
    expect(FACE_NORMALS).toHaveLength(6);
    const values = FACE_NORMALS.map(f => f.value).sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3, 4, 5, 6]);

    for (const { normal } of FACE_NORMALS) {
      expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 9);
    }
  });

  it('les faces opposées totalisent 7, comme sur un vrai dé', () => {
    for (const face of FACE_NORMALS) {
      const opposite = FACE_NORMALS.find(f =>
        f.normal.x === -face.normal.x &&
        f.normal.y === -face.normal.y &&
        f.normal.z === -face.normal.z
      );
      expect(opposite).toBeDefined();
      expect(face.value + opposite!.value).toBe(7);
    }
  });

  it('sans rotation, la face 1 est vers le haut', () => {
    expect(readTopFace(IDENTITY)).toBe(1);
  });

  it('retournée de 180°, c\'est la face opposée (6) qui apparaît', () => {
    expect(readTopFace(fromAxisAngle(X, deg(180)))).toBe(6);
  });

  it('chaque face peut être amenée vers le haut et relue correctement', () => {
    const cases: { value: number; q: ReturnType<typeof fromAxisAngle> }[] = [
      { value: 1, q: IDENTITY },
      { value: 6, q: fromAxisAngle(X, deg(180)) },
      { value: 2, q: fromAxisAngle(X, deg(90)) },
      { value: 5, q: fromAxisAngle(X, deg(-90)) },
      { value: 4, q: fromAxisAngle(Z, deg(90)) },
      { value: 3, q: fromAxisAngle(Z, deg(-90)) },
    ];

    for (const { value, q } of cases) {
      expect(readTopFace(q)).toBe(value);
    }
  });

  it('renvoie toujours une valeur valide, quelle que soit l\'orientation', () => {
    for (let i = 0; i < 300; i++) {
      const q = normalize({
        w: Math.random() * 2 - 1,
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random() * 2 - 1,
      });
      const value = readTopFace(q);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('des orientations aléatoires produisent les 6 valeurs (pas de face inatteignable)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      seen.add(readTopFace(normalize({
        w: Math.random() * 2 - 1,
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random() * 2 - 1,
      })));
    }
    expect(seen.size).toBe(6);
  });
});

describe('faceAlignment', () => {
  it('vaut 1 quand une face est parfaitement horizontale', () => {
    expect(faceAlignment(IDENTITY)).toBeCloseTo(1, 6);
    expect(faceAlignment(fromAxisAngle(X, deg(90)))).toBeCloseTo(1, 6);
  });

  it('chute nettement quand le dé est en équilibre sur une arête', () => {
    expect(faceAlignment(fromAxisAngle(X, deg(45)))).toBeLessThan(0.75);
  });

  it('est plus faible sur une arête que posé à plat', () => {
    const flat = faceAlignment(IDENTITY);
    const tilted = faceAlignment(fromAxisAngle(Z, deg(40)));
    expect(tilted).toBeLessThan(flat);
  });
});

describe('settleOrientation', () => {
  it('laisse inchangée une orientation déjà à plat', () => {
    expect(faceAlignment(settleOrientation(IDENTITY))).toBeCloseTo(1, 6);
  });

  it('redresse un dé penché jusqu\'à l\'horizontale', () => {
    const tilted = fromAxisAngle(X, deg(30));
    expect(faceAlignment(tilted)).toBeLessThan(0.95);
    expect(faceAlignment(settleOrientation(tilted))).toBeCloseTo(1, 5);
  });

  it('ne change JAMAIS la valeur lue en redressant le dé', () => {
    // Garantie essentielle : le redressement est cosmétique, il ne doit pas
    // transformer un 3 en 5 au dernier moment.
    for (let i = 0; i < 500; i++) {
      const q = normalize({
        w: Math.random() * 2 - 1,
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random() * 2 - 1,
      });
      expect(readTopFace(settleOrientation(q))).toBe(readTopFace(q));
    }
  });

  it('produit toujours une orientation à plat depuis n\'importe quel angle', () => {
    for (let i = 0; i < 200; i++) {
      const q = normalize({
        w: Math.random() * 2 - 1,
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random() * 2 - 1,
      });
      expect(faceAlignment(settleOrientation(q))).toBeCloseTo(1, 4);
    }
  });
});
