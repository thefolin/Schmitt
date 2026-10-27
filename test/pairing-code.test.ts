import { describe, it, expect } from 'vitest';
import { fromSdp, toSdp, encode, decode, toJoinUrl, offerFromUrl } from '@/features/link/pairing-code';

/**
 * L'APPAIRAGE PAR QR CODE (épique 8, lot D — Quentin, 27/10/2026).
 *
 * Le QR porte l'offre ou la réponse WebRTC, réduite à l'essentiel. Ces
 * tests gardent ce qui doit survivre au voyage, et ce qui ne doit pas
 * pouvoir y entrer.
 */

const FINGERPRINT =
  'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:01:12:23:34:45:56:67:78:89:9A:AB:BC:CD:DE:EF:F0';

/** Une offre telle que Chrome la produit pour une voie de données. */
const CHROME_OFFER = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 54321 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 192.168.1.20',
  'a=candidate:842163049 1 udp 2122260223 192.168.1.20 54321 typ host generation 0 network-id 1',
  'a=candidate:842163049 1 udp 2122260223 192.168.1.20 54321 typ host generation 0 network-id 1',
  'a=candidate:1510613869 1 tcp 1518280447 192.168.1.20 9 typ host tcptype active generation 0',
  'a=candidate:3f1a 1 udp 2122194687 4b5c6d7e-1111-2222-3333-444455556666.local 50000 typ host generation 0',
  'a=candidate:9 1 udp 1686052607 88.12.34.56 61000 typ srflx raddr 192.168.1.20 rport 54321',
  'a=ice-ufrag:Xy9+',
  'a=ice-pwd:abcdefghijklmnopqrstuv12',
  'a=ice-options:trickle',
  `a=fingerprint:sha-256 ${FINGERPRINT}`,
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

describe('Ce que le QR garde d\'une offre Chrome', () => {
  it('garde les identifiants et l\'empreinte qui sécurise la liaison', () => {
    const code = fromSdp('offer', CHROME_OFFER)!;

    expect(code.ufrag).toBe('Xy9+');
    expect(code.pwd).toBe('abcdefghijklmnopqrstuv12');
    expect(code.fingerprint).toHaveLength(32);
    expect(code.fingerprint[0]).toBe(0xa1);
    expect(code.fingerprint[31]).toBe(0xf0);
  });

  it('garde chaque adresse UDP une seule fois, et écarte le TCP', () => {
    expect(fromSdp('offer', CHROME_OFFER)!.candidates).toEqual([
      { address: '192.168.1.20', port: 54321 },
      { address: '4b5c6d7e-1111-2222-3333-444455556666.local', port: 50000 },
      { address: '88.12.34.56', port: 61000 },
    ]);
  });

  it('refuse une offre sans adresse : personne ne pourrait nous joindre', () => {
    const blind = CHROME_OFFER.split('\r\n').filter((l) => !l.startsWith('a=candidate:')).join('\r\n');

    expect(fromSdp('offer', blind)).toBeNull();
  });

  it('refuse une offre sans empreinte : la liaison ne serait pas chiffrée', () => {
    const naked = CHROME_OFFER.split('\r\n').filter((l) => !l.startsWith('a=fingerprint')).join('\r\n');

    expect(fromSdp('offer', naked)).toBeNull();
  });
});

describe('Le voyage par QR ne perd rien', () => {
  it('relit exactement ce qui a été encodé', () => {
    const code = fromSdp('offer', CHROME_OFFER)!;

    expect(decode(encode(code))).toEqual(code);
  });

  it('tient dans un QR qui se scanne bien sur un écran', () => {
    // Une description brute fait ~1 000 caractères ; au-delà de ~300, le QR
    // devient trop dense pour être lu à distance sous un éclairage de soirée.
    expect(CHROME_OFFER.length).toBeGreaterThan(900);
    expect(encode(fromSdp('offer', CHROME_OFFER)!).length).toBeLessThan(200);
  });

  it('distingue une offre d\'une réponse', () => {
    const code = fromSdp('answer', CHROME_OFFER)!;

    expect(decode(encode(code))!.kind).toBe('answer');
  });

  it('laisse passer une adresse IPv6, dont le port suit le dernier deux-points', () => {
    const code = { ...fromSdp('offer', CHROME_OFFER)!, candidates: [{ address: 'fe80::1', port: 4000 }] };

    expect(decode(encode(code))!.candidates).toEqual([{ address: 'fe80::1', port: 4000 }]);
  });
});

describe('La description reconstruite est celle qu\'attend WebRTC', () => {
  const rebuilt = (kind: 'offer' | 'answer') => toSdp({ ...fromSdp('offer', CHROME_OFFER)!, kind });

  it('restitue l\'empreinte au format attendu', () => {
    expect(rebuilt('offer')).toContain(`a=fingerprint:sha-256 ${FINGERPRINT}`);
  });

  it('laisse le choix dans l\'offre et le prend dans la réponse', () => {
    // Si les deux côtés laissaient le choix, chacun attendrait l'autre.
    expect(rebuilt('offer')).toContain('a=setup:actpass');
    expect(rebuilt('answer')).toContain('a=setup:active');
  });

  it('ne déclare qu\'une voie de données, sans audio ni vidéo', () => {
    expect(rebuilt('offer')).toContain('m=application 9 UDP/DTLS/SCTP webrtc-datachannel');
    expect(rebuilt('offer')).not.toMatch(/m=(audio|video)/);
  });

  it('se relit à l\'identique', () => {
    const code = fromSdp('offer', CHROME_OFFER)!;

    expect(fromSdp('offer', toSdp(code))).toEqual(code);
  });
});

describe('La caméra lit n\'importe quel QR : seuls les nôtres passent', () => {
  const valid = encode(fromSdp('offer', CHROME_OFFER)!);

  it.each([
    ['l\'adresse d\'un site', 'https://example.com/menu'],
    ['du texte vide', ''],
    ['une autre version du format', valid.replace(/^S1/, 'S2')],
    ['un champ manquant', valid.split('|').slice(0, 5).join('|')],
    ['une empreinte trop courte', valid.replace(/\|[A-Za-z0-9_-]{43}\|/, '|AAAA|')],
    ['un port impossible', valid.replace(':54321', ':70000')],
    ['un retour à la ligne glissé dans une adresse', valid.replace('192.168.1.20', '1.2.3.4\r\na=x')],
  ])('refuse %s, sans jeter', (_label, text) => {
    expect(() => decode(text)).not.toThrow();
    expect(decode(text)).toBeNull();
  });
});

describe('Le QR du plateau s\'ouvre avec l\'appareil photo du téléphone', () => {
  // Quentin (27/10/2026) a scanné avec l'appareil photo et « n'est pas
  // redirigé vers l'application ou le web » : un appareil photo n'ouvre
  // qu'un lien. Le QR porte donc l'adresse du jeu, l'offre après le `#`.
  const code = encode(fromSdp('offer', CHROME_OFFER)!);
  const base = 'https://192.168.1.15:3001/index-3d.html?x=1#ancien';

  it('fait un lien vers la page du jeu, l\'offre rangée après le #', () => {
    const url = toJoinUrl(base, code)!;

    expect(url.startsWith('https://192.168.1.15:3001/index-3d.html#join=')).toBe(true);
  });

  it('se relit, lien ou code brut', () => {
    const url = toJoinUrl(base, code)!;

    expect(decode(url)).toEqual(decode(code));
  });

  it('rend l\'offre à la page ouverte par ce lien', () => {
    expect(offerFromUrl(toJoinUrl(base, code)!)).toBe(code);
  });

  it('n\'ouvre rien sur une page sans invitation', () => {
    expect(offerFromUrl('https://192.168.1.15:3001/index-3d.html')).toBeNull();
  });

  it('n\'ouvre pas sur une RÉPONSE glissée dans un lien', () => {
    const answer = encode(fromSdp('answer', CHROME_OFFER)!);

    expect(offerFromUrl(`https://h/index-3d.html#join=${encodeURIComponent(answer)}`)).toBeNull();
  });

  it('garde le code brut quand la page n\'est joignable que d\'elle-même', () => {
    // L'APK se sert en https://localhost : un lien vers « localhost »
    // ouvrirait le téléphone sur lui-même.
    expect(toJoinUrl('https://localhost/index.html', code)).toBeNull();
    expect(toJoinUrl('http://127.0.0.1:3000/index-3d.html', code)).toBeNull();
  });

  it('refuse un lien mal encodé, sans jeter', () => {
    expect(() => decode('https://h/#join=%E0%A4%A')).not.toThrow();
    expect(decode('https://h/#join=%E0%A4%A')).toBeNull();
  });
});
