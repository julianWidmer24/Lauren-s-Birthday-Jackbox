import { Room, SubmittedText } from '../../rooms/types';
import { DebateGameState, DebateRoundResult } from './types';

export function pickNextPrompt(room: Room, usedIds: string[]): SubmittedText | null {
  const available = room.content.texts
    .filter((t) => t.category === 'debate' && !usedIds.includes(t.id));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

export function parsePrompt(text: string): { prompt: string; sideA: string; sideB: string } {
  // Expected format: "Prompt text | Side A | Side B"
  const parts = text.split('|').map((s) => s.trim());
  if (parts.length >= 3) {
    return { prompt: parts[0], sideA: parts[1], sideB: parts[2] };
  }
  // Fallback: use the whole text as prompt with default sides
  return { prompt: text, sideA: 'Yes', sideB: 'No' };
}

export function calculateRoundResults(room: Room, state: DebateGameState): DebateRoundResult {
  const votes = state.argumentVotes;
  const args = state.arguments;

  const voteCounts: Record<string, number> = {};
  const voterMap: Record<string, string[]> = {};

  Object.entries(votes).forEach(([voterId, authorId]) => {
    voteCounts[authorId] = (voteCounts[authorId] || 0) + 1;
    if (!voterMap[authorId]) voterMap[authorId] = [];
    voterMap[authorId].push(voterId);
  });

  // Award points for argument votes
  Object.entries(voteCounts).forEach(([playerId, count]) => {
    const player = room.players.get(playerId);
    if (player) {
      player.score += count * 100;
    }
  });

  const argumentResults = Object.entries(args).map(([playerId, argument]) => {
    const player = room.players.get(playerId);
    return {
      playerId,
      playerName: player?.name || 'Unknown',
      side: state.picks[playerId] || 'A' as 'A' | 'B',
      argument,
      votes: voteCounts[playerId] || 0,
      voters: (voterMap[playerId] || []).map((vid) => room.players.get(vid)?.name || 'Unknown'),
    };
  });

  argumentResults.sort((a, b) => b.votes - a.votes);

  return {
    round: state.currentRound,
    prompt: state.currentPrompt!,
    sideA: state.sideA!,
    sideB: state.sideB!,
    sideAPickers: Object.entries(state.picks)
      .filter(([, side]) => side === 'A')
      .map(([pid]) => room.players.get(pid)?.name || 'Unknown'),
    sideBPickers: Object.entries(state.picks)
      .filter(([, side]) => side === 'B')
      .map(([pid]) => room.players.get(pid)?.name || 'Unknown'),
    arguments: argumentResults,
  };
}

export function shouldAutoAdvance(state: DebateGameState, room: Room): boolean {
  const connectedIds = Array.from(room.players.values())
    .filter((p) => p.isConnected)
    .map((p) => p.id);

  if (state.phase === 'picking') {
    return connectedIds.every((id) => id in state.picks);
  }

  if (state.phase === 'arguing') {
    return connectedIds.every((id) => id in state.arguments);
  }

  if (state.phase === 'voting') {
    const eligibleVoters = connectedIds.filter((id) => id in state.arguments);
    return eligibleVoters.every((id) => id in state.argumentVotes);
  }

  return false;
}
