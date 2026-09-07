import React, { useState } from 'react';
import { type PlayerState } from '../../game/GameState';
import { peerService } from '../../network/PeerService';
import { useSounds } from '../../context/SoundContext';

interface PlayerIdentityPanelProps {
    myPlayer: PlayerState | undefined;
    onDisconnect?: () => void;
}

export const PlayerIdentityPanel: React.FC<PlayerIdentityPanelProps> = ({
    onDisconnect
}) => {
    const [showRoomCode, setShowRoomCode] = useState(false);
    const { playClick, playDisconnect } = useSounds();

    return (
        <div className="absolute top-1 left-1 md:top-2 md:left-2 lg:top-4 lg:left-4 flex flex-col gap-1 lg:gap-2 z-10 pointer-events-none">
            <div className="flex gap-2">
                <div className="flex flex-col gap-1 pointer-events-auto">
                    <div className="flex gap-1 h-full">
                        <div className="relative">
                            <button onClick={() => { playClick(); setShowRoomCode(!showRoomCode); }} className="px-2 py-1 h-full bg-[#ebd8b7] hover:bg-[#d3be9a] text-black font-bold uppercase tracking-wider rounded-lg shadow-lg border border-slate-700 text-[10px] transition-colors shrink-0">
                                Room Code {showRoomCode ? '▲' : '▼'}
                            </button>
                            {showRoomCode && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[#f4e6cd]/95 backdrop-blur rounded-lg border-2 border-[#d3be9a] shadow-xl p-2 min-w-max text-center pointer-events-auto z-50 cursor-text">
                                    <span className="text-lg font-bold tracking-widest text-[#2c1d10] leading-none m-1.5 block select-all">{peerService.roomCode}</span>
                                </div>
                            )}
                        </div>
                        {onDisconnect && (
                            <button onClick={() => { playDisconnect(); onDisconnect(); }} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider rounded-lg shadow-lg border border-red-700 text-[10px] transition-colors shrink-0">
                                Log Out
                            </button>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};
