/**
 * Les chocs que `DicePhysics` ne simule pas : dé contre dé, dé contre pion.
 *
 * Quentin (20/09/2026) : « il faut que les dés puissent se toucher », « il
 * faut que les pions et cases aient leur boîte de collision ».
 *
 * `DicePhysics` ne gère QUE les bords de la table. Deux dés se traversaient
 * donc sans se voir, et un dé passait au travers des pions comme s'ils
 * n'existaient pas — ce qui se remarque immédiatement quand on regarde le
 * plateau, et ruine l'illusion d'objets posés sur une table.
 *
 * LA PHYSIQUE PARTAGÉE N'EST PAS TOUCHÉE : `DicePhysics` sert aussi au rendu
 * CSS qui tourne sur `main`, et son comportement y est acquis. Les chocs sont
 * donc résolus ICI, APRÈS son pas de simulation, en corrigeant positions et
 * vitesses. C'est la même approche que le roulement (`applyRolling`), qui
 * impose déjà la rotation du dé après coup.
 *
 * Ce module est PUR : il prend des corps, renvoie des corps corrigés, et ne
 * connaît ni Three.js ni le DOM. Les chocs se vérifient donc par la mesure —
 * conservation de la quantité de mouvement, absence de chevauchement — plutôt
 * qu'à l'œil sur un plateau qui bouge.
 */

/** Un corps mobile, vu d'au-dessus : la hauteur ne participe pas au choc. */
export interface MovingBody {
  x: number;
  z: number;
  /** Hauteur au-dessus du plateau : un dé en l'air ne heurte pas un pion. */
  height: number;
  vx: number;
  vz: number;
  /** Demi-largeur du corps, vu d'au-dessus. */
  radius: number;
}

/** Un obstacle fixe : un pion posé sur sa case. */
export interface FixedBody {
  x: number;
  z: number;
  radius: number;
  /** Hauteur du sommet : au-dessus, le dé passe par-dessus sans le toucher. */
  top: number;
}

/**
 * Restitution d'un choc, entre 0 et 1.
 *
 * Deux dés qui s'entrechoquent claquent sèchement et repartent : ils ne
 * collent pas, mais ne rebondissent pas non plus comme des billes. 0,45 est
 * proche du rebond au sol déjà retenu (0,38), un peu plus vif parce qu'aucune
 * énergie ne part dans la table.
 */
const DICE_RESTITUTION = 0.45;

/**
 * Restitution d'un choc contre un pion.
 *
 * Plus mate : un pion est plus lourd que le dé et posé sur le plateau, il
 * encaisse. Le dé repart, le pion ne bouge pas — c'est un obstacle, pas un
 * projectile. Faire bouger les pions changerait la POSITION D'UN JOUEUR,
 * c'est-à-dire une donnée de règle.
 */
const PAWN_RESTITUTION = 0.3;

/**
 * Sépare deux corps qui se chevauchent et échange leur quantité de mouvement.
 *
 * Les deux corps ont la même masse — ce sont deux dés identiques — donc
 * l'échange se fait à parts égales le long de la normale du choc. La
 * composante tangentielle est conservée : deux dés qui se frôlent continuent
 * leur route, seul le rapprochement est annulé.
 *
 * Renvoie `true` si un choc a eu lieu, pour que l'appelant puisse en tirer un
 * effet — un son, une étincelle — sans refaire le test.
 */
export function collideBodies(a: MovingBody, b: MovingBody): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;

  const reach = a.radius + b.radius;
  const gap = Math.hypot(dx, dz);

  if (gap >= reach) return false;

  // Deux corps exactement superposés n'ont pas de direction de choc : on en
  // choisit une plutôt que de diviser par zéro et d'envoyer les dés à
  // l'infini.
  const nx = gap > 0.0001 ? dx / gap : 1;
  const nz = gap > 0.0001 ? dz / gap : 0;

  // 1. LES SÉPARER. Sans cela ils resteraient imbriqués et se repousseraient
  // à chaque image, en vibrant sur place.
  const overlap = reach - gap;
  const push = overlap / 2;

  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;

  // 2. ÉCHANGER LEUR ÉLAN, le long de la normale seulement.
  const approach = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;

  // Ils s'éloignent déjà : les freiner serait les coller l'un à l'autre.
  if (approach > 0) return true;

  const impulse = -(1 + DICE_RESTITUTION) * approach / 2;

  a.vx -= impulse * nx;
  a.vz -= impulse * nz;
  b.vx += impulse * nx;
  b.vz += impulse * nz;

  return true;
}

/**
 * Fait rebondir un corps sur un obstacle fixe, qui ne bouge pas.
 *
 * Le pion NE BOUGE PAS : sa position est celle d'un joueur sur le parcours,
 * c'est-à-dire une donnée de règle. Le déplacer depuis le rendu reviendrait à
 * faire avancer un joueur parce qu'un dé l'a heurté.
 */
export function collideWithFixed(body: MovingBody, obstacle: FixedBody): boolean {
  // Le dé passe AU-DESSUS : un dé en vol ne heurte pas un pion, il le
  // survole. Sans cette condition, un dé lobé serait dévié par des pions
  // qu'il ne touche visiblement pas.
  if (body.height > obstacle.top) return false;

  const dx = body.x - obstacle.x;
  const dz = body.z - obstacle.z;

  const reach = body.radius + obstacle.radius;
  const gap = Math.hypot(dx, dz);

  if (gap >= reach) return false;

  const nx = gap > 0.0001 ? dx / gap : 1;
  const nz = gap > 0.0001 ? dz / gap : 0;

  // Le corps est repoussé SEUL : tout le dégagement est pour lui, puisque
  // l'obstacle ne cède pas.
  const overlap = reach - gap;
  body.x += nx * overlap;
  body.z += nz * overlap;

  const approach = body.vx * nx + body.vz * nz;

  // Il s'éloigne déjà de l'obstacle : rien à corriger.
  if (approach > 0) return true;

  // Réflexion sur la normale, amortie par la restitution.
  const bounce = (1 + PAWN_RESTITUTION) * approach;

  body.vx -= bounce * nx;
  body.vz -= bounce * nz;

  return true;
}
