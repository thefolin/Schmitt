import type { Player } from '@/core/models/Player';
import type { TileConfig } from '@/core/models/Tile';
import { LayoutFactory, type LayoutType, type TilePosition } from '../board.layouts';

/**
 * Rendu 3D isométrique du plateau (style Monopoly GO)
 * Utilise CSS 3D transforms pour la performance mobile
 */
export class Board3DRenderer {
  private container: HTMLElement;
  private currentLayout: LayoutType = 'circle';
  private tilePositions: TilePosition[] = [];
  private tileElements: Map<number, HTMLElement> = new Map();
  private pawnElements: Map<number, HTMLElement> = new Map();

  constructor(containerId: string = 'board3d') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} non trouvé - le renderer 3D sera désactivé`);
      // Créer un conteneur temporaire pour éviter les erreurs
      this.container = document.createElement('div');
      this.container.id = containerId;
      return;
    }
    this.container = container;
    this.init3DScene();
  }

  /**
   * Initialise la scène 3D
   */
  private init3DScene(): void {
    this.container.innerHTML = '';
    this.container.className = 'board-3d-scene';
  }

  /**
   * Change le layout du plateau
   */
  public setLayout(layoutType: LayoutType): void {
    this.currentLayout = layoutType;
  }

  /**
   * Dessine le plateau complet en 3D
   */
  public render(tiles: TileConfig[], players: Player[]): void {
    // Calculer les positions selon le layout
    const layout = LayoutFactory.getLayout(this.currentLayout);
    this.tilePositions = layout.calculatePositions(
      tiles.length,
      this.container.clientWidth,
      this.container.clientHeight
    );

    // Créer ou mettre à jour les cases 3D
    this.renderTiles3D(tiles);

    // Créer ou mettre à jour les pions 3D
    this.renderPlayers3D(players);
  }

  /**
   * Rend les cases en 3D
   */
  private renderTiles3D(tiles: TileConfig[]): void {
    tiles.forEach((tile, index) => {
      const pos = this.tilePositions[index];
      if (!pos) return;

      let tileEl = this.tileElements.get(index);

      if (!tileEl) {
        // Créer une nouvelle case 3D
        tileEl = this.createTile3D(tile, index, pos);
        this.container.appendChild(tileEl);
        this.tileElements.set(index, tileEl);
      } else {
        // Mettre à jour la position
        this.updateTilePosition(tileEl, pos);
      }
    });
  }

  /**
   * Crée une case 3D
   */
  private createTile3D(tile: TileConfig, index: number, pos: TilePosition): HTMLElement {
    const tileEl = document.createElement('div');
    tileEl.className = 'tile-3d';
    tileEl.dataset.tileIndex = index.toString();
    tileEl.dataset.tileType = tile.type;

    // Structure 3D : conteneur + faces
    tileEl.innerHTML = `
      <div class="tile-3d-inner">
        <div class="tile-face tile-top">
          <div class="tile-icon">${tile.icon}</div>
          ${index === 0 || index === 20 ? `<div class="tile-number">${index}</div>` : ''}
        </div>
        <div class="tile-face tile-front"></div>
        <div class="tile-face tile-back"></div>
        <div class="tile-face tile-left"></div>
        <div class="tile-face tile-right"></div>
        <div class="tile-face tile-bottom"></div>
      </div>
    `;

    this.updateTilePosition(tileEl, pos);
    return tileEl;
  }

  /**
   * Met à jour la position d'une case
   */
  private updateTilePosition(tileEl: HTMLElement, pos: TilePosition): void {
    const { x, y } = pos;

    tileEl.style.transform = `
      translate3d(${x}px, ${y}px, 0px)
      rotateX(60deg)
      rotateZ(45deg)
    `;
  }

  /**
   * Rend les joueurs en 3D
   */
  private renderPlayers3D(players: Player[]): void {
    players.forEach((player) => {
      let pawnEl = this.pawnElements.get(player.index);

      if (!pawnEl) {
        // Créer un nouveau pion 3D
        pawnEl = this.createPawn3D(player);
        this.container.appendChild(pawnEl);
        this.pawnElements.set(player.index, pawnEl);
      }

      // Mettre à jour la position du pion
      this.updatePawnPosition(pawnEl, player, players);
    });
  }

  /**
   * Crée un pion 3D
   */
  private createPawn3D(player: Player): HTMLElement {
    const pawnEl = document.createElement('div');
    pawnEl.className = 'pawn-3d';
    pawnEl.dataset.playerIndex = player.index.toString();
    pawnEl.style.setProperty('--player-color', player.color);

    pawnEl.innerHTML = `
      <div class="pawn-3d-inner">
        <div class="pawn-body"></div>
        <div class="pawn-shadow"></div>
        ${player.hasSchmittPower ? '<div class="pawn-power">⚡</div>' : ''}
      </div>
    `;

    return pawnEl;
  }

  /**
   * Met à jour la position d'un pion avec animation
   */
  private updatePawnPosition(pawnEl: HTMLElement, player: Player, allPlayers: Player[]): void {
    const tilePos = this.tilePositions[player.position];
    if (!tilePos) return;

    // Calculer le décalage si plusieurs joueurs sur la même case
    const playersOnSameTile = allPlayers.filter(p => p.position === player.position);
    const indexOnTile = playersOnSameTile.indexOf(player);
    const totalOnTile = playersOnSameTile.length;

    const offsetX = (indexOnTile - (totalOnTile - 1) / 2) * 25;
    const offsetY = (indexOnTile - (totalOnTile - 1) / 2) * 25;

    // Position 3D isométrique
    pawnEl.style.transform = `
      translate3d(${tilePos.x + offsetX}px, ${tilePos.y + offsetY}px, 40px)
      rotateX(60deg)
      rotateZ(45deg)
    `;

    // Mettre à jour le pouvoir Schmitt
    const powerEl = pawnEl.querySelector('.pawn-power');
    if (player.hasSchmittPower && !powerEl) {
      pawnEl.querySelector('.pawn-3d-inner')?.insertAdjacentHTML('beforeend', '<div class="pawn-power">⚡</div>');
    } else if (!player.hasSchmittPower && powerEl) {
      powerEl.remove();
    }
  }

  /**
   * Anime le déplacement d'un pion (effet "saut" style Monopoly GO)
   */
  public animatePawnMove(playerIndex: number, _fromPos: number, _toPos: number, duration: number = 800): Promise<void> {
    return new Promise((resolve) => {
      const pawnEl = this.pawnElements.get(playerIndex);
      if (!pawnEl) {
        resolve();
        return;
      }

      // Animation de saut
      pawnEl.classList.add('pawn-jumping');

      setTimeout(() => {
        pawnEl.classList.remove('pawn-jumping');
        resolve();
      }, duration);
    });
  }

  /**
   * Crée des particules d'effet (pour événements spéciaux)
   */
  public createParticles(position: number, type: 'gold' | 'power' | 'drink'): void {
    const tilePos = this.tilePositions[position];
    if (!tilePos) return;

    const particleContainer = document.createElement('div');
    particleContainer.className = `particles particles-${type}`;
    particleContainer.style.transform = `translate3d(${tilePos.x}px, ${tilePos.y}px, 50px)`;

    // Créer 20 particules
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.setProperty('--angle', `${(i / 20) * 360}deg`);
      particle.style.setProperty('--delay', `${i * 0.05}s`);
      particleContainer.appendChild(particle);
    }

    this.container.appendChild(particleContainer);

    // Supprimer après l'animation
    setTimeout(() => {
      particleContainer.remove();
    }, 2000);
  }

  /**
   * Redimensionner le plateau
   */
  public resize(): void {
    // Le CSS 3D s'adapte automatiquement via les % et vh/vw
  }

  /**
   * Nettoyer les ressources
   */
  public destroy(): void {
    this.tileElements.clear();
    this.pawnElements.clear();
    this.container.innerHTML = '';
  }
}
