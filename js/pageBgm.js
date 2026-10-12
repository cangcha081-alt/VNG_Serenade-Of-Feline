/* 页面背景音乐（pageBgm.js）
   ---------------------------------------------------------
   给「不加载 main.js」的独立页面用：登录/注册页、主菜单、
   主菜单子页（设置/成就/读取存档）以及各小游戏页。
   用法（在页面里先给配置，再引本文件）：

     <script>window.PAGE_BGM = { src: '音乐/黑猫的夜曲.mp3' };</script>
     <script src="js/pageBgm.js"></script>          // html/ 下的页面写 ../js/pageBgm.js

   可配置项：
     src      ：音频路径（必填）
     loop     ：是否循环，默认 true
     volume   ：0~1；不写则沿用游戏内音量滑条保存的值
     fadeOut  ：离开页面时淡出毫秒数，默认 400（0＝不淡出直接停）

   音量与静音沿用游戏内的设置（localStorage: vn_bgm_volume / vn_bgm_muted），
   所以玩家在游戏里调过的音量对登录页、主菜单同样生效。
   浏览器拦截自动播放时，会在玩家首次点击/按键时自动补播（不会卡住页面）。
   对外小接口：window.PageBgm.{ audio, play, pause, setVolume, isPlaying }

   —— 跨页连续播放（menuBgm 续播）——
   主菜单与它的子页（登录/设置/成就/读取存档）放的是同一首曲子，
   来回切页时不该从头再来。做法：播放中把「进度 + 墙钟时间戳」持续写进
   localStorage（vn_pagebgm_sync）；新页面加载时若曲子相同且断点新鲜
   （距上次写入 < 10 秒，说明中间一直有页面在放同一首），就先 seek 到
   「断点 + 离开耗时」再播——听感上音乐是连续的。
   从剧情/小游戏回到菜单时：剧情页（plot/deduction/deduction2）加载时会
   作废该同步点，小游戏页写的又是别的曲目 → 断点失效，音乐从头播，
   与「从剧情中进来不受连续性影响」的预期一致。 */
(function () {
  'use strict';

  var cfg = window.PAGE_BGM || {};
  if (!cfg.src) {
    if (window.console && console.warn) console.warn('[PageBgm] 缺少 window.PAGE_BGM.src，已跳过。');
    return;
  }

  var VOL_KEY = 'vn_bgm_volume';
  var MUTE_KEY = 'vn_bgm_muted';
  var SYNC_KEY = 'vn_pagebgm_sync';   // 跨页续播断点（曲目 + 进度 + 时间戳）
  var SYNC_MAX_AGE = 10000;           // 断点超过 10 秒视为失效（中间放过了别的音乐）

  function log(m) { if (window.console && console.info) console.info('[PageBgm] ' + m); }
  function warn(m) { if (window.console && console.warn) console.warn('[PageBgm] ' + m); }

  function readVolume() {
    try {
      var v = parseFloat(localStorage.getItem(VOL_KEY));
      return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
    } catch (e) { return 0.8; }
  }
  function readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }

  var volume = (typeof cfg.volume === 'number') ? Math.min(1, Math.max(0, cfg.volume)) : readVolume();
  var muted = readMuted();

  var audio = new Audio(String(cfg.src));
  audio.loop = (cfg.loop !== false);
  audio.preload = 'auto';
  audio.volume = muted ? 0 : volume;

  /* 循环保险：正常情况下 audio.loop 就够（ended 不会触发）；
     万一某些来源/编码让浏览器忽略 loop，这里在 ended 时手动从头再放一次。 */
  audio.addEventListener('ended', function () {
    try { audio.currentTime = 0; audio.play(); } catch (e) {}
  });

  /* —— 跨页续播断点：读取 / 写入 —— */
  function readSync() {
    try {
      var o = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null');
      return (o && typeof o === 'object' && o.src && isFinite(o.pos) && isFinite(o.t)) ? o : null;
    } catch (e) { return null; }
  }
  function writeSync(pos) {
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify({
        src: String(cfg.src),
        pos: isFinite(pos) ? pos : 0,
        t: Date.now()
      }));
    } catch (e) { /* 隐私模式等：续播不可用也不影响播放 */ }
  }

  /* 只认「同一首曲子 + 断点还新鲜」的同步点，否则从头播 */
  var resumeAt = null;
  (function computeResume() {
    var s = readSync();
    if (!s || s.src !== String(cfg.src)) return;
    var elapsed = Date.now() - s.t;
    if (elapsed < 0 || elapsed > SYNC_MAX_AGE) return;
    resumeAt = (s.pos || 0) + elapsed / 1000;
  })();

  /* 首次用户手势时补做的事（自动播放被拦时用） */
  var armed = false;
  function onFirstGesture(fn) {
    if (armed) return;
    armed = true;
    var once = function () {
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('keydown', once, true);
      armed = false;
      try { fn(); } catch (e) {}
    };
    document.addEventListener('pointerdown', once, true);
    document.addEventListener('keydown', once, true);
  }

  function applyVolume() { try { audio.volume = muted ? 0 : volume; } catch (e) {} }

  /* —— 「点击开启声音」提示 ——
     被浏览器自动播放策略拦下时，右下角浮出一行小胶囊；玩家一按键/点击（或直接点它）
     就补播并收起，12 秒后也会自己淡出。不挡操作、不抢焦点、不依赖页面 CSS。 */
  var hintEl = null, hintTimer = null;
  function audioHint(show) {
    if (show === false) {
      if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
      if (hintEl) {
        var dying = hintEl;
        hintEl = null;
        dying.style.opacity = '0';
        setTimeout(function () { try { dying.remove(); } catch (e) {} }, 420);
      }
      return;
    }
    if (hintEl || !document.body) return;
    hintEl = document.createElement('div');
    hintEl.id = 'pageAudioHint';
    hintEl.setAttribute('role', 'status');
    hintEl.textContent = '🔊 点击任意处开启声音';
    hintEl.style.cssText = [
      'position:fixed', 'right:20px', 'bottom:20px', 'z-index:90',
      'padding:8px 15px', 'border-radius:999px',
      'font:13px/1.4 "Microsoft YaHei",system-ui,-apple-system,sans-serif',
      'color:#f2dcab', 'background:rgba(14,12,20,.82)',
      'border:1px solid rgba(217,184,127,.38)',
      'box-shadow:0 8px 24px rgba(0,0,0,.5)',
      'letter-spacing:.06em', 'user-select:none', 'cursor:pointer',
      'pointer-events:auto'
    ].join(';');
    hintEl.addEventListener('click', function () { play(); });   /* 点它自己也能补播 */
    document.body.appendChild(hintEl);                           /* 立即出现（不依赖过渡） */
    hintTimer = setTimeout(function () { audioHint(false); }, 12000);
  }

  function play() {
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.then(function () { audioHint(false); })                  /* 出声成功 → 收起提示 */
       .catch(function () {
         log('浏览器拦截了自动播放，将在首次点击/按键后重试');
         onFirstGesture(function () { audio.play(); });
         audioHint(true);
       });
    }
    log('播放：' + cfg.src + '（' + (audio.loop ? '循环' : '单次') +
      '，音量 ' + Math.round((muted ? 0 : volume) * 100) + '%' +
      (muted ? '，游戏内已静音' : '') +
      (resumeAt != null ? '，续播自 ' + Math.round(resumeAt) + 's' : '') + '）');
  }

  /* 有断点时：先定位再开播（避免开头先露出一下），元数据迟迟不来也有兜底 */
  var started = false;
  function start() { if (started) return; started = true; play(); }
  if (resumeAt != null) {
    audio.addEventListener('loadedmetadata', function () {
      try {
        var d = audio.duration;
        if (isFinite(d) && d > 0 && resumeAt >= d) resumeAt = resumeAt % d;   // 循环曲回绕
        audio.currentTime = Math.max(0, resumeAt);
      } catch (e) {}
      resumeAt = null;
      start();
    }, { once: true });
    audio.addEventListener('error', function () { start(); }, { once: true });
    root.setTimeout(start, 2000);   // 兜底：极慢加载时也别让页面一直没声音
  } else {
    start();
  }

  /* 播放中持续记录断点（节流 ~0.4s），供下个页面续播 */
  var lastSync = 0;
  audio.addEventListener('timeupdate', function () {
    var now = Date.now();
    if (now - lastSync < 400) return;
    lastSync = now;
    writeSync(audio.currentTime || 0);
  });

  /* 离开页面 / 切到后台：先写最终断点再淡出，避免切页时被硬切 */
  function fadeOut(ms) {
    if (!ms) { try { audio.pause(); } catch (e) {} return; }
    var from = audio.volume;
    var t0 = Date.now();
    var timer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      try { audio.volume = from * (1 - k); } catch (e) {}
      if (k >= 1) { clearInterval(timer); try { audio.pause(); } catch (e2) {} }
    }, 40);
  }
  window.addEventListener('pagehide', function () {
    writeSync(audio.currentTime || 0);
    fadeOut(cfg.fadeOut === undefined ? 400 : cfg.fadeOut);
  });

  /* 从别的标签页/窗口切回来时，同步一次音量设置 */
  window.addEventListener('focus', function () {
    volume = (typeof cfg.volume === 'number') ? volume : readVolume();
    muted = readMuted();
    applyVolume();
  });

  window.PageBgm = {
    audio: audio,
    play: play,
    pause: function () { try { audio.pause(); } catch (e) {} },
    setVolume: function (v) {
      volume = Math.min(1, Math.max(0, parseFloat(v) || 0));
      applyVolume();
      return volume;
    },
    setMuted: function (b) { muted = !!b; applyVolume(); return muted; },
    isPlaying: function () { return !audio.paused; }
  };
})();
