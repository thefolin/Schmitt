/**
 * Système de caméra pour le plateau de jeu
 * Gère le viewport, zoom, pan et rotation
 */
export interface CameraState {
  x: number;           // Position X de la caméra
  y: number;           // Position Y de la caméra
  zoom: number;        // Niveau de zoom (1 = normal)
  rotation: number;    // Rotation en degrés
}

export interface CameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZoom: number;
  maxZoom: number;
}

export class Camera {
  private state: CameraState;
  private bounds: CameraBounds;
  private viewportWidth: number;
  private viewportHeight: number;

  // Pour le smooth scrolling
  private targetState: CameraState;
  private animating: boolean = false;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.state = {
      x: 0,
      y: 0,
      zoom: 1,
      rotation: 0
    };

    this.targetState = { ...this.state };

    // Bounds par défaut (seront ajustés selon la taille du plateau)
    this.bounds = {
      minX: -1000,
      maxX: 1000,
      minY: -1000,
      maxY: 1000,
      minZoom: 0.5,
      maxZoom: 2
    };
  }

  /**
   * Définit les limites de la caméra
   */
  public setBounds(bounds: Partial<CameraBounds>): void {
    this.bounds = { ...this.bounds, ...bounds };
    this.clampState();
  }

  /**
   * Redimensionne le viewport
   */
  public resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Déplace la caméra (pan)
   */
  public pan(deltaX: number, deltaY: number): void {
    this.state.x += deltaX / this.state.zoom;
    this.state.y += deltaY / this.state.zoom;
    this.clampState();
  }

  /**
   * Zoom de la caméra
   */
  public setZoom(zoom: number, centerX?: number, centerY?: number): void {
    const oldZoom = this.state.zoom;
    this.state.zoom = Math.max(this.bounds.minZoom, Math.min(this.bounds.maxZoom, zoom));

    // Ajuster la position pour zoomer vers le centre
    if (centerX !== undefined && centerY !== undefined) {
      const zoomRatio = this.state.zoom / oldZoom;
      this.state.x = centerX - (centerX - this.state.x) * zoomRatio;
      this.state.y = centerY - (centerY - this.state.y) * zoomRatio;
    }

    this.clampState();
  }

  /**
   * Zoom relatif (pinch)
   */
  public zoomBy(delta: number, centerX?: number, centerY?: number): void {
    this.setZoom(this.state.zoom * delta, centerX, centerY);
  }

  /**
   * Rotation de la caméra
   */
  public rotate(degrees: number): void {
    this.state.rotation = (this.state.rotation + degrees) % 360;
  }

  /**
   * Centrer sur une position avec animation
   */
  public centerOn(x: number, y: number, animate: boolean = true): void {
    this.targetState.x = x - this.viewportWidth / (2 * this.state.zoom);
    this.targetState.y = y - this.viewportHeight / (2 * this.state.zoom);

    if (animate) {
      this.animating = true;
    } else {
      this.state.x = this.targetState.x;
      this.state.y = this.targetState.y;
      this.clampState();
    }
  }

  /**
   * Animation frame - appelé à chaque frame pour smooth scrolling
   */
  public update(): void {
    if (!this.animating) return;

    const lerp = 0.1; // Facteur d'interpolation
    const threshold = 0.5;

    this.state.x += (this.targetState.x - this.state.x) * lerp;
    this.state.y += (this.targetState.y - this.state.y) * lerp;

    // Arrêter l'animation quand on est assez proche
    const dx = Math.abs(this.targetState.x - this.state.x);
    const dy = Math.abs(this.targetState.y - this.state.y);

    if (dx < threshold && dy < threshold) {
      this.state.x = this.targetState.x;
      this.state.y = this.targetState.y;
      this.animating = false;
    }

    this.clampState();
  }

  /**
   * Applique les limites à l'état actuel
   */
  private clampState(): void {
    this.state.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.state.x));
    this.state.y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.state.y));
    this.state.zoom = Math.max(this.bounds.minZoom, Math.min(this.bounds.maxZoom, this.state.zoom));
  }

  /**
   * Convertit les coordonnées écran en coordonnées monde
   */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: this.state.x + screenX / this.state.zoom,
      y: this.state.y + screenY / this.state.zoom
    };
  }

  /**
   * Convertit les coordonnées monde en coordonnées écran
   */
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.state.x) * this.state.zoom,
      y: (worldY - this.state.y) * this.state.zoom
    };
  }

  /**
   * Retourne la transformation CSS pour le conteneur
   */
  public getTransform(): string {
    return `
      scale(${this.state.zoom})
      translate(${-this.state.x}px, ${-this.state.y}px)
      rotate(${this.state.rotation}deg)
    `;
  }

  /**
   * Retourne l'état actuel
   */
  public getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Retourne les dimensions du viewport
   */
  public getViewport(): { width: number; height: number } {
    return {
      width: this.viewportWidth,
      height: this.viewportHeight
    };
  }

  /**
   * Vérifie si un point est visible dans le viewport
   */
  public isVisible(x: number, y: number, margin: number = 50): boolean {
    const screen = this.worldToScreen(x, y);
    return (
      screen.x >= -margin &&
      screen.x <= this.viewportWidth + margin &&
      screen.y >= -margin &&
      screen.y <= this.viewportHeight + margin
    );
  }
}
