(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  /* 分账号进度隔离：键名经 userStore 转换（u:用户名:原键名） */
  function ukey(name) {
    try { return (root.VN && root.VN.userStore) ? root.VN.userStore.key(name) : name; }
    catch (e) { return name; }
  }

  /* ★ 键名惰性求值：本文件可能先于 userStore.js 加载（endless_run.html 曾踩坑），
     加载时求值会拿不到 u:用户名: 前缀，导致成就写进无前缀键、成就页读不到。
     改成访问时才计算，并按键名缓存读取结果（键名变了自动重读）。 */
  function STORE_KEY() { return ukey('vn_achievements'); }
  function MINI_KEY()  { return ukey('vn_minigame_stats'); }
  function DED_KEY()   { return ukey('vn_deduction_stats'); }   /* 推理环节战绩（侦探之上 / 助手之下） */
  var AUTO_CLEAR_NEW = 4000;   // 成就页打开后 NEW 标识保留的毫秒数

  /*  成就定义 
     id 一旦发布不要改动（存档按 id 记录） */
  var LIST = [
    { id: 'huluo',       name: '虎落平阳',           desc: '作为黑猫被乌鸦追击' },
    { id: 'akina',       name: '秋名山猫神',         desc: '在两个小游戏I的过程中均一次通关' },
    { id: 'sleep',       name: '科目三：睡觉',       desc: '小游戏I中失败' },
    { id: 'detective',   name: '侦探之上',           desc: '在所有的推理环节中全部选出正确的选项' },
    { id: 'assistant',   name: '助手之下',           desc: '在所有的推理环节中选错选项累计超过十个' },
    { id: 'memory',      name: '你的记忆真好用',     desc: '首次进入他人的梦境/回忆' },
    { id: 'operator',    name: '王牌接听员',         desc: '在第一次推理中听完4月5日的录音回放' },
    { id: 'researcher',  name: '王牌研究员',         desc: '在第二次推理中看完实验室A402的人员介绍' },
    { id: 'cafe',        name: '律师徽章，再次闪耀！', desc: '在与知美的对话中找出真相' },
    { id: 'net3g',       name: '天翼3G太快了',       desc: '在网页小游戏中查到剧情相关的线索' },
    { id: 'justice',     name: '邪不压正',           desc: '在最终对决小游戏中战胜幕后凶手' },
    { id: 'sakura',      name: '樱树抽芽时，想你',   desc: '通关《樱花时节的遗书》' },
    { id: 'suspectx',    name: '嫌疑人X的献身',      desc: '通关《二重身的研究室》' },
    { id: 'farewell',    name: '再见，吾爱',         desc: '通关《背负诅咒的刺身》' },
    { id: 'curtain',     name: '帷幕',               desc: '通关《灵魂深处的面具》' },
    { id: 'catknows',    name: '只有猫知道',         desc: '通关《后日谈》' }
  ];

  /* 剧情类成就全部改由台本驱动：在 main.js 对应台词条目上写 achieve:'<成就id>'，
     演出跑完、该句台词出现的瞬间解锁并弹窗（不再按句索引 / 章节序号判定，
     台本增删不会错位）。目前挂了字段的：
       huluo     CG0 播完「让各位看到这么狼狈的场景……」
       sakura    「……就是现在！」（第一章，切入小游戏前）
       suspectx  「我在麻矢暖意的包围下，娓娓开口道来。」（第二章）
       farewell  「消防员奋力疏散人群，我却像被定住般不想动弹。」（第三章）
       curtain   「嗯，我们回去吧……回到我们的家。」（第四章）
       catknows  「那时，在湛蓝天穹的另一端……」（后日谈） */

  var byId = {};
  LIST.forEach(function (a) { byId[a.id] = a; });

  /*  存储  */
  function readStore() {
    try {
      var raw = root.localStorage.getItem(STORE_KEY());
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function writeStore(o) {
    try { root.localStorage.setItem(STORE_KEY(), JSON.stringify(o)); return true; }
    catch (e) { return false; }
  }
  function readMini() {
    try {
      var raw = root.localStorage.getItem(MINI_KEY());
      var o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o !== 'object') o = {};
      o.attempts = o.attempts || {};
      o.firstTry = o.firstTry || {};
      return o;
    } catch (e) { return { attempts: {}, firstTry: {}, failed: false }; }
  }
  function writeMini(o) {
    try { root.localStorage.setItem(MINI_KEY(), JSON.stringify(o)); } catch (e) {}
  }
  function readDed() {
    try {
      var raw = root.localStorage.getItem(DED_KEY());
      var o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o !== 'object') o = {};
      o.d1 = o.d1 || { done: false, perfect: false, wrong: 0 };
      o.d2 = o.d2 || { done: false, perfect: false, wrong: 0 };
      return o;
    } catch (e) { return { d1: { done: false, perfect: false, wrong: 0 }, d2: { done: false, perfect: false, wrong: 0 } }; }
  }
  function writeDed(o) {
    try { root.localStorage.setItem(DED_KEY(), JSON.stringify(o)); } catch (e) {}
  }

  /* 成就解锁快照：不再在加载时读取（见上方键名惰性求值说明），
     首次访问时才读取，且按键名缓存——userStore 就绪后键名带前缀，
     与剧情页/成就页读写的是同一个键。 */
  var storeCache = { key: null, data: null };
  function cur() {
    var k = STORE_KEY();
    if (storeCache.key !== k) { storeCache.key = k; storeCache.data = readStore(); }
    return storeCache.data;
  }

  /*  解锁通知：右上角轻提示（黄框透明底），不打断剧情，3 秒自动关闭  */
  var popupQueue = [];
  var popupBusy = false;
  var layer = null;
  var autoTimer = null;
  var hideTimer = null;
  var AUTO_CLOSE_MS = 3000;      // 显示 3 秒后自动关闭
  var HIDE_MS = 340;             // 与滑出动画时长一致

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'ach-popup-layer';
    layer.innerHTML =
      '<div class="ach-popup" role="status" aria-live="polite">' +
        '<span class="ach-popup__medal" aria-hidden="true"></span>' +
        '<div class="ach-popup__body">' +
          '<p class="ach-popup__kicker">获得成就</p>' +
          '<p class="ach-popup__name"></p>' +
        '</div>' +
        '<button type="button" class="ach-popup__close" aria-label="关闭">×</button>' +
      '</div>';
    document.body.appendChild(layer);

    var btn = layer.querySelector('.ach-popup__close');
    var box = layer.querySelector('.ach-popup');
    btn.addEventListener('click', function (e) { e.stopPropagation(); closePopup(); });
    box.addEventListener('click', function () { closePopup(); });   // 点通知本体也可立即关闭
    return layer;
  }

  function setMedal(el, gold) {
    el.innerHTML =
      '<svg viewBox="0 0 32 32" width="26" height="26">' +
        '<defs><linearGradient id="achg" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#e0a32a"/>' +
        '</linearGradient></defs>' +
        '<circle cx="16" cy="13" r="10" fill="url(#achg)" stroke="#8a5f14" stroke-width="1.5"/>' +
        '<path d="M11 20l-2.5 9 7.5-3.5 7.5 3.5L21 20z" fill="' + (gold ? '#d8b24a' : '#4d5a63') + '"/>' +
      '</svg>';
  }

  function clearTimers() {
    if (autoTimer) { root.clearTimeout(autoTimer); autoTimer = null; }
    if (hideTimer) { root.clearTimeout(hideTimer); hideTimer = null; }
  }

  function showPopup(id) {
    var a = byId[id];
    if (!a) return;
    ensureLayer();
    clearTimers();
    setMedal(layer.querySelector('.ach-popup__medal'), true);
    layer.querySelector('.ach-popup__name').textContent = '【' + a.name + '】';
    layer.classList.remove('is-hide');
    layer.classList.add('is-show');
    autoTimer = root.setTimeout(closePopup, AUTO_CLOSE_MS);
  }

  function closePopup() {
    if (!layer) return;
    clearTimers();
    layer.classList.remove('is-show');
    layer.classList.add('is-hide');
    /* 弹框关闭只做「关闭」，不标记为已查看：
       NEW 标识要留到玩家真正打开成就页看过才清除 */
    hideTimer = root.setTimeout(function () {
      popupQueue.shift();
      if (popupQueue.length) {
        showPopup(popupQueue[0]);
      } else {
        popupBusy = false;
      }
    }, HIDE_MS);
  }

  /*  对外 API  */
  var api = {
    LIST: LIST,

    /* 全部成就（含状态） */
    all: function () {
      return LIST.map(function (a) {
        var s = cur()[a.id];
        return {
          id: a.id, name: a.name, desc: a.desc,
          unlocked: !!s,
          time: s ? s.t : 0,
          seen: s ? !!s.seen : false,
          isNew: !!(s && !s.seen)
        };
      });
    },
    get: function (id) {
      var r = api.all().filter(function (x) { return x.id === id; })[0];
      return r || null;
    },
    has: function (id) { return !!cur()[id]; },
    unlockedCount: function () {
      return LIST.filter(function (a) { return !!cur()[a.id]; }).length;
    },
    totalCount: function () { return LIST.length; },
    unseenCount: function () {
      return LIST.filter(function (a) {
        var s = cur()[a.id]; return s && !s.seen;
      }).length;
    },

    /* 解锁成就（已获得则忽略）。silent=true 时不弹框 */
    unlock: function (id, silent) {
      var s = cur();
      if (!byId[id] || s[id]) return false;
      s[id] = { t: Date.now(), seen: false };
      writeStore(s);
      try {
        if (root.console) root.console.info('[VN · achieve] 解锁成就：' + byId[id].name);
      } catch (e) {}
      if (!silent) {
        if (!popupQueue.length && !popupBusy) popupBusy = true;
        popupQueue.push(id);
        if (popupQueue.length === 1) showPopup(id);
      }
      return true;
    },

    /* 标记为已查看（清除 NEW） */
    markSeen: function (id) {
      var s = cur();
      if (!s[id] || s[id].seen) return;
      s[id].seen = true;
      writeStore(s);
    },
    markAllSeen: function () {
      var s = cur();
      var dirty = false;
      for (var k in s) {
        if (Object.prototype.hasOwnProperty.call(s, k) && !s[k].seen) {
          s[k].seen = true; dirty = true;
        }
      }
      if (dirty) writeStore(s);
    },

    /* 小游戏 I 结果上报：lv=1/2，won=是否通关。
       成就在本函数内立刻解锁并弹框（获得位置＝小游戏 I 失败/通关的当下）：
       · sleep  「科目三：睡觉」  —— 第一次失败时
       · akina  「秋名山猫神」    —— 两关均一次通关（第二次通关的当下） */
    reportMinigame: function (lv, won) {
      var s = readMini();
      var key = String(lv || 1);
      s.attempts[key] = (s.attempts[key] || 0) + 1;
      if (won && s.attempts[key] === 1) s.firstTry[key] = true;
      if (!won) s.failed = true;
      writeMini(s);
      if (s.failed) api.unlock('sleep');
      if (s.firstTry['1'] && s.firstTry['2']) api.unlock('akina');
    },

    /* 读取小游戏统计（不触发解锁） */
    miniStats: function () { return readMini(); },

    /* 推理环节战绩上报（侦探之上 / 助手之下）。
       which='d1'（菊子梦境 deduction.html）/'d2'（千崎梦境 deduction2.html）
       perfect=本次全程未选错；wrong=本次累计选错次数。
       · detective「侦探之上」—— 两个推理环节均全对（后完成的那次解锁）
       · assistant「助手之下」—— 选错次数累计超过十个的当下 */
    reportDeduction: function (which, perfect, wrong) {
      var d = readDed();
      var rec = d[which];
      if (!rec) return;
      rec.wrong = (rec.wrong || 0) + (wrong || 0);
      rec.done = true;
      if (perfect) rec.perfect = true;
      writeDed(d);
      var totalWrong = (d.d1.wrong || 0) + (d.d2.wrong || 0);
      if (totalWrong > 10) api.unlock('assistant');
      if (d.d1.done && d.d1.perfect && d.d2.done && d.d2.perfect) api.unlock('detective');
    },

    /* 读取推理战绩（不触发解锁） */
    dedStats: function () { return readDed(); },

    /* 调试：清空全部成就 */
    reset: function () {
      storeCache = { key: null, data: null };
      writeStore({});
      try { root.localStorage.removeItem(MINI_KEY()); } catch (e) {}
      try { root.localStorage.removeItem(DED_KEY()); } catch (e) {}
    }
  };

  root[NS].achieve = api;

  var firstEval = true;

  function evaluateStory(idx) {
    if (typeof idx !== 'number' || idx < 0) return;
    var quiet = firstEval;

    /* 「虎落平阳」：由台本 CG0 台词条的 achieve 字段触发（见文件顶部说明）；
       「你的记忆真好用」：由 endless_run.js 进入游戏界面时触发。
       此处均不再按索引判定，避免台本增删后错位。 */

    /* 各章通关（sakura / suspectx / farewell / curtain / catknows）：
       已改为由台本指定台词条的 achieve 字段触发（见 main.js 中那五句台词），
       此处不再按「到达下一章首句」判定，避免与台词触发重复、且时间提前。 */

    /* 小游戏 I 相关：失败 / 两关均一次通关 */
    var s = readMini();
    if (s.failed) api.unlock('sleep', quiet);
    if (s.firstTry['1'] && s.firstTry['2']) api.unlock('akina', quiet);

    firstEval = false;
  }

  function watchStory() {
    var text = root.VN && root.VN.text;
    if (!text || typeof text.getProgress !== 'function') return false;
    var lastIdx = -1;
    root.setInterval(function () {
      try {
        var p = text.getProgress();
        if (!p || typeof p.index !== 'number') return;
        if (p.index === lastIdx) return;
        lastIdx = p.index;
        evaluateStory(p.index);
      } catch (e) {}
    }, 400);
    return true;
  }

  /*  成就页渲染  */
  function renderPage() {
    var listEl = document.getElementById('achList');
    if (!listEl) return;

    /* 已获得的排在最上面，锁定态保持原 LIST 顺序 */
    var data = api.all().slice().sort(function (a, b) {
      return (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0);
    });
    listEl.innerHTML = '';

    data.forEach(function (a) {
      var li = document.createElement('li');
      li.className = 'ach-item' + (a.unlocked ? ' is-unlocked' : ' is-locked');
      li.setAttribute('data-id', a.id);
      if (a.isNew) li.classList.add('is-new');

      var medal =
        '<span class="ach-item__medal" aria-hidden="true">' +
          '<svg viewBox="0 0 40 40" width="46" height="46">' +
            '<circle cx="20" cy="16" r="12" class="ach-medal__disc"/>' +
            '<path d="M13 25l-3.5 11 10.5-4.5 10.5 4.5L27 25z" class="ach-medal__ribbon"/>' +
            '<text x="20" y="21" text-anchor="middle" class="ach-medal__star">★</text>' +
          '</svg>' +
        '</span>';

      li.innerHTML =
        medal +
        '<span class="ach-item__main">' +
          '<span class="ach-item__top">' +
            '<span class="ach-item__name">' + esc(a.name) + '</span>' +
            (a.isNew ? '<span class="ach-item__new">NEW</span>' : '') +
          '</span>' +
          '<span class="ach-item__desc">' + esc(a.unlocked ? a.desc : '？？？？') + '</span>' +
          (a.unlocked && a.time
            ? '<span class="ach-item__time">' + fmtTime(a.time) + '</span>'
            : '<span class="ach-item__time">未获得</span>') +
        '</span>';

      li.addEventListener('click', function () {
        if (!a.isNew) return;
        api.markSeen(a.id);
        li.classList.remove('is-new');
        var badge = li.querySelector('.ach-item__new');
        if (badge) badge.remove();
        updateCounter();
      });

      listEl.appendChild(li);
    });

    updateCounter();

    /* 打开页面即视为「第一次查看」，短暂展示 NEW 后清除 */
    if (api.unseenCount() > 0) {
      root.setTimeout(function () {
        api.markAllSeen();
        var news = listEl.querySelectorAll('.ach-item__new');
        Array.prototype.forEach.call(news, function (n) { n.remove(); });
        Array.prototype.forEach.call(listEl.querySelectorAll('.is-new'), function (el) {
          el.classList.remove('is-new');
        });
        updateCounter();
      }, AUTO_CLEAR_NEW);
    }
  }

  function updateCounter() {
    var el = document.getElementById('achCount');
    if (el) el.textContent = api.unlockedCount() + ' / ' + api.totalCount();
    var bar = document.getElementById('achBar');
    if (bar) {
      var pct = Math.round(api.unlockedCount() / api.totalCount() * 100);
      bar.style.width = pct + '%';
    }
    var un = document.getElementById('achUnseen');
    if (un) {
      var n = api.unseenCount();
      un.textContent = n > 0 ? n + ' 个新成就' : '';
      un.hidden = n === 0;
    }
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /*  启动  */
  function boot() {
    if (document.getElementById('achList')) renderPage();
    if (document.getElementById('vnDialog') || document.getElementById('game')) watchStory();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }
})();
