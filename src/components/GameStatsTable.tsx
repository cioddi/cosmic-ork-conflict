import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { useGame } from "../game/GameContext";
import Player from "../game/classes/Player";
import { GameStateFeatureCollectionType } from "../game/classes/Game";
import { Avatar } from "@mui/material";

interface PlayerStatsType {
  id: number;
  livingUnitCount: number;
  killCount: number;
  damageDealt: number;
  player: Player;
}
function getPlayerStats(
  player: Player,
  geojson: GameStateFeatureCollectionType
): PlayerStatsType {
  let playerUnits = geojson.features.filter(
    (el) => el.properties.playerId === player.id
  );
  let livingUnits = playerUnits.filter((el) => el.properties.hitpoints > 0);
  let killCount = 0;
  let damageDealt = 0;
  playerUnits.forEach((el) => {
    killCount += el.properties.killCount;
    damageDealt += el.properties.damageDealt;
  });

  return {
    id: player.id,
    livingUnitCount: livingUnits.length,
    killCount: killCount,
    damageDealt: damageDealt,
    player,
  };
}

export default function GameStatsTable() {
  const game = useGame();

  const stats = React.useMemo(() => {
    let stats: {
      round: number;
      winner: number | undefined;
      players: PlayerStatsType[];
    } = {
      round: 0,
      players: [],
      winner: undefined,
    };

    if (game?.game && typeof game.geojson !== "undefined") {
      stats.round = game.game.round;
      stats.winner = game.game.winner;
      for (let i = 0; i < game.game.players.length; i++) {
        stats.players.push(getPlayerStats(game.game.players[i], game.geojson));
      }
    }

    return stats;
  }, [game]);
  return (
    <>
      <TableContainer component={Paper}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Game stats</TableCell>
              <TableCell align="right">value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow
              key="round_row"
              sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                turn
              </TableCell>

              <TableCell align="right">{stats.round}</TableCell>
            </TableRow>
            <TableRow
              key="winner_row"
              sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                winner
              </TableCell>

              <TableCell align="right">
                {stats.winner ? "Player " + stats.winner : ""}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <TableContainer component={Paper}>
        <Table aria-label="simple table">
          <TableBody>
            {stats.players.map((el, idx) => [
              <TableRow
                key={"title_row" + idx}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell
                  scope="row"
                  sx={{ display: "flex", alignItems: "center", padding:'5px 16px' }}
                >
                  <Avatar
                    sx={{
                      width: "10px",
                      height: "10px",
                      backgroundColor: el.player.color,
                      marginRight: "5px",
                    }}
                  >
                    &nbsp;
                  </Avatar>
                  <strong>Player {el.id}</strong>
                </TableCell>

                <TableCell 
                  sx={{ padding:'5px 16px' }}
                align="right">&nbsp;</TableCell>
              </TableRow>,
              <TableRow
                key={"kills_row" + idx}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell scope="row">
                  kills
                </TableCell>

                <TableCell align="right">{el.killCount}</TableCell>
              </TableRow>,
              <TableRow
                key={"units_row" + idx}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell scope="row">
                  units left
                </TableCell>

                <TableCell align="right">{el.livingUnitCount}</TableCell>
              </TableRow>,
              <TableRow
                key={"damage_row" + idx}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell scope="row">
                  total damage
                </TableCell>

                <TableCell align="right">{el.damageDealt}</TableCell>
              </TableRow>,
            ])}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
