'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { Player, GameState, GameInfo, TimerState } from '@/types';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import PlayerList from '@/components/shared/PlayerList';
import Timer from '@/components/shared/Timer';
import Leaderboard from '@/components/shared/Leaderboard';
import ImageUpload from '@/components/shared/ImageUpload';
import FloralDecor from '@/components/shared/FloralDecor';

type RoomStatus = 'lobby' | 'playing' | 'finished';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

export default function HostRoom() {
  const params = useParams();
  const roomCode = (params.roomCode as string).toUpperCase();
  const { emit, on, isConnected } = useSocket();

  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<RoomStatus>('lobby');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [textCount, setTextCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('caption');
  const hasReconnected = useRef(false);

  // Fetch available games
  useEffect(() => {
    fetch(`${SERVER_URL}/api/games`)
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch(() => {});
  }, []);

  // Reconnect on mount
  useEffect(() => {
    if (isConnected && !hasReconnected.current) {
      hasReconnected.current = true;
      emit('reconnect_host', { roomCode });
    }
  }, [isConnected, roomCode, emit]);

  // Socket event listeners
  useEffect(() => {
    const cleanups = [
      on('host_reconnect_success', (data: any) => {
        setPlayers(data.room.players);
        setStatus(data.room.status);
        setImageCount(data.room.contentCount?.images || 0);
        setTextCount(data.room.contentCount?.texts || 0);
      }),
      on('player_joined', (data: any) => {
        setPlayers(data.players);
      }),
      on('player_disconnected', (data: any) => {
        setPlayers(data.players);
      }),
      on('player_reconnected', () => {}),
      on('game_started', () => {
        setStatus('playing');
      }),
      on('game_state', (data: GameState) => {
        setGameState(data);
        if (data.players) setPlayers(data.players);
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
      on('image_uploaded', (data: any) => {
        setImageCount(data.totalImages);
      }),
      on('text_submitted', (data: any) => {
        setTextCount(data.totalTexts);
      }),
      on('error', (data: any) => {
        setError(data.message);
        setTimeout(() => setError(null), 4000);
      }),
    ];
    return () => cleanups.forEach((c) => c());
  }, [on]);

  const startGame = useCallback(() => {
    emit('start_game', { gameType: selectedGame });
  }, [emit, selectedGame]);

  const advancePhase = useCallback(() => {
    emit('advance_phase');
  }, [emit]);

  const returnToLobby = useCallback(() => {
    emit('return_to_lobby');
  }, [emit]);

  const submitText = useCallback((content: string, category: string) => {
    emit('submit_text', { content, category });
  }, [emit]);

  return (
    <div className="min-h-screen relative">
      <FloralDecor variant="compact" />
      <ConnectionStatus isConnected={isConnected} />

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-xl z-50 backdrop-blur-sm">
          {error}
        </div>
      )}

      {status === 'lobby' && (
        <HostLobby
          roomCode={roomCode}
          players={players}
          imageCount={imageCount}
          textCount={textCount}
          games={games}
          selectedGame={selectedGame}
          onSelectGame={setSelectedGame}
          onStart={startGame}
          onSubmitText={submitText}
        />
      )}

      {status === 'playing' && gameState && (
        <HostGame
          gameState={gameState}
          timer={timer}
          onAdvance={advancePhase}
          roomCode={roomCode}
        />
      )}

      {status === 'finished' && gameState && (
        <HostResults
          gameState={gameState}
          onReturnToLobby={returnToLobby}
        />
      )}
    </div>
  );
}

// ─── Lobby ───

function HostLobby({
  roomCode,
  players,
  imageCount,
  textCount,
  games,
  selectedGame,
  onSelectGame,
  onStart,
  onSubmitText,
}: {
  roomCode: string;
  players: Player[];
  imageCount: number;
  textCount: number;
  games: GameInfo[];
  selectedGame: string;
  onSelectGame: (id: string) => void;
  onStart: () => void;
  onSubmitText: (content: string, category: string) => void;
}) {
  const game = games.find((g) => g.id === selectedGame);
  const needsImages = selectedGame === 'caption' || selectedGame === 'tournament';
  const needsTexts = selectedGame === 'match' || selectedGame === 'debate' || selectedGame === 'mostlikely';

  const minImages = selectedGame === 'tournament' ? 4 : 1;
  const minTexts = selectedGame === 'match' || selectedGame === 'mostlikely' ? 3 : 1;

  const hasEnoughPlayers = players.length >= (game?.minPlayers || 2);
  const hasEnoughContent = needsImages
    ? imageCount >= minImages
    : needsTexts
    ? textCount >= minTexts
    : true;
  const canStart = hasEnoughPlayers && hasEnoughContent;

  let startLabel = '';
  if (!hasEnoughPlayers) {
    const needed = (game?.minPlayers || 2) - players.length;
    startLabel = `Need ${needed} more player${needed !== 1 ? 's' : ''}`;
  } else if (!hasEnoughContent) {
    if (needsImages) {
      startLabel = `Need at least ${minImages} photo${minImages !== 1 ? 's' : ''}`;
    } else {
      startLabel = `Need at least ${minTexts} text submission${minTexts !== 1 ? 's' : ''}`;
    }
  } else {
    startLabel = `Start ${game?.name || 'Game'}`;
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Room code display */}
        <div className="text-center space-y-2">
          <p className="text-2xl select-none">{'\u{1F33F}\u{1F338}\u{1F33F}'}</p>
          <p className="text-white/60 text-lg">Join at <span className="text-white font-semibold">{process.env.NEXT_PUBLIC_GAME_URL || 'localhost:3000/play'}</span></p>
          <div className="room-code">{roomCode}</div>
          <p className="text-white/40 text-sm">Enter this code on your phone</p>
        </div>

        {/* Players */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Players ({players.length})</h2>
          </div>
          <PlayerList players={players} />
        </div>

        {/* Game selection */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Choose a Game</h2>
          <div className="grid gap-3">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => onSelectGame(g.id)}
                className={`text-left rounded-xl p-4 transition-all duration-200 border ${
                  selectedGame === g.id
                    ? 'bg-primary-600/30 border-primary-400 ring-2 ring-primary-400/50'
                    : 'bg-primary-900/20 border-primary-400/20 hover:bg-primary-700/30 hover:border-primary-400'
                }`}
              >
                <p className="font-bold text-lg">{g.name}</p>
                <p className="text-white/50 text-sm mt-1">{g.description}</p>
                <p className="text-white/30 text-xs mt-2">{g.minPlayers}-{g.maxPlayers} players</p>
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        {needsImages && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Photos</h2>
              <span className="text-accent-400 font-mono font-bold">{imageCount} uploaded</span>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Players can upload photos from their phones. The host can also upload here.
            </p>
            <ImageUpload
              roomCode={roomCode}
              playerId="host"
              playerName="Host"
            />
          </div>
        )}

        {needsTexts && (
          <TextSubmissionPanel
            selectedGame={selectedGame}
            textCount={textCount}
            onSubmitText={onSubmitText}
          />
        )}

        {/* Start button */}
        <button
          onClick={onStart}
          disabled={!canStart}
          className="btn-accent w-full text-2xl py-5"
        >
          {startLabel}
        </button>
      </div>
    </div>
  );
}

function TextSubmissionPanel({
  selectedGame,
  textCount,
  onSubmitText,
}: {
  selectedGame: string;
  textCount: number;
  onSubmitText: (content: string, category: string) => void;
}) {
  const [text, setText] = useState('');

  const isDebate = selectedGame === 'debate';
  const isMostLikely = selectedGame === 'mostlikely';
  const category = isDebate ? 'debate' : isMostLikely ? 'mostlikely' : 'general';
  const placeholder = isDebate
    ? 'Pineapple on pizza | Yes, it belongs | No, never'
    : isMostLikely
    ? 'Most likely to fall asleep during a movie...'
    : 'Write a fun fact or quote about yourself...';
  const hint = isDebate
    ? 'Format: Prompt | Side A | Side B'
    : isMostLikely
    ? 'Write "Most likely to..." prompts. Both the host and players can submit!'
    : 'Submit facts or quotes that players will try to match to each other';

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmitText(trimmed, category);
    setText('');
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Text Prompts</h2>
        <span className="text-accent-400 font-mono font-bold">{textCount} submitted</span>
      </div>
      <p className="text-white/60 text-sm mb-3">{hint}</p>
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder={placeholder}
          className="input-field h-20 resize-none"
          maxLength={500}
        />
        <div className="flex justify-between items-center">
          <span className="text-white/40 text-xs">{text.length}/500</span>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="btn-primary"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Game (all modes) ───

function HostGame({
  gameState,
  timer,
  onAdvance,
  roomCode,
}: {
  gameState: GameState;
  timer: TimerState | null;
  onAdvance: () => void;
  roomCode: string;
}) {
  const { phase, gameType } = gameState;

  const skippablePhases = gameType === 'tournament'
    ? ['voting']
    : gameType === 'debate'
    ? ['picking', 'arguing', 'voting']
    : gameType === 'mostlikely'
    ? ['voting']
    : ['captioning', 'voting', 'guessing'];

  return (
    <div className="min-h-screen flex flex-col p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-white/40 text-sm">Room</span>
          <span className="room-code-small ml-2">{roomCode}</span>
        </div>
        <div className="text-right">
          <span className="text-white/60">
            {gameType === 'tournament'
              ? `Bracket Round ${gameState.bracketRound} / ${gameState.totalBracketRounds}`
              : `Round ${gameState.currentRound} / ${gameState.totalRounds}`}
          </span>
        </div>
      </div>

      <Timer timer={timer} />

      <div className="flex-1 flex flex-col items-center justify-center">
        {gameType === 'caption' && <CaptionHostPhase gameState={gameState} onAdvance={onAdvance} />}
        {gameType === 'match' && <MatchHostPhase gameState={gameState} onAdvance={onAdvance} />}
        {gameType === 'debate' && <DebateHostPhase gameState={gameState} onAdvance={onAdvance} />}
        {gameType === 'tournament' && <TournamentHostPhase gameState={gameState} onAdvance={onAdvance} />}
        {gameType === 'mostlikely' && <MostLikelyHostPhase gameState={gameState} onAdvance={onAdvance} />}
      </div>

      {/* Host skip button */}
      {skippablePhases.includes(phase) && (
        <div className="text-center mt-6">
          <button onClick={onAdvance} className="btn-secondary text-sm">
            Skip Phase
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Caption Host Phases ───

function CaptionHostPhase({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const { phase } = gameState;
  if (phase === 'captioning') return <HostCaptioning gameState={gameState} />;
  if (phase === 'voting') return <HostVoting gameState={gameState} />;
  if (phase === 'reveal') return <HostReveal gameState={gameState} onAdvance={onAdvance} />;
  if (phase === 'final') return <HostFinal gameState={gameState} />;
  return null;
}

function HostCaptioning({ gameState }: { gameState: GameState }) {
  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Caption This!</h2>
      {gameState.imageAuthor && (
        <p className="text-white/50 text-sm">Photo by {gameState.imageAuthor}</p>
      )}
      {gameState.imageUrl && (
        <div className="flex justify-center">
          <img
            src={gameState.imageUrl}
            alt="Caption this"
            className="max-h-[50vh] max-w-full rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
      <p className="text-white/60 text-xl animate-gentle-pulse">
        {gameState.submittedCount} / {gameState.totalPlayers} players submitted
      </p>
    </div>
  );
}

function HostVoting({ gameState }: { gameState: GameState }) {
  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Vote for the best caption!</h2>
      {gameState.imageUrl && (
        <div className="flex justify-center">
          <img
            src={gameState.imageUrl}
            alt="Caption this"
            className="max-h-[35vh] max-w-full rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
      <div className="grid gap-3 max-w-xl mx-auto">
        {gameState.captions?.map((c, i) => (
          <div key={i} className="card text-left">
            <p className="text-lg">{c.caption}</p>
          </div>
        ))}
      </div>
      <p className="text-white/60 animate-gentle-pulse">
        {gameState.votedCount} / {gameState.totalVoters} votes in
      </p>
    </div>
  );
}

function HostReveal({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const result = gameState.roundResult;
  if (!result) return null;

  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Results</h2>
      {gameState.imageUrl && (
        <div className="flex justify-center">
          <img
            src={gameState.imageUrl}
            alt="Round image"
            className="max-h-[30vh] max-w-full rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
      <div className="grid gap-3 max-w-xl mx-auto">
        {result.captions.map((c, i) => (
          <div
            key={i}
            className={`card text-left flex justify-between items-center
              ${i === 0 && c.votes > 0 ? 'ring-2 ring-accent-400 bg-accent-500/10' : ''}`}
          >
            <div>
              <p className="text-lg font-medium">{c.caption}</p>
              <p className="text-sm text-white/50">-- {c.playerName}</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-2xl font-bold text-accent-400">+{c.votes * 100}</p>
              <p className="text-xs text-white/40">{c.votes} vote{c.votes !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onAdvance} className="btn-primary text-lg">
        {gameState.currentRound >= gameState.totalRounds ? 'See Final Results' : 'Next Round'}
      </button>
    </div>
  );
}

// ─── Match Host Phases ───

function MatchHostPhase({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const { phase } = gameState;
  if (phase === 'guessing') return <HostMatchGuessing gameState={gameState} />;
  if (phase === 'reveal') return <HostMatchReveal gameState={gameState} onAdvance={onAdvance} />;
  if (phase === 'final') return <HostFinal gameState={gameState} />;
  return null;
}

function HostMatchGuessing({ gameState }: { gameState: GameState }) {
  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Who Said It?</h2>
      <div className="card max-w-xl mx-auto">
        <p className="text-2xl font-medium italic">&ldquo;{gameState.fact}&rdquo;</p>
      </div>
      <p className="text-white/60 text-xl animate-gentle-pulse">
        {gameState.guessedCount} / {gameState.totalGuessers} guesses in
      </p>
    </div>
  );
}

function HostMatchReveal({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const result = gameState.matchRoundResult;
  if (!result) return null;

  const correctCount = result.guesses.filter((g) => g.correct).length;

  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">It was {result.authorName}!</h2>
      <div className="card max-w-xl mx-auto">
        <p className="text-xl italic">&ldquo;{result.fact}&rdquo;</p>
      </div>
      <p className="text-white/60 text-lg">
        {correctCount} of {result.guesses.length} guessed correctly
      </p>
      <div className="grid gap-2 max-w-xl mx-auto">
        {result.guesses.map((g, i) => (
          <div
            key={i}
            className={`card flex justify-between items-center ${
              g.correct ? 'ring-1 ring-green-400 bg-green-500/10' : ''
            }`}
          >
            <div>
              <p className="font-medium">{g.playerName}</p>
              <p className="text-sm text-white/40">guessed {g.guessedName}</p>
            </div>
            <span className={`font-bold ${g.correct ? 'text-green-400' : 'text-red-400'}`}>
              {g.correct ? '+100' : '+0'}
            </span>
          </div>
        ))}
      </div>
      <button onClick={onAdvance} className="btn-primary text-lg">
        {gameState.currentRound >= gameState.totalRounds ? 'See Final Results' : 'Next Round'}
      </button>
    </div>
  );
}

// ─── Debate Host Phases ───

function DebateHostPhase({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const { phase } = gameState;
  if (phase === 'picking') return <HostDebatePicking gameState={gameState} />;
  if (phase === 'arguing') return <HostDebateArguing gameState={gameState} />;
  if (phase === 'voting') return <HostDebateVoting gameState={gameState} />;
  if (phase === 'reveal') return <HostDebateReveal gameState={gameState} onAdvance={onAdvance} />;
  if (phase === 'final') return <HostFinal gameState={gameState} />;
  return null;
}

function HostDebatePicking({ gameState }: { gameState: GameState }) {
  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Hot Take</h2>
      <div className="card max-w-xl mx-auto">
        <p className="text-2xl font-medium">{gameState.prompt}</p>
      </div>
      <div className="flex gap-6 justify-center">
        <div className="card flex-1 text-center">
          <p className="text-lg font-bold text-primary-300">{gameState.sideA}</p>
          <p className="text-3xl font-black text-accent-400 mt-2">{gameState.sideACount || 0}</p>
        </div>
        <div className="card flex-1 text-center">
          <p className="text-lg font-bold text-primary-300">{gameState.sideB}</p>
          <p className="text-3xl font-black text-accent-400 mt-2">{gameState.sideBCount || 0}</p>
        </div>
      </div>
      <p className="text-white/60 animate-gentle-pulse">
        {gameState.pickedCount} / {gameState.totalPickers} players picked a side
      </p>
    </div>
  );
}

function HostDebateArguing({ gameState }: { gameState: GameState }) {
  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Make Your Case!</h2>
      <div className="card max-w-xl mx-auto">
        <p className="text-xl">{gameState.prompt}</p>
      </div>
      <div className="flex gap-6 justify-center text-sm text-white/50">
        <span>{gameState.sideA}: {gameState.sideACount || 0} players</span>
        <span>{gameState.sideB}: {gameState.sideBCount || 0} players</span>
      </div>
      <p className="text-white/60 text-xl animate-gentle-pulse">
        {gameState.submittedCount} / {gameState.totalPlayers} arguments submitted
      </p>
    </div>
  );
}

function HostDebateVoting({ gameState }: { gameState: GameState }) {
  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Vote for the best argument!</h2>
      <div className="grid gap-3 max-w-xl mx-auto">
        {gameState.arguments?.map((a, i) => (
          <div key={i} className="card text-left">
            <span className={`text-xs font-bold uppercase tracking-wide ${
              a.side === 'A' ? 'text-primary-300' : 'text-accent-400'
            }`}>
              {a.side === 'A' ? gameState.sideA : gameState.sideB}
            </span>
            <p className="text-lg mt-1">{a.argument}</p>
          </div>
        ))}
      </div>
      <p className="text-white/60 animate-gentle-pulse">
        {gameState.votedCount} / {gameState.totalVoters} votes in
      </p>
    </div>
  );
}

function HostDebateReveal({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const result = gameState.debateRoundResult;
  if (!result) return null;

  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Results</h2>
      <p className="text-white/50">{result.prompt}</p>
      <div className="flex gap-6 justify-center text-sm">
        <span className="text-primary-300">{result.sideA}: {result.sideAPickers.length} players</span>
        <span className="text-accent-400">{result.sideB}: {result.sideBPickers.length} players</span>
      </div>
      <div className="grid gap-3 max-w-xl mx-auto">
        {result.arguments.map((a, i) => (
          <div
            key={i}
            className={`card text-left flex justify-between items-center
              ${i === 0 && a.votes > 0 ? 'ring-2 ring-accent-400 bg-accent-500/10' : ''}`}
          >
            <div>
              <span className={`text-xs font-bold uppercase tracking-wide ${
                a.side === 'A' ? 'text-primary-300' : 'text-accent-400'
              }`}>
                {a.side === 'A' ? result.sideA : result.sideB}
              </span>
              <p className="text-lg font-medium mt-1">{a.argument}</p>
              <p className="text-sm text-white/50">-- {a.playerName}</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-2xl font-bold text-accent-400">+{a.votes * 100}</p>
              <p className="text-xs text-white/40">{a.votes} vote{a.votes !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onAdvance} className="btn-primary text-lg">
        {gameState.currentRound >= gameState.totalRounds ? 'See Final Results' : 'Next Round'}
      </button>
    </div>
  );
}

// ─── Tournament Host Phases ───

function TournamentHostPhase({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const { phase } = gameState;
  if (phase === 'voting') return <HostTournamentVoting gameState={gameState} />;
  if (phase === 'result') return <HostTournamentResult gameState={gameState} onAdvance={onAdvance} />;
  if (phase === 'final') return <HostTournamentFinal gameState={gameState} />;
  return null;
}

function HostTournamentVoting({ gameState }: { gameState: GameState }) {
  const matchup = gameState.matchup;
  if (!matchup) return null;

  return (
    <div className="text-center space-y-6 max-w-4xl w-full">
      <h2 className="text-3xl font-bold">
        Matchup {gameState.matchupNumber} of {gameState.totalMatchups}
      </h2>
      <p className="text-white/50 text-sm">Bracket Round {gameState.bracketRound}</p>
      <div className="flex gap-6 items-center justify-center">
        <div className="flex-1 text-center space-y-3">
          <img
            src={matchup.imageA.url}
            alt="Photo A"
            className="max-h-[40vh] max-w-full rounded-2xl shadow-2xl object-contain mx-auto"
          />
          <p className="text-white/50 text-sm">by {matchup.imageA.playerName}</p>
        </div>
        <div className="text-3xl font-black text-white/30">VS</div>
        <div className="flex-1 text-center space-y-3">
          <img
            src={matchup.imageB.url}
            alt="Photo B"
            className="max-h-[40vh] max-w-full rounded-2xl shadow-2xl object-contain mx-auto"
          />
          <p className="text-white/50 text-sm">by {matchup.imageB.playerName}</p>
        </div>
      </div>
      <p className="text-white/60 text-xl animate-gentle-pulse">
        {gameState.votedCount} / {gameState.totalVoters} votes in
      </p>
    </div>
  );
}

function HostTournamentResult({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const matchup = gameState.matchup;
  const result = gameState.matchupResult;
  if (!matchup || !result) return null;

  return (
    <div className="text-center space-y-6 max-w-4xl w-full">
      <h2 className="text-3xl font-bold">Winner!</h2>
      <div className="flex gap-6 items-center justify-center">
        <div className={`flex-1 text-center space-y-3 ${
          result.winnerId === matchup.imageA.id ? 'ring-2 ring-accent-400 rounded-2xl p-3' : 'opacity-40'
        }`}>
          <img
            src={matchup.imageA.url}
            alt="Photo A"
            className="max-h-[35vh] max-w-full rounded-2xl shadow-2xl object-contain mx-auto"
          />
          <p className="text-accent-400 font-bold">{result.votesA} votes</p>
        </div>
        <div className="text-3xl font-black text-white/30">VS</div>
        <div className={`flex-1 text-center space-y-3 ${
          result.winnerId === matchup.imageB.id ? 'ring-2 ring-accent-400 rounded-2xl p-3' : 'opacity-40'
        }`}>
          <img
            src={matchup.imageB.url}
            alt="Photo B"
            className="max-h-[35vh] max-w-full rounded-2xl shadow-2xl object-contain mx-auto"
          />
          <p className="text-accent-400 font-bold">{result.votesB} votes</p>
        </div>
      </div>
      <button onClick={onAdvance} className="btn-primary text-lg">
        Next
      </button>
    </div>
  );
}

function HostTournamentFinal({ gameState }: { gameState: GameState }) {
  return (
    <div className="text-center space-y-6 max-w-lg w-full">
      <h2 className="text-4xl font-black bg-gradient-to-r from-accent-400 to-primary-400 bg-clip-text text-transparent">
        Champion Photo!
      </h2>
      {gameState.winnerUrl && (
        <div className="flex justify-center">
          <img
            src={gameState.winnerUrl}
            alt="Winner"
            className="max-h-[50vh] max-w-full rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
      {gameState.winnerPlayerName && (
        <p className="text-2xl">
          Photo by <span className="text-accent-400 font-bold">{gameState.winnerPlayerName}</span>
        </p>
      )}
      {gameState.leaderboard && (
        <Leaderboard entries={gameState.leaderboard} title="Player Scores" />
      )}
    </div>
  );
}

// ─── Most Likely To Host Phases ───

function MostLikelyHostPhase({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const { phase } = gameState;
  if (phase === 'voting') return <HostMostLikelyVoting gameState={gameState} />;
  if (phase === 'reveal') return <HostMostLikelyReveal gameState={gameState} onAdvance={onAdvance} />;
  if (phase === 'final') return <HostFinal gameState={gameState} />;
  return null;
}

function HostMostLikelyVoting({ gameState }: { gameState: GameState }) {
  const tally = gameState.voteTally || [];

  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Most Likely To...</h2>
      <div className="card max-w-xl mx-auto">
        <p className="text-2xl font-medium">{gameState.prompt}</p>
      </div>
      {tally.length > 0 && (
        <div className="grid gap-2 max-w-xl mx-auto">
          {tally.map((entry) => (
            <div key={entry.id} className="card flex justify-between items-center">
              <span className="font-medium">{entry.name}</span>
              {entry.votes > 0 && (
                <span className="text-accent-400 font-bold">{entry.votes} vote{entry.votes !== 1 ? 's' : ''}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-white/60 text-xl animate-gentle-pulse">
        {gameState.votedCount} / {gameState.totalVoters} votes in
      </p>
    </div>
  );
}

function HostMostLikelyReveal({ gameState, onAdvance }: { gameState: GameState; onAdvance: () => void }) {
  const result = gameState.mostLikelyResult;
  if (!result) return null;

  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <h2 className="text-3xl font-bold">Most Likely To...</h2>
      <div className="card max-w-xl mx-auto">
        <p className="text-xl">{result.prompt}</p>
      </div>
      {result.winner && (
        <div className="space-y-2">
          <p className="text-4xl font-black text-accent-400">{result.winner.playerName}</p>
          <p className="text-white/60 text-lg">
            with {result.winner.voteCount} vote{result.winner.voteCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
      <div className="grid gap-2 max-w-xl mx-auto">
        {result.votes.map((v, i) => (
          <div key={i} className="card flex justify-between items-center text-sm">
            <span className="text-white/60">{v.voterName}</span>
            <span className="font-medium">{v.votedForName}</span>
          </div>
        ))}
      </div>
      <button onClick={onAdvance} className="btn-primary text-lg">
        {gameState.currentRound >= gameState.totalRounds ? 'See Final Results' : 'Next Round'}
      </button>
    </div>
  );
}

// ─── Shared Final ───

function HostFinal({ gameState }: { gameState: GameState }) {
  if (!gameState.leaderboard) return null;

  return (
    <div className="text-center space-y-6 max-w-lg w-full">
      <p className="text-3xl select-none">{'\u{1F33B}\u{1F338}\u{1F33B}'}</p>
      <h2 className="text-4xl font-black bg-gradient-to-r from-accent-400 to-primary-400 bg-clip-text text-transparent">
        Game Over!
      </h2>
      {gameState.leaderboard[0] && (
        <p className="text-2xl">
          <span className="text-accent-400 font-bold">{gameState.leaderboard[0].name}</span> wins! {'\u{1F3C6}'}
        </p>
      )}
      <Leaderboard entries={gameState.leaderboard} title="Final Standings" />
    </div>
  );
}

// ─── Finished (post-game with return to lobby) ───

function HostResults({
  gameState,
  onReturnToLobby,
}: {
  gameState: GameState;
  onReturnToLobby: () => void;
}) {
  const isTournament = gameState.gameType === 'tournament';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        {isTournament ? (
          <HostTournamentFinal gameState={gameState} />
        ) : (
          <HostFinal gameState={gameState} />
        )}
        <div className="text-center space-y-3">
          <button onClick={onReturnToLobby} className="btn-primary text-lg">
            {'\u{1F331}'} Return to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
