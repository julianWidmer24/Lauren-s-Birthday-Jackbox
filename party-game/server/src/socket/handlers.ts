import { Socket, Server as SocketServer } from 'socket.io';
import * as RoomManager from '../rooms/RoomManager';
import * as PlayerManager from '../rooms/PlayerManager';
import * as Engine from '../engine/GameEngine';
import { store } from '../store/MemoryStore';

export function handleCreateRoom(io: SocketServer, socket: Socket, data: any) {
  try {
    const settings = data?.settings || {};
    const room = RoomManager.createRoom(socket.id, settings);
    socket.join(room.id);

    console.log(`Room created: ${room.code} by ${socket.id}`);

    socket.emit('room_created', {
      roomCode: room.code,
      roomId: room.id,
      settings: room.settings,
    });
  } catch (err: any) {
    socket.emit('error', { message: err.message });
  }
}

export function handleJoinRoom(io: SocketServer, socket: Socket, data: any) {
  try {
    const { code, name } = data;
    if (!code || !name) {
      socket.emit('error', { message: 'Room code and name are required' });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 20) {
      socket.emit('error', { message: 'Name must be 1-20 characters' });
      return;
    }

    const room = RoomManager.getRoomByCode(code.toUpperCase());
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.status === 'playing') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    const player = PlayerManager.addPlayer(room, trimmedName, socket.id);
    socket.join(room.id);

    console.log(`Player "${player.name}" joined room ${room.code}`);

    socket.emit('join_accepted', {
      playerId: player.id,
      roomCode: room.code,
      roomId: room.id,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        isConnected: p.isConnected,
      })),
    });

    // Notify everyone else in the room
    socket.to(room.id).emit('player_joined', {
      player: { id: player.id, name: player.name, isConnected: true },
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isConnected: p.isConnected,
      })),
    });
  } catch (err: any) {
    socket.emit('error', { message: err.message });
  }
}

export function handleReconnect(io: SocketServer, socket: Socket, data: any) {
  try {
    const { playerId, roomCode } = data;
    if (!playerId || !roomCode) {
      socket.emit('error', { message: 'Player ID and room code required for reconnect' });
      return;
    }

    const room = RoomManager.getRoomByCode(roomCode.toUpperCase());
    if (!room) {
      socket.emit('reconnect_failed', { reason: 'Room no longer exists' });
      return;
    }

    const player = PlayerManager.reconnectPlayer(room, playerId, socket.id);
    if (!player) {
      socket.emit('reconnect_failed', { reason: 'Player not found in room' });
      return;
    }

    socket.join(room.id);
    console.log(`Player "${player.name}" reconnected to room ${room.code}`);

    socket.emit('reconnect_success', {
      playerId: player.id,
      roomCode: room.code,
      roomId: room.id,
      roomStatus: room.status,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isConnected: p.isConnected,
      })),
    });

    // If game is in progress, send current game state
    if (room.status === 'playing' && room.gameType) {
      const { getGame } = require('../engine/registry');
      const gameModule = getGame(room.gameType);
      if (gameModule) {
        const playerView = gameModule.getPlayerView(room, playerId);
        socket.emit('game_state', {
          role: 'player',
          phase: room.gameState.phase,
          ...playerView,
        });
      }
    }

    // Notify others
    socket.to(room.id).emit('player_reconnected', {
      playerId: player.id,
      playerName: player.name,
    });
  } catch (err: any) {
    socket.emit('error', { message: err.message });
  }
}

export function handleHostReconnect(io: SocketServer, socket: Socket, data: any) {
  try {
    const { roomCode } = data;
    if (!roomCode) {
      socket.emit('error', { message: 'Room code required' });
      return;
    }

    const room = RoomManager.getRoomByCode(roomCode.toUpperCase());
    if (!room) {
      socket.emit('reconnect_failed', { reason: 'Room no longer exists' });
      return;
    }

    RoomManager.updateHostSocket(room.id, socket.id);
    socket.join(room.id);

    console.log(`Host reconnected to room ${room.code}`);

    socket.emit('host_reconnect_success', {
      room: RoomManager.serializeRoom(room),
    });

    // If game is in progress, send current game state
    if (room.status === 'playing' && room.gameType) {
      const { getGame } = require('../engine/registry');
      const gameModule = getGame(room.gameType);
      if (gameModule) {
        const hostView = gameModule.getHostView(room);
        socket.emit('game_state', {
          role: 'host',
          phase: room.gameState.phase,
          ...hostView,
        });
      }
    }
  } catch (err: any) {
    socket.emit('error', { message: err.message });
  }
}

export function handleSubmitText(io: SocketServer, socket: Socket, data: any) {
  try {
    const room = store.getRoomBySocket(socket.id);
    if (!room) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    const { content, category } = data;
    if (!content || typeof content !== 'string') {
      socket.emit('error', { message: 'Text content is required' });
      return;
    }

    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      socket.emit('error', { message: 'Text must be 1-500 characters' });
      return;
    }

    const player = PlayerManager.getPlayerBySocket(room, socket.id);
    const playerId = player?.id || 'host';

    const text = {
      id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      content: trimmed,
      category: category || 'general',
    };

    room.content.texts.push(text);
    RoomManager.touchRoom(room);

    io.to(room.id).emit('text_submitted', {
      textId: text.id,
      playerId: text.playerId,
      category: text.category,
      totalTexts: room.content.texts.length,
    });
  } catch (err: any) {
    socket.emit('error', { message: err.message });
  }
}

export function handleStartGame(io: SocketServer, socket: Socket, data: any) {
  const room = store.getRoomBySocket(socket.id);
  if (!room) {
    socket.emit('error', { message: 'Not in a room' });
    return;
  }

  if (room.hostSocketId !== socket.id) {
    socket.emit('error', { message: 'Only the host can start the game' });
    return;
  }

  const gameType = data?.gameType || 'caption';
  const result = Engine.startGame(room, gameType);

  if (!result.ok) {
    socket.emit('error', { message: result.reason });
    return;
  }

  console.log(`Game started in room ${room.code}: ${gameType}`);
  io.to(room.id).emit('game_started', { gameType });
}

export function handleGameAction(io: SocketServer, socket: Socket, data: any) {
  const room = store.getRoomBySocket(socket.id);
  if (!room || room.status !== 'playing') return;

  // Find the player
  const player = PlayerManager.getPlayerBySocket(room, socket.id);
  if (!player) return;

  Engine.handleAction(room, player.id, {
    type: data.type,
    payload: data.payload,
  });
}

export function handleAdvancePhase(io: SocketServer, socket: Socket) {
  const room = store.getRoomBySocket(socket.id);
  if (!room) return;

  if (room.hostSocketId !== socket.id) {
    socket.emit('error', { message: 'Only the host can advance phases' });
    return;
  }

  Engine.advancePhase(room);
}

export function handleReturnToLobby(io: SocketServer, socket: Socket) {
  const room = store.getRoomBySocket(socket.id);
  if (!room) return;

  if (room.hostSocketId !== socket.id) {
    socket.emit('error', { message: 'Only the host can return to lobby' });
    return;
  }

  Engine.endGame(room);
  PlayerManager.resetScores(room);

  io.to(room.id).emit('returned_to_lobby', {
    room: RoomManager.serializeRoom(room),
  });

  console.log(`Room ${room.code} returned to lobby`);
}

export function handleDisconnect(io: SocketServer, socket: Socket) {
  const room = store.getRoomBySocket(socket.id);
  if (!room) return;

  // Check if this was the host
  if (room.hostSocketId === socket.id) {
    console.log(`Host disconnected from room ${room.code}`);
    io.to(room.id).emit('host_disconnected');
    // Don't destroy room immediately — allow reconnect
    return;
  }

  // Check if this was a player
  const player = PlayerManager.disconnectPlayer(room, socket.id);
  if (player) {
    console.log(`Player "${player.name}" disconnected from room ${room.code}`);
    io.to(room.id).emit('player_disconnected', {
      playerId: player.id,
      playerName: player.name,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isConnected: p.isConnected,
      })),
    });
  }
}
