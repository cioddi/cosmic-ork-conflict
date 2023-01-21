import * as React from "react";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import { getImageSrcFromProps } from "../game/GameDataLayers";
import { MiniatureGeoJsonFeature } from "../game/classes/Game";
import { useGame } from "../game/GameContext";

export default function FolderList(props: {
  miniature: MiniatureGeoJsonFeature;
}) {
  const game = useGame();
  return (
    <ListItem
      sx={{
        padding: "0 15px",
        cursor: "pointer",
        backgroundColor:
          game?.selectedMiniatureId === props.miniature.properties.id
            ? "primary.dark"
            : "initial",
      }}
      onClick={() => {
        console.log(props?.miniature?.properties?.id);
        game?.setSelectedMiniatureId(props?.miniature?.properties?.id);
      }}
    >
      <ListItemAvatar>
        <Avatar
          sx={{
            border:
              "2px solid " +
              game?.game?.players[props.miniature.properties.playerId - 1]
                .color,
          }}
        >
          <img
            src={getImageSrcFromProps(props.miniature.properties)}
            alt={props.miniature.properties.description}
          />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={props.miniature.properties.name}
        primaryTypographyProps={{
          color:
            game?.selectedMiniatureId === props.miniature.properties.id
              ? "primary.contrastText"
              : "primary.main",
        }}
        secondary={
          "Kills: " +
          props.miniature.properties.killCount +
          " " +
          (props.miniature.properties.hitpoints > 0 ? "" : "(*dead*)")
        }
      />
    </ListItem>
  );
}
