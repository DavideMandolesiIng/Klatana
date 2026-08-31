import { HexMath } from './HexMath';
import { type ResourceType, type HexData, type MapTemplate, type PortType, type PortData, StandardMap, XLMap } from './mapTemplates';

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

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function generateMap(gameMode: 'standard' | 'xl' = 'standard', balancedResources: boolean = false): MapTemplate {
    const template = gameMode === 'xl' ? XLMap : StandardMap;
    const terrains = gameMode === 'xl' ? XL_TERRAINS : STANDARD_TERRAINS;
    const numbers = gameMode === 'xl' ? XL_NUMBERS : STANDARD_NUMBERS;
    const portTypes = gameMode === 'xl' ? XL_PORTS : STANDARD_PORTS;

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

    // Assign numbers (desert gets None)
    let numIndex = 0;
    hexes.forEach(h => {
        if (h.resource !== 'DESERT') {
            h.number = shuffledNumbers[numIndex];
            numIndex++;
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
                // If gameMode is xl, we have 8 reds instead of 4, so we might allow 2 of the same resource to be red.
                const limit = gameMode === 'xl' ? 2 : 1;
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

    return {
        name: `Random ${gameMode === 'xl' ? 'XL' : 'Standard'} Map`,
        hexes,
        ports
    };
}
