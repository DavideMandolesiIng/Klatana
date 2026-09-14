import { type Axial } from './HexMath';

export type ResourceType = 'OAK' | 'CLAY' | 'CEREALS' | 'WOOL' | 'ORE' | 'NUGGETS' | 'DESERT';
export type PortType = '3:1' | 'OAK' | 'CLAY' | 'CEREALS' | 'WOOL' | 'ORE';

export interface HexData {
  coords: Axial;
  resource: ResourceType;
  number: number | null; // 2-12, null for desert
}

export interface PortData {
  coords: Axial;
  edgeDirection: number;
  type: PortType;
}

export interface MapTemplate {
  name: string;
  hexes: HexData[];
  ports?: PortData[];
}

export const StandardMap: MapTemplate = {
  name: "Standard",
  hexes: [
    // Center
    { coords: { q: 0, r: 0 }, resource: 'DESERT', number: null },
    
    // Ring 1
    { coords: { q: 1, r: -1 }, resource: 'OAK', number: 11 },
    { coords: { q: 1, r: 0 }, resource: 'WOOL', number: 12 },
    { coords: { q: 0, r: 1 }, resource: 'CEREALS', number: 9 },
    { coords: { q: -1, r: 1 }, resource: 'CLAY', number: 4 },
    { coords: { q: -1, r: 0 }, resource: 'ORE', number: 6 },
    { coords: { q: 0, r: -1 }, resource: 'OAK', number: 5 },
    
    // Ring 2
    { coords: { q: 0, r: -2 }, resource: 'WOOL', number: 10 },
    { coords: { q: 1, r: -2 }, resource: 'CEREALS', number: 3 },
    { coords: { q: 2, r: -2 }, resource: 'OAK', number: 11 },
    { coords: { q: 2, r: -1 }, resource: 'ORE', number: 4 },
    { coords: { q: 2, r: 0 }, resource: 'CEREALS', number: 8 },
    { coords: { q: 1, r: 1 }, resource: 'CLAY', number: 2 },
    { coords: { q: 0, r: 2 }, resource: 'WOOL', number: 9 },
    { coords: { q: -1, r: 2 }, resource: 'OAK', number: 10 },
    { coords: { q: -2, r: 2 }, resource: 'ORE', number: 8 },
    { coords: { q: -2, r: 1 }, resource: 'CEREALS', number: 3 },
    { coords: { q: -2, r: 0 }, resource: 'CLAY', number: 5 },
    { coords: { q: -1, r: -1 }, resource: 'WOOL', number: 6 },
  ],
  ports: [
    { coords: { q: 1, r: -2 }, edgeDirection: 5, type: '3:1' },
    { coords: { q: 2, r: -2 }, edgeDirection: 0, type: '3:1' },
    { coords: { q: 2, r: 0 }, edgeDirection: 1, type: '3:1' },
    { coords: { q: 1, r: 1 }, edgeDirection: 1, type: '3:1' },
    { coords: { q: -1, r: 2 }, edgeDirection: 2, type: '3:1' },
    { coords: { q: -2, r: 2 }, edgeDirection: 3, type: '3:1' },
    { coords: { q: -2, r: 0 }, edgeDirection: 4, type: '3:1' },
    { coords: { q: -1, r: -1 }, edgeDirection: 4, type: '3:1' },
    { coords: { q: 0, r: -2 }, edgeDirection: 4, type: '3:1' },
  ]
};

export const XLMap: MapTemplate = {
  name: "XL",
  hexes: [
    ...StandardMap.hexes,
    // Ring 3
    { coords: { q: 0, r: -3 }, resource: 'WOOL', number: 10 },
    { coords: { q: 1, r: -3 }, resource: 'CEREALS', number: 3 },
    { coords: { q: 2, r: -3 }, resource: 'OAK', number: 11 },
    { coords: { q: 3, r: -3 }, resource: 'ORE', number: 4 },
    { coords: { q: 3, r: -2 }, resource: 'CEREALS', number: 8 },
    { coords: { q: 3, r: -1 }, resource: 'CLAY', number: 2 },
    { coords: { q: 3, r: 0 }, resource: 'WOOL', number: 9 },
    { coords: { q: 2, r: 1 }, resource: 'OAK', number: 10 },
    { coords: { q: 1, r: 2 }, resource: 'ORE', number: 8 },
    { coords: { q: 0, r: 3 }, resource: 'CEREALS', number: 3 },
    { coords: { q: -1, r: 3 }, resource: 'CLAY', number: 5 },
    { coords: { q: -2, r: 3 }, resource: 'WOOL', number: 6 },
    { coords: { q: -3, r: 3 }, resource: 'OAK', number: 11 },
    { coords: { q: -3, r: 2 }, resource: 'ORE', number: 4 },
    { coords: { q: -3, r: 1 }, resource: 'CEREALS', number: 8 },
    { coords: { q: -3, r: 0 }, resource: 'CLAY', number: 2 },
    { coords: { q: -2, r: -1 }, resource: 'WOOL', number: 9 },
    { coords: { q: -1, r: -2 }, resource: 'OAK', number: 10 },
  ],
  ports: [
    { coords: { q: 1, r: -3 }, edgeDirection: 5, type: '3:1' },
    { coords: { q: 3, r: -3 }, edgeDirection: 0, type: '3:1' },
    { coords: { q: 3, r: -1 }, edgeDirection: 0, type: '3:1' },
    { coords: { q: 3, r: 0 }, edgeDirection: 1, type: '3:1' },
    { coords: { q: 1, r: 2 }, edgeDirection: 1, type: '3:1' },
    { coords: { q: 0, r: 3 }, edgeDirection: 2, type: '3:1' },
    { coords: { q: -2, r: 3 }, edgeDirection: 2, type: '3:1' },
    { coords: { q: -3, r: 3 }, edgeDirection: 3, type: '3:1' },
    { coords: { q: -3, r: 1 }, edgeDirection: 3, type: '3:1' },
    { coords: { q: -3, r: 0 }, edgeDirection: 4, type: '3:1' },
    { coords: { q: -1, r: -2 }, edgeDirection: 4, type: '3:1' },
    { coords: { q: 0, r: -3 }, edgeDirection: 5, type: '3:1' },
  ]
};

/**
 * ConquestXL map: XL grid with the 4 topmost and 4 bottommost hexes removed
 * (creating a more horizontal diamond shape), and 3 central NUGGETS hexes
 * at (-1,0), (0,0), (1,0) — used by the MapGenerator in conquest+xl mode.
 *
 * Coordinate layout (pointy-top, axial):
 *   Ring-3 hexes removed from TOP:    (0,-3),(1,-3),(2,-3),(3,-3)
 *   Ring-3 hexes removed from BOTTOM: (0,3),(-1,3),(-2,3),(-3,3)
 *   NUGGETS (fixed):                  (-1,0),(0,0),(1,0)
 */
export const ConquestXLMap: MapTemplate = {
  name: "Conquest XL",
  hexes: [
    // ── Center ──
    { coords: { q: 0, r: 0 }, resource: 'NUGGETS', number: null },

    // ── Ring 1 ──
    { coords: { q: 1, r: -1 }, resource: 'OAK', number: 11 },
    { coords: { q: 1, r: 0 }, resource: 'NUGGETS', number: null }, // NUGGETS right
    { coords: { q: 0, r: 1 }, resource: 'CEREALS', number: 9 },
    { coords: { q: -1, r: 1 }, resource: 'CLAY', number: 4 },
    { coords: { q: -1, r: 0 }, resource: 'NUGGETS', number: null }, // NUGGETS left
    { coords: { q: 0, r: -1 }, resource: 'OAK', number: 5 },

    // ── Ring 2 ──
    { coords: { q: 0, r: -2 }, resource: 'WOOL', number: 10 },
    { coords: { q: 1, r: -2 }, resource: 'CEREALS', number: 3 },
    { coords: { q: 2, r: -2 }, resource: 'OAK', number: 11 },
    { coords: { q: 2, r: -1 }, resource: 'ORE', number: 4 },
    { coords: { q: 2, r: 0 }, resource: 'CEREALS', number: 8 },
    { coords: { q: 1, r: 1 }, resource: 'CLAY', number: 2 },
    { coords: { q: 0, r: 2 }, resource: 'WOOL', number: 9 },
    { coords: { q: -1, r: 2 }, resource: 'OAK', number: 10 },
    { coords: { q: -2, r: 2 }, resource: 'ORE', number: 8 },
    { coords: { q: -2, r: 1 }, resource: 'CEREALS', number: 3 },
    { coords: { q: -2, r: 0 }, resource: 'CLAY', number: 5 },
    { coords: { q: -1, r: -1 }, resource: 'WOOL', number: 6 },

    // ── Ring 3 (partial — top-4 and bottom-4 removed) ──
    // removed: (0,-3),(1,-3),(2,-3),(3,-3)  ← was top row
    { coords: { q: 3, r: -2 }, resource: 'CEREALS', number: 8 },
    { coords: { q: 3, r: -1 }, resource: 'CLAY', number: 2 },
    { coords: { q: 3, r: 0 }, resource: 'WOOL', number: 9 },
    { coords: { q: 2, r: 1 }, resource: 'OAK', number: 10 },
    { coords: { q: 1, r: 2 }, resource: 'ORE', number: 8 },
    // removed: (0,3),(-1,3),(-2,3),(-3,3) ← was bottom row
    { coords: { q: -3, r: 2 }, resource: 'ORE', number: 4 },
    { coords: { q: -3, r: 1 }, resource: 'CEREALS', number: 8 },
    { coords: { q: -3, r: 0 }, resource: 'CLAY', number: 2 },
    { coords: { q: -2, r: -1 }, resource: 'WOOL', number: 9 },
    { coords: { q: -1, r: -2 }, resource: 'OAK', number: 10 },
  ],
  ports: [
    // ── Top boundary (new edge after top-4 removal) ──
    { coords: { q: 2, r: -2 }, edgeDirection: 5, type: '3:1' },  // top-right area
    { coords: { q: 0, r: -2 }, edgeDirection: 5, type: '3:1' },  // top-left area
    // ── Right boundary ──
    { coords: { q: 3, r: -2 }, edgeDirection: 0, type: '3:1' },
    { coords: { q: 3, r: 0 }, edgeDirection: 1, type: '3:1' },
    // ── Bottom-right boundary ──
    { coords: { q: 1, r: 2 }, edgeDirection: 1, type: '3:1' },
    // ── Bottom boundary (new edge after bottom-4 removal) ──
    { coords: { q: -1, r: 2 }, edgeDirection: 2, type: '3:1' },  // bottom-right area
    { coords: { q: -2, r: 2 }, edgeDirection: 2, type: '3:1' },  // bottom-left area (ring 2)
    // ── Left boundary ──
    { coords: { q: -3, r: 2 }, edgeDirection: 3, type: '3:1' },
    { coords: { q: -3, r: 0 }, edgeDirection: 4, type: '3:1' },
    // ── Top-left boundary ──
    { coords: { q: -1, r: -2 }, edgeDirection: 4, type: '3:1' },
  ]
};
