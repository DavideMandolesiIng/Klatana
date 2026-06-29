import React, { useState, useEffect, useMemo } from 'react';
import { GameBoard } from './GameBoard';
import { type MapTemplate } from '../game/mapTemplates';
import { type PlayerData, PLAYER_COLORS } from '../game/Player';
import { peerService } from '../network/PeerService';
import { type GameState, createInitialGameState, rollDice, distributeResources, validateSettlementPlacement, validateRoadPlacement, getStartingResources, advanceSetupTurn, getValidRoadPlacements, getValidSettlementPlacements, BUILD_COSTS, canAfford } from '../game/GameState';
import { HexMath } from '../game/HexMath';

export const GameScreen: React.FC<{ map: MapTemplate, initialPlayers: PlayerData[] }> = ({ map, initialPlayers }) => {
    const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(initialPlayers, map));
    const [buildMode, setBuildMode] = useState<'NONE' | 'SETTLEMENT' | 'ROAD' | 'CITY'>('NONE');
    const [discardSelection, setDiscardSelection] = useState<Partial<Record<string, number>>>({});
    const [abundancePicks, setAbundancePicks] = useState<string[]>([]);

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

    const [activeCardContext, setActiveCardContext] = useState<'MONOPOLY' | 'ABUNDANCE' | null>(null);

    const handleEndTurn = () => {
        if (!isMyTurn || gameState.phase === 'ROLL' || gameState.gamePhase !== 'MAIN_GAME') return;
        
        const nextIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
        const nextPlayer = gameState.players[nextIndex];
        
        const newPlayers = [...gameState.players];
        const myIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        if (myIndex !== -1) {
            newPlayers[myIndex] = {
                ...newPlayers[myIndex],
                actionCards: newPlayers[myIndex].actionCards.map(c => ({ ...c, boughtThisTurn: false }))
            };
        }

        const newState: GameState = {
            ...gameState,
            players: newPlayers,
            currentTurnIndex: nextIndex,
            phase: 'ROLL',
            diceRoll: null,
            activeTurnPlayedCard: false,
            logs: [...gameState.logs, `${currentPlayer.username} ended their turn. It is now ${nextPlayer.username}'s turn.`]
        };
        
        setBuildMode('NONE');
        broadcastState(newState);
    };

    const handleBuyCard = () => {
        if (!isMyTurn || gameState.phase === 'ROLL' || !canAffordCard || gameState.actionCardDeck.length === 0) return;

        const newPlayers = [...gameState.players];
        const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        const updatedPlayer = { 
            ...newPlayers[playerIndex], 
            resources: { ...newPlayers[playerIndex].resources },
            actionCards: [...newPlayers[playerIndex].actionCards]
        };

        Object.entries(BUILD_COSTS.ACTION_CARD).forEach(([res, count]) => {
            updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= count;
        });

        const newDeck = [...gameState.actionCardDeck];
        const drawnCard = newDeck.pop()!;
        updatedPlayer.actionCards.push({ type: drawnCard, boughtThisTurn: true });

        newPlayers[playerIndex] = updatedPlayer;

        broadcastState({
            ...gameState,
            players: newPlayers,
            actionCardDeck: newDeck,
            logs: [...gameState.logs, `${myPlayer!.username} bought an Action Card.`]
        });
    };

    const handlePlayCard = (cardIndex: number) => {
        if (!isMyTurn || gameState.phase === 'ROLL' || gameState.activeTurnPlayedCard) return;

        const card = myPlayer!.actionCards[cardIndex];
        if (card.boughtThisTurn && card.type !== 'MONUMENT') {
            alert("You cannot play a card on the turn you bought it.");
            return;
        }
        if (card.type === 'MONUMENT') return; // Passive

        const newPlayers = [...gameState.players];
        const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        const updatedPlayer = { 
            ...newPlayers[playerIndex], 
            actionCards: newPlayers[playerIndex].actionCards.filter((_, i) => i !== cardIndex)
        };
        newPlayers[playerIndex] = updatedPlayer;

        let newState: GameState = {
            ...gameState,
            players: newPlayers,
            activeTurnPlayedCard: true,
            logs: [...gameState.logs, `${myPlayer!.username} played a ${card.type} card!`]
        };

        if (card.type === 'NINJA') {
            newState.gamePhase = 'NINJA_MOVE';
            broadcastState(newState);
        } else if (card.type === 'RAPID_EXPANSION') {
            newState.gamePhase = 'FREE_ROAD_BUILDING';
            newState.freeRoadsLeft = 2;
            broadcastState(newState);
        } else if (card.type === 'MONOPOLY' || card.type === 'ABUNDANCE') {
            setActiveCardContext(card.type);
            broadcastState(newState);
        }
    };

    const isSetupPhase = gameState.gamePhase === 'SETUP_1' || gameState.gamePhase === 'SETUP_2';
    const activeBuildMode = isSetupPhase ? (gameState.setupAction || 'NONE') : buildMode;

    const canAffordRoad = isSetupPhase || (myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.ROAD) && myPlayer.inventory.availableRoads > 0);
    const canAffordSettlement = isSetupPhase || (myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.SETTLEMENT) && myPlayer.inventory.availableSettlements > 0);
    const canAffordCity = !isSetupPhase && myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.CITY) && myPlayer.inventory.availableCities > 0;
    const canAffordCard = !isSetupPhase && myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.ACTION_CARD);

    // Pre-compute valid placements for UI highlighting (derived from authoritative validation)
    const { allEdgeIds, allNodeIds } = useMemo(() => {
        const nodeSet = new Map<string, boolean>();
        const edgeSet = new Map<string, boolean>();
        map.hexes.forEach(hex => {
            HexMath.hexNodes(hex.coords, 55).forEach(n => nodeSet.set(n.id, true));
            HexMath.hexEdges(hex.coords, 55).forEach(e => edgeSet.set(e.id, true));
        });
        return {
            allEdgeIds: Array.from(edgeSet.keys()),
            allNodeIds: Array.from(nodeSet.keys())
        };
    }, [map]);

    const validRoadEdges = useMemo(() => {
        if (!myPlayer || activeBuildMode !== 'ROAD' || !isMyTurn) return new Set<string>();
        return getValidRoadPlacements(gameState, myPlayer.peerId, allEdgeIds);
    }, [gameState, myPlayer, activeBuildMode, allEdgeIds, isMyTurn]);

    const validSettlementNodes = useMemo(() => {
        if (!myPlayer || activeBuildMode !== 'SETTLEMENT' || !isMyTurn) return new Set<string>();
        return getValidSettlementPlacements(gameState, myPlayer.peerId, allNodeIds);
    }, [gameState, myPlayer, activeBuildMode, allNodeIds, isMyTurn]);

    const validCityNodes = useMemo(() => {
        if (!myPlayer || activeBuildMode !== 'CITY' || !isMyTurn) return new Set<string>();
        const nodes = new Set<string>();
        Object.values(gameState.settlements).forEach(s => {
            if (s.ownerId === myPlayer.peerId && !s.isCity) {
                nodes.add(s.nodeId);
            }
        });
        return nodes;
    }, [gameState, myPlayer, activeBuildMode, isMyTurn]);

    const handleNodeClick = (nodeId: string) => {
        if (!isMyTurn) return;

        if (activeBuildMode === 'CITY') {
            const settlement = gameState.settlements[nodeId];
            if (!settlement || settlement.ownerId !== myPlayer!.peerId || settlement.isCity) return;

            const newPlayers = [...gameState.players];
            const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
            const updatedPlayer = { 
                ...newPlayers[playerIndex], 
                resources: { ...newPlayers[playerIndex].resources },
                inventory: { 
                    ...newPlayers[playerIndex].inventory, 
                    availableCities: newPlayers[playerIndex].inventory.availableCities - 1, 
                    availableSettlements: newPlayers[playerIndex].inventory.availableSettlements + 1 
                }
            };

            Object.entries(BUILD_COSTS.CITY).forEach(([res, count]) => {
                updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= count;
            });
            newPlayers[playerIndex] = updatedPlayer;

            const newState: GameState = {
                ...gameState,
                players: newPlayers,
                settlements: {
                    ...gameState.settlements,
                    [nodeId]: { ...settlement, isCity: true }
                },
                logs: [...gameState.logs, `${currentPlayer.username} upgraded a settlement to a City.`]
            };
            setBuildMode('NONE');
            broadcastState(newState);
            return;
        }

        if (activeBuildMode !== 'SETTLEMENT') return;
        
        const validation = validateSettlementPlacement(gameState, nodeId, myPlayer!.peerId);
        if (!validation.valid) {
            alert(validation.reason);
            return;
        }

        const newPlayers = [...gameState.players];
        const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        const updatedPlayer = { 
            ...newPlayers[playerIndex], 
            resources: { ...newPlayers[playerIndex].resources },
            inventory: { 
                ...newPlayers[playerIndex].inventory, 
                availableSettlements: newPlayers[playerIndex].inventory.availableSettlements - 1 
            }
        };

        if (!isSetupPhase) {
            Object.entries(BUILD_COSTS.SETTLEMENT).forEach(([res, count]) => {
                updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= count;
            });
        }
        newPlayers[playerIndex] = updatedPlayer;

        const newState: GameState = {
            ...gameState,
            players: newPlayers,
            settlements: {
                ...gameState.settlements,
                [nodeId]: { ownerId: myPlayer!.peerId, isCity: false, nodeId }
            },
            logs: [...gameState.logs, `${currentPlayer.username} placed a settlement.`]
        };

        if (isSetupPhase) {
            newState.lastBuiltNodeId = nodeId;
            newState.setupAction = 'ROAD';
            if (gameState.gamePhase === 'SETUP_2') {
                const gained = getStartingResources(newState, nodeId, map);
                Object.entries(gained).forEach(([res, count]) => {
                    newState.players[newState.currentTurnIndex].resources[res as any] += count;
                });
                newState.logs.push(`${currentPlayer.username} received starting resources.`);
            }
        } else {
            setBuildMode('NONE');
        }

        broadcastState(newState);
    };

    const handleEdgeClick = (edgeId: string) => {
        if (activeBuildMode !== 'ROAD' || !isMyTurn) return;
        
        const validation = validateRoadPlacement(gameState, edgeId, myPlayer!.peerId);
        if (!validation.valid) {
            alert(validation.reason);
            return;
        }
        
        const newPlayers = [...gameState.players];
        const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        const updatedPlayer = { 
            ...newPlayers[playerIndex], 
            resources: { ...newPlayers[playerIndex].resources },
            inventory: { 
                ...newPlayers[playerIndex].inventory, 
                availableRoads: newPlayers[playerIndex].inventory.availableRoads - 1 
            }
        };

        if (!isSetupPhase && gameState.gamePhase !== 'FREE_ROAD_BUILDING') {
            Object.entries(BUILD_COSTS.ROAD).forEach(([res, count]) => {
                updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= count;
            });
        }
        newPlayers[playerIndex] = updatedPlayer;
        
        let newState: GameState = {
            ...gameState,
            players: newPlayers,
            roads: {
                ...gameState.roads,
                [edgeId]: { ownerId: myPlayer!.peerId, edgeId }
            },
            logs: [...gameState.logs, `${currentPlayer.username} built a road.`]
        };

        if (isSetupPhase) {
            newState = advanceSetupTurn(newState);
        } else if (gameState.gamePhase === 'FREE_ROAD_BUILDING') {
            newState.freeRoadsLeft -= 1;
            if (newState.freeRoadsLeft <= 0) {
                newState.gamePhase = 'MAIN_GAME';
                setBuildMode('NONE');
            }
        } else {
            setBuildMode('NONE');
        }

        broadcastState(newState);
    };

    const handleDiscard = () => {
        if (!myPlayer) return;
        const totalCards = Object.values(myPlayer.resources).reduce((a,b)=>a+b,0);
        const required = Math.floor(totalCards / 2);
        const selected = Object.values(discardSelection).reduce((a,b)=>(a||0)+(b||0),0);
        if (selected !== required) return;

        const newPlayers = [...gameState.players];
        const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer.peerId);
        const updatedPlayer = { ...newPlayers[playerIndex], resources: { ...newPlayers[playerIndex].resources } };
        
        Object.entries(discardSelection).forEach(([res, count]) => {
            updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= (count || 0);
        });
        newPlayers[playerIndex] = updatedPlayer;

        const newDiscarders = gameState.playersNeedingToDiscard.filter(id => id !== myPlayer.peerId);
        const newState: GameState = {
            ...gameState,
            players: newPlayers,
            playersNeedingToDiscard: newDiscarders,
            gamePhase: newDiscarders.length === 0 ? 'NINJA_MOVE' : 'NINJA_DISCARD',
            logs: [...gameState.logs, `${myPlayer.username} discarded ${required} resources.`]
        };
        broadcastState(newState);
        setDiscardSelection({});
    };

    const handleSteal = (targetPeerId: string) => {
        const newPlayers = [...gameState.players];
        const targetIndex = newPlayers.findIndex(p => p.peerId === targetPeerId);
        const myIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        const targetPlayer = { ...newPlayers[targetIndex], resources: { ...newPlayers[targetIndex].resources } };
        const updatedMe = { ...newPlayers[myIndex], resources: { ...newPlayers[myIndex].resources } };

        // Pick random resource from target
        const available = Object.entries(targetPlayer.resources).filter(([_, count]) => count > 0).map(([res]) => res);
        if (available.length > 0) {
            const stolenRes = available[Math.floor(Math.random() * available.length)] as keyof typeof targetPlayer.resources;
            targetPlayer.resources[stolenRes] -= 1;
            updatedMe.resources[stolenRes] += 1;
        }

        newPlayers[targetIndex] = targetPlayer;
        newPlayers[myIndex] = updatedMe;

        const newState: GameState = {
            ...gameState,
            players: newPlayers,
            gamePhase: 'MAIN_GAME',
            logs: [...gameState.logs, `${myPlayer!.username} stole a resource from ${targetPlayer.username}.`]
        };
        broadcastState(newState);
    };

    const handleHexClick = (q: number, r: number) => {
        if (gameState.gamePhase !== 'NINJA_MOVE' || !isMyTurn) return;
        
        // Find adjacent settlements
        const hexNodeIds = HexMath.getHexNodeIds({q, r});
        const adjacentOpponents = new Set<string>();
        hexNodeIds.forEach(nId => {
            const s = gameState.settlements[nId];
            if (s && s.ownerId !== myPlayer!.peerId) {
                adjacentOpponents.add(s.ownerId);
            }
        });

        let newState = {
            ...gameState,
            ninjaHexCoords: { q, r },
            logs: [...gameState.logs, `${currentPlayer.username} moved the Ninja.`]
        };

        if (adjacentOpponents.size > 0) {
            newState.gamePhase = 'NINJA_STEAL';
        } else {
            newState.gamePhase = 'MAIN_GAME';
            newState.logs.push(`No opponents adjacent to the Ninja.`);
        }

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

            {/* NINJA DISCARD MODAL */}
            {gameState.gamePhase === 'NINJA_DISCARD' && myPlayer && gameState.playersNeedingToDiscard.includes(myPlayer.peerId) && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-2xl max-w-md w-full">
                        <h2 className="text-xl font-bold text-white mb-2 text-center uppercase tracking-wider text-red-400">Ninja Attack!</h2>
                        <p className="text-slate-300 text-sm mb-4 text-center">You have more than 7 cards. You must discard half (rounded down).</p>
                        
                        <div className="space-y-2 mb-6">
                            {Object.entries(myPlayer.resources).map(([res, count]) => {
                                const selected = discardSelection[res as keyof typeof discardSelection] || 0;
                                return (
                                    <div key={res} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700">
                                        <span className="text-sm font-bold text-slate-300 w-16">{res}</span>
                                        <span className="text-xs text-slate-500">Available: {count}</span>
                                        <div className="flex gap-2 items-center">
                                            <button onClick={() => setDiscardSelection(prev => ({...prev, [res]: Math.max(0, (prev[res as keyof typeof prev] || 0) - 1)}))} className="w-8 h-8 bg-slate-700 rounded hover:bg-slate-600 font-bold">-</button>
                                            <span className="w-4 text-center font-bold">{selected}</span>
                                            <button onClick={() => setDiscardSelection(prev => ({...prev, [res]: Math.min(count, (prev[res as keyof typeof prev] || 0) + 1)}))} className="w-8 h-8 bg-slate-700 rounded hover:bg-slate-600 font-bold">+</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {(() => {
                            const totalCards = Object.values(myPlayer.resources).reduce((a,b)=>a+b,0);
                            const required = Math.floor(totalCards / 2);
                            const selected = Object.values(discardSelection).reduce((a,b)=>(a||0)+(b||0),0);
                            return (
                                <button 
                                    onClick={handleDiscard}
                                    disabled={selected !== required}
                                    className={`w-full py-3 rounded-xl font-bold shadow-lg transition-colors border text-sm uppercase tracking-wider ${selected === required ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 opacity-50 cursor-not-allowed'}`}
                                >
                                    Discard ({selected} / {required})
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* NINJA STEAL MODAL */}
            {gameState.gamePhase === 'NINJA_STEAL' && isMyTurn && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-2xl max-w-sm w-full">
                        <h2 className="text-xl font-bold text-white mb-2 text-center uppercase tracking-wider text-emerald-400">Steal Resource</h2>
                        <p className="text-slate-300 text-sm mb-6 text-center">Choose an opponent adjacent to the Ninja to steal from.</p>
                        <div className="space-y-3">
                            {(() => {
                                const hexNodeIds = HexMath.getHexNodeIds(gameState.ninjaHexCoords);
                                const adjacentOpponents = new Set<string>();
                                hexNodeIds.forEach(nId => {
                                    const s = gameState.settlements[nId];
                                    if (s && s.ownerId !== myPlayer!.peerId) {
                                        adjacentOpponents.add(s.ownerId);
                                    }
                                });
                                return Array.from(adjacentOpponents).map(oppId => {
                                    const opp = gameState.players.find(p => p.peerId === oppId);
                                    if (!opp) return null;
                                    const oppCards = Object.values(opp.resources).reduce((a,b)=>a+b,0);
                                    return (
                                        <button 
                                            key={opp.peerId}
                                            onClick={() => handleSteal(opp.peerId)}
                                            disabled={oppCards === 0}
                                            className={`w-full py-3 px-4 flex justify-between items-center rounded-xl font-bold border transition-colors shadow-sm ${oppCards > 0 ? 'bg-slate-700 hover:bg-slate-600 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed'}`}
                                        >
                                            <span>{opp.username}</span>
                                            <span className="text-xs">{oppCards} Cards</span>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}
            
            {/* ACTION CARD MODALS */}
            {activeCardContext === 'MONOPOLY' && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-2xl max-w-sm w-full">
                        <h2 className="text-xl font-bold text-white mb-2 text-center uppercase tracking-wider text-indigo-400">Monopoly</h2>
                        <p className="text-slate-300 text-sm mb-6 text-center">Choose a resource to steal from all players.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {['WOOD', 'CLAY', 'WHEAT', 'WOOL', 'ORE'].map(res => (
                                <button 
                                    key={res}
                                    onClick={() => {
                                        const newPlayers = [...gameState.players];
                                        let totalStolen = 0;
                                        newPlayers.forEach((p, idx) => {
                                            if (p.peerId !== myPlayer!.peerId) {
                                                const amount = p.resources[res as keyof typeof p.resources];
                                                totalStolen += amount;
                                                newPlayers[idx] = { ...p, resources: { ...p.resources, [res]: 0 } };
                                            }
                                        });
                                        const myIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
                                        const myRes = newPlayers[myIndex].resources;
                                        const resKey = res as keyof typeof myRes;
                                        newPlayers[myIndex] = { 
                                            ...newPlayers[myIndex], 
                                            resources: { ...myRes, [resKey]: myRes[resKey] + totalStolen } 
                                        };
                                        broadcastState({
                                            ...gameState,
                                            players: newPlayers,
                                            logs: [...gameState.logs, `${myPlayer!.username} played Monopoly and took ${totalStolen} ${res}!`]
                                        });
                                        setActiveCardContext(null);
                                    }}
                                    className="py-3 px-4 rounded-xl font-bold border transition-colors bg-slate-700 hover:bg-slate-600 border-slate-500 text-white"
                                >
                                    {res}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeCardContext === 'ABUNDANCE' && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-2xl max-w-sm w-full">
                        <h2 className="text-xl font-bold text-white mb-2 text-center uppercase tracking-wider text-indigo-400">Abundance</h2>
                        <p className="text-slate-300 text-sm mb-6 text-center">Pick {2 - abundancePicks.length} resource(s) from the bank.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {['WOOD', 'CLAY', 'WHEAT', 'WOOL', 'ORE'].map(res => (
                                <button 
                                    key={res}
                                    onClick={() => {
                                        const newPicks = [...abundancePicks, res];
                                        if (newPicks.length === 2) {
                                            const newPlayers = [...gameState.players];
                                            const myIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
                                            const updatedMe = { ...newPlayers[myIndex], resources: { ...newPlayers[myIndex].resources } };
                                            newPicks.forEach(r => { updatedMe.resources[r as keyof typeof updatedMe.resources] += 1; });
                                            newPlayers[myIndex] = updatedMe;
                                            broadcastState({
                                                ...gameState,
                                                players: newPlayers,
                                                logs: [...gameState.logs, `${myPlayer!.username} played Abundance and took 2 resources.`]
                                            });
                                            setActiveCardContext(null);
                                            setAbundancePicks([]);
                                        } else {
                                            setAbundancePicks(newPicks);
                                        }
                                    }}
                                    className="py-3 px-4 rounded-xl font-bold border transition-colors bg-slate-700 hover:bg-slate-600 border-slate-500 text-white"
                                >
                                    {res}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
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
                        <button className="w-full py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors opacity-50 cursor-not-allowed border border-slate-600" title="Not implemented yet">
                            Trade
                        </button>
                    </div>

                    {/* Action Cards Box */}
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg flex flex-col shrink-0 min-h-0 overflow-y-auto">
                        <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-2">Action Cards</h3>
                        <div className="flex flex-col gap-2 flex-grow">
                            {myPlayer?.actionCards.map((card, i) => (
                                <div key={i} className="bg-slate-900 p-2 rounded border border-slate-700 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{card.type}</span>
                                    {card.type !== 'MONUMENT' && (
                                        <button 
                                            onClick={() => handlePlayCard(i)} 
                                            disabled={!isMyTurn || gameState.phase === 'ROLL' || gameState.activeTurnPlayedCard || card.boughtThisTurn}
                                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Play
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={handleBuyCard}
                            disabled={!canAffordCard || gameState.actionCardDeck.length === 0 || !isMyTurn || gameState.phase === 'ROLL'}
                            className="w-full py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 border border-slate-600 flex justify-between px-2"
                        >
                            <span>Buy Card</span>
                            <span className="text-xs text-slate-400 font-normal">({gameState.actionCardDeck.length} left)</span>
                        </button>
                    </div>
                </div>

                {/* Main Board Area */}
                <main className="flex-grow flex flex-col items-center justify-center bg-slate-800 rounded-xl border border-slate-700 shadow-xl relative overflow-hidden min-w-0">
                    <GameBoard 
                        template={map} 
                        gameState={gameState} 
                        buildMode={activeBuildMode}
                        validRoadEdges={validRoadEdges}
                        validSettlementNodes={validSettlementNodes}
                        validCityNodes={validCityNodes}
                        onNodeClick={handleNodeClick} 
                        onEdgeClick={handleEdgeClick}
                        onHexClick={handleHexClick}
                    />
                    
                    {/* Top-Left Floating Info: Turn and Phase */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
                        <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur rounded-lg text-xs font-bold shadow-lg border border-slate-700">
                            <span className="text-slate-400 uppercase tracking-wider mr-2">Turn:</span>
                            <span className="text-white" style={{color: currentPlayer ? PLAYER_COLORS[currentPlayer.color as any].hex : 'white'}}>{currentPlayer?.username}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur rounded-lg text-xs font-bold shadow-lg border border-slate-700">
                            <span className="text-slate-400 uppercase tracking-wider mr-2">Phase:</span>
                            <span className="text-emerald-400 uppercase">{isSetupPhase ? gameState.gamePhase : gameState.phase}</span>
                        </div>
                        {activeBuildMode !== 'NONE' && (
                            <div className="px-3 py-1.5 bg-indigo-900/80 backdrop-blur rounded-lg text-xs font-bold shadow-lg border border-indigo-500 animate-pulse text-indigo-200">
                                BUILDING {activeBuildMode}...
                            </div>
                        )}
                    </div>

                    {/* Floating Controls (Roll/Build/End Turn) - Bottom Right inside Main Area */}
                    <div className="absolute bottom-6 right-6 flex gap-3 z-10">
                        {isMyTurn ? (
                            isSetupPhase ? (
                                <div className="px-6 py-3 bg-indigo-900/90 backdrop-blur-sm rounded-xl text-sm font-bold text-indigo-200 shadow-xl border border-indigo-500 animate-pulse">
                                    PLACE {gameState.setupAction}
                                </div>
                            ) : (
                                <>
                                    {gameState.phase === 'ROLL' ? (
                                        <button onClick={handleRollDice} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold shadow-2xl transition-colors border border-indigo-400 text-sm uppercase tracking-wider">
                                            Roll Dice
                                        </button>
                                    ) : (
                                        <>
                                            {buildMode !== 'NONE' ? (
                                                <button onClick={() => setBuildMode('NONE')} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors shadow-xl border border-slate-600 text-sm uppercase tracking-wider">
                                                    Cancel Build
                                                </button>
                                            ) : (
                                                <>
                                                    <button onClick={() => setBuildMode('SETTLEMENT')} disabled={!canAffordSettlement} className={`px-6 py-3 rounded-xl font-bold transition-colors shadow-xl border text-sm uppercase tracking-wider ${canAffordSettlement ? 'bg-slate-700 hover:bg-slate-600 border-slate-600' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'}`}>
                                                        Settlement
                                                    </button>
                                                    <button onClick={() => setBuildMode('CITY')} disabled={!canAffordCity} className={`px-6 py-3 rounded-xl font-bold transition-colors shadow-xl border text-sm uppercase tracking-wider ${canAffordCity ? 'bg-slate-700 hover:bg-slate-600 border-slate-600' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'}`}>
                                                        City
                                                    </button>
                                                    <button onClick={() => setBuildMode('ROAD')} disabled={!canAffordRoad} className={`px-6 py-3 rounded-xl font-bold transition-colors shadow-xl border text-sm uppercase tracking-wider ${canAffordRoad ? 'bg-slate-700 hover:bg-slate-600 border-slate-600' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'}`}>
                                                        Road
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={handleEndTurn} disabled={gameState.gamePhase !== 'MAIN_GAME'} className={`px-6 py-3 rounded-xl font-bold shadow-2xl transition-colors border text-sm uppercase tracking-wider ${gameState.gamePhase === 'MAIN_GAME' ? 'bg-red-600 hover:bg-red-500 border-red-400' : 'bg-red-800 border-red-700 opacity-50 cursor-not-allowed'}`}>
                                                End Turn
                                            </button>
                                        </>
                                    )}
                                </>
                            )
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
