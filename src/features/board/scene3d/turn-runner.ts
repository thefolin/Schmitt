import type { GameLogic } from '@/features/game/game.logic';
import type { TileConfig } from '@/core/models/Tile';

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

/** Ce qu'une case a fait au pion après qu'il s'y est posé. */
export interface EffectOutcome {
  type: string;
  from: number;
  to: number;
}

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
  /** Le déplacement provoqué par la case, s'il y en a eu un. */
  effect: EffectOutcome | null;
  /** Ce tour a-t-il donné le pouvoir du Schmitt ? */
  schmittPower: boolean;
  /** Le nom du vainqueur, si la partie vient de s'achever. */
  winner: string | null;
}

/**
 * Nombre maximal de flèches enchaînées sur un même tour.
 *
 * Deux flèches qui se pointent l'une l'autre boucleraient sans fin. La règle
 * exacte du nombre d'enchaînements autorisés n'est pas tranchée — la
 * description de la case parle de deux déplacements consécutifs, mais rien ne
 * l'implémente dans les règles, et je n'invente pas une règle de jeu. Cette
 * borne n'est donc PAS une règle : c'est un garde-fou contre une boucle
 * infinie, qui laisse passer tout enchaînement que Quentin pourrait vouloir.
 */
const MAX_CHAINED_ARROWS = 8;

export interface PawnView {
  position: number;
  color: string;
}

export class TurnRunner {
  /** Le catalogue des cases, dans l'ordre du parcours. */
  private board: TileConfig[] = [];

  constructor(private readonly logic: GameLogic) {}

  /**
   * Déclare les cases du parcours.
   *
   * Sans catalogue, aucun effet ne se déclenche et le tour se joue quand
   * même : la scène doit rester affichable avant que les données soient là.
   */
  public setBoard(board: TileConfig[]): void {
    this.board = board;
  }

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

    // Les effets de la case où le pion vient de se poser. Chacun est
    // appliqué PAR `GameLogic` : ce module choisit lequel appeler d'après le
    // type de la case, il ne calcule aucune position.
    const effect = this.applyArrows(player);
    const landed = effect ? effect.to : to;

    const schmittPower =
      landed === this.logic.getLastPosition() && this.logic.claimSchmittPower(player);

    const winner = this.logic.checkVictory();

    this.logic.nextPlayer();

    return {
      player,
      playerName,
      dice,
      steps: dice,
      from,
      to,
      returning,
      effect,
      schmittPower,
      winner: winner ? winner.name : null,
    };
  }

  /**
   * Applique les cases flèche, tant que le pion en rencontre.
   *
   * La flèche est DESSINÉE sur le plateau : elle envoie toujours du même
   * côté, quel que soit le sens de marche du joueur. C'est pourquoi on passe
   * par `movePlayerInDirection` et non par `movePlayer`, qui inverserait
   * l'effet en phase de retour — le seul défaut de flèche qu'on ait connu.
   */
  private applyArrows(player: number): EffectOutcome | null {
    let outcome: EffectOutcome | null = null;
    let origin: number | null = null;

    for (let chained = 0; chained < MAX_CHAINED_ARROWS; chained++) {
      const position = this.logic.getPlayers()[player]?.position ?? 0;
      const tile = this.board[position];

      if (!tile || !tile.type.startsWith('forward_')) break;

      const steps = Number(tile.type.split('_')[1]);
      if (!Number.isFinite(steps) || steps <= 0) break;

      const direction = tile.direction ?? 'forward';
      const to = this.logic.movePlayerInDirection(player, steps, direction);

      if (origin === null) origin = position;
      outcome = { type: tile.type, from: origin, to };

      // Une flèche qui ne déplace plus rien (bord du plateau) ne doit pas
      // relancer la boucle sur la même case.
      if (to === position) break;
    }

    return outcome;
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

  /**
   * La dernière case du parcours.
   *
   * L'animation en a besoin pour reconstituer le rebond : c'est sur ce bord
   * que le pion fait demi-tour quand le dé dépasse.
   */
  public lastPosition(): number {
    return this.logic.getLastPosition();
  }

  /**
   * Consigne un événement dans l'historique de la PARTIE.
   *
   * On passe par `GameLogic`, qui tient cet historique depuis toujours,
   * plutôt que d'en tenir un second dans la scène : deux récits de la même
   * partie finiraient par diverger.
   */
  public log(message: string): void {
    this.logic.logEvent(message);
  }

  /** L'historique de la partie, du plus ancien au plus récent. */
  public history(): string[] {
    return this.logic.getHistory();
  }

  /** Qui doit jouer maintenant. */
  public currentPlayerName(): string {
    return this.logic.getPlayers()[this.logic.getCurrentPlayerIndex()]?.name ?? '';
  }
}
