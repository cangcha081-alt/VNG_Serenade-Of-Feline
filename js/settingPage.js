(function () {
  'use strict';
  var LS = window.localStorage;
  function readNum(k, d) {
    try {
      var v = parseFloat(LS.getItem(k));
      return isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
    } catch (e) { return d; }
  }
  function save(k, v) { try { LS.setItem(k, String(v)); } catch (e) {} }
  /* 读取原始数值（不做 [0,1] 钳制——readNum 是给音量用的，速度存的是毫秒数） */
  function readRaw(k, d) {
    try {
      var v = parseFloat(LS.getItem(k));
      return isFinite(v) ? v : d;
    } catch (e) { return d; }
  }
  function skey(name) {
    return (window.VN && VN.userStore && VN.userStore.key) ? VN.userStore.key(name) : name;
  }

  /* ============================================================
     与游戏本体的桥接（本工作区专用）
     ------------------------------------------------------------
     新版设置把值写在「按账号隔离」的键上：u:用户名:vn_bgm_volume；
     而工作区里的游戏本体（main.js / pageBgm.js）读的是**不带前缀**的
     vn_bgm_volume / vn_text_speed。这里保存时同时写一份无前缀的值 ——
     设置页调完，剧情 / 推理 / 小游戏下次载入就跟着生效（同源共享 localStorage）。
     读取时反过来：账号键没有值就退回无前缀键，界面能显示游戏里的当前值。
     以后若游戏本体也接入 userStore，把下面这三个函数换成直接 skey 即可。
     ============================================================ */
  function saveBoth(name, v) {
    save(skey(name), v);     /* 按账号（新版设置自己的口径） */
    save(name, v);           /* 无前缀（游戏本体读的口径） */
  }
  function readNumBoth(name, d) {
    var v = readNum(skey(name), NaN);
    return isFinite(v) ? v : readNum(name, d);
  }
  function readRawBoth(name, d) {
    var v = readRaw(skey(name), NaN);
    return isFinite(v) ? v : readRaw(name, d);
  }

  /* 滑条填充比例：驱动轨道渐变的 --val 变量（初始化 + 拖动时实时刷新） */
  function paintRange(el) {
    var min = parseFloat(el.min) || 0, max = parseFloat(el.max) || 100;
    var v = parseFloat(el.value) || 0;
    var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
    el.style.setProperty('--val', pct.toFixed(2) + '%');
  }
  (function wireRanges() {
    var ranges = document.querySelectorAll('input[type="range"]');
    Array.prototype.forEach.call(ranges, function (el) {
      paintRange(el);
      el.addEventListener('input', function () { paintRange(el); });
    });
  })();

  /*  返回来源页 
     入口通过 ?from= 带上来源；没有时回退 referrer，再回退主菜单。 */
  var FROM_WHITELIST = ['hall.html', 'attackboss.html', 'rpg1.html', 'rpg2.html', 'plot.html', 'deduction.html', 'deduction2.html'];
  var fromPage = 'hall.html';
  (function () {
    var m = new RegExp('[?&]from=([^&]+)').exec(location.search || '');
    var cand = m ? decodeURIComponent(m[1]) : '';
    if (!cand && document.referrer) {
      try { cand = new URL(document.referrer).pathname.split('/').pop(); } catch (e) {}
    }
    if (FROM_WHITELIST.indexOf(cand) >= 0) fromPage = cand;
  })();
  /* 返回地址：不只是「同一个页面」，还要回到离开时的进度 ——
     · plot.html → 带上当前账号的自动存档键（?save=），恢复到离开前那一句
     · rpg1/rpg2 → 裸地址即可（rpg.js 会用 sessionStorage 恢复探索进度）
     · 其余页面 → 裸地址 */
  function buildReturnUrl(page) {
    if (page === 'plot.html') {
      /* 玩法存档：本工作区的游戏写的是无前缀的 vn_save_auto；
         新版账号体系下是 u:用户名:vn_save_auto。哪个存在用哪个，避免「返回剧情」丢失续玩点。 */
      var plain = 'vn_save_auto';
      var key = plain;
      try {
        if (window.VN && VN.userStore && VN.userStore.key) {
          var named = VN.userStore.key(plain);
          if (LS.getItem(named)) key = named;
          else if (!LS.getItem(plain)) key = named;
        }
      } catch (e) {}
      return 'plot.html?save=' + encodeURIComponent(key);
    }
    if (page === 'rpg1.html' || page === 'rpg2.html') {
      return page + '?resume=1';   /* rpg.js 据此从 sessionStorage 恢复探索进度 */
    }
    return page;
  }
  document.getElementById('btnBack').addEventListener('click', function () {
    location.href = buildReturnUrl(fromPage);
  });

  /*  文字速度
     滑条 v:0~10 → 每字毫秒 ms=(10-v)*15（v=10 即 0ms 瞬间；默认 v=5 → 75ms，
     即滑条正中 50%）。分账号存储：键 = u:用户名:vn_text_speed，该账号调整过
     就保存上一次的选择，没调整过按默认值显示。 */
  var txt = document.getElementById('txtSpeed');
  var txtVal = document.getElementById('txtSpeedVal');
  function speedLabel(v) {
    if (v >= 10) return '瞬间';
    if (v >= 8) return '很快';
    if (v >= 5) return '适中';
    if (v >= 3) return '较慢';
    return '很慢';
  }
  function speedToMs(v) { return (10 - v) * 15; }
  function msToSpeed(ms) { return Math.max(0, Math.min(10, 10 - Math.round(ms / 15))); }
  var curSpeed = msToSpeed(Math.min(150, readRawBoth('vn_text_speed', 75)));
  txt.value = String(curSpeed);
  txtVal.textContent = speedLabel(curSpeed);

  /* 打字预览 */
  var preview = document.getElementById('typePreview');
  var previewTimer = null;
  function runPreview() {
    if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
    var full = '「喵——这样速度的感觉如何？」小黑甩了甩尾巴。';
    var i = 0;
    var ms = speedToSpeed2(curSpeed);
    function step() {
      if (i > full.length) return;
      preview.innerHTML = escapeHtml(full.slice(0, i)) + '<span class="cursor">▍</span>';
      var ch = full.charAt(i); i += 1;
      var d = ms;
      if ('。！？…，、；：'.indexOf(ch) >= 0) d += ms * 1.6;   // 标点稍作停顿，与游戏内一致
      previewTimer = setTimeout(step, d);
    }
    step();
  }
  function speedToSpeed2(v) { return Math.max(8, speedToMs(v)); }   // 预览最慢 8ms/帧，避免肉眼过慢
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  txt.addEventListener('input', function () {
    curSpeed = parseInt(txt.value, 10);
    txtVal.textContent = speedLabel(curSpeed);
    saveBoth('vn_text_speed', speedToMs(curSpeed));   /* 同时写游戏本体读的无前缀键 */
  });
  txt.addEventListener('change', runPreview);
  runPreview();

  /*  音量（总 / BGM / SE 分开）
     三条滑条默认都是 50%；分账号存储（u:用户名:键名），
     该账号调整过后保存上一次的选择。
     注意：游戏本体只有一个 vn_bgm_volume，所以桥接写进去的是**实际音量**
     （总音量 × 背景音乐），这样剧情/小游戏的音乐响度与这里显示的一致。 */
  var master = Math.round(readNumBoth('vn_master_volume', 0.5) * 100);
  var bgmVol = Math.round(readNumBoth('vn_bgm_volume', 0.5) * 100);
  var seVol = Math.round(readNumBoth('vn_se_volume', 0.5) * 100);
  var rM = document.getElementById('volMaster'), rB = document.getElementById('volBgm'), rS = document.getElementById('volSe');
  var vM = document.getElementById('volMasterVal'), vB = document.getElementById('volBgmVal'), vS = document.getElementById('volSeVal');
  function syncVolumeUI() {
    rM.value = master; rB.value = bgmVol; rS.value = seVol;
    vM.textContent = master + '%'; vB.textContent = bgmVol + '%'; vS.textContent = seVol + '%';
  }
  function applyPageBgm() {
    // 本页自己的 BGM（PageBgm 实例）实时跟随「总 × BGM」
    if (window.PageBgm && PageBgm.setVolume) PageBgm.setVolume((master / 100) * (bgmVol / 100));
  }
  /* 桥接：把「实际音量」写给游戏本体读的无前缀键 */
  function bridgeBgmVolume() {
    save('vn_bgm_volume', (master / 100) * (bgmVol / 100));
  }
  rM.addEventListener('input', function () {
    master = parseInt(rM.value, 10);
    saveBoth('vn_master_volume', master / 100);
    bridgeBgmVolume();
    syncVolumeUI(); applyPageBgm();
  });
  rB.addEventListener('input', function () {
    bgmVol = parseInt(rB.value, 10);
    saveBoth('vn_bgm_volume', bgmVol / 100);
    bridgeBgmVolume();
    syncVolumeUI(); applyPageBgm();
  });
  rS.addEventListener('input', function () {
    seVol = parseInt(rS.value, 10);
    save(skey('vn_se_volume'), seVol / 100);
    syncVolumeUI();
  });
  syncVolumeUI(); applyPageBgm();

  /* SE 试听*/
  document.getElementById('seTest').addEventListener('click', function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = new AC();
      var out = ctx.createGain();
      out.gain.value = (seVol / 100) * (master / 100);
      out.connect(ctx.destination);
      [660, 990].forEach(function (f, i) {
        var t0 = ctx.currentTime + i * 0.1;
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        osc.connect(g).connect(out);
        osc.start(t0); osc.stop(t0 + 0.18);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 800);
    } catch (e) {}
  });

  /*  全屏 */
  var btnFull = document.getElementById('btnFull');
  var frame = document.getElementById('gameFrame');
  var FULL_KEY = 'vn_fullscreen';
  var inFrame = (window.parent !== window);   /* 本页被嵌在 iframe 里（外壳模式下的游戏内设置页） */
  var shellFull = false;                      /* inFrame 时：外壳回报的真实全屏状态 */
  var shellActive = false;                    /* 顶层：外壳已激活（本页正承载游戏） */
  var pendingShell = false;                   /* 已申请全屏，等待 fullscreenchange 确认 */

  function isFullLocal() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function saveFullPref(v) {
    try { LS.setItem(FULL_KEY, v ? '1' : '0'); } catch (e) {}
  }
  function wantFullPref() {
    try { return LS.getItem(FULL_KEY) === '1'; } catch (e) { return false; }
  }
  function enterFullscreenLocal() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return false;
    try {
      var p = req.call(el);
      if (p && p.then) p.then(function () {}, function () {
        pendingShell = false; saveFullPref(false); syncFullBtn();
      });
      return true;
    } catch (e) { return false; }
  }
  function exitFullscreenLocal() {
    var d = document;
    var ex = d.exitFullscreen || d.webkitExitFullscreen;
    if (ex) { try { var p = ex.call(d); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  }
  function broadcastFs() {
    if (inFrame || !shellActive) return;
    try { frame.contentWindow.postMessage({ __vnFsState: isFullLocal() }, '*'); } catch (e) {}
  }

  /* —— 外壳激活 / 拆除 —— */
  function activateShell() {
    if (shellActive) { broadcastFs(); return; }
    shellActive = true;
    document.body.classList.add('is-shell');
    /* 暂停本页自己的 BGM，避免与游戏内音乐叠加 */
    try { if (window.PageBgm && PageBgm.pause) PageBgm.pause(); } catch (e) {}
    frame.src = buildReturnUrl(fromPage);       /* 从进入设置前的页面继续 */
    setTimeout(broadcastFs, 400);
  }
  function teardownShell() {
    if (!shellActive) return;
    shellActive = false; pendingShell = false;
    document.body.classList.remove('is-shell');
    try { frame.src = 'about:blank'; } catch (e) {}   /* 卸掉 iframe 里的游戏页（同时停掉其音乐） */
    /* 恢复本页 BGM（若被浏览器拦截，pageBgm 会提示并等首次手势补播） */
    try { if (window.PageBgm && PageBgm.play) PageBgm.play(); } catch (e) {}
    syncFullBtn();
  }

  function syncFullBtn() {
    var on = inFrame ? shellFull : (shellActive || isFullLocal());
    btnFull.textContent = on ? '退出全屏' : '进入全屏';
    btnFull.classList.toggle('is-on', on);
  }

  btnFull.addEventListener('click', function () {
    if (inFrame) {
      /* 游戏内设置页（在 iframe 里）：请父级外壳进入/退出全屏 */
      var act = shellFull ? 'exit' : 'enter';
      saveFullPref(act === 'enter');
      try { window.parent.postMessage({ __vnFs: act }, '*'); } catch (e) {}
      return;
    }
    if (shellActive || isFullLocal()) {
      /* 退出：偏好先记为关，实际拆除统一放在 fullscreenchange 里 */
      saveFullPref(false);
      exitFullscreenLocal();
      return;
    }
    /* 进入：申请成功后由 fullscreenchange 激活外壳 */
    saveFullPref(true);
    pendingShell = true;
    if (!enterFullscreenLocal()) { pendingShell = false; saveFullPref(false); }
    syncFullBtn();
  });

  function onFsChangeLocal() {
    if (inFrame) { syncFullBtn(); return; }
    if (isFullLocal()) {
      if (pendingShell) { pendingShell = false; activateShell(); }
    } else {
      pendingShell = false;
      saveFullPref(false);
      teardownShell();        /* 主动退出或按 Esc：一律拆外壳、回设置界面 */
    }
    syncFullBtn();
    broadcastFs();
  }
  document.addEventListener('fullscreenchange', onFsChangeLocal);
  document.addEventListener('webkitfullscreenchange', onFsChangeLocal);

  /* 外壳消息协议：iframe 内页面 → 本页（enter / exit / query）；本页 → iframe（状态回报） */
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (d && typeof d.__vnFsState === 'boolean') {       /* 收到外壳状态（仅 iframe 内的设置页用） */
      shellFull = d.__vnFsState;
      syncFullBtn();
      return;
    }
    if (d && d.__vnFs && !inFrame) {                     /* 本页作为外壳处理页内请求 */
      if (d.__vnFs === 'enter') {
        saveFullPref(true);
        if (isFullLocal()) { activateShell(); }
        else {
          pendingShell = true;
          if (!enterFullscreenLocal()) { pendingShell = false; saveFullPref(false); }
        }
      } else if (d.__vnFs === 'exit') {
        saveFullPref(false);
        if (isFullLocal()) exitFullscreenLocal();        /* 拆除在 fullscreenchange 里做 */
        else teardownShell();
      } else if (d.__vnFs === 'query') {
        broadcastFs();
      }
    }
  });

  /* iframe 每次载入新页面后，主动同步一次全屏状态给页内 UI */
  frame.addEventListener('load', function () { if (shellActive) setTimeout(broadcastFs, 60); });

  if (inFrame) {
    try { window.parent.postMessage({ __vnFs: 'query' }, '*'); } catch (e) {}
    setTimeout(syncFullBtn, 100);
  } else if (wantFullPref()) {
    /* 上次是全屏（如中途关过页面）：先以窗口模式恢复外壳，首次点击后自动回到全屏 */
    activateShell();
  }
  syncFullBtn();

  /*  CG 鉴赏 
     列表与 main.js 的 cgLib 保持一致；解锁记录在 vn_cg_seen（分账号）。 */
  var CG_LIST = [
    { id: 'CG0', title: 'CG 0', src: '../CG/Cat_CG0_fixed+.mp4' },
    { id: 'CG1', title: 'CG 1', src: '../CG/Cat_CG1.mp4' },
    { id: 'CG2', title: 'CG 2', src: '../CG/Cat_CG2.mp4' },
    { id: 'CG3', title: 'CG 3', src: '../CG/Cat_CG3.mp4' },
    { id: 'CG4', title: 'CG 4', src: '../CG/Cat_CG4.mp4' }
  ];
  function readSeen() {
    /* 解锁记录：账号键优先，没有就退回游戏本体写的无前缀 vn_cg_seen（本工作区桥接） */
    function parse(raw) {
      try { return JSON.parse(raw || '{}') || {}; } catch (e) { return {}; }
    }
    var named = parse(LS.getItem(skey('vn_cg_seen')));
    if (Object.keys(named).length) return named;
    return parse(LS.getItem('vn_cg_seen'));
  }
  var grid = document.getElementById('cgGrid');
  var seen = readSeen();
  CG_LIST.forEach(function (cg) {
    var div = document.createElement('div');
    var unlocked = !!seen[cg.id];
    div.className = 'cg-item' + (unlocked ? '' : ' is-locked');
    if (unlocked) {
      div.innerHTML =
        '<video src="' + cg.src + '#t=0.1" muted preload="metadata"></video>' +
        '<span class="tag">' + cg.title + '</span>';
      div.addEventListener('click', function () { openCg(cg); });
    } else {
      div.innerHTML = '<div class="lockface">？？？<small>尚未解锁</small></div>' +
                      '<span class="tag">' + cg.title + '</span>';
    }
    grid.appendChild(div);
  });

  /* CG 回放浮层 */
  var modal = document.getElementById('cgModal');
  var player = document.getElementById('cgPlayer');
  var modalTitle = document.getElementById('cgModalTitle');
  function openCg(cg) {
    modalTitle.textContent = cg.title;
    player.src = cg.src;
    try { player.volume = Math.min(1, (master / 100) * (bgmVol / 100)); } catch (e) {}
    modal.classList.add('is-open');
    var p = player.play();
    if (p && p.catch) p.catch(function () {});
  }
  function closeCg() {
    modal.classList.remove('is-open');
    try { player.pause(); } catch (e) {}
    player.removeAttribute('src'); player.load();
  }
  document.getElementById('cgClose').addEventListener('click', closeCg);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeCg(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeCg();
  });

  /*  退出登录（放最后）  */
  document.getElementById('btnLogout').addEventListener('click', function () {
    if (window.VN && VN.userStore && VN.userStore.logout) VN.userStore.logout();
    else { try { LS.removeItem('vn_current_user'); } catch (e) {} }
    location.href = '../index.html';
  });

  /* 各滑条初值已在上面按存档刷新过：最后统一重画填充比例 */
  Array.prototype.forEach.call(document.querySelectorAll('input[type="range"]'), paintRange);
})();
