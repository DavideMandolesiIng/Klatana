import React, { useState } from 'react';
import { MainMenu } from './components/MainMenu';
import { Lobby } from './components/Lobby';

function App() {
  const [inLobby, setInLobby] = useState(false);

  return (
    <div className="App">
      {!inLobby ? (
        <MainMenu onJoinLobby={() => setInLobby(true)} />
      ) : (
        <Lobby />
      )}
    </div>
  );
}

export default App;
