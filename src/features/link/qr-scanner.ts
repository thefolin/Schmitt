import jsQR from 'jsqr';

/**
 * LIRE UN QR CODE AVEC LA CAMÉRA, SUR N'IMPORTE QUEL APPAREIL.
 *
 * Deux lecteurs, le meilleur disponible d'abord :
 *   - `BarcodeDetector`, intégré à Chrome sur Android — celui de l'APK et
 *     des téléphones, rapide et économe ;
 *   - jsQR en repli, du JavaScript pur, pour les navigateurs qui n'ont pas
 *     le premier (Firefox, Safari, Chrome sous Windows). Quentin veut
 *     « tous les combos » : un PC doit pouvoir scanner aussi.
 *
 * LA CAMÉRA EST TOUJOURS RENDUE. Qu'on trouve le code, qu'on abandonne ou
 * qu'une erreur survienne, les pistes vidéo sont arrêtées : un voyant de
 * caméra resté allumé vide la batterie et inquiète à juste titre.
 */

/** Combien de fois par seconde regarder l'image. Assez pour ne rien rater, pas plus. */
const SCAN_INTERVAL_MS = 150;

export interface ScanHandle {
  /** Le premier texte accepté, ou `null` si l'on a arrêté avant. */
  result: Promise<string | null>;
  /** Arrête la recherche et rend la caméra. Sans effet si c'est déjà fait. */
  stop(): void;
}

/** Ce que le navigateur offre de `BarcodeDetector`, quand il l'offre. */
interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Ouvre la caméra arrière dans `video` et rend le premier QR que `accept`
 * retient.
 *
 * `accept` TRIE CE QUE VOIT LA CAMÉRA : dans un bar, elle croise l'affiche
 * du WiFi, un menu, l'écran d'un autre jeu. Ces lectures sont ignorées et la
 * recherche continue, au lieu de s'arrêter sur le premier code venu.
 */
export function scanQr(video: HTMLVideoElement, accept: (text: string) => boolean): ScanHandle {
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  let settle: (value: string | null) => void = () => {};

  const result = new Promise<string | null>((resolve) => {
    settle = resolve;
  });

  const finish = (value: string | null) => {
    if (finished) return;
    finished = true;

    if (timer !== null) clearTimeout(timer);
    for (const track of stream?.getTracks() ?? []) track.stop();
    video.srcObject = null;

    settle(value);
  };

  const start = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      // Caméra refusée, absente ou déjà prise : rien à lire.
      return finish(null);
    }

    // L'appel a pu être arrêté pendant que l'utilisateur répondait à la
    // demande d'autorisation : on rend aussitôt la caméra qu'on vient d'obtenir.
    if (finished) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.muted = true;
    // `play` ne rend pas toujours une promesse (anciennes WebView) : un
    // `.catch` dessus jetterait. Un refus de lecture automatique n'empêche
    // pas de lire l'image, la recherche continue donc.
    try {
      await video.play();
    } catch {
      // Rien à faire : voir ci-dessus.
    }

    const read = await reader(video);

    const tick = async () => {
      if (finished) return;

      for (const text of await read().catch(() => [] as string[])) {
        if (accept(text)) return finish(text);
      }

      if (!finished) timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    void tick();
  };

  void start();

  return { result, stop: () => finish(null) };
}

/** Choisit le lecteur : celui du navigateur s'il lit les QR, jsQR sinon. */
async function reader(video: HTMLVideoElement): Promise<() => Promise<string[]>> {
  const native = (globalThis as { BarcodeDetector?: {
    new (options: { formats: string[] }): Detector;
    getSupportedFormats?: () => Promise<string[]>;
  } }).BarcodeDetector;

  if (native) {
    const formats = (await native.getSupportedFormats?.().catch(() => [])) ?? [];

    if (formats.includes('qr_code')) {
      const detector = new native({ formats: ['qr_code'] });
      return async () => (await detector.detect(video)).map((code) => code.rawValue);
    }
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  return async () => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!context || width === 0 || height === 0) return [];

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    const found = jsQR(context.getImageData(0, 0, width, height).data, width, height, {
      // Nos QR sont sombres sur fond clair : chercher aussi l'inverse
      // doublerait le travail pour rien, et le téléphone chaufferait.
      inversionAttempts: 'dontInvert',
    });

    return found ? [found.data] : [];
  };
}
