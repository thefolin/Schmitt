/**
 * Modèle représentant un joueur dans le jeu
 */
export interface Player {
  name: string;
  color: string;
  position: number;
  hasSchmittPower: boolean;
  isReturning: boolean;
  /**
   * Vrai dès que le joueur a quitté START pendant la phase de retour.
   * Sans ce drapeau, un joueur encore sur START au moment du demi-tour
   * gagnerait instantanément, sans avoir fait le voyage de retour.
   */
  hasLeftStartOnReturn: boolean;
  drinks: number;
  hasAthenaShield: boolean;
  canReplay: boolean; // Permet de rejouer (case replay)
  /**
   * Rang de Poulet : 0 = aucun, 1 = Petit Poulet 🐤, 2 = Gros Poulet 🐔.
   *
   * Le statut dure plusieurs tours et décide qui boit sur chaque 3 ou 6 : il
   * doit donc se voir sur le pion. `GameLogic` en reste la source de vérité,
   * ce champ n'est que son reflet pour l'affichage.
   */
  chickenRank: 0 | 1 | 2;
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
  hasLeftStartOnReturn: boolean;
  drinks: number;
  hasAthenaShield: boolean;
  canReplay: boolean;
  chickenRank: 0 | 1 | 2;
  index: number;

  constructor(name: string, color: string, index: number) {
    this.name = name;
    this.color = color;
    this.index = index;
    this.position = 0;
    this.hasSchmittPower = false;
    this.isReturning = false;
    this.hasLeftStartOnReturn = false;
    this.drinks = 0;
    this.hasAthenaShield = false;
    this.canReplay = false;
    this.chickenRank = 0;
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
    this.hasLeftStartOnReturn = false;
    this.drinks = 0;
    this.hasAthenaShield = false;
    this.canReplay = false;
    this.chickenRank = 0;
  }
}
