export type CaptionPhase = 'captioning' | 'voting' | 'reveal' | 'final';

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

export interface CaptionGameState {
  phase: CaptionPhase;
  currentRound: number;
  totalRounds: number;
  currentImageId: string | null;
  currentImageUrl: string | null;
  currentImageAuthor: string | null;
  captions: Record<string, string>;       // playerId → caption text
  votes: Record<string, string>;          // voterId → captionOwnerId
  roundResults: RoundResult[];
  usedImageIds: string[];
  timerDuration: number | null;
}
