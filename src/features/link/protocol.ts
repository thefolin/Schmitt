/**
 * LE VOCABULAIRE DE LA LIAISON À DEUX APPAREILS.
 *
 * Ce module ne parle à personne : il ne connaît ni WebSocket, ni UDP, ni
 * Capacitor. Il dit seulement QUELS messages existent et à quoi ils
 * ressemblent. Le transport vient par-dessus, et peut changer sans toucher
 * ici — c'est la raison de cette séparation.
 *
 * POURQUOI LE MAÎTRE SEUL TIRE LE DÉ (Quentin, 27/10/2026 : « APK contrôle
 * site web OU site web contrôle APK », tous les combos TV/PC/smartphone).
 *
 * Le critère « la face du dé reste identique sur les deux écrans » ne peut
 * PAS être tenu en rejouant la physique de chaque côté : `DicePhysics`
 * appelle `Math.random()` à huit endroits, et il est partagé avec `main`.
 * Deux simulations donneraient deux faces — exactement le défaut que
 * `dice-3d-scene.ts` documente : « la face vue peut différer de la face
 * jouée », et ça se conteste à table.
 *
 * Donc : UN SEUL tirage, chez le maître, diffusé comme une donnée. L'esclave
 * demande, le maître tranche et annonce. L'esclave n'invente jamais une face.
 *
 * C'est la même règle que la refonte 3D vient d'établir pour le panneau : la
 * valeur montrée est celle qui compte, jamais un second tirage.
 */

/** La version du dialecte. Deux appareils qui ne la partagent pas se refusent. */
export const PROTOCOL_VERSION = 1;

/**
 * Qui mène. Un appareil n'est maître ou esclave que par ce qu'il fait, pas
 * par ce qu'il est : le même build sert les deux rôles, sur APK comme sur
 * navigateur. Quentin : « bidirectionnel ».
 */
export type Role = 'master' | 'slave';

/** Ce que l'esclave demande. Il demande — il ne décide pas. */
export type Command =
  /** « Je veux lancer. » Le maître tire, anime, puis annonce la face. */
  | { kind: 'roll-request' }
  /** « Je veux lancer les deux dés de la faveur. » Même règle. */
  | { kind: 'favor-request' }
  /**
   * « J'ai lu, on continue » : valide la fenêtre ouverte sur le plateau.
   * Elle est désignée par son numéro, pour qu'un appui en retard ne solde
   * pas la fenêtre suivante.
   */
  | { kind: 'validate'; prompt: number }
  /** Reprise de liaison : l'esclave annonce la dernière version qu'il a vue. */
  | { kind: 'resync'; since: number };

/**
 * Ce que le maître annonce. Chaque annonce porte un numéro qui ne recule
 * jamais : c'est lui qui permet de savoir si l'on a manqué quelque chose,
 * sans horloge partagée — deux appareils n'ont pas la même heure.
 */
export type Announcement =
  /** L'état entier. Envoyé à la connexion, et pour rattraper un retard. */
  | { kind: 'state'; version: number; state: unknown }
  /** Un changement depuis la version précédente. */
  | { kind: 'delta'; version: number; from: number; patch: unknown }
  /** La face tirée par le maître. L'esclave l'affiche, il ne la recalcule pas. */
  | { kind: 'rolled'; version: number; dice: number }
  /** Les deux faces de la faveur, tirées par le maître. */
  | { kind: 'favor-rolled'; version: number; dice: [number, number] }
  /**
   * Une notification. Quentin (27/10/2026) a tranché qu'elles ne sont PAS
   * privées : « plateau ET esclave ». Elle part donc aux deux, et l'épique
   * SCH-33 est à corriger sur ce point.
   */
  | { kind: 'notice'; version: number; text: string };

/** Tout ce qui circule, dans un sens ou dans l'autre. */
export type Message = (Command | Announcement) & { v?: number };

/** Une enveloppe telle qu'elle passe sur le réseau. */
export interface Envelope {
  /** Version du protocole, pour refuser un appareil d'une autre génération. */
  v: number;
  /** Qui parle. Sert à repérer deux maîtres sur le même réseau. */
  from: Role;
  /** Le message lui-même. */
  body: Message;
}

/** Emballe un message pour l'envoi. */
export function seal(from: Role, body: Message): Envelope {
  return { v: PROTOCOL_VERSION, from, body };
}

/**
 * Lit ce qui arrive du réseau, et rend `null` si ce n'est pas lisible.
 *
 * NE JETTE JAMAIS : à l'autre bout il y a un appareil quelconque sur un WiFi
 * quelconque. Un paquet tronqué, un vieux build, un scanner de port qui
 * envoie n'importe quoi — aucun ne doit faire tomber la partie en cours.
 * Le repli mono-appareil est un critère d'acceptation de l'épique.
 */
export function parse(raw: string): Envelope | null {
  let candidate: unknown;

  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof candidate !== 'object' || candidate === null) return null;

  const { v, from, body } = candidate as Record<string, unknown>;

  if (v !== PROTOCOL_VERSION) return null;
  if (from !== 'master' && from !== 'slave') return null;
  if (typeof body !== 'object' || body === null) return null;
  if (typeof (body as Record<string, unknown>).kind !== 'string') return null;

  return { v, from, body: body as Message };
}

/**
 * Un dé est-il une face jouable ?
 *
 * Le maître s'en sert sur CE QU'IL TIRE, et l'esclave sur ce qu'il reçoit :
 * un `rolled` corrompu ne doit pas déplacer un pion de 0 ou de 47 cases.
 * `TurnRunner.playTurn` fait confiance à son argument — la vérification est
 * donc à faire ici, avant de l'appeler.
 */
export function isPlayableFace(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}
