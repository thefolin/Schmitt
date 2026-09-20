import { describe, it, expect } from 'vitest';
import {
  rollSpan,
  CINEMA_HOLD_MS,
  CINEMA_SPAN_TILES,
  CINEMA_DEFAULT,
} from '@/features/board/scene3d/cinema-mode';

/**
 * EPIC-8 #54, #56, #58 — les réglages qui FONT le mode cinéma.
 *
 * CE FICHIER A ÉTÉ RÉDUIT APRÈS VÉRIFICATION. Il contenait d'abord quatre
 * tests sur l'état de l'écran — HUD masqué, HUD rendu — qui reproduisaient
 * dans le test la bascule de classe que la scène applique. Ils passaient
 * donc quoi qu'il arrive : en cassant `dimHud` dans `preview.ts`, les huit
 * tests passaient toujours. Ils décrivaient un comportement sans pouvoir le
 * défendre, ce qui est pire que pas de test — on croit la zone couverte.
 *
 * Ce qui reste appelle le vrai code et échoue si on le casse. Le masquage du
 * HUD, lui, se vérifie à l'œil sur le téléphone : c'est une bascule de classe
 * CSS, et jsdom ne calcule aucun style.
 */

describe('EPIC-8 #54 — le mode resserre la vue', () => {
  it('cadre plus serré que le mode plateau', () => {
    // C'EST TOUT LE MODE côté caméra : le dé occupe l'écran au lieu d'être
    // un objet parmi les cases. Si ce cadre cessait d'être plus serré, le
    // mode n'aurait plus aucun effet visible.
    expect(rollSpan(true, 120, 11)).toBeLessThan(rollSpan(false, 120, 11));
  });

  it('garde assez de place pour que le dé tienne dans le cadre', () => {
    // Le lancer parcourt plusieurs cases : un cadre d'une seule case
    // laisserait le dé sortir de l'écran en roulant, et le joueur ne verrait
    // pas la face s'arrêter.
    expect(CINEMA_SPAN_TILES).toBeGreaterThanOrEqual(2);
  });
});

describe('EPIC-8 #56 — le résultat reste lisible', () => {
  it('laisse le temps de lire la face', () => {
    // Quentin : « résultat lisible 2-3 secondes ». En dessous de deux, la
    // face disparaît avant d'avoir été lue ; au-delà de trois, le tour
    // traîne et le joueur suivant attend.
    expect(CINEMA_HOLD_MS).toBeGreaterThanOrEqual(2000);
    expect(CINEMA_HOLD_MS).toBeLessThanOrEqual(3000);
  });
});

describe('EPIC-8 #58 — le mode plateau n\'est pas touché', () => {
  it('garde le cadre d\'origine quand le mode est éteint', () => {
    // NON-RÉGRESSION : le cadre du mode plateau est celui qui a réglé la
    // nausée (#70), onze cases posées une fois au lancer. Le mode cinéma ne
    // doit rien y changer tant qu'il est éteint.
    expect(rollSpan(false, 120, 11)).toBe(11 * 120);
  });

  it('reste éteint par défaut', () => {
    // Un joueur qui n'a rien demandé garde le jeu que Quentin a validé.
    expect(CINEMA_DEFAULT).toBe(false);
  });
});
