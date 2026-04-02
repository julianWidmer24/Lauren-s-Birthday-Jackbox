export type MatchPhase = 'guessing' | 'reveal' | 'final';

export interface MatchRoundResult {
  round: number;
  fact: string;
  authorId: string;
  authorName: string;
  guesses: Array<{
    playerId: string;
    playerName: string;
    guessedId: string;
    guessedName: string;
    correct: boolean;
  }>;
}

export interface MatchGameState {
  phase: MatchPhase;
  currentRound: number;
  totalRounds: number;
  currentFact: string | null;
  currentFactAuthorId: string | null;
  guesses: Record<string, string>;       // guesserId -> guessedAuthorId
  roundResults: MatchRoundResult[];
  usedTextIds: string[];
  timerDuration: number | null;
}
