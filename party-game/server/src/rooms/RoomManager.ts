import { v4 as uuidv4 } from 'uuid';
import { Room, DEFAULT_SETTINGS, RoomSettings } from './types';
import { store } from '../store/MemoryStore';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
const CODE_LENGTH = 4;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function generateUniqueCode(): string {
  let code = generateCode();
  let attempts = 0;
  while (store.hasCode(code) && attempts < 100) {
    code = generateCode();
    attempts++;
  }
  if (store.hasCode(code)) {
    throw new Error('Failed to generate unique room code');
  }
  return code;
}

export function createRoom(hostSocketId: string, settings?: Partial<RoomSettings>): Room {
  const room: Room = {
    id: uuidv4(),
    code: generateUniqueCode(),
    hostSocketId,
    players: new Map(),
    status: 'lobby',
    gameType: null,
    gameState: null,
    content: { images: [], texts: [] },
    createdAt: Date.now(),
    lastActivity: Date.now(),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };

  store.setRoom(room);
  store.setSocketRoom(hostSocketId, room.id);

  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return store.getRoom(roomId);
}

export function getRoomByCode(code: string): Room | undefined {
  return store.getRoomByCode(code);
}

export function destroyRoom(roomId: string): void {
  store.deleteRoom(roomId);
}

export function updateHostSocket(roomId: string, newSocketId: string): void {
  const room = store.getRoom(roomId);
  if (!room) return;
  store.removeSocket(room.hostSocketId);
  room.hostSocketId = newSocketId;
  store.setSocketRoom(newSocketId, room.id);
  room.lastActivity = Date.now();
}

export function getRoomBySocket(socketId: string): Room | undefined {
  return store.getRoomBySocket(socketId);
}

export function touchRoom(room: Room): void {
  room.lastActivity = Date.now();
}

export function serializeRoom(room: Room) {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    gameType: room.gameType,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      isConnected: p.isConnected,
    })),
    settings: room.settings,
    contentCount: {
      images: room.content.images.length,
      texts: room.content.texts.length,
    },
  };
}
