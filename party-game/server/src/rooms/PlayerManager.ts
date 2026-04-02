import { v4 as uuidv4 } from 'uuid';
import { Player, Room } from './types';
import { store } from '../store/MemoryStore';

export function addPlayer(room: Room, name: string, socketId: string): Player {
  if (room.players.size >= room.settings.maxPlayers) {
    throw new Error('Room is full');
  }

  // Check for duplicate names
  const existingNames = Array.from(room.players.values()).map((p) => p.name.toLowerCase());
  if (existingNames.includes(name.toLowerCase())) {
    throw new Error('Name already taken');
  }

  const player: Player = {
    id: uuidv4(),
    name,
    socketId,
    score: 0,
    isConnected: true,
    joinedAt: Date.now(),
  };

  room.players.set(player.id, player);
  store.setSocketRoom(socketId, room.id);
  store.setPlayerRoom(player.id, room.id);
  room.lastActivity = Date.now();

  return player;
}

export function removePlayer(room: Room, playerId: string): void {
  const player = room.players.get(playerId);
  if (player) {
    store.removeSocket(player.socketId);
    store.removePlayer(playerId);
    room.players.delete(playerId);
    room.lastActivity = Date.now();
  }
}

export function disconnectPlayer(room: Room, socketId: string): Player | undefined {
  for (const [, player] of room.players) {
    if (player.socketId === socketId) {
      player.isConnected = false;
      room.lastActivity = Date.now();
      return player;
    }
  }
  return undefined;
}

export function reconnectPlayer(
  room: Room,
  playerId: string,
  newSocketId: string
): Player | undefined {
  const player = room.players.get(playerId);
  if (!player) return undefined;

  store.removeSocket(player.socketId);
  player.socketId = newSocketId;
  player.isConnected = true;
  store.setSocketRoom(newSocketId, room.id);
  room.lastActivity = Date.now();

  return player;
}

export function getPlayerBySocket(room: Room, socketId: string): Player | undefined {
  for (const [, player] of room.players) {
    if (player.socketId === socketId) {
      return player;
    }
  }
  return undefined;
}

export function getConnectedPlayers(room: Room): Player[] {
  return Array.from(room.players.values()).filter((p) => p.isConnected);
}

export function updateScore(room: Room, playerId: string, delta: number): void {
  const player = room.players.get(playerId);
  if (player) {
    player.score += delta;
  }
}

export function resetScores(room: Room): void {
  room.players.forEach((player) => {
    player.score = 0;
  });
}
