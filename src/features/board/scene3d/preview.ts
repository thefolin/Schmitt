import { Raycaster, Vector2 } from 'three';
import { BoardScene } from './board-scene';
import { buildJourneyProgress } from './journey-progress';
import {
  readInsetOverrides,
  applySimulatedSafeArea,
  describeInsets,
  type InsetOverrides,
} from './debug-insets';
import { BoardTiles3D } from './board-tiles-3d';
import { Dice3DScene } from './dice-3d-scene';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG, rollingSpinRate, DIE_EDGE } from './dice-world-config';
import { diceArena } from './dice-arena';
import { FavorDice } from './favor-dice';
import { duringFavor, betweenFavors, type DiceVisibility } from './dice-on-stage';
import {
  grabProbes,
  gestureOwner,
  followsFinger,
  shortestTurn,
  commonDrift,
  mouseGesture,
} from './grab-zone';

/**
 * Degrés d'inclinaison par pixel de glissement commun.
 *
 * La même valeur que la souris (`TILT_PER_PIXEL` dans `board-scene`) : un
 * geste vertical doit incliner d'autant, qu'il vienne d'un doigt ou d'une
 * souris. Deux réglages différents pour le même mouvement donneraient deux
 * appareils qui ne se ressemblent pas.
 */
const TILT_PER_PIXEL = 0.3;
import { collideWithFixed, type MovingBody } from './collisions';
import { walkPath } from './pawn-path';
import { walkFrame } from './pawn-walk';
import { swipeToThrow, GRAB_LIFT, type ThrowRequest } from './dice-gesture';
import { describeTurn, JOURNAL_MAX } from './turn-journal';
import {
  readCinemaMode,
  toggleCinemaMode,
  rollSpan,
  CINEMA_HOLD_MS,
} from './cinema-mode';
import {
  isShake,
  motionIntensity,
  motionAvailable,
  motionContextAllowed,
  motionBlockedReason,
  type MotionReading,
} from './shake';
import { readDeviceOverride } from './device';
import { askForPlayers } from './setup-screen';
import { modalContent, showActionModal } from './action-modal';
// Les tokens du design system précèdent la feuille qui les consomme :
// `setup-screen.css` en emploie 43, et sans eux l'écran s'affiche nu.
import '@/styles/common/design-system.css';
import '@/styles/common/setup-screen.css';
// La modale emprunte la mise en scène du setup : sa feuille suit donc celle
// qu'elle complète, et n'ajoute que ce qui lui est propre.
import '@/styles/common/action-modal.css';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from './turn-runner';
import { loadTileConfigs, TILE_CONFIGS } from '@/features/tiles/tile.config';
import type { TileConfig } from '@/core/models/Tile';
import { fetchBoardLayout } from '../camera/board-layout.config';

/**
 * Aperçu du rendu 3D, isolé du jeu.
 *
 * Il sert à juger le plateau — cadrage, lisibilité, orientation — sans
 * toucher à la partie jouable. Le rendu CSS reste en place pendant toute la
 * refonte : on ne remplace rien tant que le nouveau rendu n'est pas au
 * niveau.
 */

async function main(): Promise<void> {
  const container = document.getElementById('scene');
  const status = document.getElementById('status');
  if (!container) return;

  // Outillage de recette : sans lui, un défaut de cadrage sur téléphone se
  // corrige à l'aveugle, par l'intermédiaire de quelqu'un qui n'a pas le code
  // sous les yeux. Sans paramètre d'URL, rien ne change.
  const overrides = readInsetOverrides(window.location.search);
  const device = readDeviceOverride(window.location.search);
  applySimulatedSafeArea(overrides);
  if (overrides.outline) document.body.classList.add('debug-outline');

  // LE BANDEAU DE DIAGNOSTIC est réservé à la RECETTE. Il servait à régler le
  // cadrage — cases visibles, angle, taille d'une case en pixels — et Quentin
  // le veut hors de l'écran de jeu : « minimaliste, style Waze ». Il n'est pas
  // supprimé pour autant : reconstruire cette instrumentation de mémoire
  // coûterait cher, et elle reste ce qui permet de régler le portrait.
  const diagnostics = document.getElementById('bar');
  if (diagnostics) diagnostics.hidden = !overrides.outline;

  const scene = new BoardScene({
    container,
    // Les bandeaux sont MESURÉS, jamais devinés. Une constante en dur ignore
    // que le bandeau du haut passe à trois lignes sur un écran étroit, et que
    // la barre de progression occupe le bas — le plateau se cadrait alors
    // dans une surface qui n'existe pas. Invisible sur un écran large, où le
    // bandeau tient sur une ligne.
    hudInsets: measureHudInsets(overrides),
  });

  if (!scene.isAvailable()) {
    if (status) {
      status.textContent =
        'WebGL indisponible sur cet appareil — le jeu resterait sur le rendu actuel.';
    }
    return;
  }

  const tiles = new BoardTiles3D();
  scene.world.add(tiles.group);

  // Les vraies données du jeu : mêmes cases, même parcours, mêmes
  // illustrations. Un aperçu sur des données inventées ne prouverait rien.
  const [catalog, layout] = await Promise.all([
    loadTileConfigs().catch(() => TILE_CONFIGS),
    fetchBoardLayout('/assets/schmitt.json'),
  ]);

  const positions = tiles.build(catalog, layout);

  // Une vraie partie, pilotée par les VRAIES règles (#46). La scène ne
  // décide d'aucune règle : elle demande à GameLogic ce qui arrive au pion
  // et se contente de l'afficher.
  const logic = new GameLogic();
  logic.setBoardSize(positions.length);

  // QUI JOUE ? La scène attend la réponse avant de commencer. Elle démarrait
  // jusqu'ici sur trois joueurs écrits en dur — Alice, Bastien, Chloé — ce
  // qui interdisait de jouer à quatre, de se nommer et de choisir sa
  // couleur. Sur un jeu à boire qui se joue en soirée, c'est bloquant.
  //
  // Les noms sont retenus d'une partie à l'autre : on ne se renomme pas à
  // chaque manche.
  logic.startGame(await askForPlayers());

  const runner = new TurnRunner(logic);

  // Les cases telles qu'elles sont POSÉES sur le parcours, et non le
  // catalogue : sur un plateau composé dans l'éditeur, la case du rang N
  // n'est pas la case N du catalogue. C'est le correctif #30.
  // Les cases telles qu'elles sont POSÉES sur le parcours : c'est la même
  // liste que celle donnée au runner, gardée sous la main pour retrouver la
  // case où un pion vient de s'arrêter et en énoncer la règle.
  const placed = layout.placements.map(placement => catalog[placement.tileId]);

  runner.setBoard(placed);

  tiles.setPawns(runner.pawns());

  scene.setBoardExtent(positions, layout.tileSize);

  // La vue suit le pion : c'est l'arbitrage de Quentin pour la lisibilité
  // (#45). Une case fait alors 54 px sur un 5 pouces, contre 40 en montrant
  // tout le parcours — au-dessus des 48 px de la cible tactile.
  const die = new Dice3DScene();
  scene.world.add(die.group);

  /**
   * Choisit la vue d'après la forme de l'écran.
   *
   * En paysage le plateau entier se lit (67 px sur un Pixel 10) et la vue
   * d'ensemble y est meilleure que la vue suivie : on montre tout. En
   * portrait le plateau entier tombe à 40 px, sous la cible tactile, et la
   * vue suivie reste nécessaire. Recalculé à chaque rotation de l'appareil.
   */
  const applyPreferredView = (): void => {
    if (scene.prefersWholeBoard()) scene.showWholeBoard();
    else scene.followTile(runner.tileToFollow());
  };

  applyPreferredView();

  scene.start();

  const refresh = () => {
    report(status, scene, positions.length);
    renderProgress(runner.tileToFollow(), positions.length);
    announce(runner);
    labelViewButton(scene);
  };

  // Le tour complet : lancer → avancer → joueur suivant (#46).
  const startsOnDice = attachDice(
    die,
    positions,
    tiles,
    logic,
    runner,
    placed,
    scene,
    applyPreferredView,
    refresh
  );

  // Basculer entre « tout voir » et « suivre le pion », quand le joueur
  // veut autre chose que ce que la forme de l'écran suggère.
  document.getElementById('whole')?.addEventListener('click', () => {
    if (scene.isFollowing()) scene.showWholeBoard();
    else scene.followTile(runner.tileToFollow());
    refresh();
  });

  refresh();

  // Le dé, dans la MÊME scène et sous la MÊME caméra que le plateau (#44).
  // C'est le juge de paix de la refonte : le désaccord face lue / face vue
  // ne peut plus exister par construction, puisqu'il n'y a plus deux
  // représentations à accorder.
  // Déplacement, zoom et rotation : l'acquis #15 plus la rotation de #43.
  attachControls(container, scene, refresh, startsOnDice);

  /**
   * Remesure les bandeaux et recadre.
   *
   * Au redimensionnement et à la rotation, mais aussi quand la barre d'URL du
   * navigateur mobile se rétracte : `visualViewport` signale ce changement que
   * `resize` seul ne rapporte pas toujours.
   */
  const remeasure = () => {
    const insets = measureHudInsets(overrides);
    scene.setHudInsets(insets);
    showInsets(insets, overrides);
    // La rotation de l'appareil change la vue qui convient : on la recalcule
    // plutôt que de laisser le joueur sur un cadrage choisi pour l'autre
    // orientation.
    applyPreferredView();
      refresh();
  };

  // L'HISTORIQUE, derrière un bouton. Il occupait trois lignes en
  // permanence pour un CONFORT — savoir ce qui vient de se passer. Le
  // plateau récupère la place, et le joueur l'ouvre quand il en a besoin.
  //
  // Aucune remesure ici : le panneau se SUPERPOSE au plateau, il ne change
  // pas la hauteur des bandeaux. C'est l'arbitrage retenu pour la modale
  // d'action, et il vaut pour la même raison — un recadrage à chaque
  // consultation ferait sauter l'image sous les yeux du joueur.
  const journalPanel = document.getElementById('journal-panel');
  const showJournal = (open: boolean): void => {
    if (journalPanel) journalPanel.hidden = !open;
  };

  document.getElementById('journal-open')?.addEventListener('click', () => showJournal(true));
  document.getElementById('journal-close')?.addEventListener('click', () => showJournal(false));

  // Toucher à côté de la carte referme : c'est le geste attendu d'un
  // panneau posé par-dessus, et il évite de viser une croix de 36 px.
  journalPanel?.addEventListener('click', event => {
    if (event.target === journalPanel) showJournal(false);
  });

  window.addEventListener('resize', remeasure);
  window.addEventListener('orientationchange', remeasure);
  window.visualViewport?.addEventListener('resize', remeasure);

  // Les bandeaux peuvent changer de hauteur quand leur texte change — le
  // libellé « Case 12 / 23 » n'occupe pas toujours le même nombre de lignes.
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(remeasure);
    for (const id of ['bar', 'foot']) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
  }

  // Une première mesure après la mise en page : au moment de la construction,
  // les bandeaux n'ont pas encore leur hauteur définitive.
  requestAnimationFrame(remeasure);
}

/**
 * Mesure la place réellement occupée par les bandeaux.
 *
 * On lit le DOM plutôt que de reprendre des constantes : la hauteur dépend du
 * texte, de la taille de police du système et de la largeur de l'écran. Les
 * encoches système, elles, sont ajoutées par la scène — elle les lit depuis le
 * CSS, seul endroit où le navigateur les expose.
 */
function measureHudInsets(overrides: InsetOverrides): { top: number; bottom: number } {
  const height = (id: string): number => {
    const element = document.getElementById(id);
    if (!element) return 0;

    const box = element.getBoundingClientRect();
    return Math.max(0, Math.round(box.height));
  };

  return {
    top: overrides.top ?? height('bar'),
    bottom: overrides.bottom ?? height('foot'),
  };
}

/** Affiche ce que le cadrage a décidé, pour pouvoir en juger. */
function report(status: HTMLElement | null, scene: BoardScene, count: number): void {
  if (!status) return;

  const framing = scene.getFraming();
  const turned = framing.yawDeg === 90 ? 'quart de tour' : 'sens naturel';

  // En perspective, la taille apparente dépend de la distance : on la mesure
  // sur la scène plutôt que de la déduire d'un facteur d'échelle, qui n'a
  // plus cours depuis le passage en projection conique.
  const tilePx = Math.round(scene.worldToScreenPixels(120));

  // L'angle de vue est affiché : c'est ce qu'on est en train de juger, et
  // « vue 45° » se vérifie d'un coup d'œil là où un plateau tourné ne dit
  // pas de combien il l'est.
  const orbit = scene.getOrbit();
  const angle = `vue ${Math.round(orbit.yawDeg)}° / ${Math.round(orbit.tiltDeg)}°`;
  const mode = scene.isFollowing() ? 'suivi' : 'tout le plateau';

  status.textContent = `${count} cases · ${mode} · ${turned} · ${angle} · case ≈ ${tilePx} px`;
}

/**
 * Montre où l'on en est dans le parcours.
 *
 * Cadrer une fenêtre règle la lisibilité mais retire la vue d'ensemble, qui
 * disait implicitement où l'on en était. Une barre fine et une case comptée
 * rendent cette information sans manger l'écran.
 */
function renderProgress(position: number, total: number): void {
  const bar = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  const wrap = document.getElementById('progress');

  const progress = buildJourneyProgress(position, total);
  if (!wrap) return;

  if (!progress) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  if (bar) bar.style.width = `${progress.ratio * 100}%`;
  if (label) label.textContent = progress.label;
}

/**
 * Affiche les marges retenues et trace le cadre visé.
 *
 * Le cadre rend la question vérifiable au lieu d'être une appréciation : on
 * voit si le plateau est centré DANS LUI, sans avoir à juger « à vue » sur
 * une capture d'écran.
 */
function showInsets(
  insets: { top: number; bottom: number },
  overrides: InsetOverrides
): void {
  const line = document.getElementById('insets');
  if (line) {
    line.textContent = describeInsets(insets, {
      width: Math.round(window.visualViewport?.width ?? window.innerWidth),
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
    });
  }

  if (!overrides.outline) return;

  const frame = document.getElementById('frame');
  if (!frame) return;

  frame.style.top = `${insets.top}px`;
  frame.style.bottom = `${insets.bottom}px`;
}

/**
 * Lance le dé et le fait vivre dans la scène.
 *
 * La physique est celle du jeu, sans modification : elle a déjà été mesurée à
 * 0 % d'erreur sur 3 000 tirages, et le dé tombé hors plateau s'y repose à
 * plat (13f9c40). On ne refait pas ce qui marche — on le branche sur un rendu
 * qui ne peut plus le contredire.
 */
function attachDice(
  die: Dice3DScene,
  positions: { x: number; z: number }[],
  tiles: BoardTiles3D,
  logic: GameLogic,
  runner: TurnRunner,
  /** Les cases telles qu'elles sont POSÉES, pour énoncer la règle de celle où le pion s'arrête. */
  board: TileConfig[],
  scene: BoardScene,
  follow: () => void,
  refresh: () => void
): (x: number, y: number) => boolean {
  // L'aire de jeu épouse le PLATEAU, et non un carré inventé : le dé roule
  // sur les cases et rebondit sur leurs bords. « Pas de je jette le dé dans
  // le vide. » Les quatre côtés sont bordés, donc le dé ne peut pas tomber.
  const arena = diceArena(positions, 120);

  /**
   * Une physique neuve, posée au MILIEU du tapis.
   *
   * Quentin : « au début de la partie je voudrais que le dé soit au milieu du
   * tapis ». Elle est reconstruite à chaque tour, et pas seulement au
   * démarrage : `DicePhysics` relance depuis l'endroit où le dé s'est
   * ARRÊTÉ, pas depuis son point d'origine — vérifié, le deuxième lancer
   * partait de (923, 481) après un premier qui avait fini là.
   *
   * Sans cela, reposer le dessin au centre sans replacer la simulation ferait
   * SAUTER le dé au moment du lancer, du centre vers sa position précédente.
   *
   * `DicePhysics` n'a pas de méthode pour se repositionner, et c'est un
   * module partagé avec le rendu CSS de `main` : on le reconstruit plutôt que
   * d'y toucher. L'objet est léger, et un lancer par tour n'a rien d'une
   * boucle serrée.
   */
  const physicsAt = (from?: { x: number; z: number }): DicePhysics => {
    // Le point de départ est BORNÉ à l'aire : un dé lâché au bord de l'écran
    // pourrait viser un point hors du plateau, et la physique démarrerait
    // dans le mur.
    const startX = from
      ? Math.min(Math.max(from.x, arena.minX), arena.maxX)
      : (arena.minX + arena.maxX) / 2;
    const startZ = from
      ? Math.min(Math.max(from.z, arena.minZ), arena.maxZ)
      : (arena.minZ + arena.maxZ) / 2;

    const fresh = new DicePhysics(
      WORLD_DICE_CONFIG,
      { x: startX, y: startZ },
      { width: arena.maxX - arena.minX, height: arena.maxZ - arena.minZ }
    );

    fresh.setTableBounds(
      { minX: arena.minX, maxX: arena.maxX, minY: arena.minZ, maxY: arena.maxZ },
      { top: true, right: true, bottom: true, left: true }
    );

    return fresh;
  };

  let physics = physicsAt();

  const result = document.getElementById('dice-value');

  // LES DEUX DÉS DU TEMPLE. Objet distinct du dé du tour : celui-ci garde sa
  // physique et sa chaîne « la face vue est celle dont on avance ». Ils
  // restent invisibles tant que personne ne se pose sur le temple.
  const favorDice = new FavorDice(arena, () => tiles.pawnObstacles());
  for (const view of favorDice.views) scene.world.add(view.group);

  /**
   * Applique qui est posé sur le plateau.
   *
   * JAMAIS TROIS DÉS. Le dé du tour et les deux dés de la faveur sont trois
   * objets distincts : montrer la faveur sans retirer le dé du tour en
   * laissait trois sur le plateau, et la somme annoncée ne correspondait plus
   * à une paire lisible.
   */
  const showDice = (visibility: DiceVisibility): void => {
    die.setVisible(visibility.turn);
    favorDice.setVisible(visibility.favor);
  };

  /**
   * POSE le dé du tour au milieu du tapis.
   *
   * Quentin (20/09/2026) : « au début de la partie je voudrais que le dé soit
   * au milieu du tapis ».
   *
   * Sa position n'était fixée que PENDANT l'animation du lancer : avant le
   * premier jet, il restait à l'origine du monde, c'est-à-dire dans un coin
   * du plateau. Le joueur devait deviner où l'attraper — le même défaut que
   * celui corrigé pour les deux dés de la faveur (#61).
   *
   * Le centre est CONSERVÉ plutôt que relu sur la physique : après un lancer,
   * `getState().position` donne l'endroit où le dé s'est arrêté, pas celui
   * d'où il est parti. Le relire reposerait le dé là où il a fini de rouler.
   */
  const matCentre = {
    x: (arena.minX + arena.maxX) / 2,
    z: (arena.minZ + arena.maxZ) / 2,
  };

  const restDie = (): void => {
    // La SIMULATION revient au centre elle aussi, sinon le prochain lancer
    // partirait de là où le dé s'était arrêté et le dé sauterait.
    physics = physicsAt();

    die.setPosition(matCentre.x, BoardTiles3D.diceSurface + Dice3DScene.halfSize, matCentre.z);
  };

  let frame: number | null = null;

  /**
   * Le pion est-il en train de marcher ?
   *
   * Le lancer doit rester SOURD pendant ce temps. `frame` est remis à `null`
   * dès que le dé s'immobilise, donc avant que le pion soit arrivé : sans ce
   * second verrou, un joueur pressé pourrait relancer en pleine marche, et la
   * physique serait remplacée sous les pieds de l'animation en cours.
   */
  let walking = false;

  /**
   * Un tour SUSPENDU par la modale d'action.
   *
   * Tant qu'elle attend « Valider », le dé est sourd. C'est ce qui donne son
   * sens au bouton : sans ce verrou, la modale énoncerait la règle pendant
   * que le joueur suivant lance déjà, et « on reprend le tour » ne
   * reprendrait rien du tout.
   */
  let awaitingValidation = false;

  /**
   * Fait rouler le dé dans le sens de sa course.
   *
   * Un cube d'arête `a` qui avance de `v` sans glisser bascule à `2·v/a`,
   * autour de l'axe horizontal perpendiculaire à son déplacement. Tant qu'il
   * est en l'air, on laisse la rotation libre de la physique : un dé en vol
   * ne roule sur rien.
   */
  const applyRolling = (state: ReturnType<typeof physics.update>): void => {
    if (state.height > 0.5) return;

    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    if (speed < 1) return;

    const rate = rollingSpinRate(speed);

    state.spin.x = (-state.velocity.y / speed) * rate;
    state.spin.z = (state.velocity.x / speed) * rate;
    state.spin.y *= 0.9;
  };

  /**
   * Cadrage du dé pendant qu'il roule, ramené doucement.
   *
   * Le suivi est AMORTI : la caméra tend vers le dé au lieu de lui coller.
   * Un cadrage collé sur un objet qui rebondit donne le tournis, et le
   * mouvement de la caméra masquerait celui du dé qu'on veut justement
   * regarder.
   */
  /**
   * Le cadre pendant qu'un dé roule, en unités monde.
   *
   * Quentin (20/09/2026) : « cela m'a presque fait vomir comme cela tourne
   * si vite ».
   *
   * LA CAMÉRA POURSUIVAIT LE DÉ, et j'avais aggravé la chose en allongeant
   * les lancers (#69). Mesuré sur un Pixel 10 en portrait : le suivi faisait
   * défiler l'image jusqu'à 1 372 px par seconde, sans que le joueur commande
   * ce mouvement. Le mal des transports apparaît bien en deçà — vers 800 px/s
   * de panoramique subi.
   *
   * Le dé ne s'écarte jamais de plus de 4,75 cases de son point de départ
   * (mesuré sur 900 lancers, au plus fort de la plage). Un cadre de ONZE
   * cases centré sur ce départ le contient donc TOUJOURS, et peut rester
   * IMMOBILE : plus aucun panoramique, et le dé reste visible du début à la
   * fin de sa course.
   *
   * Onze cases plutôt que neuf : à neuf le cadre serait au plus juste, et un
   * dé qui frôle le bord donnerait envie de le suivre. Onze laisse de la
   * marge sans rendre le dé trop petit — 40 px sur un Pixel 10, plus la zone
   * de prise de 12 px de chaque côté (#63), soit 64 px de cible.
   */
  /** Le nombre de cases que cadre le mode plateau, et la taille d'une case. */
  const BOARD_SPAN_TILES = 11;
  const TILE = 120;

  /**
   * Le mode choisi par le joueur, relu au démarrage.
   *
   * Tenu en mémoire plutôt que relu à chaque lancer : la lecture du stockage
   * peut jeter, et le moment du lancer n'est pas celui de s'en apercevoir.
   */
  let cinema = readCinemaMode();

  const cinemaButton = document.getElementById('cinema');
  const cinemaResult = document.getElementById('cinema-result');

  /** Le cadre du lancer en cours, selon le mode. */
  const currentSpan = (): number => rollSpan(cinema, TILE, BOARD_SPAN_TILES);

  /** Efface le HUD le temps de la prise de vue. */
  const dimHud = (on: boolean): void => {
    document.body.classList.toggle('cinema-rolling', on);
  };

  /**
   * La pause en cours, s'il y en a une.
   *
   * Retenue pour pouvoir l'ANNULER : sans cela, un joueur qui recadre ou
   * relance pendant les deux secondes verrait le HUD se rallumer et la vue
   * s'élargir au milieu de son geste, commandés par un lancer déjà fini.
   */
  let holding: number | null = null;

  /** Interrompt la pause et remet le HUD, quoi qu'il se soit passé. */
  const endCinemaHold = (): void => {
    if (holding !== null) {
      window.clearTimeout(holding);
      holding = null;
    }

    showCinemaFace(null);
    dimHud(false);
  };

  /** Montre la face lue, en grand, pendant que le HUD est effacé. */
  const showCinemaFace = (face: number | null): void => {
    if (!cinemaResult) return;

    cinemaResult.textContent = face === null ? '' : String(face);
    cinemaResult.classList.toggle('shown', face !== null);
  };

  /** Met le bouton en accord avec l'état, à l'écran comme pour l'annonce. */
  const showCinemaState = (): void => {
    cinemaButton?.setAttribute('aria-pressed', String(cinema));
  };

  /**
   * DIT au joueur comment lancer, d'après ce qu'on a CONSTATÉ.
   *
   * Sans consigne, une secousse ne se devine pas : le joueur reste au bouton
   * et le geste n'existe que pour qui a lu le journal des modifications.
   * C'est la même raison qui fait annoncer « attrape les 2 dés » quand la
   * faveur des dieux arrive.
   *
   * Mais la consigne ne PROMET QUE CE QUI MARCHE : annoncer le geste sur un
   * appareil qui ne mesure rien enverrait le joueur secouer dans le vide, et
   * il conclurait que l'application est cassée plutôt que son téléphone
   * dépourvu de capteur.
   */
  const sayHowToRoll = (shakes: boolean): void => {
    if (!cinema) return;

    const who = runner.currentPlayerName();

    if (shakes) {
      say(`\u{1F3B2} ${who} — secoue le téléphone ou appuie sur Lancer`);
      return;
    }

    // ON DIT LA CAUSE, pas le symptôme. « Les capteurs ne répondent pas »
    // envoie chercher une panne de téléphone, alors que le cas le plus
    // fréquent en recette est une page servie en HTTP : Chrome coupe alors
    // les capteurs sans le dire, et aucune permission n'y change rien.
    const blocked = motionBlockedReason();

    say(
      blocked
        ? `\u{1F3B2} ${who} — appuie sur Lancer (${blocked})`
        : `\u{1F3B2} ${who} — appuie sur Lancer`
    );
  };

  showCinemaState();

  /**
   * Temps pendant lequel les deux dés du temple restent posés.
   *
   * Assez pour lire les deux faces et vérifier la somme annoncée — c'est un
   * jeu à boire, on recompte. Au-delà, deux dés oubliés se confondraient avec
   * le dé du tour suivant.
   */
  const FAVOR_DICE_LINGER_MS = 4000;
  /**
   * Où la caméra se pose pour regarder le lancer, et où elle RESTE.
   *
   * Posée UNE FOIS au moment du jet, sur le point d'où le dé part. Elle ne le
   * poursuit pas : c'est ce panoramique subi qui donnait la nausée.
   */
  let camX = (arena.minX + arena.maxX) / 2;
  let camZ = (arena.minZ + arena.maxZ) / 2;

  /** Cadre le lancer à venir, sans plus bouger ensuite. */
  const frameTheRoll = (): void => {
    const start = physics.getState().position;

    camX = start.x;
    camZ = start.y;

    // LE CADRE DIT LE MODE. C'est la seule différence côté caméra entre
    // regarder le dé rouler au milieu du jeu et le voir en gros plan.
    scene.followPoint(camX, camZ, currentSpan());

    // Une pause qui traînerait est interrompue : elle appartient au lancer
    // précédent, et rallumerait le HUD en plein milieu de celui-ci.
    endCinemaHold();

    // Le HUD s'efface dès le départ du dé, et le résultat précédent avec
    // lui : le laisser à l'écran pendant le nouveau lancer annoncerait une
    // face qui n'est plus la bonne.
    if (cinema) {
      dimHud(true);
      showCinemaFace(null);
    }
  };

  const step = (): void => {
    const state = physics.update(16);

    applyRolling(state);

    // LE DÉ HEURTE LES PIONS. `DicePhysics` ne gère que les bords : sans
    // cette passe, le dé traversait les pions comme s'ils n'existaient pas.
    // Le choc est résolu APRÈS le pas de simulation, comme le roulement, pour
    // ne pas toucher au module partagé avec le rendu CSS de `main`.
    hitPawns(state, tiles);

    // LA CAMÉRA NE BOUGE PAS pendant que le dé roule. Elle a été posée au
    // lancer sur la zone où le dé va évoluer, et elle y reste : c'est le
    // joueur qui suit le dé des yeux, pas l'image qui défile sous lui.
    die.setOrientation(state.orientation);
    // Les coordonnées de la physique SONT celles du monde : l'aire épouse le
    // plateau, il n'y a plus de repère intermédiaire à convertir.
    die.setPosition(
      state.position.x,
      BoardTiles3D.diceSurface + Dice3DScene.halfSize + Math.max(0, state.height),
      state.position.y
    );

    if (state.isRolling) {
      frame = requestAnimationFrame(step);
      return;
    }

    // Un dé tombé de la table se repose à plat plutôt que de rester figé sur
    // une arête, sans face lisible (13f9c40) : l'acquis qu'on ne perd pas.
    if (state.hasFallen) physics.resetFall();

    frame = null;

    // LA CHAÎNE QUI COMPTE : la face que le joueur voit sur le dessus du dé
    // est celle dont on avance. Elle n'est pas retirée au sort une seconde
    // fois — c'est toute la différence avec le rendu précédent.
    const face = physics.getState().currentValue;
    if (result) result.textContent = String(face);

    const outcome = runner.playTurn(face);

    walking = true;

    // LE PION MARCHE, il ne se téléporte pas (#48). `setPawns` reconstruit
    // chaque pion à sa position finale : c'est exactement la téléportation
    // que Quentin ne veut plus. On anime le trajet, puis on repose les pions
    // proprement à l'arrivée.
    walkPawn(tiles, runner, outcome, () => {
      tiles.setPawns(runner.pawns());
      refresh();

      // LE DÉ REVIENT AU MILIEU DU TAPIS. Il reste là où il s'est arrêté le
      // temps que le pion marche — c'est cette face qu'on vient de lire, et
      // la déplacer pendant qu'on la lit serait déroutant. Une fois le pion
      // posé, il regagne sa place : le joueur suivant sait toujours où le
      // trouver, plutôt que de le chercher là où le précédent l'a laissé.
      //
      // La physique, elle, relance toujours depuis le centre de l'aire.
      restDie();
      walking = false;

      // LA FAVEUR DES DIEUX, une fois le pion posé. Les deux dés arrivent
      // APRÈS la marche : le joueur doit d'abord voir où il est tombé, sinon
      // les dés surgissent pendant que le pion bouge encore et plus personne
      // ne sait ce qui a déclenché quoi.
      if (outcome.godFavor) offerFavorDice();
    });

    // Retour SOUPLE à la vue du plateau : un saut de caméra à l'instant où
    // le dé s'immobilise ferait perdre le résultat de vue.
    //
    // EN MODE CINÉMA, la face reste lisible un instant avant que la vue
    // s'élargisse. C'est tout ce que la pause achète, et c'est ce que
    // Quentin a demandé : « résultat lisible 2-3 secondes ». Le HUD étant
    // masqué, la face est écrite en grand au milieu de l'écran — sans quoi
    // elle ne serait affichée nulle part.
    if (cinema) {
      showCinemaFace(face);

      holding = window.setTimeout(() => {
        holding = null;
        showCinemaFace(null);
        dimHud(false);
        easeBack(scene, camX, camZ, currentSpan(), follow);
      }, CINEMA_HOLD_MS);
    } else {
      easeBack(scene, camX, camZ, currentSpan(), follow);
    }

    // Le tour est raconté par `describeTurn`, et consigné dans l'historique
    // que GameLogic tient déjà. On ne tient pas un second journal à côté :
    // deux récits de la même partie finiraient par diverger.
    const line = describeTurn(outcome);
    runner.log(line);
    say(line);
    renderJournal(runner);

    // CE QUE LA TABLE DOIT FAIRE, et l'attente qui va avec. La modale
    // suspend le tour : le dé reste sourd tant que « Valider » n'a pas été
    // pressé, ce qui est la seule façon pour « on reprend le tour » de
    // vouloir dire quelque chose.
    const landedTile = board[outcome.effect ? outcome.effect.to : outcome.to] ?? null;

    awaitingValidation = renderActions(logic, runner, outcome, landedTile, refresh, () => {
      awaitingValidation = false;
      refresh();
    });

    refresh();
  };

  /**
   * POSE les deux dés de la faveur sur le plateau, et attend le joueur.
   *
   * Elle ne les lance PAS. Quentin : « les 2 dés ne doivent pas se lancer
   * automatiquement, le joueur doit les lancer lui-même. » C'est `throwFavor`
   * qui les jette, quand le geste arrive.
   *
   * La main reste au joueur du temple pendant tout ce temps : c'est
   * `TurnRunner` qui la retient, et `resolveGodFavor` qui la rend.
   */
  let favorLinger: number | null = null;

  const offerFavorDice = (): void => {
    const pending = runner.getAwaitingGodFavor();
    if (!pending) return;

    // LA PAUSE CINÉMA PREND FIN ICI, même si ses deux secondes ne sont pas
    // écoulées. La faveur DIT au joueur d'attraper les dés (`say`) et cadre
    // le plateau entier : avec le HUD encore masqué, la consigne serait
    // invisible, et les deux cadrages se contrediraient. La face du tour a
    // déjà été lue — le pion a fini de marcher.
    endCinemaHold();

    // Le plateau porte DEUX cases « faveur des dieux » : deux tirages peuvent
    // s'enchaîner à moins de quatre secondes. Le minuteur du tirage précédent
    // effacerait alors les dés du nouveau en plein vol.
    if (favorLinger !== null) {
      window.clearTimeout(favorLinger);
      favorLinger = null;
    }

    // On DIT au joueur ce qu'on attend de lui. Deux dés qui apparaissent
    // sans consigne se regardent sans qu'on sache qu'il faut les jeter.
    say(`\u{26A1} ${runner.currentPlayerName()} — attrape les 2 dés et lance-les !`);

    // Le tirage se regarde : on cadre le plateau entier, sinon un dé peut
    // tomber hors du cadre suivi de sept cases.
    scene.showWholeBoard();

    // LE DÉ DU TOUR S'EFFACE le temps de la faveur : sinon il en reste trois
    // sur le plateau, et la somme annoncée n'est plus recomptable.
    showDice(duringFavor());

    // Et les deux dés sont POSÉS à leurs points de lancer. Sans cela leur
    // position n'est fixée que pendant l'animation : des dés jamais lancés
    // resteraient à l'origine du monde, hors du plateau et l'un dans
    // l'autre, sans rien à attraper.
    favorDice.rest();
  };

  /**
   * Lance les deux dés de la faveur, du geste du joueur.
   *
   * Quentin : « les 2 dés ne doivent PAS se lancer automatiquement, le joueur
   * doit les lancer lui-même ». C'est la même exigence que pour le dé du tour
   * (#49) : on ne joue pas à la place du joueur, et un lancer qu'on n'a pas
   * fait soi-même ne se conteste pas — dans un jeu à boire, ça compte.
   */
  const throwFavor = (request: ThrowRequest, from?: { x: number; z: number }): void => {
    favorDice.roll((a, b) => {
      const roll = runner.resolveGodFavor(a, b);

      const line = roll.favor
        ? `${roll.a} + ${roll.b} = ${roll.sum} — ${roll.favor.icon} ${roll.favor.name} : ${roll.favor.description}`
        : `${roll.a} + ${roll.b} = ${roll.sum}`;

      runner.log(line);
      say(line);
      renderJournal(runner);

      // Les dés restent posés le temps qu'on lise le résultat, puis rendent
      // la place au dé du tour : deux dés oubliés sur le plateau se
      // confondraient avec celui du tour suivant.
      favorLinger = window.setTimeout(() => {
        favorLinger = null;
        showDice(betweenFavors());
      }, FAVOR_DICE_LINGER_MS);

      refresh();
    }, request, from);
  };

  /** Lance le dé, si un lancer est attendu. */
  /**
   * Secouer le téléphone pour lancer (itération 2 d'EPIC-8).
   *
   * LE BOUTON RESTE, et ce n'est pas un pis-aller : il est le seul chemin sur
   * ordinateur, le seul quand les capteurs sont refusés, et celui du joueur
   * qui ne veut pas agiter son téléphone au-dessus de la table.
   *
   * L'écoute n'est branchée QUE dans le mode cinéma : c'est là que le geste a
   * un sens, le dé occupant l'écran. En mode plateau, on attrape le dé au
   * doigt (#49), et un téléphone qui bouge ne doit pas lancer à la place du
   * geste.
   */
  let lastShake: number | null = null;
  let listening = false;

  /**
   * Un capteur a-t-il déjà envoyé une lecture CHIFFRÉE ?
   *
   * C'est la seule preuve qu'il mesure vraiment. L'existence de
   * `DeviceMotionEvent` n'en est pas une : un navigateur de bureau l'expose
   * sans accéléromètre derrière.
   */
  let sensorsAnswered = false;

  /**
   * Combien de temps on laisse au capteur pour se manifester.
   *
   * Les capteurs qui fonctionnent émettent plusieurs fois par seconde : trois
   * secondes sont larges. Passé ce délai sans lecture chiffrée, on coupe
   * l'écoute et le bouton reste seul — sans que le joueur ait eu à répondre
   * à quoi que ce soit.
   */
  const SENSOR_PROBE_MS = 3000;

  const onMotion = (event: DeviceMotionEvent): void => {
    // LA PREUVE QUE LE CAPTEUR MESURE : une lecture chiffrée, et pas
    // seulement un événement qui arrive. Certains appareils émettent des
    // événements dont tous les axes sont nuls — c'est `motionIntensity` qui
    // fait la différence, en renvoyant `null` dans ce cas.
    if (!sensorsAnswered && motionIntensity(event as MotionReading) !== null) {
      sensorsAnswered = true;
      sayHowToRoll(true);
    }

    // Le mode a pu être coupé depuis l'abonnement : on n'agit pas en dehors.
    if (!cinema) return;

    const since = lastShake === null ? null : performance.now() - lastShake;

    if (!isShake(event as MotionReading, since)) return;

    // `roll` porte DÉJÀ tous les garde-fous — dé en vol, pion qui marche,
    // dés de la faveur en cours — et sait servir la faveur des dieux. On
    // l'appelle plutôt que de refaire ces tests ici, où ils divergeraient.
    lastShake = performance.now();
    roll();
  };

  /**
   * S'abonne aux capteurs, et CONSTATE s'ils répondent.
   *
   * Quentin (via PO, 20/09/2026) : « pas de demande de permission au joueur,
   * détecte automatiquement si les capteurs marchent. Zéro friction. »
   *
   * C'est possible sur la cible du projet. `requestPermission` est une
   * particularité d'iOS, et iOS est ABANDONNÉ depuis le 19/09/2026 : sur
   * Android, les capteurs de mouvement ne demandent jamais rien. La demande
   * de Quentin décrit donc le comportement réel de sa cible, et la retirer
   * ne coûte aucune fonctionnalité.
   *
   * LA DÉTECTION EST UNE OBSERVATION, pas une question posée à l'API.
   * `DeviceMotionEvent` peut exister sans que le capteur envoie quoi que ce
   * soit — un navigateur de bureau l'expose, un téléphone sans
   * accéléromètre aussi. On s'abonne donc, et on regarde si des lectures
   * CHIFFRÉES arrivent : c'est la seule preuve qui vaille.
   */
  const listenForShakes = (): void => {
    // HORS CONTEXTE SÉCURISÉ, inutile de s'abonner : Chrome laisse
    // l'abonnement réussir et n'envoie que des axes nuls. On l'annonce tout
    // de suite plutôt que d'attendre trois secondes pour rien.
    if (listening || !motionAvailable() || !motionContextAllowed()) {
      sayHowToRoll(false);
      return;
    }

    window.addEventListener('devicemotion', onMotion);
    listening = true;

    // On ne promet rien tant qu'aucune lecture n'est arrivée : annoncer le
    // geste sur un appareil muet enverrait le joueur secouer dans le vide.
    sayHowToRoll(false);

    // Si rien de chiffré n'arrive dans ce délai, l'appareil ne mesure pas —
    // et le bouton reste seul, sans que le joueur ait eu à répondre à quoi
    // que ce soit. Trois secondes : les capteurs émettent plusieurs fois par
    // seconde quand ils fonctionnent, c'est large.
    window.setTimeout(() => {
      if (!sensorsAnswered) stopListening();
    }, SENSOR_PROBE_MS);
  };

  /** Coupe l'écoute : l'appareil ne mesure rien d'exploitable. */
  const stopListening = (): void => {
    if (!listening) return;

    window.removeEventListener('devicemotion', onMotion);
    listening = false;
  };

  const roll = (): void => {
    if (frame !== null || walking || favorDice.rolling || awaitingValidation) return;

    // Le bouton sert aussi la faveur : c'est le repli de ceux qui ne font
    // pas le geste, et il ne doit pas laisser la partie bloquée.
    if (runner.getAwaitingGodFavor()) {
      throwFavor(swipeToThrow({ dx: 0, dy: -120, ms: 120, worldPerPixel: 1 }));
      return;
    }

    if (result) result.textContent = '…';
    physics.throw();

    frameTheRoll();

    frame = requestAnimationFrame(step);
  };

  /**
   * Lance le dé avec la vigueur du geste (#49).
   *
   * `throwWithVelocity` existe déjà dans `DicePhysics` et tire la force du
   * couple depuis la vitesse : on s'appuie dessus plutôt que d'écrire une
   * seconde physique. Le module partagé avec le rendu CSS n'est pas touché.
   */
  const throwFromGesture = (request: ThrowRequest, from?: { x: number; z: number }): void => {
    if (frame !== null || walking || favorDice.rolling || awaitingValidation) return;

    // LE GESTE VA AUX DÉS QUI ATTENDENT. Quand la faveur est en attente,
    // c'est la paire qu'on jette ; sinon c'est le dé du tour. Le joueur
    // attrape ce qu'il voit, sans avoir à choisir lequel.
    if (runner.getAwaitingGodFavor()) {
      throwFavor(request, from);
      return;
    }

    if (result) result.textContent = '…';

    // LE LANCER PART D'OÙ LE DÉ A ÉTÉ LÂCHÉ. Depuis qu'il suit le doigt, il
    // n'est plus au centre du tapis : relancer depuis le centre le ferait
    // sauter en arrière sous les yeux du joueur.
    physics = physicsAt(from);

    physics.throwWithVelocity(
      request.velocity,
      request.verticalVelocity,
      { x: 0, y: 0 }
    );

    // La caméra se pose MAINTENANT, une fois pour toute la course.
    frameTheRoll();

    frame = requestAnimationFrame(step);
  };

  // Le dé est POSÉ avant que la partie commence : sans cela il attend à
  // l'origine du monde, dans un coin, au lieu du milieu du tapis.
  restDie();

  document.getElementById('roll')?.addEventListener('click', roll);

  cinemaButton?.addEventListener('click', () => {
    // PENDANT UN LANCER, on ne bascule pas : le cadre est déjà posé et le
    // HUD déjà effacé. Changer d'avis en vol laisserait la vue à mi-chemin,
    // avec un HUD masqué qu'aucune fin de séquence ne viendrait rallumer.
    //
    // UNE MODALE EN ATTENTE NE BLOQUE PAS ce bouton : elle suspend le TOUR,
    // pas les réglages. Le joueur qui lit une règle peut très bien changer
    // de mode d'affichage en même temps.
    if (frame !== null || walking || favorDice.rolling) return;

    cinema = toggleCinemaMode();
    showCinemaState();

    // L'ABONNEMENT PART D'ICI, et non du chargement : la permission aux
    // capteurs ne peut être demandée que depuis un geste de l'utilisateur.
    // Ce clic en est un.
    if (cinema) listenForShakes();

    // Quitter le mode remet le HUD tout de suite, sans attendre un lancer.
    if (!cinema) endCinemaHold();
  });

  // ATTRAPER LE DÉ AU DOIGT plutôt que par un bouton. Le déclenchement se
  // fait PAR LE CONTEXTE, comme Quentin le préfère : le dé répond quand un
  // lancer est attendu, et reste sourd pendant qu'il roule. Sur un téléphone
  // posé sur la table et passé de main en main, c'est toujours le tour de
  // celui qui le tient — il n'y a donc pas d'autre condition à vérifier.
  return attachDiceGrab(
    () => (runner.getAwaitingGodFavor() ? favorDice.views : [die]),
    scene,
    () => frame === null && !walking && !favorDice.rolling && !awaitingValidation,
    throwFromGesture
  );
}

/**
 * Fait rebondir le dé sur les pions posés sur le plateau.
 *
 * Quentin : « il faut que les pions et cases aient leur boîte de collision ».
 *
 * Les pions NE BOUGENT PAS : leur position est celle d'un joueur sur le
 * parcours, c'est-à-dire une donnée de règle. Les pousser depuis le rendu
 * reviendrait à faire avancer un joueur parce qu'un dé l'a heurté.
 *
 * L'état de `DicePhysics` est mutable — c'est déjà ce dont le roulement se
 * sert — donc corriger position et vitesse suffit : le pas suivant repart de
 * la situation corrigée.
 */
function hitPawns(state: ReturnType<DicePhysics['update']>, tiles: BoardTiles3D): void {
  const obstacles = tiles.pawnObstacles();
  if (obstacles.length === 0) return;

  const body: MovingBody = {
    x: state.position.x,
    z: state.position.y,
    height: state.height,
    vx: state.velocity.x,
    vz: state.velocity.y,
    // La DEMI-DIAGONALE de la face, et non la demi-arête : un cube qui tourne
    // présente tantôt sa face, tantôt son coin.
    radius: (DIE_EDGE * Math.SQRT2) / 2,
  };

  let touched = false;
  for (const obstacle of obstacles) {
    if (collideWithFixed(body, obstacle)) touched = true;
  }

  if (!touched) return;

  state.position.x = body.x;
  state.position.y = body.z;
  state.velocity.x = body.vx;
  state.velocity.y = body.vz;
}

/**
 * Fait marcher le pion case par case jusqu'à son arrivée.
 *
 * Quentin : « pas de téléportation ». Le trajet suit le CHEMIN calculé par les
 * règles, rebond compris : un 5 depuis la case 20 fait monter le pion jusqu'au
 * bord puis redescendre, cinq pas en tout. Sauter directement à l'arrivée
 * montrerait le pion reculer d'une case alors que le dé annonce 5.
 *
 * Le pion est DÉPLACÉ, pas reconstruit : `setPawns` recrée chaque pion à sa
 * position finale, ce qui est la téléportation elle-même.
 */
function walkPawn(
  tiles: BoardTiles3D,
  runner: TurnRunner,
  outcome: { player: number; from: number; to: number; dice: number; returning: boolean;
    effect: { from: number; to: number } | null },
  done: () => void
): void {
  const last = runner.lastPosition();

  // Le trajet du dé, puis celui de la flèche s'il y en a une : deux
  // déplacements distincts que le joueur doit voir l'un après l'autre.
  const legs: { start: number; path: number[] }[] = [
    {
      start: outcome.from,
      path: walkPath({
        from: outcome.from,
        to: outcome.to,
        steps: outcome.dice,
        last,
        returning: outcome.returning,
      }),
    },
  ];

  if (outcome.effect) {
    legs.push({
      start: outcome.effect.from,
      path: walkPath({
        from: outcome.effect.from,
        to: outcome.effect.to,
        steps: Math.abs(outcome.effect.to - outcome.effect.from),
        last,
        returning: false,
      }),
    });
  }

  const pawn = tiles.pawnOf(outcome.player);
  if (!pawn) {
    done();
    return;
  }

  let leg = 0;
  let began = performance.now();

  const tick = (): void => {
    const current = legs[leg];

    if (!current) {
      done();
      return;
    }

    const frame = walkFrame(current.path, current.start, performance.now() - began);

    const from = tiles.pawnAnchor(frame.from);
    const to = tiles.pawnAnchor(frame.to);

    if (from && to) {
      pawn.position.set(
        from.x + (to.x - from.x) * frame.progress,
        // Un léger saut à chaque case : le pion se pose plutôt que de glisser,
        // ce qui rend les pas comptables à l'œil.
        BoardTiles3D.pawnRestHeight + Math.sin(frame.progress * Math.PI) * 14,
        from.z + (to.z - from.z) * frame.progress
      );
    }

    if (!frame.done) {
      requestAnimationFrame(tick);
      return;
    }

    leg += 1;
    began = performance.now();

    if (leg < legs.length) {
      requestAnimationFrame(tick);
      return;
    }

    done();
  };

  // Un trajet vide — une flèche bloquée au bord — ne doit pas faire attendre.
  if (legs.every(l => l.path.length === 0)) {
    done();
    return;
  }

  requestAnimationFrame(tick);
}

/**
 * Ramène la caméra du dé vers la vue du plateau, en douceur.
 *
 * La durée est courte — une demi-seconde — pour ne pas rallonger le tour de
 * façon sensible. Ce qu'on achète avec, c'est que le joueur garde le dé et
 * son résultat à l'œil pendant que la vue s'élargit.
 */
function easeBack(
  scene: BoardScene,
  fromX: number,
  fromZ: number,
  fromSpan: number,
  done: () => void
): void {
  const DURATION = 480;
  const start = performance.now();

  // La cible : ce que la vue montrera à l'arrivée.
  done();
  const target = scene.getFraming();
  const targetSpan = Math.max(target.rotated.width, target.rotated.depth);
  const centre = scene.getFocusCenter();

  const tick = (): void => {
    const t = Math.min(1, (performance.now() - start) / DURATION);
    // Amorti en fin de course : le mouvement s'arrête sans à-coup.
    const eased = 1 - Math.pow(1 - t, 3);

    if (t >= 1) {
      done();
      return;
    }

    scene.followPoint(
      fromX + (centre.x - fromX) * eased,
      fromZ + (centre.z - fromZ) * eased,
      fromSpan + (targetSpan - fromSpan) * eased
    );

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/**
 * Rend le dé attrapable au doigt ou à la souris.
 *
 * Le geste est distingué de la rotation de caméra par ce qu'il TOUCHE : un
 * appui sur le dé le lance, un appui ailleurs laisse la caméra tourner. La
 * rotation n'est donc pas désactivée, elle est seulement précédée.
 */
function attachDiceGrab(
  dice: () => Dice3DScene[],
  scene: BoardScene,
  canRoll: () => boolean,
  throwDice: (request: ThrowRequest, from?: { x: number; z: number }) => void
): (x: number, y: number) => boolean {
  const container = scene.viewport;
  const raycaster = new Raycaster();

  /**
   * Le doigt touche-t-il l'un des dés à lancer ?
   *
   * La faveur des dieux en pose DEUX : attraper l'un ou l'autre lance la
   * paire. Un joueur ne cherche pas lequel des deux est « le bon ».
   */
  const hitsDie = (clientX: number, clientY: number): boolean => {
    const box = container.getBoundingClientRect();

    // UNE ZONE DE PRISE PLUS LARGE QUE LE DÉ. Le dé mesure 37 px à l'écran en
    // vue d'ensemble, sous les 48 px de cible tactile : viser le cube lui-même
    // demande une précision qu'un doigt n'a pas, surtout sur un téléphone
    // passé de main en main.
    //
    // On teste donc le centre du doigt PUIS quelques points autour, à la
    // distance qui complète la cible. Le dé n'a pas besoin de grossir pour
    // être attrapable — c'est la zone sensible qui s'élargit, pas l'objet.
    return grabProbes(clientX, clientY).some(probe => {
      const pointer = new Vector2(
        ((probe.x - box.left) / Math.max(1, box.width)) * 2 - 1,
        -((probe.y - box.top) / Math.max(1, box.height)) * 2 + 1
      );

      raycaster.setFromCamera(pointer, scene.camera);

      return dice().some(die => raycaster.intersectObject(die.group, true).length > 0);
    });
  };

  /** Le retour visuel s'applique à tous les dés que le geste va lancer. */
  const setHeld = (held: boolean): void => {
    for (const die of dice()) die.setHeld(held);
  };

  let holding = false;
  let startX = 0;
  let startY = 0;
  let startedAt = 0;

  /**
   * FAIT SUIVRE LES DÉS AU DOIGT.
   *
   * C'était le défaut que Quentin décrivait : « quand je le prends il s'élève
   * très peu et je ne peux pas le déplacer ». Le code enregistrait l'appui et
   * le relâchement, mais RIEN ENTRE LES DEUX — il n'y avait aucun
   * `pointermove`. Le dé restait donc collé sur place, soulevé, jusqu'au
   * lâcher. Le retour visuel disait « je te tiens » et le dé démentait.
   *
   * La position est lue sur le plateau À LA HAUTEUR DU DÉ SOULEVÉ : au
   * niveau du sol, le dé dériverait sous le doigt, d'autant plus que la vue
   * est inclinée.
   */
  const follow = (clientX: number, clientY: number): void => {
    // DEUX VERROUS, et le second est celui qui manquait. `holding` dit que le
    // doigt tient le dé ; `canRoll()` dit qu'un lancer est encore attendu.
    //
    // Quentin : « il suit le curseur après l'avoir jeté ». Si le `pointerup`
    // n'arrive pas — souris sortie de la fenêtre, geste interrompu par le
    // système, `preventDefault` sur certaines WebViews — `holding` reste vrai
    // et le dé continue de coller au curseur PENDANT qu'il roule. Deux
    // autorités se disputaient alors sa position : la physique et le doigt.
    //
    // Dès que le dé est lancé, `canRoll()` devient faux : le dé cesse d'être
    // au doigt, quoi qu'ait fait le relâchement. « Qu'il vive tout seul. »
    if (!followsFinger(holding, canRoll())) return;

    const point = scene.screenToBoard(clientX, clientY, Dice3DScene.halfSize + GRAB_LIFT);
    if (!point) return;

    const held = dice();

    // Plusieurs dés suivent ENSEMBLE, en gardant leur écart : c'est une
    // poignée qu'on déplace, pas deux objets qu'on empile.
    const centre = held.reduce(
      (sum, die) => ({ x: sum.x + die.group.position.x, z: sum.z + die.group.position.z }),
      { x: 0, z: 0 }
    );
    const midX = centre.x / Math.max(1, held.length);
    const midZ = centre.z / Math.max(1, held.length);

    for (const die of held) {
      die.setPosition(
        die.group.position.x + (point.x - midX),
        die.group.position.y,
        die.group.position.z + (point.z - midZ)
      );
    }
  };

  const release = (clientX: number, clientY: number): void => {
    if (!holding) return;

    holding = false;
    setHeld(false);

    const request = swipeToThrow({
      dx: clientX - startX,
      dy: clientY - startY,
      ms: performance.now() - startedAt,
      // Combien d'unités monde vaut un pixel, ici et maintenant : sans
      // cette échelle, le même geste lancerait deux fois plus fort en vue
      // rapprochée qu'en vue d'ensemble.
      worldPerPixel: 1 / Math.max(0.0001, scene.worldToScreenPixels(1)),
    });

    // Un simple appui n'est pas un lancer : le joueur a hésité, on repose le
    // dé sans rien déclencher.
    //
    // LE LANCER PART D'OÙ LE DÉ A ÉTÉ LÂCHÉ, et non du centre du tapis :
    // depuis qu'il suit le doigt, il n'est plus là où la physique le croit.
    // Le faire partir du centre le ferait SAUTER en arrière au moment du jet.
    if (request.thrown) {
      const first = dice()[0];

      throwDice(
        request,
        first ? { x: first.group.position.x, z: first.group.position.z } : undefined
      );
    }
  };

  /**
   * Coupe la prise, sans rien lancer.
   *
   * Filet pour les cas où le relâchement n'arrive jamais : la souris quitte
   * la fenêtre, l'onglet passe en arrière-plan, le système interrompt le
   * geste. Sans lui, `holding` reste vrai indéfiniment et le dé colle au
   * curseur pour le reste de la partie.
   */
  const letGo = (): void => {
    if (!holding) return;

    holding = false;
    setHeld(false);
  };

  container.addEventListener(
    'pointerdown',
    event => {
      if (!canRoll() || !hitsDie(event.clientX, event.clientY)) return;

      // Le dé passe AVANT la caméra : tant qu'on le tient, la vue ne tourne
      // pas. C'est l'exigence « le plateau ne bouge pas pendant la prise ».
      event.stopPropagation();
      event.preventDefault();

      holding = true;
      startX = event.clientX;
      startY = event.clientY;
      startedAt = performance.now();

      // Le retour visuel : on VOIT qu'on tient le dé.
      setHeld(true);
    },
    true
  );

  // Le relâchement est écouté sur la fenêtre : un doigt qui quitte le canvas
  // en cours de geste doit quand même lancer, sinon le dé reste en main.
  // LE DÉ SUIT LE DOIGT. Écouté sur la fenêtre, comme le relâchement : un
  // doigt qui sort du canevas en cours de geste doit continuer d'entraîner le
  // dé, sinon celui-ci se fige au bord.
  window.addEventListener('pointermove', event => follow(event.clientX, event.clientY));

  window.addEventListener('pointerup', event => release(event.clientX, event.clientY));
  window.addEventListener('pointercancel', letGo);

  // Le curseur qui SORT de la fenêtre sans relâcher : sans cela le dé reste
  // en main et suit le pointeur au retour.
  window.addEventListener('pointerleave', letGo);
  window.addEventListener('blur', letGo);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) letGo();
  });

  // Rendu à la caméra pour qu'elle se taise quand le geste appartient au dé.
  // Un SEUL juge de « le doigt est-il sur un dé », partagé : deux réponses
  // différentes à la même question rouvriraient le défaut.
  return (x, y) => canRoll() && hitsDie(x, y);
}


/*
 * L'INVITE À TOURNER LE TÉLÉPHONE A ÉTÉ RETIRÉE le 20/09/2026, à la demande
 * de Quentin : « il faudrait enlever l'avertissement sur portable pour
 * tourner ou non le téléphone ».
 *
 * Elle conseillait le paysage, où le plateau entier se lit. Deux raisons de
 * ne plus la montrer :
 *
 *   - le portrait est désormais tenable : la vue suivie le cadre, et le HUD
 *     se replie sur écran bas (#71), ce qui n'était pas le cas quand le
 *     conseil a été écrit ;
 *   - un conseil qu'on ne peut pas suivre — on joue le téléphone posé sur la
 *     table, passé de main en main — se transforme en reproche.
 *
 * Le cadrage, lui, continue de s'adapter à l'orientation : c'est la mesure
 * qui décide de la vue, pas un message.
 */

/**
 * Affiche les derniers événements de la partie.
 *
 * La source est l'historique de `GameLogic` — celui que le jeu tient depuis
 * toujours — et non une liste tenue par la scène.
 */
function renderJournal(runner: TurnRunner): void {
  const list = document.getElementById('journal');
  if (!list) return;

  list.replaceChildren(
    ...runner.history().slice(-JOURNAL_MAX).reverse().map(entry => {
      const line = document.createElement('li');
      line.textContent = entry;
      return line;
    })
  );
}

/**
 * Énonce ce que la table doit faire, et SUSPEND le tour le temps qu'elle le
 * fasse.
 *
 * LE DÉFAUT QUE CELA CORRIGE : le panneau énonçait bien « Alice distribue
 * 3 🍺 », mais rien n'attendait. Le joueur suivant pouvait relancer aussitôt
 * et l'énoncé disparaissait sous le tour d'après — bu ou pas bu.
 *
 * La scène ÉNONCE, elle n'arbitre pas : c'est la ligne tranchée par Quentin
 * le 19/09/2026. « Valider » ne désigne personne et n'applique aucune règle,
 * il rend la main.
 *
 * Renvoie `true` quand la modale attend une validation — le lancer doit
 * rester sourd jusque-là.
 */
function renderActions(
  logic: GameLogic,
  runner: TurnRunner,
  outcome: ReturnType<TurnRunner['playTurn']>,
  tile: TileConfig | null,
  refresh: () => void,
  onValidated: () => void
): boolean {
  // LE BOUCLIER D'ATHÉNA, soldé sans demander de cible. Les règles RETIENNENT
  // les gorgées tant que personne n'est désigné : cesser de poser la question
  // sans les solder les ferait s'évaporer. Elles retombent sur le porteur.
  const settled = runner.settlePendingShield();
  const shield = settled
    ? {
        playerName: logic.getPlayers()[settled.player]?.name ?? '',
        amount: settled.amount,
      }
    : null;

  const content = modalContent(outcome, tile, shield);

  // UN TOUR ORDINAIRE NE S'INTERROMPT PAS. Ouvrir une modale à chaque tour
  // la ferait fermer sans la lire, y compris les tours qui comptent.
  if (!content) return false;

  // Le panneau du HUD garde la trace de ce qui a été énoncé, une fois la
  // modale refermée : le joueur qui a validé trop vite peut le relire.
  const panel = document.getElementById('actions-panel');
  if (panel) {
    panel.hidden = false;
    panel.replaceChildren(
      ...content.lines.map(text => {
        const line = document.createElement('div');
        line.className = 'action-prompt';
        line.textContent = text;
        return line;
      })
    );
  }

  for (const line of content.lines) runner.log(line);
  renderJournal(runner);
  refresh();

  showActionModal(content, onValidated);

  return true;
}

/** Raconte le dernier tour joué. */
function say(message: string): void {
  const line = document.getElementById('turn-log');
  if (line) line.textContent = message;
}

/**
 * Met le bouton de vue au bon libellé.
 *
 * Un bouton qui dit « Tout le plateau » alors qu'on voit déjà tout le plateau
 * ne dit pas ce qu'il fait. Il annonce donc la vue vers laquelle il bascule.
 */
function labelViewButton(scene: BoardScene): void {
  const button = document.getElementById('whole');
  if (!button) return;

  button.textContent = scene.isFollowing() ? 'Tout le plateau' : 'Suivre le pion';
}

/** Annonce à qui est le tour. */
function announce(runner: TurnRunner): void {
  const line = document.getElementById('whose-turn');
  if (line) line.textContent = `Au tour de ${runner.currentPlayerName()}`;
}

/**
 * Tourner et déplacer, à la souris comme au doigt.
 *
 * Les deux voies sont SÉPARÉES à dessein. Le tactile n'a pas encore été
 * vérifié sur un vrai téléphone : réparer la souris ne doit pas risquer de
 * casser un geste tactile qu'on n'a pas pu tester.
 *
 * À la souris, le déplacement passait par Maj+glisser — que personne ne
 * devine — et par « deux doigts », qui sur un trackpad Mac est déjà le geste
 * de défilement du système et n'arrive donc jamais à la page. D'où le retour
 * de Quentin : « je n'arrive pas à bien me déplacer avec le PC. » Le clic
 * DROIT prend le relais : c'est la convention des outils 3D, et il ne
 * demande aucune touche.
 */
function attachControls(
  container: HTMLElement,
  scene: BoardScene,
  onChange: () => void,
  /**
   * Le geste commence-t-il SUR un dé ?
   *
   * LE DÉFAUT QUE CELA CORRIGE : le dé écoute `pointerdown`, la caméra
   * écoute `touchstart`. Ce sont deux familles d'événements distinctes, et
   * `stopPropagation` sur l'une n'empêche pas l'autre. Sur téléphone, poser
   * le doigt sur le dé démarrait donc les DEUX gestes à la fois : on tenait
   * le dé pendant que la caméra tournait sous lui, et le dé ne partait pas.
   *
   * `touchstart` est de surcroît passif — il ne peut pas être annulé. La
   * seule issue est que la caméra SE TAISE d'elle-même quand le geste
   * appartient au dé.
   */
  startsOnDice: (x: number, y: number) => boolean = () => false
): void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pinch = 0;

  const start = (x: number, y: number) => {
    // Le dé passe AVANT la caméra : un geste qui commence sur lui lui
    // appartient entièrement.
    if (gestureOwner(startsOnDice(x, y)) === 'dice') return;

    dragging = true;
    lastX = x;
    lastY = y;
  };

  const move = (x: number, y: number, pan: boolean) => {
    if (!dragging) return;
    if (pan) scene.panBy(x - lastX, y - lastY);
    // Le lacet suit le doigt ; l'élévation est inversée pour que tirer vers
    // le bas rapproche la vue de l'horizon, comme on incline un objet réel.
    else scene.orbitByPixels(x - lastX, -(y - lastY));
    lastX = x;
    lastY = y;
    onChange();
  };

  // Le bouton enfoncé décide du geste, et il est retenu au début plutôt que
  // relu à chaque déplacement : sur certaines souris `buttons` se vide en
  // cours de glissement, et le geste changerait de nature en plein mouvement.
  let panning = false;

  container.addEventListener('mousedown', e => {
    if (gestureOwner(startsOnDice(e.clientX, e.clientY)) === 'dice') return;

    // LE CLIC SIMPLE DÉPLACE. Quentin : « sur souris, clic simple + glisser ».
    // C'était l'inverse — le clic gauche faisait TOURNER la vue — ce qui
    // désaccordait la souris du tactile, où un doigt déplace depuis #73.
    // Le geste le plus courant doit faire la même chose sur les deux, sinon
    // on apprend le jeu deux fois.
    //
    // La ROTATION reste accessible, au clic droit ou molette, et à `Shift` :
    // elle n'est pas perdue, elle cesse d'être le geste par défaut.
    panning = mouseGesture(e.button, e.shiftKey) === 'pan';
    start(e.clientX, e.clientY);
  });

  // Sans cela, le clic droit ouvre le menu contextuel au lieu de déplacer.
  container.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('mousemove', e => move(e.clientX, e.clientY, panning));
  window.addEventListener('mouseup', () => {
    dragging = false;
    panning = false;
  });

  /**
   * L'angle entre les deux doigts, pour la rotation à deux doigts.
   *
   * Conservé d'une image à l'autre : c'est sa VARIATION qui fait tourner la
   * vue, pas sa valeur.
   */
  let twist = 0;

  /**
   * Où étaient les deux doigts à l'image précédente.
   *
   * L'inclinaison se lit sur leur glissement COMMUN : il faut donc comparer
   * chaque doigt à lui-même, et non au centre des deux, qui bouge aussi quand
   * ils pivotent.
   */
  let twoFingers = { first: { y: 0 }, second: { y: 0 } };

  container.addEventListener(
    'touchstart',
    e => {
      if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) {
        pinch = distance(e.touches);
        twist = angleBetween(e.touches);
        twoFingers = {
          first: { y: e.touches[0].clientY },
          second: { y: e.touches[1].clientY },
        };
        start(center(e.touches).x, center(e.touches).y);
      }
    },
    { passive: true }
  );

  container.addEventListener(
    'touchmove',
    e => {
      // UN DOIGT DÉPLACE, comme sur une carte. Quentin : « il ne faudrait
      // pas inverser les contrôles pour le téléphone comme sur Google Maps ? »
      //
      // C'était l'inverse : un doigt faisait TOURNER la vue, ce qui est le
      // geste le plus fréquent appliqué à l'action la plus déroutante. Sur un
      // plateau vu en plongée, un doigt qui glisse doit déplacer ce qu'on
      // regarde — c'est ce que fait toute carte, et ce que la main attend.
      if (e.touches.length === 1) {
        move(e.touches[0].clientX, e.touches[0].clientY, true);
        return;
      }

      // DEUX DOIGTS : pincer pour zoomer, pivoter pour TOURNER, glisser
      // ensemble pour INCLINER. Les trois se font naturellement en même temps
      // et se lisent séparément — les séparer obligerait à lever un doigt au
      // milieu du geste.
      //
      // C'est le jeu de gestes d'une carte en 3D. Quentin : « on est en 3D,
      // il faudrait l'adapter ». Ma première version avait mis « deux doigts
      // glissent → déplace », ce qui DOUBLAIT le geste à un doigt et laissait
      // l'inclinaison sans aucun geste — alors que c'est précisément le
      // réglage qu'il cherchait en disant « il faut bien trouver le bon
      // angle ».
      if (e.touches.length === 2 && pinch > 0) {
        const next = distance(e.touches);
        scene.setUserZoom(scene.getUserZoom() * (next / pinch));
        pinch = next;

        // La rotation suit l'angle des doigts, au degré près : le plateau
        // tourne EXACTEMENT comme la main, sans facteur d'amplification qui
        // donnerait l'impression de patiner.
        const turned = angleBetween(e.touches);

        // L'INCLINAISON suit le glissement COMMUN des deux doigts. Deux
        // doigts qui pivotent ont une moyenne de déplacement nulle — l'un
        // monte, l'autre descend — donc les deux gestes ne se confondent pas.
        //
        // Le sens est celui de Maps : tirer vers le HAUT couche la vue vers
        // l'horizon, tirer vers le BAS la ramène au-dessus du plateau.
        const drift = commonDrift(
          { y: e.touches[0].clientY },
          { y: e.touches[1].clientY },
          twoFingers
        );

        scene.orbitBy(shortestTurn(turned - twist), -drift * TILT_PER_PIXEL);

        twist = turned;
        twoFingers = {
          first: { y: e.touches[0].clientY },
          second: { y: e.touches[1].clientY },
        };

        onChange();
      }
    },
    { passive: true }
  );

  container.addEventListener('touchend', () => {
    dragging = false;
    pinch = 0;
  });

  container.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      scene.setUserZoom(scene.getUserZoom() * (e.deltaY > 0 ? 0.92 : 1.08));
      onChange();
    },
    { passive: false }
  );

  document.getElementById('reset')?.addEventListener('click', () => {
    scene.resetView();
    onChange();
  });
}

/** Milieu d'un geste à deux doigts. */
function center(touches: TouchList): { x: number; y: number } {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function distance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/**
 * L'angle de la droite qui joint les deux doigts, en degrés.
 *
 * C'est sa VARIATION qui fait tourner la vue : deux doigts qu'on pivote
 * font pivoter le plateau du même angle, comme sur une carte. La valeur
 * absolue ne veut rien dire — elle dépend de la façon dont on a posé la
 * main.
 */
function angleBetween(touches: TouchList): number {
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;

  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

void main();
