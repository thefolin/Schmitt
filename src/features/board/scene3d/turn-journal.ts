import type { TurnOutcome } from './turn-runner';
import { GULP } from '@/features/game/action-text';

/**
 * Raconter un tour au joueur.
 *
 * Première étape du HUD, et la plus sûre : purement de l'affichage, aucune
 * règle nouvelle. `GameLogic` tient DÉJÀ un historique — `logEvent`,
 * `getHistory` — qui n'était simplement branché nulle part dans la scène.
 *
 * On ne tient donc pas un second journal à côté du premier : deux récits de
 * la même partie finiraient par diverger, et c'est la duplication que toute
 * la refonte supprime.
 */

/**
 * Nombre d'événements affichés.
 *
 * Un journal sans fin pousse le reste du HUD hors de l'écran, et sur un
 * téléphone en paysage la place est comptée. `GameLogic` en garde 50 ; on en
 * montre les derniers.
 */
export const JOURNAL_MAX = 6;

/**
 * Traduit un tour en une phrase lisible.
 *
 * Fonction PURE : elle ne connaît ni le DOM ni la scène, et se vérifie sans
 * rien afficher.
 */
export function describeTurn(outcome: TurnOutcome): string {
  const parts: string[] = [];

  parts.push(`${outcome.playerName} fait ${outcome.dice}`);

  // Le rebond mérite d'être NOMMÉ. Un 5 qui finit deux cases en arrière
  // ressemble à une erreur si on ne dit pas pourquoi — et le joueur compte
  // ses cases, c'est un jeu où le dé décide de ce qu'il boit.
  const straight = outcome.returning
    ? outcome.from - outcome.dice
    : outcome.from + outcome.dice;
  const bounced = straight !== outcome.to;

  parts.push(
    bounced
      ? `case ${outcome.from} → ${outcome.to} (rebond)`
      : `case ${outcome.from} → ${outcome.to}`
  );

  if (outcome.effect) parts.push(`flèche → ${outcome.effect.to}`);

  // Ce que la case fait boire. Le symbole 🍺 remplace le mot « gorgées »,
  // comme partout ailleurs dans le jeu (SCH-12).
  if (outcome.drinks) parts.push(`${outcome.drinks.amount} ${GULP}`);
  if (outcome.distribute) parts.push(`distribue ${outcome.distribute.amount} ${GULP}`);
  if (outcome.everyone) parts.push(`tournée générale — tout le monde boit ${GULP}`);
  if (outcome.tableRule) parts.push('à jouer à la table');
  if (outcome.returning) parts.push('retour');
  if (outcome.schmittPower) parts.push('\u{26A1} pouvoir du Schmitt, demi-tour !');
  if (outcome.winner) parts.push(`\u{1F3C6} ${outcome.winner} gagne !`);

  return parts.join(' · ');
}
