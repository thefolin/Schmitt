import { describe, it, expect, afterEach, vi } from 'vitest';
import { isHandheld, readDeviceOverride } from '@/features/board/scene3d/device';

/**
 * « Tourne ton téléphone » ne doit s'afficher que là où c'est possible.
 *
 * PO : « sur PC, si on tourne le navigateur, ça triggère le même message —
 * c'est faux. » Il a raison : la détection portait sur le seul ratio de la
 * fenêtre, et une fenêtre étroite sur un moniteur n'est pas un téléphone tenu
 * à la verticale.
 *
 * Le test porte sur des CAPACITÉS et non sur le nom du navigateur. Renifler
 * l'UserAgent vieillit mal — la liste s'allonge à chaque appareil, les
 * navigateurs mentent, un iPad récent s'annonce comme un Mac — et surtout il
 * rendrait la page non vérifiable depuis un poste de développement, alors que
 * tout l'outillage de recette du cadrage sert exactement à ça.
 */

afterEach(() => vi.restoreAllMocks());

/**
 * Simule les capacités d'un appareil.
 *
 * `matchMedia` est DÉFINI et non espionné : jsdom ne le fournit pas, et
 * `vi.spyOn` refuse d'espionner ce qui n'existe pas. C'est d'ailleurs le cas
 * qu'il faut savoir traverser — un navigateur sans `matchMedia` ne doit pas
 * faire planter la page.
 */
function pretend(coarse: boolean, orientation: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({ matches: query.includes('coarse') && coarse }),
    configurable: true,
    writable: true,
  });

  Object.defineProperty(window, 'screen', {
    value: orientation ? { orientation: {} } : {},
    configurable: true,
  });
}

describe('détection d\'appareil — sur quoi joue-t-on ?', () => {
  it('survit à un navigateur sans matchMedia', () => {
    // Les WebViews anciennes de la cible Android 5.1 : l'absence de la
    // fonction ne doit pas lever, seulement rendre la réponse prudente.
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true });

    expect(() => isHandheld()).not.toThrow();
    expect(isHandheld()).toBe(false);
  });

  it('reconnaît un appareil tenu en main', () => {
    pretend(true, true);

    expect(isHandheld()).toBe(true);
  });

  it('ne prend pas un PC pour un téléphone', () => {
    // Le cas signalé par PO : une fenêtre plus haute que large sur un
    // moniteur. L'utilisateur ne tournera pas son écran.
    pretend(false, true);

    expect(isHandheld()).toBe(false);
  });

  it('ne prend pas un écran tactile de bureau pour un téléphone', () => {
    // Un tout-en-un tactile répond « pointeur grossier » sans que son écran
    // se tourne jamais. Exiger les DEUX capacités l'écarte.
    pretend(true, false);

    expect(isHandheld()).toBe(false);
  });

  it('se tait quand il ne peut pas trancher', () => {
    // Mieux vaut ne pas afficher le message que de l'afficher à tort : un
    // conseil faux use la confiance plus qu'il n'aide.
    pretend(false, false);

    expect(isHandheld()).toBe(false);
  });
});

describe('détection d\'appareil — la recette peut forcer les deux cas', () => {
  it('force le mode mobile', () => {
    pretend(false, false);

    expect(isHandheld({ force: 'mobile' })).toBe(true);
  });

  it('force le mode bureau', () => {
    pretend(true, true);

    expect(isHandheld({ force: 'desktop' })).toBe(false);
  });

  it('lit le forçage dans l\'URL', () => {
    expect(readDeviceOverride('?device=mobile').force).toBe('mobile');
    expect(readDeviceOverride('?device=desktop').force).toBe('desktop');
  });

  it('ne force rien sans paramètre', () => {
    expect(readDeviceOverride('').force).toBeUndefined();
    expect(readDeviceOverride('?device=tablette').force).toBeUndefined();
  });
});
