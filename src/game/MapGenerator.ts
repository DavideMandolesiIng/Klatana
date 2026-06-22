import { type Axial, HexMath } from './HexMath';
import { type ResourceType, type HexData, type MapTemplate } from './mapTemplates';

const STANDARD_TERRAINS: ResourceType[] = [
    'WOOD', 'WOOD', 'WOOD', 'WOOD',
    'WOOL', 'WOOL', 'WOOL', 'WOOL',
    'WHEAT', 'WHEAT', 'WHEAT', 'WHEAT',
    'CLAY', 'CLAY', 'CLAY',
    'ORE', 'ORE', 'ORE',
    'DESERT'
];

const STANDARD_NUMBERS: number[] = [
    2, 12, 
    3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11
];

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function generateStandardMap(balancedResources: boolean = false): MapTemplate {
    // 1. Define standard coordinates
    const coords: Axial[] = [
        {q: 0, r: 0}, // center
        ...HexMath.directions, // ring 1
        {q:0, r:-2}, {q:1, r:-2}, {q:2, r:-2}, // ring 2
        {q:2, r:-1}, {q:2, r:0}, {q:1, r:1},
        {q:0, r:2}, {q:-1, r:2}, {q:-2, r:2},
        {q:-2, r:1}, {q:-2, r:0}, {q:-1, r:-1}
    ];

    let hexes: HexData[] = [];
    const shuffledTerrains = shuffle(STANDARD_TERRAINS);
    let shuffledNumbers = shuffle(STANDARD_NUMBERS);
    
    // Assign terrains
    shuffledTerrains.forEach((terrain, i) => {
        hexes.push({
            coords: coords[i],
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

    // 4. Validate and fix Rules
    let valid = false;
    while (!valid) {
        valid = true;
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
                if (sameResourceCount > 1) {
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

    return {
        name: "Random Standard Map",
        hexes
    };
}
