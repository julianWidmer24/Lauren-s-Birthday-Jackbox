export interface Player {
  id: string;
  name: string;
  score: number;
  isConnected: boolean;
}

export interface RoomInfo {
  id: string;
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  gameType: string | null;
  players: Player[];
  settings: RoomSettings;
  contentCount: {
    images: number;
    texts: number;
  };
}

export interface RoomSettings {
  maxPlayers: number;
  roundCount: number;
  timePerRound: number;
  timePerVote: number;
}

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

// ─── Caption game types ───

export interface CaptionEntry {
  playerId: string;
  playerName?: string;
  caption: string;
  isMine?: boolean;
  votes?: number;
  voters?: string[];
}

export interface RoundResult {
  round: number;
  imageId: string;
  captions: Array<{
    playerId: string;
    playerName: string;
    caption: string;
    votes: number;
    voters: string[];
  }>;
}

// ─── Match game types ───

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

// ─── Debate game types ───

export interface DebateArgument {
  playerId: string;
  playerName?: string;
  argument: string;
  side: 'A' | 'B';
  isMine?: boolean;
  votes?: number;
  voters?: string[];
}

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

// ─── Tournament game types ───

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

// ─── Most Likely To game types ───

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

export interface VoteTallyEntry {
  id: string;
  name: string;
  votes: number;
}

// ─── Unified game state ───

export interface GameState {
  role: 'host' | 'player';
  phase: string;
  gameType?: string;
  currentRound: number;
  totalRounds: number;

  // Caption-specific
  imageUrl?: string | null;
  imageAuthor?: string | null;
  submittedCount?: number;
  totalPlayers?: number;
  captions?: CaptionEntry[];
  votedCount?: number;
  totalVoters?: number;
  roundResult?: RoundResult;
  allResults?: RoundResult[];
  hasSubmitted?: boolean;
  myCaption?: string | null;
  hasVoted?: boolean;
  myVote?: string | null;

  // Match-specific
  fact?: string | null;
  guessedCount?: number;
  totalGuessers?: number;
  isAuthor?: boolean;
  hasGuessed?: boolean;
  playerOptions?: Array<{ id: string; name: string }>;
  matchRoundResult?: MatchRoundResult;

  // Debate-specific
  prompt?: string | null;
  sideA?: string | null;
  sideB?: string | null;
  hasPicked?: boolean;
  myPick?: 'A' | 'B' | null;
  mySide?: 'A' | 'B' | null;
  hasSubmittedArgument?: boolean;
  myArgument?: string | null;
  pickedCount?: number;
  totalPickers?: number;
  sideACount?: number;
  sideBCount?: number;
  arguments?: DebateArgument[];
  debateRoundResult?: DebateRoundResult;

  // Tournament-specific
  matchup?: BracketMatchup;
  matchupNumber?: number;
  totalMatchups?: number;
  matchupResult?: MatchupResult;
  bracketRound?: number;
  totalBracketRounds?: number;
  category?: string;
  winnerId?: string | null;
  winnerUrl?: string | null;
  winnerPlayerName?: string | null;
  allRoundResults?: MatchupResult[][];

  // Most Likely To-specific
  promptSource?: 'host' | 'player';
  promptAuthorName?: string | null;
  voteTally?: VoteTallyEntry[];
  mostLikelyResult?: MostLikelyRoundResult;

  // Shared
  leaderboard?: Array<{ id: string; name: string; score: number }>;
  players?: Player[];
  myScore?: number;
  myRank?: number;
}

export interface TimerState {
  remaining: number;
  total: number;
}
