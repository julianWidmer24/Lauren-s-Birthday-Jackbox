import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';

import { setupSocketGateway } from './socket/gateway';
import { initEngine } from './engine/GameEngine';
import { registerGame, getGameList } from './engine/registry';
import captionGame from './games/caption';
import matchGame from './games/match';
import debateGame from './games/debate';
import tournamentGame from './games/tournament';
import mostLikelyGame from './games/mostlikely';
import * as RoomManager from './rooms/RoomManager';
import * as UploadManager from './uploads/UploadManager';
import { store } from './store/MemoryStore';

// Config
const PORT = parseInt(process.env.PORT || '3001', 10);

// Allow any localhost or private-network origin (safe for a LAN party game)
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
}

// Express app
const app = express();
const httpServer = createServer(app);

// CORS — permissive for local/LAN origins
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Socket.IO
const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize game engine
initEngine(io);

// Register game modules
registerGame(captionGame);
registerGame(matchGame);
registerGame(debateGame);
registerGame(tournamentGame);
registerGame(mostLikelyGame);

// Set up socket gateway
setupSocketGateway(io);

// ─── REST API ───

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', rooms: store.getRoomCount() });
});

// Game list
app.get('/api/games', (_req, res) => {
  res.json(getGameList());
});

// File upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

app.post('/api/rooms/:code/upload', upload.single('image'), (req, res) => {
  try {
    const { code } = req.params;
    const playerId = req.headers['x-player-id'] as string;
    const playerName = req.headers['x-player-name'] as string;

    const room = RoomManager.getRoomByCode(code.toUpperCase());
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const validation = UploadManager.validateUpload(req.file);
    if (!validation.ok) {
      res.status(400).json({ error: validation.reason });
      return;
    }

    const image = UploadManager.saveImage(
      req.file,
      room.id,
      playerId || 'host',
      playerName || 'Host'
    );
    room.content.images.push(image);
    RoomManager.touchRoom(room);

    // Notify room about new upload
    io.to(room.id).emit('image_uploaded', {
      imageId: image.id,
      playerId: image.playerId,
      playerName: image.playerName,
      imageUrl: `/api/uploads/${room.id}/${image.filename}`,
      totalImages: room.content.images.length,
    });

    res.json({
      imageId: image.id,
      imageUrl: `/api/uploads/${room.id}/${image.filename}`,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve uploaded files
app.get('/api/uploads/:roomId/:filename', (req, res) => {
  const { roomId, filename } = req.params;
  const filepath = UploadManager.getUploadPath(roomId, filename);

  if (!filepath) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.sendFile(filepath);
});

// Get room info (for join validation)
app.get('/api/rooms/:code', (req, res) => {
  const room = RoomManager.getRoomByCode(req.params.code.toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  res.json(RoomManager.serializeRoom(room));
});

// ─── Room Cleanup ───

// Clean up stale rooms every 5 minutes
const ROOM_TTL = 2 * 60 * 60 * 1000; // 2 hours
setInterval(() => {
  const now = Date.now();
  const rooms = store.getAllRooms();
  rooms.forEach((room) => {
    if (now - room.lastActivity > ROOM_TTL) {
      console.log(`Cleaning up stale room: ${room.code}`);
      UploadManager.deleteRoomUploads(room.id);
      RoomManager.destroyRoom(room.id);
    }
  });
}, 5 * 60 * 1000);

// ─── Start Server ───

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Party Game Server running on port ${PORT}`);
  console.log(`Accepting connections from any local/LAN origin`);
});
