import { describe, it, expect } from 'vitest';
import { PROTOCOL_VERSION, seal, parse, isPlayableFace } from '@/features/link/protocol';
import { StateHistory, HISTORY_DEPTH } from '@/features/link/history';

/**
 * LA LIAISON À DEUX APPAREILS (épique 8, SCH-30 / SCH-31).
 *
 * Ces tests ne touchent aucun réseau : ils gardent le vocabulaire et la
 * mémoire, qui sont communs à toutes les combinaisons — APK, navigateur,
 * TV. Quentin (27/10/2026) : « tous les combos doivent marcher ».
 */

describe('Ce qui arrive du réseau ne fait jamais tomber la partie', () => {
  it('relit fidèlement ce qui a été emballé', () => {
    const sent = seal('slave', { kind: 'roll-request' });

    expect(parse(JSON.stringify(sent))).toEqual(sent);
  });

  it.each([
    ['du texte qui n\'est pas du JSON', '{tronqué'],
    ['un JSON qui n\'est pas un objet', '42'],
    ['null', 'null'],
    ['un message sans corps', JSON.stringify({ v: PROTOCOL_VERSION, from: 'slave' })],
    ['un corps sans genre', JSON.stringify({ v: PROTOCOL_VERSION, from: 'slave', body: {} })],
  ])('rend null pour %s, sans jeter', (_label, raw) => {
    // N'importe quel appareil peut écrire sur le WiFi d'une soirée. Un
    // paquet illisible doit être ignoré, pas propagé en exception.
    expect(() => parse(raw)).not.toThrow();
    expect(parse(raw)).toBeNull();
  });

  it('refuse un appareil d\'une autre génération du protocole', () => {
    // Un vieux build et un neuf ne doivent pas croire se comprendre.
    const stale = JSON.stringify({ v: PROTOCOL_VERSION + 1, from: 'slave', body: { kind: 'roll-request' } });

    expect(parse(stale)).toBeNull();
  });

  it('refuse un rôle inconnu', () => {
    const odd = JSON.stringify({ v: PROTOCOL_VERSION, from: 'spectator', body: { kind: 'roll-request' } });

    expect(parse(odd)).toBeNull();
  });
});

describe('Seule une face de 1 à 6 peut déplacer un pion', () => {
  // `TurnRunner.playTurn` fait confiance à son argument. Un `rolled`
  // corrompu le déplacerait de 0 ou de 47 cases.
  it.each([1, 2, 3, 4, 5, 6])('accepte %i', (face) => {
    expect(isPlayableFace(face)).toBe(true);
  });

  it.each([0, 7, -1, 3.5, NaN, Infinity, '4', null, undefined])('refuse %p', (face) => {
    expect(isPlayableFace(face)).toBe(false);
  });
});

describe('La mémoire courte, pour passer la main en pleine partie', () => {
  // Quentin (27/10/2026) : « pouvoir revenir ou changer d'esclave/maître en
  // plein game ».

  it('n\'a rien à envoyer tant que rien n\'a été joué', () => {
    expect(new StateHistory().catchUp(0)).toBeNull();
  });

  it('garde au plus dix états, comme le demande SCH-31', () => {
    const history = new StateHistory();
    for (let turn = 0; turn < 25; turn++) history.record({ turn });

    expect(HISTORY_DEPTH).toBe(10);
    expect(history.at(15)).toBeNull();
    expect(history.at(16)).not.toBeNull();
    expect(history.at(25)).not.toBeNull();
  });

  it('ne réutilise jamais un numéro, même après oubli', () => {
    // C'est ce qui rend `since` comparable entre deux appareils sans
    // horloge commune.
    const history = new StateHistory(2);
    const versions = [1, 2, 3, 4].map((turn) => history.record({ turn }));

    expect(versions).toEqual([1, 2, 3, 4]);
    expect(history.currentVersion()).toBe(4);
  });

  it('rend l\'état ENTIER à un appareil qui arrive sans rien', () => {
    // Le cas du téléphone qui prend la suite de la TV : il part de zéro.
    const history = new StateHistory();
    history.record({ turn: 1 });
    history.record({ turn: 2 });

    expect(history.catchUp(0)).toEqual({ kind: 'state', version: 2, state: { turn: 2 } });
  });

  it('rend l\'état entier même quand le retard dépasse la mémoire', () => {
    // Un appareil parti trop longtemps n'a plus de delta exploitable.
    const history = new StateHistory(3);
    for (let turn = 1; turn <= 8; turn++) history.record({ turn });

    expect(history.catchUp(1)).toEqual({ kind: 'state', version: 8, state: { turn: 8 } });
  });

  it('n\'envoie rien à un appareil déjà à jour — la batterie compte', () => {
    const history = new StateHistory();
    history.record({ turn: 1 });

    expect(history.catchUp(1)).toBeNull();
    expect(history.catchUp(9)).toBeNull();
  });
});
