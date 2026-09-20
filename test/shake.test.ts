import { describe, it, expect } from 'vitest';
import {
  isShake,
  motionIntensity,
  motionAvailable,
  motionContextAllowed,
  motionBlockedReason,
  GRAVITY,
  SHAKE_THRESHOLD,
  SHAKE_DEBOUNCE_MS,
} from '@/features/board/scene3d/shake';

/**
 * EPIC-8 itération 2 — secouer le téléphone pour lancer.
 *
 * Ce qui se teste ici est la DÉCISION : à partir de quelle lecture on
 * considère qu'il y a eu geste. Le réglage fin du seuil, lui, ne se fait pas
 * en test — il demande un vrai téléphone et un vrai bras. Ces tests servent à
 * ce que ce réglage ne change qu'un nombre, sans casser la logique autour.
 */

/** Un téléphone immobile : la pesanteur, et rien d'autre. */
const STILL = { accelerationIncludingGravity: { x: 0, y: GRAVITY, z: 0 } };

/** Un geste franc, mesuré sans la pesanteur. */
const SHAKEN = { acceleration: { x: 0, y: 30, z: 0 } };

describe('secousse — la pesanteur n\'est pas un geste', () => {
  it('ne voit aucun geste dans un téléphone posé', () => {
    // C'EST LE PIÈGE PRINCIPAL. `accelerationIncludingGravity` lit 9,81 sur
    // un téléphone parfaitement immobile : comparer un seuil à cette lecture
    // brute rendrait le déclenchement bien plus facile qu'il n'y paraît.
    expect(motionIntensity(STILL)).toBeCloseTo(0, 1);
    expect(isShake(STILL, null)).toBe(false);
  });

  it('retire la pesanteur de la lecture brute', () => {
    // Un mouvement de 20 s'ajoutant à la pesanteur se lit 29,81 en brut.
    const reading = { accelerationIncludingGravity: { x: 0, y: GRAVITY + 20, z: 0 } };

    expect(motionIntensity(reading)).toBeCloseTo(20, 1);
  });

  it('prend la lecture déjà nettoyée quand elle existe', () => {
    // `acceleration` est le chemin préféré : rien à retrancher.
    expect(motionIntensity(SHAKEN)).toBeCloseTo(30, 1);
  });
});

describe('secousse — un appareil muet ne lance rien', () => {
  it('ne décide pas sans lecture exploitable', () => {
    // Beaucoup d'Android renseignent `acceleration` à null. Un appareil qui
    // ne donne NI l'un NI l'autre ne doit pas se mettre à lancer le dé.
    expect(motionIntensity({})).toBeNull();
    expect(motionIntensity({ acceleration: null })).toBeNull();
    expect(
      motionIntensity({ acceleration: { x: null, y: null, z: null } })
    ).toBeNull();
    expect(isShake({}, null)).toBe(false);
  });

  it('bascule sur la lecture brute quand la nettoyée est vide', () => {
    const reading = {
      acceleration: { x: null, y: null, z: null },
      accelerationIncludingGravity: { x: 0, y: GRAVITY + 25, z: 0 },
    };

    expect(motionIntensity(reading)).toBeCloseTo(25, 1);
  });

  it('dit NULL sur une lecture brute vide, et pas une intensité fausse', () => {
    // SANS CE TEST, le garde-fou sur la lecture brute passait inaperçu : une
    // lecture d'axes nuls donne 0, puis |0 − 9,81| = 9,81, ce qui reste sous
    // le seuil. Le dé ne partait donc pas — par ACCIDENT, pas par décision.
    //
    // La distinction compte : `null` veut dire « cet appareil ne mesure
    // rien », et c'est ce que la scène doit savoir pour s'en remettre au
    // bouton. 9,81 voudrait dire « il mesure, et c'est presque un geste ».
    expect(
      motionIntensity({ accelerationIncludingGravity: { x: null, y: null, z: null } })
    ).toBeNull();
  });

  it('ignore un axe non chiffré sans jeter', () => {
    const reading = { acceleration: { x: 30, y: null, z: undefined } };

    expect(motionIntensity(reading)).toBeCloseTo(30, 1);
  });
});

describe('secousse — le seuil sépare le geste du bruit', () => {
  it('accepte un geste franc', () => {
    expect(isShake(SHAKEN, null)).toBe(true);
  });

  it('refuse un mouvement de marche', () => {
    // Marcher avec le téléphone en main produit 2 à 4 m/s².
    expect(isShake({ acceleration: { x: 3, y: 2, z: 1 } }, null)).toBe(false);
  });

  it('refuse un téléphone posé brusquement', () => {
    // Autour de 10-15 : c'est le faux positif qui coûterait le plus cher,
    // puisqu'il lancerait le dé sans que personne l'ait voulu.
    expect(isShake({ acceleration: { x: 0, y: 14, z: 0 } }, null)).toBe(false);
  });

  it('se règle par son seuil, sans toucher au reste', () => {
    // LE RÉGLAGE SE FERA SUR UN VRAI TÉLÉPHONE : ce test existe pour que ce
    // jour-là il n'y ait qu'un nombre à changer.
    const soft = { acceleration: { x: 0, y: 12, z: 0 } };

    expect(isShake(soft, null)).toBe(false);
    expect(isShake(soft, null, 10)).toBe(true);
  });

  it('place le seuil entre le bruit et le geste', () => {
    expect(SHAKE_THRESHOLD).toBeGreaterThan(15);
    expect(SHAKE_THRESHOLD).toBeLessThan(25);
  });
});

describe('secousse — un geste ne lance qu\'un dé', () => {
  it('refuse un second déclenchement immédiat', () => {
    // C'EST LA RAISON D'ÊTRE DU TEMPS MORT : une secousse n'est pas un pic
    // isolé. Le téléphone repart en sens inverse et repasse le seuil
    // plusieurs fois en une fraction de seconde — un seul geste lancerait
    // le dé deux ou trois fois.
    expect(isShake(SHAKEN, 100)).toBe(false);
    expect(isShake(SHAKEN, SHAKE_DEBOUNCE_MS - 1)).toBe(false);
  });

  it('accepte de nouveau une fois le temps mort passé', () => {
    expect(isShake(SHAKEN, SHAKE_DEBOUNCE_MS)).toBe(true);
    expect(isShake(SHAKEN, 5000)).toBe(true);
  });

  it('couvre le geste et son rebond sans bloquer le tour suivant', () => {
    expect(SHAKE_DEBOUNCE_MS).toBeGreaterThanOrEqual(600);
    expect(SHAKE_DEBOUNCE_MS).toBeLessThanOrEqual(1500);
  });

  it('refuse même un geste énorme pendant le temps mort', () => {
    // Le temps mort passe AVANT la mesure : aucune intensité ne le force.
    expect(isShake({ acceleration: { x: 0, y: 500, z: 0 } }, 50)).toBe(false);
  });
});

describe('secousse — savoir si les capteurs existent', () => {
  it('répond sans jeter, quel que soit l\'environnement', () => {
    expect(() => motionAvailable()).not.toThrow();
  });

  it('reconnaît l\'API quand elle est là', () => {
    // MESURÉ : jsdom expose `DeviceMotionEvent` — je le croyais absent, il
    // est là. C'est précisément l'argument du code : la PRÉSENCE de l'API ne
    // prouve rien sur le capteur derrière. Un navigateur de bureau l'expose
    // sans accéléromètre, et jsdom aussi.
    //
    // C'est pourquoi la scène ne s'y fie pas : elle s'abonne, puis attend
    // une lecture CHIFFRÉE avant d'annoncer le geste (`sensorsAnswered` dans
    // `preview.ts`). Sans quoi, tout navigateur de bureau prétendrait savoir
    // détecter une secousse.
    expect(motionAvailable()).toBe(true);
  });

  it('dit `false` là où l\'API n\'existe pas', () => {
    const scope = window as unknown as { DeviceMotionEvent?: unknown };
    const previous = scope.DeviceMotionEvent;

    try {
      delete scope.DeviceMotionEvent;
      expect(motionAvailable()).toBe(false);
    } finally {
      scope.DeviceMotionEvent = previous;
    }
  });
});

/**
 * Le HTTP est la cause la plus fréquente d'un capteur muet en recette.
 *
 * `DeviceMotionEvent` est une fonctionnalité à CONTEXTE SÉCURISÉ. Hors
 * HTTPS, Chrome laisse l'abonnement réussir, envoie des événements, et met
 * tous les axes à `null` — sans erreur, sans modale, sans permission à
 * demander. Le symptôme ressemble à un téléphone sans capteur, la cause est
 * l'adresse de la page.
 *
 * Quentin teste sur `http://192.168.x.x:3000` : `localhost` fait exception
 * à la règle, mais pas une IP locale.
 */
describe('secousse — un contexte non sécurisé coupe les capteurs', () => {
  /** Force `isSecureContext` le temps d'un test. */
  function withSecureContext(secure: boolean, run: () => void): void {
    const previous = Object.getOwnPropertyDescriptor(window, 'isSecureContext');

    try {
      Object.defineProperty(window, 'isSecureContext', {
        value: secure,
        configurable: true,
      });
      run();
    } finally {
      if (previous) Object.defineProperty(window, 'isSecureContext', previous);
    }
  }

  it('refuse les capteurs hors contexte sécurisé', () => {
    withSecureContext(false, () => {
      expect(motionContextAllowed()).toBe(false);
    });
  });

  it('les accepte en contexte sécurisé', () => {
    withSecureContext(true, () => {
      expect(motionContextAllowed()).toBe(true);
    });
  });

  it('nomme le HTTP comme cause, et pas le téléphone', () => {
    // C'EST TOUT L'INTÉRÊT. Dire « les capteurs ne répondent pas » envoie
    // chercher une panne de matériel ; dire « il faut du HTTPS » dit quoi
    // faire.
    withSecureContext(false, () => {
      const reason = motionBlockedReason();

      expect(reason).not.toBeNull();
      expect(reason).toContain('HTTPS');
    });
  });

  it('ne donne aucune raison quand rien ne bloque', () => {
    withSecureContext(true, () => {
      expect(motionBlockedReason()).toBeNull();
    });
  });

  it('nomme l\'absence de capteur quand c\'est le cas', () => {
    const scope = window as unknown as { DeviceMotionEvent?: unknown };
    const previous = scope.DeviceMotionEvent;

    try {
      delete scope.DeviceMotionEvent;
      withSecureContext(true, () => {
        expect(motionBlockedReason()).toContain('capteur');
      });
    } finally {
      scope.DeviceMotionEvent = previous;
    }
  });
});
