import { type ResourceType, type MapTemplate } from './mapTemplates';
import { type PlayerData } from './Player';

export type TurnPhase = 'ROLL' | 'TRADE' | 'BUILD';

// We map generic resource types. DESERT produces nothing.
export type ResourceCounts = Record<Exclude<ResourceType, 'DESERT'>, number>;

export interface PlayerState {
  peerId: string;
  username: string;
  color: string;
  resources: ResourceCounts;
  victoryPoints: number;
}

export interface GameState {
  players: PlayerState[];
  currentTurnIndex: number;
  phase: TurnPhase;
  diceRoll: { die1: number; die2: number, total: number } | null;
  logs: string[];
}

export const createInitialGameState = (lobbyPlayers: PlayerData[]): GameState => {
  return {
    players: lobbyPlayers.map(p => ({
      peerId: p.peerId,
      username: p.username,
      color: p.color || 'RED',
      resources: { WOOD: 0, CLAY: 0, WHEAT: 0, WOOL: 0, ORE: 0, GOLD: 0 },
      victoryPoints: 0
    })),
    currentTurnIndex: 0,
    phase: 'ROLL',
    diceRoll: null,
    logs: ['Game started!']
  };
};

export const rollDice = () => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return { die1, die2, total: die1 + die2 };
};

// Phase 3 placeholder for resource distribution.
// Real node-checking logic will come in Phase 4 when nodes/settlements exist.
export const distributeResources = (gameState: GameState, map: MapTemplate, roll: number): GameState => {
  if (roll === 7) {
    return {
      ...gameState,
      logs: [...gameState.logs, `A 7 was rolled! Robber activated. (Half cards rule not fully implemented yet)`]
    };
  }

  // Find hexes with this number
  const activeHexes = map.hexes.filter(h => h.number === roll);
  if (activeHexes.length === 0) {
    return {
      ...gameState,
      logs: [...gameState.logs, `Rolled ${roll}, but no hexes produce resources.`]
    };
  }

  const logEntries = activeHexes.map(h => `Hex at (${h.coords.q},${h.coords.r}) produces ${h.resource}.`);
  logEntries.push('(Settlement distribution logic will be added in Phase 4)');

  return {
    ...gameState,
    logs: [...gameState.logs, ...logEntries]
  };
};
