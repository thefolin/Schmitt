/**
 * Secouer le téléphone pour lancer le dé.
 *
 * Itération 2 du mode cinéma. Le bouton reste : il n'est pas un pis-aller
 * mais le chemin qui marche toujours — sur ordinateur, quand les capteurs
 * sont refusés, et quand le joueur ne veut simplement pas agiter son
 * téléphone au-dessus de la table.
 *
 * LE SEUIL EST LE COEUR DU SUJET, et il ne se règle pas dans un test. Trop
 * bas, le dé part quand on pose le téléphone ; trop haut, le joueur secoue
 * trois fois sans rien obtenir. Ce module rend la DÉCISION vérifiable — à
 * partir de quelle lecture on considère qu'il y a eu geste — pour que le
 * réglage se fasse sur un vrai téléphone en ne changeant qu'un nombre.
 *
 * Module PUR : il ne s'abonne à rien et ne lance aucun dé.
 */

/** La pesanteur, en m/s². */
export const GRAVITY = 9.81;

/**
 * Le seuil, mesuré SANS la gravité.
 *
 * `DeviceMotionEvent` expose deux lectures, et le choix décide de tout :
 *
 *   - `acceleration` est déjà débarrassé de la pesanteur, mais vaut `null`
 *     sur beaucoup d'Android — il ne peut donc pas être le seul chemin ;
 *   - `accelerationIncludingGravity` existe partout, mais un téléphone POSÉ
 *     y lit déjà 9,81. Comparer 25 à cette lecture-là ne laisse que 15 de
 *     marge réelle, et le geste devient bien plus facile à déclencher qu'il
 *     n'y paraît.
 *
 * On ramène donc les deux lectures à la même échelle — sans la pesanteur —
 * avant de comparer, et le seuil s'exprime dans cette échelle.
 *
 * 18 plutôt que 25 : un geste volontaire de lancer se situe entre 20 et 40,
 * un téléphone posé brusquement autour de 10-15. 18 se place entre les deux,
 * plus près du bruit que du geste, parce qu'un lancer manqué se rattrape
 * d'un second geste alors qu'un lancer parti tout seul ne se rattrape pas —
 * dans un jeu à boire, un jet est un jet.
 */
export const SHAKE_THRESHOLD = 18;

/**
 * Temps mort après un lancer accepté.
 *
 * Un geste de secousse n'est PAS un pic isolé : le téléphone repart en sens
 * inverse et repasse le seuil plusieurs fois en une fraction de seconde. Sans
 * ce délai, un seul geste lancerait le dé deux ou trois fois.
 *
 * 900 ms couvre le geste complet et son rebond, sans empêcher un joueur
 * pressé d'enchaîner deux tours.
 */
export const SHAKE_DEBOUNCE_MS = 900;

/** Ce qu'un événement de mouvement apporte, réduit à ce qui sert. */
export interface MotionReading {
  /** Accélération déjà débarrassée de la pesanteur, ou `null`. */
  acceleration?: { x?: number | null; y?: number | null; z?: number | null } | null;
  /** Accélération brute, pesanteur comprise. Présente à peu près partout. */
  accelerationIncludingGravity?: {
    x?: number | null;
    y?: number | null;
    z?: number | null;
  } | null;
}

/**
 * L'intensité du mouvement, pesanteur retirée.
 *
 * Renvoie `null` quand la lecture n'apporte rien d'exploitable : mieux vaut
 * ne pas décider que décider sur des zéros. Un appareil qui ne renseigne
 * aucun des deux champs ne doit pas se mettre à lancer le dé.
 */
export function motionIntensity(reading: MotionReading): number | null {
  const clean = reading.acceleration;

  // Le chemin PRÉFÉRÉ : déjà sans la pesanteur, donc directement comparable.
  if (isUsable(clean)) return magnitude(clean);

  const raw = reading.accelerationIncludingGravity;
  if (!isUsable(raw)) return null;

  // Ramené à la même échelle. La soustraction est approximative — la
  // pesanteur ne s'aligne pas forcément avec le mouvement — mais elle suffit
  // pour distinguer un geste d'un téléphone immobile, qui est tout ce qu'on
  // demande. Une orientation exacte demanderait le gyroscope, pour un
  // réglage qui se fait de toute façon à la main sur un vrai téléphone.
  return Math.abs(magnitude(raw) - GRAVITY);
}

/**
 * Cette lecture est-elle un geste de lancer ?
 *
 * `since` est le temps écoulé depuis le dernier lancer accepté, en
 * millisecondes, ou `null` s'il n'y en a jamais eu.
 */
export function isShake(
  reading: MotionReading,
  since: number | null,
  threshold: number = SHAKE_THRESHOLD
): boolean {
  // LE TEMPS MORT D'ABORD : inutile de mesurer un geste qu'on refusera.
  if (since !== null && since < SHAKE_DEBOUNCE_MS) return false;

  const intensity = motionIntensity(reading);
  if (intensity === null) return false;

  return intensity >= threshold;
}

/** Une lecture apporte-t-elle au moins un axe chiffré ? */
function isUsable(
  vector: { x?: number | null; y?: number | null; z?: number | null } | null | undefined
): vector is { x?: number | null; y?: number | null; z?: number | null } {
  if (!vector) return false;

  return [vector.x, vector.y, vector.z].some(
    axis => typeof axis === 'number' && Number.isFinite(axis)
  );
}

/** La norme du vecteur, les axes manquants comptant pour zéro. */
function magnitude(vector: {
  x?: number | null;
  y?: number | null;
  z?: number | null;
}): number {
  const x = axis(vector.x);
  const y = axis(vector.y);
  const z = axis(vector.z);

  return Math.sqrt(x * x + y * y + z * z);
}

function axis(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Les capteurs de mouvement sont-ils utilisables ici ?
 *
 * Sur certains Android et sur iOS, l'accès demande une PERMISSION explicite,
 * qui ne peut être demandée que depuis un geste de l'utilisateur. Cette
 * fonction ne dit donc pas « c'est autorisé » mais « ça vaut la peine de
 * demander » — et le bouton reste, quelle que soit la réponse.
 */
export function motionAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  return typeof (window as { DeviceMotionEvent?: unknown }).DeviceMotionEvent !== 'undefined';
}

/**
 * Cet appareil exige-t-il une permission avant d'écouter ?
 *
 * Reconnu à la présence de `requestPermission` sur le constructeur, ce qui
 * est la seule manière fiable de le savoir : la liste des appareils
 * concernés change, la présence de la méthode non.
 */
export function motionNeedsPermission(): boolean {
  if (!motionAvailable()) return false;

  const constructor = (window as { DeviceMotionEvent?: { requestPermission?: unknown } })
    .DeviceMotionEvent;

  return typeof constructor?.requestPermission === 'function';
}
