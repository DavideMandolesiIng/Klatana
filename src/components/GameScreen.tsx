import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GameBoard } from './GameBoard';
import { type MapTemplate } from '../game/mapTemplates';
import { type PlayerData, PLAYER_COLORS } from '../game/Player';
import { peerService } from '../network/PeerService';
import { type GameState, createInitialGameState, rollDice, distributeResources, validateHousePlacement, validatestreetPlacement, getStartingResources, advanceSetupTurn, getValidStreetPlacements, getValidHousePlacements, BUILD_COSTS, canAfford, calculateScores, type ResourceCounts, getLongestStreetForPlayer, type GameSettings, createDiceDeck, getPlayerTradeRates } from '../game/GameState';
import { HexMath } from '../game/HexMath';
import { TradeModal } from './TradeModal';
import { useSounds } from '../context/SoundContext';

import tableBg from '../assets/textures/table-background.jpeg';
import clayTexture from '../assets/textures/clay-texture.jpeg';
import woodTexture from '../assets/textures/wood-texture-1.jpeg';
import woolTexture from '../assets/textures/wool-texture.jpeg';
import wheatTexture from '../assets/textures/wheat-texture-1.jpeg';

export const RESOURCE_TEXTURES: Record<string, string> = {
    OAK: woodTexture,
    CLAY: clayTexture,
    CEREALS: wheatTexture,
    WOOL: woolTexture,
};

import oakIcon from '../assets/icons/resources/oak_icon.png';
import clayIcon from '../assets/icons/resources/clay_icon.png';
import oreIcon from '../assets/icons/resources/ore_icon.png';
import woolIcon from '../assets/icons/resources/wool_icon.png';
import cerealIcon from '../assets/icons/resources/cereal_icon.png';
import nuggetsIcon from '../assets/icons/resources/nuggets_icon.png';

const RESOURCE_ICONS: Record<string, string> = {
    OAK: oakIcon,
    CLAY: clayIcon,
    ORE: oreIcon,
    WOOL: woolIcon,
    CEREALS: cerealIcon,
    NUGGETS: nuggetsIcon
};

export const RESOURCE_GRADIENTS: Record<string, { center: string, edge: string }> = {
    OAK: { center: '#0a805f', edge: '#033b2b' },
    CLAY: { center: '#d14a11', edge: '#7d2604' },
    CEREALS: { center: '#f2d488', edge: '#c29f46' },
    WOOL: { center: '#9ae823', edge: '#5c910d' },
    ORE: { center: '#5f7087', edge: '#293442' },
    NUGGETS: { center: '#fad05c', edge: '#ad6900' }
};

export type AnimationEvent = 'TRADE' | 'BUILD' | 'YIELD';
export type ResourceDiff = { res: string; diff: number };

export const GameScreen: React.FC<{ map: MapTemplate, initialPlayers: PlayerData[], settings: GameSettings, initialGameState?: GameState, onReturnToLobby?: () => void }> = ({ map, initialPlayers, settings, initialGameState, onReturnToLobby }) => {
    const [gameState, setGameState] = useState<GameState>(() => initialGameState || createInitialGameState(initialPlayers, map, settings));
    const [buildMode, setBuildMode] = useState<'NONE' | 'HOUSE' | 'street' | 'FORTRESS'>('NONE');
    const [discardSelection, setDiscardSelection] = useState<Partial<Record<string, number>>>({});
    const [abundancePicks, setAbundancePicks] = useState<string[]>([]);
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [tradeModalConfig, setTradeModalConfig] = useState<{
        initialOffer?: Partial<ResourceCounts>;
    }>({});
    const [showBankPanel, setShowBankPanel] = useState(true);
    const [showBuildCosts, setShowBuildCosts] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [pendingBuild, setPendingBuild] = useState<{ type: 'HOUSE' | 'street' | 'FORTRESS' | 'ACTION_CARD', id: string, costText: string } | null>(null);
    const [dismissedNotificationPhase, setDismissedNotificationPhase] = useState<string | null>(null);
    const { playRoll, playTurn, playBuild, playTrade, playWin, playLose, playNinja, playClick, playCard, playDiscard, playCoins, playCollect, playDisconnect, playConnect } = useSounds();

    const [recentAnimations, setRecentAnimations] = useState<{ id: string; event: AnimationEvent; diffs: ResourceDiff[] }[]>([]);
    const prevResources = useRef<ResourceCounts | null>(null);

    useEffect(() => {
        if (dismissedNotificationPhase !== null && gameState.gamePhase !== dismissedNotificationPhase) {
            setDismissedNotificationPhase(null);
        }
    }, [gameState.gamePhase, dismissedNotificationPhase]);

    useEffect(() => {
        peerService.onMessage((data, _peerId) => {
            if (data.type === 'GAME_STATE_UPDATE') {
                setGameState(prev => {
                    let nextState = data.state;
                    if (prev.tradeProposal && nextState.tradeProposal && prev.tradeProposal.proposerId === nextState.tradeProposal.proposerId) {
                        nextState = {
                            ...nextState,
                            tradeProposal: {
                                ...nextState.tradeProposal,
                                acceptedBy: prev.tradeProposal.acceptedBy,
                                declinedBy: prev.tradeProposal.declinedBy
                            }
                        };
                    }

                    // Host must re-broadcast state updates from clients to all other clients
                    if (peerService.role === 'host') {
                        setTimeout(() => peerService.broadcast({ type: 'GAME_STATE_UPDATE', state: nextState }), 0);
                    }
                    return nextState;
                });
            } else if (data.type === 'TRADE_RESPONSE') {
                setGameState(prev => {
                    if (!prev.tradeProposal) return prev;

                    const acceptedBy = prev.tradeProposal.acceptedBy.filter(id => id !== data.peerId);
                    const declinedBy = (prev.tradeProposal.declinedBy || []).filter(id => id !== data.peerId);

                    if (data.response === 'ACCEPT') acceptedBy.push(data.peerId);
                    if (data.response === 'REJECT') declinedBy.push(data.peerId);

                    const nextState = {
                        ...prev,
                        tradeProposal: {
                            ...prev.tradeProposal,
                            acceptedBy,
                            declinedBy
                        }
                    };

                    if (peerService.role === 'host') {
                        setTimeout(() => peerService.broadcast(data), 0);
                    }
                    return nextState;
                });
            }
        });

        if (peerService.role === 'host') {
            peerService.onPeerDisconnect((disconnectedPeerId) => {
                setGameState(prev => {
                    const p = prev.players.find(x => x.peerId === disconnectedPeerId);
                    if (p && !p.isInert) {
                        const newState = {
                            ...prev,
                            isPaused: true,
                            disconnectedPlayers: [...prev.disconnectedPlayers, p.playerId || disconnectedPeerId],
                            logs: [...prev.logs, `${p.username} disconnected. Game paused.`]
                        };
                        peerService.broadcast({ type: 'GAME_STATE_UPDATE', state: newState });
                        return newState;
                    }
                    return prev;
                });
            });

            peerService.onPlayerReconnected((peerId, metadata) => {
                setGameState(prev => {
                    const incomingPlayerId = metadata?.playerId;
                    if (incomingPlayerId && prev.disconnectedPlayers.includes(incomingPlayerId)) {
                        const pIndex = prev.players.findIndex(x => x.playerId === incomingPlayerId);
                        if (pIndex !== -1) {
                            const newPlayers = [...prev.players];
                            newPlayers[pIndex] = { ...newPlayers[pIndex], peerId };
                            const newDisconnected = prev.disconnectedPlayers.filter(id => id !== incomingPlayerId);
                            const newState = {
                                ...prev,
                                players: newPlayers,
                                disconnectedPlayers: newDisconnected,
                                isPaused: newDisconnected.length > 0,
                                logs: [...prev.logs, `${newPlayers[pIndex].username} reconnected!`]
                            };
                            peerService.broadcast({ type: 'GAME_STATE_UPDATE', state: newState });
                            setTimeout(() => peerService.sendTo(peerId, { type: 'RESUME_GAME', map, players: initialPlayers, state: newState }), 100);
                            return newState;
                        }
                    } else if (metadata?.playerId) {
                        peerService.rejectConnection(peerId, 'You are not in this game or not disconnected.');
                    }
                    return prev;
                });
            });
        }
    }, []);

    const broadcastState = (newState: GameState) => {
        const scoredState = calculateScores(newState);
        setGameState(scoredState);
        peerService.broadcast({ type: 'GAME_STATE_UPDATE', state: scoredState });
    };

    const isMyTurn = gameState.players[gameState.currentTurnIndex]?.peerId === peerService.peerId;
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    const myPlayer = gameState.players.find(p => p.peerId === peerService.peerId);

    const prevGamePhase = useRef(gameState.gamePhase);
    useEffect(() => {
        if (prevGamePhase.current !== 'GAME_OVER' && gameState.gamePhase === 'GAME_OVER') {
            const isWinner = myPlayer && (myPlayer.victoryPoints + myPlayer.actionCards.filter(c => c.type === 'MONUMENT').length >= gameState.winningScore);
            if (isWinner) {
                playWin();
            } else {
                playLose();
            }
        }
        prevGamePhase.current = gameState.gamePhase;
    }, [gameState.gamePhase, myPlayer, gameState.winningScore, playWin, playLose]);

    useEffect(() => {
        if (!myPlayer) return;
        if (prevResources.current) {
            const changes: ResourceDiff[] = [];
            Object.keys(myPlayer.resources).forEach(res => {
                const diff = myPlayer.resources[res as keyof ResourceCounts] - prevResources.current![res as keyof ResourceCounts];
                if (diff !== 0) changes.push({ res, diff });
            });
            if (changes.length > 0) {
                const hasPositive = changes.some(c => c.diff > 0);
                const hasNegative = changes.some(c => c.diff < 0);
                let eventType: AnimationEvent = 'YIELD';
                if (hasPositive && hasNegative) eventType = 'TRADE';
                else if (hasNegative && !hasPositive) eventType = 'BUILD';
                else if (hasPositive && !hasNegative) eventType = 'YIELD';

                const id = Math.random().toString(36).substring(2, 9);
                if (eventType === 'TRADE') {
                    playCoins();
                } else if (eventType === 'YIELD') {
                    playCollect();
                }
                setRecentAnimations(prev => [...prev, { id, event: eventType, diffs: changes }]);
                setTimeout(() => {
                    setRecentAnimations(prev => prev.filter(anim => anim.id !== id));
                }, 2000);
            }
        }
        prevResources.current = { ...myPlayer.resources };
    }, [myPlayer?.resources]);

    const prevPhase = useRef(gameState.phase);
    useEffect(() => {
        if (prevPhase.current === 'ROLL' && gameState.phase !== 'ROLL') {
            if (gameState.diceRoll?.total === 7) {
                playNinja();
            }
        }
        prevPhase.current = gameState.phase;
    }, [gameState.phase, gameState.diceRoll?.total]);

    const prevNinjaCoords = useRef(gameState.ninjaHexCoords);
    useEffect(() => {
        if (prevNinjaCoords.current && gameState.ninjaHexCoords) {
            if (prevNinjaCoords.current.q !== gameState.ninjaHexCoords.q || prevNinjaCoords.current.r !== gameState.ninjaHexCoords.r) {
                playBuild();
            }
        }
        prevNinjaCoords.current = gameState.ninjaHexCoords;
    }, [gameState.ninjaHexCoords?.q, gameState.ninjaHexCoords?.r]);

    const prevDisconnectedCount = useRef(gameState.disconnectedPlayers.length);
    useEffect(() => {
        if (gameState.disconnectedPlayers.length > prevDisconnectedCount.current) {
            playDisconnect();
        } else if (gameState.disconnectedPlayers.length < prevDisconnectedCount.current) {
            playConnect();
        }
        prevDisconnectedCount.current = gameState.disconnectedPlayers.length;
    }, [gameState.disconnectedPlayers.length, playDisconnect, playConnect]);

    const prevTurnIndex = useRef(gameState.currentTurnIndex);
    useEffect(() => {
        if (prevTurnIndex.current !== gameState.currentTurnIndex) {
            playTurn();
        }
        prevTurnIndex.current = gameState.currentTurnIndex;
    }, [gameState.currentTurnIndex, playTurn]);

    const handleRollDice = () => {
        if (!isMyTurn || gameState.phase !== 'ROLL') return;
        playRoll();

        let roll;
        let newDeck = [...gameState.diceDeck];
        if (gameState.settings.trueRoll) {
            roll = rollDice();
        } else {
            if (newDeck.length === 0) newDeck = createDiceDeck();
            const p = newDeck.pop()!;
            roll = { die1: p.die1, die2: p.die2, total: p.die1 + p.die2 };
        }

        let newState: GameState = {
            ...gameState,
            diceRoll: roll,
            diceDeck: newDeck,
            phase: 'TRADE',
            logs: [...gameState.logs, `${currentPlayer.username} rolled a ${roll.total} (${roll.die1} + ${roll.die2}).`]
        };

        newState = distributeResources(newState, map, roll.total);
        broadcastState(newState);
    };

    const [activeCardContext, setActiveCardContext] = useState<'MARKET CONTROL' | 'ABUNDANCE' | null>(null);

    const handleEndTurn = (forceHostSkip = false) => {
        if (!forceHostSkip) {
            if (!isMyTurn || gameState.phase === 'ROLL' || gameState.gamePhase !== 'MAIN_GAME') return;
        }

        let nextIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
        let loops = 0;
        while (gameState.players[nextIndex].isInert && loops < gameState.players.length) {
            nextIndex = (nextIndex + 1) % gameState.players.length;
            loops++;
        }

        const nextPlayer = gameState.players[nextIndex];

        const newPlayers = [...gameState.players];
        const myIndex = newPlayers.findIndex(p => p.peerId === myPlayer?.peerId);
        if (myIndex !== -1 && !forceHostSkip) {
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
        setPendingBuild(null);
        broadcastState(newState);
    };

    useEffect(() => {
        if (peerService.role === 'host' && gameState.players[gameState.currentTurnIndex]?.isInert) {
            handleEndTurn(true);
        }
    }, [gameState.currentTurnIndex, gameState.players]);

    const handleBuyCard = () => {
        if (!isMyTurn || gameState.phase === 'ROLL' || !canAffordCard || gameState.actionCardDeck.length === 0) return;

        setPendingBuild({ type: 'ACTION_CARD', id: 'deck', costText: '1 Ore, 1 Wool, 1 Cereal' });
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

            // Largest Clan tracking
            const newPlayedCount = (newState.playedNinjaCards[myPlayer!.peerId] || 0) + 1;
            newState.playedNinjaCards = { ...newState.playedNinjaCards, [myPlayer!.peerId]: newPlayedCount };

            if (newPlayedCount >= 3 && newPlayedCount > newState.largestClanSize) {
                if (newState.largestClanHolder !== myPlayer!.peerId) {
                    newState.logs.push(`${myPlayer!.username} took the Largest Clan award!`);
                }
                newState.largestClanHolder = myPlayer!.peerId;
                newState.largestClanSize = newPlayedCount;
            }

            broadcastState(newState);
        } else if (card.type === 'RAPID_EXPANSION') {
            newState.gamePhase = 'FREE_STREET_BUILDING';
            newState.freeStreetsLeft = 2;
            setBuildMode('street');
            broadcastState(newState);
        } else if (card.type === 'MARKET CONTROL' || card.type === 'ABUNDANCE') {
            setActiveCardContext(card.type);
            broadcastState(newState);
        }
    };

    const handleBankTrade = (giveRes: string, giveAmount: number, getRes: string) => {
        const newPlayers = [...gameState.players];
        const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        const updatedPlayer = { ...newPlayers[playerIndex], resources: { ...newPlayers[playerIndex].resources } };

        updatedPlayer.resources[giveRes as keyof ResourceCounts] -= giveAmount;
        updatedPlayer.resources[getRes as keyof ResourceCounts] += 1;

        newPlayers[playerIndex] = updatedPlayer;
        broadcastState({
            ...gameState,
            players: newPlayers,
            logs: [...gameState.logs, `${myPlayer!.username} traded ${giveAmount} ${giveRes} for 1 ${getRes} with the bank.`]
        });
    };

    const handleProposeTrade = (offer: Partial<ResourceCounts>, request: Partial<ResourceCounts>) => {
        playTrade();
        broadcastState({
            ...gameState,
            gamePhase: 'P2P_TRADE_PENDING',
            tradeProposal: {
                proposerId: myPlayer!.peerId,
                offer,
                request,
                acceptedBy: []
            },
            logs: [...gameState.logs, `${myPlayer!.username} proposed a trade.`]
        });
    };

    const handleAcceptTrade = () => {
        if (!gameState.tradeProposal) return;
        const msg = { type: 'TRADE_RESPONSE', peerId: myPlayer!.peerId, response: 'ACCEPT' };
        peerService.broadcast(msg);
        setGameState(prev => {
            if (!prev.tradeProposal) return prev;
            return {
                ...prev,
                tradeProposal: {
                    ...prev.tradeProposal,
                    acceptedBy: [...prev.tradeProposal.acceptedBy.filter(id => id !== myPlayer!.peerId), myPlayer!.peerId],
                    declinedBy: (prev.tradeProposal.declinedBy || []).filter(id => id !== myPlayer!.peerId)
                }
            };
        });
    };

    const handleRejectTrade = () => {
        if (!gameState.tradeProposal) return;
        const msg = { type: 'TRADE_RESPONSE', peerId: myPlayer!.peerId, response: 'REJECT' };
        peerService.broadcast(msg);
        setGameState(prev => {
            if (!prev.tradeProposal) return prev;
            return {
                ...prev,
                tradeProposal: {
                    ...prev.tradeProposal,
                    acceptedBy: prev.tradeProposal.acceptedBy.filter(id => id !== myPlayer!.peerId),
                    declinedBy: [...(prev.tradeProposal.declinedBy || []).filter(id => id !== myPlayer!.peerId), myPlayer!.peerId]
                }
            };
        });
    };

    const handleFinalizeTrade = (acceptedPeerId: string) => {
        if (!gameState.tradeProposal) return;
        const newPlayers = [...gameState.players];

        const myIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
        const partnerIndex = newPlayers.findIndex(p => p.peerId === acceptedPeerId);
        const updatedMe = { ...newPlayers[myIndex], resources: { ...newPlayers[myIndex].resources } };
        const updatedPartner = { ...newPlayers[partnerIndex], resources: { ...newPlayers[partnerIndex].resources } };

        const { offer, request } = gameState.tradeProposal;

        Object.entries(offer).forEach(([res, count]) => {
            updatedMe.resources[res as keyof ResourceCounts] -= (count || 0);
            updatedPartner.resources[res as keyof ResourceCounts] += (count || 0);
        });

        Object.entries(request).forEach(([res, count]) => {
            updatedPartner.resources[res as keyof ResourceCounts] -= (count || 0);
            updatedMe.resources[res as keyof ResourceCounts] += (count || 0);
        });

        newPlayers[myIndex] = updatedMe;
        newPlayers[partnerIndex] = updatedPartner;

        broadcastState({
            ...gameState,
            players: newPlayers,
            gamePhase: 'MAIN_GAME',
            tradeProposal: undefined,
            logs: [...gameState.logs, `${myPlayer!.username} and ${newPlayers[partnerIndex].username} completed a trade.`]
        });
    };

    const handleCancelTrade = () => {
        broadcastState({
            ...gameState,
            gamePhase: 'MAIN_GAME',
            tradeProposal: undefined,
            logs: [...gameState.logs, `${myPlayer!.username} canceled their trade proposal.`]
        });
    };

    const handleResourceClick = (res: string) => {
        if (!myPlayer || isSetupPhase) return;

        const rates = getPlayerTradeRates(gameState, map, myPlayer.peerId);
        const exchangeRateForRes = rates[res as keyof typeof rates] || 4;
        const playerResCount = myPlayer.resources[res as keyof typeof myPlayer.resources] || 0;

        let initialAmount = 1;
        if (playerResCount >= exchangeRateForRes) {
            initialAmount = exchangeRateForRes;
        }

        // Pre-fill the offer with the calculated amount of the clicked resource
        setTradeModalConfig({ initialOffer: { [res]: initialAmount } });
        setShowTradeModal(true);
    };

    const isSetupPhase = gameState.gamePhase === 'SETUP_1' || gameState.gamePhase === 'SETUP_2';
    const activeBuildMode = isSetupPhase ? (gameState.setupAction || 'NONE') : buildMode;

    const canAffordStreet = isSetupPhase ||
        (gameState.gamePhase === 'FREE_STREET_BUILDING' && myPlayer && myPlayer.inventory.availableStreets > 0) ||
        (gameState.gamePhase === 'MAIN_GAME' && myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.street) && myPlayer.inventory.availableStreets > 0);
    const canAffordHouse = isSetupPhase || (gameState.gamePhase === 'MAIN_GAME' && myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.HOUSE) && myPlayer.inventory.availableHouses > 0);
    const canAffordFortress = gameState.gamePhase === 'MAIN_GAME' && myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.FORTRESS) && myPlayer.inventory.availableFortresses > 0;
    const canAffordCard = gameState.gamePhase === 'MAIN_GAME' && myPlayer && canAfford(myPlayer.resources, BUILD_COSTS.ACTION_CARD);

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

    const hasValidHouseSpots = useMemo(() => {
        if (!myPlayer || !isMyTurn) return false;
        return getValidHousePlacements(gameState, myPlayer.peerId, allNodeIds).size > 0;
    }, [gameState, myPlayer, allNodeIds, isMyTurn]);

    const hasValidStreetSpots = useMemo(() => {
        if (!myPlayer || !isMyTurn) return false;
        return getValidStreetPlacements(gameState, myPlayer.peerId, allEdgeIds).size > 0;
    }, [gameState, myPlayer, allEdgeIds, isMyTurn]);

    const hasValidFortressSpots = useMemo(() => {
        if (!myPlayer || !isMyTurn) return false;
        return Object.values(gameState.houses).some(s => s.ownerId === myPlayer.peerId && !s.isFortress);
    }, [gameState, myPlayer, isMyTurn]);

    const validStreetEdges = useMemo(() => {
        if (!myPlayer || activeBuildMode !== 'street' || !isMyTurn) return new Set<string>();
        return getValidStreetPlacements(gameState, myPlayer.peerId, allEdgeIds);
    }, [gameState, myPlayer, activeBuildMode, allEdgeIds, isMyTurn]);

    const validHouseNodes = useMemo(() => {
        if (!myPlayer || activeBuildMode !== 'HOUSE' || !isMyTurn) return new Set<string>();
        return getValidHousePlacements(gameState, myPlayer.peerId, allNodeIds);
    }, [gameState, myPlayer, activeBuildMode, allNodeIds, isMyTurn]);

    const validFortressNodes = useMemo(() => {
        if (!myPlayer || activeBuildMode !== 'FORTRESS' || !isMyTurn) return new Set<string>();
        const nodes = new Set<string>();
        Object.values(gameState.houses).forEach(s => {
            if (s.ownerId === myPlayer.peerId && !s.isFortress) {
                nodes.add(s.nodeId);
            }
        });
        return nodes;
    }, [gameState, myPlayer, activeBuildMode, isMyTurn]);

    const handleConfirmBuild = () => {
        if (!pendingBuild || !isMyTurn) return;

        if (pendingBuild.type === 'ACTION_CARD') {
            playCard();
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
            setPendingBuild(null);
            return;
        }

        if (pendingBuild.type === 'FORTRESS') {
            playBuild();
            const nodeId = pendingBuild.id;
            const house = gameState.houses[nodeId];
            if (!house || house.ownerId !== myPlayer!.peerId || house.isFortress) return;

            const newPlayers = [...gameState.players];
            const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
            const updatedPlayer = {
                ...newPlayers[playerIndex],
                resources: { ...newPlayers[playerIndex].resources },
                inventory: {
                    ...newPlayers[playerIndex].inventory,
                    availableFortresses: newPlayers[playerIndex].inventory.availableFortresses - 1,
                    availableHouses: newPlayers[playerIndex].inventory.availableHouses + 1
                }
            };

            Object.entries(BUILD_COSTS.FORTRESS).forEach(([res, count]) => {
                updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= count;
            });
            newPlayers[playerIndex] = updatedPlayer;

            const newState: GameState = {
                ...gameState,
                players: newPlayers,
                houses: {
                    ...gameState.houses,
                    [nodeId]: { ...house, isFortress: true }
                },
                logs: [...gameState.logs, `${currentPlayer.username} upgraded a house to a Fortress.`]
            };
            setBuildMode('NONE');
            setPendingBuild(null);
            broadcastState(newState);
            return;
        }

        if (pendingBuild.type === 'HOUSE') {
            playBuild();
            const nodeId = pendingBuild.id;
            const validation = validateHousePlacement(gameState, nodeId, myPlayer!.peerId);
            if (!validation.valid) return;

            const newPlayers = [...gameState.players];
            const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
            const updatedPlayer = {
                ...newPlayers[playerIndex],
                resources: { ...newPlayers[playerIndex].resources },
                inventory: {
                    ...newPlayers[playerIndex].inventory,
                    availableHouses: newPlayers[playerIndex].inventory.availableHouses - 1
                }
            };

            if (!isSetupPhase) {
                Object.entries(BUILD_COSTS.HOUSE).forEach(([res, count]) => {
                    updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= count;
                });
            }
            newPlayers[playerIndex] = updatedPlayer;

            const newState: GameState = {
                ...gameState,
                players: newPlayers,
                houses: {
                    ...gameState.houses,
                    [nodeId]: { ownerId: myPlayer!.peerId, isFortress: false, nodeId }
                },
                logs: [...gameState.logs, `${currentPlayer.username} placed a house.`]
            };

            if (isSetupPhase) {
                newState.lastBuiltNodeId = nodeId;
                newState.setupAction = 'street';
                if (gameState.gamePhase === 'SETUP_2') {
                    const gained = getStartingResources(newState, nodeId, map);
                    Object.entries(gained).forEach(([res, count]) => {
                        newState.players[newState.currentTurnIndex].resources[res as keyof ResourceCounts] += (count || 0);
                    });
                    newState.logs.push(`${currentPlayer.username} received starting resources.`);
                }
            } else {
                setBuildMode('NONE');
            }

            setPendingBuild(null);
            broadcastState(newState);
            return;
        }

        if (pendingBuild.type === 'street') {
            playBuild();
            const edgeId = pendingBuild.id;
            const validation = validatestreetPlacement(gameState, edgeId, myPlayer!.peerId);
            if (!validation.valid) return;

            const newPlayers = [...gameState.players];
            const playerIndex = newPlayers.findIndex(p => p.peerId === myPlayer!.peerId);
            const updatedPlayer = {
                ...newPlayers[playerIndex],
                resources: { ...newPlayers[playerIndex].resources },
                inventory: {
                    ...newPlayers[playerIndex].inventory,
                    availableStreets: newPlayers[playerIndex].inventory.availableStreets - 1
                }
            };

            if (!isSetupPhase && gameState.gamePhase !== 'FREE_STREET_BUILDING') {
                Object.entries(BUILD_COSTS.street).forEach(([res, count]) => {
                    updatedPlayer.resources[res as keyof typeof updatedPlayer.resources] -= count;
                });
            }
            newPlayers[playerIndex] = updatedPlayer;

            let newState: GameState = {
                ...gameState,
                players: newPlayers,
                streets: {
                    ...gameState.streets,
                    [edgeId]: { ownerId: myPlayer!.peerId, edgeId }
                },
                logs: [...gameState.logs, `${currentPlayer.username} built a street.`]
            };

            if (isSetupPhase) {
                newState = advanceSetupTurn(newState);
            } else if (gameState.gamePhase === 'FREE_STREET_BUILDING') {
                newState.freeStreetsLeft -= 1;
                if (newState.freeStreetsLeft <= 0) {
                    newState.gamePhase = 'MAIN_GAME';
                    setBuildMode('NONE');
                }
            } else {
                setBuildMode('NONE');
            }

            setPendingBuild(null);
            broadcastState(newState);
        }
    };

    const handleCancelBuild = () => {
        setPendingBuild(null);
    };

    const handleNodeClick = (nodeId: string) => {
        if (!isMyTurn) return;

        if (activeBuildMode === 'FORTRESS') {
            const house = gameState.houses[nodeId];
            if (!house || house.ownerId !== myPlayer!.peerId || house.isFortress) return;

            setPendingBuild({ type: 'FORTRESS', id: nodeId, costText: '3 Ore, 2 Cereal' });
            return;
        }

        if (activeBuildMode !== 'HOUSE') return;

        const validation = validateHousePlacement(gameState, nodeId, myPlayer!.peerId);
        if (!validation.valid) {
            alert(validation.reason);
            return;
        }

        setPendingBuild({ type: 'HOUSE', id: nodeId, costText: isSetupPhase ? 'Free' : '1 Wood, 1 Clay, 1 Wool, 1 Cereal' });
    };

    const handleEdgeClick = (edgeId: string) => {
        if (activeBuildMode !== 'street' || !isMyTurn) return;

        const validation = validatestreetPlacement(gameState, edgeId, myPlayer!.peerId);
        if (!validation.valid) {
            alert(validation.reason);
            return;
        }

        const costText = (isSetupPhase || gameState.gamePhase === 'FREE_STREET_BUILDING') ? 'Free' : '1 Wood, 1 Clay';
        setPendingBuild({ type: 'street', id: edgeId, costText });
    };

    const handleDiscard = () => {
        if (!myPlayer) return;
        const totalCards = Object.values(myPlayer.resources).reduce((a, b) => a + b, 0);
        const required = Math.floor(totalCards / 2);
        const selected = Object.values(discardSelection).reduce((a, b) => (a || 0) + (b || 0), 0);
        if (selected !== required) return;

        playDiscard();

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
        let logMessage = `${myPlayer!.username} stole a resource from ${targetPlayer.username}.`;
        if (available.length > 0) {
            const stolenRes = available[Math.floor(Math.random() * available.length)] as keyof typeof targetPlayer.resources;
            targetPlayer.resources[stolenRes] -= 1;
            updatedMe.resources[stolenRes] += 1;
            logMessage = `${myPlayer!.username} stole a resource from ${targetPlayer.username}.|STEAL|${myPlayer!.peerId}|${targetPlayer.peerId}|${stolenRes}`;
        }

        newPlayers[targetIndex] = targetPlayer;
        newPlayers[myIndex] = updatedMe;

        const newState: GameState = {
            ...gameState,
            players: newPlayers,
            gamePhase: 'MAIN_GAME',
            logs: [...gameState.logs, logMessage]
        };
        broadcastState(newState);
    };

    const handleHexClick = (q: number, r: number) => {
        if (gameState.gamePhase !== 'NINJA_MOVE' || !isMyTurn) return;

        // Find adjacent houses
        const hexNodeIds = HexMath.getHexNodeIds({ q, r });
        const adjacentOpponents = new Set<string>();
        hexNodeIds.forEach(nId => {
            const s = gameState.houses[nId];
            if (s && s.ownerId !== myPlayer!.peerId) {
                const opp = gameState.players.find(p => p.peerId === s.ownerId);
                // Safe Ninja: skip opponents with ≤2 VP
                if (opp && gameState.settings?.safeNinja && opp.victoryPoints <= 2) return;
                adjacentOpponents.add(s.ownerId);
            }
        });

        let newState = {
            ...gameState,
            ninjaHexCoords: { q, r },
            logs: [...gameState.logs, `${currentPlayer.username} moved the Ninja.`]
        };

        const hasTargetableOpponents = Array.from(adjacentOpponents).some(oppId => {
            const opp = gameState.players.find(p => p.peerId === oppId);
            if (!opp) return false;
            return Object.values(opp.resources).reduce((a, b) => a + b, 0) > 0;
        });

        if (hasTargetableOpponents) {
            newState.gamePhase = 'NINJA_STEAL';
        } else {
            newState.gamePhase = 'MAIN_GAME';
            newState.logs.push(`No targetable opponents adjacent to the Ninja.`);
        }

        broadcastState(newState);
    };

    return (
        <div className="h-[100dvh] p-1 md:p-2 lg:p-4 flex flex-col text-[#2c1d10] overflow-y-auto md:overflow-hidden"
            style={{
                backgroundImage: `url(${tableBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}>

            {/* VICTORY SCREEN */}
            {gameState.gamePhase === 'GAME_OVER' && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md">
                    <div className="bg-[#fcf7ec]/95 backdrop-blur-md p-10 rounded-3xl border-4 border-[#a37941] shadow-[0_15px_40px_rgba(0,0,0,0.6)] max-w-lg w-full text-center flex flex-col items-center gap-4">
                        {(() => {
                            const sortedPlayers = gameState.players.slice().sort((a, b) => (b.victoryPoints + b.actionCards.filter(c => c.type === 'MONUMENT').length) - (a.victoryPoints + a.actionCards.filter(c => c.type === 'MONUMENT').length));
                            const myRankIndex = sortedPlayers.findIndex(p => p.peerId === myPlayer?.peerId);
                            const rankText = myRankIndex === 0 ? "VICTORY!" : myRankIndex === 1 ? "SECOND PLACE" : myRankIndex === 2 ? "THIRD PLACE" : myRankIndex === 3 ? "FOURTH PLACE" : myRankIndex === 4 ? "FIFTH PLACE" : "LAST PLACE";
                            const colorClass = myRankIndex === 0 ? "from-yellow-400 to-amber-600" : myRankIndex === 1 ? "from-slate-300 to-slate-500" : myRankIndex === 2 ? "from-amber-700 to-amber-900" : "from-stone-600 to-stone-800";
                            return (
                                <h1
                                    className={`text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r ${colorClass} mb-4 uppercase`}
                                    style={{
                                        WebkitTextStroke: '2px black',
                                        filter: 'drop-shadow(0px 6px 4px rgba(0,0,0,0.9))'
                                    }}
                                >
                                    {rankText}
                                </h1>
                            );
                        })()}
                        <div className="w-16 h-16 rounded-full mb-2" style={{ backgroundColor: PLAYER_COLORS[gameState.players.find(p => p.victoryPoints + p.actionCards.filter(c => c.type === 'MONUMENT').length >= gameState.winningScore)?.color as keyof typeof PLAYER_COLORS || 'RED'].hex }}></div>
                        <h2 className="text-2xl font-bold text-[#2c1d10] uppercase tracking-widest">
                            {gameState.players.find(p => p.victoryPoints + p.actionCards.filter(c => c.type === 'MONUMENT').length >= gameState.winningScore)?.username} Wins!
                        </h2>
                        <p className="text-[#5c4936]">
                            They reached {gameState.winningScore} Victory Points and conquered Klatana.
                        </p>

                        <div className="w-full mt-6 bg-[#ebd8b7] shadow-inner rounded-xl p-4 border-2 border-[#d3be9a]">
                            <h3 className="text-sm font-black text-[#7d6549] uppercase tracking-wider mb-3 border-b border-[#d3be9a] pb-2">Final Scores</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-[#dcc9a5] text-xs text-[#7d6549] font-black uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Rank</th>
                                            <th className="px-3 py-2">Player</th>
                                            <th className="px-3 py-2">Total VPs</th>
                                            <th className="px-3 py-2">Cards Found</th>
                                            <th className="px-3 py-2">Clan Size</th>
                                            <th className="px-3 py-2">Longest street</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {gameState.players
                                            .sort((a, b) => (b.victoryPoints + b.actionCards.filter(c => c.type === 'MONUMENT').length) - (a.victoryPoints + a.actionCards.filter(c => c.type === 'MONUMENT').length))
                                            .map((p, idx) => {
                                                const hiddenVp = p.actionCards.filter(c => c.type === 'MONUMENT').length;
                                                const totalVp = p.victoryPoints + hiddenVp;
                                                return (
                                                    <tr key={p.peerId} className="hover:bg-[#f0e5ce]/50">
                                                        <td className="px-3 py-2 font-black text-[#a37941]">#{idx + 1}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[p.color as keyof typeof PLAYER_COLORS].hex }}></div>
                                                                <span className="font-bold text-[#2c1d10]">{p.username}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 font-bold text-yellow-600">{totalVp}</td>
                                                        <td className="px-3 py-2 font-medium text-black">{p.actionCards.length}</td>
                                                        <td className="px-3 py-2 font-medium text-black">{gameState.largestClanHolder === p.peerId ? gameState.largestClanSize : (gameState.playedNinjaCards[p.peerId] || 0)}</td>
                                                        <td className="px-3 py-2 font-medium text-black">{gameState.longestStreetHolder === p.peerId ? gameState.longestStreetLength : getLongestStreetForPlayer(gameState, p.peerId)}</td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {onReturnToLobby && (
                            <button onClick={onReturnToLobby} className="mt-4 px-8 py-3 bg-gradient-to-b from-[#3ca956] via-[#2f8a43] to-[#1c552a] hover:from-[#4ac565] text-[#f7efd8] rounded-xl font-bold uppercase tracking-widest shadow-lg transition-colors border-b-4 border-[#113118]">
                                Return to Lobby
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* PAUSED MODAL */}
            {gameState.isPaused && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md">
                    <div className="bg-[#fcf7ec]/95 backdrop-blur-md p-8 rounded-3xl border-4 border-red-500/70 shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-4">
                        <div className="text-5xl font-black text-red-500 mb-2 drop-shadow-lg">⏸️</div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-widest">
                            Game Paused
                        </h2>
                        <div className="text-[#5c4936]">
                            Waiting for players to reconnect:
                            <ul className="mt-4 space-y-2">
                                {gameState.disconnectedPlayers.map(id => {
                                    const p = gameState.players.find(x => (x.playerId || x.peerId) === id);
                                    return (
                                        <li key={id} className="flex justify-between items-center bg-[#ebd8b7] shadow-inner p-3 rounded-lg border-2 border-[#d3be9a]">
                                            <span className="font-bold text-[#2c1d10]">{p?.username || 'Unknown Player'}</span>
                                            {peerService.role === 'host' && (
                                                <button
                                                    onClick={() => {
                                                        const newPlayers = [...gameState.players];
                                                        const idx = newPlayers.findIndex(x => (x.playerId || x.peerId) === id);
                                                        if (idx !== -1) {
                                                            newPlayers[idx] = { ...newPlayers[idx], isInert: true };
                                                        }
                                                        const newDisconnected = gameState.disconnectedPlayers.filter(x => x !== id);
                                                        broadcastState({
                                                            ...gameState,
                                                            players: newPlayers,
                                                            disconnectedPlayers: newDisconnected,
                                                            isPaused: newDisconnected.length > 0,
                                                            logs: [...gameState.logs, `${p?.username} was marked as inert. They will be skipped.`]
                                                        });
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-md font-bold uppercase transition"
                                                >
                                                    Mark as Inert (Kick)
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* NINJA DISCARD MODAL */}
            {gameState.gamePhase === 'NINJA_DISCARD' && myPlayer && gameState.playersNeedingToDiscard.includes(myPlayer.peerId) && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-[#fcf7ec]/95 backdrop-blur-md p-6 rounded-2xl border-4 border-[#a37941] shadow-2xl max-w-md w-full">
                        <h2 className="text-xl font-black text-[#c0392b] mb-2 text-center uppercase tracking-wider">Ninja Attack!</h2>
                        <p className="text-[#5c4936] text-sm mb-4 text-center">You have more than {gameState.settings?.discardLimit ?? 7} cards. You must discard half (rounded down).</p>

                        <div className="space-y-3 mx-auto px-4 mb-6">
                            {Object.entries(myPlayer.resources)
                                .filter(([res]) => res !== 'NUGGETS' || map.hexes.some(h => h.resource === 'NUGGETS'))
                                .map(([res, count]) => {
                                    const selected = discardSelection[res as keyof typeof discardSelection] || 0;
                                    const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                                    let textClass = "text-white drop-shadow-sm";
                                    let numBgClass = "bg-black/40";
                                    let numTextClass = "text-white";

                                    if (res === 'CEREALS' || res === 'NUGGETS' || res === 'WOOL') {
                                        textClass = "text-[#2a1c0d] drop-shadow-none";
                                        numBgClass = "bg-[#2a1c0d]/20";
                                        numTextClass = "text-[#2a1c0d]";
                                    }

                                    return (
                                        <div key={res} className="relative flex justify-between items-center p-2 rounded-lg border border-black/30 shadow-md overflow-hidden min-h-[60px]" style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}>
                                            {RESOURCE_TEXTURES[res] && (
                                                <div
                                                    className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay"
                                                    style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                                />
                                            )}
                                            <div className="relative z-10 flex items-center gap-3 ml-2">
                                                <img src={RESOURCE_ICONS[res as keyof typeof RESOURCE_ICONS]} alt={res} className="w-8 h-8 drop-shadow-md filter-none" />
                                                <div className="flex flex-col">
                                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${textClass} leading-tight`}>{res}</span>
                                                    <span className={`text-[10px] font-bold ${numTextClass} ${numBgClass} px-1.5 py-0.5 rounded shadow-inner mt-0.5 max-w-fit`}>Available: {count}</span>
                                                </div>
                                            </div>

                                            <div className="relative z-10 flex gap-2 items-center mr-2">
                                                <button onClick={() => setDiscardSelection(prev => ({ ...prev, [res]: Math.max(0, (prev[res as keyof typeof prev] || 0) - 1) }))} className="w-8 h-8 bg-black/40 text-white rounded hover:bg-black/60 shadow font-bold transition-colors">-</button>
                                                <span className={`w-6 text-center font-black ${textClass} text-lg`}>{selected}</span>
                                                <button onClick={() => setDiscardSelection(prev => ({ ...prev, [res]: Math.min(count, (prev[res as keyof typeof prev] || 0) + 1) }))} className="w-8 h-8 bg-black/40 text-white rounded hover:bg-black/60 shadow font-bold transition-colors">+</button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {(() => {
                            const totalCards = Object.values(myPlayer.resources).reduce((a, b) => a + b, 0);
                            const required = Math.floor(totalCards / 2);
                            const selected = Object.values(discardSelection).reduce((a, b) => (a || 0) + (b || 0), 0);
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

            {/* NON-BLOCKING WAITING NOTIFICATIONS */}
            {gameState.gamePhase === 'NINJA_DISCARD' && myPlayer && !gameState.playersNeedingToDiscard.includes(myPlayer.peerId) && dismissedNotificationPhase !== 'NINJA_DISCARD' && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                    <div className="bg-[#f4e6cd] p-4 rounded-2xl border-2 border-[#7d6549]  shadow-2xl min-w-[300px] text-center backdrop-blur-md relative">
                        <button onClick={() => setDismissedNotificationPhase('NINJA_DISCARD')} className="absolute top-2 right-2 text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition-colors">✕</button>
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="animate-spin text-xl">⏳</div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-yellow-600">Waiting for Discards</h2>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                            {gameState.playersNeedingToDiscard.map(id => {
                                const player = gameState.players.find(p => p.peerId === id);
                                if (!player) return null;
                                return (
                                    <div key={id} className="bg-slate-900/80 px-2 py-1 rounded-md border border-slate-700 flex items-center gap-2 shadow-inner text-xs">
                                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: PLAYER_COLORS[player.color as keyof typeof PLAYER_COLORS]?.hex || '#fff' }}></div>
                                        <span className="font-bold text-white">{player.username}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {gameState.gamePhase === 'NINJA_MOVE' && !isMyTurn && dismissedNotificationPhase !== 'NINJA_MOVE' && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                    <div className="bg-[#f4e6cd] p-4 rounded-2xl border border-emerald-500/50 shadow-2xl min-w-[300px] text-center backdrop-blur-md relative">
                        <button onClick={() => setDismissedNotificationPhase('NINJA_MOVE')} className="absolute top-2 right-2 text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition-colors">✕</button>
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">{currentPlayer.username} is moving the Ninja</h2>
                        </div>
                    </div>
                </div>
            )}

            {/* NINJA STEAL MODAL */}
            {gameState.gamePhase === 'NINJA_STEAL' && isMyTurn && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-[#fcf7ec]/95 backdrop-blur-md p-6 rounded-2xl border-4 border-[#a37941] shadow-2xl max-w-sm w-full">
                        <h2 className="text-xl font-black text-emerald-700 mb-2 text-center uppercase tracking-wider">Steal Resource</h2>
                        <p className="text-[#5c4936] text-sm mb-6 text-center">Choose an opponent adjacent to the Ninja to steal from.</p>
                        <div className="space-y-3">
                            {(() => {
                                const hexNodeIds = HexMath.getHexNodeIds(gameState.ninjaHexCoords);
                                const adjacentOpponents = new Set<string>();
                                hexNodeIds.forEach(nId => {
                                    const s = gameState.houses[nId];
                                    if (s && s.ownerId !== myPlayer!.peerId) {
                                        const opp = gameState.players.find(p => p.peerId === s.ownerId);
                                        // Safe Ninja: skip opponents with ≤2 VP
                                        if (opp && gameState.settings?.safeNinja && opp.victoryPoints <= 2) return;
                                        adjacentOpponents.add(s.ownerId);
                                    }
                                });
                                return Array.from(adjacentOpponents).map(oppId => {
                                    const opp = gameState.players.find(p => p.peerId === oppId);
                                    if (!opp) return null;
                                    const oppCards = Object.values(opp.resources).reduce((a, b) => a + b, 0);
                                    return (
                                        <button
                                            key={opp.peerId}
                                            onClick={() => handleSteal(opp.peerId)}
                                            disabled={oppCards === 0}
                                            className={`w-full py-3 px-4 flex justify-between items-center rounded-xl font-bold border transition-colors shadow-sm ${oppCards > 0 ? 'bg-[#ebd8b7] hover:bg-[#d3be9a] border-black text-black' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed'}`}
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
            {activeCardContext === 'MARKET CONTROL' && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-[#fcf7ec]/95 backdrop-blur-md p-6 rounded-2xl border-4 border-[#a37941] shadow-2xl max-w-sm w-full">
                        <h2 className="text-xl font-black text-[#5c4936] mb-2 text-center uppercase tracking-wider">Market Control</h2>
                        <p className="text-[#5c4936] text-sm mb-6 text-center">Choose a resource to steal from all players.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {['OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'].map(res => (
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
                                            logs: [...gameState.logs, `${myPlayer!.username} played Market Control and took ${totalStolen} ${res}!`]
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
                    <div className="bg-[#fcf7ec]/95 backdrop-blur-md p-6 rounded-2xl border-4 border-[#a37941] shadow-2xl max-w-sm w-full">
                        <h2 className="text-xl font-black text-[#5c4936] mb-2 text-center uppercase tracking-wider">Abundance</h2>
                        <p className="text-[#5c4936] text-sm mb-6 text-center">Pick {2 - abundancePicks.length} resource(s) from the bank.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {['OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'].map(res => (
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
                                    className="py-3 px-4 rounded-xl font-bold border transition-colors shadow-md overflow-hidden relative border-black/30 text-white"
                                    style={{ background: `radial-gradient(circle at center, ${RESOURCE_GRADIENTS[res]?.center || '#334155'}, ${RESOURCE_GRADIENTS[res]?.edge || '#0f172a'})` }}
                                >
                                    {RESOURCE_TEXTURES[res] && (
                                        <div
                                            className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay"
                                            style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                        />
                                    )}
                                    <span className="relative z-10 drop-shadow-sm">{res}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}



            <div className="flex-grow flex flex-col md:flex-row gap-2 md:gap-4 min-h-0 overflow-visible md:overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-full md:w-48 lg:w-56 flex flex-col shrink-0">
                    <div className="flex-grow flex flex-row md:flex-col gap-2 lg:gap-4">
                        {/* Disclaimer */}
                        <div className="hidden md:flex opacity-70 hover:opacity-100 transition-opacity pointer-events-none flex-col shrink-0">
                            <p className="text-[10px] text-slate-400 max-w-sm leading-tight">
                                Klatana is a free, open-source fan project.<br />It is not affiliated with, endorsed by, or sponsored by Catan Studio, Asmodee, or any related entities.
                            </p>
                        </div>

                        {/* Action Cards Box */}
                        <div className="flex-1 md:flex-none bg-[#f4e6cd] p-1 md:p-3 rounded-lg md:rounded-xl border-2 border-[#d3be9a] shadow-lg flex flex-col shrink-0 min-h-0 mt-0 md:mt-auto">
                            <h3 className="hidden md:block font-black text-[#7d6549] uppercase text-xs tracking-wider mb-2">Action Cards</h3>
                            <div className="flex flex-row md:flex-col gap-1 md:gap-2 flex-grow overflow-x-auto overflow-y-hidden md:overflow-visible items-center md:items-stretch">
                                {myPlayer?.actionCards.map((card, i) => (
                                    <div key={i} className="bg-[#ebd8b7] p-1 md:p-2 rounded border-2 border-[#d3be9a] flex gap-2 justify-between items-center group relative cursor-help shrink-0 md:shrink">
                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#fcf7ec]/98 backdrop-blur border-2 border-[#d3be9a] rounded-lg p-2 shadow-2xl w-48 pointer-events-none z-[60]">
                                            <span className="text-[10px] uppercase tracking-widest font-black text-[#7d6549] border-b border-[#d3be9a] pb-1 mb-1 text-center">Info</span>
                                            <span className="text-[10px] text-black text-center font-medium">
                                                {card.type === 'NINJA' ? 'Move the Ninja to a new hex and steal 1 resource from an adjacent opponent.' :
                                                    card.type === 'MONUMENT' ? '+1 Victory Point (Hidden from others until the end).' :
                                                        card.type === 'MARKET CONTROL' ? 'Name 1 resource. All opponents must give you ALL their cards of that type.' :
                                                            card.type === 'ABUNDANCE' ? 'Instantly take any 2 resources of your choice from the bank.' :
                                                                card.type === 'RAPID_EXPANSION' ? 'Instantly build 2 streets for free.' : ''}
                                            </span>
                                        </div>
                                        <span className="text-[9px] md:text-[10px] font-black text-[#2c1d10] uppercase truncate pr-1 flex-1">{card.type}</span>
                                        {card.type !== 'MONUMENT' && (
                                            <button
                                                onClick={() => handlePlayCard(i)}
                                                disabled={!isMyTurn || gameState.phase === 'ROLL' || gameState.activeTurnPlayedCard || card.boughtThisTurn}
                                                className="px-1.5 py-0.5 md:px-2 md:py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[9px] md:text-[10px] font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed relative z-10 shrink-0"
                                            >
                                                Play
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {/* Buy Card button moved to main button area */}
                        </div>{/* end Action Cards box */}

                        {/* Resources Box */}
                        <div className="flex-1 md:flex-none bg-[#f4e6cd] p-1 md:p-3 rounded-lg md:rounded-xl border-2 border-[#d3be9a] shadow-lg flex flex-col shrink-0">
                            <h3 className="hidden md:block font-black text-[#7d6549] uppercase text-xs tracking-wider mb-2">My Resources</h3>
                            {myPlayer && (
                                <div className="flex flex-row md:grid md:grid-cols-3 gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible mb-0 md:mb-2 items-center">
                                    {Object.entries(myPlayer.resources)
                                        .filter(([res]) => res !== 'NUGGETS' || map.hexes.some(h => h.resource === 'NUGGETS'))
                                        .map(([res, count]) => {
                                            const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                                            let textClass = "text-white drop-shadow-sm";
                                            let numBgClass = "bg-black/40";
                                            let numTextClass = "text-white";

                                            // Make text darker on bright resources for legibility
                                            if (res === 'CEREALS' || res === 'NUGGETS' || res === 'WOOL') {
                                                textClass = "text-[#2a1c0d] drop-shadow-none";
                                                numBgClass = "bg-[#2a1c0d]/20";
                                                numTextClass = "text-[#2a1c0d]";
                                            }

                                            return (
                                                <div
                                                    key={res}
                                                    onClick={() => { playClick(); handleResourceClick(res); }}
                                                    className="relative flex flex-row md:flex-col items-center justify-between gap-1 md:gap-0 p-1 md:p-1.5 rounded border border-black/30 shadow-md overflow-hidden min-h-[24px] md:min-h-[70px] transition-transform hover:scale-105 cursor-pointer shrink-0"
                                                    style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}
                                                >
                                                    {RESOURCE_TEXTURES[res] && (
                                                        <div
                                                            className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay"
                                                            style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                                        />
                                                    )}
                                                    <div className="relative z-10 flex flex-row md:flex-col items-center gap-1 md:gap-0.5">
                                                        <img src={RESOURCE_ICONS[res as keyof typeof RESOURCE_ICONS]} alt={res} className="w-4 h-4 md:w-6 md:h-6 drop-shadow-md filter-none" />
                                                        <span className={`hidden md:block text-[8px] font-bold uppercase tracking-wider ${textClass} text-center leading-tight truncate w-full`}>
                                                            {res}
                                                        </span>
                                                    </div>
                                                    <div className={`relative z-10 font-black ${numTextClass} ${numBgClass} px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[10px] md:text-xs mt-0 md:mt-1 w-auto md:w-full text-center shadow-inner`}>
                                                        {count}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>{/* end flex-grow inner left sidebar */}
                </div>{/* end w-56 Left Sidebar */}


                {/* Main Board Area */}
                <main className="flex-grow flex flex-col items-center justify-center bg-[#2c5f3a]/60 backdrop-blur-sm rounded-xl border-2 border-[#1c3d26] shadow-xl relative overflow-hidden min-w-0">
                    <GameBoard
                        template={map}
                        gameState={gameState}
                        buildMode={activeBuildMode}
                        validStreetEdges={validStreetEdges}
                        validHouseNodes={validHouseNodes}
                        validFortressNodes={validFortressNodes}
                        pendingBuild={pendingBuild}
                        currentPlayerColor={myPlayer ? PLAYER_COLORS[myPlayer.color as keyof typeof PLAYER_COLORS].hex : 'white'}
                        isMyTurn={isMyTurn}
                        onConfirmBuild={handleConfirmBuild}
                        onCancelBuild={handleCancelBuild}
                        onNodeClick={handleNodeClick}
                        onEdgeClick={handleEdgeClick}
                        onHexClick={handleHexClick}
                    />

                    {/* Top-Left Floating Info: Player Identity */}
                    <div className="absolute top-1 left-1 md:top-2 md:left-2 lg:top-4 lg:left-4 flex flex-col gap-1 lg:gap-2 z-10 pointer-events-none">
                        <div className="px-3 py-1.5 bg-[#fcf7ec]/90 backdrop-blur rounded-lg text-sm font-bold shadow-lg border-2 border-[#d3be9a]">
                            <span className="text-[#7d6549] mr-2">Playing as:</span>
                            <span className="text-white drop-shadow" style={{ color: myPlayer ? PLAYER_COLORS[myPlayer.color as keyof typeof PLAYER_COLORS].hex : 'white' }}>{myPlayer?.username}</span>
                        </div>
                        {activeBuildMode !== 'NONE' && (
                            <div className="px-3 py-1.5 bg-[#2d1b0f]/80 backdrop-blur rounded-lg text-xs font-bold shadow-lg border border-[#a37941] animate-pulse text-amber-300">
                                BUILDING {activeBuildMode}...
                            </div>
                        )}
                    </div>

                    {/* Top-Right Floating Info: Dice Roll, Turn & Phase */}
                    <div className="absolute top-1 right-1 md:top-2 md:right-2 lg:top-4 lg:right-4 z-10 pointer-events-none flex flex-col items-end gap-1 lg:gap-2">
                        <div className="flex gap-2">
                            <div className="px-3 py-1.5 bg-[#fcf7ec]/90 backdrop-blur rounded-lg text-xs font-bold shadow-lg border-2 border-[#d3be9a]">
                                <span className="text-[#7d6549] uppercase tracking-wider mr-2">Turn:</span>
                                <span className="text-white drop-shadow" style={{ color: currentPlayer ? PLAYER_COLORS[currentPlayer.color as keyof typeof PLAYER_COLORS].hex : 'white' }}>{currentPlayer?.username}</span>
                            </div>
                            <div className="px-3 py-1.5 bg-[#fcf7ec]/90 backdrop-blur rounded-lg text-xs font-bold shadow-lg border-2 border-[#d3be9a]">
                                <span className="text-[#7d6549] uppercase tracking-wider mr-2">Phase:</span>
                                <span className="text-emerald-400 uppercase">{isSetupPhase ? gameState.gamePhase : gameState.phase}</span>
                            </div>
                        </div>
                        {gameState.diceRoll && (
                            <div className="flex flex-col items-center justify-center bg-[#fcf7ec]/90 backdrop-blur px-4 py-2 rounded-xl border-2 border-[#d3be9a] shadow-2xl min-w-[120px]">
                                <span className="text-[#9c8466] text-[10px] font-black uppercase tracking-widest mb-1 drop-shadow">Last Roll</span>
                                <div className="text-4xl font-black text-[#2c1d10] leading-none drop-shadow-md mb-1">{gameState.diceRoll.total}</div>
                                <div className="flex gap-1 text-slate-400 text-xs font-bold">
                                    <span>{gameState.diceRoll.die1}</span>
                                    <span>+</span>
                                    <span>{gameState.diceRoll.die2}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom-Left Floating Panels: Trade Proposal & Trade Market */}
                    {myPlayer && (
                        <div className="absolute bottom-0 left-0 z-20 w-[90%] md:w-80 lg:w-[360px] max-w-sm flex flex-col justify-end gap-2">
                            {/* P2P Trade Proposal */}
                            {gameState.gamePhase === 'P2P_TRADE_PENDING' && gameState.tradeProposal && (
                                <div className="bg-[#fcf7ec]/95 backdrop-blur-md rounded-tr-xl border-t-2 border-r-2 border-[#d3be9a] shadow-2xl p-3 flex flex-col">
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
                            )}

                            {/* Trade Market (collapsible) */}
                            <div className="relative">
                                {/* Toggle Tab */}
                                <button
                                    onClick={() => { playClick(); setShowTradeModal(prev => !prev); }}
                                    disabled={isSetupPhase}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-tr-xl border-r border-t border-slate-600 shadow-xl transition-colors ${isSetupPhase
                                        ? 'bg-slate-800/80 text-slate-600 cursor-not-allowed'
                                        : showTradeModal
                                            ? 'bg-slate-800/95 text-blue-400 border-blue-700'
                                            : 'bg-slate-800/80 text-slate-400 hover:text-blue-400 hover:border-blue-700'
                                        }`}
                                >
                                    <span>⚖ Trade Market</span>
                                    <span className="ml-2">{showTradeModal ? '▼' : '▲'}</span>
                                </button>

                                {/* Expanded Content */}
                                {showTradeModal && (
                                    <div className="bg-[#fcf7ec]/95 backdrop-blur-md border-r-2 border-t-2 border-[#d3be9a] rounded-tr-xl shadow-2xl p-2 md:p-3 max-h-[50vh] overflow-y-auto pointer-events-auto">
                                        <TradeModal
                                            gameState={gameState}
                                            myPlayerId={myPlayer.peerId}
                                            map={map}
                                            onClose={() => setShowTradeModal(false)}
                                            onBankTrade={handleBankTrade}
                                            onProposeTrade={handleProposeTrade}
                                            canPropose={isMyTurn && gameState.phase !== 'ROLL' && !isSetupPhase}
                                            initialOffer={tradeModalConfig.initialOffer}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Floating Controls (Roll/Build/End Turn) - Bottom Right inside Main Area */}
                    <div className="absolute bottom-[30px] md:bottom-0 right-0 z-10 flex flex-col items-end gap-2 pb-1 pr-1 md:pb-2 md:pr-2 lg:pb-3 lg:pr-4 md:scale-90 lg:scale-100 origin-bottom-right pointer-events-none">
                        {/* Build Costs Legend - sits above action buttons */}
                        <div className="flex flex-col gap-2 items-end pointer-events-auto">
                            <button
                                onClick={() => { playClick(); setShowBuildCosts(!showBuildCosts); }}
                                className="bg-[#fcf7ec]/90 hover:bg-[#fff9ea] text-[#7d6549] border-2 border-[#d3be9a] px-2 py-1 md:px-3 md:py-1.5 rounded md:rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md transition-colors flex items-center gap-1 md:gap-2"
                            >
                                <span>Build Costs</span>
                                <span>{showBuildCosts ? '▼' : '▲'}</span>
                            </button>
                            {showBuildCosts && (
                                <div className="flex flex-col gap-1 bg-[#fcf7ec]/95 backdrop-blur-md p-1.5 md:p-2.5 rounded md:rounded-lg border-2 border-[#d3be9a] shadow-xl text-[8px] md:text-[9px] uppercase font-black tracking-wider mb-1">
                                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                                        <span>street</span>
                                        <div className="flex gap-1 drop-shadow-sm">
                                            <img src={RESOURCE_ICONS.OAK} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.CLAY} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                                        <span>House</span>
                                        <div className="flex gap-1 drop-shadow-sm">
                                            <img src={RESOURCE_ICONS.OAK} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.CLAY} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.WOOL} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                                        <span>Fortress</span>
                                        <div className="flex gap-1 drop-shadow-sm">
                                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-[#5c4936]">
                                        <span>Card</span>
                                        <div className="flex gap-1 drop-shadow-sm">
                                            <img src={RESOURCE_ICONS.ORE} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.CEREALS} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            <img src={RESOURCE_ICONS.WOOL} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
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
                                                    <div className="relative group flex items-stretch">
                                                        <button onClick={() => isMyTurn && setBuildMode('HOUSE')} disabled={!isMyTurn || !canAffordHouse || !hasValidHouseSpots} title={isMyTurn && canAffordHouse && !hasValidHouseSpots ? "No valid spots available on board" : (!isMyTurn ? "Not your turn" : undefined)} className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border text-[9px] md:text-sm uppercase tracking-wider ${isMyTurn && canAffordHouse && hasValidHouseSpots ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white' : (isMyTurn && canAffordHouse && !hasValidHouseSpots ? 'bg-yellow-900/50 text-yellow-500 border-yellow-700 opacity-80 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-50 cursor-not-allowed')}`}>
                                                            House
                                                        </button>
                                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#f4e6cd] backdrop-blur border-2 border-[#7d6549] rounded-lg p-2 shadow-2xl w-32 pointer-events-none z-50">
                                                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#7d6549] border-b border-[#7d6549] pb-1 mb-1 text-center">Cost</span>
                                                            {Object.entries({ OAK: 1, CLAY: 1, CEREALS: 1, WOOL: 1 }).map(([res, cost]) => {
                                                                const has = myPlayer?.resources[res as keyof typeof myPlayer.resources] || 0;
                                                                return <div key={res} className="flex items-center justify-between text-[10px] font-bold mb-1"><div className="flex items-center gap-1.5"><img src={RESOURCE_ICONS[res]} className="w-3.5 h-3.5 drop-shadow-sm filter-none" alt="" /><span className="text-black">{res}</span></div><span className={has >= cost ? 'text-emerald-400' : 'text-red-500'}>{has}/{cost}</span></div>;
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="relative group flex items-stretch">
                                                        <button onClick={() => isMyTurn && setBuildMode('FORTRESS')} disabled={!isMyTurn || !canAffordFortress || !hasValidFortressSpots} title={isMyTurn && canAffordFortress && !hasValidFortressSpots ? "No valid spots available on board" : (!isMyTurn ? "Not your turn" : undefined)} className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border text-[9px] md:text-sm uppercase tracking-wider ${isMyTurn && canAffordFortress && hasValidFortressSpots ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white' : (isMyTurn && canAffordFortress && !hasValidFortressSpots ? 'bg-yellow-900/50 text-yellow-500 border-yellow-700 opacity-80 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-50 cursor-not-allowed')}`}>
                                                            Fortress
                                                        </button>
                                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#f4e6cd] backdrop-blur border-2 border-[#7d6549] rounded-lg p-2 shadow-2xl w-32 pointer-events-none z-50">
                                                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#7d6549] border-b border-[#7d6549] pb-1 mb-1 text-center">Cost</span>
                                                            {Object.entries({ CEREALS: 2, ORE: 3 }).map(([res, cost]) => {
                                                                const has = myPlayer?.resources[res as keyof typeof myPlayer.resources] || 0;
                                                                return <div key={res} className="flex items-center justify-between text-[10px] font-bold mb-1"><div className="flex items-center gap-1.5"><img src={RESOURCE_ICONS[res]} className="w-3.5 h-3.5 drop-shadow-sm filter-none" alt="" /><span className="text-black">{res}</span></div><span className={has >= cost ? 'text-emerald-400' : 'text-red-500'}>{has}/{cost}</span></div>;
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="relative group flex items-stretch">
                                                        <button onClick={() => isMyTurn && setBuildMode('street')} disabled={!isMyTurn || !canAffordStreet || !hasValidStreetSpots} title={isMyTurn && canAffordStreet && !hasValidStreetSpots ? "No valid spots available on board" : (!isMyTurn ? "Not your turn" : undefined)} className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border text-[9px] md:text-sm uppercase tracking-wider ${isMyTurn && canAffordStreet && hasValidStreetSpots ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white' : (isMyTurn && canAffordStreet && !hasValidStreetSpots ? 'bg-yellow-900/50 text-yellow-500 border-yellow-700 opacity-80 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-50 cursor-not-allowed')}`}>
                                                            street
                                                        </button>
                                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#f4e6cd] backdrop-blur border-2 border-[#7d6549] rounded-lg p-2 shadow-2xl w-32 pointer-events-none z-50">
                                                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#7d6549] border-b border-[#7d6549] pb-1 mb-1 text-center">Cost</span>
                                                            {Object.entries({ OAK: 1, CLAY: 1 }).map(([res, cost]) => {
                                                                const has = myPlayer?.resources[res as keyof typeof myPlayer.resources] || 0;
                                                                return <div key={res} className="flex items-center justify-between text-[10px] font-bold mb-1"><div className="flex items-center gap-1.5"><img src={RESOURCE_ICONS[res]} className="w-3.5 h-3.5 drop-shadow-sm filter-none" alt="" /><span className="text-black">{res}</span></div><span className={has >= cost ? 'text-emerald-400' : 'text-red-500'}>{has}/{cost}</span></div>;
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="relative group flex items-stretch">
                                                        <button onClick={() => isMyTurn && handleBuyCard()} disabled={!isMyTurn || !canAffordCard || gameState.actionCardDeck.length === 0} title={!isMyTurn ? "Not your turn" : undefined} className={`px-2 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl font-bold transition-colors shadow-xl border-2 text-[9px] text-white md:text-sm uppercase tracking-wider ${isMyTurn && canAffordCard && gameState.actionCardDeck.length > 0 ? 'bg-slate-700 hover:bg-slate-600 border-purple-500 text-purple-200' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'}`}>
                                                            Buy Card <span className="text-[8px] md:text-[10px] text-white font-normal">({gameState.actionCardDeck.length})</span>
                                                        </button>
                                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#f4e6cd] backdrop-blur border-2 border-[#7d6549] rounded-lg p-2 shadow-2xl w-32 pointer-events-none z-50">
                                                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#7d6549] border-b border-[#7d6549] pb-1 mb-1 text-center">Cost</span>
                                                            {Object.entries({ CEREALS: 1, WOOL: 1, ORE: 1 }).map(([res, cost]) => {
                                                                const has = myPlayer?.resources[res as keyof typeof myPlayer.resources] || 0;
                                                                return <div key={res} className="flex items-center justify-between text-[10px] font-bold mb-1"><div className="flex items-center gap-1.5"><img src={RESOURCE_ICONS[res]} className="w-3.5 h-3.5 drop-shadow-sm filter-none" alt="" /><span className="text-black">{res}</span></div><span className={has >= cost ? 'text-emerald-400' : 'text-red-500'}>{has}/{cost}</span></div>;
                                                            })}
                                                        </div>
                                                    </div>

                                                    {pendingBuild?.type === 'ACTION_CARD' && (
                                                        <div className="absolute bottom-16 right-full mr-4 bg-[#f4e6cd] backdrop-blur-md p-3 rounded-xl border-2 border-[#7d6549] shadow-2xl flex flex-col items-center pointer-events-auto w-48 z-50">
                                                            <span className="text-xs text-[#7d6549] font-bold mb-2 text-center uppercase tracking-wider">Confirm Purchase?</span>
                                                            <span className="text-[10px] text-black font-bold mb-3 text-center">Cost: 1 Ore, 1 Wool, 1 Cereal</span>
                                                            <div className="flex gap-2 w-full">
                                                                <button onClick={handleConfirmBuild} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 rounded font-bold cursor-pointer transition-colors shadow-md">✓ Buy</button>
                                                                <button onClick={handleCancelBuild} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs py-1.5 rounded font-bold cursor-pointer transition-colors shadow-md">✗ Cancel</button>
                                                            </div>
                                                        </div>
                                                    )}

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
                        </div>{/* end flex gap-3 action buttons */}
                    </div>{/* end absolute bottom-0 right-0 flex-col */}
                </main>

                {/* Right Sidebar */}
                <div className="w-full md:w-56 lg:w-72 flex flex-row md:flex-col gap-2 lg:gap-4 shrink-0 min-h-0">
                    <div className="flex-1 flex flex-col gap-2 lg:gap-4 min-w-0">
                        {/* Bank Resources Panel */}
                        {!settings.hideBankResources && (
                            <div className="bg-[#f4e6cd] rounded-xl border-2 border-[#d3be9a] shadow-lg shrink-0 flex flex-col overflow-hidden">
                                <button
                                    onClick={() => { playClick(); setShowBankPanel(!showBankPanel); }}
                                    className="bg-[#ebd8b7] shadow-inner p-2 md:p-3 border-b-2 border-[#d3be9a] font-black text-[10px] md:text-xs uppercase text-[#7d6549] tracking-wider flex justify-between items-center hover:bg-[#dcc9a5] transition"
                                >
                                    <span>Bank Resources</span>
                                    <span>{showBankPanel ? '▼' : '▲'}</span>
                                </button>
                                {showBankPanel && (
                                    <div className="p-2 md:p-3 flex flex-col md:grid md:grid-cols-2 gap-1.5 md:gap-2 max-h-32 md:max-h-none overflow-y-auto md:overflow-visible">
                                        {['OAK', 'CLAY', 'CEREALS', 'WOOL', 'ORE'].map(res => {
                                            const totalInPlay = gameState.players.reduce((sum, p) => sum + (p.resources[res as keyof typeof p.resources] || 0), 0);
                                            const remaining = Math.max(0, 19 - totalInPlay);
                                            const grad = RESOURCE_GRADIENTS[res] || { center: '#334155', edge: '#0f172a' };
                                            let textClass = "text-white drop-shadow-sm";
                                            let numBgClass = "bg-black/40";
                                            let numTextClass = "text-white";

                                            if (res === 'CEREALS' || res === 'NUGGETS' || res === 'WOOL') {
                                                textClass = "text-[#2a1c0d] drop-shadow-none";
                                                numBgClass = "bg-[#2a1c0d]/20";
                                                numTextClass = "text-[#2a1c0d]";
                                            }

                                            return (
                                                <div
                                                    key={res}
                                                    className="relative p-1 md:p-1.5 rounded border border-black/30 flex justify-between items-center shadow-md overflow-hidden shrink-0"
                                                    style={{ background: `radial-gradient(circle at center, ${grad.center}, ${grad.edge})` }}
                                                >
                                                    {RESOURCE_TEXTURES[res] && (
                                                        <div
                                                            className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-50 mix-blend-overlay"
                                                            style={{ backgroundImage: `url(${RESOURCE_TEXTURES[res]})` }}
                                                        />
                                                    )}
                                                    <span className={`relative z-10 text-[9px] md:text-[10px] font-bold ${textClass} mr-1`}>{res}</span>
                                                    <span className={`relative z-10 font-black ${numTextClass} ${numBgClass} px-1.5 rounded text-[10px] md:text-xs`}>{remaining}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Game Log (Top Right) */}
                        <div className="flex flex-col gap-2 shrink-0 max-h-40 md:h-40">
                            <button onClick={() => { playClick(); setShowLogs(!showLogs); }} className="md:hidden w-full bg-[#f4e6cd] p-2 text-[10px] font-black text-[#7d6549] uppercase tracking-wider rounded-xl border-2 border-[#d3be9a] shadow-lg flex justify-between items-center shrink-0">
                                <span>Game Log</span>
                                <span>{showLogs ? '▼' : '▲'}</span>
                            </button>
                            <div className={`${showLogs ? 'flex' : 'hidden'} md:flex bg-[#f4e6cd] rounded-xl border-2 border-[#d3be9a] shadow-lg h-32 md:h-full shrink-0 flex-col overflow-hidden`}>
                                <div className="hidden md:block bg-[#ebd8b7] shadow-inner p-2 border-b-2 border-[#d3be9a] font-black text-[10px] uppercase text-[#7d6549] tracking-wider shrink-0">
                                    Game Log
                                </div>
                                <div className="p-2 overflow-y-auto flex-grow space-y-1 text-[10px] md:text-xs flex flex-col-reverse text-[#5c4936]">
                                    {[...gameState.logs].reverse().map((log, i) => {
                                        if (log.includes('|STEAL|')) {
                                            const [msg, , stealerId, targetId, resource] = log.split('|');
                                            const canSee = myPlayer?.peerId === stealerId || myPlayer?.peerId === targetId;
                                            return (
                                                <div key={i} className="text-slate-300 border-b border-slate-700/50 pb-1">
                                                    {canSee ? msg.replace('a resource', `1 ${resource}`) : msg}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={i} className="text-[#5c4936] border-b border-[#d3be9a]/50 pb-1">{log}</div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 lg:gap-4 min-w-0">
                        {/* Players List (Below Log) */}
                        <div className="flex-grow bg-[#f4e6cd] rounded-xl border-2 border-[#d3be9a] shadow-lg p-2 md:p-3 flex flex-col gap-1 md:gap-2 overflow-y-auto min-h-0">
                            <h3 className="font-black text-[#7d6549] uppercase text-[10px] md:text-xs tracking-wider mb-1 shrink-0">Players</h3>
                            {gameState.players.map(p => (
                                <div key={p.peerId} className={`p-1.5 md:p-2 rounded border-2 transition-colors flex flex-col gap-1 md:gap-2 shrink-0 ${p.peerId === currentPlayer?.peerId ? 'border-[#2f8a43] bg-[#e0eddf]' : 'border-[#d3be9a] bg-[#f4e6cd]/60'}`}>
                                    <div className="flex items-center gap-1.5 md:gap-2 truncate">
                                        <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0" style={{ backgroundColor: PLAYER_COLORS[p.color as keyof typeof PLAYER_COLORS].hex }}></div>
                                        <span className="font-bold text-xs md:text-sm truncate text-[#2c1d10]">{p.username}</span>
                                    </div>
                                    <div className="flex gap-1.5 md:gap-3 text-[10px] md:text-xs items-center mt-0.5 md:mt-1">
                                        <div className="flex gap-1 md:gap-2">
                                            <span title="Victory Points" className="bg-slate-800/80 px-1 py-0.5 rounded shadow border border-slate-700">VP: <span className="text-white font-bold">{p.victoryPoints}{p.peerId === myPlayer?.peerId ? (() => { const monuments = p.actionCards.filter(c => c.type === 'MONUMENT').length; return monuments >= 1 ? <span className="text-emerald-400 font-normal">+{monuments}</span> : ''; })() : ''}</span></span>
                                            <span title="Cards" className="bg-slate-800/80 px-1 py-0.5 rounded shadow border border-slate-700 text-slate-300">🃏 <span className="text-white font-bold">{Object.values(p.resources).reduce((a, b) => a + b, 0)}</span></span>
                                        </div>
                                        <div className="flex ml-auto gap-1 md:gap-2">
                                            <div className={`flex items-center gap-0.5 md:gap-1 px-1 py-0.5 rounded shadow border ${gameState.longestStreetHolder === p.peerId ? 'bg-amber-900 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`} title="Street Length">
                                                <span className="text-[9px] md:text-[10px]">🚧</span>
                                                <span className="font-bold">{gameState.longestStreetHolder === p.peerId ? gameState.longestStreetLength : getLongestStreetForPlayer(gameState, p.peerId)}</span>
                                            </div>
                                            <div className={`flex items-center gap-0.5 md:gap-1 px-1 py-0.5 rounded shadow border ${gameState.largestClanHolder === p.peerId ? 'bg-red-900 border-red-500 text-red-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`} title="Clan Size">
                                                <span className="text-[9px] md:text-[10px]">⚔️</span>
                                                <span className="font-bold">{gameState.largestClanHolder === p.peerId ? gameState.largestClanSize : (gameState.playedNinjaCards[p.peerId] || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>{/* end Right Sidebar */}
            </div>{/* end flex-grow flex gap-4 */}

            {/* FLOATING_ANIMATIONS_ROOT */}
            {recentAnimations.map(anim => {
                let positionClass = '';
                if (anim.event === 'TRADE') {
                    // bottom-left, slightly above absolute bottom so it floats over the modal
                    positionClass = 'bottom-32 left-12';
                } else if (anim.event === 'BUILD') {
                    // bottom-right, directly from the specific Build action buttons
                    positionClass = 'bottom-20 right-80';
                } else if (anim.event === 'YIELD') {
                    // Top-Left area of the central game board (or right next to local player avatar)
                    positionClass = 'top-20 left-[280px]';
                }

                return (
                    <div key={anim.id} className={`fixed z-[200] ${positionClass} animate-float-up pointer-events-none flex flex-wrap gap-4 drop-shadow-2xl font-black bg-[#2c1d10]/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-[#a37941]/50 block w-max`}>
                        {anim.diffs.map((d, i) => (
                            <div key={i} className={`flex items-center gap-2 text-2xl ${d.diff > 0 ? 'text-emerald-400' : 'text-red-500'}`} style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                {d.diff > 0 ? '+' : ''}{d.diff}
                                {RESOURCE_ICONS[d.res] && <img src={RESOURCE_ICONS[d.res]} className="w-8 h-8 drop-shadow-sm filter-none" alt={d.res} />}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};