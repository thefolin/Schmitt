import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  modalSteps,
  runModalSteps,
  showActionModal,
  favorStep,
} from '@/features/board/scene3d/action-modal';
import { readFavorRoll, forcedFaces } from '@/features/board/scene3d/god-favor-roll';
import { GOD_FAVORS } from '@/features/game/god-favors';
import type { TurnOutcome } from '@/features/board/scene3d/turn-runner';
import type { TileConfig } from '@/core/models/Tile';

/**
 * La modale qui arrête le jeu le temps que la table s'exécute.
 *
 * Ce qui se vérifie ici est le COMPORTEMENT : ce qu'on énonce, et surtout ce
 * qu'on N'énonce PAS. L'apparence relève de `setup-screen.css` et se juge à
 * l'œil — jsdom ne calcule aucun style.
 *
 * Le point le plus délicat est la frontière tranchée par Quentin : la modale
 * ÉNONCE et attend, elle n'arbitre pas. Un bouton qui désignerait une cible
 * la ferait sortir de son rôle.
 */

/** Un tour ordinaire : rien à annoncer, personne ne boit. */
function plainTurn(over: Partial<TurnOutcome> = {}): TurnOutcome {
  return {
    player: 0,
    playerName: 'Quentin',
    dice: 4,
    steps: 4,
    from: 2,
    to: 6,
    returning: false,
    effect: null,
    schmittPower: false,
    winner: null,
    drinks: null,
    distribute: null,
    everyone: false,
    tableRule: false,
    godFavor: false,
    chicken: null,
    chickenPenalty: null,
    ...over,
  };
}

function tile(over: Partial<TileConfig> = {}): TileConfig {
  return { type: 'drink_3', icon: '🍺', name: 'BUVEZ 3 GORGÉES', ...over } as TileConfig;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Toutes les phrases d'un tour, tous écrans confondus. */
function allLines(...args: Parameters<typeof modalSteps>): string {
  return modalSteps(...args)
    .flatMap(step => step.lines)
    .join(' // ');
}

/** Valide l'écran affiché, et passe au suivant s'il y en a un. */
function validate(): void {
  document.querySelector<HTMLButtonElement>('#action-validate')!.click();
}

describe('tour — un tour ordinaire n\'interrompt personne', () => {
  it('ne produit aucune étape quand il n\'y a rien à dire', () => {
    // SANS CELA on fermerait une modale à CHAQUE tour, et on finirait par la
    // fermer sans la lire — y compris les tours qui comptent.
    expect(modalSteps(plainTurn())).toEqual([]);
  });

  it('n\'en produit pas non plus sur une case sans action', () => {
    const neutral = tile({ type: 'normal', name: 'CASE VIDE' });

    expect(modalSteps(plainTurn(), neutral)).toEqual([]);
  });
});

describe('tour — les événements s\'enchaînent DANS L\'ORDRE', () => {
  it('sépare la sentence du Poulet de l\'action de la case', () => {
    // C'EST LE BUG DE QUENTIN : « la modale affiche tout mélangé ». La
    // sentence frappe un AUTRE joueur, sur le jet, AVANT tout déplacement ;
    // l'action de la case frappe celui qui joue, après. Les mettre sur un
    // même écran demandait de démêler deux règles sous une seule image.
    const steps = modalSteps(
      plainTurn({
        chickenPenalty: { name: 'Bastien', distributes: false, roll: 3 },
        drinks: { player: 0, amount: 3 },
      }),
      tile()
    );

    expect(steps).toHaveLength(2);
    expect(steps[0].lines.join(' ')).toContain('Bastien');
    expect(steps[1].lines.join(' ')).toContain('Quentin');
  });

  it('suit l\'ordre d\'exécution du tour', () => {
    // L'ORDRE EST CELUI DE `playTurn` : sentence du Poulet (sur le jet),
    // puis effet de la case, puis prise du titre, puis faveur des dieux.
    // C'est l'ordre dans lequel les règles s'appliquent réellement.
    const steps = modalSteps(
      plainTurn({
        chickenPenalty: { name: 'Bastien', distributes: false, roll: 6 },
        chicken: { rank: 1 },
        godFavor: true,
      }),
      tile({ type: 'chicken', name: 'POULET' })
    );

    expect(steps.map(step => step.title)).toEqual([
      'Le Poulet',
      'Le Poulet',
      'Faveur des dieux',
    ]);
    expect(steps[0].lines.join(' ')).toContain('Bastien');
    expect(steps[1].lines.join(' ')).toContain('Quentin');
  });

  it('place le bouclier avant tout le reste', () => {
    // Il a INTERCEPTÉ une sanction : ce qui suit se lit en sachant qu'elle
    // est retombée sur son porteur.
    const steps = modalSteps(
      plainTurn({ drinks: { player: 0, amount: 2 } }),
      tile(),
      { playerName: 'Chloé', amount: 4 }
    );

    expect(steps[0].title).toContain('Athéna');
    expect(steps[0].lines.join(' ')).toContain('Chloé');
  });

  it('garde la victoire pour la fin', () => {
    const steps = modalSteps(
      plainTurn({ winner: 'Bastien', drinks: { player: 0, amount: 2 } }),
      tile()
    );

    expect(steps[steps.length - 1].title).toBe('Victoire');
  });

  it('n\'ouvre qu\'un écran pour une case ordinaire', () => {
    // Découper un tour simple en plusieurs écrans serait le défaut inverse :
    // on validerait trois fois pour une seule gorgée.
    const steps = modalSteps(plainTurn({ drinks: { player: 0, amount: 3 } }), tile());

    expect(steps).toHaveLength(1);
  });
});

describe('tour — chaque étape dit ce qu\'il faut faire', () => {
  it('annonce les gorgées de la case', () => {
    expect(allLines(plainTurn({ drinks: { player: 0, amount: 3 } }), tile())).toContain(
      'Quentin'
    );
  });

  it('annonce une distribution', () => {
    const lines = allLines(
      plainTurn({ distribute: { by: 0, amount: 2 } }),
      tile({ type: 'distribute_2', name: 'DISTRIBUEZ 2 GORGÉES' })
    );

    expect(lines).toContain('distribue');
  });

  it('n\'AVALE PLUS la distribution quand le Poulet frappe le même tour', () => {
    // LE DÉFAUT TROUVÉ EN CHEMIN : `tableAnnouncement` s'arrête à la
    // PREMIÈRE chose trouvée et renvoyait la sentence OU la distribution,
    // jamais les deux. Un tour qui produisait les deux en perdait une en
    // silence — des gorgées que personne ne distribuait.
    const lines = allLines(
      plainTurn({
        chickenPenalty: { name: 'Bastien', distributes: false, roll: 3 },
        distribute: { by: 0, amount: 2 },
      }),
      tile({ type: 'distribute_2', name: 'DISTRIBUEZ 2 GORGÉES' })
    );

    expect(lines).toContain('Bastien');
    expect(lines).toContain('distribue');
  });

  it('dit la règle d\'une case qui se joue à la table', () => {
    const rule = tile({
      type: 'rule',
      name: 'LE SCHMITT',
      description: 'Invente une règle que tous doivent suivre',
    });

    expect(allLines(plainTurn({ tableRule: true }), rule)).toContain('règle');
  });

  it('annonce la prise du titre de Poulet', () => {
    // CE STATUT N'EST ANNONCÉ NULLE PART AILLEURS : c'est lui qui déclenche
    // la sentence à tous les tours suivants, et personne ne peut l'appliquer
    // sans l'avoir entendu poser.
    const lines = allLines(
      plainTurn({ chicken: { rank: 1 } }),
      tile({ type: 'chicken', name: 'POULET' })
    );

    expect(lines).toContain('Poulet');
    expect(lines).toContain('Quentin');
  });

  it('distingue le GROS Poulet, qui distribue au lieu de boire', () => {
    const lines = allLines(
      plainTurn({ chicken: { rank: 2 } }),
      tile({ type: 'chicken', name: 'POULET' })
    );

    expect(lines).toContain('distribuera');
  });

  it('ne dit pas deux fois la distribution', () => {
    // SCH-11 de Bastien : « le texte est répété 2 fois ».
    const lines = allLines(
      plainTurn({ distribute: { by: 0, amount: 2 } }),
      tile({ type: 'distribute_2', name: 'DISTRIBUEZ 2 GORGÉES' })
    ).split(' // ');

    expect(lines.filter(line => line.includes('distribue'))).toHaveLength(1);
  });
});

describe('tour — chaque étape MONTRE la case', () => {
  it('donne l\'illustration à l\'étape de la case', () => {
    const steps = modalSteps(
      plainTurn({ drinks: { player: 0, amount: 3 } }),
      tile({ image: 'assets/drink_3.png', name: 'BUVEZ 3 GORGÉES' })
    );

    expect(steps[0].tile!.src).toBe('/assets/drink_3.png');
    expect(steps[0].tile!.alt).toBe('BUVEZ 3 GORGÉES');
  });

  it('ne met AUCUNE illustration sur la sentence du Poulet', () => {
    // Elle frappe un autre joueur, sur le jet : elle n'a rien à voir avec la
    // case où le pion vient de se poser. Y coller son image ferait croire
    // que c'est cette case qui la déclenche.
    const steps = modalSteps(
      plainTurn({ chickenPenalty: { name: 'Bastien', distributes: false, roll: 3 } }),
      tile({ image: 'assets/drink_3.png' })
    );

    expect(steps[0].tile).toBeNull();
  });

  it('reste affichable quand la case n\'a pas d\'illustration', () => {
    const steps = modalSteps(
      plainTurn({ drinks: { player: 0, amount: 3 } }),
      tile({ image: undefined })
    );

    expect(steps).toHaveLength(1);
    expect(steps[0].tile).toBeNull();
  });

  it('reporte le VRAI chiffre sur une illustration qui en porte un gravé', () => {
    // Une seule illustration sert pour ×2, ×3 et ×4 : sans ce report, une
    // case ×4 montrerait « ×2 » au joueur.
    const steps = modalSteps(
      plainTurn({ drinks: { player: 0, amount: 4 } }),
      tile({ image: 'assets/drink_2.png', amount: 4 })
    );

    expect(steps[0].tile!.amount).toBe(4);
  });
});

describe('modale — les écrans se jouent l\'un après l\'autre', () => {
  const deux = [
    { title: 'Le Poulet', tile: null, lines: ['Bastien boit 1 🍺'] },
    { title: 'Au tour de Quentin', tile: null, lines: ['Quentin boit 3 🍺'] },
  ];

  it('n\'affiche que le PREMIER écran au départ', () => {
    runModalSteps(deux, () => {});

    expect(document.body.textContent).toContain('Bastien');
    expect(document.body.textContent).not.toContain('Quentin boit');
  });

  it('passe au suivant à la validation', () => {
    runModalSteps(deux, () => {});

    validate();

    expect(document.body.textContent).toContain('Quentin boit');
  });

  it('ne rend la main QU\'APRÈS le dernier écran', () => {
    // C'EST LE VERROU : rendre la main dès le premier laisserait le joueur
    // suivant lancer alors qu'une règle n'a pas été appliquée.
    const done = vi.fn();
    runModalSteps(deux, done);

    validate();
    expect(done).not.toHaveBeenCalled();

    validate();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('annonce qu\'un écran suit, plutôt que de dire « Valider »', () => {
    // Un bouton qui dit « Valider » alors qu'un autre écran suit laisse
    // croire que le tour est fini.
    runModalSteps(deux, () => {});

    expect(document.querySelector('#action-validate')!.textContent).toBe('Suivant');

    validate();

    expect(document.querySelector('#action-validate')!.textContent).toBe('Valider');
  });

  it('ne laisse aucun écran derrière lui', () => {
    runModalSteps(deux, () => {});
    validate();
    validate();

    expect(document.querySelector('.action-modal')).toBeNull();
  });

  it('ne suspend rien quand il n\'y a aucune étape', () => {
    const done = vi.fn();

    expect(runModalSteps([], done)).toBe(false);
    expect(done).not.toHaveBeenCalled();
    expect(document.querySelector('.action-modal')).toBeNull();
  });
});

describe('modale — le jeu attend la validation', () => {
  it('s\'affiche', () => {
    showActionModal({ title: 'Test', tile: null, lines: ['Quentin boit 3 🍺'] }, () => {});

    expect(document.querySelector('.action-modal')).not.toBeNull();
    expect(document.body.textContent).toContain('Quentin boit');
  });

  it('ne rend la main QU\'AU clic sur Valider', () => {
    const done = vi.fn();
    showActionModal({ title: 'Test', tile: null, lines: ['x'] }, done);

    expect(done).not.toHaveBeenCalled();

    document.querySelector<HTMLButtonElement>('#action-validate')!.click();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('se retire une fois validée', () => {
    // SANS CELA elle resterait en `position: fixed` par-dessus le plateau :
    // le jeu tournerait derrière, injouable.
    showActionModal({ title: 'Test', tile: null, lines: ['x'] }, () => {});

    document.querySelector<HTMLButtonElement>('#action-validate')!.click();

    expect(document.querySelector('.action-modal')).toBeNull();
  });

  it('ne valide pas deux fois', () => {
    // Un double tap sur un téléphone ne doit pas faire reprendre deux tours.
    const done = vi.fn();
    const handles = showActionModal({ title: 'Test', tile: null, lines: ['x'] }, done);

    handles.validate();
    handles.validate();

    expect(done).toHaveBeenCalledTimes(1);
  });
});

/**
 * Est-elle réellement escamotée À L'ÉCRAN ?
 *
 * CE DÉTAIL A COÛTÉ UN ALLER-RETOUR SUR L'APK. Le premier test lisait la
 * propriété `hidden`, qui restait `true` pendant que la modale s'affichait :
 * l'attribut ne vaut qu'un `display: none` de la feuille par défaut du
 * navigateur, et `.setup-screen` pose `display: flex`, qui l'emporte. Le
 * DOM disait « cachée », l'écran montrait le contraire, et le test croyait
 * la zone couverte.
 *
 * jsdom ne calcule aucun style : on vérifie donc `display` posé sur
 * l'élément, qui est ce que le code contrôle désormais sans dépendre de
 * l'ordre des feuilles.
 */
function escamotee(selector: string): boolean {
  const element = document.querySelector<HTMLElement>(selector)!;

  return element.hidden && element.style.display === 'none';
}

describe('modale — on peut aller voir le plateau et revenir', () => {
  it('escamote sans rendre la main', () => {
    // C'EST LE POINT : « Voir le plateau » ne solde pas le tour. Si elle
    // rendait la main ici, le joueur suivant pourrait lancer alors que la
    // table n'a rien bu.
    const done = vi.fn();
    showActionModal({ title: 'Test', tile: null, lines: ['x'] }, done);

    document.querySelector<HTMLButtonElement>('#action-peek')!.click();

    expect(escamotee('.action-modal')).toBe(true);
    expect(done).not.toHaveBeenCalled();
  });

  it('laisse un rappel pour revenir', () => {
    // SANS LUI « Voir le plateau » serait un aller sans retour, et la partie
    // resterait suspendue sans que rien ne l'explique.
    showActionModal({ title: 'Test', tile: null, lines: ['x'] }, () => {});

    expect(escamotee('#action-recall')).toBe(true);

    document.querySelector<HTMLButtonElement>('#action-peek')!.click();

    expect(escamotee('#action-recall')).toBe(false);
  });

  it('ramène la modale au rappel', () => {
    showActionModal({ title: 'Test', tile: null, lines: ['x'] }, () => {});

    document.querySelector<HTMLButtonElement>('#action-peek')!.click();
    document.querySelector<HTMLButtonElement>('#action-recall')!.click();

    expect(escamotee('.action-modal')).toBe(false);
    expect(escamotee('#action-recall')).toBe(true);
  });

  it('emporte le rappel en validant', () => {
    // Un rappel laissé derrière rouvrirait une modale déjà soldée.
    showActionModal({ title: 'Test', tile: null, lines: ['x'] }, () => {});

    document.querySelector<HTMLButtonElement>('#action-peek')!.click();
    document.querySelector<HTMLButtonElement>('#action-recall')!.click();
    document.querySelector<HTMLButtonElement>('#action-validate')!.click();

    expect(document.querySelector('#action-recall')).toBeNull();
  });
});

describe('modale — elle n\'arbitre rien', () => {
  it('n\'offre AUCUN choix de cible', () => {
    // Quentin (19/09/2026) : « énoncé + à la table. Pas de sélection dans
    // l'app, pas de choix à arbitrer. » Ce test est la garde de cette
    // décision : il échouera si un jour on ajoute des boutons de joueur.
    showActionModal(
      { title: 'Test', tile: null, lines: ['Quentin distribue 3 🍺'] },
      () => {}
    );

    const buttons = [...document.querySelectorAll('.action-modal button')];

    expect(buttons).toHaveLength(2);
    expect(buttons.map(b => b.textContent)).toEqual(['Voir le plateau', 'Valider']);
  });
});


describe('faveur des dieux — elle s\'annonce comme une case', () => {
  /** Le jet qui donne une faveur, sans passer par la physique. */
  function favorRoll(a: number, b: number) {
    return readFavorRoll(a, b);
  }

  it('montre le dieu, et dit sa règle', () => {
    // Demande de Quentin : « même spec que les cases » — image + règle +
    // boutons. Une faveur est une règle à appliquer à la table au même titre
    // qu'une case.
    const step = favorStep(favorRoll(1, 2))!;

    expect(step.title).toContain('ATHÉNA');
    expect(step.tile!.src).toBe('/assets/cells/god_3.png');
    expect(step.lines.join(' ')).toContain('bouclier');
  });

  it('dit la somme, pour que le joueur vérifie les dés qu\'il voit', () => {
    // Sans elle, impossible de contrôler que l'application lit les mêmes
    // faces que lui — et dans un jeu à boire, ça se conteste.
    const step = favorStep(favorRoll(4, 5))!;

    expect(step.lines[0]).toBe('4 + 5 = 9');
  });

  it('écrit les gorgées avec le symbole (SCH-12)', () => {
    const step = favorStep(favorRoll(1, 2))!;

    expect(step.lines.join(' ')).toContain('\u{1F37A}');
    expect(step.lines.join(' ')).not.toMatch(/gorgées?/i);
  });

  it('s\'affiche SANS image pour les doubles, plutôt que d\'en inventer une', () => {
    // La COLÈRE DES DIEUX (2) et ZEUS (12) n'ont pas d'illustration : les
    // fichiers n'existent pas. On affiche le texte seul — mettre l'image
    // d'un autre dieu serait pire que pas d'image.
    const wrath = favorStep(favorRoll(1, 1))!;
    const zeus = favorStep(favorRoll(6, 6))!;

    expect(wrath.tile).toBeNull();
    expect(zeus.tile).toBeNull();
    expect(wrath.lines.join(' ')).toBeTruthy();
  });

  it('se joue avec les mêmes boutons qu\'une case', () => {
    const step = favorStep(favorRoll(1, 2))!;

    runModalSteps([step], () => {});

    expect(document.querySelector('#action-peek')).not.toBeNull();
    expect(document.querySelector('#action-validate')!.textContent).toBe('Valider');
    expect(document.querySelector<HTMLImageElement>('.action-modal-art')!.getAttribute('src'))
      .toBe('/assets/cells/god_3.png');
  });
});

describe('faveur des dieux — chaque dieu porte SON illustration', () => {
  /**
   * LA CORRESPONDANCE A ÉTÉ VÉRIFIÉE EN REGARDANT LES NEUF IMAGES, attributs
   * à l'appui — la chouette d'Athéna, la lyre d'Apollon, le trident de
   * Poséidon. Un commentaire de `main-camera.ts` s'y était refusé faute de
   * preuve, et cette prudence était juste : le nom d'un fichier ne prouve
   * rien.
   *
   * Ce test fige le résultat de cette vérification. Il échouera si la table
   * des faveurs est renumérotée sans que les images suivent — ce qui s'est
   * DÉJÀ produit (#34, décalage d'un cran sur les sommes 3 à 7).
   */
  const ATTENDU: Record<number, string> = {
    3: 'ATHÉNA',
    4: 'APHRODITE',
    5: 'HERMÈS',
    6: 'APOLLON',
    7: 'ARTÉMIS',
    8: 'ARÈS',
    9: 'DIONYSOS',
    10: 'HÉPHAÏSTOS',
    11: 'POSÉIDON',
  };

  for (const [sum, name] of Object.entries(ATTENDU)) {
    it(`donne ${name} pour la somme ${sum}`, () => {
      const favor = GOD_FAVORS[Number(sum)];

      expect(favor.name).toBe(name);

      // Un jet NON double qui fait cette somme : les doubles sont la Colère.
      const a = Number(sum) > 6 ? 6 : 1;
      const step = favorStep(readFavorRoll(a, Number(sum) - a))!;

      expect(step.tile!.src).toBe(`/assets/cells/god_${sum}.png`);
    });
  }
});

describe('recette — forcer une faveur sans attendre le bon jet', () => {
  it('donne bien la faveur demandée', () => {
    // POURQUOI ÇA EXISTE : Aphrodite sort sur 1+3 ou 3+1 — deux jets sur
    // trente-six, et encore faut-il être tombé sur un temple. Une faveur sur
    // dix-huit : la tester en jouant est impraticable.
    for (let sum = 3; sum <= 11; sum += 1) {
      const [a, b] = forcedFaces(sum)!;

      expect(a + b).toBe(sum);
      expect(readFavorRoll(a, b).favor).toBe(GOD_FAVORS[sum]);
    }
  });

  it('ne produit JAMAIS un double là où on attend une autre faveur', () => {
    // C'EST LE PIÈGE : un double est la Colère des dieux quelle que soit sa
    // valeur. Forcer la somme 8 avec 4+4 donnerait la Colère et non Arès —
    // le paramètre de recette mentirait sur ce qu'il teste.
    for (let sum = 3; sum <= 11; sum += 1) {
      const [a, b] = forcedFaces(sum)!;

      expect(a).not.toBe(b);
      expect(readFavorRoll(a, b).double).toBe(false);
    }
  });

  it('rend des faces qui existent sur un dé', () => {
    for (let sum = 2; sum <= 12; sum += 1) {
      const [a, b] = forcedFaces(sum)!;

      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
    }
  });

  it('donne la Colère pour les sommes qui n\'existent qu\'en double', () => {
    // 2 ne se fait qu'en 1+1, 12 qu'en 6+6 : ce sont des doubles, donc la
    // Colère. ZEUS (12) est inatteignable autrement, et c'est la table du
    // plateau qui le veut.
    expect(readFavorRoll(...forcedFaces(2)!).favor!.name).toContain('COLÈRE');
    expect(readFavorRoll(...forcedFaces(12)!).favor!.name).toContain('COLÈRE');
  });

  it('ne force rien quand rien n\'est demandé', () => {
    // Sans le paramètre, le jeu tire ses dés normalement.
    expect(forcedFaces(null)).toBeNull();
  });

  it('ignore une somme que deux dés ne peuvent pas faire', () => {
    for (const bogus of [0, 1, 13, 99, -4, 2.5]) {
      expect(forcedFaces(bogus)).toBeNull();
    }
  });
});
