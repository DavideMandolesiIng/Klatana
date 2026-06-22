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

  static readonly directions: Axial[] = [
    { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
    { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }
  ];

  static isAdjacent(a: Axial, b: Axial): boolean {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    // Axial math to Cube math for distance measurement
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
    return Math.max(dq, dr, ds) === 1;
  }

  static getEdgeId(a: Axial, b: Axial): string {
    const s1 = `${a.q},${a.r}`;
    const s2 = `${b.q},${b.r}`;
    return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
  }

  static getNodeId(a: Axial, b: Axial, c: Axial): string {
    const arr = [`${a.q},${a.r}`, `${b.q},${b.r}`, `${c.q},${c.r}`].sort();
    return arr.join('|');
  }

  static getHexNodeIds(axial: Axial): string[] {
    const ids = [];
    for (let i = 0; i < 6; i++) {
        const n2 = { q: axial.q + this.directions[i].q, r: axial.r + this.directions[i].r };
        const nextDir = (i + 1) % 6;
        const n3 = { q: axial.q + this.directions[nextDir].q, r: axial.r + this.directions[nextDir].r };
        ids.push(this.getNodeId(axial, n2, n3));
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

  // Returns { id, x1, y1, x2, y2 } for all 6 edges of a hex
  static hexEdges(axial: Axial, size: number): { id: string, x1: number, y1: number, x2: number, y2: number }[] {
    const center = this.hexToPixel(axial, size);
    const corners = this.hexCorners(center, size);
    const edges = [];
    for (let i = 0; i < 6; i++) {
        const p1 = corners[i];
        const p2 = corners[(i + 1) % 6];
        const n2 = { q: axial.q + this.directions[i].q, r: axial.r + this.directions[i].r };
        edges.push({
            id: this.getEdgeId(axial, n2),
            x1: p1.x, y1: p1.y,
            x2: p2.x, y2: p2.y
        });
    }
    return edges;
  }
}
