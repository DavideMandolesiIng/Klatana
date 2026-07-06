import React, { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { type MapTemplate } from './game/mapTemplates';
import { type PlayerData } from './game/Player';
import { peerService } from './network/PeerService';

function App() {
  const [gameState, setGameState] = useState<'menu' | 'lobby' | 'playing'>('menu');
  const [gameMap, setGameMap] = useState<MapTemplate | null>(null);
  const [gamePlayers, setGamePlayers] = useState<PlayerData[]>([]);
  const [gameSettings, setGameSettings] = useState<{ hideBankResources: boolean }>({ hideBankResources: false });

  useEffect(() => {
    peerService.onConnectionRejected((reason) => {
      alert(`Connection rejected: ${reason}`);
      setGameState('menu');
      setGameMap(null);
    });
  }, []);

  return (
    <div className="App">
      {gameState === 'menu' && <MainMenu onJoinLobby={() => setGameState('lobby')} />}
      {gameState === 'lobby' && <Lobby onStartGame={(map: MapTemplate, players: PlayerData[], settings: { hideBankResources: boolean } = { hideBankResources: false }) => { setGameMap(map); setGamePlayers(players); setGameSettings(settings); setGameState('playing'); }} />}
      {gameState === 'playing' && gameMap && <GameScreen map={gameMap} initialPlayers={gamePlayers} settings={gameSettings || { hideBankResources: false }} />}
    </div>
  );
}

export default App;
