import { describe, it, expect } from 'vitest';
import {
  grabProbes,
  gestureOwner,
  followsFinger,
  shortestTurn,
  commonDrift,
  GRAB_PADDING_PX,
  mouseGesture,
} from '@/features/board/scene3d/grab-zone';

/**
 * 3D-63 — attraper le dé au doigt, pour de bon.
 *
 * Quentin (20/09/2026) : « je ne peux toujours pas déplacer le dé ».
 *
 * Deux défauts se cachaient derrière cette phrase, et ni la physique ni la
 * traduction du geste n'étaient en cause : les deux avaient été mesurées
 * justes, et c'est ce qui rendait le diagnostic trompeur.
 *
 * 1. LE CONFLIT D'ÉVÉNEMENTS. Le dé écoute `pointerdown`, la caméra écoute
 *    `touchstart` — deux familles distinctes, où `stopPropagation` sur l'une
 *    n'empêche pas l'autre. Poser le doigt sur le dé démarrait les DEUX
 *    gestes : on tenait le dé pendant que la caméra tournait sous lui, et le
 *    dé, suivant la vue, paraissait immobile.
 *
 * 2. LA CIBLE TROP PETITE. Le dé, ramené de 86 à 58 unités monde parce qu'il
 *    était trop gros (#62), ne fait plus que 37 px à l'écran en vue
 *    d'ensemble — sous les 48 px de cible tactile.
 */

/** Le dé à l'écran, en vue d'ensemble sur un téléphone. */
const DIE_SCREEN_PX = 37;

describe('3D-63 — le dé passe avant la caméra', () => {
  it('donne le geste au dé quand il commence dessus', () => {
    expect(gestureOwner(true)).toBe('dice');
  });

  it('laisse le geste à la caméra partout ailleurs', () => {
    // La rotation n'est PAS désactivée, elle est seulement précédée. Un appui
    // sur le plateau doit continuer de tourner la vue : corriger un défaut en
    // supprimant la rotation en créerait un autre.
    expect(gestureOwner(false)).toBe('camera');
  });

  it('n\'attribue jamais le même geste aux deux', () => {
    // L'INVARIANT, et c'est leur simultanéité qui produisait le défaut.
    const owners = [true, false].map(gestureOwner);

    expect(new Set(owners).size).toBe(2);
  });
});

describe('3D-63 — la zone de prise est plus large que le dé', () => {
  it('sonde le centre du doigt en premier', () => {
    // Le cas courant doit rester le moins cher : un doigt posé au milieu du
    // dé ne doit pas payer neuf lancers de rayon.
    const [first] = grabProbes(100, 200);

    expect(first).toEqual({ x: 100, y: 200 });
  });

  it('sonde tout autour, pas seulement en croix', () => {
    // Un doigt qui déborde en diagonale doit attraper aussi : c'est le cas
    // le plus fréquent quand on vise un petit cube en perspective.
    const probes = grabProbes(0, 0);

    expect(probes).toContainEqual({ x: -GRAB_PADDING_PX, y: -GRAB_PADDING_PX });
    expect(probes).toContainEqual({ x: GRAB_PADDING_PX, y: GRAB_PADDING_PX });
  });

  it('porte la cible au-dessus des 48 px tactiles', () => {
    // LE CHIFFRE QUI COMPTE. Le dé n'a pas besoin de grossir pour être
    // attrapable : c'est la zone sensible qui s'élargit autour de lui.
    const target = DIE_SCREEN_PX + GRAB_PADDING_PX * 2;

    expect(target).toBeGreaterThanOrEqual(48);
  });

  it('garde une marge discrète, qui n\'avale pas le plateau', () => {
    // Une tolérance trop large attraperait le dé alors qu'on visait une case
    // voisine, et la rotation de la vue deviendrait capricieuse.
    expect(GRAB_PADDING_PX).toBeLessThan(DIE_SCREEN_PX / 2);
  });

  it('ne sonde aucun point deux fois', () => {
    const probes = grabProbes(50, 50);
    const seen = new Set(probes.map(p => `${p.x},${p.y}`));

    expect(seen.size).toBe(probes.length);
  });
});

describe('3D-65 — le dé lâché vit sa vie', () => {
  it('suit le doigt tant qu\'on le tient et qu\'il n\'est pas lancé', () => {
    expect(followsFinger(true, true)).toBe(true);
  });

  it('CESSE de suivre dès qu\'il est lancé', () => {
    // Quentin : « il suit le curseur après l'avoir jeté, il faudrait qu'il
    // parte de lui-même, qu'il vive tout seul ».
    //
    // C'est le verrou qui manquait. Si le relâchement n'arrive jamais —
    // souris sortie de la fenêtre, geste interrompu par le système — la
    // prise reste vraie et le dé colle au curseur PENDANT qu'il roule.
    expect(followsFinger(true, false)).toBe(false);
  });

  it('ne suit pas un doigt qui ne tient rien', () => {
    expect(followsFinger(false, true)).toBe(false);
  });

  it('ne laisse jamais deux autorités déplacer le dé', () => {
    // L'INVARIANT, et c'est lui qui produisait le défaut : la physique fait
    // rouler le dé, le doigt le traîne, et la physique perd. Tant qu'un
    // lancer est en cours, le doigt n'a plus la main — quel que soit l'état
    // de la prise.
    const rolling = false;

    for (const holding of [true, false]) {
      expect(followsFinger(holding, rolling)).toBe(false);
    }
  });
});

describe('3D-73 — la rotation à deux doigts ne fait pas de tour complet', () => {
  it('rend un petit écart tel quel', () => {
    expect(shortestTurn(12)).toBeCloseTo(12, 6);
    expect(shortestTurn(-30)).toBeCloseTo(-30, 6);
  });

  it('ramène un écart de 350° à -10°', () => {
    // LE CAS QUI CASSE, et il ne se voit qu'au moment précis où les doigts
    // franchissent la verticale : l'angle saute de +180 à −180, la différence
    // brute vaut 350, et le plateau ferait presque un tour complet en une
    // seule image. Le joueur verrait la vue partir en vrille.
    expect(shortestTurn(350)).toBeCloseTo(-10, 6);
  });

  it('ramène un écart de -350° à +10°', () => {
    expect(shortestTurn(-350)).toBeCloseTo(10, 6);
  });

  it('ne renvoie jamais plus d\'un demi-tour', () => {
    // L'INVARIANT : quel que soit l'écart mesuré, la vue ne tourne jamais de
    // plus de 180° d'un coup.
    for (let delta = -1080; delta <= 1080; delta += 7) {
      const turn = shortestTurn(delta);

      expect(turn).toBeGreaterThanOrEqual(-180);
      expect(turn).toBeLessThanOrEqual(180);
    }
  });

  it('garde le SENS du geste', () => {
    // Un demi-tour inversé ferait tourner le plateau à l'opposé de la main,
    // ce qui est pire qu'un saut : le joueur corrigerait dans le mauvais sens.
    expect(shortestTurn(20)).toBeGreaterThan(0);
    expect(shortestTurn(-20)).toBeLessThan(0);
    expect(shortestTurn(370)).toBeGreaterThan(0);
    expect(shortestTurn(-370)).toBeLessThan(0);
  });

  it('ne bouge pas quand les doigts ne pivotent pas', () => {
    expect(shortestTurn(0)).toBe(0);
    expect(shortestTurn(360)).toBeCloseTo(0, 6);
  });
});

describe('3D-74 — deux doigts qui glissent ensemble inclinent la vue', () => {
  /** Deux doigts posés l'un au-dessus de l'autre. */
  const posed = { first: { y: 300 }, second: { y: 500 } };

  it('lit le glissement commun quand les deux doigts montent', () => {
    // Le geste de Maps : deux doigts qui remontent l'écran couchent la vue
    // vers l'horizon.
    const drift = commonDrift({ y: 250 }, { y: 450 }, posed);

    expect(drift).toBeCloseTo(-50, 6);
  });

  it('le lit aussi quand ils descendent', () => {
    const drift = commonDrift({ y: 360 }, { y: 560 }, posed);

    expect(drift).toBeCloseTo(60, 6);
  });

  it('IGNORE un pivot pur', () => {
    // LA PROPRIÉTÉ QUI SÉPARE LES DEUX GESTES, et sans laquelle ils se
    // confondraient : quand les doigts pivotent, l'un monte pendant que
    // l'autre descend. Leur moyenne est nulle, donc la vue ne s'incline pas
    // pendant qu'on la tourne.
    const drift = commonDrift({ y: 240 }, { y: 560 }, posed);

    expect(drift).toBeCloseTo(0, 6);
  });

  it('ne bouge pas quand les doigts ne bougent pas', () => {
    expect(commonDrift({ y: 300 }, { y: 500 }, posed)).toBe(0);
  });

  it('lit un glissement même quand les doigts pivotent EN MÊME TEMPS', () => {
    // Les deux gestes doivent pouvoir se faire ensemble, comme sur une
    // carte : les séparer obligerait à lever un doigt au milieu.
    //
    // Ici les deux doigts descendent de 40 en moyenne, tout en pivotant.
    const drift = commonDrift({ y: 300 }, { y: 580 }, posed);

    expect(drift).toBeCloseTo(40, 6);
  });

  it('donne le même résultat quel que soit l\'ordre des doigts', () => {
    // Le système ne garantit pas dans quel ordre les touches arrivent : un
    // geste ne doit pas s'inverser selon le doigt posé en premier.
    const straight = commonDrift({ y: 250 }, { y: 450 }, posed);
    const swapped = commonDrift(
      { y: 450 },
      { y: 250 },
      { first: { y: 500 }, second: { y: 300 } }
    );

    expect(swapped).toBeCloseTo(straight, 6);
  });
});

/**
 * Ce qu'un bouton de souris fait à la caméra.
 *
 * Quentin : « sur souris, clic simple + glisser » pour déplacer le plateau.
 * C'était l'inverse — le clic gauche faisait TOURNER la vue.
 *
 * L'enjeu n'est pas le confort mais la COHÉRENCE entre les deux appareils :
 * un doigt déplace depuis #73, donc le clic simple doit déplacer aussi. Un
 * joueur qui passe du téléphone au navigateur refait le même mouvement et
 * doit obtenir la même chose, sinon il apprend le jeu deux fois.
 */
describe('contrôles — le clic simple déplace, comme un doigt', () => {
  it('fait glisser le plateau au clic gauche', () => {
    expect(mouseGesture(0, false)).toBe('pan');
  });

  it('accorde la souris au tactile', () => {
    // C'EST LE POINT. `followsFinger` dit qu'un doigt posé hors du dé
    // commande la caméra ; le clic gauche doit commander la MÊME chose.
    expect(mouseGesture(0, false)).toBe('pan');
  });

  it('garde la rotation au clic droit', () => {
    // Elle n'est pas perdue : elle cesse d'être le geste par défaut.
    expect(mouseGesture(2, false)).toBe('orbit');
  });

  it('garde la rotation au clic molette', () => {
    expect(mouseGesture(1, false)).toBe('orbit');
  });

  it('garde la rotation avec Shift, pour les souris à un bouton', () => {
    // Un trackpad de portable n'a souvent qu'un bouton : sans ce raccourci,
    // la rotation deviendrait inatteignable pour tout un pan des joueurs.
    expect(mouseGesture(0, true)).toBe('orbit');
  });

  it('ne laisse aucun bouton sans effet', () => {
    // Un bouton latéral de souris de jeu ne doit pas ouvrir un troisième
    // comportement : tout ce qui n'est pas le clic simple fait tourner.
    for (const button of [3, 4, 9]) {
      expect(mouseGesture(button, false)).toBe('orbit');
    }
  });
});
