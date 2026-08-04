import React from 'react';
import { type PlayerState } from '../../game/GameState';
import { PLAYER_COLORS } from '../../game/Player';
import { useSounds } from '../../context/SoundContext';

interface MobileRoomTabProps {
    roomCode: string;
    myPlayer: PlayerState | undefined;
    onDisconnect?: () => void;
}

export const MobileRoomTab: React.FC<MobileRoomTabProps> = ({ roomCode, myPlayer, onDisconnect }) => {
    const { playDisconnect } = useSounds();

    return (
        <div className="p-3 flex flex-col gap-3">
            <div className="bg-[#f4e6cd] rounded-xl border-2 border-[#d3be9a] shadow p-3 flex flex-col gap-2">
                <h3 className="font-black text-[#7d6549] uppercase text-[10px] tracking-wider">Game Settings</h3>
                <div className="flex items-center justify-between bg-[#ebd8b7] rounded-lg px-3 py-2 border border-[#d3be9a]">
                    <span className="text-xs font-bold text-[#5c4936]">Room Code</span>
                    <span className="text-sm font-black tracking-widest text-[#2c1d10] select-all">{roomCode}</span>
                </div>
                <div className="flex items-center justify-between bg-[#ebd8b7] rounded-lg px-3 py-2 border border-[#d3be9a]">
                    <span className="text-xs font-bold text-[#5c4936]">Playing as</span>
                    <span className="text-xs font-bold" style={{ color: myPlayer ? PLAYER_COLORS[myPlayer.color as keyof typeof PLAYER_COLORS].hex : '#2c1d10' }}>{myPlayer?.username}</span>
                </div>
                {onDisconnect && (
                    <button onClick={() => { playDisconnect(); onDisconnect(); }} className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm uppercase tracking-wider border border-red-700 transition shadow">
                        Disconnect
                    </button>
                )}
            </div>
            <p className="text-[9px] text-[#a39070] text-center leading-tight">Klatana is a free, open-source fan project. It is not affiliated with, endorsed by, or sponsored by Catan Studio, Asmodee, or any related entities.</p>
        </div>
    );
};
