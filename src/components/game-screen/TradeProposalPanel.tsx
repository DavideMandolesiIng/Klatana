import React from 'react';
import { type GameState, type PlayerState, canAfford } from '../../game/GameState';
import { RESOURCE_GRADIENTS, RESOURCE_TEXTURES } from '../GameScreen';

interface TradeProposalPanelProps {
    gameState: GameState;
    myPlayer: PlayerState;
    handleFinalizeTrade: (acceptedPeerId: string) => void;
    handleCancelTrade: () => void;
    handleAcceptTrade: () => void;
    handleRejectTrade: () => void;
}

export const TradeProposalPanel: React.FC<TradeProposalPanelProps> = ({
    gameState,
    myPlayer,
    handleFinalizeTrade,
    handleCancelTrade,
    handleAcceptTrade,
    handleRejectTrade
}) => {
    if (gameState.gamePhase !== 'P2P_TRADE_PENDING' || !gameState.tradeProposal) {
        return null;
    }

    return (
        <div className="bg-[#f4e6cd]/95 backdrop-blur-md rounded-tr-xl border-t-2 border-r-2 border-[#d3be9a] shadow-2xl p-3 flex flex-col pointer-events-auto">
            <h2 className="text-xs font-black text-[#5c4936] mb-2 text-center uppercase tracking-wider">Trade Proposal</h2>

            <div className="flex flex-col gap-2 justify-between bg-[#ebd8b7] shadow-inner p-2 rounded-lg border-2 border-[#d3be9a] mb-2">
                <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-[#7d6549] uppercase">{gameState.players.find(p => p.peerId === gameState.tradeProposal!.proposerId)?.username} gives</span>
                    <div className="flex gap-1 flex-wrap justify-center">
                        {Object.entries(gameState.tradeProposal.offer).filter(([_, count]) => (count || 0) > 0).map(([res, count]) => (
                            <div key={res} className="relative p-1 px-2 rounded overflow-hidden border border-black/30 flex justify-center items-center" style={{ background: `radial-gradient(circle at center, ${RESOURCE_GRADIENTS[res]?.center || '#334155'}, ${RESOURCE_GRADIENTS[res]?.edge || '#0f172a'})` }}>
                                {RESOURCE_TEXTURES[res] && (
                                    <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay" style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }} />
                                )}
                                <span className="relative z-10 font-bold text-white text-[10px] drop-shadow-sm">{count} {res}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-center text-sm font-black text-slate-500 leading-none">🔄</div>
                <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-[#7d6549] uppercase">Requests</span>
                    <div className="flex gap-1 flex-wrap justify-center">
                        {Object.entries(gameState.tradeProposal.request).filter(([_, count]) => (count || 0) > 0).map(([res, count]) => (
                            <div key={res} className="relative p-1 px-2 rounded overflow-hidden border border-black/30 flex justify-center items-center" style={{ background: `radial-gradient(circle at center, ${RESOURCE_GRADIENTS[res]?.center || '#334155'}, ${RESOURCE_GRADIENTS[res]?.edge || '#0f172a'})` }}>
                                {RESOURCE_TEXTURES[res] && (
                                    <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay" style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }} />
                                )}
                                <span className="relative z-10 font-bold text-white text-[10px] drop-shadow-sm">{count} {res}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {myPlayer.peerId === gameState.tradeProposal.proposerId ? (
                <div className="space-y-2">
                    {/* Accepted players */}
                    {gameState.tradeProposal.acceptedBy.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <h3 className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider text-center">✓ Accepted</h3>
                            {gameState.tradeProposal.acceptedBy.map(pid => {
                                const p = gameState.players.find(x => x.peerId === pid);
                                return p ? (
                                    <button key={pid} onClick={() => handleFinalizeTrade(pid)} className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[10px] text-white rounded font-bold transition-colors shadow">
                                        Trade with {p.username}
                                    </button>
                                ) : null;
                            })}
                        </div>
                    )}

                    {/* Declined players */}
                    {(gameState.tradeProposal.declinedBy?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-1">
                            <h3 className="text-[9px] font-bold text-red-400 uppercase tracking-wider text-center">✗ Declined</h3>
                            {gameState.tradeProposal.declinedBy!.map(pid => {
                                const p = gameState.players.find(x => x.peerId === pid);
                                return p ? (
                                    <div key={pid} className="w-full py-1 px-2 bg-red-900/40 border border-red-800/50 text-[10px] rounded font-bold text-white text-center">
                                        {p.username}
                                    </div>
                                ) : null;
                            })}
                        </div>
                    )}

                    {/* Waiting message if nobody has responded yet */}
                    {gameState.tradeProposal.acceptedBy.length === 0 && (gameState.tradeProposal.declinedBy?.length ?? 0) === 0 && (
                        <p className="text-slate-500 text-center text-[10px] italic">Waiting for responses...</p>
                    )}

                    <button onClick={handleCancelTrade} className="w-full py-1.5 bg-yellow-600 hover:bg-yellow-700 text-[10px] text-white rounded font-bold transition-colors shadow">Cancel Offer</button>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <button
                            onClick={handleAcceptTrade}
                            disabled={!canAfford(myPlayer.resources, gameState.tradeProposal.request) || gameState.tradeProposal.acceptedBy.includes(myPlayer.peerId)}
                            className={`flex-1 py-2 ${gameState.tradeProposal.acceptedBy.includes(myPlayer.peerId) ? 'bg-emerald-800 text-emerald-300' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:bg-slate-700 disabled:text-slate-500 text-[10px] rounded font-bold uppercase tracking-wider transition-colors shadow`}
                        >
                            {gameState.tradeProposal.acceptedBy.includes(myPlayer.peerId) ? 'Accepted ✓' : 'Accept'}
                        </button>
                        <button
                            onClick={handleRejectTrade}
                            disabled={gameState.tradeProposal.declinedBy?.includes(myPlayer.peerId)}
                            className={`flex-1 py-2 ${gameState.tradeProposal.declinedBy?.includes(myPlayer.peerId) ? 'bg-red-800 text-red-300 disabled:opacity-100 disabled:cursor-default' : 'bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500'} text-[10px] rounded font-bold uppercase tracking-wider transition-colors shadow`}
                        >
                            {gameState.tradeProposal.declinedBy?.includes(myPlayer.peerId) ? 'Rejected ✗' : 'Reject'}
                        </button>
                    </div>
                    {!canAfford(myPlayer.resources, gameState.tradeProposal.request) && (
                        <p className="text-red-400 text-[9px] text-center font-bold">You do not have the requested resources.</p>
                    )}
                </div>
            )}
        </div>
    );
};
