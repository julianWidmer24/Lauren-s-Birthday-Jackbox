import { Room, UploadedImage } from '../../rooms/types';
import { CaptionGameState, RoundResult } from './types';

export function pickNextImage(room: Room, usedIds: string[]): UploadedImage | null {
  const available = room.content.images.filter((img) => !usedIds.includes(img.id));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

export function calculateRoundResults(room: Room, state: CaptionGameState): RoundResult {
  const votes = state.votes;
  const captions = state.captions;

  // Count votes per caption author
  const voteCounts: Record<string, number> = {};
  const voterMap: Record<string, string[]> = {};

  Object.entries(votes).forEach(([voterId, captionOwnerId]) => {
    voteCounts[captionOwnerId] = (voteCounts[captionOwnerId] || 0) + 1;
    if (!voterMap[captionOwnerId]) voterMap[captionOwnerId] = [];
    voterMap[captionOwnerId].push(voterId);
  });

  // Award points
  Object.entries(voteCounts).forEach(([playerId, count]) => {
    const player = room.players.get(playerId);
    if (player) {
      player.score += count * 100;
    }
  });

  // Build results
  const captionResults = Object.entries(captions).map(([playerId, caption]) => {
    const player = room.players.get(playerId);
    return {
      playerId,
      playerName: player?.name || 'Unknown',
      caption,
      votes: voteCounts[playerId] || 0,
      voters: (voterMap[playerId] || []).map((vid) => {
        const voter = room.players.get(vid);
        return voter?.name || 'Unknown';
      }),
    };
  });

  // Sort by votes descending
  captionResults.sort((a, b) => b.votes - a.votes);

  return {
    round: state.currentRound,
    imageId: state.currentImageId!,
    captions: captionResults,
  };
}

export function getImageUrl(image: UploadedImage): string {
  return `/api/uploads/${image.roomId}/${image.filename}`;
}

export function shouldAutoAdvance(state: CaptionGameState, room: Room): boolean {
  const connectedPlayerIds = Array.from(room.players.values())
    .filter((p) => p.isConnected)
    .map((p) => p.id);

  if (state.phase === 'captioning') {
    // All connected players have submitted
    return connectedPlayerIds.every((id) => id in state.captions);
  }

  if (state.phase === 'voting') {
    // All connected players have voted (those who can vote)
    const eligibleVoters = connectedPlayerIds.filter((id) => id in state.captions);
    return eligibleVoters.every((id) => id in state.votes);
  }

  return false;
}
