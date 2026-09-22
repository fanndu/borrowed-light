import { createAnalytics } from "./analytics.js";
import { levels } from "./levels.js";
import { evaluate, initialState, solve } from "./engine.js";
import {
  createStore,
  recordWin,
  nextUnlocked,
  validateSave,
  SAVE_KEY,
} from "./storage.js";
import { renderBoard, harborArt, icon } from "./board.js";
import { playSound } from "./audio.js";
const $ = (s) => document.querySelector(s);
const analytics = createAnalytics(window);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const store = createStore(levels),
  app = $("#app"),
  dialog = $("#modal");
let screen = "home",
  result = null,
  hintKey = null,
  confirmCallback = null,
  lastFocus = null,
  toastTimer;
const chapterNames = ["渡口", "眠街", "回声庭", "彩窗", "潮汐工坊", "长夜灯塔"];
const chapterIntros = [
  "从一束微光开始，让渡口重新有了方向。",
  "夜已深。绕过熟睡的居民，别惊扰他们的梦。",
  "一束光，可以照亮不止一个远方。",
  "穿过彩窗，光也有了自己的颜色。",
  "在交错的光路之间，找到恰好的秩序。",
  "把一路学会的温柔，送到夜色的尽头。",
];
const chapterEnds = [
  "渡口亮了，晚归的小船终于看见了岸。",
  "街巷亮了，窗内的梦依旧安静。",
  "回声庭亮了，分开的光在远处相逢。",
  "彩窗亮了，海风也染上了颜色。",
  "工坊亮了，每一道光都找到了去处。",
  "长夜灯塔亮了。谢谢你，把光借给这座岛。",
];
const current = () => levels.find((l) => l.id === store.data.active?.levelId);
const completedCount = () => Object.keys(store.data.completed).length;
const totalStars = () =>
  Object.values(store.data.completed).reduce((sum, s) => sum + s.stars, 0);
const fmt = (n) => String(n).padStart(2, "0");
const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const ch = (l) => chapterNames[l.chapter] || "海岛";
function sound(kind) {
  playSound(kind, store.data.settings.sound);
}
function announce(text) {
  $("#announcer").textContent = text;
}
function toast(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
  announce(text);
}
function persist() {
  const saved = store.persist();
  if (!saved) {
    if (store.available) {
      closeModal();
      screen = "home";
      result = null;
      hintKey = null;
      render();
    }
    toast(store.warning);
  }
  return saved || !store.available;
}
function syncProgress() {
  if (!store.refresh()) return false;
  closeModal();
  screen = "home";
  result = null;
  hintKey = null;
  render();
  toast("旅程已在另一个窗口更新，已同步最新进度。请继续旅程。");
  return true;
}
function applySettings() {
  document.body.classList.toggle(
    "reduce-motion",
    store.data.settings.reducedMotion,
  );
}
function header() {
  return `<header class="site-header"><button class="brand" data-action="home" aria-label="借光，回到首页"><span class="brand-mark">✦</span><span>借光<span class="brand-en">BORROWED LIGHT</span></span></button><div class="header-right"><span class="edition">一座岛 · 三十六束光</span><button class="icon-button" data-action="settings" aria-label="设置">${icon("settings")}</button></div></header>`;
}
function footer() {
  return `<footer class="site-footer"><span>慢一点，光会找到方向。</span><button data-action="about">关于借光 <span>1.0</span></button></footer>`;
}
function render(focusKey) {
  applySettings();
  app.innerHTML = `<div class="app-shell">${header()}${screen === "home" ? homeView() : screen === "map" ? mapView() : screen === "ending" ? endingView() : gameView()}${footer()}${analyticsPrompt()}</div>`;
  if (focusKey) {
    const e = [...document.querySelectorAll("[data-mirror]")].find(
      (e) => e.dataset.mirror === focusKey,
    );
    e?.focus({ preventScroll: true });
  }
}
function analyticsPrompt() {
  if (!analytics.available || analytics.consent !== null) return "";
  return `<aside class="analytics-prompt" aria-label="可选使用统计"><div><strong>帮助我们把小岛做得更好？</strong><p>允许 Google Analytics 统计访问来源与关卡进度。拒绝不影响游玩，设置中可随时修改。 <button class="text-button" data-action="privacy">统计说明</button></p></div><div class="analytics-choices"><button class="button secondary" data-action="analytics-deny">暂不 / No thanks</button><button class="button primary" data-action="analytics-allow">允许 / Allow</button></div></aside>`;
}
function trackStart() {
  const l = current();
  if (!l || screen !== "game") return;
  analytics.track("game_started", {}, true);
  analytics.track(
    "level_started",
    {
      level_id: l.id,
      chapter: l.chapter + 1,
      is_replay: !!store.data.completed[l.id],
    },
    true,
  );
}
function changeAnalytics(value) {
  analytics.setConsent(value);
  render();
  if (value) trackStart();
}
function privacy() {
  modal(
    `<p class="eyebrow">YOUR CHOICE</p><h2>可选使用统计</h2><p>只有你允许后，线上版本才会加载 Google Analytics，帮助我们了解访问来源、开始游玩、关卡完成、尝试失败和提示使用情况。拒绝后游戏功能保持完整，离线文件不发送统计。</p><p>统计会使用 Cookie 区分浏览器，Google 可能处理设备信息和近似地区；本游戏不发送姓名、邮箱、存档内容或任意网址参数，不启用广告个性化。游戏专用统计 Cookie 最长保留60天。</p><p>可在设置中关闭统计，停止后续发送并删除本游戏的统计 Cookie。本机存档不会被删除。统计只代表参与者，不能当作全部玩家人数。</p><p><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 隐私权政策</a> · <a href="https://x.com/frankd992133231" target="_blank" rel="noopener noreferrer">联系开发者 Frank</a></p><button class="button primary" data-action="close">明白了</button>`,
  );
}
function homeView() {
  const done = completedCount(),
    hasSave = done > 0 || store.data.active;
  return `<main id="main" tabindex="-1" class="home-view"><section class="hero-copy"><p class="eyebrow"><span class="tiny-line"></span> A QUIET PUZZLE ADVENTURE</p><h1>借一束光，<br>让小岛<span class="serif-accent">亮起来。</span></h1><p class="hero-description">旋转镜面，穿过彩窗，点亮夜里的灯塔。<br>也请记得，让熟睡的人继续做梦。</p><div class="hero-actions"><button class="button primary large" data-action="continue">${done === levels.length ? "重访小岛" : hasSave ? "继续旅程" : "开始旅程"} ${icon("arrow")}</button><button class="text-button" data-action="map">章节地图 ${icon("map")}</button></div><div class="home-progress">${hasSave ? `<div class="progress-track"><span style="width:${(done / levels.length) * 100}%"></span></div><span>${fmt(done)} / ${levels.length} 处灯火已点亮 <b>✦ ${totalStars()} / ${levels.length * 3}</b></span>` : '<span class="small-dot"></span><span>36 个关卡 · 6 段夜行 · 随时停下，随时回来</span>'}</div><p class="save-note">${store.available ? "进度自动保存在此浏览器，可在设置中导出备份。" : "本机存档不可用，请在设置中导出进度备份。"}</p></section><section class="hero-visual">${harborArt()}<span class="art-caption"><span>01 / THE FIRST LIGHT</span><span>光不会催促你。</span></span></section><section class="intro-strip"><div><span class="intro-icon">↗</span><p><strong>转一面镜</strong><span>点击镜面，改变光的方向</span></p></div><div><span class="intro-icon">✦</span><p><strong>点一盏灯</strong><span>让所有灯塔收到正确的光</span></p></div><div><span class="intro-icon">☾</span><p><strong>留一场梦</strong><span>光路避开居民，夜晚依旧安静</span></p></div></section></main>`;
}
function mapView() {
  const unlocked = nextUnlocked(store.data, levels);
  return `<main id="main" tabindex="-1" class="map-view"><div class="page-heading"><div><p class="eyebrow">THE ISLAND AT NIGHT</p><h1>沿着光，走远一点。</h1><p>每点亮一处，下一段旅程就会开启。已完成的关卡可以随时重访。</p></div><span class="map-total">${totalStars()}<small> / ${levels.length * 3} 星光</small></span></div><div class="chapter-grid">${chapterNames
    .map((name, i) => {
      const list = levels.filter((l) => l.chapter === i),
        stars = list.reduce(
          (s, l) => s + (store.data.completed[l.id]?.stars || 0),
          0,
        ),
        locked = list[0].id > unlocked;
      return `<section class="chapter-card ${locked ? "chapter-locked" : ""}"><div class="chapter-card-top"><span class="chapter-number">${fmt(i + 1)}</span><span class="chapter-stars">✦ ${stars} / ${list.length * 3}</span></div><h2>${name}</h2><p>${chapterIntros[i]}</p><div class="level-grid">${list
        .map((l) => {
          const score = store.data.completed[l.id],
            lock = l.id > unlocked;
          return `<button class="level-button ${score ? "is-complete" : ""} ${l.id === unlocked && !score ? "is-current" : ""}" data-level="${l.id}" ${lock ? "disabled" : ""} aria-label="第${l.id}关 ${escape(l.title)}，${lock ? "尚未解锁" : score ? score.stars + "颗星" : "可以挑战"}"><span>${lock ? "·" : fmt(l.id)}</span><small>${score ? starText(score.stars) : lock ? "未解锁" : "待点亮"}</small></button>`;
        })
        .join("")}</div></section>`;
    })
    .join(
      "",
    )}</div>${completedCount() === levels.length ? '<button class="button secondary" data-action="ending">再看一次小岛的结局 ✦</button>' : ""}</main>`;
}
function gameView() {
  const level = current();
  if (!level) {
    screen = "home";
    return homeView();
  }
  const a = store.data.active,
    targets = level.cells.filter((c) => c.type === "target").length,
    score = store.data.completed[level.id];
  const guidance = hintKey
    ? "金色外框标记的镜面，是离当前局面最近的解法中的一步。"
    : result
      ? result.hit.length
        ? `这束光惊扰了 ${result.hit.length} 位居民。调整光路，再试一次。`
        : result.won
          ? "每一盏灯都亮了，夜色依旧安静。"
          : `已经点亮 ${result.lit.length} / ${targets} 盏灯。看看光在哪里停下了。`
      : "先调整镜面，再送出光。试错不会扣除任何星光。";
  const present = new Set(level.cells.map((c) => c.type));
  return `<main id="main" tabindex="-1" class="game-view"><nav class="game-topbar"><button class="text-button" data-action="map">${icon("back")} 章节地图</button><span>第 ${fmt(level.chapter + 1)} 章 · ${ch(level)}</span><button class="text-button" data-action="help">玩法说明 <span class="help-circle">?</span></button></nav><div class="game-layout"><aside class="level-sidebar"><p class="eyebrow">LIGHT ${fmt(level.id)} / ${levels.length}</p><h1>${escape(level.title)}</h1><p class="level-brief">${escape(level.brief)}</p><div class="level-stats"><div><strong>${a.moves}</strong><span>旋转次数</span></div><div><strong>${level.par}</strong><span>最少旋转</span></div><div><strong>${result?.lit.length || 0}<small>/${targets}</small></strong><span>已亮灯塔</span></div></div><div class="level-lesson"><span class="lesson-marker">✧</span><p>${escape(level.tutorial || chapterIntros[level.chapter])}</p></div><div class="legend"><span><i class="legend-mirror"></i>镜面：点击旋转</span><span><i class="legend-lamp"></i>灯塔：接收光线</span>${present.has("sleeper") ? '<span><i class="legend-sleeper"></i>居民：请避开</span>' : ""}${present.has("splitter") ? '<span><i class="legend-prism"></i>分光镜：直行＋反射</span>' : ""}${present.has("filter") ? '<span><i class="legend-filter"></i>彩窗：改变光的颜色</span>' : ""}</div>${score ? `<p class="best-score">最好记录 <span>${starText(score.stars)}</span> · ${score.bestMoves} 次旋转</p>` : ""}<button class="text-button star-help" data-action="stars">怎样收集三颗星？</button></aside><section class="board-section" aria-label="游戏区域"><div class="board-frame"><span class="board-corner tl"></span><span class="board-corner tr"></span>${renderBoard(level, a.orientation, result, hintKey)}<span class="board-corner bl"></span><span class="board-corner br"></span></div><div class="game-status ${result?.hit.length ? "warning" : ""}" role="status"><span>${result?.hit.length ? "☾" : result?.won ? "✦" : "·"}</span>${escape(guidance)}</div><div class="game-controls"><div class="utility-controls"><button class="control-button" data-action="undo" ${!a.history.length ? "disabled" : ""} aria-label="撤销上一次旋转">${icon("undo")}<span>撤销</span></button><button class="control-button" data-action="reset">${icon("reset")}<span>重置</span></button><button class="control-button" data-action="hint">${icon("hint")}<span>提示${a.hints ? " · " + a.hints : ""}</span></button></div><button class="button primary fire-button" data-action="fire"><span class="light-symbol">✦</span>送出光 <kbd>空格</kbd></button></div><p class="keyboard-note">点击镜面旋转 · 空格送光 · Z 撤销 · 方向键切换镜面</p></section></div></main>`;
}
function endingView() {
  return `<main id="main" tabindex="-1" class="ending-view"><p class="eyebrow">EVERY LIGHT FINDS A HOME</p><div class="constellation" aria-hidden="true">${levels.map((l, i) => `<span style="--i:${i};--x:${8 + ((i * 29) % 86)}%;--y:${10 + ((i * 17) % 78)}%">✦</span>`).join("")}</div><p class="ending-overline">三十六处灯火，三十六个安静的梦。</p><h1>小岛亮了。<br><em>谢谢你的光。</em></h1><p class="ending-copy">你没有赶走夜色，只是让晚归的人有路可走。<br>也让每个熟睡的人，拥有了一个没有被打扰的夜晚。</p><div class="ending-stats"><span><strong>${completedCount()}</strong> / ${levels.length} 处灯火</span><span><strong>${totalStars()}</strong> / ${levels.length * 3} 颗星光</span></div><div class="hero-actions"><button class="button primary" data-action="map">重访小岛 ${icon("arrow")}</button><button class="button secondary" data-action="export">保存旅程备份</button></div><p class="save-note">旅程已完成。所有关卡仍可重玩，最好成绩会一直保留。</p></main>`;
}
function modal(html) {
  const wasOpen = dialog.open;
  if (!wasOpen) lastFocus = document.activeElement;
  dialog.innerHTML = `<button class="modal-close icon-button" data-action="close" aria-label="关闭">×</button>${html}`;
  if (!wasOpen) dialog.showModal();
}
function closeModal() {
  confirmCallback = null;
  dialog.close();
}
dialog.addEventListener("close", () => {
  if (dialog.open) return; // An older close event must not clear a newly opened confirmation.
  confirmCallback = null;
  lastFocus?.isConnected && lastFocus.focus({ preventScroll: true });
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeModal();
  }
});
function confirm(text, action, label = "确认") {
  modal(
    `<p class="eyebrow">A LITTLE PAUSE</p><h2>确定继续吗？</h2><p>${escape(text)}</p><div class="modal-actions"><button class="button secondary" data-action="close">取消</button><button class="button primary" data-action="confirm">${label}</button></div>`,
  );
  confirmCallback = action;
}
function goLevel(id, resume = false) {
  const level = levels.find((l) => l.id === id);
  if (!level || id > nextUnlocked(store.data, levels)) return;
  closeModal();
  if (!resume || store.data.active?.levelId !== id)
    store.data.active = {
      levelId: id,
      orientation: initialState(level),
      moves: 0,
      hints: 0,
      history: [],
      submitted: false,
    };
  result = null;
  hintKey = null;
  screen = "game";
  persist();
  render();
  trackStart();
  $("#main").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function continueJourney() {
  const a = store.data.active;
  if (a && !a.submitted) return goLevel(a.levelId, true);
  if (completedCount() === levels.length) {
    screen = "map";
    render();
    return;
  }
  goLevel(nextUnlocked(store.data, levels));
}
function rotate(key) {
  const level = current(),
    a = store.data.active;
  if (!level || !Object.hasOwn(a.orientation, key)) return;
  a.history.push({ orientation: { ...a.orientation }, moves: a.moves });
  if (a.history.length > 1000) a.history.shift();
  a.orientation[key] = a.orientation[key] === 0 ? 1 : 0;
  a.moves++;
  a.submitted = false;
  result = null;
  hintKey = null;
  sound("rotate");
  persist();
  render(key);
  announce(`已旋转镜面，累计 ${a.moves} 次。`);
}
function undo() {
  const a = store.data.active;
  if (!a?.history.length) return;
  const h = a.history.pop();
  a.orientation = h.orientation;
  a.moves = h.moves;
  a.submitted = false;
  result = null;
  hintKey = null;
  persist();
  sound("click");
  render();
  announce("已撤销上一次旋转。");
}
function fire() {
  const l = current(),
    a = store.data.active;
  if (!l) return;
  hintKey = null;
  result = evaluate(l, a.orientation);
  if (result.won) {
    const newSubmission = !a.submitted;
    const replay = !!store.data.completed[l.id];
    a.submitted = true;
    const earned = recordWin(store.data, l.id, a.moves, a.hints, l.par);
    if (!persist()) return;
    if (newSubmission)
      analytics.track("level_completed", {
        level_id: l.id,
        chapter: l.chapter + 1,
        moves: a.moves,
        hints: a.hints,
        stars: earned,
        is_replay: replay,
      });
    render();
    sound("success");
    showWin(l, earned);
  } else {
    analytics.track("puzzle_failed", {
      level_id: l.id,
      chapter: l.chapter + 1,
      moves: a.moves,
    });
    sound(result.hit.length ? "fail" : "fire");
    render();
    announce(
      result.hit.length
        ? "光照到了居民，请调整镜面。"
        : `已点亮 ${result.lit.length} 盏灯，还没有全部完成。`,
    );
  }
}
function showWin(l, stars) {
  const chapterEnd = l.id % 6 === 0,
    all = completedCount() === levels.length;
  modal(
    `<p class="eyebrow">${chapterEnd ? "CHAPTER COMPLETE" : "A LIGHT FINDS ITS WAY"}</p><div class="win-symbol">✦</div><h2>${chapterEnd ? ch(l) + "，亮了。" : "这一束光，刚刚好。"}</h2><div class="win-stars" aria-label="本次获得${stars}颗星">${starText(stars)}</div><p>${escape(chapterEnd ? chapterEnds[l.chapter] : "灯塔收到光，居民没有被惊扰。")}</p><div class="win-summary"><span>${store.data.active.moves} 次旋转</span><span>${store.data.active.hints} 次提示</span><span>最好 ${starText(store.data.completed[l.id].stars)}</span></div><div class="modal-actions"><button class="button secondary" data-action="map">章节地图</button><button class="button primary" data-action="${all ? "ending" : "next"}">${all ? "看看整座小岛" : chapterEnd ? "走向下一章" : "下一束光"} ${icon("arrow")}</button></div>${stars < 3 ? '<button class="text-button retry-link" data-action="retry">再试一次，收集更多星光</button>' : ""}`,
  );
}
function settings() {
  modal(
    `<p class="eyebrow">MAKE YOURSELF AT HOME</p><h2>旅途设置</h2><div class="settings-row"><div><strong>轻声回应</strong><small>旋转与点亮时播放音效</small></div><button role="switch" aria-checked="${store.data.settings.sound}" aria-label="音效" class="switch" data-action="toggle-sound"><span></span></button></div><div class="settings-row"><div><strong>让画面静下来</strong><small>减少装饰动画与过渡</small></div><button role="switch" aria-checked="${store.data.settings.reducedMotion}" aria-label="减少动态" class="switch" data-action="toggle-motion"><span></span></button></div><div class="settings-row"><div><strong>帮助改进游戏</strong><small>${analytics.available ? "允许基础使用统计，可随时关闭" : "此版本不发送统计"}</small></div><button role="switch" aria-checked="${analytics.consent === true}" aria-label="使用统计" class="switch" data-action="toggle-analytics" ${analytics.available ? "" : "disabled"}><span></span></button></div><button class="text-button" data-action="privacy">统计与隐私说明</button><div class="save-panel"><p><strong>你的旅程</strong><span>${completedCount()} / ${levels.length} 关 · ${totalStars()} 颗星</span></p><p class="small-copy">${store.available ? "进度自动保存在此浏览器。清除网站数据或更换设备会失去本机记录，建议定期导出备份。" : escape(store.warning)}</p><div class="modal-actions"><button class="button secondary" data-action="export">导出进度</button><button class="button secondary" data-action="import">导入进度</button></div></div><button class="danger-link" data-action="clear-save">清除全部进度</button>`,
  );
}
function help() {
  modal(
    `<p class="eyebrow">A SMALL GUIDE TO LIGHT</p><h2>让光找到方向</h2><ol class="help-list"><li><strong>点击镜面旋转。</strong>镜面只有两个方向。光从带箭头的光源出发，起始颜色与光源标记一致，遇到镜面转弯。</li><li><strong>送出光，检查路线。</strong>所有灯塔都亮起，且光没有碰到任何居民，才算过关。</li><li><strong>分光镜会留下一束直行的光。</strong>另一束按照镜面方向反射。墙壁会挡住光。</li><li><strong>彩窗改变经过的光。</strong>带 ● 的粉色灯塔需要粉光，带 ◆ 的蓝色灯塔需要蓝光，带 ✦ 的金色灯塔需要金光。</li></ol><p class="small-copy">灯塔会接住并终止光线。居民也会阻挡光线。光路可以交叉，但不能惊扰居民。</p><div class="help-keyboard">键盘：Tab 或方向键选择镜面，Enter 旋转，空格送光，Z 撤销。手机直接轻触镜面即可。</div><button class="button primary" data-action="close">明白了 ${icon("check")}</button>`,
  );
}
function exportSave() {
  const blob = new Blob([JSON.stringify(store.data, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `借光-进度-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("已生成进度备份，请保留下载的 JSON 文件。");
}
const actions = {
  privacy,
  "analytics-allow": () => changeAnalytics(true),
  "analytics-deny": () => changeAnalytics(false),
  "toggle-analytics": () => {
    changeAnalytics(analytics.consent !== true);
    settings();
    $("[data-action=toggle-analytics]").focus();
  },
  home: () => {
    closeModal();
    screen = "home";
    render();
  },
  map: () => {
    closeModal();
    screen = "map";
    render();
    window.scrollTo(0, 0);
  },
  continue: continueJourney,
  settings,
  help,
  stars: () =>
    modal(
      '<p class="eyebrow">COLLECT THE STARLIGHT</p><h2>三颗星，三个小目标</h2><div class="star-rules"><p><b>★</b> 点亮全部灯塔，并避开居民。</p><p><b>★★</b> 旋转次数不超过最少次数 + 2。</p><p><b>★★★</b> 以最少次数过关，且没有使用提示。</p></div><p>送光试验不计步数。撤销会退回上一步的次数。重玩只会提升最好成绩。</p><button class="button primary" data-action="close">继续旅程</button>',
    ),
  close: closeModal,
  confirm: () => {
    const cb = confirmCallback;
    confirmCallback = null;
    closeModal();
    cb?.();
  },
  undo,
  fire,
  reset: () => {
    if (!current()) return;
    if (store.data.active.moves || store.data.active.hints)
      confirm(
        "这一关会回到初始布局，已获得的星光和其他关卡进度都会保留。",
        () => goLevel(current().id),
        "重置这一关",
      );
    else goLevel(current().id);
  },
  retry: () => goLevel(current().id),
  next: () => goLevel(Math.min(current().id + 1, levels.length)),
  ending: () => {
    if (completedCount() < levels.length) return;
    closeModal();
    screen = "ending";
    render();
    window.scrollTo(0, 0);
  },
  hint: () => {
    const l = current();
    if (!l) return;
    const solution = solve(l, store.data.active.orientation);
    if (!solution) return toast("没有找到可行光路，请重置这一关后重试。");
    if (solution.distance === 0) return toast("光路已经准备好了，试着送出光。");
    store.data.active.hints++;
    analytics.track("hint_requested", {
      level_id: l.id,
      chapter: l.chapter + 1,
      hints: store.data.active.hints,
    });
    hintKey = solution.moves[0];
    persist();
    render(hintKey);
    toast("已标出一面可以旋转的镜面。本关使用提示后最高可获两颗星。");
  },
  "toggle-sound": () => {
    store.data.settings.sound = !store.data.settings.sound;
    persist();
    sound("click");
    settings();
    $("[data-action=toggle-sound]").focus();
  },
  "toggle-motion": () => {
    store.data.settings.reducedMotion = !store.data.settings.reducedMotion;
    persist();
    applySettings();
    settings();
    $("[data-action=toggle-motion]").focus();
  },
  export: exportSave,
  import: () => $("#save-file").click(),
  "clear-save": () =>
    confirm(
      "这会清除本浏览器的全部星光、解锁记录和进行中的关卡。建议先导出备份。",
      () => {
        store.reset();
        screen = "home";
        result = null;
        hintKey = null;
        render();
        toast("已开始一段新的旅程。");
      },
      "清除并重新开始",
    ),
  about: () =>
    modal(
      '<p class="eyebrow">BORROWED LIGHT · VERSION 1.0.1</p><h2>一场安静的夜行</h2><p>《借光》是一款原创光路解谜游戏。36 个关卡，6 个章节，一束需要你照顾的光。</p><p>游戏使用原创矢量画面与合成音效，无广告、无账号。仅在你允许时发送基础使用统计，可在设置中随时关闭。联网打开并完成缓存后，可离线继续游玩。</p><p class="small-copy">作品由人类与 AI 协作完成。所有游戏判断都在本机运行。进度保存在浏览器，请定期导出备份。</p><button class="button primary" data-action="close">愿你一路有光</button>',
    ),
};
document.addEventListener("click", (e) => {
  if (syncProgress()) return;
  const mirror = e.target.closest("[data-mirror]");
  if (mirror && screen === "game" && !dialog.open)
    return rotate(mirror.dataset.mirror);
  const level = e.target.closest("[data-level]");
  if (level && !level.disabled) return goLevel(Number(level.dataset.level));
  const b = e.target.closest("[data-action]");
  if (b && !b.disabled) actions[b.dataset.action]?.();
});
document.addEventListener("keydown", (e) => {
  if (syncProgress()) {
    e.preventDefault();
    return;
  }
  if (
    dialog.open ||
    screen !== "game" ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
  )
    return;
  if (
    e.code === "Space" &&
    (!e.target.closest("button") || e.target.closest("[data-mirror]"))
  ) {
    e.preventDefault();
    fire();
  } else if (e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  } else if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
  ) {
    const controls = [...document.querySelectorAll("[data-mirror]")];
    if (!controls.length) return;
    e.preventDefault();
    const index = controls.indexOf(document.activeElement),
      step = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1;
    controls[(index + step + controls.length) % controls.length].focus();
  }
});
$("#save-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 2000000)
      throw new Error("文件太大，请选择《借光》导出的 JSON 进度文件。");
    const parsed = validateSave(JSON.parse(await file.text()), levels);
    confirm(
      `导入后将替换本机进度：${Object.keys(parsed.completed).length} 个已完成关卡。当前进度不会自动合并。`,
      () => {
        store.replace(parsed);
        result = null;
        hintKey = null;
        screen = "home";
        render();
        toast("旅程已恢复。");
      },
      "导入并替换",
    );
  } catch (err) {
    toast(
      err instanceof SyntaxError
        ? "无法读取这个文件，请选择有效的 JSON 备份。"
        : err.message,
    );
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === SAVE_KEY || e.key === null) syncProgress();
});
render();
if (!store.available) toast(store.warning);
if (
  "serviceWorker" in navigator &&
  location.protocol !== "file:" &&
  document.querySelector('link[rel="manifest"]')
)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}),
  );
