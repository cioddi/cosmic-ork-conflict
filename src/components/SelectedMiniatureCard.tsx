import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { MiniatureGeoJsonFeature } from "../game/classes/Game";
import { getImageSrcFromProps } from "../game/GameDataLayers";
import { MiniatureType } from "../game/classes/Miniature";
import { Avatar, CardHeader, IconButton } from "@mui/material";
import { red } from "@mui/material/colors";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { useGame } from "../game/GameContext";

export default function SelectedMiniatureCard(props: {
  miniature: MiniatureGeoJsonFeature;
}) {
  const game = useGame();

  return (
    <Card sx={{ width: "100%" }}>
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
            <img
              src={getImageSrcFromProps(props.miniature.properties)}
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
          color: "primary.main",
        }}
        action={
          <IconButton
            aria-label="deselect"
            onClick={() => game?.setSelectedMiniatureId(undefined)}
          >
            <HighlightOffIcon />
          </IconButton>
        }
      />
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {props.miniature.properties.description}
        </Typography>
      </CardContent>
    </Card>
  );
}
