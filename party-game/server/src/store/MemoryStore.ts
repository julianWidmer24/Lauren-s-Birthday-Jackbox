import { Room } from '../rooms/types';

class MemoryStore {
  private rooms: Map<string, Room> = new Map();
  private codeToRoomId: Map<string, string> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private playerToRoom: Map<string, string> = new Map();

  // Room operations
  setRoom(room: Room): void {
    this.rooms.set(room.id, room);
    this.codeToRoomId.set(room.code, room.id);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByCode(code: string): Room | undefined {
    const roomId = this.codeToRoomId.get(code.toUpperCase());
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.codeToRoomId.delete(room.code);
      room.players.forEach((player) => {
        this.socketToRoom.delete(player.socketId);
        this.playerToRoom.delete(player.id);
      });
      this.socketToRoom.delete(room.hostSocketId);
    }
    this.rooms.delete(roomId);
  }

  hasCode(code: string): boolean {
    return this.codeToRoomId.has(code);
  }

  // Socket-to-room mapping
  setSocketRoom(socketId: string, roomId: string): void {
    this.socketToRoom.set(socketId, roomId);
  }

  getRoomBySocket(socketId: string): Room | undefined {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  removeSocket(socketId: string): void {
    this.socketToRoom.delete(socketId);
  }

  // Player-to-room mapping
  setPlayerRoom(playerId: string, roomId: string): void {
    this.playerToRoom.set(playerId, roomId);
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  removePlayer(playerId: string): void {
    this.playerToRoom.delete(playerId);
  }

  // Utilities
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}

export const store = new MemoryStore();
