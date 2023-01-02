import { createContext, useContext, useMemo, useRef } from "react";
import { useState, useEffect } from "react";
import Game, {
  GameStateFeatureCollectionType,
  MiniatureGeoJsonFeature,
} from "./classes/Game";
import SequentialAI from "./classes/SequentialAI";
import Miniature, { MiniatureType } from "./classes/Miniature";
import { orcUnits } from "./armylist/orcs";
import * as turf from "@turf/turf";
import { GeoJSONFeature, LngLatLike } from "maplibre-gl";
import { useMap } from "@mapcomponents/react-maplibre";

const GameContext = createContext<{
  game: Game | null;
  geojson: GameStateFeatureCollectionType | undefined;
  selectedMiniature: MiniatureGeoJsonFeature | undefined;
  selectedMiniatureId: string | undefined;
  setSelectedMiniatureId: (id: string | undefined) => void;
} | null>(null);

const playerSetupAreas: GeoJSONFeature[] = [
  {
    type: "Feature",
    properties: {},
    geometry: {
      coordinates: [
        [
          [2.3100715332713833, 48.85097657043505],
          [2.328249799962066, 48.85365591032402],
          [2.3309401834327446, 48.8503067130581],
          [2.310289672471839, 48.846957291748225],
          [2.3100715332713833, 48.85097657043505],
        ],
      ],
      type: "Polygon",
    },
  },
  {
    type: "Feature",
    properties: {},
    geometry: {
      coordinates: [
        [
          [2.3163248570122335, 48.83690728604532],
          [2.3378479247763266, 48.840256647415714],
          [2.3388659077103, 48.83662030670902],
          [2.3182153967493946, 48.833270885399145],
          [2.3163248570122335, 48.83690728604532],
        ],
      ],
      type: "Polygon",
    },
  },
] as GeoJSONFeature[];

function getRandomPointInPolygon(
  polygonFeature: GeoJSONFeature
): [number, number] {
  console.log(polygonFeature.type);

  const randomPoint = turf.randomPoint(1, { bbox: turf.bbox(polygonFeature) });
  return randomPoint.features?.[0]?.geometry?.coordinates as [number, number];
}

let selectedCharacterIds: number[] = [];
function getRandomOrkUnitId() {
  return Math.floor(Math.random() * orcUnits.length);
}
function getRandomOrkUnit(playerId: number) {
  let unitId = getRandomOrkUnitId();
  while (
    MiniatureType[orcUnits[unitId].type] === "CHARACTER" &&
    selectedCharacterIds.indexOf(unitId) !== -1
  ) {
    unitId = getRandomOrkUnitId();
  }
  if (MiniatureType[orcUnits[unitId].type] === "CHARACTER") {
    console.log("character chosen");

    selectedCharacterIds.push(unitId);
  }
  return new Miniature({
    ...orcUnits[unitId],
    position: getRandomPointInPolygon(playerSetupAreas[playerId - 1]),
  });
}
export function GameProvider(props: { children: React.ReactNode }) {
  const gameRef = useRef<Game | undefined>();
  const selectedMiniatureIdRef = useRef<string | undefined>();
  const mapHook = useMap({ mapId: "map_1" });
  const [game, setGame] = useState<Game | null>(null);
  const [geojson, setGeojson] = useState<
    GameStateFeatureCollectionType | undefined
  >();
  const [selectedMiniatureId, setSelectedMiniatureId] = useState<
    string | undefined
  >();

  const selectedMiniature = useMemo<MiniatureGeoJsonFeature | undefined>(() => {
    if (!selectedMiniatureId || !geojson?.features) return;

    let _selectedMini = geojson.features.filter((el) => {
      return el.properties.id === selectedMiniatureId;
    });

    if (selectedMiniatureId !== selectedMiniatureIdRef.current) {
      selectedMiniatureIdRef.current = selectedMiniatureId;
      if (mapHook.map) {
        mapHook.map.map.easeTo({
          center: _selectedMini[0].geometry.coordinates as LngLatLike,
          zoom: 16,
        });
      }
    }
    return _selectedMini?.[0];
  }, [geojson, selectedMiniatureId, mapHook]);

  useEffect(() => {
    console.log("setup game");

    selectedCharacterIds = [];
    let player_1_units = [];
    let player_2_units = [];
    for (var i = 0; i < 12; i++) {
      player_1_units.push(getRandomOrkUnit(1));
      player_2_units.push(getRandomOrkUnit(2));
    }
    const players = [
      new SequentialAI(1, "Player 1", player_1_units),
      new SequentialAI(2, "Player 2", player_2_units),
    ];
    gameRef.current = new Game(players);
    setGame(gameRef.current);

    let round = 0;
    // Play the game until it is over

    let intervalId = window.setInterval(() => {
      if (!gameRef.current) return;
      round++;

      players[0].playRound(gameRef.current);
      players[1].playRound(gameRef.current);
      setGeojson(gameRef.current.getGameStateAsGeoJSON());

      if (gameRef.current.isOver() || round > 10000) {
        window.clearInterval(intervalId);
      }
    }, 200);
    return () => {
      gameRef.current = undefined;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <GameContext.Provider
      value={{
        game,
        geojson,
        selectedMiniature,
        selectedMiniatureId,
        setSelectedMiniatureId,
      }}
    >
      {props.children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const game = useContext(GameContext);
  return game;
}
