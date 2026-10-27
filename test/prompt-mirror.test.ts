import { describe, it, expect, beforeEach, vi } from 'vitest';
import { watchPrompts, type Prompt } from '@/features/link/prompt-mirror';
import { showActionModal, runModalSteps } from '@/features/board/scene3d/action-modal';
import { showHermesScreen } from '@/features/board/scene3d/hermes-screen';
import { showPoseidonScreen } from '@/features/board/scene3d/poseidon-screen';

/**
 * VALIDER DEPUIS LE TÉLÉPHONE (Quentin, 27/10/2026 : « valider / confirmer
 * les notifications, pas juste les recevoir »).
 *
 * Les fenêtres sont les VRAIES fenêtres du jeu : le miroir doit les
 * comprendre telles qu'elles sont, sans qu'on les ait adaptées pour lui.
 */

/** Laisse passer l'observateur, qui prévient après coup. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const STEP = { title: 'Case Poulet', tile: null, lines: ['Tu deviens le Petit Poulet.'] };

let seen: (Prompt | null)[];

beforeEach(() => {
  document.body.innerHTML = '';
  seen = [];
});

describe('Le téléphone voit la fenêtre ouverte sur le plateau', () => {
  it('avec son titre, ses lignes et le libellé de son bouton', async () => {
    watchPrompts(document.body, (p) => seen.push(p));
    showActionModal(STEP, () => {});
    await settle();

    expect(seen.at(-1)).toMatchObject({
      title: 'Case Poulet',
      lines: ['Tu deviens le Petit Poulet.'],
      action: 'Valider',
    });
  });

  it('sait qu\'elle est fermée', async () => {
    const watch = watchPrompts(document.body, (p) => seen.push(p));
    showActionModal(STEP, () => {});
    await settle();

    watch.validate(watch.current()!.id);
    await settle();

    expect(seen.at(-1)).toBeNull();
  });

  it('suit les étapes une à une, « Suivant » puis « Valider »', async () => {
    const watch = watchPrompts(document.body, (p) => seen.push(p));
    runModalSteps([STEP, { ...STEP, title: 'Gorgées' }], () => {});
    await settle();
    expect(watch.current()!.action).toBe('Suivant');

    watch.validate(watch.current()!.id);
    await settle();

    expect(watch.current()).toMatchObject({ title: 'Gorgées', action: 'Valider' });
  });

  it('ignore l\'écran d\'appairage, qui n\'est pas une fenêtre de jeu', async () => {
    const watch = watchPrompts(document.body, (p) => seen.push(p));
    const pairing = document.createElement('div');
    pairing.className = 'setup-screen action-modal';
    pairing.id = 'link-screen';
    document.body.appendChild(pairing);
    await settle();

    expect(watch.current()).toBeNull();
  });
});

describe('Valider depuis le téléphone, c\'est appuyer sur le bouton du plateau', () => {
  it('solde la case comme un doigt sur le plateau', async () => {
    const onValidate = vi.fn();
    const watch = watchPrompts(document.body, () => {});
    showActionModal(STEP, onValidate);

    expect(watch.validate(watch.current()!.id)).toBe(true);
    expect(onValidate).toHaveBeenCalledOnce();
  });

  it('valide aussi le rappel de Poséidon, qui ne demande aucun choix', () => {
    const onDone = vi.fn();
    const watch = watchPrompts(document.body, () => {});
    showPoseidonScreen([5, 2], onDone);

    expect(watch.current()!.action).not.toBeNull();
    expect(watch.validate(watch.current()!.id)).toBe(true);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('une validation en retard ne vise pas la fenêtre suivante', async () => {
    // Deux appuis sur le téléphone pendant que le WiFi traîne : le second
    // visait la première étape, il ne doit pas solder la seconde.
    const onDone = vi.fn();
    const watch = watchPrompts(document.body, () => {});
    runModalSteps([STEP, { ...STEP, title: 'Gorgées' }], onDone);
    const first = watch.current()!.id;

    watch.validate(first);
    await settle();

    expect(watch.validate(first)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('Un choix ne se fait pas à distance', () => {
  it('montre Hermès, mais ne le valide pas', () => {
    // Valider de loin appliquerait la sélection par défaut — un adversaire
    // que personne n'a choisi.
    const onDone = vi.fn();
    const watch = watchPrompts(document.body, () => {});
    showHermesScreen(0, 3, [{ index: 1, name: 'Bastien', position: 8 }], onDone);

    const prompt = watch.current()!;
    expect(prompt.title).toMatch(/herm[eè]s/i);
    expect(prompt.action).toBeNull();
    expect(watch.validate(prompt.id)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('Le téléphone n\'est prévenu que d\'un vrai changement', () => {
  it('ne renvoie pas la même fenêtre quand autre chose bouge sur la page', async () => {
    // Chaque envoi réveille le téléphone : la batterie est un risque
    // relevé par l'épique.
    watchPrompts(document.body, (p) => seen.push(p));
    showActionModal(STEP, () => {});
    await settle();
    const before = seen.length;

    document.body.appendChild(document.createElement('div'));
    await settle();

    expect(seen.length).toBe(before);
  });

  it('montre la fenêtre du DESSUS quand deux sont ouvertes', async () => {
    const watch = watchPrompts(document.body, () => {});
    showActionModal(STEP, () => {});
    showPoseidonScreen([5, 2], () => {});

    expect(watch.current()!.title).not.toBe('Case Poulet');
  });
});
