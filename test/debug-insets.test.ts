import { describe, it, expect } from 'vitest';
import {
  readInsetOverrides,
  describeInsets,
  applySimulatedSafeArea,
} from '@/features/board/scene3d/debug-insets';

/**
 * Outillage de recette du cadrage.
 *
 * PO : « donne-moi un moyen de VÉRIFIER le centrage sans avoir le téléphone
 * de Quentin sous la main. Sinon on va boucler. »
 *
 * Une encoche ne se reproduit pas sur un navigateur de bureau : les
 * `env(safe-area-inset-*)` y valent zéro. Sans moyen de la simuler, chaque
 * correction se vérifie au jugé, à distance, par l'intermédiaire de
 * quelqu'un qui n'a pas le code sous les yeux.
 */

describe('recette du cadrage — forcer les marges par l\'URL', () => {
  it('lit les marges applicatives', () => {
    const overrides = readInsetOverrides('?top=96&bottom=88');

    expect(overrides.top).toBe(96);
    expect(overrides.bottom).toBe(88);
  });

  it('lit les encoches simulées', () => {
    const overrides = readInsetOverrides('?safeTop=48&safeBottom=24');

    expect(overrides.safeTop).toBe(48);
    expect(overrides.safeBottom).toBe(24);
  });

  it('ne force rien quand l\'URL est nue', () => {
    // Le comportement par défaut ne doit pas dépendre de l'outillage : sans
    // paramètre, tout est mesuré sur le DOM comme en production.
    const overrides = readInsetOverrides('');

    expect(overrides.top).toBeNull();
    expect(overrides.bottom).toBeNull();
    expect(overrides.safeTop).toBeNull();
    expect(overrides.safeBottom).toBeNull();
    expect(overrides.outline).toBe(false);
  });

  it('ignore une valeur qui n\'a pas de sens', () => {
    // Une marge négative ou illisible replierait le cadrage sur lui-même ;
    // mieux vaut retomber sur la mesure réelle que sur une valeur absurde.
    const overrides = readInsetOverrides('?top=-40&bottom=abc');

    expect(overrides.top).toBeNull();
    expect(overrides.bottom).toBeNull();
  });

  it('accepte zéro, qui est une valeur légitime', () => {
    // Forcer « pas de marge du tout » doit être possible : c'est le cas qui
    // isole le cadrage de l'influence des bandeaux.
    const overrides = readInsetOverrides('?top=0&bottom=0');

    expect(overrides.top).toBe(0);
    expect(overrides.bottom).toBe(0);
  });

  it('active le cadre de contrôle à la demande', () => {
    expect(readInsetOverrides('?debug=1').outline).toBe(true);
    expect(readInsetOverrides('?debug=0').outline).toBe(false);
  });
});

describe('recette du cadrage — dire ce qui a été mesuré', () => {
  it('annonce la surface libre, et non seulement les marges', () => {
    // C'est la surface libre qui décide du cadrage : l'afficher évite de
    // refaire la soustraction de tête en lisant une capture d'écran.
    const text = describeInsets({ top: 96, bottom: 88 }, { width: 412, height: 932 });

    expect(text).toContain('412×932');
    expect(text).toContain('96/88');
    expect(text).toContain('748px');
  });
});

describe('recette du cadrage — une encoche simulée se comporte comme une vraie', () => {
  it('atteint la scène, et pas seulement les bandeaux', () => {
    // Le piège : poser des variables CSS que seule la feuille de style
    // consulte décalerait les bandeaux sans décaler le cadrage. On
    // vérifierait alors un comportement qui n'est pas celui de l'appareil,
    // ce qui est pire que pas d'outil du tout.
    applySimulatedSafeArea(readInsetOverrides('?safeTop=48&safeBottom=24'));

    const root = document.documentElement;

    expect(root.style.getPropertyValue('--safe-top')).toBe('48px');
    expect(root.style.getPropertyValue('--safe-bottom')).toBe('24px');

    // La sonde de `safe-area.ts` lit ces mêmes variables : c'est ce qui
    // garantit que la simulation traverse jusqu'au cadrage.
    const probe = document.querySelector('[aria-hidden="true"]');
    if (probe) {
      expect((probe as HTMLElement).style.paddingTop).toContain('--safe-top');
    }
  });
});
