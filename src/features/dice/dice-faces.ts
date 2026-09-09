import { rotateVector, fromAxisAngle, multiply, normalize, type Quaternion, type Vec3 } from './quaternion';

/**
 * Géométrie du dé : SOURCE DE VÉRITÉ UNIQUE.
 *
 * Chaque entrée associe une valeur à une face du cube, décrite à la fois par
 * sa normale (pour la physique) et par sa transformation CSS (pour le rendu).
 * Les deux sont définies ici ensemble, car les séparer avait justement produit
 * un dé qui annonçait un chiffre et en affichait un autre.
 *
 * Sur un vrai dé, les faces opposées totalisent 7 (1-6, 2-5, 3-4) : la
 * répartition ci-dessous respecte cette règle.
 *
 * Repère : X vers la droite, Y vers le BAS (convention CSS), Z vers le
 * spectateur. La face du dessus a donc une normale -Y.
 */
export interface DiceFace {
  value: number;
  normal: Vec3;
  /** Rotation CSS plaçant cette face sur le cube (avant translateZ). */
  cssRotation: string;
}

export const DICE_FACES: DiceFace[] = [
  { value: 1, normal: { x: 0, y: -1, z: 0 }, cssRotation: 'rotateX(90deg)' },   // dessus
  { value: 6, normal: { x: 0, y: 1, z: 0 }, cssRotation: 'rotateX(-90deg)' },   // dessous (1+6=7)
  { value: 2, normal: { x: 0, y: 0, z: 1 }, cssRotation: 'rotateY(0deg)' },     // avant
  { value: 5, normal: { x: 0, y: 0, z: -1 }, cssRotation: 'rotateY(180deg)' },  // arrière (2+5=7)
  { value: 3, normal: { x: 1, y: 0, z: 0 }, cssRotation: 'rotateY(90deg)' },    // droite
  { value: 4, normal: { x: -1, y: 0, z: 0 }, cssRotation: 'rotateY(-90deg)' },  // gauche  (3+4=7)
];

/** Normales seules, pour les calculs d'orientation. */
export const FACE_NORMALS: { value: number; normal: Vec3 }[] = DICE_FACES.map(
  ({ value, normal }) => ({ value, normal })
);

/** Direction du "haut" à l'écran (Y CSS pointe vers le bas). */
const UP: Vec3 = { x: 0, y: -1, z: 0 };

/**
 * Lit la valeur du dé depuis son orientation : la face dont la normale, une
 * fois tournée, pointe le plus vers le haut est celle qu'on voit.
 *
 * C'est l'inverse de l'ancienne approche (tirer un chiffre puis forcer
 * l'orientation) : ici le chiffre est une conséquence de la physique, comme
 * avec un vrai dé.
 */
export function readTopFace(orientation: Quaternion): number {
  let bestValue = 1;
  let bestDot = -Infinity;

  for (const face of FACE_NORMALS) {
    const worldNormal = rotateVector(orientation, face.normal);
    const dot = worldNormal.x * UP.x + worldNormal.y * UP.y + worldNormal.z * UP.z;
    if (dot > bestDot) {
      bestDot = dot;
      bestValue = face.value;
    }
  }

  return bestValue;
}

/**
 * Mesure à quel point le dé repose à plat : 1 = une face parfaitement
 * horizontale, valeurs plus faibles = posé de travers, en équilibre sur une
 * arête ou un coin.
 */
export function faceAlignment(orientation: Quaternion): number {
  let best = -Infinity;
  for (const face of FACE_NORMALS) {
    const n = rotateVector(orientation, face.normal);
    const dot = n.x * UP.x + n.y * UP.y + n.z * UP.z;
    if (dot > best) best = dot;
  }
  return best;
}

/**
 * Orientation à plat la plus proche : celle qui met la face actuellement la
 * plus haute exactement à l'horizontale. Sert à finir la chute proprement,
 * sans jamais changer la valeur déjà déterminée par la physique.
 */
export function settleOrientation(orientation: Quaternion): Quaternion {
  const value = readTopFace(orientation);
  const face = FACE_NORMALS.find(f => f.value === value)!;

  const current = rotateVector(orientation, face.normal);
  const axis = {
    x: current.y * UP.z - current.z * UP.y,
    y: current.z * UP.x - current.x * UP.z,
    z: current.x * UP.y - current.y * UP.x,
  };

  const axisLength = Math.hypot(axis.x, axis.y, axis.z);
  const dot = Math.max(-1, Math.min(1, current.x * UP.x + current.y * UP.y + current.z * UP.z));

  // Déjà aligné (ou exactement à l'opposé, cas dégénéré) : rien à corriger
  if (axisLength < 1e-6) return orientation;

  const angle = Math.acos(dot);
  const correction = fromAxisAngle(
    { x: axis.x / axisLength, y: axis.y / axisLength, z: axis.z / axisLength },
    angle
  );

  return normalize(multiply(correction, orientation));
}
