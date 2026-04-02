import { GameModule, GameAction, StateUpdate, StartCheck } from '../../engine/types';
import { Room } from '../../rooms/types';
import { TournamentGameState } from './types';
import {
  buildMatchups,
  calculateMatchupResult,
  countBracketRounds,
  shouldAutoAdvance,
  awardMatchupPoints,
  getImageUrl,
} from './logic';

const tournamentGame: GameModule = {
  id: 'tournament',
  name: 'Photo Ranking',
  description: 'Photos go head-to-head in a bracket tournament -- vote for your favorite',
  minPlayers: 2,
  maxPlayers: 12,

  canStart(room: Room): StartCheck {
    const playerCount = room.players.size;
    if (playerCount < this.minPlayers) {
      return { ok: false, reason: `Need at least ${this.minPlayers} players (have ${playerCount})` };
    }
    if (room.content.images.length < 4) {
      return { ok: false, reason: 'Need at least 4 photos for a tournament bracket' };
    }
    return { ok: true };
  },

  init(room: Room): TournamentGameState {
    // Shuffle images for random seeding
    const imageIds = room.content.images
      .map((img) => img.id)
      .sort(() => Math.random() - 0.5);

    const totalRounds = countBracketRounds(imageIds.length);
    const { matchups, byes } = buildMatchups(room, imageIds);

    // Byes auto-advance to the remaining pool
    const remainingImageIds = [...byes];

    return {
      phase: 'voting',
      category: 'Best Photo',
      bracketRound: 1,
      totalBracketRounds: totalRounds,
      currentMatchupIndex: 0,
      matchups,
      votes: {},
      matchupResults: [],
      allRoundResults: [],
      remainingImageIds,
      winnerId: null,
      winnerUrl: null,
      winnerPlayerName: null,
      timerDuration: 15,
    };
  },

  handleAction(room: Room, playerId: string, action: GameAction): StateUpdate | null {
    const state = room.gameState as TournamentGameState;

    if (action.type !== 'submit_vote') return null;
    if (state.phase !== 'voting') return null;
    if (state.votes[playerId]) return null;

    const votedImageId = action.payload?.votedFor;
    const matchup = state.matchups[state.currentMatchupIndex];
    if (!matchup) return null;
    if (votedImageId !== matchup.imageA.id && votedImageId !== matchup.imageB.id) return null;

    state.votes[playerId] = votedImageId;

    if (shouldAutoAdvance(state, room)) {
      return this.advance(room);
    }

    return { gameState: state };
  },

  advance(room: Room): StateUpdate {
    const state = room.gameState as TournamentGameState;

    switch (state.phase) {
      case 'voting': {
        // Calculate result of current matchup
        const result = calculateMatchupResult(state);
        state.matchupResults.push(result);
        state.remainingImageIds.push(result.winnerId);

        awardMatchupPoints(room, result, state.bracketRound);

        state.phase = 'result';
        state.timerDuration = 6;
        return {
          gameState: state,
          events: [{ type: 'matchup_result', data: result }],
        };
      }

      case 'result': {
        // Move to next matchup or next bracket round
        if (state.currentMatchupIndex < state.matchups.length - 1) {
          // Next matchup in this bracket round
          state.currentMatchupIndex++;
          state.votes = {};
          state.phase = 'voting';
          state.timerDuration = 15;
          return { gameState: state };
        }

        // All matchups in this bracket round are done
        state.allRoundResults.push([...state.matchupResults]);

        // Check if we have a winner (only 1 image remaining)
        if (state.remainingImageIds.length <= 1) {
          const winnerImgId = state.remainingImageIds[0];
          const winnerImg = room.content.images.find((img) => img.id === winnerImgId);
          state.winnerId = winnerImgId || null;
          state.winnerUrl = winnerImg ? getImageUrl(winnerImg) : null;
          state.winnerPlayerName = winnerImg
            ? (room.players.get(winnerImg.playerId)?.name || 'the host')
            : null;
          state.phase = 'final';
          state.timerDuration = null;
          return { gameState: state };
        }

        // Build next bracket round
        state.bracketRound++;
        const { matchups, byes } = buildMatchups(room, state.remainingImageIds);
        state.matchups = matchups;
        state.remainingImageIds = [...byes];
        state.matchupResults = [];
        state.currentMatchupIndex = 0;
        state.votes = {};

        if (matchups.length === 0) {
          // Only byes remain — we have a winner
          const winnerImgId = state.remainingImageIds[0];
          const winnerImg = room.content.images.find((img) => img.id === winnerImgId);
          state.winnerId = winnerImgId || null;
          state.winnerUrl = winnerImg ? getImageUrl(winnerImg) : null;
          state.winnerPlayerName = winnerImg
            ? (room.players.get(winnerImg.playerId)?.name || 'the host')
            : null;
          state.phase = 'final';
          state.timerDuration = null;
          return { gameState: state };
        }

        state.phase = 'voting';
        state.timerDuration = 15;
        return { gameState: state };
      }

      default:
        return { gameState: state };
    }
  },

  onTimerExpired(room: Room): StateUpdate {
    return this.advance(room);
  },

  getHostView(room: Room): any {
    const state = room.gameState as TournamentGameState;

    const base = {
      gameType: 'tournament',
      bracketRound: state.bracketRound,
      totalBracketRounds: state.totalBracketRounds,
      category: state.category,
      currentRound: state.bracketRound,
      totalRounds: state.totalBracketRounds,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isConnected: p.isConnected,
      })),
    };

    switch (state.phase) {
      case 'voting': {
        const matchup = state.matchups[state.currentMatchupIndex];
        return {
          ...base,
          matchup,
          matchupNumber: state.currentMatchupIndex + 1,
          totalMatchups: state.matchups.length,
          votedCount: Object.keys(state.votes).length,
          totalVoters: Array.from(room.players.values()).filter((p) => p.isConnected).length,
        };
      }

      case 'result': {
        const lastResult = state.matchupResults[state.matchupResults.length - 1];
        const matchup = state.matchups[state.currentMatchupIndex];
        return {
          ...base,
          matchup,
          matchupResult: lastResult,
          matchupNumber: state.currentMatchupIndex + 1,
          totalMatchups: state.matchups.length,
        };
      }

      case 'final':
        return {
          ...base,
          winnerId: state.winnerId,
          winnerUrl: state.winnerUrl,
          winnerPlayerName: state.winnerPlayerName,
          allRoundResults: state.allRoundResults,
          leaderboard: Array.from(room.players.values())
            .map((p) => ({ id: p.id, name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score),
        };

      default:
        return base;
    }
  },

  getPlayerView(room: Room, playerId: string): any {
    const state = room.gameState as TournamentGameState;
    const player = room.players.get(playerId);

    const base = {
      gameType: 'tournament',
      bracketRound: state.bracketRound,
      totalBracketRounds: state.totalBracketRounds,
      category: state.category,
      currentRound: state.bracketRound,
      totalRounds: state.totalBracketRounds,
      myScore: player?.score || 0,
    };

    switch (state.phase) {
      case 'voting': {
        const matchup = state.matchups[state.currentMatchupIndex];
        return {
          ...base,
          matchup,
          matchupNumber: state.currentMatchupIndex + 1,
          totalMatchups: state.matchups.length,
          hasVoted: !!state.votes[playerId],
        };
      }

      case 'result': {
        const lastResult = state.matchupResults[state.matchupResults.length - 1];
        const matchup = state.matchups[state.currentMatchupIndex];
        return {
          ...base,
          matchup,
          matchupResult: lastResult,
        };
      }

      case 'final':
        return {
          ...base,
          winnerId: state.winnerId,
          winnerUrl: state.winnerUrl,
          winnerPlayerName: state.winnerPlayerName,
          leaderboard: Array.from(room.players.values())
            .map((p) => ({ id: p.id, name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score),
          myRank:
            Array.from(room.players.values())
              .sort((a, b) => b.score - a.score)
              .findIndex((p) => p.id === playerId) + 1,
        };

      default:
        return base;
    }
  },

  cleanup(_room: Room): void {},
};

export default tournamentGame;
