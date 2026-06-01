export type AuctionPhase =
  | "MEGA"
  | "MAIN"
  | "SPECIAL"
  | "FINISHED";

export interface AuctionState {
  phase: AuctionPhase;
  currentTurn: number;
  currentPokemonId?: number;
  timerEndsAt?: string;
  status: "IDLE" | "RUNNING";
}