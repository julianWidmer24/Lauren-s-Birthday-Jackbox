export type MostLikelyPhase = 'voting' | 'reveal' | 'final';

export interface MostLikelyRoundResult {
  round: number;
  prompt: string;
  promptSource: 'host' | 'player';
  promptAuthorName: string | null;
  votes: Array<{
    voterId: string;
    voterName: string;
    votedForId: string;
    votedForName: string;
  }>;
  winner: {
    playerId: string;
    playerName: string;
    voteCount: number;
  } | null;
}

export interface MostLikelyGameState {
  phase: MostLikelyPhase;
  currentRound: number;
  totalRounds: number;
  currentPrompt: string | null;
  currentPromptSource: 'host' | 'player';
  currentPromptAuthorName: string | null;
  votes: Record<string, string>;           // voterId -> votedForPlayerId
  roundResults: MostLikelyRoundResult[];
  usedTextIds: string[];
  timerDuration: number | null;
}
