import { type ResourceType, type MapTemplate } from './mapTemplates';
import { type PlayerData } from './Player';
import { HexMath } from './HexMath';

export type TurnPhase = 'ROLL' | 'TRADE' | 'BUILD';
export type GamePhase = 'SETUP_1' | 'SETUP_2' | 'MAIN_GAME' | 'NINJA_DISCARD' | 'NINJA_MOVE' | 'NINJA_STEAL' | 'FREE_STREET_BUILDING' | 'GAME_OVER' | 'P2P_TRADE_PENDING';
export type ActionCardType = 'NINJA' | 'MONUMENT' | 'MARKET CONTROL' | 'ABUNDANCE' | 'RAPID_EXPANSION';
export type SetupAction = 'HOUSE' | 'STREET';

export interface GameSettings {
    hideBankResources: boolean;
    winPoints: number;
    turnTimer: number | null;
    discardLimit: number;
    trueRoll: boolean;
    gameMode: 'standard' | 'xl';
    balancedResources: boolean;
    safeNinja: boolean;
}

// We map generic resource types. DESERT produces nothing.
export type ResourceCounts = Record<Exclude<ResourceType, 'DESERT'>, number>;

export const BUILD_COSTS = {
    street: { OAK: 1, CLAY: 1 },
    HOUSE: { OAK: 1, CLAY: 1, CEREALS: 1, WOOL: 1 },
    FORTRESS: { ORE: 3, CEREALS: 2 },
    ACTION_CARD: { ORE: 1, CEREALS: 1, WOOL: 1 }
};

export const canAfford = (resources: ResourceCounts, cost: Partial<Record<string, number>>): boolean => {
    for (const [res, amount] of Object.entries(cost)) {
        if ((resources[res as keyof ResourceCounts] || 0) < (amount || 0)) {
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
    inventory: { availableStreets: number; availableHouses: number; availableFortresses: number };
    victoryPoints: number;
    actionCards: { type: ActionCardType, boughtThisTurn: boolean }[];
    playerId?: string;
    isInert?: boolean;
}

export interface House {
    ownerId: string;
    isFortress: boolean;
    nodeId: string;
}

export interface street {
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
    houses: Record<string, House>;
    streets: Record<string, street>;
    actionCardDeck: ActionCardType[];
    ninjaHexCoords: { q: number, r: number };
    playersNeedingToDiscard: string[];
    activeTurnPlayedCard: boolean;
    freeStreetsLeft: number;
    largestClanHolder: string | null;
    largestClanSize: number;
    longestStreetHolder: string | null;
    longestStreetLength: number;
    playedNinjaCards: Record<string, number>;
    winningScore: number;
    diceDeck: { die1: number, die2: number }[];
    settings: GameSettings;
    tradeProposal?: {
        proposerId: string;
        offer: Partial<ResourceCounts>;
        request: Partial<ResourceCounts>;
        acceptedBy: string[];
        declinedBy?: string[];
    };
    isPaused: boolean;
    disconnectedPlayers: string[];
    turnCounter: number;
}

export const createDiceDeck = (): { die1: number, die2: number }[] => {
    const deck: { die1: number, die2: number }[] = [];
    for (let i = 1; i <= 6; i++) {
        for (let j = 1; j <= 6; j++) {
            deck.push({ die1: i, die2: j });
        }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

export const createInitialGameState = (lobbyPlayers: PlayerData[], map: MapTemplate | undefined, settings: GameSettings): GameState => {
    // Randomize turn order at game start
    const shuffledPlayers = [...lobbyPlayers];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }

    const deck: ActionCardType[] = [
        ...Array(14).fill('NINJA'),
        ...Array(5).fill('MONUMENT'),
        ...Array(2).fill('MARKET CONTROL'),
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
        players: shuffledPlayers.map(p => ({
            peerId: p.peerId,
            playerId: p.playerId,
            username: p.username,
            color: p.color || 'RED',
            resources: { OAK: 0, CLAY: 0, CEREALS: 0, WOOL: 0, ORE: 0, NUGGETS: 0 },
            inventory: { availableStreets: 15, availableHouses: 5, availableFortresses: 4 },
            victoryPoints: 0,
            actionCards: [],
            isInert: false
        })),
        currentTurnIndex: 0,
        gamePhase: 'SETUP_1',
        setupAction: 'HOUSE',
        phase: 'ROLL',
        diceRoll: null,
        logs: ['Game started! Setup Phase 1: Place a house and a street.'],
        houses: {},
        streets: {},
        actionCardDeck: deck,
        ninjaHexCoords: desertCoords,
        playersNeedingToDiscard: [],
        activeTurnPlayedCard: false,
        freeStreetsLeft: 0,
        largestClanHolder: null,
        largestClanSize: 0,
        longestStreetHolder: null,
        longestStreetLength: 0,
        playedNinjaCards: {},
        winningScore: settings.winPoints,
        diceDeck: settings.trueRoll ? [] : createDiceDeck(),
        settings,
        isPaused: false,
        disconnectedPlayers: [],
        turnCounter: 1
    };
};

export const validateHousePlacement = (gameState: GameState, nodeId: string, peerId: string): { valid: boolean, reason?: string } => {
    if (gameState.houses[nodeId]) return { valid: false, reason: "Node is already occupied." };

    const player = gameState.players.find(p => p.peerId === peerId);
    if (player && player.inventory.availableHouses <= 0) {
        return { valid: false, reason: "No houses left in inventory." };
    }

    const isTooClose = Object.keys(gameState.houses).some(existingNode => HexMath.areNodesAdjacent(nodeId, existingNode));
    if (isTooClose) return { valid: false, reason: "Distance Rule: Too close to another house." };

    if (gameState.gamePhase !== 'MAIN_GAME' && gameState.gamePhase !== 'SETUP_1' && gameState.gamePhase !== 'SETUP_2') {
        return { valid: false, reason: "Cannot build a house during this phase." };
    }

    if (gameState.gamePhase === 'MAIN_GAME') {
        const player = gameState.players.find(p => p.peerId === peerId);
        if (player && !canAfford(player.resources, BUILD_COSTS.HOUSE)) {
            return { valid: false, reason: "Not enough resources." };
        }

        const ownsConnectedStreet = Object.values(gameState.streets).some(r => r.ownerId === peerId && HexMath.isEdgeAdjacentToNode(r.edgeId, nodeId));
        if (!ownsConnectedStreet) return { valid: false, reason: "Must connect to one of your streets." };
    }
    return { valid: true };
};

export const validatestreetPlacement = (gameState: GameState, edgeId: string, peerId: string): { valid: boolean, reason?: string } => {
    if (gameState.streets[edgeId]) return { valid: false, reason: "Edge is already occupied." };

    const player = gameState.players.find(p => p.peerId === peerId);
    if (player && player.inventory.availableStreets <= 0) {
        return { valid: false, reason: "No streets left in inventory." };
    }

    if (gameState.gamePhase === 'SETUP_1' || gameState.gamePhase === 'SETUP_2') {
        if (!gameState.lastBuiltNodeId) return { valid: false, reason: "Must place a house first." };
        if (!HexMath.isEdgeAdjacentToNode(edgeId, gameState.lastBuiltNodeId)) {
            return { valid: false, reason: "street must connect to your newly placed house." };
        }
    } else if (gameState.gamePhase === 'MAIN_GAME' || gameState.gamePhase === 'FREE_STREET_BUILDING') {
        const player = gameState.players.find(p => p.peerId === peerId);
        if (gameState.gamePhase === 'MAIN_GAME' && player && !canAfford(player.resources, BUILD_COSTS.street)) {
            return { valid: false, reason: "Not enough resources." };
        }

        // Check: connects to own house/fortress at one of the two edge endpoints
        const connectsToOwnHouse = Object.values(gameState.houses).some(
            s => s.ownerId === peerId && HexMath.isEdgeAdjacentToNode(edgeId, s.nodeId)
        );

        // Check: connects to own street, but NOT if the shared node is blocked by an enemy house
        const edgeNodes = HexMath.getEdgeNodeIds(edgeId);
        const connectsToOwnStreetUnblocked = Object.values(gameState.streets).some(r => {
            if (r.ownerId !== peerId) return false;
            if (!HexMath.areEdgesAdjacent(edgeId, r.edgeId)) return false;
            // Find the shared node between the two edges
            const existingEdgeNodes = HexMath.getEdgeNodeIds(r.edgeId);
            const sharedNode = edgeNodes.find(n => existingEdgeNodes.includes(n));
            if (!sharedNode) return false;
            // BLOCKED if an enemy house/fortress sits on the shared node
            const nodeOccupant = gameState.houses[sharedNode];
            if (nodeOccupant && nodeOccupant.ownerId !== peerId) return false;
            return true;
        });

        if (!connectsToOwnHouse && !connectsToOwnStreetUnblocked) {
            return { valid: false, reason: "street must connect to your own house, fortress, or an unblocked street." };
        }
    } else {
        return { valid: false, reason: "Cannot build a street during this phase." };
    }
    return { valid: true };
};

/**
 * Returns the Set of edge IDs where the current player is allowed to place a street.
 * This is used by the UI to highlight only truly valid edges.
 */
export const getValidStreetPlacements = (gameState: GameState, peerId: string, allEdgeIds: string[]): Set<string> => {
    const valid = new Set<string>();
    for (const edgeId of allEdgeIds) {
        if (validatestreetPlacement(gameState, edgeId, peerId).valid) {
            valid.add(edgeId);
        }
    }
    return valid;
};

/**
 * Returns the Set of node IDs where the current player is allowed to place a house.
 * This is used by the UI to highlight only truly valid nodes.
 */
export const getValidHousePlacements = (gameState: GameState, peerId: string, allNodeIds: string[]): Set<string> => {
    const valid = new Set<string>();
    for (const nodeId of allNodeIds) {
        if (validateHousePlacement(gameState, nodeId, peerId).valid) {
            valid.add(nodeId);
        }
    }
    return valid;
};

export const getStartingResources = (_gameState: GameState, nodeId: string, map: MapTemplate): Partial<Record<string, number>> => {
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
        setupAction: nextPhase !== 'MAIN_GAME' ? 'HOUSE' : undefined,
        lastBuiltNodeId: undefined,
        phase: 'ROLL',
        logs: [...gameState.logs, nextPhase === 'MAIN_GAME' ? `Setup complete! It's ${nextPlayer.username}'s turn to roll.` : `It's ${nextPlayer.username}'s setup turn.`],
        turnCounter: gameState.turnCounter + 1
    };
};

export const rollDice = () => {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    return { die1, die2, total: die1 + die2 };
};

// Phase 3 placeholder for resource distribution.
// Real node-checking logic will come in Phase 4 when nodes/houses exist.
export const distributeResources = (gameState: GameState, map: MapTemplate, roll: number): GameState => {
    if (roll === 7) {
        const limit = gameState.settings?.discardLimit ?? 7;
        const playersNeedingToDiscard = gameState.players
            .filter(p => Object.values(p.resources).reduce((sum, count) => sum + count, 0) > limit)
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
            const house = gameState.houses[nodeId];
            if (house) {
                const owner = newPlayers.find(p => p.peerId === house.ownerId);
                if (owner && !owner.isInert) {
                    const amount = house.isFortress ? 2 : 1;
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

// 1. Get Longest street using Node DFS
export const getLongestStreetForPlayer = (gameState: GameState, peerId: string): number => {
    const myStreets = Object.values(gameState.streets).filter(r => r.ownerId === peerId);
    if (myStreets.length === 0) return 0;

    const nodeAdj: Record<string, { toNode: string, edgeId: string }[]> = {};
    myStreets.forEach(r => {
        const [n1, n2] = HexMath.getEdgeNodeIds(r.edgeId);
        if (!nodeAdj[n1]) nodeAdj[n1] = [];
        if (!nodeAdj[n2]) nodeAdj[n2] = [];
        nodeAdj[n1].push({ toNode: n2, edgeId: r.edgeId });
        nodeAdj[n2].push({ toNode: n1, edgeId: r.edgeId });
    });

    let maxNodePath = 0;
    const dfsNodes = (currentNode: string, visitedEdges: Set<string>, currentLength: number) => {
        if (currentLength > maxNodePath) maxNodePath = currentLength;
        const occupant = gameState.houses[currentNode];
        if (occupant && occupant.ownerId !== peerId && currentLength > 0) return;

        const neighbors = nodeAdj[currentNode] || [];
        for (const neighbor of neighbors) {
            if (!visitedEdges.has(neighbor.edgeId)) {
                visitedEdges.add(neighbor.edgeId);
                dfsNodes(neighbor.toNode, visitedEdges, currentLength + 1);
                visitedEdges.delete(neighbor.edgeId);
            }
        }
    };
    Object.keys(nodeAdj).forEach(startNode => {
        dfsNodes(startNode, new Set<string>(), 0);
    });

    return maxNodePath;
};

export const calculateScores = (gameState: GameState): GameState => {
    if (gameState.gamePhase === 'SETUP_1' || gameState.gamePhase === 'SETUP_2') return gameState;

    let newState: GameState = { ...gameState, players: JSON.parse(JSON.stringify(gameState.players)) as PlayerState[] };


    // Calculate Longest street and Base Points
    const playerStreetLengths: Record<string, number> = {};
    const playerBasePoints: Record<string, number> = {};

    newState.players.forEach(p => {
        playerStreetLengths[p.peerId] = getLongestStreetForPlayer(newState, p.peerId);
        playerBasePoints[p.peerId] = 0;
    });

    Object.values(newState.houses).forEach(s => {
        if (playerBasePoints[s.ownerId] !== undefined) {
            playerBasePoints[s.ownerId] += s.isFortress ? 2 : 1;
        }
    });

    // Determine Longest street Holder
    newState.players.forEach(p => {
        const streetLen = playerStreetLengths[p.peerId];
        if (streetLen >= 5 && streetLen > newState.longestStreetLength) {
            if (newState.longestStreetHolder !== p.peerId) {
                newState.logs.push(`${p.username} took the Longest street award!`);
            }
            newState.longestStreetHolder = p.peerId;
            newState.longestStreetLength = streetLen;
        }
    });

    // Update Scores and Check Win
    newState.players.forEach(p => {
        let publicVp = playerBasePoints[p.peerId];
        if (newState.longestStreetHolder === p.peerId) publicVp += 2;
        if (newState.largestClanHolder === p.peerId) publicVp += 2;

        p.victoryPoints = publicVp;

        const hiddenVp = p.actionCards.filter(c => c.type === 'MONUMENT').length;

        if (publicVp + hiddenVp >= newState.winningScore && newState.gamePhase !== 'GAME_OVER') {
            newState.gamePhase = 'GAME_OVER';
            newState.logs.push(`🏆 ${p.username} HAS WON THE GAME!`);
        }
    });

    return newState;
};

export const getPlayerTradeRates = (gameState: GameState, map: MapTemplate, peerId: string): Record<Exclude<ResourceType, 'DESERT'>, number> => {
    const rates: Record<Exclude<ResourceType, 'DESERT'>, number> = {
        OAK: 4, CLAY: 4, CEREALS: 4, WOOL: 4, ORE: 4, NUGGETS: 4
    };

    if (!map.ports) return rates;

    const playerNodes = new Set<string>();
    Object.values(gameState.houses).forEach(s => {
        if (s.ownerId === peerId) {
            playerNodes.add(s.nodeId);
        }
    });

    map.ports.forEach(port => {
        const dirIdx = (port.edgeDirection + 1) % 6;
        const neighbor = { q: port.coords.q + HexMath.directions[dirIdx].q, r: port.coords.r + HexMath.directions[dirIdx].r };
        const edgeId = HexMath.getEdgeId(port.coords, neighbor);
        const portNodes = HexMath.getEdgeNodeIds(edgeId);

        if (portNodes.some(n => playerNodes.has(n))) {
            if (port.type === '3:1') {
                Object.keys(rates).forEach(res => {
                    const r = res as Exclude<ResourceType, 'DESERT'>;
                    if (rates[r] > 3) rates[r] = 3;
                });
            } else {
                const r = port.type as Exclude<ResourceType, 'DESERT'>;
                if (rates[r] > 2) rates[r] = 2;
            }
        }
    });

    return rates;
};

