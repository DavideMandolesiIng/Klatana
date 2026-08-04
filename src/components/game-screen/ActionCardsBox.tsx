import React from 'react';
import { type PlayerState, type GameState } from '../../game/GameState';

interface ActionCardsBoxProps {
    myPlayer: PlayerState | undefined;
    isMyTurn: boolean;
    gameState: GameState;
    handlePlayCard: (cardIndex: number) => void;
}

export const ActionCardsBox: React.FC<ActionCardsBoxProps> = ({
    myPlayer,
    isMyTurn,
    gameState,
    handlePlayCard
}) => {
    return (
        <div className="flex-1 md:flex-none bg-[#f4e6cd] p-1 md:p-3 rounded-lg md:rounded-xl border-2 border-[#d3be9a] shadow-lg flex flex-col shrink-0 min-h-0 mt-0 md:mt-auto">
            <h3 className="hidden md:block font-black text-[#7d6549] uppercase text-xs tracking-wider mb-2">Action Cards</h3>
            <div className="flex flex-row md:flex-col gap-1 md:gap-2 flex-grow overflow-x-auto overflow-y-hidden md:overflow-visible items-center md:items-stretch">
                {myPlayer?.actionCards.map((card, i) => (
                    <div key={i} className="bg-[#ebd8b7] p-1 md:p-2 rounded border-2 border-[#d3be9a] flex gap-2 justify-between items-center group relative cursor-help shrink-0 md:shrink">
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#f4e6cd]/98 backdrop-blur border-2 border-[#d3be9a] rounded-lg p-2 shadow-2xl w-48 pointer-events-none z-[60]">
                            <span className="text-[10px] uppercase tracking-widest font-black text-[#7d6549] border-b border-[#d3be9a] pb-1 mb-1 text-center">Info</span>
                            <span className="text-[10px] text-black text-center font-medium">
                                {card.type === 'NINJA' ? 'Move the Ninja to a new hex and steal 1 resource from an adjacent opponent.' :
                                    card.type === 'MONUMENT' ? '+1 Victory Point (Hidden from others until the end).' :
                                        card.type === 'MARKET CONTROL' ? 'Name 1 resource. All opponents must give you ALL their cards of that type.' :
                                            card.type === 'ABUNDANCE' ? 'Instantly take any 2 resources of your choice from the bank.' :
                                                card.type === 'RAPID_EXPANSION' ? 'Instantly build 2 streets for free.' : ''}
                            </span>
                        </div>
                        <span className="text-[9px] md:text-[10px] font-black text-[#2c1d10] uppercase truncate pr-1 flex-1">{card.type}</span>
                        {card.type !== 'MONUMENT' && (
                            <button
                                onClick={() => handlePlayCard(i)}
                                disabled={!isMyTurn || gameState.phase === 'ROLL' || gameState.activeTurnPlayedCard || card.boughtThisTurn}
                                className="px-1.5 py-0.5 md:px-2 md:py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[9px] md:text-[10px] font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed relative z-10 shrink-0"
                            >
                                Play
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
