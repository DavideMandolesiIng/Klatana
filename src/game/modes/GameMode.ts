import { type ResourceType, type MapTemplate } from '../mapTemplates';
import { type GameState } from '../GameState';

export type GameModeId = 'classic' | 'conquest';
export type MapTypeId = 'standard' | 'xl';

export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

export interface GameModeDefinition {
    id: GameModeId;
    name: string;
    description: string;
    supportedMapTypes: MapTypeId[];
    activeResources: Exclude<ResourceType, 'DESERT'>[];

    validateHousePlacement?: (
        gameState: GameState,
        nodeId: string,
        peerId: string,
        map?: MapTemplate
    ) => ValidationResult | null; // return null to allow default validation

    getTradeRates?: (
        gameState: GameState,
        map: MapTemplate,
        peerId: string,
        baseRates: Record<Exclude<ResourceType, 'DESERT'>, number>
    ) => Record<Exclude<ResourceType, 'DESERT'>, number>;

    canSelectInActionCard?: (cardType: 'MARKET CONTROL' | 'ABUNDANCE', res: ResourceType) => boolean;

    customizeGeneratedMap?: (template: MapTemplate) => MapTemplate;
}

const gameModesRegistry: Partial<Record<GameModeId, GameModeDefinition>> = {};

export const registerGameMode = (mode: GameModeDefinition) => {
    gameModesRegistry[mode.id] = mode;
};

export const getGameMode = (id?: GameModeId | string): GameModeDefinition => {
    if (id && gameModesRegistry[id as GameModeId]) {
        return gameModesRegistry[id as GameModeId]!;
    }
    return gameModesRegistry['classic']!;
};

export const getAllGameModes = (): GameModeDefinition[] => {
    return Object.values(gameModesRegistry);
};
