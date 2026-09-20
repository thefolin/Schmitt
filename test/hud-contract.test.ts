import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * LE CONTRAT ENTRE LA PAGE ET LA SCÈNE.
 *
 * POURQUOI CE FICHIER EXISTE : la refonte du HUD en barre flottante a
 * déplacé, renommé ou retiré une quinzaine d'éléments de `index-3d.html`, et
 * les 888 tests sont passés sans broncher. La scène retrouve ses éléments par
 * `getElementById` : un identifiant disparu ne casse rien à la compilation,
 * ne lève aucune exception — le bouton cesse simplement de répondre, et
 * personne ne l'apprend avant d'avoir l'APK en main.
 *
 * Ce fichier ne juge NI l'apparence NI la mise en page : jsdom ne calcule
 * aucun style, et « minimaliste, style Waze » se juge à l'œil. Il vérifie
 * seulement que ce que la scène réclame existe dans la page.
 */

const ROOT = resolve(__dirname, '..');
const page = readFileSync(resolve(ROOT, 'index-3d.html'), 'utf8');
const scene = readFileSync(
  resolve(ROOT, 'src/features/board/scene3d/preview.ts'),
  'utf8'
);

/** Les identifiants posés dans la page. */
function pageIds(): Set<string> {
  return new Set([...page.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
}

/** Les identifiants que la scène va chercher. */
function sceneIds(): Set<string> {
  return new Set(
    [...scene.matchAll(/getElementById\('([a-zA-Z0-9_-]+)'\)/g)].map(m => m[1])
  );
}

describe('HUD — la page porte ce que la scène réclame', () => {
  it('ne réclame aucun élément absent de la page', () => {
    // C'EST LE TEST QUI MANQUAIT. Un identifiant renommé d'un côté et pas de
    // l'autre donne un bouton muet, sans erreur nulle part.
    const missing = [...sceneIds()].filter(id => !pageIds().has(id));

    expect(missing).toEqual([]);
  });
});

describe('HUD — ce sans quoi on ne peut pas jouer', () => {
  /**
   * Les éléments dont l'absence rend la partie INJOUABLE, par opposition à
   * ceux qui sont un confort. On ne gagne pas de la place en retirant les
   * premiers.
   */
  const ESSENTIELS = [
    'scene', // le plateau lui-même
    'roll', // lancer le dé
    'whose-turn', // à qui est la main
    'dice-value', // la face qu'on vient de faire
    'actions-panel', // ce que la table doit faire
  ];

  for (const id of ESSENTIELS) {
    it(`garde #${id}`, () => {
      expect(pageIds().has(id)).toBe(true);
    });
  }
});

describe('HUD — la barre d\'action porte les commandes', () => {
  const COMMANDES = ['roll', 'cinema', 'reset', 'whole', 'journal-open'];

  for (const id of COMMANDES) {
    it(`porte le bouton #${id}`, () => {
      expect(pageIds().has(id)).toBe(true);
    });
  }

  it('place les commandes dans la barre du bas', () => {
    // Elles vivaient à deux endroits : « Recadrer » en haut, le reste en bas.
    // Quentin les veut ensemble — « barre d'action en bas ».
    const foot = page.slice(page.indexOf('<div class="foot"'), page.indexOf('</body>'));

    for (const id of COMMANDES) {
      expect(foot).toContain(`id="${id}"`);
    }
  });
});

describe('HUD — l\'historique n\'est plus affiché d\'office', () => {
  it('range le journal dans un panneau masqué', () => {
    // « Ne pas afficher l'historique directement » : il occupait trois lignes
    // en permanence pour un confort. Le plateau récupère la place.
    expect(page).toMatch(/<div id="journal-panel"[^>]*\bhidden\b/);
  });

  it('garde le journal lui-même, dans ce panneau', () => {
    const panel = page.slice(
      page.indexOf('<div id="journal-panel"'),
      page.indexOf('<script')
    );

    expect(panel).toContain('id="journal"');
    expect(panel).toContain('id="progress"');
  });

  it('garde #progress autour de la progression', () => {
    // `renderProgress` s'en sert pour masquer la barre quand le parcours n'a
    // pas de sens : SANS LUI elle ne met plus rien à jour du tout, et la
    // fonction sort avant d'avoir rien fait.
    const progress = page.slice(page.indexOf('<div id="progress">'));

    expect(progress).toContain('id="progress-label"');
    expect(progress).toContain('id="progress-fill"');
  });
});

describe('HUD — le diagnostic a quitté l\'écran de jeu', () => {
  it('masque le bandeau de mesure par défaut', () => {
    // Il servait à RÉGLER le cadrage, pas à jouer. Quentin le veut hors de
    // l'écran : « minimaliste, style Waze ».
    expect(page).toMatch(/<div class="bar" id="bar"[^>]*\bhidden\b/);
  });

  it('le masque VRAIMENT, et pas seulement dans le DOM', () => {
    // CE TEST A MANQUÉ UNE FOIS, et le bandeau est resté à l'écran : il
    // lisait l'attribut `hidden`, qui ne vaut qu'un `display: none` de la
    // feuille par défaut du navigateur. `.bar` pose `display: flex`, qui
    // l'emporte — le DOM disait « caché », l'écran montrait le contraire.
    //
    // Même défaut que sur la modale d'action, reproduit à l'identique. La
    // leçon : sur un élément qui porte un `display`, l'attribut seul ne
    // masque rien.
    expect(page).toMatch(/\.bar\[hidden\]\s*\{[^}]*display:\s*none/);
    expect(scene).toMatch(/diagnostics\.style\.display/);
  });

  it('le garde disponible pour la recette', () => {
    // Il n'est pas supprimé : c'est l'instrumentation qui a permis de régler
    // le cadrage portrait, et la reconstruire de mémoire coûterait cher.
    // Elle reparaît avec `?debug=1`.
    expect(page).toContain('id="status"');
    expect(scene).toContain("document.getElementById('bar')");
    expect(scene).toMatch(/diagnostics\.hidden\s*=\s*!overrides\.outline/);
  });
});

describe('HUD — le bouton de recette d\'Aphrodite', () => {
  it('existe dans la barre du bas', () => {
    // Aphrodite sort sur deux jets sur trente-six, après être tombé sur un
    // temple : une faveur sur dix-huit. L'atteindre en jouant est
    // impraticable, et Quentin veut la tester au clic.
    expect(pageIds().has('test-aphrodite')).toBe(true);

    const foot = page.slice(page.indexOf('<div class="foot"'), page.indexOf('</body>'));
    expect(foot).toContain('id="test-aphrodite"');
  });

  it('se dit « Test », pour qu\'on ne le prenne pas pour une commande du jeu', () => {
    // IL EST VISIBLE PAR DÉFAUT, tranché par Quentin : la recette se fait à
    // plusieurs autour d'une table, où personne ne tape un paramètre d'URL.
    // Le libellé est donc la seule chose qui empêche un joueur de le presser
    // en croyant jouer.
    expect(page).toMatch(/<button id="test-aphrodite"[^>]*>[^<]*Test/);
    expect(page).not.toMatch(/<button id="test-aphrodite"[^>]*\bhidden\b/);
  });

  it('ouvre l\'écran DIRECTEMENT, sans passer par le lancer', () => {
    // IL PASSAIT D'ABORD PAR LE VRAI CHEMIN — dés posés, joueur qui les
    // lance — et le bouton paraissait mort : les dés se posaient
    // discrètement, et la seule consigne partait dans `#turn-log`, qui vit
    // depuis la refonte du HUD à l'intérieur du panneau d'historique,
    // masqué par défaut.
    //
    // Le bouton sert à REGARDER L'ÉCRAN. Le vrai chemin reste celui d'une
    // faveur tirée en jouant, et `?favor=4` l'éprouve de bout en bout.
    const handler = scene.slice(
      scene.indexOf('const aphroditeTest'),
      scene.indexOf("document.getElementById('roll')")
    );

    expect(handler).toContain('openAphrodite(');
    expect(handler).not.toContain('offerAphroditeDice()');
  });

  it('ouvre sur une somme qui désigne bien Aphrodite', () => {
    // Deux faces DISTINCTES, et de somme 4 : un double serait la Colère des
    // dieux, et deux faces égales rendraient les colonnes indiscernables.
    const handler = scene.slice(
      scene.indexOf('const aphroditeTest'),
      scene.indexOf("document.getElementById('roll')")
    );

    const call = /openAphrodite\((\d+),\s*(\d+)\)/.exec(handler)!;
    const [a, b] = [Number(call[1]), Number(call[2])];

    expect(a + b).toBe(4);
    expect(a).not.toBe(b);
  });
});
