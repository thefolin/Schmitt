/**
 * Est-on sur un appareil qu'on tient dans la main ?
 *
 * La question se pose pour une seule raison : « tourne ton téléphone » n'a de
 * sens que si l'écran PEUT être tourné. Sur un PC dont la fenêtre est plus
 * haute que large, le message est faux — l'utilisateur ne tournera pas son
 * moniteur.
 *
 * Le test porte sur des CAPACITÉS, pas sur le nom du navigateur. Renifler
 * l'UserAgent est le réflexe habituel, mais il vieillit mal : chaque nouvel
 * appareil oblige à rallonger la liste, les navigateurs mentent sur leur
 * identité depuis toujours, et un iPad récent s'annonce comme un Mac. Surtout,
 * une liste de noms rendrait la page non testable sur un poste de
 * développement — alors que tout l'outillage de recette du cadrage sert
 * justement à vérifier le comportement mobile depuis un navigateur de bureau.
 *
 * Deux capacités suffisent et se combinent :
 *   - l'écran expose une ORIENTATION qu'on peut lire
 *   - le pointeur principal est GROSSIER, celui d'un doigt et non d'une souris
 */

export interface DeviceHints {
  /** Forcé par la recette, pour vérifier les deux cas depuis un bureau. */
  force?: 'mobile' | 'desktop';
}

/**
 * Un appareil dont l'orientation a un sens pour l'utilisateur.
 *
 * Renvoie `false` quand on ne peut pas trancher : mieux vaut ne pas afficher
 * le message que de l'afficher à tort sur un poste fixe.
 */
export function isHandheld(hints: DeviceHints = {}): boolean {
  if (hints.force === 'mobile') return true;
  if (hints.force === 'desktop') return false;

  if (typeof window === 'undefined') return false;

  // Un pointeur grossier : le doigt. Une souris ou un trackpad répondent
  // « fine ». C'est le signal le plus fiable, et il ne nomme aucun appareil.
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

  // L'orientation n'existe que là où l'écran tourne avec l'appareil.
  const hasOrientation =
    typeof window.screen !== 'undefined' && window.screen.orientation !== undefined;

  // Les deux, et non l'un ou l'autre : un écran tactile de bureau répond
  // « coarse » sans pour autant se tourner, et certains navigateurs de bureau
  // exposent `screen.orientation` sans que l'écran bouge jamais.
  return coarse && hasOrientation;
}

/** Lit un forçage dans l'URL : `?device=mobile` ou `?device=desktop`. */
export function readDeviceOverride(search: string): DeviceHints {
  const value = new URLSearchParams(search).get('device');

  if (value === 'mobile' || value === 'desktop') return { force: value };

  return {};
}
