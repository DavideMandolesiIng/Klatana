import React from 'react';
import settlementIcon from '../assets/icons/builds/settlement_icon.png';
import cityIcon from '../assets/icons/builds/city_icon.png';
import roadIcon from '../assets/icons/builds/road_icon.png';

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
    const filterId = `url(#tint-${playerColor.replace('#', '')})`;
    const WIDTH = 44;
    const HEIGHT = 44;
    return (
      <image
        href={settlementIcon}
        x={x - WIDTH / 2}
        y={y - HEIGHT / 2}
        width={WIDTH}
        height={HEIGHT}
        filter={filterId}
      />
    );
  }
  // Add more custom skins here later
  return null;
};

export const RoadAsset: React.FC<RoadAssetProps> = ({ x, y, x2, y2, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    const filterId = `url(#tint-${playerColor.replace('#', '')})`;
    const midX = (x + x2) / 2;
    const midY = (y + y2) / 2;
    const angle = Math.atan2(y2 - y, x2 - x) * (180 / Math.PI) - 90;
    const edgeLength = Math.hypot(x2 - x, y2 - y);
    const WIDTH = 22;
    const HEIGHT = edgeLength;
    return (
      <image
        href={roadIcon}
        x={midX - WIDTH / 2}
        y={midY - HEIGHT / 2}
        width={WIDTH}
        height={HEIGHT}
        filter={filterId}
        transform={`rotate(${angle} ${midX} ${midY})`}
        preserveAspectRatio="none"
      />
    );
  }
  // Add more custom skins here later
  return null;
};

export const CityAsset: React.FC<AssetProps> = ({ x, y, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    const filterId = `url(#tint-${playerColor.replace('#', '')})`;
    const WIDTH = 52;
    const HEIGHT = 52;
    return (
      <image
        href={cityIcon}
        x={x - WIDTH / 2}
        y={y - HEIGHT / 2}
        width={WIDTH}
        height={HEIGHT}
        filter={filterId}
      />
    );
  }
  return null;
};

