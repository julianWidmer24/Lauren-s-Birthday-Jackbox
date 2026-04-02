export interface Player {
  id: string;
  name: string;
  socketId: string;
  score: number;
  isConnected: boolean;
  joinedAt: number;
}

export interface UploadedImage {
  id: string;
  roomId: string;
  playerId: string;
  playerName: string;
  filename: string;
  path: string;
  mimeType: string;
  uploadedAt: number;
}

export interface SubmittedText {
  id: string;
  playerId: string;
  content: string;
  category: string;
}

export interface RoomContent {
  images: UploadedImage[];
  texts: SubmittedText[];
}

export interface RoomSettings {
  maxPlayers: number;
  roundCount: number;
  timePerRound: number;  // seconds
  timePerVote: number;   // seconds
}

export interface Room {
  id: string;
  code: string;
  hostSocketId: string;
  players: Map<string, Player>;
  status: 'lobby' | 'playing' | 'finished';
  gameType: string | null;
  gameState: any;
  content: RoomContent;
  createdAt: number;
  lastActivity: number;
  settings: RoomSettings;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 12,
  roundCount: 5,
  timePerRound: 60,
  timePerVote: 30,
};
