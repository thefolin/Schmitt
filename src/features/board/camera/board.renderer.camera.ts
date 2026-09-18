import type { Player } from '@/core/models/Player';
import type { TileConfig } from '@/core/models/Tile';
import { withGulpSymbol } from '@/features/game/action-text';
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
 * Diamètre d'un pion, en pixels monde.
 *
 * Doit rester aligné sur `--pawn-size` dans board-camera.css : le CSS dessine
 * le pion, ce fichier calcule où le poser. Deux valeurs divergentes décalent
 * les pions du centre de leur case.
 */
export const PAWN_SIZE = 46;

/**
 * Renderer avec système de caméra
 * Vue 3/4 avec navigation pan/zoom
 */
export class BoardCameraRenderer {
  private container: HTMLElement;
  private viewport!: HTMLElement;
  private worldContainer!: HTMLElement;
  private tableLayer!: HTMLElement;
  private isoLayer!: HTMLElement;
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

    // Calque du tapis, séparé du monde 3D. Un élément aussi large placé dans
    // le contexte preserve-3d du monde écrase le rendu en perspective des
    // cases ; isolé ici, il suit la caméra sans perturber la scène.
    this.tableLayer = document.createElement('div');
    this.tableLayer.className = 'board-camera-table-layer';

    // World container (contient le plateau, transformé par la caméra)
    this.worldContainer = document.createElement('div');
    this.worldContainer.className = 'board-camera-world';

    // Calque d'inclinaison : il bascule tapis et cases d'un seul bloc, autour
    // du centre du viewport. La caméra cadre ensuite une scène déjà inclinée.
    this.isoLayer = document.createElement('div');
    this.isoLayer.className = 'board-camera-iso';

    this.isoLayer.appendChild(this.tableLayer);
    this.isoLayer.appendChild(this.worldContainer);
    this.viewport.appendChild(this.isoLayer);
    this.container.appendChild(this.viewport);

    // Contrôles de navigation
    this.createNavigationControls();
  }

  /**
   * Crée les boutons de navigation
   * Note: Les contrôles sont maintenant dans le HTML principal (action-buttons-zone)
   * Cette méthode est conservée pour compatibilité mais ne fait plus rien
   */
  private createNavigationControls(): void {
    // Les contrôles sont maintenant intégrés dans le HTML principal
    // Voir index-camera.html > action-buttons-zone
  }

  /**
   * Retourne l'instance de la caméra
   */
  public getCamera(): Camera {
    return this.camera;
  }

  /**
   * Centre la caméra sur le dé
   */
  public focusOnDice(dicePosition?: { x: number; y: number } | null): void {
    // Arrêter toute animation en cours pour permettre le contrôle immédiat
    this.camera.stopAnimation();

    // Viser le dé lui-même quand on connaît sa position ; à défaut, le centre
    // de la table (le dé y est ramené entre deux tours)
    if (dicePosition) {
      this.camera.centerOn(dicePosition.x, dicePosition.y, true);
      return;
    }

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
    // Rendre la main au joueur : sans ça, un recentrage automatique en cours
    // continue de tirer la caméra vers sa cible pendant qu'on essaie de paner
    this.camera.stopAnimation();
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
    // Idem que onPointerDown : le toucher reprend la main sur tout recentrage
    this.camera.stopAnimation();
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
    this.camera.stopAnimation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoomBy(delta, e.clientX, e.clientY);
  }

  private onResize(): void {
    const rect = this.container.getBoundingClientRect();
    this.camera.resize(rect.width, rect.height);
    // Le cadrage dépend de la taille de l'écran : le recalculer à la rotation
    // comme au redimensionnement de la fenêtre.
    this.fitTableToViewport();
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
      const transform = this.camera.getTransform();
      this.worldContainer.style.transform = transform;
      // Le tapis suit la caméra à l'identique pour rester sous le plateau
      this.tableLayer.style.transform = transform;
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

    // Indexé par POSITION DE PARCOURS (l'ordre des placements), pas par
    // `tileId`. Le tileId est le numéro de la case dans le catalogue, et sur
    // un plateau composé dans l'éditeur il est quelconque et troué
    // (0, 3, 6, 15, 19, 22…) : s'en servir comme index laissait des vides que
    // le pion traversait sans jamais trouver de case.
    this.boardLayout.placements.forEach((placement, position) => {
      const bounds = calculatePlacementBounds(placement, this.boardLayout);

      positions[position] = {
        x: bounds.x,
        y: bounds.y,
        row: placement.gridRow,
        col: placement.gridCol
      };
    });

    return positions;
  }

  /**
   * Les cases du parcours, dans l'ordre, telles qu'elles doivent être jouées.
   *
   * Chaque placement désigne une case du catalogue par son `tileId` ; c'est
   * cette case-là qu'il faut dessiner et dont l'effet s'applique. Rendre le
   * catalogue entier, comme on le faisait, revenait à jouer le plateau
   * officiel quel que soit le plateau composé dans l'éditeur.
   */
  private resolvePathTiles(catalog: TileConfig[]): TileConfig[] {
    return this.boardLayout.placements
      .map(placement => catalog[placement.tileId])
      .filter((tile): tile is TileConfig => Boolean(tile));
  }

  /**
   * Dessine le plateau complet
   */
  public render(catalog: TileConfig[], players: Player[]): void {
    // Calculer les positions à partir du layout
    this.tilePositions = this.calculatePositionsFromLayout();

    // `catalog` est le répertoire des cases disponibles ; le parcours réel est
    // la suite des placements du layout. Sur le plateau officiel les deux
    // coïncident, sur un plateau composé dans l'éditeur non.
    const tiles = this.resolvePathTiles(catalog);
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

    // Au premier rendu, cadrer la table entière plutôt que la case de départ :
    // centrer sur le premier joueur laissait le plateau collé en haut de
    // l'écran, et minuscule sur un téléviseur.
    if (this.isFirstRender && players.length > 0) {
      this.fitTableToViewport(false);
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

    // Créer l'élément de la table : un vrai tapis de jeu, pas un simple cadre.
    // Il matérialise la zone où le dé peut rouler et ancre visuellement la
    // scène, comme un tapis posé sur une table.
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

    this.tableLayer.appendChild(table);
    this.tableElement = table;
  }

  /**
   * Obtient les bounds de la table (pour la détection de sortie du dé)
   */
  public getTableBounds(): TableBounds | null {
    return this.tableBounds;
  }

  /**
   * Renvoie le tileId de la case occupant une position du parcours.
   *
   * L'effet appliqué doit venir de la case réellement posée, pas de l'index du
   * pion : sur un plateau personnalisé les deux diffèrent, et même sur le
   * plateau officiel un tileId manquant les décalait.
   */
  public getTileIdAtPosition(position: number): number | null {
    const placement = this.boardLayout.placements[position];
    return placement ? placement.tileId : null;
  }

  /** Nombre de cases du parcours, dernière position jouable incluse. */
  public getTileCount(): number {
    return this.boardLayout.placements.length;
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

      // La flèche doit montrer où elle envoie (SCH-03). L'angle se déduit de
      // la géométrie du parcours, pas d'une valeur écrite dans les données :
      // un plateau créé dans l'éditeur (U, cercle, T) s'oriente donc seul.
      this.orientArrow(tileEl, tile, index);
    });
  }

  /**
   * Nombre de cases dont une case flèche déplace.
   *
   * La règle est « avancez de 2 cases » et le type de case le dit déjà.
   * Sorti en constante pour que l'image et le déplacement ne puissent pas
   * diverger si la valeur change un jour.
   */
  private static readonly ARROW_STEPS = 2;

  /**
   * Fait pointer l'illustration d'une case flèche vers sa destination réelle.
   *
   * L'image source pointe vers le haut. On mesure l'angle entre la case et
   * celle où elle envoie, puis on tourne l'image d'autant.
   *
   * L'angle est calculé sur les coordonnées du plateau, avant la projection
   * isométrique : la scène entière étant inclinée ensuite, la flèche subit la
   * même déformation que les cases et reste cohérente avec elles.
   */
  private orientArrow(tileEl: HTMLElement, tile: TileConfig, index: number): void {
    const img = tileEl.querySelector('.tile-image') as HTMLElement | null;
    if (!img) return;

    if (tile.type !== 'forward_2') {
      // Une case peut changer de type entre deux rendus (plateau personnalisé) :
      // sans cela, une ancienne rotation resterait collée à l'image.
      img.style.removeProperty('transform');
      return;
    }

    const steps = BoardCameraRenderer.ARROW_STEPS;
    const delta = tile.direction === 'backward' ? -steps : steps;

    const from = this.tilePositions[index];
    // Faute de destination (flèche en bout de parcours), on vise la case
    // voisine dans le même sens : l'orientation reste juste.
    const to =
      this.tilePositions[index + delta] ??
      this.tilePositions[index + Math.sign(delta)];
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) return;

    // atan2 donne l'angle depuis l'axe X ; l'image pointe vers le haut,
    // soit 90° plus tôt.
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    img.style.transform = `rotate(${angle.toFixed(1)}deg)`;
  }

  /**
   * Crée un élément de case avec taille configurable
   */
  private createTileElement(tile: TileConfig, index: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'board-tile';
    el.dataset.index = index.toString();
    el.dataset.type = tile.type;

    // `index` est la position dans le parcours : le placement est celui de
    // même rang. Chercher par `tileId` échouait dès qu'un plateau réutilisait
    // deux fois la même case du catalogue — ce que l'éditeur permet.
    const placement = this.boardLayout.placements[index];

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
      // Le badge recouvre le « x2 » gravé dans l'illustration : une seule
      // image sert ainsi pour x2, x3 et x4.
      const badge =
        typeof tile.amount === 'number'
          ? `<span class="tile-amount">x${tile.amount}</span>`
          : '';
      el.innerHTML = `
        <img src="${tile.image}" alt="${tile.name}" class="tile-image" />
        ${badge}
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
    const tileSize = this.config.tileSize;
    const padding = 5;

    // La grille s'adapte au nombre de pions présents : seul sur sa case, un
    // pion occupe toute la place et reste bien lisible ; c'est seulement à
    // plusieurs qu'on resserre. Une grille 3x3 systématique réduisait le cas
    // courant — un pion par case — à un point minuscule.
    const crowd = playersOnSameTile.length;
    const gridSize = crowd <= 1 ? 1 : crowd <= 4 ? 2 : 3;
    const cellSize = (tileSize - padding * 2) / gridSize;

    // Le pion ne doit jamais déborder de sa cellule, sinon les pions se
    // chevauchent et mordent sur les cases voisines.
    const pawnSize = Math.min(PAWN_SIZE, Math.round(cellSize * 0.92));
    pawnEl.style.width = `${pawnSize}px`;
    pawnEl.style.height = `${pawnSize}px`;
    const slots: { x: number; y: number }[] = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        slots.push({
          x: pos.x + padding + col * cellSize + (cellSize - pawnSize) / 2,
          y: pos.y + padding + row * cellSize + (cellSize - pawnSize) / 2
        });
      }
    }

    // Au-delà des emplacements disponibles, on empile sur le dernier
    const maxSlots = gridSize * gridSize;
    const slotIndex = indexOnTile < maxSlots ? indexOnTile : maxSlots - 1;
    const slot = slots[slotIndex];

    pawnEl.style.left = `${slot.x}px`;
    pawnEl.style.top = `${slot.y}px`;

    // Si empilés, ajouter un léger offset pour qu'on devine la pile
    if (indexOnTile >= maxSlots) {
      const stackOffset = (indexOnTile - maxSlots + 1) * 3;
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
   * Ajuste le zoom pour que la table occupe l'écran, puis la recentre.
   *
   * Sans cela le zoom reste à 1 quelle que soit la taille de l'écran : sur un
   * téléviseur 4K le plateau n'occupait qu'un sixième de la surface, tandis que
   * sur un petit téléphone il débordait. Le zoom est borné pour éviter un
   * plateau géant sur très grand écran ou illisible sur très petit.
   */
  /**
   * Part de hauteur conservée par la projection isométrique.
   *
   * Lue depuis le CSS pour qu'il n'existe qu'une seule source de vérité :
   * changer `--iso-tilt` doit suffire à réaccorder le cadrage, sans avoir à
   * répercuter la valeur ici.
   */
  private getIsoVerticalRatio(): number {
    const styles = getComputedStyle(document.documentElement);
    const tilt = parseFloat(styles.getPropertyValue('--iso-tilt')) || 55;
    const squash = parseFloat(styles.getPropertyValue('--iso-squash')) || 0.82;
    return Math.cos((tilt * Math.PI) / 180) * squash;
  }

  public fitTableToViewport(animate = false): void {
    if (!this.tableBounds) return;

    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const tableWidth = this.tableBounds.maxX - this.tableBounds.minX;
    const tableHeightWorld = this.tableBounds.maxY - this.tableBounds.minY;
    if (tableWidth <= 0 || tableHeightWorld <= 0) return;

    // La projection isométrique écrase la scène verticalement : une table de
    // 800 unités de haut n'occupe plus que 800 × cos(tilt) × squash à l'écran.
    // Sans cette correction le cadrage raisonne sur une hauteur qui n'existe
    // pas, et le plateau sort du champ.
    const tableHeight = tableHeightWorld * this.getIsoVerticalRatio();

    // Le HUD mord sur la vue, mais pas du même côté selon l'orientation :
    // en paysage téléphone les commandes sont en colonne à droite, ailleurs
    // c'est une barre en bas. On cadre la table dans ce qui reste libre.
    const isPhoneLandscape = rect.height <= 520 && rect.width > rect.height;

    const topInset = rect.height * 0.10;
    const bottomInset = isPhoneLandscape ? rect.height * 0.04 : rect.height * 0.14;
    const rightInset = isPhoneLandscape ? rect.width * 0.24 : 0;

    const usableWidth = rect.width * 0.97 - rightInset;
    const usableHeight = rect.height - topInset - bottomInset;

    // Plancher bas : sur un iPhone SE (320px) la table fait 1209 unités de
    // large, il faut pouvoir descendre sous 0.25 pour la faire entrer.
    // Le plateau tient toujours en entier : sur un écran étroit et haut il
    // reste du vide vertical, mais voir toutes les cases d'un coup vaut mieux
    // que devoir faire glisser la vue à chaque tour.
    const rawZoom = Math.min(usableWidth / tableWidth, usableHeight / tableHeight);
    const zoom = Math.max(0.12, Math.min(2.5, rawZoom));
    this.camera.setZoom(zoom);

    // centerOn vise le centre de l'écran ; le milieu de la zone laissée libre
    // par le HUD est décalé, d'où ces deux corrections.
    const bandShiftY =
      (bottomInset - topInset) / (2 * zoom * this.getIsoVerticalRatio());
    const bandShiftX = rightInset / (2 * zoom);

    this.camera.centerOn(
      this.tableBounds.minX + tableWidth / 2 + bandShiftX,
      this.tableBounds.minY + tableHeightWorld / 2 - bandShiftY,
      animate
    );
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
      const pawnSize = PAWN_SIZE;
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
    if (titleEl) titleEl.textContent = withGulpSymbol(tile.name);
    if (descEl) descEl.textContent = withGulpSymbol(tile.description || '');
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
