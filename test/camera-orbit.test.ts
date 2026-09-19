import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * 3D-43 — tourner la caméra autour du plateau.
 *
 * Quentin : « il faudrait pouvoir tourner la caméra ».
 *
 * Deux exigences de fond, posées par PO et qui décident de la forme du code :
 *
 * 1. La rotation manuelle s'AJOUTE au choix d'orientation automatique de #41,
 *    elle ne le remplace pas. Le quart de tour reste calculé sur la forme du
 *    parcours ; ce que le joueur manipule, c'est sa vue. Ce sont donc deux
 *    angles distincts, et non un seul que la rotation écraserait.
 *
 * 2. « Recadrer » restaure le cadrage automatique ANGLE COMPRIS. Un bouton
 *    qui rendrait le zoom mais pas l'angle laisserait perdu le joueur qui
 *    s'en sert précisément parce qu'il l'est.
 *
 * jsdom n'a pas de WebGL : la scène tourne en repli. C'est voulu — l'état de
 * l'observateur est une propriété de la scène, pas un effet de bord du rendu,
 * et il doit rester mesurable sans navigateur.
 */

let container: HTMLElement;
let scene: BoardScene;

beforeEach(() => {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: 390, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 844, configurable: true });

  scene = new BoardScene({ container });
  // Le plateau officiel : large et plat, donc tourné d'un quart de tour.
  const tiles = [];
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 0 });
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 675 });
  scene.setBoardExtent(tiles, 120);
});

afterEach(() => scene.dispose());

describe('3D-43 — la rotation au doigt', () => {
  it('tourne autour de la verticale', () => {
    scene.orbitBy(90, 0);

    expect(scene.getOrbit().yawDeg).toBeCloseTo(90);
  });

  it('accumule les gestes successifs', () => {
    scene.orbitBy(30, 0);
    scene.orbitBy(45, 0);

    expect(scene.getOrbit().yawDeg).toBeCloseTo(75);
  });

  it('fait le tour complet sans butée', () => {
    // Un plateau se regarde de tous les côtés : borner le lacet créerait un
    // mur invisible au milieu d'un geste continu.
    scene.orbitBy(400, 0);

    expect(() => scene.orbitBy(400, 0)).not.toThrow();
    // L'angle reste exploitable : ramené dans un tour, jamais cumulé à
    // l'infini au point de perdre la précision du flottant.
    expect(Math.abs(scene.getOrbit().yawDeg)).toBeLessThanOrEqual(360);
  });
});

describe('3D-43 — l\'élévation est bornée', () => {
  it('ne passe jamais sous le plateau', () => {
    // Sous le plateau, le joueur voit la tranche des cases par en dessous et
    // ne comprend plus rien : c'est un état dont on ne sait pas revenir.
    scene.orbitBy(0, -500);

    // Borné des DEUX côtés : « inférieur à 90 » serait vrai aussi d'un angle
    // de -448°, qui décrit une caméra ayant fait plusieurs tours. L'angle
    // doit rester dans le domaine où il veut dire quelque chose.
    const tilt = scene.getOrbit().tiltDeg;
    expect(tilt).toBeGreaterThan(0);
    expect(tilt).toBeLessThan(90);
  });

  it('ne bascule pas à la verticale absolue', () => {
    // À la verticale, la perspective disparaît : on retombe sur la vue plate
    // que Quentin a refusée au premier jet.
    scene.orbitBy(0, 500);

    const tilt = scene.getOrbit().tiltDeg;
    expect(tilt).toBeGreaterThan(0);
    expect(tilt).toBeLessThan(90);
  });

  it('garde la caméra au-dessus du plateau, quel que soit le geste', () => {
    scene.orbitBy(137, -900);

    expect(scene.getCameraPosition().y).toBeGreaterThan(0);
  });
});

describe('3D-43 — rotation manuelle et cadrage automatique cohabitent', () => {
  it('ne touche pas à l\'orientation choisie sur la forme du parcours', () => {
    const auto = scene.getFraming().yawDeg;
    expect(auto).toBe(90);

    scene.orbitBy(45, 0);

    // #41 décide du sens de présentation du PLATEAU ; #43 décide d'où on le
    // regarde. Confondre les deux ferait recalculer un cadrage à chaque
    // geste, et le plateau changerait de taille pendant qu'on tourne.
    expect(scene.getFraming().yawDeg).toBe(90);
  });

  it('la vue effective compose les deux angles', () => {
    scene.orbitBy(45, 0);

    expect(scene.getOrbit().yawDeg).toBeCloseTo(45);
    expect(scene.getFraming().yawDeg).toBe(90);
  });
});

describe('3D-43 — « Recadrer » restaure tout, angle compris', () => {
  it('annule la rotation', () => {
    scene.orbitBy(120, -25);

    scene.resetView();

    expect(scene.getOrbit().yawDeg).toBe(0);
  });

  it('annule aussi l\'élévation', () => {
    scene.orbitBy(0, 30);

    scene.resetView();

    expect(scene.getOrbit().tiltDeg).toBeCloseTo(scene.getDefaultTiltDeg());
  });

  it('annule rotation, zoom et déplacement d\'un seul geste', () => {
    scene.orbitBy(200, 20);
    scene.setUserZoom(2.4);
    scene.panBy(90, 60);

    scene.resetView();

    expect(scene.getOrbit().yawDeg).toBe(0);
    expect(scene.getOrbit().tiltDeg).toBeCloseTo(scene.getDefaultTiltDeg());
    expect(scene.getUserZoom()).toBe(1);
  });
});

describe('3D-43 — le plateau reste au centre de la rotation', () => {
  it('tourne autour du parcours, pas autour de l\'origine', () => {
    // Un parcours loin de l'origine : si la caméra orbitait autour de (0,0),
    // le plateau sortirait du champ au premier geste.
    const far = Array.from({ length: 8 }, (_, i) => ({ x: 4000 + i * 135, z: 3000 }));
    scene.setBoardExtent(far, 120);

    const cx = 4000 + (7 * 135) / 2;
    const cz = 3000;

    // On vérifie la DIRECTION, pas la distance : celle-ci varie légitimement
    // avec l'angle, puisque le plateau n'offre pas le même encombrement de
    // face et de côté. Ce qui doit rester vrai, c'est que la caméra se place
    // toujours sur le relèvement demandé depuis le centre du parcours — si
    // elle orbitait autour de l'origine, l'angle observé n'aurait aucun
    // rapport avec celui demandé.
    for (const yaw of [0, 60, 120, 180, 240, 300]) {
      scene.resetView();
      scene.orbitBy(yaw, 0);
      const p = scene.getCameraPosition();

      const observed = (Math.atan2(p.x - cx, p.z - cz) * 180) / Math.PI;
      const delta = Math.abs(((observed - yaw + 540) % 360) - 180);

      expect(delta).toBeLessThan(0.5);
    }
  });
});

describe('3D-43 — le cadrage tient compte de l\'angle de vue', () => {
  it('cadre au plus près selon l\'angle, sans jamais couper le plateau', () => {
    // Le cadrage ne se DÉDUIT plus d'une formule, il se MESURE : on projette
    // les coins de l'emprise et on recule jusqu'à ce qu'ils tiennent. La
    // formule précédente modélisait le plateau comme une carte plate face à
    // l'objectif, alors que c'est un plan incliné dont le bord proche est
    // bien plus près de la caméra — elle annonçait que tout tenait pendant
    // que les coins sortaient à 450 px sur un écran de 390.
    //
    // Conséquence mesurée : le plateau officiel se cadre au plus large vu de
    // côté (46 px contre 31 de face), parce qu'il présente alors sa petite
    // dimension à l'horizontale. L'assertion porte sur ce qui compte — que
    // la taille dépende bien de l'angle — plutôt que sur un chiffre.
    scene.resetView();
    const front = scene.worldToScreenPixels(120);

    scene.orbitBy(90, 0);
    const side = scene.worldToScreenPixels(120);

    expect(side).toBeGreaterThan(front);
  });

  it('recule le plus en diagonale, où le plateau est le plus encombrant', () => {
    // Un rectangle vu en biais occupe, sur l'horizontale, la somme des
    // projections de ses deux côtés : c'est là qu'il est le plus large, donc
    // là où il faut le plus reculer.
    scene.resetView();
    const front = scene.worldToScreenPixels(120);
    scene.resetView();
    scene.orbitBy(45, 0);
    const diagonal = scene.worldToScreenPixels(120);

    expect(diagonal).toBeLessThan(front);
  });

  it('tient compte de l\'inclinaison', () => {
    // Une vue plongeante replie le plateau en profondeur et permet de s'en
    // approcher ; une vue rasante le déploie devant l'objectif. L'ancienne
    // formule ignorait l'effet sur ce plateau — la mesure, elle, le voit.
    scene.resetView();
    scene.orbitBy(0, -100);
    const high = scene.worldToScreenPixels(120);

    scene.resetView();
    scene.orbitBy(0, 100);
    const low = scene.worldToScreenPixels(120);

    expect(low).toBeLessThan(high);
  });
});
