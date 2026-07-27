import React from 'react';
import houseIcon from '/assets/icons/builds/house_icon.webp?url';
import fortressIcon from '/assets/icons/builds/fortress_icon.webp?url';
import streetIcon from '/assets/icons/builds/street_icon.webp?url';

export interface AssetProps {
  x: number;
  y: number;
  playerColor: string;
  skinId?: string; // For future modding
}

export interface StreetAssetProps extends AssetProps {
  x2: number;
  y2: number;
  angle?: number;
}

export const HouseAsset: React.FC<AssetProps> = ({ x, y, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    const filterId = `url(#tint-${playerColor.replace('#', '')})`;
    const WIDTH = 44;
    const HEIGHT = 44;
    return (
      <image
        href={houseIcon}
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

export const StreetAsset: React.FC<StreetAssetProps> = ({ x, y, x2, y2, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    const filterId = `url(#tint-${playerColor.replace('#', '')})`;
    const midX = (x + x2) / 2;
    const midY = (y + y2) / 2;
    const angle = Math.atan2(y2 - y, x2 - x) * (180 / Math.PI) - 90;
    const edgeLength = Math.hypot(x2 - x, y2 - y) + 10; //constant 10 added to make streets overlap over each other 
    const WIDTH = 22;
    const HEIGHT = edgeLength;
    return (
      <image
        href={streetIcon}
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

export const FortressAsset: React.FC<AssetProps> = ({ x, y, playerColor, skinId = 'classic' }) => {
  if (skinId === 'classic') {
    const filterId = `url(#tint-${playerColor.replace('#', '')})`;
    const WIDTH = 52;
    const HEIGHT = 52;
    return (
      <image
        href={fortressIcon}
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

