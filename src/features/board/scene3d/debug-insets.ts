/**
 * Forcer et lire les marges de cadrage, pour pouvoir recetter sans l'appareil.
 *
 * Le problème que ça règle : « il teste, il dit que ce n'est pas centré, on
 * corrige à l'aveugle, il reteste. » Une encoche ne se reproduit pas sur un
 * navigateur de bureau, où les `env(safe-area-inset-*)` valent zéro. Sans
 * moyen de la simuler, chaque correction se vérifie à distance et au jugé.
 *
 * Les valeurs se passent par l'URL :
 *
 *   ?top=96&bottom=88          marges applicatives, en pixels
 *   ?safeTop=48&safeBottom=24  encoches système simulées
 *   ?debug=1                   trace le cadre visé à l'écran
 *   ?favor=4                   force la faveur des dieux, sans attendre le dé
 *
 * Elles ne changent rien au comportement par défaut : sans paramètre, tout
 * est mesuré sur le DOM comme en production.
 */

export interface InsetOverrides {
  top: number | null;
  bottom: number | null;
  safeTop: number | null;
  safeBottom: number | null;
  outline: boolean;
  /**
   * La faveur à forcer en recette, par sa SOMME — `?favor=4` pour Aphrodite.
   *
   * POURQUOI ÇA EXISTE : Aphrodite sort sur 1+3 ou 3+1, soit 2 jets sur 36.
   * Il faut d'abord tomber sur une case temple, puis faire cette somme-là :
   * une faveur sur dix-huit. La tester en jouant est impraticable.
   *
   * UN PARAMÈTRE D'URL PLUTÔT QU'UN BOUTON, et c'est délibéré. Un bouton
   * « pour tester, on le supprimera après » reste : il faut y penser, et
   * personne n'y pense. Celui-ci ne s'active que si on le demande, ne
   * s'affiche jamais en partie, et ne coûte rien à laisser en place — c'est
   * la convention déjà retenue pour `?debug=1` et les encoches simulées.
   *
   * `null` en l'absence du paramètre : le jeu tire ses dés normalement.
   */
  favor: number | null;
}

function readNumber(params: URLSearchParams, key: string): number | null {
  if (!params.has(key)) return null;

  const value = Number(params.get(key));

  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Lit les valeurs forcées dans l'URL. */
export function readInsetOverrides(search: string): InsetOverrides {
  const params = new URLSearchParams(search);

  return {
    top: readNumber(params, 'top'),
    bottom: readNumber(params, 'bottom'),
    safeTop: readNumber(params, 'safeTop'),
    safeBottom: readNumber(params, 'safeBottom'),
    outline: params.get('debug') === '1',
    favor: readFavorSum(params),
  };
}

/**
 * Applique les encoches simulées au document.
 *
 * Le navigateur n'expose `env(safe-area-inset-*)` qu'en lecture : on ne peut
 * pas les écrire. On pose donc des variables CSS que la feuille de style
 * consulte en priorité, ce qui permet de simuler une encoche là où il n'y en
 * a pas.
 */
export function applySimulatedSafeArea(overrides: InsetOverrides): void {
  const root = document.documentElement;

  if (overrides.safeTop !== null) {
    root.style.setProperty('--safe-top', `${overrides.safeTop}px`);
  }

  if (overrides.safeBottom !== null) {
    root.style.setProperty('--safe-bottom', `${overrides.safeBottom}px`);
  }
}

/** Ce que le cadrage a réellement retenu, pour l'afficher. */
export function describeInsets(
  insets: { top: number; bottom: number },
  viewport: { width: number; height: number }
): string {
  const free = Math.max(0, viewport.height - insets.top - insets.bottom);

  return `écran ${viewport.width}×${viewport.height} · marges ${insets.top}/${insets.bottom} · libre ${free}px`;
}

/**
 * La faveur forcée par l'URL, ou `null`.
 *
 * Bornée aux sommes que deux dés peuvent produire : une valeur hors table ne
 * désignerait aucune faveur, et mieux vaut l'ignorer que d'ouvrir un écran
 * vide.
 */
function readFavorSum(params: URLSearchParams): number | null {
  if (!params.has('favor')) return null;

  const sum = Number(params.get('favor'));
  if (!Number.isInteger(sum) || sum < 2 || sum > 12) return null;

  return sum;
}
