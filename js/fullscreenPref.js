
(function () {
  'use strict';

  var KEY = 'vn_fullscreen';
  var inShell = (window.parent !== window);   /* 嵌在外壳 iframe 内 */
  var armed = false;
  var shellFull = false;                      /* 外壳模式：外壳当前是否全屏 */

  function wantFull() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function setPref(v) {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
  }
  function isFullLocal() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /* 外壳模式 */
  function shellAsk(action) {
    try { window.parent.postMessage({ __vnFs: action }, '*'); } catch (e) {}
  }
  function onShellState(full) {
    shellFull = !!full;
    if (shellFull) disarm();
    else if (wantFull()) arm();
  }
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d.__vnFsState !== 'boolean') return;
    onShellState(d.__vnFsState);
  });

  /* 独立模式 */
  function enterLocal() {
    if (isFullLocal()) return Promise.resolve();
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return undefined;
    try {
      var p = req.call(el);
      if (p && p.catch) p.catch(function () {});
      return p || Promise.resolve();
    } catch (e) { return undefined; }
  }

  function disarm() {
    armed = false;
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
  }
  function onGesture() {
    if (!armed) return;
    if (!wantFull()) { disarm(); return; }
    if (inShell) {
      shellAsk('enter');          /* 请外壳进入全屏（用户激活会向上传播到外壳） */
      return;                     /* 是否成功由外壳回报的状态消息决定 */
    }
    if (isFullLocal()) { disarm(); return; }
    var p = enterLocal();
    if (p && p.then) p.then(function () { disarm(); }, function () { /* 失败：下次交互继续尝试 */ });
  }
  function arm() {
    if (armed) return;
    if (inShell) { if (shellFull || !wantFull()) return; }
    else if (isFullLocal() || !wantFull()) return;
    armed = true;
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
  }

  /* 独立模式：区分「用户主动退出」与「页面跳转导致的被动退出」——
     后者不能改写偏好，否则新页面不再恢复。 */
  var navigating = false;
  window.addEventListener('pagehide', function () { navigating = true; });
  window.addEventListener('beforeunload', function () { navigating = true; });
  window.addEventListener('pageshow', function () { navigating = false; });

  function onFsChangeLocal() {
    if (inShell) return;
    if (isFullLocal()) { setPref(true); disarm(); }
    else if (!navigating) { setPref(false); arm(); }
  }
  document.addEventListener('fullscreenchange', onFsChangeLocal);
  document.addEventListener('webkitfullscreenchange', onFsChangeLocal);

  /* 启动 */
  if (inShell) {
    shellAsk('query');            /* 询问外壳当前状态 */
    if (wantFull()) arm();        /* 偏好为全屏：等待第一次交互请外壳进入 */
    setTimeout(function () { shellAsk('query'); }, 400);   /* 兜底再问一次 */
  } else if (wantFull()) {
    arm();
  }
})();
