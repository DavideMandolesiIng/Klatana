import React from 'react';
import { type GameState, type PlayerState } from '../../game/GameState';
import { RESOURCE_ICONS } from '../GameScreen';

// Definiamo un tipo per i modi di costruzione per evitare stringhe libere
type BuildMode = 'NONE' | 'HOUSE' | 'STREET' | 'FORTRESS';

interface BuildControlsProps {
    isSetupPhase: boolean;
    gameState: GameState;
    myPlayer: PlayerState | undefined;
    currentPlayer: PlayerState | undefined;
    isMyTurn: boolean;
    buildMode: BuildMode; // Tipizzato correttamente
    setBuildMode: (mode: BuildMode) => void;
    setPendingBuild: (pending: any) => void;
    pendingBuild: any;
    handleRollDice: () => void;
    handleBuyCard: () => void;
    canAffordCard: boolean;
    canAffordHouse: boolean;
    canAffordFortress: boolean;
    canAffordStreet: boolean;
    hasValidHouseSpots: boolean;
    hasValidFortressSpots: boolean;
    hasValidStreetSpots: boolean;
    handleConfirmBuild: () => void;
    handleCancelBuild: () => void;
    handleEndTurn: (force: boolean) => void;
    broadcastState: (state: GameState) => void;
}

export const BuildControls: React.FC<BuildControlsProps> = ({
    isSetupPhase,
    gameState,
    myPlayer,
    currentPlayer,
    isMyTurn,
    buildMode,
    setBuildMode,
    setPendingBuild,
    pendingBuild,
    handleRollDice,
    handleBuyCard,
    canAffordCard,
    canAffordHouse,
    canAffordFortress,
    canAffordStreet,
    hasValidHouseSpots,
    hasValidFortressSpots,
    hasValidStreetSpots,
    handleConfirmBuild,
    handleCancelBuild,
    handleEndTurn,
    broadcastState
}) => {

    // Funzione helper per rendere i tooltip dei costi senza ripetere codice
    const renderCostTooltip = (costs: Record<string, number>) => (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#f4e6cd] backdrop-blur border-2 border-[#7d6549] rounded-lg p-2 shadow-2xl w-32 pointer-events-none z-50">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#7d6549] border-b border-[#7d6549] pb-1 mb-1 text-center">Cost</span>
            {Object.entries(costs).map(([res, cost]) => {
                const has = myPlayer?.resources ? (myPlayer.resources[res as keyof typeof myPlayer.resources] || 0) : 0;
                return (
                    <div key={res} className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <div className="flex items-center gap-1.5">
                            <img src={RESOURCE_ICONS[res as keyof typeof RESOURCE_ICONS]} className="w-3.5 h-3.5" alt="" />
                            <span className="text-black">{res}</span>
                        </div>
                        <span className={has >= cost ? 'text-emerald-600' : 'text-red-500'}>{has}/{cost}</span>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="flex flex-wrap justify-end gap-1.5 md:gap-3 max-w-[240px] md:max-w-[400px] pointer-events-auto">
            {isSetupPhase ? (
                <div className="px-3 py-1.5 md:px-6 md:py-3 bg-indigo-900/90 backdrop-blur-sm rounded-lg md:rounded-xl text-[10px] md:text-sm font-bold text-indigo-200 shadow-xl border border-indigo-500 animate-pulse">
                    {isMyTurn ? `PLACE ${gameState.setupAction}` : `Waiting for ${currentPlayer?.username}...`}
                </div>
            ) : (
                <>
                    {gameState.phase === 'ROLL' && isMyTurn ? (
                        <button onClick={handleRollDice} className="px-3 py-1.5 md:px-6 md:py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg md:rounded-xl font-bold shadow-2xl transition-colors border border-indigo-400 text-[10px] md:text-sm uppercase tracking-wider w-full md:w-auto">
                            Roll Dice
                        </button>
                    ) : (
                        <>
                            {buildMode !== 'NONE' && isMyTurn ? (
                                <button onClick={() => { setBuildMode('NONE'); setPendingBuild(null); }} className="px-3 py-1.5 md:px-6 md:py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg md:rounded-xl font-bold transition-colors shadow-xl border border-slate-600 text-[10px] md:text-sm uppercase tracking-wider w-full md:w-auto">
                                    Cancel Build
                                </button>
                            ) : (
                                <>
                                    {/* HOUSE */}
                                    <div className="relative group flex items-stretch">
                                        <button
                                            onClick={() => isMyTurn && setBuildMode('HOUSE')}
                                            disabled={!isMyTurn || !canAffordHouse || !hasValidHouseSpots}
                                            className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border text-[9px] md:text-sm uppercase tracking-wider ${isMyTurn && canAffordHouse && hasValidHouseSpots ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-50 cursor-not-allowed'}`}
                                        >
                                            House
                                        </button>
                                        {renderCostTooltip({ OAK: 1, CLAY: 1, CEREALS: 1, WOOL: 1 })}
                                    </div>

                                    {/* FORTRESS */}
                                    <div className="relative group flex items-stretch">
                                        <button
                                            onClick={() => isMyTurn && setBuildMode('FORTRESS')}
                                            disabled={!isMyTurn || !canAffordFortress || !hasValidFortressSpots}
                                            className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border text-[9px] md:text-sm uppercase tracking-wider ${isMyTurn && canAffordFortress && hasValidFortressSpots ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-50 cursor-not-allowed'}`}
                                        >
                                            Fortress
                                        </button>
                                        {renderCostTooltip({ CEREALS: 2, ORE: 3 })}
                                    </div>

                                    {/* STREET */}
                                    <div className="relative group flex items-stretch">
                                        <button
                                            onClick={() => isMyTurn && setBuildMode('STREET')}
                                            disabled={!isMyTurn || !canAffordStreet || !hasValidStreetSpots}
                                            className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border text-[9px] md:text-sm uppercase tracking-wider ${isMyTurn && canAffordStreet && hasValidStreetSpots ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-50 cursor-not-allowed'}`}
                                        >
                                            Street
                                        </button>
                                        {renderCostTooltip({ OAK: 1, CLAY: 1 })}
                                    </div>

                                    {/* BUY CARD */}
                                    <div className="relative group flex items-stretch">
                                        <button
                                            onClick={() => isMyTurn && handleBuyCard()}
                                            disabled={!isMyTurn || !canAffordCard || gameState.actionCardDeck.length === 0}
                                            className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border-2 text-[9px] text-white md:text-sm uppercase tracking-wider ${isMyTurn && canAffordCard && gameState.actionCardDeck.length > 0 ? 'bg-slate-700 hover:bg-slate-600 border-purple-500 text-purple-200' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'}`}
                                        >
                                            Buy Card <span className="text-[8px] md:text-[10px] text-white font-normal">({gameState.actionCardDeck.length})</span>
                                        </button>
                                        {renderCostTooltip({ CEREALS: 1, WOOL: 1, ORE: 1 })}

                                        {pendingBuild?.type === 'ACTION_CARD' && (
                                            <div className="absolute bottom-full mb-2 right-0 bg-[#f4e6cd] backdrop-blur-md p-3 rounded-xl border-2 border-[#7d6549] shadow-2xl flex flex-col items-center pointer-events-auto w-48 z-50">
                                                <span className="text-xs text-[#7d6549] font-bold mb-2 text-center uppercase tracking-wider">Confirm Purchase?</span>
                                                <div className="flex gap-2 w-full">
                                                    <button onClick={handleConfirmBuild} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 rounded font-bold transition-colors">✓ Buy</button>
                                                    <button onClick={handleCancelBuild} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs py-1.5 rounded font-bold transition-colors">✗ Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {isMyTurn ? (
                                        gameState.gamePhase === 'FREE_STREET_BUILDING' ? (
                                            <button onClick={() => {
                                                broadcastState({ ...gameState, gamePhase: 'MAIN_GAME', freeStreetsLeft: 0 });
                                                setBuildMode('NONE');
                                            }} className="px-3 py-1.5 md:px-6 md:py-3 rounded-lg md:rounded-xl font-bold shadow-2xl transition-colors border border-amber-500 bg-amber-600 hover:bg-amber-500 text-white text-[10px] md:text-sm uppercase tracking-wider">
                                                End Free street
                                            </button>
                                        ) : (
                                            <button onClick={() => handleEndTurn(false)} disabled={gameState.gamePhase !== 'MAIN_GAME'} className={`px-4 py-1.5 md:px-6 md:py-3 rounded-lg md:rounded-xl font-bold shadow-2xl transition-colors border text-[10px] md:text-sm uppercase tracking-wider text-white ${gameState.gamePhase === 'MAIN_GAME' ? 'bg-red-600 hover:bg-red-500 border-red-400' : 'bg-red-800 border-red-700 opacity-50 cursor-not-allowed'}`}>
                                                End Turn
                                            </button>
                                        )
                                    ) : (
                                        <div className="px-3 py-2 md:px-5 md:py-3 bg-slate-900/80 backdrop-blur-sm rounded-lg md:rounded-xl text-[10px] md:text-sm font-medium text-slate-400 shadow-xl border border-slate-700 flex items-center h-full">
                                            Waiting for {currentPlayer?.username}...
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};