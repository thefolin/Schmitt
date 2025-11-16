/**
 * Gestionnaire des sons du jeu
 * Utilise l'API Web Audio pour générer des sons simples
 */
export class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    this.initAudio();
  }

  /**
   * Initialise le contexte audio
   */
  private initAudio(): void {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Active ou désactive les sons
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && !this.audioContext) {
      this.initAudio();
    }
  }

  /**
   * Vérifie si les sons sont activés
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Joue un bip simple
   */
  private playBeep(frequency: number, duration: number): void {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  /**
   * Joue une mélodie (séquence de notes)
   */
  private playMelody(notes: number[], duration: number): void {
    if (!this.enabled || !this.audioContext) return;

    notes.forEach((note, index) => {
      setTimeout(() => this.playBeep(note, duration), index * duration * 1000);
    });
  }

  /**
   * Sons spécifiques du jeu
   */
  playDiceRoll(): void {
    this.playBeep(300, 0.1);
  }

  playMove(): void {
    this.playBeep(400, 0.05);
  }

  playDrink(): void {
    this.playBeep(200, 0.15);
  }

  playWin(): void {
    this.playMelody([523, 659, 784, 1047], 0.2);
  }

  playEffect(): void {
    this.playBeep(500, 0.1);
  }

  playTemple(): void {
    this.playMelody([392, 523, 659], 0.15);
  }
}
