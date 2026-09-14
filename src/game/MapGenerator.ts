import { HexMath } from './HexMath';
import { type ResourceType, type HexData, type MapTemplate, type PortType, type PortData, StandardMap, XLMap, ConquestXLMap } from './mapTemplates';
import { type GameModeId, type MapTypeId, getGameMode } from './modes';

const STANDARD_TERRAINS: ResourceType[] = [
    'OAK', 'OAK', 'OAK', 'OAK',
    'WOOL', 'WOOL', 'WOOL', 'WOOL',
    'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS',
    'CLAY', 'CLAY', 'CLAY',
    'ORE', 'ORE', 'ORE',
    'DESERT'
];

const STANDARD_PORTS: PortType[] = [
    '3:1', '3:1', '3:1', '3:1',
    'OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'
];

const STANDARD_NUMBERS: number[] = [
    2, 12,
    3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11
];

const XL_TERRAINS: ResourceType[] = [
    'OAK', 'OAK', 'OAK', 'OAK', 'OAK', 'OAK', 'OAK', 'OAK',
    'WOOL', 'WOOL', 'WOOL', 'WOOL', 'WOOL', 'WOOL', 'WOOL', 'WOOL',
    'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS',
    'CLAY', 'CLAY', 'CLAY', 'CLAY', 'CLAY', 'CLAY',
    'ORE', 'ORE', 'ORE', 'ORE', 'ORE',
    'DESERT', 'DESERT'
];

const XL_PORTS: PortType[] = [
    '3:1', '3:1', '3:1', '3:1', '3:1',
    'OAK', 'OAK', 'CLAY', 'CLAY', 'CEREALS', 'WOOL', 'ORE'
];

const XL_NUMBERS: number[] = [
    2, 2, 12, 12,
    3, 3, 3, 3,
    4, 4, 4, 4,
    5, 5, 5, 5,
    6, 6, 6, 6,
    8, 8, 8, 8,
    9, 9, 9, 9,
    10, 10, 10, 10,
    11, 11, 11
];

// ConquestXL: 29 hexes total.
// 3 are fixed NUGGETS (with production numbers), 1 DESERT (no number) → 28 numbered hexes.
// The 26 non-NUGGETS slots are filled randomly from CONQUEST_XL_TERRAINS (26 entries = 25 resource + 1 DESERT).
const CONQUEST_XL_TERRAINS: ResourceType[] = [
    'OAK', 'OAK', 'OAK', 'OAK', 'OAK', 'OAK',
    'WOOL', 'WOOL', 'WOOL', 'WOOL', 'WOOL',       // 5 WOOL (one less: (1,0) is now fixed NUGGETS)
    'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS', 'CEREALS',
    'CLAY', 'CLAY', 'CLAY', 'CLAY',
    'ORE', 'ORE', 'ORE', 'ORE',
    'DESERT'
];

// 28 numbers: 25 for regular hexes + 3 for NUGGETS tiles
const CONQUEST_XL_NUMBERS: number[] = [
    2, 12,
    3, 3, 3, 3,
    4, 4, 4, 4,
    5, 5, 5, 5,
    6, 6, 6,
    8, 8, 8,
    9, 9, 9,
    10, 10, 10,
    11, 11
];

const CONQUEST_XL_PORTS: PortType[] = [
    '3:1', '3:1', '3:1', '3:1', '3:1',
    'OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'
];

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function generateMap(
    mapTypeOrMode: MapTypeId | 'standard' | 'xl' = 'standard',
    balancedResources: boolean = false,
    gameModeId: GameModeId | string = 'classic'
): MapTemplate {
    const isXL = mapTypeOrMode === 'xl';
    const isConquestXL = isXL && gameModeId === 'conquest';

    // ── ConquestXL: fixed NUGGETS hexes, dedicated resource pool ──
    if (isConquestXL) {
        const template = ConquestXLMap;
        const shuffledTerrains = shuffle(CONQUEST_XL_TERRAINS);
        let shuffledNumbers = shuffle(CONQUEST_XL_NUMBERS);
        const portTypes = CONQUEST_XL_PORTS;

        // Build hexes: NUGGETS slots are pre-fixed in the template;
        // fill the rest from shuffledTerrains.
        let terrainIdx = 0;
        let hexes: HexData[] = template.hexes.map(h => {
            if (h.resource === 'NUGGETS') {
                return { coords: h.coords, resource: 'NUGGETS' as ResourceType, number: null };
            }
            const resource = shuffledTerrains[terrainIdx++];
            return { coords: h.coords, resource, number: null };
        });

        // Assign numbers: NUGGETS get a production number (hidden until discovered); only DESERT skips.
        let numIndex = 0;
        hexes.forEach(h => {
            if (h.resource !== 'DESERT') {
                h.number = shuffledNumbers[numIndex++];
            } else {
                h.number = null;
            }
        });

        // Validate: no two red (6/8) hexes adjacent (include NUGGETS in swap candidates)
        let valid = false;
        let attempts = 0;
        while (!valid && attempts < 1000) {
            valid = true;
            attempts++;
            const redHexes = hexes.filter(h => h.number === 6 || h.number === 8);
            let troubleHex: HexData | null = null;
            for (let i = 0; i < redHexes.length; i++) {
                for (let j = i + 1; j < redHexes.length; j++) {
                    if (HexMath.isAdjacent(redHexes[i].coords, redHexes[j].coords)) {
                        valid = false;
                        troubleHex = redHexes[j];
                        break;
                    }
                }
                if (!valid) break;
                if (balancedResources) {
                    const sameCount = redHexes.filter(h => h.resource === redHexes[i].resource).length;
                    if (sameCount > 1) {
                        valid = false;
                        troubleHex = redHexes[i];
                        break;
                    }
                }
            }
            if (!valid && troubleHex) {
                const safeHexes = hexes.filter(h => h.number !== null && h.number !== 6 && h.number !== 8 && h.resource !== 'DESERT');
                const swapCandidate = safeHexes[Math.floor(Math.random() * safeHexes.length)];
                const tempNum = troubleHex.number;
                troubleHex.number = swapCandidate.number;
                swapCandidate.number = tempNum;
            }
        }

        const shuffledPorts = shuffle(portTypes);
        const ports: PortData[] = template.ports!.map((loc, i) => ({
            coords: loc.coords,
            edgeDirection: loc.edgeDirection,
            type: shuffledPorts[i]
        }));

        return {
            name: 'Random Conquest XL Map',
            hexes,
            ports
        };
    }

    const template = isXL ? XLMap : StandardMap;
    const terrains = isXL ? XL_TERRAINS : STANDARD_TERRAINS;
    const numbers = isXL ? XL_NUMBERS : STANDARD_NUMBERS;
    const portTypes = isXL ? XL_PORTS : STANDARD_PORTS;

    let hexes: HexData[] = [];
    const shuffledTerrains = shuffle(terrains);
    let shuffledNumbers = shuffle(numbers);

    // Assign terrains using coordinates from template
    shuffledTerrains.forEach((terrain, i) => {
        hexes.push({
            coords: template.hexes[i].coords,
            resource: terrain,
            number: null
        });
    });

    // In Conquest mode (standard map), ensure center hex (0,0) is NUGGETS and DESERT is placed elsewhere
    if (gameModeId === 'conquest') {
        const centerHex = hexes.find(h => h.coords.q === 0 && h.coords.r === 0);
        const originalDesertHex = hexes.find(h => h.resource === 'DESERT');

        if (centerHex) {
            if (originalDesertHex && originalDesertHex !== centerHex) {
                centerHex.resource = 'NUGGETS';
            } else {
                centerHex.resource = 'NUGGETS';
                const outerHexes = hexes.filter(h => h !== centerHex);
                const randomOuter = outerHexes[Math.floor(Math.random() * outerHexes.length)];
                randomOuter.resource = 'DESERT';
            }
        }
    }

    // Assign numbers (desert gets None)
    let numIndex = 0;
    hexes.forEach(h => {
        if (h.resource !== 'DESERT') {
            h.number = shuffledNumbers[numIndex];
            numIndex++;
        } else {
            h.number = null;
        }
    });

    // Validate and fix Rules
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 1000) {
        valid = true;
        attempts++;
        const redHexes = hexes.filter(h => h.number === 6 || h.number === 8);

        let troubleHex: HexData | null = null;

        for (let i = 0; i < redHexes.length; i++) {
            // Check Rule 1: No Red Numbers Touching
            for (let j = i + 1; j < redHexes.length; j++) {
                if (HexMath.isAdjacent(redHexes[i].coords, redHexes[j].coords)) {
                    valid = false;
                    troubleHex = redHexes[j];
                    break;
                }
            }
            if (!valid) break;

            // Check Rule 2: Balanced Resources
            if (balancedResources) {
                const sameResourceCount = redHexes.filter(h => h.resource === redHexes[i].resource).length;
                // If isXL, we have 8 reds instead of 4, so we might allow 2 of the same resource to be red.
                const limit = isXL ? 2 : 1;
                if (sameResourceCount > limit) {
                    valid = false;
                    // Pick this hex to swap
                    troubleHex = redHexes[i];
                    break;
                }
            }
        }

        if (!valid && troubleHex) {
            // Grab a random non-red number to swap with
            const safeHexes = hexes.filter(h => h.number !== null && h.number !== 6 && h.number !== 8 && h.resource !== 'DESERT');
            const swapCandidate = safeHexes[Math.floor(Math.random() * safeHexes.length)];

            // Execute swap
            const tempNum = troubleHex.number;
            troubleHex.number = swapCandidate.number;
            swapCandidate.number = tempNum;
        }
    }

    // Generate Ports based on map template
    const shuffledPorts = shuffle(portTypes);
    const ports: PortData[] = template.ports!.map((loc: any, i: number) => ({
        coords: loc.coords,
        edgeDirection: loc.edgeDirection,
        type: shuffledPorts[i]
    }));

    let mapResult: MapTemplate = {
        name: `Random ${isXL ? 'XL' : 'Standard'} Map`,
        hexes,
        ports
    };

    const mode = getGameMode(gameModeId);
    if (mode?.customizeGeneratedMap) {
        mapResult = mode.customizeGeneratedMap(mapResult);
    }

    return mapResult;
}
