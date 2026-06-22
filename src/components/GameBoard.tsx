import React, { useMemo } from 'react';
import { HexMath } from '../game/HexMath';
import { type MapTemplate } from '../game/mapTemplates';
import { type GameState } from '../game/GameState';
import { PLAYER_COLORS } from '../game/Player';
import { SettlementAsset, RoadAsset } from './Assets';

interface GameBoardProps {
  template: MapTemplate;
  gameState?: GameState;
  buildMode?: 'NONE' | 'SETTLEMENT' | 'ROAD';
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
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

export const GameBoard: React.FC<GameBoardProps> = ({ template, gameState, buildMode = 'NONE', onNodeClick, onEdgeClick }) => {
  const hexSize = 55;
  
  const { uniqueNodes, uniqueEdges } = useMemo(() => {
    const nodes = new Map<string, { id: string, x: number, y: number }>();
    const edges = new Map<string, { id: string, x1: number, y1: number, x2: number, y2: number }>();
    template.hexes.forEach(hex => {
        HexMath.hexNodes(hex.coords, hexSize).forEach(n => nodes.set(n.id, n));
        HexMath.hexEdges(hex.coords, hexSize).forEach(e => edges.set(e.id, e));
    });
    return { uniqueNodes: Array.from(nodes.values()), uniqueEdges: Array.from(edges.values()) };
  }, [template]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-blue-900/10 rounded-xl overflow-hidden border border-slate-700">
      <svg width="100%" height="100%" viewBox={`-400 -300 800 600`} className="max-w-4xl">
        {/* Draw all hexes */}
        {template.hexes.map((hex, i) => {
          const center = HexMath.hexToPixel(hex.coords, hexSize);
          const corners = HexMath.hexCorners(center, hexSize);
          const pointsString = corners.map(p => `${p.x},${p.y}`).join(' ');
          
          return (
            <g key={`hex-${i}`}>
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
                case 'WOOD': return '#14532d';
                case 'CLAY': return '#7c2d12';
                case 'WOOL': return '#86efac';
                case 'WHEAT': return '#fef08a';
                case 'ORE': return '#94a3b8';
                default: return '#f8fafc';
             }
           };

           return (
              <g key={`port-${i}`} transform={`translate(${portX}, ${portY})`}>
                 <circle cx="0" cy="0" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                 <circle cx="0" cy="0" r="12" fill={getPortColor(port.type)} />
                 <text x="0" y="4" textAnchor="middle" fontSize={port.type === '3:1' ? '8px' : '5px'} fontWeight="bold" fill={['WOOD', 'CLAY'].includes(port.type) ? 'white' : '#0f172a'}>
                    {port.type}
                 </text>
                 <text x="0" y="-6" textAnchor="middle" fontSize="4px" fontWeight="bold" fill="white" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}>
                    {port.type === '3:1' ? '' : '2:1'}
                 </text>
              </g>
           );
        })}

        {/* RENDER EDGES (ROADS) */}
        {uniqueEdges.map(edge => {
            const road = gameState?.roads[edge.id];
            const isClickable = buildMode === 'ROAD' && !road;
            return (
                <g key={`edge-${edge.id}`} onClick={() => isClickable && onEdgeClick?.(edge.id)} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
                    <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="transparent" strokeWidth="20" />
                    {road ? (
                        <RoadAsset x={edge.x1} y={edge.y1} x2={edge.x2} y2={edge.y2} playerColor={PLAYER_COLORS[gameState!.players.find(p => p.peerId === road.ownerId)?.color as any]?.hex || 'white'} />
                    ) : (
                        isClickable && <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="white" strokeWidth="6" opacity="0.4" strokeDasharray="4 4" />
                    )}
                </g>
            );
        })}

        {/* RENDER NODES (SETTLEMENTS/CITIES) */}
        {uniqueNodes.map(node => {
            const settlement = gameState?.settlements[node.id];
            const isClickable = buildMode === 'SETTLEMENT' && !settlement;
            return (
                <g key={`node-${node.id}`} onClick={() => isClickable && onNodeClick?.(node.id)} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
                    <circle cx={node.x} cy={node.y} r="15" fill="transparent" />
                    {settlement ? (
                        <SettlementAsset x={node.x} y={node.y} playerColor={PLAYER_COLORS[gameState!.players.find(p => p.peerId === settlement.ownerId)?.color as any]?.hex || 'white'} />
                    ) : (
                        isClickable && <circle cx={node.x} cy={node.y} r="8" fill="white" opacity="0.6" />
                    )}
                </g>
            );
        })}

      </svg>
    </div>
  );
};
