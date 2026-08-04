import React from 'react';
import { type GameState, type PlayerState } from '../../game/GameState';
import { RESOURCE_ICONS, RESOURCE_TEXTURES, RESOURCE_GRADIENTS } from '../GameScreen';
import { TradeProposalPanel } from './TradeProposalPanel';
import { TradeModal } from '../TradeModal';

interface MobileTradeTabProps {
    gameState: GameState;
    myPlayer: PlayerState;
    map: any;
    isMyTurn: boolean;
    isSetupPhase: boolean;
    tradeModalConfig: any;
    handleFinalizeTrade: (peerId: string) => void;
    handleCancelTrade: () => void;
    handleAcceptTrade: () => void;
    handleRejectTrade: () => void;
    handleBankTrade: (giveRes: string, giveAmount: number, getRes: string) => void;
    handleProposeTrade: (offer: any, request: any) => void;
}

export const MobileTradeTab: React.FC<MobileTradeTabProps> = ({
    gameState,
    myPlayer,
    map,
    isMyTurn,
    isSetupPhase,
    tradeModalConfig,
    handleFinalizeTrade,
    handleCancelTrade,
    handleAcceptTrade,
    handleRejectTrade,
    handleBankTrade,
    handleProposeTrade,
}) => {
    return (
        <div className="p-2 flex flex-col gap-3">
            {/* ── My Resources summary (compact) ── */}
            <div className="bg-[#f4e6cd]/90 rounded-lg border border-[#d3be9a] shadow px-2 py-1.5 flex items-center gap-1 flex-wrap">
                <span className="text-[9px] font-black text-[#7d6549] uppercase tracking-wider shrink-0 mr-0.5">My resources:</span>
                {Object.entries(myPlayer.resources)
                    .filter(([res]) => res !== 'NUGGETS' || map.hexes.some((h: any) => h.resource === 'NUGGETS'))
                    .map(([res, count]) => {
                        const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                        return (
                            <div key={res} className={`relative flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-black/20 overflow-hidden shrink-0 transition-opacity ${count === 0 ? 'opacity-30' : ''}`}
                                style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}>
                                {RESOURCE_TEXTURES[res] && <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-40 mix-blend-overlay" style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }} />}
                                <img src={RESOURCE_ICONS[res as keyof typeof RESOURCE_ICONS]} alt={res} className="relative z-10 w-3 h-3" />
                                <span className="relative z-10 text-[10px] font-black text-white leading-none">{count}</span>
                            </div>
                        );
                    })}
            </div>

            {/* P2P Trade Proposal (Reusing TradeProposalPanel for mobile) */}
            <TradeProposalPanel
                gameState={gameState}
                myPlayer={myPlayer}
                handleFinalizeTrade={handleFinalizeTrade}
                handleCancelTrade={handleCancelTrade}
                handleAcceptTrade={handleAcceptTrade}
                handleRejectTrade={handleRejectTrade}
            />

            <div className="bg-[#f4e6cd] rounded-xl border-2 border-[#d3be9a] shadow p-3">
                <TradeModal
                    gameState={gameState}
                    myPlayerId={myPlayer.peerId}
                    map={map}
                    onClose={() => { /* no-op on mobile: tab switching handled by nav bar */ }}
                    onBankTrade={handleBankTrade}
                    onProposeTrade={handleProposeTrade}
                    canPropose={isMyTurn && gameState.phase !== 'ROLL' && !isSetupPhase}
                    initialOffer={tradeModalConfig.initialOffer}
                />
            </div>
        </div>
    );
};
