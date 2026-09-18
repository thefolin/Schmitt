import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * SCH-21 — l'interface d'Aphrodite doit tenir dans un écran de téléphone.
 *
 * Bastien (capture 00000045, 14:48:25) : « Interface aphrodite a revoir ».
 * L'écran débordait de tous les côtés — titre coupé, consigne tronquée à
 * gauche ET à droite, une carte joueur coupée, la seconde hors écran, et
 * « Joueur 3 » chevauchant « Position actuelle : 4 ».
 *
 * jsdom ne calcule aucune mise en page : ces tests vérifient donc les CAUSES
 * structurelles du débordement, pas les pixels. Le rendu réel reste à
 * confirmer à l'œil sur un téléphone.
 */

const css = readFileSync(
  resolve(__dirname, '../src/styles/game/manual-movement.css'),
  'utf-8'
);

/** Extrait le corps d'une règle CSS, sans dépendre des espaces. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match ? match[1] : '';
}

describe('SCH-21 — le conteneur se plie à la largeur de l\'écran', () => {
  it('a une largeur fluide, et pas seulement un plafond', () => {
    // C'était la première cause : `max-width: 800px` sans largeur fluide ne
    // réduit rien — la modale gardait la largeur de son contenu.
    const content = rule('.aphrodite-content');

    expect(content).toMatch(/width:\s*100%/);
    expect(content).toMatch(/max-width:\s*800px/);
  });

  it('réduit son rembourrage sur petit écran', () => {
    // 30px de chaque côté, c'est un sixième d'un écran de téléphone.
    expect(rule('.aphrodite-content')).toMatch(/padding:\s*clamp\(/);
  });
});

describe('SCH-21 — les cartes passent sur une colonne quand il le faut', () => {
  it('n\'impose plus un nombre de colonnes fixe', () => {
    // Deuxième cause : `repeat(${players.length}, 1fr)` forçait deux cartes
    // côte à côte, quelle que soit la largeur disponible.
    expect(rule('.aphrodite-cards')).toMatch(/repeat\(\s*auto-fit/);
  });

  it('autorise une carte à descendre sous la largeur de son contenu', () => {
    // Sans le `min(…, 100%)`, une piste de grille refuse de rétrécir sous la
    // taille de son contenu, et la carte déborde à nouveau.
    expect(rule('.aphrodite-cards')).toMatch(/min\(\s*260px\s*,\s*100%\s*\)/);
  });

  it('la carte elle-même peut rétrécir', () => {
    // `min-width: 0` lève la largeur minimale automatique des éléments de
    // grille, l'autre moitié du même piège.
    expect(rule('.aphrodite-card')).toMatch(/min-width:\s*0/);
  });
});

describe('SCH-21 — le nom du joueur ne chevauche plus sa position', () => {
  it('la carte empile ses blocs au lieu de les aligner', () => {
    // Troisième cause : la carte héritait de `.player-movement-card`, en
    // `display: flex; justify-content: space-between`. Le nom et la position
    // se retrouvaient sur la même ligne, à se marcher dessus.
    expect(rule('.player-movement-card')).toMatch(/display:\s*flex/);
    expect(rule('.aphrodite-card')).toMatch(/display:\s*block/);
  });

  it('ne se décale plus au survol', () => {
    // `translateX(8px)` sur une carte déjà au bord la poussait hors écran.
    expect(rule('.player-movement-card:hover')).toMatch(/transform:\s*translateX/);
    expect(rule('.aphrodite-card:hover')).toMatch(/transform:\s*none/);
  });
});

describe('SCH-21 — les textes se replient au lieu d\'être rognés', () => {
  it('le titre et la consigne peuvent revenir à la ligne', () => {
    const wrapping = new RegExp(
      '\\.aphrodite-content \\.manual-movement-title,\\s*' +
        '\\.aphrodite-content \\.manual-movement-subtitle\\s*\\{([^}]*)\\}'
    ).exec(css)?.[1];

    expect(wrapping).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('le titre laisse la place à la croix de fermeture', () => {
    expect(rule('.aphrodite-content .manual-movement-title')).toMatch(
      /padding-right:\s*40px/
    );
  });
});

describe('SCH-21 — les boutons restent tactiles', () => {
  it('ne descendent jamais sous la cible tactile de 48px', () => {
    // Contrainte du projet : aucune cible tactile sous 48px.
    expect(rule('.aphrodite-card .direction-btn')).toMatch(/min-height:\s*48px/);
  });

  it('peuvent rétrécir en largeur sans déborder', () => {
    const btn = rule('.aphrodite-card .direction-btn');
    expect(btn).toMatch(/min-width:\s*0/);
    expect(btn).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe('SCH-21 — le balisage n\'impose plus de dimensions en dur', () => {
  let source: string;

  beforeEach(() => {
    source = readFileSync(resolve(__dirname, '../src/camera/main-camera.ts'), 'utf-8');
  });

  it('la modale ne porte plus de max-width en style inline', () => {
    expect(source).not.toContain('class="manual-movement-content" style="max-width: 800px;"');
  });

  it('la grille des cartes ne porte plus de colonnes calculées en dur', () => {
    expect(source).not.toContain('grid-template-columns: repeat(${players.length}, 1fr)');
  });

  it('utilise les classes dédiées', () => {
    expect(source).toContain('class="aphrodite-cards"');
    expect(source).toContain('aphrodite-card');
    expect(source).toContain('class="aphrodite-position"');
  });
});
