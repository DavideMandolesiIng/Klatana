# AGENTS.md

## Project Overview
A multiplayer browser-based game where players build settlements/roads on a hexagonal map, manage resources, and compete for victory points. Built with React 19, TypeScript, Vite 8, and Firebase 12 for real-time sync.

## Technology Stack
- **Frontend**: React 19, TypeScript, Vite 8
- **State Management**: Centralized `GameState` interface in `src/game/`
- **Networking**: Firebase 12 (realtime sync) + PeerJS (P2P connections)
- **CSS**: TailwindCSS 4 with PostCSS
- **Type Checking**: TypeScript 6.0.2

## Architectural Conventions
1. **Module Separation**:
   - `src/game/`: Game logic (rules, state transitions)
   - `src/network/`: Firebase/PeerJS integration
   - `src/components/`: UI elements
2. **State Flow**: All state changes must go through `GameState.ts`
3. **Validation**: Centralized validation in `GameState.ts` (e.g., `validateSettlementPlacement`)

## Coding Conventions
- UseTypeScript: Yes (100%)
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