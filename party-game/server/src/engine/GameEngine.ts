import { Server as SocketServer } from 'socket.io';
import { Room } from '../rooms/types';
import { GameModule, GameAction, StateUpdate } from './types';
import { getGame } from './registry';
import { serializeRoom } from '../rooms/RoomManager';

interface ActiveTimer {
  timeout: NodeJS.Timeout;
  endsAt: number;
  interval: NodeJS.Timeout;
}

const activeTimers: Map<string, ActiveTimer> = new Map();

let io: SocketServer;

export function initEngine(socketServer: SocketServer): void {
  io = socketServer;
}

export function startGame(room: Room, gameType: string): { ok: boolean; reason?: string } {
  const gameModule = getGame(gameType);
  if (!gameModule) {
    return { ok: false, reason: `Unknown game type: ${gameType}` };
  }

  const check = gameModule.canStart(room);
  if (!check.ok) {
    return check;
  }

  room.gameType = gameType;
  room.status = 'playing';
  room.gameState = gameModule.init(room);

  broadcastGameState(room, gameModule);
  startPhaseTimer(room, gameModule);

  return { ok: true };
}

export function handleAction(room: Room, playerId: string, action: GameAction): void {
  if (!room.gameType || !room.gameState) return;

  const gameModule = getGame(room.gameType);
  if (!gameModule) return;

  const update = gameModule.handleAction(room, playerId, action);
  if (update) {
    room.gameState = update.gameState;
    broadcastGameState(room, gameModule);

    if (update.events) {
      update.events.forEach((event) => {
        io.to(room.id).emit('game_event', event);
      });
    }
  }
}

export function advancePhase(room: Room): void {
  if (!room.gameType || !room.gameState) return;

  const gameModule = getGame(room.gameType);
  if (!gameModule) return;

  clearRoomTimer(room.id);

  const update = gameModule.advance(room);
  room.gameState = update.gameState;

  broadcastGameState(room, gameModule);

  if (update.events) {
    update.events.forEach((event) => {
      io.to(room.id).emit('game_event', event);
    });
  }

  // Check if game is finished
  if (room.gameState.phase === 'final') {
    room.status = 'finished';
    io.to(room.id).emit('game_finished', {
      players: Array.from(room.players.values())
        .map((p) => ({ id: p.id, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score),
    });
  } else {
    startPhaseTimer(room, gameModule);
  }
}

export function handleTimerExpired(room: Room): void {
  if (!room.gameType || !room.gameState) return;

  const gameModule = getGame(room.gameType);
  if (!gameModule) return;

  clearRoomTimer(room.id);

  const update = gameModule.onTimerExpired(room);
  room.gameState = update.gameState;

  broadcastGameState(room, gameModule);

  if (update.events) {
    update.events.forEach((event) => {
      io.to(room.id).emit('game_event', event);
    });
  }

  if (room.gameState.phase === 'final') {
    room.status = 'finished';
    io.to(room.id).emit('game_finished', {
      players: Array.from(room.players.values())
        .map((p) => ({ id: p.id, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score),
    });
  } else {
    startPhaseTimer(room, gameModule);
  }
}

export function endGame(room: Room): void {
  clearRoomTimer(room.id);

  if (room.gameType) {
    const gameModule = getGame(room.gameType);
    if (gameModule) {
      gameModule.cleanup(room);
    }
  }

  room.gameType = null;
  room.gameState = null;
  room.status = 'lobby';
}

function broadcastGameState(room: Room, gameModule: GameModule): void {
  // Send host view
  const hostView = gameModule.getHostView(room);
  io.to(room.hostSocketId).emit('game_state', {
    role: 'host',
    phase: room.gameState.phase,
    ...hostView,
  });

  // Send player-specific views
  room.players.forEach((player) => {
    if (player.isConnected) {
      const playerView = gameModule.getPlayerView(room, player.id);
      io.to(player.socketId).emit('game_state', {
        role: 'player',
        phase: room.gameState.phase,
        ...playerView,
      });
    }
  });
}

function startPhaseTimer(room: Room, gameModule: GameModule): void {
  const state = room.gameState;
  if (!state || !state.timerDuration) return;

  const duration = state.timerDuration * 1000;
  const endsAt = Date.now() + duration;

  // Broadcast timer tick every second
  const interval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    io.to(room.id).emit('timer_tick', { remaining, total: state.timerDuration });
  }, 1000);

  const timeout = setTimeout(() => {
    clearInterval(interval);
    activeTimers.delete(room.id);
    handleTimerExpired(room);
  }, duration);

  activeTimers.set(room.id, { timeout, endsAt, interval });

  // Send initial timer
  io.to(room.id).emit('timer_tick', {
    remaining: state.timerDuration,
    total: state.timerDuration,
  });
}

function clearRoomTimer(roomId: string): void {
  const timer = activeTimers.get(roomId);
  if (timer) {
    clearTimeout(timer.timeout);
    clearInterval(timer.interval);
    activeTimers.delete(roomId);
  }
}
