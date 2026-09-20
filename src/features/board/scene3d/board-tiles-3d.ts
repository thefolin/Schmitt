import {
  Group,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  CircleGeometry,
  TextureLoader,
  SRGBColorSpace,
  Color,
  Sprite,
  SpriteMaterial,
  type Texture,
} from 'three';
import type { TileConfig } from '@/core/models/Tile';
import { arrowDirection } from './arrow-tile';
import { pawnMarks, MARK_SIZE, type PawnMark } from './pawn-marks';
import { paintMark } from './mark-texture';
import {
  calculatePlacementBounds,
  type BoardLayoutConfig,
} from '../camera/board-layout.config';

/**
 * Les cases du plateau, posées dans la scène 3D.
 *
 * Elles vivent dans le même espace que le dé et les pions : c'est tout
 * l'intérêt de la refonte. Plus de transformation CSS à synchroniser à la
 * main, plus de constante d'angle dupliquée entre deux fichiers.
 *
 * Le module ne suppose rien de la forme du parcours : il lit les placements
 * du layout, quels qu'ils soient. Un plateau en U, en cercle ou en T se rend
 * par le même chemin que le plateau officiel.
 */

/**
 * Épaisseur d'une case, en unités monde.
 *
 * 28 sur une case de 120, soit près d'un quart : franchement plus marqué que
 * les 14 du premier jet. Sous une plongée légère on ne voit qu'une mince
 * bande de la tranche, et c'est elle qui dit que la case est un objet posé
 * plutôt qu'un dessin sur le tapis.
 */
const TILE_THICKNESS = 28;

/**
 * Finesse du contour d'une case ronde.
 *
 * 32 côtés : le bord se lit comme un cercle même quand le joueur zoome à
 * fond, sans peser sur les téléphones d'entrée de gamme, qui sont la cible.
 * À 16 on voit le polygone, à 64 on paie le double pour rien.
 */
const TILE_SEGMENTS = 32;

/**
 * Les cases qui se distinguent du parcours ordinaire.
 *
 * Quentin : « les ajustements ne s'appliquent qu'à 3 cases — les pouvoirs
 * des dieux et le Schmitt. Les 20 autres restent comme avant. »
 *
 * Ce sont les trois cases du plateau officiel qui ne font pas boire mais
 * DÉCLENCHENT quelque chose : deux temples de la faveur des dieux (rangs 4
 * et 18) et le Schmitt (rang 11). Les distinguer à l'œil aide : le joueur
 * voit de loin qu'il va tomber sur un événement, pas sur une gorgée.
 *
 * Reconnu par le TYPE, et non par le rang : un plateau composé dans
 * l'éditeur peut les poser ailleurs, et le rendu ne suppose rien de la forme
 * du parcours (CLAUDE.md).
 */
const SPECIAL_TILE_TYPES = new Set(['power', 'temple', 'schmitt_call']);

/**
 * De combien une case spéciale dépasse les autres.
 *
 * 1,25 et non 2 : MESURÉ. Le pas de grille vaut 135 et une case ordinaire
 * 120, donc son voisin commence à 135 du centre — une case spéciale ne peut
 * pas dépasser 150 de diamètre sans le recouvrir. Doubler (240) mordrait de
 * 52 sur chaque voisine.
 */
const SPECIAL_TILE_SCALE = 1.25;

/**
 * Couleurs des cases par famille d'effet.
 *
 * Les illustrations viendront ensuite — Quentin veut d'abord juger les
 * volumes. Elles reprennent le code couleur du plateau physique : rouge pour
 * boire, vert pour distribuer, jaune pour les flèches, bleu pour les cases
 * spéciales.
 */
const TILE_COLORS: Record<string, number> = {
  start: 0xe8e2d2,
  finish: 0xe3c169,
  drink_2: 0xc4382f,
  drink_3: 0xc4382f,
  drink_4: 0xc4382f,
  drink_5: 0xc4382f,
  distribute_2: 0x2f8f4e,
  distribute_3: 0x2f8f4e,
  distribute_4: 0x2f8f4e,
  everyone_drinks: 0xa8422f,
  forward_2: 0xe0a53c,
  chicken: 0x3d7fc4,
  big_chicken: 0x3d7fc4,
  copy: 0x3d7fc4,
  schmitt_call: 0x3d7fc4,
  rule: 0x3d7fc4,
  temple: 0x9b7fd4,
  power: 0xe3c169,
};

/** Couleur de repli pour une case dont le type n'est pas répertorié. */
const TILE_COLOR_DEFAULT = 0xb9c0d0;

/** Dimensions d'un pion, en unités monde. */
const PAWN_RADIUS = 26;
const PAWN_HEIGHT = 46;

/**
 * Couleur du plateau sous les cases.
 *
 * NOIR, demandé par Quentin en remplacement de l'image de plateau complet.
 * Le vert de tapis de jeu qui précédait entrait en concurrence avec les
 * couleurs des cases ; un fond noir les laisse porter le regard, et il
 * s'accorde au plateau imprimé, dont le fond est lui-même très sombre.
 *
 * Pas tout à fait 0x000000 : un noir absolu efface la tranche des cases et
 * le relief disparaît. Ce gris très sombre garde l'assise visible sans se
 * faire remarquer.
 */
const TABLE_COLOR = 0x0a0a0c;

/** Marge du tapis autour des cases. */
const TABLE_PADDING = 90;

/**
 * Les deux colonnes de pouvoirs, posées de part et d'autre du parcours.
 *
 * Quentin a d'abord demandé le plateau imprimé entier en fond, puis l'a
 * remplacé par un fond NOIR et ces deux colonnes. Le premier essai montrait
 * les 23 cases une seconde fois sous celles qu'on joue ; ces colonnes-ci ne
 * portent que la TABLE DES FAVEURS, qui n'existe nulle part ailleurs dans la
 * scène — elle n'est lue que par `GOD_FAVORS`, dans le code.
 *
 * C'est donc un décor qui AJOUTE quelque chose : le joueur qui tire une
 * faveur lit à quoi correspond sa somme, comme sur le plateau réel.
 *
 * gauche : ATHÉNA 3, APHRODITE 4, HERMÈS 5, APOLLON 6, ARTÉMIS 7
 * droite : ARTÉMIS 7, ARÈS 8, DIONYSOS 9, HÉPHAÏSTOS 10, POSÉIDON 11
 */
const COLUMN_LEFT_IMAGE = 'assets/column-favors-left.png';
const COLUMN_RIGHT_IMAGE = 'assets/column-favors-right.png';

/** Proportions des colonnes, hautes et étroites (790×1920). */
const COLUMN_RATIO = 790 / 1920;

/**
 * Hauteur des colonnes, en part de la profondeur du parcours.
 *
 * RÉDUITE DE MOITIÉ à la demande de Quentin : à 0,95 elles dominaient le
 * plateau et forçaient la caméra à s'éloigner, donc à rapetisser les cases.
 * C'est la lisibilité des cases qui a décidé du cadrage (#75), et elle prime
 * sur le décor.
 */
const COLUMN_HEIGHT_FIT = 0.475;

/** Écart entre le bord du parcours et une colonne. */
const COLUMN_MARGIN = 70;

export interface TilePosition {
  x: number;
  z: number;
}

export class BoardTiles3D {
  readonly group = new Group();

  private positions: TilePosition[] = [];
  private table: Mesh | null = null;
  private readonly pawns = new Group();
  /** L'illustration de chaque case POSÉE, dans l'ordre du parcours. */
  private images: (string | undefined)[] = [];
  private readonly loader = new TextureLoader();
  /** Les textures chargées, pour pouvoir les libérer. */
  private readonly textures: Texture[] = [];

  /**
   * Dessine le parcours et renvoie la position de chaque case.
   *
   * Les positions servent au cadrage et au placement des pions : elles sont
   * calculées ici, une seule fois, plutôt que recalculées par chaque module
   * qui en a besoin.
   */
  public build(catalog: TileConfig[], layout: BoardLayoutConfig): TilePosition[] {
    this.clear();

    const step = layout.tileSize + layout.tileGap;
    this.positions = [];

    // Le parcours est la SUITE DES PLACEMENTS, pas le catalogue : sur un
    // plateau composé dans l'éditeur, la case posée au rang N n'est pas la
    // case N du catalogue. C'est le correctif #30, qu'on ne perd pas ici.
    layout.placements.forEach((placement, index) => {
      const tile = catalog[placement.tileId];
      if (!tile) return;

      const bounds = calculatePlacementBounds(placement, layout);

      // Le monde 3D est centré sur l'origine : on recentre le parcours pour
      // que les rotations tournent autour de son milieu et non d'un coin.
      const x = bounds.x + bounds.width / 2;
      const z = bounds.y + bounds.height / 2;

      this.positions[index] = { x, z };
      this.images[index] = tile.image;
      this.group.add(this.createTile(tile, bounds, index, placement.rotation));
    });

    this.createTable(step);
    this.group.add(this.pawns);

    return this.positions;
  }

  public getPositions(): TilePosition[] {
    return this.positions;
  }

  /**
   * L'illustration de la case posée au rang donné.
   *
   * Exposée pour être vérifiable : c'est ici que se jouait le défaut #30, où
   * les bonnes images se retrouvaient aux mauvais endroits parce qu'on lisait
   * le catalogue dans son ordre au lieu de suivre les placements.
   */
  public imageAt(index: number): string | undefined {
    return this.images[index];
  }

  /** Une case : un pavé épais, éclairé, dont on distingue dessus et tranche. */
  private createTile(
    tile: TileConfig,
    bounds: { x: number; y: number; width: number; height: number },
    index: number,
    rotationDeg?: number
  ): Group {
    const holder = new Group();
    holder.position.set(bounds.x + bounds.width / 2, 0, bounds.y + bounds.height / 2);
    holder.name = `tile-${index}`;

    const color = new Color(TILE_COLORS[tile.type] ?? TILE_COLOR_DEFAULT);

    // Le corps de la case. MeshLambertMaterial RÉAGIT à la lumière : c'est ce
    // qui distingue le dessus de la tranche. Un matériau qui l'ignore rend
    // six faces de la même couleur, et le volume ne se voit pas — c'est ce
    // qui faisait paraître le plateau plat au premier jet.
    // TROIS CASES SONT RONDES ET PLUS GRANDES : les deux temples de la
    // faveur des dieux et le Schmitt. Quentin les veut distinctes du reste
    // du parcours, qui garde ses pavés carrés.
    //
    // Un jeton plutôt qu'un pavé, et un jeton plus large : le joueur voit de
    // loin qu'il va tomber sur un événement, pas sur une gorgée.
    const special = SPECIAL_TILE_TYPES.has(tile.type);
    const width = bounds.width * (special ? SPECIAL_TILE_SCALE : 1);
    const height = bounds.height * (special ? SPECIAL_TILE_SCALE : 1);

    const body = new Mesh(
      special
        ? new CylinderGeometry(width / 2, width / 2, TILE_THICKNESS, TILE_SEGMENTS)
        : new BoxGeometry(width, TILE_THICKNESS, height),
      new MeshLambertMaterial({ color })
    );
    body.position.y = TILE_THICKNESS / 2;
    body.name = 'tile-body';
    holder.add(body);

    // LA FACE DU DESSUS porte l'illustration. Elle est séparée du corps à
    // dessein : une texture appliquée au pavé entier habillerait les six
    // faces, et une case deviendrait un cube d'affiches. Une case est une
    // pièce posée sur la table — sa tranche est de la matière.
    const face = new Mesh(
      special
        ? new CircleGeometry((width / 2) * 0.94, TILE_SEGMENTS)
        : new PlaneGeometry(width * 0.94, height * 0.94),
      new MeshLambertMaterial({
        // La couleur reste SOUS l'illustration : pendant le chargement, et
        // si l'image n'arrive jamais, la case se lit quand même. Sur un
        // téléphone, quinze images en retard ne doivent pas donner un
        // plateau vide.
        color: color.clone().lerp(new Color(0xffffff), 0.28),
        transparent: true,
      })
    );
    face.rotation.x = -Math.PI / 2;
    // L'ORIENTATION DU DESSIN, qui se joue sur deux plans distincts.
    //
    // 1. La ROTATION DU PLACEMENT redresse l'illustration sur le plateau. Le
    //    parcours est un U : il file vers l'est, tourne vers le sud, repart
    //    vers l'ouest. L'illustration de la flèche est dessinée une fois pour
    //    toutes et pointe vers le bas — sur les segments est et ouest elle
    //    montrait donc un côté sans rapport avec la marche.
    //
    // 2. Le DEMI-TOUR d'une flèche qui recule, qui vient de la case et non du
    //    placement : c'est une donnée de règle, et le dessin la suit.
    //
    // Les deux s'ajoutent, et restent séparés : Quentin doit pouvoir
    // redresser un dessin sans toucher à ce que la case fait au pion.
    //
    // La rotation se fait autour de la normale de la face, donc sur z APRÈS
    // le basculement en x : la face est déjà couchée dans le plan du plateau.
    // Le sens est inversé pour rester HORAIRE à l'écran — la face est vue de
    // dessus, et sa normale pointe vers l'observateur.
    const placed = -((rotationDeg ?? 0) * Math.PI) / 180;
    const flipped = arrowDirection(tile) === 'backward' ? Math.PI : 0;

    face.rotation.z = placed + flipped;
    face.position.y = TILE_THICKNESS + 0.6;
    face.name = 'tile-face';
    holder.add(face);

    this.paint(face, tile.image);

    return holder;
  }

  /**
   * Charge l'illustration et la pose sur la face, quand elle arrive.
   *
   * Le chargement est asynchrone et peut échouer : la case est déjà dessinée
   * avec sa couleur de fond, et l'image ne fait que s'ajouter par-dessus. Un
   * échec ne retire donc rien — il laisse la case telle qu'elle était.
   */
  private paint(face: Mesh, image: string | undefined): void {
    if (!image) return;

    this.loader.load(
      image.startsWith('/') ? image : `/${image}`,
      texture => {
        // Sans cet espace colorimétrique, les illustrations ressortent
        // délavées : Three.js les traiterait comme des données brutes.
        texture.colorSpace = SRGBColorSpace;

        const material = face.material as MeshLambertMaterial;
        material.map = texture;
        // La couleur de fond teinterait l'illustration : une fois l'image
        // là, on la laisse parler.
        material.color.set(0xffffff);
        material.needsUpdate = true;

        this.textures.push(texture);
      },
      undefined,
      () => {
        // Rien à faire : la case garde sa couleur, qui reste lisible.
      }
    );
  }

  /**
   * Pose les pions sur leurs cases.
   *
   * Des volumes simples — Quentin voulait d'abord juger si un pion posé sur
   * une case se lit correctement. « Le reste viendra », disait ce commentaire :
   * le reste, ce sont les MARQUES de statut, ajoutées depuis (SCH-17).
   *
   * Les statuts sont FACULTATIFS dans la signature : la scène doit continuer
   * à se construire pour un appelant qui ne donne que position et couleur,
   * et c'est le cas de plusieurs bancs d'essai du cadrage.
   */
  public setPawns(
    players: { position: number; color: string; marks?: PawnMark[] }[]
  ): void {
    this.pawns.clear();

    players.forEach((player, index) => {
      const tile = this.positions[player.position];
      if (!tile) return;

      // Plusieurs pions sur la même case : on les décale en cercle plutôt
      // que de les empiler, sinon seul le dernier se voit.
      const sharing = players.filter(p => p.position === player.position);
      const rank = sharing.indexOf(player);
      const spread = sharing.length > 1 ? 26 : 0;
      const angle = (rank / Math.max(1, sharing.length)) * Math.PI * 2;

      const pawn = new Mesh(
        new CylinderGeometry(PAWN_RADIUS, PAWN_RADIUS * 1.15, PAWN_HEIGHT, 20),
        new MeshLambertMaterial({ color: new Color(player.color) })
      );
      pawn.position.set(
        tile.x + Math.cos(angle) * spread,
        TILE_THICKNESS + PAWN_HEIGHT / 2,
        tile.z + Math.sin(angle) * spread
      );
      pawn.name = `pawn-${index}`;

      this.pawns.add(pawn);

      // LA MARQUE DE STATUT, au-dessus du pion (SCH-17). Bastien l'a demandée
      // deux fois : un statut qui dure plusieurs tours doit se lire sur le
      // plateau, pas seulement défiler dans le journal au tour où il tombe.
      this.markPawn(pawn, player.marks ?? []);
    });
  }

  /**
   * Pose les marques de statut au-dessus d'un pion (SCH-17).
   *
   * Des SPRITES, et non des plans : un sprite fait toujours face à la caméra.
   * C'est nécessaire depuis que l'inclinaison de la vue est un geste du
   * joueur (#74) — un plan orienté une fois pour toutes se présenterait de
   * profil, donc invisible, dès qu'il change l'angle.
   *
   * Les marques sont ENFANTS du pion : elles le suivent quand il marche vers
   * sa case (#48) sans qu'aucun code d'animation ait à les connaître.
   */
  private markPawn(pawn: Mesh, marks: PawnMark[]): void {
    for (const mark of marks) {
      const texture = paintMark(mark.icon);

      // Pas de contexte 2D (jsdom, ou canvas indisponible) : le pion reste
      // nu. Mieux vaut un pion sans marque qu'une scène qui ne se construit
      // pas — le statut reste lisible dans la liste des joueurs.
      if (!texture) continue;

      this.textures.push(texture);

      const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false }));
      sprite.scale.set(MARK_SIZE, MARK_SIZE, 1);
      sprite.position.set(0, PAWN_HEIGHT / 2 + mark.lift, 0);
      sprite.name = `mark-${mark.label}`;

      pawn.add(sprite);
    }
  }

  /**
   * Où poser le pion d'un joueur sur une case donnée.
   *
   * Exposé pour que l'animation puisse placer un pion entre deux cases sans
   * reconstruire toute la scène — `setPawns` recrée chaque pion, ce qui est
   * précisément ce qui donnait une téléportation.
   */
  public pawnAnchor(tileIndex: number): { x: number; y: number; z: number } | null {
    const tile = this.positions[tileIndex];
    if (!tile) return null;

    return { x: tile.x, y: TILE_THICKNESS + PAWN_HEIGHT / 2, z: tile.z };
  }

  /**
   * Les boîtes de collision des pions posés, pour que le dé les heurte.
   *
   * Quentin : « il faut que les pions et cases aient leur boîte de
   * collision ». Le dé les traversait comme s'ils n'existaient pas.
   *
   * La position vient des pions RÉELLEMENT POSÉS dans la scène, et non des
   * positions de jeu : pendant qu'un pion marche, il est entre deux cases, et
   * c'est là qu'il doit faire obstacle. Lire les positions de jeu placerait
   * l'obstacle là où le pion n'est pas encore.
   *
   * `top` est le SOMMET du pion : un dé qui vole plus haut le survole au lieu
   * d'être dévié par un choc invisible.
   */
  public pawnObstacles(): { x: number; z: number; radius: number; top: number }[] {
    const obstacles: { x: number; z: number; radius: number; top: number }[] = [];

    for (const pawn of this.pawns.children) {
      obstacles.push({
        x: pawn.position.x,
        z: pawn.position.z,
        radius: PAWN_RADIUS * 1.15,
        // `top` est compté AU-DESSUS DES CASES, dans le même repère que la
        // hauteur de vol du dé — laquelle vaut 0 quand le dé est posé sur le
        // plateau. Le donner en coordonnées monde (donc 28 de plus) ferait
        // croire les pions plus hauts qu'ils ne sont, et un dé les
        // traverserait au lieu de les survoler, ou l'inverse.
        top: PAWN_HEIGHT,
      });
    }

    return obstacles;
  }

  /** Le pion d'un joueur, pour le déplacer sans le recréer. */
  public pawnOf(index: number): Mesh | null {
    return (this.pawns.getObjectByName(`pawn-${index}`) as Mesh | undefined) ?? null;
  }

  /**
   * La surface sur laquelle le dé roule, en unités monde.
   *
   * Quentin (20/09/2026) : « je vois que les dés traversent les joueurs et
   * les cases ».
   *
   * IL AVAIT RAISON, et le défaut était grossier : le dé était posé à la
   * hauteur de la TABLE (y = 0) alors que les cases ont 28 unités
   * d'épaisseur. Il roulait donc ENFONCÉ de 28 dans le plateau — la moitié de
   * sa propre hauteur — et passait visuellement sous les pions, qui sont
   * posés SUR les cases.
   *
   * Aucun test ne pouvait le dire : les collisions étaient justes, la
   * physique aussi. C'est la hauteur d'affichage qui était fausse, et elle ne
   * se voit qu'à l'écran.
   */
  public static get diceSurface(): number {
    return TILE_THICKNESS;
  }

  /** Hauteur d'un pion au repos, au-dessus du plateau. */
  public static get pawnRestHeight(): number {
    return TILE_THICKNESS + PAWN_HEIGHT / 2;
  }

  /** Le tapis sous le plateau, qui lui donne son assise. */
  private createTable(step: number): void {
    if (this.positions.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of this.positions) {
      if (!p) continue;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }

    const width = maxX - minX + step + TABLE_PADDING * 2;
    const depth = maxZ - minZ + step + TABLE_PADDING * 2;

    const table = new Mesh(
      new PlaneGeometry(width, depth),
      new MeshLambertMaterial({ color: new Color(TABLE_COLOR) })
    );
    table.rotation.x = -Math.PI / 2;
    table.position.set((minX + maxX) / 2, -1, (minZ + maxZ) / 2);
    table.name = 'table';

    this.group.add(table);
    this.table = table;

    this.createColumns(minX, maxX, (minZ + maxZ) / 2, depth);
  }

  /**
   * Pose les deux colonnes de pouvoirs de part et d'autre du parcours.
   *
   * DES SPRITES, et non des plans. Quentin les veut « toujours face à la
   * caméra, quel que soit l'angle de vue » : c'est exactement ce qu'est un
   * sprite dans Three.js, et il n'y a donc RIEN à écrire pour l'obtenir.
   * Aucun code de réorientation, aucune mise à jour par image — le moteur
   * les oriente au rendu, ce qui est aussi plus juste qu'un calcul fait à la
   * main une fois par tour.
   *
   * C'est le même mécanisme que les badges de statut des pions (SCH-17), et
   * pour la même raison : le joueur incline et pivote la vue comme il veut
   * depuis #74, donc rien de plat ne reste lisible.
   *
   * CE QUE ÇA CHANGE par rapport aux plans précédents : un plan orienté une
   * fois pour toutes se présentait de profil — donc invisible — dès que le
   * joueur tournait d'un quart de tour. Un sprite ne peut pas disparaître
   * ainsi, et `DoubleSide` n'a plus lieu d'être : un sprite n'a pas de dos.
   */
  private createColumns(minX: number, maxX: number, z: number, depth: number): void {
    const height = depth * COLUMN_HEIGHT_FIT;
    const width = height * COLUMN_RATIO;

    const sides = [
      { image: COLUMN_LEFT_IMAGE, x: minX - COLUMN_MARGIN - width / 2, name: 'column-left' },
      { image: COLUMN_RIGHT_IMAGE, x: maxX + COLUMN_MARGIN + width / 2, name: 'column-right' },
    ];

    for (const side of sides) {
      const texture = new TextureLoader().load(side.image);
      texture.colorSpace = SRGBColorSpace;
      this.textures.push(texture);

      const column = new Sprite(new SpriteMaterial({ map: texture, transparent: true }));

      // `scale` tient lieu de dimensions : un sprite n'a pas de géométrie
      // propre, il est mis à l'échelle au rendu.
      column.scale.set(width, height, 1);

      // Le pied posé sur le tapis, le panneau montant vers le haut.
      column.position.set(side.x, height / 2, z);
      column.name = side.name;

      this.group.add(column);
    }
  }

  /** Vide le plateau, en libérant la mémoire graphique. */
  public clear(): void {
    this.pawns.clear();
    this.group.clear();
    this.table = null;
    this.positions = [];
    this.images = [];
  }

  /**
   * Libère textures et géométries.
   *
   * Three.js ne le fait pas tout seul : sans cela, recommencer une partie
   * accumule des textures dans la mémoire graphique jusqu'à saturation.
   */
  public dispose(): void {
    this.group.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(m => m.dispose());
      else material.dispose();
    });

    // Three.js ne libère pas les textures tout seul : sans cela, recommencer
    // une partie en accumule dans la mémoire graphique jusqu'à saturation.
    for (const texture of this.textures) texture.dispose();
    this.textures.length = 0;

    this.clear();
  }
}
