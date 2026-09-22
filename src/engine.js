/** Pure optical rules. Grid coordinates in segments refer to cell centers. */
export const getCellKey = (cell) => cell.id || `${cell.x},${cell.y}`;
const isRotatable = (cell) =>
  cell.type === "mirror" || cell.type === "splitter";
const vectors = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const reflection = [
  [3, 2, 1, 0],
  [1, 0, 3, 2],
];

export function initialState(level) {
  return Object.fromEntries(
    level.cells
      .filter(isRotatable)
      .map((cell) => [getCellKey(cell), cell.state === 1 ? 1 : 0]),
  );
}

function normalizedState(level, state) {
  const result = initialState(level);
  for (const key of Object.keys(result)) {
    if (
      state &&
      Object.hasOwn(state, key) &&
      (state[key] === 0 || state[key] === 1)
    )
      result[key] = state[key];
  }
  return result;
}

export function evaluate(level, state) {
  const orientations = normalizedState(level, state);
  const grid = new Map(
    level.cells.map((cell) => [`${cell.x},${cell.y}`, cell]),
  );
  const targets = level.cells.filter((cell) => cell.type === "target");
  const segments = [],
    lit = new Set(),
    hit = new Set();
  // DFS colors distinguish a cycle on the current route from a beam that joins
  // an already completed route. The latter is common with multiple sources.
  const active = new Set(),
    complete = new Set();
  let loops = false;
  function trace(x, y, dir, color) {
    const key = `${x},${y}:${dir}:${color}`;
    if (active.has(key)) {
      loops = true;
      return;
    }
    if (complete.has(key)) return;
    active.add(key);
    const [dx, dy] = vectors[dir];
    let nx = x + dx,
      ny = y + dy;
    while (
      nx >= 0 &&
      nx < level.cols &&
      ny >= 0 &&
      ny < level.rows &&
      !grid.has(`${nx},${ny}`)
    ) {
      nx += dx;
      ny += dy;
    }
    const outside = nx < 0 || nx >= level.cols || ny < 0 || ny >= level.rows;
    segments.push({
      x1: x + 0.5,
      y1: y + 0.5,
      x2: outside ? Math.max(0, Math.min(level.cols, nx + 0.5)) : nx + 0.5,
      y2: outside ? Math.max(0, Math.min(level.rows, ny + 0.5)) : ny + 0.5,
      color,
    });
    if (!outside) {
      const cell = grid.get(`${nx},${ny}`),
        cellKey = getCellKey(cell);
      if (cell.type === "target") {
        if (color === (cell.color || "gold")) lit.add(cellKey);
      } else if (cell.type === "sleeper") {
        hit.add(cellKey);
      } else if (cell.type !== "wall") {
        if (isRotatable(cell)) {
          trace(nx, ny, reflection[orientations[cellKey]][dir], color);
          if (cell.type === "splitter") trace(nx, ny, dir, color);
        } else {
          trace(
            nx,
            ny,
            dir,
            cell.type === "filter" ? cell.color || "gold" : color,
          );
        }
      }
    }
    active.delete(key);
    complete.add(key);
  }
  for (const source of level.cells.filter((cell) => cell.type === "source")) {
    trace(
      source.x,
      source.y,
      Number.isInteger(source.dir) && source.dir >= 0 && source.dir < 4
        ? source.dir
        : 0,
      source.color || "gold",
    );
  }
  return {
    won: targets.length > 0 && lit.size === targets.length && hit.size === 0,
    segments,
    lit: [...lit],
    hit: [...hit],
    loops,
  };
}

/** Exhaustive finite-state search by Hamming distance; ties use cell order. */
export function solve(level, state) {
  const current = normalizedState(level, state);
  const keys = Object.keys(current);
  for (let distance = 0; distance <= keys.length; distance++) {
    let result = null;
    const candidate = { ...current },
      moves = [];
    function choose(start, remaining) {
      if (remaining === 0) {
        if (evaluate(level, candidate).won)
          result = { state: { ...candidate }, moves: [...moves], distance };
        return;
      }
      for (let i = start; i <= keys.length - remaining && !result; i++) {
        const key = keys[i];
        candidate[key] = 1 - candidate[key];
        moves.push(key);
        choose(i + 1, remaining - 1);
        moves.pop();
        candidate[key] = 1 - candidate[key];
      }
    }
    choose(0, distance);
    if (result) return result;
  }
  return null;
}
