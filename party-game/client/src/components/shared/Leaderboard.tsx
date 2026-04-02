'use client';

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  highlightId?: string;
  title?: string;
}

export default function Leaderboard({ entries, highlightId, title = 'Leaderboard' }: LeaderboardProps) {
  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4 text-center">{'\u{1F33F}'} {title} {'\u{1F33F}'}</h3>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all
              ${i === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' : ''}
              ${i === 1 ? 'bg-gray-300/10 border border-gray-300/20' : ''}
              ${i === 2 ? 'bg-amber-700/20 border border-amber-700/30' : ''}
              ${i > 2 ? 'bg-white/5' : ''}
              ${entry.id === highlightId ? 'ring-2 ring-primary-400' : ''}`}
          >
            <span className={`w-8 text-center font-bold text-lg ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/50'}`}>
              #{i + 1}
            </span>
            <span className="flex-1 font-medium truncate">{entry.name}</span>
            <span className="font-mono font-bold text-xl text-accent-400">{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
