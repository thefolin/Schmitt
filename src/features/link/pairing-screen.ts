import qrcode from 'qrcode-generator';
import { decode, toJoinUrl } from './pairing-code';
import { LINK_TEXT } from './link-text';
import type { Role } from './protocol';
import { scanQr, type ScanHandle } from './qr-scanner';
import type { Transport } from './transport';
import { WebRtcTransport, type HostPairing } from './webrtc-transport';
import { RelayTransport } from './relay-transport';

/**
 * L'ÉCRAN QUI RELIE DEUX APPAREILS (épique 8, lot D3).
 *
 * Quentin (27/10/2026) : appairage par QR code, deux scans.
 *
 *   PLATEAU                              MANETTE
 *   affiche son QR  ───── scan ─────▶    lit l'offre
 *   lit la réponse  ◀──── scan ──────    affiche son QR
 *                 la voie s'ouvre
 *
 * Le PLATEAU mène la partie (maître) : il tire le dé. La MANETTE demande
 * (esclave). Ce sont des rôles, pas des appareils — un téléphone peut être
 * plateau, une tablette manette, un PC l'un ou l'autre.
 *
 * Les deux côtés scannent une fois : un écran sans caméra ne peut donc pas
 * s'appairer. C'est la limite connue de ce transport, transmise à Quentin.
 */

/** Combien attendre l'ouverture de la voie une fois les deux QR échangés. */
const LINK_TIMEOUT_MS = 15000;

/** Ce que l'écran rend : le rôle choisi et la voie ouverte. */
export interface Pairing {
  role: Role;
  transport: Transport;
}

/**
 * Ce dont l'écran a besoin du monde extérieur. Remplaçable pour les tests :
 * ni caméra ni WebRTC n'existent dans jsdom.
 */
export interface PairingDeps {
  host(): Promise<HostPairing | null>;
  join(offer: string): Promise<{ transport: Transport; code: string } | null>;
  scan(video: HTMLVideoElement, accept: (text: string) => boolean): ScanHandle;
  /** L'adresse de cette page, base du lien que porte le QR du plateau. */
  joinBase(): string;
  /** Le relais du serveur du WiFi : l'appairage par code. */
  relay: {
    available(): Promise<boolean>;
    host(): Promise<{ transport: Transport; pin: string } | null>;
    join(pin: string): Promise<Transport | null>;
  };
}

const realDeps: PairingDeps = {
  host: () => WebRtcTransport.host(),
  join: (offer) => WebRtcTransport.join(offer),
  scan: scanQr,
  joinBase: () => window.location.href,
  relay: {
    available: () => RelayTransport.available(),
    host: () => RelayTransport.host(),
    join: (pin) => RelayTransport.join(pin),
  },
};

/** Le serveur du WiFi garde un code deux minutes (`server/pair-relay.ts`). */
const PIN_LIFETIME_MS = 2 * 60 * 1000;

/** Le QR en SVG : sombre sur fond clair, la seule combinaison que lisent tous les lecteurs. */
function qrSvg(text: string): string {
  // Correction « M » : le QR survit à un reflet ou à un écran sale sans
  // devenir trop dense pour être lu à un mètre.
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();

  return code.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
}

/**
 * Affiche l'écran et rend la liaison établie, ou `null` si le joueur
 * abandonne.
 *
 * ABANDONNER NE LAISSE RIEN DERRIÈRE : la caméra est rendue et la voie à
 * moitié ouverte est fermée. Le jeu reste exactement tel qu'il était.
 */
export function showPairingScreen(
  host: HTMLElement = document.body,
  deps: PairingDeps = realDeps,
  /**
   * Une offre déjà en main : la page a été ouverte par l'appareil photo, sur
   * le lien du QR du plateau. On passe alors directement à la réponse, sans
   * demander le rôle ni rouvrir la caméra.
   */
  offer: string | null = null
): Promise<Pairing | null> {
  return new Promise((resolve) => {
    let transport: Transport | null = null;
    let scan: ScanHandle | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const screen = document.createElement('div');
    screen.className = 'setup-screen action-modal link-screen';
    screen.id = 'link-screen';

    const panel = document.createElement('div');
    panel.className = 'setup-panel action-modal-panel link-panel';

    const title = document.createElement('h2');
    title.textContent = LINK_TEXT.title;

    const step = document.createElement('p');
    step.className = 'action-modal-line';
    step.id = 'link-step';

    const qr = document.createElement('div');
    qr.className = 'link-qr';
    qr.id = 'link-qr';

    const camera = document.createElement('video');
    camera.className = 'link-camera';
    camera.id = 'link-camera';

    // LE CODE, en très gros : il se lit de loin, sur l'écran du plateau.
    const pin = document.createElement('p');
    pin.className = 'link-pin';
    pin.id = 'link-pin';

    // LA SAISIE DU CODE. Clavier numérique sur téléphone ; la validation
    // part aussi de la touche Entrée.
    const codeForm = document.createElement('form');
    codeForm.className = 'link-code-form';
    codeForm.id = 'link-code-form';
    const codeInput = document.createElement('input');
    codeInput.id = 'link-code';
    codeInput.className = 'link-code';
    codeInput.inputMode = 'numeric';
    codeInput.autocomplete = 'one-time-code';
    codeInput.maxLength = 4;
    codeInput.placeholder = '0000';
    codeInput.setAttribute('aria-label', 'Code du plateau');
    const codeError = document.createElement('p');
    codeError.className = 'link-code-error';
    codeError.id = 'link-code-error';
    codeError.setAttribute('role', 'alert');
    codeForm.append(codeInput, codeError);

    const buttons = document.createElement('div');
    buttons.className = 'action-modal-buttons';

    panel.append(title, step, pin, codeForm, qr, camera, buttons);

    /** Le relais répond-il ? Demandé une fois, dès l'ouverture. */
    const relayReady = deps.relay.available();
    screen.appendChild(panel);
    host.appendChild(screen);

    /**
     * Montre ou escamote un élément.
     *
     * `hidden` SEUL NE SUFFIT PAS sous `.setup-screen` : c'est le défaut vu
     * deux fois sur l'APK et documenté dans `hermes-screen.ts`.
     */
    const show = (element: HTMLElement, visible: boolean) => {
      element.hidden = !visible;
      element.style.display = visible ? '' : 'none';
    };

    const button = (id: string, label: string, primary: boolean, onClick: () => void) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = primary ? 'btn btn-primary' : 'btn btn-secondary';
      element.id = id;
      element.textContent = label;
      element.addEventListener('click', onClick);
      return element;
    };

    const stopScan = () => {
      scan?.stop();
      scan = null;
    };

    const finish = (result: Pairing | null) => {
      if (done) return;
      done = true;

      stopScan();
      if (timer !== null) clearTimeout(timer);
      if (result === null) transport?.close();

      screen.remove();
      resolve(result);
    };

    const cancel = () => button('link-cancel', 'Annuler', false, () => finish(null));

    /** Un état de l'écran : la consigne, ce qu'on montre, les boutons. */
    const render = (
      text: string,
      options: { qr?: string; camera?: boolean; pin?: string; codeEntry?: boolean; actions?: HTMLElement[] } = {}
    ) => {
      step.textContent = text;

      pin.textContent = options.pin ?? '';
      show(pin, Boolean(options.pin));
      show(codeForm, Boolean(options.codeEntry));
      codeError.textContent = '';

      qr.innerHTML = options.qr ? qrSvg(options.qr) : '';
      // Le texte porté par le QR, lisible sans décoder l'image : pour les
      // tests, et pour diagnostiquer un appairage sur un appareil réel.
      qr.dataset.text = options.qr ?? '';
      show(qr, Boolean(options.qr));
      show(camera, Boolean(options.camera));

      buttons.replaceChildren(...(options.actions ?? []), cancel());
    };

    const fail = (text: string) => {
      stopScan();
      transport?.close();
      transport = null;

      render(text, { actions: [button('link-retry', 'Recommencer', true, choose)] });
    };

    /**
     * Attend que la voie s'ouvre, avec un délai : sans lui, deux appareils
     * sur deux WiFi différents laisseraient l'écran figé sur « en cours ».
     */
    const awaitLink = (
      role: Role,
      channel: Transport,
      timeout: number = LINK_TIMEOUT_MS,
      message: string = 'La liaison ne s’établit pas. Les deux appareils sont-ils sur le même WiFi ?'
    ) => {
      timer = setTimeout(() => fail(message), timeout);

      channel.onStatus((status) => {
        if (status === 'linked' && !done) finish({ role, transport: channel });
      });
    };

    /**
     * PLATEAU, PAR CODE : le serveur du WiFi donne 4 chiffres, l'autre
     * appareil les tape. Aucune caméra.
     */
    const asMasterByCode = async () => {
      render('Préparation du code…');

      const room = await deps.relay.host();
      if (done) return room?.transport.close();
      if (room === null) return asMasterByQr();

      transport = room.transport;
      render(LINK_TEXT.masterShowsPin, {
        pin: room.pin,
        actions: [button('link-use-qr', LINK_TEXT.useQr, false, switchToQr(() => void asMasterByQr()))],
      });

      // LE PLATEAU ATTEND UN HUMAIN qui tape le code : pas les 15 s d'une
      // liaison technique, mais la vie du code sur le serveur.
      awaitLink('master', room.transport, PIN_LIFETIME_MS, LINK_TEXT.pinExpired);
    };

    /** Passe aux QR codes : le code en cours est abandonné. */
    const switchToQr = (next: () => void) => () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      transport?.close();
      transport = null;
      next();
    };

    const asMaster = async () => {
      if (await relayReady) return asMasterByCode();
      return asMasterByQr();
    };

    const asMasterByQr = async () => {
      render('Préparation du code…');

      const pairing = await deps.host();
      if (done) return pairing?.transport.close();
      if (pairing === null) return fail('Impossible de préparer le code sur cet appareil.');

      transport = pairing.transport;

      const scanAnswer = () => {
        render(LINK_TEXT.masterAimsAtSlave, { camera: true });

        // SEULE UNE RÉPONSE EST RETENUE : la caméra du plateau peut
        // reprendre sa propre offre en reflet, ou celle d'un autre plateau.
        scan = deps.scan(camera, (text) => decode(text)?.kind === 'answer');

        void scan.result.then(async (answer) => {
          if (done || answer === null) return;

          render('Liaison en cours…');
          if (!(await pairing.accept(answer))) return fail('Ce code n’a pas pu être lu. Recommencez.');

          awaitLink('master', pairing.transport);
        });
      };

      // LE QR PORTE UN LIEN quand cette page est joignable depuis le WiFi :
      // l'appareil photo du téléphone l'ouvre et la page rejoint d'elle-même.
      // Le scanner du jeu, lui, lit les deux formes.
      render(LINK_TEXT.masterShowsOffer, {
        qr: toJoinUrl(deps.joinBase(), pairing.code) ?? pairing.code,
        actions: [button('link-scan-answer', LINK_TEXT.masterScanAnswer, true, scanAnswer)],
      });
    };

    /** APPAREIL DE CONTRÔLE, PAR CODE : il tape les 4 chiffres du plateau. */
    const asSlaveByCode = () => {
      render(LINK_TEXT.slaveEntersPin, {
        codeEntry: true,
        actions: [
          button('link-join', LINK_TEXT.join, true, () => codeForm.requestSubmit()),
          button('link-use-qr', LINK_TEXT.useQr, false, switchToQr(asSlaveByQr)),
        ],
      });
      codeInput.value = '';
      codeInput.focus();
    };

    codeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      void (async () => {
        const typed = codeInput.value.replace(/\D/g, '');
        const joined = await deps.relay.join(typed);
        if (done) return joined?.close();

        // UN CODE FAUX NE RAMÈNE PAS AU DÉBUT : on reste sur la saisie, le
        // message dit quoi vérifier.
        if (joined === null) {
          codeError.textContent = LINK_TEXT.pinRejected;
          codeInput.select();
          return;
        }

        transport = joined;
        render('Liaison en cours…');
        awaitLink('slave', joined, LINK_TIMEOUT_MS, LINK_TEXT.masterSilent);
      })();
    });

    const asSlave = async () => {
      if (await relayReady) return asSlaveByCode();
      return asSlaveByQr();
    };

    const asSlaveByQr = () => {
      render(LINK_TEXT.slaveAimsAtMaster, { camera: true });

      scan = deps.scan(camera, (text) => decode(text)?.kind === 'offer');

      void scan.result.then((scanned) => {
        if (done || scanned === null) return;
        void joinWith(scanned);
      });
    };

    const joinWith = async (offer: string) => {
      render('Préparation de la réponse…');

      const joined = await deps.join(offer);
      if (done) return joined?.transport.close();
      if (joined === null) return fail('Ce code n’a pas pu être lu. Recommencez.');

      transport = joined.transport;
      render(LINK_TEXT.slaveShowsAnswer, { qr: joined.code });
      awaitLink('slave', joined.transport);
    };

    function choose(): void {
      if (timer !== null) clearTimeout(timer);
      timer = null;

      render('Quel rôle pour cet appareil ?', {
        actions: [
          button('link-as-master', LINK_TEXT.asMaster, true, () => void asMaster()),
          button('link-as-slave', LINK_TEXT.asSlave, true, () => void asSlave()),
        ],
      });
    }

    if (offer !== null) void joinWith(offer);
    else choose();
  });
}
