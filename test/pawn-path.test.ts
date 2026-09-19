import { describe, it, expect } from 'vitest';
import { walkPath } from '@/features/board/scene3d/pawn-path';

/**
 * 3D-50 — le pion marche case par case, il ne se téléporte pas.
 *
 * Quentin : « pas de téléportation, les pions doivent marcher case par case ».
 *
 * CE QUI REND LE CALCUL NON TRIVIAL, et qu'une interpolation de A vers B
 * raterait : les règles font parfois REBONDIR le pion. L'arrivée se fait à la
 * valeur exacte, donc un 5 depuis la case 20 d'un plateau qui en compte 23
 * n'envoie pas à 25 — il envoie à 19, après être monté jusqu'à 22 et être
 * redescendu de 3.
 *
 * Aller directement de 20 à 19 montrerait le pion RECULER d'une case, alors
 * que la règle le fait avancer de deux puis reculer de trois. L'animation
 * raconterait autre chose que ce qui s'est passé, et le joueur qui compte les
 * cases — c'est un jeu à boire, il les compte — ne retrouverait pas son dé.
 *
 * Le chemin est donc calculé, pas interpolé. C'est une fonction PURE : elle
 * ne connaît ni la scène ni le temps, et se vérifie sans rien afficher.
 */

/** Un plateau de 23 cases, comme le plateau officiel. */
const LAST = 22;

describe('3D-50 — le chemin d\'un déplacement simple', () => {
  it('passe par chaque case intermédiaire', () => {
    const path = walkPath({ from: 3, to: 7, steps: 4, last: LAST, returning: false });

    expect(path).toEqual([4, 5, 6, 7]);
  });

  it('ne contient pas la case de départ', () => {
    // Le pion y est déjà : la répéter ferait marquer un temps d'arrêt avant
    // que le mouvement commence.
    const path = walkPath({ from: 0, to: 3, steps: 3, last: LAST, returning: false });

    expect(path[0]).toBe(1);
  });

  it('finit exactement sur la case d\'arrivée', () => {
    const path = walkPath({ from: 5, to: 9, steps: 4, last: LAST, returning: false });

    expect(path[path.length - 1]).toBe(9);
  });

  it('compte autant de pas que le dé', () => {
    for (let dice = 1; dice <= 6; dice++) {
      const path = walkPath({ from: 2, to: 2 + dice, steps: dice, last: LAST, returning: false });

      expect(path).toHaveLength(dice);
    }
  });
});

describe('3D-50 — le rebond sur la dernière case', () => {
  it('monte jusqu\'au bord puis redescend', () => {
    // 20 + 5 = 25, soit 3 de trop : on monte à 22, puis on redescend à 19.
    const path = walkPath({ from: 20, to: 19, steps: 5, last: LAST, returning: false });

    expect(path).toEqual([21, 22, 21, 20, 19]);
  });

  it('fait toujours autant de pas que le dé, rebond compris', () => {
    // C'est ce que le joueur compte à voix haute. Un chemin plus court
    // donnerait l'impression que le dé a menti.
    const path = walkPath({ from: 20, to: 19, steps: 5, last: LAST, returning: false });

    expect(path).toHaveLength(5);
  });

  it('touche la dernière case en chemin', () => {
    // Le pion DOIT passer par la dernière case : c'est elle qui donne le
    // pouvoir du Schmitt, et le joueur doit voir qu'il l'a atteinte.
    const path = walkPath({ from: 19, to: 20, steps: 5, last: LAST, returning: false });

    expect(path).toContain(LAST);
  });

  it('ne rebondit pas quand la valeur tombe juste', () => {
    const path = walkPath({ from: 19, to: 22, steps: 3, last: LAST, returning: false });

    expect(path).toEqual([20, 21, 22]);
  });
});

describe('3D-50 — la phase de retour', () => {
  it('recule case par case vers le départ', () => {
    const path = walkPath({ from: 10, to: 6, steps: 4, last: LAST, returning: true });

    expect(path).toEqual([9, 8, 7, 6]);
  });

  it('rebondit sur START', () => {
    // 2 - 5 = -3 : on descend à 0, puis on repart de l'autre côté jusqu'à 3.
    const path = walkPath({ from: 2, to: 3, steps: 5, last: LAST, returning: true });

    expect(path).toEqual([1, 0, 1, 2, 3]);
  });

  it('touche START en chemin lors d\'un rebond', () => {
    // START est la case de la victoire : le joueur doit voir qu'il l'a
    // touchée, même s'il en est reparti.
    const path = walkPath({ from: 2, to: 3, steps: 5, last: LAST, returning: true });

    expect(path).toContain(0);
  });

  it('s\'arrête sur START quand la valeur tombe juste', () => {
    const path = walkPath({ from: 3, to: 0, steps: 3, last: LAST, returning: true });

    expect(path).toEqual([2, 1, 0]);
  });
});

describe('3D-50 — les déplacements qui ne viennent pas du dé', () => {
  it('marche aussi pour une case flèche', () => {
    // Une flèche pousse de son propre nombre de cases, dans son propre sens.
    const path = walkPath({ from: 5, to: 7, steps: 2, last: LAST, returning: false });

    expect(path).toEqual([6, 7]);
  });

  it('ne bouge pas quand la flèche est bloquée au bord', () => {
    // Une flèche pousse jusqu'au bord et s'arrête : si le pion y est déjà,
    // il ne se passe rien, et l'animation ne doit pas inventer un mouvement.
    //
    // Le nombre de pas vaut alors ZÉRO, et c'est l'appelant qui le calcule
    // depuis la distance réellement parcourue. Passer `steps: 2` ici
    // décrirait une situation que la scène ne produit jamais — et masquerait
    // le cas, bien réel, d'un aller-retour qui revient à son point de départ.
    const path = walkPath({ from: LAST, to: LAST, steps: 0, last: LAST, returning: false });

    expect(path).toEqual([]);
  });
});

describe('3D-50 — le chemin reste sur le plateau', () => {
  it('ne sort jamais du parcours, quel que soit le déplacement', () => {
    for (let from = 0; from <= LAST; from++) {
      for (let dice = 1; dice <= 6; dice++) {
        for (const returning of [false, true]) {
          const raw = returning ? from - dice : from + dice;
          const to = returning
            ? raw < 0
              ? Math.abs(raw)
              : raw
            : raw > LAST
              ? LAST - (raw - LAST)
              : raw;

          const path = walkPath({ from, to, steps: dice, last: LAST, returning });

          for (const tile of path) {
            expect(tile).toBeGreaterThanOrEqual(0);
            expect(tile).toBeLessThanOrEqual(LAST);
          }

          // Et il arrive bien là où la règle l'a mis.
          expect(path[path.length - 1] ?? from).toBe(to);
        }
      }
    }
  });

  it('tient sur un plateau minuscule', () => {
    // L'éditeur permet des parcours très courts, où un dé rebondit plusieurs
    // fois. Sur trois cases, un 4 depuis la case 1 mène à 0 — vérifié auprès
    // de `GameLogic`, qui borne le rebond plutôt que de le laisser filer.
    // C'est la règle qui donne l'arrivée ; ce module ne fait que reconstituer
    // la route.
    const path = walkPath({ from: 1, to: 0, steps: 4, last: 2, returning: false });

    expect(path).toHaveLength(4);
    expect(path[path.length - 1]).toBe(0);

    for (const tile of path) {
      expect(tile).toBeGreaterThanOrEqual(0);
      expect(tile).toBeLessThanOrEqual(2);
    }
  });
});

describe('3D-54 — un aller-retour qui revient au point de départ', () => {
  it('marche quand même, au lieu de rester immobile', () => {
    // Cas réel, rencontré en enchaînant des parties : en phase de retour,
    // depuis la case 2 avec un 4, le pion descend à 0 puis remonte à 2. Il
    // ARRIVE là où il était parti — mais il a bel et bien fait quatre pas,
    // et il a touché START au passage.
    //
    // Mon premier garde-fou traitait « départ == arrivée » comme « rien ne
    // bouge », ce qui est vrai d'une flèche bloquée au bord mais faux ici :
    // le pion serait resté figé pendant que le journal annonce un 4.
    const path = walkPath({ from: 2, to: 2, steps: 4, last: 22, returning: true });

    expect(path).toEqual([1, 0, 1, 2]);
  });

  it('touche bien START au passage', () => {
    // START est la case de la victoire : le joueur doit voir que son pion
    // l'a touchée, même s'il en repart.
    const path = walkPath({ from: 2, to: 2, steps: 4, last: 22, returning: true });

    expect(path).toContain(0);
  });

  it('distingue le rebond d\'une flèche bloquée', () => {
    // Une flèche qui pousse un pion déjà collé au bord ne le bouge pas :
    // aucun pas n'est demandé, et l'animation ne doit rien inventer. La
    // différence tient au NOMBRE DE PAS, pas à l'égalité départ/arrivée.
    const blocked = walkPath({ from: 22, to: 22, steps: 0, last: 22, returning: false });

    expect(blocked).toEqual([]);
  });
});
