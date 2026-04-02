import { Room, UploadedImage } from '../../rooms/types';
import { TournamentGameState, BracketMatchup, MatchupResult } from './types';

export function getImageUrl(image: UploadedImage): string {
  return `/api/uploads/${image.roomId}/${image.filename}`;
}

/**
 * Build matchups from a list of image IDs.
 * Pairs them sequentially: [0,1], [2,3], etc.
 * If odd number, last image gets a bye (auto-advances).
 */
export function buildMatchups(room: Room, imageIds: string[]): { matchups: BracketMatchup[]; byes: string[] } {
  const matchups: BracketMatchup[] = [];
  const byes: string[] = [];

  for (let i = 0; i < imageIds.length; i += 2) {
    if (i + 1 >= imageIds.length) {
      byes.push(imageIds[i]);
      continue;
    }

    const imgA = room.content.images.find((img) => img.id === imageIds[i]);
    const imgB = room.content.images.find((img) => img.id === imageIds[i + 1]);
    if (!imgA || !imgB) continue;

    matchups.push({
      id: `${imageIds[i]}_vs_${imageIds[i + 1]}`,
      imageA: {
        id: imgA.id,
        url: getImageUrl(imgA),
        playerName: room.players.get(imgA.playerId)?.name || 'the host',
      },
      imageB: {
        id: imgB.id,
        url: getImageUrl(imgB),
        playerName: room.players.get(imgB.playerId)?.name || 'the host',
      },
    });
  }

  return { matchups, byes };
}

export function calculateMatchupResult(state: TournamentGameState): MatchupResult {
  const matchup = state.matchups[state.currentMatchupIndex];
  const votes = state.votes;

  let votesA = 0;
  let votesB = 0;

  Object.values(votes).forEach((imageId) => {
    if (imageId === matchup.imageA.id) votesA++;
    else if (imageId === matchup.imageB.id) votesB++;
  });

  const winner = votesA >= votesB ? matchup.imageA : matchup.imageB;

  return {
    matchupId: matchup.id,
    winnerId: winner.id,
    winnerUrl: winner.url,
    winnerPlayerName: winner.playerName,
    votesA,
    votesB,
  };
}

export function countBracketRounds(imageCount: number): number {
  if (imageCount <= 1) return 0;
  return Math.ceil(Math.log2(imageCount));
}

export function shouldAutoAdvance(state: TournamentGameState, room: Room): boolean {
  if (state.phase !== 'voting') return false;

  const matchup = state.matchups[state.currentMatchupIndex];
  if (!matchup) return false;

  // Players who submitted either image in this matchup can't vote on it
  const connectedVoters = Array.from(room.players.values())
    .filter((p) => p.isConnected)
    .map((p) => p.id);

  return connectedVoters.every((id) => id in state.votes);
}

/**
 * Award points to the player whose photo wins a matchup.
 * More points in later bracket rounds.
 */
export function awardMatchupPoints(room: Room, result: MatchupResult, bracketRound: number): void {
  const winnerImage = room.content.images.find((img) => img.id === result.winnerId);
  if (winnerImage) {
    const player = room.players.get(winnerImage.playerId);
    if (player) {
      player.score += bracketRound * 50;
    }
  }
}
