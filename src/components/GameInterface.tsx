import { useEffect, useMemo, useState } from "react";
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
import { MiniatureGeoJsonFeature } from "../game/view/MapLibreSnapshotAdapter";
import SelectedMiniatureCard from "./SelectedMiniatureCard";
import SelectedMiniatureStatsTable from "./SelectedMiniatureStatsTable";
import GameStatsTable from "./GameStatsTable";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CasinoIcon from "@mui/icons-material/Casino";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import "./GameInterface.css";

export default function GameInterface() {
  const theme = useTheme();
  const matchesXs = useMediaQuery(theme.breakpoints.down(600));
  const game = useGame();
  const [hideTheDead, setHideTheDead] = useState(false);
  const [selectedView, setSelectedView] = useState<
    "units" | "selected" | "game"
  >("units");

  const leaders = useMemo(() => {
    let _leaders: MiniatureGeoJsonFeature[] = [...(game?.geojson?.features ?? [])];
    if (hideTheDead) {
      _leaders = _leaders.filter((el) => el.properties.hitpoints > 0);
    }

    return _leaders.sort((el1, el2) => {
      return el2.properties.killCount - el1.properties.killCount;
    });
  }, [game, hideTheDead]);

  useEffect(() => {
    if (!game?.selectedMiniatureId) return;

    setSelectedView("selected");
  }, [game?.selectedMiniatureId]);

  return (
    <>
      {matchesXs && (
        <Box className="battle-view-switcher">
          <ToggleButtonGroup
            className="battle-view-switcher__group"
            value={selectedView}
            exclusive
            onChange={(_event, val) => {
              if (val) setSelectedView(val);
            }}
            aria-label="Battle information view"
          >
            <ToggleButton value="units" aria-label="Show combat roster">
              <FormatListBulletedIcon />
            </ToggleButton>
            {game?.selectedMiniature && (
              <ToggleButton value="selected" aria-label="Show selected unit">
                <SmartToyIcon />
              </ToggleButton>
            )}
            <ToggleButton value="game" aria-label="Show battle stats">
              <CasinoIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}
      <Grid
        container
        className="game-interface-bar"
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          boxSizing: "border-box",
          height: "30%",
          overflow: matchesXs ? "auto" : "hidden",
        }}
      >
        <Grid
          className="battle-interface-panel"
          size={{ sm: 4, xs: 12 }}
          sx={{
            ...(matchesXs
              ? { display: selectedView === "units" ? "block" : "none" }
              : {}),
            height: matchesXs ? "initial" : "100%",
            overflow: matchesXs ? "initial" : "auto",
          }}
        >
          <Box className="battle-panel-heading">
            <div>
              <span className="battle-panel-heading__eyebrow">Field command</span>
              <strong>Combat roster</strong>
            </div>
            <label className="battle-roster-filter">
              <span>Hide fallen</span>
              <Checkbox
                className="battle-roster-filter__toggle"
                size="small"
                slotProps={{ input: { "aria-label": "hide the dead" } }}
                icon={<VisibilityIcon />}
                checkedIcon={<VisibilityOffIcon />}
                onClick={() => {
                  setHideTheDead((val) => !val);
                }}
              />
            </label>
          </Box>

          <List
            className="battle-roster-list"
            sx={{ width: "100%", padding: 0 }}
          >
            {leaders.map((leader) => (
              <LeaderListItem
                key={leader.properties.id}
                miniature={leader}
              />
            ))}
          </List>
        </Grid>
        <Grid
          className="battle-interface-panel battle-selected-panel"
          size={{ sm: 4, xs: 12 }}
          sx={{
            ...(matchesXs
              ? { display: selectedView === "selected" ? "block" : "none" }
              : {}),
            flexDirection: "column",
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
            </>
          )}
          {!game?.selectedMiniature && (
            <div className="battle-panel-empty">
              <span>Unit telemetry</span>
              <strong>No unit selected</strong>
              <p>Select a unit on the map or from the combat roster.</p>
            </div>
          )}
        </Grid>
        <Grid
          className="battle-interface-panel battle-game-panel"
          size={{ sm: 4, xs: 12 }}
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
