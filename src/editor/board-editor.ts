/**
 * Éditeur visuel de plateau amélioré
 * - Panneaux latéraux repliables (pin/unpin)
 * - Grille fine pour placement précis
 * - Drag & drop avec preview
 * - Déplacement des tuiles placées
 */

import { TILE_CONFIGS } from '@/features/tiles/tile.config';
import type { BoardLayoutConfig, TilePlacement } from '@/features/board/camera/board-layout.config';

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
    name: 'Jugement Dernier',
    icon: '🎲',
    description: 'Conservez 1 des 2 dés et relancez l\'autre en fonction des faveurs souhaitées. Attention à la colère des Dieux !',
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
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
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
      tileItem.title = `${tile.name}\n${tile.description || ''}`;

      tileItem.innerHTML = `
        ${tile.image
          ? `<img src="/${tile.image}" alt="${tile.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
             <span style="display:none; font-size: 24px;">${tile.icon}</span>`
          : `<span style="font-size: 24px;">${tile.icon}</span>`
        }
        <div class="tile-info">
          <div class="tile-name">${tile.name}</div>
          <div class="tile-id">#${index}</div>
        </div>
      `;

      tileItem.addEventListener('dragstart', (e) => this.onTileDragStart(e, index));
      tileItem.addEventListener('dragend', () => this.onDragEnd());

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
      tileItem.title = `${power.name}\n${power.description}`;

      tileItem.innerHTML = `
        ${power.image
          ? `<img src="/${power.image}" alt="${power.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
             <span style="display:none; font-size: 24px;">${power.icon}</span>`
          : `<span style="font-size: 24px;">${power.icon}</span>`
        }
        <div class="tile-info">
          <div class="tile-name">${power.name}</div>
          <div class="tile-id">Faveur</div>
        </div>
      `;

      tileItem.addEventListener('dragstart', (e) => this.onTileDragStart(e, power.id));
      tileItem.addEventListener('dragend', () => this.onDragEnd());

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

    // Track mouse position for info bar
    gridContainer.addEventListener('mousemove', (e) => {
      const rect = this.fineGrid.getBoundingClientRect();
      const x = Math.floor(e.clientX - rect.left);
      const y = Math.floor(e.clientY - rect.top);
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
   * Met à jour la position du ghost de placement
   */
  private updatePlacementGhost(e: DragEvent): void {
    const rect = this.fineGrid.getBoundingClientRect();
    let x = e.clientX - rect.left - this.state.tileSize / 2;
    let y = e.clientY - rect.top - this.state.tileSize / 2;

    // Snap to grid
    x = Math.round(x / this.state.snapSize) * this.state.snapSize;
    y = Math.round(y / this.state.snapSize) * this.state.snapSize;

    // Clamp to bounds
    x = Math.max(0, Math.min(x, this.state.gridCols * 20 - this.state.tileSize));
    y = Math.max(0, Math.min(y, this.state.gridRows * 20 - this.state.tileSize));

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
    const rect = this.fineGrid.getBoundingClientRect();
    let x = e.clientX - rect.left - this.state.tileSize / 2;
    let y = e.clientY - rect.top - this.state.tileSize / 2;

    // Snap to grid
    x = Math.round(x / this.state.snapSize) * this.state.snapSize;
    y = Math.round(y / this.state.snapSize) * this.state.snapSize;

    // Clamp to bounds
    x = Math.max(0, Math.min(x, this.state.gridCols * 20 - this.state.tileSize));
    y = Math.max(0, Math.min(y, this.state.gridRows * 20 - this.state.tileSize));

    if (this.draggedPlacedTile) {
      // Déplacer une tuile existante
      this.draggedPlacedTile.x = x;
      this.draggedPlacedTile.y = y;
    } else if (this.draggedTileId !== null) {
      // Nouvelle tuile
      const tile: PlacedTile = {
        id: `tile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tileId: this.draggedTileId,
        x,
        y,
        rotation: 0,
        width: this.state.tileSize,
        height: this.state.tileSize
      };
      this.state.placedTiles.push(tile);
    }

    this.renderPlacedTiles();
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
        ? `${godPower!.name}\n${godPower!.description}`
        : `${tileConfig!.name}\n${tileConfig!.description || ''}`;
      el.title = tooltipText;

      // Contenu selon le type
      const displayName = isGodPower ? godPower!.name : tileConfig!.name;
      const displayIcon = isGodPower ? godPower!.icon : tileConfig!.icon;
      const displayId = isGodPower ? godPower!.name : `#${tile.tileId}`;
      const displayImage = isGodPower ? godPower!.image : tileConfig!.image;

      el.innerHTML = `
        <div class="tile-controls">
          <button class="tile-control-btn" data-action="rotate-left" title="Rotation gauche">↺</button>
          <button class="tile-control-btn" data-action="rotate-right" title="Rotation droite">↻</button>
        </div>
        ${displayImage
          ? `<img src="/${displayImage}" alt="${displayName}" onerror="this.style.display='none'">`
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

      // Boutons de rotation
      el.querySelectorAll('.tile-control-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = (btn as HTMLElement).dataset.action;
          if (action === 'rotate-left') {
            tile.rotation = (tile.rotation - 90 + 360) % 360;
          } else if (action === 'rotate-right') {
            tile.rotation = (tile.rotation + 90) % 360;
          }
          this.renderPlacedTiles();
        });
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
