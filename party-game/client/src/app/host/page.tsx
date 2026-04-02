'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import FloralDecor from '@/components/shared/FloralDecor';

export default function HostCreate() {
  const router = useRouter();
  const { emit, on, isConnected } = useSocket();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const cleanup = on('room_created', (data: { roomCode: string }) => {
      sessionStorage.setItem('hostRoomCode', data.roomCode);
      router.push(`/host/${data.roomCode}`);
    });
    return cleanup;
  }, [on, router]);

  function handleCreate() {
    setCreating(true);
    emit('create_room', {});
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <FloralDecor variant="full" />

      <div className="text-center max-w-md w-full space-y-8 relative z-10">
        <div>
          <p className="text-3xl mb-2 select-none">{'\u{1F33B}'}</p>
          <h1 className="text-4xl font-black">Host a Game</h1>
          <p className="text-white/60 mt-2">
            Create a room and display this screen for everyone to see
          </p>
        </div>

        {!isConnected ? (
          <p className="text-yellow-400">Connecting to server...</p>
        ) : (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-primary w-full text-xl py-4"
          >
            {creating ? 'Creating...' : `\u{1F331} Create Room`}
          </button>
        )}
      </div>
    </div>
  );
}
