import { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { type MapTemplate } from './game/mapTemplates';
import { type PlayerData } from './game/Player';
import { peerService } from './network/PeerService';
import { type GameSettings, type GameState } from './game/GameState';
import { Volume2, VolumeX } from 'lucide-react';
import { useSounds } from './context/SoundContext';

function App() {
  const { isMuted, toggleMute, playClick } = useSounds();
  const [gameState, setGameState] = useState<'menu' | 'lobby' | 'playing' | 'privacy'>('menu');
  const [gameMap, setGameMap] = useState<MapTemplate | null>(null);
  const [gamePlayers, setGamePlayers] = useState<PlayerData[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
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
  const [resumeGameState, setResumeGameState] = useState<GameState | null>(null);

  useEffect(() => {
    peerService.onConnectionRejected((reason) => {
      alert(`Connection rejected: ${reason}`);
      setGameState('menu');
      setGameMap(null);
    });
  }, []);

  return (
    <div className="App">
      <button 
        onClick={() => {
          toggleMute();
          if (isMuted) playClick(); // play click when unmuting
        }}
        className="fixed bottom-4 right-4 z-[9999] p-3 rounded-full bg-parchment-100 border-2 border-stone-700 shadow-md transition-transform hover:scale-110 active:scale-95 text-stone-700"
        title={isMuted ? "Unmute sounds" : "Mute sounds"}
      >
        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
      </button>

      {gameState === 'menu' && <MainMenu onJoinLobby={() => setGameState('lobby')} onPrivacyPolicy={() => setGameState('privacy')} />}
      {gameState === 'privacy' && <PrivacyPolicy onBack={() => setGameState('menu')} />}
      {gameState === 'lobby' && <Lobby 
          initialSettings={gameSettings} 
          onDisconnect={() => {
              peerService.destroy();
              setGameState('menu');
          }}
          onStartGame={(map: MapTemplate, players: PlayerData[], settings: GameSettings, resumingState?: GameState) => { 
              setGameMap(map); 
              setGamePlayers(players); 
              setGameSettings(settings); 
              setResumeGameState(resumingState || null);
              setGameState('playing'); 
          }} 
      />}
      {gameState === 'playing' && gameMap && <GameScreen map={gameMap} initialPlayers={gamePlayers} settings={gameSettings!} initialGameState={resumeGameState || undefined} onReturnToLobby={() => setGameState('lobby')} onDisconnect={() => { peerService.destroy(); setGameState('menu'); }} />}
    </div>
  );
}

export default App;
