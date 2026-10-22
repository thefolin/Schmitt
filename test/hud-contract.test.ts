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
  it('range le journal dans un tiroir fermé', () => {
    // « Ne pas afficher l'historique directement » : il occupait trois lignes
    // en permanence pour un confort. Le plateau récupère la place.
    //
    // CE N'EST PLUS `hidden` QUI LE FERME : le panneau coulisse depuis la
    // gauche, et un `display: none` empêcherait toute transition. L'état
    // vit dans `data-open`, comme pour le panneau des dés.
    expect(page).toMatch(/<div id="journal-panel"[^>]*data-open="false"/);
  });

  it('empêche le tiroir fermé de happer les gestes de caméra', () => {
    // UN TIROIR TRANSLATÉ HORS DE L'ÉCRAN RESTE DANS L'ARBRE : sans
    // `pointer-events: none`, il intercepterait les gestes lancés depuis le
    // bord de l'écran, et le plateau ne tournerait plus de ce côté.
    expect(page).toMatch(/#journal-panel\s*\{[^}]*pointer-events:\s*none/);
    expect(page).toMatch(/#dice-panel\s*\{[^}]*pointer-events:\s*none/);
  });

  it('garde l\'onglet ATTEIGNABLE quand son panneau est ouvert', () => {
    // VU EN IMAGE, invisible au DOM : une règle héritée du temps où le
    // bouton vivait dans la barre du bas l'effaçait à l'ouverture. Mesuré à
    // 0 × 0 px — il ne restait plus aucun moyen de refermer hors la croix,
    // alors que l'onglet est précisément censé basculer.
    expect(page).not.toMatch(/body\[data-dice-panel="open"\]\s*#dice-open\s*\{[^}]*display:\s*none/);

    // Il suit le panneau plutôt que de rester collé au bord, sinon il
    // passerait dessous.
    expect(page).toMatch(/body\[data-dice-panel="open"\]\s*\.edge-right\s*\{[^}]*translate/);
  });

  it('arrête la barre du bas au panneau, et non au bord de l\'écran', () => {
    // MESURÉ : 500 px de large alors que le plateau n'en occupait que 290.
    // Ses boutons de droite passaient SOUS le panneau et devenaient
    // intouchables — « Lancer » le premier.
    // LA RÈGLE PRINCIPALE, et non celle de la media query : `.foot {`
    // apparaît deux fois, et viser la première attrapait la mauvaise.
    const start = page.indexOf('\n        .foot {');
    const foot = page.slice(start, page.indexOf('}', start));

    expect(foot).toMatch(/right:\s*var\(--dice-panel\)/);
  });

  it('pose les deux onglets sur les bords, et non dans la barre du bas', () => {
    // Demande de Quentin : « bouton 📜 à gauche, bouton 🎲 à droite ». Le
    // geste part d'où le panneau arrive.
    // LA BARRE S'ARRÊTE À SA PROPRE FERMETURE, et non à `</body>` : les
    // onglets vivent APRÈS elle dans la page, et un découpage trop large
    // les attraperait alors qu'ils en sont justement sortis.
    const start = page.indexOf('<div class="foot"');
    const foot = page.slice(start, page.indexOf('\n    </div>', start));

    expect(foot).toContain('id="roll"');
    expect(foot).not.toContain('id="journal-open"');
    expect(foot).not.toContain('id="dice-open"');

    expect(page).toMatch(/<button id="journal-open"[^>]*class="edge-tab edge-left"/);
    expect(page).toMatch(/<button id="dice-open"[^>]*class="edge-tab edge-right"/);
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

describe('HUD — le panneau des dés', () => {
  it('porte son bouton d\'ouverture dans la barre du bas', () => {
    expect(pageIds().has('dice-open')).toBe(true);

    const foot = page.slice(page.indexOf('<div class="foot"'), page.indexOf('</body>'));
    expect(foot).toContain('id="dice-open"');
  });

  it('porte les éléments que la scène pilote', () => {
    // `getElementById` ne lève pas sur un identifiant disparu : le panneau
    // cesserait simplement de répondre, sans que rien ne le signale.
    for (const id of [
      'dice-panel',
      'dice-panel-close',
      'dice-panel-roll',
      'dice-panel-value',
      'dice-panel-caption',
    ]) {
      expect(pageIds().has(id)).toBe(true);
    }
  });

  it('laisse TOUTE la largeur au plateau tant qu\'il est fermé', () => {
    // EN PORTRAIT LA LARGEUR EST COMPTÉE — contrainte de CLAUDE.md, et
    // TODO.md §2 garde la trace d'un cadrage tombé à « 8 cases sur 23 ».
    // Un panneau ouvert d'office amputerait le plateau en continu.
    expect(page).toMatch(/--dice-panel:\s*0px/);
    expect(page).toMatch(/<aside id="dice-panel"[^>]*data-open="false"/);
  });

  it('fait céder la place au plateau, au lieu de passer dessus', () => {
    // `#scene` consomme la variable dans son `right` : la scène se mesure
    // sur son conteneur et recadre sur ce qui lui reste.
    const scene3d = page.slice(page.indexOf('#scene {'), page.indexOf('#scene:active'));

    expect(scene3d).toMatch(/right:\s*var\(--dice-panel\)/);
  });

  it('accorde la durée du coulissement entre la feuille et la scène', () => {
    // LA SCÈNE RECADRE APRÈS L'ANIMATION : si les deux durées divergent,
    // elle mesure la largeur de départ et garde un cadrage périmé.
    expect(page).toMatch(/transition:\s*right\s*300ms/);
    expect(scene).toMatch(/PANEL_SLIDE_MS\s*=\s*300/);
  });
});

describe('HUD — le bouton de recette de Poséidon', () => {
  it('existe dans la barre du bas', () => {
    expect(pageIds().has('test-poseidon')).toBe(true);

    const foot = page.slice(page.indexOf('<div class="foot"'), page.indexOf('</body>'));
    expect(foot).toContain('id="test-poseidon"');
  });

  it('se dit « Test », pour qu\'on ne le prenne pas pour une commande du jeu', () => {
    // Il est visible par défaut, comme l'était celui d'Aphrodite : la
    // recette se fait autour d'une table, où personne ne tape une URL. Le
    // libellé est la seule chose qui empêche un joueur de le presser.
    expect(page).toMatch(/<button id="test-poseidon"[^>]*>[^<]*Test/);
  });

  it('tire les faces AU HASARD, comme la faveur elle-même', () => {
    // LE LANCER EST AUTOMATIQUE, tranché par Quentin : l'écran est un
    // rappel, pas une séquence à jouer. Des faces écrites en dur
    // montreraient toujours le même résultat, et le bouton ne testerait
    // plus ce que voit un joueur.
    const handler = scene.slice(
      scene.indexOf("document.getElementById('test-poseidon')"),
      scene.indexOf("document.getElementById('roll')")
    );

    expect(handler).toContain('rollPoseidon()');
  });
});

describe('HUD — le bouton de recette d\'Hermès', () => {
  it('existe dans la barre du bas', () => {
    expect(pageIds().has('test-hermes')).toBe(true);

    const foot = page.slice(page.indexOf('<div class="foot"'), page.indexOf('</body>'));
    expect(foot).toContain('id="test-hermes"');
  });

  it('se dit « Test », pour qu\'on ne le prenne pas pour une commande du jeu', () => {
    expect(page).toMatch(/<button id="test-hermes"[^>]*>[^<]*Test/);
  });

  it('ouvre l\'écran DIRECTEMENT, sans dés', () => {
    // HERMÈS NE DEMANDE AUCUN SECOND JET, tranché par Quentin : sa règle
    // n'en parle pas. Passer par un lancer ferait éprouver une séquence qui
    // n'existe pas.
    const handler = scene.slice(
      scene.indexOf("document.getElementById('test-hermes')"),
      scene.indexOf("document.getElementById('roll')")
    );

    expect(handler).toContain('openHermes()');
  });
});
