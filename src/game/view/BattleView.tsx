import { createTheme, ThemeProvider } from "@mui/material/styles";
import "maplibre-gl/dist/maplibre-gl.css";
import GameInterface from "../../components/GameInterface";
import { themeOptions } from "../../theme";
import GameDataLayers from "../GameDataLayers";
import GameStatusOverlay from "./GameStatusOverlay";
import { MapLibreView } from "./MapLibreView";
import MapSelectionCamera from "./MapSelectionCamera";

const theme = createTheme(themeOptions);

export default function BattleView() {
  return (
    <ThemeProvider theme={theme}>
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
    </ThemeProvider>
  );
}
