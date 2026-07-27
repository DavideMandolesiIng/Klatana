import React, { useMemo } from 'react';
import { HexMath } from '../game/HexMath';
import { type MapTemplate } from '../game/mapTemplates';
import { type GameState } from '../game/GameState';
import { PLAYER_COLORS } from '../game/Player';
import { HouseAsset, StreetAsset, FortressAsset } from './Assets';

import desertTexture from '/assets/textures/desert-texture.webp?url';
import wavesBackground from '/assets/textures/waves-background.webp?url';

import lighthouseIcon from '/assets/icons/lighthouse_icon.webp?url';

import oreTexture from '/assets/textures/ore-texture.webp?url';
import clayTexture from '/assets/textures/clay-texture.webp?url';
import woodTexture from '/assets/textures/wood-texture-1.webp?url';
import woolTexture from '/assets/textures/wool-texture.webp?url';
import wheatTexture from '/assets/textures/wheat-texture-1.webp?url';

import oakIcon from '/assets/icons/resources/oak_icon.webp?url';
import clayIcon from '/assets/icons/resources/clay_icon.webp?url';
import oreIcon from '/assets/icons/resources/ore_icon.webp?url';
import woolIcon from '/assets/icons/resources/wool_icon.webp?url';
import cerealIcon from '/assets/icons/resources/cereal_icon.webp?url';
import nuggetsIcon from '/assets/icons/resources/nuggets_icon.webp?url';
import ninjaIcon from '/assets/icons/ninja_icon.webp?url';

interface GameBoardProps {
  template: MapTemplate;
  gameState?: GameState;
  buildMode?: 'NONE' | 'HOUSE' | 'street' | 'FORTRESS';
  /** Pre-computed set of valid edge IDs for street placement highlighting */
  validStreetEdges?: Set<string>;
  /** Pre-computed set of valid node IDs for house placement highlighting */
  validHouseNodes?: Set<string>;
  validFortressNodes?: Set<string>;
  pendingBuild?: { type: 'HOUSE' | 'street' | 'FORTRESS' | 'ACTION_CARD', id: string, costText: string } | null;
  currentPlayerColor?: string;
  onConfirmBuild?: () => void;
  onCancelBuild?: () => void;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onHexClick?: (q: number, r: number) => void;
  isMyTurn?: boolean;
}

// Default fallback colors if no custom assets are provided
const RESOURCE_COLORS: Record<string, string> = {
  OAK: '#065f46',
  CLAY: '#b43807',
  CEREALS: '#e9c46a',
  WOOL: '#84cc16',
  ORE: '#475569',
  NUGGETS: '#f59e0b',
  DESERT: '#e0afa0'
};

const RESOURCE_GRADIENTS: Record<string, { center: string, edge: string }> = {
  OAK: { center: '#0a805f', edge: '#033b2b' },
  CLAY: { center: '#d14a11', edge: '#7d2604' },
  CEREALS: { center: '#f2d488', edge: '#c29f46' },
  WOOL: { center: '#9ae823', edge: '#5c910d' },
  ORE: { center: '#5f7087', edge: '#293442' },
  NUGGETS: { center: '#fad05c', edge: '#ad6900' }
};

const RESOURCE_ICONS: Record<string, string> = {
  OAK: oakIcon,
  CLAY: clayIcon,
  ORE: oreIcon,
  WOOL: woolIcon,
  CEREALS: cerealIcon,
  NUGGETS: nuggetsIcon
};

const RESOURCE_TEXTURES: Record<string, { src: string, opacity: number }> = {
  OAK: { src: woodTexture, opacity: 0.5 },
  CLAY: { src: clayTexture, opacity: 0.5 },
  CEREALS: { src: wheatTexture, opacity: 0.5 },
  WOOL: { src: woolTexture, opacity: 0.5 },
  ORE: { src: oreTexture, opacity: 0.5 },
};


const PORT_OUTWARD_OFFSET = 25;
const PORT_IMAGE_WIDTH = 50;
const PORT_IMAGE_HEIGHT = 50;

export const GameBoard: React.FC<GameBoardProps> = ({
  template,
  gameState,
  buildMode = 'NONE',
  validStreetEdges,
  validHouseNodes,
  validFortressNodes,
  pendingBuild,
  currentPlayerColor = 'white',
  isMyTurn = false,
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
    <div
      className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden border border-slate-700 bg-cover bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.15)), url(${wavesBackground})` }}
    >
      <svg width="100%" height="100%" viewBox={`-400 -300 800 600`} className="max-w-4xl">
        <defs>
          <pattern id="desert-pattern" patternContentUnits="objectBoundingBox" width="1" height="1">
            <image href={desertTexture} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
          </pattern>
          {Object.entries(RESOURCE_GRADIENTS).map(([res, colors]) => (
            <radialGradient key={`grad-${res}`} id={`grad-${res}`} cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor={colors.center} />
              <stop offset="100%" stopColor={colors.edge} />
            </radialGradient>
          ))}
          {Object.entries(RESOURCE_TEXTURES).map(([res, { src }]) => (
            <pattern key={`pattern-${res}`} id={`pattern-${res}`} patternContentUnits="objectBoundingBox" width="1" height="1">
              <image href={src} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ))}

          {/* Player Tint Filters (Multiply) */}
          {Object.values(PLAYER_COLORS).map(({ hex }) => (
            <filter key={`tint-${hex}`} id={`tint-${hex.replace('#', '')}`} colorInterpolationFilters="sRGB" x="-50%" y="-50%" width="200%" height="200%">
              <feFlood floodColor={hex} result="flood" />
              <feBlend mode="multiply" in="flood" in2="SourceGraphic" result="blend" />
              <feComposite in="blend" in2="SourceAlpha" operator="in" result="tinted" />

              {/* Solid white outline */}
              <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="expanded" />
              <feFlood floodColor="#fff" result="whiteColor" />
              <feComposite in="whiteColor" in2="expanded" operator="in" result="outline" />

              {/* Merge outline with the tinted base graphic */}
              <feMerge result="mergedObj">
                <feMergeNode in="outline" />
                <feMergeNode in="tinted" />
              </feMerge>

              {/* Drop shadow for depth */}
              <feDropShadow in="mergedObj" dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.9" />
            </filter>
          ))}

        </defs>
        {/* Draw Base Sand Platform (Full size hexes) */}
        <g id="sand-platform">
          {template.hexes.map((hex, i) => {
            const center = HexMath.hexToPixel(hex.coords, hexSize);
            // Draw a slightly larger base to ensure they stitch perfectly without rendering gaps, or just full size
            const corners = HexMath.hexCorners(center, hexSize);
            const pointsString = corners.map(p => `${p.x},${p.y}`).join(' ');
            return (
              <polygon
                key={`platform-${i}`}
                points={pointsString}
                fill="#e6c280"
                stroke="#cfa15f"
                strokeWidth="2"
              />
            );
          })}
        </g>

        {/* Draw all Resource Hexes (Scaled down) */}
        {template.hexes.map((hex, i) => {
          const center = HexMath.hexToPixel(hex.coords, hexSize);
          // Scale down the resource hex by 3 units to reveal the sand platform underneath and create gaps
          const visualHexSize = hexSize - 3;
          const corners = HexMath.hexCorners(center, visualHexSize);
          const pointsString = corners.map(p => `${p.x},${p.y}`).join(' ');

          const isCurrentNinjaHex = gameState?.ninjaHexCoords && hex.coords.q === gameState.ninjaHexCoords.q && hex.coords.r === gameState.ninjaHexCoords.r;
          const isRolled7 = gameState?.diceRoll?.total === 7;
          const isRolledThisHex = gameState?.diceRoll && gameState.diceRoll.total === hex.number;
          const isHexClickable = gameState?.gamePhase === 'NINJA_MOVE' && !isCurrentNinjaHex && isMyTurn;

          let highlightStroke = isHexClickable ? '#fbbf24' : '#0f172a';
          let highlightWidth = isHexClickable ? '4' : '2';
          let pulseClass = isHexClickable ? 'animate-pulse' : '';
          let hexStyle = {};

          if (isCurrentNinjaHex && isRolled7) {
            if (isMyTurn) {
              highlightStroke = '#ef4444';
              highlightWidth = '4';
              pulseClass = 'animate-pulse';
              hexStyle = { filter: 'drop-shadow(0px 0px 12px rgba(239, 68, 68, 0.8))' };
            } else {
              highlightStroke = '#ef4444';
              highlightWidth = '3';
              pulseClass = '';
              hexStyle = { filter: 'drop-shadow(0px 0px 4px rgba(239, 68, 68, 0.4))' };
            }
          } else if (isRolledThisHex) {
            highlightStroke = '#00ffff';
            highlightWidth = '6';
            pulseClass = 'animate-pulse';
            hexStyle = { filter: 'drop-shadow(0px 0px 16px rgba(0, 255, 255, 1))' };
          }

          return (
            <g key={`hex-${i}`} onClick={() => isHexClickable && onHexClick?.(hex.coords.q, hex.coords.r)} style={{ cursor: isHexClickable ? 'pointer' : 'default' }}>
              <polygon
                points={pointsString}
                fill={hex.resource === 'DESERT' ? 'url(#desert-pattern)' : (RESOURCE_GRADIENTS[hex.resource] ? `url(#grad-${hex.resource})` : RESOURCE_COLORS[hex.resource])}
                stroke={highlightStroke}
                strokeWidth={highlightWidth}
                className={pulseClass}
                style={hexStyle}
              />

              {/* Draw Texture Overlay (if not desert) */}
              {hex.resource !== 'DESERT' && RESOURCE_TEXTURES[hex.resource] && (
                <polygon
                  points={pointsString}
                  fill={`url(#pattern-${hex.resource})`}
                  opacity={RESOURCE_TEXTURES[hex.resource].opacity}
                  style={{ pointerEvents: 'none' }}
                />
              )}


              {/* Draw Resource Icon (if not desert) */}
              {hex.resource !== 'DESERT' && RESOURCE_ICONS[hex.resource] && (
                <image
                  href={RESOURCE_ICONS[hex.resource]}
                  x={center.x - 20}
                  y={center.y - 42}
                  width="40"
                  height="40"
                  opacity="1"
                  style={{ filter: 'drop-shadow(0px 0px 6px rgba(255, 255, 255, 1))' }}
                />
              )}

              {/* Draw the Number Token if it's not a desert */}
              {hex.number && (
                <g>
                  <circle cx={center.x} cy={center.y + 15} r="16" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
                  <text
                    x={center.x}
                    y={center.y + 15}
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
                  <image
                    href={ninjaIcon}
                    x="-20"
                    y="-20"
                    width="40"
                    height="40"
                    style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))' }}
                  />
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
          const outwardAngle = Math.atan2(dy, dx);

          // Port visualization coordinate (offset outward into the ocean)
          const portX = midX + Math.cos(outwardAngle) * PORT_OUTWARD_OFFSET;
          const portY = midY + Math.sin(outwardAngle) * PORT_OUTWARD_OFFSET;

          // Port UI
          return (
            <g key={`port-${i}`}>
              {/* Highlight Port Edge */}
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#451a03"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="8,16"
                style={{ filter: 'drop-shadow(0px 0px 4px rgba(212, 175, 55, 0.5))' }}
              />

              <g transform={`translate(${portX}, ${portY})`}>
                <g transform="translate(0, -7.5)">
                  {/* Lighthouse Image */}
                  <image
                    href={lighthouseIcon}
                    x={-(PORT_IMAGE_WIDTH / 2)}
                    y={-(PORT_IMAGE_HEIGHT / 2)}
                    width={PORT_IMAGE_WIDTH}
                    height={PORT_IMAGE_HEIGHT}
                    preserveAspectRatio="xMidYMid slice"
                    style={{ clipPath: 'circle(50%)' }}
                  />

                  {/* Wooden Sign Overlay */}
                  <g transform={`translate(0, ${PORT_IMAGE_HEIGHT / 2 + 5})`}>
                    <rect
                      x="-22"
                      y="-10"
                      width="44"
                      height="20"
                      rx="4"
                      fill="#78350f"
                      stroke="#451a03"
                      strokeWidth="2"
                      style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.5))' }}
                    />
                    {port.type === '3:1' ? (
                      <text x="0" y="4" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fef3c7" style={{ textShadow: '0px 1px 1px black' }}>
                        3:1
                      </text>
                    ) : (
                      <>
                        <text x="-6" y="4" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fef3c7" style={{ textShadow: '0px 1px 1px black' }}>
                          2:1
                        </text>
                        <image
                          href={RESOURCE_ICONS[port.type]}
                          x="4"
                          y="-7"
                          width="14"
                          height="14"
                          style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.8))' }}
                        />
                      </>
                    )}
                  </g>
                </g>
              </g>
            </g>
          );
        })}

        {/* RENDER EDGES (STREETS) */}
        {uniqueEdges.map(edge => {
          const street = gameState?.streets[edge.id];
          // Only highlight if this specific edge is in the pre-validated set
          const isValidPlacement = buildMode === 'street' && !pendingBuild && !street && (validStreetEdges?.has(edge.id) ?? false);
          const isClickable = isValidPlacement;
          const isPendingEdge = pendingBuild?.type === 'street' && pendingBuild.id === edge.id;

          return (
            <g key={`edge-${edge.id}`} onClick={() => isClickable && onEdgeClick?.(edge.id)} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
              {/* Invisible wide hit-area */}
              <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="transparent" strokeWidth="20" />
              {street ? (
                <StreetAsset x={edge.x1} y={edge.y1} x2={edge.x2} y2={edge.y2} playerColor={PLAYER_COLORS[gameState!.players.find(p => p.peerId === street.ownerId)?.color as keyof typeof PLAYER_COLORS]?.hex || 'white'} />
              ) : isPendingEdge ? (
                <StreetAsset x={edge.x1} y={edge.y1} x2={edge.x2} y2={edge.y2} playerColor={currentPlayerColor} />
              ) : (
                isValidPlacement && <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="#fbbf24" strokeWidth="10" opacity="0.9" strokeDasharray="8 6" className="animate-pulse" style={{ filter: 'drop-shadow(0px 0px 4px rgba(251, 191, 36, 0.8))' }} />
              )}
            </g>
          );
        })}

        {/* RENDER NODES (HOUSES/FORTRESSES) */}
        {uniqueNodes.map(node => {
          const house = gameState?.houses[node.id];
          // Only highlight if this specific node is in the pre-validated set
          const isValidPlacement = buildMode === 'HOUSE' && !pendingBuild && !house && (validHouseNodes?.has(node.id) ?? false);
          const isValidFortressUpgrade = buildMode === 'FORTRESS' && !pendingBuild && house && !house.isFortress && (validFortressNodes?.has(node.id) ?? false);
          const isClickable = isValidPlacement || isValidFortressUpgrade;
          const isPendingNode = pendingBuild?.id === node.id;

          let nodeAsset = null;
          if (house) {
            const color = PLAYER_COLORS[gameState!.players.find(p => p.peerId === house.ownerId)?.color as keyof typeof PLAYER_COLORS]?.hex || 'white';
            if (house.isFortress) {
              nodeAsset = <FortressAsset x={node.x} y={node.y} playerColor={color} />;
            } else if (isPendingNode && pendingBuild.type === 'FORTRESS') {
              nodeAsset = <FortressAsset x={node.x} y={node.y} playerColor={color} />;
            } else {
              nodeAsset = <HouseAsset x={node.x} y={node.y} playerColor={color} />;
              if (isValidFortressUpgrade) {
                nodeAsset = (
                  <g>
                    {nodeAsset}
                    <circle cx={node.x} cy={node.y} r="22" fill="none" stroke="#60a5fa" strokeWidth="3" className="animate-pulse" />
                  </g>
                );
              }
            }
          } else if (isPendingNode && pendingBuild.type === 'HOUSE') {
            nodeAsset = <HouseAsset x={node.x} y={node.y} playerColor={currentPlayerColor} />;
          }

          return (
            <g key={`node-${node.id}`} onClick={() => isClickable && onNodeClick?.(node.id)} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
              <circle cx={node.x} cy={node.y} r="15" fill="transparent" />
              {nodeAsset ? nodeAsset : (
                isValidPlacement && <circle cx={node.x} cy={node.y} r="8" fill="white" opacity="0.6" />
              )}
            </g>
          );
        })}

        {/* PENDING BUILD CONFIRMATION OVERLAY (Always drawn last for max z-index) */}
        {pendingBuild && (pendingBuild.type === 'street' || pendingBuild.type === 'HOUSE' || pendingBuild.type === 'FORTRESS') && (() => {
          let cx = 0, cy = 0;
          if (pendingBuild.type === 'street') {
            const edge = uniqueEdges.find(e => e.id === pendingBuild.id);
            if (!edge) return null;
            cx = (edge.x1 + edge.x2) / 2;
            cy = (edge.y1 + edge.y2) / 2;
          } else {
            const node = uniqueNodes.find(n => n.id === pendingBuild.id);
            if (!node) return null;
            cx = node.x;
            cy = node.y;
          }

          return (
            <foreignObject x={cx - 60} y={cy - (pendingBuild.type === 'street' ? 70 : 80)} width="120" height="90" style={{ pointerEvents: 'none' }}>
              <div className="bg-[#f4e6cd] backdrop-blur-md p-2 rounded-lg border-2 border-[#7d6549] shadow-xl flex flex-col items-center pointer-events-auto" style={{ pointerEvents: 'auto' }}>
                <span className="text-[10px] text-[#7d6549] font-bold mb-1 text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  Cost: {pendingBuild.costText}
                </span>
                <div className="flex gap-1 w-full relative z-[100]">
                  <button onClick={(e) => { e.stopPropagation(); onConfirmBuild?.(); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] py-1 rounded font-bold cursor-pointer transition-colors shadow">✓</button>
                  <button onClick={(e) => { e.stopPropagation(); onCancelBuild?.(); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-[10px] py-1 rounded font-bold cursor-pointer transition-colors shadow">✗</button>
                </div>
              </div>
            </foreignObject>
          );
        })()}

      </svg>
    </div>
  );
};
