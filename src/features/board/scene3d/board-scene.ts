import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Group,
  Vector3,
  Vector2,
  Raycaster,
  Plane,
  MathUtils,
  AmbientLight,
  DirectionalLight,
} from 'three';
import { readSafeArea, disposeSafeAreaProbe } from './safe-area';
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

/**
 * Bornes de l'élévation manuelle, en degrés depuis la verticale (#43).
 *
 * Elles ne sont pas décoratives. À 90° on passerait SOUS le plateau : on y
 * verrait la tranche des cases par en dessous, sans repère pour comprendre
 * comment en revenir. À 0° la caméra regarde droit vers le bas, la fuite
 * disparaît et on retombe sur la vue plate que Quentin a refusée au premier
 * jet — la borne haute protège donc l'acquis de la perspective.
 *
 * Le LACET, lui, n'est pas borné : un plateau se regarde de tous les côtés,
 * et une butée au milieu d'un geste continu se sentirait comme un défaut.
 */
/**
 * Côté de la fenêtre suivie, en cases (#45).
 *
 * Le paramètre est une EMPRISE, pas un nombre de cases, et la distinction
 * décide de tout. Mesuré sur le plateau officiel — deux rangées de dix —
 * cadrer 12 cases donne exactement la même taille que d'en cadrer 23 :
 * les douze premières couvrent déjà toute la largeur, et c'est elle qui
 * contraint. Un nombre de cases ne voudrait d'ailleurs rien dire sur un
 * plateau en U ou en cercle.
 *
 * 7 tient le critère de Quentin sur tous les appareils visés, avec de la
 * marge : 53,8 px sur un 5 pouces (360 × 640, HUD de 210) là où le seuil de
 * cible tactile est à 48. À 8, le 5 pouces retombe à 47,0 px.
 */
const FOLLOW_SPAN_TILES = 7;

/**
 * Taille minimale d'une case pour que la vue d'ensemble reste jouable.
 *
 * 48 px est la cible tactile recommandée, et c'est aussi ce qu'il faut pour
 * lire l'illustration d'une case à bout de bras sur une table.
 */
const MIN_TILE_PIXELS = 48;

const MIN_TILT_DEG = 12;
const MAX_TILT_DEG = 78;

/** Degrés de rotation par pixel glissé. */
const YAW_PER_PIXEL = 0.4;
const TILT_PER_PIXEL = 0.3;

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
  /** Encoches système mesurées au dernier cadrage. */
  private safeArea = { top: 0, bottom: 0, left: 0, right: 0 };

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
  /**
   * Orbite du joueur : d'où il regarde le plateau (#43).
   *
   * Distincte du lacet de `framing`, et c'est le point à ne pas confondre.
   * `framing.yawDeg` décide du SENS DE PRÉSENTATION du plateau d'après sa
   * forme — il appartient au plateau. `orbitYaw` décide d'OÙ ON LE REGARDE —
   * il appartient au joueur. Les fondre en un seul angle ferait recalculer
   * un cadrage à chaque geste, et le plateau changerait de taille pendant
   * qu'on le tourne.
   */
  private orbitYaw = 0;
  private orbitTilt = CAMERA_TILT_DEG;

  /** Emprise et centre du parcours ENTIER, pour la vue d'ensemble. */
  private wholeExtent: BoardExtent = { width: 1, depth: 1 };
  private wholeCenter = { x: 0, z: 0 };
  /** Les cases telles qu'elles sont posées, pour cadrer autour de l'une. */
  private tiles: { x: number; z: number }[] = [];
  private tileSize = 120;
  /** Case suivie, ou `null` en vue d'ensemble. */
  private followed: number | null = null;
  /** Point cadré indépendamment des cases — le dé qui roule. */
  private focus: { x: number; z: number; span: number } | null = null;
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
    window.addEventListener('orientationchange', this.onResize);
    // La barre d'URL qui se rétracte ne déclenche pas toujours `resize`.
    window.visualViewport?.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.layout();
  }

  /** L'élément qui reçoit les gestes : le même que celui qui porte le canvas. */
  public get viewport(): HTMLElement {
    return this.container;
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
    // La même mesure que le cadrage : lire une hauteur différente ici
    // donnerait un chiffre qui ne correspond pas à ce qui est affiché.
    const screenHeight = this.measureViewport().height;

    return (worldLength / visibleHeight) * screenHeight;
  }

  /**
   * Le point du PLATEAU que vise un pixel de l'écran.
   *
   * Indispensable pour qu'un objet SUIVE le doigt : sans cette conversion, on
   * sait qu'un geste a eu lieu mais pas où il pointe dans le monde. Le dé
   * restait donc collé sur place pendant qu'on le glissait.
   *
   * Le rayon est croisé avec le plan du plateau à la hauteur demandée — et
   * non avec le sol : un dé soulevé de 34 unités qu'on suivrait au niveau du
   * sol dériverait sous le doigt, d'autant plus que la vue est inclinée.
   *
   * Renvoie `null` quand le pixel vise le ciel, au-dessus de l'horizon : il
   * n'y a alors aucun point du plateau sous le doigt, et inventer une
   * position enverrait l'objet à l'infini.
   */
  public screenToBoard(
    clientX: number,
    clientY: number,
    height = 0
  ): { x: number; z: number } | null {
    const box = this.container.getBoundingClientRect();

    const pointer = new Vector2(
      ((clientX - box.left) / Math.max(1, box.width)) * 2 - 1,
      -((clientY - box.top) / Math.max(1, box.height)) * 2 + 1
    );

    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, this.camera);

    // Le plan horizontal du plateau, remonté à la hauteur de l'objet.
    const plane = new Plane(new Vector3(0, 1, 0), -height);
    const hit = new Vector3();

    if (!raycaster.ray.intersectPlane(plane, hit)) return null;

    return { x: hit.x, z: hit.z };
  }

  /**
   * Vaut-il mieux montrer tout le plateau, ou suivre le pion ?
   *
   * La réponse dépend de la FORME DE L'ÉCRAN, et elle est mesurée, pas
   * décidée d'avance. En paysage, le plateau entier passe le critère des
   * 48 px sur tous les appareils visés — 67 px sur un Pixel 10, 58 sur un
   * iPhone SE, 56 sur un 5 pouces. Mieux : la vue d'ensemble y est MEILLEURE
   * que la vue suivie (67,2 contre 63,8 px), parce que le plateau officiel et
   * un écran paysage ont la même forme.
   *
   * En portrait le plateau entier tombe à 40 px, sous la cible tactile : la
   * vue suivie de #45 y reste nécessaire. C'est le problème qu'elle résolvait,
   * et il ne se pose qu'en portrait.
   *
   * Le principe est celui de #41 : on ne fige pas un choix qui dépend du
   * contexte, on le recalcule.
   */
  public prefersWholeBoard(): boolean {
    const viewport = this.measureViewport();
    const free = Math.max(
      1,
      viewport.height - this.hudInsets.top - this.hudInsets.bottom - this.safeArea.top -
        this.safeArea.bottom
    );

    // LA DÉCISION SE PREND SUR LA LISIBILITÉ MESURÉE, et non sur la forme de
    // l'écran.
    //
    // Le critère était « plus large que haut », ce qui rangeait un TÉLÉPHONE
    // COUCHÉ parmi les grands écrans. Mesuré sur le Pixel 10 de Quentin,
    // capture à l'appui : 866 × 306 avec la barre d'URL ouverte, soit une
    // case à 46 px — SOUS la cible tactile de 48 — alors que le code lui
    // promettait la vue d'ensemble comme à un portable de 1440 px, où la même
    // case ferait 142 px.
    //
    // Le commentaire d'origine annonçait 67 px sur un Pixel 10 : c'était une
    // mesure prise SANS la barre du navigateur. En vrai usage elle est là.
    //
    // On mesure donc ce que la vue d'ensemble DONNERAIT, et on ne la retient
    // que si elle reste lisible. La forme de l'écran n'entre plus en compte,
    // ce qui règle du même coup le cas du téléphone couché comme celui de la
    // fenêtre de bureau étroite.
    void free;

    return this.wholeBoardTilePixels() >= MIN_TILE_PIXELS;
  }

  /**
   * Taille d'une case, en pixels, si l'on montrait tout le plateau.
   *
   * MESURÉE et non déduite : on cadre réellement le plateau entier, on lit ce
   * qu'une case y ferait, puis on remet la vue comme on l'a trouvée. C'est la
   * même méthode que le reste du cadrage — la taille apparente dépend de la
   * distance en projection conique, elle ne se déduit pas d'un rapport de
   * rectangles.
   *
   * Un calcul « à la main » sur les dimensions du plateau donnait la même
   * réponse partout : `framing.rotated` décrit le cadre tourné, pas la
   * surface occupée, et les deux ne se ressemblent pas.
   */
  private wholeBoardTilePixels(): number {
    const tile = this.followed;
    const point = this.focus;

    this.showWholeBoard();
    const pixels = this.worldToScreenPixels(this.tileSize);

    // La vue est remise exactement comme elle était : cette mesure ne doit
    // rien changer à ce que le joueur regarde.
    if (point) this.followPoint(point.x, point.z, point.span);
    else if (tile !== null) this.followTile(tile);

    return pixels;
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
    this.tiles = tiles;
    this.tileSize = tileSize;
    this.wholeExtent = measureExtent(tiles, tileSize);
    this.wholeCenter = measureCenter(tiles);

    this.applyView();
  }

  /**
   * Cadre une portion autour d'une case, et y reste (#45).
   *
   * Quentin a tranché pour la lisibilité : plutôt que de montrer tout le
   * parcours avec des cases de 40 px, on cadre une fenêtre autour du joueur.
   */
  public followTile(index: number): void {
    this.followed = index;
    this.focus = null;
    this.applyView();
  }

  /** Montre tout le parcours, à la demande (#45). */
  public showWholeBoard(): void {
    this.followed = null;
    this.focus = null;
    this.applyView();
  }

  /**
   * Cadre un point du monde, sans le rattacher à une case (#49).
   *
   * Sert à suivre le dé pendant qu'il roule : il ne se trouve sur aucune case
   * en particulier, et souvent entre plusieurs.
   */
  public followPoint(x: number, z: number, span: number): void {
    this.followed = null;
    this.focus = { x, z, span };
    this.layout();
  }

  /** Le point que la caméra vise actuellement. */
  public getFocusCenter(): { x: number; z: number } {
    return { ...this.center };
  }

  /** Abandonne le cadrage d'un point et revient à la vue courante. */
  public releasePoint(): void {
    this.focus = null;
    this.applyView();
  }

  /** Suit-on un pion, ou voit-on tout le plateau ? */
  public isFollowing(): boolean {
    return this.followed !== null;
  }

  /**
   * Choisit ce que la caméra doit cadrer : la fenêtre suivie ou tout le
   * parcours.
   *
   * La fenêtre garde une taille FIXE même près des extrémités, où elle
   * déborde du plateau. La rogner sur ce qui reste donnerait des cases plus
   * grosses au départ qu'au milieu, et la vue changerait d'échelle en
   * jouant — un défaut qu'on remarque immédiatement et qu'on ne s'explique
   * pas.
   */
  private applyView(): void {
    // Un point cadré l'emporte : pendant que le dé roule, c'est lui qu'on
    // regarde, quelle que soit la vue qui reprendra ensuite.
    if (this.focus) {
      this.extent = { width: this.focus.span, depth: this.focus.span };
      this.center = { x: this.focus.x, z: this.focus.z };
      this.layout();
      return;
    }

    const tile = this.followed === null ? undefined : this.tiles[this.followed];

    if (!tile) {
      this.extent = this.wholeExtent;
      this.center = this.wholeCenter;
      this.layout();
      return;
    }

    const span = FOLLOW_SPAN_TILES * this.tileSize;
    this.extent = { width: span, depth: span };
    this.center = { x: tile.x, z: tile.z };

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

  /**
   * Tourne la vue autour du plateau, en degrés (#43).
   *
   * Le lacet fait le tour librement ; l'élévation est bornée. On ne recadre
   * PAS en continu pendant le geste : le plateau se remettrait à l'échelle
   * sous le doigt, et le joueur verrait sa taille changer sans avoir rien
   * demandé. Une rotation libre peut donc sortir des cases du champ — c'est
   * son choix, et « Recadrer » est le filet.
   */
  public orbitBy(yawDeg: number, tiltDeg: number): void {
    // Ramené dans un tour : cumulé sans fin, l'angle finirait par perdre en
    // précision, et une valeur de cinquante tours ne dit rien à personne.
    this.orbitYaw = wrapDegrees(this.orbitYaw + yawDeg);
    this.orbitTilt = MathUtils.clamp(this.orbitTilt + tiltDeg, MIN_TILT_DEG, MAX_TILT_DEG);
    this.layout();
  }

  /** Tourne la vue en pixels glissés, pour un geste au doigt (#43). */
  public orbitByPixels(dxPx: number, dyPx: number): void {
    this.orbitBy(dxPx * YAW_PER_PIXEL, dyPx * TILT_PER_PIXEL);
  }

  /** D'où le joueur regarde le plateau. Exposé pour être mesuré. */
  public getOrbit(): { yawDeg: number; tiltDeg: number } {
    return { yawDeg: this.orbitYaw, tiltDeg: this.orbitTilt };
  }

  /** L'élévation du cadrage automatique, celle que « Recadrer » restaure. */
  public getDefaultTiltDeg(): number {
    return CAMERA_TILT_DEG;
  }

  /** Position de la caméra dans le monde. Exposée pour être mesurée. */
  public getCameraPosition(): { x: number; y: number; z: number } {
    const { x, y, z } = this.camera.position;
    return { x, y, z };
  }

  /**
   * Revient au cadrage automatique : zoom, déplacement ET angle.
   *
   * L'angle en fait partie. Un bouton qui rendrait le zoom mais laisserait la
   * vue de travers ne serait qu'un demi-bouton, et laisserait perdu le joueur
   * qui s'en sert précisément parce qu'il l'est.
   */
  public resetView(): void {
    this.userZoom = 1;
    this.userPan = { x: 0, y: 0 };
    this.orbitYaw = 0;
    this.orbitTilt = CAMERA_TILT_DEG;
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

    const { width, height } = this.measureViewport();

    // Le cadrage se calcule MÊME sans contexte graphique. C'est une propriété
    // de la scène, pas un effet de bord du rendu : il doit rester mesurable
    // quand WebGL manque, et testable sans navigateur.
    if (this.renderer) {
      // Le troisième argument laissé à `true` : Three.js pose alors la taille
      // CSS du canvas en plus du tampon de rendu. Avec `false`, le canvas
      // gardait sa taille intrinsèque par défaut — 300 × 150 — et dessinait
      // une vignette dans un coin pendant que tout le reste se calculait
      // correctement. Écran noir sur téléphone, alors que le bandeau
      // annonçait « 23 cases · case ≈ 53 px ». Le troisième argument n'est
      // utile qu'à qui gère lui-même la taille CSS ; notre feuille de style
      // ne donne aucune dimension au canvas.
      this.renderer.setSize(width, height);
      // Plafonné à 2 : au-delà, un écran dense quadruple le nombre de pixels à
      // dessiner pour un gain invisible, et les téléphones d'entrée de gamme
      // sont la cible.
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }

    // Les encoches système s'ajoutent au HUD applicatif. Avec
    // `viewport-fit=cover` le canvas s'étend SOUS l'encoche et sous la barre
    // de gestes : cadrer sur le canvas entier centre le plateau par rapport à
    // un rectangle dont le système masque une partie. Invisible sur un
    // navigateur de bureau, où ces valeurs sont nulles ; bien visible sur un
    // Pixel, où l'encoche fait une quarantaine de pixels.
    const safe = readSafeArea();
    this.safeArea = safe;

    const insetTop = this.hudInsets.top + safe.top;
    const insetBottom = this.hudInsets.bottom + safe.bottom;

    const usable = {
      width: Math.max(1, width - safe.left - safe.right),
      height: Math.max(1, height - insetTop - insetBottom),
    };

    this.framing = computeFraming(this.extent, usable);

    // La rotation de cadrage tourne le plateau AUTOUR DE SON CENTRE, et non
    // autour de l'origine du monde. Un parcours composé dans l'éditeur n'est
    // pas centré sur l'origine : le tourner autour d'elle l'envoie ailleurs,
    // et la caméra, qui vise son centre, cadre alors à côté.
    this.world.rotation.y = MathUtils.degToRad(this.framing.yawDeg);
    this.world.position.set(0, 0, 0);
    this.world.updateMatrixWorld(true);

    const spun = new Vector3(this.center.x, 0, this.center.z).applyMatrix4(this.world.matrixWorld);
    this.world.position.set(this.center.x - spun.x, 0, this.center.z - spun.z);
    this.world.updateMatrixWorld(true);

    // En perspective, cadrer ne consiste plus à fixer des bornes mais à
    // RECULER la caméra jusqu'à ce que le plateau tienne dans le cône de
    // vision. Le choix d'orientation, lui, ne change pas : vérifié, le quart
    // de tour reste gagnant sur le plateau officiel (35 → 59 px) et perdant
    // sur un parcours en colonne, exactement comme en projection parallèle.
    // Le rapport d'image est celui de la SOUS-FENÊTRE, celle où le plateau
    // doit tenir. C'est elle qu'on cadre ; le canvas entier n'est que le
    // support sur lequel elle est découpée.
    this.camera.aspect = usable.width / usable.height;
    this.cameraDistance = this.distanceToFit(usable) / this.userZoom;

    // PAS de `setViewOffset` ici, et c'est un enseignement payé par la
    // mesure : cette méthode DÉCOUPE une sous-région d'un cône existant, elle
    // ne RÉSERVE pas une bande. Trois variantes essayées, aucune ne place le
    // haut de la zone libre là où il faut — le plateau finissait plus haut
    // que sans elle. Ce qu'on veut n'est pas un découpage mais un décalage de
    // la VISÉE, obtenu dans `placeCamera` : on cadre le cône sur la
    // sous-fenêtre, puis on décale ce que la caméra regarde pour que le
    // plateau tombe au milieu de la bande libre.
    this.camera.clearViewOffset();

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
  /**
   * Place réellement disponible pour dessiner.
   *
   * Sur mobile, `clientHeight` ne vaut pas ce qu'on croit : la barre d'URL du
   * navigateur se rétracte au défilement, et la hauteur du conteneur reste
   * celle d'avant. `visualViewport` donne la surface effectivement visible.
   * Elle n'existe pas partout — les WebViews anciennes de la cible Android
   * 5.1 ne la connaissent pas — d'où le repli sur le conteneur.
   */
  private measureViewport(): { width: number; height: number } {
    const visual = typeof window !== 'undefined' ? window.visualViewport : null;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    if (!visual) return { width, height };

    // On ne prend la mesure du navigateur que si elle est plausible : un
    // `visualViewport` qui rapporterait zéro ferait disparaître le plateau.
    return {
      width: visual.width > 0 ? Math.max(1, Math.round(visual.width)) : width,
      height: visual.height > 0 ? Math.max(1, Math.round(visual.height)) : height,
    };
  }

  /**
   * Distance à laquelle tout le parcours tient dans le champ.
   *
   * On ne la DÉDUIT pas d'une formule : on la MESURE. La formule précédente
   * modélisait le plateau comme une carte plate face à l'objectif, et
   * calculait la largeur visible à la distance de la caméra. Le plateau est
   * un plan INCLINÉ : son bord proche est bien plus près de la caméra que
   * son centre, et le cône y est d'autant plus étroit. La formule donnait
   * donc systématiquement une distance trop courte, et le plateau débordait
   * — ses coins tombaient à -72 px et 532 px sur un écran de 390 px.
   *
   * On place donc la caméra, on projette les quatre coins de l'emprise, et
   * on recule tant qu'ils dépassent. Le débordement décroît quand on recule,
   * ce qui rend la recherche sûre : quelques itérations suffisent, et le
   * résultat est vrai par construction plutôt que par confiance dans un
   * modèle qui s'est révélé faux.
   */
  private distanceToFit(usable: Viewport): number {
    const fov = MathUtils.degToRad(CAMERA_FOV_DEG);
    const { width, depth } = this.framing.rotated;

    /**
     * Emprise visée, en coordonnées normalisées.
     *
     * 1 serait le cadrage au ras du bord. La marge laisse respirer
     * l'épaisseur des cases et les pions, qui dépassent du plan du plateau.
     */
    const TARGET = 1 / 1.06;

    const span = Math.max(width, depth);
    let distance = Math.max(span / (2 * Math.tan(fov / 2)), 200);

    // On converge dans LES DEUX SENS. Une boucle qui ne sait que reculer
    // dépend entièrement de la justesse de son point de départ : si celui-ci
    // est trop loin, elle s'arrête aussitôt et le plateau reste minuscule,
    // cadré par une estimation grossière plutôt que par la mesure. C'est ce
    // qui arrivait avec un HUD encombrant, là où la sous-fenêtre devient
    // presque carrée.
    for (let i = 0; i < 40; i++) {
      const overflow = this.measureOverflow(distance);
      if (!Number.isFinite(overflow)) {
        distance *= 1.5;
        continue;
      }

      const correction = overflow / TARGET;
      if (Math.abs(correction - 1) < 0.002) break;

      // L'emprise décroît à peu près comme l'inverse de la distance : on
      // vise directement le bon facteur plutôt que de tâtonner par pas fixes.
      distance *= MathUtils.clamp(correction, 0.5, 2);
      distance = Math.max(distance, 200);
    }

    return distance;
  }

  /** Pose la caméra sur son orbite autour du centre du plateau. */
  private placeCamera(): void {
    const tilt = MathUtils.degToRad(this.orbitTilt);
    const yaw = MathUtils.degToRad(this.orbitYaw);

    // Le déplacement manuel s'exprime en pixels écran : on le ramène en
    // unités monde pour qu'un glissement suive le doigt quel que soit le zoom.
    const worldPerPixel = this.cameraDistance * 2 *
      Math.tan(MathUtils.degToRad(CAMERA_FOV_DEG) / 2) /
      this.measureViewport().height;

    const target = new Vector3(
      this.center.x + this.userPan.x * worldPerPixel,
      0,
      this.center.z - this.userPan.y * worldPerPixel
    );

    // La caméra orbite AUTOUR DE LA CIBLE, et non autour de l'origine du
    // monde : un parcours posé loin de l'origine sortirait du champ au
    // premier geste si on tournait autour de (0, 0).
    const ground = Math.sin(tilt) * this.cameraDistance;

    this.camera.position.set(
      target.x + Math.sin(yaw) * ground,
      Math.cos(tilt) * this.cameraDistance,
      target.z + Math.cos(yaw) * ground
    );
    this.camera.lookAt(target);

    // Le décalage du HUD se fait APRÈS l'orientation, dans le repère de
    // l'écran : « vers le bas de l'image » ne correspond à aucun axe fixe du
    // monde dès que la caméra tourne. On déplace la caméra le long de son
    // propre axe vertical, ce qui fait glisser l'image sans changer l'angle.
    const hudShift = this.hudShiftWorld(this.cameraDistance);
    if (hudShift !== 0) {
      const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      this.camera.position.addScaledVector(up, hudShift);
    }

    this.camera.updateMatrixWorld(true);
  }

  /**
   * Plus grande coordonnée normalisée atteinte par les coins du parcours.
   *
   * Au-delà de 1, le plateau sort du cadre.
   *
   * La mesure se fait avec la VRAIE caméra, placée pour de bon puis remise
   * en place : un modèle parallèle rejouant le calcul à la main a déjà
   * divergé de la projection réelle, parce que le cône est dimensionné sur
   * la sous-fenêtre tandis que la projection se lit sur le canvas. Interroger
   * la caméra elle-même supprime la question au lieu d'essayer de la
   * reproduire fidèlement.
   */
  private measureOverflow(distance: number): number {
    // L'emprise NON TOURNÉE, et c'est le point délicat : `framing.rotated`
    // décrit le plateau après le quart de tour, mais cette rotation vit dans
    // `world.rotation` et non dans les coordonnées. Sonder les coins de
    // `rotated` revient à mesurer un rectangle qui n'existe nulle part —
    // 795 × 1335 alors que le plateau occupe réellement 1215 × 675. La
    // mesure annonçait alors que tout tenait pendant que les coins sortaient
    // à 450 px sur un écran de 390.
    const { width, depth } = this.extent;

    const saved = this.cameraDistance;
    this.cameraDistance = distance;
    this.placeCamera();
    this.camera.updateProjectionMatrix();

    const hw = width / 2;
    const hd = depth / 2;
    let worst = 0;

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // Les coins de l'emprise, exprimés autour du centre visé.
        // Les coins sont donnés DIRECTEMENT en monde, sans repasser par la
        // matrice : `extent` décrit déjà l'emprise telle qu'elle est posée,
        // et la rotation de cadrage tourne le plateau autour de son centre
        // sans déplacer ce centre. Appliquer la matrice en plus tournerait
        // le rectangle une seconde fois, et la mesure porterait sur une
        // emprise qui n'existe nulle part.
        const corner = new Vector3(
          this.center.x + sx * hw,
          0,
          this.center.z + sz * hd
        ).project(this.camera);

        worst = Math.max(worst, Math.abs(corner.x), Math.abs(corner.y));
      }
    }

    this.cameraDistance = saved;

    return worst;
  }

  /**
   * Décalage de visée dû au HUD, en unités monde à la distance donnée.
   *
   * Le plateau doit se centrer dans la bande LIBRE. Quand le HUD mange le
   * haut de l'écran, le centre de cette bande est plus bas que celui du
   * canvas, et la caméra doit viser d'autant plus haut pour l'y amener.
   */
  private hudShiftWorld(distance: number): number {
    // Encoches comprises : c'est la bande RÉELLEMENT visible qu'on centre.
    const shiftPx =
      (this.hudInsets.top + this.safeArea.top - this.hudInsets.bottom - this.safeArea.bottom) / 2;
    const screenHeight = this.measureViewport().height;
    const visibleHeight = 2 * distance * Math.tan(MathUtils.degToRad(CAMERA_FOV_DEG) / 2);

    return (shiftPx / screenHeight) * visibleHeight;
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
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
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

    disposeSafeAreaProbe();
  }
}

/** Ramène un angle dans ]-360, 360[, en gardant son signe. */
function wrapDegrees(deg: number): number {
  return deg % 360;
}
