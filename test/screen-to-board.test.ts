import { describe, it, expect, afterEach } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';
import { GRAB_LIFT } from '@/features/board/scene3d/dice-gesture';

/**
 * 3D-64 — le dé suit le doigt.
 *
 * Quentin (20/09/2026) : « quand je le prends il s'élève très peu et je ne
 * peux pas le déplacer ».
 *
 * LE DÉFAUT, et il était béant une fois nommé : le code écoutait l'appui
 * (`pointerdown`) et le relâchement (`pointerup`), mais RIEN ENTRE LES DEUX.
 * Il n'existait aucun `pointermove`. Le dé restait donc collé sur place,
 * soulevé, jusqu'au lâcher — le retour visuel disait « je te tiens » et le dé
 * démentait.
 *
 * Faire suivre un objet au doigt demande de savoir QUEL POINT DU PLATEAU un
 * pixel vise. Cette conversion n'existait pas : la scène savait convertir une
 * longueur monde en pixels, jamais l'inverse.
 *
 * Elle se vérifie sans rien afficher — c'est de la géométrie — mais PAS sans
 * caméra : le rapport dépend de l'inclinaison et de la distance de vue. Le
 * test construit donc une vraie scène, sans jamais demander de rendu.
 */

let scene: BoardScene;

afterEach(() => scene?.dispose());

/** Une scène cadrée sur le plateau officiel, dans un viewport de téléphone. */
function phoneScene(): BoardScene {
  const container = document.createElement('div');
  // jsdom rapporte 0 pour clientWidth/Height : sans ces valeurs, la scène se
  // construit sur un viewport nul et la projection n'a aucun sens.
  Object.defineProperty(container, 'clientWidth', { value: 390, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 844, configurable: true });
  container.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0 }) as DOMRect;

  document.body.appendChild(container);

  const built = new BoardScene({ container });

  const positions = Array.from({ length: 23 }, (_, index) => ({
    x: (index % 10) * 135,
    z: Math.floor(index / 10) * 135,
  }));
  built.setBoardExtent(positions, 120);
  built.showWholeBoard();

  return built;
}

describe('3D-64 — un pixel de l\'écran vise un point du plateau', () => {
  it('trouve un point sous le centre de l\'écran', () => {
    // Sans cette conversion, on sait qu'un geste a eu lieu mais pas où il
    // pointe : c'est exactement pourquoi le dé ne pouvait pas suivre.
    scene = phoneScene();

    expect(scene.screenToBoard(195, 422)).not.toBeNull();
  });

  it('déplace le point visé quand le doigt se déplace', () => {
    // LA PROPRIÉTÉ QUI COMPTE. Si deux pixels différents visaient le même
    // point, le dé resterait immobile quoi qu'on fasse — le défaut, sous une
    // autre forme.
    scene = phoneScene();

    const left = scene.screenToBoard(100, 422);
    const right = scene.screenToBoard(290, 422);

    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(right!.x).toBeGreaterThan(left!.x);
  });

  it('suit le doigt dans le même SENS, à l\'horizontale', () => {
    // Un dé qui part à gauche quand le doigt va à droite serait pire que
    // l'immobilité.
    scene = phoneScene();

    const a = scene.screenToBoard(150, 422)!;
    const b = scene.screenToBoard(240, 422)!;

    expect(b.x - a.x).toBeGreaterThan(0);
  });

  it('suit le doigt dans le même SENS, en profondeur', () => {
    // La vue est en plongée : glisser vers le BAS de l'écran doit RAPPROCHER
    // le point, donc augmenter z. Un signe inversé ici enverrait le dé à
    // l'opposé du geste, et c'est une erreur qu'on ne voit qu'à l'usage.
    scene = phoneScene();

    const haut = scene.screenToBoard(195, 300)!;
    const bas = scene.screenToBoard(195, 600)!;

    expect(bas.z).toBeGreaterThan(haut.z);
  });
});

describe('3D-64 — la hauteur du dé soulevé est prise en compte', () => {
  it('ne vise pas le même point au sol et à hauteur de prise', () => {
    // Le dé est SOULEVÉ pendant qu'on le tient. Lire sa position au niveau du
    // sol le ferait dériver sous le doigt, d'autant plus que la vue est
    // inclinée : plus l'objet est haut, plus l'écart se creuse.
    scene = phoneScene();

    const sol = scene.screenToBoard(195, 600, 0)!;
    const souleve = scene.screenToBoard(195, 600, GRAB_LIFT)!;

    expect(souleve.z).not.toBeCloseTo(sol.z, 1);
  });
});

describe('3D-64 — viser le ciel ne renvoie rien', () => {
  it('ne rend aucun point au-dessus de l\'horizon', () => {
    // Il n'y a alors aucun point du plateau sous le doigt. Inventer une
    // position enverrait le dé à l'infini, ce qu'un `null` évite franchement.
    scene = phoneScene();

    // Très au-dessus du cadre : le rayon part vers le ciel.
    expect(scene.screenToBoard(195, -100000)).toBeNull();
  });
});
