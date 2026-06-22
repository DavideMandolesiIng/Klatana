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
      </svg>
    </div>
  );
};
