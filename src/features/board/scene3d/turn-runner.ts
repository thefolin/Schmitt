import type { GameLogic } from '@/features/game/game.logic';
import type { TileConfig } from '@/core/models/Tile';
import { isArrowTile, arrowDirection } from './arrow-tile';
import {
  isGodFavorTile,
  readFavorRoll,
  grantsAthenaShield,
  type FavorRoll,
} from './god-favor-roll';
import { pawnMarks, type PawnMark } from './pawn-marks';

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

/** Des gorgées servies au joueur qui vient de jouer. */
export interface DrinkOutcome {
  player: number;
  amount: number;
}

/** Des gorgées à distribuer, dont la cible reste à choisir. */
export interface DistributeOutcome {
  by: number;
  amount: number;
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
  /** Les gorgées servies par la case, s'il y en a. */
  drinks: DrinkOutcome | null;
  /** Les gorgées à distribuer, la cible restant au joueur. */
  distribute: DistributeOutcome | null;
  /** La case a-t-elle fait boire tout le monde ? */
  everyone: boolean;
  /** La case se joue-t-elle à la table, hors de l'application ? */
  tableRule: boolean;
  /**
   * La case appelle-t-elle la FAVEUR DES DIEUX ?
   *
   * Quentin : « les 2 dés n'apparaissent pas quand on tombe dessus ». Le
   * temps du tirage, la main reste au joueur : le tour ne passe pas au
   * suivant tant que les deux dés ne sont pas tombés.
   */
  godFavor: boolean;
  /**
   * Le joueur devient-il le Poulet — ou monte-t-il en grade ?
   *
   * `rank` vaut 1 pour le Petit Poulet, 2 pour le Gros. La promotion se fait
   * en retombant sur la case sans qu'un autre joueur soit passé entre-temps,
   * et elle change la règle : le Gros Poulet DISTRIBUE au lieu de boire.
   */
  chicken: { rank: 1 | 2 } | null;
  /**
   * La sentence du Poulet sur le jet qui vient d'être fait.
   *
   * « À chaque 3 ou 6 de N'IMPORTE QUEL joueur » : elle ne concerne donc pas
   * celui qui joue, mais le Poulet en titre — c'est pourquoi elle porte son
   * propre nom plutôt que de se confondre avec les gorgées de la case.
   */
  chickenPenalty: { name: string; distributes: boolean; roll: number } | null;
}

/**
 * Gorgées d'une tournée générale.
 *
 * La case dit « tous les joueurs boivent 1 gorgée » : la quantité est dans la
 * règle, pas dans le type.
 */
const EVERYONE_DRINKS = 1;

/**
 * Cases qui se jouent À LA TABLE, hors de l'application.
 *
 * Quentin : « On laisse les joueurs le faire, on affiche les règles, ils le
 * font dans la vraie vie, puis quand ils sont finis on reprend le tour. »
 * L'application énonce et attend — elle n'arbitre pas.
 *
 * `power` A ÉTÉ RETIRÉ de cette liste : c'est la case « FAVEUR DES DIEUX »,
 * qui appelle un lancer de deux dés. Rangée ici, elle affichait « à jouer à
 * la table » et aucun dé n'apparaissait — le défaut que Quentin a signalé.
 */
const TABLE_RULE_TYPES = new Set(['rule', 'schmitt_call', 'copy']);

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

/**
 * Ce que coûte la COLÈRE DES DIEUX.
 *
 * « Le joueur reçoit 1 cul sec ! » — c'est la description de la case, et le
 * jeu qui tourne compte bien 1. La quantité vient de la règle, pas d'ici.
 */
const WRATH_DRINKS = 1;

export interface PawnView {
  position: number;
  color: string;
  /**
   * Les statuts durables portés par le pion (SCH-17).
   *
   * Calculés ici, où les joueurs sont connus, plutôt que dans le rendu : la
   * scène 3D n'a pas à interroger `GameLogic` pour savoir qui est Poulet.
   */
  marks: PawnMark[];
}

export class TurnRunner {
  /** Le catalogue des cases, dans l'ordre du parcours. */
  private board: TileConfig[] = [];

  /**
   * Distribution en attente de cible.
   *
   * Elle vit ICI et non dans le compte rendu du tour : `TurnOutcome` est un
   * récit FIGÉ de ce qui s'est passé, et y lire une décision en attente la
   * ferait réapparaître indéfiniment après résolution — le joueur croirait
   * que son clic n'a rien fait. L'état d'une décision doit vivre là où elle
   * peut être résolue, comme le bouclier vit dans `GameLogic`.
   */
  private awaitingDistribution: { by: number; amount: number } | null = null;
  /**
   * Le joueur qui doit lancer les deux dés de la faveur des dieux.
   *
   * L'état vit ICI et non dans `TurnOutcome`, qui est figé au moment du
   * retour : une décision lue dans un résultat gelé ne s'efface jamais, et le
   * panneau concerné reparaissait à chaque image.
   */
  private awaitingGodFavor: { player: number } | null = null;

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

    // LA SENTENCE DU POULET, avant tout déplacement. « À chaque 3 ou 6 de
    // n'importe quel joueur » : elle ne dépend ni de la case d'arrivée ni de
    // qui lance, seulement de la face sortie. Le rendu CSS la place au même
    // endroit, juste après le jet.
    const penalty = this.logic.applyChickenPenalty(dice);

    const to = this.logic.movePlayer(player, dice);

    // Les effets de la case où le pion vient de se poser. Chacun est
    // appliqué PAR `GameLogic` : ce module choisit lequel appeler d'après le
    // type de la case, il ne calcule aucune position.
    const effect = this.applyArrows(player);
    const landed = effect ? effect.to : to;

    const schmittPower =
      landed === this.logic.getLastPosition() && this.logic.claimSchmittPower(player);

    // Les effets de boisson de la case où le pion s'est posé. Toutes les
    // gorgées passent par `addDrinks`, seul endroit où le bouclier d'Athéna
    // intercepte : les compter ici laisserait passer le bouclier.
    const drinking = this.applyDrinking(player, landed);

    // LA CASE POULET pose le statut, et promeut celui qui y retombe. Elle
    // était laissée de côté en attendant les badges (SCH-17) : sans elle,
    // `chickenRank` restait à zéro pour tout le monde et le badge du Poulet
    // ne pouvait jamais s'afficher.
    const chicken = this.applyChicken(player, landed);

    const winner = this.logic.checkVictory();

    // LA MAIN RESTE AU JOUEUR tant que la faveur des dieux n'est pas tirée.
    // Passer au suivant ici ferait résoudre la faveur pendant le tour d'un
    // autre : c'est exactement le défaut qui avait figé le panneau de
    // distribution, où l'état vivait d'un côté et la décision de l'autre.
    // `resolveGodFavor` rendra la main quand les deux dés seront tombés.
    if (drinking.godFavor) {
      this.awaitingGodFavor = { player };
    } else {
      this.logic.nextPlayer();
    }

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
      chicken,
      chickenPenalty: penalty
        ? { name: penalty.name, distributes: penalty.distributes, roll: dice }
        : null,
      ...drinking,
    };
  }

  /**
   * Pose le statut de Poulet quand le pion s'arrête sur la case.
   *
   * Le rang est calculé par `GameLogic` : y retomber sans qu'un autre joueur
   * soit passé entre-temps promeut en GROS POULET, qui distribue au lieu de
   * boire. Ce module ne décide de rien, il déclenche.
   */
  private applyChicken(player: number, position: number): { rank: 1 | 2 } | null {
    const tile = this.board[position];
    if (!tile) return null;
    if (tile.type !== 'chicken' && tile.type !== 'big_chicken') return null;

    const rank = this.logic.setChicken(player);

    return rank >= 2 ? { rank: 2 } : { rank: 1 };
  }

  /**
   * Applique ce que la case fait boire.
   *
   * Ce module CHOISIT quelle méthode de `GameLogic` appeler d'après le type
   * de la case ; il ne tient aucun compte lui-même. La quantité est lue dans
   * le type — `drink_2`, `distribute_3` — qui en est la seule source.
   */
  private applyDrinking(
    player: number,
    position: number
  ): Pick<TurnOutcome, 'drinks' | 'distribute' | 'everyone' | 'tableRule' | 'godFavor'> {
    const empty = {
      drinks: null,
      distribute: null,
      everyone: false,
      tableRule: false,
      godFavor: false,
    };

    const tile = this.board[position];
    if (!tile) return empty;

    // Le Poulet n'est pas un effet de boisson : il pose un STATUT, traité
    // par `applyChicken`. Il ne sert donc aucune gorgée ICI — sa sentence
    // tombe sur les jets suivants, pas sur la case elle-même.
    if (tile.type === 'chicken' || tile.type === 'big_chicken') return empty;

    // LA CASE DU TEMPLE appelle les deux dés. Elle tombait jusqu'ici dans le
    // cas « aucun effet », silencieusement : le joueur s'y posait et le tour
    // passait au suivant. On ne sert aucune gorgée ici — la faveur décide de
    // ce qui se boit, et elle n'est pas encore tirée.
    if (isGodFavorTile(tile)) {
      return { ...empty, godFavor: true };
    }

    if (TABLE_RULE_TYPES.has(tile.type)) {
      return { ...empty, tableRule: true };
    }

    if (tile.type === 'everyone_drinks') {
      this.logic.getPlayers().forEach((_, index) => {
        this.logic.addDrinks(index, EVERYONE_DRINKS);
      });

      return { ...empty, everyone: true };
    }

    const amount = Number(tile.type.split('_')[1]);
    if (!Number.isFinite(amount) || amount <= 0) return empty;

    if (tile.type.startsWith('drink_')) {
      this.logic.addDrinks(player, amount);

      return { ...empty, drinks: { player, amount } };
    }

    if (tile.type.startsWith('distribute_')) {
      // LA DISTRIBUTION SE FAIT À LA TABLE. Quentin : « pas de sélection dans
      // l'app, pas de choix à arbitrer — juste “Alice distribue 3 gorgées” ».
      // L'application énonce, les joueurs appliquent.
      //
      // Aucune gorgée n'est donc comptée ici, et c'est VOULU : les compter
      // sur quelqu'un demanderait de choisir qui boit, exactement ce qu'on
      // retire. Le compte de l'application ne prétend plus suivre ce qui se
      // boit réellement autour de la table.
      return { ...empty, distribute: { by: player, amount } };
    }

    return empty;
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

      if (!tile || !isArrowTile(tile)) break;

      const steps = Number(tile.type.split('_')[1]);
      if (!Number.isFinite(steps) || steps <= 0) break;

      const direction = arrowDirection(tile);
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
      marks: pawnMarks(player),
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

  /**
   * Résout une décision en attente.
   *
   * La scène pose la question ; c'est `GameLogic` qui applique. Ce module ne
   * fait que lui transmettre le choix du joueur.
   */
  public resolveDistribute(target: number, amount: number): void {
    this.logic.addDrinks(target, amount);
    this.awaitingDistribution = null;
  }

  /** La distribution qui attend encore sa cible, s'il y en a une. */
  public getAwaitingDistribution(): { by: number; amount: number } | null {
    return this.awaitingDistribution;
  }

  /**
   * Solde un bouclier qui retenait une sanction, sans demander de cible.
   *
   * Quentin a tranché que les interactions se jouent À LA TABLE : l'écran ne
   * demande plus sur qui renvoyer. Mais `GameLogic` RETIENT les gorgées tant
   * qu'aucune cible n'est désignée — cesser simplement de poser la question
   * les ferait s'évaporer, et le compte deviendrait faux sans que rien ne le
   * signale.
   *
   * `cancelPendingShield` est le filet que les règles prévoient déjà pour ce
   * cas : la sanction retombe sur le porteur, qui garde son bouclier. C'est
   * la lecture prudente — elle ne fait disparaître aucune gorgée et
   * n'invente aucune règle. Si Quentin veut que le renvoi se négocie aussi à
   * la table, c'est à lui de le dire.
   *
   * Renvoie le porteur et le montant retenus, pour pouvoir l'annoncer.
   */
  public settlePendingShield(): { player: number; amount: number } | null {
    const pending = this.logic.getPendingShield();
    if (!pending) return null;

    this.logic.cancelPendingShield();

    return { player: pending.playerIndex, amount: pending.amount };
  }

  /** Le joueur qui doit lancer les deux dés du temple, s'il y en a un. */
  public getAwaitingGodFavor(): { player: number } | null {
    return this.awaitingGodFavor;
  }

  /**
   * Enregistre le tirage des deux dés et rend la main.
   *
   * La faveur elle-même se joue À LA TABLE : l'application l'énonce, les
   * joueurs l'appliquent, comme pour les autres cases que Quentin a tranchées
   * ainsi. Servir des gorgées ici reviendrait à arbitrer des règles qui
   * demandent de choisir une cible, de relancer un dé ou de poser un shooter
   * — rien de tout cela ne se décide sans le joueur.
   *
   * DEUX FAVEURS FONT EXCEPTION, pour la même raison : elles ne demandent
   * aucun choix au joueur au moment où elles tombent.
   *
   *   - la COLÈRE DES DIEUX sert un cul sec, et passe par `addDrinks`, seul
   *     endroit où le bouclier d'Athéna intercepte.
   *   - ATHÉNA donne un objet bouclier. « Choisissez un objet bouclier » ne
   *     demande pas de désigner un joueur : le choix vient PLUS TARD, quand
   *     une sanction arrive et qu'il faut dire sur qui la renvoyer — et ce
   *     mécanisme existe déjà (`getPendingShield`, `resolveShield`).
   *
   * Le bouclier est un ÉTAT DURABLE, pas une annonce : il se garde jusqu'à
   * être utilisé et interdit de gagner tant qu'on le porte. Laisser les
   * joueurs le tenir de tête reviendrait à leur demander de se souvenir d'une
   * règle qui décide de la victoire.
   */
  public resolveGodFavor(a: number, b: number): FavorRoll {
    const roll = readFavorRoll(a, b);
    const pending = this.awaitingGodFavor;

    this.awaitingGodFavor = null;

    if (pending && roll.double) {
      this.logic.addDrinks(pending.player, WRATH_DRINKS);
    }

    // LE BOUCLIER EST ACCORDÉ, comme le fait le jeu qui tourne. Sans cela,
    // `resolveShield` juste en dessous ne pouvait jamais servir, et le badge
    // du bouclier ne pouvait jamais s'afficher : rien ne mettait l'état à
    // vrai côté 3D.
    if (pending && grantsAthenaShield(roll)) {
      this.logic.grantAthenaShield(pending.player);
    }

    this.logic.nextPlayer();

    return roll;
  }

  /** Renvoie la sanction retenue par le bouclier sur la cible choisie. */
  public resolveShield(target: number): void {
    this.logic.useAthenaShield(target);
  }

  /** Le porteur renonce au renvoi et boit. */
  public declineShield(): void {
    this.logic.cancelPendingShield();
  }

  /**
   * Applique la case où un pion a été DÉPOSÉ par une faveur.
   *
   * Aphrodite déplace deux adversaires, et la règle le dit : « Ils appliquent
   * alors l'effet de leur nouvel emplacement. » Sans cela, les pions
   * changeaient de case et rien ne se passait — le déplacement restait sans
   * conséquence.
   *
   * CE N'EST PAS UN TOUR. Le pion n'a pas lancé de dé, ne se déplace plus, et
   * la main ne change pas : c'est le joueur d'Aphrodite qui joue toujours. On
   * ne rejoue donc PAS `playTurn`, qui avancerait le pion et passerait la
   * main.
   *
   * LES MÊMES RÈGLES QUE SUR UN TOUR ORDINAIRE, et non une seconde
   * implémentation : `applyDrinking` et `applyChicken` sont ceux qu'emploie
   * `playTurn`. Le Poulet posé par la case compte donc pour de bon, et le
   * temple ouvre la faveur des dieux.
   */
  public applyLanding(player: number, position: number): TurnOutcome {
    const who = this.logic.getPlayers()[player];

    const drinking = this.applyDrinking(player, position);
    const chicken = this.applyChicken(player, position);
    const winner = this.logic.checkVictory();

    return {
      player,
      playerName: who?.name ?? '',
      // Aucun dé n'a été lancé pour arriver là : la face ne veut rien dire,
      // et la donner ferait croire à un déplacement qui n'a pas eu lieu.
      dice: 0,
      steps: 0,
      from: position,
      to: position,
      returning: who?.isReturning ?? false,
      effect: null,
      schmittPower: false,
      winner: winner ? winner.name : null,
      chicken,
      // La sentence du Poulet tombe sur un JET : il n'y en a pas eu ici.
      chickenPenalty: null,
      ...drinking,
    };
  }

  /** Qui doit jouer maintenant. */
  public currentPlayerName(): string {
    return this.logic.getPlayers()[this.logic.getCurrentPlayerIndex()]?.name ?? '';
  }
}
