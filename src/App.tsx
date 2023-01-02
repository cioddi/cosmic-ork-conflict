import React from "react";
import "./App.css";
import { MapLibreMap } from "@mapcomponents/react-maplibre";
import GameDataLayers from "./game/GameDataLayers";
import Header from "./components/Header";
import GameInterface from "./components/GameInterface";


import "maplibre-gl/dist/maplibre-gl.css";

function App() {
  return (
    <>
      <Header />
      <MapLibreMap
        mapId="map_1"
        options={{
          zoom: 14,
          style:
            "https://wms.wheregroup.com/tileserver/style/osm-fiord-color.json",
          center: [2.3239752536248943, 48.844339364968505],
        }}
      />
      <GameDataLayers />
      <GameInterface />
    </>
  );
}

export default App;
