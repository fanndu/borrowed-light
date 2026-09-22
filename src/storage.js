export const SAVE_KEY = "borrowed-light:v1";
export function freshSave() {
  return {
    game: "borrowed-light",
    version: 1,
    completed: {},
    active: null,
    settings: { sound: true, reducedMotion: false },
    updatedAt: new Date().toISOString(),
  };
}
const integer = (n, max = 1000000) =>
  Number.isSafeInteger(n) && n >= 0 && n <= max;
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export function validateSave(raw, levels) {
  if (
    !plain(raw) ||
    raw.game !== "borrowed-light" ||
    raw.version !== 1 ||
    !plain(raw.completed) ||
    !plain(raw.settings)
  )
    throw new Error("这不是兼容的《借光》进度文件。");
  const data = freshSave();
  const known = new Map(levels.map((l) => [String(l.id), l]));
  for (const [id, score] of Object.entries(raw.completed)) {
    if (
      !known.has(id) ||
      !plain(score) ||
      !integer(score.stars, 3) ||
      score.stars < 1 ||
      !integer(score.bestMoves)
    )
      throw new Error("进度中的关卡成绩不完整。");
    data.completed[id] = { stars: score.stars, bestMoves: score.bestMoves };
  }
  let gap = false;
  for (const level of levels) {
    if (!data.completed[level.id]) gap = true;
    else if (gap) throw new Error("解锁记录不连续。");
  }
  for (const key of ["sound", "reducedMotion"]) {
    if (typeof raw.settings[key] !== "boolean")
      throw new Error("进度中的设置不完整。");
    data.settings[key] = raw.settings[key];
  }
  if (raw.active != null) {
    const a = raw.active,
      level = known.get(String(a.levelId));
    if (
      !level ||
      level.id > nextUnlocked(data, levels) ||
      !integer(a.moves) ||
      !integer(a.hints)
    )
      throw new Error("进行中的关卡记录无效。");
    if (a.submitted != null && typeof a.submitted !== "boolean")
      throw new Error("过关状态无效。");
    if (a.submitted && !data.completed[level.id])
      throw new Error("过关状态与成绩不一致。");
    const keys = level.cells
      .filter((c) => ["mirror", "splitter"].includes(c.type))
      .map((c) => c.id || `${c.x},${c.y}`);
    const orientation = (input) => {
      if (
        !plain(input) ||
        Object.keys(input).length !== keys.length ||
        keys.some((k) => input[k] !== 0 && input[k] !== 1)
      )
        throw new Error("镜面状态不完整。");
      return Object.fromEntries(keys.map((k) => [k, input[k]]));
    };
    if (!Array.isArray(a.history) || a.history.length > 1000)
      throw new Error("撤销记录无效。");
    data.active = {
      levelId: level.id,
      orientation: orientation(a.orientation),
      moves: a.moves,
      hints: a.hints,
      submitted: a.submitted ?? false,
      history: a.history.map((h, index) => {
        if (
          !plain(h) ||
          !integer(h.moves) ||
          h.moves !== a.moves - a.history.length + index
        )
          throw new Error("撤销记录无效。");
        return { orientation: orientation(h.orientation), moves: h.moves };
      }),
    };
  }
  return data;
}
export function recordWin(data, levelId, moves, hints, par) {
  const stars = moves <= par && hints === 0 ? 3 : moves <= par + 2 ? 2 : 1;
  const old = data.completed[levelId];
  data.completed[levelId] = {
    stars: Math.max(stars, old?.stars || 0),
    bestMoves: Math.min(moves, old?.bestMoves ?? Infinity),
  };
  return stars;
}
export function nextUnlocked(data, levels) {
  return levels.find((l) => !data.completed[l.id])?.id ?? levels.at(-1).id;
}
export function createStore(levels, backend) {
  let memory = freshSave(),
    available = true,
    warning = "",
    lastRead = Symbol("unread");
  const decode = (raw) =>
    raw == null ? freshSave() : validateSave(JSON.parse(raw), levels);
  try {
    backend ??= globalThis.localStorage;
    // Opening a second tab must not itself become a write or discard another
    // tab's in-progress edits. Retain the exact bytes for stale-write detection.
    lastRead = backend.getItem(SAVE_KEY);
    memory = decode(lastRead);
  } catch {
    available = false;
    warning =
      "本机存档暂不可用或旧记录损坏。可以继续游玩，请在设置中导出备份。";
  }

  function adopt(raw, conflict) {
    // Remember even invalid bytes: a later deliberate action may repair the
    // already-observed corruption, but the first stale write must never do so.
    lastRead = raw;
    try {
      const incoming = decode(raw);
      memory = incoming;
      available = true;
      warning = conflict
        ? "另一个标签页已更新进度。本次旧记录未写入，已同步最新进度，请从首页继续。"
        : "已同步另一个标签页的最新进度，请从首页继续。";
      return true;
    } catch {
      available = false;
      warning = "检测到外部存档损坏，保留当前进度，请在设置中导出备份。";
      return false;
    }
  }

  function write() {
    try {
      const updatedAt = new Date().toISOString();
      const raw = JSON.stringify({ ...memory, updatedAt });
      backend.setItem(SAVE_KEY, raw);
      memory.updatedAt = updatedAt;
      lastRead = raw;
      available = true;
      warning = "";
      return true;
    } catch {
      available = false;
      warning = "无法写入本机存档，请导出进度备份。";
      return false;
    }
  }

  return {
    get data() {
      return memory;
    },
    get available() {
      return available;
    },
    get warning() {
      return warning;
    },
    refresh() {
      try {
        const raw = backend.getItem(SAVE_KEY);
        if (raw === lastRead) return false;
        return adopt(raw, false);
      } catch {
        available = false;
        warning = "无法读取本机存档，保留当前进度，请导出备份。";
        return false;
      }
    },
    persist() {
      try {
        const raw = backend.getItem(SAVE_KEY);
        if (raw !== lastRead) {
          adopt(raw, true);
          return false;
        }
      } catch {
        available = false;
        warning = "无法读取最新本机存档，本次未写入，请导出进度备份。";
        return false;
      }
      return write();
    },
    replace(raw) {
      // Validate before any mutation or I/O. Explicit import/reset are the only
      // operations allowed to replace newer external data after confirmation.
      const validated = validateSave(raw, levels);
      memory = validated;
      return write();
    },
    reset() {
      memory = freshSave();
      return write();
    },
  };
}
