import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Le conseil « tourne ton téléphone » ne doit JAMAIS empêcher de jouer.
 *
 * Quentin, sur son téléphone : « le message s'affiche mais le plateau reste
 * inaccessible, je ne peux pas jouer ».
 *
 * Ma première version posait un panneau plein écran, fond opaque et sans
 * `pointer-events: none` : le plateau était bien dessiné derrière, mais
 * aucun geste ne l'atteignait. J'avais écrit dans le commit « c'est un
 * conseil, pas un blocage » — et livré exactement un blocage.
 *
 * Quentin a explicitement refusé le verrouillage d'orientation (option b) :
 * le portrait doit rester JOUABLE, seulement moins confortable. Un conseil
 * qui empêche de jouer trahit cette décision.
 *
 * Le test lit la feuille de style plutôt que de simuler un rendu : jsdom ne
 * calcule ni la mise en page ni le passage des événements, donc un test qui
 * cliquerait « à travers » le panneau ne vérifierait rien.
 */

const html = readFileSync('index-3d.html', 'utf8');

/** Le bloc de style d'un sélecteur. */
function ruleFor(selector: string): string {
  const start = html.indexOf(`${selector} {`);
  if (start < 0) return '';

  return html.slice(start, html.indexOf('}', start));
}

describe('« tourne ton téléphone » — un conseil, pas un mur', () => {
  it('laisse passer les gestes vers le plateau', () => {
    // LA propriété qui décide de tout : sans elle, le panneau intercepte
    // chaque toucher et le jeu devient inutilisable en portrait.
    expect(ruleFor('#rotate-hint')).toContain('pointer-events: none');
  });

  it('ne couvre pas tout l\'écran', () => {
    const rule = ruleFor('#rotate-hint');

    // `inset: 0` étire le panneau sur les quatre bords : c'est ce qui
    // masquait le plateau entier.
    expect(rule).not.toContain('inset: 0');
  });

  it('ne pose pas de fond opaque sur toute la page', () => {
    // Le fond appartient à la carte du message, pas au panneau qui la porte.
    expect(ruleFor('#rotate-hint')).not.toContain('background');
  });

  it('reste au-dessus du plateau mais sous les commandes', () => {
    // Il doit se voir sans passer devant les boutons, qui eux doivent rester
    // cliquables.
    const hint = Number(/z-index:\s*(\d+)/.exec(ruleFor('#rotate-hint'))?.[1]);
    const bar = Number(/z-index:\s*(\d+)/.exec(ruleFor('.bar'))?.[1]);

    expect(hint).toBeGreaterThan(0);
    expect(hint).toBeGreaterThanOrEqual(bar);
  });

  it('est caché par défaut', () => {
    // `hidden` dans le balisage : il n'apparaît qu'après la mesure, jamais
    // pendant le chargement.
    expect(html).toContain('id="rotate-hint" hidden');
  });
});
