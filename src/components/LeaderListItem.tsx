import * as React from "react";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import { getUnitImageSrc } from "../game/unitAppearance";
import { MiniatureGeoJsonFeature } from "../game/view/MapLibreSnapshotAdapter";
import { useGame } from "../game/GameContext";

import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import { styled } from "@mui/material";

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
  width: "50px",
  height: "5px",
  borderRadius: "5px",
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: theme.palette.error.main,
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 5,
    backgroundColor: theme.palette.success,
  },
}));

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
            ? (theme) => theme.palette.grey['600']
            : "initial",
      }}
      onClick={() => {
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
            backgroundColor: "grey.main",
            display: "flex",
            flexDirection: "column",
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
            sx: {
              color: "text.primary",
              fontWeight: 700,
              letterSpacing: "0.01em",
            },
          },
        }}
        secondary={
          "Kills: " +
          props.miniature.properties.killCount +
          " " +
          (props.miniature.properties.hitpoints > 0 ? "" : "(*dead*)")
        }
      />
      <BorderLinearProgress
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
