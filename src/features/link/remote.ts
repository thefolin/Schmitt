import type { Link } from './link';
import type { Announcement } from './protocol';
import { watchPrompts, type Prompt, type PromptWatch } from './prompt-mirror';

/**
 * LE PLATEAU PILOTÉ À DISTANCE (épique 8, SCH-32 et SCH-33).
 *
 * Côté MAÎTRE : exécuter ce que la manette demande, et lui dire ce qui se
 * passe. Côté MANETTE : un bouton « Lancer », la face sortie, à qui le tour,
 * et les messages du plateau.
 *
 * LA MANETTE NE JOUE PAS LA PARTIE. Elle n'a ni règles ni moteur : elle
 * affiche ce que le plateau lui envoie. C'est voulu pour cette première
 * version — deux moteurs qui tournent chacun de leur côté finissent par
 * diverger au premier choix mal transmis, et la face vue pourrait différer
 * de la face jouée. Le plateau complet sur le téléphone viendra avec le
 * journal des entrées (voie A), dont le passage de main a de toute façon
 * besoin.
 */

/** Ce que la manette affiche de la partie. Un résumé, pas l'état du moteur. */
export interface RemoteSummary {
  /** Le joueur dont c'est le tour. */
  turn: string;
  players: { name: string; position: number; color: string }[];
  /** Les dernières lignes du journal, la plus récente en dernier. */
  log: string[];
  /** Les deux dés de la faveur sont attendus plutôt que le dé du tour. */
  awaitingFavor: boolean;
  /** La fenêtre ouverte sur le plateau, que le téléphone peut valider. */
  prompt: Prompt | null;
}

/** Combien de lignes du journal partent avec chaque résumé. */
export const REMOTE_LOG_DEPTH = 5;

/**
 * Côté plateau : branché sur la partie par trois points d'accroche, et sur
 * une liaison quand il y en a une.
 *
 * Il existe AVANT toute liaison, et n'émet alors rien : la partie appelle
 * ses méthodes sans se demander si un téléphone écoute. C'est le repli
 * mono-appareil — rien ne change tant que personne ne s'est relié.
 */
export class MasterRemote {
  private link: Link | null = null;
  private prompts: PromptWatch | null = null;

  /** Ce que fait le bouton « Lancer » du plateau. Posé par la partie. */
  public roll: () => void = () => {};

  public constructor(private readonly summary: () => Omit<RemoteSummary, 'prompt'>) {}

  /**
   * Regarde les fenêtres que la partie ouvre dans `root`. Chacune qui
   * s'ouvre ou se ferme part sur le téléphone, qui peut la valider.
   */
  public watch(root: HTMLElement): void {
    this.prompts?.stop();
    this.prompts = watchPrompts(root, () => this.publish());
  }

  public attach(link: Link): void {
    this.link = link;

    // LA MANETTE APPUIE SUR LE MÊME BOUTON que le joueur assis devant le
    // plateau. Le garde de `roll` refuse un lancer pendant qu'un dé roule ou
    // qu'une fenêtre attend une décision : la manette n'a pas plus de droits
    // que l'écran.
    link.onCommand((command) => {
      if (command.kind === 'roll-request' || command.kind === 'favor-request') this.roll();
      if (command.kind === 'validate') this.prompts?.validate(command.prompt);
    });

    // LA MANETTE VOIT LA PARTIE DÈS LA LIAISON, sans attendre le prochain
    // lancer. Les retours après coupure, eux, sont l'affaire de la reprise
    // de `Link` : la manette y redemande ce qu'elle a manqué.
    this.publish();
  }

  /** Après chaque changement : la manette se met à jour. */
  public publish(): void {
    this.link?.publish({ ...this.summary(), prompt: this.prompts?.current() ?? null });
  }

  /** La face tirée par le plateau, la seule qui compte. */
  public rolled(face: number): void {
    this.link?.announce({ kind: 'rolled', dice: face });
  }

  public favorRolled(a: number, b: number): void {
    this.link?.announce({ kind: 'favor-rolled', dice: [a, b] });
  }

  /**
   * Un message du plateau. Quentin (27/10/2026) : « notifications partout,
   * plateau ET esclave » — il part donc tel quel, sans tri.
   */
  public notice(text: string): void {
    this.link?.announce({ kind: 'notice', text });
  }
}

/** Combien de temps attendre la face avant de rendre la main au bouton. */
const ROLL_TIMEOUT_MS = 8000;

/** Combien de messages la manette garde à l'écran. */
const NOTICE_DEPTH = 6;

/**
 * Côté manette : l'écran qui remplace le plateau sur le téléphone.
 *
 * Rend de quoi le fermer. Il recouvre la page : la partie locale, si elle
 * existe, n'est plus touchée — c'est le plateau qui joue.
 */
export function showRemote(link: Link, host: HTMLElement = document.body): () => void {
  let waiting: ReturnType<typeof setTimeout> | null = null;
  let summary: RemoteSummary | null = null;
  const notices: string[] = [];

  const screen = document.createElement('div');
  screen.className = 'remote-screen';
  screen.id = 'remote-screen';
  screen.innerHTML = `
    <p class="remote-status" id="remote-status"></p>
    <p class="remote-turn" id="remote-turn">En attente du plateau…</p>
    <div class="remote-face" id="remote-face" aria-live="polite">–</div>
    <section class="remote-prompt" id="remote-prompt" aria-live="polite">
      <h3 class="remote-prompt-title" id="remote-prompt-title"></h3>
      <div class="remote-prompt-lines" id="remote-prompt-lines"></div>
      <button type="button" class="remote-validate" id="remote-validate"></button>
      <p class="remote-prompt-note" id="remote-prompt-note">Le choix se fait sur le plateau.</p>
    </section>
    <button type="button" class="remote-roll" id="remote-roll">Lancer le dé</button>
    <ul class="remote-log" id="remote-log" aria-live="polite"></ul>
    <ol class="remote-players" id="remote-players"></ol>
  `;
  host.appendChild(screen);

  const element = (id: string) => screen.querySelector<HTMLElement>(`#${id}`)!;
  const status = element('remote-status');
  const turn = element('remote-turn');
  const face = element('remote-face');
  const button = element('remote-roll') as HTMLButtonElement;
  const log = element('remote-log');
  const players = element('remote-players');
  const promptCard = element('remote-prompt');
  const promptTitle = element('remote-prompt-title');
  const promptLines = element('remote-prompt-lines');
  const validate = element('remote-validate') as HTMLButtonElement;
  const promptNote = element('remote-prompt-note');

  /** Montre ou escamote : `hidden` seul ne suffit pas sous un `display` posé (voir `hermes-screen.ts`). */
  const show = (target: HTMLElement, visible: boolean) => {
    target.hidden = !visible;
    target.style.display = visible ? '' : 'none';
  };

  /**
   * LE BOUTON « LANCER » SE GRISE pendant un lancer, et tant qu'une fenêtre
   * attend sur le plateau : le plateau refuse alors de lancer, et un appui
   * sans réponse laisserait croire à une panne.
   */
  const syncRoll = () => {
    button.disabled = waiting !== null || (summary?.prompt ?? null) !== null;
  };

  const release = () => {
    if (waiting !== null) clearTimeout(waiting);
    waiting = null;
    syncRoll();
  };

  const renderLog = () => {
    log.replaceChildren(
      ...notices.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      })
    );
  };

  const renderPrompt = () => {
    const prompt = summary?.prompt ?? null;
    show(promptCard, prompt !== null);
    if (prompt === null) return;

    promptTitle.textContent = prompt.title;
    promptLines.replaceChildren(
      ...prompt.lines.map((text) => {
        const line = document.createElement('p');
        line.textContent = text;
        return line;
      })
    );

    // UN CHOIX (Hermès, Aphrodite) se fait sur le plateau : le téléphone le
    // montre, sans bouton qui choisirait à la place des joueurs.
    show(validate, prompt.action !== null);
    show(promptNote, prompt.action === null);
    validate.textContent = prompt.action ?? '';
    validate.disabled = false;
  };

  const renderSummary = () => {
    if (summary === null) return;

    turn.textContent = `Au tour de ${summary.turn}`;
    button.textContent = summary.awaitingFavor ? 'Lancer les 2 dés' : 'Lancer le dé';
    renderPrompt();
    syncRoll();

    players.replaceChildren(
      ...summary.players.map((player) => {
        const item = document.createElement('li');
        item.textContent = `${player.name} — case ${player.position + 1}`;
        item.style.borderLeftColor = player.color;
        return item;
      })
    );
  };

  const renderStatus = (state: string) => {
    status.textContent =
      state === 'linked' ? '\u{1F7E2} Relié au plateau' : '\u{1F534} Liaison perdue — vérifiez le WiFi';
    status.dataset.state = state;
  };

  button.addEventListener('click', () => {
    if (!link.request({ kind: summary?.awaitingFavor ? 'favor-request' : 'roll-request' })) {
      // LE BOUTON NE PART PAS DANS LE VIDE : sans liaison, rien ne se grise
      // et la ligne d'état dit déjà « Liaison perdue ». On ne laisse pas
      // croire qu'un dé roule quelque part.
      return;
    }

    button.disabled = true;
    face.textContent = '…';

    // LE PLATEAU PEUT REFUSER EN SILENCE — un dé roule déjà, une fenêtre
    // attend un choix. Sans ce délai, le bouton resterait gris pour toujours.
    waiting = setTimeout(() => {
      release();
      if (face.textContent === '…') face.textContent = '–';
    }, ROLL_TIMEOUT_MS);
  });

  validate.addEventListener('click', () => {
    const prompt = summary?.prompt;
    if (!prompt) return;

    // GRISÉ JUSQU'À LA RÉPONSE DU PLATEAU : deux appuis rapides ne doivent
    // pas sembler valider deux fois. La fenêtre suivante, si elle vient,
    // rend le bouton.
    if (link.request({ kind: 'validate', prompt: prompt.id })) validate.disabled = true;
  });

  const handle = (announcement: Announcement) => {
    switch (announcement.kind) {
      case 'state':
        summary = announcement.state as RemoteSummary;
        renderSummary();
        break;
      case 'rolled':
        // LA FACE AFFICHÉE EST CELLE DU PLATEAU, reçue telle quelle. La
        // manette n'en tire jamais une à elle.
        face.textContent = String(announcement.dice);
        release();
        break;
      case 'favor-rolled':
        face.textContent = `${announcement.dice[0]} + ${announcement.dice[1]}`;
        release();
        break;
      case 'notice':
        notices.unshift(announcement.text);
        notices.length = Math.min(notices.length, NOTICE_DEPTH);
        renderLog();
        break;
      case 'delta':
        break;
    }
  };

  show(promptCard, false);

  const offAnnouncement = link.onAnnouncement(handle);
  const offStatus = link.onStatus(renderStatus);
  renderStatus(link.status());

  return () => {
    release();
    offAnnouncement();
    offStatus();
    screen.remove();
  };
}
