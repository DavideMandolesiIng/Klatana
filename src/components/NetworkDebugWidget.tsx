import React, { useState, useEffect } from 'react';
import { peerService } from '../network/PeerService';
import { debugLogger, type LogEntry } from '../network/DebugLogger';
import { Bug, X, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Set to true to enable the Network Debugger floating widget in the app.
 * Change to true when debugging networking/reconnection issues.
 */
const ENABLE_DEBUG_WIDGET = false;

export const NetworkDebugWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [roomInfo, setRoomInfo] = useState<any>(null);

  if (!ENABLE_DEBUG_WIDGET) {
    return null;
  }

  useEffect(() => {
    return debugLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
  }, []);

  const refreshRoomInfo = async () => {
    if (peerService.roomCode) {
      try {
        const { getRoomInfo } = await import('../network/firebase');
        const info = await getRoomInfo(peerService.roomCode);
        setRoomInfo(info);
      } catch (err) {
        setRoomInfo({ error: String(err) });
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshRoomInfo();
    }
  }, [isOpen, peerService.roomCode]);

  const handleManualReconnect = async () => {
    debugLogger.log('CLIENT', 'Manual reconnect triggered from debug widget');
    if (peerService.roomCode) {
      try {
        const { getRoomInfo } = await import('../network/firebase');
        const info = await getRoomInfo(peerService.roomCode);
        if (info && info.hostPeerId) {
          await peerService.reconnectClientToHost(info.hostPeerId);
        }
      } catch (err) {
        debugLogger.log('ERROR', 'Manual reconnect failed', err);
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[99999] bg-stone-950/90 hover:bg-black text-amber-400 p-2.5 rounded-full border-2 border-amber-500/50 shadow-2xl transition-transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
        title="Open Network Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[99999] w-[92%] sm:w-[450px] bg-stone-950/95 border-2 border-amber-500/60 rounded-xl shadow-2xl text-stone-200 font-mono text-xs overflow-hidden backdrop-blur-md flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="bg-stone-900 px-3 py-2 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-amber-400 uppercase tracking-wider">Network Debugger</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800"
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Status Bar */}
          <div className="p-3 bg-stone-900/60 border-b border-stone-800 space-y-1">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>Role: <span className="font-bold text-emerald-400 uppercase">{peerService.role}</span></div>
              <div>Room: <span className="font-bold text-amber-300">{peerService.roomCode || 'NONE'}</span></div>
              <div className="col-span-2 truncate">My Peer ID: <span className="text-cyan-400">{peerService.peerId || 'NONE'}</span></div>
              <div className="col-span-2">Peers Connected: <span className="text-emerald-400 font-bold">{peerService.getConnectedPeers().length}</span> ({peerService.getConnectedPeers().join(', ') || 'none'})</div>
              {roomInfo && (
                <div className="col-span-2 text-[10px] text-stone-400 border-t border-stone-800 pt-1 mt-1">
                  Firebase Host ID: <span className="text-amber-300">{roomInfo.hostPeerId}</span> | DB Status: <span className="text-emerald-400">{roomInfo.status}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleManualReconnect}
                className="flex-1 py-1.5 px-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/50 rounded flex items-center justify-center gap-1 font-bold transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Reconnect</span>
              </button>
              <button
                onClick={refreshRoomInfo}
                className="py-1.5 px-2 bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-600 rounded flex items-center justify-center gap-1 transition cursor-pointer"
              >
                Inspect DB
              </button>
              <button
                onClick={() => debugLogger.clear()}
                className="py-1.5 px-2 bg-stone-800 hover:bg-stone-700 text-red-400 border border-stone-600 rounded flex items-center justify-center transition cursor-pointer"
                title="Clear Logs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Logs List */}
          <div className="p-2 overflow-y-auto max-h-[260px] space-y-1.5 bg-black/50">
            {logs.length === 0 ? (
              <div className="text-stone-600 text-center py-4 italic">No logs recorded yet...</div>
            ) : (
              logs.map((log) => {
                let badgeColor = 'bg-stone-800 text-stone-300';
                if (log.category === 'PEER') badgeColor = 'bg-cyan-950 text-cyan-300 border border-cyan-800';
                if (log.category === 'FIREBASE') badgeColor = 'bg-amber-950 text-amber-300 border border-amber-800';
                if (log.category === 'CLIENT') badgeColor = 'bg-emerald-950 text-emerald-300 border border-emerald-800';
                if (log.category === 'HOST') badgeColor = 'bg-purple-950 text-purple-300 border border-purple-800';
                if (log.category === 'ERROR') badgeColor = 'bg-red-950 text-red-300 border border-red-800';

                return (
                  <div key={log.id} className="text-[11px] leading-tight border-b border-stone-900 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-stone-500">{log.timestamp}</span>
                      <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${badgeColor}`}>{log.category}</span>
                      <span className="text-stone-200 font-semibold">{log.message}</span>
                    </div>
                    {log.data !== undefined && (
                      <pre className="text-[10px] text-stone-400 ml-3 mt-0.5 overflow-x-auto whitespace-pre-wrap">
                        {typeof log.data === 'object' ? JSON.stringify(log.data) : String(log.data)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
