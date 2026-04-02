import { GameModule, GameAction, StateUpdate, StartCheck } from '../../engine/types';
import { Room } from '../../rooms/types';
import { MatchGameState } from './types';
import { pickNextFact, calculateRoundResults, shouldAutoAdvance } from './logic';

const matchGame: GameModule = {
  id: 'match',
  name: 'Who Said It?',
  description: 'Guess which player submitted each anonymous fact or quote',
  minPlayers: 3,
  maxPlayers: 12,

  canStart(room: Room): StartCheck {
    const playerCount = room.players.size;
    if (playerCount < this.minPlayers) {
      return { ok: false, reason: `Need at least ${this.minPlayers} players (have ${playerCount})` };
    }
    if (room.content.texts.length < 3) {
      return { ok: false, reason: 'Need at least 3 submitted texts to play' };
    }
    return { ok: true };
  },

  init(room: Room): MatchGameState {
    const maxRounds = Math.min(room.settings.roundCount, room.content.texts.length);
    const firstFact = pickNextFact(room, []);

    return {
      phase: 'guessing',
      currentRound: 1,
      totalRounds: maxRounds,
      currentFact: firstFact?.content || null,
      currentFactAuthorId: firstFact?.playerId || null,
      guesses: {},
      roundResults: [],
      usedTextIds: firstFact ? [firstFact.id] : [],
      timerDuration: room.settings.timePerRound,
    };
  },

  handleAction(room: Room, playerId: string, action: GameAction): StateUpdate | null {
    const state = room.gameState as MatchGameState;

    if (action.type !== 'submit_guess') return null;
    if (state.phase !== 'guessing') return null;
    if (state.guesses[playerId]) return null;
    if (playerId === state.currentFactAuthorId) return null;

    const guessedId = action.payload?.guessedId;
    if (!guessedId || !room.players.has(guessedId)) return null;

    state.guesses[playerId] = guessedId;

    if (shouldAutoAdvance(state, room)) {
      return this.advance(room);
    }

    return { gameState: state };
  },

  advance(room: Room): StateUpdate {
    const state = room.gameState as MatchGameState;

    switch (state.phase) {
      case 'guessing': {
        const result = calculateRoundResults(room, state);
        state.roundResults.push(result);
        state.phase = 'reveal';
        state.timerDuration = 10;
        return {
          gameState: state,
          events: [{ type: 'round_results', data: result }],
        };
      }

      case 'reveal': {
        if (state.currentRound >= state.totalRounds) {
          state.phase = 'final';
          state.timerDuration = null;
          return { gameState: state };
        }

        state.currentRound++;
        const nextFact = pickNextFact(room, state.usedTextIds);
        if (!nextFact) {
          state.phase = 'final';
          state.timerDuration = null;
          return { gameState: state };
        }

        state.currentFact = nextFact.content;
        state.currentFactAuthorId = nextFact.playerId;
        state.usedTextIds.push(nextFact.id);
        state.guesses = {};
        state.phase = 'guessing';
        state.timerDuration = room.settings.timePerRound;
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
    const state = room.gameState as MatchGameState;

    const base = {
      gameType: 'match',
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isConnected: p.isConnected,
      })),
    };

    switch (state.phase) {
      case 'guessing':
        return {
          ...base,
          fact: state.currentFact,
          guessedCount: Object.keys(state.guesses).length,
          totalGuessers: Array.from(room.players.values())
            .filter((p) => p.isConnected && p.id !== state.currentFactAuthorId).length,
        };

      case 'reveal':
        return {
          ...base,
          matchRoundResult: state.roundResults[state.roundResults.length - 1],
        };

      case 'final':
        return {
          ...base,
          allResults: state.roundResults,
          leaderboard: Array.from(room.players.values())
            .map((p) => ({ id: p.id, name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score),
        };

      default:
        return base;
    }
  },

  getPlayerView(room: Room, playerId: string): any {
    const state = room.gameState as MatchGameState;
    const player = room.players.get(playerId);

    const base = {
      gameType: 'match',
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      myScore: player?.score || 0,
    };

    switch (state.phase) {
      case 'guessing': {
        const isAuthor = playerId === state.currentFactAuthorId;
        return {
          ...base,
          fact: state.currentFact,
          isAuthor,
          hasGuessed: !!state.guesses[playerId],
          playerOptions: Array.from(room.players.values())
            .filter((p) => p.isConnected)
            .map((p) => ({ id: p.id, name: p.name })),
        };
      }

      case 'reveal':
        return {
          ...base,
          matchRoundResult: state.roundResults[state.roundResults.length - 1],
        };

      case 'final':
        return {
          ...base,
          allResults: state.roundResults,
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

export default matchGame;
