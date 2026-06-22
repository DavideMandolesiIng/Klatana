import { type ResourceType, type MapTemplate } from './mapTemplates';
import { type PlayerData } from './Player';
import { HexMath } from './HexMath';

export type TurnPhase = 'ROLL' | 'TRADE' | 'BUILD';
export type GamePhase = 'SETUP_1' | 'SETUP_2' | 'MAIN_GAME' | 'NINJA_DISCARD' | 'NINJA_MOVE' | 'NINJA_STEAL' | 'FREE_ROAD_BUILDING';
export type ActionCardType = 'NINJA' | 'MONUMENT' | 'MONOPOLY' | 'ABUNDANCE' | 'RAPID_EXPANSION';
export type SetupAction = 'SETTLEMENT' | 'ROAD';

// We map generic resource types. DESERT produces nothing.
export type ResourceCounts = Record<Exclude<ResourceType, 'DESERT'>, number>;

export const BUILD_COSTS = {
  ROAD: { WOOD: 1, CLAY: 1 },
  SETTLEMENT: { WOOD: 1, CLAY: 1, WHEAT: 1, WOOL: 1 },
  CITY: { ORE: 3, WHEAT: 2 },
  ACTION_CARD: { ORE: 1, WHEAT: 1, WOOL: 1 }
};

export const canAfford = (resources: ResourceCounts, cost: Partial<Record<string, number>>): boolean => {
    for (const [res, amount] of Object.entries(cost)) {
        if ((resources[res as keyof ResourceCounts] || 0) < amount) {
            return false;
        }
    }
    return true;
};

export interface PlayerState {
  peerId: string;
  username: string;
  color: string;
  resources: ResourceCounts;
  victoryPoints: number;
  actionCards: { type: ActionCardType, boughtThisTurn: boolean }[];
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
  gamePhase: GamePhase;
  setupAction?: SetupAction;
  lastBuiltNodeId?: string;
  phase: TurnPhase;
  diceRoll: { die1: number; die2: number, total: number } | null;
  logs: string[];
  settlements: Record<string, Settlement>;
  roads: Record<string, Road>;
  actionCardDeck: ActionCardType[];
  ninjaHexCoords: { q: number, r: number };
  playersNeedingToDiscard: string[];
  activeTurnPlayedCard: boolean;
  freeRoadsLeft: number;
}

export const createInitialGameState = (lobbyPlayers: PlayerData[], map?: MapTemplate): GameState => {
  const deck: ActionCardType[] = [
      ...Array(14).fill('NINJA'),
      ...Array(5).fill('MONUMENT'),
      ...Array(2).fill('MONOPOLY'),
      ...Array(2).fill('ABUNDANCE'),
      ...Array(2).fill('RAPID_EXPANSION')
  ];
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  let desertCoords = { q: 0, r: 0 };
  if (map) {
      const desert = map.hexes.find(h => h.resource === 'DESERT');
      if (desert) desertCoords = { ...desert.coords };
  }

  return {
    players: lobbyPlayers.map(p => ({
      peerId: p.peerId,
      username: p.username,
      color: p.color || 'RED',
      resources: { WOOD: 0, CLAY: 0, WHEAT: 0, WOOL: 0, ORE: 0, GOLD: 0 },
      victoryPoints: 0,
      actionCards: []
    })),
    currentTurnIndex: 0,
    gamePhase: 'SETUP_1',
    setupAction: 'SETTLEMENT',
    phase: 'ROLL',
    diceRoll: null,
    logs: ['Game started! Setup Phase 1: Place a settlement and a road.'],
    settlements: {},
    roads: {},
    actionCardDeck: deck,
    ninjaHexCoords: desertCoords,
    playersNeedingToDiscard: [],
    activeTurnPlayedCard: false,
    freeRoadsLeft: 0
  };
};

export const validateSettlementPlacement = (gameState: GameState, nodeId: string, peerId: string): {valid: boolean, reason?: string} => {
    if (gameState.settlements[nodeId]) return {valid: false, reason: "Node is already occupied."};
    
    const isTooClose = Object.keys(gameState.settlements).some(existingNode => HexMath.areNodesAdjacent(nodeId, existingNode));
    if (isTooClose) return {valid: false, reason: "Distance Rule: Too close to another settlement."};

    if (gameState.gamePhase === 'MAIN_GAME') {
        const player = gameState.players.find(p => p.peerId === peerId);
        if (player && !canAfford(player.resources, BUILD_COSTS.SETTLEMENT)) {
            return {valid: false, reason: "Not enough resources."};
        }

        const ownsConnectedRoad = Object.values(gameState.roads).some(r => r.ownerId === peerId && HexMath.isEdgeAdjacentToNode(r.edgeId, nodeId));
        if (!ownsConnectedRoad) return {valid: false, reason: "Must connect to one of your roads."};
    }
    return {valid: true};
};

export const validateRoadPlacement = (gameState: GameState, edgeId: string, peerId: string): {valid: boolean, reason?: string} => {
    if (gameState.roads[edgeId]) return {valid: false, reason: "Edge is already occupied."};

    if (gameState.gamePhase === 'SETUP_1' || gameState.gamePhase === 'SETUP_2') {
        if (!gameState.lastBuiltNodeId) return {valid: false, reason: "Must place a settlement first."};
        if (!HexMath.isEdgeAdjacentToNode(edgeId, gameState.lastBuiltNodeId)) {
            return {valid: false, reason: "Road must connect to your newly placed settlement."};
        }
    } else {
        const player = gameState.players.find(p => p.peerId === peerId);
        if (player && !canAfford(player.resources, BUILD_COSTS.ROAD)) {
            return {valid: false, reason: "Not enough resources."};
        }

        // Check: connects to own settlement/city at one of the two edge endpoints
        const connectsToOwnSettlement = Object.values(gameState.settlements).some(
            s => s.ownerId === peerId && HexMath.isEdgeAdjacentToNode(edgeId, s.nodeId)
        );

        // Check: connects to own road, but NOT if the shared node is blocked by an enemy settlement
        const edgeNodes = HexMath.getEdgeNodeIds(edgeId);
        const connectsToOwnRoadUnblocked = Object.values(gameState.roads).some(r => {
            if (r.ownerId !== peerId) return false;
            if (!HexMath.areEdgesAdjacent(edgeId, r.edgeId)) return false;
            // Find the shared node between the two edges
            const existingEdgeNodes = HexMath.getEdgeNodeIds(r.edgeId);
            const sharedNode = edgeNodes.find(n => existingEdgeNodes.includes(n));
            if (!sharedNode) return false;
            // BLOCKED if an enemy settlement/city sits on the shared node
            const nodeOccupant = gameState.settlements[sharedNode];
            if (nodeOccupant && nodeOccupant.ownerId !== peerId) return false;
            return true;
        });

        if (!connectsToOwnSettlement && !connectsToOwnRoadUnblocked) {
            return {valid: false, reason: "Road must connect to your own settlement, city, or an unblocked road."};
        }
    }
    return {valid: true};
};

/**
 * Returns the Set of edge IDs where the current player is allowed to place a road.
 * This is used by the UI to highlight only truly valid edges.
 */
export const getValidRoadPlacements = (gameState: GameState, peerId: string, allEdgeIds: string[]): Set<string> => {
    const valid = new Set<string>();
    for (const edgeId of allEdgeIds) {
        if (validateRoadPlacement(gameState, edgeId, peerId).valid) {
            valid.add(edgeId);
        }
    }
    return valid;
};

/**
 * Returns the Set of node IDs where the current player is allowed to place a settlement.
 * This is used by the UI to highlight only truly valid nodes.
 */
export const getValidSettlementPlacements = (gameState: GameState, peerId: string, allNodeIds: string[]): Set<string> => {
    const valid = new Set<string>();
    for (const nodeId of allNodeIds) {
        if (validateSettlementPlacement(gameState, nodeId, peerId).valid) {
            valid.add(nodeId);
        }
    }
    return valid;
};

export const getStartingResources = (gameState: GameState, nodeId: string, map: MapTemplate): Partial<Record<string, number>> => {
    const nodeHexes = nodeId.split('|');
    const gained: Partial<Record<string, number>> = {};
    nodeHexes.forEach(hexCoordsStr => {
        const [qStr, rStr] = hexCoordsStr.split(',');
        const q = parseInt(qStr, 10);
        const r = parseInt(rStr, 10);
        const hex = map.hexes.find(h => h.coords.q === q && h.coords.r === r);
        if (hex && hex.resource !== 'DESERT') {
            gained[hex.resource] = (gained[hex.resource] || 0) + 1;
        }
    });
    return gained;
};

export const advanceSetupTurn = (gameState: GameState): GameState => {
    const n = gameState.players.length;
    const i = gameState.currentTurnIndex;
    let nextPhase = gameState.gamePhase;
    let nextI = i;

    if (gameState.gamePhase === 'SETUP_1') {
        if (i < n - 1) {
            nextI = i + 1;
        } else {
            nextPhase = 'SETUP_2';
            nextI = n - 1;
        }
    } else if (gameState.gamePhase === 'SETUP_2') {
        if (i > 0) {
            nextI = i - 1;
        } else {
            nextPhase = 'MAIN_GAME';
            nextI = 0;
        }
    }

    const nextPlayer = gameState.players[nextI];
    return {
        ...gameState,
        currentTurnIndex: nextI,
        gamePhase: nextPhase,
        setupAction: nextPhase !== 'MAIN_GAME' ? 'SETTLEMENT' : undefined,
        lastBuiltNodeId: undefined,
        phase: 'ROLL',
        logs: [...gameState.logs, nextPhase === 'MAIN_GAME' ? `Setup complete! It's ${nextPlayer.username}'s turn to roll.` : `It's ${nextPlayer.username}'s setup turn.`]
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
    const playersNeedingToDiscard = gameState.players
      .filter(p => Object.values(p.resources).reduce((sum, count) => sum + count, 0) > 7)
      .map(p => p.peerId);

    return {
      ...gameState,
      gamePhase: playersNeedingToDiscard.length > 0 ? 'NINJA_DISCARD' : 'NINJA_MOVE',
      playersNeedingToDiscard,
      logs: [...gameState.logs, `A 7 was rolled! Ninja activated. ${playersNeedingToDiscard.length > 0 ? 'Some players must discard.' : ''}`]
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
    if (hex.coords.q === gameState.ninjaHexCoords.q && hex.coords.r === gameState.ninjaHexCoords.r) {
        logEntries.push(`Ninja blocked production on ${hex.resource} hex.`);
        return;
    }
    
    const nodeIds = HexMath.getHexNodeIds(hex.coords);
    nodeIds.forEach(nodeId => {
      const settlement = gameState.settlements[nodeId];
      if (settlement) {
         const owner = newPlayers.find(p => p.peerId === settlement.ownerId);
         if (owner) {
            const amount = settlement.isCity ? 2 : 1;
            owner.resources[hex.resource as keyof ResourceCounts] += amount;
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
