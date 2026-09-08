import { type GameModeDefinition, registerGameMode } from './GameMode';

export const ClassicMode: GameModeDefinition = {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional Klatana rules: gather resources, build roads and houses, and expand your clan.',
    supportedMapTypes: ['standard', 'xl'],
    activeResources: ['OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'],

    // Default placement: no extra restrictions
    validateHousePlacement: () => null,

    // Default trade rates: uses base rates directly
    getTradeRates: (_gameState, _map, _peerId, baseRates) => baseRates,

    // Action cards can select standard resources
    canSelectInActionCard: (_cardType, res) => res !== 'NUGGETS' && res !== 'DESERT'
};

registerGameMode(ClassicMode);
