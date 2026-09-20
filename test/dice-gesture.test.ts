import { describe, it, expect } from 'vitest';
import {
  swipeToThrow,
  GRAB_LIFT,
  MIN_SWIPE_SPEED,
} from '@/features/board/scene3d/dice-gesture';
import { WORLD_DICE_CONFIG } from '@/features/board/scene3d/dice-world-config';

/**
 * 3D-49 — lancer le dé d'un geste, comme un vrai joueur.
 *
 * Quentin : « au lieu que le dé roule au toucher, faire comme un vrai
 * joueur — le doigt appuie, on saisit, on glisse, on relâche ».
 *
 * La traduction geste → lancer est isolée ici parce qu'elle décide de la
 * sensation, et qu'une sensation se règle par la mesure plutôt qu'à
 * l'estime. Le module ne connaît ni Three.js ni le DOM.
 *
 * LE POINT QUI DEMANDE DE LA PRUDENCE : le geste est en pixels d'écran, la
 * physique en unités monde. Les deux ne se ressemblent pas — un glissement de
 * 200 px n'est pas un lancer de 200 unités — et la conversion doit tenir
 * compte de l'échelle à laquelle le plateau est vu, sinon le même geste
 * lancerait deux fois plus fort en vue rapprochée.
 */

/** Un lancer de vigueur moyenne : 300 px en 200 ms. */
const MEDIUM = { dx: 0, dy: -300, ms: 200, worldPerPixel: 4 };

describe('3D-49 — la vigueur du geste devient celle du lancer', () => {
  it('lance plus fort quand on glisse plus vite', () => {
    const gentle = swipeToThrow({ ...MEDIUM, ms: 600 });
    const brisk = swipeToThrow({ ...MEDIUM, ms: 120 });

    expect(brisk.speed).toBeGreaterThan(gentle.speed);
  });

  it('suit la direction du doigt', () => {
    // Glisser vers la droite envoie le dé vers la droite : sans ça, le
    // joueur ne reconnaît pas son geste dans ce qu'il voit.
    const right = swipeToThrow({ dx: 300, dy: 0, ms: 200, worldPerPixel: 4 });

    expect(right.velocity.x).toBeGreaterThan(0);
    expect(Math.abs(right.velocity.y)).toBeLessThan(Math.abs(right.velocity.x));
  });

  it('envoie vers le haut de l\'écran quand on glisse vers le haut', () => {
    // L'écran a son Y vers le bas, le plateau sa profondeur vers l'avant :
    // glisser vers le haut doit éloigner le dé, pas le rapprocher.
    const up = swipeToThrow(MEDIUM);

    expect(up.velocity.y).toBeLessThan(0);
  });
});

describe('3D-49 — la conversion écran → monde', () => {
  it('tient compte de l\'échelle du plateau', () => {
    // Le même geste, vu de plus loin, doit lancer plus fort en unités monde
    // pour parcourir la même distance À L'ÉCRAN. Sans ça, le lancer serait
    // deux fois plus court en vue d'ensemble qu'en vue rapprochée.
    const close = swipeToThrow({ ...MEDIUM, worldPerPixel: 2 });
    const far = swipeToThrow({ ...MEDIUM, worldPerPixel: 8 });

    expect(far.speed).toBeGreaterThan(close.speed);
  });

  it('reste borné, même sur un geste violent', () => {
    // Un geste très rapide ne doit pas expédier le dé hors du plateau : les
    // bornes de l'aire le retiendraient, mais on verrait un dé qui rebondit
    // contre les murs au lieu de rouler.
    //
    // LE PLAFOND EST CELUI DE LA CONFIGURATION, et non un nombre écrit ici :
    // la plage a été élargie deux fois pour rendre le lancer sensible (#62,
    // #69), et un chiffre figé dans le test aurait fait échouer chaque
    // réglage sans rien dire de faux.
    const violent = swipeToThrow({ dx: 0, dy: -4000, ms: 16, worldPerPixel: 8 });

    expect(violent.speed).toBeLessThanOrEqual(WORLD_DICE_CONFIG.velocityMax);
  });

  it('garde un lancer minimum sur un geste mou', () => {
    // Un glissement lent mais FRANC — le doigt a bien parcouru une distance —
    // doit quand même faire rouler le dé. Sinon le joueur croit que
    // l'application n'a pas répondu, et il réessaie.
    //
    // 12 px ne conviendrait pas pour ce test : c'est en dessous du seuil qui
    // sépare le lancer de l'hésitation, donc un appui et non un geste mou.
    // Les deux cas sont distincts et ont chacun leur test.
    const soft = swipeToThrow({ dx: 0, dy: -40, ms: 700, worldPerPixel: 2 });

    expect(soft.thrown).toBe(true);
    expect(soft.speed).toBeGreaterThanOrEqual(MIN_SWIPE_SPEED);
  });
});

describe('3D-49 — les gestes qui ne sont pas des lancers', () => {
  it('ne lance pas sur un simple appui', () => {
    // Poser le doigt et le relever sans bouger, c'est hésiter, pas lancer.
    const tap = swipeToThrow({ dx: 0, dy: 0, ms: 150, worldPerPixel: 4 });

    expect(tap.thrown).toBe(false);
  });

  it('lance dès que le doigt a franchi une vraie distance', () => {
    const swipe = swipeToThrow({ dx: 0, dy: -60, ms: 150, worldPerPixel: 4 });

    expect(swipe.thrown).toBe(true);
  });

  it('survit à une durée nulle', () => {
    // Deux événements dans la même image : la division par le temps ne doit
    // pas produire l'infini.
    const instant = swipeToThrow({ dx: 0, dy: -200, ms: 0, worldPerPixel: 4 });

    expect(Number.isFinite(instant.speed)).toBe(true);
    expect(instant.speed).toBeLessThanOrEqual(WORLD_DICE_CONFIG.velocityMax);
  });
});

describe('3D-49 — le dé tenu en main', () => {
  it('se soulève quand on le saisit', () => {
    // Le retour visuel que Quentin demande : on doit VOIR qu'on tient le dé.
    expect(GRAB_LIFT).toBeGreaterThan(0);
  });
});
