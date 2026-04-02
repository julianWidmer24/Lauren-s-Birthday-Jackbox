import { GameModule, GameAction, StateUpdate, StartCheck } from '../../engine/types';
import { Room } from '../../rooms/types';
import { DebateGameState } from './types';
import { pickNextPrompt, parsePrompt, calculateRoundResults, shouldAutoAdvance } from './logic';

const debateGame: GameModule = {
  id: 'debate',
  name: 'Hot Take',
  description: 'Pick a side on spicy prompts, then argue your case',
  minPlayers: 2,
  maxPlayers: 12,

  canStart(room: Room): StartCheck {
    const playerCount = room.players.size;
    if (playerCount < this.minPlayers) {
      return { ok: false, reason: `Need at least ${this.minPlayers} players (have ${playerCount})` };
    }
    const debateTexts = room.content.texts.filter((t) => t.category === 'debate');
    if (debateTexts.length < 1) {
      return { ok: false, reason: 'Need at least 1 debate prompt to play' };
    }
    return { ok: true };
  },

  init(room: Room): DebateGameState {
    const debateTexts = room.content.texts.filter((t) => t.category === 'debate');
    const maxRounds = Math.min(room.settings.roundCount, debateTexts.length);
    const firstPrompt = pickNextPrompt(room, []);
    const parsed = firstPrompt ? parsePrompt(firstPrompt.content) : { prompt: '', sideA: 'Yes', sideB: 'No' };

    return {
      phase: 'picking',
      currentRound: 1,
      totalRounds: maxRounds,
      currentPrompt: parsed.prompt,
      sideA: parsed.sideA,
      sideB: parsed.sideB,
      picks: {},
      arguments: {},
      argumentVotes: {},
      roundResults: [],
      usedTextIds: firstPrompt ? [firstPrompt.id] : [],
      timerDuration: 15,
    };
  },

  handleAction(room: Room, playerId: string, action: GameAction): StateUpdate | null {
    const state = room.gameState as DebateGameState;

    switch (action.type) {
      case 'pick_side': {
        if (state.phase !== 'picking') return null;
        if (state.picks[playerId]) return null;

        const side = action.payload?.side;
        if (side !== 'A' && side !== 'B') return null;

        state.picks[playerId] = side;

        if (shouldAutoAdvance(state, room)) {
          return this.advance(room);
        }
        return { gameState: state };
      }

      case 'submit_argument': {
        if (state.phase !== 'arguing') return null;
        if (state.arguments[playerId]) return null;

        const argument = (action.payload?.argument || '').trim();
        if (!argument || argument.length > 300) return null;

        state.arguments[playerId] = argument;

        if (shouldAutoAdvance(state, room)) {
          return this.advance(room);
        }
        return { gameState: state };
      }

      case 'vote_argument': {
        if (state.phase !== 'voting') return null;
        if (state.argumentVotes[playerId]) return null;

        const votedFor = action.payload?.votedFor;
        if (!votedFor || votedFor === playerId) return null;
        if (!state.arguments[votedFor]) return null;

        state.argumentVotes[playerId] = votedFor;

        if (shouldAutoAdvance(state, room)) {
          return this.advance(room);
        }
        return { gameState: state };
      }

      default:
        return null;
    }
  },

  advance(room: Room): StateUpdate {
    const state = room.gameState as DebateGameState;

    switch (state.phase) {
      case 'picking': {
        state.phase = 'arguing';
        state.timerDuration = room.settings.timePerRound;
        return { gameState: state };
      }

      case 'arguing': {
        const argCount = Object.keys(state.arguments).length;
        if (argCount < 2) {
          // Not enough arguments to vote — skip to reveal
          state.phase = 'reveal';
          state.timerDuration = 8;
          state.roundResults.push({
            round: state.currentRound,
            prompt: state.currentPrompt!,
            sideA: state.sideA!,
            sideB: state.sideB!,
            sideAPickers: Object.entries(state.picks)
              .filter(([, s]) => s === 'A')
              .map(([pid]) => room.players.get(pid)?.name || 'Unknown'),
            sideBPickers: Object.entries(state.picks)
              .filter(([, s]) => s === 'B')
              .map(([pid]) => room.players.get(pid)?.name || 'Unknown'),
            arguments: Object.entries(state.arguments).map(([pid, arg]) => ({
              playerId: pid,
              playerName: room.players.get(pid)?.name || 'Unknown',
              side: state.picks[pid] || 'A',
              argument: arg,
              votes: 0,
              voters: [],
            })),
          });
          return { gameState: state };
        }

        state.phase = 'voting';
        state.timerDuration = room.settings.timePerVote;
        return { gameState: state };
      }

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

        const parsed = parsePrompt(nextPrompt.content);
        state.currentPrompt = parsed.prompt;
        state.sideA = parsed.sideA;
        state.sideB = parsed.sideB;
        state.usedTextIds.push(nextPrompt.id);
        state.picks = {};
        state.arguments = {};
        state.argumentVotes = {};
        state.phase = 'picking';
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
    const state = room.gameState as DebateGameState;

    const base = {
      gameType: 'debate',
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      prompt: state.currentPrompt,
      sideA: state.sideA,
      sideB: state.sideB,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isConnected: p.isConnected,
      })),
    };

    switch (state.phase) {
      case 'picking': {
        const sideACount = Object.values(state.picks).filter((s) => s === 'A').length;
        const sideBCount = Object.values(state.picks).filter((s) => s === 'B').length;
        return {
          ...base,
          pickedCount: Object.keys(state.picks).length,
          totalPickers: Array.from(room.players.values()).filter((p) => p.isConnected).length,
          sideACount,
          sideBCount,
        };
      }

      case 'arguing':
        return {
          ...base,
          submittedCount: Object.keys(state.arguments).length,
          totalPlayers: Array.from(room.players.values()).filter((p) => p.isConnected).length,
          sideACount: Object.values(state.picks).filter((s) => s === 'A').length,
          sideBCount: Object.values(state.picks).filter((s) => s === 'B').length,
        };

      case 'voting':
        return {
          ...base,
          arguments: Object.entries(state.arguments).map(([pid, arg]) => ({
            playerId: pid,
            argument: arg,
            side: state.picks[pid],
          })),
          votedCount: Object.keys(state.argumentVotes).length,
          totalVoters: Object.keys(state.arguments).length,
        };

      case 'reveal':
        return {
          ...base,
          debateRoundResult: state.roundResults[state.roundResults.length - 1],
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
    const state = room.gameState as DebateGameState;
    const player = room.players.get(playerId);

    const base = {
      gameType: 'debate',
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      prompt: state.currentPrompt,
      sideA: state.sideA,
      sideB: state.sideB,
      myScore: player?.score || 0,
    };

    switch (state.phase) {
      case 'picking':
        return {
          ...base,
          hasPicked: !!state.picks[playerId],
          myPick: state.picks[playerId] || null,
        };

      case 'arguing':
        return {
          ...base,
          mySide: state.picks[playerId] || null,
          hasSubmitted: !!state.arguments[playerId],
          myArgument: state.arguments[playerId] || null,
        };

      case 'voting':
        return {
          ...base,
          arguments: Object.entries(state.arguments).map(([pid, arg]) => ({
            playerId: pid,
            argument: arg,
            side: state.picks[pid],
            isMine: pid === playerId,
          })),
          hasVoted: !!state.argumentVotes[playerId],
          myVote: state.argumentVotes[playerId] || null,
        };

      case 'reveal':
        return {
          ...base,
          debateRoundResult: state.roundResults[state.roundResults.length - 1],
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

export default debateGame;
