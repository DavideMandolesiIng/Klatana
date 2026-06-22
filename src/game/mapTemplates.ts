import { type Axial } from './HexMath';

export type ResourceType = 'WOOD' | 'CLAY' | 'WHEAT' | 'WOOL' | 'ORE' | 'GOLD' | 'DESERT';

export interface HexData {
  coords: Axial;
  resource: ResourceType;
  number: number | null; // 2-12, null for desert
}

export interface MapTemplate {
  name: string;
  hexes: HexData[];
}

export const StandardMap: MapTemplate = {
  name: "Standard",
  hexes: [
    // Center
    { coords: { q: 0, r: 0 }, resource: 'DESERT', number: null },
    
    // Ring 1
    { coords: { q: 1, r: -1 }, resource: 'WOOD', number: 11 },
    { coords: { q: 1, r: 0 }, resource: 'WOOL', number: 12 },
    { coords: { q: 0, r: 1 }, resource: 'WHEAT', number: 9 },
    { coords: { q: -1, r: 1 }, resource: 'CLAY', number: 4 },
    { coords: { q: -1, r: 0 }, resource: 'ORE', number: 6 },
    { coords: { q: 0, r: -1 }, resource: 'WOOD', number: 5 },
    
    // Ring 2
    { coords: { q: 0, r: -2 }, resource: 'WOOL', number: 10 },
    { coords: { q: 1, r: -2 }, resource: 'WHEAT', number: 3 },
    { coords: { q: 2, r: -2 }, resource: 'WOOD', number: 11 },
    { coords: { q: 2, r: -1 }, resource: 'ORE', number: 4 },
    { coords: { q: 2, r: 0 }, resource: 'WHEAT', number: 8 },
    { coords: { q: 1, r: 1 }, resource: 'CLAY', number: 2 },
    { coords: { q: 0, r: 2 }, resource: 'WOOL', number: 9 },
    { coords: { q: -1, r: 2 }, resource: 'WOOD', number: 10 },
    { coords: { q: -2, r: 2 }, resource: 'ORE', number: 8 },
    { coords: { q: -2, r: 1 }, resource: 'WHEAT', number: 3 },
    { coords: { q: -2, r: 0 }, resource: 'CLAY', number: 5 },
    { coords: { q: -1, r: -1 }, resource: 'WOOL', number: 6 },
  ]
};
