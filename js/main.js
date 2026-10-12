/* 对话框与人物立绘（VN.dialog / VN.portrait） */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  var dialogEl    = document.getElementById('vnDialog');
  var speakerEl   = document.getElementById('vnSpeaker');
  var textEl      = document.getElementById('vnText');
  var textBodyEl  = document.getElementById('vnTextBody');
  var portraitEl  = document.getElementById('vnPortrait');
  var portraitImg = document.getElementById('vnPortraitImg');

  function warn(msg) {
    if (root.console && root.console.warn) {
      root.console.warn('[VN · dialog] ' + msg);
    }
  }

  /* ---------------- 对话框 ---------------- */
  var dialog = {
    show: function () {
      if (!dialogEl) return;
      dialogEl.classList.remove('is-hidden');
    },

    hide: function () {
      if (!dialogEl) return;
      dialogEl.classList.add('is-hidden');
    },

    isVisible: function () {
      return !!dialogEl && !dialogEl.classList.contains('is-hidden');
    },

    /* 设置说话人名字 */
    speaker: function (name) {
      if (!speakerEl) return;
      if (name === undefined || name === null) name = '？？？';
      speakerEl.textContent = name;
      speakerEl.classList.toggle('is-empty', name === '');
    },

    /* 显示一句台词 */
    say: function (text) {
      if (!textBodyEl) return;
      textBodyEl.textContent = (text === undefined || text === null) ? '' : String(text);
      if (textEl) textEl.scrollTop = 0;
    },

    clear: function () {
      this.say('');
    }
  };

  /* ---------------- 人物立绘 ---------------- */
  var portrait = {
    /* 设置立绘图片 */
    set: function (src) {
      if (!portraitImg) return;
      if (src) {
        portraitImg.setAttribute('src', String(src));
      } else {
        portraitImg.removeAttribute('src');
      }
    },

    show: function (src) {
      if (src !== undefined) this.set(src);
      if (portraitEl) portraitEl.classList.remove('is-hidden');
    },

    hide: function () {
      if (portraitEl) portraitEl.classList.add('is-hidden');
    },

    isVisible: function () {
      return !!portraitEl && !portraitEl.classList.contains('is-hidden');
    }
  };

  root[NS].dialog   = dialog;
  root[NS].portrait = portrait;

  if (!dialogEl)   warn('未找到 #vnDialog，请确认模块 HTML 已插入页面。');
  if (!portraitEl) warn('未找到 #vnPortrait，请确认模块 HTML 已插入页面。');
})();

/* 文字效果：逐字打字机与推进（VN.text） */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  var dialogEl   = document.getElementById('vnDialog');
  var speakerEl  = document.getElementById('vnSpeaker');
  var textEl     = document.getElementById('vnText');
  var textBodyEl = document.getElementById('vnTextBody');
  var portraitEl    = document.getElementById('vnPortrait');
  var portraitImgEl = document.getElementById('vnPortraitImg');

  function warn(msg) {
    if (root.console && root.console.warn) root.console.warn('[VN · text] ' + msg);
  }
  if (!textBodyEl) { warn('未找到 #vnTextBody，文字效果无法工作。'); return; }

  /* ---------------- 状态机 ---------------- */
  var TYPING = 'typing';
  var WAITING = 'waiting';
  var IDLE = 'idle';
  var SWITCHING = 'switching';
  var state = IDLE;
  var switchWait = 0;

  var currentItem = null;
  var fullText = '';
  var shown = 0;
  var timer = null;

  /* 打字速度（毫秒/字）：跟随设置页里「文字速度」滑条写入的 vn_text_speed；
     没有该设置时用默认 60。0 表示瞬间显示。设置页改完，刷新/切页即生效。 */
  var speed = (function () {
    try {
      var v = parseFloat(root.localStorage.getItem('vn_text_speed'));
      if (isFinite(v) && v >= 0) return Math.min(1000, v);
    } catch (e) { /* 隐私模式等 */ }
    return 60;
  })();
  var punctDelay = {
    '。': 180, '！': 220, '？': 220, '…': 180, '～': 160,
    '，': 80, '、': 70, '；': 110, '：': 100, '—': 140,
    '.': 90, '!': 220, '?': 220, ',': 60
  };

  /* ---------------- 立绘注册表 ----------------
     来源：images/Characters/<分类>/<文件>（键名＝文件名，小写、'-'→'_'）
     与旧注册重复的一律改指 Characters 里的新图；本表由 _register_portraits.js 生成 */
  var portraitLib = {
    /* —— 黑猫（images/Characters/cat） —— */
    'cat_alert': '../images/Characters/cat/cat_alert.png',
    'cat_confident': '../images/Characters/cat/cat_confident.png',
    'cat_ponder': '../images/Characters/cat/cat_ponder.png',
    'cat_proud': '../images/Characters/cat/cat_proud.png',
    'cat_shocked': '../images/Characters/cat/cat_shocked.png',
    'cat_sigh': '../images/Characters/cat/cat_sigh.png',
    'cat_speechless': '../images/Characters/cat/cat_speechless.png',
    /* —— 白木麻矢（主）（images/Characters/main） —— */
    'ms_1': '../images/Characters/main/ms_1.png',
    'ms_2': '../images/Characters/main/ms_2.png',
    'ms_3': '../images/Characters/main/ms_3.png',
    'ms_mr': '../images/Characters/main/ms_mr.png',
    'ms_sk': '../images/Characters/main/ms_sk.png',
    /* —— 少女（images/Characters/girl） —— */
    'girl1_confused': '../images/Characters/girl/girl1_confused.png',
    'girl_happy': '../images/Characters/girl/girl_happy.png',   /* 也供台本键：ms_happy */
    'girl_smile': '../images/Characters/girl/girl_smile.png',   /* 也供台本键：ms_smile */
    'ms_happy': '../images/Characters/girl/girl_happy.png',   /* 台本键别名 */
    'ms_smile': '../images/Characters/girl/girl_smile.png',   /* 台本键别名 */
    /* —— 知美（zm）（images/Characters/girl+） —— */
    'zm_sn': '../images/Characters/girl+/zm-sn.png',
    'zm_tq': '../images/Characters/girl+/zm-tq.png',
    'zm_wx': '../images/Characters/girl+/zm-wx.png',
    'zm_zj': '../images/Characters/girl+/zm-zj.png',
    /* —— 沙耶香（sy）（images/Characters/sis） —— */
    'sy_fn': '../images/Characters/sis/sy_fn.png',
    'sy_jz': '../images/Characters/sis/sy_jz.png',
    'sy_xy': '../images/Characters/sis/sy_xy.png',
    /* —— 千崎刑警（qq）（images/Characters/police） —— */
    'qq_dy': '../images/Characters/police/qq-dy.png',
    'qq_mm': '../images/Characters/police/qq-mm.png',
    'qq_wx': '../images/Characters/police/qq_wx.png',
    'qq_zc': '../images/Characters/police/qq_zc.png',
    /* —— 久住刑警（jz）（images/Characters/boy） —— */
    'jz': '../images/Characters/boy/jz.png',
    /* —— 南乡夫妇（images/Characters/husband&wife） —— */
    'husband_normal': '../images/Characters/husband&wife/husband_normal.png',
    'husband_soul': '../images/Characters/husband&wife/husband_soul.png',   /* 也供台本键：nxlh */
    'wife_normal': '../images/Characters/husband&wife/wife_normal.png',   /* 也供台本键：nxfr */
    'nxfr': '../images/Characters/husband&wife/wife_normal.png',   /* 台本键别名 */
    'nxlh': '../images/Characters/husband&wife/husband_soul.png',   /* 台本键别名 */
    /* —— 灵魂（images/Characters/soul） —— */
    'soul': '../images/Characters/soul/Soul+.png',   /* 也供台本键：lh */
    'lh': '../images/Characters/soul/Soul+.png',   /* 台本键别名 */
    /* —— 峰岸（fa）（images/Characters/villian） —— */
    'fa_beg': '../images/Characters/villian/fa_beg.png',
    'fa_end': '../images/Characters/villian/fa_end.png',
    'fa_lx': '../images/Characters/villian/fa_lx.png',
    'fa_xe': '../images/Characters/villian/fa_xe.png',
    /* —— 台本键别名（美工改名后的对应关系；保留旧键，重新生成台本也不会丢图） —— */
    'cat_think': '../images/Characters/cat/cat_ponder.png',
    'jz_beg': '../images/Characters/villian/fa_beg.png',
    'ms_wt': '../images/Characters/main/ms_1.png',
    'ms_think': '../images/Characters/main/ms_sk.png',
    'ms_silent': '../images/Characters/main/ms_mr.png',
    'ms_wuyu': '../images/Characters/main/ms_3.png',
    /* —— 台本键别名（美工改名后的对应关系；保留旧键，重新生成台本也不会丢图） —— */
    'fa_nq': '../images/Characters/villian/fa_xe.png',
  };
  root[NS].portraitLib = portraitLib;

  /* 立绘「家族」：用来给不同角色单独设置位置/边距。
     · 登记键取前缀：cat_confident → cat，ms_smile → ms，jz → jz，lh → lh，nxlh → nx…
     · 直接写图片路径时，取路径里倒数第二段目录名：…/Characters/cat/cat_x.png → cat
     页面样式可用 .vn-portrait[data-portrait-family="cat"] 单独覆盖边距。 */
  function portraitFamily(ref, src) {
    var key = String(ref === undefined || ref === null ? '' : ref);
    if (Object.prototype.hasOwnProperty.call(portraitLib, key)) {
      var p = key.split('_')[0];
      return p ? p.toLowerCase() : '';
    }
    var path = String(src || key).replace(/\\/g, '/');
    var parts = path.split('/');
    if (parts.length >= 2) {
      var dir = parts[parts.length - 2];
      if (dir && dir.indexOf('.') === -1) return dir.toLowerCase();
    }
    return '';
  }

  var swapToken = 0;

  function resolvePortrait(ref) {
    if (ref === undefined || ref === null) return null;              /* 保持 */
    if (ref === '' || ref === 'none' || ref === 'hide') return false;/* 隐藏 */
    if (Object.prototype.hasOwnProperty.call(portraitLib, ref)) {
      var mapped = portraitLib[ref];
      if (!mapped) return false;        /* 键存在但没填路径 → 视为隐藏 */
      return String(mapped);
    }
    return String(ref);                 /* 未登记：当作直接图片路径 */
  }

  /* 把家族/键名写到容器上（CSS 据此区分角色） */
  function markPortrait(ref, src) {
    if (!portraitEl) return;
    var fam = portraitFamily(ref, src);
    if (fam) portraitEl.setAttribute('data-portrait-family', fam);
    else portraitEl.removeAttribute('data-portrait-family');
    var key = String(ref === undefined || ref === null ? '' : ref);
    if (key && Object.prototype.hasOwnProperty.call(portraitLib, key)) {
      portraitEl.setAttribute('data-portrait-key', key);
    } else {
      portraitEl.removeAttribute('data-portrait-key');
    }
  }

  /* 切换立绘：淡出 → 换图（等加载完成） → 淡入 */
  function applyPortrait(ref) {
    if (!portraitEl) return;
    var src = resolvePortrait(ref);
    if (src === null) return;           /* 该段未指定立绘：保持现状 */
    if (src === false) {                /* 隐藏立绘 */
      swapToken++;
      portraitEl.classList.remove('vn-portrait--leaving');
      portraitEl.classList.add('is-hidden');
      return;
    }
    /* 已是同一张且正显示中：不重复闪烁 */
    if (!portraitEl.classList.contains('is-hidden') &&
        !portraitEl.classList.contains('vn-portrait--leaving') &&
        portraitImgEl && portraitImgEl.getAttribute('src') === src) {
      markPortrait(ref, src);
      return;
    }
    swapToken++;
    var token = swapToken;
    /* 注意：这里**不能**立刻改 data-portrait-family。
       家族标记会决定尺寸与边距，而此刻旧立绘还在淡出、仍然可见 ——
       立刻改就会「旧图以新角色的尺寸闪一下」。正确做法是等图片真正换掉时再改（见下面 setTimeout）。 */
    portraitEl.classList.remove('is-hidden');       /* 确保可见 */
    if (!portraitImgEl) { markPortrait(ref, src); return; }
    portraitEl.classList.add('vn-portrait--leaving'); /* 淡出 */
    setTimeout(function () {
      if (token !== swapToken) return;              /* 已被更新的切换取代 */
      portraitImgEl.onload = function () {
        if (token !== swapToken) return;
        portraitEl.classList.remove('vn-portrait--leaving'); /* 淡入 */
        portraitImgEl.onload = null;
        portraitImgEl.onerror = null;
      };
      portraitImgEl.onerror = function () {
        if (token !== swapToken) return;
        warn('立绘加载失败（请检查路径/文件）：' + src);
        portraitImgEl.removeAttribute('src');       /* 回到虚线占位提示 */
        portraitEl.classList.remove('vn-portrait--leaving');
        portraitImgEl.onload = null;
        portraitImgEl.onerror = null;
      };
      /* 此刻已淡出到看不见（0.4s 过渡走到 380ms），换图与换家族一起做，玩家看不到几何跳变 */
      markPortrait(ref, src);
      portraitImgEl.setAttribute('src', src);       /* 换图 */
    }, 380); /* 等淡出过渡（0.4s）基本完成后再换图 */
  }

  var queue = [];            /* 待播段队列 */
  /* ---------------- 首屏遮幕 ----------------
     html/plot.html 的 #vnBlackout 初始就是黑的（内联 style="opacity:1"），
     这样「进/返回剧情页」时不会先闪出视觉小说的背景、占位对话框与空立绘 ——
     尤其是从小游戏/推理页回来时那句自带 CG 的情况：CG 视频要缓冲一会儿，
     旧写法这段时间里会把占位画面全露出来。
     第一句的演出就绪（或在没有演出步骤时）调用下面这个函数揭幕，
     之后完全交回既有的黑场逻辑（setBlackout / playChapterIntro）。 */
  var bootCurtain = true;
  var bootCurtainTimer = null;
  var bootCurtainRetry = null;
  /* 揭幕必须自己动手把 #vnBlackout 淡开：
     ★ 本模块（VN.text）在 main.js 里位于 VN.scene **之前**，而 startDemo() 是在
       DOMContentLoaded 上同步跑的。于是「读档 / 从小游戏・推理页返回」这类
       「一进页面就立刻续玩」的情况里，第一句（常常正是那句自带 CG 的句子）的演出
       会瞬间跑完并调用本函数，此刻 VN.scene 还没定义 —— 原来那句
       `VN.scene.revealBlackout(0)` 直接被 if 挡掉，黑幕就再也没人揭开，
       只能等 16s 兜底定时器，玩家看到的就是「CG 视频在背后播了十几秒黑屏」。 */
  function liftBootCurtain(why) {
    if (!bootCurtain) return;
    bootCurtain = false;
    if (bootCurtainTimer) { root.clearTimeout(bootCurtainTimer); bootCurtainTimer = null; }
    /* ① 直接淡开黑幕（不依赖 VN.scene 是否已加载） */
    var bl = document.getElementById('vnBlackout');
    if (bl) {
      bl.style.transition = 'opacity 700ms ease';
      bl.style.opacity = '0';
      bl.style.pointerEvents = 'none';
    }
    /* ② 顺手收掉「CG 载入中…」提示（CG 模块可能还没加载：稍后补两次） */
    var hideHint = function () {
      if (root.VN && typeof root.VN.hideCgLoading === 'function') {
        try { root.VN.hideCgLoading(); return true; } catch (eHL) {}
      }
      return false;
    };
    if (!hideHint()) { root.setTimeout(hideHint, 0); root.setTimeout(hideHint, 200); }
    /* ③ 把「遮幕已揭」这件事告诉场景模块（它可能还没加载：就绪后补一次） */
    (function tellScene(left) {
      if (root.VN && root.VN.scene && typeof root.VN.scene.revealBlackout === 'function') {
        try { root.VN.scene.revealBlackout(0); } catch (eBC) {}
        hideHint();
        return;
      }
      if (left <= 0) return;
      bootCurtainRetry = root.setTimeout(function () { tellScene(left - 1); }, 50);
    })(60);   /* 最多重试 60 次 ≈ 3s */
    if (root.console) root.console.info('[VN] 首屏遮幕揭幕（' + (why || '') + '）');
  }
  root[NS].liftBootCurtain = liftBootCurtain;      /* 暴露给 CG 模块 / 测试 */
  /* 兜底：万一第一句的演出一直没就绪（例如 CG 加载失败），也不能把玩家黑在屏幕里。
     注意要留够「连续标题卡」的时间（开篇声明 + Chapter 0 两张卡 ≈ 10.4s），所以给 16s。 */
  bootCurtainTimer = root.setTimeout(function () { liftBootCurtain('兜底超时 16s'); }, 16000);

  var needNext = null;       /* “取下一句”回调 */
  var storyLines = null;     /* 线性剧情源：非空时逐句取自该数组（供存档续玩） */
  var storyCursor = 0;       /* 剧情源中“下一句”的索引 */
  var lastBranchIdx = -1;    /* 最近一次「选择 / 问卷」句的索引（坏结局回主菜单时用它当续玩点） */

  /* ---------- 「最近的选择点」跨页面持久化 ----------
     坏结局回主菜单时，自动存档要退回「做这次选择之前」那一句。
     原来的 lastBranchIdx 只活在**当前页面会话**里：只要玩家中途退出过
     （读自动档 / 从推理页返回 / 关掉页面再「继续游戏」），新会话里它是 -1，
     于是坏结局只能退到「结局句本身」——回主菜单点「继续游戏」又直接播坏结局，
     玩家被困在这个结局里出不来（Chapter 4 尤其明显：它的坏结局都藏在一长串分支深处）。
     这里把选择点写进 localStorage（与存档同一个账号前缀），
     续玩时再校验着取回：必须是同一章、且在当前句之前、且那一句确实是选择/问卷句。 */
  var BRANCH_KEY = 'vn_last_branch';
  function branchStoreKey() {
    try {
      if (root.VN && root.VN.userStore && typeof root.VN.userStore.key === 'function') {
        return root.VN.userStore.key(BRANCH_KEY);
      }
    } catch (e) { /* 隐私模式等：退回裸键 */ }
    return BRANCH_KEY;
  }
  function rememberBranch(idx) {
    lastBranchIdx = idx;
    try {
      root.localStorage.setItem(branchStoreKey(), JSON.stringify({
        idx: idx, chapter: chapterNameAt(idx), time: Date.now()
      }));
    } catch (e2) { /* 存不了就算：本次会话内仍然有效 */ }
  }
  function restoreBranch(resumeIdx) {
    try {
      var raw = root.localStorage.getItem(branchStoreKey());
      var o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o.idx !== 'number') return -1;
      var i = o.idx;
      if (i < 0 || i >= resumeIdx) return -1;                 /* 必须在续玩点之前 */
      var it = DEMO_LINES[i];
      var isBranch = !!(it && ((it.choices && it.choices.length) ||
        (it.ask && it.ask.options && it.ask.options.length)));
      if (!isBranch) return -1;                               /* 那一句必须真的是选择/问卷句 */
      if (chapterNameAt(i) !== chapterNameAt(resumeIdx)) return -1;   /* 跨章的旧记录不可信 */
      return i;
    } catch (e3) { return -1; }
  }

  /* 兜底（老存档 / 记录丢失时用）：由「结局句」反推这次路线的分岔点。
     本作台词表里每个分支段都以一句带 label 的句子开头，而这个 label 只会被
     某个选择/问卷句的选项指向 —— 于是：
       ① 从结局句往回找最近的 label 行（＝本段分支的入口）；
       ② 再往回找「哪个选择/问卷句的选项指向这个 label」→ 那就是分岔点。 */
  function deriveBranchBefore(from) {
    var arr = DEMO_LINES || [];
    if (!arr.length) return -1;
    var tries = 0;
    for (var i = Math.min(from, arr.length - 1); i >= 0 && tries < 4; i--) {
      var it = arr[i];
      if (!it || !it.label) continue;
      tries++;
      var label = String(it.label);
      for (var j = i - 1; j >= 0; j--) {          /* 分岔点一定在这段分支之前 */
        var c = arr[j];
        if (!c) continue;
        var opts = null;
        if (c.choices && c.choices.length) opts = c.choices;
        else if (c.ask && c.ask.options && c.ask.options.length) {
          opts = c.ask.options.slice();
          if (c.ask.done) opts.push(c.ask.done);
        }
        if (!opts) continue;
        for (var k = 0; k < opts.length; k++) {
          var o = opts[k] || {};
          if (String(o.label || o.jump || '') === label) return j;
        }
      }
    }
    return -1;
  }

  var callbacks = {};        /* 事件：lineStart / lineEnd / queueEnd */
  var enabled = true;

  /* 待跳转：句子带 goto 字段时，读完并点击推进 → 整屏渐黑 → 跳转该页面 */
  var exitUrl = null;        /* 当前句的跳转目标 */
  var exitBusy = false;      /* 退出转场进行中（防重复触发） */

  /* 自动推进：句子带 auto 字段时，读完无需点击，延时后自动推进（或跳页） */
  var AUTO_ADVANCE_DELAY = 1000;   /* 打字完成后的自动推进延时（毫秒） */
  var autoAdvance = false;         /* 当前句是否需要自动推进 */
  var autoTimer = null;            /* 自动推进的定时器 */
  function clearAuto() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } }

  /* 自动播放（对话框左下角按钮 / A 键切换）：每句读完后停一会儿自动前进 */
  var autoPlay = false;            /* 是否处于自动播放 */
  var autoPlayDelay = 1000;        /* 自动播放时每句停留时长（毫秒，可运行时调整） */

  /* 长按空格连跳 */
  var HOLD_GAP = 150;        /* 连跳间隔（毫秒） */
  var holdOn = false;
  var holdTimer = null;

  var reducedMotion =
    root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
  function clearHold() { if (holdTimer) { clearInterval(holdTimer); holdTimer = null; } }

  function fire(name, a, b) {
    var fn = callbacks[name];
    if (typeof fn === 'function') {
      try { fn(a, b); }
      catch (err) {
        if (root.console) root.console.error('[VN · text] ' + name + ' 回调出错：', err);
      }
    }
  }

  /* ---------------- 名字牌 ---------------- */
  function setSpeaker(name) {
    if (!speakerEl) return;
    if (name === undefined || name === null) name = '？？？';
    speakerEl.textContent = String(name);
    speakerEl.classList.toggle('is-empty', name === '');
  }

  /* ---------------- 打字机核心 ---------------- */
  function render() {
    textBodyEl.textContent = fullText.slice(0, shown);
  }

  function delayOfLastChar() {
    var ch = fullText.charAt(shown - 1);
    return speed + (punctDelay[ch] || 0);
  }

  function tick() {
    if (state !== TYPING) return;
    shown++;
    render();
    if (shown >= fullText.length) {
      finish(false);                 /* 自然播放完毕 */
    } else {
      timer = setTimeout(tick, delayOfLastChar());
    }
  }

  /* 用户打断：立即补全本段 */
  function revealAll() {
    if (state !== TYPING) return;
    clearTimer();
    shown = fullText.length;
    render();
    finish(true);                    /* skipped = true */
  }

  function finish(skipped) {
    if (state === IDLE) return;
    clearTimer();
    state = WAITING;                 /* 整段已显示，等下一次点击/空格 */
    fire('lineEnd', currentItem, { skipped: !!skipped });
    /* 自动推进：读完（无论自然播完还是被快进）都安排一次自动前进。
       带 auto 字段的句子用 AUTO_ADVANCE_DELAY；开着自动播放时用 autoPlayDelay。 */
    if (autoAdvance || autoPlay) {
      clearAuto();
      autoTimer = setTimeout(function () {
        autoTimer = null;
        advanceFromWait();
      }, autoAdvance ? AUTO_ADVANCE_DELAY : autoPlayDelay);
    }
  }

  /* 真正开始逐字打字（切景后与普通开播共用） */
  function beginTyping() {
    state = TYPING;
    if (fullText.length === 0) { finish(false); return; }
    if (reducedMotion || speed <= 0) { shown = fullText.length; render(); finish(false); return; }
    timer = setTimeout(tick, speed);
  }

  /* ===== 通用：分支跳转 / 选项层 / 问卷（模块作用域，供 resumeStory、advanceFromWait 等调用）===== */
  /* ---------- 分支跳转与选项（Chapter 4 多结局） ----------
     · jumpToLabel(label)：按 label 找到目标句，把游标搬过去继续播（不跳页、不写返回点，也没有过场黑场）
     · choices：[{text,label},…] → 藏起对话框与立绘，浮出哥特风选项；点选后跳对应 label
     · ending：'坏结局 · 名称' → 复用章节标题卡播结局，随后自动回主菜单（配 goto:'hall.html'）
     选项层是动态创建的（不改任何 HTML），样式走游戏既有的墨夜 + 微光金配色。 */
  function jumpToLabel(label) {
    var arr = storyLines || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && String(arr[i].label || '') === String(label)) {
        switchWait++;                  /* 作废旧演出回调 */
        exitUrl = null;
        exitBusy = false;
        autoAdvance = false;
        clearAuto();
        closeChoices();
        state = IDLE;
        storyCursor = i;
        if (root.console) root.console.info('[VN] 分支跳转 → ' + label + '（第 ' + i + ' 句）');
        goNext();
        return true;
      }
    }
    if (root.console) root.console.warn('[VN] 找不到分支标签：' + label);
    return false;
  }

  var choiceLayer = null;
  function ensureChoiceStyle() {
    if (document.getElementById('vnChoiceStyle')) return;
    var st = document.createElement('style');
    st.id = 'vnChoiceStyle';
    st.textContent = [
      '.vn-choices{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:clamp(14px,2.2vh,26px);',
      'background:radial-gradient(120% 90% at 50% 40%, rgba(8,6,12,.55), rgba(4,3,7,.88));',
      'opacity:0;transition:opacity .45s ease;}',
      '.vn-choices.is-on{opacity:1;}',
      '.vn-choice{position:relative;min-width:min(74vw,720px);max-width:88vw;padding:clamp(14px,2vh,22px) clamp(22px,3vw,40px);',
      'font-family:var(--font-cn,serif);font-size:clamp(15px,2.05vh,21px);line-height:1.5;letter-spacing:.05em;',
      'color:#e6dcc6;text-align:left;cursor:pointer;',
      'background:linear-gradient(165deg, rgba(30,24,40,.92), rgba(10,8,16,.94));',
      'border:1px solid rgba(217,184,127,.34);border-radius:3px;',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 10px 26px rgba(0,0,0,.55);',
      'transition:transform .18s ease,border-color .22s ease,box-shadow .25s ease,color .22s ease;}',
      '.vn-choice::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;',
      'background:linear-gradient(180deg,transparent,rgba(217,184,127,.75),transparent);opacity:.55;transition:opacity .22s ease;}',
      '.vn-choice:hover,.vn-choice:focus-visible{color:#f6ecd6;border-color:rgba(240,217,166,.85);outline:none;',
      'transform:translateY(-2px);box-shadow:0 0 18px rgba(217,184,127,.28), inset 0 0 18px rgba(217,184,127,.10), 0 12px 30px rgba(0,0,0,.6);}',
      '.vn-choice:hover::before,.vn-choice:focus-visible::before{opacity:1;}',
      '.vn-choice:active{transform:translateY(0);}',
      '.vn-choice.is-done{color:rgba(150,142,126,.55);border-color:rgba(120,110,92,.28);',
      'background:linear-gradient(165deg, rgba(20,18,26,.85), rgba(9,8,14,.9));cursor:default;',
      'filter:grayscale(.55);box-shadow:inset 0 0 12px rgba(0,0,0,.5);}',
      '.vn-choice.is-done::before{opacity:.18;}',
      '.vn-choice.is-done:hover{transform:none;box-shadow:inset 0 0 12px rgba(0,0,0,.5);color:rgba(150,142,126,.55);}'
    ].join('');
    document.head.appendChild(st);
  }
  function closeChoices() {
    if (choiceLayer && choiceLayer.parentNode) choiceLayer.parentNode.removeChild(choiceLayer);
    choiceLayer = null;
  }
  function showChoices(list, onPick) {
    ensureChoiceStyle();
    closeChoices();
    choiceLayer = document.createElement('div');
    choiceLayer.className = 'vn-choices';
    (list || []).forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vn-choice' + (c.disabled ? ' is-done' : '');
      b.textContent = String(c.text || '');
      if (c.disabled) {
        b.disabled = true;
        b.setAttribute('aria-disabled', 'true');
      } else {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (root.console) root.console.info('[VN] 选择：' + c.text + ' → ' + (c.label || c.jump));
          if (typeof onPick === 'function') onPick(c);
          else jumpToLabel(c.label);
        });
      }
      choiceLayer.appendChild(b);
    });
    document.body.appendChild(choiceLayer);
    void choiceLayer.offsetWidth;
    choiceLayer.classList.add('is-on');

    /* ★ 空格＝剧情推进键，绝不能用来「选」选项。
       下面会把焦点放到第一个选项按钮上（方便键盘操作 / 无障碍），
       而浏览器对「聚焦中的按钮」按空格＝点击该按钮 —— 于是玩家想按空格继续，
       结果直接把默认聚焦的第一项选了（看起来就像「选择被跳过」）。
       这里在选项层里拦下空格（捕获阶段，先于按钮的默认行为）：
       · 空格不再选中任何选项，也不会推进剧情；
       · 想用键盘选，仍可按 Tab / 方向键移动焦点 + Enter 确认，或直接用鼠标点。 */
    choiceLayer.addEventListener('keydown', function (e) {
      var isSpace = (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');
      if (!isSpace) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    var first = choiceLayer.querySelector('.vn-choice');
    if (first && first.focus) first.focus();
  }

  /* ---------- 多选问卷（第三次选择：四问，选过的置灰） ----------
     ask: { id, options:[{text, jump, once}], done:{text, jump} }
     · once 选项选过一次就置灰不可再选；
     · 全部 once 选项都选过 → 追加 done（E. 没有问题了。）；
     · 每个分支末尾 jump 回问卷句的 label，问卷带"已选"状态重开。 */
  var surveySeen = {};
  function surveyReset() { surveySeen = {}; }
  function showSurvey(ask) {
    ask = ask || {};
    var id = String(ask.id || 'default');
    var seen = surveySeen[id] || (surveySeen[id] = {});
    var opts = ask.options || [];
    var list = opts.map(function (o, i) {
      return { text: o.text, jump: o.jump, key: i, once: !!o.once, disabled: !!seen[i] };
    });
    var allDone = opts.every(function (o, i) { return !o.once || !!seen[i]; });
    if (allDone && ask.done) list.push({ text: ask.done.text, jump: ask.done.jump, final: true });
    showChoices(list, function (opt) {
      if (!opt.final && opt.once && !opt.disabled) seen[opt.key] = true;
      jumpToLabel(opt.jump);
    });
  }

  function startLine(item) {
    currentItem = item;
    /* 记录本句是否带跳转目标（读完后点击推进即跳页）；无则清空 */
    exitUrl = (item.goto === undefined || item.goto === null || item.goto === '')
      ? null : String(item.goto);
    exitBusy = false;
    /* 记录本句是否自动推进（带 auto 字段时读完自动前进 / 跳页） */
    autoAdvance = (item.auto === true);
    state = TYPING;
    clearTimer();
    shown = 0;
    fullText = String(item.text === undefined || item.text === null ? '' : item.text);
    textBodyEl.textContent = '';
    if (textEl) textEl.scrollTop = 0;
    setSpeaker(item.speaker);
    applyPortrait(item.portrait);    /* 该段指定了立绘时自动切换 */
    /* 音乐：本句写了 bgm 就切/停（与 bg 同一套机制，不阻塞打字）。
       但若本句的 CG 自带音乐，则先放 CG 的曲子，等 CG 演完再把本句 bgm 接回来。
       ★ 例外：**章节句**不这样 —— 章节开场必须立刻响本章的 bgm（否则会先放 CG 的曲子、
         把本章主题曲推迟到 CG 演完，Chapter 2 的「曙光良镇」就是这么被跳过的）。 */
    var cgMusic = null;
    if (item.cg !== undefined && item.cg !== null && root.VN.cg && root.VN.cg.musicOf) {
      try { cgMusic = root.VN.cg.musicOf(item.cg); } catch (eCg) { cgMusic = null; }
    }
    var isChapterLine = (item.chapter !== undefined && item.chapter !== null && item.chapter !== '');
    if (root.VN && root.VN.bgm && root.VN.bgm.play) {
      if (cgMusic && !isChapterLine) {
        try { root.VN.bgm.play(cgMusic); } catch (e0) {}       /* CG 的音乐占位 */
      } else if (item.bgm !== undefined) {
        try { root.VN.bgm.play(item.bgm); } catch (e) {}
      }
    }
    fire('lineStart', { speaker: item.speaker, text: fullText, portrait: item.portrait, bg: item.bg, bgm: item.bgm, cg: item.cg });

    /* 这一句开始打字前要先跑的演出序列（按顺序、前一步跑完再跑下一步）：
         bg    → 整屏黑场切景
         cg    → 插入 CG（图片淡入 / 视频整段播完）
         chapter → 章节标题卡（整屏渐黑 → 标题渐显渐隐 → 渐显画面）
       章节句走「CG → 标题卡 → 打字」：bg 由标题卡在「屏幕全黑」那一刻静默换好（玩家看不到），
       对话框在整段演出期间立即隐藏 —— 所以标题卡出现之前既不会先露出新背景，
       也不会出现「清空后的空白对话框」。普通句仍是「切景（黑场转场）→ CG → 打字」。 */
    var myWait = ++switchWait;
    var hasScene = !!(root.VN && root.VN.scene && root.VN.scene.apply);
    var hasCg = !!(root.VN && root.VN.cg && root.VN.cg.apply);
    var wantBg = (item.bg !== undefined && item.bg !== null && hasScene);
    var wantCg = (item.cg !== undefined && item.cg !== null && hasCg);
    /* 手稿照片轮播（写在台词上的 photos: ['手稿1', …]，逐张「渐黑 → 显现」，
       停在画面上等玩家按空格/点鼠标左键才翻下一张） */
    var wantPhotos = !!(item.photos && item.photos.length &&
                        root.VN && root.VN.photos && root.VN.photos.play);
    var wantChoices = !!(item.choices && item.choices.length);         /* 选项句 */
    var wantSurvey = !!(item.ask && item.ask.options && item.ask.options.length);   /* 问卷句 */
    var wantEnding = !!(item.ending && hasScene);                      /* 结局卡句 */
    /* 记下最近一次「选择 / 问卷」句的索引：坏结局把玩家送回主菜单时，
       自动存档会退回这里，好让「继续游戏」回到那个选择重选（见 beginExit）。
       同时写进 localStorage，这样中途退出/读档回来（新页面会话）也还记得。 */
    if ((wantChoices || wantSurvey) && storyLines === DEMO_LINES && storyCursor > 0) {
      rememberBranch(storyCursor - 1);
    }
    var wantCard = (item.chapter !== undefined && item.chapter !== null && item.chapter !== '' &&
                    hasScene && !!root.VN.scene.playChapterIntro);

    /* 连续两张「章节/标题卡」（例如开篇的改编声明 → Chapter 0）：
       中间**不揭幕、也不等玩家点击** —— 黑场里直接接着演下一张卡，
       否则两张卡之间会先露出视觉小说的背景，还要玩家点一下才出现下一张。
       判据：本句是章节卡，且台词表里的下一句也是章节卡。 */
    var nextPreview = (storyLines && storyCursor < storyLines.length) ? storyLines[storyCursor] : null;
    var chainCards = !!(wantCard && nextPreview && nextPreview.chapter);
    if (chainCards) autoAdvance = true;        /* 本句演完自动接下一张卡（不再等点击） */

    /* 预热下一支 CG：本句开始时就往前看几句，找到即将出现的第一处 cg 就悄悄提前缓冲。
       这些 CG 动辄几十上百 MB（CG1 69MB / CG2 108MB / CG3 81MB / CG4 78MB），
       到点时首帧要等好几秒，那段时间屏幕是黑的；提前拉进缓存能把它压到最短。
       ★ 对「推理页 → CG」这条路尤其有用：进入推理页之前的那句 goto 就会把
         返回后的 CG 先缓冲一部分，等玩家从 inference/deduction 页回来时首帧更快到位。
       只是后台下载：不显示、不改画面、失败也完全不影响剧情。 */
    if (storyLines && root.VN && root.VN.cg && typeof root.VN.cg.preload === 'function') {
      var curCg = (item.cg === undefined || item.cg === null) ? '' : String(item.cg);
      for (var pk = storyCursor; pk < storyLines.length && pk < storyCursor + 10; pk++) {
        var pl = storyLines[pk];
        if (pl && pl.cg !== undefined && pl.cg !== null && pl.cg !== '' && String(pl.cg) !== curCg) {
          try { root.VN.cg.preload(pl.cg); } catch (ePre) {}
          break;
        }
      }
    }

    /* 这次演出期间是否要把对话框藏起来（章节句；照片轮播；或「没有台词、只有 bg/cg」的纯演出句） */
    var hideForPerformance = wantCard || wantPhotos || wantChoices || wantSurvey || wantEnding ||
                             (fullText === '' && (wantCg || wantBg));
    /* 选项句 / 问卷句 / 结局卡句：对话框与立绘都要收起来 */
    if ((wantChoices || wantSurvey || wantEnding) && typeof applyPortrait === 'function') {
      applyPortrait('');            /* '' = 收起立绘 */
    }

    /* 上一句是章节句／纯演出句，把对话框藏起来了 → 本句要念台词，先把对话框恢复回来。
       （否则 CG 之后的所有台词都会因为对话框保持隐藏而「看不见」） */
    if (!hideForPerformance && fullText !== '' && root.VN && root.VN.dialog) {
      if (root.VN.dialog.isVisible && !root.VN.dialog.isVisible() && root.VN.dialog.show) {
        root.VN.dialog.show();
      }
    }

    /* 演出全部跑完 → 先弹成就（本句写了 achieve 字段的话）→ 需要时恢复对话框 → 开始打字 */
    function startTypingAfterShow() {
      if (myWait !== switchWait) return;
      /* 第一句的演出已经就绪（CG 第一帧 / 章节卡 / 背景都在位了）→ 揭掉首屏遮幕。
         但「连续标题卡」这种要留在黑场里直接接下一张，不能在这里揭幕
         （否则两张卡之间会露出视觉小说的背景）；那种情况由最后一张卡的揭幕收尾。 */
      if (!chainCards) liftBootCurtain('第一句演出就绪');
      if (root.VN && root.VN.dialog) {
        if (fullText === '') {
          if (hideForPerformance) hideDialogNow();     /* 纯演出句：保持隐藏，别露出空白框 */
        } else if (hideForPerformance && root.VN.dialog.show) {
          root.VN.dialog.show();                       /* 有台词 → 恢复对话框再打字 */
        }
      }
      /* 成就：写在台词条目的 achieve 字段里（值＝成就 id，如 'huluo'）。
         演出（切景/CG/标题卡）跑完那一刻弹出，所以「CG 播完再出成就」只需写在同一条上。 */
      if (item.achieve !== undefined && item.achieve !== null && item.achieve !== '' &&
          root.VN.achieve && typeof root.VN.achieve.unlock === 'function') {
        try { root.VN.achieve.unlock(String(item.achieve)); } catch (eA) {}
      }
      /* 地图锚点：写在台词条目的 mapZone 字段里（值＝该剧情点应有的 Zone 编号）。
         演出跑完、台词出现前强制全屏弹出该 Zone 的地图，进入点击门：
         玩家点中新地点（箭头漂移过去、停 1s）才关闭继续；
         弹出期间压住打字，关掉后这句台词才从头开始敲字。
         跟剧走不落盘：每次重看这段都会弹，显示的就是这个剧情点的地图。 */
      if (item.mapZone !== undefined && item.mapZone !== null &&
          root.VN.map && typeof root.VN.map.unlock === 'function') {
        try { root.VN.map.unlock(Number(item.mapZone)); } catch (eMap) {}
      }
      if (state === SWITCHING) {
        if (root.VN.map && typeof root.VN.map.isHolding === 'function' && root.VN.map.isHolding()) {
          try { root.VN.map.afterClose(function () { if (state === SWITCHING) beginTyping(); }); } catch (eMap2) {}
        } else {
          beginTyping();
        }
      }
    }

    /* 立即隐藏对话框（不留淡出过程，避免看见「空白的框慢慢消失」） */
    function hideDialogNow() {
      if (!(root.VN && root.VN.dialog && root.VN.dialog.hide)) return;
      var dEl = document.getElementById('vnDialog');
      if (!dEl) { root.VN.dialog.hide(); return; }
      var prev = dEl.style.transition;
      dEl.style.transition = 'none';
      root.VN.dialog.hide();
      void dEl.offsetWidth;                 /* 强制回流，让瞬时状态立即生效 */
      dEl.style.transition = prev;
    }

    /* CG 步骤：演完后（图片已浮出 / 视频播完）把本句 bgm 接回来 */
    function cgStep(next) {
      root.VN.cg.apply(item.cg, function (stillPlaying) {
        /* 循环视频还在自己播（stillPlaying=true）就不接，免得两首打架 */
        if (!stillPlaying && cgMusic && item.bgm !== undefined && item.bgm !== null &&
            root.VN.bgm && root.VN.bgm.play) {
          try { root.VN.bgm.play(item.bgm); } catch (e1) {}
        }
        next();
      });
    }

    /* 手稿照片步骤：逐张「渐黑 → 显现 → 渐黑」，全部放完淡出黑场再继续本句 */
    function photosStep(next) {
      root.VN.photos.play(item.photos, next);
    }

    /* 选项步骤：只负责把选项浮出来；点选后由 jumpToLabel 接管，所以这里不调 next() */
    function choicesStep() { showChoices(item.choices); }
    /* 问卷步骤：把本句的 ask 交给 showSurvey（问卷句一般还带 label，分支末尾 jump 回来重开） */
    function surveyStep() { showSurvey(item.ask); }
    /* 结局步骤：复用章节卡播「坏结局 · 名称」，播完按时自动回主菜单（走本句的 goto） */
    function endingStep(next) {
      root.VN.scene.playChapterIntro(String(item.ending), function () {
        next();
        if (exitUrl) root.setTimeout(function () { if (exitUrl) beginExit(); }, 1100);
      });
    }


    /* CG + 同句切景 的步骤：**先演 CG，等 CG 真的浮到画面上之后，再在它背后静默换景**。
       旧写法是「先切景（带黑场转场）→ 再浮出 CG」，于是新背景会先露一下再被 CG 盖住（闪现 bug）。
       这里用 VN.cg.current() 轮询确认 CG 已显示：此时整屏被 CG 遮住，静默换景玩家看不到。 */
    function cgThenSilentBgStep(next) {
      var swapped = false;
      function swapBgNow() {
        if (swapped) return;
        swapped = true;
        try { root.VN.scene.setBg(item.bg); } catch (eB) {}
      }
      var poll = root.setInterval(function () {
        if (root.VN && root.VN.cg && root.VN.cg.current && root.VN.cg.current()) {
          root.clearInterval(poll);
          swapBgNow();
        }
      }, 60);
      root.VN.cg.apply(item.cg, function (stillPlaying) {
        root.clearInterval(poll);
        swapBgNow();                       /* 兜底：图片极快 / 视频极短时，至少在这一刻换好 */
        if (!stillPlaying && cgMusic && item.bgm !== undefined && item.bgm !== null &&
            root.VN.bgm && root.VN.bgm.play) {
          try { root.VN.bgm.play(item.bgm); } catch (e2) {}
        }
        next();
      });
    }

    var steps = [];
    if (wantCard) {
      /* 章节句：先立即藏起对话框 → [照片] → [CG] → 标题卡（黑定那刻静默换本句 bg）→ 显示对话框 → 打字 */
      hideDialogNow();
      if (wantPhotos) steps.push(photosStep);
      if (wantCg) steps.push(cgStep);
      var silentBgRef = (item.bg !== undefined && item.bg !== null && hasScene) ? item.bg : null;
      steps.push(function (next) {
        /* chainCards：标题卡演完不揭幕，留在黑场里直接接下一张卡（见上面的 chainCards） */
        root.VN.scene.playChapterIntro(String(item.chapter), next, silentBgRef,
          { keepBlack: chainCards });
      });
    } else {
      if (hideForPerformance) hideDialogNow();       /* 演出句：演出期间不显示空对话框 */
      if (wantEnding) steps.push(endingStep);
      if (wantChoices) steps.push(choicesStep);
      if (wantSurvey) steps.push(surveyStep);
      if (wantPhotos) steps.push(photosStep);
      if (wantCg && wantBg && hasScene) {
        steps.push(cgThenSilentBgStep);              /* 同句既有 CG 又有切景：CG 先上，背景静默换 ✓ */
      } else {
        if (wantBg) steps.push(function (next) { root.VN.scene.apply(item.bg, next); });
        if (wantCg) steps.push(cgStep);
      }
    }

    if (!steps.length) {
      /* 没有演出步骤：成就也照常弹，然后直接打字（首屏遮幕也在这一刻揭掉） */
      liftBootCurtain('第一句无演出步骤');
      if (item.achieve !== undefined && item.achieve !== null && item.achieve !== '' &&
          root.VN.achieve && typeof root.VN.achieve.unlock === 'function') {
        try { root.VN.achieve.unlock(String(item.achieve)); } catch (eA0) {}
      }
      /* 地图锚点（无演出步骤的句子走这条分支）：同样强制弹出进点击门并压住打字 */
      if (item.mapZone !== undefined && item.mapZone !== null &&
          root.VN.map && typeof root.VN.map.unlock === 'function') {
        try { root.VN.map.unlock(Number(item.mapZone)); } catch (eMap0) {}
      }
      if (root.VN.map && typeof root.VN.map.isHolding === 'function' && root.VN.map.isHolding()) {
        try { root.VN.map.afterClose(function () { beginTyping(); }); } catch (eMap1) {}
      } else {
        beginTyping();
      }
      return;
    }

    state = SWITCHING;                             /* 演出期间锁住点击/空格推进 */
    (function runStep(i) {
      if (myWait !== switchWait) return;           /* 已切到别的句子：作废 */
      if (i >= steps.length) {
        startTypingAfterShow();
        return;
      }
      steps[i](function () { runStep(i + 1); });
    })(0);
  }

  /* ---------------- 段推进 ---------------- */
  /* 台词项标准化 */
  function toItem(x) {
    if (!x) return null;
    if (typeof x === 'string') return { text: x };
    if (typeof x !== 'object' || !('text' in x)) return null;
    var o = {};
    for (var k in x) {
      if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k];
    }
    return o;
  }

  function nextItem() {
    var it;
    if (queue.length) {
      it = queue.shift();
    } else if (storyLines !== null && storyCursor < storyLines.length) {
      it = storyLines[storyCursor++];      /* 线性剧情源（存档系统依赖此游标） */
    } else if (typeof needNext === 'function') {
      it = needNext();
    } else {
      return null;
    }
    return toItem(it);
  }

  function goNext() {
    var it = nextItem();
    if (!it) {
      state = IDLE;
      currentItem = null;
      fire('queueEnd');
      return;
    }
    startLine(it);
  }

  /* ---------------- 带 goto 的句子：读完点击后渐黑跳页 ---------------- */
  function beginExit() {
    if (exitBusy) return;
    var url = exitUrl;
    if (!url) return;                      /* 无跳转目标 */
    exitBusy = true;
    exitUrl = null;
    clearTimer();
    clearHold();
    clearAuto();
    holdOn = false;
    state = IDLE;                          /* 转场期间锁住点击/空格推进 */

    /* 离开剧情有两种情形，处理方式**必须分开**：
       ① 小游戏/外链入口句（goto endless_run.html 等）——玩家还会回到剧情，
          所以：把游标推过本句再存档（“继续游戏”不会又掉进小游戏），
          并写下「小游戏返回点」＝本句的下一句。
       ② 回主菜单/结局的退出句（goto:'hall.html'，或带 ending 的坏结局）——剧情到此结束，
          **绝不能**把游标推向下一句：坏结局分支的下一句往往已经是别的分支或
          下一章（如 #511 过早的剥离 → #512 第五章章节句），推过去就会让
          玩家回主菜单后「继续游戏」直接跳过坏结局进入后续剧情。
          · 坏结局（有 ending 字段）：自动存档退到最近的选择点，方便玩家回去改选；
          · 普通结局卡（只有 chapter + goto:'hall.html'，如「达成结局：夏日启示录」）：
            没有"改选"这回事，就停在**本句**，别把玩家丢回中段的选择。 */
    var isBadEnding = !!(currentItem && currentItem.ending);
    var exitToMenu = /(^|[\\/])hall\.html([?#]|$)/i.test(String(url)) || isBadEnding;
    if (exitToMenu) {
      /* 坏结局：统一退到「做这次选择之前」那一句。
         ① 本次会话里做过选择 → lastBranchIdx；
         ② 中途退出/读档回来（本次会话还没做过选择）→ 从持久化的选择点里校验着取回；
         ③ 还没有（老存档 / 记录丢失）→ 由结局句反推本段路线的分岔点；
         ④ 都推不出来 → 只能退到本句，至少不会跳过结局。
         普通结局卡（chapter + goto:'hall.html'）没有"改选"这回事，仍然停在**本句**。 */
      var branchIdx = -1;
      if (isBadEnding) {
        if (lastBranchIdx >= 0 && lastBranchIdx < storyCursor) branchIdx = lastBranchIdx;
        if (branchIdx < 0) branchIdx = restoreBranch(storyCursor - 1);
        if (branchIdx < 0) branchIdx = deriveBranchBefore(storyCursor - 1);
        if (branchIdx >= 0) lastBranchIdx = branchIdx;
      }
      var backIdx = (isBadEnding && branchIdx >= 0) ? branchIdx : (storyCursor - 1);
      storyCursor = backIdx + 1;             /* getProgress() 取 storyCursor-1 → 正好是 backIdx */
      try {
        if (root.VN && root.VN.save && typeof root.VN.save.autosave === 'function') {
          root.VN.save.autosave();
        }
        if (root.console) {
          root.console.info('[VN · text] 结局/回主菜单：自动存档退回第 ' + backIdx + ' 句' +
            (backIdx === lastBranchIdx && isBadEnding ? '（最近的选择点，便于改选）' : '（本句）') +
            '；不写小游戏返回点。');
        }
      } catch (errE) {
        if (root.console) root.console.warn('[VN · text] 退出前自动存档失败：' + errE);
      }
      /* 屏幕渐黑完成后自动跳转目标页 */
      if (root.VN && root.VN.scene && root.VN.scene.fadeToBlack) {
        root.VN.scene.fadeToBlack(function () { redirectPage(url); });
      } else {
        redirectPage(url);
      }
      return;
    }

    /* —— 以下是小游戏/外链入口句的处理 —— */
    /* 本句（带 goto 的入口句）的「下一句」＝ 小游戏结束后要回到的那一句。
       nextItem() 取出本句时已经做过一次 storyCursor++（见 nextItem），
       所以此刻 storyCursor 就已经指向它 —— 先存下来，别被下面那次 ++ 带走。 */
    var nextIdx = storyCursor;

    /* 收尾：把剧情游标再推一格并立即自动存档，使“继续游戏”下次从下一句
       （即下一章开头）开始，而不是永远停在本句反复进入小游戏。
       注意这次 ++ 只服务于紧跟其后的 autosave（getProgress() 取 storyCursor-1），
       返回点用的是上面存好的 nextIdx —— 少了它就会**多跳一句**：
       Chapter 2 的章节句（自带 CG1）就是这样被跳过，从推理页回来时
       CG1 改由 cgplay 过场页播，章节标题卡与那句台词全被吞掉。 */
    if (storyLines !== null && storyLines.length && storyCursor < storyLines.length) {
      storyCursor++;
      try {
        if (root.VN && root.VN.save && typeof root.VN.save.autosave === 'function') {
          root.VN.save.autosave();
        }
      } catch (err) {
        if (root.console) root.console.warn('[VN · text] 跳转前自动存档失败：' + err);
      }
    }

    /* 写入「小游戏返回点」：记录本句的下一句，小游戏（endless_run.html 等）
       结束后据此回到原对话的后一句继续播放，而不是回到首页或原地不动。
       键名 vn_minigame_return 与 endless_run.js 中的 RETURN_KEYS 保持一致。
       返回点必须落在**下一句本身**：若落在本句（goto 句）会反复进入小游戏，
       若再多跳一句（旧写法直接用 storyCursor）就会吞掉下一句的演出与台词。
       bgKey 则复用 getProgress() 回溯出的最近切景背景，保证跳回后有画面。 */
    try {
      var prog = (root.VN && root.VN.text && typeof root.VN.text.getProgress === 'function')
        ? root.VN.text.getProgress() : null;
      var back = {
        kind: 'auto',
        time: Date.now(),
        index: nextIdx,                     /* 本句的下一句（真正的返回点） */
        item: (storyLines && nextIdx >= 0 && nextIdx < storyLines.length)
          ? storyLines[nextIdx]
          : { speaker: '', text: '', portrait: '' },
        bgKey: (prog && prog.bgKey) || null,
        chapter: (prog && prog.chapter) || ''
      };
      root.localStorage.setItem('vn_minigame_return', JSON.stringify(back));
    } catch (err2) {
      if (root.console) root.console.warn('[VN · text] 写入小游戏返回点失败：' + err2);
    }

    /* 屏幕渐黑完成后自动跳转目标页 */
    if (root.VN && root.VN.scene && root.VN.scene.fadeToBlack) {
      root.VN.scene.fadeToBlack(function () { redirectPage(url); });
    } else {
      redirectPage(url);
    }
  }

  function redirectPage(url) {
    try { root.location.href = url; }
    catch (err) {
      if (root.console) root.console.error('[VN · text] 页面跳转失败：' + err);
    }
  }

  function enqueue(list) {
    if (!list) return;
    var arr = [].concat(list);
    for (var i = 0; i < arr.length; i++) {
      var o = toItem(arr[i]);
      if (o) queue.push(o);
    }
    if (state === IDLE) goNext();    /* 空闲时排入队列会自动开播 */
  }

  /* ---------------- 交互：单击 / 空格 / 长按空格 ---------------- */
  function advanceFromWait() {
    clearAuto();                       /* 手动推进：取消待触发的自动推进 */
    /* 本句带 jump：在**剧情内部**跳到某个 label（分支汇合用，不跳页、不写返回点） */
    if (currentItem && currentItem.jump) { jumpToLabel(currentItem.jump); return; }
    if (exitUrl) { beginExit(); return; }  /* 本句带跳转：读完点击 → 渐黑跳页 */
    goNext();
  }

  function activate() {
    if (!enabled || document.hidden) return;
    if (exitBusy) return;
    if (state === TYPING) revealAll();     /* 打字中 → 跳出整段 */
    else if (state === WAITING) advanceFromWait(); /* 已显示 → 下一句 / 跳页 */
  }

  function isInteractiveTarget(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(
      'button, a, input, textarea, select, [contenteditable="true"], .vn-btn, [data-vn-no-advance]'
    );
  }

  function onDocClick(e) {
    if (!enabled) return;
    if (e.button !== 0) return;          /* 仅鼠标左键 */
    if (isInteractiveTarget(e.target)) return; /* 按钮/输入框等交给它们自己 */
    activate();
  }

  function onKeyDown(e) {
    if (!enabled) return;
    if (e.code !== 'Space' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (isInteractiveTarget(e.target)) return; /* 焦点在按钮上时不劫持空格 */
    e.preventDefault();
    if (e.repeat) return;                /* 长按连跳由 holdTimer 控制节奏 */
    activate();
    if (!holdOn) {
      holdOn = true;
      holdTimer = setInterval(holdTick, HOLD_GAP);
    }
  }

  function onKeyUp(e) {
    if (e.code !== 'Space' && e.key !== ' ' && e.key !== 'Spacebar') return;
    holdOn = false;
    clearHold();
  }

  function holdTick() {
    if (!holdOn) { clearHold(); return; }
    if (exitBusy) return;
    if (state === TYPING) revealAll();
    else if (state === WAITING) advanceFromWait();
  }

  document.addEventListener('click', onDocClick, false);
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);

  /* ---------------- 对外接口（VN.text） ---------------- */
  var api = {
    /* 直接播放一句 */
    play: function (item) {
      var o = toItem(item);
      if (o) startLine(o);
      return api;
    },

    /* 排入多句（空闲时自动开播） */
    queue: function (list) { enqueue(list); return api; },

    /* 手动推进（同单击 / 空格） */
    advance: function () { activate(); return api; },

    /* 立即补全当前段 */
    complete: function () { if (state === TYPING) revealAll(); return api; },

    /* 登记 / 修改立绘键 */
    addPortrait: function (key, path) {
      if (key) portraitLib[key] = (path === undefined) ? '' : String(path);
      return api;
    },

    /* 查询立绘键对应的图片路径 */
    getPortraitPath: function (key) { return resolvePortrait(key); },

    /* 控制台演示 */
    demoPortraits: function () {
      var lines = [
        { speaker: '？？？', text: '立绘切换演示（一）：端坐的黑猫。', portrait: '黑猫·端坐' },
        { speaker: '？？？', text: '立绘切换演示（二）：它抬起头，望向月亮。', portrait: '黑猫·仰望' },
        { speaker: '', text: '立绘切换演示（完）：现在收起立绘。', portrait: 'hide' }
      ];
      enqueue(lines);
      return api;
    },

    /* 停止播放 */
    stop: function () {
      clearTimer();
      clearHold();
      holdOn = false;
      switchWait++;                /* 作废进行中的断点式切景等待 */
      exitUrl = null;              /* 作废待跳转 */
      exitBusy = false;
      state = IDLE;
      currentItem = null;
      return api;
    },

    /* 清空：停播并清空文字 */
    clear: function () {
      clearTimer();
      switchWait++;                /* 作废进行中的断点式切景等待 */
      exitUrl = null;              /* 作废待跳转 */
      exitBusy = false;
      queue.length = 0;
      currentItem = null;
      fullText = '';
      shown = 0;
      state = IDLE;
      textBodyEl.textContent = '';
      setSpeaker('');
      return api;
    },

    /* 打字速度：每字毫秒数 */
    setSpeed: function (ms) { speed = Math.max(0, +ms || 0); return api; },
    getSpeed: function () { return speed; },

    /* 自动播放：开关 / 查询 / 调整每句停留时长（毫秒） */
    setAuto: function (on) {
      autoPlay = !!on;
      if (!autoPlay) clearAuto();                     /* 关掉时取消已排队的自动前进 */
      else if (state === WAITING) {                   /* 当前句已读完 → 立即安排下一次 */
        clearAuto();
        autoTimer = setTimeout(function () { autoTimer = null; advanceFromWait(); }, autoPlayDelay);
      }
      return api;
    },
    isAuto: function () { return autoPlay; },
    toggleAuto: function () { return api.setAuto(!autoPlay); },
    setAutoDelay: function (ms) {
      var v = parseInt(ms, 10);
      if (isFinite(v) && v >= 200) autoPlayDelay = v;
      return autoPlayDelay;
    },
    getAutoDelay: function () { return autoPlayDelay; },

    /* 注册“取下一句”回调 */
    setSource: function (fn) {
      needNext = (typeof fn === 'function') ? fn : null;
      return api;
    },

    /* 事件：on('lineStart', fn) / on('lineEnd', fn) / on('queueEnd', fn) */
    on: function (name, fn) {
      if (typeof fn === 'function') callbacks[name] = fn;
      return api;
    },

    /* 启用 / 禁用输入推进 */
    setEnabled: function (v) {
      enabled = !!v;
      if (!enabled) { holdOn = false; clearHold(); }
      return api;
    },
    isEnabled: function () { return enabled; },

    /* 状态查询 */
    isTyping: function () { return state === TYPING; },
    isWaiting: function () { return state === WAITING; },
    isSwitching: function () { return state === SWITCHING; },
    isIdle: function () { return state === IDLE; },
    getState: function () { return state; },

    /* ---------------- 线性剧情与存档支持 ---------------- */

    /* 从头开始新游戏（等价于 resumeStory(0)） */
    startStory: function () { return api.resumeStory(0, null); },

    /* 从第 idx 句继续：清空当前播放并重开剧情，此后逐句正常推进
       bgKey / cgKey：存档里记录的「最近一次切景 / 最近一次 CG」，用于恢复画面 */
    resumeStory: function (idx, bgKey, cgKey) {
      clearTimer();
      clearHold();
      clearAuto();
      holdOn = false;
      switchWait++;                       /* 作废正在进行的切景/打字回调 */
      exitUrl = null;                     /* 作废待跳转 */
      exitBusy = false;
      autoAdvance = false;
      queue.length = 0;
      currentItem = null;
      fullText = '';
      shown = 0;
      /* 读档/换段时把可能还浮着的选项层收掉：
         否则在选项句上读档（游戏内菜单 → 读取存档）会留下旧的选项覆盖层，
         它会一直盖在剧情上面、甚至带着旧分支的 label。 */
      if (typeof closeChoices === 'function') closeChoices();
      storyLines = DEMO_LINES;            /* 进入线性剧情模式 */
      var n = storyLines ? storyLines.length : 0;
      var i = Math.max(0, Math.min(n, (+idx) || 0));
      /* 注意：这里**不再自动跳过带 goto 的小游戏入口句**。
         自动存档就是「玩家此刻所在的句子」，从小游戏退出后读自动档应当回到那一句
         （重读后再点一次即可重新进入小游戏），而不是被悄悄推过一句、
         直接跳到小游戏之后的剧情（那样会整段跳过小游戏）。
         死循环由「返回点」机制本身保证不会发生：跳进小游戏前写入的
         vn_minigame_return 永远是入口句的**下一句**。 */
      storyCursor = i;                    /* 下一句将从 story[i] 开始 */
      /* 恢复「最近的选择点」：这样即使本次会话还没做过任何选择
         （中途退出后「继续游戏」直接落在分支深处），之后的坏结局
         仍然能退回「做选择之前」，而不会卡在结局里反复重播。 */
      lastBranchIdx = restoreBranch(i);
      if (storyCursor >= n) {             /* 已到结尾：停止 */
        state = IDLE;
        liftBootCurtain('续玩点已在结尾，无可播句子');
        fire('queueEnd');
        return api;
      }
      if (bgKey && root.VN && root.VN.scene && root.VN.scene.apply) {
        try { root.VN.scene.apply(bgKey); }
        catch (err) { warn('续玩时背景切换失败：' + err); }
      }
      /* 恢复 CG：cgKey 为 null 表示读档时画面上没有 CG，什么都别放。
         视频 CG 是一次性演出，只有「读档点正好就是这条 CG 句」时才恢复
         （旧存档可能残留已播完的 CG 键，这里靠这条校验拦掉，不会再重播）。 */
      if (cgKey !== undefined && cgKey !== null && cgKey !== '' &&
          root.VN && root.VN.cg && root.VN.cg.apply) {
        var cgOk = true;
        try {
          var cgInfo = (typeof root.VN.cg.resolve === 'function') ? root.VN.cg.resolve(cgKey) : null;
          if (cgInfo && typeof cgInfo === 'object' && cgInfo.video) {
            var atLine = (storyLines[i] || {}).cg;
            cgOk = (atLine === cgKey);
          }
        } catch (eCgChk) { cgOk = true; }
        if (cgOk) {
          try { root.VN.cg.apply(cgKey); }
          catch (err2) { warn('续玩时 CG 恢复失败：' + err2); }
        } else {
          if (root.console) root.console.info('[VN] 读档点不在该视频 CG 句上，跳过 CG 恢复：' + cgKey);
        }
      }
      /* 恢复音乐：音乐是「持续状态」，但从小游戏/存档回来是**新页面**，
         若读档点那句自己没写 bgm，就会一直静音（rpg2 返回后的那段就是这种情况）。
         这里回溯最近的 bgm 键并播放；本句若自带 bgm，稍后 startLine 会覆盖它。 */
      surveyReset();                       /* 新一局：问卷的"已问过"状态清零 */
      if (root.VN && root.VN.bgm && root.VN.bgm.play) {
        var bgmBack = null;
        for (var bb = i; bb >= 0; bb--) {
          var itb = storyLines[bb];
          if (itb && itb.bgm !== undefined && itb.bgm !== null && itb.bgm !== '') { bgmBack = itb.bgm; break; }
        }
        if (bgmBack) {
          try {
            root.VN.bgm.play(bgmBack);
            if (root.console) root.console.info('[VN] 续玩时接回音乐：' + bgmBack);
          } catch (errB) { warn('续玩时音乐接回失败：' + errB); }
        }
      }
      /* 地图跟剧走：续玩点之前出现过的 mapZone 锚点决定当前区域；
         一个锚点都没有（还在 CG0 之前）则保持未解锁（-1）。
         静默同步、不弹窗——之后剧情再经过锚点/CG0 时才会强制弹出。 */
      if (root.VN && root.VN.map && typeof root.VN.map.syncZone === 'function') {
        var mzZ = -1;
        for (var mzI = 0; mzI < i && mzI < storyLines.length; mzI++) {
          var mzIt = storyLines[mzI];
          if (mzIt && mzIt.mapZone !== undefined && mzIt.mapZone !== null) {
            var mzV = Number(mzIt.mapZone);
            if (isFinite(mzV) && mzV > mzZ) mzZ = mzV;
          }
        }
        try { root.VN.map.syncZone(mzZ); } catch (eMz) {}
      }
      state = IDLE;
      goNext();
      return api;
    },

    /* 当前进度快照（存档用）。返回：
       { index, item:{speaker,text,portrait}, bgKey, cgKey, chapter }；非剧情模式返回 null */
    getProgress: function () {
      if (storyLines !== DEMO_LINES || !DEMO_LINES.length) return null;
      var last = DEMO_LINES.length - 1;
      var idx = storyCursor - 1;          /* 当前正在显示的句子索引 */
      if (idx < 0) idx = 0;
      if (idx > last) idx = last;
      var it = DEMO_LINES[idx] || {};
      var bgKey = null;                   /* 最近一次切景的背景键（背景是持续状态，回溯取即可） */
      for (var b = idx; b >= 0; b--) {
        if (DEMO_LINES[b] && DEMO_LINES[b].bg !== undefined && DEMO_LINES[b].bg !== null) {
          bgKey = DEMO_LINES[b].bg;
          break;
        }
      }
      /* CG 是「一次性演出」：视频 CG 播完会自动收起、图片 CG 也可能被 cg:'' 收掉，
         所以不能回溯历史字段（否则在普通对话处存档，读档会重播早已放完的 CG）。
         这里以 CG 层的实时状态为准：此刻真的显示着哪支 CG 就存哪支，没显示就存 null。 */
      var cgKey = null;
      if (root.VN && root.VN.cg && typeof root.VN.cg.current === 'function') {
        try { cgKey = root.VN.cg.current(); } catch (eCgNow) { cgKey = null; }
        if (cgKey === undefined) cgKey = null;
      }
      return {
        index: idx,
        item: {
          speaker: it.speaker === undefined || it.speaker === null ? '' : String(it.speaker),
          text: String(it.text === undefined || it.text === null ? '' : it.text),
          portrait: it.portrait === undefined || it.portrait === null ? '' : String(it.portrait)
        },
        bgKey: bgKey,
        cgKey: cgKey,
        chapter: chapterNameAt(idx)
      };
    }
  };

  root[NS].text = api;

  /* ---------------- 内置台词（整理自《黑猫小夜曲台本.docx》，标注即立绘键，无标注为 ''） ---------------- */
  var DEMO_LINES = [
    /* 开篇改编声明：用「章节卡」的呈现形式（整屏渐黑 → 文字渐显渐隐 → 渐显画面）。
       这里不带 bg / cg，画面保持黑幕，紧接着就是 Chapter 0 的章节卡。 */
    { chapter: '本作改编自知念实希人同名小说', speaker: '', text: '', portrait: '', bgm: '黑猫的夜曲_变奏'},
    /*chapter 0*/
    // 【制作说明】场景切换时间隔2s,章节切换时间隔5s
    // 【chapter】===== Chapter 0 亲临人间的死神 =====
    // 【场景】【场景I 黑幕】
    { chapter: 'Chapter 0 亲临人间的死神', speaker: '？？？', text: '在故事开始时，讲述者往往会mention自己的姓名。', portrait: '', bgm: '黑猫的夜曲_变奏'},
    { speaker: '？？？', text: '我虽然内心竭力想向诸位介绍我的称呼，然而可惜，这是无法做到的——', portrait: ''},
    { speaker: '？？？', text: '因为我是无比honorable的死神。', portrait: ''},
    { speaker: '？？？', text: '由于我们行事的神秘性与存在的稀有性，高贵的我们自然不被那些人类所知。', portrait: ''},
    { speaker: '？？？', text: '我们之间会用“言灵”作为交流媒介，而人类，想读出我们的名字时只能吐出几句含糊不清的字节。', portrait: ''},
    { speaker: '？？？', text: '每一位死神都会世界上某一特定区域人类的死亡。与许多人类的固有认知不同，人类死亡后他们的灵魂会与肉体分离。', portrait: ''},
    { speaker: '？？？', text: '我们的任务便是把灵魂带到boss那里；如果灵魂离体时间过长变为了地缚灵，那免不了要遭boss一顿责骂和同事的幸灾乐祸了~', portrait: ''},
    { speaker: '？？？', text: '我嘛，从死神训练课程到今天，都是相当excellent，相当outstanding，相当incredible的存在……', portrait: ''},
    /*CG0*/
    /*场景II*/
    // 【场景】【场景II 镜头怼着黑猫正面 后面天空中有一只乌鸦】
    // 【成就】【成就：虎落平阳】
    { speaker: '？？？', text: '让各位看到这么狼狈的场景，都是我们boss的worst idea……', portrait: 'cat_sigh', cg: 'CG0', achieve: 'huluo',bg:'scene_2'},
    { speaker: 'Boss', text: '“说到奇怪的灵魂……最近你那里好像有不少一样的人类哦。” ', portrait: ''},
    { speaker: '？？？', text: '“人类怎么想又和我们有什么关系……”我撇了撇嘴，“工作而已嘛，他们压力又变大了？”', portrait: 'cat_confident'},
    { speaker: 'Boss', text: '“这样的思想很危险哦。”祂又露出了招牌的神秘笑容，一股不详的预感从我心中升起。“不如去下面实地看看，说不定会有不一样的感受哦？”', portrait: ''},
    { speaker: '？？？', text: '“那我的工作……”', portrait: 'cat_shocked'},
    { speaker: 'Boss', text: '“放心吧，会有死神帮你完成的！”不知不觉间我的笑容全部转移到了祂的脸上。', portrait: ''},
    { speaker: '？？？', text: '我尝试用这具新的躯体腾挪反转逃过乌鸦的俯冲。但很不幸，它也很笨重，我先顺拐了两三下，再重重地摔在了地上。', portrait: 'cat_ponder'},
    { speaker: '？？？', text: 'Damn.', portrait: 'cat_speechless'},
    { speaker: '？？？', text: '一万种绝望的声音在我脑中爆发，直到我听到一个声音——', portrait: 'cat_speechless'},
    { speaker: '未知的女声', text: '“小黑猫，小黑猫，这里！”', portrait: ''},
    { speaker: '？？？', text: '前方几米处竟然有一个栅栏门，我来不及管后面是什么，一头扎了进去。', portrait: 'cat_confident'},
    // 【场景】【场景III 镜头依旧怼着猫 可以是背后或者侧面 远处空中有灵魂 可仿制灵魂那种可爱的布罩就行 注意颜色】
    { speaker: '？？？', text: '这是一处人家的yard。', portrait: 'cat_alert', bgm: '潜行探戈', bg: 'scene_3'},
    { speaker: '未知的女声', text: '刚才的女声又怯生生地响了起来：“你还好吗？”', portrait: ''},
    { speaker: '？？？', text: '我欣赏着自己的毛发，没想到摸爬滚打了半天它们竟然还如此顺滑。', portrait: 'cat_confident'},
    { speaker: '？？？', text: '“谢谢你啊……”差点脱口而出下一句，我是猫，猫怎么在说人话？', portrait: 'cat_shocked'},
    { speaker: '？？？', text: '意识到自己犯了大错的我赶忙抬起头来，灵魂？', portrait: 'cat_shocked'},
    { speaker: '？？？', text: '怎么是灵魂？我突然意识到，刚才听到的好像确实不是“话”而是“言灵”。', portrait: 'cat_ponder'},
    { speaker: '未知的灵魂', text: '“看到刚才你的动作，我觉得你不是普通的猫咪”，灵魂说。“你能看得见我吗？”', portrait: 'lh'},
    { speaker: '？？？', text: '我操纵言灵，问道：“你是谁？这个样子多久了？”', portrait: 'cat_ponder'},
    { speaker: '未知的灵魂', text: '“我这样子已经两个多月了，但我总是记得自己有事情没有完成……”', portrait: 'lh'},
    { speaker: '？？？', text: '的确，它的躯体已经不像刚刚产生的灵魂那般白净剔透，而是带着焦黑的斑点，这是长时间未被死神带走的灵魂的特征。', portrait: 'cat_ponder'},
    { speaker: '？？？', text: '如果有强烈的心愿没有完成，灵魂会一直盘踞在原地不愿离开，但我之前怎么没注意到这个灵魂的存在呢？', portrait: 'cat_ponder'},
    { speaker: '未知的灵魂', text: '“这栋住户二楼的女生我已经观察她很久了。”', portrait: 'lh'},
    { speaker: '？？？', text: '在她的带领下，我小心翼翼地跳上窗台，屋内有位年轻白净的女生正躺在床上——不过最引人注目的还是她身上插着的大大小小的管子与满地的仪器，看来她这样的生活已经持续很久了。', portrait: 'cat_confident'},
    { speaker: '未知的灵魂', text: '“我真的记不起来我是谁了……但我记得我必须要搞明白我死之前发生了什么。”', portrait: 'lh'},
    { speaker: '？？？', text: '似乎有恳求的目光。但我知道不行。将灵魂强行并入身体是非常高级的法术，更不要提伦理道德上的不可取了。', portrait: 'cat_ponder'},
    { speaker: '未知的灵魂', text: '“我可以为你提供住所与食物，你也可以全面帮助我的调查……”恳求的目光似乎越发强烈了。“虽然我也不知道你是谁，但我相信你的能力一定会做到。”', portrait: 'lh'},
    { speaker: '？？？', text: '年轻人真是聪明啊，我叹了口气。我倒是对猫粮、逗猫棒、不被乌鸦追赶这些东西不感兴趣。但奇怪的灵魂，这是不是一个入手点呢？', portrait: 'cat_sigh'},
    { speaker: '', text: '……', portrait: ''},
    { speaker: '？？？', text: '“这种法术非常危险，如果失败了我概不负责。”我最后咳了一声。', portrait: 'cat_speechless'},
    { speaker: '未知的灵魂', text: '她没有犹豫就答应了我的话。“谢谢了！”', portrait: 'lh'},
    // 【场景】【场景IV 麻矢在床上半坐着 猫在窗台上】
    { speaker: '？？？', text: '怎么让她“复活”的场景我便不再赘叙了，满头大汗的回忆我可不想变为第二次的现实。', portrait: 'cat_speechless', bgm: '潜行探戈', bg: 'scene_4'},
    { speaker: '？？？', text: '看着床上的女性徐徐revive，我松了一口气。看来她的外伤基本已经痊愈，只是灵魂出窍导致的不省人事。', portrait: 'cat_confident'},
    { speaker: '？？？', text: '她用胳膊支撑着半坐起来，嗯，没有问题。', portrait: 'cat_confident'},
    { speaker: '麻矢', text: '“根据房里的物品，现在的‘我’应该叫白木麻矢。”她微笑着说。“你叫什么名字啊？”', portrait: 'ms_smile'},
    { speaker: '麻矢', text: '“不如就叫你小黑吧！”她雀跃着说着，打断了我的思考。', portrait: 'ms_happy'},
    { speaker: '小黑', text: '“这种idea真是太愚蠢了。”我下了结论。我可不想被人小黑小黑的称呼！', portrait: 'cat_speechless'},
    { speaker: '麻矢', text: '“为什么你说话总是夹杂英文呢？”', portrait: 'ms_happy'},
    { speaker: '小黑', text: '没想到话题这样就被岔开了，怎么这么帅气的habit介绍起来却有些令人尴尬……我想赶紧另起炉灶，我来人世间可是为了工作,不如趁机向她介绍一下我的能力。', portrait: 'cat_speechless'},
    { speaker: '小黑', text: '“……所以我想进入别人的记忆就可以进入，对了解为什么有的灵魂不想离开人世很有帮助呢。”', portrait: 'cat_proud'},
    { speaker: '小黑', text: '“小黑，那你‘看过了’我的记忆吗？”她浅笑着问。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '其实刚才出于谨慎我只是扫了一眼她的记忆。我并没看到任何有用或令人怀疑的东西，总而言之她应该还是值得信任的。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '我刚想操纵言灵作答，一声大叫传来。', portrait: 'cat_shocked'},
    { speaker: '麻矢的母亲', text: '“啊！”', portrait: ''},
    { speaker: '我', text: '门口处，一名老妇人手中的水盆应声掉落，不过她的视线从未离开床上的女性。', portrait: ''},
    { speaker: '麻矢的母亲', text: '“太好了……麻矢，你终于醒了！”', portrait: ''},
    // 【chapter】===== Chapter 1 樱花时节的遗书 =====
    // 【场景】【场景V 依旧是白木麻矢家，不过多了一些生活气息，比如被子的折叠，小黑的猫盆等等】
    { chapter: 'Chapter 1 樱花时节的遗书', speaker: '小黑', text: '我在屋顶上漫步而行，在接近窗户的时候一跃而起，从敞开的窗户跳进房间。', portrait: 'cat_confident', bgm: '曙光良镇', bg: 'scene_5'},
    { speaker: '小黑', text: '从窗台跳至地板上，肉球和柔软的地毯吸收了我的冲击。我的脖子一带传出琳琅声响，大概是我的项圈发出的声响。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '和穿着睡衣的麻矢打过招呼后，我便跑到她给我准备的食盆旁大快朵颐，你说猫粮这东西时谁发明的呢（嚼嚼嚼），真的还怪好吃的，以前没品尝过真是死神生憾事。', portrait: 'cat_proud'},
    { speaker: '小黑', text: '我简单梳理了一下这几天发生的事情：我每天早上都在镇上散步，基本熟悉了这座小镇的风土人情。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '我作为黑猫彻底成为了白木家的宠物，驾轻就熟地学会了奔跑、跳跃、刺挠什么猫的生活。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '虽然被麻矢挠痒痒时很丢人，但确实也挺舒服的哎（）', portrait: 'cat_proud'},
    { speaker: '小黑', text: '麻矢的复建也在有条不紊的进行，虽然我们都很有负罪感，但还是对麻矢的父母假装成因为事故而记忆一片混乱。期待真的白木麻矢早日苏醒吧。', portrait: 'cat_ponder'},
    { speaker: '麻矢', text: '“别忘了今天是我们第一天组合调查的日子哦。”她瞥了我一眼，“后面我可能还要顶替白木小姐去上班呢。”', portrait: 'ms_3'},
    { speaker: '小黑', text: '“你能当银行职员吗……还有我朝你说的方向走了好久都没到你说的地方……”', portrait: 'cat_sigh'},
    { speaker: '麻矢', text: '“因为那座宅子已经在镇子之外了。”她叹了口气。“现在就出发吧！”', portrait: 'ms_smile', mapZone: 1},
    // 【场景】【场景VI 桥。主体在桥上。这个场景后面会多次应用，注意应该有较宽阔的河，河两岸有一定面积杂草地，（可以只出现一边岸）按照设定一边是小镇，一边是杂草地杂草地外还有一两栋占地较大的小别墅有电线杆；但不同时期有细节上的不同。在本次场景中电线杆上应有较明显“变态抢劫频发，注意深夜安全！”字样的告示板】
    { speaker: '小黑', text: '“还没走到吗？”我操纵言灵问道。', portrait: 'cat_speechless', bg: 'scene_6'},
    { speaker: '麻矢', text: '“左边的房子就是。”可能因为刚刚复健的缘故，白木麻矢也是走一步喘三步。“我经常在那里看到轻飘飘游荡的地缚灵。”', portrait: 'ms_smile'},
    { speaker: '小黑', text: '我看着电线杆上的标志，“此处抢劫频发！晚上请勿独自行走！”抽了抽嘴角。', portrait: 'cat_speechless'},
    { speaker: '麻矢', text: '麻矢看出了我的意思，尴尬地笑了笑，“呃，小镇外的话治安确实……”', portrait: 'ms_3'},
    { speaker: '小黑', text: '“到时直接rush the soul。”', portrait: 'cat_ponder'},
    { speaker: '麻矢', text: '麻矢的嘴角抽了抽，“然后让我因为私闯民宅被逮捕归案吗？”', portrait: 'ms_3'},
    { speaker: '小黑', text: '倒也是。人类怎么总是这么麻烦呢？有了什么“地产证”，难道这块地就能归属他们了吗？', portrait: 'cat_speechless', mapZone: 2},
    // 【场景】【场景VII 宅子正门前面院落内部。房子就设计成现代别墅与上个场景照应即可。玻璃门窗是紧闭的。猫在空地上与一个灵魂对话】
    { speaker: '小黑', text: '告别麻矢后，我孤身一猫来到了这座精致雅观的繁茂庭院，我虽然不是人类，但还是能明显感受到这座院落设计之大方，樱花烂漫，甚至还有一座小小的水池。', portrait: 'cat_confident', bgm: '推理要在下班后', bg: 'scene_7'},
    { speaker: '小黑', text: '眼前出现了一团微弱黯淡的光。没错了。我抬起头，操纵言灵，问道：', portrait: 'cat_confident'},
    { speaker: '小黑', text: '“快前往吾主的跟前吧。徘徊流连在这种地方不过是Nonsense的行为。你的肉体已经死亡，无法再对这个世界产生任何影响了。一直留在这里你也会走向灭亡的。”', portrait: 'cat_ponder'},
    { speaker: '南乡纯太郎', text: '看来这个灵魂不是很擅长使用言灵，良久他才吐出两个字。', portrait: 'nxlh'},
    { speaker: '小黑', text: '“随……便……”', portrait: 'nxlh'},
    { speaker: '小黑', text: '随便什么啊……看着灵魂焦急旋转的模样，我知道这并非他本来的意思。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '这个灵魂看起来状态并不稳定，如果我直接干预他的灵魂，以他的受损程度，直接灰飞烟灭也不是没有可能。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '面面相觑后，灵魂突然主动轻飘飘地飞了起来，往屋内移动——', portrait: 'cat_alert'},
    { speaker: '小黑', text: '在檐廊深处的和室中有一个跪坐的老妇人。', portrait: 'nxfr'},
    { speaker: '小黑', text: '她弯着腰，眼神空洞地望向前面。她的嘴里念念有词，面前则是那个灵魂的佛龛。', portrait: 'nxfr'},
    { speaker: '小黑', text: '看来两人是夫妻关系。“百日夫妻似海深”，这位女人感到sorrow是非常正常的现象。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '我仔细辨别着她的话，“对不起……对不起……”', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '魂魄靠近那个女人，开始画圆似地在女人周围飘荡。', portrait: 'nxlh'},
    { speaker: '小黑', text: '原来如此，如果无法从灵魂的回忆入手，那就从生者的回忆开始吧。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '“喵呜！”我大声叫道，一边用前脚的肉球猛烈敲打玻璃门。', portrait: 'cat_confident'},
    { speaker: '南乡菊子', text: '坐在佛龛前的女人身体陡地一震，带着胆怯望向我这边，露出了僵硬的笑容。', portrait: 'nxfr'},
    { speaker: '南乡菊子', text: '“好可爱的小猫啊。是从哪里来的呢？”', portrait: 'nxfr'},
    { speaker: '小黑', text: '……就是现在！', portrait: 'cat_ponder', goto: 'endless_run.html?next=rpg1.html', achieve: 'sakura'},
    // 【rpg】【切入rpg游戏】
    // 【CG】插入 CG1】
    // 【chapter】===== Chapter 2 二重身的研究室 =====
    // 【场景】【场景V 复用场景】
    { chapter: 'Chapter 2 二重身的研究室', speaker: '小黑', text: '“所以说，事情就是这样。”我接受着麻矢温柔的抚摸，不自觉地发出哼哼唧唧的声音。', portrait: 'cat_proud', bgm: '曙光良镇', bg: 'scene_5', cg: 'CG1'},
    { speaker: '小黑', text: '距离上次南乡家的团聚已经过去了三天，虽然白木麻矢对“我把她晾在屋外几个小时”这件事表达了强烈的不满，但这件矛盾在我大快朵颐早餐旗鱼罐头后就烟消云散了。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '为了尽快完成调查离开人间，我和麻矢又在小镇里兜兜转转，最终将目标锁定在一带老旧的住宅区。', portrait: 'cat_confident', mapZone: 3},
    // 【场景】【场景VIII 柏油单行道，道路上的标志已经严重磨损了。隔著道路耸有高约三公尺的铁丝网。铁丝网往左右延伸了很多，隔著铁丝网往里面看，里面是用来遮蔽视线的树林，在那之后则是宽约十公尺的草坪，草坪后矗立著一座外型长方体的建筑。从这个方向看到的大概是背面，既看不到窗户，也看不到出入口。建筑物的数十公尺后，林立著工厂及大楼】
    { speaker: '小黑', text: '到达目的地后，我聚精会神地环视四周，什么人或者灵魂都没有。', portrait: 'cat_alert', bg: 'scene_8'},
    { speaker: '麻矢', text: '“这附近有‘吃人的废墟’一说呢。”麻矢歪着脑袋神秘兮兮地说。', portrait: 'ms_1'},
    { speaker: '小黑', text: '“要相信自然科学……”我屏息凝神。“没看见只可能是我现在的脸太黑了。”', portrait: 'cat_speechless'},
    { speaker: '小黑', text: '然而地缚灵倒是言出法随地出现了。在建筑物的屋顶一带，出现了散发朦胧光晕的灵魂。', portrait: ''},
    { speaker: '麻矢', text: '“找到了？”麻矢低声问。', portrait: 'ms_smile'},
    { speaker: '小黑', text: '“嗯。我去去就回，麻烦你再在这里等我一下。”我说完后便俯下身体，钻进铁丝网之间的缝隙。', portrait: 'cat_alert'},
    { speaker: '麻矢', text: '“什么，你又要把我一人丢在这里？”', portrait: 'ms_mr'},
    { speaker: '小黑', text: '麻矢的身体可不能穿过这样的铁丝网啊，我心想。不过她既然没再说话，那应该是默认了吧。', portrait: 'cat_proud'},
    // 【场景】【场景IX 灰色的二层建筑前。可参考北理理教。建筑物的出入口出现在视野中，看似自动门的大门深锁，门旁挂著「研究大楼」的牌子】
    { speaker: '小黑', text: '“Hello，你在这里做什么呢？可以下来听我讲几句话吗？”我操纵言灵问道。', portrait: 'cat_confident', bg: 'scene_9'},
    { speaker: '小黑', text: '仔细观瞧，这个灵魂是一位四十岁上下的大叔，眼神虽然迷惑，却透着一丝犀利。', portrait: 'qq_mm'},
    { speaker: '千崎隆太', text: '“你是……老是来游说……家伙的、同伙吗？”', portrait: 'qq_mm'},
    { speaker: '小黑', text: '老来游说？看来是负责这片小镇工作的死神还是比较努力的。不过既然地缚灵不愿跟随他走，我需要用更委婉的方式改变他的想法……', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '还没有等我想完，灵魂便自顾自的向上飘去。', portrait: 'qq_mm'},
    { speaker: '小黑', text: '“哎，你等一下。我并不是来说服你，而是来帮你解决你的依恋。我叫做小黑。”我用哄骗猫（虽然我就是）的语气说到。“你和这个地方有什么联系呢？”', portrait: 'cat_proud'},
    { speaker: '千崎隆太', text: '“我是……千崎，千崎隆太。”', portrait: 'qq_dy'},
    { speaker: '小黑', text: '眼前的灵魂似乎犹豫了一下，但还是努力讲了下去。', portrait: 'qq_mm'},
    { speaker: '千崎隆太', text: '“我是……刑警。在一年半前……这个建筑物……嫌疑犯，说是嫌疑犯，但是我……其实”', portrait: 'qq_dy'},
    { speaker: '小黑', text: '眼前魂魄的状态如此稳定，即使遭受我的干预（大概）也不会有问题。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '“让我进入你的梦境世界中看看吧，比你的叙述肯定更加清晰……”', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '名叫千崎的刑警一愣，我集中了注意力。', portrait: 'cat_alert', goto: 'endless_run.html?lv=2&next=rpg2.html'},
   
    // 【rpg】【进入rpg】这里不插CG和推理时间了，直接跳回视觉小说
    // 【场景】【场景VIII复用】
    { speaker: '小黑', text: '我一路小跑出来，向不知何时躲在电线杆阴影下的麻矢鸣喵示好。', portrait: '',bg:'scene_8',bgm: '曙光良镇'},
    { speaker: '小黑', text: '“这里暂时还没有思路，我们去下一个地方吧。”我摇头晃脑，“一年半前在椿桥，一个名叫小泉沙耶香的女人在那里遭人杀害。Let\'s go吧”', portrait: 'cat_confident'},
    { speaker: '小黑', text: '麻矢却没动，脸色僵硬。我歪头看她：“……麻矢？”', portrait: 'cat_shocked', bg: 'scene_8'},
    { speaker: '麻矢', text: '“我刚才有点走神，可能有些累了。我现在头痛。不好意思，小黑，你能够自己一个人……不对，自己一只猫去那个地方吗？”', portrait: 'ms_mr'},
    { speaker: '小黑', text: '她现在体力尚未完全恢复，我是否让她太过劳累了？罪恶感在我毛绒绒的胸口之中扩散。“你一个人回家没问题吗？需要我陪你回去吗？”', portrait: 'cat_ponder'},
    { speaker: '麻矢', text: '麻矢回头浅笑，“当然没问题啦。倒是小黑你要注意车子，别被车撞到喔 。”', portrait: 'ms_smile'},
    { speaker: '小黑', text: '“我可是高级灵体！你还是多关心关心自己的状态吧。”我怀着吐槽与不安复杂地心情说到。', portrait: 'cat_ponder'},
    // 【场景】【场景X 椿桥 视角从桥上看栏杆与河流 河流应较宽，与上文中河流为同一条 栏杆为铁质 有明显生锈】
    { speaker: '小黑', text: '一年半前，小泉沙耶香便于此被杀害。我在桥上走走嗅嗅，一无所获。', portrait: 'cat_alert', bgm: '闲暇时光', bg: 'scene_10'},
    { speaker: '小黑', text: '在我苦苦寻找时，桥下悠悠地飘出来了一个崩蚀严重的魂魄——表面起毛球、色泽暗沉，辨不出模样。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '它沙哑发声，似有话却因久滞人间、锈蚀过甚而无法流利言灵，由其锈蚀程度看滞留起码逾一年。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '“你是……小泉沙耶香的魂魄吗？”在我说出“小泉沙耶香”这个名字的瞬间，眼前的魂魄开始剧烈闪烁。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '果然没猜错，我陷入阴郁。一年半前，在这里惨遭杀害的小泉沙耶香无法接受自己的死，至今仍然被囚禁在这个地方。过不了多久，小泉沙耶香的魂魄应该就会灰飞烟灭吧。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '“要怎么做，你才会愿意前往吾主的身边呢？找出杀害你的凶手，并让凶手接受惩罚的话，你就会前往吾主身边吗？”', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '魂魄一直毫无反应，摇摇晃晃地缓慢飘回河畔空地，也就是一年前沙耶香遗体被人发现的地方。如果从小泉沙耶香的魂魄口中问不出任何东西，我继续待在这里也没有什么意义。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '再次路过旧住宅区，路边一家门牌吸引了我的注意力。南乡家……', portrait: 'cat_confident'},
    { speaker: '小黑', text: '这样吗…… 一个疯狂大胆的想法开始在我脑中生成。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '我拔腿向发现千崎灵魂的厂房跑去。', portrait: 'cat_ponder',goto:'deduction2.html'},
    // 【场景】【场景IX复用】
    // 【推理时间】【推理时间II】
    // 【CG】插入 CG2】
    { speaker: '小黑', text: '……千崎的魂魄彷佛打招呼似地轻轻摇动，我试着露出微笑，不过猫在现实世界中的脸部肌肉似乎无法顺利做出微笑的表情。', portrait: 'cat_proud', bgm: '漫长的告别', bg: 'scene_9', cg: 'CG2'},
    { speaker: '小黑', text: '“唷，辛苦啦。”我的头上突然传来言灵。我抬起头，发现距离我正上方五公尺的地方，飘浮着引路人。对方应该就是boss所说的负责这片区域的死神了吧。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '“……你已经来啦？”我眯起眼睛，这家伙应该嗅到千崎的灵魂决定安息才来的吧。', portrait: 'cat_ponder'},
    { speaker: '死神同事', text: '“办事手脚愈快愈好吧。我可得趁这家伙还没改变心意的时候，赶快带他前往‘吾主’身边才行啊。”', portrait: ''},
    { speaker: '小黑', text: '我顿时无话可说。正如我这个同事所说，人类这种生物会受到感情这种莫名其妙的东西左右，做出非常不合理的的判断，能够理解这种存在的心情才奇怪。', portrait: 'cat_speechless'},
    { speaker: '千崎隆太', text: '只见面前的同事向千崎的魂魄发出“那我们走吧”的言灵。千崎悄然飘向我鼻尖之前，用依旧不灵活的言灵朝我发话。', portrait: 'qq_mm'},
    { speaker: '千崎隆太', text: '“约定……拜托了……”', portrait: 'qq_mm'},
    { speaker: '小黑', text: '我“喵”了一声作为回应。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '“对了，等一下！”我慌忙朝同事发出言灵。“你在这两年半之间，应该也负责这个地区吧？这样的话，你知道在那栋研究大楼遭人割喉而死的男人是被谁杀的吗?”', portrait: 'cat_ponder'},
    { speaker: '死神同事', text: '“我说啊，那种事情我怎么可能知道呢。我确实记得那边曾经有个遭人杀害而当了一会地缚灵的魂魄，不过现在已经跑去别的地方了。”', portrait: ''},
    { speaker: '小黑', text: '哦，小泉昭良的魂魄果然变成地缚灵了啊。', portrait: 'cat_ponder'},
    { speaker: '死神同事', text: '“不过啊，你真喜欢解决牵扯杀人案家伙的依恋啊，难不成你特别在找这种吗。”', portrait: ''},
    { speaker: '小黑', text: '我默不作声，同事就自言自语似地发出言灵。我「呜喵？」地叫一声，歪了歪头。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '“南乡纯太郎和杀人案应该没什么关系吧，他可是自己冲到马路上的。”', portrait: 'cat_shocked'},
    { speaker: '死神同事', text: '“自己冲到马路上？你在说什么啊。你之前帮忙解决依恋的家伙，是从背后被人推到马路上的喔。”', portrait: ''},
    { speaker: '小黑', text: '“什……”我张口结舌，瞪大双眼。“不可能，南乡纯太郎是追在抢劫犯后面，才跑到马路上……”', portrait: 'cat_shocked'},
    { speaker: '死神同事', text: '“抢劫犯？什么抢劫犯？他是被接近身后的家伙抢走皮包，然后直接推到马路上的。我一直等在一旁，准备为那家伙的魂魄引路，所以目睹了那一瞬间，绝不会错。”', portrait: ''},
    { speaker: '小黑', text: '南乡纯太郎是被杀的？陷入混乱的我用后脚站了起来。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '“是谁？为什么要杀了南乡纯太郎？”', portrait: 'cat_ponder'},
    { speaker: '死神同事', text: '“所以我刚才不是说了吗，我怎么可能会知道这种事情啊。不过那家伙从皮包中拿出某样东西之后，就把皮包往旁一丢，所以那样东西应该就是目的吧。”', portrait: ''},
    { speaker: '小黑', text: '我感觉自己的脑袋好像要炸了——', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '小泉昭良和沙耶香夫妇以及南乡纯太郎，这三人大概在那个地下研究室进行什么不为人知的研究，然后三人都遭人夺去性命……', portrait: 'cat_confident'},
    { speaker: '小黑', text: '两个月前，将南乡纯太郎推向马路杀害的人，该不会和杀害小泉夫妇的凶手是同一人？', portrait: 'cat_alert'},
    { speaker: '小黑', text: '假如同事所说属实，犯人是在抢走南乡纯太郎的皮包之后，将他推到马路上。也就是说，犯人的目的其实是皮包吗？', portrait: 'cat_alert'},
    { speaker: '小黑', text: '这么一想，被扔在河畔空地的皮包里面，之所以还留着值钱的东西和戒指，也就可以理解了。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '犯人从皮包里面抢走了比这些更贵重的东西，而那到底是？', portrait: 'cat_alert'},
    { speaker: '小黑', text: '我小小的脑袋瓜中逐渐塞满疑问。', portrait: 'cat_ponder'},
    // 【场景】【场景V复用 注意此时背景时间应调整为深夜】
    { speaker: '小黑', text: '我小小叫一声权充到家的招呼，从微开窗缝挤进身体。疲劳如沉积水底的泥巴淤在深处，现在只想倒头大睡。', portrait: 'cat_sigh', bgm: '微光引灯时', bg: 'scene_4'},
    { speaker: '麻矢', text: '“你回来啦，小黑？”', portrait: 'ms_smile'},
    { speaker: '小黑', text: '突然的声音让我尾巴瞬间炸毛，我连忙抬起视线，躺在床上的麻矢露出微笑往下看著我。', portrait: 'cat_shocked'},
    { speaker: '麻矢', text: '“哎，等等，别乱动。”我转头一看，麻矢的脸就近在面前。看来我似乎是被麻矢抱起来了。', portrait: 'ms_smile'},
    { speaker: '小黑', text: '“怎么了？突然把我抱起来。”我停止挣扎，近距离望著麻矢的脸庞。', portrait: 'cat_shocked'},
    { speaker: '麻矢', text: '“嗯，我总觉得小黑似乎很难受的样子，应该是遇到什么讨厌的事情吧。”', portrait: 'ms_sk'},
    { speaker: '小黑', text: '“……并没有。”', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '我撇开视线看向一旁，毕竟这件事跟麻矢说也没什么意义。', portrait: 'cat_sigh'},
    { speaker: '麻矢', text: '“你不想说的话也没关系。总之，今晚就一起睡吧。”', portrait: 'ms_smile'},
    { speaker: '麻矢', text: '麻矢就这样抱著我躺到床上，并拉起棉被一同盖到我的身上。', portrait: 'ms_smile'},
    { speaker: '小黑', text: '麻矢温柔地抚摸我的头，因为感觉太过舒服，我的喉咙情不自禁地咕噜作响。', portrait: 'cat_proud'},
    { speaker: '麻矢', text: '“你一定累了吧，今天就好好休息吧。”', portrait: 'ms_smile'},
    { speaker: '小黑', text: '麻矢宛如耳语的话语声渗进身体，寒冷的躯干也温暖了起来。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '“……我说，麻矢。”我闭起眼睛，发出言灵。“刚才我在研究大楼地缚灵那里……”', portrait: 'cat_confident'},
    { speaker: '小黑', text: '我在麻矢暖意的包围下，娓娓开口道来。', portrait: '', achieve: 'suspectx'},
    // 【chapter】===== Chapter 3 背负诅咒的刺身 =====
    // 【场景】【场景20 三层楼米黄色外表的西洋宅邸 上面挂着红十字 标题“安宁医院”】
    { chapter: 'Chapter 3 背负诅咒的刺身', speaker: '小黑', text: '“千崎的遗物就在这里。”我向麻矢发出言灵。', portrait: 'cat_confident', bgm: '推理要在下班后', bg: 'scene_20', mapZone: 4},
    { speaker: '小黑', text: '在被我那讨厌的同事带走前，千崎曾经对我千叮咛万嘱咐，希望我能帮助他找到真相。并让我去寻找他的遗物。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '“抱歉，宠物的话暂时不能入内。”我还正在思考，门卫大爷就挥动着手做出了不欢迎的表示。', portrait: ''},
    { speaker: '麻矢', text: '麻矢强忍着笑容。“没办法了小黑，这次只能你等我一段时间了。”', portrait: 'ms_smile'},
    { speaker: '小黑', text: '在门外小打了一顿瞌睡后，麻矢拿着一本厚重的黑皮笔记本出来，“小黑，该醒醒了！”', portrait: 'cat_speechless'},
    { speaker: '小黑', text: '麻矢翻开了这本笔记本，我跳上她的肩头看了起来。', portrait: 'cat_alert'},
    // 【笔记本照片】【插入几张笔记本的照片】
    // 【场景】【场景20复用】
    { photos: ['手稿1', '手稿2', '手稿3', '手稿4', '手稿5'], speaker: '小黑', text: '看完笔记本，我陷入了沉思。', portrait: 'cat_ponder', bg: 'scene_20'},
    { speaker: '小黑', text: '千崎刑警是在约两个月前四月八日去世的，这本笔记本甚至也记录到了南乡社长逝世四月五日的那天。一想到千崎的心情我就想帮他找出犯人，但我是不是自作多情了呢？', portrait: 'cat_confident'},
    { speaker: '麻矢', text: '“小黑，别楞着了。”麻矢出声叫我。“这个可是相当重要的情报。”', portrait: 'ms_sk'},
    { speaker: '麻矢', text: '麻矢指着笔记本上“柏村摩智子”的名字，“小泉沙耶香的妹妹在姐姐死后，竟然也进入了南方制药公司。”', portrait: 'ms_sk'},
    { speaker: '小黑', text: '“现在实验室没有死亡或者失踪的人员，就只剩下柏村摩智子了。”', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '南乡纯太郎与小泉昭良的死亡都被警方以“自杀”结案了，接下来的推理只能靠我们二人了。', portrait: 'cat_ponder'},
    // 【场景】【场景XIII 麻矢家的客厅。这个客厅实际上并没有什么特别值得提的，正常日本00年代风格 客厅即可】
    { speaker: '久住淳', text: '与麻矢一道回到家中，客厅的玄关旁除了麻矢的妈妈外，还站着一位看起来充满稚气的年轻男性，但他的眼眶四周又布满了黑眼圈。', portrait: 'jz', bgm: '不安的梦魇', bg: 'scene_13'},
    { speaker: '小黑', text: '“麻矢，这是刑警久住先生，有些问题想问问你。”麻矢妈妈一脸紧张的看着麻矢。', portrait: ''},
    { speaker: '小黑', text: '久住？这不就是之前与千崎联手共同审讯小泉并蹲点的那位年轻刑警吗？既然如此，那说不定能从他的身上得到关于案件的新线索。', portrait: 'cat_confident'},
    { speaker: '久住淳', text: '“关于之前驾车冲撞肇事逃逸的事件，警方有了最新进展。实际上白木小姐遭遇车祸的现场，有目击证人。”', portrait: 'jz'},
    { speaker: '久住淳', text: '“由于没有监控，我们之前只是将该起案件作为超速驾驶进行处理，也没有得到车主的相关信息。”', portrait: 'jz'},
    { speaker: '久住淳', text: '“但是，根据最新的线索，这辆车是在跟踪白木小姐后加速撞向她的。司机甚至下车确认并拿走了白木小姐的随身物品. ”', portrait: 'jz'},
    { speaker: '麻矢', text: '麻矢和我都屏息凝神地看着久住。麻矢的母亲颤抖的问道，“那目击证人有看到是谁干的吗？”', portrait: 'ms_mr'},
    { speaker: '久住淳', text: '久住叹了一口气。“是的，根据证人的描述，两个月前我们的确在小镇周围的湖边接到发现一辆废弃的相似车辆的报告……并在上面检测出了撞击痕迹。”', portrait: 'jz'},
    { speaker: '久住淳', text: '“虽然目前不能确定车主的身份，但我们会持续追查。”', portrait: 'jz'},
    { speaker: '小黑', text: '我和白木面面相觑。', portrait: 'cat_ponder'},
    // 【场景】【场景V复用 背景应调整为深夜】
    { speaker: '麻矢', text: '送别了久住刑警，安慰了妈妈后，麻矢一言不发的回到了房间。', portrait: 'ms_mr', bgm: '椿桥夜寻踪', bg: 'scene_4'},
    { speaker: '小黑', text: '白木麻矢原来的身体到底被谁盯上了……这样的念头在我的心中挥之不去。我走过去，“喵呜”的叫了起来。', portrait: 'cat_sigh'},
    { speaker: '麻矢', text: '“小黑，今天可没有生鱼片啊。”麻矢心不在焉地挠逗着我的耳朵。', portrait: 'ms_mr'},
    { speaker: '小黑', text: '我小声说道，“麻矢，你有没有发现……笔记上的人物，除去下落不明的阿久津一也，只剩下两位了。”', portrait: 'cat_confident'},
    { speaker: '麻矢', text: '麻矢点了点头，现任南方制药公司董事长秘书的柏村摩智子，与游港大学生物学教授峰岸诚，这两位character与案件中的其他人物有着千丝万缕的联系，却一直居于神秘的幕后。', portrait: 'ms_mr'},
    { speaker: '麻矢', text: '“不如用电脑试试吧。”麻矢抖擞精神，笑着对我说。', portrait: 'ms_smile'},
    { speaker: '小黑', text: '电脑？我确实在千崎的记忆里也见过。人类用这种东西可以获取很多信息，是不是我也应该学学呢？', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '分别搜索“柏村摩智子”“南方制药”和“峰岸诚”看看吧。', portrait: '',goto:'mogul-search.html?embed=1F'},
    // 【小游戏】【插入小游戏】
    // 【场景】【场景XI 深夜，旧住宅区的一座院落。木制二层小别墅，但明显已经很久没有人居住。院落中杂七杂八丢着许多打扫用的物品，其中有一辆三轮车，上面有“南乡”的称号】
    { speaker: '小黑', text: '“这就是我怀疑小泉昭良案中有暗道的场合……南乡家的旧宅邸。”我快速地向麻矢说明着情况。“没想到这里离我们的目的地还挺近的。”', portrait: 'cat_alert', bgm: '椿桥夜寻踪', bg: 'scene_11'},
    { speaker: '小黑', text: '在网上查完相关线索后，我们一人一猫决定先突击千崎刑警笔记本中阿久津一也的住址，不承想路过了那个带给我推理灵感的院落。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '“那天晚上我回家之前我还潜入了这个院子。确实在仓库里面发现了能前往秘密研究基地的路线……”我兴奋地发出言灵，直到有一个女声浅浅地从身后传来。', portrait: 'cat_proud'},
    { speaker: '又一个女声', text: '“一也……”', portrait: ''},
    { speaker: '樱井知美', text: '我们回过头去，只见一位lady紧紧盯着阿久津一也家紧闭的大门。', portrait: 'zm_sn'},
    { speaker: '小黑', text: '从她身上我立刻闻到一股甜腻的气息，作为引路人，我清醒地知道这代表着可能不久于人世的“绝症气息”。', portrait: 'cat_shocked'},
    { speaker: '麻矢', text: '“请问你认识阿久津一也吗？”麻矢温柔却坚定地注视着他。', portrait: 'ms_sk'},
    { speaker: '樱井知美', text: '“是的，我是他的女朋友。”陌生的女人低声答道。“一切都是从那个刺身开始的……”', portrait: 'zm_tq'},
    { speaker: '小黑', text: '我和麻矢对望了一眼。', portrait: 'cat_alert'},
    // 【场景】【场景XII 温暖的咖啡厅，暖黄色的灯光。镜头应照着落地窗前的桌子。落地窗外是老城区，窗外的建筑破旧鲜有灯光】
    { speaker: '樱井知美', text: '名叫知美的女生低着头，仿佛下一秒就会哭出来般。', portrait: 'zm_sn', bgm: '漫长的告别', bg: 'scene_12'},
    { speaker: '小黑', text: '她知道阿久津的下落吗？她为什么要在阿久津的门前徘徊呢？如果阿久津是前几起案件的最大嫌疑人，她是否值得相信呢？', portrait: 'cat_ponder'},
    { speaker: '麻矢', text: '“虽然打探您的隐私很不好意思。”麻矢用招牌的微笑问道，“请问您能讲讲您和阿久津之间的故事吗？最近他下落不明，作为她的同事我很担心……”', portrait: 'ms_smile'},
    { speaker: '樱井知美', text: '“故事要从三年前说起……当年我刚刚从大学毕业，顺利拿到了当地银行的offer。然而我却身体却逐渐恶化，被确诊为SLE，全身性红斑性狼疮……具体的机理我不作详细介绍了，但那段时间我身体变化巨大，也一直都有轻生的念头。”', portrait: 'zm_sn'},
    { speaker: '樱井知美', text: '知美顿了顿，仿佛想起了美好的记忆。', portrait: 'zm_wx'},
    { speaker: '樱井知美', text: '“就在半年后，阿久津给我发来信息，希望与我约饭，并在离开时向我表白。虽然当时的我感到被同情的愤怒和不知如何回答的逃避，但他始终向我表达想与我交往的决心。”', portrait: 'zm_wx'},
    { speaker: '樱井知美', text: '她深呼吸了一口气。', portrait: 'zm_tq'},
    { speaker: '樱井知美', text: '“直到半年前的那个晚上，一切都结束了。”', portrait: 'zm_sn'},
    // 【CG】插入 CG3】
    { speaker: '樱井知美', text: '“故事其实还有转机。”知美抿了一口咖啡，苦笑道。', portrait: 'zm_wx', cg: 'CG3'},
    { speaker: '樱井知美', text: '在前几天收拾家中物品时，她发现了一张草稿纸，上面潦草地记载了“项目计划”“研发日志”等字眼，但最引人注目的还是“HLTV-1”的标注。', portrait: 'zm_zj'},
    { speaker: '樱井知美', text: '虽然阿久津经常强调自己的研究是保密项目，但这行字很可能是他在处理工作时无意识写下的。', portrait: 'zm_zj'},
    { speaker: '樱井知美', text: '知美查询了这种叫做人类T淋巴细胞病毒1型的病毒，但并非医学出身的她却一知半解，只是模糊地感觉到这和丈夫的变化有很大关系。', portrait: 'zm_tq'},
    // 【推理时间】线索栏界面说明（台本原文）：这里界面进行跳转。可以是《逆转裁判》类的固定几句话，对话框可回滚或向前，找出“有问题的句子”；也可以是模仿证物栏来一个语言栏。选错不惩罚、不跳坏结局，只提示“这不是正确答案”并返回刚才的问题。蓝字＝沙耶香说的，红字＝小黑（玩家选择）。界面里的句子含有 CG 里的句子，句子库需要找作者索取。
    { speaker: '麻矢', text: '这时，麻矢突然出声打断了知美的叙述。', portrait: 'ms_smile', goto: 'deduction3.html'},
    /* ★ 这一句是「推理页 deduction3 四轮问答全部答完」回到剧情时要打出的第一句。
       返回点＝上面那句 goto 的**下一句**（beginExit 用 storyCursor 写 vn_minigame_return），
       所以它必须紧跟在 goto 句后面：往后挪一句就再也播不到了。 */
    { speaker: '麻矢', text: '“没错！如果与您诞下孩子，HLTV-的诅咒会继续传下去……为了您的幸福，它只能和你离得越远越好。”', portrait: 'ms_smile'},
    // 【成就】（获得成就：律师徽章，再次闪耀！）
    { speaker: '樱井知美', text: '不知何时，知美已经开始啜泣。屋外星空闪烁，正是知美的记忆中游港大学顶楼的夜空。', portrait: 'zm_sn'},
    { speaker: '樱井知美', text: '“不，不，怎么是这样……”她小声地说，仿佛刚刚接受两人不能在一起的事实。', portrait: 'zm_sn'},
    { speaker: '小黑', text: '我想，明白阿久津一也的深爱自己的心意后，她一定能怀抱着两人共同的memory，她身上的甜腻的气息变成了宛如薄荷一般的清冽芳香，我清楚知美度过这一关了。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '我和麻矢对视一眼——一个真相解开了，更大的真相却无法告知眼前的知美。那个杀人犯，果然极有可能是阿久津一也。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '对于感染 HLTV-1、又因过敏未接受治疗的阿久津一也而言，完成南方公司的研究正是他能与深爱恋人携手共度人生的最后希望。然而事与愿违，研究虽极可能已完成，他却无法享用成果，或因伙伴意见对立，又或未进展到足以人体投药的阶段。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '今年四月初，阿久津向知美告别、消失无踪的同一时期，南乡纯太郎遭杀害、包中物品被窃。我推断是阿久津杀了南乡、窃取实验档案；至今下落不明的柏村摩智子，恐怕也遭其毒手。', portrait: 'cat_ponder'},
    
    // 【场景】【场景XI 复用】（这一段都是小黑说的）
    { speaker: '小黑', text: '突然窗外传来一阵嘈杂，我们赶紧向外张望，只见天空中的重重浓烟——', portrait: 'cat_alert', bg: 'scene_11'},
    { speaker: '小黑', text: '我心中警铃大作。“不会吧……”麻矢说出了我心中的话。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '一小时前我们经过的南乡家旧宅，已消失在漫天火光中。', portrait: ''},
    { speaker: '小黑', text: '消防员奋力疏散人群，我却像被定住般不想动弹。', portrait: 'ms_mr', achieve: 'farewell'},
    // 【chapter】===== Chapter 4 灵魂深处的面具 =====
    // 【场景】【场景XIII复用】
    { chapter: 'Chapter 4 灵魂深处的面具', speaker: '麻矢', text: '阳光明媚的周日早晨。今天的麻矢却没有过来和我问好或抚背摸头。我惊讶地抬起头，只见她正盯着电视屏幕发呆。', portrait: 'ms_mr', bgm: '闲暇时光', bg: 'scene_13'},
    { speaker: '小黑', text: '电视上一个穿着西装的男人好像在念着什么，我跟随麻矢的目光看向滚动的字幕——', portrait: 'cat_shocked'},
    { speaker: '亢奋的记者', text: '六月二十七日早上，一位游港大学相关人士通报校内散布血迹的事件，前往现场的警察于药学系执教的峰岸诚教授（五十八岁）的办公室中发现大量其血迹。峰岸教授目前下落不明，警方正朝峰岸教授被卷进刑事案件的方向进行搜查。', portrait: ''},
    { speaker: '麻矢', text: '“该不会是……”麻矢用嘶哑的声音说到。', portrait: 'ms_sk'},
    { speaker: '小黑', text: '我呆愣地凝视着画面，“阿久津一也……连峰岸也杀了？”', portrait: 'cat_shocked'},
    // 【场景】【场景V复用】
    { speaker: '小黑', text: '阿久津一也应该是完全失控了，我已经完全读不懂他的行为走向了，不过毫无疑问地这个事件正在走向终点。', portrait: 'cat_ponder', bgm: '闲暇时光', bg: 'scene_5'},
    { speaker: '麻矢', text: '“……可能是为了钱。”麻矢听完我的疑惑后总结道，“如果真的有对HLTV-1如此致命的病毒研发出了特效药，一定会被各大制药公司疯狂求购。”', portrait: 'ms_sk'},
    { speaker: '麻矢', text: '“当然，我认为他的主要目的还是希望根据研究成果，马上做出新药，用以治疗自己的疾病。不过只是这样的话，他应该不需要烧掉研究室，杀害峰岸教授才对。”', portrait: 'ms_sk'},
    { speaker: '麻矢', text: '“想来阿久津一也和恋人分手之后，只剩下金钱这个目的。既然他在一年半前手上就沾着人命……说不定他已经沦落到愿意为了钱，做出任何事情了。”', portrait: 'ms_sk'},
    { speaker: '小黑', text: '“真是愚蠢，竟然会为了钱这种东西伤害他人，玷污自己的魂魄。所有人类都终有一死喔。不管身上的钱再多，大限当头的时候也毫无意义嘛。”', portrait: 'cat_speechless'},
    { speaker: '小黑', text: '一阵晕眩感突然袭来，我踉跄了一下，一股灼热的感觉从胃涌上食道。我用力弯起身体，呕了几声后，从口中吐出褐色物体，原来是我刚才吃下的猫干粮。', portrait: 'cat_shocked'},
    { speaker: '麻矢', text: '“小黑，你没事吧！”麻矢睁大眼睛，跑到我身边，伸手抚摸我的背。', portrait: 'ms_mr'},
    { speaker: '小黑', text: '“没事……”我喃喃的说到，但困意不知为何却愈发严重。', portrait: ''},
    { speaker: '小黑', text: '我两眼一黑，没有了意识。', portrait: ''},
    // 【场景】【场景V，深夜版本】
    { speaker: '小黑', text: '呕吐与晕眩的感觉伴随了我整个梦境，当我再次醒来时，已经是黄昏了，而麻矢不在家中。', portrait: 'cat_sigh', bgm: '潜行探戈', bg: 'scene_4'},
    { speaker: '麻矢', text: '“人类的确拥有会为了自己的欲望而伤害他人的肮脏一面，不过呢，人类不只有肮脏的一面，也同时拥有温柔的一面喔。”', portrait: 'ms_smile'},
    { speaker: '小黑', text: '脑中浮现出麻矢的脸。和她一起度过的时光，和她成为她口中的”朋友“，改变了我对人类的看法。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '南乡纯太郎虽然是被人杀害的，但比起让犯人得到报应，他更希望拂去妻子的苦恼。', portrait: ''},
    { speaker: '小黑', text: '千崎隆太将他人生的一切都倾注于对抗犯罪，身患绝症最后的几天也在追查真相。', portrait: ''},
    { speaker: '小黑', text: '即使是阿久津一也，他也选择让恋人拥有更好的未来，而试图牺牲自己。', portrait: ''},
    { speaker: '小黑', text: '人类确实也拥有宝贵的一面。引人呕吐的丑陋与残忍心性，以及令人感动的温柔与高尚品性——人类就是同时蕴含了这两种面向的存在，实在是令人费解。', portrait: 'cat_speechless'},
    { speaker: '小黑', text: '当引路人时人类于我不过是负担；自有了猫身贴身生活，才觉人类有趣，这认知也许就值得我来人间一趟……值得我来人间一趟啊，我对这想法露出苦笑。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '猫粮盆里已经堆满了猫粮，但是我不饿。隐约看还有一张压着的字条……', portrait: ''},
    { speaker: '麻矢', text: '“小黑，谢谢你。至今为止发生的一切，都十分感谢。”', portrait: ''},
    { speaker: '小黑', text: '这是麻矢的字迹。', portrait: ''},
    { speaker: '小黑', text: '这是什么意思？我歪着脑袋，喵了一声。', portrait: 'cat_sigh'},
    // 【场景】【场景XIII】
    { speaker: '小黑', text: '我在家中找着麻矢的踪迹，直到来到了那间一直紧锁着的房间门前。', portrait: 'cat_confident', bgm: '潜行探戈', bg: 'scene_13'},
    { speaker: '小黑', text: '我同时发出呜喵的叫声和“麻矢你听得到吗”的言灵。', portrait: 'cat_confident'},
    { speaker: '麻矢的母亲', text: '“哎呀，小黑。这里现在没有人住着哦。”是麻矢的妈妈。她露出了悲伤的神色，却温柔的把我抱起来，“现在久住先生在家里，你一定要听话些呀。”（姓名栏：麻矢的母亲）', portrait: ''},
    { speaker: '小黑', text: '久住？我的脑子彻底乱了。我默默跟着麻矢的妈妈来到客厅，果然看到了那个年轻人和另一位中年刑警——', portrait: ''},
    { speaker: '麻矢的母亲', text: '“不好意思，你们大老远跑这一趟，麻矢却刚好不在。我已经试着打电话联络她，不过她似乎没开手机。”', portrait: ''},
    { speaker: '小黑', text: '麻矢出门了？我焦急地心想。', portrait: 'cat_alert'},
    { speaker: '久住淳', text: '“哦，请不要在意，是我们要突然登门的。”久住毕恭毕敬地回答道。“关于白木小姐遭遇的肇事逃逸案，我们有了新的进展。”', portrait: 'jz'},
    { speaker: '久住淳', text: '“那辆车因为不确定车主，曾一度陷入了僵持的局面。但现在不一样了。”', portrait: 'jz'},
    { speaker: '久住淳', text: '“请问您认识阿久津一也吗？”', portrait: 'jz'},
    { speaker: '小黑', text: '我情不自禁的喵出声来。阿久津一也！但是他为什么要谋害与研究中心毫无关系的白木麻矢呢？还是说这次撞击事故只是意外？', portrait: 'cat_ponder'},
    { speaker: '麻矢的母亲', text: '“是的……我知道他。”', portrait: ''},
    { speaker: '小黑', text: '白木麻矢的母亲认识阿久津一也？我瞪圆双眼。', portrait: 'cat_shocked'},
    { speaker: '久住旁的中年刑警', text: '“实际上，我们最近一直因为某起案件追查阿久津一也的下落……唉，其实您应该也可以猜到是峰岸教授的遇刺案，我们一度掌握了重要线索认为这起案件与他有关联。”一直没开口的中年刑警说。', portrait: ''},
    { speaker: '久住淳', text: '“然而，在汽车旁的水池内，我们打捞上了阿九津的尸体。”久住说到。', portrait: 'jz'},
    { speaker: '久住淳', text: '“经法医鉴定，遗体在池中泡了超过两个月的时间，遗体被鱼虾螃蟹等啃食破坏得相当严重，几乎只剩白骨，所以目前还不清楚死因。”', portrait: 'jz'},
    { speaker: '小黑', text: '麻矢的母亲抽搐着嘴巴，说不出半句话，不过我受到的冲击不亚于她。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '如果阿九津已死，到底是谁放火烧了地下研究所，还攻击了峰岸？', portrait: 'cat_shocked'},
    { speaker: '久住淳', text: '“我们不清楚阿久津一也是蓄意还是过失，不过我们认为他是在撞伤麻矢小姐后，选择连人带车开进池中自杀。该怎么说呢，我们查出阿久津罹患了相当难以医治的病，时日所剩无几，也许他就是因为这样自暴自弃。”', portrait: 'jz'},
    { speaker: '小黑', text: '的确，失去与恋人的共同未来之后，阿久津会选择自己结束生命，倒也不是无法理解。只是他在那之前还杀害了南乡纯太郎，偷走实验的资料。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '一个人有可能在做下这些事之后选择自杀吗？还是说他终究没得到实验资料，因而就此绝望？', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '有些事情不对劲……', portrait: 'cat_ponder'},
    { speaker: '麻矢的母亲', text: '“请等一下，你说不清楚肇事逃逸是不是蓄意犯案的话，难道你要说麻矢是刚好被同一个大学毕业，还在同一个公司工作的同事开车撞伤吗？”', portrait: ''},
    { speaker: '小黑', text: '麻矢的母亲用尖锐声音高喊的瞬间，我更加陷入混乱。', portrait: ''},
    { speaker: '小黑', text: '阿久津是麻矢的同事？她在说什么，我记得麻矢明明是在银行上班……', portrait: ''},
    { speaker: '久住淳', text: '“太太，请你冷静下来，我们也不认为这是巧合。老实说，确认遗体身份前，我们还怀疑阿久津一也可能和一年半前的案子有关。”', portrait: 'jz'},
    { speaker: '麻矢的母亲', text: '“你是说沙耶香的案子吗？”麻矢的母亲尖声高问，从沙发上探出身体。', portrait: ''},
    { speaker: '小黑', text: '我无法相信自己的耳朵──刚才麻矢的母亲说了什么？', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '沙耶香？沙耶香的案子？一年半前的案子？', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '……难不成！', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '宛如遭到雷击一般的冲击从头到尾巴地贯穿我的全身，我的肉球在思考之前就踏上地面迈步狂奔。我动用全身肌肉，两阶并一阶地奔上楼梯后，急停在我的目的地之前。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '由于冲劲过猛，我一度往前栽倒。使力勉强保持住身体平衡之后，我抬头望向眼前的房门。这扇门并不是麻矢房间的门，而是紧锁的房门。麻矢的母亲刚刚对这个房间喃喃低语“这里没人”。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '心脏在我小小胸口之中激烈跳动。原因不是我一路跑到这里，而是我深怕房门后即将展现在我眼前的东西。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '如果我想的没错……', portrait: 'cat_confident'},
    // 【场景】【场景V复用】
    { speaker: '小黑', text: '我绕到房间窗外，奋力一跳跳入房间。房间和麻矢房内装修相差不多，不过整体上用色大方的家具偏多，营造出沉稳的气氛。', portrait: 'cat_shocked', bgm: '推理要在下班后', bg: 'scene_5'},
    { speaker: '小黑', text: '我一跃跳上书桌，看到摆饰在书桌上的相框，两名女性面带笑容地站在一起。其中一位脸上浮现满面笑容的女性是麻矢，而站在麻矢身旁的是一名身材苗条，留著黑色短发的女性，在照片中露出柔和的微笑。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '我转头环视房间，在夕照下染成朱红的房间墙壁上挂著一幅挂框。裱在框中的纸上写著大大的毕业证书，我注视着证书上的名字，然后陷入绝望之中。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '「白木沙耶香」。', portrait: ''},
    { speaker: '小黑', text: '这五个字烙印在我的视网膜上。名为白木沙耶香的女性曾经住在这里，而白木沙耶香之后嫁给小泉昭良……成为小泉沙耶香。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '这里就是一年半前在椿桥上遇害的小泉沙耶香住过的房间；而被阿久津一也的车撞陷入昏睡状态的白木麻矢，正是继承姐姐遗志，进入南方制药公司，在地下研究室进行HLTV新药研究的妹妹。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '「柏村摩智子」这名人物一开始就不存在，我一直和我在找的“小泉沙耶香的妹妹”生活在一起，我真是个大糊涂蛋。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '千崎的笔记上为什么会将小泉沙耶香妹妹的名字记载为「柏村摩智子」，现在一想，理由其实很简单。在山丘上的安宁医院拿到千崎的笔记本时，麻矢是独自行动的，她应该是在那时动一点手脚。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '「白木麻矢」再增添几笔，就能够把文字改成柏村摩智子。麻矢就是这样让我相信了根本不存在的人物，成功地隐瞒自己现在的身体就是小泉沙耶香妹妹这项事实。千崎的笔迹相当潦草，所以我才没注意到文字遭到篡改。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '麻矢一定知道「白木麻矢」就是小泉沙耶香的妹妹，也是南方制药公司的职员。调查过房间，看过身份证或驾驶证的照片，或和双亲谈过话，应该马上能知道，但麻矢却向我隐瞒。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '她为什么要这么做……', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '有一件事很清楚：麻矢绝对没丧失记忆。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '她的全盘举动从一开始就在算计之中。现在一想，解决南乡纯太郎和千崎隆太这两个地缚灵的依恋，也是因为麻矢向我指引了他们所在的场所。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '……但她为什么要这么做？', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '最重要的是，使用白木麻矢身体的灵魂到底是谁。从一切都在计算的行动来看，她应该是研究室的相关人物。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '……她？', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '为何我一直认定麻矢是女性？言灵没有男女的声差——我认为麻矢是生前为女性的人类魂魄，是因为她的说话方式。不过假使她从一开始就有意欺瞒，说话方式根本是想改就改的小问题。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '麻矢就是……阿久津一也……', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '回想起来，HLTV的新药完成后，阿久津想要将成果占为己有，用新药治疗自己的HLTV，并卖掉研究资料以获取庞大利润。这会是放弃与恋人共度未来的阿久津唯一的生存目的了。', portrait: ''},
    { speaker: '小黑', text: '接下来，阿久津杀害南乡纯太郎。但是南乡纯太郎为防万一将资料分成了两个部分，分别由自己和白木麻矢保管。', portrait: ''},
    { speaker: '小黑', text: '于是阿久津开车撞了白木麻矢，打算强抢剩下的资料，可惜这至关重要的资料没在身上。绝望的阿久津连人带车开进池子，结束了自己的性命。', portrait: ''},
    { speaker: '小黑', text: '他的魂魄因为强烈的依恋而滞留人间，飘荡在理应持有剩下资料并陷入昏睡的白木麻矢旁。这时，我出现了。', portrait: ''},
    { speaker: '小黑', text: '于是……我完完全全上了他的当，就这样让阿久津复活了。睽违两个月，阿久津借用白木麻矢的身体与名字，再度展开行动，试图拿到研究资料。', portrait: ''},
    { speaker: '小黑', text: '啊啊，对了！我趴下身体，伸出两只前脚抱头。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '应他要求，我让那魂魄 Download 了身体记忆——阿久津窃得资料的回忆后，作为最后工作抹消痕迹、烧了研究室、杀害了对研究稍有知情的峰岸。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '我颓然垂头。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '全都是我的错。都是因为我用轻率的mood，将才刚碰面的魂魄放进了白木麻矢的身体里……假如我没做出轻率的举动，至少峰岸也不至于死于非命了。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '撕心裂肺的自责感让我感到痛苦不已。', portrait: 'cat_ponder'},
    { speaker: '麻矢', text: '麻矢──不，阿久津应该不会再回到这个家了。他已经得到所有必需的研究资料，接下来将资料卖给哪家公司，赚取大笔酬劳就好。他应该还在我早餐的猫干粮中混入药物，让我一路睡到傍晚，以免他的逃亡计划被我察觉。', portrait: 'ms_mr'},
    { speaker: '小黑', text: '客观条件下，沉睡于那副身体深处的白木麻矢本人的魂魄醒过来，寄宿其中的阿久津魂魄就会被赶出体外。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '不过谋害自己的人的魂魄就在自己体内，白木麻矢的魂魄说不定会就这样一直沉睡在身体深处。这么一来，阿久津就能一直使用那副身体，直到肉体迎来寿命尽头。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '……我该怎么做才好？', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '麻矢……从乌鸦喙下救我、同住照顾我、称我为友的人。那温柔笑容全是虚假吗？灵魂面具下，他是否正嘲讽着我？', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '啊啊，有了。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '我默默发出言灵，召唤我那讨厌的死神同事。', portrait: 'cat_confident', mapZone: 5},
      // 【背景XIIII 游港大学理学楼天台。夜色已深，满天繁星，小镇最高点俯瞰万家灯火。这是正文部分的最后一张背景图了，请美工尽可能发挥】
    { speaker: '小黑', text: '得到了麻矢，哦不，阿久津的行动线索后，我一路赶来了游港大学的理科教学楼。', portrait: 'cat_ponder', bg: 'scene_14', bgm: '不安的梦魇'},
    { speaker: '小黑', text: '在知美的叙述中，这是小镇的最高点，也是新闻中峰岸教授办公室的所在地。不过现在通往天台的门把上缠绕着绳子，门的上方还装着陌生的薄片状物体。那个到底是什么？', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '没空细想，我继续飞身赶往天台。天台空荡荡的，只有四周围着动物园般的铁栅栏。', portrait: 'cat_alert'},
    { speaker: '？？？', text: '“小黑？”', portrait: ''},
    { speaker: '小黑', text: '我被突然响起的声音吓得一震，回过头去，只见麻矢站在角落的阴影里，手上还握着一根绳子。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '麻矢的脸出现在眼前的瞬间，我顿时无法动弹。一波又一波涌上心头的混乱情绪，让我的脑子僵住，无法思考。', portrait: 'cat_shocked'},
    { speaker: '麻矢', text: '“……怎么会是小黑？……你是怎么知道这里的？”麻矢茫然低语。', portrait: 'ms_mr'},
    /* ===== 第一次选择：A / B / C（台本 chapter4多结局部分.docx）===== */
    { speaker: '', text: '', portrait: '', choices: [{ text: 'A. “你骗了我……对吧？”', label: 'ch4_a' }, { text: 'B. 先观察她手中的绳子。', label: 'ch4_b' }, { text: 'C. 立刻发动言灵，把阿久津从麻矢身体里拖出来。', label: 'ch4_c' }]},
    // —— 分支 A：直接摊牌 ——
    { speaker: '小黑', text: '我不停做深呼吸，穿过铁栅栏的空隙，缓缓来到麻矢的面前。“你骗了我……对吧？”', portrait: 'cat_ponder', label: 'ch4_a'},
    { speaker: '小黑', text: '“你根本没丧失记忆！你打从一开始就知道白木麻矢是沙耶香的妹妹，但是你因为不想让我知道这项事实，而创作出柏村摩智子这个虚构的人物。”', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '“一切都是你演的戏。你通过欺骗我得到白木麻矢的记忆之后，成功从地下研究室得到你的目标物，也就是白木麻矢本人藏起来的HLTV新药资料才是你的目的，对吧？”', portrait: 'cat_alert'},
    { speaker: '小黑', text: '麻矢嘴唇紧闭，不发一语。我静候麻矢的回答，或叙述想要听到“你搞错了”的否定，紧张让我的全身泛起细微的颤抖。', portrait: 'cat_ponder'},
    { speaker: '麻矢？', text: '“小黑……我……”', portrait: 'ms_mr'},
    { speaker: '小黑', text: '“别靠过来！你今天早上对我下药，打算趁这时候躲起来吧？我要你立刻回答我的问题，不然我就直接把你从那副身体中拖出来。”', portrait: 'cat_ponder'},
    { speaker: '麻矢', text: '我和麻矢隔著几公尺对视，最后麻矢低下头，微弱说道。“……对不起……事情就如同你所说的。”', portrait: 'ms_mr'},
    { speaker: '麻矢？', text: '“一开始遇到你，我一心想著如何达成我的目的，所以不假思索就撒谎。后来我好几次都想说出实情，但一想到你会反对……而且我也不想让你卷进危险，才用了木天蓼……这是我必须自己解决的问题。”', portrait: 'ms_smile'},
    { speaker: '小黑', text: '“反对你要做的事情？这不是废话吗。放火烧地下研究室、杀害峰岸诚，难不成你以为我会赞成这种行径吗？” 我还是尽快把麻矢──不对，阿久津一也从白木麻矢的身体拖出来吧。', portrait: 'cat_alert'},
    { speaker: '麻矢', text: '“什……等一下，我才没做出那种事！” 猛然抬起脸的麻矢左右摇头。', portrait: 'ms_mr'},
    { speaker: '小黑', text: '“现在想要装傻也没用，我全部都知道了，阿久津一也！”', portrait: 'cat_ponder'},
    { speaker: '麻矢', text: '“阿久津……一也？” 麻矢结结巴巴地说出这个名字。 “小黑，这是个误会！”', portrait: 'ms_mr'},
    { speaker: '小黑', text: '“闭嘴！” 我大吼，开始集中精神，对上麻矢的视线。麻矢的表情瞬间扭曲了起来。', portrait: 'cat_alert'},
    { speaker: '麻矢', text: '麻矢正紧咬牙关，试图抵抗我的干预。“我、我是……”', portrait: 'ms_mr'},
    { speaker: '小黑', text: '麻矢用细如蚊蚋的声音喃喃低语，而后颓然崩落般地跪倒在地。就在此时，麻矢动作僵硬地抬头望向我。在那双宛如求助的视线注视之下，我情不自禁地减弱对魂魄的干预。麻矢抓住这个瞬间，大大地吸一口气。', portrait: ''},
    { speaker: '麻矢？', text: '“我才不是阿久津一也！我是沙耶香！小泉沙耶香啊！”', portrait: 'sy_jz'},
    { speaker: '小黑', text: '“小泉……沙耶香？我在椿桥看过变成地缚灵的小泉沙耶香魂魄，你一定又打算骗我吧。”我不可置信道。', portrait: 'cat_ponder'},
    { speaker: '麻矢？', text: '“不是我。我想，那个人……应该是我丈夫小泉昭良的魂魄。”', portrait: 'sy_jz'},
    { speaker: '小黑', text: '我停止呼吸。那人确实不曾说自己是小泉沙耶香，小泉昭良在深爱妻子遇害的地点，化成地缚灵的模样吗？确实说得通。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '“你是……”', portrait: 'cat_sigh'},
    /* ===== 第二次选择：A / B / C / D（台本 chapter4多结局部分.docx）===== */
    { speaker: '', text: '', portrait: '', choices: [{ text: 'A. 白木麻矢', label: 'ch4_wrong' }, { text: 'B. 阿久津一也', label: 'ch4_wrong' }, { text: 'C. 小泉沙耶香', label: 'ch4_right' }, { text: 'D. 小泉昭良', label: 'ch4_wrong' }]},
    // —— A / B / D：错误的指认 ——
    { speaker: '小黑', text: '“不对……你在撒谎！”', portrait: 'cat_alert', label: 'ch4_wrong'},
    { speaker: '小黑', text: '我再次强行干预魂魄。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '但这次，麻矢体内的灵魂没有抵抗，只是发出绝望的悲鸣。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '我错过了唯一能听她说完的机会。', portrait: 'cat_alert'},
    { speaker: '', text: '', portrait: '', ending: '坏结局 · 错误的指认', goto: 'hall.html' },
    // —— C：小泉沙耶香（正确）——
    { speaker: '小黑', text: '“如、如果你是小泉沙耶香，你怎么会想进入妹妹的身体？”', portrait: 'cat_alert', label: 'ch4_right'},
    { speaker: '沙耶香', text: '“我是为了守护她……我做的一切都是为了守护她。” 麻矢摇摇晃晃地站起身，“那一晚，在我从地下研究室回家的途中……我被人从后方刺了一刀，一无所知地像垃圾一样地被丢到桥下……我还有非做不可的事情啊……”', portrait: ''},
    { speaker: '沙耶香', text: '“于是我就遭到依恋束缚，开始漫无目的地在街上仿徨，后来我听到传闻说昭良也遭遇不幸。我明白他是遭到杀我凶手的毒手，但是我却束手无策。”', portrait: ''},
    { speaker: '沙耶香', text: '“我想昭良说不定也和我一样徘徊在人间，所以试著寻找他，结果却没能找到他在哪里。因为我无论如何都无法接近那座桥，我实在太过害怕了……”', portrait: ''},
    { speaker: '小黑', text: '啊，打算前往椿桥的时候，麻矢之所以脸色铁青地拒绝，理由原来是因为这个……不，等一下，这依然有可能是阿久津的骗局，我维持著警戒状态，聆听麻矢的说明。', portrait: 'cat_alert'},
    { speaker: '沙耶香', text: '“我一心以为昭良成佛了，尽管很不甘心尚未知道凶手身份，不过既然妹妹愿意继承并完成我的研究，我决定在见证研究完成之后，就将这一切画上句点，前往昭良先我一步而去的场所。然而就在这个时候，妹妹被人开车撞上，陷入昏迷……”', portrait: 'sy_jz'},
    { speaker: '小黑', text: '沙耶香神色一沉，然后继续说。', portrait: 'sy_jz'},
    { speaker: '沙耶香', text: '“杀害我的凶手如果知道我妹妹还活著，想必会再下毒手，所以我得想办法保护她才行。于是我再次开始在镇上徘徊，结果得知了连南乡董事长都死于非命的消息，还发现追查事件的刑警先生成了南方制药公司的地缚灵。然后，你出现了……”', portrait: ''},
    { speaker: '小黑', text: '“……就算是这样，为什么一开始见面的时候，你不把这些说出来呢？”我眯起眼睛。', portrait: 'cat_ponder'},
    { speaker: '沙耶香', text: '“因为你说你跟那个引路人是一伙的嘛……引路人每次都不肯听我说明，即使我费尽唇舌，也只会说『前往吾主身边吧』，我才认为小黑也是一样……”', portrait: 'sy_jz'},
    { speaker: '小黑', text: '的确，刚来人间的我只会机械的重复这句话。但这一个多月来的点点滴滴，我相信我见到的麻矢是一个充满爱心的人，而不是冷酷无情的连环杀手。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '但我还有很多疑问。', portrait: 'cat_ponder'},
    /* ===== 第三次选择：四问（选过的置灰，四个都问过才出现 E）===== */
    { label: 'ch4_q3', speaker: '', text: '', portrait: '', ask: { id: 'ch4_q3', options: [{ text: 'A. “南乡董事长的资料在哪里？”', jump: 'q3_a', once: true }, { text: 'B. “阿久津一也已经死了，你知道吗？”', jump: 'q3_b', once: true }, { text: 'C. “你为什么害怕椿桥？”', jump: 'q3_c', once: true }, { text: 'D. “你怀疑凶手是谁？”', jump: 'q3_d', once: true }], done: { text: 'E. 没有问题了。', jump: 'q3_e' } }},
    // —— A：资料在哪里 ——
    { speaker: '白木沙耶香', text: '“南乡董事长的资料放在他随身的包中被人抢走了；而麻矢的那一部分则一直放在实验室隐秘角落的USB中……实验室只有麻矢本人能进入，而今天我想在这里守株待兔。”', portrait: 'sy_jz', label: 'q3_a'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q3' },
    // —— B：阿久津已死 ——
    { speaker: '小黑', text: '“沙耶香，我希望你能冷静下来听我说……阿久津一也已经死了。”', portrait: 'cat_confident', label: 'q3_b'},
    { speaker: '白木沙耶香', text: '“啊？”沙耶香一脸错愕。', portrait: 'sy_fn'},
    { speaker: '小黑', text: '“警方检验是两个月前就死亡了。”我解释道，“并且没有我们死神的帮助，他的灵魂根本无法进入他人的肉体……”', portrait: 'cat_ponder'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q3' },
    // —— C：为什么害怕椿桥 ——
    { speaker: '沙耶香', text: '因为我在那里惨死了……我都不知道发生了什么，就像垃圾一样被丢到了桥下……', portrait: 'ms_mr', label: 'q3_c'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q3' },
    // —— D：怀疑凶手是谁 ——
    { speaker: '白木沙耶香', text: '“依然是阿九津，我以为他和我一样见到非洲儿童遭受传染病的惨状后有志于献身科研，却没想到他只是为了一己私利，宣扬要大面积使用临床试验，遭到拒绝后……”', portrait: 'sy_jz', label: 'q3_d'},
    { speaker: '小黑', text: '她的声音低了下去，也许是想起了妹妹的遭遇，她按住了胸口。', portrait: 'sy_jz'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q3' },
    // —— E：没有问题了 → 继续主线 ——
    { speaker: '白木沙耶香', text: '“那肯定是哪里搞错了。”沙耶香抬起了头，“我用小号邮箱给阿久津一也的手机发了一封邮件，告诉他如果想要剩下的资料，就今晚零点带着资料到顶楼来。我收到回信，‘明白，不过周围有警察的话，我就毁掉手上的资料’”', portrait: 'sy_jz', label: 'q3_e'},
    { speaker: '小黑', text: '阿久津？还是沙耶香？一直用恳切的眼神看着我。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '我深呼了一口气，喊道：', portrait: 'cat_ponder'},
    /* ===== 第四次选择：A / B / C（台本 chapter4多结局部分.docx）===== */
    { speaker: '', text: '', portrait: '', choices: [{ text: 'A. “别想再骗我了！”', label: 'ch4_4a' }, { text: 'B. “这是个陷阱，我们必须撤退！”', label: 'ch4_4b' }, { text: 'C. “既然如此，我们就去会会那个‘死人’。”', label: 'ch4_4c' }]},
    // —— A：强行剥离 → 坏结局 · 破裂的信任（无立绘无姓名）——
    { speaker: '', text: '“别想再骗我了！阿久津，给我滚出来！” 我咆哮着，不再理会她的任何辩解，将言灵的干预提升到了极限。', portrait: '', label: 'ch4_4a'},
    { speaker: '', text: '“不！小黑，求求你，零点马上就要到了——” 沙耶香发出绝望的惨叫，但在死神绝对的力量面前，那虚弱的魂魄瞬间被撕扯出麻矢的身体，化作点点惨白的荧光消散在空气中。', portrait: ''},
    { speaker: '', text: '失去灵魂支撑的麻矢如同断线的木偶，重重地摔倒在地，陷入了深度的昏迷。', portrait: ''},
    { speaker: '', text: '我喘着粗气，以为自己终于排除了威胁。', portrait: ''},
    { speaker: '', text: '然而，当午夜零点的钟声敲响时，顶楼的铁门被缓缓推开。', portrait: ''},
    { speaker: '', text: '走进来的是一个我绝对意想不到的人。', portrait: ''},
    { speaker: '', text: '他看着倒在地上昏迷不醒的麻矢，嘴角勾起一抹残忍的冷笑：“看来，连老天都在帮我。”', portrait: ''},
    { speaker: '', text: '我试图发动言灵，却发现刚才强行剥离灵魂已经耗尽了我所有的力量。我只能眼睁睁地看着他拿走实验室角落的USB，随后一把火点燃了整个房间。', portrait: ''},
    { speaker: '', text: '真相，连同麻矢的生命，彻底化为了灰烬。', portrait: ''},
    { speaker: '', text: '', portrait: '', ending: '坏结局 · 破裂的信任', goto: 'hall.html' },
    // —— B：撤退 → 坏结局 · 无尽的逃亡（无立绘无姓名）——
    { speaker: '', text: '“不能去顶楼！既然阿久津死了，回邮件的一定是那个连环杀手！我们现在去就是送死！”', portrait: '', label: 'ch4_4b'},
    { speaker: '', text: '我一把拉起虚弱的沙耶香，强行带着她向楼下冲去。', portrait: ''},
    { speaker: '', text: '“可是资料！那是麻矢的心血！”沙耶香挣扎着，但我的态度不容置疑。', portrait: ''},
    { speaker: '', text: '我们顺着消防通道一路狂奔，逃出了大楼。我以为我们躲过了一劫，但我们错了。', portrait: ''},
    { speaker: '', text: '真凶在顶楼没有等到人，立刻意识到了这是一个圈套。', portrait: ''},
    { speaker: '', text: '他不仅当场销毁了南乡董事长包里的那部分HLTV资料，还顺藤摸瓜锁定了麻矢的行踪。', portrait: ''},
    { speaker: '', text: '在接下来的日子里，我们每天都生活在被追杀的恐惧中。沙耶香为了保护妹妹的身体，灵魂力量日益衰竭，最终彻底消散。', portrait: ''},
    { speaker: '', text: '而失去资料的南方制药公司也随之破产，那些本可以被新药拯救的非洲儿童，永远失去了希望。 我虽然保护了麻矢的肉体，却让她在苏醒后，面对一个一无所有、充满绝望的世界。', portrait: ''},
    { speaker: '', text: '', portrait: '', ending: '坏结局 · 无尽的逃亡', goto: 'hall.html' },
    // —— C：会会那个“死人” → 继续主线 ——
    { speaker: '小黑', text: '半夜零点已经快到了。', portrait: '', label: 'ch4_4c'},
    { speaker: '小黑', text: '我吞一口口水。阿久津的生死问题再多想也没用，答案马上就要送上门了。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '脚步声逐渐变大，最后一道人影出现在我们眼中。对方穿着大衣，身材修长，脸上则被口罩和墨镜遮著，无法确认长相，背上还背著一个小背包。', portrait: 'fa_beg'},
    { speaker: '小黑', text: '男人走出顶楼入口，缓缓环顾四周。沙耶香迅速用力扯动绳子，入口的门猛然关上。', portrait: ''},
    { speaker: '小黑', text: '同时，简易式的锁发出喀锵一声，锁住入口的门。一个牢笼当场完成。', portrait: 'fa_beg'},
    { speaker: '男人', text: '被关在铁笼之中的男人慢慢地望向我们的方向。“……好久不见了，阿久津学弟。”', portrait: 'sy_jz'},
    { speaker: '小黑', text: '步出阴影处的沙耶香声音微微发颤。沙耶香放开绳子，从包包中取出电击棒。', portrait: 'sy_fn'},
    { speaker: '白木沙耶香', text: '“你被关在那个铁笼里面了，乖乖交出从南乡董事长身上抢来的研究资料吧。轻举妄动的话，我就用电击棒让你安分一点。只要你交出研究资料，我就告诉你简易锁的密码。”', portrait: 'sy_fn'},
    { speaker: '小黑', text: '男人几乎毫不犹豫便将USB拋向沙耶香。沙耶香一把接住随身碟。', portrait: 'fa_beg'},
    { speaker: '小黑', text: '……太奇怪了，太顺利了。如果那个男人就是阿久津一也，他绝不可能如此轻易交出资料。无法言喻的不安在我胸中逐渐膨胀。', portrait: 'cat_alert'},
    { speaker: '白木沙耶香', text: '接下USB的沙耶香立即奔向放在地上的笔记型电脑。“小黑，帮我监视阿久津！他有什么可疑举动的话就告诉我。”', portrait: 'sy_jz'},
    /* ===== 第五次选择：A / B / C（台本 chapter4多结局部分.docx；无坏结局）===== */
    { speaker: '', text: '', portrait: '', choices: [{ text: 'A. 试着干预男人的魂魄。', label: 'ch4_5a' }, { text: 'B. 静观其变，先看沙耶香检查资料。', label: 'ch4_5main' }, { text: 'C. 提醒沙耶香注意男人的背包。', label: 'ch4_5main' }]},
    // —— A：多 4 句后汇入主线 ——
    { speaker: '小黑', text: '我于是试着干预男人的魂魄。', portrait: 'cat_ponder', label: 'ch4_5a'},
    { speaker: '小黑', text: '想来虽然不会像进入他人记忆那般简单，不过只要能成功控制对方，就能确保事情安全进行。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '“呜喵！”', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '下一瞬间，我就扬起惨叫，向后弹跳退开。刚才就在尝试的瞬间，一股浊黑滚腾的热流反扑而来。', portrait: 'cat_shocked'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_5main' },
    // —— 主线（B/C 直接进这里；A 也是）——
    { speaker: '小黑', text: '沙耶香睁大双眼敲打键盘。', portrait: '', label: 'ch4_5main'},
    { speaker: '小黑', text: '随后浮现欢喜雀跃的表情。', portrait: ''},
    { speaker: '沙耶香', text: '“这份资料是真的！不会错的，这就是南乡董事长的那份资料！”', portrait: 'sy_xy'},
    { speaker: '小黑', text: '难道这一切是我杞人忧天吗？', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '下一刻，沙耶香脸上的笑容就有如潮水退潮一般逐渐消褪。', portrait: ''},
    { speaker: '沙耶香', text: '“为什么没有网了？”', portrait: 'sy_jz'},
    { speaker: '男人', text: '男人第一次出声，隔着口罩的声音显得低沉模糊。', portrait: 'fa_beg'},
    { speaker: '男人', text: '“……原因是这个。”', portrait: 'fa_beg'},
    { speaker: '小黑', text: '他从背包中拿出类似对讲机的机器，放在顶楼的地面上。', portrait: ''},
    { speaker: '小黑', text: '这是妨碍电波的装置。', portrait: ''},
    { speaker: '沙耶香', text: '“我不管你是谁，快点关掉那个机器，不然我就要报警。”', portrait: 'sy_jz'},
    { speaker: '男人', text: '“报警？手机不能用，你要怎么报警呢？如果大喊，这里距离教职员大楼有一段距离，你真的觉得警察会注意到？你可没法从那里脱身。”', portrait: 'fa_beg'},
    { speaker: '小黑', text: '沙耶香喘着气怒吼。男人慢慢接近铁栅栏的门，然后拿起门上的挂锁，挂锁随着喀锵一声打开了。', portrait: ''},
    { speaker: '小黑', text: '沙耶香从喉咙中冒出小声悲鸣。男人打开门，步出铁笼。', portrait: ''},
    { speaker: '小黑', text: '“为什么？为什么这家伙会知道挂锁的密码？”我慌张地奔向沙耶香的脚边。', portrait: 'cat_alert'},
    { speaker: '沙耶香', text: '“我不知道，他明明不可能知道啊……”', portrait: 'sy_jz'},
    { speaker: '男人', text: '“怎么了，麻矢同学，你还没发现？我不是老跟你说，你有注意力涣散的问题，这就研究者而言是相当大的缺陷。”', portrait: 'fa_beg'},
    { speaker: '沙耶香', text: '“骗人……怎么可能……”', portrait: 'sy_jz'},
    { speaker: '小黑', text: '此时男人脱下帽子，接着拿下了脸上的墨镜和口罩。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '露出的脸让我顿时合不拢嘴。', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '和网页上的照片一样，是游港大学药学系教授的峰岸诚教授。', portrait: 'cat_shocked'},
    { speaker: '峰岸', text: '“嗨，麻矢同学，好久不见。”他用宛如早上见面打招呼般的轻松语气道。', portrait: 'fa_lx'},
    { speaker: '沙耶香', text: '“为、为什么峰岸老师会……？你不是应该被阿久津杀了……”', portrait: 'sy_jz'},
    { speaker: '峰岸', text: '“不不，刚好相反，是我杀了阿久津同学。”峰岸嘲弄地看着我们，两端嘴角扬起。', portrait: 'fa_lx'},
    { speaker: '峰岸', text: '“你还不懂吗？缺乏想象力呢。所有人都是我杀的，不论是阿久津，南乡董事长，还是小泉昭良，以及……你的姐姐。”', portrait: 'fa_lx'},
    /* ===== 第六次选择：质问五问（选过的置灰；五问全问过才出现 F）===== */
    { label: 'ch4_q6', speaker: '', text: '', portrait: '', ask: { id: 'ch4_q6', options: [{ text: 'A. “为什么杀小泉沙耶香？”', jump: 'q6_a', once: true }, { text: 'B. “为什么杀阿久津？”', jump: 'q6_b', once: true }, { text: 'C. “为什么嫁祸小泉昭良？”', jump: 'q6_c', once: true }, { text: 'D. “为什么撞白木麻矢？”', jump: 'q6_d', once: true }, { text: 'E. “你怎么知道挂锁密码？”', jump: 'q6_e', once: true }], done: { text: 'F. 不问了，趁他炫耀时观察环境。', jump: 'q6_f' } }},
    // —— 质问 A：为什么杀小泉沙耶香 ——
    { speaker: '峰岸', text: '“为什么？因为你姐姐先一步发现了治疗物质啊。我多年来都在找那种物质，都是因为有我的研究才能找到那种物质！结果那个女人竟然想把这个发现当作自己的功劳。”', portrait: 'fa_lx', label: 'q6_a'},
    { speaker: '沙耶香', text: '“就因为这件事就想要杀了我吗？以我们实验室的名义发布，就可以避免南方制药公司专利权等诸多问题……”', portrait: 'sy_fn'},
    { speaker: '峰岸', text: '“哼，你姐也像这样啰嗦，不过我清楚那个女人想嘲笑我，想在那篇划时代的论文列名为第一作者，然后把我的名字放在后面，好让自己看起来比我更伟大！”', portrait: 'fa_lx'},
    { speaker: '小黑', text: '大概是释放了压抑已久的情绪，峰岸大口吐气后仰望着天空，脸上缓缓浮现恍惚的表情。', portrait: 'fa_lx'},
    { speaker: '峰岸', text: '“刺杀你姐姐就像昨天的事情一样历历在目。我花了好几天筹划，最后完美地执行了计划。我的计划完美无缺……那些留在我手上的触感……”', portrait: 'fa_xe'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q6' },
    // —— 质问 B：为什么杀阿久津 ——
    { speaker: '峰岸', text: '“三月，阿久津终于告诉我实验已经进入到了尾声。新药已经制好，他却因为不能被临床试验而苦恼不堪。我一边安慰着他，一边在背后用绳子勒住了他的脖子。”', portrait: 'fa_lx', label: 'q6_b'},
    { speaker: '峰岸', text: '“我把阿久津的遗体一起沉进池底，让他看起来像是开车撞你后自杀了。这样有需要的话，我就能让他成为我的代罪羔羊。”', portrait: 'fa_lx'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q6' },
    // —— 质问 C：为什么嫁祸小泉昭良 ——
    { speaker: '峰岸', text: '“哦，昭良啊。毕竟我需要一个代罪羔羊。我稍早前听你们说过夫妇一起投保的事情，他信我，个性单纯又容易操纵。我想要让他当犯人，就事先散播夫妇关系濒临破裂的传闻之类，于是，他成为警方的嫌疑犯，然后前来找我商量。”', portrait: 'fa_lx', label: 'q6_c'},
    { speaker: '峰岸', text: '“我先让他凭借研究的争执以为阿久津就是凶手，案发当天，我骗昭良说阿久津联络我，说他‘铸下大错’，昭良轻易就相信了。向复仇心切的他提出建议，让他利用地下研究室和研究大楼之间的秘密通道制造不在场证明，简直是易如反掌啊。他真的很爱沙耶香呢，就连我是杀害妻子的真凶都一无所知。”', portrait: 'fa_lx'},
    { speaker: '沙耶香', text: '“……你知道地下研究室的事情，对啊。”', portrait: 'sy_fn'},
    { speaker: '峰岸', text: '“嗯？我曾经是和他一起研究的伙伴。顺带一提，我也从阿久津和南乡董事长他们两人口中，得知研究室在进行新型抗HLTV药物的研究。毕竟他们比起昭良对我更是满心信赖。”', portrait: 'fa_nq'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q6' },
    // —— 质问 D：为什么撞白木麻矢 ——
    { speaker: '峰岸', text: '“把南乡推到马路上抢走资料后，我开着他的车策划了对你的撞击。没想到你竟然提前把资料藏到了实验室里，我只能耐心地等待你的苏醒。”', portrait: 'fa_lx', label: 'q6_d'},
    { speaker: '峰岸', text: '“由于我的目标只是抢走资料，所以我短暂开机了阿久津一也的手机，又将自己的血样洒在办公室里。虽然会被发现，但一两天内应该可以避避风头。”', portrait: 'fa_lx'},
    { speaker: '峰岸', text: '“正如我的计划，你果然主动联系了我。虽然没法大摇大摆回去当‘峰岸诚’了，但我已经联系好了国外某制药公司，到时……”', portrait: 'fa_lx'},
    { speaker: '小黑', text: '峰岸又露出了恶心的笑容，想必他已经在描绘他未来的人生了。', portrait: 'fa_lx'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q6' },
    // —— 质问 E：你怎么知道挂锁密码 ——
    { speaker: '峰岸', text: '“挂锁密码？你从以前就习惯把重要东西藏在实验室角落，也习惯用同一个日期做密码。你妹妹也知道，昭良也知道。我只要稍微问过昭良，就够了。”', portrait: 'fa_lx', label: 'q6_e'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_q6' },
    // —— F：不问了，趁他炫耀时观察环境 → 主线（战斗 → 峰岸坠楼 → 收束）——
    { speaker: '小黑', text: '峰岸站得很近，匕首在右侧口袋。电波干扰器放在地面，门上方薄片还在闪红灯。', portrait: 'cat_ponder', label: 'q6_f'},
    { speaker: '小黑', text: '沙耶香手里的电击棒没有丢。USB在电脑旁。', portrait: 'cat_ponder'},
    { speaker: '峰岸', text: '“多说无益，快把试验资料给我吧。”峰岸掏出一把匕首，逼近了过来。', portrait: 'fa_nq'},
    { speaker: '小黑', text: '面对这个强悍高大的男人，只凭麻矢的身体与我现在的样子，是一定无法通过肉搏战斗的。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '通过“更灵活的身法”，巧妙取胜吧。', portrait: 'cat_ponder', goto: 'attackboss.html'},
    { speaker: '小黑', text: '几番交战后，我瞅准时机，“喵呜！”', portrait: 'cat_alert'},
    { speaker: '小黑', text: '我借助麻矢的肩膀高高跃起，右前脚用力一划。锋利的猫爪划过峰岸的眼睛，击中的手感结结实实传递到肉球。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '峰岸用右手捂着脸，发出惨叫。不过即使失去了视觉，他依旧没停下脚步。', portrait: 'fa_xe'},
    { speaker: '小黑', text: '“沙耶香，快躲开！”', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '沙耶香看到峰岸手拿刀子逐渐逼近的身影，扬起小小的惨叫。她情急之下往旁一跳，不过因为我的利爪而失去视觉的峰岸并未对此做出反应。', portrait: 'sy_jz'},
    { speaker: '小黑', text: '峰岸伸出握着小刀的左手，朝著沙耶香几秒前的所站位置猛力一刺，结果身体收不住冲势，腰就这样撞上了栏杆。', portrait: 'fa_end'},
    { speaker: '小黑', text: '失去平衡的峰岸以腰部为支点，身体跌向前方，双手在一片虚空之中伸长攀抓，最后峰岸就像失衡的天平一样，身体逐渐倾向栏杆的外侧。', portrait: 'fa_end'},
    { speaker: '小黑', text: '下一刻，峰岸向栏杆的外侧翻落，在重力的拉扯下缩短他与地面之间几十公尺的距离。峰岸发出的惨叫逐渐转小，然后是一声沉重的闷响。', portrait: 'fa_end'},
    { speaker: '小黑', text: '“先把资料上传！”', portrait: 'cat_alert'},
    { speaker: '小黑', text: '麻矢点点头，冲向电脑。我向地面望去——那些过于邪恶的灵魂，就算是死神也不会将他们收走。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '峰岸倒在地上。他的灵魂飘了出来，他的表面甚至还覆盖有一层黑色粘液的物质，看起来丑陋又恶心。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '在他的尸体底下，一根触手以灵活的动作刺穿了峰岸的魂魄，霎时，我彷佛听到耳边响起垂死挣扎的惨叫。处理完峰岸的魂魄，他们彷佛溶解在夜晚的黑暗似地消失隐散，留下躺在原地的遗体。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '亲眼目睹完一切的我屁股向后一坐，用力地呼了一口气，因为亢奋而被我遗忘的疼痛再次袭上身体。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '这时，一条手臂突然环住身体。我吃惊地回头一看，见到沙耶香泪流不止的脸庞。', portrait: 'cat_confident'},
    { speaker: '沙耶香', text: '“小黑、小黑、小黑……”沙耶香紧紧抱著我，喉间流泄出小小呜咽，不停呼唤我的名字。我放松紧绷的身体。', portrait: 'sy_xy'},
    { speaker: '小黑', text: '“沙耶香，你成功寄出资料了吗？”', portrait: 'cat_confident'},
    { speaker: '小黑', text: '沙耶香连点了好几次头，然后把脸埋进我背部的毛皮中。', portrait: 'sy_xy'},
    { speaker: '小黑', text: '我在沙耶香的怀中扭动身体转回正面，伸出两只前脚的肉球，按在沙耶香跪坐的两膝之上踩了踩。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '“那么沙耶香，我们也差不多该回去了，回到我们的家。”', portrait: 'cat_confident'},
    { speaker: '小黑', text: '沙耶香慢慢松开抱着我的手臂，被泪水濡湿的脸庞泛起微笑。', portrait: 'sy_xy'},
    { speaker: '小黑', text: '那正是她总是向我展现的微笑。', portrait: 'sy_xy'},
    { speaker: '沙耶香', text: '“嗯，我们回去吧……回到我们的家。”', portrait: 'sy_xy', achieve: 'curtain'},
    { speaker: '', text: '', portrait: '', jump: 'ch5_start' },
    // —— 分支 B：先观察绳子（两句后汇入 A）——
    { speaker: '小黑', text: '她手里的绳子……和门把上的绳子是一套。', portrait: 'cat_ponder', label: 'ch4_b'},
    { speaker: '小黑', text: '她不是来杀人的，她是在布置什么。', portrait: 'cat_ponder'},
    { speaker: '', text: '', portrait: '', jump: 'ch4_a' },
    // —— 分支 C：强行剥离 → 坏结局 ——
    { speaker: '小黑', text: '“别装了，阿久津！给我出来！”', portrait: 'cat_alert', label: 'ch4_c'},
    { speaker: '小黑', text: '我直接将言灵干预提升到极限。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '但下一瞬间，麻矢体内传来一股异常熟悉的抵抗。', portrait: 'cat_alert'},
    { speaker: '小黑', text: '那不是阿久津，而是另一个魂魄的悲鸣。', portrait: 'cat_alert'},
    { speaker: '白木沙耶香', text: '“不……不要……这是我妹妹的身体……”', portrait: 'sy_fn'},
    { speaker: '小黑', text: '魂魄被强行撕扯，麻矢的身体像断线木偶一样倒下。', portrait: 'sy_fn'},
    { speaker: '小黑', text: '我犯下了无法挽回的错误。', portrait: 'sy_fn'},
    { speaker: '', text: '', portrait: '', ending: '坏结局 · 过早的剥离', goto: 'hall.html' },
    /* ===== 下一段从这里继续：分岔点「“你骗了我……对吧？”」→ ①观察她手中的绳子 / ②发动言灵（坏结局·过早的剥离）===== */
    // 【chapter】===== Chapter 5 后日谈 =====
    // 【场景】【背景X复用】
    { label: 'ch5_start', chapter: 'Chapter 5 后日谈', speaker: '小黑', text: '自从那场我们在晴明大学理科大楼顶楼，和峰岸诚之间展开的对峙落幕之后，迄今已经过两周。在这两周间，有关这一连串事件的情况有了相当巨大的变化。', portrait: 'cat_proud', bgm: '曙光良镇', bg: 'scene_10'},
    { speaker: '小黑', text: '首先是理应已经遭到杀害的峰岸从理科大楼的顶楼坠楼而死，警方似乎因此陷入不小的混乱状态。我和沙耶香回家之前，自然已经抹消了我们在顶楼留下的一切痕迹，所以警方并不知道这件事与白木麻矢有关。', portrait: 'cat_sigh', bgm: '不安的梦魇', bg: 'scene_15'},
    { speaker: '白木沙耶香', text: '此外，沙耶香提及自己回想起被撞当时的事情，声称“当时开车的是峰岸诚，他低头看著我，告诉我‘你就要步上你姊姊、姊夫以及阿久津的后尘，成为我手下的亡魂。’”', portrait: 'sy_jz', bgm: '日出与否'},
    { speaker: '小黑', text: '警方以此为契机，开始朝峰岸诚是小泉夫妇和阿久津一也等案的凶手，试图伪造自己的死亡以逃离搜捕，不过最后自知难逃而选择自杀的方向思考。', portrait: 'cat_confident'},
    { speaker: '久住淳', text: '久住先前上门拜访，说明搜查情形，表示案件以嫌疑犯峰岸诚死亡的结果送交地检署。详细情形我不太清楚，不过听沙耶香的讲法，似乎类似由于嫌疑犯身亡，案件便就此结案的感觉。想来这应该是最好的结果。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '沙耶香在两周前寄送出去的研究资料，在全世界的研究者之间似乎引起广大回响。沙耶香随资料附上的那段开放版权的讯息引起了巨大反响，目前以几家制药公司为中心的研究Project已经在筹备。', portrait: 'cat_proud'},
    { speaker: '小黑', text: '在又一个晴日，沙耶香叫住了我。', portrait: 'cat_ponder'},
    { speaker: '白木沙耶香', text: '“在去吾主那里之前，小黑能带我去一次椿桥吗？”', portrait: 'sy_xy'},
    // 【CG】插入 CG4】
    // 【场景】【背景V复用】
  
    { label: 'ch4_join', speaker: '小黑', text: '我识趣地避开了夫妇亲热的画面，相信不久之后，地缚灵的怨念解开，他们也一定会在吾主那里幸福地生活的。', portrait: 'cat_speechless', bgm: '黑猫的夜曲_变奏', bg: 'scene_5', cg: 'CG4'},
    { speaker: '小黑', text: '回到这个熟悉的角落，今天似乎有什么不同……仔细观瞧，天花板上飘着一团光雾。', portrait: 'cat_confident'},
    { speaker: 'Boss', text: '“‘小黑’，你的工作成效完全超乎想像喔，竟然在短短期间就解开不少地缚灵的依恋。”', portrait: ''},
    { speaker: '小黑', text: 'Bo……Boss!我不可置信地摇摇脑袋。', portrait: 'cat_shocked'},
    { speaker: 'Boss', text: '“所以呢，考虑到辉煌成果，只要你想要，我可以马上让你回到引路人的岗位喔。”', portrait: ''},
    { speaker: '小黑', text: '“真的吗！”', portrait: 'cat_shocked'},
    { speaker: '小黑', text: '我情不自禁地探出身体，Boss便再用言灵回答了一遍：“嗯，真的喔”。', portrait: ''},
    { speaker: '小黑', text: '我现在马上──就能回到原本的职位──回去当引路人。我应该立即说好，毕竟这才是我本来的目标。', portrait: 'cat_ponder'},
    { speaker: '小黑', text: '我应该立即说好……', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '“……恕我回绝。”我几乎毫不迷惘地作出回答。', portrait: 'cat_sigh'},
    { speaker: '小黑', text: '“哦，为什么？”Boss似乎已经预感到了我这么回答，带着笑意问道。', portrait: ''},
    { speaker: '小黑', text: '“因为……我还要守护真正的麻矢啊。”', portrait: 'cat_confident'},
    { speaker: '小黑', text: '没错，这就是我找到的崭新工作。这可是我最重要的朋友的妹妹哦。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '我会告诉她她昏迷时发生的一切，告诉她的姐姐与她的朋友们是多么的善良勇敢。', portrait: 'cat_confident'},
    { speaker: '小黑', text: '那时，在湛蓝天穹的另一端，他们一定会微笑地注视着你吧。', portrait: 'cat_confident', achieve: 'catknows'},
    /* 结局卡：同样用「章节卡」的呈现形式（整屏渐黑 → 文字渐显渐隐 → 渐显画面）。
       演完之后 auto:true 让它自动渐黑跳页，goto 回主菜单（无需再点一下）。 */
    { chapter: '达成结局：夏日启示录', speaker: '', text: '', portrait: '', goto: 'hall.html', auto: true},
    // 【成就】【弹出成就：只有猫知道】
  ];

  /* ---------------- 章节标记（供存档的章节标注/读取页展示使用） ----------------
     ★ 现在**运行时从 DEMO_LINES 的 chapter 字段推导**（每章第一句的下标）。
       以前这里写死过一组数字，台词一增删就漂（曾经 Chapter 5 标在 442、实际在 512），
       于是存档槽会显示错误的章节名，achieve.js 的「通关成就」判定点也跟着错。
       下面的 FALLBACK 只在台词里一个 chapter 字段都没有时才用。 */
  var STORY_MARKS_FALLBACK = [
    { at: 0,   name: 'Chapter 0 亲临人间的死神' },
    { at: 55,  name: 'Chapter 1 樱花时节的遗书' },
    { at: 90,  name: 'Chapter 2 二重身的研究室' },
    { at: 172, name: 'Chapter 3 背负诅咒的刺身' },
    { at: 234, name: 'Chapter 4 灵魂深处的面具' },
    { at: 512, name: 'Chapter 5 后日谈' }
  ];
  var STORY_MARKS = (function () {
    var out = [], seen = {};
    for (var mi = 0; mi < DEMO_LINES.length; mi++) {
      var ln = DEMO_LINES[mi];
      var ch = ln && ln.chapter;
      /* ★ 只把「Chapter N …」当章节标记：开篇的改编声明、结尾的「达成结局：…」
         这些卡也走章节卡的呈现形式，但它们不是章节，不能占掉章节序号
         （否则章节序号会整体错位，章节名/跳章等显示都会错）。 */
      if (ch && /^Chapter\s+\d+/i.test(String(ch)) &&
          !Object.prototype.hasOwnProperty.call(seen, ch)) {
        seen[ch] = 1;
        out.push({ at: mi, name: String(ch) });
      }
    }
    return out.length ? out : STORY_MARKS_FALLBACK;
  })();

  /* 第 idx 句所属章节名 */
  function chapterNameAt(idx) {
    var name = STORY_MARKS.length ? STORY_MARKS[0].name : '';
    for (var m = 0; m < STORY_MARKS.length; m++) {
      if (STORY_MARKS[m].at <= idx) name = STORY_MARKS[m].name;
      else break;
    }
    return name;
  }

  root[NS].storyLines = DEMO_LINES;
  root[NS].storyMarks = STORY_MARKS;

  function startDemo() {
    if (root.__VN_NO_AUTO_DEMO__) return;
    /* 由读取存档页/游戏内读档设置的“待续玩指令”优先于自动从头播放 */
    var pending = root.__VN_PENDING_RESUME__;
    if (pending && typeof pending.index === 'number' && pending.index >= 0) {
      if (root.console) {
        root.console.info('[VN] 读取存档：从第 ' + pending.index + ' 句（' +
          chapterNameAt(pending.index) + '）继续。');
      }
      api.resumeStory(pending.index, pending.bgKey, pending.cgKey);
      return;
    }
    api.startStory(); /* 新游戏：自动从第一句开始逐字播放 */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDemo, false);
  } else {
    startDemo();
  }
})();

/* 菜单（VN.menu） */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  var widget = document.getElementById('vnMenu');
  var toggle = document.getElementById('vnMenuToggle');
  var list   = document.getElementById('vnMenuList');

  function warn(msg) {
    if (root.console && root.console.warn) root.console.warn('[VN · menu] ' + msg);
  }
  if (!widget || !toggle || !list) { warn('未找到 #vnMenu / #vnMenuToggle / #vnMenuList。'); return; }

  var items = Array.prototype.slice.call(list.querySelectorAll('.vn-menu__item'));
  var isOpen = false;

  /* 记录打开前的启用状态（关闭后恢复） */
  var textWasEnabled = true;

  function setTextEnabled(v) {
    if (root.VN && root.VN.text && root.VN.text.setEnabled) {
      root.VN.text.setEnabled(v);
    }
  }

  function textIsEnabled() {
    return !!(root.VN && root.VN.text && root.VN.text.isEnabled &&
              root.VN.text.isEnabled());
  }

  function openMenu() {
    if (isOpen) return;
    isOpen = true;
    widget.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    textWasEnabled = textIsEnabled();
    setTextEnabled(false);               /* 菜单打开时暂停剧情推进 */
  }

  function closeMenu() {
    if (!isOpen) return;
    isOpen = false;
    widget.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    setTextEnabled(textWasEnabled);      /* 恢复原推进状态 */
  }

  /* —— 圆形按钮：开/关 —— */
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    if (isOpen) closeMenu(); else openMenu();
  });

  /* —— 点击菜单外部：收起 —— */
  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    if (!(e.target && e.target.closest && e.target.closest('.vn-menu'))) {
      closeMenu();
      e.stopPropagation();
    }
  }, true);

  /* —— Esc 收起 —— */
  document.addEventListener('keydown', function (e) {
    if (isOpen && e.key === 'Escape') {
      closeMenu();
      e.stopPropagation();
    }
  }, false);

  /* —— 菜单项：点击后收起菜单 —— */
  items.forEach(function (a) {
    a.addEventListener('click', function (e) {
      closeMenu();
      var href = (a.getAttribute('href') || '').trim();
      if (href === '' || href === '#') {
        e.preventDefault();
        if (root.console) {
          root.console.info('[VN · menu] “' + a.textContent + '”尚未设置链接（href 仍为占位 "#"）。');
        }
      }
      /* href 为真实地址时不做拦截，交给浏览器正常跳转 */
    });
  });

  /* —— 对外接口 —— */
  root[NS].menu = {
    isOpen: function () { return isOpen; },
    open: function () { openMenu(); },
    close: function () { closeMenu(); },
    toggle: function () { if (isOpen) closeMenu(); else openMenu(); }
  };
})();

/* 场景背景（VN.scene） */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  var bgEl      = document.getElementById('vnBg');
  var img       = document.getElementById('vnBgImg');
  var blackout  = document.getElementById('vnBlackout');

  /* 章节标题层（index.html 内 #vnChapterTitle） */
  var chapterEl      = document.getElementById('vnChapterTitle');
  var chapterKickerEl = document.getElementById('vnChapterKicker');
  var chapterMainEl  = document.getElementById('vnChapterMain');

  function warn(msg) {
    if (root.console && root.console.warn) root.console.warn('[VN · bg] ' + msg);
  }
  if (!bgEl || !img || !blackout) {
    warn('未找到 #vnBg / #vnBgImg / #vnBlackout，场景背景不可用。');
    return;
  }

  /* ---------------- 背景注册表 ----------------
     来源：images/Backgrounds/（键名＝文件名，小写）；Scene_N 对应台本里的【场景N】
     与旧注册重名的一律改指 Backgrounds 里的新图；本表由 _register_backgrounds.js 生成 */
  var bgLib = {
    /* —— 场景（images/Backgrounds/Scene_N.png） —— */
    'scene_2': '../images/Backgrounds/Scene_2.png',   /* 场景II */
    'scene_3': '../images/Backgrounds/Scene_3.png',
    'scene_4': '../images/Backgrounds/Scene_4.png',   /* 场景IV */
    'scene_5': '../images/Backgrounds/Scene_5.png',   /* 场景V */
    'scene_6': '../images/Backgrounds/Scene_6.png',   /* 场景VI */
    'scene_7': '../images/Backgrounds/Scene_7.png',   /* 场景VII */
    'scene_8': '../images/Backgrounds/Scene_8.png',   /* 场景VIII */
    'scene_9': '../images/Backgrounds/Scene_9.png',   /* 场景IX */
    'scene_10': '../images/Backgrounds/Scene_10.png',   /* 场景X */
    'scene_11': '../images/Backgrounds/Scene_11.png',   /* 场景XI */
    'scene_12': '../images/Backgrounds/Scene_12.png',   /* 场景XII */
    'scene_13': '../images/Backgrounds/Scene_13.png',   /* 场景XIII */
    'scene_14': '../images/Backgrounds/Scene_14.png',   /* 场景XIV */
    'scene_20': '../images/Backgrounds/Scene_20.png',   /* 场景XX */
    /* —— 城镇 / 时段 —— */
    'morning_city': '../images/Backgrounds/morning_city.png',
    'night_city': '../images/Backgrounds/night_city.png',
    /* —— 旧占位图（DEMO_LINES 仍在用 bg1/bg2/bg3） —— */
   
  };
  root[NS].bgLib = bgLib;

  /* 过渡节奏（毫秒） */
  var FADE_OUT   = 800;   /* 淡出到黑 */
  var BLACK_HOLD = 500;   /* 黑屏停留（兼作等图加载的余量） */
  var FADE_IN    = 700;   /* 淡入新背景 */

  /* 章节标题转场节奏（毫秒）：淡出黑场 → 标题淡入 → 停留 → 标题淡出 → 淡入场景 */
  var TITLE_IN    = 900;  /* 标题逐渐显现 */
  var TITLE_HOLD  = 3500; /* 完全显现后的停留 */
  var TITLE_OUT   = 800;  /* 标题逐渐消失 */

  /* 尊重系统“减少动态效果”偏好：节奏减半 */
  var reduceMotion =
    root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rhythm(ms) { return reduceMotion ? Math.round(ms / 2) : ms; }

  var swapToken = 0;
  var busy = false;

  /* 初始图加载失败：移除 src，回退夜色基底 */
  img.addEventListener('error', function () {
    if (busy) return;                 /* 切景期间的失败交给 applyBg 处理 */
    if (img.getAttribute('src')) {
      warn('初始背景加载失败（已自动回退夜色基底）：' + img.getAttribute('src'));
      img.removeAttribute('src');
    }
  });
  if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
    warn('初始背景加载失败（已自动回退夜色基底）：' + img.getAttribute('src'));
    img.removeAttribute('src');
  }

  function resolveBg(ref) {
    if (ref === undefined || ref === null) return null;               /* 保持 */
    if (ref === '' || ref === 'none' || ref === 'hide') return false; /* 回基底 */
    if (Object.prototype.hasOwnProperty.call(bgLib, ref)) {
      var mapped = bgLib[ref];
      if (!mapped) return false;
      return String(mapped);
    }
    return String(ref);              /* 未登记：当作直接图片路径 */
  }

  /* 整屏黑场遮罩开关；黑场期间挡住鼠标，防止误操作 */
  function setBlackout(on, durMs) {
    blackout.style.transition = 'opacity ' + durMs + 'ms ease';
    blackout.style.opacity = on ? '1' : '0';
    blackout.style.pointerEvents = on ? 'auto' : 'none';
  }

  /* ref：键名 / 路径 / false 回基底 / null 不动 */
  function applyBg(ref, onDone) {
    var src = resolveBg(ref);
    if (src === null) return;                /* 未指定：保持现状 */

    /* 新一轮切景：作废旧轮次 */
    if (busy) swapToken++;

    var token = ++swapToken;
    busy = true;

    /* 同一张且空闲：直接完成，不闪黑 */
    if (src !== false && img.getAttribute('src') === src &&
        blackout.style.opacity !== '1') {
      busy = false;
      if (typeof onDone === 'function') setTimeout(onDone, 0);
      return;
    }

    function reveal() {
      if (token !== swapToken) return;
      setBlackout(false, FADE_IN);           /* 淡入新画面 */
      setTimeout(function () {
        if (token !== swapToken) return;
        busy = false;
        if (typeof onDone === 'function') onDone();
      }, FADE_IN + 60);
    }

    function swapAndReveal() {
      if (token !== swapToken) return;
      if (src === false) {
        img.removeAttribute('src');          /* 回夜色基底 */
        reveal();
        return;
      }
      /* 全黑时换图，加载完再淡入 */
      img.onload = function () {
        if (token !== swapToken) return;
        img.onload = null;
        img.onerror = null;
        setTimeout(reveal, BLACK_HOLD);
      };
      img.onerror = function () {
        if (token !== swapToken) return;
        warn('背景加载失败（请检查路径/文件）：' + src);
        img.removeAttribute('src');          /* 回夜色基底 */
        img.onload = null;
        img.onerror = null;
        setTimeout(reveal, 120);
      };
      img.setAttribute('src', src);
    }

    setBlackout(true, FADE_OUT);             /* ① 淡出到整屏黑场 */
    setTimeout(swapAndReveal, FADE_OUT + 60);/* ② 黑场 → 换图 → ③ 淡入 */
  }

  /* 静默换背景：不做黑场转场，直接把图换掉（不阻塞、无回调）
     供「章节句」在标题卡里使用：换图发生在屏幕全黑那一刻，玩家看不到过程，
     标题卡出现之前也就不会先露出新背景。
     keepToken=true 表示「由章节转场内部调用」，此时不要作废它自己的轮次令牌。 */
  function setBgSilently(ref, keepToken) {
    var src = resolveBg(ref);
    if (src === null) return false;          /* 未指定：保持现状 */
    if (!keepToken) swapToken++;             /* 外部调用：作废进行中的转场 */
    busy = false;
    img.onload = null;
    img.onerror = null;
    if (src === false) img.removeAttribute('src');
    else img.setAttribute('src', String(src));
    return true;
  }

  /* 单纯淡出到整屏黑（供“读完跳页/退出”等场景使用），完成后回调 */
  function toBlackScreen(onDone) {
    var token = ++swapToken;
    busy = true;
    setBlackout(true, rhythm(FADE_OUT));
    setTimeout(function () {
      if (token !== swapToken) return;
      busy = false;
      if (typeof onDone === 'function') onDone();
    }, rhythm(FADE_OUT) + 80);
  }

  /* ---------------- 章节标题转场 ----------------
     用于每章第一句台词前：整屏渐黑 → 屏幕中央的暗黑哥特章节标题
     逐渐显现并停留 → 标题逐渐消失 → 屏幕逐渐显现下一章画面。
     由 VN.text 在遇到带 chapter 字段的台词时调用；完成后回调以开始打字。 */
  function setChapterTitle(on, durMs) {
    if (!chapterEl) return;
    chapterEl.style.transition = 'opacity ' + durMs + 'ms ease';
    chapterEl.style.opacity = on ? '1' : '0';
  }

  /* 把章节名拆成“标识行 + 中文主标题”：
     “Chapter 1 樱花时节的遗书” → Chapter 1 / 樱花时节的遗书
     “序章 · 屋顶上的死神”      → 序章 / 屋顶上的死神        */
  function fillChapterTitle(name) {
    var s = String(name === undefined || name === null ? '' : name).trim();
    var kicker = '';
    var main = s;
    var m = /^(Chapter\s+[0-9]+)\s+(.+)$/i.exec(s);
    if (m) {
      kicker = m[1];
      main = m[2].trim();
    } else {
      var m2 = /^(.{1,12}?)\s*[·•]\s*(.+)$/.exec(s);
      if (m2) {
        kicker = m2[1].trim();
        main = m2[2].trim();
      }
    }
    if (chapterKickerEl) {
      chapterKickerEl.textContent = kicker;
      chapterKickerEl.classList.toggle('is-empty', kicker === '');
    }
    if (chapterMainEl) chapterMainEl.textContent = main;
  }

  /* 章节标题转场：整屏渐黑 → 标题渐显渐隐 → 渐显画面
     silentBg（可选）：本句的 bg 键。会在「屏幕已经完全黑掉」的那一刻静默换图，
     因此标题卡出现前后都不会先露出新背景，换图过程完全藏在黑场里。 */
  function playChapterIntro(name, onDone, silentBg, opts) {
    /* opts.keepBlack：标题消失后不揭幕，停在黑场里直接回调（供「连续的提示卡」使用，
       免得两张卡之间把视觉小说的背景露出来一闪；由调用方最后调 revealBlackout 揭幕） */
    var keepBlack = !!(opts && opts.keepBlack);
    var token = ++swapToken;         /* 作废旧轮次（含进行中的切景） */
    busy = true;

    function still() { return token === swapToken; }
    function finish() {
      busy = false;
      if (typeof onDone === 'function') onDone();
    }

    /* 没有标题层时：退化为一次干净的黑场开合，避免丢失过渡手感 */
    if (!chapterEl) {
      setBlackout(true, rhythm(FADE_OUT));
      setTimeout(function () {
        if (!still()) return;
        if (keepBlack) { finish(); return; }        /* 停在黑场，等下一张卡 / 调用方揭幕 */
        setBlackout(false, rhythm(FADE_IN));
        setTimeout(function () {
          if (!still()) return;
          finish();
        }, rhythm(FADE_IN) + 60);
      }, rhythm(FADE_OUT) + 80);
      return;
    }

    /* ① 屏幕渐黑（完全转成黑屏） */
    setBlackout(true, rhythm(FADE_OUT));
    setTimeout(function () {
      if (!still()) return;
      /* ② 黑定后：先把本句新背景静默换好（此刻全黑，玩家看不到换图），再写入标题并逐渐显现 */
      if (silentBg !== undefined && silentBg !== null) setBgSilently(silentBg, true);
      fillChapterTitle(name);
      setChapterTitle(true, rhythm(TITLE_IN));
      setTimeout(function () {
        if (!still()) return;
        /* ③ 停留后标题逐渐消失 */
        setChapterTitle(false, rhythm(TITLE_OUT));
        setTimeout(function () {
          if (!still()) return;
          /* ④ 标题消失后屏幕逐渐显现下一章画面（keepBlack：停在黑场里直接回调） */
          if (keepBlack) { finish(); return; }
          setBlackout(false, rhythm(FADE_IN));
          setTimeout(function () {
            if (!still()) return;
            finish();
          }, rhythm(FADE_IN) + 60);
        }, rhythm(TITLE_OUT) + 80);
      }, rhythm(TITLE_IN) + rhythm(TITLE_HOLD));
    }, rhythm(FADE_OUT) + 80);
  }

  /* 台词驱动的切景由文字引擎调用本层完成，这里不再监听 lineStart */

  /* —— 对外接口 —— */
  root[NS].scene = {
    /* 换背景（可传完成回调） */
    apply: function (ref, onDone) { applyBg(ref, onDone); },
    to: function (ref, onDone) { applyBg(ref, onDone); },
    hide: function () { applyBg(false); },
    isBusy: function () { return busy; },

    /* 章节标题转场（整屏渐黑 → 标题渐显渐隐 → 渐显画面）
       第三参 silentBg：可选；黑定那一刻静默切到该背景（把切景过程藏起来）
       第四参 opts.keepBlack：可选；标题消失后停在黑场不揭幕（连续提示卡用） */
    playChapterIntro: function (name, onDone, silentBg, opts) { playChapterIntro(name, onDone, silentBg, opts); },
    chapterTitle: function (name, onDone) { playChapterIntro(name, onDone); },

    /* 只把黑场淡出（配合 keepBlack 的提示卡序列：整串卡播完后由调用方揭幕） */
    revealBlackout: function (durMs) {
      setBlackout(false, (durMs === undefined || durMs === null) ? rhythm(FADE_IN) : durMs);
    },

    /* 纯淡出到黑（跳转/退出页面前调用） */
    fadeToBlack: function (onDone) { toBlackScreen(onDone); },
    blackout: function (onDone) { toBlackScreen(onDone); },

    /* 登记 / 修改背景键 */
    addBg: function (key, path) {
      if (key) bgLib[key] = (path === undefined) ? '' : String(path);
      return root[NS].scene;
    },
    getBgPath: function (key) { return resolveBg(key); },
    setBg: function (ref) { return setBgSilently(ref); },   /* 静默换景：无黑场转场 */

    /* 控制台演示 */
    demo: function () {
      if (busy) { warn('背景正在切换中，请稍候再试。'); return; }
      applyBg('场景·月下屋顶', function () {
        setTimeout(function () {
          applyBg('场景·雾中森林', function () {
            setTimeout(function () { applyBg(false); }, 1300);
          });
        }, 1400);
      });
    }
  };
})();

/* CG 插入（VN.cg）
   ---------------------------------------------------------
   与背景（bg）完全同一套用法：台词条目里写 cg 字段即在该句插入整屏 CG
     { speaker:'', text:'…', cg:'Cat_CG1' }                     显示登记键 Cat_CG1
     { speaker:'', text:'…', cg:'' / 'none' / 'hide' / false }  收掉 CG，回到背景
     { speaker:'', text:'…' }                                   不写 cg ＝ 保持当前状态
   CG 文件放进 项目根的 CG/ 目录（也可放别处），在下面的 cgLib 里登记键名→路径；
   未登记的键会被当作直接路径使用（与 resolveBg 行为一致）。
   · 图片（png/jpg…）：整屏黑场 → 淡入插图 → 字号照常打字；CG 在立绘之上、对话框之下。
   · 视频（mp4/webm…，即 CG/ 里的 mp4）：黑场 → 自动播放整段（期间隐藏对话框、
     音量跟随音乐滑条）→ 播完自动收起 → 再开始打字。登记成 { src, loop:true } 则循环播放，
     且不等待播完（适合当动态背景用）。 */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  function warn(m) { if (root.console && root.console.warn) root.console.warn('[VN · cg] ' + m); }
  function log(m) { if (root.console && root.console.info) root.console.info('[VN · cg] ' + m); }

  /* ---------------- CG 注册表 ----------------
     键名 → 路径，或 { src, loop, bgm }
       · loop:true 仅对视频有意义：循环播放且不等待播完
       · bgm:'曲目键' = 这支 CG 自带音乐：演到它时用这首取代本句的 bgm，
         等 CG 演完（图片浮出后 / 视频播完后）再把本句的 bgm 接回去。 */
  var cgLib = {
    'CG0': { src: '../CG/Cat_CG0_fixed+.mp4', bgm: '猫说猫话' },   /* 文件名 Cat_CG0_fixed+.mp4 */
    'CG1': { src: '../CG/Cat_CG1.mp4', bgm: '时光正在回退' },
    'CG2': { src: '../CG/Cat_CG2.mp4', bgm: '时光正在回退' },
    'CG3': { src: '../CG/Cat_CG3.mp4', bgm: '时光正在回退' },
    'CG4': { src: '../CG/Cat_CG4.mp4', bgm: '时光正在回退' }
  };
  root[NS].cgLib = cgLib;

  var el    = document.getElementById('vnCg');
  var img   = document.getElementById('vnCgImg');
  var video = document.getElementById('vnCgVideo');
  if (!el || !img) { warn('未找到 #vnCg / #vnCgImg，CG 层不可用。'); return; }

  var FADE = 650;                 /* 淡入/淡出时长（与切景节奏一致） */
  var reduceMotion =
    root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rhythm(ms) { return reduceMotion ? 0 : ms; }

  /* ---------- 载入提示 + 预热（解决「进 CG 长时间黑屏」的体感） ----------
     · 载入提示：视频 CG 等首帧的这段时间（通常正好是整屏黑幕）显示「CG 载入中…」，
       CG 一浮出 / 遮幕一揭就收掉 —— 让玩家知道是在读取，而不是卡死。
     · 预热：把「很快会遇到的那支 CG」提前用隐藏元素缓冲好，到点时首帧更快就绪。 */
  function loadingEl() { return root.document ? root.document.getElementById('vnLoading') : null; }
  function showLoading() { var e = loadingEl(); if (e) e.classList.add('is-on'); }
  function hideLoading() { var e = loadingEl(); if (e) e.classList.remove('is-on'); }
  root[NS].hideCgLoading = hideLoading;      /* 供 VN.text 揭幕时调用 */

  var warmEl = null, warmSrc = '';
  function preload(ref) {
    var info;
    try { info = resolveCg(ref); } catch (e) { return false; }
    if (!info || info === true || info === false || !info.src) return false;
    if (!root.document || !root.document.body) return false;
    if (warmSrc === info.src) return true;                       /* 已经预热过 */

    if (!info.video) {                                           /* 图片 CG：交给浏览器解码缓存 */
      warmSrc = info.src;
      try { var wi = new Image(); wi.decoding = 'async'; wi.src = info.src; } catch (eImg) { return false; }
      log('预热即将到来的图片 CG：' + info.src);
      return true;
    }

    if (!warmEl) {
      warmEl = root.document.createElement('video');
      warmEl.preload = 'auto';
      warmEl.muted = true;
      warmEl.setAttribute('playsinline', '');
      warmEl.setAttribute('aria-hidden', 'true');
      warmEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      root.document.body.appendChild(warmEl);
    }
    warmSrc = info.src;
    try { warmEl.setAttribute('src', info.src); warmEl.load(); } catch (e2) {}
    log('预热即将到来的 CG：' + info.src);
    return true;
  }

  var curKey = null;              /* 当前 CG 键名；null ＝ 没有 CG */

  /* 记录「这支 CG 已看过」→ 设置页的「CG 鉴赏」据此解锁回放。
     写入无前缀的 vn_cg_seen（与设置页的桥接口径一致），刷新/切页后仍保留。 */
  function markCgSeen(key) {
    if (!key) return;
    try {
      var raw = root.localStorage.getItem('vn_cg_seen');
      var obj = raw ? JSON.parse(raw) : {};
      if (!obj || typeof obj !== 'object') obj = {};
      if (obj[key]) return;
      obj[key] = 1;
      root.localStorage.setItem('vn_cg_seen', JSON.stringify(obj));
    } catch (e) { /* 隐私模式等：忽略 */ }
  }
  var token = 0;                  /* 切换令牌：后发起的切换作废先前的回调 */
  var busy = false;
  var gestureArmed = false;
  var gestureQueue = [];          /* 首次点击/按键时要补做的事（补播、解除静音…） */

  /* 首次点击/按键时执行（可登记多件；已登记过就排队，不再重复挂监听） */
  function onFirstGesture(fn) {
    if (typeof fn !== 'function') return;
    if (!gestureArmed) {
      gestureArmed = true;
      var once = function () {
        document.removeEventListener('pointerdown', once, true);
        document.removeEventListener('keydown', once, true);
        gestureArmed = false;
        var q = gestureQueue.slice();
        gestureQueue.length = 0;
        q.forEach(function (f) { try { f(); } catch (e) {} });
      };
      document.addEventListener('pointerdown', once, true);
      document.addEventListener('keydown', once, true);
    }
    gestureQueue.push(fn);
  }

  function isVideoSrc(src) { return /\.(mp4|webm|ogv|ogg|mov|m4v)([?#]|$)/i.test(String(src)); }

  /* 解析：null ＝ 保持 / false ＝ 收起 / { src, video, loop, bgm } ＝ 插入 */
  function resolveCg(ref) {
    if (ref === undefined || ref === null) return null;
    if (ref === '' || ref === false || ref === 'none' || ref === 'hide') return false;
    var mapped = Object.prototype.hasOwnProperty.call(cgLib, ref) ? cgLib[ref] : ref;
    if (!mapped) return false;
    var src, loop = false, bgmKey = null;
    if (typeof mapped === 'object') {
      src = String(mapped.src || '');
      loop = mapped.loop === true;
      bgmKey = mapped.bgm ? String(mapped.bgm) : null;
    } else {
      src = String(mapped);
    }
    if (!src) return false;
    return { src: src, video: isVideoSrc(src), loop: loop, bgm: bgmKey };
  }

  /* 这支 CG 自带的音乐键（没有则 null）——引擎用它决定本句 bgm 要不要让位 */
  function musicOf(ref) {
    var info = resolveCg(ref);
    return (info && typeof info === 'object' && info.bgm) ? info.bgm : null;
  }

  function clearMedia() {
    img.removeAttribute('src');
    if (video) { try { video.pause(); } catch (e) {} video.removeAttribute('src'); try { video.load(); } catch (e2) {} }
  }

  /* 显示 / 收起 CG，完成后回调。
     回调参数 stillPlaying：true ＝ CG（循环视频）还在自己播着，本句的 bgm 先别接回来；
     false ＝ CG 这一轮演完了（图片已浮出 / 视频播完并收起），引擎可以接着放本句 bgm。 */
  function applyCg(ref, onDone) {
    var info = resolveCg(ref);
    if (info === null) { if (onDone) onDone(false); return; }            /* 保持：直接放行 */

    var my = ++token;
    busy = true;
    function finish(stillPlaying) {
      if (my !== token) return;
      busy = false;
      if (onDone) onDone(!!stillPlaying);
    }

    /* —— 收起 —— */
    if (info === false) {
      if (curKey === null && !el.classList.contains('is-visible')) { finish(false); return; }
      curKey = null;
      el.classList.remove('is-visible');
      root.setTimeout(function () {
        if (my !== token) return;
        clearMedia();
        log('收起 CG');
        finish(false);
      }, rhythm(FADE + 60));
      return;
    }

    /* —— 已在显示同一张：不重来（循环视频仍视为「自己还在播」） —— */
    if (String(ref) === curKey && el.classList.contains('is-visible')) {
      finish(!!(video && info.video && !video.paused));
      return;
    }

    /* —— 视频 CG —— */
    if (info.video) {
      if (!video) { warn('页面里没有 #vnCgVideo，无法播放视频 CG：' + info.src); finish(false); return; }
      img.removeAttribute('src');
      /* 让 CG 真正浮到画面上（首帧就绪时、或发现视频其实已经在播时都走这里）。
         只做一次；而且揭幕后**必须立刻揭掉「首屏遮幕」** —— 遮幕层(z100)盖在 CG 层
         (z12)之上：视频在黑幕背后照样会播，玩家就是「只听得见声音、看不到画面」
         （从 deduction / 小游戏返回落到自带 CG 的那一句时最典型）。
         这里只揭幕、不动任何演出时序：视频照旧播完，播完照旧接回本句 bgm 与台词。 */
      var revealed = false;
      function revealCg(why) {
        if (my !== token || revealed) return;
        revealed = true;
        hideLoading();                          /* 画面已经出来了：收掉「CG 载入中…」 */
        curKey = String(ref);
        markCgSeen(curKey);                     /* 解锁「CG 鉴赏」里的这一支 */
        el.classList.add('is-visible');
        if (root.VN && typeof root.VN.liftBootCurtain === 'function') {
          try { root.VN.liftBootCurtain(why || ('CG 已浮出：' + curKey)); } catch (eLift) {}
        }
        if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();  /* 演出中不显示台词框 */
      }
      var startPoll = null;
      var stopPoll = function () { if (startPoll) { root.clearInterval(startPoll); startPoll = null; } };
      var onReady = function () {
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('loadeddata', onReady);   /* 先到先得：首帧就绪即浮出 */
        if (my !== token) return;
        revealCg('CG 已浮出：' + String(ref));
        /* 先静音起播：浏览器只允许「静音」自动播放，这样打开页面无需任何点击就能演 CG。
           CG0-4 本身没有音轨；若以后某支视频带了音效，玩家第一次点击/按键后会按当前
           音量设置自动解除静音，不影响演出。 */
        try { video.volume = (root.VN.bgm && root.VN.bgm.getVolume) ? root.VN.bgm.getVolume() : 1; } catch (e) {}
        try { video.muted = true; } catch (e2) {}
        var p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {
            warn('浏览器拦截了视频自动播放，将在首次点击/按键后补播：' + curKey);
            onFirstGesture(function () { try { video.play(); } catch (e3) {} });
          });
        }
        /* 首次手势后解除静音（游戏里没静音的话） */
        onFirstGesture(function () {
          var bgmApi = root.VN && root.VN.bgm;
          var silent = !!(bgmApi && bgmApi.isMuted && bgmApi.isMuted());
          try {
            video.volume = (bgmApi && bgmApi.getVolume) ? bgmApi.getVolume() : 1;
            if (!silent) video.muted = false;
          } catch (e4) {}
        });
        log('播放视频 CG：' + curKey + '（' + info.src + (info.loop ? '，循环' : '') + '）');
        if (info.loop) root.setTimeout(function () { finish(true); }, rhythm(FADE * 0.7));   /* 循环：不等待播完 */
      };
      var onEnded = function () {
        video.removeEventListener('ended', onEnded);
        if (my !== token) return;
        stopPoll();
        var endedKey = curKey;
        curKey = null;
        el.classList.remove('is-visible');
        root.setTimeout(function () {
          if (my !== token) return;
          clearMedia();
          hideLoading();                    /* 兜底：演出结束一定收掉载入提示 */
          if (root.VN && root.VN.dialog && root.VN.dialog.show) root.VN.dialog.show();  /* 演完恢复台词框 */
          /* CG0 播完 → 解锁地图 Zone0 并强制全屏弹出（序章初见，进点击门）；
             重看时照样弹，显示的就是 CG0 后应有的 Zone0 */
          if (endedKey === 'CG0' && root.VN.map && root.VN.map.unlock) {
            try { root.VN.map.unlock(0); } catch (eMap) {}
          }
          log('视频 CG 播完，已收起');
          finish(false);                       /* 演完了：引擎可以接回本句 bgm */
        }, rhythm(240));
      };
      video.addEventListener('canplay', onReady);
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('ended', onEnded);
      /* ★ 兜底：万一 canplay / loadeddata 都没触发（有的机器/编码表现为
         「视频已经在播、只出声音，画面却不浮出」），只要视频真的开始走了
         （currentTime > 0）就照样把它浮出来并揭幕。 */
      startPoll = root.setInterval(function () {
        if (my !== token) { stopPoll(); return; }
        if (video && !video.paused && video.currentTime > 0) {
          stopPoll();
          revealCg('CG 已在播放（兜底揭幕）：' + String(ref));
        }
      }, 120);
      /* 加载失败也要收场：否则 canplay 永不触发 → 一直黑屏 + 一直显示「CG 载入中…」 */
      var onErr = function () {
        video.removeEventListener('error', onErr);
        if (my !== token) return;
        warn('视频 CG 加载失败（跳过这一支，继续剧情）：' + info.src);
        stopPoll();
        hideLoading();
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('ended', onEnded);
        clearMedia();
        if (root.VN && typeof root.VN.liftBootCurtain === 'function') {
          try { root.VN.liftBootCurtain('CG 加载失败：' + info.src); } catch (eLift2) {}
        }
        finish(false);
      };
      video.addEventListener('error', onErr);
      log('准备视频 CG：' + String(ref) + '（' + info.src + '），等首帧就绪…');
      showLoading();                              /* ★ 等首帧期间显示「CG 载入中…」 */
      video.loop = info.loop;
      video.setAttribute('src', info.src);
      try { video.load(); } catch (e3) {}
      return;
    }

    /* —— 图片 CG —— */
    if (video) { try { video.pause(); } catch (e4) {} video.removeAttribute('src'); }
    showLoading();                                /* 图片通常瞬间就位，但慢盘上也给个提示 */
    var pre = new Image();
    pre.onload = function () {
      if (my !== token) return;
      hideLoading();
      img.setAttribute('src', info.src);
      el.classList.add('is-visible');
      curKey = String(ref);
      markCgSeen(curKey);                       /* 解锁「CG 鉴赏」里的这一支 */
      /* 同视频分支：CG 已经浮到画面上，首屏遮幕不能再压着它 */
      if (root.VN && typeof root.VN.liftBootCurtain === 'function') {
        try { root.VN.liftBootCurtain('图片 CG 已浮出：' + curKey); } catch (eLift2) {}
      }
      log('浮出图片 CG：' + curKey + '（' + info.src + '）');
      root.setTimeout(function () { finish(false); }, rhythm(FADE * 0.7));   /* 图片已就位：本句 bgm 可以接回 */
    };
    pre.onerror = function () {
      if (my !== token) return;
      hideLoading();
      warn('CG 加载失败（已保持原画面）：' + info.src);
      finish(false);
    };
    pre.src = info.src;
  }

  var api = {
    apply: function (ref, onDone) { applyCg(ref, onDone); },
    show: function (ref) { applyCg(ref); },
    hide: function () { applyCg(false); },
    preload: preload,                          /* 提前预热某一支 CG（不显示） */
    loadingHint: { show: showLoading, hide: hideLoading },
    current: function () { return curKey; },
    isVisible: function () { return !!curKey && el.classList.contains('is-visible'); },
    isBusy: function () { return busy; },
    list: function () { return Object.keys(cgLib); },
    musicOf: musicOf,                        /* 这支 CG 自带的音乐键（没有则 null） */
    add: function (key, pathValue) {
      if (key) cgLib[key] = (pathValue === undefined) ? '' : String(pathValue);
      return api;
    },
    resolve: resolveCg,
    getCgPath: function (key) {
      var r = resolveCg(key);
      return (r && typeof r === 'object') ? r.src : r;
    },
    element: el
  };
  root[NS].cg = api;
})();

/* ---------------- 手稿照片轮播（VN.photos） ----------------
   用法：写在台词条目上，像 bg/cg 一样，例如
     { photos: ['手稿1', '手稿2', '手稿3', '手稿4', '手稿5'], speaker: '小黑', text: '看完笔记本，我陷入了沉思。', portrait: 'cat_ponder' }
   演出节奏：每一张都是「渐黑 → 显现」，然后**停在画面上等玩家翻页** ——
   按空格或点鼠标左键才会切到下一张；看完最后一张后再按一下，收起照片、淡出黑场，
   恢复对话框并开始打这一句的台词。演出期间对话框保持隐藏。
   图层是**动态创建**的（不改任何 HTML，任何剧情页都能用）；
   层在切景黑场之下（z-index 11 < --z-blackout:100），所以渐黑一定盖得住照片。
   键名 → 路径见 photoLib，想加图只改那张表即可。 */
(function () {
  'use strict';
  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  var FADE = 700;      /* 每次渐黑 / 渐显时长（毫秒） */
  var ARM_DELAY = 320; /* 照片显现后多久开始接受翻页输入（避免触发本次演出的那一下点击被重复计入） */
  var LOAD_TIMEOUT = 5000;

  var photoLib = {
    '手稿1': '../images/手稿图/手稿1.png',
    '手稿2': '../images/手稿图/手稿2.png',
    '手稿3': '../images/手稿图/手稿3.png',
    '手稿4': '../images/手稿图/手稿4.png',
    '手稿5': '../images/手稿图/手稿5.png'
  };
  root[NS].photoLib = photoLib;

  function resolve(ref) {
    if (ref === undefined || ref === null || ref === '') return null;
    if (Object.prototype.hasOwnProperty.call(photoLib, ref)) return photoLib[ref];
    return String(ref);                      /* 未登记：当作直接图片路径 */
  }

  var layer = null, imgEl = null;
  function ensureLayer() {
    if (layer && layer.parentNode) return true;
    if (!document.body) return false;
    if (!document.getElementById('vnPhotoStyle')) {
      var st = document.createElement('style');
      st.id = 'vnPhotoStyle';
      st.textContent =
        '.vn-photo{position:fixed;inset:0;z-index:11;display:none;align-items:center;justify-content:center;' +
        'background:#05050a;pointer-events:none;}' +
        '.vn-photo.is-on{display:flex;}' +
        '.vn-photo__img{max-width:96vw;max-height:92vh;object-fit:contain;display:block;' +
        'filter:drop-shadow(0 18px 46px rgba(0,0,0,.8));}';
      document.head.appendChild(st);
    }
    layer = document.createElement('div');
    layer.className = 'vn-photo';
    layer.setAttribute('aria-hidden', 'true');
    imgEl = document.createElement('img');
    imgEl.className = 'vn-photo__img';
    imgEl.alt = '手稿';
    layer.appendChild(imgEl);
    document.body.appendChild(layer);
    return true;
  }

  function setBlack(on, ms) {
    var b = document.getElementById('vnBlackout');
    if (!b) return;
    b.style.transition = 'opacity ' + (ms | 0) + 'ms ease';
    b.style.opacity = on ? '1' : '0';
    b.style.pointerEvents = on ? 'auto' : 'none';
  }

  function preload(src, done) {
    var im = new Image(), fin = false;
    function go() { if (fin) return; fin = true; done(); }
    im.onload = go;
    im.onerror = function () { if (root.console) console.warn('[VN · photos] 图片加载失败：' + src); go(); };
    im.src = src;
    if (im.complete) setTimeout(go, 30);
    setTimeout(go, LOAD_TIMEOUT);            /* 兜底：不让流程卡死 */
  }

  var playing = false;
  var pendingAdvance = null;    /* 当前「等玩家翻页」的回调；VN.photos.next() 可直接触发（调试/测试用） */

  function isUiTarget(el) {
    return !!(el && el.closest &&
      el.closest('button, a, input, textarea, select, [contenteditable="true"], .vn-btn, [data-vn-no-advance]'));
  }

  /* 等玩家「翻页」：空格 或 鼠标左键（其余键/右键无效）。
     监听挂在 document 的捕获阶段 —— 此时剧情引擎正处在 SWITCHING，本来就不响应点击，
     这里只把这一下敲击记成「下一张」，并拦掉它，免得被算两次。 */
  function waitForAdvance(cb) {
    var ready = false;
    var armTimer = root.setTimeout(function () { ready = true; }, ARM_DELAY);
    function cleanup() {
      root.clearTimeout(armTimer);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onMouse, true);
      pendingAdvance = null;
    }
    function fire() {
      if (!ready) return;                    /* 刚显现的这段时间内不翻页 */
      cleanup();
      cb();
    }
    function onKey(e) {
      var isSpace = (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');
      if (!isSpace || isUiTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      fire();
    }
    function onMouse(e) {
      if (e.button !== 0 || isUiTarget(e.target)) return;   /* 仅鼠标左键 */
      e.preventDefault();
      e.stopPropagation();
      fire();
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onMouse, true);
    pendingAdvance = fire;
  }
  function cancelWait() { if (pendingAdvance) pendingAdvance = null; }

  function play(list, onDone) {
    var arr = (list || []).map(resolve).filter(Boolean);
    function finish() { playing = false; cancelWait(); if (typeof onDone === 'function') onDone(); }
    if (!arr.length || !ensureLayer()) { finish(); return; }
    playing = true;
    var i = 0;

    setBlack(true, 0);                       /* 立刻黑场，避免看见上一张或旧画面 */

    function nextPhoto() {
      if (i >= arr.length) {                 /* 全部看完：收起照片 → 淡出黑场 → 继续剧情 */
        layer.classList.remove('is-on');
        setBlack(false, FADE);
        setTimeout(finish, FADE + 60);
        return;
      }
      var src = arr[i];
      if (root.console && console.info) console.info('[VN · photos] 第 ' + (i + 1) + '/' + arr.length + ' 张：' + src);
      setBlack(true, FADE);                  /* ① 渐黑 */
      setTimeout(function () {
        preload(src, function () {
          imgEl.setAttribute('src', src);
          layer.classList.add('is-on');      /* ② 黑场淡出 → 照片显现 */
          setBlack(false, FADE);
          /* ③ 停在画面上等玩家翻页（空格 / 鼠标左键），不再自动计时 */
          waitForAdvance(function () {
            if (!playing) return;
            setBlack(true, FADE);
            setTimeout(function () { i++; nextPhoto(); }, FADE + 80);
          });
        });
      }, FADE);
    }
    nextPhoto();
  }

  root[NS].photos = {
    play: play,
    lib: photoLib,
    isPlaying: function () { return playing; },
    /* 调试/测试用：等价于玩家按了一下空格 */
    next: function () { if (pendingAdvance) pendingAdvance(); return root[NS].photos; },
    add: function (key, path) { if (key) photoLib[key] = String(path || ''); return root[NS].photos; }
  };
})();

/* 背景音乐（VN.bgm）
   ---------------------------------------------------------
   与背景同一套用法：台词条目里写 bgm 字段即在该句切换音乐
     { speaker:'', text:'…', portrait:'', bgm:'rain' }     切到登记键 rain
     bgm:'' / 'stop' / 'none' / false                      淡出停止
     不写 bgm 字段                                          保持当前音乐不变
   音乐文件放进 images/../audio/（任意目录）后，在下面的 bgmLib 里登记键名→路径即可；
   未登记的键会被当作直接路径使用（与 resolveBg 行为一致）。
   切换为交叉淡入淡出；音量可在游戏内用菜单里的音量按钮调节，并记在 localStorage。 */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  function log(m) { if (root.console && root.console.info) root.console.info('[VN · bgm] ' + m); }
  function warn(m) { if (root.console && root.console.warn) root.console.warn('[VN · bgm] ' + m); }

  /* ---------------- 音乐注册表 ----------------
     键名 → { src, loop }；路径相对 html/，音乐文件放在 音乐/ 目录。
     **所有曲子都循环播放**（loop:true）。若个别曲子确实只想放一次，
     把它的 loop 改成 false 即可（播放器的规则是「不写 loop 或写 true 都是循环，
     只有明确写 loop:false 才单次」）。 */
  var bgmLib = {
    '黑猫的夜曲_变奏': { src: '../音乐/黑猫的夜曲_变奏.mp3', loop: true },   /* README 写作「黑猫的夜曲——变奏」 */
    '猫说猫话':        { src: '../音乐/猫说猫话.mp3',        loop: true },
    '曙光良镇':        { src: '../音乐/曙光良镇.mp3',        loop: true },
    '闲暇时光':        { src: '../音乐/闲暇时光.mp3',        loop: true },
    '推理要在下班后':  { src: '../音乐/推理要在下班后.mp3',  loop: true  },
    '微光引灯时':      { src: '../音乐/微光引灯时.mp3',      loop: true },
    '漫长的告别':      { src: '../音乐/漫长的告别.mp3',      loop: true },
    '不安的梦魇':      { src: '../音乐/不安的梦魇 .mp3',     loop: true },   /* 注意：文件名里 .mp3 前有一个空格 */
    '椿桥夜寻踪':      { src: '../音乐/椿桥夜寻踪.mp3',      loop: true },
    '日出与否':        { src: '../音乐/日出与否.mp3',        loop: true  },
    '潜行探戈':        { src: '../音乐/潜行探戈.mp3',        loop: true },
    '福尔摩斯':        { src: '../音乐/（罗曼圣诞探案集）福尔摩斯.mp3', loop: true },  /* 推理线索板用 */
    'Life Sentence':   { src: '../音乐/Life Sentence.mp3', loop: true },   /* 推理页坏结局用 */
    /* —— 以下曲目 README 里尚未安排插入点，先登记备用 —— */
    '时光正在回退':    { src: '../音乐/（绝区零）时光正在回退.mp3', loop: true },
    '黑猫的夜曲':      { src: '../音乐/黑猫的夜曲.mp3',      loop: true },
    '天台决战':        { src: '../音乐/天台决战.mp3',        loop: true },
    '海底捞针':        { src: '../音乐/海底捞针.mp3',        loop: true },
    '生死时速':        { src: '../音乐/生死时速.mp3',        loop: true },
    '疑案追生':        { src: '../音乐/疑案追生.mp3',        loop: true },
    '研究室迷宫':      { src: '../音乐/研究室迷宫.mp3',      loop: true }
  };
  root[NS].bgmLib = bgmLib;

  var FADE = 900;                       /* 交叉淡入淡出时长（毫秒） */
  var VOL_KEY = 'vn_bgm_volume';
  var MUTE_KEY = 'vn_bgm_muted';

  function readNum(k, d) {
    try {
      var v = parseFloat(root.localStorage.getItem(k));
      return isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
    } catch (e) { return d; }
  }
  function readBool(k, d) {
    try {
      var v = root.localStorage.getItem(k);
      return v === null ? d : v === '1';
    } catch (e) { return d; }
  }
  function save(k, v) { try { root.localStorage.setItem(k, String(v)); } catch (e) {} }

  var volume = readNum(VOL_KEY, 0.8);    /* 0..1 */
  var muted = readBool(MUTE_KEY, false);
  var curKey = null;                     /* 当前音乐键名；null=没有 */
  var curEl = null;                      /* 当前 <audio> */
  var pendingKey = null;                 /* 被自动播放策略拦下、等首次用户手势重试 */
  var gestureHooked = false;

  /* 解析：null＝保持 / false＝停止 / { src, loop }＝播放这首 */
  function resolveBgm(ref) {
    if (ref === undefined || ref === null) return null;                  /* 保持 */
    if (ref === '' || ref === false || ref === 'stop' || ref === 'none') return false;
    if (Object.prototype.hasOwnProperty.call(bgmLib, ref)) {
      var mapped = bgmLib[ref];
      if (!mapped) return false;
      if (typeof mapped === 'object') {
        return { src: String(mapped.src || ''), loop: mapped.loop !== false };
      }
      return { src: String(mapped), loop: true };
    }
    return { src: String(ref), loop: true };   /* 未登记：当作直接音频路径 */
  }

  function targetVolume() { return muted ? 0 : volume; }

  function makeAudio(src, loop) {
    var a = new Audio();
    a.loop = (loop !== false);
    a.preload = 'auto';
    a.volume = 0;
    a.src = String(src);
    return a;
  }

  function now() {
    return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
  }

  /* 音量渐变（用 rAF，切页/暂停也不残留定时器） */
  function fade(el, from, to, ms, onDone) {
    if (!el) return;
    if (ms <= 0) { try { el.volume = to; } catch (e) {} if (onDone) onDone(); return; }
    var t0 = now();
    function step() {
      var k = Math.min(1, (now() - t0) / ms);
      try { el.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch (e) {}
      if (k < 1) { if (root.requestAnimationFrame) root.requestAnimationFrame(step); else root.setTimeout(step, 30); }
      else if (onDone) onDone();
    }
    step();
  }

  function stopCurrent(ms) {
    var old = curEl;
    if (!old) return;
    curEl = null;
    fade(old, old.volume, 0, ms, function () {
      try { old.pause(); old.removeAttribute('src'); } catch (e) {}
    });
  }

  /* 首次用户手势后重试被拦下的播放（浏览器自动播放策略） */
  function hookGesture() {
    if (gestureHooked) return;
    gestureHooked = true;
    var once = function () {
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('keydown', once, true);
      gestureHooked = false;
      var k = pendingKey;
      pendingKey = null;
      if (k) { curKey = null; play(k); }
    };
    document.addEventListener('pointerdown', once, true);
    document.addEventListener('keydown', once, true);
  }

  /* —— 「点击开启声音」提示：已移除右下角可见提示 ——
     浏览器自动播放策略拦下音频时不浮任何胶囊：首次点击/按键（剧情推进本来就要点）
     会经 hookGesture 自动补播，无需玩家额外注意。 */
  var hintEl = null, hintTimer = null;
  function audioHint(show) {
    if (show === false) {
      if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
      if (hintEl) {
        var dying = hintEl;
        hintEl = null;
        dying.style.opacity = '0';
        root.setTimeout(function () { try { dying.remove(); } catch (e) {} }, 420);
      }
    }
    /* show === true：什么都不显示（保留函数签名，调用点不动） */
  }

  /* 播放 / 切换 / 停止 */
  function play(ref, opts) {
    opts = opts || {};
    var r = resolveBgm(ref);
    if (r === null) return;                         /* 未给值：保持 */
    var ms = (opts.fade === undefined) ? FADE : opts.fade;

    if (r === false) {                              /* 停止 */
      if (curEl) { log('停止音乐'); stopCurrent(ms); }
      curKey = null;
      return;
    }
    var key = String(ref);
    if (key === curKey && curEl) return;             /* 同一首在播：不重来 */

    var el = makeAudio(r.src, r.loop);
    var p = el.play();
    if (p && typeof p.catch === 'function') {
      p.then(function () { audioHint(false); })      /* 出声成功 → 收起提示 */
       .catch(function () {                          /* 多半是自动播放被拦 */
         warn('浏览器拦截了自动播放，将在首次点击/按键后重试：' + key);
         pendingKey = key;
         hookGesture();
         audioHint(true);                            /* 浮出「点击开启声音」 */
       });
    }
    stopCurrent(ms);
    curEl = el;
    curKey = key;
    fade(el, 0, targetVolume(), ms);
    log('播放音乐：' + key + '（' + r.src + '，' + (r.loop ? '循环' : '单次') + '）');
  }

  function applyVolume() {
    if (curEl) { try { curEl.volume = targetVolume(); } catch (e) {} }
  }

  function setVolume(v, opts) {
    v = parseFloat(v);
    if (!isFinite(v)) return volume;
    volume = Math.min(1, Math.max(0, v));
    save(VOL_KEY, volume);
    if (volume > 0 && muted) { muted = false; save(MUTE_KEY, '0'); }
    if (opts && opts.fade) fade(curEl, curEl ? curEl.volume : 0, targetVolume(), opts.fade);
    else applyVolume();
    return volume;
  }

  function setMuted(b) {
    muted = !!b;
    save(MUTE_KEY, muted ? '1' : '0');
    applyVolume();
    return muted;
  }

  var api = {
    FADE: FADE,
    play: play,
    stop: function (ms) { return play(false, { fade: ms }); },
    setVolume: setVolume,
    getVolume: function () { return volume; },
    setMuted: setMuted,
    isMuted: function () { return muted; },
    toggleMute: function () { return setMuted(!muted); },
    current: function () { return curKey; },
    list: function () { return Object.keys(bgmLib); },
    add: function (key, path) {
      if (key) bgmLib[key] = (path === undefined) ? '' : String(path);
      return api;
    },
    resolve: resolveBgm,
    /* 调试/自检用：当前 <audio> 的状态 */
    debug: function () {
      if (!curEl) return { key: null, playing: false };
      return {
        key: curKey,
        src: curEl.getAttribute('src'),
        volume: curEl.volume,
        paused: curEl.paused,
        currentTime: curEl.currentTime,
        readyState: curEl.readyState
      };
    }
  };
  root[NS].bgm = api;
})();

/* 地图按钮 + 全屏地图浮层（VN.map）
   ---------------------------------------------------------
   地图完全跟着剧情走，**不读写任何存档/localStorage**：
   - 开局未解锁（zone=-1）：点地图键弹「地图还未解锁」提示；
   - CG0 播完 → unlock(0)：解锁 Zone0 并强制全屏弹出（重看也照弹）；
   - 台本句子写 mapZone:N → 演出跑完、台词出现前强制全屏弹出地图，
     旧图缓慢渐变成新图；此时进入「点击门」模式：
     玩家必须点中新地点的位置，箭头才漂移过去（2.4s）、
     停 1s 后关闭地图继续剧情；点错位置不响应；
     弹出期间 isHolding()=true 压住台词打字，afterClose 里放行——
     关掉地图后那句台词才从头开始敲字；
   - 重玩/重看同一段剧情时锚点照样弹，显示的正是该剧情点的地图
     （无视账号进度：看到什么只由剧情位置决定）；
   - 续玩（读档/小游戏返回）时由 resumeStory 扫描续玩点之前的锚点
     静默同步 zone（syncZone），不弹窗；
   - 右上角地图键随时可手动查看当前剧情位置的地图（手动查看仍可点任意处关闭）；
   - Zone5 显示处理过版式的 map_processed.png。
   - 测试：控制台 VN.map.reset() 关浮层并回到未解锁待机态。 */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  var btn = document.getElementById('vnMapToggle');
  var box = document.getElementById('vnMap');
  var base = document.getElementById('vnMapImgBase');
  var top = document.getElementById('vnMapImgNext');
  var toast = document.getElementById('vnMapToast');
  var pin = document.getElementById('vnMapPin');
  var pinName = document.getElementById('vnMapPinName');   /* 旧版名字胶囊，现已移除（留空安全） */
  var labelsEl = document.getElementById('vnMapLabels');   /* 地名标注层：已解锁地点全部标注 */
  var frameEl = base ? base.parentNode : null; /* .vn-map__frame：定位标的定位基准 */
  if (!btn || !box || !base || !top) return;   /* 本页没有这套 UI：跳过 */

  var MAX_ZONE = 5;
  var TRANS_MS = 2400;                         /* Zone 变化的缓慢交叉淡入/箭头漂移时长 */

  /* 各 Zone 的地点名称 + 定位标坐标（地图图片上的百分比位置，可直接改） */
  var ZONES = [
    { name: '白木家',     x: 27, y: 76 },   /* Zone0 */
    { name: '良镇街区',   x: 33, y: 56 },   /* Zone1 */
    { name: '南乡家',     x: 73, y: 77 },   /* Zone2 */
    { name: '良镇旧城区', x: 30, y: 30 },   /* Zone3 */
    { name: '安宁医院',   x: 74, y: 56 },   /* Zone4 */
    { name: '游港大学',   x: 10, y: 27 }    /* Zone5 */
  ];

  var zone = -1;                /* 当前剧情位置对应的区域（跟剧走，不落盘）；-1 = 未解锁 */
  var shownZone = -1;           /* 浮层当前已稳定显示的区域（页面内存态） */
  var pinZone = -1;             /* 定位标当前所在的区域（-1 = 尚未放置） */
  var topTimer = null;
  var holding = false;          /* 强制弹出期间压住台词打字，关掉地图才放行 */
  var closeCbs = [];            /* 关闭浮层后要执行的回调（如「现在才开始打字」） */
  var natural = {};             /* zone -> {w,h} 图片原始尺寸（cover 裁切换算用） */

  /* —— 点击门（gate）：强制弹出后玩家必须点中新地点才继续剧情 —— */
  var gate = false;             /* true = 等待玩家点击正确位置（浮层不可手动关闭） */
  var gateZone = -1;            /* 点击门要求点中的目标区域 */
  var gateDone = false;         /* 已点中（漂移/停顿中，忽略后续点击） */
  var gateTimer = null;         /* 点中后「漂移+停 1s」的关闭定时器 */

  function zoneSrc(z) {
    return (z === MAX_ZONE) ? '../images/Map/map_processed.png'
                            : '../images/Map/Zone' + z + '.png';
  }
  function preload(z) {
    if (z < 0 || z > MAX_ZONE) return;
    var im = new Image();
    im.onload = function () {
      natural[z] = { w: im.naturalWidth, h: im.naturalHeight };
      if (isOpen()) {                                    /* 尺寸到位后校正定位标与标注位置 */
        if (pinZone === z) placePin(z, false);
        renderLabels();
      }
    };
    im.src = zoneSrc(z);
  }
  function paint(el, z) {
    if (z >= 0) { el.src = zoneSrc(z); el.style.display = 'block'; }
    else { el.removeAttribute('src'); el.style.display = 'none'; }
  }

  /* —— 未解锁提示 —— */
  var toastTimer = null;
  function showToast() {
    if (!toast) return;
    toast.classList.add('is-show');
    if (toastTimer) root.clearTimeout(toastTimer);
    toastTimer = root.setTimeout(function () { toast.classList.remove('is-show'); }, 1600);
  }

  /* —— 人物定位标：把 zone 的地点坐标换算成屏幕像素 ——
     图片是 object-fit: cover 裁切显示的，所以要按「cover 放大倍数 + 居中偏移」
     把图片上的百分比坐标换算到图框内的实际像素位置。
     animate=true 时定位标用 2.4s 从旧位置平移过去（与交叉淡入同速）。 —— */
  /* —— 地图坐标换算：把 zone 的地点百分比坐标换算成图框内屏幕像素 ——
     图片是 object-fit: cover 裁切显示的，所以要按「cover 放大倍数 + 居中偏移」换算。
     定位标与地名标注共用这一套换算。 —— */
  function pointAt(z) {
    var cfg = ZONES[z];
    if (!cfg || !frameEl) return null;
    var fw = frameEl.clientWidth || 1;
    var fh = frameEl.clientHeight || 1;
    var nat = natural[z] || { w: 1376, h: 768 };         /* 兜底：Zone0-4 的原始尺寸 */
    var s = Math.max(fw / nat.w, fh / nat.h);            /* cover：取较大缩放比 */
    var dw = nat.w * s, dh = nat.h * s;
    return {
      x: (fw - dw) / 2 + cfg.x / 100 * dw,
      y: (fh - dh) / 2 + cfg.y / 100 * dh
    };
  }

  /* —— 地名标注：所有已解锁（0..zone）的地点都各悬一枚名称胶囊，
     位置固定不随定位标移动；当前剧情所在地的胶囊金边加亮。 —— */
  function renderLabels() {
    if (!labelsEl) return;
    labelsEl.innerHTML = '';
    if (zone < 0) return;
    for (var z = 0; z <= zone; z++) {
      var p = pointAt(z);
      if (!p) continue;
      var el = document.createElement('span');
      el.className = 'vn-map__label' + (z === zone ? ' is-now' : '');
      el.textContent = ZONES[z].name;
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      labelsEl.appendChild(el);
    }
  }

  function placePin(z, animate) {
    if (!pin || !frameEl) return;
    var p = pointAt(z);
    if (!p) { pin.style.opacity = '0'; pinZone = -1; return; }
    if (!animate) pin.style.transitionDuration = '0s, 0s, 500ms';   /* 首次放置：不平移 */
    pin.style.left = p.x + 'px';
    pin.style.top = p.y + 'px';
    if (!animate) { void pin.offsetWidth; pin.style.transitionDuration = ''; }   /* 恢复默认时长 */
    pin.style.opacity = '1';
    if (pinName) pinName.textContent = ZONES[z] ? ZONES[z].name : '';
    pinZone = z;
  }

  /* —— Zone 升级：旧图 → 新图缓慢交叉淡入 —— */
  function crossfade(target) {
    paint(top, target);
    top.style.transition = 'none';
    top.style.opacity = '0';
    void top.offsetWidth;                        /* 强制回流，确保过渡生效 */
    top.style.transition = 'opacity ' + TRANS_MS + 'ms ease';
    top.style.opacity = '1';
    if (topTimer) root.clearTimeout(topTimer);
    topTimer = root.setTimeout(function () {
      topTimer = null;
      paint(base, target);
      top.style.transition = 'none';
      top.style.opacity = '0';
    }, TRANS_MS + 60);
  }
  function commitNow() {                         /* 中途关闭时立即落定，不留半截渐变 */
    if (!topTimer) return;
    root.clearTimeout(topTimer);
    topTimer = null;
    paint(base, shownZone);
    top.style.transition = 'none';
    top.style.opacity = '0';
  }

  /* —— 开/关浮层 —— */
  function isOpen() { return box.classList.contains('is-open'); }
  function open(fromAuto, forcedZone) {
    var target = (forcedZone === undefined || forcedZone === null) ? zone : (Number(forcedZone) | 0);
    if (!(target >= 0 && target <= MAX_ZONE)) { showToast(); return; }   /* 未解锁：点按钮弹提示 */
    if (shownZone < 0) {                         /* 本页首次展示：直接呈现目标区域 */
      paint(base, target);
      shownZone = target;
    } else if (shownZone !== target) {           /* 与当前显示不同（升/降都算）：缓慢渐变过去 */
      crossfade(target);
      shownZone = target;
    }
    /* 定位标：
       - 点击门模式（强制弹出）：箭头不动——留在旧地点（首次则暂不出现），
         等玩家点中新地点后才漂移过去（见 gateClick）；
       - 手动查看：Zone 变化时从旧地点 2.4s 平移到新地点；首次放置直接出现 */
    if (!fromAuto) placePin(target, pinZone >= 0 && pinZone !== target);
    /* 地名标注：已解锁的全部地点各悬一枚名称胶囊（当前所在地金边高亮＝点击门目标） */
    renderLabels();
    box.classList.add('is-open');
    box.classList.toggle('is-gate', !!fromAuto);  /* 点击门期间隐藏「点击任意处关闭」提示 */
    box.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    holding = !!fromAuto;                        /* 只有强制弹出才压住打字 */
    if (fromAuto) {                              /* 强制弹出＝点击门：必须点中才继续 */
      gate = true;
      gateZone = target;
      gateDone = false;
    }
    try { if (root.VN.autoplay && root.VN.autoplay.isOn && root.VN.autoplay.isOn()) root.VN.autoplay.off(); } catch (e) {}
  }
  function close() {
    if (gateTimer) { root.clearTimeout(gateTimer); gateTimer = null; }
    gate = false; gateDone = false; gateZone = -1;
    if (!isOpen()) return;
    commitNow();
    box.classList.remove('is-open');
    box.classList.remove('is-gate');
    box.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    holding = false;
    var cbs = closeCbs; closeCbs = [];           /* 关掉地图后：放行被压住的台词（从头打字） */
    while (cbs.length) { try { cbs.shift()(); } catch (e) {} }
  }
  function toggle() { if (gate) return; isOpen() ? close() : open(); }

  /* —— 点击门：玩家点中目标地点 → 箭头漂移过去 → 停 1s → 关闭进入剧情 —— */
  function gateClick(e) {
    if (gateDone) return;                        /* 已点中：漂移/停顿期间忽略后续点击 */
    var tp = pointAt(gateZone);
    if (!tp || !frameEl) return;
    var rect = frameEl.getBoundingClientRect();
    var dx = (e.clientX - rect.left) - tp.x;
    var dy = (e.clientY - rect.top) - tp.y;
    if (dx * dx + dy * dy > 80 * 80) return;     /* 没点中目标位置：不响应 */
    gateDone = true;
    /* 箭头漂移：已有定位标时 2.4s 平移过去；首次（Zone0）直接在原地亮起 */
    var drift = (pinZone >= 0 && pinZone !== gateZone) ? TRANS_MS : 0;
    placePin(gateZone, drift > 0);
    gateTimer = root.setTimeout(function () {    /* 漂移到位后停 1s 再进入剧情 */
      gateTimer = null;
      close();
    }, drift + 1000);
  }
  /* 强制弹出期间返回 true：引擎据此把台词打字推迟到 afterClose */
  function isHolding() { return holding && isOpen(); }
  function afterClose(cb) { if (typeof cb === 'function') closeCbs.push(cb); }

  /* —— 剧情锚点（台本 mapZone 字段）：跟剧走、不落盘。
     每次经过锚点都强制全屏弹出该剧情点的区域，进入点击门：
     玩家点中新地点 → 箭头漂移过去、停 1s → 关闭继续剧情 —— */
  function unlock(z) {
    z = Number(z);
    if (!isFinite(z) || z < 0 || z > MAX_ZONE) return false;
    zone = z;
    open(true, z);
    return true;
  }
  /* 续玩点静默同步：只对齐 zone（-1 = 续玩点之前还没解锁地图），不弹窗（resumeStory 调用） */
  function syncZone(z) {
    z = Number(z);
    if (!isFinite(z) || z < -1 || z > MAX_ZONE) return;
    zone = z;
  }

  /* —— 测试重置：关浮层、清显示，回到未解锁的锁定态 —— */
  function reset() {
    if (topTimer) { root.clearTimeout(topTimer); topTimer = null; }
    close();                                     /* 会顺手取消点击门定时器并放行挂起的打字回调 */
    paint(base, -1);                             /* 隐藏底图 */
    top.style.transition = 'none';
    top.style.opacity = '0';
    zone = -1;
    shownZone = -1;
    pinZone = -1;                                /* 定位标一并收回 */
    if (pin) pin.style.opacity = '0';
    renderLabels();                              /* 地名标注清空（zone=-1 时不渲染） */
  }

  /* —— 交互 —— */
  btn.addEventListener('click', function (e) {
    e.stopPropagation();                         /* 不触发剧情推进 */
    toggle();                                    /* 点击门期间 toggle() 内部会忽略 */
  });

  /* 点浮层内部：点击门模式 → 命中判定（点中目标地点才继续）；否则任意处关闭 */
  box.addEventListener('click', function (e) {
    e.stopPropagation();
    if (gate) { gateClick(e); return; }
    close();
  });

  /* 浮层打开期间（capture 阶段，先于剧情页的推进监听）：
     Esc 关闭；空格不再推进台词；点浮层外面 → 关闭且不推进。
     点击门模式下 Esc/点外面都不响应（必须点中目标地点）。 */
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.stopPropagation(); if (!gate) close(); return; }
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    if (box.contains(e.target) || btn.contains(e.target)) return;
    if (gate) { e.stopPropagation(); return; }   /* 点击门：点外面不放行 */
    e.stopPropagation();
    close();
  }, true);

  /* 预加载全部 Zone 图（顺便记下原始尺寸，供定位标换算） */
  for (var zi = 0; zi <= MAX_ZONE; zi++) preload(zi);
  /* 窗口尺寸变化时校正定位标与地名标注（cover 裁切随视口变化） */
  root.addEventListener('resize', function () {
    if (!isOpen()) return;
    if (pinZone >= 0) placePin(pinZone, false);
    renderLabels();
  });

  root[NS].map = {
    open: open, close: close, toggle: toggle, isOpen: isOpen,
    unlock: unlock, syncZone: syncZone, reset: reset,
    isHolding: isHolding, afterClose: afterClose,
    zone: function () { return zone; }
  };
})();

/* 自动播放按钮（VN.autoplay）
   ---------------------------------------------------------
   位于对话框左下角（与右下角的「长按空格可快进」对称）。
   点一下开启：每句读完后停 vnAutoplayDelay 毫秒自动进入下一句；再点一下关闭。
   快捷键：A。状态记在 localStorage（vn_autoplay），换页后保持。
   按钮与样式都由本模块动态创建 —— 页面 HTML 无需任何改动，
   以后重新导出剧情页也不会丢。每句停留时长可用
     VN.text.setAutoDelay(毫秒)   或   VN.autoplay.setDelay(毫秒)
   调整（默认 1600）。 */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  var dialogEl = document.getElementById('vnDialog');
  if (!dialogEl) return;                       /* 本页没有对话框：跳过 */
  var text = root[NS].text || {};

  var STORE_KEY = 'vn_autoplay';

  /* —— 样式（只注入一次；不依赖任何 CSS 文件） —— */
  if (!document.getElementById('vnAutoStyle')) {
    var st = document.createElement('style');
    st.id = 'vnAutoStyle';
    st.textContent = [
      '.vn-auto{position:absolute;left:16px;bottom:10px;z-index:3;',
      'display:inline-flex;align-items:center;gap:6px;',
      'padding:4px 10px 4px 8px;border-radius:999px;cursor:pointer;',
      'font:12px/1 "Microsoft YaHei",system-ui,-apple-system,sans-serif;',
      'letter-spacing:.08em;color:rgba(236,227,209,.62);',
      'background:rgba(16,13,24,.35);',
      'border:1px solid rgba(217,184,127,.30);',
      'transition:color .2s ease,border-color .2s ease,background .2s ease,box-shadow .2s ease;}',
      '.vn-auto:hover{color:#f2dcab;border-color:rgba(240,217,166,.55);background:rgba(217,184,127,.10);}',
      '.vn-auto:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(217,184,127,.28);}',
      '.vn-auto.is-on{color:#f2dcab;border-color:rgba(240,217,166,.85);background:rgba(217,184,127,.16);',
      'box-shadow:0 0 12px rgba(217,184,127,.30),inset 0 0 8px rgba(217,184,127,.12);}',
      '.vn-auto__icon{position:relative;display:block;width:9px;height:10px;}',
      /* 三角形＝播放 */
      '.vn-auto__icon::before{content:"";position:absolute;inset:0;',
      'border-left:9px solid currentColor;border-top:5px solid transparent;border-bottom:5px solid transparent;}',
      /* 开启后换成两根竖条＝暂停 */
      '.vn-auto.is-on .vn-auto__icon::before{border:0;background:currentColor;',
      'box-shadow:6px 0 0 currentColor;width:3px;height:10px;inset:auto;left:0;top:0;}',
      '.vn-auto.is-on .vn-auto__label{opacity:1;}'
    ].join('');
    document.head.appendChild(st);
  }

  /* —— 按钮 —— */
  var btn = document.createElement('button');
  btn.id = 'vnAutoBtn';
  btn.type = 'button';
  btn.className = 'vn-auto';
  btn.tabIndex = -1;                           /* 移出 Tab 序列：键盘既不能聚焦也不能开关它 */
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<span class="vn-auto__icon" aria-hidden="true"></span>' +
                  '<span class="vn-auto__label">自动</span>';
  dialogEl.appendChild(btn);

  function render() {
    var on = !!(text.isAuto && text.isAuto());
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? '关闭自动播放（鼠标左键点这里）' : '自动播放（鼠标左键点这里）';
    btn.setAttribute('aria-label', btn.title);
  }

  function set(on) {
    if (text.setAuto) text.setAuto(on);
    try { root.localStorage.setItem(STORE_KEY, on ? '1' : '0'); } catch (e) {}
    render();
  }
  function toggle() { set(!(text.isAuto && text.isAuto())); }

  /* 只认鼠标左键点击：
     · 其它按键（中键/右键）不响应
     · 点完立刻 blur，避免按钮保持焦点后被空格/回车"再按一次"
     · 不会冒泡到「点击推进」，所以点按钮不会顺带翻页 */
  btn.addEventListener('click', function (e) {
    if (e.button !== undefined && e.button !== 0) return;   /* 0 = 鼠标左键 */
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    toggle();
    if (btn.blur) btn.blur();
  });

  /* 键盘不能开关自动播放：按钮收到 空格/回车 时吃掉默认行为（不触发 click），
     但不阻止冒泡 —— 空格仍然交给页面用于「推进剧情/快进打字」。 */
  btn.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
      if (e.preventDefault) e.preventDefault();
    }
  });

  /* 换页后保持上次状态 */
  var saved = false;
  try { saved = root.localStorage.getItem(STORE_KEY) === '1'; } catch (e2) {}
  if (saved) set(true); else render();

  root[NS].autoplay = {
    on: function () { set(true); },
    off: function () { set(false); },
    toggle: toggle,
    isOn: function () { return !!(text.isAuto && text.isAuto()); },
    setDelay: function (ms) { return text.setAutoDelay ? text.setAutoDelay(ms) : 0; },
    button: btn
  };
})();

