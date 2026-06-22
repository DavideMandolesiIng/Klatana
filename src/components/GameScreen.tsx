import React from 'react';
import { GameBoard } from './GameBoard';
import { type MapTemplate } from '../game/mapTemplates';

export const GameScreen: React.FC<{ map: MapTemplate }> = ({ map }) => {
    return (
        <div className="min-h-screen bg-slate-900 p-4 flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex-grow flex flex-col">
                <header className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                    <h1 className="text-2xl font-bold text-white tracking-widest uppercase">Hexagonal Realms</h1>
                    <div className="text-slate-400 font-medium">Phase 2: Board Rendering</div>
                </header>
                
                <main className="flex-grow flex items-center justify-center p-4 bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative">
                    <GameBoard template={map} />
                </main>
            </div>
        </div>
    );
};
