import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modalContent, showActionModal } from '@/features/board/scene3d/action-modal';
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

describe('modale — un tour ordinaire n\'interrompt personne', () => {
  it('ne s\'ouvre pas quand il n\'y a rien à dire', () => {
    // SANS CELA on fermerait une modale à CHAQUE tour, et on finirait par la
    // fermer sans la lire — y compris les tours qui comptent.
    expect(modalContent(plainTurn())).toBeNull();
  });

  it('ne s\'ouvre pas non plus sur une case sans action', () => {
    const neutral = tile({ type: 'normal', name: 'CASE VIDE' });

    expect(modalContent(plainTurn(), neutral)).toBeNull();
  });
});

describe('modale — elle énonce ce que la table doit faire', () => {
  it('annonce les gorgées de la case', () => {
    const content = modalContent(plainTurn({ drinks: { player: 0, amount: 3 } }), tile());

    expect(content).not.toBeNull();
    expect(content!.lines.join(' ')).toContain('3');
    expect(content!.lines.join(' ')).toContain('Quentin');
  });

  it('annonce une distribution', () => {
    const content = modalContent(
      plainTurn({ distribute: { by: 0, amount: 2 } }),
      tile({ type: 'distribute_2', name: 'DISTRIBUEZ 2 GORGÉES' })
    );

    expect(content!.lines.join(' ')).toContain('distribue');
  });

  it('annonce la sentence du Poulet', () => {
    // Elle concerne un AUTRE joueur que celui qui joue : personne ne la
    // guette, et c'est la règle la plus souvent oubliée.
    const content = modalContent(
      plainTurn({ chickenPenalty: { name: 'Bastien', distributes: false, roll: 3 } })
    );

    expect(content!.lines.join(' ')).toContain('Bastien');
  });

  it('dit la règle d\'une case qui se joue à la table', () => {
    // SANS CELA la modale s'ouvrirait sur un titre et RIEN d'autre : le
    // joueur verrait « Au tour de Quentin » et deux boutons, sans savoir ce
    // qu'on attend de lui.
    const rule = tile({
      type: 'rule',
      name: 'LE SCHMITT',
      description: 'Invente une règle que tous doivent suivre',
    });

    const content = modalContent(plainTurn({ tableRule: true }), rule);

    expect(content!.lines.join(' ')).toContain('règle');
  });

  it('annonce la victoire', () => {
    const content = modalContent(plainTurn({ winner: 'Bastien' }));

    expect(content!.title).toBe('Victoire');
    expect(content!.lines.join(' ')).toContain('Bastien');
  });

  it('annonce le bouclier soldé avec le reste', () => {
    const content = modalContent(plainTurn({ drinks: { player: 0, amount: 2 } }), tile(), {
      playerName: 'Chloé',
      amount: 4,
    });

    expect(content!.lines[0]).toContain('Chloé');
    expect(content!.lines[0]).toContain('4');
  });
});

describe('modale — elle ne dit pas deux fois la même chose', () => {
  it('n\'ajoute pas la phrase de la case quand la distribution est déjà annoncée', () => {
    // `tableAnnouncement` et `buildActionText` décrivent tous deux une
    // distribution. Les laisser parler ensemble afficherait la règle en
    // double, ce qui est précisément le défaut SCH-11 de Bastien.
    const content = modalContent(
      plainTurn({ distribute: { by: 0, amount: 2 } }),
      tile({ type: 'distribute_2', name: 'DISTRIBUEZ 2 GORGÉES' })
    );

    const distributions = content!.lines.filter(line => line.includes('distribue'));
    expect(distributions).toHaveLength(1);
  });
});

describe('modale — le jeu attend la validation', () => {
  it('s\'affiche', () => {
    showActionModal({ title: 'Test', lines: ['Quentin boit 3 🍺'] }, () => {});

    expect(document.querySelector('.action-modal')).not.toBeNull();
    expect(document.body.textContent).toContain('Quentin boit');
  });

  it('ne rend la main QU\'AU clic sur Valider', () => {
    const done = vi.fn();
    showActionModal({ title: 'Test', lines: ['x'] }, done);

    expect(done).not.toHaveBeenCalled();

    document.querySelector<HTMLButtonElement>('#action-validate')!.click();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('se retire une fois validée', () => {
    // SANS CELA elle resterait en `position: fixed` par-dessus le plateau :
    // le jeu tournerait derrière, injouable.
    showActionModal({ title: 'Test', lines: ['x'] }, () => {});

    document.querySelector<HTMLButtonElement>('#action-validate')!.click();

    expect(document.querySelector('.action-modal')).toBeNull();
  });

  it('ne valide pas deux fois', () => {
    // Un double tap sur un téléphone ne doit pas faire reprendre deux tours.
    const done = vi.fn();
    const handles = showActionModal({ title: 'Test', lines: ['x'] }, done);

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
    showActionModal({ title: 'Test', lines: ['x'] }, done);

    document.querySelector<HTMLButtonElement>('#action-peek')!.click();

    expect(escamotee('.action-modal')).toBe(true);
    expect(done).not.toHaveBeenCalled();
  });

  it('laisse un rappel pour revenir', () => {
    // SANS LUI « Voir le plateau » serait un aller sans retour, et la partie
    // resterait suspendue sans que rien ne l'explique.
    showActionModal({ title: 'Test', lines: ['x'] }, () => {});

    expect(escamotee('#action-recall')).toBe(true);

    document.querySelector<HTMLButtonElement>('#action-peek')!.click();

    expect(escamotee('#action-recall')).toBe(false);
  });

  it('ramène la modale au rappel', () => {
    showActionModal({ title: 'Test', lines: ['x'] }, () => {});

    document.querySelector<HTMLButtonElement>('#action-peek')!.click();
    document.querySelector<HTMLButtonElement>('#action-recall')!.click();

    expect(escamotee('.action-modal')).toBe(false);
    expect(escamotee('#action-recall')).toBe(true);
  });

  it('emporte le rappel en validant', () => {
    // Un rappel laissé derrière rouvrirait une modale déjà soldée.
    showActionModal({ title: 'Test', lines: ['x'] }, () => {});

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
      { title: 'Test', lines: ['Quentin distribue 3 🍺'] },
      () => {}
    );

    const buttons = [...document.querySelectorAll('.action-modal button')];

    expect(buttons).toHaveLength(2);
    expect(buttons.map(b => b.textContent)).toEqual(['Voir le plateau', 'Valider']);
  });
});

describe('modale — la prise du titre de Poulet s\'annonce', () => {
  it('annonce le Poulet quand le pion se pose sur la case', () => {
    // CE STATUT N'EST ANNONCÉ NULLE PART AILLEURS. `tableAnnouncement` ne
    // traite que la SENTENCE (« à chaque 3 ou 6 »), pas la prise du titre —
    // vérifié sur le vrai catalogue : la case `chicken` n'ouvrait aucune
    // modale. Or c'est ce titre qui déclenche la sentence à tous les tours
    // suivants, et personne ne peut l'appliquer sans l'avoir entendu poser.
    const content = modalContent(plainTurn({ chicken: { rank: 1 } }), tile({ type: 'chicken', name: 'POULET' }));

    expect(content).not.toBeNull();
    expect(content!.lines.join(' ')).toContain('Poulet');
    expect(content!.lines.join(' ')).toContain('Quentin');
  });

  it('distingue le GROS Poulet, qui distribue au lieu de boire', () => {
    const content = modalContent(plainTurn({ chicken: { rank: 2 } }), tile({ type: 'chicken', name: 'POULET' }));

    expect(content!.lines.join(' ')).toContain('distribuera');
  });
});

describe('modale — elle MONTRE la case où le pion s\'est posé', () => {
  it('donne l\'illustration de la case', () => {
    // Demande de Quentin après essai sur l'APK : montrer la case plutôt que
    // la nommer. C'est ce que le joueur a sous les yeux sur le plateau —
    // la reconnaître demande moins d'effort que de lire un numéro.
    const content = modalContent(
      plainTurn({ drinks: { player: 0, amount: 3 } }),
      tile({ image: 'assets/drink_3.png', name: 'BUVEZ 3 GORGÉES' })
    );

    expect(content!.tile).not.toBeNull();
    expect(content!.tile!.src).toBe('/assets/drink_3.png');
  });

  it('nomme la case dans l\'alternative textuelle', () => {
    // L'ILLUSTRATION SEULE NE SUFFIT PAS : `drink_3.png` ne montre qu'un
    // « ×3 », qui ne dit pas s'il faut boire ou distribuer. Le nom reste
    // donc accessible à qui ne voit pas l'écran.
    const content = modalContent(
      plainTurn({ drinks: { player: 0, amount: 3 } }),
      tile({ image: 'assets/drink_3.png', name: 'BUVEZ 3 GORGÉES' })
    );

    expect(content!.tile!.alt).toBe('BUVEZ 3 GORGÉES');
  });

  it('reste affichable quand la case n\'a pas d\'illustration', () => {
    const content = modalContent(
      plainTurn({ drinks: { player: 0, amount: 3 } }),
      tile({ image: undefined })
    );

    expect(content).not.toBeNull();
    expect(content!.tile).toBeNull();
  });

  it('reporte le VRAI chiffre sur une illustration qui en porte un gravé', () => {
    // Une seule illustration sert pour ×2, ×3 et ×4 : sans ce report, une
    // case ×4 montrerait « ×2 » au joueur.
    const content = modalContent(
      plainTurn({ drinks: { player: 0, amount: 4 } }),
      tile({ image: 'assets/drink_2.png', amount: 4 })
    );

    expect(content!.tile!.amount).toBe(4);
  });

  it('ne pose aucun chiffre quand la case n\'en porte pas', () => {
    const content = modalContent(
      plainTurn({ drinks: { player: 0, amount: 3 } }),
      tile({ image: 'assets/drink_3.png' })
    );

    expect(content!.tile!.amount).toBeNull();
  });

  it('affiche l\'illustration dans la carte', () => {
    showActionModal(
      { title: 'T', tile: { src: '/assets/petitPoulet.png', alt: 'POULET', amount: null }, lines: ['x'] },
      () => {}
    );

    const art = document.querySelector<HTMLImageElement>('.action-modal-art')!;

    expect(art).not.toBeNull();
    expect(art.getAttribute('src')).toBe('/assets/petitPoulet.png');
    expect(art.alt).toBe('POULET');
  });

  it('pose le chiffre par-dessus dans la carte', () => {
    showActionModal(
      { title: 'T', tile: { src: '/assets/drink_2.png', alt: 'BUVEZ', amount: 4 }, lines: ['x'] },
      () => {}
    );

    expect(document.querySelector('.action-modal-amount')!.textContent).toBe('\u00d74');
  });

  it('retire l\'illustration qui ne charge pas, sans casser la modale', () => {
    // Une image manquante ne doit pas laisser un cadre vide au milieu de la
    // carte : la règle, elle, est écrite en dessous et suffit à jouer.
    showActionModal(
      { title: 'T', tile: { src: '/assets/absente.png', alt: 'X', amount: null }, lines: ['x'] },
      () => {}
    );

    document.querySelector('.action-modal-art')!.dispatchEvent(new Event('error'));

    expect(document.querySelector('.action-modal-tile')).toBeNull();
    expect(document.querySelector('.action-modal')).not.toBeNull();
  });
});
