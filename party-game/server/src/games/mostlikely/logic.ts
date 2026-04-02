import { Room, SubmittedText } from '../../rooms/types';
import { MostLikelyGameState, MostLikelyRoundResult } from './types';

export function pickNextPrompt(room: Room, usedIds: string[]): SubmittedText | null {
  const available = room.content.texts
    .filter((t) => t.category === 'mostlikely' && !usedIds.includes(t.id));
  if (available.length === 0) return null;
  // Shuffle: prefer host prompts first, then player prompts
  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

export function calculateRoundResults(room: Room, state: MostLikelyGameState): MostLikelyRoundResult {
  const votes = state.votes;

  // Count votes per target player
  const voteCounts: Record<string, number> = {};
  Object.values(votes).forEach((targetId) => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  // Find the winner (most votes)
  let winnerId: string | null = null;
  let maxVotes = 0;
  Object.entries(voteCounts).forEach(([playerId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      winnerId = playerId;
    }
  });

  // Award points
  // Winner gets 50 points per vote they received
  if (winnerId) {
    const winner = room.players.get(winnerId);
    if (winner) {
      winner.score += maxVotes * 50;
    }
  }

  // Voters who picked the winner get 100 points
  Object.entries(votes).forEach(([voterId, targetId]) => {
    if (targetId === winnerId) {
      const voter = room.players.get(voterId);
      if (voter) {
        voter.score += 100;
      }
    }
  });

  const voteList = Object.entries(votes).map(([voterId, targetId]) => ({
    voterId,
    voterName: room.players.get(voterId)?.name || 'Unknown',
    votedForId: targetId,
    votedForName: room.players.get(targetId)?.name || 'Unknown',
  }));

  return {
    round: state.currentRound,
    prompt: state.currentPrompt!,
    promptSource: state.currentPromptSource,
    promptAuthorName: state.currentPromptAuthorName,
    votes: voteList,
    winner: winnerId
      ? {
          playerId: winnerId,
          playerName: room.players.get(winnerId)?.name || 'Unknown',
          voteCount: maxVotes,
        }
      : null,
  };
}

export function shouldAutoAdvance(state: MostLikelyGameState, room: Room): boolean {
  if (state.phase !== 'voting') return false;

  const connectedIds = Array.from(room.players.values())
    .filter((p) => p.isConnected)
    .map((p) => p.id);

  return connectedIds.every((id) => id in state.votes);
}
