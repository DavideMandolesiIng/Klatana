import React, { useState } from 'react';
import { peerService } from '../network/PeerService';
import { Users, Plus, LogIn } from 'lucide-react';

interface MainMenuProps {
  onJoinLobby: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onJoinLobby }) => {
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);
      setError('');
      await peerService.createRoom();
      onJoinLobby();
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || joinCode.length !== 4) {
      setError('Please enter a valid 4-letter code');
      return;
    }
    
    try {
      setIsJoining(true);
      setError('');
      await peerService.joinRoom(joinCode);
      onJoinLobby();
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
        <div className="p-8 text-center bg-slate-800/50 border-b border-slate-700">
          <div className="mx-auto bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Hexagonal Realms</h1>
          <p className="text-slate-400">Multiplayer Turn-Based Strategy</p>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleCreateRoom}
            disabled={isCreating || isJoining}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <span className="animate-pulse">Creating Room...</span>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>Create New Game</span>
              </>
            )}
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">OR</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label htmlFor="roomCode" className="block text-sm font-medium text-slate-400 mb-1">
                Room Code
              </label>
              <input
                id="roomCode"
                type="text"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter 4-letter code"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase tracking-widest text-center text-xl font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isCreating || isJoining || joinCode.length !== 4}
              className="w-full flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isJoining ? (
                <span className="animate-pulse">Joining...</span>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Join Game</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
