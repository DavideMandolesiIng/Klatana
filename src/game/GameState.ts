import { type ResourceType, type MapTemplate } from './mapTemplates';
import { type PlayerData } from './Player';
import { HexMath } from './HexMath';

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

export interface Settlement {
  ownerId: string;
  isCity: boolean;
  nodeId: string;
}

export interface Road {
  ownerId: string;
  edgeId: string;
}

export interface GameState {
  players: PlayerState[];
  currentTurnIndex: number;
  phase: TurnPhase;
  diceRoll: { die1: number; die2: number, total: number } | null;
  logs: string[];
  settlements: Record<string, Settlement>;
  roads: Record<string, Road>;
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
    logs: ['Game started!'],
    settlements: {},
    roads: {}
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
      logs: [...gameState.logs, `A 7 was rolled! Robber activated.`]
    };
  }

  // Find hexes with this number
  const activeHexes = map.hexes.filter(h => h.number === roll);
  if (activeHexes.length === 0) {
    return gameState;
  }

  const logEntries: string[] = [];
  // Deep clone players to safely mutate resources
  const newPlayers = JSON.parse(JSON.stringify(gameState.players)) as PlayerState[];

  activeHexes.forEach(hex => {
    if (hex.resource === 'DESERT') return;
    
    const nodeIds = HexMath.getHexNodeIds(hex.coords);
    nodeIds.forEach(nodeId => {
      const settlement = gameState.settlements[nodeId];
      if (settlement) {
         const owner = newPlayers.find(p => p.peerId === settlement.ownerId);
         if (owner) {
            const amount = settlement.isCity ? 2 : 1;
            owner.resources[hex.resource] += amount;
            logEntries.push(`${owner.username} got ${amount} ${hex.resource}`);
         }
      }
    });
  });

  if (logEntries.length === 0) {
    logEntries.push(`Rolled ${roll}, but no one received resources.`);
  }

  return {
    ...gameState,
    players: newPlayers,
    logs: [...gameState.logs, ...logEntries]
  };
};
