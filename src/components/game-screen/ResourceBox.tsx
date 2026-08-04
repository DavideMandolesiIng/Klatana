import React from 'react';
import { type PlayerState } from '../../game/GameState';
import { type MapTemplate } from '../../game/mapTemplates';
import { RESOURCE_TEXTURES, RESOURCE_ICONS, RESOURCE_GRADIENTS } from '../GameScreen';
import { useSounds } from '../../context/SoundContext';

interface ResourceBoxProps {
    myPlayer: PlayerState | undefined;
    map: MapTemplate;
    handleResourceClick: (res: string) => void;
}

export const ResourceBox: React.FC<ResourceBoxProps> = ({
    myPlayer,
    map,
    handleResourceClick
}) => {
    const { playClick } = useSounds();

    if (!myPlayer) return null;

    return (
        <div className="flex-1 md:flex-none bg-[#f4e6cd] p-1 md:p-3 rounded-lg md:rounded-xl border-2 border-[#d3be9a] shadow-lg flex flex-col shrink-0">
            <h3 className="hidden md:block font-black text-[#7d6549] uppercase text-xs tracking-wider mb-2">My Resources</h3>
            <div className="flex flex-row md:grid md:grid-cols-3 gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible mb-0 md:mb-2 items-center">
                {Object.entries(myPlayer.resources)
                    .filter(([res]) => res !== 'NUGGETS' || map.hexes.some(h => h.resource === 'NUGGETS'))
                    .map(([res, count]) => {
                        const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                        let textClass = "text-white drop-shadow-sm";
                        let numBgClass = "bg-black/40";
                        let numTextClass = "text-white";

                        // Make text darker on bright resources for legibility
                        if (res === 'CEREALS' || res === 'NUGGETS' || res === 'WOOL') {
                            textClass = "text-[#2a1c0d] drop-shadow-none";
                            numBgClass = "bg-[#2a1c0d]/20";
                            numTextClass = "text-[#2a1c0d]";
                        }

                        return (
                            <div
                                key={res}
                                onClick={() => { playClick(); handleResourceClick(res); }}
                                className="relative flex flex-row md:flex-col items-center justify-between gap-1 md:gap-0 p-1 md:p-1.5 rounded border border-black/30 shadow-md overflow-hidden min-h-[24px] md:min-h-[70px] transition-transform hover:scale-105 cursor-pointer shrink-0"
                                style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}
                            >
                                {RESOURCE_TEXTURES[res] && (
                                    <div
                                        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay"
                                        style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                    />
                                )}
                                <div className="relative z-10 flex flex-row md:flex-col items-center gap-1 md:gap-0.5">
                                    <img src={RESOURCE_ICONS[res]} alt={res} className="w-4 h-4 md:w-6 md:h-6 drop-shadow-md filter-none" />
                                    <span className={`hidden md:block text-[8px] font-bold uppercase tracking-wider ${textClass} text-center leading-tight truncate w-full`}>
                                        {res}
                                    </span>
                                </div>
                                <div className={`relative z-10 font-black ${numTextClass} ${numBgClass} px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[10px] md:text-xs mt-0 md:mt-1 w-auto md:w-full text-center shadow-inner`}>
                                    {count}
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};
