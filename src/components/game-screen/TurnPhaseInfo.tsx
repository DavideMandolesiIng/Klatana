import React from 'react';
import { PLAYER_COLORS } from '../../game/Player';
import { type GameState, type PlayerState } from '../../game/GameState';
import { SupportWidget } from './SupportWidget';

interface TurnPhaseInfoProps {
    currentPlayer: PlayerState | undefined;
    isSetupPhase?: boolean;
    gameState: GameState;
    timeLeft?: number | null;
}

export const TurnPhaseInfo: React.FC<TurnPhaseInfoProps> = ({
    currentPlayer,
    gameState,
    timeLeft
}) => {
    return (
        <div className="absolute top-1 right-1 md:top-2 md:right-2 lg:top-4 lg:right-4 z-10 pointer-events-none flex flex-col items-end gap-1 lg:gap-2">
            <div className="flex gap-2 items-center">
                <div className="px-3 py-1.5 bg-[#f4e6cd]/90 backdrop-blur rounded-lg text-xs font-bold shadow-lg border-2 border-[#d3be9a]">
                    <span className="text-[#7d6549] uppercase tracking-wider mr-2">Turn:</span>
                    <span className="text-white drop-shadow" style={{ color: currentPlayer ? PLAYER_COLORS[currentPlayer.color as keyof typeof PLAYER_COLORS].hex : 'white' }}>{currentPlayer?.username}</span>
                </div>

                {/* Support Klatana Widget */}
                <SupportWidget />

                {timeLeft !== null && timeLeft !== undefined && (
                    <div className={`px-3 py-1.5 backdrop-blur rounded-lg text-xs font-bold shadow-lg border-2 flex items-center transition-colors ${timeLeft <= 10 ? 'bg-red-600/90 text-white border-red-400 animate-pulse' : 'bg-[#e2cead]/90 text-[#7d6549] border-[#d3be9a]'}`}>
                        <span className="uppercase tracking-wider">⏳ {timeLeft}s</span>
                    </div>
                )}
            </div>
            {gameState.diceRoll && (
                <div className="flex flex-col items-center justify-center bg-[#f4e6cd]/90 backdrop-blur px-4 py-2 rounded-xl border-2 border-[#d3be9a] shadow-2xl min-w-[120px]">
                    <span className="text-[#9c8466] text-[10px] font-black uppercase tracking-widest mb-1 drop-shadow">Last Roll</span>
                    <div className="text-4xl font-black text-[#2c1d10] leading-none drop-shadow-md mb-1">{gameState.diceRoll.total}</div>
                    <div className="flex gap-1 text-slate-400 text-xs font-bold">
                        <span>{gameState.diceRoll.die1}</span>
                        <span>+</span>
                        <span>{gameState.diceRoll.die2}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
