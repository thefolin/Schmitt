import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CE QUE LA PAGE 3D DOIT PORTER POUR LA LIAISON (épique 8).
 *
 * jsdom ne calcule aucun style : un bouton gris ou un QR doré y passeraient
 * inaperçus. Ces gardes lisent donc le texte des règles, comme le fait
 * `hud-contract.test.ts` pour le panneau des dés.
 */

const page = readFileSync(resolve(__dirname, '../index-3d.html'), 'utf-8');

/** Le corps d'une règle CSS, commentaires retirés. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.#]/g, (c) => `\\${c}`).replace(/ /g, "\\s+");
  const match = page.match(new RegExp(`\\n\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return (match?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('La page offre de relier un second appareil', () => {
  it('porte le bouton 📱 dans le HUD', () => {
    expect(page).toMatch(/<button id="link-open"[^>]*>/);
  });
});

describe('Le QR se scanne sous n\'importe quel éclairage', () => {
  it('reste sombre sur fond BLANC, quel que soit le thème', () => {
    // Un QR doré sur bleu nuit ne se lit pas : les lecteurs attendent du
    // contraste, sombre sur clair.
    expect(rule('.link-qr')).toMatch(/background:\s*#ffffff/i);
  });
});

describe('La manette se prend au pouce', () => {
  it('recouvre l\'écran des joueurs', () => {
    // `.setup-screen` est à 1000 : en dessous, le téléphone qui rejoint
    // comme manette resterait bloqué sur « Qui joue ? ».
    const z = Number(rule('.remote-screen').match(/z-index:\s*(\d+)/)?.[1]);
    expect(z).toBeGreaterThan(1000);
  });

  it('donne au bouton « Lancer » le doré du jeu, pas le gris du navigateur', () => {
    // `.roll` et `.btn-primary` ne sont stylés que dans leur conteneur :
    // repris tels quels, ils laissaient un bouton gris (vu au rendu réel).
    expect(rule('.remote-roll')).toMatch(/background:\s*var\(--grad-gold\)/);
  });
});

describe('Le second rôle s\'appelle « appareil de contrôle »', () => {
  // Quentin (27/10/2026) : « manette » ne convenait pas à tous les rôles.
  it('aucun texte affiché ne dit plus « manette »', async () => {
    const { LINK_TEXT } = await import('@/features/link/link-text');

    for (const text of Object.values(LINK_TEXT)) expect(text.toLowerCase()).not.toContain('manette');
  });

  it('le choix du rôle le nomme', async () => {
    const { LINK_TEXT } = await import('@/features/link/link-text');

    expect(LINK_TEXT.asSlave).toMatch(/appareil de contrôle/);
  });
});

describe('L\'écran d\'appairage tient sur un petit téléphone', () => {
  it('empile ses boutons au lieu de les serrer côte à côte', () => {
    // À 360 px, trois boutons côte à côte cassaient « Utiliser comme
    // appareil de contrôle » sur cinq lignes (vu au rendu réel).
    expect(rule('.link-panel .action-modal-buttons')).toMatch(/flex-direction:\s*column/);
  });
});
