/**
 * Éditeur visuel de plateau amélioré
 * - Panneaux latéraux repliables (pin/unpin)
 * - Grille fine pour placement précis
 * - Drag & drop avec preview
 * - Déplacement des tuiles placées
 */

import { TILE_CONFIGS, loadTileConfigs } from '@/features/tiles/tile.config';
import type { BoardLayoutConfig, TilePlacement } from '@/features/board/camera/board-layout.config';
import '../styles/common/design-system.css';
import '../styles/editor/editor-theme.css';
import { withGulpSymbol } from '@/features/game/action-text';

// Configuration des pouvoirs des dieux pour l'éditeur
const GOD_POWERS = [
  {
    id: 100,
    name: 'Colère des Dieux',
    icon: '💀',
    description: 'COLÈRE DES DIEUX ! Le joueur reçoit 1 cul sec ! (Double aux dés = pas de faveur)',
    image: 'assets/mort.jpg'
  },
  {
    id: 101,
    name: 'Artémis',
    icon: '🏹',
    description: 'Conservez 1 dé et relancez l\'autre une seule fois. Si vous retombez sur un double, distribuez les gorgées de la Colère des Dieux au joueur de votre choix à votre place.',
    image: 'assets/de.jpg'
  },
  {
    id: 102,
    name: 'Athéna',
    icon: '🛡️',
    description: 'Choisissez un objet bouclier. Ce bouclier renvoie 1 seule fois toutes les gorgées/cul-sec sur le joueur de votre choix. Tant que vous possédez le bouclier, vous ne pouvez pas gagner.',
    image: 'assets/athena.jpg'
  },
  {
    id: 103,
    name: 'Aphrodite',
    icon: '💕',
    description: 'Lancez 2 dés, choisissez 2 adversaires et associez 1 dé à chacun. Déplacez-les en avant ou arrière. Ils appliquent l\'effet de leur nouvel emplacement.',
    image: 'assets/aphrodite.jpg'
  },
  {
    id: 104,
    name: 'Hermès',
    icon: '👟',
    description: 'Choisissez un adversaire et déplacez-vous sur sa case OU déplacez-le sur votre case. Appliquez l\'effet de la case du nouvel emplacement.',
    image: 'assets/hermes.jpg'
  },
  {
    id: 105,
    name: 'Apollon',
    icon: '☀️',
    description: 'Rejouez un tour en lançant 2 dés, conservez celui de votre choix. Distribuez 1 gorgée à chaque adversaire que vous dépassez.',
    image: 'assets/apollo.jpg'
  },
  {
    id: 106,
    name: 'Arès',
    icon: '⚔️',
    description: 'Tous les joueurs choisissent pouce haut ou bas. Ceux qui font l\'inverse de vous reçoivent autant de gorgées que le nombre qui ont fait comme vous.',
    image: 'assets/ares.jpg'
  },
  {
    id: 107,
    name: 'Dionysos',
    icon: '🍷',
    description: 'Tous les joueurs trinquent et continuent de boire avec vous jusqu\'à ce que vous seul décidiez d\'arrêter.',
    image: 'assets/dionysus.jpg'
  },
  {
    id: 108,
    name: 'Héphaïstos',
    icon: '🔨',
    description: 'Placez 2 shooters sur des cases différentes. Le premier joueur à tomber dessus doit boire immédiatement le shooter, puis appliquer la case.',
    image: 'assets/hephaestus.jpg'
  },
  {
    id: 109,
    name: 'Poséidon',
    icon: '🔱',
    description: 'Ciblez un joueur et lancez 2 dés. Il reçoit autant de gorgées que le dé le plus élevé. Ses 2 voisins reçoivent chacun le score du dé le plus faible.',
    image: 'assets/poseidon.jpg'
  }
];

interface PlacedTile {
  id: string;
  tileId: number;
  x: number;
  y: number;
  rotation: number;  // 0, 90, 180, 270
  width: number;
  height: number;
}

interface EditorState {
  gridRows: number;
  gridCols: number;
  tileSize: number;
  snapSize: number;
  zoom: number;
  placedTiles: PlacedTile[];
  savedLayouts: SavedLayout[];
}

interface SavedLayout {
  name: string;
  timestamp: number;
  config: BoardLayoutConfig;
}

class BoardEditor {
  private state: EditorState;
  private fineGrid!: HTMLElement;
  private gridBoard!: HTMLElement;
  private placedTilesContainer!: HTMLElement;
  private tilesList!: HTMLElement;
  private layoutsList!: HTMLElement;
  private saveModal!: HTMLElement;
  private placementGhost!: HTMLElement;
  private tileCountEl!: HTMLElement;
  private cursorPosEl!: HTMLElement;

  private draggedTileId: number | null = null;
  /**
   * Case choisie dans la palette, en attente d'être posée par un tap sur la
   * grille. Le drag & drop HTML5 ne fonctionne pas au doigt : c'est ce mode
   * « je choisis puis je pose » qui rend l'éditeur utilisable sur mobile.
   */
  private armedTileId: number | null = null;
  private draggedPlacedTile: PlacedTile | null = null;
  private isResizing = false;
  private resizingTile: PlacedTile | null = null;
  private resizeHandle: string = '';
  private resizeStart = { x: 0, y: 0, width: 0, height: 0 };
  private zoomLevelEl!: HTMLElement;
  private gridContainer!: HTMLElement;

  // Pan avec souris (style Anno)
  private isPanning = false;
  private panStart = { x: 0, y: 0 };

  constructor() {
    this.state = {
      gridRows: 45,
      gridCols: 30,
      tileSize: 60,
      snapSize: 10,
      zoom: 1,
      placedTiles: [],
      savedLayouts: []
    };

    this.init();
  }

  private init(): void {
    // L'éditeur charge le même parcours que le jeu : sa palette doit refléter
    // board-tiles.json, sinon les deux divergeraient.
    const start = () => void loadTileConfigs().then(() => this.setup());

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  private setup(): void {
    // Récupérer les éléments DOM
    this.fineGrid = document.getElementById('fineGrid')!;
    this.gridBoard = document.getElementById('gridBoard')!;
    this.placedTilesContainer = document.getElementById('placedTiles')!;
    this.tilesList = document.getElementById('tilesList')!;
    this.layoutsList = document.getElementById('layoutsList')!;
    this.saveModal = document.getElementById('saveModal')!;
    this.placementGhost = document.getElementById('placementGhost')!;
    this.tileCountEl = document.getElementById('tileCount')!;
    this.cursorPosEl = document.getElementById('cursorPos')!;
    this.zoomLevelEl = document.getElementById('zoomLevel')!;

    // Récupérer le container de grille
    this.gridContainer = document.getElementById('gridContainer')!;

    // Charger les layouts sauvegardés
    this.loadSavedLayouts();

    // Setup panneaux repliables
    this.setupPanels();

    // Afficher les cases disponibles
    this.renderTilesList();

    // Créer la grille
    this.updateGrid();

    // Afficher les layouts sauvegardés
    this.renderLayoutsList();

    // Setup drag & drop global
    this.setupGlobalDragDrop();

    // Setup contrôles souris style Anno
    this.setupMouseControls();
  }

  /**
   * Configure les panneaux latéraux repliables
   */
  private setupPanels(): void {
    const tilesPanel = document.getElementById('tilesPanel')!;
    const configPanel = document.getElementById('configPanel')!;
    const tilesPinBtn = document.getElementById('tilesPinBtn')!;
    const configPinBtn = document.getElementById('configPinBtn')!;

    tilesPinBtn.addEventListener('click', () => {
      tilesPanel.classList.toggle('collapsed');
      tilesPinBtn.classList.toggle('pinned');
    });

    configPinBtn.addEventListener('click', () => {
      configPanel.classList.toggle('collapsed');
      configPinBtn.classList.toggle('pinned');
    });
  }

  /**
   * Affiche la liste des cases disponibles organisées en sections
   */
  private renderTilesList(): void {
    this.tilesList.innerHTML = '';

    // Section Cases du jeu
    const gameSection = document.createElement('div');
    gameSection.className = 'tiles-section';
    gameSection.innerHTML = `<h4 class="section-title">Cases du jeu</h4>`;

    const gameList = document.createElement('div');
    gameList.className = 'section-list';

    TILE_CONFIGS.forEach((tile, index) => {
      const tileItem = document.createElement('div');
      tileItem.className = 'tile-item';
      tileItem.draggable = true;
      tileItem.dataset.tileId = index.toString();

      // Tooltip avec description de la règle
      tileItem.title = withGulpSymbol(`${tile.name}\n${tile.description || ''}`);

      tileItem.innerHTML = `
        ${tile.image
          ? `<img src="${tile.image}" alt="${tile.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
             <span style="display:none; font-size: 24px;">${tile.icon}</span>`
          : `<span style="font-size: 24px;">${tile.icon}</span>`
        }
        <div class="tile-info">
          <div class="tile-name">${withGulpSymbol(tile.name)}</div>
          <div class="tile-id">#${index}</div>
        </div>
      `;

      tileItem.addEventListener('dragstart', (e) => this.onTileDragStart(e, index));
      tileItem.addEventListener('dragend', () => this.onDragEnd());
      tileItem.addEventListener('click', () => this.armTile(index));

      gameList.appendChild(tileItem);
    });

    gameSection.appendChild(gameList);
    this.tilesList.appendChild(gameSection);

    // Section Pouvoirs des Dieux
    const godSection = document.createElement('div');
    godSection.className = 'tiles-section god-powers-section';
    godSection.innerHTML = `<h4 class="section-title">Pouvoirs des Dieux</h4>`;

    const godList = document.createElement('div');
    godList.className = 'section-list';

    GOD_POWERS.forEach((power) => {
      const tileItem = document.createElement('div');
      tileItem.className = 'tile-item god-power-item';
      tileItem.draggable = true;
      tileItem.dataset.tileId = power.id.toString();

      // Tooltip avec description
      tileItem.title = withGulpSymbol(`${power.name}\n${power.description}`);

      tileItem.innerHTML = `
        ${power.image
          ? `<img src="${power.image}" alt="${power.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
             <span style="display:none; font-size: 24px;">${power.icon}</span>`
          : `<span style="font-size: 24px;">${power.icon}</span>`
        }
        <div class="tile-info">
          <div class="tile-name">${withGulpSymbol(power.name)}</div>
          <div class="tile-id">Faveur</div>
        </div>
      `;

      tileItem.addEventListener('dragstart', (e) => this.onTileDragStart(e, power.id));
      tileItem.addEventListener('dragend', () => this.onDragEnd());
      tileItem.addEventListener('click', () => this.armTile(power.id));

      godList.appendChild(tileItem);
    });

    godSection.appendChild(godList);
    this.tilesList.appendChild(godSection);
  }

  /**
   * Met à jour la grille
   */
  public updateGrid(): void {
    const rowsInput = document.getElementById('gridRows') as HTMLInputElement;
    const colsInput = document.getElementById('gridCols') as HTMLInputElement;

    if (rowsInput && colsInput) {
      this.state.gridRows = parseInt(rowsInput.value) || 45;
      this.state.gridCols = parseInt(colsInput.value) || 30;
    }

    const cellSize = 20;
    const width = this.state.gridCols * cellSize;
    const height = this.state.gridRows * cellSize;

    this.gridBoard.style.width = `${width}px`;
    this.gridBoard.style.height = `${height}px`;

    // Mettre à jour le container pour les tuiles placées
    if (this.placedTilesContainer) {
      this.placedTilesContainer.style.width = `${width}px`;
      this.placedTilesContainer.style.height = `${height}px`;
      this.placedTilesContainer.style.position = 'absolute';
      this.placedTilesContainer.style.top = '0';
      this.placedTilesContainer.style.left = '0';
    }

    this.renderPlacedTiles();
  }

  /**
   * Configure le drag & drop global sur la grille
   */
  private setupGlobalDragDrop(): void {
    const gridContainer = document.getElementById('gridContainer')!;

    gridContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.draggedTileId !== null || this.draggedPlacedTile) {
        this.updatePlacementGhost(e);
      }
    });

    gridContainer.addEventListener('dragleave', (e) => {
      if (!gridContainer.contains(e.relatedTarget as Node)) {
        this.hidePlacementGhost();
      }
    });

    gridContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      this.handleDrop(e);
    });

    // Échap annule la sélection en cours et referme les tiroirs
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      this.clearArmedTile();
      this.closeMobilePanels();
    });

    // Tiroirs mobiles : la palette et la configuration, inaccessibles autrement
    // quand les colonnes latérales sont masquées sur petit écran.
    document.getElementById('openTilesBtn')?.addEventListener('click', () => {
      this.toggleMobilePanel('tilesPanel');
    });

    document.getElementById('openConfigBtn')?.addEventListener('click', () => {
      this.toggleMobilePanel('configPanel');
    });

    document.getElementById('editorBackdrop')?.addEventListener('click', () => {
      this.closeMobilePanels();
    });

    // Placement au tap : pose la case choisie dans la palette. Ignoré si le
    // tap vise une case déjà posée, pour ne pas empiler à l'aveugle.
    gridContainer.addEventListener('click', (e) => {
      if (this.armedTileId === null) return;
      if ((e.target as HTMLElement).closest('.placed-tile')) return;

      const { x, y } = this.pointToTilePosition(e.clientX, e.clientY);
      this.placeTileAt(this.armedTileId, x, y);
      // La case reste choisie : poser une série va plus vite
    });

    // Track mouse position for info bar
    gridContainer.addEventListener('mousemove', (e) => {
      const rect = this.fineGrid.getBoundingClientRect();
      // Account for zoom in position display
      const x = Math.floor((e.clientX - rect.left) / this.state.zoom);
      const y = Math.floor((e.clientY - rect.top) / this.state.zoom);
      this.cursorPosEl.textContent = `Position: ${x}, ${y}`;
    });
  }

  /**
   * Début du drag d'une case depuis la liste
   */
  private onTileDragStart(e: DragEvent, tileId: number): void {
    this.draggedTileId = tileId;
    (e.target as HTMLElement).classList.add('dragging');
    e.dataTransfer?.setData('text/plain', tileId.toString());

    // Show ghost
    this.placementGhost.style.width = `${this.state.tileSize}px`;
    this.placementGhost.style.height = `${this.state.tileSize}px`;
  }

  /**
   * Fin du drag
   */
  private onDragEnd(): void {
    this.draggedTileId = null;
    this.draggedPlacedTile = null;
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    this.hidePlacementGhost();
  }

  /**
   * Déplace une case posée au doigt.
   *
   * On suit le pointeur jusqu'au relâchement, en gardant le décalage entre le
   * point touché et le coin de la case pour qu'elle ne saute pas sous le doigt.
   */
  private startTouchDrag(e: PointerEvent, tile: PlacedTile, el: HTMLElement): void {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');

    const rect = this.fineGrid.getBoundingClientRect();
    const grabOffsetX = (e.clientX - rect.left) / this.state.zoom - tile.x;
    const grabOffsetY = (e.clientY - rect.top) / this.state.zoom - tile.y;

    const onMove = (ev: PointerEvent) => {
      const gridRect = this.fineGrid.getBoundingClientRect();
      let x = (ev.clientX - gridRect.left) / this.state.zoom - grabOffsetX;
      let y = (ev.clientY - gridRect.top) / this.state.zoom - grabOffsetY;

      x = Math.round(x / this.state.snapSize) * this.state.snapSize;
      y = Math.round(y / this.state.snapSize) * this.state.snapSize;

      x = Math.max(0, Math.min(x, this.state.gridCols * 20 - tile.width));
      y = Math.max(0, Math.min(y, this.state.gridRows * 20 - tile.height));

      // Déplacement visuel immédiat, sans reconstruire toute la grille
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      tile.x = x;
      tile.y = y;
    };

    const onEnd = () => {
      el.classList.remove('dragging');
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
      this.renderPlacedTiles();
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
  }

  /** Ouvre le tiroir demandé, en refermant l'autre. */
  private toggleMobilePanel(panelId: string): void {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const wasOpen = panel.classList.contains('is-open');
    this.closeMobilePanels();
    if (!wasOpen) {
      panel.classList.add('is-open');
      const backdrop = document.getElementById('editorBackdrop');
      if (backdrop) backdrop.hidden = false;
    }
  }

  private closeMobilePanels(): void {
    document.querySelectorAll('.side-panel.is-open').forEach((el) =>
      el.classList.remove('is-open')
    );
    const backdrop = document.getElementById('editorBackdrop');
    if (backdrop) backdrop.hidden = true;
  }

  /**
   * Choisit (ou désélectionne) la case à poser au prochain tap sur la grille.
   */
  private armTile(tileId: number): void {
    this.armedTileId = this.armedTileId === tileId ? null : tileId;
    this.refreshArmedState();

    // Sur mobile, choisir une case doit rendre la grille : c'est l'étape
    // suivante du geste.
    if (this.armedTileId !== null) this.closeMobilePanels();
  }

  private clearArmedTile(): void {
    this.armedTileId = null;
    this.refreshArmedState();
  }

  /** Reflète la case choisie dans la palette et dans la barre d'info. */
  private refreshArmedState(): void {
    document.querySelectorAll('.tile-item').forEach((el) => {
      const id = (el as HTMLElement).dataset.tileId;
      el.classList.toggle('armed', id !== undefined && Number(id) === this.armedTileId);
    });

    const hint = document.getElementById('armedHint');
    if (hint) {
      if (this.armedTileId === null) {
        hint.textContent = '';
        hint.hidden = true;
      } else {
        const isGodPower = this.armedTileId >= 100;
        const name = isGodPower
          ? GOD_POWERS.find((g) => g.id === this.armedTileId)?.name
          : TILE_CONFIGS[this.armedTileId]?.name;
        hint.textContent = `${name ?? 'Case'} — touchez la grille pour poser`;
        hint.hidden = false;
      }
    }

    document.getElementById('gridContainer')?.classList.toggle(
      'is-placing',
      this.armedTileId !== null
    );
  }

  /**
   * Convertit un point de l'écran en position de case, accrochée à la grille.
   * Partagé par le survol, le drop et le placement au doigt : un seul calcul,
   * donc un seul comportement à corriger si la grille change.
   */
  private pointToTilePosition(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.fineGrid.getBoundingClientRect();
    let x = (clientX - rect.left) / this.state.zoom - this.state.tileSize / 2;
    let y = (clientY - rect.top) / this.state.zoom - this.state.tileSize / 2;

    x = Math.round(x / this.state.snapSize) * this.state.snapSize;
    y = Math.round(y / this.state.snapSize) * this.state.snapSize;

    x = Math.max(0, Math.min(x, this.state.gridCols * 20 - this.state.tileSize));
    y = Math.max(0, Math.min(y, this.state.gridRows * 20 - this.state.tileSize));

    return { x, y };
  }

  /**
   * Pose une case à la position donnée, ou y déplace celle en cours de saisie.
   */
  private placeTileAt(tileId: number, x: number, y: number): void {
    const tile: PlacedTile = {
      id: `tile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tileId,
      x,
      y,
      rotation: 0,
      width: this.state.tileSize,
      height: this.state.tileSize
    };
    this.state.placedTiles.push(tile);
    this.renderPlacedTiles();
  }

  /**
   * Met à jour la position du ghost de placement
   */
  private updatePlacementGhost(e: DragEvent): void {
    const { x, y } = this.pointToTilePosition(e.clientX, e.clientY);

    this.placementGhost.style.display = 'block';
    this.placementGhost.style.left = `${x}px`;
    this.placementGhost.style.top = `${y}px`;
    this.placementGhost.style.width = `${this.state.tileSize}px`;
    this.placementGhost.style.height = `${this.state.tileSize}px`;
  }

  /**
   * Cache le ghost de placement
   */
  private hidePlacementGhost(): void {
    this.placementGhost.style.display = 'none';
  }

  /**
   * Gère le drop d'une tuile
   */
  private handleDrop(e: DragEvent): void {
    const { x, y } = this.pointToTilePosition(e.clientX, e.clientY);

    if (this.draggedPlacedTile) {
      // Déplacer une tuile existante
      this.draggedPlacedTile.x = x;
      this.draggedPlacedTile.y = y;
      this.renderPlacedTiles();
    } else if (this.draggedTileId !== null) {
      this.placeTileAt(this.draggedTileId, x, y);
    }

    this.onDragEnd();
  }

  /**
   * Affiche les tuiles placées
   */
  private renderPlacedTiles(): void {
    this.placedTilesContainer.innerHTML = '';

    this.state.placedTiles.forEach(tile => {
      // Gérer les pouvoirs des dieux (ID >= 100)
      const isGodPower = tile.tileId >= 100;
      const godPower = isGodPower ? GOD_POWERS.find(p => p.id === tile.tileId) : null;
      const tileConfig = isGodPower ? null : TILE_CONFIGS[tile.tileId];

      if (!tileConfig && !godPower) return;

      const el = document.createElement('div');
      el.className = isGodPower ? 'placed-tile god-power-placed' : 'placed-tile';
      el.dataset.id = tile.id;
      el.draggable = true;
      el.style.left = `${tile.x}px`;
      el.style.top = `${tile.y}px`;
      el.style.width = `${tile.width}px`;
      el.style.height = `${tile.height}px`;
      el.style.transform = `rotate(${tile.rotation}deg)`;

      // Tooltip avec description de la règle
      const tooltipText = isGodPower
        ? withGulpSymbol(`${godPower!.name}\n${godPower!.description}`)
        : `${tileConfig!.name}\n${tileConfig!.description || ''}`;
      el.title = tooltipText;

      // Contenu selon le type
      const displayName = isGodPower ? godPower!.name : tileConfig!.name;
      const displayIcon = isGodPower ? godPower!.icon : tileConfig!.icon;
      const displayImage = isGodPower ? godPower!.image : tileConfig!.image;

      // Rang dans le parcours : c'est lui qui détermine l'ordre de jeu, pas le
      // tileId. Sans ce numéro, l'ordre du chemin est invisible pendant la
      // construction. Les pouvoirs des dieux ne font pas partie du parcours.
      const pathIndex = isGodPower
        ? null
        : this.state.placedTiles.filter((t) => t.tileId < 100).indexOf(tile);
      const displayId = isGodPower ? godPower!.name : `${pathIndex}`;

      // Rotation désactivée : les images des cases sont déjà dans le bon sens,
      // et les boutons encombraient la case au doigt. Le champ `rotation` est
      // conservé dans le modèle et l'export pour ne pas casser les layouts
      // existants ; il vaut toujours 0.
      el.innerHTML = `
        ${displayImage
          ? `<img src="${displayImage}" alt="${displayName}" onerror="this.style.display='none'">`
          : `<span style="font-size: ${Math.min(tile.width, tile.height) * 0.4}px">${displayIcon}</span>`
        }
        <span class="tile-number">${displayId}</span>
        <button class="remove-btn">×</button>
        <div class="resize-handle se" data-handle="se"></div>
        <div class="resize-handle sw" data-handle="sw"></div>
        <div class="resize-handle ne" data-handle="ne"></div>
        <div class="resize-handle nw" data-handle="nw"></div>
      `;

      // Drag pour déplacer
      el.addEventListener('dragstart', (e) => {
        if (this.isResizing) {
          e.preventDefault();
          return;
        }
        this.draggedPlacedTile = tile;
        el.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', tile.id);

        // Show ghost
        this.placementGhost.style.width = `${tile.width}px`;
        this.placementGhost.style.height = `${tile.height}px`;
      });

      el.addEventListener('dragend', () => this.onDragEnd());

      // Déplacement au doigt : dragstart ne se déclenche pas au toucher, une
      // case posée était donc impossible à bouger sur mobile.
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return; // la souris garde le drag & drop
        if ((e.target as HTMLElement).closest('.remove-btn, .resize-handle')) return;
        this.startTouchDrag(e, tile, el);
      });

      // Poignées de redimensionnement
      el.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.startResize(e as MouseEvent, tile, (handle as HTMLElement).dataset.handle || 'se');
        });
      });

      // Bouton supprimer
      el.querySelector('.remove-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTile(tile.id);
      });

      this.placedTilesContainer.appendChild(el);
    });

    // Update count
    this.tileCountEl.textContent = `${this.state.placedTiles.length} cases placées`;

    this.updateBoardStatus();
  }

  /**
   * Démarre le redimensionnement
   */
  private startResize(e: MouseEvent, tile: PlacedTile, handle: string): void {
    this.isResizing = true;
    this.resizingTile = tile;
    this.resizeHandle = handle;
    this.resizeStart = {
      x: e.clientX,
      y: e.clientY,
      width: tile.width,
      height: tile.height
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.resizingTile) return;

      const dx = e.clientX - this.resizeStart.x;
      const dy = e.clientY - this.resizeStart.y;

      let newWidth = this.resizeStart.width;
      let newHeight = this.resizeStart.height;

      if (this.resizeHandle.includes('e')) {
        newWidth = Math.max(20, this.resizeStart.width + dx);
      }
      if (this.resizeHandle.includes('w')) {
        newWidth = Math.max(20, this.resizeStart.width - dx);
        if (newWidth !== this.resizeStart.width - dx + 20) {
          this.resizingTile.x = this.resizingTile.x + (this.resizeStart.width - newWidth);
        }
      }
      if (this.resizeHandle.includes('s')) {
        newHeight = Math.max(20, this.resizeStart.height + dy);
      }
      if (this.resizeHandle.includes('n')) {
        newHeight = Math.max(20, this.resizeStart.height - dy);
        if (newHeight !== this.resizeStart.height - dy + 20) {
          this.resizingTile.y = this.resizingTile.y + (this.resizeStart.height - newHeight);
        }
      }

      // Snap to grid
      newWidth = Math.round(newWidth / this.state.snapSize) * this.state.snapSize;
      newHeight = Math.round(newHeight / this.state.snapSize) * this.state.snapSize;

      this.resizingTile.width = newWidth;
      this.resizingTile.height = newHeight;

      this.renderPlacedTiles();
    };

    const onMouseUp = () => {
      this.isResizing = false;
      this.resizingTile = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Supprime une tuile
   */
  private removeTile(id: string): void {
    this.state.placedTiles = this.state.placedTiles.filter(t => t.id !== id);
    this.renderPlacedTiles();
  }

  /**
   * Met à jour la taille des tuiles
   */
  public updateTileSize(): void {
    const input = document.getElementById('tileSize') as HTMLInputElement;
    this.state.tileSize = parseInt(input.value) || 60;
    this.renderPlacedTiles();
  }

  /**
   * Définit la taille d'accrochage à la grille
   */
  public setSnap(size: number): void {
    this.state.snapSize = size;

    // Update UI
    document.querySelectorAll('.snap-option').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-snap') || '0') === size);
    });
  }

  /**
   * Nouveau layout vide
   */
  public newLayout(): void {
    if (this.state.placedTiles.length > 0) {
      if (!confirm('Effacer le layout actuel ?')) return;
    }
    this.state.placedTiles = [];
    this.renderPlacedTiles();
  }

  /**
   * Efface toutes les cases
   */
  public clearBoard(): void {
    if (!confirm('Effacer toutes les cases ?')) return;
    this.state.placedTiles = [];
    this.renderPlacedTiles();
  }

  /**
   * Affiche le modal de sauvegarde
   */
  public saveLayout(): void {
    this.saveModal.classList.add('active');
    const input = document.getElementById('layoutName') as HTMLInputElement;
    input.value = '';
    input.focus();
  }

  /**
   * Ferme le modal de sauvegarde
   */
  public closeSaveModal(): void {
    this.saveModal.classList.remove('active');
  }

  /**
   * Confirme la sauvegarde
   */
  public confirmSave(): void {
    const input = document.getElementById('layoutName') as HTMLInputElement;
    const name = input.value.trim();

    if (!name) {
      alert('Veuillez entrer un nom pour le layout');
      return;
    }

    if (!this.confirmDespiteErrors(this.validateBoard(), 'Sauvegarder')) return;

    const config = this.generateConfig();

    const layout: SavedLayout = {
      name,
      timestamp: Date.now(),
      config
    };

    const existingIndex = this.state.savedLayouts.findIndex(l => l.name === name);
    if (existingIndex >= 0) {
      if (!confirm(`Le layout "${name}" existe déjà. Remplacer ?`)) return;
      this.state.savedLayouts[existingIndex] = layout;
    } else {
      this.state.savedLayouts.push(layout);
    }

    this.saveSavedLayouts();
    this.closeSaveModal();
    this.renderLayoutsList();

    alert(`Layout "${name}" sauvegardé !`);
  }

  /**
   * Affiche en continu si le plateau est jouable, pour qu'on le sache en
   * construisant plutôt qu'au moment d'exporter.
   */
  private updateBoardStatus(): void {
    const el = document.getElementById('boardStatus');
    if (!el) return;

    const errors = this.validateBoard();
    if (errors.length === 0) {
      el.textContent = '✓ Plateau jouable';
      el.className = 'board-status is-valid';
      el.title = ''; // sinon l'infobulle garde les erreurs déjà corrigées
    } else {
      el.textContent = `⚠ ${errors.length} problème${errors.length > 1 ? 's' : ''}`;
      el.className = 'board-status is-invalid';
      el.title = errors.join('\n');
    }
  }

  /**
   * Vérifie qu'un plateau est jouable : il lui faut exactement un départ et
   * au moins une arrivée, sans quoi la partie n'a ni point de lancement ni
   * condition de victoire.
   *
   * Les types sont cherchés dans TILE_CONFIGS plutôt que par un identifiant
   * en dur : si l'ordre des cases change, la validation suit.
   */
  private validateBoard(): string[] {
    const errors: string[] = [];
    const placed = this.state.placedTiles.filter((t) => t.tileId < 100);

    if (placed.length === 0) {
      return ['Le plateau est vide : ajoutez au moins une case de départ et une arrivée.'];
    }

    const countByType = (type: string) =>
      placed.filter((t) => TILE_CONFIGS[t.tileId]?.type === type).length;

    const starts = countByType('start');
    const finishes = countByType('finish');

    if (starts === 0) {
      errors.push('Il manque une case de départ (START) : la partie ne peut pas commencer.');
    } else if (starts > 1) {
      errors.push(`Il y a ${starts} cases de départ : gardez-en une seule.`);
    }

    if (finishes === 0) {
      errors.push("Il manque une case d'arrivée : la partie ne pourrait jamais se terminer.");
    }

    return errors;
  }

  /**
   * Affiche les erreurs de validation et demande si l'on veut continuer.
   * Retourne true si l'on peut poursuivre l'action.
   */
  private confirmDespiteErrors(errors: string[], action: string): boolean {
    if (errors.length === 0) return true;

    const list = errors.map((e) => `• ${e}`).join('\n');
    return confirm(
      `Ce plateau n'est pas jouable :\n\n${list}\n\n${action} quand même ?`
    );
  }

  /**
   * Génère la configuration à partir de l'état
   */
  private generateConfig(): BoardLayoutConfig {
    const exportTileSize = parseInt((document.getElementById('exportTileSize') as HTMLInputElement).value) || 120;
    const exportTileGap = parseInt((document.getElementById('exportTileGap') as HTMLInputElement).value) || 15;

    // Formule inverse de loadConfig() :
    // loadConfig: scale = tileSize / exportTileSize
    //             gap = exportTileGap * scale
    //             x = gridCol * (tileSize + gap)
    // Donc: gridCol = x / (tileSize + gap)
    const scale = this.state.tileSize / exportTileSize;
    const gap = exportTileGap * scale;
    const editorTileStep = this.state.tileSize + gap;

    const placements: TilePlacement[] = this.state.placedTiles
      .filter(tile => tile.tileId < 100) // Exclure les pouvoirs des dieux pour les placements
      .map((tile) => {
        // Convertir la position pixel de l'éditeur en position de grille
        const gridCol = Math.round(tile.x / editorTileStep);
        const gridRow = Math.round(tile.y / editorTileStep);

        return {
          tileId: tile.tileId,
          gridRow,
          gridCol,
          size: 'full' as const
        };
      });

    // Calculer la grille nécessaire
    const maxRow = placements.length > 0 ? Math.max(...placements.map(p => p.gridRow)) + 1 : 1;
    const maxCol = placements.length > 0 ? Math.max(...placements.map(p => p.gridCol)) + 1 : 1;

    return {
      gridRows: Math.max(maxRow, 1),
      gridCols: Math.max(maxCol, 1),
      tileSize: exportTileSize,
      tileGap: exportTileGap,
      placements
    };
  }

  /**
   * Exporte le layout en JSON
   */
  public exportJson(): void {
    if (!this.confirmDespiteErrors(this.validateBoard(), 'Exporter')) return;

    const config = this.generateConfig();
    const json = JSON.stringify(config, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'board-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Importe un layout depuis un fichier JSON
   */
  public importJson(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text) as BoardLayoutConfig;

        if (!config.placements || !Array.isArray(config.placements)) {
          throw new Error('Format de fichier invalide');
        }

        this.loadConfig(config);
        alert('Layout importé avec succès !');
      } catch (error) {
        alert(`Erreur d'importation: ${(error as Error).message}`);
      }
    };

    input.click();
  }

  /**
   * Charge une configuration
   */
  private loadConfig(config: BoardLayoutConfig): void {
    // Convertir les placements en positions pixel
    const scale = this.state.tileSize / (config.tileSize || 120);
    const gap = (config.tileGap || 15) * scale;

    this.state.placedTiles = config.placements.map(placement => ({
      id: `tile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tileId: placement.tileId,
      x: placement.gridCol * (this.state.tileSize + gap),
      y: placement.gridRow * (this.state.tileSize + gap),
      rotation: 0,
      width: this.state.tileSize,
      height: this.state.tileSize
    }));

    this.renderPlacedTiles();
  }

  /**
   * Affiche la liste des layouts sauvegardés
   */
  private renderLayoutsList(): void {
    this.layoutsList.innerHTML = '';

    if (this.state.savedLayouts.length === 0) {
      this.layoutsList.innerHTML = '<p style="color: #888; font-size: 12px;">Aucun layout sauvegardé</p>';
      return;
    }

    this.state.savedLayouts.forEach((layout, index) => {
      const item = document.createElement('div');
      item.className = 'layout-item';

      const date = new Date(layout.timestamp);
      const dateStr = date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      item.innerHTML = `
        <div>
          <div class="layout-name">${layout.name}</div>
          <div style="font-size: 10px; color: #888;">${dateStr} - ${layout.config.placements.length} cases</div>
        </div>
        <div class="layout-actions">
          <button class="btn-primary" onclick="editor.loadLayout(${index})">Charger</button>
          <button class="btn-danger" onclick="editor.deleteLayout(${index})">×</button>
        </div>
      `;

      this.layoutsList.appendChild(item);
    });
  }

  /**
   * Charge un layout sauvegardé
   */
  public loadLayout(index: number): void {
    const layout = this.state.savedLayouts[index];
    if (!layout) return;

    if (this.state.placedTiles.length > 0) {
      if (!confirm(`Charger le layout "${layout.name}" ? Le layout actuel sera perdu.`)) return;
    }

    this.loadConfig(layout.config);
  }

  /**
   * Supprime un layout sauvegardé
   */
  public deleteLayout(index: number): void {
    const layout = this.state.savedLayouts[index];
    if (!layout) return;

    if (!confirm(`Supprimer le layout "${layout.name}" ?`)) return;

    this.state.savedLayouts.splice(index, 1);
    this.saveSavedLayouts();
    this.renderLayoutsList();
  }

  /**
   * Sauvegarde les layouts dans localStorage
   */
  private saveSavedLayouts(): void {
    localStorage.setItem('schmitt-board-layouts', JSON.stringify(this.state.savedLayouts));
  }

  /**
   * Charge les layouts depuis localStorage
   */
  private loadSavedLayouts(): void {
    const data = localStorage.getItem('schmitt-board-layouts');
    if (data) {
      try {
        this.state.savedLayouts = JSON.parse(data);
      } catch {
        this.state.savedLayouts = [];
      }
    }
  }

  /**
   * Zoom avant
   */
  public zoomIn(): void {
    this.state.zoom = Math.min(3, this.state.zoom + 0.1);
    this.applyZoom();
  }

  /**
   * Zoom arrière
   */
  public zoomOut(): void {
    this.state.zoom = Math.max(0.25, this.state.zoom - 0.1);
    this.applyZoom();
  }

  /**
   * Reset zoom
   */
  public resetZoom(): void {
    this.state.zoom = 1;
    this.applyZoom();
  }

  /**
   * Applique le niveau de zoom
   */
  private applyZoom(): void {
    this.fineGrid.style.transform = `scale(${this.state.zoom})`;
    this.fineGrid.style.transformOrigin = '0 0';
    this.zoomLevelEl.textContent = `${Math.round(this.state.zoom * 100)}%`;
  }

  /**
   * Configure les contrôles souris style Anno
   * - Pan avec clic droit ou molette (clic milieu)
   * - Zoom avec molette souris
   */
  private setupMouseControls(): void {
    // Empêcher le menu contextuel sur clic droit
    this.gridContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Début du pan avec clic droit (button 2) ou clic milieu (button 1)
    this.gridContainer.addEventListener('mousedown', (e) => {
      // Clic droit (2) ou clic milieu (1)
      if (e.button === 2 || e.button === 1) {
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.gridContainer.style.cursor = 'grabbing';
      }
    });

    // Mouvement pendant le pan
    this.gridContainer.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;

        this.gridContainer.scrollLeft -= dx;
        this.gridContainer.scrollTop -= dy;

        this.panStart = { x: e.clientX, y: e.clientY };
      }
    });

    // Fin du pan
    this.gridContainer.addEventListener('mouseup', (e) => {
      if (e.button === 2 || e.button === 1) {
        this.isPanning = false;
        this.gridContainer.style.cursor = '';
      }
    });

    // Fin du pan si la souris sort du container
    this.gridContainer.addEventListener('mouseleave', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.gridContainer.style.cursor = '';
      }
    });

    // Zoom avec la molette
    this.gridContainer.addEventListener('wheel', (e) => {
      // Seulement si Ctrl est pressé ou si c'est un zoom intentionnel
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        if (e.deltaY < 0) {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
      } else {
        // Sans Ctrl: zoom direct avec la molette (style Anno)
        e.preventDefault();

        // Zoom plus fin avec la molette
        const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
        this.state.zoom = Math.max(0.25, Math.min(3, this.state.zoom + zoomDelta));
        this.applyZoom();
      }
    }, { passive: false });
  }
}

// Créer l'instance globale
const editor = new BoardEditor();

// Exposer globalement pour les boutons HTML
(window as unknown as { editor: BoardEditor }).editor = editor;

export { editor };
