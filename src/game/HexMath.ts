export interface Axial {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

export class HexMath {
  static readonly SQRT_3 = Math.sqrt(3);

  // Convert axial (q, r) to pixel (x, y) for pointy-topped hexes
  static hexToPixel(axial: Axial, size: number): Point {
    const x = size * (this.SQRT_3 * axial.q + this.SQRT_3 / 2 * axial.r);
    const y = size * (3 / 2 * axial.r);
    return { x, y };
  }

  // Get the 6 corners of a hex (for drawing polygons)
  static hexCorners(center: Point, size: number): Point[] {
    const corners: Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle_deg = 60 * i - 30; // Pointy topped starts at -30 deg
      const angle_rad = Math.PI / 180 * angle_deg;
      corners.push({
        x: center.x + size * Math.cos(angle_rad),
        y: center.y + size * Math.sin(angle_rad)
      });
    }
    return corners;
  }

  // The 6 axial direction vectors for a pointy-top hex grid.
  // directions[i] is the neighbor that shares the edge between corner[i] and corner[(i+1)%6].
  static readonly directions: Axial[] = [
    { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
    { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }
  ];

  static isAdjacent(a: Axial, b: Axial): boolean {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
    return Math.max(dq, dr, ds) === 1;
  }

  // --- Canonical ID generators ---

  // Edge between two adjacent hexes: sorted for uniqueness regardless of call order.
  static getEdgeId(a: Axial, b: Axial): string {
    const s1 = `${a.q},${a.r}`;
    const s2 = `${b.q},${b.r}`;
    return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
  }

  // Node at the intersection of three hexes: sorted for uniqueness.
  static getNodeId(a: Axial, b: Axial, c: Axial): string {
    const arr = [`${a.q},${a.r}`, `${b.q},${b.r}`, `${c.q},${c.r}`].sort();
    return arr.join('|');
  }

  /**
   * Returns the 6 node IDs for a given hex (one per corner).
   *
   * CRITICAL: Corner i is shared by exactly 3 hexes:
   *   this hex, this hex + dir[i], this hex + dir[(i+1)%6]
   *
   * This is the source-of-truth for all node IDs in the game.
   * Any change to this formula WILL break settlement/road adjacency logic.
   */
  static getHexNodeIds(axial: Axial): string[] {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const nextDir = (i + 1) % 6; // <-- MUST be i+1, not i-1
      const nA = { q: axial.q + this.directions[i].q,       r: axial.r + this.directions[i].r };
      const nB = { q: axial.q + this.directions[nextDir].q, r: axial.r + this.directions[nextDir].r };
      ids.push(this.getNodeId(axial, nA, nB));
    }
    return ids;
  }

  // Returns { id, x, y } for all 6 nodes of a hex
  static hexNodes(axial: Axial, size: number): { id: string, x: number, y: number }[] {
    const center = this.hexToPixel(axial, size);
    const corners = this.hexCorners(center, size);
    const nodeIds = this.getHexNodeIds(axial);
    return nodeIds.map((id, i) => ({ id, x: corners[i].x, y: corners[i].y }));
  }

  // Returns { id, x1, y1, x2, y2 } for all 6 edges of a hex.
  // Edge i is the segment between corner[i] and corner[(i+1)%6].
  static hexEdges(axial: Axial, size: number): { id: string, x1: number, y1: number, x2: number, y2: number }[] {
    const center = this.hexToPixel(axial, size);
    const corners = this.hexCorners(center, size);
    const edges = [];
    for (let i = 0; i < 6; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + 1) % 6];
      // Edge i (corner i → corner i+1) is shared with neighbor at directions[(i+1)%6], NOT directions[i].
      // directions[i] would be the neighbor sharing the PREVIOUS edge (edge i-1), creating an off-by-one.
      const dirIdx = (i + 1) % 6;
      const neighbor = { q: axial.q + this.directions[dirIdx].q, r: axial.r + this.directions[dirIdx].r };
      edges.push({
        id: this.getEdgeId(axial, neighbor),
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y
      });
    }
    return edges;
  }

  // --- Topology Helpers ---

  /**
   * An edge is adjacent to a node iff both hex-strings in the edge ID appear
   * in the node's three-hex string.
   *
   * Why this works: getEdgeId(hexA, hexB) encodes the pair (hexA, hexB). A node
   * at the junction of hexA, hexB, and hexC has all three in its ID. So:
   *   - For the endpoint that contains hexA AND hexB → both present → TRUE  ✓
   *   - For the other endpoint (contains hexA and hexC but NOT hexB) → FALSE ✓
   *   - For any unrelated node → at most one of hexA/hexB matches → FALSE ✓
   *
   * This elegantly finds the correct endpoint without any coordinate math.
   */
  static isEdgeAdjacentToNode(edgeId: string, nodeId: string): boolean {
    const edgeHexes = edgeId.split('|');
    const nodeHexes = nodeId.split('|');
    return edgeHexes.every(h => nodeHexes.includes(h));
  }

  /**
   * Two nodes are adjacent (connected by exactly one edge) iff their hex triples
   * share exactly 2 hexes.
   */
  static areNodesAdjacent(nodeIdA: string, nodeIdB: string): boolean {
    const hexesA = nodeIdA.split('|');
    const hexesB = nodeIdB.split('|');
    const shared = hexesA.filter(h => hexesB.includes(h));
    return shared.length === 2;
  }

  /**
   * Two edges are adjacent (share a common vertex node) iff:
   *   1. The union of their hex pairs has exactly 3 distinct hexes (they share one hex).
   *   2. Those 3 hexes are all mutually adjacent — i.e., they form a valid node triple.
   *
   * Condition 2 is necessary to avoid false positives: without it, any two edges
   * of the same hex would pass condition 1 (they always share that hex), even if
   * they don't share a corner (e.g. opposite edges).
   */
  static areEdgesAdjacent(edgeIdA: string, edgeIdB: string): boolean {
    if (edgeIdA === edgeIdB) return false;
    const hexesA = edgeIdA.split('|');
    const hexesB = edgeIdB.split('|');
    const allHexStrings = Array.from(new Set([...hexesA, ...hexesB]));
    if (allHexStrings.length !== 3) return false;
    // Parse and verify all 3 hexes form a valid mutual-adjacency triangle
    const h = allHexStrings.map(s => {
      const [q, r] = s.split(',').map(Number);
      return { q, r };
    });
    return this.isAdjacent(h[0], h[1]) &&
           this.isAdjacent(h[1], h[2]) &&
           this.isAdjacent(h[0], h[2]);
  }

  /**
   * Returns the two Node IDs that are the endpoints of an edge.
   *
   * For edge = getEdgeId(hexA, hexA+dir[i]):
   *   endpoint1 = getNodeId(hexA, hexA+dir[i], hexA+dir[(i-1+6)%6])
   *   endpoint2 = getNodeId(hexA, hexA+dir[i], hexA+dir[(i+1)%6])
   *
   * Used in main-game road validation to find the shared node between two
   * edges (for the enemy-settlement blocking check).
   */
  static getEdgeNodeIds(edgeId: string): string[] {
    const parts = edgeId.split('|');
    const parseAxial = (s: string): Axial => {
      const [q, r] = s.split(',').map(Number);
      return { q, r };
    };
    const hexA = parseAxial(parts[0]);
    const hexB = parseAxial(parts[1]);

    // Find direction index from hexA to hexB
    let dirIdx = -1;
    for (let i = 0; i < 6; i++) {
      const d = this.directions[i];
      if (hexA.q + d.q === hexB.q && hexA.r + d.r === hexB.r) {
        dirIdx = i;
        break;
      }
    }
    if (dirIdx === -1) return []; // should never happen for a valid edge

    const prevDir = (dirIdx + 5) % 6;
    const nextDir = (dirIdx + 1) % 6;

    const thirdForNode1 = {
      q: hexA.q + this.directions[prevDir].q,
      r: hexA.r + this.directions[prevDir].r
    };
    const thirdForNode2 = {
      q: hexA.q + this.directions[nextDir].q,
      r: hexA.r + this.directions[nextDir].r
    };

    return [
      this.getNodeId(hexA, hexB, thirdForNode1),
      this.getNodeId(hexA, hexB, thirdForNode2)
    ];
  }
}
