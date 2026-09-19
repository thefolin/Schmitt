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
import { WORLD_DICE_CONFIG, rollingSpinRate } from './dice-world-config';
import { diceArena } from './dice-arena';
import { FavorDice } from './favor-dice';
import { duringFavor, betweenFavors, type DiceVisibility } from './dice-on-stage';
import { walkPath } from './pawn-path';
import { walkFrame } from './pawn-walk';
import { swipeToThrow, type ThrowRequest } from './dice-gesture';
import { describeTurn, JOURNAL_MAX } from './turn-journal';
import { tableAnnouncement } from './table-announcements';
import { isHandheld, readDeviceOverride, type DeviceHints } from './device';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from './turn-runner';
import { loadTileConfigs, TILE_CONFIGS } from '@/features/tiles/tile.config';
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
  logic.startGame([
    { name: 'Alice', color: '#e2483d' },
    { name: 'Bastien', color: '#3d7fc4' },
    { name: 'Chloé', color: '#2f8f4e' },
  ]);

  const runner = new TurnRunner(logic);

  // Les cases telles qu'elles sont POSÉES sur le parcours, et non le
  // catalogue : sur un plateau composé dans l'éditeur, la case du rang N
  // n'est pas la case N du catalogue. C'est le correctif #30.
  runner.setBoard(layout.placements.map(placement => catalog[placement.tileId]));

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
  showRotateHint(scene, device);

  scene.start();

  const refresh = () => {
    report(status, scene, positions.length);
    renderProgress(runner.tileToFollow(), positions.length);
    announce(runner);
    labelViewButton(scene);
  };

  // Le tour complet : lancer → avancer → joueur suivant (#46).
  attachDice(die, positions, tiles, logic, runner, scene, applyPreferredView, refresh);

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
  attachControls(container, scene, refresh);

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
    showRotateHint(scene, device);
    refresh();
  };

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
  scene: BoardScene,
  follow: () => void,
  refresh: () => void
): void {
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
  const centredPhysics = (): DicePhysics => {
    const fresh = new DicePhysics(
      WORLD_DICE_CONFIG,
      { x: (arena.minX + arena.maxX) / 2, y: (arena.minZ + arena.maxZ) / 2 },
      { width: arena.maxX - arena.minX, height: arena.maxZ - arena.minZ }
    );

    fresh.setTableBounds(
      { minX: arena.minX, maxX: arena.maxX, minY: arena.minZ, maxY: arena.maxZ },
      { top: true, right: true, bottom: true, left: true }
    );

    return fresh;
  };

  let physics = centredPhysics();

  const result = document.getElementById('dice-value');

  // LES DEUX DÉS DU TEMPLE. Objet distinct du dé du tour : celui-ci garde sa
  // physique et sa chaîne « la face vue est celle dont on avance ». Ils
  // restent invisibles tant que personne ne se pose sur le temple.
  const favorDice = new FavorDice(arena);
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
    physics = centredPhysics();

    die.setPosition(matCentre.x, Dice3DScene.halfSize, matCentre.z);
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
  const ROLL_SPAN = 7 * 120;

  /**
   * Temps pendant lequel les deux dés du temple restent posés.
   *
   * Assez pour lire les deux faces et vérifier la somme annoncée — c'est un
   * jeu à boire, on recompte. Au-delà, deux dés oubliés se confondraient avec
   * le dé du tour suivant.
   */
  const FAVOR_DICE_LINGER_MS = 4000;
  let camX = (arena.minX + arena.maxX) / 2;
  let camZ = (arena.minZ + arena.maxZ) / 2;

  const step = (): void => {
    const state = physics.update(16);

    applyRolling(state);

    camX += (state.position.x - camX) * 0.08;
    camZ += (state.position.y - camZ) * 0.08;
    scene.followPoint(camX, camZ, ROLL_SPAN);
    die.setOrientation(state.orientation);
    // Les coordonnées de la physique SONT celles du monde : l'aire épouse le
    // plateau, il n'y a plus de repère intermédiaire à convertir.
    die.setPosition(
      state.position.x,
      Dice3DScene.halfSize + Math.max(0, state.height),
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
    easeBack(scene, camX, camZ, ROLL_SPAN, follow);

    // Le tour est raconté par `describeTurn`, et consigné dans l'historique
    // que GameLogic tient déjà. On ne tient pas un second journal à côté :
    // deux récits de la même partie finiraient par diverger.
    const line = describeTurn(outcome);
    runner.log(line);
    say(line);
    renderJournal(runner);

    // Les décisions que la règle attend du joueur : sans elles, la partie
    // reste bloquée sans que rien ne l'explique.
    renderActions(logic, runner, outcome, refresh);

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
  const throwFavor = (request: ThrowRequest): void => {
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
    }, request);
  };

  /** Lance le dé, si un lancer est attendu. */
  const roll = (): void => {
    if (frame !== null || walking || favorDice.rolling) return;

    // Le bouton sert aussi la faveur : c'est le repli de ceux qui ne font
    // pas le geste, et il ne doit pas laisser la partie bloquée.
    if (runner.getAwaitingGodFavor()) {
      throwFavor(swipeToThrow({ dx: 0, dy: -120, ms: 120, worldPerPixel: 1 }));
      return;
    }

    if (result) result.textContent = '…';
    physics.throw();
    frame = requestAnimationFrame(step);
  };

  /**
   * Lance le dé avec la vigueur du geste (#49).
   *
   * `throwWithVelocity` existe déjà dans `DicePhysics` et tire la force du
   * couple depuis la vitesse : on s'appuie dessus plutôt que d'écrire une
   * seconde physique. Le module partagé avec le rendu CSS n'est pas touché.
   */
  const throwFromGesture = (request: ThrowRequest): void => {
    if (frame !== null || walking || favorDice.rolling) return;

    // LE GESTE VA AUX DÉS QUI ATTENDENT. Quand la faveur est en attente,
    // c'est la paire qu'on jette ; sinon c'est le dé du tour. Le joueur
    // attrape ce qu'il voit, sans avoir à choisir lequel.
    if (runner.getAwaitingGodFavor()) {
      throwFavor(request);
      return;
    }

    if (result) result.textContent = '…';
    physics.throwWithVelocity(
      request.velocity,
      request.verticalVelocity,
      { x: 0, y: 0 }
    );
    frame = requestAnimationFrame(step);
  };

  // Le dé est POSÉ avant que la partie commence : sans cela il attend à
  // l'origine du monde, dans un coin, au lieu du milieu du tapis.
  restDie();

  document.getElementById('roll')?.addEventListener('click', roll);

  // ATTRAPER LE DÉ AU DOIGT plutôt que par un bouton. Le déclenchement se
  // fait PAR LE CONTEXTE, comme Quentin le préfère : le dé répond quand un
  // lancer est attendu, et reste sourd pendant qu'il roule. Sur un téléphone
  // posé sur la table et passé de main en main, c'est toujours le tour de
  // celui qui le tient — il n'y a donc pas d'autre condition à vérifier.
  attachDiceGrab(
    () => (runner.getAwaitingGodFavor() ? favorDice.views : [die]),
    scene,
    () => frame === null && !walking && !favorDice.rolling,
    throwFromGesture
  );
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
  throwDice: (request: ThrowRequest) => void
): void {
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
    const pointer = new Vector2(
      ((clientX - box.left) / Math.max(1, box.width)) * 2 - 1,
      -((clientY - box.top) / Math.max(1, box.height)) * 2 + 1
    );

    raycaster.setFromCamera(pointer, scene.camera);

    return dice().some(die => raycaster.intersectObject(die.group, true).length > 0);
  };

  /** Le retour visuel s'applique à tous les dés que le geste va lancer. */
  const setHeld = (held: boolean): void => {
    for (const die of dice()) die.setHeld(held);
  };

  let holding = false;
  let startX = 0;
  let startY = 0;
  let startedAt = 0;

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
    if (request.thrown) throwDice(request);
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
  window.addEventListener('pointerup', event => release(event.clientX, event.clientY));
  window.addEventListener('pointercancel', () => {
    if (!holding) return;
    holding = false;
    setHeld(false);
  });
}


/**
 * Invite à tourner le téléphone en portrait.
 *
 * Quentin a choisi de ne PAS verrouiller l'orientation : le jeu reste
 * réactif, et on le dit au joueur plutôt que de lui imposer. Ça laisse la
 * porte ouverte à un verrouillage plus tard, si l'usage montre qu'il le faut.
 *
 * Le cadrage portrait continue donc de fonctionner derrière le message — ce
 * n'est pas un écran de blocage, c'est un conseil.
 */
function showRotateHint(scene: BoardScene, device: DeviceHints): void {
  const hint = document.getElementById('rotate-hint');
  if (!hint) return;

  // Le conseil ne vaut QUE là où l'écran peut tourner. Sur un poste fixe dont
  // la fenêtre est plus haute que large, « tourne ton téléphone » est faux —
  // personne ne tournera son moniteur — et un conseil faux use la confiance
  // plus qu'il n'aide.
  hint.hidden = scene.prefersWholeBoard() || !isHandheld(device);
}

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
 * Affiche les décisions en attente et les rend cliquables.
 *
 * La scène POSE la question ; c'est `GameLogic` qui applique le choix. Elle
 * ne tranche rien elle-même.
 */
function renderActions(
  logic: GameLogic,
  runner: TurnRunner,
  outcome: ReturnType<TurnRunner['playTurn']>,
  refresh: () => void
): void {
  const panel = document.getElementById('actions-panel');
  if (!panel) return;

  const lines: string[] = [];

  // LE BOUCLIER D'ATHÉNA, soldé sans demander de cible. Les règles RETIENNENT
  // les gorgées tant que personne n'est désigné : cesser de poser la question
  // sans les solder les ferait s'évaporer. Elles retombent sur le porteur.
  const shield = runner.settlePendingShield();
  if (shield) {
    const holder = logic.getPlayers()[shield.player];
    lines.push(
      `\u{1F6E1}\u{FE0F} ${holder?.name ?? ''} garde son bouclier et boit ${shield.amount} \u{1F37A}`
    );
  }

  // CE QUI SE JOUE À LA TABLE : on l'énonce, les joueurs l'appliquent.
  const announcement = tableAnnouncement(outcome);
  if (announcement) lines.push(announcement.text);

  if (lines.length === 0) {
    panel.hidden = true;
    panel.replaceChildren();
    return;
  }

  panel.hidden = false;
  panel.replaceChildren(
    ...lines.map(text => {
      const line = document.createElement('div');
      line.className = 'action-prompt';
      line.textContent = text;
      return line;
    })
  );

  for (const line of lines) runner.log(line);
  renderJournal(runner);
  refresh();
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
  onChange: () => void
): void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pinch = 0;

  const start = (x: number, y: number) => {
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
    panning = e.button === 2 || e.button === 1 || e.shiftKey;
    start(e.clientX, e.clientY);
  });

  // Sans cela, le clic droit ouvre le menu contextuel au lieu de déplacer.
  container.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('mousemove', e => move(e.clientX, e.clientY, panning));
  window.addEventListener('mouseup', () => {
    dragging = false;
    panning = false;
  });

  container.addEventListener(
    'touchstart',
    e => {
      if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) {
        pinch = distance(e.touches);
        start(center(e.touches).x, center(e.touches).y);
      }
    },
    { passive: true }
  );

  container.addEventListener(
    'touchmove',
    e => {
      // Un doigt tourne.
      if (e.touches.length === 1) {
        move(e.touches[0].clientX, e.touches[0].clientY, false);
        return;
      }

      // Deux doigts pincent pour zoomer ET glissent pour déplacer : les deux
      // gestes se font naturellement en même temps, les séparer obligerait à
      // lever un doigt au milieu.
      if (e.touches.length === 2 && pinch > 0) {
        const next = distance(e.touches);
        scene.setUserZoom(scene.getUserZoom() * (next / pinch));
        pinch = next;
        const mid = center(e.touches);
        move(mid.x, mid.y, true);
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

void main();
