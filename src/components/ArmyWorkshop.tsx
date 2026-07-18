import { useMemo, useState } from "react";
import {
  ArmyDefinition,
  DEFAULT_POINT_LIMIT,
  MAX_UNITS_PER_ARMY,
  UNIT_CATALOG,
  createArmy,
  generateRandomArmy,
  getArmyPointCost,
  getArmyUnitCount,
  isUsableArmy,
  loadArmyCollection,
  saveArmyCollection,
  setArmyUnitCount,
  upsertArmy,
} from "../game/army";
import { useGame } from "../game/GameContext";
import { DEFAULT_GAME_RULES } from "../game/rules";
import { getUnitImageSrc } from "../game/unitAppearance";
import "./ArmyWorkshop.css";

type OpponentMode = "random" | "saved";

function loadSavedArmies(): ArmyDefinition[] {
  try {
    return loadArmyCollection(window.localStorage);
  } catch {
    return [];
  }
}

export default function ArmyWorkshop() {
  const game = useGame();
  const [savedArmies, setSavedArmies] = useState<ArmyDefinition[]>(loadSavedArmies);
  const [draft, setDraft] = useState<ArmyDefinition>(() =>
    savedArmies[0] ? { ...savedArmies[0], unitCounts: { ...savedArmies[0].unitCounts } } : createArmy()
  );
  const [opponentMode, setOpponentMode] = useState<OpponentMode>("random");
  const [opponentId, setOpponentId] = useState(savedArmies[1]?.id ?? savedArmies[0]?.id ?? "");
  const [message, setMessage] = useState<string>();

  const pointCost = getArmyPointCost(draft);
  const unitCount = getArmyUnitCount(draft);
  const withinBudget = draft.pointLimit === null || pointCost <= draft.pointLimit;
  const canUseDraft = isUsableArmy(draft) && withinBudget;
  const savedOpponent = useMemo(
    () => savedArmies.find((army) => army.id === opponentId),
    [savedArmies, opponentId]
  );
  const worldReady = game?.status === "army-selection";

  if (game?.game) {
    return (
      <button className="army-workshop-return" onClick={game.openArmyBuilder}>
        ⚙ Army workshop
      </button>
    );
  }

  const persist = (armies: ArmyDefinition[]) => {
    try {
      saveArmyCollection(window.localStorage, armies);
      setSavedArmies(armies);
      setMessage("Warband saved in this browser.");
    } catch {
      setMessage("This browser did not allow local army storage.");
    }
  };

  const saveDraft = () => {
    if (!canUseDraft) {
      setMessage("Add at least one unit and keep the warband within its point limit.");
      return;
    }
    persist(upsertArmy(savedArmies, draft));
  };

  const startBattle = () => {
    if (!game || !worldReady || !canUseDraft) return;
    const opponent =
      opponentMode === "random"
        ? generateRandomArmy(pointCost, Math.random, `Raiders near ${pointCost} pts`)
        : savedOpponent;
    if (!opponent || !isUsableArmy(opponent)) {
      setMessage("Choose a saved opponent with at least one unit.");
      return;
    }
    game.startBattle({ first: draft, second: opponent });
  };

  const setCount = (unitId: string, count: number) => {
    const next = setArmyUnitCount(draft, unitId, count);
    if (next === draft && count > (draft.unitCounts[unitId] ?? 0)) {
      setMessage(
        draft.pointLimit !== null
          ? "That recruit would exceed the point limit."
          : `An army can contain at most ${MAX_UNITS_PER_ARMY} units.`
      );
      return;
    }
    setMessage(undefined);
    setDraft(next);
  };

  return (
    <div className="army-workshop" role="dialog" aria-label="Army workshop">
      <div className="army-workshop__scanlines" />
      <header className="army-workshop__header">
        <div>
          <span className="army-workshop__eyebrow">MUSTER DECK // SECTOR PARIS</span>
          <h1>Build your warband</h1>
        </div>
        <div className={`army-workshop__world ${worldReady ? "is-ready" : ""}`}>
          <span />
          {worldReady ? "Battlefield ready" : "Preparing battlefield…"}
        </div>
      </header>

      <main className="army-workshop__grid">
        <aside className="army-panel army-library">
          <div className="army-panel__title">
            <h2>Saved armies</h2>
            <button onClick={() => setDraft(createArmy())}>＋ New</button>
          </div>
          <div className="army-library__list">
            {savedArmies.length === 0 && (
              <p className="army-muted">No saved warbands yet.</p>
            )}
            {savedArmies.map((army) => (
              <div
                className={`army-library__item ${army.id === draft.id ? "is-active" : ""}`}
                key={army.id}
              >
                <button
                  className="army-library__load"
                  onClick={() =>
                    setDraft({ ...army, unitCounts: { ...army.unitCounts } })
                  }
                >
                  <strong>{army.name}</strong>
                  <span>{getArmyUnitCount(army)} units · {getArmyPointCost(army)} pts</span>
                </button>
                <button
                  className="army-library__delete"
                  aria-label={`Delete ${army.name}`}
                  onClick={() => {
                    const next = savedArmies.filter((candidate) => candidate.id !== army.id);
                    persist(next);
                    if (opponentId === army.id) setOpponentId(next[0]?.id ?? "");
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="army-panel army-roster">
          <div className="army-roster__identity">
            <label>
              Warband name
              <input
                value={draft.name}
                maxLength={60}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    name: event.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
            </label>
            <label className="army-limit-toggle">
              <input
                type="checkbox"
                checked={draft.pointLimit !== null}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    pointLimit: event.target.checked
                      ? Math.max(DEFAULT_POINT_LIMIT, pointCost)
                      : null,
                  })
                }
              />
              Enforce point limit
            </label>
            {draft.pointLimit !== null && (
              <label>
                Point limit
                <input
                  type="number"
                  min={50}
                  max={10000}
                  value={draft.pointLimit}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      pointLimit: Math.max(50, Number(event.target.value) || 50),
                    })
                  }
                />
              </label>
            )}
          </div>

          <div className="unit-catalog">
            {UNIT_CATALOG.map((entry) => {
              const count = draft.unitCounts[entry.id] ?? 0;
              return (
                <article className="unit-card" key={entry.id}>
                  <img src={getUnitImageSrc(entry.template)} alt="" />
                  <div className="unit-card__body">
                    <div className="unit-card__heading">
                      <h3>
                        {entry.template.name}
                        {entry.maxPerArmy === 1 && <small>Unique</small>}
                      </h3>
                      <strong>{entry.points} pts</strong>
                    </div>
                    <p>{entry.template.description}</p>
                    <div className="unit-card__stats">
                      <span>HP {entry.template.hitpoints}</span>
                      <span>ARM {entry.template.armour}</span>
                      <span>SPD {entry.template.speed}</span>
                    </div>
                    <div
                      className="unit-card__weapons"
                      aria-label={`${entry.template.name} weapons`}
                    >
                      <span className="unit-card__weapons-title">Weapons</span>
                      {entry.template.weapons.map((weapon, weaponIndex) => {
                        const isRanged =
                          weapon.range > DEFAULT_GAME_RULES.closeCombatRangeMeters;
                        const attackProfile = isRanged
                          ? `RNG ${weapon.range}m · HIT ${entry.template.rangeAttack}+`
                          : `MELEE · ATK +${entry.template.meleeAttack}`;
                        return (
                          <div
                            className="unit-card__weapon"
                            key={`${weapon.name}-${weaponIndex}`}
                            title={weapon.description}
                            aria-label={`${weapon.name}, damage ${weapon.damage}, ${attackProfile}`}
                          >
                            <strong>{weapon.name}</strong>
                            <span>DMG {weapon.damage}</span>
                            <span>{attackProfile}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="unit-card__counter">
                    <button
                      aria-label={`Remove ${entry.template.name}`}
                      disabled={count === 0}
                      onClick={() => setCount(entry.id, count - 1)}
                    >
                      −
                    </button>
                    <output>{count}</output>
                    <button
                      aria-label={`Add ${entry.template.name}`}
                      disabled={
                        unitCount >= MAX_UNITS_PER_ARMY || count >= entry.maxPerArmy
                      }
                      onClick={() => setCount(entry.id, count + 1)}
                    >
                      ＋
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="army-panel army-deploy">
          <div className="army-total">
            <span>{unitCount}/{MAX_UNITS_PER_ARMY} units</span>
            <strong className={!withinBudget ? "is-over" : ""}>
              {pointCost}{draft.pointLimit !== null ? ` / ${draft.pointLimit}` : ""} pts
            </strong>
          </div>
          <button className="army-action army-action--secondary" onClick={saveDraft}>
            Save warband
          </button>

          <fieldset className="opponent-picker">
            <legend>Opponent</legend>
            <label>
              <input
                type="radio"
                name="opponent"
                checked={opponentMode === "random"}
                onChange={() => setOpponentMode("random")}
              />
              Random matched army
              <small>Generated close to {pointCost} points</small>
            </label>
            <label>
              <input
                type="radio"
                name="opponent"
                checked={opponentMode === "saved"}
                onChange={() => setOpponentMode("saved")}
              />
              Saved army
            </label>
            {opponentMode === "saved" && (
              <select value={opponentId} onChange={(event) => setOpponentId(event.target.value)}>
                <option value="">Choose an army…</option>
                {savedArmies.map((army) => (
                  <option value={army.id} key={army.id}>
                    {army.name} — {getArmyPointCost(army)} pts
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          {message && <p className="army-message">{message}</p>}
          {game?.error && <p className="army-message is-error">{game.error}</p>}
          <button
            className="army-action army-action--deploy"
            disabled={!worldReady || !canUseDraft || (opponentMode === "saved" && !savedOpponent)}
            onClick={startBattle}
          >
            {worldReady ? "Deploy armies" : "Battlefield loading"}
          </button>
          <p className="army-fineprint">
            Armies are stored only in this browser. Point values are calculated by the local game rules.
          </p>
        </aside>
      </main>
    </div>
  );
}
