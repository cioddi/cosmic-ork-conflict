import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Game, { GameSnapshot } from "./classes/Game";
import SequentialAI from "./classes/SequentialAI";
import Miniature, { MiniatureType } from "./classes/Miniature";
import { orcUnits } from "./armylist/orcs";
import { GridNavigation } from "./navigation/GridNavigation";
import {
  VectorTileWorldLoader,
  createSeededRandom,
  findSpawnPoint,
} from "./world";
import { PARIS_WORLD_DEFINITION } from "./world/worlds/paris";
import {
  GameStateFeatureCollectionType,
  MiniatureGeoJsonFeature,
  gameSnapshotToGeoJSON,
} from "./view/MapLibreSnapshotAdapter";

export type GameLoadStatus =
  | "loading-world"
  | "creating-game"
  | "preparing-view"
  | "running"
  | "finished"
  | "error";

interface GameContextValue {
  game: Game | null;
  snapshot: GameSnapshot | undefined;
  geojson: GameStateFeatureCollectionType | undefined;
  selectedMiniature: MiniatureGeoJsonFeature | undefined;
  selectedMiniatureId: string | undefined;
  setSelectedMiniatureId: (id: string | undefined) => void;
  setViewReady: (ready: boolean) => void;
  status: GameLoadStatus;
  error: string | undefined;
}

const GameContext = createContext<GameContextValue | null>(null);
const UNITS_PER_PLAYER = 12;
const TICK_INTERVAL_MS = 650;

let selectedCharacterIds: number[] = [];
let parisWorldPromise: Promise<Game["world"]> | undefined;

function loadParisWorld(): Promise<Game["world"]> {
  if (!parisWorldPromise) {
    parisWorldPromise = new VectorTileWorldLoader()
      .load(PARIS_WORLD_DEFINITION)
      .catch((error) => {
        parisWorldPromise = undefined;
        throw error;
      });
  }
  return parisWorldPromise;
}

function getRandomOrkUnitId(random: () => number): number {
  return Math.floor(random() * orcUnits.length);
}

function createRandomUnit(
  playerIndex: number,
  world: Game["world"],
  navigation: GridNavigation,
  random: () => number
): Miniature {
  let unitId = getRandomOrkUnitId(random);
  while (
    MiniatureType[orcUnits[unitId].type] === "CHARACTER" &&
    selectedCharacterIds.includes(unitId)
  ) {
    unitId = getRandomOrkUnitId(random);
  }
  if (MiniatureType[orcUnits[unitId].type] === "CHARACTER") {
    selectedCharacterIds.push(unitId);
  }
  const template = orcUnits[unitId];
  const mobilityProfileId =
    template.type === MiniatureType.VEHICLE ? "vehicle" : "infantry";
  return new Miniature({
    ...template,
    mobilityProfileId,
    position: findSpawnPoint(
      world,
      playerIndex,
      mobilityProfileId,
      random,
      400,
      (point) => navigation.isInMainNavigableArea(point, mobilityProfileId)
    ),
  });
}

export interface GameProviderProps {
  children: React.ReactNode;
  loadWorld?: () => Promise<Game["world"]>;
}

export function GameProvider(props: GameProviderProps) {
  const simulationFinishedRef = useRef(false);
  const [game, setGame] = useState<Game | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>();
  const [selectedMiniatureId, setSelectedMiniatureId] = useState<string>();
  const [viewReady, setViewReady] = useState(false);
  const [status, setStatus] = useState<GameLoadStatus>("loading-world");
  const [error, setError] = useState<string>();

  const geojson = useMemo(
    () =>
      snapshot && game
        ? gameSnapshotToGeoJSON(snapshot, game.world.projection)
        : undefined,
    [snapshot, game]
  );
  const selectedMiniature = useMemo(
    () =>
      selectedMiniatureId
        ? geojson?.features.find(
            (feature) => feature.properties.id === selectedMiniatureId
          )
        : undefined,
    [geojson, selectedMiniatureId]
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        setStatus("loading-world");
        const world = await (props.loadWorld ?? loadParisWorld)();
        if (cancelled) return;
        setStatus("creating-game");
        const navigation = new GridNavigation(world);
        navigation.initialize();
        const random = createSeededRandom(0xc05c1c);
        selectedCharacterIds = [];
        const player1Units: Miniature[] = [];
        const player2Units: Miniature[] = [];
        for (let index = 0; index < UNITS_PER_PLAYER; index++) {
          player1Units.push(createRandomUnit(0, world, navigation, random));
          player2Units.push(createRandomUnit(1, world, navigation, random));
        }
        const players = [
          new SequentialAI(1, "Player 1", player1Units, "red"),
          new SequentialAI(2, "Player 2", player2Units, "yellow"),
        ];
        const nextGame = new Game(players, world, navigation, random);
        simulationFinishedRef.current = false;
        setGame(nextGame);
        setSnapshot(nextGame.getSnapshot());
        setStatus("preparing-view");
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus("error");
      }
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [props.loadWorld]);

  useEffect(() => {
    if (!game || !viewReady || simulationFinishedRef.current) return;
    setStatus("running");
    let timeoutId: number | undefined;
    const runTurn = () => {
      game.beginStep();
      const currentPlayer = game.players[game.currentPlayer];
      currentPlayer.playRound?.(game);
      setSnapshot(game.getSnapshot());
      if (game.isOver() || game.round > 10000) {
        simulationFinishedRef.current = true;
        setStatus("finished");
        return;
      }
      timeoutId = window.setTimeout(runTurn, TICK_INTERVAL_MS);
    };
    timeoutId = window.setTimeout(runTurn, TICK_INTERVAL_MS);
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [game, viewReady]);

  return (
    <GameContext.Provider
      value={{
        game,
        snapshot,
        geojson,
        selectedMiniature,
        selectedMiniatureId,
        setSelectedMiniatureId,
        setViewReady,
        status,
        error,
      }}
    >
      {props.children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue | null {
  return useContext(GameContext);
}
