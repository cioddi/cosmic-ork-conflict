import { MovementTrace } from "../classes/Game";
import { sampleMovementTrace } from "./MapLibreSnapshotAdapter";

const trace: MovementTrace = {
  unitId: "unit",
  points: [[0, 0], [10, 0], [10, 30]],
  segmentLengths: [10, 30],
  totalDistance: 40,
  startedAtTick: 1,
};

test("samples a multi-segment movement trace by distance, not endpoint chord", () => {
  expect(sampleMovementTrace(trace, 0).position).toEqual([0, 0]);
  expect(sampleMovementTrace(trace, 0.25).position).toEqual([10, 0]);
  expect(sampleMovementTrace(trace, 0.5).position).toEqual([10, 10]);
  expect(sampleMovementTrace(trace, 1).position).toEqual([10, 30]);
});

test("clamps trace samples and reports segment bearing", () => {
  expect(sampleMovementTrace(trace, -1).position).toEqual([0, 0]);
  expect(sampleMovementTrace(trace, 2).position).toEqual([10, 30]);
  expect(sampleMovementTrace(trace, 0.5).bearing).toBeCloseTo(0, 8);
});

