export type DebatePhase = 'picking' | 'arguing' | 'voting' | 'reveal' | 'final';

export interface DebateRoundResult {
  round: number;
  prompt: string;
  sideA: string;
  sideB: string;
  sideAPickers: string[];
  sideBPickers: string[];
  arguments: Array<{
    playerId: string;
    playerName: string;
    side: 'A' | 'B';
    argument: string;
    votes: number;
    voters: string[];
  }>;
}

export interface DebateGameState {
  phase: DebatePhase;
  currentRound: number;
  totalRounds: number;
  currentPrompt: string | null;
  sideA: string | null;
  sideB: string | null;
  picks: Record<string, 'A' | 'B'>;          // playerId -> side
  arguments: Record<string, string>;          // playerId -> argument text
  argumentVotes: Record<string, string>;      // voterId -> argumentAuthorId
  roundResults: DebateRoundResult[];
  usedTextIds: string[];
  timerDuration: number | null;
}
