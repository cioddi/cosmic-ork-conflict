import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import { getUnitImageSrc } from "../game/unitAppearance";
import { MiniatureGeoJsonFeature } from "../game/view/MapLibreSnapshotAdapter";
import { useGame } from "../game/GameContext";

import LinearProgress from "@mui/material/LinearProgress";

export default function FolderList(props: {
  miniature: MiniatureGeoJsonFeature;
}) {
  const game = useGame();
  const isSelected =
    game?.selectedMiniatureId === props.miniature.properties.id;
  const isDead = props.miniature.properties.hitpoints <= 0;
  return (
    <ListItem
      className={`battle-roster-unit${isSelected ? " is-selected" : ""}${
        isDead ? " is-fallen" : ""
      }`}
      tabIndex={0}
      onClick={() => {
        game?.setSelectedMiniatureId(props?.miniature?.properties?.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          game?.setSelectedMiniatureId(props.miniature.properties.id);
        }
      }}
    >
      <ListItemAvatar>
        <Avatar
          className="battle-roster-unit__avatar"
          sx={{
            border:
              "2px solid " +
              game?.game?.players[props.miniature.properties.playerId - 1]
                .color,
          }}
        >
          <img
            style={{ width: "100%" }}
            src={getUnitImageSrc(props.miniature.properties)}
            alt={props.miniature.properties.description}
          />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={props.miniature.properties.name}
        slotProps={{
          primary: {
            className: "battle-roster-unit__name",
          },
          secondary: {
            className: "battle-roster-unit__meta",
          },
        }}
        secondary={`${props.miniature.properties.killCount} kills${
          isDead ? " · fallen" : ""
        }`}
      />
      <LinearProgress
        className="battle-unit-health"
        variant="determinate"
        value={
          props?.miniature?.properties?.initialHitpoints
            ? (props.miniature.properties.hitpoints /
                props.miniature.properties.initialHitpoints) *
              100
            : 0
        }
      />
    </ListItem>
  );
}
