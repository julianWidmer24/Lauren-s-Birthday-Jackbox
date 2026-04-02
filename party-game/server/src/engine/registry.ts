import { GameModule } from './types';

const gameModules: Map<string, GameModule> = new Map();

export function registerGame(module: GameModule): void {
  if (gameModules.has(module.id)) {
    throw new Error(`Game module "${module.id}" is already registered`);
  }
  gameModules.set(module.id, module);
  console.log(`Registered game module: ${module.name} (${module.id})`);
}

export function getGame(id: string): GameModule | undefined {
  return gameModules.get(id);
}

export function getAllGames(): GameModule[] {
  return Array.from(gameModules.values());
}

export function getGameList(): Array<{ id: string; name: string; description: string; minPlayers: number; maxPlayers: number }> {
  return getAllGames().map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
  }));
}
