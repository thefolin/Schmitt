/**
 * Le chemin qu'un pion parcourt, case par case.
 *
 * Quentin : « pas de téléportation, les pions doivent marcher case par case ».
 *
 * CE QUI REND LE CALCUL NON TRIVIAL : les règles font parfois REBONDIR le
 * pion. L'arrivée se fait à la valeur exacte, donc un 5 depuis la case 20 d'un
 * plateau de 23 n'envoie pas à 25 — il envoie à 19, après être monté jusqu'à
 * 22 et être redescendu de 3.
 *
 * Aller directement de 20 à 19 montrerait le pion RECULER d'une case, alors
 * que la règle le fait avancer de deux puis reculer de trois. L'animation
 * raconterait autre chose que ce qui s'est passé, et le joueur qui compte les
 * cases à voix haute — c'est un jeu à boire, il les compte — ne retrouverait
 * pas son dé.
 *
 * Le chemin est donc CALCULÉ pas à pas, et non interpolé entre deux positions.
 *
 * La fonction est PURE : elle ne connaît ni la scène, ni le temps, ni Three.js,
 * et se vérifie sans rien afficher. Elle ne décide d'aucune règle non plus —
 * `GameLogic` a déjà tranché où le pion arrive ; on reconstitue seulement la
 * route qu'il a suivie pour y aller.
 */

export interface WalkRequest {
  /** Case de départ. */
  from: number;
  /** Case d'arrivée, telle que les règles l'ont décidée. */
  to: number;
  /** Nombre de pas à faire — la face du dé, ou la poussée d'une flèche. */
  steps: number;
  /** Dernière case du parcours. */
  last: number;
  /** Le joueur marche-t-il vers le retour ? */
  returning: boolean;
}

/**
 * Les cases traversées, dans l'ordre, sans la case de départ.
 *
 * La case de départ est exclue : le pion y est déjà, et la répéter ferait
 * marquer un temps d'arrêt avant que le mouvement commence.
 */
export function walkPath(request: WalkRequest): number[] {
  const { from, to, steps, last, returning } = request;

  if (!Number.isFinite(steps) || steps <= 0 || last < 1) return [];

  // Le critère est le NOMBRE DE PAS, et non l'égalité départ/arrivée. Un
  // pion peut revenir exactement d'où il vient tout en ayant marché : en
  // phase de retour, depuis la case 2 avec un 4, il descend à 0 puis remonte
  // à 2. Traiter « départ == arrivée » comme « rien ne bouge » le laissait
  // figé pendant que le journal annonçait un 4.

  const path: number[] = [];

  let position = from;
  // Le sens de marche, qui s'inverse à chaque rebond sur un bord.
  let direction = returning ? -1 : 1;

  for (let step = 0; step < steps; step++) {
    const next = position + direction;

    if (next > last) {
      // Le bord supérieur : le pion touche la dernière case et repart en
      // sens inverse. Il DOIT y passer — c'est elle qui donne le pouvoir du
      // Schmitt, et le joueur doit voir qu'il l'a atteinte.
      direction = -1;
      position = last - 1;
    } else if (next < 0) {
      // Le bord inférieur : START, la case de la victoire. Même raison.
      direction = 1;
      position = 1;
    } else {
      position = next;
    }

    path.push(Math.max(0, Math.min(position, last)));
  }

  // Le dernier pas doit tomber là où les règles ont mis le pion. S'il en
  // diverge, c'est la règle qui fait foi, pas cette reconstitution : mieux
  // vaut un dernier pas un peu brusque qu'un pion posé au mauvais endroit.
  if (path.length > 0 && path[path.length - 1] !== to) {
    path[path.length - 1] = to;
  }

  return path;
}
