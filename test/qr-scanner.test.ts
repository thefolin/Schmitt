import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scanQr } from '@/features/link/qr-scanner';

/**
 * LIRE LE QR DE L'AUTRE APPAREIL (épique 8, lot D3).
 *
 * La caméra est simulée : on vérifie ce qui se décide autour d'elle — quel
 * code on retient, et surtout qu'elle est TOUJOURS rendue.
 */

let tracks: { stop: ReturnType<typeof vi.fn> }[];
let readings: string[][];

function stubCamera(options: { refuse?: boolean } = {}) {
  tracks = [{ stop: vi.fn() }];
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: options.refuse
        ? vi.fn().mockRejectedValue(new Error('NotAllowedError'))
        : vi.fn().mockResolvedValue({ getTracks: () => tracks }),
    },
  });
}

class FakeDetector {
  public static getSupportedFormats = async () => ['qr_code'];
  public async detect() {
    return (readings.shift() ?? []).map((rawValue) => ({ rawValue }));
  }
}

function video(): HTMLVideoElement {
  const element = document.createElement('video');
  element.play = vi.fn().mockResolvedValue(undefined);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
  readings = [];
  vi.stubGlobal('BarcodeDetector', FakeDetector);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Le scanner ne retient que nos codes', () => {
  it('ignore les QR étrangers et continue jusqu\'au bon', async () => {
    // Dans un bar, la caméra croise l'affiche du WiFi avant l'écran du jeu.
    stubCamera();
    readings = [['WIFI:S:Bar;P:1234;;'], [], ['https://menu.example'], ['S1|o|bon']];

    const scan = scanQr(video(), (text) => text.startsWith('S1|'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(await scan.result).toBe('S1|o|bon');
  });

  it('retient le bon code même lu au milieu d\'autres sur la même image', async () => {
    stubCamera();
    readings = [['https://menu.example', 'S1|a|bon']];

    const scan = scanQr(video(), (text) => text.startsWith('S1|'));
    await vi.advanceTimersByTimeAsync(200);

    expect(await scan.result).toBe('S1|a|bon');
  });
});

describe('La caméra est toujours rendue', () => {
  it('après avoir trouvé le code', async () => {
    stubCamera();
    readings = [['S1|o|bon']];

    const scan = scanQr(video(), () => true);
    await vi.advanceTimersByTimeAsync(200);
    await scan.result;

    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('quand le joueur abandonne', async () => {
    stubCamera();

    const scan = scanQr(video(), () => false);
    await vi.advanceTimersByTimeAsync(500);
    scan.stop();

    expect(await scan.result).toBeNull();
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('quand il abandonne PENDANT la demande d\'autorisation', async () => {
    // Le cas piège : la caméra arrive après l'abandon. Sans garde, elle
    // resterait ouverte, voyant allumé, sans que plus rien ne l'arrête.
    let grant: (stream: unknown) => void = () => {};
    tracks = [{ stop: vi.fn() }];
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => new Promise((resolve) => (grant = resolve)) },
    });

    const scan = scanQr(video(), () => true);
    scan.stop();
    grant({ getTracks: () => tracks });
    await vi.advanceTimersByTimeAsync(200);

    expect(await scan.result).toBeNull();
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('rend null si la caméra est refusée, sans jeter', async () => {
    stubCamera({ refuse: true });

    const scan = scanQr(video(), () => true);
    await vi.advanceTimersByTimeAsync(200);

    expect(await scan.result).toBeNull();
  });
});
