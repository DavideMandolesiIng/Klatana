import React from 'react';
import { useSounds } from '../../context/SoundContext';

export type MobileTab = 'GAME' | 'LOG' | 'TRADE' | 'ROOM';

interface MobileTabBarProps {
    mobileActiveTab: MobileTab;
    setMobileActiveTab: (tab: MobileTab) => void;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ mobileActiveTab, setMobileActiveTab }) => {
    const { playClick } = useSounds();

    return (
        <div className="shrink-0 h-14 bg-[#ebd8b7] border-t-2 border-[#d3be9a] flex items-stretch" style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.12)' }}>
            {(['GAME', 'LOG', 'TRADE', 'ROOM'] as const).map(tab => {
                const icons: Record<string, string> = { GAME: '🏠', LOG: '📋', TRADE: '⚖️', ROOM: '⚙️' };
                const labels: Record<string, string> = { GAME: 'Game', LOG: 'Log', TRADE: 'Trade', ROOM: 'Room' };
                return (
                    <button key={tab} onClick={() => { playClick(); setMobileActiveTab(tab); }}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black uppercase tracking-wider transition-all ${mobileActiveTab === tab ? 'bg-[#f4e6cd] text-[#5c4936] border-t-[3px] border-[#a37941]' : 'text-[#7d6549] hover:bg-[#f4e6cd]/60 border-t-[3px] border-transparent'}`}>
                        <span className="text-base leading-none">{icons[tab]}</span>
                        <span>{labels[tab]}</span>
                    </button>
                );
            })}
        </div>
    );
};
