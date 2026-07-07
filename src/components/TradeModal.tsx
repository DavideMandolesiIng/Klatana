import React, { useState } from 'react';
import { type GameState, getPlayerTradeRates, type ResourceCounts } from '../game/GameState';
import { type MapTemplate, type ResourceType } from '../game/mapTemplates';
import { RESOURCE_GRADIENTS, RESOURCE_TEXTURES } from './GameScreen';

interface TradeModalProps {
    gameState: GameState;
    myPlayerId: string;
    map: MapTemplate;
    onClose: () => void;
    onBankTrade: (giveRes: string, giveAmount: number, getRes: string) => void;
    onProposeTrade: (offer: Partial<ResourceCounts>, request: Partial<ResourceCounts>) => void;
}

const RESOURCES: Exclude<ResourceType, 'DESERT'>[] = ['OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'];

export const TradeModal: React.FC<TradeModalProps> = ({ gameState, myPlayerId, map, onClose, onBankTrade, onProposeTrade }) => {
    const [tab, setTab] = useState<'BANK' | 'PLAYER'>('BANK');
    const myPlayer = gameState.players.find(p => p.peerId === myPlayerId);
    const rates = getPlayerTradeRates(gameState, map, myPlayerId);

    // Bank Trade State
    const [bankGive, setBankGive] = useState<string>('OAK');
    const [bankGet, setBankGet] = useState<string>('CLAY');

    // Player Trade State
    const [offer, setOffer] = useState<Partial<ResourceCounts>>({});
    const [request, setRequest] = useState<Partial<ResourceCounts>>({});

    if (!myPlayer) return null;

    const handleBankTrade = () => {
        const rate = rates[bankGive as keyof typeof rates];
        if (myPlayer.resources[bankGive as keyof typeof myPlayer.resources] >= rate) {
            onBankTrade(bankGive, rate, bankGet);
            onClose();
        }
    };

    const handleProposeTrade = () => {
        const totalOffer = Object.values(offer).reduce((a, b) => a + (b || 0), 0);
        const totalReq = Object.values(request).reduce((a, b) => a + (b || 0), 0);
        if (totalOffer > 0 && totalReq > 0) {
            onProposeTrade(offer, request);
            onClose();
        }
    };

    const updateOffer = (res: string, delta: number) => {
        const current = offer[res as keyof typeof offer] || 0;
        const available = myPlayer.resources[res as keyof typeof myPlayer.resources];
        const next = Math.max(0, Math.min(available, current + delta));
        setOffer(prev => ({ ...prev, [res]: next }));
    };

    const updateRequest = (res: string, delta: number) => {
        const current = request[res as keyof typeof request] || 0;
        const next = Math.max(0, current + delta);
        setRequest(prev => ({ ...prev, [res]: next }));
    };

    return (
        <div className="w-full text-slate-200">
            {/* Tab Row */}
            <div className="flex gap-3 mb-3 border-b border-slate-700 pb-2">
                <button
                    onClick={() => setTab('BANK')}
                    className={`font-bold pb-1 uppercase tracking-wider text-[10px] transition-colors ${tab === 'BANK' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Maritime
                </button>
                <button
                    onClick={() => setTab('PLAYER')}
                    className={`font-bold pb-1 uppercase tracking-wider text-[10px] transition-colors ${tab === 'PLAYER' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Player
                </button>
            </div>

            {tab === 'BANK' && (
                <div className="space-y-2">
                    {/* Rates */}
                    <div className="grid grid-cols-5 gap-1 bg-slate-900/60 p-2 rounded-lg border border-slate-700">
                        {RESOURCES.map(res => {
                            const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                            return (
                                <div key={res} className="relative text-center flex flex-col items-center justify-center p-1 rounded-md border border-black/30 overflow-hidden shadow-sm" style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}>
                                    {RESOURCE_TEXTURES[res] && (
                                        <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay" style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }} />
                                    )}
                                    <span className="relative z-10 text-[8px] font-bold text-white drop-shadow-sm">{res}</span>
                                    <span className="relative z-10 text-[10px] font-black text-white drop-shadow-md">{rates[res]}:1</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Give / Get */}
                    <div className="flex gap-2 items-center justify-center">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold uppercase text-red-400">Give</span>
                            <select
                                className="bg-slate-700 border border-slate-600 rounded p-1 text-[10px] font-bold w-24"
                                value={bankGive}
                                onChange={(e) => setBankGive(e.target.value)}
                            >
                                {RESOURCES.map(r => (
                                    <option key={r} value={r}>{r} ({rates[r]})</option>
                                ))}
                            </select>
                        </div>
                        <span className="font-bold text-slate-500 text-lg mt-4">→</span>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold uppercase text-emerald-400">Get</span>
                            <select
                                className="bg-slate-700 border border-slate-600 rounded p-1 text-[10px] font-bold w-24"
                                value={bankGet}
                                onChange={(e) => setBankGet(e.target.value)}
                            >
                                {RESOURCES.filter(r => r !== bankGive).map(r => (
                                    <option key={r} value={r}>{r} (1)</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleBankTrade}
                        disabled={myPlayer.resources[bankGive as keyof typeof myPlayer.resources] < rates[bankGive as keyof typeof rates]}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-bold uppercase tracking-wider text-[10px] transition-colors shadow"
                    >
                        Execute Trade
                    </button>
                </div>
            )}

            {tab === 'PLAYER' && (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-900/60 p-2 rounded-lg border border-red-900/50">
                            <h3 className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-2 text-center">Give</h3>
                            <div className="space-y-1">
                                {RESOURCES.map(res => {
                                    const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                                    return (
                                        <div key={res} className="relative flex justify-between items-center px-2 py-1 rounded border border-black/30 shadow-sm overflow-hidden" style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}>
                                            {RESOURCE_TEXTURES[res] && (
                                                <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay" style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }} />
                                            )}
                                            <span className="relative z-10 text-[9px] font-bold w-14 text-white drop-shadow-sm">{res}</span>
                                            <div className="relative z-10 flex gap-1 items-center bg-black/40 rounded px-1 py-0.5">
                                                <button onClick={() => updateOffer(res, -1)} className="w-5 h-5 bg-white/20 hover:bg-white/40 rounded font-bold text-[10px] text-white transition-colors">-</button>
                                                <span className="w-4 text-center text-[10px] font-bold text-white">{offer[res as keyof typeof offer] || 0}</span>
                                                <button onClick={() => updateOffer(res, 1)} className="w-5 h-5 bg-white/20 hover:bg-white/40 rounded font-bold text-[10px] text-white transition-colors">+</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-900/50">
                            <h3 className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-2 text-center">Get</h3>
                            <div className="space-y-1">
                                {RESOURCES.map(res => {
                                    const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                                    return (
                                        <div key={res} className="relative flex justify-between items-center px-2 py-1 rounded border border-black/30 shadow-sm overflow-hidden" style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}>
                                            {RESOURCE_TEXTURES[res] && (
                                                <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay" style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }} />
                                            )}
                                            <span className="relative z-10 text-[9px] font-bold w-14 text-white drop-shadow-sm">{res}</span>
                                            <div className="relative z-10 flex gap-1 items-center bg-black/40 rounded px-1 py-0.5">
                                                <button onClick={() => updateRequest(res, -1)} className="w-5 h-5 bg-white/20 hover:bg-white/40 rounded font-bold text-[10px] text-white transition-colors">-</button>
                                                <span className="w-4 text-center text-[10px] font-bold text-white">{request[res as keyof typeof request] || 0}</span>
                                                <button onClick={() => updateRequest(res, 1)} className="w-5 h-5 bg-white/20 hover:bg-white/40 rounded font-bold text-[10px] text-white transition-colors">+</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleProposeTrade}
                        disabled={Object.values(offer).reduce((a, b) => a + (b || 0), 0) === 0 || Object.values(request).reduce((a, b) => a + (b || 0), 0) === 0}
                        className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-bold uppercase tracking-wider text-[10px] transition-colors shadow"
                    >
                        Propose Trade
                    </button>
                </div>
            )}
        </div>
    );
};
