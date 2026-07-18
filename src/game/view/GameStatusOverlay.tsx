import { useGame } from "../GameContext";

export default function GameStatusOverlay() {
  const state = useGame();
  if (
    !state ||
    state.status === "army-selection" ||
    state.status === "running" ||
    state.status === "finished"
  ) {
    return null;
  }
  const message =
    state.status === "error"
      ? `Unable to create game world: ${state.error ?? "unknown error"}`
      : state.status === "loading-world"
      ? "Loading game terrain…"
      : state.status === "creating-game"
      ? "Building navigation model…"
      : "Preparing map and unit images…";
  return (
    <div
      className={`battle-status-overlay${
        state.status === "error" ? " is-error" : ""
      }`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
