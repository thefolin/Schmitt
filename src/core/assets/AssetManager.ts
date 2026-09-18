/**
 * Gestionnaire d'assets customisables
 * Permet de charger des images personnalisées pour :
 * - Pions des joueurs
 * - Icônes des cases
 * - Icônes des pouvoirs
 * - Arrière-plans
 */

export interface AssetConfig {
  id: string;
  type: 'pawn' | 'tile' | 'power' | 'background';
  source: 'emoji' | 'image' | 'svg';
  value: string; // Emoji, URL, ou SVG path
}

export class AssetManager {
  private assets: Map<string, AssetConfig> = new Map();
  private loadedImages: Map<string, HTMLImageElement> = new Map();

  /**
   * Enregistre un asset
   */
  public registerAsset(asset: AssetConfig): void {
    this.assets.set(asset.id, asset);

    // Précharger les images
    if (asset.source === 'image') {
      this.loadImage(asset.id, asset.value);
    }
  }

  /**
   * Enregistre plusieurs assets
   */
  public registerAssets(assets: AssetConfig[]): void {
    assets.forEach(asset => this.registerAsset(asset));
  }

  /**
   * Obtient un asset
   */
  public getAsset(id: string): AssetConfig | undefined {
    return this.assets.get(id);
  }

  /**
   * Obtient une image chargée
   */
  public getImage(id: string): HTMLImageElement | undefined {
    return this.loadedImages.get(id);
  }

  /**
   * Charge une image
   */
  private loadImage(id: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedImages.set(id, img);
        resolve();
      };
      img.onerror = () => {
        console.error(`Impossible de charger l'image: ${url}`);
        reject();
      };
      img.src = url;
    });
  }

  /**
   * Dessine un asset sur le canvas
   */
  public drawAsset(
    ctx: CanvasRenderingContext2D,
    assetId: string,
    x: number,
    y: number,
    size: number
  ): void {
    const asset = this.getAsset(assetId);
    if (!asset) {
      console.warn(`Asset non trouvé: ${assetId}`);
      return;
    }

    switch (asset.source) {
      case 'emoji':
        this.drawEmoji(ctx, asset.value, x, y, size);
        break;
      case 'image':
        this.drawImage(ctx, assetId, x, y, size);
        break;
      case 'svg':
        // TODO: Implémenter le rendu SVG
        console.warn('Rendu SVG pas encore implémenté');
        break;
    }
  }

  /**
   * Dessine un emoji
   */
  private drawEmoji(
    ctx: CanvasRenderingContext2D,
    emoji: string,
    x: number,
    y: number,
    size: number
  ): void {
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
  }

  /**
   * Dessine une image
   */
  private drawImage(
    ctx: CanvasRenderingContext2D,
    assetId: string,
    x: number,
    y: number,
    size: number
  ): void {
    const img = this.getImage(assetId);
    if (!img) {
      console.warn(`Image non chargée: ${assetId}`);
      return;
    }

    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  /**
   * Charge les assets par défaut
   */
  public loadDefaultAssets(): void {
    // Assets des cases (emojis par défaut)
    const defaultTileAssets: AssetConfig[] = [
      { id: 'tile-start', type: 'tile', source: 'emoji', value: '🏁' },
      { id: 'tile-drink', type: 'tile', source: 'emoji', value: '🍺' },
      { id: 'tile-power', type: 'tile', source: 'emoji', value: '⚡' },
      { id: 'tile-temple', type: 'tile', source: 'emoji', value: '🏛️' },
      { id: 'tile-give', type: 'tile', source: 'emoji', value: '🎁' },
      { id: 'tile-back', type: 'tile', source: 'emoji', value: '⏪' },
      { id: 'tile-forward', type: 'tile', source: 'emoji', value: '⏩' },
      { id: 'tile-replay', type: 'tile', source: 'emoji', value: '🔄' },
      { id: 'tile-skip', type: 'tile', source: 'emoji', value: '⏭️' },
      { id: 'tile-lucky', type: 'tile', source: 'emoji', value: '🍀' },
      { id: 'tile-waterfall', type: 'tile', source: 'emoji', value: '🌊' },
      { id: 'tile-finish', type: 'tile', source: 'emoji', value: '🏆' }
    ];

    // Assets des pions (emojis par défaut)
    const defaultPawnAssets: AssetConfig[] = [
      { id: 'pawn-default', type: 'pawn', source: 'emoji', value: '🔴' }
    ];

    // Assets des pouvoirs
    const defaultPowerAssets: AssetConfig[] = [
      // ⚡ appartient à Zeus. Le pouvoir du Schmitt le portait aussi, et un
      // testeur a lu « Zeus » sur le pion qui l'affichait, puis signalé comme
      // un bug l'absence de l'effet de Zeus. Deux pouvoirs, deux symboles.
      { id: 'power-schmitt', type: 'power', source: 'emoji', value: '🏆' },
      { id: 'power-zeus', type: 'power', source: 'emoji', value: '⚡' },
      { id: 'power-poseidon', type: 'power', source: 'emoji', value: '🔱' },
      { id: 'power-athena', type: 'power', source: 'emoji', value: '🛡️' }
    ];

    this.registerAssets([
      ...defaultTileAssets,
      ...defaultPawnAssets,
      ...defaultPowerAssets
    ]);
  }

  /**
   * Remplace un asset (pour customisation)
   * Exemple : remplacer l'emoji par une image custom
   */
  public replaceAsset(id: string, newValue: string, newSource: 'emoji' | 'image' | 'svg'): void {
    const asset = this.getAsset(id);
    if (!asset) {
      console.warn(`Asset non trouvé: ${id}`);
      return;
    }

    asset.source = newSource;
    asset.value = newValue;

    // Recharger l'image si nécessaire
    if (newSource === 'image') {
      this.loadImage(id, newValue);
    }
  }
}

// Instance globale (singleton)
export const assetManager = new AssetManager();
