'use client';

import { TimerState } from '@/types';

interface TimerProps {
  timer: TimerState | null;
}

export default function Timer({ timer }: TimerProps) {
  if (!timer) return null;

  const percentage = (timer.remaining / timer.total) * 100;
  const isLow = timer.remaining <= 10;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-white/60">Time remaining</span>
        <span className={`font-mono font-bold text-lg ${isLow ? 'text-red-400' : 'text-white'}`}>
          {timer.remaining}s
        </span>
      </div>
      <div className="timer-bar">
        <div
          className={`timer-bar-fill ${isLow ? '!bg-red-500' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
