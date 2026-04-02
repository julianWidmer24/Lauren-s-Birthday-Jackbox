import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { UploadedImage } from '../rooms/types';

const UPLOAD_BASE = process.env.UPLOAD_DIR || './uploads';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5MB

export function validateUpload(file: Express.Multer.File): { ok: boolean; reason?: string } {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return { ok: false, reason: `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_TYPES.join(', ')}` };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, reason: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${MAX_SIZE / 1024 / 1024}MB` };
  }
  return { ok: true };
}

export function ensureRoomDir(roomId: string): string {
  const dir = path.join(UPLOAD_BASE, roomId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function saveImage(
  file: Express.Multer.File,
  roomId: string,
  playerId: string,
  playerName: string
): UploadedImage {
  const dir = ensureRoomDir(roomId);
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, file.buffer);

  return {
    id: uuidv4(),
    roomId,
    playerId,
    playerName,
    filename,
    path: filepath,
    mimeType: file.mimetype,
    uploadedAt: Date.now(),
  };
}

export function deleteRoomUploads(roomId: string): void {
  const dir = path.join(UPLOAD_BASE, roomId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function getUploadPath(roomId: string, filename: string): string | null {
  const filepath = path.join(UPLOAD_BASE, roomId, filename);
  // Prevent directory traversal
  const resolved = path.resolve(filepath);
  const base = path.resolve(UPLOAD_BASE);
  if (!resolved.startsWith(base)) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}
