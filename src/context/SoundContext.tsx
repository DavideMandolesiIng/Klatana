import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Howl, Howler } from 'howler';

interface SoundContextType {
  isMuted: boolean;
  toggleMute: () => void;
  playClick: () => void;
  playConnect: () => void;
  playRoll: () => void;
  playBuild: () => void;
  playTrade: () => void;
  playTurn: () => void;
  playWin: () => void;
  playLose: () => void;
  playNinja: () => void;
  playStart: () => void;
  playCoins: () => void;
  playCard: () => void;
  playDiscard: () => void;
  playDisconnect: () => void;
  playCollect: () => void;
}

const SoundContext = createContext<SoundContextType | null>(null);

export const useSounds = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSounds must be used within a SoundProvider');
  }
  return context;
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('klatana_muted');
    return saved === 'true';
  });

  useEffect(() => {
    Howler.mute(isMuted);
    localStorage.setItem('klatana_muted', String(isMuted));
  }, [isMuted]);

  const toggleMute = () => setIsMuted((prev) => !prev);

  // Sound instances map to avoid recreating them
  const soundsRef = useRef<{ [key: string]: Howl }>({});

  const getSound = (src: string, volume: number = 1.0) => {
    if (!soundsRef.current[src]) {
      soundsRef.current[src] = new Howl({ src: [src], volume });
    }
    return soundsRef.current[src];
  };

  const playClick = () => getSound('/sounds/click.mp3', 0.5).play();
  const playConnect = () => getSound('/sounds/connect.mp3', 0.6).play();
  const playRoll = () => getSound('/sounds/roll.mp3', 0.8).play();
  const playBuild = () => getSound('/sounds/build.ogg', 0.7).play();
  const playTrade = () => getSound('/sounds/trade.mp3', 0.7).play();
  const playTurn = () => getSound('/sounds/turn.mp3', 0.5).play();
  const playWin = () => getSound('/sounds/win.mp3', 0.8).play();
  const playLose = () => getSound('/sounds/lose.mp3', 0.8).play();
  const playNinja = () => getSound('/sounds/ninja.mp3', 1.0).play();
  const playStart = () => getSound('/sounds/start.mp3', 0.7).play();
  const playCoins = () => getSound('/sounds/coins.mp3', 0.7).play();
  const playCard = () => getSound('/sounds/card.mp3', 0.7).play();
  const playDiscard = () => getSound('/sounds/discard.mp3', 0.6).play();
  const playDisconnect = () => getSound('/sounds/disconnect.mp3', 0.6).play();
  const playCollect = () => getSound('/sounds/collect.mp3', 0.6).play();

  const value = {
    isMuted,
    toggleMute,
    playClick,
    playConnect,
    playRoll,
    playBuild,
    playTrade,
    playTurn,
    playWin,
    playLose,
    playNinja,
    playStart,
    playCoins,
    playCard,
    playDiscard,
    playDisconnect,
    playCollect
  };

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
};
