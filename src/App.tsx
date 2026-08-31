import { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Changelog } from './components/Changelog';
import { type MapTemplate } from './game/mapTemplates';
import { type PlayerData } from './game/Player';
import { peerService } from './network/PeerService';
import { type GameSettings, type GameState } from './game/GameState';
import { Volume2, VolumeX } from 'lucide-react';
import { useSounds } from './context/SoundContext';

function App() {
  const { isMuted, playClick, volume, setVolume } = useSounds();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [gameState, setGameState] = useState<'menu' | 'lobby' | 'playing' | 'privacy' | 'changelog'>('menu');
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
      <div className={`fixed right-4 z-[9999] flex items-center gap-2 ${gameState === 'playing' ? 'bottom-[4.5rem] md:bottom-4' : 'bottom-4'}`}>
        {showVolumeSlider && (
          <div className="bg-[#f4e6cd] border-2 border-stone-700 px-4 py-2 rounded-full shadow-md flex items-center gap-3 w-40 opacity-90 backdrop-blur">
            <span className="text-[10px] font-bold text-stone-700 uppercase tracking-wider">Vol</span>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              onMouseUp={() => { if (volume > 0) playClick(); }}
              onTouchEnd={() => { if (volume > 0) playClick(); }}
              className="w-full accent-stone-700"
            />
          </div>
        )}

        <button 
          onClick={() => {
            playClick();
            setShowVolumeSlider(!showVolumeSlider);
          }}
          className={`p-3 rounded-full border-2 border-stone-700 shadow-md transition-transform hover:scale-110 active:scale-95 flex items-center justify-center ${showVolumeSlider ? 'bg-stone-700 text-[#f4e6cd]' : 'bg-[#f4e6cd] text-stone-700'}`}
          title="Adjust Volume"
        >
          {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {gameState === 'menu' && (
        <MainMenu 
          onJoinLobby={() => setGameState('lobby')} 
          onPrivacyPolicy={() => setGameState('privacy')} 
          onChangelog={() => setGameState('changelog')}
        />
      )}
      {gameState === 'privacy' && <PrivacyPolicy onBack={() => setGameState('menu')} />}
      {gameState === 'changelog' && <Changelog onBack={() => setGameState('menu')} />}
      {gameState === 'lobby' && <Lobby 
          initialSettings={gameSettings} 
          onDisconnect={() => {
              peerService.destroy(true);
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
      {gameState === 'playing' && gameMap && <GameScreen map={gameMap} initialPlayers={gamePlayers} settings={gameSettings!} initialGameState={resumeGameState || undefined} onReturnToLobby={() => setGameState('lobby')} onDisconnect={() => { peerService.destroy(true); setGameState('menu'); }} />}
    </div>
  );
}

export default App;
