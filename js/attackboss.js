
(function () {
	'use strict';

	/* 
	   1. 配置
	    */
	const CFG = {
		HP_MAX: 100,          // 双方满血
		ATK_QTES: 3,          // 己方回合：进攻 QTE 次数
		DEF_QTES: 2,          // 对手回合：防御 QTE 次数
		QTE_LIFE: 2000,       // 进攻 QTE 存在时长(ms)
		DEF_LIFE: 2000,       // 防御 QTE 存在时长(ms)，2s 后消失
		W_PERFECT: 500,       // <=0.5s
		W_GREAT: 1000,        // <=1.0s
		W_GOOD: 2000,         // <=2.0s
		DMG_PER_QTE: 8,       // 单次进攻 QTE 满额伤害（100% / 80% / 50%）
		FOE_DMG: 10,          // 对手单次攻击基础伤害（按防御率减免）

		// 己方（沙耶香）进攻按键：鼠标左键 + J / K / I / L
		ATK_KEYS: ['LMB', 'J', 'K', 'I', 'L'],

		// 峰岸诚的进攻分两种，对应两种防御方式：
		//   'parry' 斩击 —— 屏幕两侧泛红光，浮现 W/A/S/D，由沙耶香挥剑招架
		//   'cat'   突袭 —— 屏幕两侧泛黄光，浮现 Space，按 Space 切刀换小黑格挡
		PARRY_KEYS: ['W', 'A', 'S', 'D'],
		CAT_KEY: 'SPACE',
		CAT_GUARD_MS: 1200,   // 小黑登场防御的动画时长（要和 attackboss.css 的 catGuard 一致）

		// 小黑「防御立绘」身体中心在容器高度中的位置：爪痕、残影、金盾都锚在这个点上。
		// s-defense.png 显示高 19.1vh、底边贴地（见 .unit-cat .s-defense）→ 猫身占容器 y 76.9vh~96vh，
		// 中心 = (76.9+96)/2 / 96 = 90%。改了防御立绘尺寸，这个数要跟着改。
		CAT_BODY_Y: 0.90
	};

	// QTE 圆圈上按键的显示方式（label 主字 / small 缩小 / sub 圆内小字）
	const KEY_META = {
		SPACE: { label: 'SPACE', small: true, sub: '切刀·小黑' },
		LMB:   { label: 'LMB',   small: true, sub: '左键' },
		W: { label: 'W' }, A: { label: 'A' }, S: { label: 'S' }, D: { label: 'D' },
		J: { label: 'J' }, K: { label: 'K' }, I: { label: 'I' }, L: { label: 'L' }
	};
	const metaOf = (key) => KEY_META[key] || { label: key };

	// 判定等级：名称 / 颜色 / 攻击力度 / 防御率
	//   atk：对敌方造成的伤害倍率（100% / 80% / 50% / 0%）
	//   def：己方减免的伤害比例（100% / 70% / 40% / 0%）
	const GRADE = {
		perfect: { name: 'PERFECT', color: '#ffd85e', atk: 1.00, def: 1.00 },
		great:   { name: 'GREAT',   color: '#5ee08a', atk: 0.80, def: 0.70 },
		good:    { name: 'GOOD',    color: '#ff9b45', atk: 0.50, def: 0.40 },
		miss:    { name: 'MISS',    color: '#9aa6bd', atk: 0.00, def: 0.00 }
	};

	/* 
	   2. 元素引用
	    */
	const $ = (id) => document.getElementById(id);

	const stage      = $('stage');
	const arena      = $('arena');
	const fxLayer    = $('fxLayer');
	const qteLayer   = $('qteLayer');
	const judgeText  = $('judgeText');
	const comboBox   = $('comboBox');
	const comboNum   = $('comboNum');
	const turnBanner = $('turnBanner');
	const turnText   = $('turnText');
	const roundNumEl = $('roundNum');
	const roundSubEl = $('roundSub');

	const unitCat    = $('unitCat');
	const unitProtag = $('unitProtag');
	const unitRival  = $('unitRival');
	const shieldP    = $('shieldProtag');
	const shieldCat  = $('shieldCat');

	// 屏幕两侧的红光 / 黄光预警
	const edgeL      = $('edgeGlowL');
	const edgeR      = $('edgeGlowR');

	const hpFillP = $('hpFillPlayer');
	const hpLagP  = $('hpLagPlayer');
	const hpNumP  = $('hpNumPlayer');
	const hpBarP  = $('hpbarPlayer');
	const hpFillR = $('hpFillRival');
	const hpLagR  = $('hpLagRival');
	const hpNumR  = $('hpNumRival');
	const hpBarR  = $('hpbarRival');

	const startOverlay  = $('startOverlay');
	const resultOverlay = $('resultOverlay');
	const startBtn      = $('startBtn');
	const restartBtn    = $('restartBtn');
	const homeBtn       = $('homeBtn');

	/*  胜利后回到原对话的「后一句」 ----------------------------------------
	   剧情页（index.html）在跳进小游戏前会把「本句的下一句」写入 localStorage
	   的 vn_minigame_return（见 main.js 的 beginExit）。这里带上 ?save=键名
	   跳回 index.html，存档系统的 bootstrapResume 会把它解析成续玩指令，
	   从原对话的后一句继续播放（默认即"几番交战后，我瞅准时机……"）。
	   找不到返回点时退回到 hall.html。 */
	/* 返回点候选键：先裸键（剧情页 beginExit 写的），再自动存档 ——
	   登录状态下自动存档带 u:<用户>: 前缀，所以顺带把带前缀的那个也列进来
	   （与 settingPage.js 的「哪个存在用哪个」一致）。 */
	const RETURN_KEYS = (function () {
		const ks = ['vn_minigame_return', 'vn_save_auto'];
		try {
			if (window.VN && VN.userStore && VN.userStore.key) {
				const named = VN.userStore.key('vn_save_auto');
				if (named && ks.indexOf(named) < 0) ks.push(named);
			}
		} catch (e) { /* 未登录 / 无 userStore：保持裸键 */ }
		return ks;
	})();
	const FALLBACK_PAGE = '../hall.html';   // attackboss 在 html/ 下，hall 在 html/ 下
	function resolveNextPage() {
		for (let i = 0; i < RETURN_KEYS.length; i++) {
			let raw = null;
			try { raw = window.localStorage.getItem(RETURN_KEYS[i]); } catch (e) { /* 隐私模式等 */ }
			if (!raw) continue;
			try {
				const s = JSON.parse(raw);
				if (s && typeof s.index === 'number' && s.index >= 0) {
					return 'plot.html?save=' + encodeURIComponent(RETURN_KEYS[i]);
				}
			} catch (e) { /* 存档损坏，尝试下一个 */ }
		}
		return FALLBACK_PAGE;
	}

	/*  打输时：把「小游戏返回点」和自动存档都退回**入口句本身** ------------------
	   剧情页是在「点进小游戏」那一刻写下的返回点（＝入口句的下一句），
	   所以正常情况下「继续游戏」会落在战斗之后；如果玩家打输了、回到大厅再点
	   「继续游戏」，就会被当成打赢一样直接跳过这场战斗。
	   这里在失败结算时把两份存档各退一句（index-1 = 入口句），
	   于是「继续游戏」会回到那句台词，再点一下即可重打这场战斗。 */
	function rollBackToEntry() {
		let touched = [];
		RETURN_KEYS.forEach((k) => {
			let raw = null;
			try { raw = window.localStorage.getItem(k); } catch (e) { return; }
			if (!raw) return;
			try {
				const s = JSON.parse(raw);
				if (!s || typeof s.index !== 'number' || s.index <= 0) return;
				s.index = s.index - 1;
				window.localStorage.setItem(k, JSON.stringify(s));
				touched.push(k + ' → 第 ' + s.index + ' 句');
			} catch (e2) { /* 存档损坏：跳过 */ }
		});
		if (window.console && console.info) {
			console.info('[attackboss] 战斗失败：存档已退回入口句（' + (touched.join('、') || '无可回退项') + '）');
		}
		return touched;
	}

	/* 
	   3. 工具函数
	    */
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const rand  = (a, b) => a + Math.random() * (b - a);
	const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];

	/* 
	   4. 音效（WebAudio 合成，无需外部文件）
	    */
	const SFX = {
		ctx: null,
		enabled: true,
		init() {
			if (this.ctx) return;
			try {
				const AC = window.AudioContext || window.webkitAudioContext;
				this.ctx = new AC();
			} catch (e) { this.enabled = false; }
		},
		tone(freq, dur, type, vol, delay) {
			if (!this.enabled || !this.ctx) return;
			const t0 = this.ctx.currentTime + (delay || 0);
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = type || 'square';
			osc.frequency.setValueAtTime(freq, t0);
			gain.gain.setValueAtTime(0.0001, t0);
			gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
			osc.connect(gain).connect(this.ctx.destination);
			osc.start(t0);
			osc.stop(t0 + dur + 0.02);
		},
		sweep(f1, f2, dur, type, vol) {
			if (!this.enabled || !this.ctx) return;
			const t0 = this.ctx.currentTime;
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = type || 'sawtooth';
			osc.frequency.setValueAtTime(f1, t0);
			osc.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
			gain.gain.setValueAtTime(vol || 0.1, t0);
			gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
			osc.connect(gain).connect(this.ctx.destination);
			osc.start(t0);
			osc.stop(t0 + dur + 0.02);
		},
		// 带通滤波的噪声：金属摩擦、刀锋这类音色的底子
		noise(dur, vol, f1, f2, q) {
			if (!this.enabled || !this.ctx) return;
			const ctx = this.ctx;
			const t0 = ctx.currentTime;
			const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
			const buf = ctx.createBuffer(1, len, ctx.sampleRate);
			const data = buf.getChannelData(0);
			for (let i = 0; i < len; i++) {
				data[i] = (Math.random() * 2 - 1) * (1 - i / len);   // 自带衰减包络
			}
			const src = ctx.createBufferSource();
			src.buffer = buf;
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.Q.value = q || 1.4;
			bp.frequency.setValueAtTime(f1, t0);
			bp.frequency.exponentialRampToValueAtTime(Math.max(80, f2), t0 + dur);
			const gain = ctx.createGain();
			gain.gain.setValueAtTime(vol || 0.12, t0);
			gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
			src.connect(bp).connect(gain).connect(ctx.destination);
			src.start(t0);
			src.stop(t0 + dur + 0.02);
		},
		qte()   { this.tone(880, 0.09, 'sine', 0.07); },
		perfect() { this.tone(1320, 0.1, 'square', 0.1); this.tone(1760, 0.12, 'square', 0.08, 0.06); },
		great() { this.tone(1050, 0.1, 'square', 0.09); },
		good()  { this.tone(760, 0.1, 'square', 0.08); },
		miss()  { this.sweep(320, 110, 0.24, 'sawtooth', 0.07); },
		hit()   { this.sweep(220, 60, 0.2, 'square', 0.13); this.tone(140, 0.14, 'triangle', 0.12); },
		block() { this.tone(660, 0.08, 'sine', 0.09); this.tone(990, 0.1, 'sine', 0.07, 0.05); },
		// 切刀：按 Space 换小黑上场时的金属出鞘声
		blade() {
			this.noise(0.14, 0.2, 1700, 6400, 1.5);
			this.tone(2350, 0.07, 'triangle', 0.085);
			this.sweep(3600, 900, 0.28, 'sawtooth', 0.07);
		},
		// 猫爪格挡：爪刃挡下刀锋的摩擦声
		guard() {
			this.noise(0.12, 0.17, 3200, 1300, 2.4);
			this.tone(1180, 0.09, 'triangle', 0.08);
			this.tone(1560, 0.11, 'sine', 0.06, 0.06);
		},
		hurt()  { this.sweep(420, 90, 0.28, 'sawtooth', 0.1); },
		turn()  { this.tone(520, 0.12, 'square', 0.08); this.tone(780, 0.16, 'square', 0.08, 0.1); },
		win()   { [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.22, 'square', 0.1, i * 0.13)); },
		lose()  { [440, 350, 260, 180].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.09, i * 0.16)); }
	};

	/* 
	   5. 战斗状态
	    */
	const S = {
		running: false,
		phase: 'idle',        // idle | turn | playerAtk | foeAtk | over
		round: 1,
		hpP: CFG.HP_MAX,
		hpR: CFG.HP_MAX,
		combo: 0,
		maxCombo: 0,          // 全场最大连击（跨回合累计）
		statPerfect: 0,
		statBlock: 0,
		statCat: 0,           // 小黑上场接替防御的次数
		current: null         // 当前活跃的 QTE
	};

	/* 
	   6. UI：血条 / 回合 / 状态 / 特效
	    */
	function setHP(who, val) {
		val = Math.max(0, Math.min(CFG.HP_MAX, Math.round(val)));
		const pct = (val / CFG.HP_MAX) * 100 + '%';
		if (who === 'P') {
			S.hpP = val;
			hpFillP.style.width = pct;
			hpLagP.style.width = pct;
			hpNumP.textContent = val;
			hpBarP.classList.toggle('danger', val <= 30);
		} else {
			S.hpR = val;
			hpFillR.style.width = pct;
			hpLagR.style.width = pct;
			hpNumR.textContent = val;
			hpBarR.classList.toggle('danger', val <= 30);
		}
	}

	function bumpHPBar(who) {
		const el = who === 'P' ? hpBarP : hpBarR;
		el.classList.remove('shake');
		void el.offsetWidth;
		el.classList.add('shake');
	}

	function setRound(n, sub) {
		S.round = n;
		roundNumEl.textContent = n;
		if (sub !== undefined) roundSubEl.textContent = sub;
		roundNumEl.classList.remove('bump');
		void roundNumEl.offsetWidth;
		roundNumEl.classList.add('bump');
	}

	// 切换角色形态图：idle / attack / defense / fail
	function setForm(unit, form) {
		const list = unit.querySelectorAll('.sprite');
		for (let i = 0; i < list.length; i++) {
			list[i].classList.toggle('on', list[i].classList.contains('s-' + form));
		}
		if (form !== 'idle') {                   // 切换瞬间提亮，强化打击感
			unit.classList.remove('form-pop');
			void unit.offsetWidth;
			unit.classList.add('form-pop');
		}
	}

	// 切换角色状态：idle / attack / defense / hurt / down
	function setState(unit, state, holdMs) {
		const cls = 'state-' + state;
		unit.classList.remove('state-idle', 'state-attack', 'state-defense', 'state-hurt');
		if (state === 'down') {
			unit.classList.add('state-down');
			return;
		}
		void unit.offsetWidth;
		unit.classList.add(cls);
		if (state !== 'idle') {
			const dur = state === 'defense' ? 900 : (state === 'hurt' ? 420 : 460);
			setTimeout(() => {
				if (unit.classList.contains(cls)) {
					unit.classList.remove(cls);
					if (!unit.classList.contains('state-down')) unit.classList.add('state-idle');
				}
			}, holdMs || dur);
		}
	}

	function resetStates() {
		[unitCat, unitProtag, unitRival].forEach((u) => {
			u.classList.remove('state-attack', 'state-defense', 'state-hurt',
			                  'state-down', 'state-idle', 'state-aggro', 'state-fail', 'ready');
			u.style.opacity = '';
			setForm(u, 'idle');          // 形态图恢复默认
		});
		unitCat.classList.add('state-idle');
		unitProtag.classList.add('state-idle');
		unitRival.classList.add('state-idle');
	}

	/* ---- 特效 ---- */
	function unitCenter(unit, ratioY) {
		// data-cx：立绘内容在容器中的横向中心比例（因各图留白不同）
		const cx = parseFloat(unit.dataset.cx);
		return {
			x: unit.offsetLeft + unit.offsetWidth * (isNaN(cx) ? 0.5 : cx),
			y: unit.offsetTop + unit.offsetHeight * (ratioY === undefined ? 0.35 : ratioY)
		};
	}

	function spawnFx(cls, x, y, life) {
		const el = document.createElement('div');
		el.className = cls;
		el.style.left = x + 'px';
		el.style.top = y + 'px';
		fxLayer.appendChild(el);
		setTimeout(() => el.remove(), life || 700);
		return el;
	}

	function spawnDmgNum(x, y, text, isHeal) {
		const el = document.createElement('div');
		el.className = 'dmgnum' + (isHeal ? ' heal' : '');
		el.textContent = text;
		el.style.left = x + 'px';
		el.style.top = y + 'px';
		fxLayer.appendChild(el);
		setTimeout(() => el.remove(), 950);
	}

	// 主角发射的攻击弹道
	function spawnProjectile(fromX, fromY, toX, toY) {
		const el = document.createElement('div');
		el.className = 'projectile';
		el.style.left = fromX + 'px';
		el.style.top = fromY + 'px';
		el.style.setProperty('--dx', (toX - fromX) + 'px');
		el.style.setProperty('--dy', (toY - fromY) + 'px');
		fxLayer.appendChild(el);
		setTimeout(() => el.remove(), 380);
	}

	// 与 unitCenter 同理，但把当前的位移 / 缩放动画一起算进去
	//（小黑冲刺时立绘已经离开原位，要拿它「眼前」的位置放特效）
	function unitCenterLive(unit, ratioY) {
		const r = unit.getBoundingClientRect();
		const a = arena.getBoundingClientRect();
		const cx = parseFloat(unit.dataset.cx);
		return {
			x: (r.left - a.left) + r.width  * (isNaN(cx) ? 0.5 : cx),
			y: (r.top  - a.top)  + r.height * (ratioY === undefined ? 0.35 : ratioY)
		};
	}

	/* ---- 小黑（黑猫）的防御 ---- */
	// 对手进攻预警：屏幕两侧亮起红光（WASD 招架）或黄光（Space 切刀换小黑）
	function showEdgeGlow(kind) {
		const cls = kind === 'cat' ? 'yellow' : 'red';
		[edgeL, edgeR].forEach((el) => {
			el.classList.remove('red', 'yellow', 'on');
			void el.offsetWidth;
			el.classList.add(cls, 'on');
		});
	}
	function hideEdgeGlow() {
		[edgeL, edgeR].forEach((el) => el.classList.remove('on'));
	}

	// 黄光时给小黑加一层金光，提示它已待命
	function setCatReady(on) {
		unitCat.classList.toggle('ready', !!on);
	}

	// 小黑的格挡姿态（CSS 里 .unit-cat.state-defense = catGuard 动画）
	let catGuardTimer = 0;
	function catGuardOn() {
		clearTimeout(catGuardTimer);
		unitCat.classList.remove('state-idle', 'state-hurt', 'state-defense');
		void unitCat.offsetWidth;
		unitCat.classList.add('state-defense');
		catGuardTimer = setTimeout(catGuardOff, CFG.CAT_GUARD_MS);
	}
	function catGuardOff() {
		clearTimeout(catGuardTimer);
		unitCat.classList.remove('state-defense');
		setForm(unitCat, 'idle');                    // 立绘切回待机图
		if (!unitCat.classList.contains('state-down')) unitCat.classList.add('state-idle');
	}

	// 猫爪格挡特效（三道金色爪痕）
	function spawnClaw(x, y) {
		const el = document.createElement('div');
		el.className = 'clawfx';
		el.innerHTML = '<i></i><i></i><i></i>';
		el.style.left = x + 'px';
		el.style.top = y + 'px';
		fxLayer.appendChild(el);
		setTimeout(() => el.remove(), 700);
	}

	// 整屏染色闪（红＝对手斩击 / 金＝小黑突袭）
	function tintFlash(kind) {
		const el = document.createElement('div');
		el.className = 'tint ' + (kind === 'cat' ? 'gold' : 'red');
		stage.appendChild(el);
		void el.offsetWidth;
		el.classList.add('on');
		setTimeout(() => el.remove(), 380);
	}

	/**
	 * 小黑上场防御的完整演出：
	 * 切刀音效 → 沙耶香后撤让位 → 小黑从左侧跃到身前张开爪子 → 开启金色护盾
	 * @returns {Promise<{x:number,y:number}>} 格挡特效应该出现的位置
	 */
	async function catIntercept() {
		SFX.blade();                                 // 切刀音效
		unitProtag.classList.remove('state-aggro');
		setForm(unitProtag, 'defense');              // 沙耶香后撤半步，把正面让给小黑
		setForm(unitCat, 'defense');                 // 小黑切到防御立绘 s-defense.png
		catGuardOn();                                // 小黑冲刺入场（CSS 的 catGuard 位移）
		await sleep(230);
		const mid = unitCenterLive(unitCat, CFG.CAT_BODY_Y);
		spawnFx('catflash', mid.x, mid.y);           // 冲刺残影
		await sleep(340);                            // 等它冲到沙耶香身前
		const c = unitCenterLive(unitCat, CFG.CAT_BODY_Y);   // 猫身中心（96vh 容器里的 86.7%）
		spawnClaw(c.x, c.y);                         // 张爪格挡
		shieldCat.classList.remove('on');
		void shieldCat.offsetWidth;
		shieldCat.classList.add('on');
		SFX.guard();
		return c;
	}

	function shake(size) {
		stage.classList.remove('shake-s', 'shake-l');
		void stage.offsetWidth;
		stage.classList.add(size === 'l' ? 'shake-l' : 'shake-s');
		setTimeout(() => stage.classList.remove('shake-s', 'shake-l'), 380);
	}

	function flash() {
		const el = document.createElement('div');
		el.className = 'flash';
		stage.appendChild(el);
		void el.offsetWidth;
		el.classList.add('on');
		setTimeout(() => el.remove(), 340);
	}

	function showJudge(grade) {
		const g = GRADE[grade];
		judgeText.textContent = g.name;
		judgeText.style.color = g.color;
		judgeText.style.textShadow = '0 0 18px ' + g.color + ', 0 3px 6px rgba(0,0,0,.9)';
		judgeText.classList.remove('show');
		void judgeText.offsetWidth;
		judgeText.classList.add('show');
	}

	function updateCombo(n) {
		S.combo = n;
		if (n > S.maxCombo) S.maxCombo = n;      // 记录最大连击
		comboNum.textContent = n;
		comboBox.classList.toggle('show', n >= 2);   // 跨回合保留，归零才隐藏
		if (n >= 2) {
			comboBox.classList.remove('bump');
			void comboBox.offsetWidth;
			comboBox.classList.add('bump');
		}
	}

	/* 
	   7. QTE 核心
	    */
	// 颜色随时间衰减：金 → 绿 → 橙 → (将消失)红
	function colorAt(elapsed) {
		if (elapsed <= CFG.W_PERFECT) return '#ffd85e';
		if (elapsed <= CFG.W_GREAT)   return '#5ee08a';
		if (elapsed <= CFG.W_GOOD)    return '#ff9b45';
		return '#ff4d5e';
	}
	function gradeAt(elapsed) {
		if (elapsed <= CFG.W_PERFECT) return 'perfect';
		if (elapsed <= CFG.W_GREAT)   return 'great';
		if (elapsed <= CFG.W_GOOD)    return 'good';
		return 'miss';
	}

	let lastPos = { x: 50, y: 45 };

	/**
	 * 生成一个 QTE 并等待玩家响应
	 * @param {string} key  期望按键：W/A/S/D 或 SPACE/LMB
	 * @param {number} life 存在时长
	 * @returns {Promise<{grade:string, elapsed:number}>}
	 */
	function runQTE(key, life) {
		return new Promise((resolve) => {
			// 随机位置（避开顶部 HUD 与底部地面，且与上一个保持距离）
			let px, py, tries = 0;
			do {
				px = rand(24, 76);
				py = rand(27, 68);
				tries++;
			} while (tries < 12 && Math.abs(px - lastPos.x) < 14 && Math.abs(py - lastPos.y) < 12);
			lastPos = { x: px, y: py };

			const el = document.createElement('div');
			el.className = 'qte';
			el.style.left = px + 'vw';
			el.style.top = py + 'vh';

			const meta = metaOf(key);
			const sub = meta.sub ? '<span class="key-sub">' + meta.sub + '</span>' : '';

			el.innerHTML =
				'<div class="ring"></div>' +
				'<div class="disc"><span class="key' + (meta.small ? ' small' : '') + '">' + meta.label + '</span>' + sub + '</div>' +
				'<div class="core"></div>';

			const ring = el.querySelector('.ring');
			const core = el.querySelector('.core');
			core.style.left = '50%';
			core.style.top = '50%';
			core.style.transform = 'translate(-50%, -50%)';

			qteLayer.appendChild(el);
			SFX.qte();

			const t0 = performance.now();
			let done = false;
			let raf = 0;

			function tick() {
				if (done) return;
				const el2 = performance.now() - t0;
				const p = Math.max(0, 1 - el2 / life);
				const c = colorAt(el2);
				el.style.setProperty('--p', p);
				el.style.setProperty('--qc', c);
				// 内圈随剩余时间收缩
				const s = 8 + p * 46;
				core.style.width = s + '%';
				core.style.height = s + '%';
				// 即将消失时抖动警示
				if (p < 0.16) {
					el.style.transform = 'translate(-50%, -50%) scale(' + (1 + Math.sin(el2 / 26) * 0.05) + ')';
				}
				raf = requestAnimationFrame(tick);
			}
			tick();

			function finish(grade) {
				if (done) return;
				done = true;
				cancelAnimationFrame(raf);
				clearTimeout(timer);
				const elapsed = performance.now() - t0;
				// grade 为空时按真实耗时判定（超时自动 MISS）
				const g = grade || gradeAt(elapsed);
				el.classList.add(g === 'miss' ? 'miss' : 'hit');
				el.style.setProperty('--qc', GRADE[g].color);
				setTimeout(() => el.remove(), g === 'miss' ? 420 : 360);
				S.current = null;
				resolve({ grade: g, elapsed: elapsed });
			}

			const timer = setTimeout(() => finish(), life);

			S.current = {
				key: key,
				hit: () => finish(),          // 立即按当前耗时结算
				skip: () => finish('miss')    // 按错键：直接跳过本次技能
			};
		});
	}

	/* 
	   8. 输入
	    */
	function press(k) {
		if (!S.running || !S.current) return;
		if (S.current.key !== k) { S.current.skip(); return; }  // 按错：直接跳过本次技能
		S.current.hit();                                        // 结算时按真实耗时判定等级
	}

	document.addEventListener('keydown', (e) => {
		if (e.repeat) return;              // 长按不重复触发，避免连续跳过
		const code = e.code;
		const key = (e.key || '').toUpperCase();

		// 开场：Space 开始
		if (!S.running && (code === 'Space' || key === ' ')) {
			if (startOverlay.classList.contains('show')) {
				e.preventDefault();
				startGame();
				return;
			}
		}
		if (code === 'Space' || key === ' ') e.preventDefault();

		if (!S.running || !S.current) return;

		// Space：对手黄光突袭时按它＝切刀换小黑防御
		if (code === 'Space' || key === ' ') { press('SPACE'); return; }
		// 鼠标左键 与 键盘 ← 同等效果（己方进攻用左键）
		if (code === 'ArrowLeft' || key === 'ARROWLEFT') { e.preventDefault(); press('LMB'); return; }
		// 己方进攻键 J/K/I/L 与 招架键 W/A/S/D 都按实际按下的键比对
		if (key.length === 1 && 'WASDJKIL'.indexOf(key) >= 0) press(key);
	});

	stage.addEventListener('mousedown', (e) => {
		if (e.button !== 0) return;
		if (e.target.closest('.btn') || e.target.closest('.overlay')) return;
		SFX.init();
		if (!S.running || !S.current) return;
		press('LMB');
	});

	/* 
	   9. 回合流程
	    */
	async function showTurn(isPlayer) {
		S.phase = 'turn';
		turnText.textContent = isPlayer ? '轮到己方攻击' : '轮到对手攻击';
		turnBanner.classList.toggle('foe', !isPlayer);
		turnBanner.classList.remove('show');
		void turnBanner.offsetWidth;
		turnBanner.classList.add('show');
		SFX.turn();
		roundSubEl.textContent = isPlayer ? '我方行动' : '敌方行动';
		await sleep(1250);
	}

	// ---- 己方进攻回合 ----
	async function playerAttackPhase() {
		S.phase = 'playerAtk';
		// 连击跨回合累计：回合开始不重置，只有 MISS 才断
		unitProtag.classList.add('state-aggro');   // 主角保持进攻姿态

		for (let i = 0; i < CFG.ATK_QTES; i++) {
			if (S.hpR <= 0) break;
			const key = pick(CFG.ATK_KEYS);
			const res = await runQTE(key, CFG.QTE_LIFE);

			if (res.grade === 'miss') {
				showJudge('miss');
				SFX.miss();
				updateCombo(0);
				await sleep(280);
				continue;
			}

			// 命中：主角切换 attack 形态 → 发射攻击 → 命中 → 复原
			const g = GRADE[res.grade];
			const dmg = Math.max(1, Math.round(CFG.DMG_PER_QTE * g.atk));

			showJudge(res.grade);
			// ≤1s（PERFECT / GREAT）累计连击；>1s（GOOD）算没连击，直接重计
			if (res.grade === 'perfect' || res.grade === 'great') updateCombo(S.combo + 1);
			else                                            updateCombo(0);
			if (res.grade === 'perfect') { S.statPerfect++; SFX.perfect(); }
			else if (res.grade === 'great') SFX.great();
			else SFX.good();

			setForm(unitProtag, 'attack');            // 切换攻击形态
			await sleep(130);

			const from = unitCenter(unitProtag, 0.34);
			const to = unitCenter(unitRival, 0.34);
			spawnProjectile(from.x, from.y, to.x, to.y);
			await sleep(230);                         // 弹道飞行

			spawnFx('slash', to.x, to.y);
			spawnFx('impact', to.x + rand(-30, 30), to.y + rand(-20, 20));
			spawnDmgNum(to.x + rand(-20, 20), to.y - 40, '-' + dmg);
			SFX.hit();
			shake(res.grade === 'perfect' ? 'l' : 's');
			setState(unitRival, 'hurt');
			bumpHPBar('R');
			setHP('R', S.hpR - dmg);

			await sleep(200);
			setForm(unitProtag, 'idle');              // 攻击后复原
			await sleep(170);
		}

		await sleep(420);
		// 连击显示跨回合保留（归零时 updateCombo 已隐藏）
		unitProtag.classList.remove('state-aggro');
		setState(unitProtag, 'idle');
		setState(unitRival, 'idle');
	}

	// ---- 对手进攻（我方防御）回合 ----
	// 峰岸诚的进攻有两种：
	//   'parry' 斩击：屏幕两侧泛红光，浮现 W / A / S / D，沙耶香挥剑招架
	//   'cat'   突袭：屏幕两侧泛黄光，浮现 Space，按 Space「切刀」换小黑上来格挡
	async function foeAttackPhase() {
		S.phase = 'foeAtk';
		unitRival.classList.add('state-aggro');    // 对手保持进攻姿态

		let lastKind = null;
		for (let i = 0; i < CFG.DEF_QTES; i++) {
			if (S.hpP <= 0) break;

			// 两种进攻交替出现，保证每回合「招架」和「切刀换小黑」都能练到
			const kind = lastKind === 'parry' ? 'cat'
			           : lastKind === 'cat'   ? 'parry'
			           : (Math.random() < 0.5 ? 'parry' : 'cat');
			lastKind = kind;
			const isCat = kind === 'cat';

			// 先出预警：两侧亮起红光 / 黄光，圆圈提示这一击该按什么键
			showEdgeGlow(kind);
			setCatReady(isCat);
			const key = isCat ? CFG.CAT_KEY : pick(CFG.PARRY_KEYS);
			const res = await runQTE(key, CFG.DEF_LIFE);
			hideEdgeGlow();
			setCatReady(false);

			if (res.grade === 'miss') {
				// 超时未防御：对手发动攻击，主角全额受创，连击中断
				const dmg = CFG.FOE_DMG;
				showJudge('miss');
				SFX.miss();
				tintFlash(kind);
				updateCombo(0);
				setForm(unitRival, isCat ? 'attack2' : 'attack');   // 突袭用第二套立绘
				await sleep(210);
				const c = unitCenter(unitProtag, 0.3);
				spawnFx('impact', c.x, c.y);
				spawnDmgNum(c.x + rand(-20, 20), c.y - 40, '-' + dmg);
				SFX.hurt();
				shake('l');
				setState(unitProtag, 'hurt');
				bumpHPBar('P');
				setHP('P', S.hpP - dmg);
				await sleep(380);
				setForm(unitRival, 'idle');          // 对手复原
			} else {
				// 玩家按下：对手切换 attack，我方按防御率减免伤害
				const g = GRADE[res.grade];
				const dmg = Math.round(CFG.FOE_DMG * (1 - g.def));

				showJudge(res.grade);
				// 防御：≤1s 累计连击；>1s 算没格挡好，重计
				if (res.grade === 'perfect' || res.grade === 'great') updateCombo(S.combo + 1);
				else                                            updateCombo(0);
				setForm(unitRival, isCat ? 'attack2' : 'attack');   // 斩击用 attack，突袭用 attack2

				// 谁来挡下这一刀：沙耶香招架（W/A/S/D）还是小黑登场（Space）
				let c;
				if (isCat) {
					S.statCat++;                     // 小黑接替防御
					c = await catIntercept();        // 切刀音效 + 小黑冲刺 + 金色护盾
				} else {
					setForm(unitProtag, 'defense');  // 主角切换防御形态
					await sleep(200);
					c = unitCenter(unitProtag, 0.34);
					shieldP.classList.remove('on');
					void shieldP.offsetWidth;
					shieldP.classList.add('on');
				}
				tintFlash(kind);

				if (dmg <= 0) {
					// 完全防御：血条不削减
					S.statBlock++;
					SFX.block();
					spawnFx('blockfx' + (isCat ? ' gold' : ''), c.x, c.y);
					spawnDmgNum(c.x + rand(-16, 16), c.y - 40, 'BLOCK', true);
					shake('s');
				} else {
					// 部分防御：仍有部分伤害穿透
					SFX.block();
					SFX.hurt();
					spawnFx('blockfx' + (isCat ? ' gold' : ''), c.x, c.y);
					spawnDmgNum(c.x + rand(-16, 16), c.y - 40, '-' + dmg);
					shake('s');
					setState(unitProtag, 'hurt');
					bumpHPBar('P');
					setHP('P', S.hpP - dmg);
				}
				await sleep(isCat ? 560 : 420);      // 小黑还要留一会儿，等它退回原位
				setForm(unitRival, 'idle');          // 复原
				setForm(unitProtag, 'idle');
			}
		}

		await sleep(420);
		hideEdgeGlow();
		setCatReady(false);
		shieldP.classList.remove('on');
		shieldCat.classList.remove('on');
		catGuardOff();                               // 小黑退回待机
		unitRival.classList.remove('state-aggro');
		setState(unitProtag, 'idle');
		setState(unitRival, 'idle');
	}

	// ---- 主循环 ----
	async function battleLoop() {
		while (S.running) {
			setRound(S.round, '我方行动');

			await showTurn(true);
			await playerAttackPhase();
			if (S.hpR <= 0) { await finishBattle(true); return; }
			if (!S.running) return;

			await showTurn(false);
			await foeAttackPhase();
			if (S.hpP <= 0) { await finishBattle(false); return; }
			if (!S.running) return;

			setRound(S.round + 1);
			await sleep(300);
		}
	}

	/* 
	   10. 开始 / 结束
	    */
	async function finishBattle(win) {
		S.running = false;
		S.phase = 'over';
		roundSubEl.textContent = win ? '战斗结束' : '力竭倒下';

		// 结束演出
		flash();
		shake('l');
		if (win) {
			SFX.win();
			setForm(unitRival, 'fail');                 // 对手切换败北形态
			unitRival.classList.remove('state-idle');
			unitRival.classList.add('state-fail');
			await sleep(900);
			flash();
		} else {
			SFX.lose();
			setForm(unitProtag, 'defense');
			unitProtag.classList.add('state-down');
			catGuardOff();
			unitCat.classList.add('state-down');      // 小黑也跟着倒下
			await sleep(900);
		}

		$('resultBadge').textContent = win ? '✓' : '✕';
		$('resultBadge').classList.toggle('lose', !win);
		$('resultTitle').textContent = win ? '战斗胜利' : '战斗失败';
		$('resultSub').textContent = win ? '峰岸诚 被击退了' : '沙耶香 与 小黑 倒下了…';
		$('statRound').textContent = S.round;
		$('statPerfect').textContent = S.statPerfect;
		$('statBlock').textContent = S.statBlock;
		$('statCat').textContent = S.statCat;
		$('statMaxCombo').textContent = S.maxCombo;

		restartBtn.style.display = win ? 'none' : '';
		homeBtn.textContent = win ? '继 续' : '返回大厅';
		homeBtn.classList.toggle('btn-ghost', !win);
		if (!win) rollBackToEntry();          // 失败：存档退回入口句，重进时不被跳过战斗
		homeBtn.classList.toggle('btn-primary', win);
		// 胜利后点「继续」回到剧情下一句（"几番交战后，我瞅准时机……"）
		homeBtn.setAttribute('href', win ? resolveNextPage() : '../hall.html');

		// 胜利瞬间：弹「邪不压正」（再次挑战胜利因去重不会重复弹）
		if (win && window.VN && VN.achieve && typeof VN.achieve.unlock === 'function') {
			try { VN.achieve.unlock('justice'); } catch (eJ) {}
		}

		await sleep(300);
		resultOverlay.classList.add('show');
	}

	function startGame() {
		SFX.init();
		if (S.running) return;

		// 重置
		S.running = true;
		S.round = 1;
		S.combo = 0;
		S.maxCombo = 0;
		S.statPerfect = 0;
		S.statBlock = 0;
		S.statCat = 0;
		S.current = null;

		setHP('P', CFG.HP_MAX);
		setHP('R', CFG.HP_MAX);
		hpLagP.style.width = '100%';
		hpLagR.style.width = '100%';
		setRound(1, '战斗开始');
		resetStates();
		hideEdgeGlow();
		setCatReady(false);
		shieldP.classList.remove('on');
		shieldCat.classList.remove('on');
		qteLayer.innerHTML = '';
		fxLayer.innerHTML = '';
		comboBox.classList.remove('show');

		startOverlay.classList.remove('show');
		resultOverlay.classList.remove('show');

		battleLoop();
	}

	startBtn.addEventListener('click', startGame);
	restartBtn.addEventListener('click', startGame);

	// 初始：双方待机呼吸
	resetStates();
	setRound(1, '准备');

})();
