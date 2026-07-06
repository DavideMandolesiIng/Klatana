import React, { useEffect, useState } from 'react';
import { peerService } from '../network/PeerService';
import { Send, Users, Wifi } from 'lucide-react';
import { generateStandardMap } from '../game/MapGenerator';
import { type MapTemplate } from '../game/mapTemplates';
import { type PlayerData, type PlayerColor, PLAYER_COLORS } from '../game/Player';

export const Lobby: React.FC<{ onStartGame: (map: MapTemplate, players: PlayerData[], settings: { hideBankResources: boolean }) => void }> = ({ onStartGame }) => {
  const [messages, setMessages] = useState<{ senderId: string; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [balancedResources, setBalancedResources] = useState(false);
  const balancedResourcesRef = React.useRef(false);
  const [hideBankResources, setHideBankResources] = useState(false);
  const hideBankResourcesRef = React.useRef(false);
  const [players, setPlayers] = useState<PlayerData[]>([]);

  // Automatically executed when component mounts
  useEffect(() => {
    const myUsername = localStorage.getItem('klatana_username') || 'Unknown';
    
    if (peerService.role === 'host') {
      // Host immediately registers themselves as Red
      setPlayers([{
        peerId: peerService.peerId,
        username: myUsername,
        color: 'RED',
        isHost: true
      }]);
    } else {
      // Client sends JOIN intent to Host as soon as they render the lobby
      const connectedPeers = peerService.getConnectedPeers();
      if (connectedPeers.length > 0) {
        peerService.sendTo(connectedPeers[0], { type: 'JOIN_LOBBY', username: myUsername });
      }
    }

    // Setup network listeners
    peerService.onConnection((conn) => {
      // We don't automatically add them to UI array here, we wait for their JOIN_LOBBY msg
      setMessages((prev) => [...prev, { senderId: 'SYSTEM', text: `Connection established with ${conn.peer.substring(0, 6)}...` }]);
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
        onStartGame(data.map, data.players, data.settings || { hideBankResources: false });
      }
      else if (data.type === 'LOBBY_STATE') {
        // Client receives master lobby state from Host
        setPlayers(data.players);
      }
      else if (data.type === 'LOBBY_SETTINGS') {
        setBalancedResources(data.balancedResources);
        balancedResourcesRef.current = data.balancedResources;
        setHideBankResources(data.hideBankResources || false);
        hideBankResourcesRef.current = data.hideBankResources || false;
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

             const next = [...prev, { peerId: incomingPeerId, username: data.username, color: assigned, isHost: false }];
             setTimeout(() => {
               peerService.broadcast({ type: 'LOBBY_STATE', players: next });
               peerService.broadcast({ type: 'LOBBY_SETTINGS', balancedResources: balancedResourcesRef.current, hideBankResources: hideBankResourcesRef.current });
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

  const handleBalancedResourcesChange = (checked: boolean) => {
    setBalancedResources(checked);
    balancedResourcesRef.current = checked;
    if (peerService.role === 'host') {
      peerService.broadcast({ type: 'LOBBY_SETTINGS', balancedResources: checked, hideBankResources: hideBankResourcesRef.current });
    }
  };

  const handleHideBankResourcesChange = (checked: boolean) => {
    setHideBankResources(checked);
    hideBankResourcesRef.current = checked;
    if (peerService.role === 'host') {
      peerService.broadcast({ type: 'LOBBY_SETTINGS', balancedResources: balancedResourcesRef.current, hideBankResources: checked });
    }
  };

  const handleStartGameClick = async () => {
    if (peerService.role === 'host') {
      const newMap = generateStandardMap(balancedResources);
      await peerService.setGameStarted();
      peerService.broadcast({ type: 'startGame', map: newMap, players, settings: { hideBankResources: hideBankResourcesRef.current } });
      onStartGame(newMap, players, { hideBankResources: hideBankResourcesRef.current });
    }
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
                      className={`w-8 h-8 rounded-full shadow border-2 transition-all ${isTaken ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'} ${isMine ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-emerald-400 border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: PLAYER_COLORS[c].hex }}
                      title={isTaken ? 'Color taken' : `Select ${PLAYER_COLORS[c].name}`}
                    />
                  )
                })}
             </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700">
            <button 
              onClick={handleStartGameClick}
              disabled={peerService.role !== 'host'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {peerService.role === 'host' ? 'Launch Game' : 'Waiting for Host...'}
            </button>
          </div>
        </div>
      </div>

      {/* Central Area: Game Settings */}
      <div className="flex-grow bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-xl flex flex-col">
        <h2 className="text-2xl font-bold mb-8 border-b border-slate-700 pb-4 text-emerald-400">Game Settings</h2>
        
        <div className="space-y-6">
          {/* Balanced Resources Toggle */}
          <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors w-fit">
            <input 
              type="checkbox" 
              id="balanced" 
              checked={balancedResources}
              onChange={(e) => peerService.role === 'host' && handleBalancedResourcesChange(e.target.checked)}
              disabled={peerService.role !== 'host'}
              className={`w-6 h-6 text-emerald-500 rounded border-slate-600 bg-slate-700 ${peerService.role === 'host' ? 'cursor-pointer focus:ring-emerald-500' : 'opacity-50 cursor-not-allowed'}`}
            />
            <label htmlFor="balanced" className={peerService.role === 'host' ? 'select-none cursor-pointer' : 'select-none opacity-80'}>
              <span className="font-bold block text-slate-200 text-lg">Balanced Resources</span>
              <span className="text-sm text-slate-400">Prevent red numbers (6, 8) from being placed on adjacent hexes or same terrain types.</span>
            </label>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors w-fit">
            <input 
              type="checkbox" 
              id="hideBankRes" 
              checked={hideBankResources}
              onChange={(e) => peerService.role === 'host' && handleHideBankResourcesChange(e.target.checked)}
              disabled={peerService.role !== 'host'}
              className={`w-6 h-6 text-emerald-500 rounded border-slate-600 bg-slate-700 ${peerService.role === 'host' ? 'cursor-pointer focus:ring-emerald-500' : 'opacity-50 cursor-not-allowed'}`}
            />
            <label htmlFor="hideBankRes" className={peerService.role === 'host' ? 'select-none cursor-pointer' : 'select-none opacity-80'}>
              <span className="font-bold block text-slate-200 text-lg">Hide Bank Resources</span>
              <span className="text-sm text-slate-400">Hide the panel showing remaining resources in the bank.</span>
            </label>
          </div>
          
          {/* Future settings can go here */}
          <div className="p-8 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-500 mt-8">
            {peerService.role === 'host' ? 'More settings coming soon...' : 'Waiting for host to launch the game...'}
          </div>
        </div>
      </div>

      {/* Right Sidebar: Chat Area */}
      <div className="w-80 bg-slate-800 rounded-xl border border-slate-700 shadow-xl flex flex-col overflow-hidden flex-shrink-0">
        <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700 p-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Network Test Chat
          </h2>
        </div>
        
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic text-sm text-center">
              No messages yet. Send one to test the WebRTC connection.
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
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.senderId === 'YOU' 
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

        <form onSubmit={handleSendMessage} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2">
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
      </div>
    </div>
  );
};
