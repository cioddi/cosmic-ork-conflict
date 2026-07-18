import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Game, { GameSnapshot } from "./classes/Game";
import SequentialAI from "./classes/SequentialAI";
import Miniature, { MiniatureType } from "./classes/Miniature";
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
import {
  BattleArmies,
  expandArmyUnitIds,
  isUsableArmy,
  UNIT_CATALOG_BY_ID,
} from "./army";

export type GameLoadStatus =
  | "loading-world"
  | "army-selection"
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
  startBattle: (armies: BattleArmies) => void;
  openArmyBuilder: () => void;
  status: GameLoadStatus;
  error: string | undefined;
}

const GameContext = createContext<GameContextValue | null>(null);
const TICK_INTERVAL_MS = 650;

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

function createArmyUnit(
  unitId: string,
  playerIndex: number,
  world: Game["world"],
  navigation: GridNavigation,
  random: () => number
): Miniature {
  const entry = UNIT_CATALOG_BY_ID.get(unitId);
  if (!entry) throw new Error(`Unknown unit catalogue id: ${unitId}`);
  const template = entry.template;
  const mobilityProfileId =
    template.mobilityProfileId ??
    (template.type === MiniatureType.VEHICLE ? "vehicle" : "infantry");
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
  const [preparedWorld, setPreparedWorld] = useState<{
    world: Game["world"];
    navigation: GridNavigation;
  }>();
  const [battleArmies, setBattleArmies] = useState<BattleArmies>();

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

  const startBattle = useCallback((armies: BattleArmies) => {
    if (!isUsableArmy(armies.first) || !isUsableArmy(armies.second)) {
      setError("Both armies need at least one valid unit.");
      return;
    }
    setError(undefined);
    setSelectedMiniatureId(undefined);
    setViewReady(false);
    setBattleArmies(armies);
    setStatus("creating-game");
  }, []);

  const openArmyBuilder = useCallback(() => {
    simulationFinishedRef.current = true;
    setViewReady(false);
    setSelectedMiniatureId(undefined);
    setSnapshot(undefined);
    setGame(null);
    setBattleArmies(undefined);
    setStatus(preparedWorld ? "army-selection" : "loading-world");
  }, [preparedWorld]);

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
        setPreparedWorld({ world, navigation });
        setStatus("army-selection");
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
    if (!preparedWorld || !battleArmies) return;
    try {
      setStatus("creating-game");
      const random = createSeededRandom(Date.now() >>> 0);
      const player1Units = expandArmyUnitIds(battleArmies.first).map((unitId) =>
        createArmyUnit(
          unitId,
          0,
          preparedWorld.world,
          preparedWorld.navigation,
          random
        )
      );
      const player2Units = expandArmyUnitIds(battleArmies.second).map((unitId) =>
        createArmyUnit(
          unitId,
          1,
          preparedWorld.world,
          preparedWorld.navigation,
          random
        )
      );
      const players = [
        new SequentialAI(1, battleArmies.first.name, player1Units, "red"),
        new SequentialAI(2, battleArmies.second.name, player2Units, "yellow"),
      ];
      const nextGame = new Game(
        players,
        preparedWorld.world,
        preparedWorld.navigation,
        random
      );
      simulationFinishedRef.current = false;
      setGame(nextGame);
      setSnapshot(nextGame.getSnapshot());
      setStatus("preparing-view");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
    }
  }, [preparedWorld, battleArmies]);

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
        startBattle,
        openArmyBuilder,
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
