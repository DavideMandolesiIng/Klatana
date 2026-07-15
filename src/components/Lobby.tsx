import React, { useEffect, useState } from 'react';
import { peerService } from '../network/PeerService';
import { Send, Users, Wifi } from 'lucide-react';
import { generateStandardMap } from '../game/MapGenerator';
import { type MapTemplate } from '../game/mapTemplates';
import { type PlayerData, type PlayerColor, PLAYER_COLORS } from '../game/Player';
import { type GameSettings, type GameState, createInitialGameState } from '../game/GameState';

export const Lobby: React.FC<{ initialSettings?: GameSettings, onStartGame: (map: MapTemplate, players: PlayerData[], settings: GameSettings, resumingState?: GameState) => void }> = ({ initialSettings, onStartGame }) => {
  const [messages, setMessages] = useState<{ senderId: string; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);

  const [settings, setSettings] = useState<GameSettings>(initialSettings || {
    hideBankResources: false,
    winPoints: 10,
    turnTimer: null,
    discardLimit: 7,
    trueRoll: false,
    mapShape: 'standard',
    mapSize: 'medium',
    balancedResources: true,
    safeNinja: false
  });
  const settingsRef = React.useRef<GameSettings>(settings);
  const [players, setPlayers] = useState<PlayerData[]>([]);

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
      setPlayers(prev => {
        const next = prev.filter(p => p.peerId !== disconnectedPeerId);
        // Host broadcasts the new list if someone leaves
        if (peerService.role === 'host') {
          peerService.broadcast({ type: 'LOBBY_STATE', players: next });
        }
        return next;
      });
      setMessages((prev) => [...prev, { senderId: 'SYSTEM', text: `Peer disconnected: ${disconnectedPeerId.substring(0, 6)}...` }]);
    });

    peerService.onMessage((data: any, incomingPeerId: string) => {
      if (data.type === 'chat') {
        setMessages((prev) => [...prev, { senderId: incomingPeerId, text: data.message }]);
      }
      else if (data.type === 'startGame') {
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
          setPlayers(prev => {
            // Prevent duplicates (e.g. from React strict mode executing UI effects twice)
            if (prev.some(p => p.peerId === incomingPeerId)) return prev;

            // Assign them a generic grey/null color or the first available
            const usedColors = prev.map(p => p.color).filter(c => c !== null);
            const available = (Object.keys(PLAYER_COLORS) as PlayerColor[]).filter(c => !usedColors.includes(c));
            const assigned = available.length > 0 ? available[0] : null;

            const next = [...prev, { peerId: incomingPeerId, playerId: data.playerId, username: data.username, color: assigned, isHost: false }];
            setMessages(m => [...m, { senderId: 'SYSTEM', text: `${data.username} joined the lobby` }]);
            setTimeout(() => {
              peerService.broadcast({ type: 'LOBBY_STATE', players: next });
              peerService.broadcast({ type: 'LOBBY_SETTINGS', settings: settingsRef.current });
            }, 100);
            return next;
          });
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
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    settingsRef.current = newSettings;
    peerService.broadcast({ type: 'LOBBY_SETTINGS', settings: newSettings });
  };

  const handleStartGameClick = async () => {
    if (peerService.role === 'host') {
      const newMap = generateStandardMap(settingsRef.current.balancedResources);
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
    <div className="min-h-screen bg-slate-900 p-8 text-slate-100 flex gap-8 w-full max-w-[1600px] mx-auto">
      {/* Left Sidebar */}
      <div className="w-80 flex flex-col gap-6 flex-shrink-0">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <Wifi className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm text-slate-400 font-medium uppercase tracking-wider">Room Code</h2>
              <p className="text-3xl font-mono font-bold tracking-widest text-emerald-400">
                {peerService.roomCode}
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-400">
            Role: <span className="text-white capitalize">{peerService.role}</span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-700 pb-4">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-lg">Players ({players.length}/6)</h2>
          </div>
          <ul className="space-y-3 flex-grow">
            {players.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: p.color ? PLAYER_COLORS[p.color].hex : '#94a3b8' }}
                  ></div>
                  <span className="font-medium text-slate-200">
                    {p.username} {p.peerId === peerService.peerId ? <span className="text-slate-500 text-xs ml-1">(You)</span> : ''}
                  </span>
                </div>
                {p.isHost && <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Host</span>}
              </li>
            ))}
          </ul>

          {/* Color Selector */}
          <div className="mt-4 border-t border-slate-700 pt-4">
            <h3 className="text-xs text-slate-400 uppercase font-semibold mb-3">Choose your color</h3>
            <div className="flex gap-2 flex-wrap justify-start">
              {(Object.keys(PLAYER_COLORS) as PlayerColor[]).map((c) => {
                const isTaken = players.some(p => p.color === c && p.peerId !== peerService.peerId);
                const isMine = getMyPlayer()?.color === c;
                return (
                  <button
                    key={c}
                    onClick={() => handleColorSelect(c)}
                    disabled={isTaken}
                    className={`relative w-8 h-8 rounded-full shadow border-2 transition-all ${isTaken ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'} ${isMine ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-emerald-400 border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: PLAYER_COLORS[c].hex }}
                    title={isTaken ? `${PLAYER_COLORS[c].name} — taken` : `Select ${PLAYER_COLORS[c].name}`}
                    aria-label={isTaken ? `${PLAYER_COLORS[c].name} — taken` : `Select ${PLAYER_COLORS[c].name}`}
                  >
                    {isTaken && (
                      <svg
                        viewBox="0 0 16 16"
                        className="absolute inset-0 w-full h-full p-1.5 pointer-events-none"
                        aria-hidden="true"
                      >
                        <line x1="2" y1="2" x2="14" y2="14" stroke={getContrastColor(PLAYER_COLORS[c].hex)} strokeWidth="2.5" strokeLinecap="round" />
                        <line x1="14" y1="2" x2="2" y2="14" stroke={getContrastColor(PLAYER_COLORS[c].hex)} strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex flex-col items-center">
            {(() => {
              // Host is 1 player. We check if at least we have the right amount of registered players.
              const allPlayersReady = peerService.role === 'host' ? players.length > 0 : true;
              return (
                <button
                  onClick={handleStartGameClick}
                  disabled={peerService.role !== 'host' || !allPlayersReady}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors"
                >
                  <span>{peerService.role === 'host' ? 'Launch Game' : 'Waiting for Host...'}</span>
                  {peerService.role === 'host' && !allPlayersReady && (
                    <span className="text-[10px] font-normal uppercase tracking-wider text-emerald-200">Waiting for players to return...</span>
                  )}
                </button>
              );
            })()}
            <p className="mt-4 text-[10px] text-slate-500/80 text-center leading-tight px-2">
              Klatana is a free, open-source fan project. It is not affiliated with, endorsed by, or sponsored by Catan Studio, Asmodee, or any related entities.
            </p>
          </div>
        </div>
      </div>

      {/* Central Area: Game Settings */}
      <div className="flex-grow bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-xl flex flex-col">
        <h2 className="text-2xl font-bold mb-6 border-b border-slate-700 pb-4 text-emerald-400">Game Settings</h2>
        {peerService.role !== 'host' && (
          <div className="mb-4 text-xs text-amber-400 bg-amber-400/10 border border-amber-700/50 rounded-lg px-3 py-2 text-center">
            Only the host can change settings
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">

          {/* ── Map Generation ── */}
          <div className="col-span-2">
            <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Map Generation</h3>
          </div>
          <div className="flex items-start gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <input type="checkbox" id="balanced" checked={settings.balancedResources}
              onChange={(e) => peerService.role === 'host' && updateSettings({ balancedResources: e.target.checked })}
              disabled={peerService.role !== 'host'}
              className={`mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 accent-emerald-500 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
            <label htmlFor="balanced" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
              <span className="font-semibold block text-slate-100">Balanced Resources</span>
              <span className="text-xs text-slate-400">No red numbers (6, 8) on adjacent hexes.</span>
            </label>
          </div>
          <div className="flex items-start gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700 opacity-50">
            <div className="flex flex-col flex-1 gap-1">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Map Shape <span className="text-slate-600">(soon)</span></span>
              <select disabled className="bg-slate-800 border border-slate-700 text-slate-400 text-sm rounded-lg px-2 py-1.5 cursor-not-allowed">
                <option>Standard Hexagon</option>
              </select>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700 opacity-50">
            <div className="flex flex-col flex-1 gap-1">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Map Size <span className="text-slate-600">(soon)</span></span>
              <select disabled className="bg-slate-800 border border-slate-700 text-slate-400 text-sm rounded-lg px-2 py-1.5 cursor-not-allowed">
                <option>Medium (5 rings)</option>
              </select>
            </div>
          </div>

          {/* ── Victory ── */}
          <div className="col-span-2 mt-2">
            <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Victory &amp; Limits</h3>
          </div>
          <div className="flex flex-col gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <label htmlFor="winPoints" className="text-sm font-semibold text-slate-200">
                Victory Points
              </label>
              <span className="text-lg font-bold text-emerald-400 bg-slate-800 px-3 py-0.5 rounded-lg border border-slate-600 min-w-[3rem] text-center tabular-nums">
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
              className={`w-full h-2 rounded-full appearance-none bg-slate-700 accent-emerald-500 ${peerService.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>3</span><span>10</span><span>20</span>
            </div>
            <span className="text-xs text-slate-400">First player to reach this score wins.</span>
          </div>
          <div className="flex flex-col gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <label htmlFor="discardLimit" className="text-sm font-semibold text-slate-200">
                Safe Hand Limit <span className="text-slate-400 font-normal text-xs">(Ninja)</span>
              </label>
              <span className="text-lg font-bold text-amber-400 bg-slate-800 px-3 py-0.5 rounded-lg border border-slate-600 min-w-[3rem] text-center tabular-nums">
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
              className={`w-full h-2 rounded-full appearance-none bg-slate-700 accent-amber-500 ${peerService.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1</span><span>7</span><span>20</span>
            </div>
            <span className="text-xs text-slate-400">Cards over this limit must be discarded on a 7.</span>
          </div>


          {/* ── Dice & Turns ── */}
          <div className="col-span-2 mt-2">
            <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Dice &amp; Turns</h3>
          </div>
          <div className="flex items-start gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <input type="checkbox" id="trueRoll"
              checked={settings.trueRoll}
              onChange={(e) => updateSettings({ trueRoll: e.target.checked })}
              disabled={peerService.role !== 'host'}
              className={`mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 accent-emerald-500 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
            <label htmlFor="trueRoll" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
              <span className="font-semibold block text-slate-100">True Random Dice</span>
              <span className="text-xs text-slate-400">Default: "Dice Deck" system guarantees statistically fair distribution. Enable for pure RNG.</span>
            </label>
          </div>
          <div className="flex items-start gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <input type="checkbox" id="hideBankRes"
              checked={settings.hideBankResources}
              onChange={(e) => updateSettings({ hideBankResources: e.target.checked })}
              disabled={peerService.role !== 'host'}
              className={`mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 accent-emerald-500 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
            <label htmlFor="hideBankRes" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
              <span className="font-semibold block text-slate-100">Hide Bank Resources</span>
              <span className="text-xs text-slate-400">Hides remaining bank stock from all players.</span>
            </label>
          </div>
          <div className="flex items-start gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <input type="checkbox" id="safeNinja"
              checked={settings.safeNinja}
              onChange={(e) => updateSettings({ safeNinja: e.target.checked })}
              disabled={peerService.role !== 'host'}
              className={`mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 accent-emerald-500 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`} />
            <label htmlFor="safeNinja" className={`flex-1 ${peerService.role === 'host' ? 'cursor-pointer' : 'opacity-80'} select-none`}>
              <span className="font-semibold block text-slate-100">Safe Ninja</span>
              <span className="text-xs text-slate-400">Players with 2 or fewer VP cannot be targeted for resource theft (the Ninja can still be placed on any hex).</span>
            </label>
          </div>
          <div className="flex flex-col gap-2 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <label htmlFor="turnTimer" className="text-sm font-semibold text-slate-200">Turn Timer</label>
            <select id="turnTimer"
              value={settings.turnTimer ?? 'off'}
              onChange={(e) => updateSettings({ turnTimer: e.target.value === 'off' ? null : Number(e.target.value) })}
              disabled={peerService.role !== 'host'}
              className={`bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm ${peerService.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'focus:outline-none focus:ring-2 focus:ring-emerald-500'}`}>
              <option value="off">Disabled</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
              <option value="90">90 seconds</option>
              <option value="120">120 seconds</option>
              <option value="240">240 seconds</option>
              <option value="360">360 seconds</option>
            </select>
            <span className="text-xs text-slate-400">Auto-end turn when time runs out.</span>
          </div>
        </div>{/* end grid */}
      </div>{/* end settings card */}

      {/* Right Sidebar: Chat Area */}
      <div className={`w-80 bg-slate-800 rounded-xl border border-slate-700 shadow-xl flex flex-col overflow-hidden flex-shrink-0 transition-all duration-200 ${isChatOpen ? 'h-full' : 'h-[60px] self-start'}`}>
        <div
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-slate-800/80 backdrop-blur border-b border-slate-700 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-700 transition h-[60px] shrink-0"
        >
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Room Chat
          </h2>
          <span className="text-slate-400 font-bold">{isChatOpen ? '▼' : '▲'}</span>
        </div>

        {isChatOpen && (
          <div className="flex-grow p-4 overflow-y-auto space-y-4 flex flex-col min-h-0">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 italic text-sm text-center">
                No messages yet. Chat with the host and other players before the game begins.
              </div>
            ) : (
              messages.map((m, i) => {
                let dispName = m.senderId;
                let dispColor = 'text-indigo-400';
                let dispColorHex = '';
                if (m.senderId === 'SYSTEM') {
                  dispName = 'System';
                  dispColor = 'text-slate-500';
                } else if (m.senderId === 'YOU') {
                  dispName = 'You';
                  const me = getMyPlayer();
                  if (me && me.color) dispColorHex = PLAYER_COLORS[me.color].hex;
                  else dispColor = 'text-emerald-400';
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
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.senderId === 'YOU'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : m.senderId === 'SYSTEM'
                        ? 'bg-slate-700/50 text-slate-400 italic text-xs w-full text-center'
                        : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                      }`}>
                      {m.senderId !== 'YOU' && m.senderId !== 'SYSTEM' && (
                        <div className={`text-xs font-medium mb-1 ${dispColorHex ? '' : dispColor}`} style={dispColorHex ? { color: dispColorHex } : {}}>{dispName}</div>
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
          <form onSubmit={handleSendMessage} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2 shrink-0">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a message..."
              className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
