import { Room } from '../rooms/types';

export interface GameAction {
  type: string;
  payload: any;
}

export interface StateUpdate {
  gameState: any;
  events?: GameEvent[];
}

export interface GameEvent {
  type: string;
  data: any;
}

export interface StartCheck {
  ok: boolean;
  reason?: string;
}

export interface GameModule {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;

  /** Check if the game can start with the room's current state */
  canStart(room: Room): StartCheck;

  /** Initialize game state for a new game */
  init(room: Room): any;

  /** Handle a player action (submit, vote, etc.) */
  handleAction(room: Room, playerId: string, action: GameAction): StateUpdate | null;

  /** Advance to the next phase (timer expired or host triggered) */
  advance(room: Room): StateUpdate;

  /** Get the view of game state the host should see */
  getHostView(room: Room): any;

  /** Get the view of game state a specific player should see */
  getPlayerView(room: Room, playerId: string): any;

  /** Called when timer expires for the current phase */
  onTimerExpired(room: Room): StateUpdate;

  /** Clean up when game ends */
  cleanup(room: Room): void;
}
