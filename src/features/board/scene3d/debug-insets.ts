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
