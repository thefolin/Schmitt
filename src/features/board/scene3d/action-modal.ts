/**
 * La modale qui ARRÊTE le jeu le temps que la table s'exécute.
 *
 * LE DÉFAUT QU'ELLE CORRIGE : `#actions-panel` énonce bien « Alice distribue
 * 3 🍺 », mais rien n'attend. Le joueur suivant peut relancer aussitôt, et
 * l'énoncé disparaît sous le tour d'après — bu ou pas bu. Sur un jeu de
 * soirée, une règle qu'on peut rater en regardant ailleurs n'est pas
 * appliquée.
 *
 * ELLE NE DÉCIDE RIEN, et c'est la contrainte qui la tient. Quentin
 * (19/09/2026) : « énoncé + à la table. Pas de sélection dans l'app, pas de
 * choix à arbitrer. » La modale AFFICHE la phrase et attend qu'on lui dise
 * que c'est fait. « Valider » ne choisit pas de cible, ne compte pas de
 * gorgée, n'applique aucune règle : il rend la main.
 *
 * DEUX SORTIES, parce que le plateau reste consultable. « Voir le plateau »
 * l'escamote sans la solder — le tour reste suspendu, un bouton discret la
 * rappelle. Seul « Valider » la termine.
 *
 * Le module est séparé en deux : `modalContent` DIT ce qu'il faut afficher,
 * sans DOM, et se vérifie sans rien construire ; `showActionModal` l'affiche.
 */

import type { TileConfig } from '@/core/models/Tile';
import type { TurnOutcome } from './turn-runner';
import type { FavorRoll } from './god-favor-roll';
import { tableAnnouncement } from './table-announcements';
import { buildActionText, buildSubtitle, withGulpSymbol } from '@/features/game/action-text';

/**
 * L'illustration d'une case, prête à afficher.
 *
 * `alt` porte le NOM de la case : une illustration seule ne dit rien à qui
 * ne voit pas l'écran, et `drink_3.png` ne montre qu'un « ×3 » — même à
 * l'œil, elle ne dit pas s'il faut boire ou distribuer.
 */
export interface TileArt {
  src: string;
  alt: string;
  /**
   * Le nombre à poser SUR l'illustration, quand la case en porte un.
   *
   * Les illustrations « boire » et « distribuer » ont un « ×2 » gravé :
   * une seule sert pour ×2, ×3 et ×4, et le vrai chiffre s'affiche
   * par-dessus. C'est la convention du rendu CSS, reprise telle quelle —
   * sans elle, une case ×4 montrerait « ×2 » au joueur.
   */
  amount: number | null;
}

/** Une sanction soldée par la scène, à annoncer avec le reste. */
export interface SettledShield {
  playerName: string;
  amount: number;
}

/**
 * L'illustration de la case, ou `null` s'il n'y en a pas.
 *
 * Le chemin est normalisé comme dans le rendu 3D : les données portent
 * « assets/… » sans barre de tête, et la page se sert à la racine.
 */
function tileArt(tile: TileConfig | null): TileArt | null {
  if (!tile?.image) return null;

  return {
    src: tile.image.startsWith('/') ? tile.image : `/${tile.image}`,
    alt: tile.name?.trim() || 'Case du plateau',
    amount: typeof tile.amount === 'number' ? tile.amount : null,
  };
}

/**
 * UNE étape : un écran, une chose qui s'est passée.
 *
 * LE DÉFAUT QUE CELA CORRIGE : tout était versé dans une seule carte — la
 * sentence du Poulet, la règle de la case, la prise du titre, la victoire —
 * avec un titre et une illustration pour l'ensemble. Un joueur qui tombait
 * sur le Poulet ET déclenchait la faveur des dieux voyait les deux mélangés
 * sous une seule image, sans savoir lequel appliquer en premier. Retour de
 * Quentin : « la modale affiche tout mélangé ».
 *
 * Les étapes suivent l'ORDRE D'EXÉCUTION de `playTurn` : sentence du Poulet,
 * déplacement, effets de la case, prise du titre, victoire. C'est l'ordre
 * dans lequel les règles s'appliquent réellement, et donc celui dans lequel
 * la table doit les jouer.
 */
export interface ModalStep {
  /** Le titre, court : ce qui vient d'arriver. */
  title: string;
  /** L'illustration de la case, quand cette étape en a une. */
  tile: TileArt | null;
  /** Ce qu'il y a à faire, en une ou deux phrases. */
  lines: string[];
}

/**
 * Les étapes d'un tour, dans l'ordre où elles s'appliquent.
 *
 * UN TOUR ORDINAIRE N'EN PRODUIT AUCUNE. Avancer de quatre cases et tomber
 * sur une case vide ne demande rien à personne : interrompre le jeu pour le
 * dire ferait fermer une modale à chaque tour, et on finirait par la fermer
 * sans la lire — ce qui vaut pour les tours qui comptent aussi.
 */
export function modalSteps(
  outcome: TurnOutcome,
  tile: TileConfig | null = null,
  shield: SettledShield | null = null
): ModalStep[] {
  const steps: ModalStep[] = [];
  const art = tileArt(tile);

  // 1. LE BOUCLIER, soldé avant tout le reste : il a INTERCEPTÉ une sanction,
  //    et ce qui suit se lit en sachant qu'elle est retombée sur son porteur.
  if (shield) {
    steps.push({
      title: "Bouclier d'Athéna",
      tile: null,
      lines: [
        `\u{1F6E1}\u{FE0F} ${shield.playerName} garde son bouclier et boit ${shield.amount} \u{1F37A}`,
      ],
    });
  }

  // 2. LA SENTENCE DU POULET, qui tombe sur le jet AVANT tout déplacement —
  //    c'est l'ordre de `playTurn`. Elle concerne un AUTRE joueur que celui
  //    qui joue : la mélanger à l'action de ce dernier est précisément ce qui
  //    la rendait illisible.
  if (outcome.chickenPenalty) {
    const { name, distributes, roll } = outcome.chickenPenalty;

    steps.push({
      title: 'Le Poulet',
      tile: null,
      lines: [
        distributes
          ? `\u{1F414} ${roll} — ${name} est GROS POULET : il distribue 1 \u{1F37A}`
          : `\u{1F414} ${roll} — ${name} est le Poulet : il boit 1 \u{1F37A}`,
      ],
    });
  }

  // 3. CE QUE LA CASE FAIT FAIRE. Une seule étape : c'est une seule case, et
  //    ses phrases décrivent la même chose sous deux angles.
  const tileLines = landingLines(outcome, tile);
  if (tileLines.length > 0) {
    steps.push({
      title: `Au tour de ${outcome.playerName}`,
      tile: art,
      lines: tileLines,
    });
  }

  // 4. LA PRISE DU TITRE DE POULET, posée par la case où le pion s'arrête.
  //    Elle vient APRÈS l'effet de la case, comme dans `playTurn`, et se
  //    distingue de la sentence : l'une est un statut, l'autre une sanction.
  if (outcome.chicken) {
    steps.push({
      title: 'Le Poulet',
      tile: art,
      lines: [
        outcome.chicken.rank === 2
          ? `\u{1F414} ${outcome.playerName} devient GROS POULET : il distribuera 1 \u{1F37A} à chaque 3 ou 6`
          : `\u{1F414} ${outcome.playerName} est le Poulet : il boira 1 \u{1F37A} à chaque 3 ou 6`,
      ],
    });
  }

  // 5. LA FAVEUR DES DIEUX ferme la marche : les deux dés se lancent une fois
  //    la case résolue, et l'annoncer plus tôt ferait chercher des dés qui ne
  //    sont pas encore là.
  if (outcome.godFavor) {
    steps.push({
      title: 'Faveur des dieux',
      tile: art,
      lines: [`\u{1F3B2} ${outcome.playerName} lance les deux dés de la faveur`],
    });
  }

  // 6. LA VICTOIRE CLÔT LA PARTIE : elle mérite son propre écran, même si
  //    aucune gorgée n'est en jeu.
  if (outcome.winner) {
    steps.push({
      title: 'Victoire',
      tile: null,
      lines: [`\u{1F3C6} ${outcome.winner} arrive au bout de l'Odyssée !`],
    });
  }

  return steps;
}

/**
 * Ce que la case où le pion s'est posé fait faire.
 *
 * Les phrases sont celles que `action-text` et `table-announcements`
 * tiennent déjà : on les réemploie plutôt que d'en rédiger de nouvelles.
 * Deux formulations de la même case finiraient par diverger.
 */
function landingLines(outcome: TurnOutcome, tile: TileConfig | null): string[] {
  const lines: string[] = [];

  // LA DISTRIBUTION, prise directement sur l'issue du tour et non par
  // `tableAnnouncement` : celle-ci s'arrête à la PREMIÈRE chose trouvée, et
  // rendait donc la sentence du Poulet OU la distribution, jamais les deux.
  // Un tour qui produisait les deux en perdait une en silence.
  if (outcome.distribute) {
    lines.push(
      `${outcome.playerName} distribue ${outcome.distribute.amount} \u{1F37A} — à vous de jouer`
    );
  }

  // LA PHRASE DE LA CASE, dans les termes fixés par Bastien (SCH-11/12/13).
  if (tile && !outcome.distribute) {
    const action = buildActionText(tile, outcome.playerName);
    if (action) lines.push(action);
  }

  // UNE CASE QUI SE JOUE À LA TABLE n'a ni chiffre ni verbe standard : c'est
  // sa description qui porte la règle.
  if (tile && outcome.tableRule) {
    const subtitle = buildSubtitle(tile, null);
    lines.push(subtitle || withGulpSymbol(tile.name));
  }

  // LES GORGÉES SERVIES PAR LA CASE, quand aucune phrase ne les a dites.
  if (outcome.drinks && lines.length === 0) {
    lines.push(`${outcome.playerName} boit ${outcome.drinks.amount} \u{1F37A}`);
  }

  if (outcome.everyone && lines.length === 0) {
    lines.push(`Tout le monde boit \u{1F37A}`);
  }

  return lines;
}

/** Ce que la scène doit faire pendant que la modale est ouverte. */
export interface ActionModalHandles {
  /** Ferme et solde : le tour reprend. */
  validate: () => void;
  /** Escamote sans solder : le tour reste suspendu. */
  peek: () => void;
  /** Ramène la modale escamotée. */
  restore: () => void;
  /** La modale attend-elle encore une validation ? */
  isPending: () => boolean;
}

/**
 * Affiche la modale et rend de quoi la piloter.
 *
 * ELLE N'EST PAS BLOQUANTE AU SENS D'UNE PROMESSE. Une promesse imposerait
 * d'attendre sa résolution pour rendre la main, alors que tout l'intérêt est
 * justement de pouvoir l'escamoter et revenir : c'est `onValidate` qui
 * signale la fin, et l'appelant décide quoi en faire.
 *
 * Le style vient de `setup-screen.css` — or et marbre, comme l'écran qui
 * ouvre la partie. Rien n'est réécrit ici : la modale emprunte les classes
 * existantes (`.setup-screen`, `.setup-panel`, `.btn`) et n'ajoute que ce qui
 * lui est propre.
 */
export function showActionModal(
  content: ModalStep,
  onValidate: () => void,
  host: HTMLElement = document.body,
  /**
   * Reste-t-il une étape après celle-ci ?
   *
   * Change le LIBELLÉ du bouton, rien d'autre : « Valider » sur le dernier
   * écran, « Suivant » avant. Un bouton qui dit « Valider » alors qu'un
   * autre écran suit laisse croire que le tour est fini.
   *
   * Passé en argument plutôt que rangé dans l'étape : c'est une question de
   * présentation, et une étape ne sait pas dans quelle suite on la joue.
   */
  more = false
): ActionModalHandles {
  let pending = true;

  /**
   * Montre ou escamote la modale.
   *
   * `hidden` NE SUFFIT PAS, et c'est le défaut que Quentin a vu sur l'APK :
   * l'attribut ne vaut qu'un `display: none` de la feuille par défaut du
   * navigateur, et `.setup-screen` — dont la modale emprunte la mise en
   * scène — pose `display: flex`. La modale restait donc affichée alors que
   * le DOM la disait cachée.
   *
   * Le style est posé EN PLUS de l'attribut plutôt qu'à sa place : `hidden`
   * porte le sens pour les lecteurs d'écran, `display` fait le travail sans
   * dépendre de l'ordre des feuilles.
   */
  const reveal = (element: HTMLElement, shown: boolean): void => {
    element.hidden = !shown;
    element.style.display = shown ? '' : 'none';
  };


  const screen = document.createElement('div');
  screen.className = 'setup-screen action-modal';
  screen.id = 'action-modal';

  const panel = document.createElement('div');
  panel.className = 'setup-panel action-modal-panel';

  const title = document.createElement('h2');
  title.textContent = content.title;
  panel.appendChild(title);

  // LA CASE OÙ LE PION S'EST POSÉ, avant ce qu'il faut y faire : le joueur
  // reconnaît d'abord, applique ensuite.
  if (content.tile) {
    const figure = document.createElement('div');
    figure.className = 'action-modal-tile';

    const art = document.createElement('img');
    art.className = 'action-modal-art';
    art.src = content.tile.src;
    art.alt = content.tile.alt;
    // L'illustration est DÉCORATIVE au sens où la règle est déjà écrite en
    // dessous : elle ne doit pas retarder l'affichage de la modale, et son
    // absence ne doit rien empêcher.
    art.loading = 'eager';
    art.addEventListener('error', () => figure.remove());

    figure.appendChild(art);

    // LE VRAI CHIFFRE, posé sur l'illustration qui en porte un gravé. Sans
    // lui, une case ×4 montrerait « ×2 » au joueur — c'est la convention du
    // rendu CSS, reprise telle quelle.
    if (content.tile.amount !== null) {
      const badge = document.createElement('span');
      badge.className = 'action-modal-amount';
      badge.textContent = `\u00d7${content.tile.amount}`;
      figure.appendChild(badge);
    }

    panel.appendChild(figure);
  }

  for (const text of content.lines) {
    const line = document.createElement('p');
    line.className = 'action-modal-line';
    line.textContent = text;
    panel.appendChild(line);
  }

  const buttons = document.createElement('div');
  buttons.className = 'action-modal-buttons';

  // « VOIR LE PLATEAU » escamote sans solder. Le tour reste suspendu :
  // c'est ce qui distingue ce bouton de « Valider », et c'est pourquoi il
  // ne ressemble pas à l'action principale.
  const peekButton = document.createElement('button');
  peekButton.type = 'button';
  peekButton.className = 'btn btn-secondary';
  peekButton.id = 'action-peek';
  peekButton.textContent = 'Voir le plateau';

  const validateButton = document.createElement('button');
  validateButton.type = 'button';
  validateButton.className = 'btn btn-primary';
  validateButton.id = 'action-validate';
  validateButton.textContent = more ? 'Suivant' : 'Valider';

  buttons.append(peekButton, validateButton);
  panel.appendChild(buttons);
  screen.appendChild(panel);

  // LE RAPPEL, posé hors de la modale puisqu'il ne vit que quand elle est
  // escamotée. Sans lui, « Voir le plateau » serait un aller sans retour et
  // la partie resterait suspendue sans que rien ne l'explique — exactement
  // le défaut que la modale corrige.
  const recall = document.createElement('button');
  recall.type = 'button';
  recall.className = 'action-modal-recall';
  recall.id = 'action-recall';
  recall.textContent = '\u{1F4DC} Revenir à l’action';
  // L’état initial passe par le MÊME chemin que les bascules : deux façons
  // de cacher le même bouton finiraient par diverger, et c’est exactement ce
  // qui vient d’arriver à la modale.
  reveal(recall, false);

  const peek = (): void => {
    if (!pending) return;

    reveal(screen, false);
    reveal(recall, true);
  };

  const restore = (): void => {
    if (!pending) return;

    reveal(screen, true);
    reveal(recall, false);
  };

  const validate = (): void => {
    if (!pending) return;

    pending = false;
    screen.remove();
    recall.remove();
    onValidate();
  };

  peekButton.addEventListener('click', peek);
  recall.addEventListener('click', restore);
  validateButton.addEventListener('click', validate);

  host.append(screen, recall);

  return { validate, peek, restore, isPending: () => pending };
}

/**
 * Joue les étapes d'un tour L'UNE APRÈS L'AUTRE.
 *
 * LE DÉFAUT QUE CELA CORRIGE : tout arrivait sur un seul écran. Un joueur qui
 * tombait sur le Poulet ET déclenchait la faveur des dieux voyait les deux
 * mélangés sous une même illustration, sans savoir lequel appliquer en
 * premier. Quentin : « les événements doivent s'afficher dans l'ordre
 * d'exécution, pas tous ensemble ».
 *
 * Chaque étape attend sa validation avant que la suivante paraisse, et
 * `onDone` n'est appelé qu'une fois la dernière soldée — c'est lui qui rend
 * la main au dé.
 *
 * Renvoie `false` quand il n'y a rien à jouer : l'appelant sait alors que le
 * tour n'est pas suspendu.
 */
export function runModalSteps(
  steps: ModalStep[],
  onDone: () => void,
  host: HTMLElement = document.body
): boolean {
  if (steps.length === 0) return false;

  let index = 0;

  const playNext = (): void => {
    if (index >= steps.length) {
      onDone();
      return;
    }

    const step = steps[index];
    index += 1;

    showActionModal(step, playNext, host, index < steps.length);
  };

  playNext();

  return true;
}

/**
 * Les illustrations des dieux, rangées par SOMME des deux dés.
 *
 * LEUR CORRESPONDANCE A ÉTÉ VÉRIFIÉE EN LES REGARDANT, une par une, et non
 * déduite de leur nom. Un commentaire de `main-camera.ts` s'y était refusé —
 * « rien ne dit à quelle faveur chacun correspond, le deviner reviendrait à
 * afficher le mauvais dieu » — et la prudence était juste : le nom d'un
 * fichier ne prouve rien.
 *
 * Les neuf portent bien leur dieu, attributs à l'appui : la chouette et la
 * lance d'ATHÉNA (3), les cœurs d'APHRODITE (4), le caducée et les sandales
 * ailées d'HERMÈS (5), la lyre d'APOLLON (6), l'arc et le carquois
 * d'ARTÉMIS (7), l'épée et le bouclier d'ARÈS (8), la grappe de DIONYSOS
 * (9), l'enclume et le marteau d'HÉPHAÏSTOS (10), le trident de
 * POSÉIDON (11).
 *
 * Elles suivent donc la table CORRIGÉE du plateau (#34) — c'est Artémis qui
 * porte le 7, la faveur ajoutée lors de cette correction, et non la
 * numérotation d'avant.
 *
 * LES SOMMES 2 ET 12 N'ONT PAS D'ILLUSTRATION : ce sont les doubles, la
 * COLÈRE DES DIEUX et ZEUS. Les fichiers n'existent pas, et on n'en invente
 * pas — l'étape s'affiche alors avec son texte, sans image.
 */
const GOD_ART: Record<number, string> = {
  3: '/assets/cells/god_3.png',
  4: '/assets/cells/god_4.png',
  5: '/assets/cells/god_5.png',
  6: '/assets/cells/god_6.png',
  7: '/assets/cells/god_7.png',
  8: '/assets/cells/god_8.png',
  9: '/assets/cells/god_9.png',
  10: '/assets/cells/god_10.png',
  11: '/assets/cells/god_11.png',
};

/**
 * L'écran d'une faveur des dieux : le dieu obtenu, et ce qu'il fait faire.
 *
 * MÊME FORME QUE LES CASES, comme Quentin l'a demandé — illustration, règle,
 * et les mêmes boutons. Une faveur est une règle à appliquer à la table au
 * même titre qu'une case : rien ne justifie qu'elle s'annonce autrement.
 *
 * La description est celle des règles officielles, avec 🍺 substitué à
 * l'affichage (SCH-12) : on ne réécrit pas le texte de référence.
 *
 * Renvoie `null` quand les dés n'ont donné aucune faveur — il n'y a alors
 * rien à annoncer.
 */
export function favorStep(roll: FavorRoll): ModalStep | null {
  if (!roll.favor) return null;

  const source = GOD_ART[roll.sum];

  return {
    title: `${roll.favor.icon} ${roll.favor.name}`,
    tile: source
      ? { src: source, alt: roll.favor.name, amount: null }
      : null,
    lines: [
      // LA SOMME EST DITE : c'est elle qui désigne la faveur sur le plateau,
      // et le joueur vient de lire les deux faces. Sans elle, il ne peut pas
      // vérifier que l'application lit les mêmes dés que lui.
      `${roll.a} + ${roll.b} = ${roll.sum}`,
      withGulpSymbol(roll.favor.description),
    ],
  };
}
