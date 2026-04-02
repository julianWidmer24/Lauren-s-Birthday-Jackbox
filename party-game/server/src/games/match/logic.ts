import { Room, SubmittedText } from '../../rooms/types';
import { MatchGameState, MatchRoundResult } from './types';

export function pickNextFact(room: Room, usedIds: string[]): SubmittedText | null {
  const available = room.content.texts.filter((t) => !usedIds.includes(t.id));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

export function calculateRoundResults(room: Room, state: MatchGameState): MatchRoundResult {
  const guesses = state.guesses;
  const authorId = state.currentFactAuthorId!;

  const guessResults = Object.entries(guesses).map(([guesserId, guessedId]) => {
    const correct = guessedId === authorId;
    if (correct) {
      const player = room.players.get(guesserId);
      if (player) {
        player.score += 100;
      }
    }
    return {
      playerId: guesserId,
      playerName: room.players.get(guesserId)?.name || 'Unknown',
      guessedId,
      guessedName: room.players.get(guessedId)?.name || 'Unknown',
      correct,
    };
  });

  // Bonus: if fewer than half guessed correctly, the author gets points for stumping
  const correctCount = guessResults.filter((g) => g.correct).length;
  const totalGuessers = guessResults.length;
  if (totalGuessers > 0 && correctCount < totalGuessers / 2) {
    const author = room.players.get(authorId);
    if (author) {
      author.score += 50;
    }
  }

  return {
    round: state.currentRound,
    fact: state.currentFact!,
    authorId,
    authorName: room.players.get(authorId)?.name || 'Unknown',
    guesses: guessResults,
  };
}

export function shouldAutoAdvance(state: MatchGameState, room: Room): boolean {
  if (state.phase !== 'guessing') return false;

  const connectedPlayerIds = Array.from(room.players.values())
    .filter((p) => p.isConnected && p.id !== state.currentFactAuthorId)
    .map((p) => p.id);

  return connectedPlayerIds.every((id) => id in state.guesses);
}
