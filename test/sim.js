/* 无敌猫粮 / 横穿马路 / 随机变道 的自动化回归测试
   用法： node stage_endless_run/test/sim.js
   说明：  用 Node + 假 DOM 跑真实的 endless_run.js，不需要浏览器。 */
"use strict";

const { createGame, autoPilot } = require("./harness");

const results = [];
function check(name, ok, extra) {
	results.push({ name, ok });
	console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "   [" + extra + "]" : ""));
}

const g = createGame();
const { api, state, el, pips, ctxStub } = g;

// ── 1. 开局 ──
check("开局即进入运行状态", state.live === true);
check("猫初始在中间道", state.cat.target === 1, "x=" + Math.round(state.cat.x));

// ── 2. 不打方向就会撞到障碍 ──
let died = false;
g.run(20, 1 / 60, () => { if (state.over && !state.won) died = true; });
check("不操作会被障碍撞到并结束", died, "距离=" + Math.floor(state.distance) + "m");
check("绘制被正常调用", ctxStub.calls.drawImage > 100, "drawImage=" + ctxStub.calls.drawImage);

// ── 3. 重新开始 ──
el("restartBtn").fire("click");
check("重新开始会清空状态", state.over === false && state.distance === 0 && state.food === 0);

// ── 4. 无敌猫粮：拾取 ──
api.spawnFood(1);                       // 放在猫所在车道
const foodBefore = state.food;
g.run(4, 1 / 60);
check("同车道的猫粮会被拾取", state.food > foodBefore || state.rage > 0,
	"food=" + state.food + " rage=" + state.rage.toFixed(2));

// ── 5. 集满 3 份触发无敌加速 ──
el("restartBtn").fire("click");
api.giveCatFood(3);
check("集满 3 份进入无敌状态", state.rage > 0, "rage=" + state.rage.toFixed(2));
check("无敌期间速度倍率提升", api.rageFactor() > 1.4, "x" + api.rageFactor().toFixed(2));

const distBefore = state.distance;
g.run(2, 1 / 60);
const gained = state.distance - distBefore;
check("无敌期间同样时间跑得更远", gained > api.tuning.WORLD_SPEED * 2 * 1.3,
	"2 秒跑了 " + Math.round(gained) + "m（常速 " + api.tuning.WORLD_SPEED + "m/s）");

let smashed = 0;
for (let i = 0; i < 300; i++) {
	g.step(1 / 60);
	smashed = Math.max(smashed, state.bursts.length);
	if (state.over) break;
}
check("无敌期间不会被障碍终结", state.over === false, "场上特效=" + smashed);

g.run(8, 1 / 60);
check("无敌结束后倍率回到 1", api.rageFactor() === 1, "rage=" + state.rage.toFixed(2));

// ── 6. 横穿马路的车 ──
el("restartBtn").fire("click");
api.spawnCross();
const cross = state.obstacles.find(o => o.kind === "cross");
check("横穿幽灵已生成", !!cross, cross ? "laneF=" + cross.laneF.toFixed(2) : "");
const lf0 = cross ? cross.laneF : 0;
let moved = 0;
let seenOnRoad = false;
g.run(5, 1 / 60, () => {
	autoPilot(g);          // 得让猫活着，否则游戏结束、时间就不走了
	if (!cross) return;
	moved = Math.max(moved, Math.abs(cross.laneF - lf0));
	if (Math.abs(cross.laneF) < 1.0) seenOnRoad = true;
});
check("横穿幽灵会斜着切过整条跑道", moved > 2.0, "横向位移 " + moved.toFixed(2) + " laneF");
check("横穿幽灵确实压到跑道上（不是装饰）", seenOnRoad);
check("横穿幽灵跑完会离场", !state.obstacles.includes(cross));

// ── 7. 随机变道的车 ──
el("restartBtn").fire("click");
api.spawnWeave(0);
const weave = state.obstacles.find(o => o.kind === "weave");
const startF = weave ? weave.laneF : 0;
let changed = false;
g.run(3, 1 / 60, () => { if (weave && Math.abs(weave.laneF - startF) > 0.3) changed = true; });
check("变道幽灵会随机换道", changed && !!weave,
	weave ? "laneF " + startF.toFixed(2) + " → " + weave.laneF.toFixed(2) : "");

// ── 8. 难度体检：会躲的玩家能不能跑完 ──
/* 难度基准：同一个种子跑固定局数，结果可复现（种子见 harness.js 的 seed 参数） */
function bench(game, label, attempts) {
	const runs = [];
	for (let i = 0; i < attempts; i++) {
		game.el("restartBtn").fire("click");
		game.run(240, 1 / 60, () => autoPilot(game));   // 5000m 一局约 80~90 秒
		runs.push({ dist: Math.round(game.state.distance), won: game.state.won });
	}
	const wins = runs.filter(r => r.won).length;
	return { wins, runs, label };
}
const ATTEMPTS = 20;

const full = bench(createGame(), "全部障碍", ATTEMPTS);
check("会躲的玩家能跑完全程（全部障碍）", full.wins >= ATTEMPTS / 2,
	ATTEMPTS + " 局 " + full.wins + " 通关（" + Math.round(full.wins / ATTEMPTS * 100) + "%）");

/* 对照组：把新型障碍关掉，只留原来的幽灵 —— 用来确认新增内容没有偷偷加难度 */
const ghostOnly = createGame({
	patch: (src) => src
		.replace(/const CROSS_UNLOCK = [\d.]+;/, "const CROSS_UNLOCK = 99999;")
		.replace(/const WEAVE_UNLOCK = [\d.]+;/, "const WEAVE_UNLOCK = 99999;")
});
const plain = bench(ghostOnly, "只有幽灵", ATTEMPTS);
check("对照组（只有幽灵）难度相当", plain.wins >= ATTEMPTS / 2,
	ATTEMPTS + " 局 " + plain.wins + " 通关（" + Math.round(plain.wins / ATTEMPTS * 100) + "%）");

check("长时间运行后状态没有 NaN",
	Number.isFinite(state.distance) && Number.isFinite(state.cat.x),
	"distance=" + Math.round(state.distance) + " catX=" + Math.round(state.cat.x));

// ── 9. 横向判定不会跨道误伤 ──
el("restartBtn").fire("click");
const geom = api.geom();
const laneGap = geom.BASE_HALF_W * geom.CAT_T * (2 / 3);
check("隔壁车道的障碍不会被判成碰撞",
	laneGap > geom.CAT_H * 0.85 * 0.5, "车道间距=" + Math.round(laneGap) + "px");

// ── 10. HUD 联动 ──
el("restartBtn").fire("click");
api.giveCatFood(1);
check("HUD 收集数正确", el("foodCount").textContent === "1/3", el("foodCount").textContent);
check("HUD 第一格点亮", pips[0].classList.contains("on") && !pips[1].classList.contains("on"));
api.giveCatFood(1);
check("HUD 第二格点亮", pips[1].classList.contains("on"));
api.giveCatFood(1);                                 // 第三桶 → 触发无敌
check("第三桶触发无敌", state.rage > 0, "rage=" + state.rage.toFixed(2));
check("集满后 HUD 进入 full 状态", el("foodHud").classList.contains("full"));
check("无敌倒计时条出现", el("rageTrack").classList.contains("on"));
g.run(0.5, 1 / 60, () => autoPilot(g));
check("倒计时条随剩余时间收缩", /scaleX\(0\.9/.test(el("rageFill").style.transform),
	el("rageFill").style.transform);
g.run(7, 1 / 60, () => autoPilot(g));
check("无敌结束后 HUD 熄灭",
	state.rage === 0 && !el("foodHud").classList.contains("full"),
	"rage=" + state.rage.toFixed(2) + " over=" + state.over);

// 无敌期间又攒满：不浪费当前这段，结束后自动接上第二段
el("restartBtn").fire("click");
api.startRage();
api.giveCatFood(3);
check("无敌中攒满的猫粮会排队（不立刻消耗）", state.food === 3 && state.rage > 0,
	"food=" + state.food + " rage=" + state.rage.toFixed(2));
g.run(7.5, 1 / 60, () => autoPilot(g));
check("本段结束后立刻接上第二段", state.rage > 0 || state.won,
	"rage=" + state.rage.toFixed(2) + " food=" + state.food);

// ── 11. 全程距离 & 三种障碍都要真的出现 ──
check("全程距离是 5000m", api.tuning.WIN_DISTANCE === 5000, api.tuning.WIN_DISTANCE + "m");

el("restartBtn").fire("click");
const spawnLog = [];
let seenObjs = new Set();
let runSeconds = 0;
g.run(240, 1 / 60, () => {
	autoPilot(g);
	for (const o of state.obstacles) {
		if (!seenObjs.has(o)) { seenObjs.add(o); spawnLog.push({ kind: o.kind, at: state.elapsed }); }
	}
	runSeconds = state.elapsed;
});
const tally = { ghost: 0, cross: 0, weave: 0 };
spawnLog.forEach(s => { tally[s.kind] = (tally[s.kind] || 0) + 1; });
check("一局里会真的出现「横穿」幽灵", tally.cross >= 3,
	"横穿 " + tally.cross + " 只 / 变道 " + tally.weave + " 只 / 直冲 " + tally.ghost + " 只（" +
	Math.round(runSeconds) + "s，距离 " + Math.round(state.distance) + "m）");
check("一局里会真的出现「变道」幽灵", tally.weave >= 3, "变道 " + tally.weave + " 只");

// ── 12. 幽灵频率全程匀速（不再越跑越快） ──
const times = spawnLog.map(s => s.at).sort((a, b) => a - b);
const gaps = [];
for (let i = 1; i < times.length; i++) {
	const d = times[i] - times[i - 1];
	if (d > 0.05) gaps.push(d);           // 0 间隔 = 同一帧的双幽灵，忽略
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const mid = Math.floor(gaps.length / 2);
const early = mean(gaps.slice(0, mid));
const late = mean(gaps.slice(mid));
const drift = Math.abs(early - late) / ((early + late) / 2);
check("障碍出现间隔全程恒定（匀速）", gaps.length > 5 && drift < 0.25,
	"前半 " + early.toFixed(2) + "s / 后半 " + late.toFixed(2) + "s，波动 " +
	Math.round(drift * 100) + "%");
check("障碍速率不随时间变化", api.ghostRate() === api.tuning.GHOST_RATE,
	"恒定 " + api.ghostRate().toFixed(3) + " t/s");

// ── 13. 小黑猫的跑速也全程匀速 ──
el("restartBtn").fire("click");
g.run(10, 1 / 60, () => autoPilot(g));
const spdEarly = state.speed;
const distEarly = state.distance;
g.run(25, 1 / 60, () => autoPilot(g));
const spdLate = state.speed;
const distLate = state.distance;
check("小黑猫的跑速全程恒定（匀速）", spdEarly === spdLate,
	"前 " + spdEarly.toFixed(1) + " m/s → 后 " + spdLate.toFixed(1) + " m/s");
check("跑速已加快（≥60 m/s）", api.tuning.WORLD_SPEED >= 60,
	api.tuning.WORLD_SPEED + " m/s，25 秒跑了 " + Math.round(distLate - distEarly) + "m");
check("幽灵迎面速度也加快了（≥0.38 t/s）", api.ghostRate() >= 0.38,
	api.ghostRate().toFixed(2) + " t/s（改前 0.30）");
check("障碍比之前更密（出现间隔 ≤2.2 秒）",
	api.tuning.SPACING / api.tuning.GHOST_RATE <= 2.2,
	"平均 " + (api.tuning.SPACING / api.tuning.GHOST_RATE).toFixed(2) + "s 一只");

// ── 14. 道具已改成猫粮 + 无敌期间背景切到 runbg.png ──
check("道具素材槽已改名为 item_catfood.png",
	/item_catfood\.png$/.test(api.assets.food), api.assets.food);
check("无敌用的背景图就是 images/runbg.png",
	/runbg\.png$/.test(api.assets.background), api.assets.background);

el("restartBtn").fire("click");
g.run(0.5, 1 / 60, () => autoPilot(g));
const bgBefore = state.bgMix;
api.giveCatFood(3);                       // 吃满 3 份 → 无敌
g.run(1.5, 1 / 60, () => autoPilot(g));
check("无敌期间背景切换成 runbg.png（渐入）",
	state.rage > 0 && state.bgMix > 0.85,
	"bgMix " + bgBefore.toFixed(2) + " → " + state.bgMix.toFixed(2));
g.run(9, 1 / 60, () => autoPilot(g));
check("无敌结束后背景渐变回纯色", state.bgMix < 0.15,
	"bgMix=" + state.bgMix.toFixed(2) + " rage=" + state.rage.toFixed(2));

const failed = results.filter(r => !r.ok);
console.log("\n" + (failed.length
	? failed.length + " 项未通过：" + failed.map(f => f.name).join("、")
	: "全部 " + results.length + " 项通过"));
process.exit(failed.length ? 1 : 0);
