import React, { useEffect, useState } from 'react';
import { peerService } from '../network/PeerService';
import { Send, Users, Wifi } from 'lucide-react';
import { generateStandardMap } from '../game/MapGenerator';
import { type MapTemplate } from '../game/mapTemplates';

export const Lobby: React.FC<{ onStartGame: (map: MapTemplate) => void }> = ({ onStartGame }) => {
  const [peers, setPeers] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [balancedResources, setBalancedResources] = useState(false);

  useEffect(() => {
    // Initial peers if any
    setPeers(peerService.getConnectedPeers());

    // Setup network listeners
    peerService.onConnection((conn) => {
      setPeers(peerService.getConnectedPeers());
      setMessages((prev) => [...prev, { sender: 'System', text: `Peer connected: ${conn.peer.substring(0, 6)}...` }]);
    });

    peerService.onPeerDisconnect((peerId) => {
      setPeers(peerService.getConnectedPeers());
      setMessages((prev) => [...prev, { sender: 'System', text: `Peer disconnected: ${peerId.substring(0, 6)}...` }]);
    });

    peerService.onMessage((data: any, peerId: string) => {
      if (data.type === 'chat') {
        setMessages((prev) => [...prev, { sender: peerId.substring(0, 6), text: data.message }]);
      } else if (data.type === 'startGame') {
        onStartGame(data.map);
      }
    });

  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const msgData = { type: 'chat', message: inputValue };
    
    // Broadcast if host, send to host if client
    if (peerService.role === 'host') {
      peerService.broadcast(msgData);
    } else {
      const connectedPeers = peerService.getConnectedPeers();
      if (connectedPeers.length > 0) {
        peerService.sendTo(connectedPeers[0], msgData); // Send to Host
      }
    }

    setMessages((prev) => [...prev, { sender: 'You', text: inputValue }]);
    setInputValue('');
  };

  const handleStartGameClick = () => {
    if (peerService.role === 'host') {
      const newMap = generateStandardMap(balancedResources);
      peerService.broadcast({ type: 'startGame', map: newMap });
      onStartGame(newMap);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-slate-100 flex gap-8 max-w-6xl mx-auto">
      {/* Sidebar */}
      <div className="w-80 flex flex-col gap-6">
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

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex-grow">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-700 pb-4">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-lg">Players Lobby</h2>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="font-medium text-slate-200">You ({peerService.role})</span>
            </li>
            {peers.map((p, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <span className="text-slate-300">Player {p.substring(0, 6)}</span>
              </li>
            ))}
          </ul>
          
          <div className="mt-6 pt-4 border-t border-slate-700">
            {peerService.role === 'host' && (
              <div className="mb-4 flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <input 
                  type="checkbox" 
                  id="balanced" 
                  checked={balancedResources}
                  onChange={(e) => setBalancedResources(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-slate-600 bg-slate-700 focus:ring-emerald-500"
                />
                <label htmlFor="balanced" className="text-sm text-slate-300 select-none cursor-pointer">
                  <span className="font-semibold block text-slate-200">Balanced Resources</span>
                  <span className="text-xs text-slate-500">Prevent red numbers on same terrain types</span>
                </label>
              </div>
            )}
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

      {/* Chat Area */}
      <div className="flex-grow bg-slate-800 rounded-xl border border-slate-700 shadow-xl flex flex-col overflow-hidden">
        <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700 p-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Network Test Chat
          </h2>
        </div>
        
        <div className="flex-grow p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              No messages yet. Send one to test the WebRTC connection.
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.sender === 'You' 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : msg.sender === 'System'
                    ? 'bg-slate-700/50 text-slate-400 italic text-sm w-full text-center'
                    : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                }`}>
                  {msg.sender !== 'You' && msg.sender !== 'System' && (
                    <div className="text-xs text-indigo-300 font-medium mb-1">{msg.sender}</div>
                  )}
                  <div>{msg.text}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a test message..."
            className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>Send</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
