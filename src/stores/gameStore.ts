import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import Game from '../game/classes/Game';
import { GameStateFeatureCollectionType, MiniatureGeoJsonFeature } from '../game/view/MapLibreSnapshotAdapter';

interface GameStore {
  // Game state
  game: Game | null;
  geojson: GameStateFeatureCollectionType | null;
  selectedMiniatureId: string | undefined;
  isGameRunning: boolean;
  isCalculatingPaths: boolean;

  // Animation state
  animationState: {
    isAnimating: boolean;
    fromPositions: Map<string, [number, number]>;
    targetPositions: Map<string, [number, number]>;
    targetCollection: GameStateFeatureCollectionType | null;
    startTime: number;
    duration: number;
  } | null;

  // Actions
  setGame: (game: Game | null) => void;
  updateGeojson: (geojson: GameStateFeatureCollectionType) => void;
  setSelectedMiniatureId: (id: string | undefined) => void;
  setGameRunning: (running: boolean) => void;
  setCalculatingPaths: (calculating: boolean) => void;

  // Animation actions
  startAnimation: (targetCollection: GameStateFeatureCollectionType, duration?: number) => void;
  updateAnimation: (progress: number, interpolatedCollection: GameStateFeatureCollectionType) => void;
  endAnimation: () => void;
}

const buildPositionMap = (
  collection: GameStateFeatureCollectionType | null
): Map<string, [number, number]> => {
  const map = new Map<string, [number, number]>();
  if (!collection?.features) {
    return map;
  }

  collection.features.forEach((feature) => {
    const id = feature.properties.id as string | undefined;
    if (!id) {
      return;
    }
    const coordinates = feature.geometry.coordinates as [number, number];
    map.set(id, [...coordinates]);
  });

  return map;
};

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    game: null,
    geojson: null,
    selectedMiniatureId: undefined,
    isGameRunning: false,
    isCalculatingPaths: false,
    animationState: null,

    // Actions
    setGame: (game: Game | null) => set({ game }),

    updateGeojson: (geojson: GameStateFeatureCollectionType) => set({ geojson }),

    setSelectedMiniatureId: (id: string | undefined) => set({ selectedMiniatureId: id }),

    setGameRunning: (running: boolean) => set({ isGameRunning: running }),

    setCalculatingPaths: (calculating: boolean) => set({ isCalculatingPaths: calculating }),

    // Animation actions
    startAnimation: (targetCollection: GameStateFeatureCollectionType, duration: number = 350) => {
      const currentState = get();
      const fromPositions = buildPositionMap(currentState.geojson);
      const targetPositions = buildPositionMap(targetCollection);

      set({
        animationState: {
          isAnimating: true,
          fromPositions,
          targetPositions,
          targetCollection,
          startTime: performance.now(),
          duration,
        }
      });
    },

    updateAnimation: (progress: number, interpolatedCollection: GameStateFeatureCollectionType) => {
      set({ geojson: interpolatedCollection });
    },

    endAnimation: () => {
      const currentState = get();
      if (currentState.animationState?.targetCollection) {
        set({
          geojson: currentState.animationState.targetCollection,
          animationState: null
        });
      }
    },

  }))
);

// Selectors for better performance
export const useGame = () => useGameStore((state) => state.game);
export const useGeojson = () => useGameStore((state) => state.geojson);
export const useSelectedMiniatureId = () => useGameStore((state) => state.selectedMiniatureId);
export const useSelectedMiniature = () => useGameStore((state) => {
  const { selectedMiniatureId, geojson } = state;

  if (!selectedMiniatureId || !geojson?.features) {
    return undefined;
  }

  return geojson.features.find((feature: MiniatureGeoJsonFeature) =>
    feature.properties.id === selectedMiniatureId
  );
});
export const useIsGameRunning = () => useGameStore((state) => state.isGameRunning);
export const useIsCalculatingPaths = () => useGameStore((state) => state.isCalculatingPaths);
export const useAnimationState = () => useGameStore((state) => state.animationState);
const EMPTY_ARRAY: any[] = [];
export const usePlayers = () => useGameStore((state) => state.game?.players ?? EMPTY_ARRAY);

// Actions
export const useGameActions = () => {
  const setGame = useGameStore(state => state.setGame);
  const updateGeojson = useGameStore(state => state.updateGeojson);
  const setSelectedMiniatureId = useGameStore(state => state.setSelectedMiniatureId);
  const setGameRunning = useGameStore(state => state.setGameRunning);
  const setCalculatingPaths = useGameStore(state => state.setCalculatingPaths);
  const startAnimation = useGameStore(state => state.startAnimation);
  const updateAnimation = useGameStore(state => state.updateAnimation);
  const endAnimation = useGameStore(state => state.endAnimation);

  return {
    setGame,
    updateGeojson,
    setSelectedMiniatureId,
    setGameRunning,
    setCalculatingPaths,
    startAnimation,
    updateAnimation,
    endAnimation,
  };
};
