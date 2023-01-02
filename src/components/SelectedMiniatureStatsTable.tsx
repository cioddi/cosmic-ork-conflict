import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { MiniatureGeoJsonFeature } from "../game/classes/Game";

export default function SelectedMiniatureStatsTable(props: {
  miniature: MiniatureGeoJsonFeature;
}) {
  return (
    <TableContainer component={Paper}>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>stat</TableCell>
            <TableCell align="right">value</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props?.miniature?.properties &&
            ["hitpoints", "damageDealt", "killCount"].map((key) => (
              <TableRow
                key={key}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {key}
                </TableCell>

                <TableCell align="right">
                  {(props?.miniature?.properties as any)[key]}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
