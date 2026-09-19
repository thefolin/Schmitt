import type { GameLogic } from '@/features/game/game.logic';

/**
 * La jonction entre les règles et la scène 3D.
 *
 * Elle ne contient AUCUNE règle de jeu, et c'est sa raison d'être. Le sens de
 * la dépendance est à sens unique : la scène s'adapte aux règles, jamais
 * l'inverse. `GameLogic` reste seul juge de ce qui arrive au pion — ce module
 * lui pose la question et traduit la réponse en quelque chose que le rendu
 * sait afficher.
 *
 * Recalculer ici une position, fût-ce « pour vérifier », rouvrirait la porte
 * au défaut que toute la refonte supprime : deux représentations de la même
 * chose, qui finissent par diverger.
 *
 * La valeur du dé vient de la PHYSIQUE, pas d'un tirage séparé. C'est ce qui
 * garantit que le pion avance de ce que le joueur voit sur la face du dessus :
 * les quatre défauts successifs du dé en CSS étaient tous des variantes de
 * « la face vue ne correspond pas au déplacement ».
 */

export interface TurnOutcome {
  /** Le joueur qui vient de jouer, et non celui à qui la main passe. */
  player: number;
  playerName: string;
  /** La face du dé, telle que la physique l'a posée. */
  dice: number;
  steps: number;
  from: number;
  to: number;
  /** Le joueur marche-t-il vers l'arrivée ou vers le retour ? */
  returning: boolean;
}

export interface PawnView {
  position: number;
  color: string;
}

export class TurnRunner {
  constructor(private readonly logic: GameLogic) {}

  /**
   * Joue un tour : le pion du joueur courant avance de la face du dé, puis la
   * main passe.
   *
   * Le déplacement est demandé à `GameLogic`, qui applique l'arrivée à la
   * valeur exacte, le rebond du surplus et le sens de marche. Ce module se
   * contente de rapporter ce qui s'est passé.
   */
  public playTurn(dice: number): TurnOutcome {
    const player = this.logic.getCurrentPlayerIndex();
    const before = this.logic.getPlayers()[player];

    const from = before?.position ?? 0;
    const returning = before?.isReturning ?? false;
    const playerName = before?.name ?? '';

    const to = this.logic.movePlayer(player, dice);

    this.logic.nextPlayer();

    return { player, playerName, dice, steps: dice, from, to, returning };
  }

  /**
   * La case que la vue doit suivre : celle du JOUEUR COURANT.
   *
   * Suivre un pion fixe reviendrait à regarder ailleurs dès le deuxième tour.
   */
  public tileToFollow(): number {
    return this.logic.getPlayers()[this.logic.getCurrentPlayerIndex()]?.position ?? 0;
  }

  /** Les pions à poser sur le plateau, dans l'ordre des joueurs. */
  public pawns(): PawnView[] {
    return this.logic.getPlayers().map(player => ({
      position: player.position,
      color: player.color,
    }));
  }

  /** Qui doit jouer maintenant. */
  public currentPlayerName(): string {
    return this.logic.getPlayers()[this.logic.getCurrentPlayerIndex()]?.name ?? '';
  }
}
