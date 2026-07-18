import { useGame } from "../GameContext";
import { MiniatureGeoJsonFeature } from "./MapLibreSnapshotAdapter";
import { getUnitImageSrc } from "../unitAppearance";
import "./EndGameOverlay.css";

interface PlayerLabel {
  id: number;
  name: string;
}

interface UnitPerformance {
  unit: MiniatureGeoJsonFeature;
  playerName: string;
}

export interface BattleSummary {
  winnerName: string | undefined;
  rounds: number;
  totalDamage: number;
  totalKills: number;
  survivors: number;
  casualties: number;
  best: UnitPerformance | undefined;
  worst: UnitPerformance | undefined;
}

export function summarizeBattle(
  units: MiniatureGeoJsonFeature[],
  players: PlayerLabel[],
  rounds: number,
  winnerId: number | undefined
): BattleSummary {
  const playerNames = new Map(players.map((player) => [player.id, player.name]));
  const ranked = [...units].sort((left, right) => {
    const killDifference =
      right.properties.killCount - left.properties.killCount;
    if (killDifference !== 0) return killDifference;
    const damageDifference =
      right.properties.damageDealt - left.properties.damageDealt;
    if (damageDifference !== 0) return damageDifference;
    return right.properties.hitpoints - left.properties.hitpoints;
  });
  const toPerformance = (
    unit: MiniatureGeoJsonFeature | undefined
  ): UnitPerformance | undefined =>
    unit
      ? {
          unit,
          playerName: playerNames.get(unit.properties.playerId) ??
            `Player ${unit.properties.playerId}`,
        }
      : undefined;

  const survivors = units.filter((unit) => unit.properties.hitpoints > 0).length;
  return {
    winnerName: winnerId ? playerNames.get(winnerId) : undefined,
    rounds,
    totalDamage: units.reduce(
      (total, unit) => total + unit.properties.damageDealt,
      0
    ),
    totalKills: units.reduce(
      (total, unit) => total + unit.properties.killCount,
      0
    ),
    survivors,
    casualties: units.length - survivors,
    best: toPerformance(ranked[0]),
    worst: toPerformance(ranked[ranked.length - 1]),
  };
}

function PerformanceCard(props: {
  performance: UnitPerformance | undefined;
  kind: "best" | "worst";
}) {
  const { performance, kind } = props;
  if (!performance) return null;
  const unit = performance.unit.properties;
  return (
    <article className={`endgame-performer endgame-performer--${kind}`}>
      <div className="endgame-performer__badge">
        {kind === "best" ? "MVP" : "Needs more dakka"}
      </div>
      <img src={getUnitImageSrc(unit)} alt="" />
      <div className="endgame-performer__identity">
        <span>{performance.playerName}</span>
        <strong>{unit.name}</strong>
        <p>{kind === "best" ? "Top performer" : "Lowest performer"}</p>
      </div>
      <dl>
        <div>
          <dt>Kills</dt>
          <dd>{unit.killCount}</dd>
        </div>
        <div>
          <dt>Damage</dt>
          <dd>{unit.damageDealt}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{unit.hitpoints > 0 ? "Standing" : "Fallen"}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function EndGameOverlay() {
  const state = useGame();
  const summary =
    state?.game && state.geojson
      ? summarizeBattle(
          state.geojson.features,
          state.game.players,
          state.game.round,
          state.game.winner
        )
      : undefined;

  if (state?.status !== "finished" || !summary) return null;

  return (
    <div
      className="endgame-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Battle results"
    >
      <div className="endgame-overlay__scanlines" />
      <main className="endgame-report">
        <header className="endgame-report__header">
          <span>After action report // Sector Paris</span>
          <h1>
            {summary.winnerName
              ? `${summary.winnerName} victorious`
              : "Battle concluded"}
          </h1>
          <p>The smoke clears. The numbers tell the rest of the story.</p>
        </header>

        <section className="endgame-stat-grid" aria-label="Battle totals">
          <div>
            <span>Rounds</span>
            <strong>{summary.rounds}</strong>
          </div>
          <div>
            <span>Total kills</span>
            <strong>{summary.totalKills}</strong>
          </div>
          <div>
            <span>Damage dealt</span>
            <strong>{summary.totalDamage}</strong>
          </div>
          <div>
            <span>Survivors</span>
            <strong>{summary.survivors}</strong>
          </div>
          <div>
            <span>Casualties</span>
            <strong>{summary.casualties}</strong>
          </div>
        </section>

        <section className="endgame-performers" aria-label="Unit performance">
          <PerformanceCard performance={summary.best} kind="best" />
          <PerformanceCard performance={summary.worst} kind="worst" />
        </section>

        <footer className="endgame-report__footer">
          <button type="button" onClick={state.openArmyBuilder}>
            Return to army workshop
          </button>
        </footer>
      </main>
    </div>
  );
}
