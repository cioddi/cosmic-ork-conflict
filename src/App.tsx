import React from "react";
import "./App.css";
import GameDataLayers from "./game/GameDataLayers";
import Header from "./components/Header";
import GameInterface from "./components/GameInterface";
import MapSelectionCamera from "./game/view/MapSelectionCamera";
import GameStatusOverlay from "./game/view/GameStatusOverlay";
import ArmyWorkshop from "./components/ArmyWorkshop";
import { useGame } from "./game/GameContext";
import { MapLibreView } from "./game/view/MapLibreView";

import "maplibre-gl/dist/maplibre-gl.css";

function App() {
  const game = useGame();

  return (
    <>
      <Header />
      {game?.game && (
        <>
          <MapLibreView
            options={{
              zoom: 15,
              style:
                "https://wms.wheregroup.com/tileserver/style/osm-fiord-color.json",
              center: [2.3233492066262897, 48.84239878537221],
            }}
          >
            <GameDataLayers />
            <MapSelectionCamera />
          </MapLibreView>
          <GameStatusOverlay />
          <GameInterface />
        </>
      )}
      <ArmyWorkshop />
    </>
  );
}

export default App;
