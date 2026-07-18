import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { MiniatureGeoJsonFeature } from "../game/view/MapLibreSnapshotAdapter";
import { DEFAULT_GAME_RULES } from "../game/rules";

const UNIT_STATS = [
  { key: "hitpoints", label: "Hitpoints" },
  { key: "damageDealt", label: "Damage dealt" },
  { key: "killCount", label: "Kills" },
] as const;

export default function SelectedMiniatureStatsTable(props: {
  miniature: MiniatureGeoJsonFeature;
}) {
  const miniature = props.miniature.properties;

  return (
    <>
      <TableContainer className="battle-data-table" component={Paper}>
        <Table aria-label="Selected unit statistics">
          <TableHead>
            <TableRow>
              <TableCell>Unit telemetry</TableCell>
              <TableCell align="right">Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {UNIT_STATS.map((stat) => (
              <TableRow
                key={stat.key}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {stat.label}
                </TableCell>

                <TableCell align="right">{miniature[stat.key]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <section
        className="battle-selected-weapons"
        aria-label={`${miniature.name} weapons`}
      >
        <div className="battle-selected-weapons__heading">
          <span>Loadout</span>
          <strong>Weapons</strong>
        </div>
        <div className="battle-selected-weapons__list">
          {miniature.weapons.map((weapon, index) => {
            const isRanged =
              weapon.range > DEFAULT_GAME_RULES.closeCombatRangeMeters;
            const attackProfile = isRanged
              ? `RNG ${weapon.range}m · HIT ${miniature.rangeAttack}+`
              : `MELEE · ATK +${miniature.meleeAttack}`;

            return (
              <article
                className="battle-selected-weapon"
                key={`${weapon.name}-${index}`}
                title={weapon.description}
                aria-label={`${weapon.name}, damage ${weapon.damage}, ${attackProfile}`}
              >
                <strong>{weapon.name}</strong>
                <span className="battle-selected-weapon__damage">
                  DMG {weapon.damage}
                </span>
                <span>{attackProfile}</span>
              </article>
            );
          })}
          {miniature.weapons.length === 0 && (
            <p className="battle-selected-weapons__empty">No weapons equipped</p>
          )}
        </div>
      </section>
    </>
  );
}
