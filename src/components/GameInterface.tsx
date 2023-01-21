import React, { useMemo, useState } from "react";
import {
  Box,
  Checkbox,
  Grid,
  List,
  ToggleButton,
  ToggleButtonGroup,
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
import CasinoIcon from "@mui/icons-material/Casino";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";

export default function GameInterface() {
  const theme = useTheme();
  const matchesXs = useMediaQuery(theme.breakpoints.down(600));
  const game = useGame();
  const [hideTheDead, setHideTheDead] = useState(false);
  const [selectedView, setSelectedView] = useState<
    "units" | "selected" | "game"
  >("units");

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
    <>
      {matchesXs && (
        <Box sx={{ position: "fixed", bottom: "30%" }}>
          <ToggleButtonGroup
            value={selectedView}
            exclusive
            onChange={(ev, val) => {
              setSelectedView(val);
            }}
            aria-label="text alignment"
          >
            <ToggleButton value="units" aria-label="left aligned">
              <FormatListBulletedIcon />
            </ToggleButton>
            <ToggleButton value="selected" aria-label="centered">
              <SmartToyIcon />
            </ToggleButton>
            <ToggleButton value="game" aria-label="right aligned">
              <CasinoIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}
      <Grid
        container
        sx={{
          position: "fixed",
          bottom: 0,
          bgcolor: "background.paper",
          height: "30%",
          overflow: matchesXs ? "auto" : "none",
        }}
      >
        <Grid
          item
          sm={4}
          xs={12}
          sx={{
            ...(matchesXs
              ? { display: selectedView === "units" ? "block" : "none" }
              : {}),
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
              <LeaderListItem
                key={"item" + idx}
                miniature={el}
              ></LeaderListItem>
            ))}
          </List>
        </Grid>
        <Grid
          item
          sm={4}
          xs={12}
          sx={{
            display: "flex",
            ...(matchesXs
              ? { display: selectedView === "selected" ? "flex" : "none" }
              : {}),
            flexDirection: 'column',
            height: "100%",
            overflow: "auto",
          }}
        >
          {game?.selectedMiniature && (
            <>
              <SelectedMiniatureCard
                key="miniatureCard"
                miniature={game.selectedMiniature}
              />
              <SelectedMiniatureStatsTable miniature={game.selectedMiniature} />
              <MlGeoJsonLayer
                key="selectedMiniatureIndicator"
                geojson={game.selectedMiniature}
                paint={{
                  "circle-radius": [
                    "interpolate",
                    ["exponential", 2],
                    ["zoom"],
                    10,
                    // @ts-ignore
                    [ "*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, -6] ],
                    24,
                    // @ts-ignore
                    [ "*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, 8] ],
                  ],
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
          sx={{
            display: "flex",
            ...(matchesXs
              ? { display: selectedView === "game" ? "flex" : "none" }
              : {}),
            height: "100%",
            overflow: "auto",
          }}
        >
          <GameStatsTable />
        </Grid>
      </Grid>
    </>
  );
}
