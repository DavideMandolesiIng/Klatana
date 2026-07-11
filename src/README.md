# src/README.md

## Scope
Core game logic and client-side implementation (React + TypeScript).

## Main Components
1. Game engine (`GameState.ts`)
2. Player state management (`Player.ts`)
3. Firebase/PeerJS integration (`Firebase.ts`, `PeerService.ts`)
4. Hex grid math (`HexMath.ts`)

## Key Files
- `GameState.ts`: Central state object + validation rules
- `Player.ts`: Player data model
- `Firebase.ts`: Backend integration
- `HexMath.ts`: Hex adjacency/math rules

## Dependencies
- `network/` for real-time sync
- `components/` for UI rendering

## Exclusions
- No static assets (go to `public/`)
- No test code (see `tests/` if exists)

## Conventions
- All game state in `GameState` interface
- Validation in `GameState.ts` methods
- Hex math in `HexMath.ts`
- Immutable state updates preferred