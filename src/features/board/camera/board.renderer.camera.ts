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
import {
  calculateTableBounds,
  DEFAULT_TABLE_CONFIG,
  type TableConfig,
  type TableBounds
} from './table.config';

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
  private tableElement: HTMLElement | null = null;

  private config: SerpentineLayoutConfig = {
    tileSize: 120,
    tileGap: 15,
    godPowerSize: 60
  };

  private boardLayout: BoardLayoutConfig = DEFAULT_BOARD_LAYOUT;
  private tableConfig: TableConfig | null = null;
  private tableBounds: TableBounds | null = null;

  // Touch/Mouse state
  private isDragging: boolean = false;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  private lastPinchDistance: number = 0;
  private isFirstRender: boolean = true;

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
      <button class="camera-btn" data-action="focus-dice">🎲</button>
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
        case 'focus-dice':
          this.focusOnDice();
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
   * Centre la caméra sur le dé
   */
  public focusOnDice(): void {
    // Centrer sur le centre de la table
    if (this.tableBounds) {
      const centerX = (this.tableBounds.minX + this.tableBounds.maxX) / 2;
      const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;
      this.camera.centerOn(centerX, centerY, true);
    }
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

    // Ne calculer les pouvoirs des dieux que si godPowersZone est défini dans le layout
    if (this.boardLayout.godPowersZone) {
      this.godPowerPositions = calculateGodPowersLayout(this.config);
    } else {
      this.godPowerPositions = [];
    }

    // Calculer et rendre la table
    this.calculateAndRenderTable();

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

    // Ne rendre les pouvoirs des dieux que si le layout les définit
    if (this.boardLayout.godPowersZone) {
      this.renderGodPowers();
    } else {
      // Nettoyer les éléments de pouvoirs des dieux existants
      this.clearGodPowers();
    }

    this.renderPlayers(players);

    // Centrer sur le premier joueur uniquement au premier render
    if (this.isFirstRender && players.length > 0) {
      const firstPlayer = players[0];
      const pos = this.tilePositions[firstPlayer.position];
      if (pos) {
        this.camera.centerOn(pos.x, pos.y, false);
      }
      this.isFirstRender = false;
    }
  }

  /**
   * Calcule et rend la table de jeu
   */
  private calculateAndRenderTable(): void {
    // Calculer les bounds à partir des placements de cases
    console.log('📐 Calcul des bounds de la table avec', this.boardLayout.placements.length, 'cases');

    this.tableBounds = calculateTableBounds(
      this.boardLayout.placements,
      this.boardLayout.tileSize,
      this.boardLayout.tileGap,
      DEFAULT_TABLE_CONFIG.marginPercent
    );

    console.log('📐 Bounds calculés:', this.tableBounds);

    // Créer la config de la table
    this.tableConfig = {
      bounds: this.tableBounds,
      borders: DEFAULT_TABLE_CONFIG.borders!,
      marginPercent: DEFAULT_TABLE_CONFIG.marginPercent!,
      showBorders: DEFAULT_TABLE_CONFIG.showBorders!,
      borderColor: DEFAULT_TABLE_CONFIG.borderColor!,
      borderWidth: DEFAULT_TABLE_CONFIG.borderWidth!,
      fallPenalty: DEFAULT_TABLE_CONFIG.fallPenalty
    };

    // Rendre visuellement la table
    this.renderTable();
  }

  /**
   * Rend visuellement la table (bordures)
   */
  private renderTable(): void {
    if (!this.tableConfig || !this.tableBounds) return;

    // Nettoyer l'ancienne table si elle existe
    if (this.tableElement) {
      this.tableElement.remove();
      this.tableElement = null;
    }

    if (!this.tableConfig.showBorders) return;

    // Créer l'élément de la table
    const table = document.createElement('div');
    table.className = 'game-table';
    table.style.cssText = `
      position: absolute;
      left: ${this.tableBounds.minX}px;
      top: ${this.tableBounds.minY}px;
      width: ${this.tableBounds.maxX - this.tableBounds.minX}px;
      height: ${this.tableBounds.maxY - this.tableBounds.minY}px;
      pointer-events: none;
      z-index: 1;
      box-sizing: border-box;
    `;

    const borderStyle = `${this.tableConfig.borderWidth}px solid ${this.tableConfig.borderColor}`;

    // Appliquer les bordures selon la config
    if (this.tableConfig.borders.top) {
      table.style.borderTop = borderStyle;
    }
    if (this.tableConfig.borders.right) {
      table.style.borderRight = borderStyle;
    }
    if (this.tableConfig.borders.bottom) {
      table.style.borderBottom = borderStyle;
    }
    if (this.tableConfig.borders.left) {
      table.style.borderLeft = borderStyle;
    }

    this.worldContainer.appendChild(table);
    this.tableElement = table;
  }

  /**
   * Obtient les bounds de la table (pour la détection de sortie du dé)
   */
  public getTableBounds(): TableBounds | null {
    return this.tableBounds;
  }

  /**
   * Obtient la configuration de la table
   */
  public getTableConfig(): TableConfig | null {
    return this.tableConfig;
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

    // Afficher l'image ou l'icône selon ce qui est disponible
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

    // Ajouter un événement de clic pour afficher les informations de la case
    el.addEventListener('click', () => {
      this.showTileInfo(tile, index);
    });

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
    // Utiliser tilePositions pour les layouts personnalisés
    const pos = this.tilePositions[player.position];
    if (!pos) return;

    // Trouver les joueurs sur la même case
    const playersOnSameTile = allPlayers.filter(p => p.position === player.position);
    const indexOnTile = playersOnSameTile.indexOf(player);

    // Calculer les positions pour jusqu'à 10 joueurs sur une case
    // Grille 3x3 pour 9 joueurs + 1 position centrale pour le 10ème
    const tileSize = this.config.tileSize;
    const pawnSize = 30;
    const padding = 5;

    // Positions en grille 3x3 dans la case
    const gridSize = 3;
    const cellSize = (tileSize - padding * 2) / gridSize;
    const slots: { x: number; y: number }[] = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        slots.push({
          x: pos.x + padding + col * cellSize + (cellSize - pawnSize) / 2,
          y: pos.y + padding + row * cellSize + (cellSize - pawnSize) / 2
        });
      }
    }

    // Si plus de 9 joueurs, empiler au centre
    const slotIndex = indexOnTile < 9 ? indexOnTile : 4; // Position centrale (index 4)
    const slot = slots[slotIndex];

    pawnEl.style.left = `${slot.x}px`;
    pawnEl.style.top = `${slot.y}px`;

    // Si empilés au centre, ajouter un léger offset pour visibilité
    if (indexOnTile >= 9) {
      const stackOffset = (indexOnTile - 9) * 3;
      pawnEl.style.left = `${slot.x + stackOffset}px`;
      pawnEl.style.top = `${slot.y + stackOffset}px`;
    }

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
   * Anime le déplacement d'un pion case par case avec suivi caméra
   * Simule un déplacement humain sur un plateau physique
   */
  public async animatePawnMove(
    playerIndex: number,
    fromPos: number,
    toPos: number,
    duration: number = 600
  ): Promise<void> {
    const pawnEl = this.pawnElements.get(playerIndex);
    if (!pawnEl) return;

    // Calculer le nombre de cases à parcourir
    const steps = Math.abs(toPos - fromPos);
    const direction = toPos > fromPos ? 1 : -1;

    // Durée par case (plus lent pour être naturel)
    const durationPerStep = duration;

    console.log(`🚶 Animation: ${steps} cases de ${fromPos} à ${toPos}`);

    // Animer case par case
    for (let i = 0; i < steps; i++) {
      const currentPos = fromPos + (direction * (i + 1));

      console.log(`  → Étape ${i + 1}/${steps}: case ${currentPos}`);

      // Obtenir la position de la case actuelle
      const pos = this.tilePositions[currentPos];
      if (!pos) continue;

      // Calculer la position du pion (centré dans la case)
      const pawnSize = 30;
      const halfTileSize = this.config.tileSize / 2;
      const centerOffset = (halfTileSize - pawnSize) / 2;

      // Déplacer visuellement le pion vers cette case
      pawnEl.style.left = `${pos.x + centerOffset}px`;
      pawnEl.style.top = `${pos.y + centerOffset}px`;

      // Ajouter animation de saut
      pawnEl.classList.add('pawn-moving');

      // Centrer la caméra sur la case actuelle
      this.camera.centerOn(
        pos.x + this.config.tileSize / 2,
        pos.y + this.config.tileSize / 2,
        true
      );

      // Attendre que l'animation de cette case soit terminée
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          pawnEl.classList.remove('pawn-moving');
          resolve();
        }, durationPerStep);
      });

      // Petite pause entre chaque case pour rendre le mouvement plus naturel
      if (i < steps - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      }
    }

    console.log(`✅ Animation terminée à la case ${toPos}`);
  }

  /**
   * Centre la caméra sur un joueur (appelé uniquement au lancer de dé)
   */
  public centerOnPlayer(playerIndex: number, players: Player[]): void {
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
   * Affiche une modal avec les informations d'une case
   */
  private showTileInfo(tile: TileConfig, index: number): void {
    // Créer la modal si elle n'existe pas
    let modal = document.getElementById('tileInfoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tileInfoModal';
      modal.className = 'tile-info-modal';
      modal.innerHTML = `
        <div class="tile-info-content">
          <button class="close-tile-info">&times;</button>
          <div class="tile-info-icon"></div>
          <h2 class="tile-info-title"></h2>
          <p class="tile-info-description"></p>
          <div class="tile-info-number"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // Fermer au clic sur la croix
      const closeBtn = modal.querySelector('.close-tile-info');
      closeBtn?.addEventListener('click', () => {
        modal!.style.display = 'none';
      });

      // Fermer au clic en dehors de la modal
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal!.style.display = 'none';
        }
      });
    }

    // Remplir les informations
    const iconEl = modal.querySelector('.tile-info-icon') as HTMLElement;
    const titleEl = modal.querySelector('.tile-info-title') as HTMLElement;
    const descEl = modal.querySelector('.tile-info-description') as HTMLElement;
    const numberEl = modal.querySelector('.tile-info-number') as HTMLElement;

    if (iconEl) iconEl.textContent = tile.icon;
    if (titleEl) titleEl.textContent = tile.name;
    if (descEl) descEl.textContent = tile.description;
    if (numberEl) numberEl.textContent = `Case ${index}`;

    // Afficher la modal
    modal.style.display = 'flex';
  }

  /**
   * Nettoie les éléments de pouvoirs des dieux
   */
  private clearGodPowers(): void {
    // Supprimer les éléments du DOM
    this.godPowerElements.forEach((el) => {
      el.remove();
    });
    this.godPowerElements.clear();

    // Supprimer la zone des pouvoirs
    const powerZone = this.worldContainer.querySelector('.god-powers-zone');
    if (powerZone) {
      powerZone.remove();
    }
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
