import { BoardScene } from './board-scene';
import { buildJourneyProgress } from './journey-progress';
import {
  readInsetOverrides,
  applySimulatedSafeArea,
  describeInsets,
  type InsetOverrides,
} from './debug-insets';
import { BoardTiles3D } from './board-tiles-3d';
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

  // Quelques pions pour juger s'ils se lisent bien posés sur leurs cases.
  tiles.setPawns([
    { position: 0, color: '#e2483d' },
    { position: 4, color: '#3d7fc4' },
    { position: 4, color: '#2f8f4e' },
    { position: 11, color: '#e3c169' },
  ]);

  scene.setBoardExtent(positions, layout.tileSize);

  // La vue suit le pion : c'est l'arbitrage de Quentin pour la lisibilité
  // (#45). Une case fait alors 54 px sur un 5 pouces, contre 40 en montrant
  // tout le parcours — au-dessus des 48 px de la cible tactile.
  let followed = 0;
  scene.followTile(followed);

  scene.start();

  const refresh = () => {
    report(status, scene, positions.length);
    renderProgress(followed, positions.length);
  };

  attachFollowControls(
    () => positions.length,
    next => {
      followed = next;
      scene.followTile(followed);
      refresh();
    },
    () => {
      scene.showWholeBoard();
      refresh();
    }
  );

  refresh();

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

/** Avancer, reculer, et voir tout le plateau. */
function attachFollowControls(
  total: () => number,
  goTo: (index: number) => void,
  whole: () => void
): void {
  let current = 0;

  const step = (delta: number) => {
    current = Math.max(0, Math.min(current + delta, total() - 1));
    goTo(current);
  };

  document.getElementById('prev')?.addEventListener('click', () => step(-1));
  document.getElementById('next')?.addEventListener('click', () => step(1));
  document.getElementById('whole')?.addEventListener('click', () => whole());

  // Les flèches du clavier : commode pour parcourir vite en aperçu.
  window.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') step(1);
    else if (event.key === 'ArrowLeft') step(-1);
  });
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
