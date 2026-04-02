import { Server as SocketServer } from 'socket.io';
import {
  handleCreateRoom,
  handleJoinRoom,
  handleReconnect,
  handleHostReconnect,
  handleStartGame,
  handleGameAction,
  handleAdvancePhase,
  handleReturnToLobby,
  handleSubmitText,
  handleDisconnect,
} from './handlers';

export function setupSocketGateway(io: SocketServer): void {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Room management
    socket.on('create_room', (data) => handleCreateRoom(io, socket, data));
    socket.on('join_room', (data) => handleJoinRoom(io, socket, data));
    socket.on('reconnect_player', (data) => handleReconnect(io, socket, data));
    socket.on('reconnect_host', (data) => handleHostReconnect(io, socket, data));

    // Content submission
    socket.on('submit_text', (data) => handleSubmitText(io, socket, data));

    // Game flow
    socket.on('start_game', (data) => handleStartGame(io, socket, data));
    socket.on('game_action', (data) => handleGameAction(io, socket, data));
    socket.on('advance_phase', () => handleAdvancePhase(io, socket));
    socket.on('return_to_lobby', () => handleReturnToLobby(io, socket));

    // Disconnect
    socket.on('disconnect', () => handleDisconnect(io, socket));
  });
}
