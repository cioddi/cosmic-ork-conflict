import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { MiniatureGeoJsonFeature } from "../game/view/MapLibreSnapshotAdapter";
import { getUnitImageSrc } from "../game/unitAppearance";
import { MiniatureType } from "../game/classes/Miniature";
import { Avatar, CardHeader, IconButton } from "@mui/material";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { useGame } from "../game/GameContext";

export default function SelectedMiniatureCard(props: {
  miniature: MiniatureGeoJsonFeature;
}) {
  const game = useGame();
  const playerColor =
    game?.game?.players[props.miniature.properties.playerId - 1]?.color;

  return (
    <Card className="battle-selected-card" sx={{ width: "100%" }}>
      <CardHeader
        className="battle-selected-card__header"
        avatar={
          <Avatar
            className="battle-selected-card__avatar"
            sx={{
              borderColor: playerColor,
            }}
            aria-label={`${props.miniature.properties.name} portrait`}
          >
            <img
              style={{ width: "100%" }}
              src={getUnitImageSrc(props.miniature.properties)}
              alt={props.miniature.properties.description}
            />
          </Avatar>
        }
        title={props.miniature.properties.name}
        subheader={
          MiniatureType[props.miniature.properties.type] +
          " " +
          (props.miniature.properties.hitpoints > 0 ? "" : "(*dead*)")
        }
        titleTypographyProps={{
          className: "battle-selected-card__name",
        }}
        subheaderTypographyProps={{
          className: "battle-selected-card__type",
        }}
        action={
          <IconButton
            className="battle-selected-card__close"
            aria-label="deselect"
            onClick={() => game?.setSelectedMiniatureId(undefined)}
          >
            <HighlightOffIcon />
          </IconButton>
        }
      />
      <CardContent className="battle-selected-card__content">
        <Typography className="battle-selected-card__description" variant="body2">
          {props.miniature.properties.description}
        </Typography>
      </CardContent>
    </Card>
  );
}
