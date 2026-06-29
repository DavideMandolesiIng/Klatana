import React, { useState } from 'react';
import { type GameState, getPlayerTradeRates, type ResourceCounts } from '../game/GameState';
import { type MapTemplate, type ResourceType } from '../game/mapTemplates';

interface TradeModalProps {
    gameState: GameState;
    myPlayerId: string;
    map: MapTemplate;
    onClose: () => void;
    onBankTrade: (giveRes: string, giveAmount: number, getRes: string) => void;
    onProposeTrade: (offer: Partial<ResourceCounts>, request: Partial<ResourceCounts>) => void;
}

const RESOURCES: Exclude<ResourceType, 'DESERT'>[] = ['WOOD', 'CLAY', 'WHEAT', 'WOOL', 'ORE'];

export const TradeModal: React.FC<TradeModalProps> = ({ gameState, myPlayerId, map, onClose, onBankTrade, onProposeTrade }) => {
    const [tab, setTab] = useState<'BANK' | 'PLAYER'>('BANK');
    const myPlayer = gameState.players.find(p => p.peerId === myPlayerId);
    const rates = getPlayerTradeRates(gameState, map, myPlayerId);

    // Bank Trade State
    const [bankGive, setBankGive] = useState<string>('WOOD');
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-2xl max-w-lg w-full text-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Trade Market</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-xl">&times;</button>
                </div>

                <div className="flex gap-4 mb-6 border-b border-slate-700 pb-2">
                    <button 
                        onClick={() => setTab('BANK')}
                        className={`font-bold pb-2 uppercase tracking-wider text-sm ${tab === 'BANK' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Maritime Trade
                    </button>
                    <button 
                        onClick={() => setTab('PLAYER')}
                        className={`font-bold pb-2 uppercase tracking-wider text-sm ${tab === 'PLAYER' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Player Trade
                    </button>
                </div>

                {tab === 'BANK' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-5 gap-2 bg-slate-900 p-3 rounded-xl border border-slate-700">
                            {RESOURCES.map(res => (
                                <div key={res} className="text-center flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-400">{res}</span>
                                    <span className="text-xs font-black text-white">{rates[res]}:1</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-bold uppercase text-red-400">Give</span>
                                <select 
                                    className="bg-slate-700 border border-slate-600 rounded p-2 text-sm font-bold w-32"
                                    value={bankGive}
                                    onChange={(e) => setBankGive(e.target.value)}
                                >
                                    {RESOURCES.map(r => (
                                        <option key={r} value={r}>{r} ({rates[r]})</option>
                                    ))}
                                </select>
                            </div>
                            <span className="font-bold text-slate-500 text-2xl">→</span>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-bold uppercase text-emerald-400">Get</span>
                                <select 
                                    className="bg-slate-700 border border-slate-600 rounded p-2 text-sm font-bold w-32"
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
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl font-bold uppercase tracking-wider transition-colors shadow-lg"
                        >
                            Execute Trade
                        </button>
                    </div>
                )}

                {tab === 'PLAYER' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-slate-900 p-4 rounded-xl border border-red-900/50">
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 text-center">I Want To Give</h3>
                                <div className="space-y-2">
                                    {RESOURCES.map(res => (
                                        <div key={res} className="flex justify-between items-center bg-slate-800 p-1.5 rounded">
                                            <span className="text-xs font-bold w-12">{res}</span>
                                            <div className="flex gap-1 items-center">
                                                <button onClick={() => updateOffer(res, -1)} className="w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded font-bold">-</button>
                                                <span className="w-4 text-center text-xs font-bold">{offer[res as keyof typeof offer] || 0}</span>
                                                <button onClick={() => updateOffer(res, 1)} className="w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded font-bold">+</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-xl border border-emerald-900/50">
                                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 text-center">I Want To Get</h3>
                                <div className="space-y-2">
                                    {RESOURCES.map(res => (
                                        <div key={res} className="flex justify-between items-center bg-slate-800 p-1.5 rounded">
                                            <span className="text-xs font-bold w-12">{res}</span>
                                            <div className="flex gap-1 items-center">
                                                <button onClick={() => updateRequest(res, -1)} className="w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded font-bold">-</button>
                                                <span className="w-4 text-center text-xs font-bold">{request[res as keyof typeof request] || 0}</span>
                                                <button onClick={() => updateRequest(res, 1)} className="w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded font-bold">+</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleProposeTrade}
                            disabled={Object.values(offer).reduce((a,b)=>a+(b||0),0) === 0 || Object.values(request).reduce((a,b)=>a+(b||0),0) === 0}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl font-bold uppercase tracking-wider transition-colors shadow-lg"
                        >
                            Propose Trade
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
