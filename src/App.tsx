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
          zoom: 15,
          style:
            "https://wms.wheregroup.com/tileserver/style/osm-fiord-color.json",
          center: [2.3233492066262897, 48.84239878537221],
        }}
      />
      <GameDataLayers />
      <GameInterface />
    </>
  );
}

export default App;
