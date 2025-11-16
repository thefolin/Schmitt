import type { Player } from '@/core/models/Player';
import type { TileConfig } from '@/core/models/Tile';
import { LayoutFactory, type LayoutType, type TilePosition } from './board.layouts';

/**
 * Rendu du plateau (Canvas)
 * Sépare complètement le rendu visuel de la logique
 */
export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentLayout: LayoutType = 'circle';
  private tilePositions: TilePosition[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context non disponible');
    this.ctx = ctx;
  }

  /**
   * Change le layout du plateau
   */
  public setLayout(layoutType: LayoutType): void {
    this.currentLayout = layoutType;
  }

  /**
   * Dessine le plateau complet
   */
  public render(tiles: TileConfig[], players: Player[]): void {
    // Effacer le canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculer les positions selon le layout actuel
    const layout = LayoutFactory.getLayout(this.currentLayout);
    this.tilePositions = layout.calculatePositions(
      tiles.length,
      this.canvas.width,
      this.canvas.height
    );

    // Dessiner les cases
    this.drawTiles(tiles);

    // Dessiner les joueurs
    this.drawPlayers(players);
  }

  /**
   * Dessine les cases
   */
  private drawTiles(tiles: TileConfig[]): void {
    const tileRadius = 20;

    tiles.forEach((tile, index) => {
      const pos = this.tilePositions[index];
      if (!pos) return;

      // Cercle de fond
      this.ctx.fillStyle = this.getTileColor(tile.type);
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, tileRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Bordure
      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Icône (emoji)
      this.ctx.font = '20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText(tile.icon, pos.x, pos.y);

      // Numéro de case (optionnel)
      if (index === 0 || index === tiles.length - 1) {
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(index.toString(), pos.x, pos.y + tileRadius + 12);
      }
    });
  }

  /**
   * Dessine les joueurs (pions)
   */
  private drawPlayers(players: Player[]): void {
    const pawnRadius = 12;
    const offsetDistance = 18; // Distance du centre de la case

    players.forEach((player) => {
      const tilePos = this.tilePositions[player.position];
      if (!tilePos) return;

      // Décalage pour éviter superposition (si plusieurs joueurs sur même case)
      const playersOnSameTile = players.filter(p => p.position === player.position);
      const indexOnTile = playersOnSameTile.indexOf(player);
      const totalOnTile = playersOnSameTile.length;

      // Calculer la position décalée
      const angleOffset = (indexOnTile - (totalOnTile - 1) / 2) * (Math.PI / 6);
      const x = tilePos.x + Math.cos(angleOffset) * offsetDistance;
      const y = tilePos.y + Math.sin(angleOffset) * offsetDistance;

      // Pion du joueur
      this.ctx.fillStyle = player.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, pawnRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Bordure
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Indicateur Schmitt Power
      if (player.hasSchmittPower) {
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⚡', x, y);
      }
    });
  }

  /**
   * Couleur selon le type de case
   */
  private getTileColor(type: string): string {
    const colors: Record<string, string> = {
      start: '#2ecc71',
      finish: '#f39c12',
      drink_2: '#e74c3c',
      drink_3: '#c0392b',
      drink_4: '#8e44ad',
      drink_5: '#6c3483',
      give_2: '#3498db',
      give_3: '#2980b9',
      give_4: '#1abc9c',
      power: '#f1c40f',
      temple: '#d4af37',
      back_2: '#95a5a6',
      back_3: '#7f8c8d',
      forward_2: '#16a085',
      replay: '#27ae60',
      skip_turn: '#34495e',
      everyone_drinks: '#e67e22',
      choose_player: '#9b59b6',
      waterfall: '#1abc9c',
      lucky: '#f39c12'
    };

    return colors[type] || '#bdc3c7';
  }

  /**
   * Obtenir la position d'une case (pour animations custom)
   */
  public getTilePosition(tileIndex: number): TilePosition | undefined {
    return this.tilePositions[tileIndex];
  }

  /**
   * Redimensionner le canvas
   */
  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
