/* =========================================================
   存档系统（VN.save）
   ---------------------------------------------------------
   · 自动存档：游玩过程中实时写入（localStorage），供“继续游戏”使用
   · 手动存档：6 个存档位，可互相覆盖
   · 存档位画面：每份存档额外记录 shot（背景/立绘/说话人/台词），
     读取页与游戏内弹层据此把“存档时所在页面的完整画面”重绘为
     16:9 缩略图，作为存档位框框的背景（见 buildShot）。
   · 页面职责：
       - plot.html   ：游戏内存档按钮 / 手动存档面板 / 读档弹层
                        （读档模式额外列出“自动存档”位）；
                        支持 ?save=KEY 进入页面后直接续玩（由 startDemo 拾取）。
       - loadPage.html：自动存档“继续游戏”+ 6 个手动存档位读取。
   依赖 js/main.js 提供的 VN.text.startStory / resumeStory / getProgress
   与 VN.scene（背景恢复）。loadPage.html 不加载 main.js，故旧存档的
   立绘/背景键由本文件内的 LEGACY_* 映射兜底解析。
   ========================================================= */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  /* 存储键：有 userStore（登录状态下会加 u:<用户>: 前缀）时自动按账号隔离，
     未登录 / 页面没引 userStore 时就是裸键 —— 两种情况都能跑。
     注意：plot.html 与 loadPage.html 都要在 saveSystem.js **之前**引入 userStore.js。
     userStore.js 自带「旧全局存档迁移」：老档会在首次登录时被拷进该账号名下。 */
  function ukey(name) {
    try {
      if (root.VN && root.VN.userStore && typeof root.VN.userStore.key === 'function') {
        return root.VN.userStore.key(name);
      }
    } catch (e) { /* 隐私模式等：退回裸键 */ }
    return name;
  }

  var AUTO_KEY = ukey('vn_save_auto');
  var MAN_PREFIX = ukey('vn_save_slot_');
  var SLOT_COUNT = 6;

  function getText() { return (root.VN && root.VN.text) ? root.VN.text : null; }

  function log(msg) { if (root.console) root.console.info('[VN · save] ' + msg); }
  function warn(msg) { if (root.console) root.console.warn('[VN · save] ' + msg); }

  /* ---------------- localStorage 存取 ---------------- */
  function readJson(key) {
    try {
      var raw = root.localStorage.getItem(key);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return (data && typeof data === 'object') ? data : null;
    } catch (err) {
      warn('读取存档失败（' + key + '）：' + err);
      return null;
    }
  }

  function writeJson(key, obj) {
    try {
      root.localStorage.setItem(key, JSON.stringify(obj));
      return true;
    } catch (err) {
      warn('写入存档失败（' + key + '）：' + err);
      return false;
    }
  }

  function slotName(i) { return MAN_PREFIX + i; }

  /* ---------------- 展示辅助 ---------------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtTime(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
           pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* ---------------- 画面快照（存档位背景） ----------------
     存档位框框的背景＝存档时“当前页面的完整画面”。这里不截屏（file:// 下 canvas
     会因跨域污染而无法导出），而是把画面拆成可复原的三要素记录下来，
     读取页/弹层再用纯 DOM 按游戏内比例重绘成一张 16:9 的缩略画面：
       背景图 · 立绘 · 对话框（说话人 + 本句台词）
     因此缩略图任意尺寸都清晰，也不占用 localStorage 容量。 */

  /* 旧存档兜底表：键名 → 图片路径。
     早于「shot 缩略图」时代的存档只存了 bgKey / portrait 键名，而 loadPage.html
     不加载 main.js（拿不到 bgLib / portraitLib），所以要在这里放一份完整映射。
     ★ 本表由 _apply_fallback.js 从 main.js 的 bgLib 机械生成（16 条）；
       以后 main.js 注册表有变动，重跑该脚本即可同步。 */
  var LEGACY_BG = {
    'scene_2': '../images/Backgrounds/Scene_2.png',
    'scene_3': '../images/Backgrounds/Scene_3.png',
    'scene_4': '../images/Backgrounds/Scene_4.png',
    'scene_5': '../images/Backgrounds/Scene_5.png',
    'scene_6': '../images/Backgrounds/Scene_6.png',
    'scene_7': '../images/Backgrounds/Scene_7.png',
    'scene_8': '../images/Backgrounds/Scene_8.png',
    'scene_9': '../images/Backgrounds/Scene_9.png',
    'scene_10': '../images/Backgrounds/Scene_10.png',
    'scene_11': '../images/Backgrounds/Scene_11.png',
    'scene_12': '../images/Backgrounds/Scene_12.png',
    'scene_13': '../images/Backgrounds/Scene_13.png',
    'scene_14': '../images/Backgrounds/Scene_14.png',
    'scene_20': '../images/Backgrounds/Scene_20.png',
    'morning_city': '../images/Backgrounds/morning_city.png',
    'night_city': '../images/Backgrounds/night_city.png',
  };
  /* 同上，立绘键 → 图片路径（47 条，由 main.js 的 portraitLib 生成） */
  var LEGACY_PORTRAIT = {
    'cat_alert': '../images/Characters/cat/cat_alert.png',
    'cat_confident': '../images/Characters/cat/cat_confident.png',
    'cat_ponder': '../images/Characters/cat/cat_ponder.png',
    'cat_proud': '../images/Characters/cat/cat_proud.png',
    'cat_shocked': '../images/Characters/cat/cat_shocked.png',
    'cat_sigh': '../images/Characters/cat/cat_sigh.png',
    'cat_speechless': '../images/Characters/cat/cat_speechless.png',
    'ms_1': '../images/Characters/main/ms_1.png',
    'ms_2': '../images/Characters/main/ms_2.png',
    'ms_3': '../images/Characters/main/ms_3.png',
    'ms_mr': '../images/Characters/main/ms_mr.png',
    'ms_sk': '../images/Characters/main/ms_sk.png',
    'girl1_confused': '../images/Characters/girl/girl1_confused.png',
    'girl_happy': '../images/Characters/girl/girl_happy.png',
    'girl_smile': '../images/Characters/girl/girl_smile.png',
    'ms_happy': '../images/Characters/girl/girl_happy.png',
    'ms_smile': '../images/Characters/girl/girl_smile.png',
    'zm_sn': '../images/Characters/girl+/zm-sn.png',
    'zm_tq': '../images/Characters/girl+/zm-tq.png',
    'zm_wx': '../images/Characters/girl+/zm-wx.png',
    'zm_zj': '../images/Characters/girl+/zm-zj.png',
    'sy_fn': '../images/Characters/sis/sy_fn.png',
    'sy_jz': '../images/Characters/sis/sy_jz.png',
    'sy_xy': '../images/Characters/sis/sy_xy.png',
    'qq_dy': '../images/Characters/police/qq-dy.png',
    'qq_mm': '../images/Characters/police/qq-mm.png',
    'qq_wx': '../images/Characters/police/qq_wx.png',
    'qq_zc': '../images/Characters/police/qq_zc.png',
    'jz': '../images/Characters/boy/jz.png',
    'husband_normal': '../images/Characters/husband&wife/husband_normal.png',
    'husband_soul': '../images/Characters/husband&wife/husband_soul.png',
    'wife_normal': '../images/Characters/husband&wife/wife_normal.png',
    'nxfr': '../images/Characters/husband&wife/wife_normal.png',
    'nxlh': '../images/Characters/husband&wife/husband_soul.png',
    'soul': '../images/Characters/soul/Soul+.png',
    'lh': '../images/Characters/soul/Soul+.png',
    'fa_beg': '../images/Characters/villian/fa_beg.png',
    'fa_end': '../images/Characters/villian/fa_end.png',
    'fa_lx': '../images/Characters/villian/fa_lx.png',
    'fa_xe': '../images/Characters/villian/fa_xe.png',
    'cat_think': '../images/Characters/cat/cat_ponder.png',
    'jz_beg': '../images/Characters/villian/fa_beg.png',
    'ms_wt': '../images/Characters/main/ms_1.png',
    'ms_think': '../images/Characters/main/ms_sk.png',
    'ms_silent': '../images/Characters/main/ms_mr.png',
    'ms_wuyu': '../images/Characters/main/ms_3.png',
    'fa_nq': '../images/Characters/villian/fa_xe.png',
  };

  function looksLikePath(s) {
    return /[\\/]|\.(png|jpe?g|webp|gif|avif|svg)$/i.test(String(s === undefined || s === null ? '' : s));
  }

  /* 存档瞬间抓取画面：优先取“本句所属”的立绘/背景，取不到再用页面上真正在显示的图 */
  function captureShot(p) {
    var item = p.item || {};
    var lib = root.VN || {};
    var bg = null;
    var portrait = null;

    /* 正显示着 CG 时，缩略图直接用那张 CG（读档后一眼能认出来）。
       ★ cgLib 里的**视频 CG** 是对象 { src, bgm }，不能当图片路径用；
         而且视频本来也画不进缩略图（赋给 img.src 会变成 "[object Object]"、
         加载失败后整张背景被移除）→ 这种情况跳过，退回本句背景 / 当前背景。 */
    if (p.cgKey) {
      var cgEntry = (lib.cgLib && lib.cgLib[p.cgKey]) || null;
      var cgPath = (cgEntry && typeof cgEntry === 'object') ? (cgEntry.src || '') : cgEntry;
      if (cgPath && !/\.(mp4|webm|ogv|ogg|mov|m4v)([?#]|$)/i.test(String(cgPath))) {
        bg = String(cgPath);                     /* 图片 CG：直接用 */
      } else if (!cgEntry && looksLikePath(p.cgKey)) {
        bg = String(p.cgKey);
      }
    }
    if (!bg && p.bgKey) {
      bg = (lib.bgLib && lib.bgLib[p.bgKey]) || (looksLikePath(p.bgKey) ? String(p.bgKey) : null);
    }
    if (!bg) {                                   /* 本句没有切景：用当前正在显示的背景 */
      var bgImg = document.getElementById('vnBgImg');
      if (bgImg && bgImg.getAttribute('src')) bg = bgImg.getAttribute('src');
    }
    if (item.portrait) {
      portrait = (lib.portraitLib && lib.portraitLib[item.portrait]) || null;
      if (!portrait && looksLikePath(item.portrait)) portrait = String(item.portrait);
    }
    return {
      bg: bg || null,
      portrait: portrait || null,                /* 该句无立绘 / 立绘尚未有图 → 不画立绘 */
      speaker: item.speaker ? String(item.speaker) : '',
      text: item.text ? String(item.text) : ''
    };
  }

  /* 存档快照 */
  function capture() {
    var text = getText();
    if (!text || typeof text.getProgress !== 'function') return null;
    var p = text.getProgress();
    if (!p) return null;
    return {
      kind: 'manual',
      time: Date.now(),
      timeText: fmtTime(Date.now()),
      index: p.index,
      item: p.item,
      bgKey: p.bgKey || null,
      cgKey: p.cgKey || null,
      chapter: p.chapter || '',
      shot: captureShot(p)                       /* 存档位的画面缩略图数据 */
    };
  }

  /* 取一份存档的缩略图数据（新存档用 shot，旧存档按键名兜底解析） */
  function previewOf(save) {
    if (!save) return null;
    var item = save.item || {};
    var shot = save.shot;
    if (shot && typeof shot === 'object') {
      return {
        bg: shot.bg || null,
        portrait: shot.portrait || null,
        speaker: shot.speaker || '',
        text: shot.text || item.text || ''
      };
    }
    return {
      bg: save.bgKey ? (LEGACY_BG[save.bgKey] || String(save.bgKey)) : null,
      portrait: item.portrait ? (LEGACY_PORTRAIT[item.portrait] || null) : null,
      speaker: item.speaker || '',
      text: item.text || ''
    };
  }

  /* 把一份存档重绘成缩略画面（16:9 容器内绝对定位），返回 <span class="vn-shot"> */
  function buildShot(save) {
    var p = previewOf(save);
    if (!p) return null;

    var shot = document.createElement('span');
    shot.className = 'vn-shot';
    shot.setAttribute('aria-hidden', 'true');

    if (p.bg) {
      var bg = document.createElement('img');
      bg.className = 'vn-shot__bg';
      bg.alt = '';
      bg.addEventListener('error', function () { bg.remove(); });   /* 图缺失 → 只留夜色基底 */
      bg.src = p.bg;
      shot.appendChild(bg);
    }
    if (p.portrait) {
      var pt = document.createElement('img');
      pt.className = 'vn-shot__portrait';
      pt.alt = '';
      pt.addEventListener('error', function () { pt.remove(); });
      pt.src = p.portrait;
      shot.appendChild(pt);
    }

    var fx = document.createElement('span');
    fx.className = 'vn-shot__fx';
    shot.appendChild(fx);

    var dlg = document.createElement('span');
    dlg.className = 'vn-shot__dialog';
    if (p.speaker) {
      var name = document.createElement('span');
      name.className = 'vn-shot__name';
      name.textContent = p.speaker;
      dlg.appendChild(name);
    }
    var body = document.createElement('span');
    body.className = 'vn-shot__text';
    body.textContent = p.text || '';
    dlg.appendChild(body);
    shot.appendChild(dlg);

    return shot;
  }

  /* ---------------- 对外 API ---------------- */
  var api = {
    SLOT_COUNT: SLOT_COUNT,
    AUTO_KEY: AUTO_KEY,

    readAuto: function () { return readJson(AUTO_KEY); },
    readSlot: function (i) { return readJson(slotName(i)); },
    read: function (key) { return readJson(key); },
    hasAuto: function () { return !!readJson(AUTO_KEY); },
    hasSlot: function (i) { return !!readJson(slotName(i)); },

    /* 6 个手动档的展示信息 */
    listSlots: function () {
      var out = [];
      for (var i = 1; i <= SLOT_COUNT; i++) {
        var s = readJson(slotName(i));
        out.push({ slot: i, occupied: !!s, save: s });
      }
      return out;
    },

    /* 手动存档到第 i 位（1..6）：已有存档将被覆盖 */
    saveToSlot: function (i) {
      var snap = capture();
      if (!snap) {
        warn('当前无可存档的进度（剧情尚未开始）。');
        return false;
      }
      var ok = writeJson(slotName(i), snap);
      if (ok) log('已手动存档到第 ' + i + ' 位。');
      return ok;
    },

    /* 自动存档：覆盖上一次进度 */
    autosave: function () {
      var snap = capture();
      if (!snap) return false;
      snap.kind = 'auto';
      var ok = writeJson(AUTO_KEY, snap);
      if (ok && root.__VN_SAVE_DEBUG__) log('自动存档：第 ' + snap.index + ' 句');
      return ok;
    },

    /* 游戏内直接恢复某份存档（原地续玩） */
    loadToGame: function (save) {
      var text = getText();
      if (!text || !save || typeof save.index !== 'number') return false;
      text.resumeStory(save.index, save.bgKey, save.cgKey);
      return true;
    },

    /* 跳转到 index 页面并按 ?save=KEY 续玩 */
    goLoad: function (key) {
      root.location.href = 'plot.html?save=' + encodeURIComponent(key);
    },

    /* 读取页/弹层通用按钮动作 */
    loadByKey: function (key) { api.goLoad(key); }
  };

  root[NS].save = api;

  /* ---------------- index 页面引导：?save=KEY → 待续玩指令 ----------------
     必须在 DOMContentLoaded（main.js 的 startDemo）之前完成赋值，因此放在
     本文件的顶层同步执行；index.html 需在 main.js 之后引入本文件。 */
  (function bootstrapResume() {
    var m = /[?&]save=([^&]+)/.exec(root.location.search || '');
    if (!m) return;
    var key;
    try { key = decodeURIComponent(m[1]); } catch (_) { return; }
    var s = readJson(key);
    if (s && typeof s.index === 'number' && s.index >= 0) {
      root.__VN_PENDING_RESUME__ = { index: s.index, bgKey: s.bgKey || null, cgKey: s.cgKey || null };
      log('接收到续玩指令：' + key + '（第 ' + s.index + ' 句）');
    } else {
      warn('未找到存档「' + key + '」，将从头开始新游戏。');
    }
  })();

  /* ---------------- 自动存档挂接（仅游戏页面） ---------------- */
  function wireAutosave() {
    var text = getText();
    if (!text || typeof text.on !== 'function') return;   /* loadPage 无引擎，跳过 */
    var seeded = false;

    text.on('lineStart', function () {
      if (!seeded) { seeded = true; api.autosave(); }     /* 开场即有自动档 */
    });
    text.on('lineEnd', function () {
      api.autosave();                                     /* 每句播完实时保存 */
    });

    function saveOnLeave() { try { api.autosave(); } catch (_) {} }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveOnLeave();
    }, false);
    root.addEventListener('pagehide', saveOnLeave, false);
  }

  /* ---------------- 游戏内 UI（index.html） ---------------- */
  function initIndexUI() {
    var saveRoot = document.getElementById('vnSave');
    var panel    = document.getElementById('vnSavePanel');
    var modal    = document.getElementById('vnSaveModal');
    var slotsBox = document.getElementById('vnSaveSlots');
    var modeBtns = panel ? panel.querySelectorAll('[data-mode]') : [];
    var btnCancel = document.getElementById('vnSaveCancel');
    var btnBack   = document.getElementById('vnSaveBack');

    if (!saveRoot || !panel || !modal || !slotsBox) return;

    var isOpen = false;
    var wasEnabled = true;
    var mode = 'save';                 /* save | load */

    function setTextEnabled(v) {
      var t = getText();
      if (t && t.setEnabled) t.setEnabled(v);
    }
    function textIsEnabled() {
      var t = getText();
      return !t || !t.isEnabled || t.isEnabled();
    }

    /* 一张存档位卡片：背景即“存档时的完整画面”（buildShot 重绘），
       编号/章节/时间压在顶部的暗色渐变上，不遮挡画面下方的对话框。 */
    function makeCard(opt) {
      var slot = opt.slot;                     /* 1..6 或 'auto' */
      var s = opt.save;
      var occ = !!s;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vn-save-slot' + (occ ? ' is-occupied' : '') + (opt.auto ? ' is-auto' : '');
      btn.setAttribute('data-slot', String(slot));
      btn.setAttribute('aria-label',
        (opt.auto ? '自动存档，' : '存档位 ' + slot + '，') + (occ ? '已存档' : '空'));

      if (occ) {
        var shot = buildShot(s);
        if (shot) btn.appendChild(shot);
      }

      var head = document.createElement('span');
      head.className = 'vn-save-slot__head';

      var num = document.createElement('span');
      num.className = 'vn-save-slot__num';
      num.textContent = opt.auto ? '自' : String(slot);
      head.appendChild(num);

      var main = document.createElement('span');
      main.className = 'vn-save-slot__main';
      if (occ) {
        var ch = document.createElement('span');
        ch.className = 'vn-save-slot__chapter';
        ch.textContent = opt.auto ? ('自动存档 · ' + (s.chapter || '未知章节')) : (s.chapter || '未知章节');
        var tm = document.createElement('span');
        tm.className = 'vn-save-slot__time';
        tm.textContent = (s.timeText || '') + ' · 第 ' + ((s.index || 0) + 1) + ' 句';
        main.appendChild(ch);
        main.appendChild(tm);
      } else {
        var emp = document.createElement('span');
        emp.className = 'vn-save-slot__empty';
        emp.textContent = '空存档位';
        main.appendChild(emp);
      }
      head.appendChild(main);
      btn.appendChild(head);

      btn.addEventListener('click', function () {
        if (mode === 'save') {
          var ok = api.saveToSlot(opt.slot);
          if (ok) {
            flash(modal, '已保存到存档位 ' + opt.slot);
            refreshSlots();
          } else {
            flash(modal, '当前剧情尚未开始，无法存档');
          }
          return;
        }
        /* load 模式 */
        if (!occ) { flash(modal, '存档位 ' + slot + ' 为空'); return; }
        closeUI();
        api.loadToGame(s);
      });

      return btn;
    }

    function refreshSlots() {
      slotsBox.innerHTML = '';
      /* 读档模式：把“自动存档”也作为第一个位置列出（存档模式不覆盖它） */
      if (mode === 'load') {
        var auto = api.readAuto();
        if (auto) slotsBox.appendChild(makeCard({ slot: 'auto', save: auto, auto: true }));
      }
      api.listSlots().forEach(function (o) {
        slotsBox.appendChild(makeCard({ slot: o.slot, save: o.save }));
      });
    }

    var flashTimer = null;
    function flash(scope, msg) {
      var hint = scope ? scope.querySelector('.vn-save__hint') : null;
      if (!hint) return;
      hint.textContent = msg;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        hint.textContent = mode === 'save'
          ? '点击存档位即可将当前进度保存（已有存档将被覆盖）'
          : '点击已存档的存档位读取进度';
      }, 2200);
    }

    function showPanel() {
      panel.hidden = false;
      modal.hidden = true;
    }
    function showModal(m) {
      mode = m;
      panel.hidden = true;
      modal.hidden = false;
      var title = modal.querySelector('.vn-save__title');
      var hint  = modal.querySelector('.vn-save__hint');
      if (title) title.textContent = (m === 'save') ? '手动存档' : '读取存档';
      if (hint) hint.textContent = (m === 'save')
        ? '点击存档位即可将当前进度保存（已有存档将被覆盖）'
        : '点击已存档的存档位读取进度';
      refreshSlots();
    }

    function openUI() {
      if (isOpen) return;
      isOpen = true;
      wasEnabled = textIsEnabled();
      setTextEnabled(false);               /* 打开时暂停剧情推进 */
      saveRoot.classList.add('is-open');
      saveRoot.setAttribute('aria-hidden', 'false');
      showPanel();
    }
    function closeUI() {
      if (!isOpen) return;
      isOpen = false;
      setTextEnabled(wasEnabled);
      saveRoot.classList.remove('is-open');
      saveRoot.setAttribute('aria-hidden', 'true');
    }

    /* 事件绑定 */
    var toggleBtn = document.getElementById('vnSaveToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (isOpen) closeUI(); else openUI();
      });
    }
    if (modeBtns && modeBtns.length) {
      Array.prototype.forEach.call(modeBtns, function (b) {
        b.addEventListener('click', function () { showModal(b.getAttribute('data-mode') || 'save'); });
      });
    }
    if (btnCancel) btnCancel.addEventListener('click', closeUI);
    if (btnBack)   btnBack.addEventListener('click', showPanel);

    var backdrop = document.getElementById('vnSaveBackdrop');
    if (backdrop) backdrop.addEventListener('click', function () { closeUI(); });

    document.addEventListener('keydown', function (e) {
      if (isOpen && e.key === 'Escape') { closeUI(); e.stopPropagation(); }
    }, false);

    /* 暴露给调试/复用 */
    root[NS].save._ui = {
      open: openUI, close: closeUI,
      openMode: function (m) { openUI(); showModal(m); }
    };
  }

  /* ---------------- 读取页 UI（loadPage.html） ---------------- */
  function initLoadPageUI() {
    var page = document.getElementById('vnLoadPage');
    if (!page) return;

    /* 自动存档区：左侧即“存档时的完整画面”缩略图 */
    var autoCard = document.getElementById('lpAutoCard');
    var autoShot = document.getElementById('lpAutoShot');
    var autoMeta = document.getElementById('lpAutoMeta');
    var btnAuto  = document.getElementById('lpBtnAuto');
    var auto = api.readAuto();
    if (btnAuto) {
      if (auto) {
        btnAuto.disabled = false;
        if (autoCard) autoCard.classList.add('is-occupied');
        if (autoShot) {
          var shot = buildShot(auto);
          if (shot) autoShot.appendChild(shot);
        }
        if (autoMeta) {
          autoMeta.textContent = '【已存档】 ' + (auto.chapter || '未知章节') +
            ' · ' + (auto.timeText || '') +
            ' · 进度约第 ' + ((auto.index || 0) + 1) + ' 句';
        }
        btnAuto.addEventListener('click', function () { api.goLoad(AUTO_KEY); });
      } else {
        btnAuto.disabled = true;
        if (autoCard) autoCard.classList.remove('is-occupied');
        if (autoMeta) autoMeta.textContent = '暂无自动存档：开始游戏后系统会自动记录进度';
      }
    }

    /* 手动存档区：6 张卡片（沿用 hall 的 .menuBtn 结构 + 画面缩略图背景） */
    var grid = document.getElementById('lpSlots');
    if (!grid) return;
    api.listSlots().forEach(function (o) {
      var s = o.save;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menuBtn lp-slot' + (o.occupied ? ' is-occupied' : ' is-empty');
      btn.setAttribute('aria-label', (o.occupied ? '读取存档位 ' : '空存档位 ') + o.slot);

      if (o.occupied) {
        var shot = buildShot(s);
        if (shot) btn.appendChild(shot);
      }

      var body = document.createElement('span');
      body.className = 'btnBody lp-slot__body';

      var head = document.createElement('span');
      head.className = 'lp-slot__head';
      var label = document.createElement('span');
      label.className = 'lp-slot__label';
      label.textContent = '存档位 ' + o.slot;
      var tag = document.createElement('span');
      tag.className = 'lp-slot__tag' + (o.occupied ? '' : ' is-dim');
      tag.textContent = o.occupied ? '已存档' : '空';
      head.appendChild(label);
      head.appendChild(tag);
      body.appendChild(head);

      if (o.occupied) {
        var ch = document.createElement('span');
        ch.className = 'lp-slot__chapter';
        ch.textContent = s.chapter || '未知章节';
        var meta = document.createElement('span');
        meta.className = 'lp-slot__meta';
        meta.textContent = (s.timeText || '') + ' · 第 ' + ((s.index || 0) + 1) + ' 句';
        body.appendChild(ch);
        body.appendChild(meta);
      } else {
        var empty = document.createElement('span');
        empty.className = 'lp-slot__empty';
        empty.textContent = '空存档位';
        body.appendChild(empty);
      }
      btn.appendChild(body);

      if (o.occupied) {
        btn.addEventListener('click', function () { api.goLoad(slotName(o.slot)); });
      } else {
        btn.disabled = true;                 /* 空档位：不可读取 */
      }
      grid.appendChild(btn);
    });
  }

  /* ---------------- 初始化 ---------------- */
  function boot() {
    wireAutosave();
    initIndexUI();
    initLoadPageUI();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }
})();
