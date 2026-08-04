import React, { useState } from 'react';
import { RESOURCE_ICONS } from '../GameScreen';
import { useSounds } from '../../context/SoundContext';

interface BuildCostsLegendProps {
    variant: 'mobile' | 'desktop';
}

export const BuildCostsLegend: React.FC<BuildCostsLegendProps> = ({ variant }) => {
    const [showBuildCosts, setShowBuildCosts] = useState(false);
    const { playClick } = useSounds();

    if (variant === 'mobile') {
        return (
            <div className="bg-[#f4e6cd] rounded-xl border-2 border-[#d3be9a] shadow overflow-hidden">
                <button
                    onClick={() => { playClick(); setShowBuildCosts(!showBuildCosts); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#ebd8b7] transition-colors"
                >
                    <span className="text-[#7d6549] text-[10px] font-black">{showBuildCosts ? '▲' : '▼'}</span>
                    <h3 className="font-black text-[#7d6549] uppercase text-[10px] tracking-wider">Build Costs</h3>
                </button>
                {showBuildCosts && (
                    <div className="flex flex-col gap-1.5 px-3 pb-3">
                        {([
                            { name: 'Street', costs: { OAK: 1, CLAY: 1 } },
                            { name: 'House', costs: { OAK: 1, CLAY: 1, CEREALS: 1, WOOL: 1 } },
                            { name: 'Fortress', costs: { ORE: 3, CEREALS: 2 } },
                            { name: 'Action Card', costs: { ORE: 1, CEREALS: 1, WOOL: 1 } },
                        ] as const).map(({ name, costs }) => (
                            <div key={name} className="flex items-center justify-between bg-[#ebd8b7] rounded-lg px-3 py-2 border border-[#d3be9a]">
                                <span className="text-[11px] font-black text-[#5c4936] uppercase">{name}</span>
                                <div className="flex gap-1">
                                    {(Object.entries(costs) as [string, number][]).flatMap(([res, qty]) =>
                                        Array.from({ length: qty }).map((_, idx) => (
                                            <img key={`${res}-${idx}`} src={RESOURCE_ICONS[res]} className="w-5 h-5 drop-shadow" alt={res} />
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 items-end pointer-events-auto">
            <button
                onClick={() => { playClick(); setShowBuildCosts(!showBuildCosts); }}
                className="bg-[#f4e6cd]/90 hover:bg-[#fff9ea] text-[#7d6549] border-2 border-[#d3be9a] px-2 py-1 md:px-3 md:py-1.5 rounded md:rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md transition-colors flex items-center gap-1 md:gap-2"
            >
                <span>Build Costs</span>
                <span>{showBuildCosts ? '▼' : '▲'}</span>
            </button>
            {showBuildCosts && (
                <div className="flex flex-col gap-1 bg-[#f4e6cd]/95 backdrop-blur-md p-1.5 md:p-2.5 rounded md:rounded-lg border-2 border-[#d3be9a] shadow-xl text-[8px] md:text-[9px] uppercase font-black tracking-wider mb-1">
                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                        <span>street</span>
                        <div className="flex gap-1 drop-shadow-sm">
                            <img src={RESOURCE_ICONS.OAK} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="OAK" />
                            <img src={RESOURCE_ICONS.CLAY} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="CLAY" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                        <span>House</span>
                        <div className="flex gap-1 drop-shadow-sm">
                            <img src={RESOURCE_ICONS.OAK} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="OAK" />
                            <img src={RESOURCE_ICONS.CLAY} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="CLAY" />
                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="CEREALS" />
                            <img src={RESOURCE_ICONS.WOOL} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="WOOL" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                        <span>Fortress</span>
                        <div className="flex gap-1 drop-shadow-sm">
                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="ORE" />
                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="ORE" />
                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="ORE" />
                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="CEREALS" />
                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="CEREALS" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                        <span>Card</span>
                        <div className="flex gap-1 drop-shadow-sm">
                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="ORE" />
                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="CEREALS" />
                            <img src={RESOURCE_ICONS.WOOL} className="w-2.5 h-2.5 md:w-3 md:h-3" alt="WOOL" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
