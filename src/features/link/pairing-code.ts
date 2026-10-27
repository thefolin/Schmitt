/**
 * L'OFFRE ET LA RÉPONSE WEBRTC, RÉDUITES À CE QU'UN QR CODE PORTE BIEN.
 *
 * Quentin (27/10/2026) a retenu l'appairage par QR code : un appareil
 * affiche, l'autre scanne. Une description WebRTC brute (SDP) pèse 600 à
 * 1 500 caractères — un QR aussi dense se lit mal sur un écran, à distance,
 * sous l'éclairage d'une soirée. On n'en garde donc que ce qui varie d'un
 * appareil à l'autre, et l'on reconstruit le reste à l'arrivée :
 *
 *   - les identifiants ICE (`ufrag`, `pwd`) ;
 *   - l'empreinte du certificat DTLS, qui CHIFFRE la liaison et prouve que
 *     l'on parle bien à l'appareil scanné ;
 *   - les adresses où joindre l'appareil sur le WiFi.
 *
 * Le reste est identique pour toute liaison de données : une seule voie, pas
 * d'audio ni de vidéo. Résultat : 110 à 200 caractères au lieu de 1 000.
 *
 * Pas de serveur relais (TURN) : la liaison reste sur le réseau local, sans
 * internet, comme l'épique l'exige.
 */

/** Version du format, pour refuser un QR d'un autre build. */
const CODE_VERSION = 'S1';

/** Offre (affichée par celui qui ouvre la partie) ou réponse (renvoyée). */
export type PairingKind = 'offer' | 'answer';

export interface PairingCode {
  kind: PairingKind;
  ufrag: string;
  pwd: string;
  /** Empreinte SHA-256 du certificat : 32 octets. */
  fingerprint: Uint8Array;
  /** Adresses où joindre l'appareil, déjà sans doublon. */
  candidates: { address: string; port: number }[];
}

/**
 * Extrait d'une description WebRTC ce qu'il faut transmettre.
 *
 * Rend `null` si un élément essentiel manque : mieux vaut ne pas afficher de
 * QR que d'en afficher un qui échouera en silence une fois scanné.
 */
export function fromSdp(kind: PairingKind, sdp: string): PairingCode | null {
  const line = (prefix: string) =>
    sdp.split(/\r?\n/).find((l) => l.startsWith(prefix))?.slice(prefix.length).trim();

  const ufrag = line('a=ice-ufrag:');
  const pwd = line('a=ice-pwd:');
  const print = line('a=fingerprint:sha-256 ');

  if (!ufrag || !pwd || !print) return null;

  const fingerprint = fromHex(print);
  if (fingerprint === null || fingerprint.length !== 32) return null;

  const seen = new Set<string>();
  const candidates: PairingCode['candidates'] = [];

  for (const raw of sdp.split(/\r?\n/)) {
    if (!raw.startsWith('a=candidate:')) continue;

    // a=candidate:<fondation> <composante> <protocole> <priorité> <adresse> <port> typ <type> …
    const parts = raw.slice('a=candidate:'.length).trim().split(/\s+/);
    const [, , protocol, , address, port, typ, type] = parts;

    // UDP SEULEMENT : les candidats TCP n'aident pas sur un WiFi local et
    // alourdiraient le QR. Les relais n'existent pas ici (pas de TURN).
    if (protocol?.toLowerCase() !== 'udp' || typ !== 'typ') continue;
    if (type !== 'host' && type !== 'srflx') continue;

    const portNumber = Number(port);
    if (!address || !Number.isInteger(portNumber) || portNumber <= 0 || portNumber > 65535) continue;

    const key = `${address} ${portNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({ address, port: portNumber });
  }

  // SANS ADRESSE, PERSONNE NE PEUT NOUS JOINDRE. Le QR serait inutile.
  if (candidates.length === 0) return null;

  return { kind, ufrag, pwd, fingerprint, candidates };
}

/**
 * Reconstruit une description WebRTC complète à partir du code reçu.
 *
 * `setup` décide qui ouvre la poignée de main chiffrée (DTLS) : l'offre
 * laisse le choix (`actpass`), la réponse le prend (`active`). C'est ce que
 * fait Chrome de lui-même ; le reproduire évite que les deux côtés attendent
 * l'autre indéfiniment.
 */
export function toSdp(code: PairingCode): string {
  const setup = code.kind === 'offer' ? 'actpass' : 'active';
  const fingerprint = [...code.fingerprint]
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');

  const candidates = code.candidates.map(
    ({ address, port }, index) =>
      // La priorité suit la formule de la RFC 8445 pour un candidat local ;
      // l'ordre d'apparition départage les adresses entre elles.
      `a=candidate:${index + 1} 1 udp ${2122260223 - index} ${address} ${port} typ host`
  );

  return [
    'v=0',
    'o=- 0 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    ...candidates,
    `a=ice-ufrag:${code.ufrag}`,
    `a=ice-pwd:${code.pwd}`,
    `a=fingerprint:sha-256 ${fingerprint}`,
    `a=setup:${setup}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    '',
  ].join('\r\n');
}

/**
 * Le code en une ligne de texte, prête pour le QR.
 *
 * `|` sépare les champs : il n'apparaît ni dans `ufrag`/`pwd` (la RFC 8839
 * ne permet que lettres, chiffres, `+` et `/`), ni en base64 URL, ni dans
 * une adresse. Les adresses se séparent par `,` ; le port suit le DERNIER
 * `:`, ce qui laisse passer les adresses IPv6.
 */
export function encode(code: PairingCode): string {
  return [
    CODE_VERSION,
    code.kind === 'offer' ? 'o' : 'a',
    code.ufrag,
    code.pwd,
    toBase64Url(code.fingerprint),
    code.candidates.map(({ address, port }) => `${address}:${port}`).join(','),
  ].join('|');
}

/**
 * Relit un QR scanné. Rend `null` pour tout ce qui n'est pas un code valide.
 *
 * NE JETTE JAMAIS : la caméra lit aussi l'affiche du bar, le QR d'un menu,
 * le code d'un autre jeu. Rien de cela ne doit faire tomber l'écran.
 */
export function decode(text: string): PairingCode | null {
  const fields = unwrapJoinUrl(text).trim().split('|');
  if (fields.length !== 6) return null;

  const [version, kindTag, ufrag, pwd, print, list] = fields;
  if (version !== CODE_VERSION) return null;
  if (kindTag !== 'o' && kindTag !== 'a') return null;

  const iceChars = /^[A-Za-z0-9+/]+$/;
  if (!iceChars.test(ufrag) || !iceChars.test(pwd)) return null;

  const fingerprint = fromBase64Url(print);
  if (fingerprint === null || fingerprint.length !== 32) return null;

  const candidates: PairingCode['candidates'] = [];
  for (const entry of list.split(',')) {
    const split = entry.lastIndexOf(':');
    if (split <= 0) return null;

    const address = entry.slice(0, split);
    const port = Number(entry.slice(split + 1));
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;

    // Une adresse ne contient ni espace ni retour à la ligne : en laisser
    // passer un permettrait d'injecter des lignes dans la description
    // reconstruite par `toSdp`.
    if (!/^[A-Za-z0-9.:\-]+$/.test(address)) return null;

    candidates.push({ address, port });
  }

  return { kind: kindTag === 'o' ? 'offer' : 'answer', ufrag, pwd, fingerprint, candidates };
}

/** Le repère qui porte l'offre dans un lien d'invitation. */
const JOIN_MARK = '#join=';

/**
 * L'offre en LIEN, pour l'appareil photo du téléphone.
 *
 * Quentin (27/10/2026) a scanné le QR du plateau avec l'appareil photo de
 * son téléphone, et « n'est pas redirigé vers l'application ou le web ». Un
 * appareil photo n'ouvre qu'un lien : le code brut ne lui disait rien. Le
 * QR porte donc l'adresse du jeu, l'offre rangée après le `#` — le serveur
 * ne la voit jamais, seule la page l'ouvre.
 *
 * Rend `null` quand l'adresse ne mène nulle part depuis un autre appareil :
 * l'APK se sert lui-même en `https://localhost`, et un lien vers
 * « localhost » ouvrirait le téléphone… sur lui-même. Le QR garde alors le
 * code brut, à scanner depuis le jeu.
 */
export function toJoinUrl(base: string, code: string): string | null {
  let url: URL;

  try {
    url = new URL(base);
  } catch {
    return null;
  }

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return null;

  return `${url.origin}${url.pathname}${JOIN_MARK}${encodeURIComponent(code)}`;
}

/**
 * L'offre portée par une adresse de page, ou `null` s'il n'y en a pas.
 *
 * C'est ce que lit la page ouverte par l'appareil photo, au démarrage.
 */
export function offerFromUrl(href: string): string | null {
  const at = href.indexOf(JOIN_MARK);
  if (at < 0) return null;

  const code = unwrapJoinUrl(href.slice(at));
  return decode(code)?.kind === 'offer' ? code : null;
}

/** Retire l'enveloppe du lien, s'il y en a une. Un code brut passe tel quel. */
function unwrapJoinUrl(text: string): string {
  const at = text.indexOf(JOIN_MARK);
  if (at < 0) return text;

  try {
    return decodeURIComponent(text.slice(at + JOIN_MARK.length));
  } catch {
    return '';
  }
}

function fromHex(text: string): Uint8Array | null {
  const pairs = text.split(':');
  if (pairs.some((pair) => !/^[0-9A-Fa-f]{2}$/.test(pair))) return null;

  return Uint8Array.from(pairs.map((pair) => parseInt(pair, 16)));
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;

  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}
