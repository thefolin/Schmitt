import type { Player } from '@/core/models/Player';
import type { TileConfig } from '@/core/models/Tile';
import { Camera } from './camera';
import {
  calculateSerpentineLayout,
  calculateGodPowersLayout,
  getBoardDimensions,
  calculateBoardSlots,
  type TilePosition,
  type GodPowerPosition,
  type SerpentineLayoutConfig,
  type BoardSlot
} from './serpentine.layout';
import {
  DEFAULT_BOARD_LAYOUT,
  calculatePlacementBounds,
  fetchBoardLayout,
  type BoardLayoutConfig,
  type TilePlacement
} from './board-layout.config';

/**
 * Renderer avec système de caméra
 * Vue 3/4 avec navigation pan/zoom
 */
export class BoardCameraRenderer {
  private container: HTMLElement;
  private viewport!: HTMLElement;
  private worldContainer!: HTMLElement;
  private camera: Camera;

  private tilePositions: TilePosition[] = [];
  private boardSlots: BoardSlot[] = [];
  private godPowerPositions: GodPowerPosition[] = [];
  private tileElements: Map<number, HTMLElement> = new Map();
  private pawnElements: Map<number, HTMLElement> = new Map();
  private godPowerElements: Map<number, HTMLElement> = new Map();

  private config: SerpentineLayoutConfig = {
    tileSize: 120,
    tileGap: 15,
    godPowerSize: 60
  };

  private boardLayout: BoardLayoutConfig = DEFAULT_BOARD_LAYOUT;

  // Touch/Mouse state
  private isDragging: boolean = false;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  private lastPinchDistance: number = 0;

  constructor(containerId: string = 'boardCamera') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} non trouvé`);
      this.container = document.createElement('div');
      this.viewport = document.createElement('div');
      this.worldContainer = document.createElement('div');
      this.camera = new Camera(800, 600);
      return;
    }

    this.container = container;
    this.setupDOM();

    const rect = this.container.getBoundingClientRect();
    this.camera = new Camera(rect.width, rect.height);

    this.setupEventListeners();
    this.startRenderLoop();
  }

  /**
   * Configure la structure DOM
   */
  private setupDOM(): void {
    this.container.innerHTML = '';
    this.container.className = 'board-camera-container';

    // Viewport (clip le contenu)
    this.viewport = document.createElement('div');
    this.viewport.className = 'board-camera-viewport';

    // World container (contient le plateau, transformé par la caméra)
    this.worldContainer = document.createElement('div');
    this.worldContainer.className = 'board-camera-world';

    this.viewport.appendChild(this.worldContainer);
    this.container.appendChild(this.viewport);

    // Contrôles de navigation
    this.createNavigationControls();
  }

  /**
   * Crée les boutons de navigation
   */
  private createNavigationControls(): void {
    const controls = document.createElement('div');
    controls.className = 'camera-controls';
    controls.innerHTML = `
      <button class="camera-btn" data-action="zoom-in">+</button>
      <button class="camera-btn" data-action="zoom-out">-</button>
      <button class="camera-btn" data-action="reset">⌂</button>
    `;

    controls.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;

      switch (action) {
        case 'zoom-in':
          this.camera.zoomBy(1.2);
          break;
        case 'zoom-out':
          this.camera.zoomBy(0.8);
          break;
        case 'reset':
          this.camera.setZoom(1);
          this.camera.centerOn(0, 0, true);
          break;
      }
    });

    this.container.appendChild(controls);
  }

  /**
   * Configure les événements touch/mouse
   */
  private setupEventListeners(): void {
    // Mouse events
    this.viewport.addEventListener('mousedown', this.onPointerDown.bind(this));
    window.addEventListener('mousemove', this.onPointerMove.bind(this));
    window.addEventListener('mouseup', this.onPointerUp.bind(this));

    // Touch events
    this.viewport.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.viewport.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.viewport.addEventListener('touchend', this.onTouchEnd.bind(this));

    // Wheel zoom
    this.viewport.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    // Resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private onPointerDown(e: MouseEvent): void {
    this.isDragging = true;
    this.lastTouchX = e.clientX;
    this.lastTouchY = e.clientY;
    this.viewport.style.cursor = 'grabbing';
  }

  private onPointerMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastTouchX;
    const deltaY = e.clientY - this.lastTouchY;

    this.camera.pan(-deltaX, -deltaY);

    this.lastTouchX = e.clientX;
    this.lastTouchY = e.clientY;
  }

  private onPointerUp(): void {
    this.isDragging = false;
    this.viewport.style.cursor = 'grab';
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // Pinch zoom
      this.lastPinchDistance = this.getPinchDistance(e.touches);
    }
    e.preventDefault();
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1 && this.isDragging) {
      const deltaX = e.touches[0].clientX - this.lastTouchX;
      const deltaY = e.touches[0].clientY - this.lastTouchY;

      this.camera.pan(-deltaX, -deltaY);

      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const distance = this.getPinchDistance(e.touches);
      const delta = distance / this.lastPinchDistance;

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      this.camera.zoomBy(delta, centerX, centerY);
      this.lastPinchDistance = distance;
    }
    e.preventDefault();
  }

  private onTouchEnd(): void {
    this.isDragging = false;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoomBy(delta, e.clientX, e.clientY);
  }

  private onResize(): void {
    const rect = this.container.getBoundingClientRect();
    this.camera.resize(rect.width, rect.height);
  }

  private getPinchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Boucle de rendu
   */
  private startRenderLoop(): void {
    const loop = () => {
      this.camera.update();
      this.worldContainer.style.transform = this.camera.getTransform();
      requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Définit le layout du plateau
   */
  public setLayout(layout: BoardLayoutConfig): void {
    this.boardLayout = layout;
    this.config.tileSize = layout.tileSize;
    this.config.tileGap = layout.tileGap;
  }

  /**
   * Charge le layout depuis un fichier JSON externe
   */
  public async loadLayoutFromJson(url: string): Promise<void> {
    const layout = await fetchBoardLayout(url);
    this.setLayout(layout);
  }

  /**
   * Calcule les positions des cases à partir du layout configurable
   */
  private calculatePositionsFromLayout(): TilePosition[] {
    const positions: TilePosition[] = [];

    for (const placement of this.boardLayout.placements) {
      const bounds = calculatePlacementBounds(placement, this.boardLayout);

      positions[placement.tileId] = {
        x: bounds.x,
        y: bounds.y,
        row: placement.gridRow,
        col: placement.gridCol
      };
    }

    return positions;
  }

  /**
   * Dessine le plateau complet
   */
  public render(tiles: TileConfig[], players: Player[]): void {
    // Calculer les positions à partir du layout
    this.tilePositions = this.calculatePositionsFromLayout();
    this.boardSlots = calculateBoardSlots(tiles.length, this.config);
    this.godPowerPositions = calculateGodPowersLayout(this.config);

    // Configurer les bounds de la caméra
    const dimensions = getBoardDimensions(this.config);
    this.camera.setBounds({
      minX: -100,
      maxX: dimensions.width + 100,
      minY: -100,
      maxY: dimensions.height + 100
    });

    // Rendre les éléments
    this.renderTiles(tiles);
    this.renderGodPowers();
    this.renderPlayers(players);

    // Centrer sur le premier joueur
    if (players.length > 0) {
      const firstPlayer = players[0];
      const pos = this.tilePositions[firstPlayer.position];
      if (pos) {
        this.camera.centerOn(pos.x, pos.y, false);
      }
    }
  }

  /**
   * Rend les cases du plateau
   */
  private renderTiles(tiles: TileConfig[]): void {
    tiles.forEach((tile, index) => {
      const pos = this.tilePositions[index];
      if (!pos) return;

      let tileEl = this.tileElements.get(index);

      if (!tileEl) {
        tileEl = this.createTileElement(tile, index);
        this.worldContainer.appendChild(tileEl);
        this.tileElements.set(index, tileEl);
      }

      // Positionner
      tileEl.style.left = `${pos.x}px`;
      tileEl.style.top = `${pos.y}px`;
    });
  }

  /**
   * Crée un élément de case avec taille configurable
   */
  private createTileElement(tile: TileConfig, index: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'board-tile';
    el.dataset.index = index.toString();
    el.dataset.type = tile.type;

    // Trouver le placement pour cette case
    const placement = this.boardLayout.placements.find(p => p.tileId === index);

    // Calculer la taille selon le placement
    let width = this.config.tileSize;
    let height = this.config.tileSize;

    if (placement) {
      const bounds = calculatePlacementBounds(placement, this.boardLayout);
      width = bounds.width;
      height = bounds.height;

      // Ajouter classe pour le style selon la taille
      el.dataset.size = placement.size;
    }

    // Image ou icône
    if (tile.image) {
      el.innerHTML = `
        <img src="${tile.image}" alt="${tile.name}" class="tile-image" />
        <span class="tile-number">${index}</span>
      `;
    } else {
      el.innerHTML = `
        <span class="tile-icon">${tile.icon}</span>
        <span class="tile-number">${index}</span>
      `;
    }

    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    return el;
  }

  /**
   * Rend les pouvoirs des dieux
   */
  private renderGodPowers(): void {
    // Conteneur pour la zone des pouvoirs
    let powerZone = this.worldContainer.querySelector('.god-powers-zone') as HTMLElement;

    if (!powerZone) {
      powerZone = document.createElement('div');
      powerZone.className = 'god-powers-zone';

      const title = document.createElement('div');
      title.className = 'god-powers-title';
      title.textContent = 'POUVOIRS DES DIEUX';
      powerZone.appendChild(title);

      this.worldContainer.appendChild(powerZone);
    }

    this.godPowerPositions.forEach((power) => {
      let powerEl = this.godPowerElements.get(power.id);

      if (!powerEl) {
        powerEl = document.createElement('div');
        powerEl.className = 'god-power';
        powerEl.innerHTML = `
          <div class="god-power-icon">⚡</div>
          <div class="god-power-name">${power.name}</div>
        `;
        powerEl.style.width = `${this.config.godPowerSize}px`;
        powerEl.style.height = `${this.config.godPowerSize}px`;

        this.worldContainer.appendChild(powerEl);
        this.godPowerElements.set(power.id, powerEl);
      }

      powerEl.style.left = `${power.x}px`;
      powerEl.style.top = `${power.y}px`;
    });
  }

  /**
   * Rend les joueurs (pions)
   */
  private renderPlayers(players: Player[]): void {
    players.forEach((player) => {
      let pawnEl = this.pawnElements.get(player.index);

      if (!pawnEl) {
        pawnEl = this.createPawnElement(player);
        this.worldContainer.appendChild(pawnEl);
        this.pawnElements.set(player.index, pawnEl);
      }

      this.updatePawnPosition(pawnEl, player, players);
    });
  }

  /**
   * Crée un élément de pion
   */
  private createPawnElement(player: Player): HTMLElement {
    const el = document.createElement('div');
    el.className = 'board-pawn';
    el.dataset.playerIndex = player.index.toString();
    el.style.setProperty('--player-color', player.color);

    el.innerHTML = `
      <div class="pawn-body"></div>
      ${player.hasSchmittPower ? '<div class="pawn-power">⚡</div>' : ''}
    `;

    return el;
  }

  /**
   * Met à jour la position d'un pion
   * Utilise les 4 slots de la case pour placer les joueurs
   */
  private updatePawnPosition(pawnEl: HTMLElement, player: Player, allPlayers: Player[]): void {
    const boardSlot = this.boardSlots[player.position];
    if (!boardSlot) return;

    // Trouver les joueurs sur la même case
    const playersOnSameTile = allPlayers.filter(p => p.position === player.position);
    const indexOnTile = playersOnSameTile.indexOf(player);

    // Utiliser les slots (4 coins de la case)
    const slotIndex = indexOnTile % 4;
    const slot = boardSlot.slots[slotIndex];

    const pawnSize = 30;
    const slotSize = this.config.tileSize / 2;
    const centerInSlot = (slotSize - pawnSize) / 2;

    pawnEl.style.left = `${slot.x + centerInSlot}px`;
    pawnEl.style.top = `${slot.y + centerInSlot}px`;

    // Mettre à jour le pouvoir Schmitt
    const powerEl = pawnEl.querySelector('.pawn-power');
    if (player.hasSchmittPower && !powerEl) {
      pawnEl.insertAdjacentHTML('beforeend', '<div class="pawn-power">⚡</div>');
    } else if (!player.hasSchmittPower && powerEl) {
      powerEl.remove();
    }
  }

  /**
   * Centre la caméra sur un joueur
   */
  public focusOnPlayer(playerIndex: number, players: Player[]): void {
    const player = players.find(p => p.index === playerIndex);
    if (!player) return;

    const pos = this.tilePositions[player.position];
    if (pos) {
      this.camera.centerOn(
        pos.x + this.config.tileSize / 2,
        pos.y + this.config.tileSize / 2,
        true
      );
    }
  }

  /**
   * Anime le déplacement d'un pion
   */
  public async animatePawnMove(
    playerIndex: number,
    _fromPos: number,
    toPos: number,
    duration: number = 500
  ): Promise<void> {
    const pawnEl = this.pawnElements.get(playerIndex);
    if (!pawnEl) return;

    // Centrer la caméra sur la destination
    const destPos = this.tilePositions[toPos];
    if (destPos) {
      this.camera.centerOn(
        destPos.x + this.config.tileSize / 2,
        destPos.y + this.config.tileSize / 2,
        true
      );
    }

    // Animation de saut
    pawnEl.classList.add('pawn-moving');

    return new Promise((resolve) => {
      setTimeout(() => {
        pawnEl.classList.remove('pawn-moving');
        resolve();
      }, duration);
    });
  }

  /**
   * Nettoie les ressources
   */
  public destroy(): void {
    this.tileElements.clear();
    this.pawnElements.clear();
    this.godPowerElements.clear();
    this.container.innerHTML = '';
  }
}
