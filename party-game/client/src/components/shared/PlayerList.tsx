'use client';

import { Player } from '@/types';

const COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-rose-500', 'bg-emerald-500',
];

interface PlayerListProps {
  players: Player[];
  showScores?: boolean;
  compact?: boolean;
}

export default function PlayerList({ players, showScores = false, compact = false }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <p className="text-white/40 text-center py-4 animate-gentle-pulse">
        Waiting for players to join...
      </p>
    );
  }

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {players.map((player, i) => (
        <div
          key={player.id}
          className={`flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3
            ${!player.isConnected ? 'opacity-40' : ''} transition-opacity`}
        >
          <div className={`w-8 h-8 rounded-full ${COLORS[i % COLORS.length]} flex items-center
            justify-center text-sm font-bold shrink-0`}>
            {player.name[0].toUpperCase()}
          </div>
          <span className="font-medium truncate flex-1">{player.name}</span>
          {!player.isConnected && (
            <span className="text-xs text-white/40">disconnected</span>
          )}
          {showScores && (
            <span className="font-mono font-bold text-accent-400">{player.score}</span>
          )}
        </div>
      ))}
    </div>
  );
}
