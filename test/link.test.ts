import { describe, it, expect } from 'vitest';
import { Link } from '@/features/link/link';
import { pairedInMemory } from '@/features/link/transport';
import { seal, type Announcement, type Command } from '@/features/link/protocol';

/**
 * LA LIAISON MAÎTRE ↔ ESCLAVE (épique 8, SCH-30 / SCH-31).
 *
 * Les deux appareils sont simulés dans la même page par `pairedInMemory`.
 * Rien ici ne dépend du transport que Quentin retiendra : c'est voulu.
 */

/** Un maître et un esclave branchés, liaison établie. */
function linked() {
  const wire = pairedInMemory();
  const master = new Link('master', wire.a);
  const slave = new Link('slave', wire.b);
  const heard: Announcement[] = [];
  const asked: Command[] = [];

  slave.onAnnouncement((a) => heard.push(a));
  master.onCommand((c) => asked.push(c));
  wire.restore();

  return { wire, master, slave, heard, asked };
}

describe('Sans liaison, le jeu tourne comme aujourd\'hui', () => {
  // Critère de l'épique : « pas de dégradation UX si les appareils ne
  // trouvent pas de connexion (fallback mono-appareil) ».

  it('se déclare seul, sans erreur', () => {
    expect(new Link('master', null).status()).toBe('alone');
  });

  it('refuse une demande plutôt que de laisser attendre un dé qui ne viendra pas', () => {
    expect(new Link('slave', null).request({ kind: 'roll-request' })).toBe(false);
  });

  it('se souvient quand même de la partie, pour un esclave qui arriverait', () => {
    const master = new Link('master', null);

    expect(master.publish({ turn: 1 })).toBe(1);
    expect(master.publish({ turn: 2 })).toBe(2);
  });
});

describe('L\'esclave demande, le maître tranche', () => {
  it('transmet la demande de lancer au maître', () => {
    const { slave, asked } = linked();

    expect(slave.request({ kind: 'roll-request' })).toBe(true);
    expect(asked).toEqual([{ kind: 'roll-request' }]);
  });

  it('transmet la face tirée par le maître, telle quelle', () => {
    // LA FACE N'EST TIRÉE QU'UNE FOIS. L'esclave l'affiche, il ne la
    // recalcule pas — sinon les deux écrans montreraient deux faces.
    const { master, heard } = linked();
    master.publish({ turn: 1 });
    heard.length = 0;

    master.announce({ kind: 'rolled', dice: 4 });

    expect(heard).toEqual([{ kind: 'rolled', version: 1, dice: 4 }]);
  });

  it('diffuse les notifications à l\'esclave aussi', () => {
    // Quentin (27/10/2026) : « notifications partout : plateau ET esclave ».
    const { master, heard } = linked();

    master.announce({ kind: 'notice', text: 'Zeus frappe !' });

    expect(heard.map((a) => a.kind)).toContain('notice');
  });

  it('un esclave n\'annonce rien, même s\'il essaie', () => {
    const wire = pairedInMemory();
    const slave = new Link('slave', wire.a);
    const other = new Link('slave', wire.b);
    const heard: Announcement[] = [];
    other.onAnnouncement((a) => heard.push(a));
    wire.restore();

    slave.publish({ forged: true });
    slave.announce({ kind: 'rolled', dice: 6 });

    expect(heard).toEqual([]);
  });

  it('deux maîtres sur le même WiFi ne se commandent pas', () => {
    const wire = pairedInMemory();
    const a = new Link('master', wire.a);
    const b = new Link('master', wire.b);
    const asked: Command[] = [];
    b.onCommand((c) => asked.push(c));
    wire.restore();

    wire.a.send(JSON.stringify(seal('master', { kind: 'roll-request' })));

    expect(asked).toEqual([]);
    a.close();
  });
});

describe('La liaison se branche sur une voie DÉJÀ ouverte', () => {
  it('se sait reliée, et la manette reçoit la partie', () => {
    // C'est le cas ordinaire : l'écran d'appairage ne rend la voie qu'une
    // fois ouverte, et les deux liaisons se construisent après.
    const wire = pairedInMemory();
    wire.restore();

    const master = new Link('master', wire.a);
    master.publish({ turn: 1 });
    const slave = new Link('slave', wire.b);
    const heard: Announcement[] = [];
    slave.onAnnouncement((a) => heard.push(a));
    master.publish({ turn: 2 });

    expect(master.status()).toBe('linked');
    expect(slave.status()).toBe('linked');
    expect(heard).toEqual([{ kind: 'state', version: 2, state: { turn: 2 } }]);
  });
});

describe('Une coupure du WiFi ne fige pas le téléphone au mauvais tour', () => {
  it('refuse une demande pendant la coupure, pour que le joueur relance', () => {
    // Sans ce refus, le bouton Lancer partirait dans le vide : le téléphone
    // croirait avoir lancé, le plateau n'aurait rien reçu, et la partie
    // resterait bloquée sans que personne ne sache pourquoi.
    const { wire, slave, asked } = linked();

    wire.cut();

    expect(slave.request({ kind: 'roll-request' })).toBe(false);
    expect(asked).toEqual([]);
  });

  it('rattrape à la reconnexion ce qui a été manqué', () => {
    const { wire, master, heard } = linked();
    master.publish({ turn: 1 });

    wire.cut();
    master.publish({ turn: 2 });   // perdu : personne en face
    master.publish({ turn: 3 });   // perdu aussi
    heard.length = 0;
    wire.restore();

    expect(heard).toEqual([{ kind: 'state', version: 3, state: { turn: 3 } }]);
  });

  it('ne renvoie rien à un esclave déjà à jour', () => {
    const { wire, master, heard } = linked();
    master.publish({ turn: 1 });

    wire.cut();
    heard.length = 0;
    wire.restore();

    expect(heard).toEqual([]);
  });

  it('un esclave qui arrive en pleine partie reçoit l\'état courant', () => {
    // Le cas de la TV qui prend la suite d'un téléphone vidé.
    const wire = pairedInMemory();
    const master = new Link('master', wire.a);
    master.publish({ turn: 1 });
    master.publish({ turn: 7 });

    const late = new Link('slave', wire.b);
    const heard: Announcement[] = [];
    late.onAnnouncement((a) => heard.push(a));
    wire.restore();

    expect(heard).toEqual([{ kind: 'state', version: 2, state: { turn: 7 } }]);
  });

  it('ignore une annonce plus vieille que ce qu\'il a déjà vu', () => {
    // Un paquet retardé ne doit pas ramener l'esclave un tour en arrière.
    const { wire, master, heard } = linked();
    master.publish({ turn: 1 });
    master.publish({ turn: 2 });
    heard.length = 0;

    wire.a.send(JSON.stringify(seal('master', { kind: 'state', version: 1, state: { turn: 1 } })));

    expect(heard).toEqual([]);
  });
});
