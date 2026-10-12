(function () {
	"use strict";

	/* ==========================================================================
	   黑猫夜跑 · Endless Run
	   v2 改动：
	     · 道具「无敌猫粮」：吃满 3 份 → 短期加速 + 无敌（撞飞障碍并奖励距离）
	     · 新型障碍「横穿」cross：斜着切过整条跑道（暖色幽灵）
	     · 新型障碍「随机变道」weave：边前进边换道（品红系幽灵）
	     · 三种障碍全部使用幽灵素材，只用颜色区分行为（不再出现车辆）
	     · 背景改为纯色（想换回图片背景：把 BG_MODE 改成 "image"）
	     · 修复：图片缺失时黑屏卡死 / 越过猫的障碍遮挡顺序 / 变道途中的碰撞判定
	     · 需要插入的图片位置见 CORE_ASSETS 与 OPTIONAL_ASSETS 注释
	   ========================================================================== */

	//  ── 画布与上下文 ─────────────────────────────────────────────
	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");
	let DPR = window.devicePixelRatio || 1;
	let W = 0, H = 0;          // 逻辑尺寸(CSS 像素)

	//  ── 素材表 ───────────────────────────────────────────────────
	/* 必填素材：这些文件缺失会挡住开局（缺失时现在会给控制台提示，不再无限等待） */
	const CORE_ASSETS = {
		runbg: "../images/runbg.png",
		cat_l1: "../images/runcat_l1.png",
		cat_l2: "../images/runcat_l2.png",
		cat_straight: "../images/runcat_straight.png",
		ghost1: "../images/ghost_1.png",
		ghost2: "../images/ghost_2.png"
	};
	/* ★★★ 需要插入图片的位置 ★★★
	   以下素材全部可选：把文件放进 ../images/ 就自动生效；
	   没有文件时用代码绘制兜底（幽灵=光球、猫粮=代码画的猫粮碗），不会报错、不会黑屏。

	   ../images/item_catfood.png     无敌猫粮道具，建议 256×256 透明底 PNG
	   ../images/ghost_cross.png   「横穿」幽灵专用立绘（可选，不填就用 ghost_1/2 + 暖色）
	   ../images/ghost_weave.png   「变道」幽灵专用立绘（可选，不填就用 ghost_1/2 + 品红）
	   ../images/cat_rage.png      无敌状态下的黑猫（可选，建议与 runcat_*.png 同尺寸同朝向）

	   三种障碍默认共用 ghost_1 / ghost_2 的素材，只靠颜色区分行为：
	     直冲 = 原色 · 横穿 = 暖色 · 变道 = 品红系
	   想放多张：往对应数组里继续追加路径即可，例如
	     cross: ["../images/ghost_cross.png", "../images/ghost_cross_2.png"] */
	const OPTIONAL_ASSETS = {
		food:    ["../images/item_catfood.png"],
		catRage: ["../images/cat_rage.png"],
		cross:   ["../images/ghost_cross.png"],
		weave:   ["../images/ghost_weave.png"]
	};

	//  ── 背景 ─────────────────────────────────────────────────────
	/* "solid" = 纯色背景（现在这套），"image" = 用 ../images/runbg.png
	   想换配色改 BG_SOLID；想换回原来的背景图把 BG_MODE 改成 "image"。
	   BG_RAGE_IMAGE：无敌（吃满猫粮）期间把背景渐变切到 runbg.png —— 整个世界"变了"。 */
	const BG_MODE = "solid";
	const BG_SOLID = "#0a1424";
	const BG_RAGE_IMAGE = true;
	const BG_FADE_SPEED = 3.2;       // 背景切换速度（越大越快）

	const IMG = {};     // 核心素材：IMG.ghost1 ...
	const SKIN = {};    // 可选素材：SKIN.cross[0]（可能为 null → 走代码绘制）

	//  ── 跑道几何（透视：远小近大） ───────────────────────────────
	let APEX_X = 0, APEX_Y = 0;     // 远端消失点
	let BASE_Y = 0;                 // 近端宽边
	let BASE_HALF_W = 0;            // 近端半宽
	const LANES = 3;
	/* 车道中心的「横向参数」：±1 是跑道左右边缘，三条道中心在 -2/3 / 0 / +2/3。
	   像素 x = APEX_X + BASE_HALF_W * laneF * t（t 为深度 0~1），
	   这样任何横向位置（含横穿幽灵、变道途中的中间点）都能统一参与碰撞判定。 */
	const LANE_F = [-2 / 3, 0, 2 / 3];
	const EDGE_F = 1;
	let LANE_X = [0, 0, 0];
	let CAT_LANE_X = [0, 0, 0];

	//  ── 尺寸参数 ─────────────────────────────────────────────────
	let CAT_FULL_H, CAT_H, GHOST_FULL_H, FOOD_FULL_H;
	let CAT_T = 0.7;
	let CAT_CENTER_Y = 0;           // 猫中心 Y
	function perspScale(t) { return 0.09 + t * 0.91; }   // 透视缩放

	function layout() {
		W = window.innerWidth;
		H = window.innerHeight;
		APEX_X = W / 2;
		BASE_Y = H;
		APEX_Y = H * (1 / 3);
		BASE_HALF_W = W * 0.40;
		// 近端车道中心（t=1 时）：x = APEX_X + BASE_HALF_W * laneF
		for (let i = 0; i < LANES; i++) {
			LANE_X[i] = APEX_X + BASE_HALF_W * LANE_F[i];
		}

		CAT_FULL_H = Math.max(80, Math.min(300, H * 0.235));
		// 三种障碍共用同一个幽灵尺寸，只靠颜色区分 → 画面更统一
		GHOST_FULL_H = Math.max(60, Math.min(260, H * 0.20));
		FOOD_FULL_H = Math.max(44, Math.min(180, H * 0.135));

		const footY = BASE_Y - CAT_BOTTOM_GAP;
		CAT_T = clamp((footY - APEX_Y) / (BASE_Y - APEX_Y), 0.15, 1);
		// 猫按同一透视曲线缩放，使其与同深度的幽灵大小协调
		CAT_H = CAT_FULL_H * perspScale(CAT_T);
		CAT_CENTER_Y = footY - CAT_H * 0.5;

		for (let i = 0; i < LANES; i++) {
			CAT_LANE_X[i] = laneXAt(i, CAT_T);
		}
		canvas.width = Math.floor(W * DPR);
		canvas.height = Math.floor(H * DPR);
		ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
	}

	//  ── 游戏状态 ─────────────────────────────────────────────────
	const state = {
		live: false,
		paused: false,
		over: false,
		won: false,        // 是否达成胜利距离
		distance: 0,       // 距离(m)
		elapsed: 0,        // 已进行时间(秒)
		speed: 26,         // 当前速度(m/s)
		animTime: 0,       // 动画时钟
		food: 0,           // 已收集的无敌猫粮数量 0~FOOD_MAX
		rage: 0,           // 无敌剩余秒数
		grace: 0,          // 无敌结束后的短暂保护
		shake: 0,          // 屏幕震动强度 0~1
		flash: 0,          // 全屏闪光强度 0~1
		bgMix: 0,          // 背景图混合度：0=纯色，1=runbg.png（无敌时渐变到 1）
		cat: {
			target: 1,     // 目标跑道 0/1/2
			x: 0,          // 当前绘制 X
			moving: false, // 是否正在切换跑道
			dir: 0         // -1 左, +1 右
		},
		obstacles: [],
		pickups: [],       // 场上的猫粮
		bursts: [],        // 撞飞 / 拾取特效
		popups: [],        // 飘字（+1 猫粮 / +25m）
		trail: []          // 无敌状态下的残影
	};
	/* 里程速度：小黑猫的“跑速”，全程恒定（匀速），不再越跑越快。
	   它只影响距离数字的推进快慢（5000m 一局约 70 秒），不影响碰撞判定；
	   想改成“越跑越快”，把这里换成 BASE + elapsed × k 即可。 */
	const WORLD_SPEED = 70;          // m/s
	const CAT_SPEED = 0.80;          // 猫换道的横向速度（相对 W 的比例，越大越灵敏）
	const COLLIDE_MARGIN = 0.3;      // 深度方向重叠系数（占两者高度和的比例）
	/* 横向碰撞：以「半个车道」为上限，再按两者的实际宽度收窄
	   · 猫的立绘 2848×1600，左右有大量透明留白，直接按图片宽度判定会
	     出现“人在隔壁道却被判死”，所以用一个固定的有效碰撞宽度。
	   · 上限 0.5 个车道保证：隔壁车道的障碍永远不会误判为碰撞。 */
	const CAT_HIT_W = 0.85;          // 猫的有效碰撞宽度 = 身高 × 该系数
	const HIT_LANE_RATIO = 0.5;      // 横向判定上限（车道宽的倍数）
	/* 障碍推进速率（t/秒）—— 全程恒定，不再越跑越快：
	   它同时决定「幽灵迎面而来的速度」和「生成间隔」，
	   所以改这一个数就能整体加快/放慢，间距（SPACING）始终保持不变 */
	const GHOST_RATE = 0.40;
	const SPACING = 0.8;             // 相邻障碍的间距（以跑道长度计，越大越稀）
	const LANE_CLEAR_T = 0.7;        // 同一条道的占用判定：t 超过它就不再算“占用”
	const DOUBLE_GHOST_CHANCE = 0.10; // 10% 概率同时来两只幽灵（分处不同车道）
	const OVERTAKE_BOOST = 1;        // 越过猫之后的额外提速倍数（1 = 不额外提速）
	const SPAWN_LEAD = 0.55;         // 开局缓冲（以 travel 计）

	/* 新型障碍的出现节奏：开局先给玩家熟悉跑道的时间，之后逐步加入 */
	const CROSS_UNLOCK = 5;          // 秒：横穿幽灵解禁
	const WEAVE_UNLOCK = 7;          // 秒：变道幽灵解禁
	/* 生成权重：每次刷障碍时，直冲幽灵权重恒为 1，横穿/变道按下面两条逐渐加到上限
	   （0.40 表示“三种障碍大致 5:2:2”） */
	const CROSS_WEIGHT_MAX = 0.40;
	const WEAVE_WEIGHT_MAX = 0.40;
	const MIX_RAMP = 0.06;           // 解禁后每秒增加的权重（约 7 秒加到上限）
	const CROSS_MAX_ALIVE = 3;       // 场上横穿幽灵上限
	const WEAVE_MAX_ALIVE = 3;       // 场上变道幽灵上限
	/* 横穿车按「深度」而不是按时间横移：
	   它先沿跑道边缘开过来（t < CROSS_SWEEP_T0），然后在驶近玩家的过程中
	   斜着切过整条跑道（CROSS_SWEEP_T0 → CROSS_SWEEP_T1）。
	   好处是轨迹可预测、看得懂该往哪边躲，而且一定会在玩家面前切过去。 */
	const CROSS_SWEEP_T0 = 0.30;     // 开始横穿的深度
	const CROSS_SWEEP_T1 = 1.00;     // 横穿结束的深度
	const CROSS_EDGE_F = 1.28;       // 起/终点：跑道外侧
	const CROSS_EXIT_F = 1.45;       // 横向参数超过该值即彻底淡出
	const WEAVE_V = 1.40;            // 变道速度（横向参数/秒，约 0.5 秒换一条道；世界变快后同步提速）
	const WEAVE_MAX_TIMES = 2;       // 单辆车最多变道次数（保证始终有活路）
	const WEAVE_LOCK_T = 0.45;       // 距猫还有这么多深度时不再换道（不能最后一秒变道坑人）

	/* 无敌猫粮 */
	const FOOD_MAX = 3;              // 集满 3 份触发
	const RAGE_DURATION = 6.5;       // 无敌加速持续秒数
	const RAGE_SPEED_MULT = 1.55;    // 速度倍率
	const RAGE_TAIL = 1.2;           // 结束前多少秒开始平滑回落
	const RAGE_GRACE = 0.7;          // 无敌结束后的保护时间
	const RAGE_SMASH_BONUS = 25;     // 撞飞障碍奖励距离(m)
	const FOOD_FIRST_GAP = 1.6;      // 第一份猫粮出现在开局后 travel 距离
	const FOOD_GAP_MIN = 2.6;        // 后续猫粮间距下限
	const FOOD_GAP_MAX = 4.0;        // 后续猫粮间距上限
	const FOOD_MAX_ALIVE = 2;        // 场上同时存在的猫粮上限
	const PICKUP_BAND = 0.85;        // 拾取判定带（占两者高度和的比例，比碰撞宽松）

	const KIND_GHOST = "ghost";
	const KIND_WEAVE = "weave";
	const KIND_CROSS = "cross";

	/* 障碍外观参数
	   wf   = 绘制宽高比（宽 = 高 × wf），同时用于碰撞横向判定
	   band = 碰撞的深度重叠系数 */
	const OBSTACLE_SPEC = {
		ghost: { wf: 0.98, band: 0.30 },
		weave: { wf: 0.98, band: 0.30 },
		cross: { wf: 0.98, band: 0.30 }
	};
	/* 三种障碍共用幽灵素材，用「颜色」区分行为：
	   直冲 = 原色；横穿 = 暖色；变道 = 品红/青。
	   GHOST_TINT_ALPHA 是染色浓度，0 = 完全不染色（三只看起来一模一样） */
	const GHOST_TINT_ALPHA = 0.5;
	const GHOST_TINTS = { cross: ["#ff5a3c", "#ff8a1f", "#ff3d6e"], weave: ["#b45cff", "#25e0c8", "#7c6cff"] };
	const GHOST_COLOR = "#8fe3ff";     // 直冲幽灵的原色（也用于缺图时的兜底光球）
	const FOOD_COLOR = "#ffc24a";

	//  ── 关卡配置 ─────────────────────────────────────────────────
	/* 由 URL 的 ?lv=N 选择（剧情里 goto 时带上，如 endless_run.html?lv=2）
	   · ghostSpeed：障碍推进速率倍数（同时作用于移动与生成节奏 → 间距恒定、整体变快）
	   · winDistance：走满该距离即胜利 */
	const LEVELS = {
		"1": { ghostSpeed: 1.0, winDistance: 5000 },   // 第一次：南乡家
		"2": { ghostSpeed: 1.2, winDistance: 5000 }    // 第二次：千崎刑警的梦境（幽灵更快）
	};
	const DEFAULT_LEVEL = "1";
	function levelKey() {
		const m = /[?&]lv=([^&]+)/.exec(window.location.search || "");
		const key = m ? decodeURIComponent(m[1]) : DEFAULT_LEVEL;
		return LEVELS[key] ? key : DEFAULT_LEVEL;
	}
	const LEVEL_ID = levelKey();
	const GHOST_SPEED_MULT = LEVELS[LEVEL_ID].ghostSpeed;
	const WIN_DISTANCE = LEVELS[LEVEL_ID].winDistance;   // 通关所需距离（随关卡变化）

	/* 胜利后回到原对话的「后一句」 ----------------------------------------
	   剧情页（index.html）在跳进小游戏前会把「本句的下一句」写入 localStorage
	   的 vn_minigame_return（见 main.js 的 beginExit）。这里带上 ?save=键名
	   跳回 index.html，存档系统的 bootstrapResume 会把它解析成续玩指令，
	   于是从原对话的后一句继续播放。
	   找不到返回点时依次退回到自动存档，最后退回纯 index.html。 */
	/* 返回点候选键：裸键优先；登录状态下自动存档带 u:<用户>: 前缀，也一并列进来 */
	const RETURN_KEYS = (function () {
		const ks = ["vn_minigame_return", "vn_save_auto"];
		try {
			if (window.VN && VN.userStore && VN.userStore.key) {
				const named = VN.userStore.key("vn_save_auto");
				if (named && ks.indexOf(named) < 0) ks.push(named);
			}
		} catch (e) { /* 未登录 / 无 userStore：保持裸键 */ }
		return ks;
	})();
	const FALLBACK_PAGE = "plot.html";
	/* 返回点键名（找不到则 null）：既用于默认回剧情，也用于 ?next= 时把返回点一起带过去 */
	function resolveReturnKey() {
		for (let i = 0; i < RETURN_KEYS.length; i++) {
			let raw = null;
			try { raw = window.localStorage.getItem(RETURN_KEYS[i]); } catch (e) { /* 隐私模式等 */ }
			if (!raw) continue;
			try {
				const s = JSON.parse(raw);
				if (s && typeof s.index === 'number' && s.index >= 0) return RETURN_KEYS[i];
			} catch (e) { /* 存档损坏，尝试下一个 */ }
		}
		return null;
	}
	function resolveNextPage() {
		const key = resolveReturnKey();
		return key ? (FALLBACK_PAGE + "?save=" + encodeURIComponent(key)) : FALLBACK_PAGE;
	}

	/*  通关后去哪（链式小游戏） ------------------------------------------
	   默认（URL 不带 ?next=）：回剧情，从原对话的「后一句」继续。
	   若 URL 带了 ?next=某页——剧情里 goto 时带上，例如
	     endless_run.html?next=rpg1.html
	     endless_run.html?lv=2&next=rpg2.html
	   ——则通关后先去该页（跑酷 → RPG 搜证 → 推理 → CG → 回剧情），
	   并把返回点以 ?save=键名 一并带过去，方便后续页面沿用/回剧情。
	   ?next= 是整条链路的入口，改动或重新导出本文件时请勿丢失。 */
	function nextParam() {
		const m = /[?&]next=([^&]+)/.exec(window.location.search || "");
		if (!m) return null;
		try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
	}
	function composeNextPage() {
		const custom = nextParam();
		if (!custom) return resolveNextPage();
		const key = resolveReturnKey();
		if (!key) return custom;
		return custom + (custom.indexOf("?") >= 0 ? "&" : "?") + "save=" + encodeURIComponent(key);
	}
	const NEXT_PAGE = composeNextPage();
	console.info("[endless_run] 关卡=" + LEVEL_ID + "，通关后前往：" + NEXT_PAGE);
	const CM_PX = 96 / 2.54;         // 1cm ≈ 37.795 CSS px
	const CAT_BOTTOM_GAP = 3 * CM_PX; // 猫底端离页面底部 3cm
	const MAX_OBS = 18;

	state.travel = 0;               // 全局障碍路程（单位：跑道长度比例）
	state.spawnTravel = SPAWN_LEAD; // 距下一次生成的剩余路程
	state.foodSpawnTravel = FOOD_FIRST_GAP;

	//  ── DOM ──────────────────────────────────────────────────────
	const distanceText = document.getElementById("distanceText");
	const pauseBtn = document.getElementById("pauseBtn");
	const pauseOverlay = document.getElementById("pauseOverlay");
	const pauseDistance = document.getElementById("pauseDistance");
	const gameOverOverlay = document.getElementById("gameOverOverlay");
	const winOverlay = document.getElementById("winOverlay");
	const pauseRestartBtn = document.getElementById("pauseRestartBtn");
	const finalDistance = document.getElementById("finalDistance");
	const resumeBtn = document.getElementById("resumeBtn");
	const restartBtn = document.getElementById("restartBtn");
	const nextPageBtn = document.getElementById("nextPageBtn");
	const hint = document.getElementById("hint");
	const foodHud = document.getElementById("foodHud");
	const foodCountEl = document.getElementById("foodCount");
	const foodPips = Array.prototype.slice.call(document.querySelectorAll("#foodPips .pip"));
	const rageTrack = document.getElementById("rageTrack");
	const rageFill = document.getElementById("rageFill");
	const toastEl = document.getElementById("toast");

	//  ── 工具 ─────────────────────────────────────────────────────
	function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
	function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
	function lerp(a, b, t) { return a + (b - a) * t; }
	function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

	//  ── 图片加载 ─────────────────────────────────────────────────
	let coreLoaded = 0;
	let coreStarted = false;
	function coreDone() {
		coreLoaded++;
		if (coreLoaded >= Object.keys(CORE_ASSETS).length && !coreStarted) {
			coreStarted = true;
			beginRun();
		}
	}
	function loadCore(key) {
		const img = new Image();
		// 成功或失败都要计数：以前只要有一张图路径写错，游戏就永远停在这一步（黑屏）
		img.onload = function () { IMG[key] = img; coreDone(); };
		img.onerror = function () {
			IMG[key] = null;
			coreDone();
			if (window.console) console.warn("[endless_run] 缺少素材：" + CORE_ASSETS[key]);
		};
		img.src = CORE_ASSETS[key];
	}
	/* 可选素材：加载失败就留 null，绘制时用代码兜底，不影响开局 */
	function loadOptional(slot, list) {
		SKIN[slot] = list.map(function () { return null; });
		list.forEach(function (src, i) {
			const img = new Image();
			img.onload = function () { SKIN[slot][i] = img; };
			img.onerror = function () { /* 用代码绘制兜底 */ };
			img.src = src;
		});
	}
	/* 取某类可选素材里第一张已就绪的图片，没有则返回 null */
	function skin(slot, variant) {
		const list = SKIN[slot];
		if (!list) return null;
		const ok = list.filter(Boolean);
		if (!ok.length) return null;
		return ok[Math.abs(variant | 0) % ok.length];
	}

	//  ── 速度/难度节奏 ─────────────────────────────────────────────
	function updateDifficulty() {
		// 全程匀速：里程速度恒定，只有无敌加速会按倍率临时提升（结尾平滑回落）
		state.speed = WORLD_SPEED * rageFactor();
	}
	/* 无敌加速倍率：最后 RAGE_TAIL 秒线性回落到 1，避免速度突然掉档 */
	function rageFactor() {
		if (state.rage <= 0) return 1;
		const tail = Math.min(1, state.rage / RAGE_TAIL);
		return 1 + (RAGE_SPEED_MULT - 1) * tail;
	}
	function isInvincible() { return state.rage > 0 || state.grace > 0; }

	/* 障碍推进速率：全程恒定（匀速）——迎面而来的速度和生成间隔都不再变化，
	   只有关卡倍率会整体放大（第二关更快） */
	function ghostRate() {
		return GHOST_RATE * GHOST_SPEED_MULT;
	}
	/* 世界推进速率：无敌加速时整个世界同步加快（与距离增速一致） */
	function worldRate() { return ghostRate() * rageFactor(); }

	//  ── 障碍物生成 ───────────────────────────────────────────────
	/* 横向参数 laneF → 车道序号 0/1/2
	   三条道中心在 -2/3 / 0 / +2/3，所以序号 = 1 + laneF × 1.5
	   （-2/3 → 0，0 → 1，+2/3 → 2；写成 laneF÷(2/3) 会整体错一位） */
	function laneIndexOfF(laneF) {
		return clamp(Math.round(1 + laneF * 1.5), 0, LANES - 1);
	}
	/* 障碍所处的车道序号；已滑出跑道的横穿车返回 -1（不算占道） */
	function laneIndexOf(o) {
		if (Math.abs(o.laneF) > EDGE_F * 1.05) return -1;
		return laneIndexOfF(o.laneF);
	}

	function freeLanes() {
		// 返回当前未被“靠近中的障碍”占满的空闲跑道
		const busy = [false, false, false];
		state.obstacles.forEach(o => {
			if (o.t > LANE_CLEAR_T) return;    // 同车道保持最小间距，其余车道不受影响
			const l = laneIndexOf(o);
			if (l >= 0) busy[l] = true;
		});
		const free = [];
		for (let i = 0; i < LANES; i++) if (!busy[i]) free.push(i);
		return free;
	}

	function countKind(kind) {
		let n = 0;
		for (const o of state.obstacles) if (o.kind === kind) n++;
		return n;
	}

	/* 猫的深度窗口里“正在逼近”的障碍数量 —— 用来避免刷出必死的组合 */
	function nearCatCount() {
		let n = 0;
		for (const o of state.obstacles) {
			if (o.t > 0.4 && o.t < 1.0) n++;
		}
		return n;
	}
	/* 是否有车正在横穿跑道（此时最忌讳再叠一波幽灵） */
	function crossingActive() {
		for (const o of state.obstacles) {
			if (o.kind === KIND_CROSS && !o.done && Math.abs(o.laneF) <= EDGE_F * 1.05) return true;
		}
		return false;
	}

	function makeGhost(lane) {
		return {
			kind: KIND_GHOST, laneF: LANE_F[lane], t: 0, t0: state.travel,
			phase: Math.random() * Math.PI * 2,
			color: GHOST_COLOR, tint: null, variant: 0
		};
	}

	function makeWeave(lane) {
		const idx = randInt(0, GHOST_TINTS.weave.length - 1);
		const tint = GHOST_TINTS.weave[idx];
		return {
			kind: KIND_WEAVE, laneF: LANE_F[lane], t: 0, t0: state.travel,
			phase: Math.random() * Math.PI * 2,
			color: tint, tint: tint, variant: idx,
			targetLane: lane, weaveTimer: 0.5 + Math.random() * 0.4, weaveLeft: WEAVE_MAX_TIMES
		};
	}

	function makeCross() {
		const dir = Math.random() < 0.5 ? -1 : 1;    // -1 由右向左，+1 由左向右
		const idx = randInt(0, GHOST_TINTS.cross.length - 1);
		const tint = GHOST_TINTS.cross[idx];
		const from = -dir * CROSS_EDGE_F;            // 从跑道外侧驶入
		return {
			kind: KIND_CROSS,
			laneF: from, sweepFrom: from, sweepTo: -from,
			t: 0, t0: state.travel, phase: 0,
			dir: dir, done: false,
			color: tint, tint: tint, variant: idx
		};
	}

	/* 每次生成事件决定来什么：直冲幽灵权重恒为 1，
	   横穿 / 变道幽灵在解禁后按权重逐渐加入（所以一定会出现，不会被饿死） */
	function pickSpawnKind() {
		const e = state.elapsed;
		const crossW = e < CROSS_UNLOCK ? 0
			: Math.min(CROSS_WEIGHT_MAX, (e - CROSS_UNLOCK) * MIX_RAMP);
		const weaveW = e < WEAVE_UNLOCK ? 0
			: Math.min(WEAVE_WEIGHT_MAX, (e - WEAVE_UNLOCK) * MIX_RAMP);
		const r = Math.random() * (1 + crossW + weaveW);
		if (r < crossW && countKind(KIND_CROSS) < CROSS_MAX_ALIVE && nearCatCount() <= 1) {
			return KIND_CROSS;
		}
		if (r < crossW + weaveW && countKind(KIND_WEAVE) < WEAVE_MAX_ALIVE && nearCatCount() <= 2) {
			return KIND_WEAVE;
		}
		return KIND_GHOST;
	}

	function spawnObstacle() {
		if (state.obstacles.length >= MAX_OBS) return;
		const free = freeLanes();
		if (free.length === 0) return;         // 保证始终有路可走

		const kind = pickSpawnKind();
		if (kind === KIND_CROSS) { state.obstacles.push(makeCross()); return; }
		if (kind === KIND_WEAVE) { state.obstacles.push(makeWeave(pick(free))); return; }

		const lane = free[randInt(0, free.length - 1)];
		state.obstacles.push(makeGhost(lane));
		// 10% 概率再同时来一只：必须选不同车道，始终留出至少一条通路
		// （如果正好有车在横穿，就别再叠一只，避免出现躲不掉的组合）
		if (Math.random() < DOUBLE_GHOST_CHANCE && free.length >= 2
			&& nearCatCount() < 2 && !crossingActive()) {
			const rest = free.filter(l => l !== lane);
			state.obstacles.push(makeGhost(rest[randInt(0, rest.length - 1)]));
		}
	}

	//  ── 无敌猫粮：生成与拾取 ─────────────────────────────────────
	function spawnFood() {
		if (state.pickups.length >= FOOD_MAX_ALIVE) return;
		if (state.rage > 0 && state.food >= FOOD_MAX) return;   // 无敌中且已满，不再刷
		const free = freeLanes();
		if (free.length === 0) return;                          // 三条道都被占，等下一次
		const lane = free[randInt(0, free.length - 1)];
		state.pickups.push({
			lane: lane, laneF: LANE_F[lane], t: 0,
			phase: Math.random() * Math.PI * 2, dead: false
		});
	}

	function checkPickups() {
		const cx = state.cat.x;
		const cy = catCenterY();
		const ch = CAT_H;
		const cw = CAT_H * CAT_HIT_W;
		/* 拾取判定要“大方”，但绝不能跨到隔壁车道去捡：
		   所以同样以半个车道为上限（略放宽到 0.52） */
		const lateralCap = laneSpacingPx() * 0.52;
		for (const p of state.pickups) {
			if (p.dead) continue;
			const py = laneYAt(p.t);
			const ph = FOOD_FULL_H * perspScale(p.t);
			// 深度判定比障碍宽松一些，手感更顺
			if (Math.abs(py - cy) > (ph + ch) * 0.5 * PICKUP_BAND) continue;
			const px = laneXAtF(p.laneF, CAT_T);
			const pw = ph * 1.05;      // 猫粮碗比油桶宽一点，拾取判定同步放宽
			const band = Math.min((pw + cw) * 0.5, lateralCap);
			if (Math.abs(px - cx) > band) continue;
			p.dead = true;
			collectFood(px, py);
		}
	}

	function collectFood(x, y) {
		if (state.food < FOOD_MAX) state.food++;
		popup(x, y - 40, "+1 猫粮", "#ffd98a");
		burst(x, y, FOOD_COLOR, 0.55);
		if (state.food >= FOOD_MAX && state.rage <= 0) {
			startRage();
		} else {
			toast("猫粮 " + state.food + "/" + FOOD_MAX, "warm");
		}
		updateFoodHud(true);
	}

	function startRage() {
		state.food = 0;
		state.rage = RAGE_DURATION;
		state.flash = 1;
		state.shake = Math.max(state.shake, 0.6);
		toast("猫粮吃饱 · 无敌冲刺！", "rage");
		updateFoodHud(true);
	}

	/* 无敌结束：把贴着猫的障碍清掉，再给 0.7 秒保护，
	   避免「解无敌瞬间正好被夹在障碍里」这种不讲理的死法 */
	function endRage() {
		const cy = catCenterY();
		state.obstacles = state.obstacles.filter(o => {
			const oy = laneYAt(o.t);
			const oh = obstacleHeight(o);
			return Math.abs(oy - cy) > (oh + CAT_H) * 0.5 * 1.2;
		});
		state.grace = RAGE_GRACE;
		toast("猫粮效果结束", "");
	}

	function smashObstacle(o) {
		o.dead = true;
		const x = laneXAtF(o.laneF, CAT_T);
		const y = laneYAt(o.t);
		burst(x, y, o.color, 1);
		popup(x, y - 46, "击飞 +" + RAGE_SMASH_BONUS + "m", "#ffd98a");
		state.distance += RAGE_SMASH_BONUS;
		state.shake = 1;
	}

	//  ── 特效与飘字 ───────────────────────────────────────────────
	function burst(x, y, color, power) {
		state.bursts.push({ x: x, y: y, color: color, life: 0.45, max: 0.45, power: power || 0.6 });
		if (state.bursts.length > 12) state.bursts.shift();
	}
	function popup(x, y, text, color) {
		state.popups.push({ x: x, y: y, text: text, color: color, life: 0.9 });
		if (state.popups.length > 6) state.popups.shift();
	}
	let toastTimer = null;
	function toast(text, cls) {
		if (!toastEl) return;
		toastEl.textContent = text;
		toastEl.className = "toast show" + (cls ? " " + cls : "");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => { toastEl.className = "toast"; }, 1500);
	}

	//  ── 主角移动 ─────────────────────────────────────────────────
	function stepCat(dir) {
		if (!state.live || state.paused || state.over) return;
		const next = state.cat.target + dir;
		if (next < 0 || next > 2) return;
		state.cat.target = next;
		state.cat.dir = dir;
		state.cat.moving = true;
	}

	function updateCat(dt) {
		if (!state.cat.moving) return;
		const targetX = CAT_LANE_X[state.cat.target];
		const dx = targetX - state.cat.x;
		const step = W * CAT_SPEED * dt;
		if (Math.abs(dx) <= step) {
			state.cat.x = targetX;
			state.cat.moving = false;
		} else {
			state.cat.x += Math.sign(dx) * step;
		}
	}

	//  ── 透视坐标换算 ─────────────────────────────────────────────
	function laneXAt(lane, t) { return laneXAtF(LANE_F[lane], t); }
	function laneYAt(t) { return APEX_Y + (BASE_Y - APEX_Y) * t; }
	/* 横向参数 → 像素 x：同一个 laneF 在不同深度下的屏幕 x */
	function laneXAtF(laneF, t) { return APEX_X + BASE_HALF_W * laneF * t; }
	// 猫的位置全部基于“猫站立深度”：Y 由底端离底 3cm 推出，X 就是实际绘制 X
	function catCenterY() { return CAT_CENTER_Y; }

	//  ── 精灵与尺寸 ───────────────────────────────────────────────
	function catImage() {
		if (state.rage > 0 && SKIN.catRage && SKIN.catRage[0]) return SKIN.catRage[0];
		if (state.cat.moving || state.cat.target !== 1) {
			// 移动中 / 停在左右道时用 l1/l2 快速切换的跑动姿态
			const f = (Math.floor(state.animTime / 0.12) % 2) === 0;
			return f ? IMG.cat_l1 : IMG.cat_l2;
		}
		// 稳定在中间道：正面奔跑姿态
		return IMG.cat_straight;
	}
	function catWidth() {
		const img = catImage();
		const ar = img && img.height ? (img.width / img.height) : 0.9;
		return CAT_H * clamp(ar, 0.35, 2.2);
	}
	function obstacleHeight(o) {
		return GHOST_FULL_H * perspScale(o.t);
	}
	function ghostWidth(o, img, gh) {
		if (img && img.height) return gh * (img.width / img.height);
		return gh * OBSTACLE_SPEC.ghost.wf;
	}
	/* 障碍的绘制宽高比：有专属立绘以图片为准（夹在合理范围内），
	   否则三种幽灵都用 ghost_1/ghost_2 的比例。
	   注意猫的立绘 2848×1600 带大量透明留白，所以猫用的是固定有效宽度 */
	function obstacleWidthRatio(o) {
		const spec = OBSTACLE_SPEC[o.kind] || OBSTACLE_SPEC.ghost;
		const custom = o.kind === KIND_GHOST ? null : skin(o.kind, o.variant);
		const img = custom || (Math.floor(state.animTime / 0.14) % 2 === 1 ? IMG.ghost1 : IMG.ghost2);
		if (img && img.height) return clamp(img.width / img.height, 0.5, 2.4);
		return spec.wf;
	}
	// 朝向：runcat_l 原图朝左，水平翻转后朝右
	// 移动时按移动方向；稳定时：左道朝右（翻转），右道朝左（原图）
	function catFlip() {
		if (state.cat.moving) return state.cat.dir > 0;
		return state.cat.target === 0;
	}

	//  ── 碰撞检测（2D 透视下：深度重叠 + 横向重叠） ───────────────
	/* 老版本只比较“车道序号”，猫在变道途中正好卡在两条道中间时，
	   会被算成离它更近的那一条，于是出现「看着没撞却判死 / 看着撞了却没判」。
	   现在统一换算成连续的横向参数 laneF 再做重叠判断。 */
	function hitObstacle() {
		const cx = state.cat.x;
		const cy = catCenterY();
		for (const o of state.obstacles) {
			if (o.dead) continue;
			const oy = laneYAt(o.t);
			const oh = obstacleHeight(o);
			const spec = OBSTACLE_SPEC[o.kind] || OBSTACLE_SPEC.ghost;
			const depthBand = (oh + CAT_H) * 0.5 * COLLIDE_MARGIN * (spec.band / 0.3);
			if (Math.abs(oy - cy) >= depthBand) continue;
			const ox = laneXAtF(o.laneF, CAT_T);
			if (Math.abs(ox - cx) < hitHalfWidthPx(o)) return o;
		}
		return null;
	}

	/* 一个车道在“猫所在深度”上的像素宽度 */
	function laneSpacingPx() { return BASE_HALF_W * CAT_T * (2 / 3); }
	/* 横向判定的半宽：两者宽度之和的一半，但不超过半个车道 */
	function hitHalfWidthPx(o) {
		const catW = CAT_H * CAT_HIT_W;
		const obsW = obstacleHeight(o) * obstacleWidthRatio(o);
		return Math.min((catW + obsW) * 0.5, laneSpacingPx() * HIT_LANE_RATIO);
	}

	//  ── 绘制：基础 ───────────────────────────────────────────────
	function roundRect(x, y, w, h, r) {
		const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
		ctx.beginPath();
		ctx.moveTo(x + rr, y);
		ctx.arcTo(x + w, y, x + w, y + h, rr);
		ctx.arcTo(x + w, y + h, x, y + h, rr);
		ctx.arcTo(x, y + h, x, y, rr);
		ctx.arcTo(x, y, x + w, y, rr);
		ctx.closePath();
	}

	function groundShadow(x, y, w, h) {
		ctx.fillStyle = "rgba(0,0,20,0.30)";
		ctx.beginPath();
		ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	function drawBackground() {
		ctx.save();
		ctx.fillStyle = BG_SOLID;
		ctx.fillRect(0, 0, W, H);
		/* bgMix：平时是 0（纯色），吃满猫粮进入无敌后渐变到 1（runbg.png），
		   无敌结束后再渐回纯色 —— 用缓动而不是硬切，画面不会突兀 */
		const mix = clamp(state.bgMix, 0, 1);
		if (mix > 0.002 && IMG.runbg) {
			ctx.globalAlpha = mix;
			// 无敌加速时背景轻微推近，强化“更快了”的感觉
			const zoom = 1.06 + 0.06 * Math.sin(state.animTime * 0.6)
				+ (rageFactor() - 1) * 0.12;
			const scale = Math.max(W / IMG.runbg.width, H / IMG.runbg.height);
			const dw = IMG.runbg.width * scale;
			const dh = IMG.runbg.height * scale;
			ctx.translate(W / 2, H / 2);
			ctx.scale(zoom, zoom);
			ctx.drawImage(IMG.runbg, -dw / 2, -dh / 2, dw, dh);
		}
		// 平时不画别的：整个天空就是一个纯色
		ctx.restore();
	}

	/* 每帧推进背景混合度（放在主循环里，暂停/结算时也能平滑过渡） */
	function updateBackground(dt) {
		const wantImage = IMG.runbg
			&& ((state.rage > 0 && BG_RAGE_IMAGE) || BG_MODE === "image");
		const target = wantImage ? 1 : 0;
		if (Math.abs(state.bgMix - target) < 0.002) {
			state.bgMix = target;
			return;
		}
		state.bgMix += (target - state.bgMix) * Math.min(1, dt * BG_FADE_SPEED);
	}

	function drawTrack() {
		// 三角跑道底色（由远及近的透视）
		ctx.save();
		const grad = ctx.createLinearGradient(0, APEX_Y, 0, BASE_Y);
		grad.addColorStop(0, "rgba(10, 26, 54, 0.20)");
		grad.addColorStop(0.55, "rgba(14, 34, 66, 0.42)");
		grad.addColorStop(1, "rgba(20, 46, 86, 0.58)");
		ctx.beginPath();
		ctx.moveTo(APEX_X, APEX_Y);
		ctx.lineTo(APEX_X - BASE_HALF_W, BASE_Y);
		ctx.lineTo(APEX_X + BASE_HALF_W, BASE_Y);
		ctx.closePath();
		ctx.fillStyle = grad;
		ctx.fill();

		// 跑道边缘 + 两条内部车道分隔线（汇聚到消失点 = 由远及近）
		const edges = [
			{ baseX: APEX_X - BASE_HALF_W, w: 4, color: "rgba(150, 220, 255, 0.75)" },
			{ baseX: APEX_X + BASE_HALF_W, w: 4, color: "rgba(150, 220, 255, 0.75)" }
		];
		// 三条跑道之间的两条分界：位于近端 1/3、2/3 处
		const div1 = laneXAtF(-1 / 3, 1);
		const div2 = laneXAtF(1 / 3, 1);

		ctx.lineCap = "round";
		edges.forEach(e => {
			ctx.beginPath();
			ctx.moveTo(APEX_X, APEX_Y);
			ctx.lineTo(e.baseX, BASE_Y);
			ctx.strokeStyle = e.color;
			ctx.lineWidth = e.w;
			ctx.stroke();
		});

		ctx.strokeStyle = "rgba(110, 185, 255, 0.32)";
		ctx.lineWidth = 2;
		[div1, div2].forEach(bx => {
			ctx.beginPath();
			ctx.moveTo(APEX_X, APEX_Y);
			ctx.lineTo(bx, BASE_Y);
			ctx.stroke();
		});
		ctx.restore();
	}

	//  ── 绘制：障碍 ───────────────────────────────────────────────
	/* 染色缓存：把幽灵立绘染成不同颜色，只做一次然后复用，
	   并且缩到 TINT_SIZE 以内，避免多份 2048×2048 的贴图吃内存 */
	const TINT_CACHE = new Map();
	const TINT_SIZE = 512;
	function tintedGhost(img, color) {
		if (!color || GHOST_TINT_ALPHA <= 0) return img;
		const key = (img.src || "ghost") + "|" + color;
		const cached = TINT_CACHE.get(key);
		if (cached) return cached;
		const scale = Math.min(1, TINT_SIZE / Math.max(img.width || 1, img.height || 1));
		const cv = document.createElement("canvas");
		cv.width = Math.max(1, Math.round((img.width || 1) * scale));
		cv.height = Math.max(1, Math.round((img.height || 1) * scale));
		const g = cv.getContext("2d");
		g.drawImage(img, 0, 0, cv.width, cv.height);
		// source-atop：只给“有像素”的地方上色，透明区域保持透明
		g.globalCompositeOperation = "source-atop";
		g.globalAlpha = GHOST_TINT_ALPHA;
		g.fillStyle = color;
		g.fillRect(0, 0, cv.width, cv.height);
		TINT_CACHE.set(key, cv);
		return cv;
	}
	/* 取当前帧要画的幽灵图：直冲=原色，横穿/变道=染色（也可换成专属立绘） */
	function ghostImgFor(o, ghostFrame) {
		const custom = o.kind === KIND_GHOST ? null : skin(o.kind, o.variant);
		const base = custom || (ghostFrame ? IMG.ghost1 : IMG.ghost2);
		if (!base) return null;
		return custom ? base : tintedGhost(base, o.tint);
	}

	function drawGhost(o, ghostFrame) {
		const gx = laneXAtF(o.laneF, o.t);
		const gy = laneYAt(o.t);
		const gh = obstacleHeight(o);
		const img = ghostImgFor(o, ghostFrame);
		const gw = ghostWidth(o, img, gh);
		// 轻微飘动
		const bob = Math.sin(state.animTime * 6 + o.phase) * gh * 0.05;
		// 横穿幽灵：驶入/驶出跑道时淡入淡出，避免凭空出现或消失
		const fade = o.kind === KIND_CROSS
			? clamp((CROSS_EXIT_F - Math.abs(o.laneF)) / 0.45, 0, 1)
			: 1;

		ctx.save();
		ctx.globalAlpha = fade;
		// 横穿幽灵脚下那条会动的光带：提示“这条路会被斜着切过去”
		if (o.kind === KIND_CROSS) {
			const wy = gy + gh * 0.40;
			const warn = ctx.createRadialGradient(gx, wy, 0, gx, wy, gw * 0.95);
			warn.addColorStop(0, hexA(o.color, 0.24));
			warn.addColorStop(1, hexA(o.color, 0));
			ctx.fillStyle = warn;
			ctx.beginPath();
			ctx.ellipse(gx, wy, gw * 0.95, gh * 0.26, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		groundShadow(gx, gy + gh * 0.45, gw * 0.34, gh * 0.10);
		if (img) {
			ctx.drawImage(img, gx - gw / 2, gy - gh / 2 + bob, gw, gh);
		} else {
			// 幽灵素材缺失时的兜底光球，避免整局看不到障碍
			drawFallbackOrb(gx, gy + bob, gw, gh, o.color || GHOST_COLOR);
		}
		ctx.restore();

		// 行为提示箭头：横穿=行驶方向，变道=它要换去的方向
		if (o.kind === KIND_CROSS) {
			drawDirectionHint(gx, gy - gh * 0.78, gh * 0.32, o.dir, o.color, 0.8 * fade);
		} else if (o.kind === KIND_WEAVE) {
			const d = Math.sign(LANE_F[o.targetLane] - o.laneF);
			if (d !== 0) {
				const alpha = 0.4 + 0.5 * Math.abs(Math.sin(state.animTime * 5));
				drawDirectionHint(gx + d * gw * 0.5, gy - gh * 0.72, gh * 0.28, d, o.color, alpha);
			}
		}
	}

	function drawFallbackOrb(x, y, w, h, color) {
		const g = ctx.createRadialGradient(x, y - h * 0.1, 0, x, y - h * 0.1, w * 0.6);
		g.addColorStop(0, hexA(color, 0.95));
		g.addColorStop(1, hexA(color, 0));
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, y - h * 0.1, w * 0.6, 0, Math.PI * 2);
		ctx.fill();
	}

	function drawDirectionHint(x, y, size, dir, color, alpha) {
		ctx.save();
		ctx.globalAlpha = alpha == null ? 0.85 : alpha;
		ctx.fillStyle = color;
		ctx.shadowColor = color;
		ctx.shadowBlur = size * 0.9;
		ctx.beginPath();
		const s = dir >= 0 ? 1 : -1;
		ctx.moveTo(x + s * size * 0.55, y);
		ctx.lineTo(x - s * size * 0.45, y - size * 0.5);
		ctx.lineTo(x - s * size * 0.45, y + size * 0.5);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	//  ── 绘制：无敌猫粮 ───────────────────────────────────────────
	function drawCatFood(p) {
		const x = laneXAtF(p.laneF, p.t);
		const yBase = laneYAt(p.t);
		const h = FOOD_FULL_H * perspScale(p.t);
		const img = skin("food", 0);
		const w = img && img.height ? h * (img.width / img.height) : h * 1.05;
		const bob = Math.sin(state.animTime * 3.4 + p.phase) * h * 0.12;
		const y = yBase - h * 0.28 + bob;

		ctx.save();
		// 地面光圈：远处也能一眼看到
		const halo = ctx.createRadialGradient(x, yBase + h * 0.05, 0, x, yBase + h * 0.05, w * 0.9);
		halo.addColorStop(0, hexA(FOOD_COLOR, 0.55));
		halo.addColorStop(0.55, hexA(FOOD_COLOR, 0.18));
		halo.addColorStop(1, hexA(FOOD_COLOR, 0));
		ctx.fillStyle = halo;
		ctx.beginPath();
		ctx.ellipse(x, yBase + h * 0.05, w * 0.9, h * 0.34, 0, 0, Math.PI * 2);
		ctx.fill();

		// 旋转光环
		const rot = state.animTime * 1.6 + p.phase;
		ctx.strokeStyle = hexA("#ffe6a8", 0.85);
		ctx.lineWidth = Math.max(1.5, h * 0.035);
		ctx.beginPath();
		ctx.ellipse(x, y, w * 0.72, h * 0.30, rot, 0, Math.PI * 2);
		ctx.stroke();

		if (img) {
			ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
		} else {
			/* 代码绘制的猫粮：一只碗 + 满出来的猫粮粒 + 露出的鱼尾
			   （远处也能一眼认出是“吃的”，和幽灵/跑道区分得开） */
			const bowlW = w * 0.86;
			const bowlH = h * 0.46;
			const bowlTop = y + h * 0.02;

			// 碗里的猫粮粒（先画，碗沿盖住下半部分）
			const kib = ["#c98a4b", "#e0a05a", "#a86a2f", "#d99a4e", "#b87a38"];
			for (let i = 0; i < 7; i++) {
				const kx = x + (i - 3) * bowlW * 0.115 + (i % 2 ? bowlW * 0.03 : -bowlW * 0.03);
				const ky = bowlTop - bowlH * (0.18 + (i % 3) * 0.12);
				ctx.fillStyle = kib[i % kib.length];
				ctx.beginPath();
				ctx.arc(kx, ky, Math.max(1.5, h * 0.055), 0, Math.PI * 2);
				ctx.fill();
			}
			// 露出来的鱼尾（提示这是猫吃的东西）
			ctx.fillStyle = "#8fd6ff";
			ctx.beginPath();
			ctx.moveTo(x + bowlW * 0.16, bowlTop - bowlH * 0.72);
			ctx.lineTo(x + bowlW * 0.40, bowlTop - bowlH * 0.96);
			ctx.lineTo(x + bowlW * 0.36, bowlTop - bowlH * 0.52);
			ctx.closePath();
			ctx.fill();

			// 碗身（上宽下窄的梯形）
			const bg = ctx.createLinearGradient(0, bowlTop, 0, bowlTop + bowlH);
			bg.addColorStop(0, "#e8f4ff");
			bg.addColorStop(0.35, "#9fc4e8");
			bg.addColorStop(1, "#4a6f9c");
			ctx.beginPath();
			ctx.moveTo(x - bowlW / 2, bowlTop);
			ctx.lineTo(x + bowlW / 2, bowlTop);
			ctx.lineTo(x + bowlW * 0.30, bowlTop + bowlH);
			ctx.lineTo(x - bowlW * 0.30, bowlTop + bowlH);
			ctx.closePath();
			ctx.fillStyle = bg;
			ctx.fill();
			// 碗沿
			ctx.strokeStyle = hexA(FOOD_COLOR, 0.95);
			ctx.lineWidth = Math.max(1.5, h * 0.05);
			ctx.beginPath();
			ctx.moveTo(x - bowlW / 2, bowlTop);
			ctx.lineTo(x + bowlW / 2, bowlTop);
			ctx.stroke();
			// 碗身的小爪印
			ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
			ctx.beginPath();
			ctx.arc(x, bowlTop + bowlH * 0.52, Math.max(1.5, h * 0.06), 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	//  ── 绘制：主角 ───────────────────────────────────────────────
	function drawCatSprite(x, y, w, h, alpha, flip) {
		const img = catImage();
		if (!img) return;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.translate(x, y);
		if (flip) ctx.scale(-1, 1);
		ctx.drawImage(img, -w / 2, -h / 2, w, h);
		ctx.restore();
	}

	function drawCat() {
		const cx = state.cat.x;
		const cy = catCenterY();
		const cw = catWidth();
		const ch = CAT_H;
		const inv = state.rage > 0;

		// 无敌残影
		if (state.trail.length) {
			state.trail.forEach((p, i) => {
				const a = (i + 1) / state.trail.length * 0.28;
				drawCatSprite(p.x, cy, cw, ch, a, catFlip());
			});
		}

		ctx.save();
		// 地面投影
		ctx.fillStyle = "rgba(0,0,24,0.38)";
		ctx.beginPath();
		ctx.ellipse(cx, cy + ch * 0.42, cw * 0.36, ch * 0.10, 0, 0, Math.PI * 2);
		ctx.fill();

		// 无敌光环
		if (inv) {
			const pulse = 0.75 + 0.25 * Math.sin(state.animTime * 9);
			const g = ctx.createRadialGradient(cx, cy, ch * 0.1, cx, cy, ch * 1.05);
			g.addColorStop(0, "rgba(255, 210, 120, " + (0.34 * pulse).toFixed(3) + ")");
			g.addColorStop(0.6, "rgba(255, 140, 40, " + (0.20 * pulse).toFixed(3) + ")");
			g.addColorStop(1, "rgba(255, 120, 20, 0)");
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(cx, cy, ch * 1.05, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();

		drawCatSprite(cx, cy, cw, ch, 1, catFlip());

		// 无敌时叠一层高亮，做出“通体发光”的感觉
		if (inv) {
			ctx.save();
			ctx.globalCompositeOperation = "lighter";
			ctx.globalAlpha = 0.18 + 0.10 * Math.sin(state.animTime * 10);
			drawCatSprite(cx, cy, cw * 1.04, ch * 1.04, 1, catFlip());
			ctx.restore();
		}
	}

	//  ── 绘制：特效与全屏表现 ─────────────────────────────────────
	function drawBursts() {
		for (const b of state.bursts) {
			const k = 1 - b.life / b.max;          // 0 → 1
			const r = lerp(6, 90, k) * b.power;
			ctx.save();
			ctx.globalAlpha = Math.max(0, 1 - k);
			ctx.strokeStyle = b.color;
			ctx.lineWidth = Math.max(2, 10 * (1 - k));
			ctx.shadowColor = b.color;
			ctx.shadowBlur = 22;
			ctx.beginPath();
			ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}
	}

	function drawPopups() {
		for (const p of state.popups) {
			ctx.save();
			const k = clamp(p.life / 0.9, 0, 1);
			ctx.globalAlpha = k;
			ctx.fillStyle = p.color;
			ctx.font = "700 22px 'Segoe UI', 'Microsoft YaHei', sans-serif";
			ctx.textAlign = "center";
			ctx.shadowColor = "rgba(0,0,0,0.75)";
			ctx.shadowBlur = 8;
			ctx.fillText(p.text, p.x, p.y - (1 - k) * 40);
			ctx.restore();
		}
	}

	/* 无敌加速的屏幕表现：橙色暗角 + 放射速度线 + 撞击/拾取闪光 */
	function drawRageFX() {
		if (state.rage > 0) {
			const k = clamp(state.rage / RAGE_TAIL, 0, 1);
			const g = ctx.createRadialGradient(
				W / 2, H * 0.58, Math.min(W, H) * 0.20,
				W / 2, H * 0.58, Math.max(W, H) * 0.72);
			g.addColorStop(0, "rgba(255,150,40,0)");
			g.addColorStop(1, "rgba(255,120,20," + (0.36 * k).toFixed(3) + ")");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, W, H);

			// 放射速度线（由消失点向四周扩散）
			ctx.save();
			ctx.globalAlpha = 0.34 * k;
			ctx.strokeStyle = "#ffd9a0";
			ctx.lineWidth = 2.5;
			const n = 16;
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2 + Math.sin(i * 3.1) * 0.15;
				const seed = (state.animTime * 1.6 + i * 0.37) % 1;
				const r0 = lerp(Math.min(W, H) * 0.18, Math.max(W, H) * 0.75, seed);
				const r1 = r0 + Math.max(W, H) * 0.10;
				ctx.beginPath();
				ctx.moveTo(APEX_X + Math.cos(a) * r0, APEX_Y + Math.sin(a) * r0 * 0.85);
				ctx.lineTo(APEX_X + Math.cos(a) * r1, APEX_Y + Math.sin(a) * r1 * 0.85);
				ctx.stroke();
			}
			ctx.restore();
		}
		if (state.flash > 0) {
			ctx.fillStyle = "rgba(255, 236, 190, " + (0.55 * state.flash).toFixed(3) + ")";
			ctx.fillRect(0, 0, W, H);
		}
	}

	//  ── 主绘制 ───────────────────────────────────────────────────
	function draw() {
		ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
		if (state.shake > 0) {
			const s = state.shake * state.shake * 12;
			ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
		}
		drawBackground();
		drawTrack();

		/* 按深度分两批绘制：比猫远的先画，比猫近的后画
		   （原来的写法是「所有障碍 → 猫」，于是越过猫的幽灵会被猫挡住） */
		const far = [];
		const near = [];
		for (const o of state.obstacles) {
			if (o.dead) continue;
			(o.t <= CAT_T ? far : near).push(o);
		}
		for (const p of state.pickups) {
			if (p.dead) continue;
			(p.t <= CAT_T ? far : near).push(p);
		}
		far.sort((a, b) => a.t - b.t);
		near.sort((a, b) => a.t - b.t);

		const ghostFrame = (Math.floor(state.animTime / 0.14) % 2) === 1;
		const drawOne = (item) => {
			// 三种障碍（直冲/横穿/变道）都用幽灵素材画，只有猫粮是道具
			if (item.kind === KIND_GHOST || item.kind === KIND_WEAVE || item.kind === KIND_CROSS) {
				drawGhost(item, ghostFrame);
			} else {
				drawCatFood(item);
			}
		};
		far.forEach(drawOne);
		drawCat();
		near.forEach(drawOne);

		drawBursts();
		drawPopups();
		drawRageFX();
	}

	//  ── 更新：障碍行为 ───────────────────────────────────────────
	function updateObstacle(o, rate, dt) {
		const boost = o.t > CAT_T ? OVERTAKE_BOOST : 1;
		o.t += rate * boost * dt;

		if (o.kind === KIND_CROSS) {
			// 横穿马路：横向位置由「深度」决定 → 斜着切过整条跑道，轨迹可预测
			const k = clamp((o.t - CROSS_SWEEP_T0) / (CROSS_SWEEP_T1 - CROSS_SWEEP_T0), 0, 1);
			o.laneF = lerp(o.sweepFrom, o.sweepTo, k);
			if (k >= 1) o.done = true;
		} else if (o.kind === KIND_WEAVE) {
			// 随机变道：定时挑一条新道，再平滑挪过去
			o.weaveTimer -= dt;
			if (o.weaveTimer <= 0) {
				pickWeaveTarget(o);
				o.weaveTimer = 0.55 + Math.random() * 0.65;
			}
			const target = LANE_F[o.targetLane];
			const d = target - o.laneF;
			const step = WEAVE_V * dt;
			o.laneF = Math.abs(d) <= step ? target : o.laneF + Math.sign(d) * step;
		}
	}

	/* 变道目标：避开已经有障碍的车道，且最多变 WEAVE_MAX_TIMES 次
	   （保证任何时候至少留一条能走的道） */
	function pickWeaveTarget(o) {
		if (o.weaveLeft <= 0) return;
		if (o.t > WEAVE_LOCK_T) return;   // 已经逼到面前就锁死车道，不能最后一秒变道坑人
		const cur = laneIndexOf(o);
		const options = [];
		for (let i = 0; i < LANES; i++) {
			if (i === cur) continue;
			if (laneBlockedAt(i, o)) continue;
			options.push(i);
		}
		if (!options.length) return;
		o.targetLane = pick(options);
		o.weaveLeft--;
	}

	/* 该车道在“同一个深度窗口”里是否已经有别的障碍（避免叠在一起堵死） */
	function laneBlockedAt(lane, self) {
		for (const o of state.obstacles) {
			if (o === self || o.dead) continue;
			if (Math.abs(o.t - self.t) > 0.22) continue;
			if (laneIndexOf(o) === lane) return true;
		}
		return false;
	}

	function updateEffects(dt) {
		state.shake = Math.max(0, state.shake - dt * 2.6);
		state.flash = Math.max(0, state.flash - dt * 3.2);
		state.bursts.forEach(b => { b.life -= dt; });
		state.bursts = state.bursts.filter(b => b.life > 0);
		state.popups.forEach(p => { p.life -= dt; });
		state.popups = state.popups.filter(p => p.life > 0);
		// 残影：无敌时不断记录猫的横向位置
		if (state.rage > 0) {
			state.trail.push({ x: state.cat.x });
			if (state.trail.length > 6) state.trail.shift();
		} else if (state.trail.length) {
			state.trail.splice(0, Math.max(1, state.trail.length - 2));
		}
	}

	//  ── 更新：主逻辑 ─────────────────────────────────────────────
	function update(dt) {
		state.animTime += dt;
		state.elapsed += dt;
		updateDifficulty();
		state.distance += state.speed * dt;
		updateCat(dt);
		updateEffects(dt);

		// 无敌倒计时
		if (state.rage > 0) {
			state.rage -= dt;
			if (state.rage <= 0) { state.rage = 0; endRage(); }
		} else if (state.grace > 0) {
			state.grace = Math.max(0, state.grace - dt);
		}
		/* 无敌期间又攒满 3 份：不浪费当前这段，等它结束后立刻接上 */
		if (state.food >= FOOD_MAX && state.rage <= 0) startRage();

		/* 障碍推进：统一基础速率（未超过猫时所有障碍同步 → 相对位置不变）；
		   一旦越过猫所在深度，该只障碍提速迅速离场。
		   无敌加速时整个世界同步加快，与距离增速保持一致 */
		const rate = worldRate();
		state.travel += rate * dt;          // 全局路程仅用于生成节奏
		for (const o of state.obstacles) updateObstacle(o, rate, dt);
		// 移除已经跑出画面的障碍
		state.obstacles = state.obstacles.filter(o => {
			if (o.dead) return false;
			if (o.kind === KIND_CROSS) {
				if (o.done) return false;                  // 已完成横穿（从跑道另一侧驶离）
				return o.t < 1.2;
			}
			return o.t < 1.16;
		});

		// 猫粮推进 + 拾取
		for (const p of state.pickups) p.t += rate * dt;
		checkPickups();
		state.pickups = state.pickups.filter(p => !p.dead && p.t < 1.22);

		// 按路程间距生成障碍：相邻两只间距恒为 SPACING，
		// 速率恒定 → 生成间隔也恒定（全程匀速），空间间距始终不变
		state.spawnTravel -= rate * dt;
		if (state.spawnTravel <= 0) {
			spawnObstacle();
			state.spawnTravel = SPACING;
		}
		// 猫粮按自己的节奏生成
		state.foodSpawnTravel -= rate * dt;
		if (state.foodSpawnTravel <= 0) {
			spawnFood();
			state.foodSpawnTravel = FOOD_GAP_MIN + Math.random() * (FOOD_GAP_MAX - FOOD_GAP_MIN);
		}

		// 更新距离显示
		distanceText.textContent = "距离 " + Math.floor(state.distance) + "m";
		updateFoodHud(false);

		// 胜利：走满目标距离
		if (state.distance >= WIN_DISTANCE) { win(); return; }

		// 碰撞检测：无敌时撞飞障碍，否则游戏结束
		const hit = hitObstacle();
		if (hit) {
			if (isInvincible()) smashObstacle(hit);
			else gameOver();
		}
	}

	//  ── HUD ──────────────────────────────────────────────────────
	let hudFoodShown = -1;
	let hudRageShown = -1;
	let hudFullShown = null;
	function updateFoodHud(force) {
		// full = 「集满待发」或「无敌进行中」，两种状态都让 HUD 发亮
		const full = state.food >= FOOD_MAX || state.rage > 0;
		if (foodHud && (force || state.food !== hudFoodShown || full !== hudFullShown)) {
			hudFoodShown = state.food;
			hudFullShown = full;
			if (foodCountEl) foodCountEl.textContent = state.food + "/" + FOOD_MAX;
			foodHud.classList.toggle("full", full);
			foodPips.forEach((el, i) => el.classList.toggle("on", i < state.food));
		}
		const q = state.rage > 0 ? Math.round((state.rage / RAGE_DURATION) * 100) / 100 : 0;
		if (force || q !== hudRageShown) {
			hudRageShown = q;
			if (rageFill) rageFill.style.transform = "scaleX(" + q + ")";
			if (rageTrack) rageTrack.classList.toggle("on", state.rage > 0);
		}
	}

	//  ── 游戏流程 ─────────────────────────────────────────────────
	function beginRun() {
		resetRun();
		hint.classList.remove("hidden");
		setTimeout(() => hint.classList.add("hidden"), 4100);
	}

	function resetRun() {
		state.live = true;
		state.paused = false;
		state.over = false;
		state.distance = 0;
		state.elapsed = 0;
		state.speed = WORLD_SPEED;
		state.animTime = 0;
		state.food = 0;
		state.rage = 0;
		state.grace = 0;
		state.shake = 0;
		state.flash = 0;
		state.bgMix = BG_MODE === "image" ? 1 : 0;
		state.cat.target = 1;
		state.cat.x = CAT_LANE_X[1];
		state.cat.moving = false;
		state.cat.dir = 0;
		state.obstacles = [];
		state.pickups = [];
		state.bursts = [];
		state.popups = [];
		state.trail = [];
		state.travel = 0;
		state.spawnTravel = SPAWN_LEAD;
		state.foodSpawnTravel = FOOD_FIRST_GAP;
		pauseBtn.classList.remove("paused");
		pauseOverlay.classList.remove("show");
		gameOverOverlay.classList.remove("show");
		winOverlay.classList.remove("show");
		state.won = false;
		clearTimeout(winTimer);
		distanceText.textContent = "距离 0m";
		hudFoodShown = -1;
		hudRageShown = -1;
		hudFullShown = null;
		updateFoodHud(true);
	}

	function gameOver() {
		state.over = true;
		state.live = false;
		state.rage = 0;          // 结算时收掉无敌状态，避免 HUD 一直亮着
		state.grace = 0;
		updateFoodHud(true);
		finalDistance.textContent = Math.floor(state.distance) + " m";
		gameOverOverlay.classList.add("show");
		reportResult(false);
	}

	// 胜利：显示成功标志，短暂停留后自动进入下一页
	let winTimer = null;
	/* 向成就系统上报本局结果：lv 关卡号，won 是否通关。
	   成就在上报当下立即解锁并弹框：失败＝重开页面出现的此刻（科目三：睡觉），
	   两关均一次通关＝第二次一命通关的当下（秋名山猫神）。 */
	function reportResult(won) {
		try {
			if (window.VN && window.VN.achieve && window.VN.achieve.reportMinigame) {
				window.VN.achieve.reportMinigame(LEVEL_ID, won);
			}
		} catch (e) { /* 成就系统不可用时静默忽略 */ }
	}

	function win() {
		state.over = true;
		state.won = true;
		state.live = false;
		state.rage = 0;
		state.grace = 0;
		updateFoodHud(true);
		winOverlay.classList.add("show");
		reportResult(true);
		clearTimeout(winTimer);
		winTimer = setTimeout(() => { location.href = NEXT_PAGE; }, 3000);   // 展示 3 秒后跳转
	}

	function togglePause() {
		if (!state.live || state.over) return;
		state.paused = !state.paused;
		if (state.paused) {
			pauseBtn.classList.add("paused");
			pauseOverlay.classList.add("show");
			pauseDistance.textContent = "距离 " + Math.floor(state.distance) + "m";
		} else {
			pauseBtn.classList.remove("paused");
			pauseOverlay.classList.remove("show");
		}
	}

	//  ── 主循环 ───────────────────────────────────────────────────
	let lastT = performance.now();
	let animId = null;
	function loop(now) {
		animId = requestAnimationFrame(loop);
		let dt = (now - lastT) / 1000;
		lastT = now;
		if (dt > 0.05) dt = 0.05;
		if (state.live && !state.paused && !state.over) update(dt);
		updateBackground(dt);
		draw();
	}

	//  ── 事件 ─────────────────────────────────────────────────────
	/* 绑定事件时统一做存在性判断：万一 HTML 里少写了某个按钮，
	   也只是少一个功能，而不是整个游戏初始化中断（黑屏） */
	function on(el, type, fn) {
		if (el && typeof el.addEventListener === "function") el.addEventListener(type, fn);
	}

	function bindEvents() {
		window.addEventListener("keydown", (e) => {
			const k = e.key;
			if (k === "ArrowLeft" || k === "a" || k === "A") { e.preventDefault(); if (!e.repeat) stepCat(-1); }
			else if (k === "ArrowRight" || k === "d" || k === "D") { e.preventDefault(); if (!e.repeat) stepCat(1); }
			else if (k === " " || k === "p" || k === "P" || k === "Escape") {
				e.preventDefault();
				if (state.over && !state.won) { restart(); } else if (!state.over) { togglePause(); }
			}
		});

		// 画布点击/滑动：左半屏左移，右半屏右移
		let touchX = null;
		on(canvas, "pointerdown", (e) => { touchX = e.clientX; });
		on(canvas, "pointerup", (e) => {
			if (touchX == null) return;
			if (state.over) { if (!state.won) restart(); return; }
			if (state.paused) { togglePause(); return; }
			const delta = (e.clientX - touchX) / W;
			if (delta < -0.05 || (Math.abs(delta) <= 0.05 && e.clientX < W / 2)) stepCat(-1);
			else if (delta > 0.05 || e.clientX > W / 2) stepCat(1);
			touchX = null;
		});

		on(pauseBtn, "click", togglePause);
		on(resumeBtn, "click", togglePause);   // 回到游戏
		on(pauseRestartBtn, "click", restart);  // 重新开始
		on(restartBtn, "click", restart);
		// “回到主页”是 <a href="hall.html">，无需脚本

		window.addEventListener("resize", () => {
			DPR = window.devicePixelRatio || 1;
			layout();
			// 重新对齐到新布局下、猫所在深度的车道中心
			state.cat.x = state.cat.moving ? state.cat.x : CAT_LANE_X[state.cat.target];
		});
	}

	function restart() {
		resetRun();
	}

	//  ── 小工具：颜色处理 ─────────────────────────────────────────
	function hexToRgb(hex) {
		const h = hex.replace("#", "");
		const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
		return {
			r: parseInt(v.slice(0, 2), 16),
			g: parseInt(v.slice(2, 4), 16),
			b: parseInt(v.slice(4, 6), 16)
		};
	}
	function hexA(hex, a) { const c = hexToRgb(hex); return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")"; }

	//  ── 启动 ─────────────────────────────────────────────────────
	function init() {
		/* 「你的记忆真好用」：首次跳入他人梦境/回忆（第一章场景VI → 小游戏I）
		   的瞬间解锁——此刻正是本游戏界面。unlock 自带去重，
		   第二章（lv=2）再次进入不会重复弹窗。 */
		try {
			if (window.VN && window.VN.achieve && window.VN.achieve.unlock) {
				window.VN.achieve.unlock("memory");
			}
		} catch (e) { /* 成就系统不可用时静默忽略 */ }
		layout();
		bindEvents();
		const winTarget = document.getElementById("winTarget");
		if (winTarget) winTarget.textContent = WIN_DISTANCE + "m";
		/* 胜利面板「立即进入」指向原对话的后一句（失败只能重新开始，不提供跳过） */
		if (nextPageBtn) nextPageBtn.setAttribute("href", NEXT_PAGE);
		window.__game = state;   // 供调试/自动化断言
		/* 调试/联调小工具：控制台里可直接 __endless.giveCatFood(3) 触发无敌 */
		window.__endless = {
			state: state,
			startRage: startRage,
			giveCatFood: function (n) {
				state.food = clamp(state.food + (n == null ? 1 : n), 0, FOOD_MAX);
				if (state.food >= FOOD_MAX && state.rage <= 0) startRage();
				updateFoodHud(true);
			},
			spawnCross: function () { state.obstacles.push(makeCross()); },
			spawnWeave: function (lane) { state.obstacles.push(makeWeave(lane == null ? 1 : lane)); },
			spawnFood: function (lane) {
				const l = lane == null ? 1 : lane;
				state.pickups.push({ lane: l, laneF: LANE_F[l], t: 0, phase: 0, dead: false });
			},
			rageFactor: rageFactor,
			laneIndexOfF: laneIndexOfF,
			/* 对外暴露的调参表（也方便自动化测试预测障碍轨迹） */
			tuning: {
				WIN_DISTANCE: WIN_DISTANCE,
				GHOST_RATE: GHOST_RATE,
				WORLD_SPEED: WORLD_SPEED,
				FOOD_MAX: FOOD_MAX,
				RAGE_DURATION: RAGE_DURATION,
				RAGE_SPEED_MULT: RAGE_SPEED_MULT,
				RAGE_SMASH_BONUS: RAGE_SMASH_BONUS,
				SPACING: SPACING,
				CROSS_UNLOCK: CROSS_UNLOCK,
				WEAVE_UNLOCK: WEAVE_UNLOCK,
				CROSS_SWEEP_T0: CROSS_SWEEP_T0,
				CROSS_SWEEP_T1: CROSS_SWEEP_T1,
				WEAVE_LOCK_T: WEAVE_LOCK_T,
				HIT_LANE_RATIO: HIT_LANE_RATIO
			},
			ghostRate: ghostRate,
			/* 素材路径（方便自动化测试确认“图片该放哪、叫什么名字”） */
			assets: {
				food: OPTIONAL_ASSETS.food[0],
				catRage: OPTIONAL_ASSETS.catRage[0],
				cross: OPTIONAL_ASSETS.cross[0],
				weave: OPTIONAL_ASSETS.weave[0],
				background: CORE_ASSETS.runbg
			},
			geom: function () {
				return {
					W, H, APEX_X, APEX_Y, BASE_Y, BASE_HALF_W, CAT_H, GHOST_FULL_H, CAT_T,
					CAT_CENTER_Y, LANE_X, CAT_LANE_X, LANE_F
				};
			}
		};
		window.__geom = window.__endless.geom;
		Object.keys(CORE_ASSETS).forEach(loadCore);
		Object.keys(OPTIONAL_ASSETS).forEach(slot => loadOptional(slot, OPTIONAL_ASSETS[slot]));
		updateFoodHud(true);
		animId = requestAnimationFrame(loop);
	}

	init();
})();
