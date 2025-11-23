/**
 * Modèle représentant un joueur dans le jeu
 */
export interface Player {
  name: string;
  color: string;
  position: number;
  hasSchmittPower: boolean;
  isReturning: boolean;
  drinks: number;
  hasAthenaShield: boolean;
  index: number;
}

/**
 * Classe pour créer et gérer un joueur
 */
export class PlayerModel implements Player {
  name: string;
  color: string;
  position: number;
  hasSchmittPower: boolean;
  isReturning: boolean;
  drinks: number;
  hasAthenaShield: boolean;
  index: number;

  constructor(name: string, color: string, index: number) {
    this.name = name;
    this.color = color;
    this.index = index;
    this.position = 0;
    this.hasSchmittPower = false;
    this.isReturning = false;
    this.drinks = 0;
    this.hasAthenaShield = false;
  }

  /**
   * Ajoute des gorgées au joueur
   */
  addDrinks(amount: number): void {
    this.drinks += amount;
  }

  /**
   * Déplace le joueur d'un certain nombre de cases
   */
  move(steps: number, maxPosition: number): void {
    if (this.isReturning) {
      this.position -= steps;
      if (this.position < 0) {
        this.position = Math.abs(this.position);
      }
    } else {
      this.position += steps;
      if (this.position > maxPosition) {
        const overflow = this.position - maxPosition;
        this.position = maxPosition - overflow;
      }
    }
  }

  /**
   * Réinitialise le joueur
   */
  reset(): void {
    this.position = 0;
    this.hasSchmittPower = false;
    this.isReturning = false;
    this.drinks = 0;
    this.hasAthenaShield = false;
  }
}
