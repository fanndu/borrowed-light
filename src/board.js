import { getCellKey } from "./engine.js";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const palette = { gold: "#fbd589", rose: "#f2a5b1", blue: "#91d9eb" };
export function icon(name) {
  const paths = {
    back: "M15 5l-7 7 7 7",
    undo: "M8 4L3 9l5 5M3 9h10a7 7 0 010 14",
    reset: "M4 10a8 8 0 111 9M4 4v6h6",
    sound: "M11 5L6 9H3v6h3l5 4V5M15 8a6 6 0 010 8m3-11a10 10 0 010 14",
    settings:
      "M12 8a4 4 0 100 8 4 4 0 000-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2M5 19l2-2M17 7l2-2",
    map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5m6-2v16m6-14v16",
    arrow: "M4 12h16m-6-6l6 6-6 6",
    hint: "M9 18h6m-6 3h6M8 14a6 6 0 118 0l-1 3H9l-1-3",
    check: "M4 12l5 5L20 6",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.arrow}"/></svg>`;
}
export function renderBoard(level, state, result, hintKey = null) {
  const size = 64,
    w = level.cols * size,
    h = level.rows * size;
  const lit = new Set(result?.lit || []),
    hit = new Set(result?.hit || []);
  let tiles = "",
    objects = "",
    controls = "";
  for (let y = 0; y < level.rows; y++)
    for (let x = 0; x < level.cols; x++)
      tiles += `<rect x="${x * size + 2}" y="${y * size + 2}" width="60" height="60" rx="10" fill="${(x + y) % 2 ? "#183638" : "#1a393b"}" stroke="#2c4745" stroke-opacity=".4"/>`;
  for (const c of level.cells) {
    const key = getCellKey(c),
      x = (c.x + 0.5) * size,
      y = (c.y + 0.5) * size,
      color = palette[c.color] || palette.gold,
      active = lit.has(key),
      danger = hit.has(key),
      s = state[key] ?? c.state ?? 0;
    let art = "";
    if (c.type === "mirror" || c.type === "splitter") {
      art = `${c.type === "splitter" ? '<path d="M0-29L29 0 0 29-29 0z" fill="#493c5b" stroke="#d3b9ed" stroke-width="2"/>' : ""}<circle r="23" fill="#244b4d" stroke="${hintKey === key ? "#ffe7a0" : "#496569"}" stroke-width="${hintKey === key ? 3 : 1}"/><circle r="16" fill="#152e33"/><g transform="rotate(${s === 0 ? -45 : 45})"><rect x="-24" y="-6" width="48" height="12" rx="5" fill="${c.type === "splitter" ? "#c2abe3" : "#82b4b7"}" stroke="#daf1e7"/><path d="M-19-2h38" stroke="white" stroke-opacity=".7" stroke-width="2"/></g>${c.type === "splitter" ? '<circle r="4" fill="#f2e4ff"/>' : ""}<circle cy="26" r="2" fill="#d6c091"/>`;
      controls += `<button class="cell-control ${hintKey === key ? "hinted" : ""}" style="left:${(c.x / level.cols) * 100}%;top:${(c.y / level.rows) * 100}%;width:${100 / level.cols}%;height:${100 / level.rows}%" data-mirror="${escape(key)}" aria-label="第${c.y + 1}行第${c.x + 1}列${c.type === "splitter" ? "分光镜" : "镜面"}，${s === 0 ? "右上斜向" : "右下斜向"}，按下旋转" title="旋转${c.type === "splitter" ? "分光镜" : "镜面"}"><span class="sr-only">旋转镜面</span></button>`;
    } else if (c.type === "source") {
      art = `<circle r="25" fill="${color}" opacity=".13"/><g transform="rotate(${(c.dir || 0) * 90})"><path d="M-17-16h28l13 16-13 16h-28z" fill="${color}" stroke="#e1ede2"/><rect x="-12" y="-10" width="12" height="20" rx="4" fill="#284447"/><path d="M5-6l7 6-7 6" stroke="#284447" stroke-width="3" fill="none"/><text x="-6" y="3" text-anchor="middle" font-size="9" fill="${color}">${c.color === "blue" ? "◆" : c.color === "rose" ? "●" : "✦"}</text></g>`;
    } else if (c.type === "target") {
      art = `${active ? `<circle r="28" fill="${color}" opacity=".18"/>` : ""}<path d="M-18 22l5-33h26l5 33z" fill="${active ? "#d4ba81" : "#788a7a"}" stroke="#c6bd98"/><path d="M-21-12L0-26l21 14z" fill="#bca578"/><rect x="-10" y="-10" width="20" height="20" rx="5" fill="${active ? color : "#233d41"}" stroke="${color}" stroke-width="2"/><path d="M-23 24h46" stroke="#c6bd98" stroke-width="3"/><circle cy="1" r="4" fill="${color}" opacity="${active ? 1 : 0.5}"/><text y="20" text-anchor="middle" font-size="8" fill="#21363a">${c.color === "blue" ? "◆" : c.color === "rose" ? "●" : "✦"}</text></g>`;
    } else if (c.type === "sleeper") {
      art = `<circle r="24" fill="${danger ? "#f0a49a" : "#4b6660"}" opacity=".2"/><path d="M-19 20v-21a19 19 0 0138 0v21" fill="${danger ? "#8c5951" : "#496764"}"/><ellipse cy="-3" rx="12" ry="13" fill="#ddc4a4"/><path d="M-8-3l5 1m6 0l5-1" stroke="#514b47" stroke-width="2"/><path d="M-13-7q4-15 23-8l3 13q-13-1-16-7z" fill="#344b49"/><text x="16" y="-17" fill="${danger ? "#f4baad" : "#c0d5cb"}" font-size="12">${danger ? "!" : "z"}</text>`;
    } else if (c.type === "wall") {
      art =
        '<rect x="-26" y="-25" width="52" height="52" rx="10" fill="#102a2e" stroke="#385351"/><path d="M-23-8h46M-23 9h46M-8-23v15M12-8V9M-5 9v16" stroke="#344f4d" stroke-width="2"/><path d="M-22-25h44" stroke="#63706a" stroke-width="3"/>';
    } else if (c.type === "filter") {
      art = `<rect x="-21" y="-24" width="42" height="48" rx="18" fill="${color}" opacity=".24" stroke="${color}" stroke-width="2"/><path d="M0-18L13 0 0 18-13 0z" fill="${color}" opacity=".8"/><text y="4" text-anchor="middle" font-size="11" fill="#19363b">${c.color === "blue" ? "◆" : c.color === "rose" ? "●" : "✦"}</text></g>`;
    }
    objects += `<g transform="translate(${x},${y})" class="object ${danger ? "danger" : ""}">${art}</g>`;
  }
  const rays = (result?.segments || [])
    .map(
      (s) =>
        `<path d="M${s.x1 * size},${s.y1 * size}L${s.x2 * size},${s.y2 * size}" stroke="${palette[s.color] || palette.gold}"/>`,
    )
    .join("");
  return `<div class="board-wrap ${result ? "illuminated" : ""}" style="--cols:${level.cols};aspect-ratio:${level.cols}/${level.rows}" aria-label="光路棋盘，${level.rows}行${level.cols}列"><svg class="board-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><filter id="glow"><feGaussianBlur stdDeviation="5"/></filter></defs>${tiles}<g stroke-width="9" opacity=".28" filter="url(#glow)" fill="none">${rays}</g><g class="light-rays" stroke-width="2.8" stroke-linecap="round" fill="none">${rays}</g>${objects}</svg><div class="board-controls">${controls}</div></div>`;
}
export function harborArt() {
  return `<svg class="harbor-art" viewBox="0 0 670 580" role="img" aria-label="夜色海湾，一束光穿过镜面，照亮远处灯塔"><defs><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#294b4b"/><stop offset="1" stop-color="#122b32"/></linearGradient><radialGradient id="moon"><stop stop-color="#f5e2af" stop-opacity=".32"/><stop offset="1" stop-color="#eddda8" stop-opacity="0"/></radialGradient><filter id="soft"><feGaussianBlur stdDeviation="9"/></filter></defs><circle cx="467" cy="140" r="139" fill="url(#moon)"/><circle cx="467" cy="140" r="49" fill="#e3d8af"/><path d="M0 357Q100 293 196 342T400 338T670 325V580H0" fill="url(#sea)"/><g fill="none" stroke="#52665f" opacity=".35"><path d="M24 406h189m62 10h179m62-21h112M7 450h116m44 29h240m36-21h189M58 525h152m53 19h195m32-20h131"/></g><path d="M91 393l103-58 257 116-105 65z" fill="#63756a"/><path d="M91 393v30l255 126v-33z" fill="#2a4441"/><path d="M346 516l105-65v29l-105 69" fill="#344e48"/><g stroke="#92a089" stroke-opacity=".36"><path d="M140 367l256 116M191 340l259 116M116 405l103-58M164 429l101-58M213 453l101-60M262 476l102-61M309 501l103-62"/></g><g transform="translate(193 323)"><path d="M-22 38L-17-32 19-34 27 36 3 50z" fill="#a3ac89"/><path d="M-17-32L3-44l16 10L0-21z" fill="#d1c391"/><path d="M0-21v71l27-14-8-70" fill="#83957d"/><rect x="-14" y="-26" width="12" height="26" rx="3" fill="#f5d586"/><path d="M-23-36L-2-61l28 12-7 15L3-44z" fill="#687c6b"/></g><g transform="translate(358 386)"><ellipse cy="40" rx="27" ry="13" fill="#213d3c"/><path d="M0 36v-58" stroke="#b8b591" stroke-width="6"/><path d="M-20-24l41-24 9 47-41 24z" fill="#4d7778" stroke="#b9d2c3" stroke-width="4"/></g><path d="M182 303L353 384 506 238" fill="none" stroke="#f8d181" stroke-width="22" opacity=".15" filter="url(#soft)"/><path d="M182 303L353 384 506 238" fill="none" stroke="#f4d28b" stroke-width="2.5"/><g transform="translate(504 237)"><path d="M-55 78L-25 58 29 75 7 91z" fill="#728574"/><path d="M-17 66l9-112h29l11 113-22 14z" fill="#ccc29a"/><path d="M10-46l11 0 11 113-22 14" fill="#9ba68a"/><rect x="-12" y="-51" width="37" height="25" rx="3" fill="#fbd58c"/><path d="M-20-53L5-74l27 21z" fill="#5d7870"/><path d="M-19-25h50M-6 65h27" stroke="#657c6c" stroke-width="5"/><rect x="0" y="37" width="12" height="31" rx="6" fill="#526e66"/><circle cy="-38" cx="5" r="36" fill="#f9dd9c" opacity=".12"/></g><g fill="#b6c6b0" opacity=".65"><circle cx="184" cy="92" r="2"/><circle cx="272" cy="153" r="1.5"/><circle cx="558" cy="69" r="2"/><circle cx="367" cy="76" r="1"/><circle cx="85" cy="237" r="1.5"/></g><path d="M58 194l10-7 10 7m24-27l8-6 8 6" fill="none" stroke="#91a69a" stroke-width="2"/></svg>`;
}
