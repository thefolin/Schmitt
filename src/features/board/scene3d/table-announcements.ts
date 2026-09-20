/**
 * Ce que l'application ÉNONCE, et que les joueurs appliquent à la table.
 *
 * Quentin (19/09/2026, via PO) : « Interactions = énoncé + à la table. Quand
 * un joueur tombe sur une case avec action : l'app énonce la règle
 * clairement, puis c'est aux joueurs de se démerder à la table. Pas de
 * sélection dans l'app, pas de choix à arbitrer — juste “Alice distribue 3
 * gorgées” ou “Chloé pose un bouclier”. »
 *
 * C'est la ligne qu'il avait déjà tranchée pour Arès et Dionysos : « On laisse
 * les joueurs le faire, on affiche les règles, ils le font dans la vraie vie,
 * puis quand ils sont finis on reprend le tour. » Elle s'étend maintenant à
 * toutes les interactions.
 *
 * CE QUE ÇA CHANGE POUR LE COMPTE DES GORGÉES, et qu'il faut regarder en
 * face : `GameLogic` RETIENT les gorgées d'un bouclier tant qu'aucune cible
 * n'est désignée. Si l'écran cesse simplement de poser la question, ces
 * gorgées ne retombent sur personne — elles s'évaporent. Le filet existe
 * déjà dans les règles (`cancelPendingShield`) et fait retomber la sanction
 * sur le porteur. On l'emploie plutôt que d'inventer une règle ou de laisser
 * un compte faux.
 *
 * Module PUR : il dit quoi annoncer, il n'affiche rien.
 */

import type { TurnOutcome } from './turn-runner';

/** Une phrase à lire à la table, et rien d'autre. */
export interface TableAnnouncement {
  /** Qui agit. */
  playerName: string;
  /** Ce qu'il fait, en une phrase. */
  text: string;
}

/** Le symbole employé partout pour une gorgée. */
const GULP = '\u{1F37A}';

/** Accorde « gorgée » au pluriel. */
function gulps(amount: number): string {
  return `${amount} ${GULP}`;
}

/**
 * Ce qu'il y a à annoncer après un tour.
 *
 * Une seule phrase, celle de l'action à faire. Le reste du tour est déjà
 * raconté par le journal : répéter ici ce qu'il dit ferait deux récits du
 * même tour, qui finiraient par diverger.
 */
export function tableAnnouncement(outcome: TurnOutcome): TableAnnouncement | null {
  // LA SENTENCE DU POULET D'ABORD. Elle concerne un AUTRE joueur que celui
  // qui vient de jouer — « à chaque 3 ou 6 de n'importe quel joueur » — et
  // c'est précisément ce qui la fait oublier : personne ne la guette. Elle
  // passe donc avant l'action du joueur courant, qui est déjà attendue.
  if (outcome.chickenPenalty) {
    const { name, distributes, roll } = outcome.chickenPenalty;

    return {
      playerName: name,
      text: distributes
        ? `\u{1F414} ${roll} — ${name} est GROS POULET : il distribue 1 ${GULP}`
        : `\u{1F414} ${roll} — ${name} est le Poulet : il boit 1 ${GULP}`,
    };
  }

  if (outcome.distribute) {
    return {
      playerName: outcome.playerName,
      text: `${outcome.playerName} distribue ${gulps(outcome.distribute.amount)} — à vous de jouer`,
    };
  }

  return null;
}
