import React, { useEffect, useState } from 'react';
import { peerService } from '../network/PeerService';
import { Send, Users, Wifi, LogOut } from 'lucide-react';
import { generateMap } from '../game/MapGenerator';
import { type MapTemplate } from '../game/mapTemplates';
import { type PlayerData, type PlayerColor, PLAYER_COLORS } from '../game/Player';
import { type GameSettings, type GameState, createInitialGameState } from '../game/GameState';
import { useSounds } from '../context/SoundContext';
import { DonateButton } from './DonateButton';
import { APP_VERSION } from '../version';

import tableBg from '/assets/textures/table-background.webp?url';
import angle1 from '/assets/UI/Angle1.webp?url';
import angle2 from '/assets/UI/Angle2.webp?url';

export const Lobby: React.FC<{ initialSettings?: GameSettings, onDisconnect: () => void, onStartGame: (map: MapTemplate, players: PlayerData[], settings: GameSettings, resumingState?: GameState) => void }> = ({ initialSettings, onDisconnect, onStartGame }) => {
  const { playClick, playConnect, playStart, playDisconnect } = useSounds();
  const [messages, setMessages] = useState<{ senderId: string; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);

  const [settings, setSettings] = useState<GameSettings>(initialSettings || {
    hideBankResources: false,
    winPoints: 10,
    turnTimer: null,
    discardLimit: 7,
    trueRoll: false,
    gameMode: 'standard',
    balancedResources: true,
    safeNinja: false
  });
  const settingsRef = React.useRef<GameSettings>(settings);
  const playersRef = React.useRef<PlayerData[]>([]);
  const [players, _setPlayers] = useState<PlayerData[]>([]);
  const [uiScale, setUiScale] = useState(1);
  // Ref imperativo per deduplicare i JOIN_LOBBY (evita race condition con lo stato React)
  const joinedPeers = React.useRef<Set<string>>(new Set());

  // Wrapper che aggiorna sia lo stato che il ref speculare
  const setPlayers = React.useCallback((value: PlayerData[] | ((prev: PlayerData[]) => PlayerData[])) => {
    _setPlayers(prev => {
      const next = typeof value === 'function' ? (value as (p: PlayerData[]) => PlayerData[])(prev) : value;
      playersRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const height = window.innerHeight;
      const width = window.innerWidth;
      // Depending on whether it's horizontal (desktop) or stacked (mobile), the bounding unscaled height is different.
      const baseUiHeight = width >= 1024 ? 800 : 1200;

      if (height < baseUiHeight) {
        setUiScale(Math.max(0.35, height / baseUiHeight));
      } else {
        setUiScale(1);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const prevPlayersCount = React.useRef(players.length);
  useEffect(() => {
    if (players.length < prevPlayersCount.current) {
      playDisconnect();
    } else if (players.length > prevPlayersCount.current && prevPlayersCount.current > 0) {
      playConnect();
    }
    prevPlayersCount.current = players.length;
  }, [players.length, playDisconnect, playConnect]);

  // Automatically executed when component mounts
  useEffect(() => {
    const myUsername = localStorage.getItem('klatana_username') || 'Unknown';

    if (peerService.role === 'host') {
      // Host immediately registers themselves as Red
      setPlayers([{
        peerId: peerService.peerId,
        playerId: peerService.playerId,
        username: myUsername,
        color: 'RED',
        isHost: true
      }]);
      // The host just mounted the lobby. Elicit JOIN_LOBBY from clients who might have already returned to the lobby.
      setTimeout(() => {
        peerService.broadcast({ type: 'PING_LOBBY' });
      }, 500);
    } else {
      // Client sends JOIN intent to Host as soon as they render the lobby
      const connectedPeers = peerService.getConnectedPeers();
      if (connectedPeers.length > 0) {
        peerService.sendTo(connectedPeers[0], { type: 'JOIN_LOBBY', username: myUsername, playerId: peerService.playerId });
      }
    }

    // Setup network listeners
    peerService.onConnection((_conn) => {
      // We don't automatically add them to UI array here, we wait for their JOIN_LOBBY msg
    });

    peerService.onPeerDisconnect((disconnectedPeerId) => {
      joinedPeers.current.delete(disconnectedPeerId);

      const leaving = playersRef.current.find(p => p.peerId === disconnectedPeerId);
      const leaveText = leaving ? `${leaving.username} left the lobby` : `Peer ${disconnectedPeerId.substring(0, 6)}... disconnected`;
      const nextPlayers = playersRef.current.filter(p => p.peerId !== disconnectedPeerId);

      setPlayers(nextPlayers);
      setMessages(m => [...m, { senderId: 'SYSTEM', text: leaveText }]);

      if (peerService.role === 'host') {
        peerService.broadcast({ type: 'LOBBY_STATE', players: nextPlayers });
        peerService.broadcast({ type: 'LOBBY_MSG', text: leaveText });
      }
    });

    peerService.onMessage((data: any, incomingPeerId: string) => {
      if (data.type === 'chat') {
        setMessages((prev) => [...prev, { senderId: incomingPeerId, text: data.message }]);
      }
      else if (data.type === 'startGame') {
        playStart();
        peerService.gameStatus = 'IN_PROGRESS';
        onStartGame(data.map, data.players, data.settings, data.state);
      }
      else if (data.type === 'RESUME_GAME') {
        peerService.gameStatus = 'IN_PROGRESS';
        onStartGame(data.map, data.players, data.state.settings, data.state);
      }
      else if (data.type === 'LOBBY_STATE') {
        // Client receives master lobby state from Host
        setPlayers(data.players);
      }
      else if (data.type === 'LOBBY_MSG') {
        // System message broadcast from Host to all clients
        setMessages(m => [...m, { senderId: 'SYSTEM', text: data.text }]);
      }
      else if (data.type === 'LOBBY_SETTINGS') {
        if (data.settings) {
          setSettings(data.settings);
          settingsRef.current = data.settings;
        }
      }
      else if (data.type === 'PING_LOBBY' && peerService.role !== 'host') {
        const connectedPeers = peerService.getConnectedPeers();
        if (connectedPeers.length > 0) {
          peerService.sendTo(connectedPeers[0], { type: 'JOIN_LOBBY', username: localStorage.getItem('klatana_username') || 'Unknown', playerId: peerService.playerId });
        }
      }
      else if (peerService.role === 'host') {
        // HOST ONLY ACTIONS
        if (data.type === 'JOIN_LOBBY') {
          // Guard imperativo: evita doppio processing
          if (joinedPeers.current.has(incomingPeerId)) return;
          joinedPeers.current.add(incomingPeerId);

          const joinText = `${data.username} joined the lobby`;

          // Calcola il nuovo stato in modo imperativo usando il ref
          const usedColors = playersRef.current.map(p => p.color).filter(c => c !== null);
          const available = (Object.keys(PLAYER_COLORS) as PlayerColor[]).filter(c => !usedColors.includes(c));
          const assigned = available.length > 0 ? available[0] : null;
          const nextPlayers = [...playersRef.current, { peerId: incomingPeerId, playerId: data.playerId, username: data.username, color: assigned, isHost: false }];

          setPlayers(nextPlayers);
          setMessages(m => [...m, { senderId: 'SYSTEM', text: joinText }]);

          setTimeout(() => {
            peerService.broadcast({ type: 'LOBBY_STATE', players: playersRef.current });
            peerService.broadcast({ type: 'LOBBY_SETTINGS', settings: settingsRef.current });
            peerService.broadcast({ type: 'LOBBY_MSG', text: joinText });
          }, 100);
        }
        else if (data.type === 'SELECT_COLOR') {
          setPlayers(prev => {
            // Check if color is taken
            const isTaken = prev.some(p => p.color === data.color);
            if (isTaken) return prev; // don't change

            const next = prev.map(p => p.peerId === incomingPeerId ? { ...p, color: data.color } : p);
            setTimeout(() => peerService.broadcast({ type: 'LOBBY_STATE', players: next }), 10);
            return next;
          });
        }
      }
    });

  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    peerService.broadcast({ type: 'chat', message: inputValue });
    setMessages((prev) => [...prev, { senderId: 'YOU', text: inputValue }]);
    setInputValue('');
  };

  const updateSettings = (updates: Partial<GameSettings>) => {
    if (peerService.role !== 'host') return;
    playClick();
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    settingsRef.current = newSettings;
    peerService.broadcast({ type: 'LOBBY_SETTINGS', settings: newSettings });
  };

  const handleStartGameClick = async () => {
    if (peerService.role === 'host') {
      playStart();
      const newMap = generateMap(settingsRef.current.gameMode, settingsRef.current.balancedResources);
      try {
        await peerService.setGameStarted();
      } catch (err) {
        console.warn("Failed to set room status to IN_PROGRESS in Firebase. Continuing P2P...", err);
      }
      const initialGameState = createInitialGameState(players, newMap, settingsRef.current);
      peerService.broadcast({ type: 'startGame', map: newMap, players, settings: settingsRef.current, state: initialGameState });
      onStartGame(newMap, players, settingsRef.current, initialGameState);
    }
  };

  const getContrastColor = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.179 ? 'black' : 'white';
  };

  const handleColorSelect = (color: PlayerColor) => {
    playClick();
    if (players.some(p => p.color === color)) return; // Color taken
    if (peerService.role === 'host') {
      setPlayers(prev => {
        const next = prev.map(p => p.peerId === peerService.peerId ? { ...p, color } : p);
        peerService.broadcast({ type: 'LOBBY_STATE', players: next });
        return next;
      });
    } else {
      const hostId = peerService.getConnectedPeers()[0];
      peerService.sendTo(hostId, { type: 'SELECT_COLOR', color });
    }
  };

  const getMyPlayer = () => players.find(p => p.peerId === peerService.peerId);

  return (
    <div className="min-h-[100dvh] w-full relative overflow-y-auto overflow-x-hidden bg-cyan-700"
      style={{
        backgroundImage: `url(${tableBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}>

      {/* Main Container */}
      <div
        className="relative lg:absolute lg:left-1/2 lg:top-1/2 w-full max-w-[95%] lg:max-w-[1300px] bg-gradient-to-br from-[#f4e6cd] to-[#e4cdad] rounded-[16px] shadow-[0_15px_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#a37941] z-10 transition-transform duration-100 ease-out flex flex-col h-auto lg:h-[750px] p-2 md:p-4 my-8 mx-auto lg:my-0 lg:mx-0"
        style={window.innerWidth >= 1024 ? { transform: `translate(-50%, -50%) scale(${uiScale})`, transformOrigin: 'center' } : {}}
      >
        {/* Corners UI Images */}
        <img src={angle1} alt="" className="absolute -top-[14px] -left-[14px] w-14 h-14 z-20 pointer-events-none drop-shadow-md rotate-180 transition-all" />
        <img src={angle2} alt="" className="absolute -top-[14px] -right-[14px] w-14 h-14 z-20 pointer-events-none drop-shadow-md rotate-270 transition-all" />
        <img src={angle2} alt="" className="absolute -bottom-[14px] -left-[14px] w-14 h-14 z-20 pointer-events-none drop-shadow-md rotate-90 transition-all" />
        <img src={angle1} alt="" className="absolute -bottom-[14px] -right-[14px] w-14 h-14 z-20 pointer-events-none drop-shadow-md transition-all" />

        <div className="flex-grow flex flex-col lg:flex-row gap-4 overflow-hidden relative z-10 p-2">

          {/* Left Sidebar */}
          <div className="w-full lg:w-[20%] flex flex-col gap-4 flex-shrink-0 max-h-full overflow-y-auto pr-1">
            <div className="bg-[#f4e6cd] border-2 border-[#d3be9a] rounded-xl p-5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),0_4px_10px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-3">
                  <div className="bg-[#ebd5ad] border border-[#d3be9a] shadow-inner p-2 rounded-lg shrink-0">
                    <Wifi className="w-6 h-6 text-[#1e582d]" />
                  </div>
                  <div>
                    <h2 className="text-xs text-[#7d6549] font-bold uppercase tracking-wider drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">Room Code</h2>
                    <p className="text-3xl font-bold tracking-widest text-[#2c1d10] leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,1)]">
                      {peerService.roomCode}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { playDisconnect(); onDisconnect(); }}
                  className="bg-[#d15431] text-[#fdf7e1] p-2 rounded-lg border-2 border-[#5e1e0c] shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.4)] hover:bg-[#e05b36] hover:scale-105 active:scale-95 transition-all shrink-0 self-start"
                  title="Disconnect & Return to Menu"
                >
                  <LogOut className="w-5 h-5 drop-shadow-md" />
                </button>
              </div>
              <div className="text-sm font-semibold text-[#8f7457]">
                Role: <span className="text-[#2c1d10] capitalize">{peerService.role}</span>
              </div>
            </div>

            <div className="bg-[#f4e6cd] border-2 border-[#d3be9a] rounded-xl p-5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),0_4px_10px_rgba(0,0,0,0.1)] flex flex-col flex-grow">
              <div className="flex items-center gap-2 mb-4 border-b-2 border-[#d3be9a] pb-3">
                <Users className="w-5 h-5 text-[#865d36]" />
                <h2 className="font-bold text-lg text-[#2c1d10] tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">Players ({players.length}/6)</h2>
              </div>

              <ul className="space-y-2.5 flex-grow">
                {players.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 bg-[#fbf7ee] p-2.5 rounded-lg border-2 border-[#e6d9b9] shadow-inner">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 min-w-5 rounded-full flex-shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_2px_rgba(255,255,255,1)] border border-[#a37941]"
                        style={{ backgroundColor: p.color ? PLAYER_COLORS[p.color].hex : '#94a3b8' }}
                      ></div>
                      <span className="font-bold text-[#3b2a1a]">
                        {p.username} {p.peerId === peerService.peerId ? <span className="text-[#a0743b] text-[11px] ml-1 uppercase">(You)</span> : ''}
                      </span>
                    </div>
                    {p.isHost && <span className="text-[10px] bg-[#d3bc9a] text-[#4d3c2a] border border-[#a37941] px-2 py-0.5 rounded shadow-inner uppercase font-black tracking-widest">Host</span>}
                  </li>
                ))}
              </ul>

              {/* Color Selector */}
              <div className="mt-5 border-t-2 border-[#d3be9a] pt-4">
                <h3 className="text-xs text-[#7d6549] uppercase font-bold mb-3 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">Choose your color</h3>
                <div className="flex gap-2 flex-wrap justify-start">
                  {(Object.keys(PLAYER_COLORS) as PlayerColor[]).map((c) => {
                    const isTaken = players.some(p => p.color === c && p.peerId !== peerService.peerId);
                    const isMine = getMyPlayer()?.color === c;
                    return (
                      <button
                        key={c}
                        onClick={() => handleColorSelect(c)}
                        disabled={isTaken}
                        className={`relative w-8 h-8 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_2px_3px_rgba(0,0,0,0.2)] border-2 transition-all ${isTaken ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:scale-110 active:scale-95 cursor-pointer'} ${isMine ? 'ring-2 ring-offset-2 ring-offset-[#f4e6cd] ring-cyan-600 border-white' : 'border-[#2d1b0f]'}`}
                        style={{ backgroundColor: PLAYER_COLORS[c].hex }}
                        title={isTaken ? `${PLAYER_COLORS[c].name} — taken` : `Select ${PLAYER_COLORS[c].name}`}
                        aria-label={isTaken ? `${PLAYER_COLORS[c].name} — taken` : `Select ${PLAYER_COLORS[c].name}`}
                      >
                        {isTaken && (
                          <svg viewBox="0 0 16 16" className="absolute inset-0 w-full h-full p-1.5 pointer-events-none">
                            <line x1="2" y1="2" x2="14" y2="14" stroke={getContrastColor(PLAYER_COLORS[c].hex)} strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="14" y1="2" x2="2" y2="14" stroke={getContrastColor(PLAYER_COLORS[c].hex)} strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t-2 border-[#d3be9a] flex flex-col items-center">
                {(() => {
                  const allPlayersReady = peerService.role === 'host' ? players.length > 0 : true;
                  return (
                    <button
                      onClick={handleStartGameClick}
                      disabled={peerService.role !== 'host' || !allPlayersReady}
                      className="w-full flex font-bold rounded-xl shadow-[0_6px_10px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.3)] border-t border-[#64dc7f] border-b-[5px] border-[#113118] transition-transform active:translate-y-[4px] active:border-b-[1px] active:mb-[4px] disabled:opacity-75 disabled:filter disabled:grayscale-[0.5] disabled:active:translate-y-0 overflow-hidden group flex-col items-center justify-center p-0"
                    >
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#3ca956] via-[#2f8a43] to-[#1c552a] group-hover:from-[#4ac565] group-hover:to-[#226834] text-[#f7efd8] py-3 drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]">
                        <span className="text-lg tracking-wider uppercase">{peerService.role === 'host' ? 'Launch Game' : 'Waiting...'}</span>
                        {peerService.role === 'host' && !allPlayersReady && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#b1dfbc] mt-1 shadow-none">Waiting for players to return...</span>
                        )}
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Central Area: Game Settings */}
          <div className="w-full lg:w-[60%] flex flex-col gap-4 overflow-hidden">
            <div className="bg-[#f4e6cd] h-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),0_4px_10px_rgba(0,0,0,0.1)] border-2 border-[#d3be9a] rounded-xl flex flex-col p-4 md:p-6 overflow-hidden relative">
              <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[#d3be9a] flex-shrink-0">
                <h2 className="text-xl md:text-3xl font-black text-[#2c1d10] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">Rulebook &amp; Settings</h2>
                <span className="text-[10px] md:text-xs font-black px-2.5 py-1 bg-[#2f8a43] text-[#f7efd8] border border-[#175225] rounded-md shadow-sm uppercase tracking-wider">
                  {APP_VERSION}
                </span>
              </div>

              {peerService.role !== 'host' && (
                <div className="mb-4 text-sm font-bold text-[#865913] bg-[#f8dfb1] shadow-inner rounded-xl px-4 py-3 text-center border-2 border-[#be9a55] flex-shrink-0">
                  Only the host can modify the game rules.
                </div>
              )}

              {/* Scrollable Settings Area */}
              <div className="overflow-y-auto pr-3 space-y-4 pb-4 custom-scrollbar">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                  {/* ── Map Generation ── */}
                  <div className="col-span-1 xl:col-span-2">
                    <h3 className="text-xs uppercase tracking-widest text-[#a37941] font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] border-b border-[#e1ceaf] pb-1">Geography</h3>
                  </div>

                  <div className="flex items-start gap-3 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <input type="checkbox" id="balanced" checked={settings.balancedResources}
                      onChange={(e) => peerService.role === 'host' && updateSettings({ balancedResources: e.target.checked })}
                      disabled={peerService.role !== 'host'}
                      className={`mt-1 w-5 h-5 rounded border-[#a37941] bg-[#dbcdb2] accent-[#2f8a43] shadow-inner outline-none ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
                    <label htmlFor="balanced" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
                      <span className="font-black block text-[#3b2a1a] text-sm uppercase tracking-wide">Balanced Resources</span>
                      <span className="text-xs text-[#7d6549] font-medium leading-tight block mt-1">Prevents high-yield red numbers (6, 8) from being placed on adjacent hexes.</span>
                    </label>
                  </div>
                  <div className="flex items-start gap-3 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <div className="flex flex-col flex-1 gap-1.5">
                      <label htmlFor="gameMode" className="font-black block text-[#3b2a1a] text-sm uppercase tracking-wide">Game Mode</label>
                      <select id="gameMode"
                        value={settings.gameMode}
                        onChange={(e) => updateSettings({ gameMode: e.target.value as 'standard' | 'xl' })}
                        disabled={peerService.role !== 'host'}
                        className={`bg-[#f0e3cc] border-2 border-[#dec49a] text-[#7d6549] font-bold text-sm rounded-lg px-3 py-2 mt-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] outline-none ${peerService.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-[#865913] cursor-pointer'}`}>
                        <option value="standard">Standard (19 Hexes)</option>
                        <option value="xl">XL Map (37 Hexes)</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Victory ── */}
                  <div className="col-span-1 xl:col-span-2 mt-2">
                    <h3 className="text-xs uppercase tracking-widest text-[#a37941] font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] border-b border-[#e1ceaf] pb-1">Victory & Limits</h3>
                  </div>

                  <div className="flex flex-col gap-2.5 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <div className="flex items-center justify-between">
                      <label htmlFor="winPoints" className="text-sm font-black text-[#3b2a1a] uppercase tracking-wide">
                        Victory Points
                      </label>
                      <span className="text-lg font-black text-[#fdf7e1] bg-[#2d8340] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] px-3 py-0.5 rounded-lg border border-[#113118] min-w-[3rem] text-center tabular-nums">
                        {settings.winPoints}
                      </span>
                    </div>
                    <input
                      id="winPoints"
                      type="range"
                      min={3} max={20} step={1}
                      value={settings.winPoints}
                      onChange={(e) => updateSettings({ winPoints: Number(e.target.value) })}
                      disabled={peerService.role !== 'host'}
                      className={`w-full h-2.5 mt-2 rounded-full appearance-none bg-[#cfb793] shadow-inner accent-[#2f8a43] ${peerService.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                    <span className="text-xs text-[#7d6549] font-medium leading-tight mt-1">First player to reach this score wins the game.</span>
                  </div>

                  <div className="flex flex-col gap-2.5 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <div className="flex items-center justify-between">
                      <label htmlFor="discardLimit" className="text-sm font-black text-[#3b2a1a] uppercase tracking-wide">
                        Safe Hand Limit <span className="text-[#a37941] font-bold text-[10px] ml-1">(Ninja)</span>
                      </label>
                      <span className="text-lg font-black text-[#fdf7e1] bg-[#d15431] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] px-3 py-0.5 rounded-lg border border-[#5e1e0c] min-w-[3rem] text-center tabular-nums">
                        {settings.discardLimit}
                      </span>
                    </div>
                    <input
                      id="discardLimit"
                      type="range"
                      min={1} max={20} step={1}
                      value={settings.discardLimit}
                      onChange={(e) => updateSettings({ discardLimit: Number(e.target.value) })}
                      disabled={peerService.role !== 'host'}
                      className={`w-full h-2.5 mt-2 rounded-full appearance-none bg-[#cfb793] shadow-inner accent-[#d15431] ${peerService.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                    <span className="text-xs text-[#7d6549] font-medium leading-tight mt-1">Max cards held before a consequence on a roll of 7.</span>
                  </div>

                  {/* ── Dice & Turns ── */}
                  <div className="col-span-1 xl:col-span-2 mt-2">
                    <h3 className="text-xs uppercase tracking-widest text-[#a37941] font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] border-b border-[#e1ceaf] pb-1">Mechanics & Time</h3>
                  </div>

                  <div className="flex items-start gap-3 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <input type="checkbox" id="trueRoll"
                      checked={settings.trueRoll}
                      onChange={(e) => updateSettings({ trueRoll: e.target.checked })}
                      disabled={peerService.role !== 'host'}
                      className={`mt-1 w-5 h-5 rounded border-[#a37941] bg-[#dbcdb2] accent-[#2f8a43] shadow-inner outline-none ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
                    <label htmlFor="trueRoll" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
                      <span className="font-black block text-[#3b2a1a] text-sm uppercase tracking-wide">True RNG Dice</span>
                      <span className="text-xs text-[#7d6549] font-medium leading-tight block mt-1">Disable "Dice Deck" (which forces fair distributions) for pure mathematical randomness.</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-3 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <input type="checkbox" id="hideBankRes"
                      checked={settings.hideBankResources}
                      onChange={(e) => updateSettings({ hideBankResources: e.target.checked })}
                      disabled={peerService.role !== 'host'}
                      className={`mt-1 w-5 h-5 rounded border-[#a37941] bg-[#dbcdb2] accent-[#2f8a43] shadow-inner outline-none ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
                    <label htmlFor="hideBankRes" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
                      <span className="font-black block text-[#3b2a1a] text-sm uppercase tracking-wide">Hide Bank Resources</span>
                      <span className="text-xs text-[#7d6549] font-medium leading-tight block mt-1">Conceals global remaining resources from the HUD to prevent card-counting.</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-3 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <input type="checkbox" id="safeNinja"
                      checked={settings.safeNinja}
                      onChange={(e) => updateSettings({ safeNinja: e.target.checked })}
                      disabled={peerService.role !== 'host'}
                      className={`mt-1 w-5 h-5 rounded border-[#a37941] bg-[#dbcdb2] accent-[#2f8a43] shadow-inner outline-none ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
                    <label htmlFor="safeNinja" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
                      <span className="font-black block text-[#3b2a1a] text-sm uppercase tracking-wide">Gentle Ninja Rules</span>
                      <span className="text-xs text-[#7d6549] font-medium leading-tight block mt-1">Players safely under 3 Victory Points cannot be targeted for direct theft.</span>
                    </label>
                  </div>

                  <div className="flex flex-col gap-1.5 bg-[#ebd8b7] shadow-inner p-4 rounded-xl border-2 border-[#dec49a]">
                    <label htmlFor="turnTimer" className="font-black block text-[#3b2a1a] text-sm uppercase tracking-wide">Turn Timer</label>
                    <select id="turnTimer"
                      value={settings.turnTimer ?? 'off'}
                      onChange={(e) => updateSettings({ turnTimer: e.target.value === 'off' ? null : Number(e.target.value) })}
                      disabled={peerService.role !== 'host'}
                      className={`bg-[#f0e3cc] border-2 border-[#dec49a] text-[#3b2a1a] font-bold text-sm rounded-lg px-3 py-2 mt-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] outline-none ${peerService.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-[#865913] cursor-pointer'}`}>
                      <option value="off">Casual (No Limit)</option>
                      {/*<option value="5">Debug (5s)</option>*/}
                      <option value="30">Flash (30s)</option>
                      <option value="60">Fast (60s)</option>
                      <option value="120">Relaxed (120s)</option>
                      <option value="240">Slow (240s)</option>
                      <option value="300">Sloth (300s)</option>
                    </select>
                    <span className="text-xs text-[#7d6549] font-medium leading-tight mt-1">Automatically ends a player's turn when time expires.</span>
                  </div>
                </div>{/* end grid */}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Chat Area */}
          <div className={`w-full lg:w-[20%] bg-[#f4e6cd] border-2 border-[#d3be9a] rounded-xl flex flex-col overflow-hidden flex-shrink-0 transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),0_4px_10px_rgba(0,0,0,0.1)] ${isChatOpen ? 'h-[250px] lg:h-full' : 'h-[60px] self-stretch lg:self-start'}`}>
            <div
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="bg-gradient-to-b from-[#f9f2dd] to-[#f4e6cd] border-b-2 border-[#d3be9a] p-4 flex justify-between items-center cursor-pointer hover:bg-[#fff9ea] transition h-[60px] shrink-0"
            >
              <h2 className="font-black text-[#2c1d10] uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                Lobby Chat
              </h2>
              <span className="text-[#865913] font-bold text-lg">{isChatOpen ? '▼' : '▲'}</span>
            </div>

            {isChatOpen && (
              <div className="flex-grow p-4 overflow-y-auto space-y-3 flex flex-col min-h-0 bg-[#ebd5ad] shadow-inner custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[#9c8466] font-semibold text-sm text-center px-4 leading-relaxed">
                    The tavern is quiet. Gather your friends before the journey begins.
                  </div>
                ) : (
                  messages.map((m, i) => {
                    let dispName = m.senderId;
                    let dispColor = 'text-[#1e582d]';
                    let dispColorHex = '';
                    if (m.senderId === 'SYSTEM') {
                      dispName = 'The Master';
                      dispColor = 'text-[#8f7457]';
                    } else if (m.senderId === 'YOU') {
                      dispName = 'You';
                      const me = getMyPlayer();
                      if (me && me.color) dispColorHex = PLAYER_COLORS[me.color].hex;
                      else dispColor = 'text-[#2c773e]';
                    } else {
                      const pl = players.find(p => p.peerId === m.senderId);
                      if (pl) {
                        dispName = pl.username;
                        if (pl.color) dispColorHex = PLAYER_COLORS[pl.color].hex;
                      }
                      else dispName = m.senderId.substring(0, 6);
                    }

                    return (
                      <div key={i} className={`flex ${m.senderId === 'YOU' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-[0_2px_4px_rgba(0,0,0,0.1)] border ${m.senderId === 'YOU'
                          ? 'bg-[#ecdfc0] border-[#ceb38b] text-[#2c1d10] font-medium rounded-br-sm'
                          : m.senderId === 'SYSTEM'
                            ? 'bg-transparent border-transparent shadow-none text-[#7d6549] font-bold text-xs uppercase tracking-widest w-full text-center'
                            : 'bg-[#f8f1e3] border-[#e6d9b9] text-[#2c1d10] font-medium rounded-bl-sm'
                          }`}>
                          {m.senderId !== 'YOU' && m.senderId !== 'SYSTEM' && (
                            <div className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${dispColorHex ? '' : dispColor}`} style={dispColorHex ? { color: dispColorHex } : {}}>{dispName}</div>
                          )}
                          <div>{m.text}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {isChatOpen && (
              <form onSubmit={handleSendMessage} className="p-3 bg-[#f0e3cc] border-t-2 border-[#d3be9a] flex gap-2 shrink-0 overflow-hidden">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Drop a message..."
                  className="min-w-0 flex-grow bg-[#f4e6cd] border-2 border-[#d3be9a] rounded-lg px-3 py-2 text-sm text-[#3b2a1a] font-medium placeholder-[#af977a] outline-none focus:ring-2 focus:ring-[#865913] shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="flex-shrink-0 bg-gradient-to-b from-[#b16a41] to-[#804626] hover:from-[#c27548] hover:to-[#91502b] disabled:opacity-50 disabled:grayscale text-[#fdf7e1] p-3 rounded-lg shadow-[0_4px_6px_rgba(0,0,0,0.2),inset_0_2px_3px_rgba(255,255,255,0.3)] transition-transform active:translate-y-1 flex items-center justify-center border-b-4 border-[#522b16]"
                >
                  <Send className="w-4 h-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" strokeWidth={3} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <DonateButton />
    </div>
  );
};
