import { type GameModeDefinition, registerGameMode } from './GameMode';
import { HexMath } from '../HexMath';

export const ConquestMode: GameModeDefinition = {
    id: 'conquest',
    name: 'Conquest',
    description: 'Rush to the center: starting houses can only be placed on the outer ring. Mine the central Gold Nuggets hex and trade Nuggets 1:1 with the bank.',
    supportedMapTypes: ['standard'],
    activeResources: ['OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE', 'NUGGETS'],

    validateHousePlacement: (gameState, nodeId, _peerId, map) => {
        // Setup phase restriction: houses can only be placed on the outer ring
        if (gameState.gamePhase === 'SETUP_1' || gameState.gamePhase === 'SETUP_2') {
            if (map && !HexMath.isOuterRingNode(nodeId, map)) {
                return {
                    valid: false,
                    reason: "In Conquest mode, starting houses can only be placed on the outer ring."
                };
            }
        }
        return null;
    },

    getTradeRates: (_gameState, _map, _peerId, baseRates) => {
        // Nuggets can always be traded 1:1 with the bank
        return {
            ...baseRates,
            NUGGETS: 1
        };
    },

    // Nuggets are protected from Market Control and Abundance cards
    canSelectInActionCard: (_cardType, res) => res !== 'NUGGETS' && res !== 'DESERT'
};

registerGameMode(ConquestMode);
