import { GameModule, GameAction, StateUpdate, StartCheck } from '../../engine/types';
import { Room } from '../../rooms/types';
import { MostLikelyGameState } from './types';
import { pickNextPrompt, calculateRoundResults, shouldAutoAdvance } from './logic';

const mostLikelyGame: GameModule = {
  id: 'mostlikely',
  name: 'Most Likely To',
  description: 'Vote on which player is most likely to do something -- use pre-made or player-submitted prompts',
  minPlayers: 3,
  maxPlayers: 12,

  canStart(room: Room): StartCheck {
    const playerCount = room.players.size;
    if (playerCount < this.minPlayers) {
      return { ok: false, reason: `Need at least ${this.minPlayers} players (have ${playerCount})` };
    }
    const prompts = room.content.texts.filter((t) => t.category === 'mostlikely');
    if (prompts.length < 3) {
      return { ok: false, reason: 'Need at least 3 "Most Likely To" prompts to play' };
    }
    return { ok: true };
  },

  init(room: Room): MostLikelyGameState {
    const prompts = room.content.texts.filter((t) => t.category === 'mostlikely');
    const maxRounds = Math.min(room.settings.roundCount, prompts.length);
    const firstPrompt = pickNextPrompt(room, []);

    const isHostPrompt = firstPrompt?.playerId === 'host';

    return {
      phase: 'voting',
      currentRound: 1,
      totalRounds: maxRounds,
      currentPrompt: firstPrompt?.content || null,
      currentPromptSource: isHostPrompt ? 'host' : 'player',
      currentPromptAuthorName: isHostPrompt
        ? null
        : (room.players.get(firstPrompt?.playerId || '')?.name || null),
      votes: {},
      roundResults: [],
      usedTextIds: firstPrompt ? [firstPrompt.id] : [],
      timerDuration: room.settings.timePerRound,
    };
  },

  handleAction(room: Room, playerId: string, action: GameAction): StateUpdate | null {
    const state = room.gameState as MostLikelyGameState;

    if (action.type !== 'submit_vote') return null;
    if (state.phase !== 'voting') return null;
    if (state.votes[playerId]) return null;

    const votedForId = action.payload?.votedFor;
    if (!votedForId || !room.players.has(votedForId)) return null;

    state.votes[playerId] = votedForId;

    if (shouldAutoAdvance(state, room)) {
      return this.advance(room);
    }

    return { gameState: state };
  },

  advance(room: Room): StateUpdate {
    const state = room.gameState as MostLikelyGameState;

    switch (state.phase) {
      case 'voting': {
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
        const nextPrompt = pickNextPrompt(room, state.usedTextIds);
        if (!nextPrompt) {
          state.phase = 'final';
          state.timerDuration = null;
          return { gameState: state };
        }

        const isHostPrompt = nextPrompt.playerId === 'host';
        state.currentPrompt = nextPrompt.content;
        state.currentPromptSource = isHostPrompt ? 'host' : 'player';
        state.currentPromptAuthorName = isHostPrompt
          ? null
          : (room.players.get(nextPrompt.playerId)?.name || null);
        state.usedTextIds.push(nextPrompt.id);
        state.votes = {};
        state.phase = 'voting';
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
    const state = room.gameState as MostLikelyGameState;

    const base = {
      gameType: 'mostlikely',
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
      case 'voting': {
        // Build live tally: who has votes and how many
        const tally: Record<string, number> = {};
        Object.values(state.votes).forEach((targetId) => {
          tally[targetId] = (tally[targetId] || 0) + 1;
        });

        return {
          ...base,
          prompt: state.currentPrompt,
          promptSource: state.currentPromptSource,
          promptAuthorName: state.currentPromptAuthorName,
          votedCount: Object.keys(state.votes).length,
          totalVoters: Array.from(room.players.values()).filter((p) => p.isConnected).length,
          voteTally: Array.from(room.players.values())
            .filter((p) => p.isConnected)
            .map((p) => ({
              id: p.id,
              name: p.name,
              votes: tally[p.id] || 0,
            }))
            .sort((a, b) => b.votes - a.votes),
        };
      }

      case 'reveal': {
        return {
          ...base,
          mostLikelyResult: state.roundResults[state.roundResults.length - 1],
        };
      }

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
    const state = room.gameState as MostLikelyGameState;
    const player = room.players.get(playerId);

    const base = {
      gameType: 'mostlikely',
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      myScore: player?.score || 0,
    };

    switch (state.phase) {
      case 'voting':
        return {
          ...base,
          prompt: state.currentPrompt,
          promptSource: state.currentPromptSource,
          hasVoted: !!state.votes[playerId],
          playerOptions: Array.from(room.players.values())
            .filter((p) => p.isConnected)
            .map((p) => ({ id: p.id, name: p.name })),
        };

      case 'reveal':
        return {
          ...base,
          mostLikelyResult: state.roundResults[state.roundResults.length - 1],
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

export default mostLikelyGame;
