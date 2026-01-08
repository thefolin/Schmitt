/**
 * Data Transfer Objects pour l'Application Layer
 * Convertit les entités Domain en objets simples pour l'interface
 */

export interface PlayerDTO {
  id: string;
  name: string;
  color: string;
  position: {
    index: number;
    x?: number;
    y?: number;
  };
  resources: Record<string, number>;
}

export interface TileDTO {
  id: string;
  type: string;
  name: string;
  icon?: string;
  position: {
    index: number;
    x?: number;
    y?: number;
  };
}

export interface GameStateDTO {
  id: string;
  gameDefinitionId: string;
  phase: string;
  turnNumber: number;
  currentPlayerIndex: number;
  players: PlayerDTO[];
  board: {
    size: number;
    tiles: TileDTO[];
  };
  metadata?: Record<string, any>;
}

export interface GameActionDTO {
  type: 'ROLL_DICE' | 'MOVE_PLAYER' | 'USE_POWER' | 'END_TURN' | 'CUSTOM';
  playerId: string;
  payload?: Record<string, any>;
}

export interface GameEventDTO {
  type: string;
  timestamp: number;
  playerId?: string;
  data: Record<string, any>;
}

export interface CreateGameDTO {
  gameDefinitionId: string;
  players: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export interface StartGameResultDTO {
  success: boolean;
  gameState: GameStateDTO;
  message?: string;
}

export interface ExecuteActionResultDTO {
  success: boolean;
  gameState: GameStateDTO;
  events: GameEventDTO[];
  errors?: string[];
}
