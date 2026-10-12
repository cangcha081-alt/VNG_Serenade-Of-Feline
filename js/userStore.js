/* =========================================================
   userStore · 分账号进度隔离
   ---------------------------------------------------------
   · 登录成功后 index.html（login.js）会把当前用户名写入
     localStorage['vn_current_user']；本文件据此生成「按账号
     隔离的存储键名」，让存档/成就/小游戏战绩等进度数据
     互不干扰：实际键名 = 'u:' + 用户名 + ':' + 原键名。
   · 未登录（例如开发时直接打开某个页面）时键名保持原样，
     方便调试，行为与旧版一致。
   · 旧进度迁移：账号系统上线前产生的全局 vn_* 进度数据，
     由「更新后第一个登录的账号」认领（拷贝到自己名下），
     并写入 vn_legacy_claimed 标记，避免再次分配给其他账号。
     设置类数据（打字速度 / 总音量 / BGM / SE / 静音）与账号表
     不参与迁移：所有账号一律以 50% 默认值起步，玩家调整过后
     保存在自己账号名下（键同样走 u:用户名:前缀）。
   · 使用方式（须在本文件之后引入其它业务脚本）：
       var KEY = VN.userStore.key('vn_achievements');
   ========================================================= */
(function () {
  'use strict';

  var CUR_KEY = 'vn_current_user';      // 当前登录用户名
  var LEGACY_FLAG = 'vn_legacy_claimed'; // 旧全局进度已被哪个账号认领

  function currentUser() {
    try { return window.localStorage.getItem(CUR_KEY) || ''; }
    catch (e) { return ''; }
  }

  /* 原键名 → 实际存储键名（未登录时原样返回） */
  function key(name) {
    var u = currentUser();
    if (!u) return name;
    return 'u:' + u + ':' + name;
  }

  /* 一次性迁移：把旧的全局 vn_* 进度数据拷贝给当前账号 */
  (function migrateLegacy() {
    try {
      var u = currentUser();
      if (!u) return;                                // 未登录：不迁移（调试场景）
      if (window.localStorage.getItem(LEGACY_FLAG)) return; // 已被认领过
      var skip = function (k) {
        return k === CUR_KEY || k === LEGACY_FLAG ||
               k === 'users' || k.indexOf('remember') === 0 ||
               k.indexOf('vn_bgm_') === 0 ||          // 静音/BGM 音量：设备级旧键，不迁移
               k === 'vn_master_volume' || k === 'vn_se_volume' ||
               k === 'vn_text_speed';                 // 设置类：各账号以 50% 默认值重新起步
      };
      var names = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf('vn_') === 0 && !skip(k)) names.push(k);
      }
      names.forEach(function (k) {
        var nk = key(k);
        if (window.localStorage.getItem(nk) === null) {
          window.localStorage.setItem(nk, window.localStorage.getItem(k));
        }
      });
      window.localStorage.setItem(LEGACY_FLAG, u);
    } catch (e) { /* 隐私模式等异常下静默跳过 */ }
  })();

  window.VN = window.VN || {};
  window.VN.userStore = {
    currentUser: currentUser,
    key: key,
    CUR_KEY: CUR_KEY,
    /* 退出登录：清除当前账号标记（不清进度数据） */
    logout: function () {
      try { window.localStorage.removeItem(CUR_KEY); } catch (e) {}
    }
  };
})();
