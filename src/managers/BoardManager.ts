import { Player } from '@models/Player';
import { Tile, TileData } from '@models/Tile';
import { BOARD_SIZE, BOARD_CONFIG } from '@utils/constants';

/**
 * Gestionnaire du plateau de jeu
 * Gère le rendu du plateau sur canvas et la position des joueurs
 */
export class BoardManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tiles: Tile[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.initTiles();
  }

  /**
   * Initialise les cases du plateau
   */
  private initTiles(): void {
    this.tiles = BOARD_CONFIG.map((config, index) => {
      return new Tile(index, config);
    });
  }

  /**
   * Charge les données des cases depuis le JSON
   */
  async loadTileData(tilesData: TileData[]): Promise<void> {
    tilesData.forEach(data => {
      const tile = this.tiles[data.id];
      if (tile) {
        tile.effect = data.effect;
        tile.image = data.image;
      }
    });
  }

  /**
   * Récupère une case par son index
   */
  getTile(index: number): Tile | undefined {
    return this.tiles[index];
  }

  /**
   * Redimensionne le canvas
   */
  resize(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    const size = Math.min(
      container.clientWidth - 40,
      container.clientHeight - 40
    );
    this.canvas.width = size;
    this.canvas.height = size;
  }

  /**
   * Dessine le plateau de jeu
   */
  drawBoard(players: Player[]): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = this.canvas.width * 0.35;

    // Fond du plateau
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const bgGradient = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius * 1.5
    );
    bgGradient.addColorStop(0, '#f8f9fa');
    bgGradient.addColorStop(1, '#e9ecef');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Dessiner les cases
    this.drawTiles(centerX, centerY, radius);

    // Titre central
    this.drawCenterText(centerX, centerY);

    // Dessiner les joueurs
    this.drawPlayers(players, centerX, centerY, radius);
  }

  /**
   * Dessine les cases du plateau
   */
  private drawTiles(centerX: number, centerY: number, radius: number): void {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const angle = (i / BOARD_SIZE) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const tile = this.tiles[i];

      // Dessiner le cercle de la case
      this.ctx.beginPath();
      this.ctx.arc(x, y, 18, 0, Math.PI * 2);

      // Couleur selon le type de case
      switch (tile.type) {
        case 'start':
          this.ctx.fillStyle = '#2ecc71';
          break;
        case 'power':
          this.ctx.fillStyle = '#f39c12';
          break;
        case 'temple':
          this.ctx.fillStyle = '#9b59b6';
          break;
        default:
          this.ctx.fillStyle = '#fff';
      }
      this.ctx.fill();

      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Dessiner l'icône
      if (tile.icon) {
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#000';
        this.ctx.fillText(tile.icon, x, y);
      }
    }
  }

  /**
   * Dessine le texte central
   */
  private drawCenterText(centerX: number, centerY: number): void {
    this.ctx.fillStyle = '#667eea';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('SCHMITT', centerX, centerY - 10);
    this.ctx.font = '16px Arial';
    this.ctx.fillText('ODYSSÉE', centerX, centerY + 15);
  }

  /**
   * Dessine les joueurs sur le plateau
   */
  private drawPlayers(
    players: Player[],
    centerX: number,
    centerY: number,
    radius: number
  ): void {
    players.forEach((player) => {
      const visualPosition = player.position;
      const angle = (visualPosition / BOARD_SIZE) * Math.PI * 2 - Math.PI / 2;
      const baseX = centerX + Math.cos(angle) * radius;
      const baseY = centerY + Math.sin(angle) * radius;

      // Décalage pour plusieurs joueurs sur la même case
      const playersOnCase = players.filter(p => p.position === player.position);
      const offset = playersOnCase.indexOf(player);
      const totalOnCase = playersOnCase.length;
      const offsetAngle = (offset - (totalOnCase - 1) / 2) * 0.3;

      const x = baseX + Math.cos(angle + offsetAngle) * 25;
      const y = baseY + Math.sin(angle + offsetAngle) * 25;

      // Dessiner le pion du joueur
      this.ctx.beginPath();
      this.ctx.arc(x, y, 12, 0, Math.PI * 2);
      this.ctx.fillStyle = player.color;
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Indicateur de pouvoir Schmitt
      if (player.hasSchmittPower) {
        this.ctx.fillStyle = '#f39c12';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('👑', x, y - 20);
      }

      // Flèche pour le mode retour
      if (player.isReturning) {
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.fillText('⬅️', x + 15, y - 15);
      }
    });
  }

  /**
   * Calcule la position x,y d'une case sur le canvas
   */
  getTilePosition(tileIndex: number): { x: number; y: number } {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = this.canvas.width * 0.35;

    const angle = (tileIndex / BOARD_SIZE) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    return { x, y };
  }
}
