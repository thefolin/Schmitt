import { BoardScene } from './board-scene';
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

  const scene = new BoardScene({
    container,
    // Le bandeau d'information occupe le haut de l'écran : le plateau se
    // cadre dans ce qui reste.
    hudInsets: { top: 64, bottom: 0 },
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
  scene.start();

  report(status, scene, positions.length);

  // Déplacement et zoom manuels : l'acquis #15 qu'on ne doit pas perdre.
  attachControls(container, scene, () => report(status, scene, positions.length));

  window.addEventListener('resize', () => report(status, scene, positions.length));
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

  status.textContent = `${count} cases · ${turned} · une case ≈ ${tilePx} px`;
}

/** Glisser pour déplacer, pincer ou molette pour zoomer. */
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

  const move = (x: number, y: number) => {
    if (!dragging) return;
    scene.panBy(x - lastX, y - lastY);
    lastX = x;
    lastY = y;
    onChange();
  };

  container.addEventListener('mousedown', e => start(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  container.addEventListener(
    'touchstart',
    e => {
      if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) pinch = distance(e.touches);
    },
    { passive: true }
  );

  container.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length === 1) {
        move(e.touches[0].clientX, e.touches[0].clientY);
        return;
      }

      if (e.touches.length === 2 && pinch > 0) {
        const next = distance(e.touches);
        scene.setUserZoom(scene.getUserZoom() * (next / pinch));
        pinch = next;
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

function distance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

void main();
