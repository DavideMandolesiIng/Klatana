import React from 'react';

export interface AssetProps {
  x: number;
  y: number;
  playerColor: string;
  skinId?: string; // For future modding
}

export interface RoadAssetProps extends AssetProps {
  x2: number;
  y2: number;
  angle?: number;
}

export const SettlementAsset: React.FC<AssetProps> = ({ x, y, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    return (
      <rect x={x - 8} y={y - 8} width="16" height="16" rx="2" fill={playerColor} stroke="#000" strokeWidth="2" />
    );
  }
  // Add more custom skins here later
  return null;
};

export const RoadAsset: React.FC<RoadAssetProps> = ({ x, y, x2, y2, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    return (
      <line x1={x} y1={y} x2={x2} y2={y2} stroke={playerColor} strokeWidth="8" strokeLinecap="round" />
    );
  }
  // Add more custom skins here later
  return null;
};

export const CityAsset: React.FC<AssetProps> = ({ x, y, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="-10" y="-10" width="20" height="20" rx="3" fill={playerColor} stroke="#000" strokeWidth="2" />
        <path d="M -6 10 L -6 -6 L 0 -14 L 6 -6 L 6 10 Z" fill="#fff" opacity="0.3" />
      </g>
    );
  }
  return null;
};

