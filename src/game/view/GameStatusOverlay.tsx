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
      role={state.status === "error" ? "alert" : "status"}
      style={{
        position: "absolute",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        padding: "8px 14px",
        borderRadius: 6,
        color: "white",
        background: state.status === "error" ? "#9c1c1c" : "rgba(0,0,0,0.75)",
      }}
    >
      {message}
    </div>
  );
}
