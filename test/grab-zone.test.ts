import { describe, it, expect } from 'vitest';
import {
  grabProbes,
  gestureOwner,
  GRAB_PADDING_PX,
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
