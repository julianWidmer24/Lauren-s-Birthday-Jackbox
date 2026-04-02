'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import FloralDecor from '@/components/shared/FloralDecor';

export default function JoinGame() {
  const router = useRouter();
  const { emit, on, isConnected } = useSocket();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for reconnect data
  useEffect(() => {
    const savedPlayerId = sessionStorage.getItem('playerId');
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const savedPlayerName = sessionStorage.getItem('playerName');

    if (savedPlayerId && savedRoomCode && isConnected) {
      emit('reconnect_player', { playerId: savedPlayerId, roomCode: savedRoomCode });
    }

    if (savedPlayerName) {
      setName(savedPlayerName);
    }
  }, [isConnected, emit]);

  useEffect(() => {
    const cleanups = [
      on('join_accepted', (data: any) => {
        sessionStorage.setItem('playerId', data.playerId);
        sessionStorage.setItem('roomCode', data.roomCode);
        sessionStorage.setItem('playerName', name);
        router.push(`/play/${data.roomCode}`);
      }),
      on('reconnect_success', (data: any) => {
        sessionStorage.setItem('playerId', data.playerId);
        sessionStorage.setItem('roomCode', data.roomCode);
        router.push(`/play/${data.roomCode}`);
      }),
      on('reconnect_failed', () => {
        // Clear stale session
        sessionStorage.removeItem('playerId');
        sessionStorage.removeItem('roomCode');
      }),
      on('error', (data: any) => {
        setError(data.message);
        setJoining(false);
      }),
    ];
    return () => cleanups.forEach((c) => c());
  }, [on, router, name]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setError(null);
    setJoining(true);
    emit('join_room', { code: code.trim().toUpperCase(), name: name.trim() });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <FloralDecor variant="full" />
      <ConnectionStatus isConnected={isConnected} />

      <div className="max-w-sm w-full space-y-8 relative z-10">
        <div className="text-center">
          <p className="text-2xl mb-2 select-none">{'\u{1F338}'}</p>
          <h1 className="text-3xl font-black mb-2">Join Game</h1>
          <p className="text-white/60">Enter the room code shown on the big screen</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="ROOM CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              className="input-field text-center text-2xl font-mono tracking-widest uppercase"
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              className="input-field"
              maxLength={20}
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!code.trim() || !name.trim() || joining || !isConnected}
            className="btn-primary w-full text-xl py-4"
          >
            {joining ? 'Joining...' : `\u{1F43E} Join`}
          </button>
        </form>
      </div>
    </div>
  );
}
