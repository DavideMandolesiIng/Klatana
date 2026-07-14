# Klatana - Free Multiplayer Board Game

This project is a completely free, open-source multiplayer board game using React 19, TypeScript, Vite 8, Firebase 12, and PeerJS. It aims to offer a low-maintenance, peer-to-peer architecture that allows players to enjoy the game without any hidden costs.

## Project Overview
A multiplayer browser-based game where players build settlements/streets on a hexagonal map, manage resources, and compete for victory points. Built with React 19, TypeScript, Vite 8, and Firebase 12 for real-time sync.

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite 8
- **State Management**: Centralized `GameState` interface in `src/game/`
- **Networking**: Firebase 12 (realtime sync) + PeerJS (P2P connections)
- **CSS**: TailwindCSS 4 with PostCSS
- **Type Checking**: TypeScript 6.0.2

### Architectural Conventions
1. **Module Separation**:
   - `src/game/`: Game logic (rules, state transitions)
   - `src/network/`: Firebase/PeerJS integration
   - `src/components/`: UI elements
2. **State Flow**: All state changes must go through `GameState.ts`
3. **Validation**: Centralized validation in `GameState.ts` (e.g., `validateSettlementPlacement`)

### Coding Conventions
- Use TypeScript: Yes (100%)
- Enums for game states (e.g., `TurnPhase`, `GamePhase`)
- Centralized validation rules in `GameState.ts`
- Redux-like state mutations (immutable patterns)

## AI Agent Workflow
1. Start at root with `CLAUDE.md` for overview
2. Identify module via `AGENTS.md` and folder structure
3. Check `src/README.md` or `public/README.md` for module specifics
4. Directly access files via path (no deep code scanning)
5. Update `AGENTS.md` if new patterns are discovered

## Module Identification Rules
- Game logic → `src/game/`
- Networking → `src/network/`
- UI → `src/components/`
- Assets → `public/`

## Modification Rules
1. Never modify `CLAUDE.md` or `README.md` unless fixing critical errors
2. Document changes in `AGENTS.md` if they affect patterns/conventions
3. Keep code changes minimal and focused
4. Use type hints extensively in new code
5. Update folder READMEs if module scope changes

## Project Goals
- **Completely Free**: The game will be free for both the publisher who hosts the web app and for the final user.
- **Disclaimer**: Klatana is a free, open-source fan project. It is not affiliated with, endorsed by, or sponsored by Catan Studio, Asmodee, or any related entities.
- **Peer-to-Peer Architecture**: Minimal handshaking phase on a free database to ensure zero costs for hosting.
- **Open Source**: All source code will be available under the [AGPLv3 License](LICENSE).

## Known Limitations
Due to the peer-to-peer architecture, there are known vulnerabilities and limitations that must be accepted as trade-offs to keep the product free for the final user:
- **Host Manipulation**: Because the game engine runs entirely on the Host’s browser, the Host holds the master Game State. A technically savvy Host could manipulate the code to get advantages.
- **Single Point of Failure**: If the Host disconnects, the game will be unavailable until a new Host is found.
- **Public IP Exposure**: To establish a direct connection without a central server, WebRTC requires peers to exchange their network data. This means that players' public IP addresses are exposed to the Host (and potentially to each other). While this is fine for a game among friends but not with strangers.
- **No Authoritative Server**: Because there is no authoritative backend server, it is practically impossible to implement a secure global leaderboard, matchmaking system, or ELO ranking.
- **Payload Injection**: Clients can inject payloads that could disrupt the game.

## React Compiler
The project uses Vite 8, which by default does not enable the React compiler. If you need to use the React compiler for better development experience, you can install `@vitejs/plugin-react` and configure it in your `vite.config.ts`.

1. Install the plugin:
   ```bash
   npm install @vitejs/plugin-react --save-dev
   ```

2. Configure Vite:
   ```typescript
   // vite.config.ts
   import react from '@vitejs/plugin-react';

   export default {
     plugins: [react()]
   };
   ```

## Expanding ESLint Configuration
To enable type-aware lint rules, you can use the following configuration in your `.eslintrc.js` file:

```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'prettier/react'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  rules: {
    // Custom rules can be added here
  }
};
```

This setup will help maintain type safety and adherence to best practices in your codebase.

## Installation
To get started with the project, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/DavideMandolesiIng/Klatana.git
   cd Klatana
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Contributing
Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create a new branch (``git checkout -b feature/your-feature``).

2. **Make your changes** and commit them (``git commit -m 'Add some feature'``).

3. **Push to the branch** (``git push origin feature/your-feature``).

4. **Open a pull request**.

## License
This project is licensed under the [AGPLv3 License](LICENSE)