# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands for Development

| Command | Description | Usage Example |
|---------|-------------|---------------|
| `npm run dev` | Start development server with HMR | Live-reload while coding components |
| `npm run build` | Build production-ready files | `tsc -b && vite build` (combines TypeScript build & Vite optimization) |
| `npm run lint` | Check code style and type safety | `eslint .` |
| `npm run preview` | Preview the built app locally | `vite preview` |

## Core Architecture

```
src/
├─ game/
│  ├─ GameState.ts     // Central game logic hub
│  ├─ Player.ts        // Player state management
│  ├─ MapGenerator.ts  // Map creation system
│  ├─ HexMath.ts       // Hex grid coordinate math
│  └─ mapTemplates.ts  // Map shape/resource templates
├─ network/
│  ├─ firebase.ts      // Firebase real-time sync
│  └─ PeerService.ts   // Peer-to-peer (PeerJS) connectivity
└─ components/          // React UI (GameScreen, Lobby, MainMenu, ...)
```

**Tech stack**: React 19 + TypeScript + Vite 8, TailwindCSS 4 (PostCSS), Firebase 12 for persistence/sync, PeerJS for P2P, react-router-dom 7, lucide-react icons.

### Game model
- `GameState.ts` is the single source of truth — a flat `GameState` interface (players, houses, streets, action-card deck, phase flags, logs, settings).
- Phases are two-level: `GamePhase` (SETUP_1 → SETUP_2 → MAIN_GAME → ... → GAME_OVER) and the per-turn `TurnPhase` (ROLL → TRADE → BUILD).
- House/street placement legality is centralized in `validateHousePlacement` / `validateStreetPlacement`; the UI calls `getValidHousePlacements` / `getValidStreetPlacements` to highlight only legal spots.
- Hex adjacency math (nodes, edges, neighbors) lives in `HexMath.ts` and is reused across validation, resource distribution, longest-street DFS, and port trade rates.
- Resource economy uses `ResourceCounts` (OAK/CLAY/CEREALS/WOOL/ORE/NUGGETS, excluding DESERT) and `BUILD_COSTS`; `canAfford` is the shared check.
- Longest street is computed via edge-graph DFS that breaks at enemy-occupied nodes (`getLongestStreetForPlayer`). Scores/win are computed in `calculateScores`.

### Networking model
- Firebase (`network/firebase.ts`) handles lobby presence and authoritative game-state sync.
- `PeerService.ts` wraps PeerJS for direct P2P connections between players (used for lower-latency game actions).
- Lobby players are represented by `PlayerData` (`Player.ts`); they become `PlayerState` entries inside `GameState` when a game starts (`createInitialGameState`).

## Development Conventions

- **State changes**: mutate `GameState` immutably (spread + `JSON.parse(JSON.stringify(...))` clone for nested `players`). Avoid scattering game rules into components — keep them in `src/game/`.
- **File naming**: domain logic in `src/game/<Domain>.ts`; network in `src/network/<Function>.ts`.
- **Types**: prefer enums/union types for game states (`TurnPhase`, `ActionCardType`, `GamePhase`); nest interfaces (`GameState`, `PlayerState`).
- **Validation**: UI must rely on the `getValid*Placements` helpers in `GameState.ts` rather than re-implementing adjacency rules.

## Testing Notes

- No test runner is configured yet. When adding tests, cover: house/street adjacency rules, `canAfford`/resource math, dice distribution, and Firebase/PeerService listeners.
- `npm run build` (runs `tsc -b`) is the fastest way to catch type errors across the game logic.
