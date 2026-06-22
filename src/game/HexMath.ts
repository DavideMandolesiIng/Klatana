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
}
