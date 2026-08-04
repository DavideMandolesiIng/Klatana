import React, { useState } from 'react';
import { PLAYER_COLORS } from '../../game/Player';
import { type PlayerState } from '../../game/GameState';
import { peerService } from '../../network/PeerService';
import { useSounds } from '../../context/SoundContext';

interface PlayerIdentityPanelProps {
    myPlayer: PlayerState | undefined;
    onDisconnect?: () => void;
    activeBuildMode: string;
}

export const PlayerIdentityPanel: React.FC<PlayerIdentityPanelProps> = ({
    myPlayer,
    onDisconnect,
    activeBuildMode
}) => {
    const [showRoomCode, setShowRoomCode] = useState(false);
    const { playClick, playDisconnect } = useSounds();

    return (
        <div className="absolute top-1 left-1 md:top-2 md:left-2 lg:top-4 lg:left-4 flex flex-col gap-1 lg:gap-2 z-10 pointer-events-none">
            <div className="flex gap-2">
                <div className="px-3 py-1.5 bg-[#f4e6cd]/90 backdrop-blur rounded-lg text-sm font-bold shadow-lg border-2 border-[#d3be9a] pointer-events-auto shrink-0 flex items-center">
                    <span className="text-[#7d6549] mr-2">Playing as:</span>
                    <span className="text-white drop-shadow" style={{ color: myPlayer ? PLAYER_COLORS[myPlayer.color as keyof typeof PLAYER_COLORS].hex : 'white' }}>{myPlayer?.username}</span>
                </div>
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
            {activeBuildMode !== 'NONE' && (
                <div className="px-3 py-1.5 bg-[#2d1b0f]/80 backdrop-blur rounded-lg text-xs font-bold shadow-lg border border-[#a37941] animate-pulse text-amber-300 w-max pointer-events-auto mt-1">
                    BUILDING {activeBuildMode}...
                </div>
            )}
        </div>
    );
};
