import React from 'react';
import { HexMath } from '../game/HexMath';
import { type MapTemplate } from '../game/mapTemplates';

interface GameBoardProps {
  template: MapTemplate;
}

// Default fallback colors if no custom assets are provided
const RESOURCE_COLORS: Record<string, string> = {
  WOOD: '#2d6a4f',
  CLAY: '#b7410e',
  WHEAT: '#e9c46a',
  WOOL: '#8d99ae',
  ORE: '#4a4e69',
  GOLD: '#ffb703',
  DESERT: '#e0afa0'
};

export const GameBoard: React.FC<GameBoardProps> = ({ template }) => {
  const hexSize = 55;
  
  return (
    <div className="w-full h-full flex items-center justify-center bg-blue-900/10 rounded-xl overflow-hidden border border-slate-700">
      <svg width="100%" height="100%" viewBox={`-400 -300 800 600`} className="max-w-4xl">
        {/* Draw all hexes */}
        {template.hexes.map((hex, i) => {
          const center = HexMath.hexToPixel(hex.coords, hexSize);
          const corners = HexMath.hexCorners(center, hexSize);
          const pointsString = corners.map(p => `${p.x},${p.y}`).join(' ');
          
          return (
            <g key={`hex-${i}`} className="cursor-pointer hover:opacity-80 transition-opacity">
              
              {/* 
                * FUTURE PROOFING FOR CUSTOM ASSETS *
                To use images instead of a solid color polygon, you could do:
                <image href={`/assets/hexes/${hex.resource}.png`} x={center.x - hexSize} y={center.y - hexSize} width={hexSize*2} height={hexSize*2} />
              */}
              <polygon 
                points={pointsString} 
                fill={RESOURCE_COLORS[hex.resource]} 
                stroke="#0f172a" 
                strokeWidth="2"
              />
              
              {/* Draw the Number Token if it's not a desert */}
              {hex.number && (
                <g>
                  <circle cx={center.x} cy={center.y} r="16" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
                  <text 
                    x={center.x} 
                    y={center.y} 
                    textAnchor="middle" 
                    dy=".35em"
                    fontSize="16"
                    fontWeight="bold"
                    fill={(hex.number === 6 || hex.number === 8) ? '#dc2626' : '#0f172a'}
                  >
                    {hex.number}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* RENDER PORTS */}
        {template.ports?.map((port, i) => {
           const center = HexMath.hexToPixel(port.coords, hexSize);
           const corners = HexMath.hexCorners(center, hexSize);
           
           // Edge points
           const p1 = corners[port.edgeDirection];
           const p2 = corners[(port.edgeDirection + 1) % 6];
           
           // Midpoint of the edge
           const midX = (p1.x + p2.x) / 2;
           const midY = (p1.y + p2.y) / 2;

           // Calculate outward vector from hex center to midpoint
           const dx = midX - center.x;
           const dy = midY - center.y;
           
           // Port visualization coordinate (slightly outside the hex edge)
           const portX = midX + dx * 0.25;
           const portY = midY + dy * 0.25;

           // Port colors
           const getPortColor = (type: string) => {
             switch(type) {
                case 'WOOD': return '#14532d'; // Dark forest green
                case 'CLAY': return '#7c2d12'; // Dark terracotta
                case 'WOOL': return '#86efac'; // Light pastel green
                case 'WHEAT': return '#fef08a'; // Bright yellow
                case 'ORE': return '#94a3b8';  // Slate grey
                default: return '#f8fafc';    // White for 3:1
             }
           };

           return (
              <g key={`port-${i}`} transform={`translate(${portX}, ${portY})`}>
                 {/* Outer dock rectangle / circle */}
                 <circle cx="0" cy="0" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                 <circle cx="0" cy="0" r="12" fill={getPortColor(port.type)} />
                 
                 {/* Add label */}
                 <text 
                   x="0" 
                   y="4" 
                   textAnchor="middle" 
                   fontSize={port.type === '3:1' ? '8px' : '5px'} 
                   fontWeight="bold" 
                   fill={['WOOD', 'CLAY'].includes(port.type) ? 'white' : '#0f172a'}
                 >
                    {port.type}
                 </text>
                 <text 
                   x="0" 
                   y="-6" 
                   textAnchor="middle" 
                   fontSize="4px" 
                   fontWeight="bold" 
                   fill="white"
                   style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}
                 >
                    {port.type === '3:1' ? '' : '2:1'}
                 </text>
              </g>
           );
        })}
      </svg>
    </div>
  );
};
