/**
 * Fonctions utilitaires
 */

/**
 * Génère un nombre aléatoire entre min et max (inclus)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Lance un dé à 6 faces
 */
export function rollDice(): number {
  return randomInt(1, 6);
}

/**
 * Formate une durée en minutes:secondes
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Attend un certain nombre de millisecondes
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crée des particules animées
 */
export function createParticles(x: number, y: number, emoji: string): void {
  for (let i = 0; i < 10; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = emoji;
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.fontSize = (Math.random() * 20 + 20) + 'px';
    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), 2000);
  }
}
