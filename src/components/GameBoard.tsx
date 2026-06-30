import React, { useMemo } from 'react';
import { HexMath } from '../game/HexMath';
import { type MapTemplate } from '../game/mapTemplates';
import { type GameState } from '../game/GameState';
import { PLAYER_COLORS } from '../game/Player';
import { SettlementAsset, RoadAsset, CityAsset } from './Assets';

interface GameBoardProps {
  template: MapTemplate;
  gameState?: GameState;
  buildMode?: 'NONE' | 'SETTLEMENT' | 'ROAD' | 'CITY';
  /** Pre-computed set of valid edge IDs for road placement highlighting */
  validRoadEdges?: Set<string>;
  /** Pre-computed set of valid node IDs for settlement placement highlighting */
  validSettlementNodes?: Set<string>;
  validCityNodes?: Set<string>;
  pendingBuild?: { type: 'SETTLEMENT' | 'ROAD' | 'CITY', id: string, costText: string } | null;
  currentPlayerColor?: string;
  onConfirmBuild?: () => void;
  onCancelBuild?: () => void;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onHexClick?: (q: number, r: number) => void;
}

// Default fallback colors if no custom assets are provided
const RESOURCE_COLORS: Record<string, string> = {
  WOOD: '#065f46',
  CLAY: '#b43807',
  WHEAT: '#e9c46a',
  WOOL: '#84cc16',
  ORE: '#475569',
  GOLD: '#f59e0b',
  DESERT: '#e0afa0'
};

export const GameBoard: React.FC<GameBoardProps> = ({
  template,
  gameState,
  buildMode = 'NONE',
  validRoadEdges,
  validSettlementNodes,
  validCityNodes,
  pendingBuild,
  currentPlayerColor = 'white',
  onConfirmBuild,
  onCancelBuild,
  onNodeClick,
  onEdgeClick,
  onHexClick
}) => {
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

          const isCurrentNinjaHex = gameState?.ninjaHexCoords && hex.coords.q === gameState.ninjaHexCoords.q && hex.coords.r === gameState.ninjaHexCoords.r;
          const isHexClickable = gameState?.gamePhase === 'NINJA_MOVE' && !isCurrentNinjaHex;

          return (
            <g key={`hex-${i}`} onClick={() => isHexClickable && onHexClick?.(hex.coords.q, hex.coords.r)} style={{ cursor: isHexClickable ? 'pointer' : 'default' }}>
              <polygon
                points={pointsString}
                fill={RESOURCE_COLORS[hex.resource]}
                stroke={isHexClickable ? '#fbbf24' : '#0f172a'}
                strokeWidth={isHexClickable ? '4' : '2'}
                className={isHexClickable ? 'animate-pulse' : ''}
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

              {/* Draw Ninja Token */}
              {isCurrentNinjaHex && (
                <g transform={`translate(${center.x}, ${center.y + 15})`}>
                  <circle cx="0" cy="0" r="14" fill="#000" stroke="#fff" strokeWidth="1" />
                  <text x="0" y="0" textAnchor="middle" dy=".35em" fontSize="14" fontWeight="bold" fill="#fff">🥷</text>
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
            switch (type) {
              case 'WOOD': return '#065f46';
              case 'CLAY': return '#b43807';
              case 'WOOL': return '#84cc16';
              case 'WHEAT': return '#f59e0b';
              case 'ORE': return '#475569';
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
          // Only highlight if this specific edge is in the pre-validated set
          const isValidPlacement = buildMode === 'ROAD' && !road && (validRoadEdges?.has(edge.id) ?? false);
          const isClickable = isValidPlacement;
          const isPendingEdge = pendingBuild?.type === 'ROAD' && pendingBuild.id === edge.id;

          return (
            <g key={`edge-${edge.id}`} onClick={() => isClickable && onEdgeClick?.(edge.id)} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
              {/* Invisible wide hit-area */}
              <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="transparent" strokeWidth="20" />
              {road ? (
                <RoadAsset x={edge.x1} y={edge.y1} x2={edge.x2} y2={edge.y2} playerColor={PLAYER_COLORS[gameState!.players.find(p => p.peerId === road.ownerId)?.color as keyof typeof PLAYER_COLORS]?.hex || 'white'} />
              ) : isPendingEdge ? (
                <g>
                  <RoadAsset x={edge.x1} y={edge.y1} x2={edge.x2} y2={edge.y2} playerColor={currentPlayerColor} />
                  <foreignObject x={((edge.x1 + edge.x2) / 2) - 60} y={((edge.y1 + edge.y2) / 2) - 70} width="120" height="90" style={{ pointerEvents: 'none' }}>
                    <div className="bg-slate-900/90 backdrop-blur-md p-2 rounded-lg border border-indigo-500 shadow-xl flex flex-col items-center pointer-events-auto" style={{ pointerEvents: 'auto' }}>
                      <span className="text-[10px] text-slate-300 font-bold mb-1 text-center leading-tight">Cost: {pendingBuild.costText}</span>
                      <div className="flex gap-1 w-full relative z-[100]">
                        <button onClick={(e) => { e.stopPropagation(); onConfirmBuild?.(); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] py-1 rounded font-bold cursor-pointer transition-colors shadow">✓</button>
                        <button onClick={(e) => { e.stopPropagation(); onCancelBuild?.(); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-[10px] py-1 rounded font-bold cursor-pointer transition-colors shadow">✗</button>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              ) : (
                isValidPlacement && <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="white" strokeWidth="6" opacity="0.4" strokeDasharray="4 4" />
              )}
            </g>
          );
        })}

        {/* RENDER NODES (SETTLEMENTS/CITIES) */}
        {uniqueNodes.map(node => {
          const settlement = gameState?.settlements[node.id];
          // Only highlight if this specific node is in the pre-validated set
          const isValidPlacement = buildMode === 'SETTLEMENT' && !settlement && (validSettlementNodes?.has(node.id) ?? false);
          const isValidCityUpgrade = buildMode === 'CITY' && settlement && !settlement.isCity && (validCityNodes?.has(node.id) ?? false);
          const isClickable = isValidPlacement || isValidCityUpgrade;
          const isPendingNode = pendingBuild?.id === node.id;

          let nodeAsset = null;
          if (settlement) {
            const color = PLAYER_COLORS[gameState!.players.find(p => p.peerId === settlement.ownerId)?.color as keyof typeof PLAYER_COLORS]?.hex || 'white';
            if (settlement.isCity) {
              nodeAsset = <CityAsset x={node.x} y={node.y} playerColor={color} />;
            } else if (isPendingNode && pendingBuild.type === 'CITY') {
              nodeAsset = <CityAsset x={node.x} y={node.y} playerColor={color} />;
            } else {
              nodeAsset = <SettlementAsset x={node.x} y={node.y} playerColor={color} />;
              if (isValidCityUpgrade) {
                nodeAsset = (
                  <g>
                    {nodeAsset}
                    <g transform={`translate(${node.x}, ${node.y - 25})`} className="animate-bounce">
                      <circle cx="0" cy="0" r="10" fill="#2563eb" stroke="white" strokeWidth="2" />
                      <path d="M-4,2 L0,-4 L4,2" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  </g>
                );
              }
            }
          } else if (isPendingNode && pendingBuild.type === 'SETTLEMENT') {
            nodeAsset = <SettlementAsset x={node.x} y={node.y} playerColor={currentPlayerColor} />;
          }

          return (
            <g key={`node-${node.id}`} onClick={() => isClickable && onNodeClick?.(node.id)} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
              <circle cx={node.x} cy={node.y} r="15" fill="transparent" />
              {nodeAsset ? nodeAsset : (
                isValidPlacement && <circle cx={node.x} cy={node.y} r="8" fill="white" opacity="0.6" />
              )}
              {isPendingNode && (
                <foreignObject x={node.x - 60} y={node.y - 80} width="120" height="90" style={{ pointerEvents: 'none' }}>
                  <div className="bg-slate-900/90 backdrop-blur-md p-2 rounded-lg border border-indigo-500 shadow-xl flex flex-col items-center pointer-events-auto" style={{ pointerEvents: 'auto' }}>
                    <span className="text-[10px] text-slate-300 font-bold mb-1 text-center leading-tight">Cost: {pendingBuild.costText}</span>
                    <div className="flex gap-1 w-full relative z-[100]">
                      <button onClick={(e) => { e.stopPropagation(); onConfirmBuild?.(); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] py-1 rounded font-bold cursor-pointer transition-colors shadow">✓</button>
                      <button onClick={(e) => { e.stopPropagation(); onCancelBuild?.(); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-[10px] py-1 rounded font-bold cursor-pointer transition-colors shadow">✗</button>
                    </div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

      </svg>
    </div>
  );
};
