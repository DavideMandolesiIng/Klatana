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
    canPropose: boolean;
    initialOffer?: Partial<ResourceCounts>;
    /** @deprecated no longer used, kept for backward compat */
    initialTab?: 'BANK' | 'PLAYER';
    /** @deprecated no longer used, kept for backward compat */
    initialBankGive?: string;
}

const RESOURCES: Exclude<ResourceType, 'DESERT'>[] = ['OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'];

/** Rate label colour based on trade rate */
const rateColor = (rate: number) => {
    if (rate === 2) return 'text-emerald-400';
    if (rate === 3) return 'text-amber-400';
    return 'text-slate-400';
};

export const TradeModal: React.FC<TradeModalProps> = ({
    gameState,
    myPlayerId,
    map,
    onClose,
    onBankTrade,
    onProposeTrade,
    canPropose,
    initialOffer,
}) => {
    const myPlayer = gameState.players.find(p => p.peerId === myPlayerId);
    const rates = getPlayerTradeRates(gameState, map, myPlayerId);

    // Single unified offer/request state
    const [offer, setOffer] = useState<Partial<ResourceCounts>>(initialOffer || {});
    const [request, setRequest] = useState<Partial<ResourceCounts>>({});

    React.useEffect(() => {
        if (initialOffer) setOffer({ ...initialOffer });
    }, [initialOffer]);

    if (!myPlayer) return null;

    /* ── Offer helpers ── */
    const updateOffer = (res: string, delta: number) => {
        const current = offer[res as keyof typeof offer] || 0;
        const available = myPlayer.resources[res as keyof typeof myPlayer.resources];
        const next = Math.max(0, Math.min(available, current + delta));
        setOffer(prev => ({ ...prev, [res]: next }));
    };

    /* ── Request helpers ── */
    const updateRequest = (res: string, delta: number) => {
        const current = request[res as keyof typeof request] || 0;
        const next = Math.max(0, current + delta);
        setRequest(prev => ({ ...prev, [res]: next }));
    };

    /* ── Bank trade validation ──
       For each resource in offer, we check that the player has at least `rate` units.
       For each resource in request, we need at least 1.
       We then fire one bank trade per "lot" of (rate) given, cycling through requested resources.
    */
    const bankTradeExecutable = (): boolean => {
        const totalGiveLots = RESOURCES.reduce((sum, res) => {
            const qty = offer[res] || 0;
            const rate = rates[res];
            return sum + Math.floor(qty / rate);
        }, 0);
        const totalGetSlots = RESOURCES.reduce((sum, res) => sum + (request[res] || 0), 0);
        return totalGiveLots > 0 && totalGetSlots > 0;
    };

    const handleBankTrade = () => {
        if (!canPropose || !bankTradeExecutable()) return;

        // Build a queue of "get" resources, one slot per requested unit
        const getQueue: string[] = [];
        RESOURCES.forEach(res => {
            const qty = request[res] || 0;
            for (let i = 0; i < qty; i++) getQueue.push(res);
        });

        // For each resource in offer, execute floor(qty / rate) trades
        // distributing the received resources from the queue in order
        let getIdx = 0;
        RESOURCES.forEach(res => {
            const qty = offer[res] || 0;
            const rate = rates[res];
            const lots = Math.floor(qty / rate);
            for (let i = 0; i < lots; i++) {
                if (getIdx < getQueue.length) {
                    onBankTrade(res, rate, getQueue[getIdx]);
                    getIdx++;
                }
            }
        });

        onClose();
    };

    /* ── Player trade validation ── */
    const handleProposeTrade = () => {
        const totalOffer = Object.values(offer).reduce((a, b) => a + (b || 0), 0);
        const totalReq = Object.values(request).reduce((a, b) => a + (b || 0), 0);
        if (totalOffer > 0 && totalReq > 0) {
            onProposeTrade(offer, request);
            onClose();
        }
    };

    const totalOfferQty = Object.values(offer).reduce((a, b) => a + (b || 0), 0);
    const totalReqQty = Object.values(request).reduce((a, b) => a + (b || 0), 0);

    return (
        <div className="w-full text-slate-200 space-y-2">

            {/* ── Bank Rates Legend ── */}
            <div className="bg-[#ebd8b7] border border-slate-700 rounded-lg p-2">
                <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 text-center">
                    Your Bank Rates
                </div>
                <div className="grid grid-cols-5 gap-1">
                    {RESOURCES.map(res => {
                        const rate = rates[res];
                        const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                        return (
                            <div
                                key={res}
                                className="relative text-center flex flex-col items-center justify-center p-1 rounded-md border border-black/30 overflow-hidden shadow-sm"
                                style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}
                            >
                                {RESOURCE_TEXTURES[res] && (
                                    <div
                                        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-40 mix-blend-overlay"
                                        style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                    />
                                )}
                                <span className="relative z-10 text-[7px] font-bold text-white drop-shadow-sm leading-tight">{res}</span>
                                <span className={`relative z-10 text-[11px] font-black drop-shadow-md ${rateColor(rate)}`}>
                                    {rate}:1
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Resource Selector ── */}
            <div className="grid grid-cols-2 gap-2">

                {/* Give column */}
                <div className="bg-[#ebd8b7] p-2 rounded-lg border border-red-900/50">
                    <h3 className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1.5 text-center">Give</h3>
                    <div className="space-y-1">
                        {RESOURCES.map(res => {
                            const rate = rates[res];
                            const available = myPlayer.resources[res as keyof typeof myPlayer.resources];
                            const qty = offer[res as keyof typeof offer] || 0;
                            const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                            // How many bank lots can we cover?
                            const bankLots = Math.floor(qty / rate);
                            return (
                                <div
                                    key={res}
                                    className="relative flex justify-between items-center px-1.5 py-1 rounded border border-black/30 shadow-sm overflow-hidden"
                                    style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}
                                >
                                    {RESOURCE_TEXTURES[res] && (
                                        <div
                                            className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay"
                                            style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                        />
                                    )}
                                    <div className="relative z-10 flex flex-col">
                                        <span className="text-[8px] font-bold text-white drop-shadow-sm leading-tight">{res}</span>
                                        {/* Bank rate hint */}
                                        <span className={`text-[7px] font-semibold leading-tight ${rateColor(rate)}`}>
                                            {rate}:1{bankLots > 0 ? ` (×${bankLots})` : ''}
                                        </span>
                                    </div>
                                    <div className="relative z-10 flex gap-1 items-center bg-black/40 rounded px-1 py-0.5">
                                        <button
                                            onClick={() => updateOffer(res, -1)}
                                            className="w-4 h-4 bg-white/20 hover:bg-white/40 rounded font-bold text-[9px] text-white transition-colors"
                                        >-</button>
                                        <span className="w-5 text-center text-[10px] font-bold text-white">{qty}</span>
                                        <button
                                            onClick={() => updateOffer(res, 1)}
                                            disabled={qty >= available}
                                            className="w-4 h-4 bg-white/20 hover:bg-white/40 disabled:opacity-30 rounded font-bold text-[9px] text-white transition-colors"
                                        >+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Get column */}
                <div className="bg-[#ebd8b7] p-2 rounded-lg border border-emerald-900/50">
                    <h3 className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 text-center">Get</h3>
                    <div className="space-y-1">
                        {RESOURCES.map(res => {
                            const qty = request[res as keyof typeof request] || 0;
                            const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                            return (
                                <div
                                    key={res}
                                    className="relative flex justify-between items-center px-1.5 py-1 rounded border border-black/30 shadow-sm overflow-hidden"
                                    style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}
                                >
                                    {RESOURCE_TEXTURES[res] && (
                                        <div
                                            className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay"
                                            style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                        />
                                    )}
                                    <span className="relative z-10 text-[9px] font-bold text-white drop-shadow-sm">{res}</span>
                                    <div className="relative z-10 flex gap-1 items-center bg-black/40 rounded px-1 py-0.5">
                                        <button
                                            onClick={() => updateRequest(res, -1)}
                                            className="w-4 h-4 bg-white/20 hover:bg-white/40 rounded font-bold text-[9px] text-white transition-colors"
                                        >-</button>
                                        <span className="w-5 text-center text-[10px] font-bold text-white">{qty}</span>
                                        <button
                                            onClick={() => updateRequest(res, 1)}
                                            className="w-4 h-4 bg-white/20 hover:bg-white/40 rounded font-bold text-[9px] text-white transition-colors"
                                        >+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Bank trade validation hint ── */}
            {(() => {
                const giveLots = RESOURCES.reduce((sum, res) => sum + Math.floor((offer[res] || 0) / rates[res]), 0);
                const getSlots = RESOURCES.reduce((sum, res) => sum + (request[res] || 0), 0);
                if (giveLots > 0 || getSlots > 0) {
                    const mismatch = giveLots !== getSlots;
                    return (
                        <div className={`text-[8px] text-center font-bold ${mismatch ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {mismatch
                                ? `Bank: ${giveLots} lot${giveLots !== 1 ? 's' : ''} offered → ${getSlots} resource${getSlots !== 1 ? 's' : ''} requested (need equal amounts)`
                                : `Bank trade ready: ${giveLots} → ${getSlots} ✓`}
                        </div>
                    );
                }
                return null;
            })()}

            {/* ── Action Buttons ── */}
            <div className="flex gap-2">
                {/* Propose to Players */}
                <button
                    onClick={handleProposeTrade}
                    disabled={!canPropose || totalOfferQty === 0 || totalReqQty === 0}
                    className="flex-1 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-bold uppercase tracking-wider text-[9px] transition-colors shadow"
                >
                    👥 Propose to Players
                </button>

                {/* Trade with Bank */}
                <button
                    onClick={handleBankTrade}
                    disabled={!canPropose || !bankTradeExecutable()}
                    className="flex-1 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-bold uppercase tracking-wider text-[9px] transition-colors shadow"
                >
                    🏦 Trade with Bank
                </button>
            </div>
        </div>
    );
};
