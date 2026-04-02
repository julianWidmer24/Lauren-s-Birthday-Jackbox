export type TournamentPhase = 'voting' | 'result' | 'final';

export interface BracketMatchup {
  id: string;
  imageA: { id: string; url: string; playerName: string };
  imageB: { id: string; url: string; playerName: string };
}

export interface MatchupResult {
  matchupId: string;
  winnerId: string;
  winnerUrl: string;
  winnerPlayerName: string;
  votesA: number;
  votesB: number;
}

export interface TournamentGameState {
  phase: TournamentPhase;
  category: string;
  bracketRound: number;          // 1 = first round, increases as bracket narrows
  totalBracketRounds: number;
  currentMatchupIndex: number;
  matchups: BracketMatchup[];
  votes: Record<string, string>; // playerId -> imageId they voted for
  matchupResults: MatchupResult[];
  allRoundResults: MatchupResult[][];
  remainingImageIds: string[];   // images that advance
  winnerId: string | null;
  winnerUrl: string | null;
  winnerPlayerName: string | null;
  timerDuration: number | null;
}
