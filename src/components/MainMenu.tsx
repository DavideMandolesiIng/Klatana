import React, { useState } from 'react';
import { peerService } from '../network/PeerService';
import { Plus } from 'lucide-react';
import { useSounds } from '../context/SoundContext';

import wavesBg from '/assets/textures/waves-background.webp?url';
import angle1 from '/assets/UI/Angle1.webp?url';
import angle2 from '/assets/UI/Angle2.webp?url';


interface MainMenuProps {
  onJoinLobby: () => void;
  onPrivacyPolicy: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onJoinLobby, onPrivacyPolicy }) => {
  const { playClick } = useSounds();
  const [joinCode, setJoinCode] = useState('');
  const [username, setUsername] = useState(localStorage.getItem('klatana_username') || '');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [uiScale, setUiScale] = useState(1);

  React.useEffect(() => {
    const handleResize = () => {
      const height = window.innerHeight;
      const baseUiHeight = 850; // Approximated height of the UI + overflowing logo/angles 

      // If screen is shorter than the UI, scale down dynamically
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

  const getPlayerId = () => {
    let id = localStorage.getItem('klatana_player_id');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      localStorage.setItem('klatana_player_id', id);
    }
    return id;
  };

  const handleCreateRoom = async () => {
    playClick();
    if (!username.trim()) { setError('Please enter a username'); return; }
    localStorage.setItem('klatana_username', username.trim());
    try {
      setIsCreating(true);
      setError('');

      // Need lazy initialization of peer service or something similar, but let's just use it
      peerService.playerId = getPlayerId();
      peerService.username = username.trim();
      await peerService.createRoom();
      onJoinLobby();
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    if (!username.trim()) { setError('Please enter a username'); return; }
    if (!joinCode || joinCode.length !== 4) {
      setError('Please enter a valid 4-letter code');
      return;
    }

    localStorage.setItem('klatana_username', username.trim());

    try {
      setIsJoining(true);
      setError('');

      const { getRoomInfo } = await import('../network/firebase');
      const roomInfo = await getRoomInfo(joinCode.toUpperCase());
      if (!roomInfo) {
        throw new Error('Room not found');
      }

      const savedPeerId = localStorage.getItem('klatana_peer_id');
      const savedRoomCode = localStorage.getItem('klatana_room_code');
      const isReconnecting = savedRoomCode === joinCode.toUpperCase() && !!savedPeerId;

      if (roomInfo.status === 'IN_PROGRESS' && !isReconnecting) {
        throw new Error('Error: Game already in progress');
      }

      peerService.playerId = getPlayerId();
      peerService.username = username.trim();
      await peerService.joinRoom(joinCode, isReconnecting ? savedPeerId! : undefined);
      onJoinLobby();
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full relative overflow-hidden bg-cyan-700"
      style={{
        backgroundImage: `url(${wavesBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}>

      <div
        className="absolute left-1/2 top-1/2 w-full max-w-[95%] sm:max-w-md bg-gradient-to-br from-[#f4e6cd] to-[#e4cdad] rounded-[16px] shadow-[0_15px_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#a37941] overflow-visible text-[#5c4936] z-10 transition-transform duration-100 ease-out"
        style={{ transform: `translate(-50%, -50%) scale(${uiScale})`, transformOrigin: 'center' }}
      >

        {/* Corners UI Images */}
        <img src={angle1} alt="" className="absolute -top-[10px] sm:-top-[14px] -left-[10px] sm:-left-[14px] w-10 h-10 sm:w-14 sm:h-14 z-20 pointer-events-none drop-shadow-md rotate-180 transition-all" />
        <img src={angle2} alt="" className="absolute -top-[10px] sm:-top-[14px] -right-[10px] sm:-right-[14px] w-10 h-10 sm:w-14 sm:h-14 z-20 pointer-events-none drop-shadow-md rotate-270 transition-all" />
        <img src={angle2} alt="" className="absolute -bottom-[10px] sm:-bottom-[14px] -left-[10px] sm:-left-[14px] w-10 h-10 sm:w-14 sm:h-14 z-20 pointer-events-none drop-shadow-md rotate-90 transition-all" />
        <img src={angle1} alt="" className="absolute -bottom-[10px] sm:-bottom-[14px] -right-[10px] sm:-right-[14px] w-10 h-10 sm:w-14 sm:h-14 z-20 pointer-events-none drop-shadow-md transition-all" />

        {/* Top Logo */}
        <div className="absolute -top-10 sm:-top-12 left-1/2 -translate-x-1/2 flex items-center justify-center z-30 pointer-events-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] transition-all">
          <img src="/favicon.svg" alt="Klatana Favicon" className="w-20 h-20 sm:w-24 sm:h-24 object-contain transition-all" />
        </div>

        <div className="pt-12 sm:pt-16 pb-3 sm:pb-4 text-center border-b-[2px] border-[#ceb38b] bg-gradient-to-b from-[#ffffff] to-transparent rounded-t-[12px] shadow-[inset_0_4px_8px_rgba(255,255,255,1)]">
          <h1 className="text-3xl sm:text-[2.5rem] font-black mb-1 text-[#2c1d10] tracking-wide transition-all" style={{ textShadow: '0 2px 1px rgba(255,255,255,0.8)' }}>Klatana</h1>
          <p className="text-[#644d36] text-[12px] sm:text-sm font-bold px-4 sm:px-6 drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]">Play your favourite board game with your Friends</p>
        </div>

        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6 relative z-10 w-full transition-all">
          {error && (
            <div className="bg-red-200 border-l-4 border-red-600 text-red-900 p-3 rounded shadow-sm text-sm text-center font-bold mb-2">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-[13px] font-bold text-[#5e4933] mb-1.5 text-center uppercase tracking-wider drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
              Your Username
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                maxLength={15}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your Username"
                className="w-full bg-gradient-to-b from-[#dbcdb2] to-[#e8ddc9] border-2 border-[#b59b74] rounded-md py-3 px-4 focus:outline-none focus:border-[#866841] focus:ring-2 focus:ring-[#cdb28e] text-center font-bold text-lg text-[#3b2a1a] placeholder-[#aa8d65] shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={isCreating || isJoining}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-b from-[#3ca956] via-[#2f8a43] to-[#1c552a] hover:from-[#4ac565] hover:to-[#226834] border-t border-[#64dc7f] border-b-[5px] border-[#113118] text-[#f7efd8] font-bold py-4 px-4 rounded-xl shadow-[0_6px_10px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.3)] transition-transform active:translate-y-[4px] active:border-b-[1px] active:mb-[4px] disabled:opacity-75 disabled:filter disabled:grayscale-[0.3] disabled:active:translate-y-0"
          >
            {isCreating ? (
              <span className="animate-pulse drop-shadow-md text-lg">Creating Room...</span>
            ) : (
              <>
                <Plus className="w-5 h-5 drop-shadow-md text-[#c4eec4]" strokeWidth={3} />
                <span className="text-lg tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]">Create New Game</span>
              </>
            )}
          </button>

          <div className="relative flex items-center justify-center drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] my-1 z-20">
            <div className="flex-grow border-t-2 border-[#cbb38d] max-w-full mb-2"></div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4 pb-2 z-10 relative">
            <div>
              <label htmlFor="roomCode" className="block text-[13px] font-bold text-[#5e4933] mb-1.5 text-center uppercase tracking-wider drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                Room Code - Join your friends
              </label>
              <input
                id="roomCode"
                type="text"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER 4-LETTER CODE"
                className="w-full bg-gradient-to-b from-[#dbcdb2] to-[#e8ddc9] border-2 border-[#b59b74] rounded-md py-3 px-4 focus:outline-none focus:border-[#866841] focus:ring-2 focus:ring-[#cdb28e] text-center font-bold text-xl text-[#3b2a1a] placeholder-[#aa8d65] uppercase tracking-[0.3em] shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating || isJoining || joinCode.length !== 4}
              className="w-full flex font-bold rounded-xl shadow-[0_6px_10px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.3)] border-t border-[#f77e5e] border-b-[5px] border-[#5e1e0c] transition-transform active:translate-y-[4px] active:border-b-[1px] active:mb-[4px] disabled:opacity-75 disabled:filter disabled:grayscale-[0.3] disabled:active:translate-y-0 overflow-hidden group"
            >
              <div className="flex-grow flex items-center justify-center bg-gradient-to-b from-[#d15431] via-[#aa3c1e] to-[#802a11] group-hover:from-[#e3613d] group-hover:to-[#913214] text-[#f7efd8] py-4 pl-8">
                {isJoining ? (
                  <span className="animate-pulse drop-shadow-md text-lg">Joining...</span>
                ) : (
                  <>
                    <span className="text-lg tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] mr-3">Join Game</span>
                  </>
                )}
              </div>
            </button>
          </form>
        </div>

        <div className="p-4 bg-gradient-to-b from-[#ede0c6] to-[#dfcda2] border-t-2 border-[#d3be9a] rounded-b-[12px] text-center flex flex-col items-center gap-1 shadow-[inset_0_5px_10px_rgba(0,0,0,0.03)] pb-5 z-10 relative">
          <p className="text-[10px] text-[#63503b] leading-relaxed max-w-[90%] font-semibold drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]">
            Klatana is a free, open-source fan project. It is not affiliated with, endorsed by, or sponsored by Catan Studio, Asmodee, or any related entities.
          </p>
          <button
            onClick={onPrivacyPolicy}
            className="text-[11px] text-[#2c1d10] hover:text-black font-bold transition-colors mt-1 underline underline-offset-2"
          >
            Privacy Policy
          </button>
        </div>
      </div>
    </div>
  );
};
