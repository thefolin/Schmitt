/**
 * Quaternions pour l'orientation 3D du dé.
 *
 * Pourquoi pas des angles d'Euler : composer des rotations en X/Y/Z souffre du
 * gimbal lock (perte d'un degré de liberté quand deux axes s'alignent) et rend
 * les culbutes saccadées. Un quaternion compose proprement les rotations
 * successives, ce qui est exactement ce dont on a besoin pour un dé qui roule.
 */

export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/**
 * Quaternion représentant une rotation d'un angle (radians) autour d'un axe.
 * L'axe doit être normalisé.
 */
export function fromAxisAngle(axis: Vec3, angleRad: number): Quaternion {
  const half = angleRad / 2;
  const s = Math.sin(half);
  return {
    w: Math.cos(half),
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
  };
}

/**
 * Compose deux rotations : applique `b` puis `a`.
 */
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function normalize(q: Quaternion): Quaternion {
  const len = Math.hypot(q.w, q.x, q.y, q.z);
  if (len === 0) return { ...IDENTITY };
  return { w: q.w / len, x: q.x / len, y: q.y / len, z: q.z / len };
}

/**
 * Applique la rotation d'un quaternion à un vecteur.
 */
export function rotateVector(q: Quaternion, v: Vec3): Vec3 {
  // v' = q * v * q⁻¹, développé pour éviter deux multiplications complètes
  const { w, x, y, z } = q;
  const tx = 2 * (y * v.z - z * v.y);
  const ty = 2 * (z * v.x - x * v.z);
  const tz = 2 * (x * v.y - y * v.x);
  return {
    x: v.x + w * tx + (y * tz - z * ty),
    y: v.y + w * ty + (z * tx - x * tz),
    z: v.z + w * tz + (x * ty - y * tx),
  };
}

/**
 * Interpolation sphérique entre deux orientations : donne un mouvement de
 * rotation régulier, sans à-coup, contrairement à une interpolation linéaire
 * des angles.
 */
export function slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let cosHalfTheta = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;

  // Prendre le chemin le plus court sur la sphère
  let target = b;
  if (cosHalfTheta < 0) {
    target = { w: -b.w, x: -b.x, y: -b.y, z: -b.z };
    cosHalfTheta = -cosHalfTheta;
  }

  // Quasi identiques : interpolation linéaire suffit et évite une division par ~0
  if (cosHalfTheta > 0.9995) {
    return normalize({
      w: a.w + (target.w - a.w) * t,
      x: a.x + (target.x - a.x) * t,
      y: a.y + (target.y - a.y) * t,
      z: a.z + (target.z - a.z) * t,
    });
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sin(halfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  return {
    w: a.w * ratioA + target.w * ratioB,
    x: a.x * ratioA + target.x * ratioB,
    y: a.y * ratioA + target.y * ratioB,
    z: a.z * ratioA + target.z * ratioB,
  };
}

/**
 * Convertit un quaternion en matrice CSS `matrix3d`, pour appliquer
 * l'orientation directement au cube sans repasser par des angles d'Euler.
 */
export function toCssMatrix3d(q: Quaternion): string {
  const { w, x, y, z } = normalize(q);

  const m = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];

  return `matrix3d(${m.map(n => n.toFixed(6)).join(',')})`;
}
