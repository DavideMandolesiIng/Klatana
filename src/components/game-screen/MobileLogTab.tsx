import React from 'react';
import { type GameState, type PlayerState } from '../../game/GameState';

interface MobileLogTabProps {
    gameState: GameState;
    myPlayer: PlayerState | undefined;
}

export const MobileLogTab: React.FC<MobileLogTabProps> = ({ gameState, myPlayer }) => {
    return (
        <div className="p-2 h-full">
            <div className="bg-[#f4e6cd]/90 backdrop-blur-sm rounded-xl border border-[#d3be9a] shadow-inner p-2 flex flex-col-reverse gap-0.5 text-[11px] font-medium text-[#2c1d10]">
                {[...gameState.logs].reverse().map((log, i) => {
                    if (log.includes('|STEAL|')) {
                        const [msg, , stealerId, targetId, resource] = log.split('|');
                        const canSee = myPlayer?.peerId === stealerId || myPlayer?.peerId === targetId;
                        return (
                            <div key={i} className="border-b border-[#d3be9a]/60 pb-1 last:border-0">
                                {canSee ? msg.replace('a resource', `1 ${resource}`) : msg}
                            </div>
                        );
                    }
                    return (
                        <div key={i} className="border-b border-[#d3be9a]/60 pb-1 last:border-0">
                            {log}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
