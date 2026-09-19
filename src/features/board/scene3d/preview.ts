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
import { walkPath } from './pawn-path';
import { walkFrame } from './pawn-walk';
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
  attachDice(die, positions, tiles, runner, scene, applyPreferredView, refresh);

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
  runner: TurnRunner,
  scene: BoardScene,
  follow: () => void,
  refresh: () => void
): void {
  // L'aire de jeu épouse le PLATEAU, et non un carré inventé : le dé roule
  // sur les cases et rebondit sur leurs bords. « Pas de je jette le dé dans
  // le vide. » Les quatre côtés sont bordés, donc le dé ne peut pas tomber.
  const arena = diceArena(positions, 120);
  const physics = new DicePhysics(
    WORLD_DICE_CONFIG,
    { x: (arena.minX + arena.maxX) / 2, y: (arena.minZ + arena.maxZ) / 2 },
    { width: arena.maxX - arena.minX, height: arena.maxZ - arena.minZ }
  );
  physics.setTableBounds(
    { minX: arena.minX, maxX: arena.maxX, minY: arena.minZ, maxY: arena.maxZ },
    { top: true, right: true, bottom: true, left: true }
  );

  const result = document.getElementById('dice-value');

  let frame: number | null = null;

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

    // LE PION MARCHE, il ne se téléporte pas (#48). `setPawns` reconstruit
    // chaque pion à sa position finale : c'est exactement la téléportation
    // que Quentin ne veut plus. On anime le trajet, puis on repose les pions
    // proprement à l'arrivée.
    walkPawn(tiles, runner, outcome, () => {
      tiles.setPawns(runner.pawns());
      refresh();
    });

    // Retour SOUPLE à la vue du plateau : un saut de caméra à l'instant où
    // le dé s'immobilise ferait perdre le résultat de vue.
    easeBack(scene, camX, camZ, ROLL_SPAN, follow);

    const parts = [`${outcome.playerName} fait ${outcome.dice} : ${outcome.from} → ${outcome.to}`];
    if (outcome.effect) parts.push(`flèche → ${outcome.effect.to}`);
    if (outcome.schmittPower) parts.push('\u{26A1} pouvoir du Schmitt, demi-tour !');
    if (outcome.returning) parts.push('(retour)');
    if (outcome.winner) parts.push(`\u{1F3C6} ${outcome.winner} gagne !`);

    say(parts.join(' · '));

    refresh();
  };

  /** Lance le dé, si un lancer est attendu. */
  const roll = (): void => {
    if (frame !== null) return;

    if (result) result.textContent = '…';
    physics.throw();
    frame = requestAnimationFrame(step);
  };

  document.getElementById('roll')?.addEventListener('click', roll);

  // ATTRAPER LE DÉ AU DOIGT plutôt que par un bouton. Le déclenchement se
  // fait PAR LE CONTEXTE, comme Quentin le préfère : le dé répond quand un
  // lancer est attendu, et reste sourd pendant qu'il roule. Sur un téléphone
  // posé sur la table et passé de main en main, c'est toujours le tour de
  // celui qui le tient — il n'y a donc pas d'autre condition à vérifier.
  attachDiceGrab(die, scene, () => frame === null, roll);
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
  die: Dice3DScene,
  scene: BoardScene,
  canRoll: () => boolean,
  roll: () => void
): void {
  const container = scene.viewport;
  const raycaster = new Raycaster();

  /** Le doigt touche-t-il le dé ? */
  const hitsDie = (clientX: number, clientY: number): boolean => {
    const box = container.getBoundingClientRect();
    const pointer = new Vector2(
      ((clientX - box.left) / Math.max(1, box.width)) * 2 - 1,
      -((clientY - box.top) / Math.max(1, box.height)) * 2 + 1
    );

    raycaster.setFromCamera(pointer, scene.camera);

    return raycaster.intersectObject(die.group, true).length > 0;
  };

  const tryGrab = (clientX: number, clientY: number): boolean => {
    if (!canRoll()) return false;
    if (!hitsDie(clientX, clientY)) return false;

    roll();
    return true;
  };

  container.addEventListener('pointerdown', event => {
    // Le dé passe AVANT la caméra : s'il est touché, le geste lui revient et
    // la vue ne doit pas tourner en même temps.
    if (tryGrab(event.clientX, event.clientY)) {
      event.stopPropagation();
      event.preventDefault();
    }
  }, true);
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
