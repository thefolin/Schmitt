import type { GameLogic } from '@/features/game/game.logic';
import type { TurnRunner } from './turn-runner';

/**
 * Les décisions que le jeu attend du joueur.
 *
 * Certaines règles ne se résolvent pas toutes seules : elles attendent un
 * CHOIX. Distribuer des gorgées demande de désigner qui boit ; le bouclier
 * d'Athéna demande sur qui renvoyer. Tant que ce choix n'est pas posé à
 * l'écran, la partie reste bloquée sans que rien ne l'explique — le joueur
 * voit un tour qui ne se termine pas.
 *
 * Ce module REGARDE l'état de la partie et dit ce qu'on attend. Il ne décide
 * rien et n'applique rien : c'est `GameLogic` qui tranche quand le joueur a
 * choisi. Fonction pure, vérifiable sans rien afficher.
 */

export interface ActionChoice {
  index: number;
  name: string;
  color: string;
}

export interface PendingAction {
  kind: 'distribute' | 'shield';
  /** Qui doit décider. */
  player: number;
  playerName: string;
  /** Combien de gorgées sont en jeu. */
  amount: number;
  /** Ce qu'on lui propose. */
  choices: ActionChoice[];
  /** Peut-il refuser et subir la sanction ? */
  canDecline: boolean;
  /** Ce qu'on lui dit. */
  prompt: string;
}

/** Les joueurs qu'on peut désigner, celui qui décide excepté. */
function othersThan(logic: GameLogic, playerIndex: number): ActionChoice[] {
  return logic
    .getPlayers()
    .map((player, index) => ({ index, name: player.name, color: player.color }))
    .filter(choice => choice.index !== playerIndex);
}

export function pendingActions(logic: GameLogic, runner: TurnRunner): PendingAction[] {
  const actions: PendingAction[] = [];

  // Le bouclier d'abord : il a INTERCEPTÉ une sanction, et le reste du tour
  // dépend de ce qu'on en fait.
  const shield = logic.getPendingShield();
  if (shield) {
    const holder = logic.getPlayers()[shield.playerIndex];

    actions.push({
      kind: 'shield',
      player: shield.playerIndex,
      playerName: holder?.name ?? '',
      amount: shield.amount,
      choices: othersThan(logic, shield.playerIndex),
      // Le porteur peut préférer boire : tant qu'il garde le bouclier il ne
      // peut pas gagner, mais il choisit son moment. La règle existe déjà
      // dans `GameLogic` ; l'écran doit l'offrir.
      canDecline: true,
      prompt: `Bouclier d'Athéna : renvoyer ${shield.amount} à qui ?`,
    });
  }

  // La distribution est lue sur l'ÉTAT DU JEU et non sur le compte rendu du
  // tour : celui-ci est figé, et la décision y resterait visible même une
  // fois résolue.
  const distribution = runner.getAwaitingDistribution();
  if (distribution) {
    const giver = logic.getPlayers()[distribution.by];

    actions.push({
      kind: 'distribute',
      player: distribution.by,
      playerName: giver?.name ?? '',
      amount: distribution.amount,
      // On ne se distribue pas des gorgées à soi-même.
      choices: othersThan(logic, distribution.by),
      canDecline: false,
      prompt: `Distribuer ${distribution.amount} à qui ?`,
    });
  }

  return actions;
}
