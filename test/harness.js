/* 浏览器仿真环境：把 endless_run.js 放进 Node 的 vm 里跑，
   提供假的 DOM / canvas / Image / requestAnimationFrame，方便自动化验证。
   （只用于测试，不影响游戏本身） */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeCtx() {
	const calls = { drawImage: 0, fillText: 0, arc: 0, fill: 0 };
	const gradient = { addColorStop() {} };
	const target = {
		calls,
		createLinearGradient: () => gradient,
		createRadialGradient: () => gradient,
		drawImage: () => { calls.drawImage++; },
		fillText: () => { calls.fillText++; }
	};
	return new Proxy(target, {
		get(t, k) { return (k in t) ? t[k] : () => {}; },
		set(t, k, v) { t[k] = v; return true; }
	});
}

/* 可复现的伪随机数（mulberry32）：让难度基准测试每次跑出来都一样 */
function mulberry32(seed) {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeEl(id, ctxStub) {
	const handlers = {};
	return {
		id,
		textContent: "",
		style: {},
		width: 0,
		height: 0,
		classList: {
			_set: new Set(),
			add(c) { this._set.add(c); },
			remove(c) { this._set.delete(c); },
			toggle(c, on) {
				if (on === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
				else if (on) this._set.add(c);
				else this._set.delete(c);
			},
			contains(c) { return this._set.has(c); }
		},
		setAttribute() {},
		getContext() { return ctxStub; },
		addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
		fire(type, ev) { (handlers[type] || []).forEach(fn => fn(ev || {})); }
	};
}

/* 创建一局可被脚本驱动的游戏
   opts.file    : 要加载的 js 路径（默认 ../js/endless_run.js）
   opts.patch   : (源码) => 源码，用来做实验（例如关掉某类障碍）
   opts.optionalImages : 可选素材是否视为存在（默认 false → 走代码绘制兜底） */
function createGame(opts) {
	opts = opts || {};
	const file = opts.file || path.join(__dirname, "..", "js", "endless_run.js");
	let code = fs.readFileSync(file, "utf8");
	if (opts.patch) code = opts.patch(code);

	const ctxStub = makeCtx();
	const els = {};
	const el = (id) => els[id] || (els[id] = makeEl(id, ctxStub));
	const pips = [makeEl("pip0", ctxStub), makeEl("pip1", ctxStub), makeEl("pip2", ctxStub)];

	const documentStub = {
		getElementById: el,
		querySelectorAll: (sel) => (sel.indexOf("pip") >= 0 ? pips : []),
		// 染色缓存会用到离屏 canvas（游戏里用 createElement("canvas")）
		createElement: (tag) => makeEl(tag + "-offscreen", ctxStub)
	};

	class ImageStub {
		constructor() { this.width = 200; this.height = 320; this._src = ""; }
		set src(v) {
			this._src = v;
			const optional = /item_catfood|ghost_cross|ghost_weave|cat_rage/.test(v);
			if (optional && !opts.optionalImages) { if (this.onerror) this.onerror(); }
			else if (this.onload) this.onload();
		}
		get src() { return this._src; }
	}

	let rafCb = null;
	let clock = 0;
	const timers = [];

	const sandbox = {
		console: { warn() {}, log() {}, error: console.error },
		Image: ImageStub,
		document: documentStub,
		requestAnimationFrame(cb) { rafCb = cb; return 1; },
		cancelAnimationFrame() {},
		performance: { now: () => clock },
		setTimeout: (fn, ms) => { const t = { fn, at: clock + (ms || 0) }; timers.push(t); return t; },
		clearTimeout: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
		localStorage: { getItem: () => null, setItem() {} }
	};
	sandbox.window = sandbox;
	sandbox.globalThis = sandbox;
	sandbox.window.location = { search: "?lv=1", href: "" };
	sandbox.window.innerWidth = 1280;
	sandbox.window.innerHeight = 800;
	sandbox.window.devicePixelRatio = 1;
	sandbox.window.addEventListener = () => {};
	// 固定随机数种子，保证测试可复现（不想固定就传 { seed: null }）
	if (opts.seed !== null) {
		const rand = mulberry32(opts.seed === undefined ? 20260916 : opts.seed);
		const mathStub = Object.create(Math);
		mathStub.random = rand;
		sandbox.Math = mathStub;
	}

	vm.createContext(sandbox);
	vm.runInContext(code, sandbox, { filename: file });

	const api = sandbox.window.__endless;
	if (!api) throw new Error("游戏没有暴露 __endless，说明初始化中断");
	const state = api.state;

	function step(dt) {
		clock += dt * 1000;
		for (let i = timers.length - 1; i >= 0; i--) {
			if (timers[i].at <= clock) { const t = timers.splice(i, 1)[0]; t.fn(); }
		}
		const cb = rafCb;
		rafCb = null;
		if (cb) cb(clock);
	}

	function run(seconds, dt, onTick) {
		const total = Math.round(seconds / dt);
		for (let i = 0; i < total; i++) {
			step(dt);
			if (onTick) onTick(i, dt);
		}
	}

	return { api, state, el, pips, ctxStub, step, run, clock: () => clock };
}

/* 自动玩家：像人一样一次只换相邻的一条道，提前一点反应
   game 为 createGame() 的返回值；调用一次 = 一帧的操作 */
function autoPilot(game) {
	const { api, state } = game;
	if (state.over || state.cat.moving) return;
	const geom = api.geom();
	const tune = api.tuning;
	/* 横穿车在某个深度时的横向位置（与游戏里的公式一致） */
	const CROSS_SPAN = tune.CROSS_SWEEP_T1 - tune.CROSS_SWEEP_T0;
	function crossLaneAt(o, t) {
		const k = Math.max(0, Math.min(1, (t - tune.CROSS_SWEEP_T0) / CROSS_SPAN));
		return o.sweepFrom + (o.sweepTo - o.sweepFrom) * k;
	}
	/* 每条道「离危险还有多远」：把障碍在猫的深度窗口里会经过的车道都算进去，
	   这样斜着切过来的横穿车、会换道的变道车都能被正确预判 */
	const near = [Infinity, Infinity, Infinity];
	function mark(laneF, d) {
		if (Math.abs(laneF) > 1.05) return;          // 已经出跑道的不算
		const l = api.laneIndexOfF(laneF);
		if (d < near[l]) near[l] = d;
	}
	const WIN = 0.22;                                // 深度窗口半径
	for (const o of state.obstacles) {
		const d = geom.CAT_T - o.t;                  // 还要多少深度才到猫
		if (d < -WIN) continue;                      // 已经过去了
		if (o.kind === "cross" && o.sweepFrom !== undefined) {
			for (let t = geom.CAT_T - WIN; t <= geom.CAT_T + WIN; t += 0.04) {
				mark(crossLaneAt(o, t), Math.max(0, d));
			}
		} else if (o.kind === "weave") {
			mark(o.laneF, d);                        // 现在这条道
			mark((2 / 3) * (o.targetLane - 1), d);   // 它要换去的那条道
		} else {
			mark(o.laneF, d);
		}
	}
	const dangerLine = 0.45;
	const isDanger = (i) => near[i] < dangerLine;

	if (state.rage > 0) {
		// 无敌时顺手去吃猫粮
		const p = state.pickups.find(x => !x.dead && x.t < geom.CAT_T);
		if (p) {
			const t = api.laneIndexOfF(p.laneF);
			if (t !== state.cat.target) {
				state.cat.dir = Math.sign(t - state.cat.target);
				state.cat.target = state.cat.target + state.cat.dir;
				state.cat.moving = true;
			}
		}
		return;
	}
	if (!isDanger(state.cat.target)) return;

	const opts = [state.cat.target - 1, state.cat.target + 1].filter(i => i >= 0 && i <= 2);
	if (!opts.length) return;
	opts.sort((a, b) => {
		const da = isDanger(a) ? 1 : 0;
		const db = isDanger(b) ? 1 : 0;
		if (da !== db) return da - db;
		return near[b] - near[a];
	});
	if (isDanger(opts[0]) && near[opts[0]] <= near[state.cat.target]) return;
	state.cat.dir = Math.sign(opts[0] - state.cat.target);
	state.cat.target = opts[0];
	state.cat.moving = true;
}

module.exports = { createGame, autoPilot };
