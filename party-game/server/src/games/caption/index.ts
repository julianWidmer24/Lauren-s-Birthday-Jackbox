import { GameModule, GameAction, StateUpdate, StartCheck } from '../../engine/types';
import { Room } from '../../rooms/types';
import { CaptionGameState } from './types';
import { pickNextImage, calculateRoundResults, getImageUrl, shouldAutoAdvance } from './logic';

const captionGame: GameModule = {
  id: 'caption',
  name: 'Caption This',
  description: 'Write the funniest caption for player-submitted photos. Vote for your favorites!',
  minPlayers: 2,
  maxPlayers: 12,

  canStart(room: Room): StartCheck {
    const playerCount = room.players.size;
    if (playerCount < this.minPlayers) {
      return { ok: false, reason: `Need at least ${this.minPlayers} players (have ${playerCount})` };
    }
    if (room.content.images.length === 0) {
      return { ok: false, reason: 'Need at least 1 uploaded image to play' };
    }
    return { ok: true };
  },

  init(room: Room): CaptionGameState {
    const maxRounds = Math.min(room.settings.roundCount, room.content.images.length);
    const firstImage = pickNextImage(room, []);

    return {
      phase: 'captioning',
      currentRound: 1,
      totalRounds: maxRounds,
      currentImageId: firstImage?.id || null,
      currentImageUrl: firstImage ? getImageUrl(firstImage) : null,
      currentImageAuthor: firstImage
        ? (room.players.get(firstImage.playerId)?.name || 'the host')
        : null,
      captions: {},
      votes: {},
      roundResults: [],
      usedImageIds: firstImage ? [firstImage.id] : [],
      timerDuration: room.settings.timePerRound,
    };
  },

  handleAction(room: Room, playerId: string, action: GameAction): StateUpdate | null {
    const state = room.gameState as CaptionGameState;

    switch (action.type) {
      case 'submit_caption': {
        if (state.phase !== 'captioning') return null;
        if (state.captions[playerId]) return null; // Already submitted

        const caption = (action.payload?.caption || '').trim();
        if (!caption || caption.length > 200) return null;

        state.captions[playerId] = caption;

        // Check if all connected players have submitted
        if (shouldAutoAdvance(state, room)) {
          return this.advance(room);
        }

        return { gameState: state };
      }

      case 'submit_vote': {
        if (state.phase !== 'voting') return null;
        if (state.votes[playerId]) return null; // Already voted

        const votedFor = action.payload?.votedFor;
        if (!votedFor || votedFor === playerId) return null; // Can't vote for self
        if (!state.captions[votedFor]) return null; // Invalid target

        state.votes[playerId] = votedFor;

        // Check if all eligible voters have voted
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
    const state = room.gameState as CaptionGameState;

    switch (state.phase) {
      case 'captioning': {
        // Move to voting
        // If fewer than 2 captions, skip voting and go to reveal with no scores
        const captionCount = Object.keys(state.captions).length;
        if (captionCount < 2) {
          // Not enough captions to vote — skip to reveal
          state.phase = 'reveal';
          state.timerDuration = 8;
          state.roundResults.push({
            round: state.currentRound,
            imageId: state.currentImageId!,
            captions: Object.entries(state.captions).map(([pid, caption]) => ({
              playerId: pid,
              playerName: room.players.get(pid)?.name || 'Unknown',
              caption,
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
        // Calculate results and move to reveal
        const result = calculateRoundResults(room, state);
        state.roundResults.push(result);
        state.phase = 'reveal';
        state.timerDuration = 10; // Show results for 10 seconds
        return {
          gameState: state,
          events: [{ type: 'round_results', data: result }],
        };
      }

      case 'reveal': {
        // Move to next round or final
        if (state.currentRound >= state.totalRounds) {
          state.phase = 'final';
          state.timerDuration = null;
          return { gameState: state };
        }

        // Next round
        state.currentRound++;
        const nextImage = pickNextImage(room, state.usedImageIds);
        if (!nextImage) {
          state.phase = 'final';
          state.timerDuration = null;
          return { gameState: state };
        }

        state.currentImageId = nextImage.id;
        state.currentImageUrl = getImageUrl(nextImage);
        state.currentImageAuthor = room.players.get(nextImage.playerId)?.name || 'the host';
        state.usedImageIds.push(nextImage.id);
        state.captions = {};
        state.votes = {};
        state.phase = 'captioning';
        state.timerDuration = room.settings.timePerRound;
        return { gameState: state };
      }

      default:
        return { gameState: state };
    }
  },

  onTimerExpired(room: Room): StateUpdate {
    // Timer expired — force advance to next phase
    return this.advance(room);
  },

  getHostView(room: Room): any {
    const state = room.gameState as CaptionGameState;

    const base = {
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      imageUrl: state.currentImageUrl,
      imageAuthor: state.currentImageAuthor,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isConnected: p.isConnected,
      })),
    };

    switch (state.phase) {
      case 'captioning':
        return {
          ...base,
          submittedCount: Object.keys(state.captions).length,
          totalPlayers: Array.from(room.players.values()).filter((p) => p.isConnected).length,
        };

      case 'voting':
        return {
          ...base,
          captions: Object.entries(state.captions).map(([playerId, caption]) => ({
            playerId,
            caption,
          })),
          votedCount: Object.keys(state.votes).length,
          totalVoters: Object.keys(state.captions).length,
        };

      case 'reveal':
        return {
          ...base,
          roundResult: state.roundResults[state.roundResults.length - 1],
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
    const state = room.gameState as CaptionGameState;
    const player = room.players.get(playerId);

    const base = {
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      imageUrl: state.currentImageUrl,
      imageAuthor: state.currentImageAuthor,
      myScore: player?.score || 0,
    };

    switch (state.phase) {
      case 'captioning':
        return {
          ...base,
          hasSubmitted: !!state.captions[playerId],
          myCaption: state.captions[playerId] || null,
        };

      case 'voting':
        return {
          ...base,
          captions: Object.entries(state.captions)
            .map(([pid, caption]) => ({
              playerId: pid,
              caption,
              isMine: pid === playerId,
            })),
          hasVoted: !!state.votes[playerId],
          myVote: state.votes[playerId] || null,
        };

      case 'reveal':
        return {
          ...base,
          roundResult: state.roundResults[state.roundResults.length - 1],
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

  cleanup(_room: Room): void {
    // No cleanup needed for in-memory state
  },
};

export default captionGame;
