'use client';

import { useState, useRef } from 'react';

interface ImageUploadProps {
  roomCode: string;
  playerId: string;
  playerName: string;
  onUploaded?: (imageUrl: string) => void;
}

export default function ImageUpload({ roomCode, playerId, playerName, onUploaded }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`/api/rooms/${roomCode}/upload`, {
        method: 'POST',
        headers: {
          'x-player-id': playerId,
          'x-player-name': playerName,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      setUploadCount((c) => c + 1);
      onUploaded?.(data.imageUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        id="image-upload"
      />
      <label
        htmlFor="image-upload"
        className={`btn-secondary block text-center cursor-pointer
          ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {uploading ? 'Uploading...' : 'Upload Photo'}
      </label>

      {uploadCount > 0 && (
        <p className="text-sm text-green-400 text-center">
          {uploadCount} photo{uploadCount !== 1 ? 's' : ''} uploaded
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
