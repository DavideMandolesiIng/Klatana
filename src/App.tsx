import React, { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { type MapTemplate } from './game/mapTemplates';
import { peerService } from './network/PeerService';

function App() {
  const [gameState, setGameState] = useState<'menu' | 'lobby' | 'playing'>('menu');
  const [gameMap, setGameMap] = useState<MapTemplate | null>(null);

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
      {gameState === 'lobby' && <Lobby onStartGame={(map: MapTemplate) => { setGameMap(map); setGameState('playing'); }} />}
      {gameState === 'playing' && gameMap && <GameScreen map={gameMap} />}
    </div>
  );
}

export default App;
