import React, { useMemo, useState } from "react";
import {
  Box,
  Checkbox,
  Grid,
  List,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useGame } from "../game/GameContext";
import LeaderListItem from "./LeaderListItem";
import { MiniatureGeoJsonFeature } from "../game/classes/Game";
import { MlGeoJsonLayer } from "@mapcomponents/react-maplibre";
import SelectedMiniatureCard from "./SelectedMiniatureCard";
import SelectedMiniatureStatsTable from "./SelectedMiniatureStatsTable";
import GameStatsTable from "./GameStatsTable";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export default function GameInterface() {
  const theme = useTheme();
  const matchesXs = useMediaQuery(theme.breakpoints.down(600));
  const game = useGame();
  const [hideTheDead, setHideTheDead] = useState(false);

  const leaders = useMemo(() => {
    let _leaders: MiniatureGeoJsonFeature[] = [
      ...(game?.geojson?.features ? game?.geojson?.features : []),
    ];
    if (hideTheDead) {
      _leaders = _leaders.filter((el) => el.properties.hitpoints > 0);
    }

    return _leaders.sort((el1, el2) => {
      return el2?.properties?.killCount - el1?.properties?.killCount;
    });
  }, [game, hideTheDead]);

  return (
    <Grid
      container
      sx={{
        position: "fixed",
        bottom: 0,
        bgcolor: "background.paper",
        height: "30vh",
        overflow: matchesXs ? "auto" : "none",
      }}
    >
      <Grid
        item
        sm={4}
        xs={12}
        sx={{
          height: matchesXs ? "initial" : "100%",
          overflow: matchesXs ? "initial" : "auto",
        }}
      >
        <Box>
          <Checkbox
            inputProps={{ "aria-label": "hide the dead" }}
            icon={<VisibilityIcon />}
            checkedIcon={<VisibilityOffIcon />}
            onClick={() => {
              setHideTheDead((val) => !val);
            }}
          />
        </Box>

        <List sx={{ width: "100%", padding: 0 }}>
          {leaders.map((el: any, idx: number) => (
            <LeaderListItem key={"item" + idx} miniature={el}></LeaderListItem>
          ))}
        </List>
      </Grid>
      <Grid item sm={4} xs={12} sx={{ height: "100%", overflow: "auto", display: "flex" }}>
        {game?.selectedMiniature && (
          <>
            <SelectedMiniatureCard
              key="miniatureCard"
              miniature={game.selectedMiniature}
            />
            <MlGeoJsonLayer
              key="selectedMiniatureIndicator"
              geojson={game.selectedMiniature}
              paint={{
                "circle-radius": 25,
                "circle-opacity": 0,
                "circle-color": "rgba(0,0,0,0)",
                "circle-stroke-width": 4,
                "circle-stroke-color": "#b4ddff",
              }}
            />
          </>
        )}
      </Grid>
      <Grid
        item
        sm={4}
        xs={12}
        sx={{ height: "100%", overflow: "auto", display: "flex" }}
      >
        {game?.selectedMiniature ? (
          <>
            <SelectedMiniatureStatsTable miniature={game.selectedMiniature} />
          </>
        ) : (
          <>
            <GameStatsTable />
          </>
        )}
      </Grid>
    </Grid>
  );
}
