import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Group,
  Vector3,
  MathUtils,
  AmbientLight,
  DirectionalLight,
} from 'three';
import {
  computeFraming,
  measureExtent,
  measureCenter,
  type BoardExtent,
  type Framing,
  type Viewport,
} from './framing';

/**
 * La scène : SOURCE DE VÉRITÉ UNIQUE de la position de l'observateur.
 *
 * C'est la raison d'être de toute la refonte. Le rendu précédent répartissait
 * les transformations entre board-camera.css, board.renderer.camera.ts et
 * Dice3D.ts, et comptait sur les développeurs pour les garder synchronisées.
 * Les quatre défauts successifs du dé venaient tous de là : une inclinaison
 * codée en dur à 40° quand la scène était passée à 58°, un lacet appliqué au
 * mauvais endroit de la chaîne, un dé sans l'écrasement du plateau.
 *
 * Ici il n'y a qu'une caméra. Le plateau, le dé et les pions vivent dans le
 * même espace : ils ne peuvent plus se contredire, parce qu'il n'y a plus
 * deux représentations à accorder.
 */

/** Inclinaison de la vue, en degrés depuis la verticale. */
const CAMERA_TILT_DEG = 52;

/**
 * Champ de vision vertical, en degrés.
 *
 * La projection est en PERSPECTIVE, et c'est le point qui décide de tout :
 * une projection parallèle donne à une case du fond exactement la taille
 * d'une case du premier plan. Sans fuite, aucune profondeur perçue — le
 * plateau paraît plat quelle que soit l'épaisseur réelle des cases.
 *
 * 38° est un compromis : assez pour que la fuite se voie, assez peu pour que
 * les cases du fond ne deviennent pas illisibles. Un champ large donnerait
 * un effet grand-angle qui déforme les bords.
 */
const CAMERA_FOV_DEG = 38;

export interface BoardSceneOptions {
  /** Élément qui accueille le canvas. Le HUD DOM reste au-dessus. */
  container: HTMLElement;
  /**
   * Place occupée par le HUD, en pixels, retirée de la surface de cadrage.
   * Le plateau se cadre dans ce qui reste, et non derrière les boutons.
   */
  hudInsets?: { top: number; bottom: number };
}

export class BoardScene {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  /** Tout le contenu du plateau : c'est LUI qu'on tourne, pas la caméra. */
  readonly world = new Group();

  private renderer: WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private readonly container: HTMLElement;
  private hudInsets: { top: number; bottom: number };

  private frameId: number | null = null;
  private running = false;
  private contextLost = false;
  private disposed = false;

  private extent: BoardExtent = { width: 1, depth: 1 };
  private center = { x: 0, z: 0 };
  private framing: Framing = { yawDeg: 0, scale: 1, rotated: { width: 1, depth: 1 } };

  /** Réglages de l'utilisateur, qui se composent avec le cadrage automatique. */
  private userZoom = 1;
  private userPan = { x: 0, y: 0 };
  /** Distance courante de la caméra, calculée par le cadrage. */
  private cameraDistance = 1000;

  private readonly onResize = () => this.layout();
  private readonly onVisibility = () => this.syncRunning();
  private readonly onContextLost = (event: Event) => {
    // Sans preventDefault, Android ne restaure JAMAIS le contexte : le joueur
    // revient d'un appel et trouve un écran noir définitif.
    event.preventDefault();
    this.contextLost = true;
    this.stop();
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    this.layout();
    this.syncRunning();
  };

  constructor(options: BoardSceneOptions) {
    this.container = options.container;
    this.hudInsets = options.hudInsets ?? { top: 0, bottom: 0 };

    // Les bornes sont posées au premier cadrage ; celles-ci évitent une
    // caméra dégénérée avant la première mesure.
    this.camera = new PerspectiveCamera(CAMERA_FOV_DEG, 1, 10, 40000);
    this.scene.add(this.world);
    this.addLights();

    this.renderer = this.createRenderer();
    if (this.renderer) {
      this.canvas = this.renderer.domElement;
      this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
      this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
      this.container.appendChild(this.canvas);
    }

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.layout();
  }

  /** Le rendu 3D est-il disponible ? Faux si WebGL manque à l'appel. */
  public isAvailable(): boolean {
    return this.renderer !== null;
  }

  /**
   * Taille à l'écran, en pixels, d'une longueur exprimée en unités monde.
   *
   * En projection conique la taille apparente dépend de la distance : elle ne
   * se déduit plus d'un simple facteur d'échelle. Cette conversion sert à
   * juger la lisibilité réelle d'une case.
   */
  public worldToScreenPixels(worldLength: number): number {
    const fov = MathUtils.degToRad(CAMERA_FOV_DEG);
    const visibleHeight = 2 * this.cameraDistance * Math.tan(fov / 2);
    const screenHeight = Math.max(1, this.container.clientHeight);

    return (worldLength / visibleHeight) * screenHeight;
  }

  /** Le cadrage retenu : orientation et échelle. Exposé pour être mesuré. */
  public getFraming(): Framing {
    return this.framing;
  }

  /**
   * Déclare l'encombrement du parcours et recadre.
   *
   * Appelé par le rendu du plateau, qui seul sait où les cases sont posées.
   * La scène ne présume donc rien de leur disposition.
   */
  public setBoardExtent(tiles: { x: number; z: number }[], tileSize: number): void {
    this.extent = measureExtent(tiles, tileSize);
    this.center = measureCenter(tiles);
    this.layout();
  }

  /** Zoom manuel du joueur, par-dessus le cadrage automatique (#15). */
  public setUserZoom(zoom: number): void {
    this.userZoom = MathUtils.clamp(zoom, 0.5, 3);
    this.layout();
  }

  public getUserZoom(): number {
    return this.userZoom;
  }

  /** Déplacement manuel, en pixels écran (#15). */
  public panBy(dxPx: number, dyPx: number): void {
    this.userPan.x -= dxPx;
    this.userPan.y += dyPx;
    this.layout();
  }

  /** Revient au cadrage automatique, en annulant zoom et déplacement. */
  public resetView(): void {
    this.userZoom = 1;
    this.userPan = { x: 0, y: 0 };
    this.layout();
  }

  public setHudInsets(insets: { top: number; bottom: number }): void {
    this.hudInsets = insets;
    this.layout();
  }

  /**
   * Recalcule caméra et canvas d'après la place disponible.
   *
   * Tout passe par ici : redimensionnement, rotation d'écran, zoom, cadrage.
   * C'est le point unique qui remplace les transformations éparpillées.
   */
  public layout(): void {
    if (this.disposed) return;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    // Le cadrage se calcule MÊME sans contexte graphique. C'est une propriété
    // de la scène, pas un effet de bord du rendu : il doit rester mesurable
    // quand WebGL manque, et testable sans navigateur.
    if (this.renderer) {
      this.renderer.setSize(width, height, false);
      // Plafonné à 2 : au-delà, un écran dense quadruple le nombre de pixels à
      // dessiner pour un gain invisible, et les téléphones d'entrée de gamme
      // sont la cible.
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }

    const usable = {
      width,
      height: Math.max(1, height - this.hudInsets.top - this.hudInsets.bottom),
    };

    this.framing = computeFraming(this.extent, usable);
    this.world.rotation.y = MathUtils.degToRad(this.framing.yawDeg);

    // En perspective, cadrer ne consiste plus à fixer des bornes mais à
    // RECULER la caméra jusqu'à ce que le plateau tienne dans le cône de
    // vision. Le choix d'orientation, lui, ne change pas : vérifié, le quart
    // de tour reste gagnant sur le plateau officiel (35 → 59 px) et perdant
    // sur un parcours en colonne, exactement comme en projection parallèle.
    this.camera.aspect = usable.width / usable.height;
    this.cameraDistance = this.distanceToFit(usable) / this.userZoom;

    // La fenêtre est décalée verticalement pour que le plateau se centre
    // dans la surface laissée libre par le HUD, et non derrière lui.
    const hudShift = (this.hudInsets.top - this.hudInsets.bottom) / 2;
    this.camera.setViewOffset(
      usable.width,
      usable.height,
      0,
      -hudShift,
      usable.width,
      usable.height
    );

    this.placeCamera();
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  /**
   * Distance à laquelle tout le parcours tient dans le champ de vision.
   *
   * L'inclinaison écrase la profondeur vue : un plateau incliné à 52°
   * n'occupe plus que cos(52°) de sa hauteur à l'écran. Sans en tenir
   * compte, on recule trop et le plateau devient minuscule.
   */
  private distanceToFit(usable: Viewport): number {
    const fov = MathUtils.degToRad(CAMERA_FOV_DEG);
    const aspect = usable.width / usable.height;

    const { width, depth } = this.framing.rotated;
    const projectedDepth = depth * Math.cos(MathUtils.degToRad(CAMERA_TILT_DEG));

    // Une marge sur la hauteur : l'épaisseur des cases et les pions dépassent
    // du plan du plateau, et seraient coupés par un cadrage au ras.
    const byHeight = (projectedDepth / 2) * 1.12 / Math.tan(fov / 2);
    const byWidth = (width / 2) / (Math.tan(fov / 2) * aspect);

    return Math.max(byHeight, byWidth, 200);
  }

  /** Pose la caméra au-dessus du centre du plateau, inclinée. */
  private placeCamera(): void {
    const tilt = MathUtils.degToRad(CAMERA_TILT_DEG);

    // Le déplacement manuel s'exprime en pixels écran : on le ramène en
    // unités monde pour qu'un glissement suive le doigt quel que soit le zoom.
    const worldPerPixel = this.cameraDistance * 2 *
      Math.tan(MathUtils.degToRad(CAMERA_FOV_DEG) / 2) /
      Math.max(1, this.container.clientHeight);

    const target = new Vector3(
      this.center.x + this.userPan.x * worldPerPixel,
      0,
      this.center.z - this.userPan.y * worldPerPixel
    );

    this.camera.position.set(
      target.x,
      Math.cos(tilt) * this.cameraDistance,
      target.z + Math.sin(tilt) * this.cameraDistance
    );
    this.camera.lookAt(target);
  }

  /**
   * Éclaire la scène.
   *
   * Sans lumière, un matériau qui y réagit rend NOIR, et un matériau qui
   * l'ignore rend six faces de la même couleur — le volume existe dans les
   * données mais ne se voit pas. C'est ce qui faisait paraître le plateau
   * plat malgré des cases réellement épaisses.
   */
  private addLights(): void {
    // L'ambiante empêche les faces à l'ombre de tomber dans le noir.
    this.scene.add(new AmbientLight(0xffffff, 0.62));

    // La directionnelle vient de l'avant-gauche et en hauteur : elle éclaire
    // le dessus des cases plus que leur tranche, ce qui suffit à distinguer
    // l'un de l'autre sans y réfléchir.
    const key = new DirectionalLight(0xffffff, 0.85);
    key.position.set(-0.45, 1, 0.35);
    this.scene.add(key);

    // Une seconde lumière, opposée et faible, détache les tranches du fond.
    const fill = new DirectionalLight(0xffffff, 0.3);
    fill.position.set(0.6, 0.5, -0.5);
    this.scene.add(fill);
  }

  /** Démarre la boucle de rendu. */
  public start(): void {
    this.running = true;
    this.syncRunning();
  }

  /** Arrête la boucle sans détruire la scène. */
  public stop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Aligne la boucle sur l'état réel : on ne dessine que si le jeu tourne,
   * que l'onglet est visible et que le contexte graphique existe.
   *
   * Sur Android, continuer à dessiner en arrière-plan vide la batterie sans
   * que personne ne regarde.
   */
  private syncRunning(): void {
    const shouldRun = this.running && !document.hidden && !this.contextLost && !this.disposed;

    if (shouldRun && this.frameId === null) {
      this.frameId = requestAnimationFrame(this.tick);
      return;
    }

    if (!shouldRun) this.stop();
  }

  private readonly tick = (): void => {
    this.frameId = null;
    this.renderOnce();
    this.syncRunning();
  };

  private renderOnce(): void {
    if (!this.renderer || this.contextLost || this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Crée le renderer, ou `null` si WebGL n'est pas disponible.
   *
   * La cible est Android 5.1 : la WebView y est mise à jour par le Play
   * Store et gère WebGL, mais un appareil sans accélération graphique, ou
   * une WebView bridée par le constructeur, reste possible. Renvoyer `null`
   * plutôt que de laisser l'exception remonter permet à l'appelant de
   * retomber sur l'ancien rendu au lieu d'afficher un écran noir.
   */
  private createRenderer(): WebGLRenderer | null {
    try {
      const renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        // Le plateau ne se lit pas par transparence : laisser le tampon de
        // profondeur faire son travail évite des artefacts de superposition.
        powerPreference: 'default',
      });
      renderer.setClearColor(0x000000, 0);
      return renderer;
    } catch (error) {
      console.warn(
        'WebGL indisponible : le rendu 3D est désactivé.',
        (error as Error)?.message ?? error
      );
      return null;
    }
  }

  /** Libère le contexte graphique et les écouteurs. */
  public dispose(): void {
    this.disposed = true;
    this.stop();

    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);

    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
      this.canvas.remove();
      this.canvas = null;
    }

    // Sans cela le contexte WebGL survit à la scène, et Android en limite le
    // nombre : quelques parties suffisent à ne plus pouvoir en créer.
    this.renderer?.dispose();
    this.renderer = null;
  }
}
