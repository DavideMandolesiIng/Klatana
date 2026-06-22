import React, { useState, useEffect } from 'react';
import { GameBoard } from './GameBoard';
import { type MapTemplate } from '../game/mapTemplates';
import { type PlayerData, PLAYER_COLORS } from '../game/Player';
import { peerService } from '../network/PeerService';
import { type GameState, createInitialGameState, rollDice, distributeResources } from '../game/GameState';

export const GameScreen: React.FC<{ map: MapTemplate, initialPlayers: PlayerData[] }> = ({ map, initialPlayers }) => {
    const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(initialPlayers));

    useEffect(() => {
        peerService.onMessage((data, _peerId) => {
            if (data.type === 'GAME_STATE_UPDATE') {
                setGameState(data.state);
            }
        });
    }, []);

    const broadcastState = (newState: GameState) => {
        setGameState(newState);
        peerService.broadcast({ type: 'GAME_STATE_UPDATE', state: newState });
    };

    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.peerId === peerService.peerId;
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    const myPlayer = gameState.players.find(p => p.peerId === peerService.peerId);

    const handleRollDice = () => {
        if (!isMyTurn || gameState.phase !== 'ROLL') return;
        
        const roll = rollDice();
        let newState: GameState = {
            ...gameState,
            diceRoll: roll,
            phase: 'TRADE',
            logs: [...gameState.logs, `${currentPlayer.username} rolled a ${roll.total} (${roll.die1} + ${roll.die2}).`]
        };
        
        newState = distributeResources(newState, map, roll.total);
        broadcastState(newState);
    };

    const handleEndTurn = () => {
        if (!isMyTurn || gameState.phase === 'ROLL') return;
        
        const nextIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
        const nextPlayer = gameState.players[nextIndex];
        
        const newState = {
            ...gameState,
            currentTurnIndex: nextIndex,
            phase: 'ROLL' as const,
            diceRoll: null,
            logs: [...gameState.logs, `${currentPlayer.username} ended their turn. It is now ${nextPlayer.username}'s turn.`]
        };
        
        broadcastState(newState);
    };

    return (
        <div className="h-screen bg-slate-900 p-4 flex flex-col font-sans text-slate-200 overflow-hidden">
            {/* Header */}
            <header className="flex justify-between items-center mb-4 bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg shrink-0">
                <h1 className="text-lg font-bold text-white tracking-widest uppercase ml-2">Hexagonal Realms</h1>
                
                {/* Dice Display */}
                {gameState.diceRoll && (
                    <div className="flex items-center gap-3 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Last Roll:</span>
                        <div className="flex gap-1.5">
                            <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-slate-900 font-bold text-sm shadow-inner">{gameState.diceRoll.die1}</div>
                            <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-slate-900 font-bold text-sm shadow-inner">{gameState.diceRoll.die2}</div>
                        </div>
                    </div>
                )}
            </header>
            
            <div className="flex-grow flex gap-4 min-h-0 overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-56 flex flex-col gap-4 shrink-0">
                    <div className="flex-grow"></div>
                    
                    {/* Resources Box & Trade (Bottom Left) */}
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg flex flex-col shrink-0">
                        <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-2">My Resources</h3>
                        {myPlayer && (
                            <div className="grid grid-cols-2 gap-1.5 mb-3">
                                {Object.entries(myPlayer.resources).map(([res, count]) => (
                                    <div key={res} className="bg-slate-900 p-1.5 rounded border border-slate-700 flex justify-between items-center">
                                        <span className="text-[10px] font-semibold text-slate-400 truncate mr-1">{res}</span>
                                        <span className="font-bold text-white bg-slate-800 px-1.5 rounded text-xs">{count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="w-full py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors opacity-50 cursor-not-allowed mt-auto border border-slate-600" title="Not implemented yet">
                            Trade
                        </button>
                    </div>
                </div>

                {/* Main Board Area */}
                <main className="flex-grow flex flex-col items-center justify-center bg-slate-800 rounded-xl border border-slate-700 shadow-xl relative overflow-hidden min-w-0">
                    <GameBoard template={map} />
                    
                    {/* Top-Left Floating Info: Turn and Phase */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
                        <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur rounded-lg text-xs font-bold shadow-lg border border-slate-700">
                            <span className="text-slate-400 uppercase tracking-wider mr-2">Turn:</span>
                            <span className="text-white" style={{color: currentPlayer ? PLAYER_COLORS[currentPlayer.color as any].hex : 'white'}}>{currentPlayer?.username}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur rounded-lg text-xs font-bold shadow-lg border border-slate-700">
                            <span className="text-slate-400 uppercase tracking-wider mr-2">Phase:</span>
                            <span className="text-emerald-400 uppercase">{gameState.phase}</span>
                        </div>
                    </div>

                    {/* Floating Controls (Roll/Build/End Turn) - Bottom Right inside Main Area */}
                    <div className="absolute bottom-6 right-6 flex gap-3 z-10">
                        {isMyTurn ? (
                            <>
                                {gameState.phase === 'ROLL' ? (
                                    <button onClick={handleRollDice} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold shadow-2xl transition-colors border border-indigo-400 text-sm uppercase tracking-wider">
                                        Roll Dice
                                    </button>
                                ) : (
                                    <>
                                        <button className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors opacity-50 cursor-not-allowed shadow-xl border border-slate-600 text-sm uppercase tracking-wider" title="Not implemented yet">
                                            Build
                                        </button>
                                        <button onClick={handleEndTurn} className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold shadow-2xl transition-colors border border-red-400 text-sm uppercase tracking-wider">
                                            End Turn
                                        </button>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="px-5 py-3 bg-slate-900/80 backdrop-blur-sm rounded-xl text-sm font-medium text-slate-400 shadow-xl border border-slate-700">
                                Waiting for {currentPlayer?.username}...
                            </div>
                        )}
                    </div>
                </main>

                {/* Right Sidebar */}
                <div className="w-72 flex flex-col gap-4 shrink-0 min-h-0">
                    {/* Game Log (Top Right) */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg h-40 shrink-0 flex flex-col overflow-hidden">
                        <div className="bg-slate-900/50 p-2 border-b border-slate-700 font-bold text-[10px] uppercase text-slate-400 tracking-wider shrink-0">
                            Game Log
                        </div>
                        <div className="p-2 overflow-y-auto flex-grow space-y-1 text-xs flex flex-col-reverse">
                            {[...gameState.logs].reverse().map((log, i) => (
                                <div key={i} className="text-slate-300 border-b border-slate-700/50 pb-1">{log}</div>
                            ))}
                        </div>
                    </div>

                    {/* Players List (Below Log) */}
                    <div className="flex-grow bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-3 flex flex-col gap-2 overflow-y-auto min-h-0">
                        <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-1 shrink-0">Players</h3>
                        {gameState.players.map(p => (
                            <div key={p.peerId} className={`p-2 rounded border transition-colors flex items-center justify-between gap-2 shrink-0 ${p.peerId === currentPlayer?.peerId ? 'border-emerald-500 bg-slate-900' : 'border-slate-700 bg-slate-900/50'}`}>
                                <div className="flex items-center gap-2 truncate">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PLAYER_COLORS[p.color as any].hex }}></div>
                                    <span className="font-bold text-sm truncate">{p.username}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                                    <span title="Victory Points">VP: <span className="text-white font-bold">{p.victoryPoints}</span></span>
                                    <span title="Cards">🃏 <span className="text-white font-bold">{Object.values(p.resources).reduce((a,b)=>a+b,0)}</span></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
