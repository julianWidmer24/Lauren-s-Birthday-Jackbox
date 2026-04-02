'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { Player, GameState, TimerState } from '@/types';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import PlayerList from '@/components/shared/PlayerList';
import Timer from '@/components/shared/Timer';
import Leaderboard from '@/components/shared/Leaderboard';
import ImageUpload from '@/components/shared/ImageUpload';
import FloralDecor from '@/components/shared/FloralDecor';

type RoomStatus = 'lobby' | 'playing' | 'finished';

export default function PlayerRoom() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const { emit, on, isConnected } = useSocket();

  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<RoomStatus>('lobby');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasReconnected = useRef(false);

  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null;
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') : null;

  // Reconnect on mount
  useEffect(() => {
    if (isConnected && !hasReconnected.current && playerId) {
      hasReconnected.current = true;
      emit('reconnect_player', { playerId, roomCode });
    }
  }, [isConnected, playerId, roomCode, emit]);

  useEffect(() => {
    const cleanups = [
      on('reconnect_success', (data: any) => {
        setPlayers(data.players);
        setStatus(data.roomStatus);
      }),
      on('reconnect_failed', () => {
        sessionStorage.removeItem('playerId');
        sessionStorage.removeItem('roomCode');
        router.push('/play');
      }),
      on('player_joined', (data: any) => {
        setPlayers(data.players);
      }),
      on('player_disconnected', (data: any) => {
        setPlayers(data.players);
      }),
      on('game_started', () => {
        setStatus('playing');
      }),
      on('game_state', (data: GameState) => {
        setGameState(data);
      }),
      on('timer_tick', (data: TimerState) => {
        setTimer(data);
      }),
      on('game_finished', () => {
        setStatus('finished');
      }),
      on('returned_to_lobby', (data: any) => {
        setStatus('lobby');
        setGameState(null);
        setTimer(null);
        setPlayers(data.room.players);
      }),
      on('host_disconnected', () => {
        setError('Host disconnected. Waiting for reconnect...');
      }),
      on('error', (data: any) => {
        setError(data.message);
        setTimeout(() => setError(null), 4000);
      }),
    ];
    return () => cleanups.forEach((c) => c());
  }, [on, router]);

  // ─── Game actions ───
  const submitCaption = useCallback((caption: string) => {
    emit('game_action', { type: 'submit_caption', payload: { caption } });
  }, [emit]);

  const submitVote = useCallback((votedFor: string) => {
    emit('game_action', { type: 'submit_vote', payload: { votedFor } });
  }, [emit]);

  const submitGuess = useCallback((guessedId: string) => {
    emit('game_action', { type: 'submit_guess', payload: { guessedId } });
  }, [emit]);

  const pickSide = useCallback((side: 'A' | 'B') => {
    emit('game_action', { type: 'pick_side', payload: { side } });
  }, [emit]);

  const submitArgument = useCallback((argument: string) => {
    emit('game_action', { type: 'submit_argument', payload: { argument } });
  }, [emit]);

  const voteArgument = useCallback((votedFor: string) => {
    emit('game_action', { type: 'vote_argument', payload: { votedFor } });
  }, [emit]);

  const submitText = useCallback((content: string, category: string) => {
    emit('submit_text', { content, category });
  }, [emit]);

  if (!playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-white/60">Session expired</p>
          <button onClick={() => router.push('/play')} className="btn-primary">
            Rejoin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <FloralDecor variant="compact" />
      <ConnectionStatus isConnected={isConnected} />

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-xl z-50 backdrop-blur-sm text-sm">
          {error}
        </div>
      )}

      {status === 'lobby' && (
        <PlayerLobby
          roomCode={roomCode}
          players={players}
          playerId={playerId}
          playerName={playerName || 'Player'}
          onSubmitText={submitText}
        />
      )}

      {status === 'playing' && gameState && (
        <PlayerGame
          gameState={gameState}
          timer={timer}
          playerId={playerId}
          onSubmitCaption={submitCaption}
          onSubmitVote={submitVote}
          onSubmitGuess={submitGuess}
          onPickSide={pickSide}
          onSubmitArgument={submitArgument}
          onVoteArgument={voteArgument}
        />
      )}

      {status === 'finished' && gameState && (
        <PlayerResults gameState={gameState} playerId={playerId} />
      )}
    </div>
  );
}

// ─── Lobby ───

function PlayerLobby({
  roomCode,
  players,
  playerId,
  playerName,
  onSubmitText,
}: {
  roomCode: string;
  players: Player[];
  playerId: string;
  playerName: string;
  onSubmitText: (content: string, category: string) => void;
}) {
  const [text, setText] = useState('');
  const [textCategory, setTextCategory] = useState('general');

  function handleSubmitText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmitText(trimmed, textCategory);
    setText('');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <p className="text-lg select-none mb-1">{'\u{1F338}'}</p>
          <p className="text-white/40 text-sm">Room</p>
          <p className="room-code-small">{roomCode}</p>
        </div>

        <div className="card">
          <h2 className="font-bold mb-3">Players</h2>
          <PlayerList players={players} compact />
        </div>

        <div className="card">
          <h2 className="font-bold mb-3">Upload Photos</h2>
          <p className="text-white/50 text-sm mb-3">
            Add photos that will be used in the game
          </p>
          <ImageUpload
            roomCode={roomCode}
            playerId={playerId}
            playerName={playerName}
          />
        </div>

        <div className="card">
          <h2 className="font-bold mb-3">Submit Text</h2>
          <div className="flex gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setTextCategory('general')}
              className={`text-xs px-3 py-1 rounded-lg transition-all ${
                textCategory === 'general'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/20'
              }`}
            >
              Fact / Quote
            </button>
            <button
              onClick={() => setTextCategory('debate')}
              className={`text-xs px-3 py-1 rounded-lg transition-all ${
                textCategory === 'debate'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/20'
              }`}
            >
              Debate Prompt
            </button>
            <button
              onClick={() => setTextCategory('mostlikely')}
              className={`text-xs px-3 py-1 rounded-lg transition-all ${
                textCategory === 'mostlikely'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/20'
              }`}
            >
              Most Likely To
            </button>
          </div>
          <p className="text-white/50 text-xs mb-2">
            {textCategory === 'debate'
              ? 'Format: Prompt | Side A | Side B'
              : textCategory === 'mostlikely'
              ? 'Write a "Most likely to..." prompt'
              : 'A fun fact or quote about yourself'}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder={
              textCategory === 'debate'
                ? 'Pineapple on pizza | Yes | No'
                : textCategory === 'mostlikely'
                ? 'Most likely to show up late to everything...'
                : 'I once met a celebrity at a grocery store...'
            }
            className="input-field h-16 resize-none text-sm"
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-white/40 text-xs">{text.length}/500</span>
            <button
              onClick={handleSubmitText}
              disabled={!text.trim()}
              className="btn-primary text-sm py-2 px-4"
            >
              Submit
            </button>
          </div>
        </div>

        <p className="text-center text-white/40 text-sm animate-gentle-pulse">
          {'\u{1F331}'} Waiting for host to start the game...
        </p>
      </div>
    </div>
  );
}

// ─── Game (all modes) ───

function PlayerGame({
  gameState,
  timer,
  playerId,
  onSubmitCaption,
  onSubmitVote,
  onSubmitGuess,
  onPickSide,
  onSubmitArgument,
  onVoteArgument,
}: {
  gameState: GameState;
  timer: TimerState | null;
  playerId: string;
  onSubmitCaption: (caption: string) => void;
  onSubmitVote: (votedFor: string) => void;
  onSubmitGuess: (guessedId: string) => void;
  onPickSide: (side: 'A' | 'B') => void;
  onSubmitArgument: (argument: string) => void;
  onVoteArgument: (votedFor: string) => void;
}) {
  const { gameType } = gameState;

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-white/60 text-sm">
          {gameType === 'tournament'
            ? `Bracket ${gameState.bracketRound}/${gameState.totalBracketRounds}`
            : `Round ${gameState.currentRound}/${gameState.totalRounds}`}
        </span>
        <span className="text-accent-400 font-mono font-bold">
          {gameState.myScore || 0} pts
        </span>
      </div>

      <Timer timer={timer} />

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        {gameType === 'caption' && (
          <CaptionPlayerPhase
            gameState={gameState}
            playerId={playerId}
            onSubmitCaption={onSubmitCaption}
            onSubmitVote={onSubmitVote}
          />
        )}
        {gameType === 'match' && (
          <MatchPlayerPhase
            gameState={gameState}
            playerId={playerId}
            onSubmitGuess={onSubmitGuess}
          />
        )}
        {gameType === 'debate' && (
          <DebatePlayerPhase
            gameState={gameState}
            playerId={playerId}
            onPickSide={onPickSide}
            onSubmitArgument={onSubmitArgument}
            onVoteArgument={onVoteArgument}
          />
        )}
        {gameType === 'tournament' && (
          <TournamentPlayerPhase
            gameState={gameState}
            playerId={playerId}
            onSubmitVote={onSubmitVote}
          />
        )}
        {gameType === 'mostlikely' && (
          <MostLikelyPlayerPhase
            gameState={gameState}
            playerId={playerId}
            onSubmitVote={onSubmitVote}
          />
        )}
      </div>
    </div>
  );
}

// ─── Caption Player Phases ───

function CaptionPlayerPhase({
  gameState,
  playerId,
  onSubmitCaption,
  onSubmitVote,
}: {
  gameState: GameState;
  playerId: string;
  onSubmitCaption: (caption: string) => void;
  onSubmitVote: (votedFor: string) => void;
}) {
  const { phase } = gameState;
  if (phase === 'captioning') return <PlayerCaptioning gameState={gameState} onSubmit={onSubmitCaption} />;
  if (phase === 'voting') return <PlayerVoting gameState={gameState} onVote={onSubmitVote} playerId={playerId} />;
  if (phase === 'reveal') return <PlayerCaptionReveal gameState={gameState} />;
  if (phase === 'final') return <PlayerFinal gameState={gameState} playerId={playerId} />;
  return null;
}

function PlayerCaptioning({
  gameState,
  onSubmit,
}: {
  gameState: GameState;
  onSubmit: (caption: string) => void;
}) {
  const [caption, setCaption] = useState('');

  if (gameState.hasSubmitted) {
    return (
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">Caption submitted!</p>
        <div className="card">
          <p className="text-white/70 italic">&ldquo;{gameState.myCaption}&rdquo;</p>
        </div>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Write a caption!</h2>
      {gameState.imageUrl && (
        <img
          src={gameState.imageUrl}
          alt="Caption this"
          className="w-full max-h-48 object-contain rounded-xl"
        />
      )}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 200))}
        placeholder="Type your caption..."
        className="input-field h-24 resize-none"
        maxLength={200}
        autoFocus
      />
      <div className="flex justify-between items-center">
        <span className="text-white/40 text-xs">{caption.length}/200</span>
        <button
          onClick={() => {
            if (caption.trim()) onSubmit(caption.trim());
          }}
          disabled={!caption.trim()}
          className="btn-primary"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function PlayerVoting({
  gameState,
  onVote,
  playerId,
}: {
  gameState: GameState;
  onVote: (votedFor: string) => void;
  playerId: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (gameState.hasVoted) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">Vote submitted!</p>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  const captions = gameState.captions || [];

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Vote for the best caption!</h2>
      {gameState.imageUrl && (
        <img
          src={gameState.imageUrl}
          alt="Vote"
          className="w-full max-h-32 object-contain rounded-xl"
        />
      )}
      <div className="space-y-2">
        {captions.map((c) => {
          const isMine = c.isMine;
          const isSelected = selected === c.playerId;

          return (
            <button
              key={c.playerId}
              onClick={() => {
                if (!isMine) setSelected(c.playerId);
              }}
              disabled={isMine}
              className={`w-full text-left ${
                isMine
                  ? 'vote-card vote-card-disabled'
                  : isSelected
                  ? 'vote-card vote-card-selected'
                  : 'vote-card'
              }`}
            >
              <p className="text-base">{c.caption}</p>
              {isMine && <p className="text-xs text-white/30 mt-1">Your caption</p>}
            </button>
          );
        })}
      </div>

      {selected && (
        <button onClick={() => onVote(selected)} className="btn-primary w-full">
          Confirm Vote
        </button>
      )}
    </div>
  );
}

function PlayerCaptionReveal({ gameState }: { gameState: GameState }) {
  const result = gameState.roundResult;
  if (!result) return null;

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Round Results</h2>
      <div className="space-y-2">
        {result.captions.map((c, i) => (
          <div
            key={i}
            className={`card flex justify-between items-center
              ${i === 0 && c.votes > 0 ? 'ring-1 ring-accent-400' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{c.caption}</p>
              <p className="text-xs text-white/40">{c.playerName}</p>
            </div>
            <span className="text-accent-400 font-bold ml-2 shrink-0">+{c.votes * 100}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Match Player Phases ───

function MatchPlayerPhase({
  gameState,
  playerId,
  onSubmitGuess,
}: {
  gameState: GameState;
  playerId: string;
  onSubmitGuess: (guessedId: string) => void;
}) {
  const { phase } = gameState;
  if (phase === 'guessing') return <PlayerGuessing gameState={gameState} onGuess={onSubmitGuess} />;
  if (phase === 'reveal') return <PlayerMatchReveal gameState={gameState} />;
  if (phase === 'final') return <PlayerFinal gameState={gameState} playerId={playerId} />;
  return null;
}

function PlayerGuessing({
  gameState,
  onGuess,
}: {
  gameState: GameState;
  onGuess: (guessedId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (gameState.isAuthor) {
    return (
      <div className="text-center space-y-4 max-w-sm w-full">
        <p className="text-xl font-bold">This is your fact!</p>
        <div className="card">
          <p className="text-white/70 italic">&ldquo;{gameState.fact}&rdquo;</p>
        </div>
        <p className="text-white/40 text-sm animate-gentle-pulse">
          {'\u{1F33F}'} Waiting for others to guess...
        </p>
      </div>
    );
  }

  if (gameState.hasGuessed) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">Guess submitted!</p>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  const players = gameState.playerOptions || [];

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Who said it?</h2>
      <div className="card">
        <p className="text-lg italic text-center">&ldquo;{gameState.fact}&rdquo;</p>
      </div>
      <div className="space-y-2">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`w-full text-left ${
              selected === p.id ? 'vote-card vote-card-selected' : 'vote-card'
            }`}
          >
            <p className="text-base font-medium">{p.name}</p>
          </button>
        ))}
      </div>
      {selected && (
        <button onClick={() => onGuess(selected)} className="btn-primary w-full">
          Confirm Guess
        </button>
      )}
    </div>
  );
}

function PlayerMatchReveal({ gameState }: { gameState: GameState }) {
  const result = gameState.matchRoundResult;
  if (!result) return null;

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">It was {result.authorName}!</h2>
      <div className="card">
        <p className="italic text-center">&ldquo;{result.fact}&rdquo;</p>
      </div>
      <div className="space-y-2">
        {result.guesses.map((g, i) => (
          <div
            key={i}
            className={`card flex justify-between items-center text-sm ${
              g.correct ? 'ring-1 ring-green-400 bg-green-500/10' : ''
            }`}
          >
            <div>
              <p className="font-medium">{g.playerName}</p>
              <p className="text-xs text-white/40">guessed {g.guessedName}</p>
            </div>
            <span className={`font-bold ${g.correct ? 'text-green-400' : 'text-red-400'}`}>
              {g.correct ? '+100' : '+0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Debate Player Phases ───

function DebatePlayerPhase({
  gameState,
  playerId,
  onPickSide,
  onSubmitArgument,
  onVoteArgument,
}: {
  gameState: GameState;
  playerId: string;
  onPickSide: (side: 'A' | 'B') => void;
  onSubmitArgument: (argument: string) => void;
  onVoteArgument: (votedFor: string) => void;
}) {
  const { phase } = gameState;
  if (phase === 'picking') return <PlayerDebatePicking gameState={gameState} onPick={onPickSide} />;
  if (phase === 'arguing') return <PlayerDebateArguing gameState={gameState} onSubmit={onSubmitArgument} />;
  if (phase === 'voting') return <PlayerDebateVoting gameState={gameState} onVote={onVoteArgument} playerId={playerId} />;
  if (phase === 'reveal') return <PlayerDebateReveal gameState={gameState} />;
  if (phase === 'final') return <PlayerFinal gameState={gameState} playerId={playerId} />;
  return null;
}

function PlayerDebatePicking({
  gameState,
  onPick,
}: {
  gameState: GameState;
  onPick: (side: 'A' | 'B') => void;
}) {
  if (gameState.hasPicked) {
    return (
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">
          You picked: {gameState.myPick === 'A' ? gameState.sideA : gameState.sideB}
        </p>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Pick a side!</h2>
      <div className="card">
        <p className="text-lg text-center">{gameState.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onPick('A')} className="vote-card text-center py-6">
          <p className="text-lg font-bold">{gameState.sideA}</p>
        </button>
        <button onClick={() => onPick('B')} className="vote-card text-center py-6">
          <p className="text-lg font-bold">{gameState.sideB}</p>
        </button>
      </div>
    </div>
  );
}

function PlayerDebateArguing({
  gameState,
  onSubmit,
}: {
  gameState: GameState;
  onSubmit: (argument: string) => void;
}) {
  const [argument, setArgument] = useState('');

  if (gameState.hasSubmitted) {
    return (
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">Argument submitted!</p>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  const mySideLabel = gameState.mySide === 'A' ? gameState.sideA : gameState.sideB;

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Make your case!</h2>
      <div className="card text-center">
        <p className="text-white/50 text-sm">{gameState.prompt}</p>
        <p className="text-lg font-bold mt-2">Your side: {mySideLabel}</p>
      </div>
      <textarea
        value={argument}
        onChange={(e) => setArgument(e.target.value.slice(0, 300))}
        placeholder="Why your side is right..."
        className="input-field h-24 resize-none"
        maxLength={300}
        autoFocus
      />
      <div className="flex justify-between items-center">
        <span className="text-white/40 text-xs">{argument.length}/300</span>
        <button
          onClick={() => {
            if (argument.trim()) onSubmit(argument.trim());
          }}
          disabled={!argument.trim()}
          className="btn-primary"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function PlayerDebateVoting({
  gameState,
  onVote,
  playerId,
}: {
  gameState: GameState;
  onVote: (votedFor: string) => void;
  playerId: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (gameState.hasVoted) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">Vote submitted!</p>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  const args = gameState.arguments || [];

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Vote for the best argument!</h2>
      <div className="space-y-2">
        {args.map((a) => {
          const isMine = a.isMine;
          const isSelected = selected === a.playerId;

          return (
            <button
              key={a.playerId}
              onClick={() => {
                if (!isMine) setSelected(a.playerId);
              }}
              disabled={isMine}
              className={`w-full text-left ${
                isMine
                  ? 'vote-card vote-card-disabled'
                  : isSelected
                  ? 'vote-card vote-card-selected'
                  : 'vote-card'
              }`}
            >
              <span className={`text-xs font-bold uppercase tracking-wide ${
                a.side === 'A' ? 'text-primary-300' : 'text-accent-400'
              }`}>
                {a.side === 'A' ? gameState.sideA : gameState.sideB}
              </span>
              <p className="text-base mt-1">{a.argument}</p>
              {isMine && <p className="text-xs text-white/30 mt-1">Your argument</p>}
            </button>
          );
        })}
      </div>
      {selected && (
        <button onClick={() => onVote(selected)} className="btn-primary w-full">
          Confirm Vote
        </button>
      )}
    </div>
  );
}

function PlayerDebateReveal({ gameState }: { gameState: GameState }) {
  const result = gameState.debateRoundResult;
  if (!result) return null;

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Results</h2>
      <p className="text-center text-white/50 text-sm">{result.prompt}</p>
      <div className="flex gap-3 justify-center text-sm">
        <span className="text-primary-300">{result.sideA}: {result.sideAPickers.length}</span>
        <span className="text-accent-400">{result.sideB}: {result.sideBPickers.length}</span>
      </div>
      <div className="space-y-2">
        {result.arguments.map((a, i) => (
          <div
            key={i}
            className={`card flex justify-between items-center
              ${i === 0 && a.votes > 0 ? 'ring-1 ring-accent-400' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <span className={`text-xs font-bold ${
                a.side === 'A' ? 'text-primary-300' : 'text-accent-400'
              }`}>
                {a.side === 'A' ? result.sideA : result.sideB}
              </span>
              <p className="text-sm truncate">{a.argument}</p>
              <p className="text-xs text-white/40">{a.playerName}</p>
            </div>
            <span className="text-accent-400 font-bold ml-2 shrink-0">+{a.votes * 100}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tournament Player Phases ───

function TournamentPlayerPhase({
  gameState,
  playerId,
  onSubmitVote,
}: {
  gameState: GameState;
  playerId: string;
  onSubmitVote: (votedFor: string) => void;
}) {
  const { phase } = gameState;
  if (phase === 'voting') return <PlayerTournamentVoting gameState={gameState} onVote={onSubmitVote} />;
  if (phase === 'result') return <PlayerTournamentResult gameState={gameState} />;
  if (phase === 'final') return <PlayerTournamentFinal gameState={gameState} playerId={playerId} />;
  return null;
}

function PlayerTournamentVoting({
  gameState,
  onVote,
}: {
  gameState: GameState;
  onVote: (votedFor: string) => void;
}) {
  const matchup = gameState.matchup;
  if (!matchup) return null;

  if (gameState.hasVoted) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">Vote submitted!</p>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">
        Pick your favorite!
      </h2>
      <p className="text-center text-white/40 text-xs">
        Matchup {gameState.matchupNumber} of {gameState.totalMatchups}
      </p>
      <div className="space-y-3">
        <button
          onClick={() => onVote(matchup.imageA.id)}
          className="vote-card w-full text-center"
        >
          <img
            src={matchup.imageA.url}
            alt="Photo A"
            className="w-full max-h-36 object-contain rounded-lg"
          />
          <p className="text-white/50 text-xs mt-2">by {matchup.imageA.playerName}</p>
        </button>
        <button
          onClick={() => onVote(matchup.imageB.id)}
          className="vote-card w-full text-center"
        >
          <img
            src={matchup.imageB.url}
            alt="Photo B"
            className="w-full max-h-36 object-contain rounded-lg"
          />
          <p className="text-white/50 text-xs mt-2">by {matchup.imageB.playerName}</p>
        </button>
      </div>
    </div>
  );
}

function PlayerTournamentResult({ gameState }: { gameState: GameState }) {
  const matchup = gameState.matchup;
  const result = gameState.matchupResult;
  if (!matchup || !result) return null;

  return (
    <div className="space-y-4 max-w-sm w-full text-center">
      <h2 className="text-xl font-bold">Winner!</h2>
      <img
        src={result.winnerUrl}
        alt="Winner"
        className="w-full max-h-48 object-contain rounded-xl"
      />
      <p className="text-white/50 text-sm">by {result.winnerPlayerName}</p>
      <p className="text-white/40 text-sm">
        {result.votesA} vs {result.votesB}
      </p>
    </div>
  );
}

function PlayerTournamentFinal({ gameState, playerId }: { gameState: GameState; playerId: string }) {
  return (
    <div className="space-y-6 max-w-sm w-full text-center">
      <h2 className="text-3xl font-black bg-gradient-to-r from-accent-400 to-primary-400 bg-clip-text text-transparent">
        Champion!
      </h2>
      {gameState.winnerUrl && (
        <img
          src={gameState.winnerUrl}
          alt="Champion"
          className="w-full max-h-48 object-contain rounded-xl"
        />
      )}
      {gameState.winnerPlayerName && (
        <p className="text-lg">
          Photo by <span className="text-accent-400 font-bold">{gameState.winnerPlayerName}</span>
        </p>
      )}
      {gameState.myRank && (
        <p className="text-lg">
          You placed <span className="text-accent-400 font-bold">#{gameState.myRank}</span> with{' '}
          <span className="font-bold">{gameState.myScore} points</span>
        </p>
      )}
      {gameState.leaderboard && (
        <Leaderboard
          entries={gameState.leaderboard}
          highlightId={playerId}
          title="Player Scores"
        />
      )}
    </div>
  );
}

// ─── Most Likely To Player Phases ───

function MostLikelyPlayerPhase({
  gameState,
  playerId,
  onSubmitVote,
}: {
  gameState: GameState;
  playerId: string;
  onSubmitVote: (votedFor: string) => void;
}) {
  const { phase } = gameState;
  if (phase === 'voting') return <PlayerMostLikelyVoting gameState={gameState} onVote={onSubmitVote} />;
  if (phase === 'reveal') return <PlayerMostLikelyReveal gameState={gameState} />;
  if (phase === 'final') return <PlayerFinal gameState={gameState} playerId={playerId} />;
  return null;
}

function PlayerMostLikelyVoting({
  gameState,
  onVote,
}: {
  gameState: GameState;
  onVote: (votedFor: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (gameState.hasVoted) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-400 text-5xl">&#10003;</div>
        <p className="text-xl font-bold">Vote submitted!</p>
        <p className="text-white/40 text-sm animate-gentle-pulse">{'\u{1F33F}'} Waiting for other players...</p>
      </div>
    );
  }

  const players = gameState.playerOptions || [];

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Most Likely To...</h2>
      <div className="card">
        <p className="text-lg text-center">{gameState.prompt}</p>
      </div>
      <div className="space-y-2">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`w-full text-left ${
              selected === p.id ? 'vote-card vote-card-selected' : 'vote-card'
            }`}
          >
            <p className="text-base font-medium">{p.name}</p>
          </button>
        ))}
      </div>
      {selected && (
        <button onClick={() => onVote(selected)} className="btn-primary w-full">
          Confirm Vote
        </button>
      )}
    </div>
  );
}

function PlayerMostLikelyReveal({ gameState }: { gameState: GameState }) {
  const result = gameState.mostLikelyResult;
  if (!result) return null;

  return (
    <div className="space-y-4 max-w-sm w-full">
      <h2 className="text-xl font-bold text-center">Most Likely To...</h2>
      <div className="card">
        <p className="text-center">{result.prompt}</p>
      </div>
      {result.winner && (
        <div className="text-center space-y-1">
          <p className="text-2xl font-black text-accent-400">{result.winner.playerName}</p>
          <p className="text-white/50 text-sm">
            {result.winner.voteCount} vote{result.winner.voteCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
      <div className="space-y-1">
        {result.votes.map((v, i) => (
          <div key={i} className="card flex justify-between items-center text-sm py-2">
            <span className="text-white/60">{v.voterName}</span>
            <span className="font-medium">{v.votedForName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared Final ───

function PlayerFinal({ gameState, playerId }: { gameState: GameState; playerId: string }) {
  if (!gameState.leaderboard) return null;

  return (
    <div className="space-y-6 max-w-sm w-full text-center">
      <p className="text-2xl select-none">{'\u{1F338}\u{1F33F}\u{1F338}'}</p>
      <h2 className="text-3xl font-black bg-gradient-to-r from-accent-400 to-primary-400 bg-clip-text text-transparent">
        Game Over!
      </h2>
      {gameState.myRank && (
        <p className="text-lg">
          You placed <span className="text-accent-400 font-bold">#{gameState.myRank}</span> with{' '}
          <span className="font-bold">{gameState.myScore} points</span>
        </p>
      )}
      <Leaderboard
        entries={gameState.leaderboard}
        highlightId={playerId}
        title="Final Standings"
      />
    </div>
  );
}

// ─── Finished (post-game wrapper) ───

function PlayerResults({ gameState, playerId }: { gameState: GameState; playerId: string }) {
  const isTournament = gameState.gameType === 'tournament';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {isTournament ? (
        <PlayerTournamentFinal gameState={gameState} playerId={playerId} />
      ) : (
        <PlayerFinal gameState={gameState} playerId={playerId} />
      )}
      <p className="text-white/40 text-sm mt-6 animate-gentle-pulse">
        {'\u{1F33F}'} Waiting for host... {'\u{1F33F}'}
      </p>
    </div>
  );
}
