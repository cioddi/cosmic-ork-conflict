import { GameWorld } from "../world/GameWorld";
import { distance } from "../world/geometry";
import { WorldPoint } from "../world/types";

interface GridCell {
  column: number;
  row: number;
}

interface GridTopology {
  columns: number;
  rows: number;
  walkable: Uint8Array;
  componentIds: Int32Array;
  largestComponentId: number;
}

interface NavigationGrid extends GridTopology {
  cameFrom: Int32Array;
  costs: Float64Array;
  visitedGeneration: Int32Array;
  closedGeneration: Int32Array;
  searchGeneration: number;
}

/** Conservative grid A* with exact world-geometry validation. */
export class GridNavigation {
  private grid: NavigationGrid | undefined;
  private readonly cellSize: number;
  private readonly gridClearance: number;

  constructor(private readonly world: GameWorld) {
    this.cellSize = world.definition.navigationCellSizeMeters;
    this.gridClearance =
      Math.max(
        0,
        ...world.definition.mobilityProfiles.map(
          (profile) => profile.clearanceMeters
        )
      ) +
      (this.cellSize * Math.SQRT2) / 2;
  }

  initialize(): void {
    this.gridFor();
  }

  findPath(
    start: WorldPoint,
    goal: WorldPoint,
    mobilityProfileId: string
  ): WorldPoint[] {
    if (!this.world.canOccupy(start, mobilityProfileId)) {
      return [];
    }
    if (
      this.world.canOccupy(goal, mobilityProfileId) &&
      this.world.canTraverse(start, goal, mobilityProfileId)
    ) {
      return [start, goal];
    }

    const grid = this.gridFor();
    const startCell = this.closestConnectableCell(start, mobilityProfileId, grid);
    if (!startCell) return [];
    const componentId = grid.componentIds[this.cellIndex(startCell, grid)];
    const goalCell = this.closestCellInComponent(goal, componentId, grid);
    if (!goalCell) return [];

    const cellPath = this.aStar(startCell, goalCell, grid);
    if (cellPath.length === 0) return [];
    const rawPath: WorldPoint[] = [
      start,
      ...cellPath.map((cell) => this.cellCenter(cell)),
    ];
    const approachPoint = rawPath[rawPath.length - 1];
    if (
      distance(approachPoint, goal) > 1e-6 &&
      this.world.canTraverse(approachPoint, goal, mobilityProfileId)
    ) {
      rawPath.push(goal);
    }
    const deduplicated = rawPath.filter(
      (point, index) => index === 0 || distance(point, rawPath[index - 1]) > 1e-6
    );
    const smoothed = this.smooth(deduplicated, mobilityProfileId);
    return this.isPathValid(smoothed, mobilityProfileId) ? smoothed : [];
  }

  isPathValid(path: readonly WorldPoint[], mobilityProfileId: string): boolean {
    if (path.length < 2) return false;
    for (let index = 1; index < path.length; index++) {
      if (!this.world.canTraverse(path[index - 1], path[index], mobilityProfileId)) {
        return false;
      }
    }
    return true;
  }

  /** True when a position can connect to the largest navigable region. */
  isInMainNavigableArea(point: WorldPoint, mobilityProfileId: string): boolean {
    if (!this.world.canOccupy(point, mobilityProfileId)) return false;
    const grid = this.gridFor();
    const cell = this.closestConnectableCell(point, mobilityProfileId, grid);
    return Boolean(
      cell &&
        grid.componentIds[this.cellIndex(cell, grid)] === grid.largestComponentId
    );
  }

  private gridFor(): NavigationGrid {
    if (this.grid) return this.grid;
    const bounds = this.world.routingBounds;
    const columns = Math.ceil((bounds.maxX - bounds.minX) / this.cellSize);
    const rows = Math.ceil((bounds.maxY - bounds.minY) / this.cellSize);
    const walkable = new Uint8Array(columns * rows);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        if (
          this.world.canOccupyWithClearance(
            this.cellCenter({ column, row }),
            this.gridClearance
          )
        ) {
          walkable[row * columns + column] = 1;
        }
      }
    }
    const { componentIds, largestComponentId } = this.labelComponents({
      columns,
      rows,
      walkable,
      componentIds: new Int32Array(walkable.length),
      largestComponentId: -1,
    });
    const grid = {
      columns,
      rows,
      walkable,
      componentIds,
      largestComponentId,
      cameFrom: new Int32Array(walkable.length),
      costs: new Float64Array(walkable.length),
      visitedGeneration: new Int32Array(walkable.length),
      closedGeneration: new Int32Array(walkable.length),
      searchGeneration: 0,
    };
    this.grid = grid;
    return grid;
  }

  private closestCellInComponent(
    point: WorldPoint,
    componentId: number,
    grid: NavigationGrid
  ): GridCell | null {
    const origin = this.pointToCell(point, grid);
    if (!origin) return null;
    const maxRadius = 12;
    for (let radius = 0; radius <= maxRadius; radius++) {
      let best: GridCell | null = null;
      let bestDistance = Infinity;
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset++) {
          if (
            radius > 0 &&
            Math.abs(rowOffset) !== radius &&
            Math.abs(columnOffset) !== radius
          ) {
            continue;
          }
          const candidate = {
            column: origin.column + columnOffset,
            row: origin.row + rowOffset,
          };
          if (!this.isWalkable(candidate, grid)) continue;
          if (
            grid.componentIds[this.cellIndex(candidate, grid)] !== componentId
          ) {
            continue;
          }
          const candidateDistance = distance(point, this.cellCenter(candidate));
          if (candidateDistance < bestDistance) {
            best = candidate;
            bestDistance = candidateDistance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  private closestConnectableCell(
    point: WorldPoint,
    mobilityProfileId: string,
    grid: NavigationGrid
  ): GridCell | null {
    const origin = this.pointToCell(point, grid);
    if (!origin) return null;
    const maxRadius = 12;
    for (let radius = 0; radius <= maxRadius; radius++) {
      let best: GridCell | null = null;
      let bestDistance = Infinity;
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset++) {
          if (
            radius > 0 &&
            Math.abs(rowOffset) !== radius &&
            Math.abs(columnOffset) !== radius
          ) {
            continue;
          }
          const candidate = {
            column: origin.column + columnOffset,
            row: origin.row + rowOffset,
          };
          if (!this.isWalkable(candidate, grid)) continue;
          const center = this.cellCenter(candidate);
          if (!this.world.canTraverse(point, center, mobilityProfileId)) continue;
          const candidateDistance = distance(point, center);
          if (candidateDistance < bestDistance) {
            best = candidate;
            bestDistance = candidateDistance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  private labelComponents(grid: GridTopology): {
    componentIds: Int32Array;
    largestComponentId: number;
  } {
    const componentIds = new Int32Array(grid.walkable.length);
    componentIds.fill(-1);
    let componentId = 0;
    let largestComponentId = -1;
    let largestSize = 0;

    for (let index = 0; index < grid.walkable.length; index++) {
      if (grid.walkable[index] !== 1 || componentIds[index] !== -1) continue;
      const queue = [index];
      componentIds[index] = componentId;
      let cursor = 0;
      while (cursor < queue.length) {
        const currentIndex = queue[cursor++];
        const current = this.indexToCell(currentIndex, grid);
        for (const neighbor of this.neighbors(current, grid)) {
          const neighborIndex = this.cellIndex(neighbor, grid);
          if (componentIds[neighborIndex] !== -1) continue;
          componentIds[neighborIndex] = componentId;
          queue.push(neighborIndex);
        }
      }
      if (queue.length > largestSize) {
        largestSize = queue.length;
        largestComponentId = componentId;
      }
      componentId++;
    }
    return { componentIds, largestComponentId };
  }

  private aStar(start: GridCell, goal: GridCell, grid: NavigationGrid): GridCell[] {
    const startIndex = this.cellIndex(start, grid);
    const goalIndex = this.cellIndex(goal, grid);
    const queue = new MinHeap();
    if (grid.searchGeneration >= 2_147_483_646) {
      grid.visitedGeneration.fill(0);
      grid.closedGeneration.fill(0);
      grid.searchGeneration = 0;
    }
    const generation = ++grid.searchGeneration;
    grid.cameFrom[startIndex] = -1;
    grid.costs[startIndex] = 0;
    grid.visitedGeneration[startIndex] = generation;
    queue.push(startIndex, 0);

    while (queue.size > 0) {
      const currentIndex = queue.pop()!;
      if (grid.closedGeneration[currentIndex] === generation) continue;
      if (currentIndex === goalIndex) {
        return this.reconstruct(grid.cameFrom, currentIndex, grid);
      }
      grid.closedGeneration[currentIndex] = generation;
      const currentColumn = currentIndex % grid.columns;
      const currentRow = Math.floor(currentIndex / grid.columns);
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
          if (rowOffset === 0 && columnOffset === 0) continue;
          const column = currentColumn + columnOffset;
          const row = currentRow + rowOffset;
          if (!this.isWalkableAt(column, row, grid)) continue;
          if (
            rowOffset !== 0 &&
            columnOffset !== 0 &&
            (!this.isWalkableAt(column, currentRow, grid) ||
              !this.isWalkableAt(currentColumn, row, grid))
          ) {
            continue;
          }
          const neighborIndex = row * grid.columns + column;
          if (grid.closedGeneration[neighborIndex] === generation) continue;
          const diagonal = rowOffset !== 0 && columnOffset !== 0;
          const nextCost =
            grid.costs[currentIndex] + (diagonal ? Math.SQRT2 : 1);
          if (
            grid.visitedGeneration[neighborIndex] === generation &&
            nextCost >= grid.costs[neighborIndex]
          ) {
            continue;
          }
          grid.costs[neighborIndex] = nextCost;
          grid.cameFrom[neighborIndex] = currentIndex;
          grid.visitedGeneration[neighborIndex] = generation;
          const deltaX = Math.abs(goal.column - column);
          const deltaY = Math.abs(goal.row - row);
          const heuristic =
            Math.max(deltaX, deltaY) +
            (Math.SQRT2 - 1) * Math.min(deltaX, deltaY);
          queue.push(neighborIndex, nextCost + heuristic);
        }
      }
    }
    return [];
  }

  private neighbors(cell: GridCell, grid: GridTopology): GridCell[] {
    const result: GridCell[] = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const candidate = {
          column: cell.column + columnOffset,
          row: cell.row + rowOffset,
        };
        if (!this.isWalkable(candidate, grid)) continue;
        if (rowOffset !== 0 && columnOffset !== 0) {
          if (
            !this.isWalkable({ column: candidate.column, row: cell.row }, grid) ||
            !this.isWalkable({ column: cell.column, row: candidate.row }, grid)
          ) {
            continue;
          }
        }
        result.push(candidate);
      }
    }
    return result;
  }

  private reconstruct(
    cameFrom: Int32Array,
    currentIndex: number,
    grid: NavigationGrid
  ): GridCell[] {
    const path: GridCell[] = [];
    let cursor = currentIndex;
    while (cursor >= 0) {
      path.push(this.indexToCell(cursor, grid));
      cursor = cameFrom[cursor];
    }
    return path.reverse();
  }

  private smooth(path: WorldPoint[], mobilityProfileId: string): WorldPoint[] {
    if (path.length <= 2) return path;
    const result: WorldPoint[] = [path[0]];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let next = path.length - 1;
      while (
        next > anchor + 1 &&
        !this.world.canTraverse(path[anchor], path[next], mobilityProfileId)
      ) {
        next--;
      }
      result.push(path[next]);
      anchor = next;
    }
    return result;
  }

  private pointToCell(point: WorldPoint, grid: NavigationGrid): GridCell | null {
    const column = Math.floor((point[0] - this.world.routingBounds.minX) / this.cellSize);
    const row = Math.floor((point[1] - this.world.routingBounds.minY) / this.cellSize);
    if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return null;
    return { column, row };
  }

  private cellCenter(cell: GridCell): WorldPoint {
    return [
      this.world.routingBounds.minX + (cell.column + 0.5) * this.cellSize,
      this.world.routingBounds.minY + (cell.row + 0.5) * this.cellSize,
    ];
  }

  private isWalkable(cell: GridCell, grid: GridTopology): boolean {
    return this.isWalkableAt(cell.column, cell.row, grid);
  }

  private isWalkableAt(
    column: number,
    row: number,
    grid: GridTopology
  ): boolean {
    return (
      column >= 0 &&
      row >= 0 &&
      column < grid.columns &&
      row < grid.rows &&
      grid.walkable[row * grid.columns + column] === 1
    );
  }

  private cellIndex(cell: GridCell, grid: GridTopology): number {
    return cell.row * grid.columns + cell.column;
  }

  private indexToCell(index: number, grid: GridTopology): GridCell {
    return { column: index % grid.columns, row: Math.floor(index / grid.columns) };
  }
}

class MinHeap {
  private indices: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.indices.length;
  }

  push(entryIndex: number, priority: number): void {
    this.indices.push(entryIndex);
    this.priorities.push(priority);
    let index = this.indices.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.priorities[parent] <= priority) break;
      this.indices[index] = this.indices[parent];
      this.priorities[index] = this.priorities[parent];
      index = parent;
    }
    this.indices[index] = entryIndex;
    this.priorities[index] = priority;
  }

  pop(): number | undefined {
    if (this.indices.length === 0) return undefined;
    const first = this.indices[0];
    const lastIndex = this.indices.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.indices.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.indices.length) break;
      const child =
        right < this.indices.length &&
        this.priorities[right] < this.priorities[left]
          ? right
          : left;
      if (this.priorities[child] >= lastPriority) break;
      this.indices[index] = this.indices[child];
      this.priorities[index] = this.priorities[child];
      index = child;
    }
    this.indices[index] = lastIndex;
    this.priorities[index] = lastPriority;
    return first;
  }
}
