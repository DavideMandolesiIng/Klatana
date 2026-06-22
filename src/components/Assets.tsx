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
