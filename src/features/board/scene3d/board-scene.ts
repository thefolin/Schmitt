import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  Group,
  Vector3,
  MathUtils,
} from 'three';
import {
  computeFraming,
  measureExtent,
  measureCenter,
  type BoardExtent,
  type Framing,
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
 * Distance de la caméra au plateau.
 *
 * Sans effet sur la taille apparente : la projection est orthographique, et
 * c'est justement ce qu'on veut. Une perspective conique rétrécit les cases
 * lointaines, ce que Quentin avait signalé comme « les cases ne font pas la
 * même taille ». Cette distance ne sert qu'à contenir le plateau entre les
 * plans de coupe.
 */
const CAMERA_DISTANCE = 4000;

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
  readonly camera: OrthographicCamera;
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
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_DISTANCE * 4);
    this.scene.add(this.world);

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

    // L'inclinaison écrase la profondeur à l'écran : un plateau incliné à 52°
    // n'occupe plus que cos(52°) de sa hauteur. Le cadrage doit en tenir
    // compte, sinon le plateau sort par le haut — c'est exactement ce qui
    // arrivait à la tentative précédente.
    const squash = Math.cos(MathUtils.degToRad(CAMERA_TILT_DEG));
    const scale = this.framing.scale * this.userZoom;

    const halfW = usable.width / 2 / scale;
    const halfH = usable.height / 2 / scale / Math.max(squash, 0.2);

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;

    // Le HUD mange le haut et le bas de façon asymétrique : on décale la
    // fenêtre de projection pour que le plateau reste centré dans ce qui
    // reste visible, au lieu de passer sous la barre d'action.
    const hudShift = (this.hudInsets.top - this.hudInsets.bottom) / 2 / scale;
    this.camera.top += hudShift;
    this.camera.bottom += hudShift;

    this.placeCamera();
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  /** Pose la caméra au-dessus du centre du plateau, inclinée. */
  private placeCamera(): void {
    const tilt = MathUtils.degToRad(CAMERA_TILT_DEG);
    const scale = this.framing.scale * this.userZoom;

    // Le déplacement manuel s'exprime en pixels écran : on le ramène en
    // unités monde pour qu'un glissement d'un centimètre déplace toujours le
    // plateau d'un centimètre, quel que soit le zoom.
    const target = new Vector3(
      this.center.x + this.userPan.x / scale,
      0,
      this.center.z - this.userPan.y / scale
    );

    this.camera.position.set(
      target.x,
      Math.cos(tilt) * CAMERA_DISTANCE,
      target.z + Math.sin(tilt) * CAMERA_DISTANCE
    );
    this.camera.lookAt(target);
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
