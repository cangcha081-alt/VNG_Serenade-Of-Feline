(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  /* 开场系统提示 */
  var NOTICES = [
    { kicker: '系统提示', text: '推理阶段开始' },
    { kicker: '系统提示',
      text: '您需要根据抛出的疑问，出示对应的证物或做出选择。' +
            '错误的选择将导向Bad Ending。' }
  ];

  /* 系统提示之后的开场台词 */
  var DEDUCTION_LINES = [
    { speaker: '小黑', text: '这便是我作为死神的特殊能力。', portrait: '' },
    { speaker: '小黑', text: '通过与南乡菊子的精神波长同调，我已将自己的精神投影在她的梦中。', portrait: '' },
    { speaker: '小黑', text: '梦中是那天的瓢泼大雨，卡车驶来将南乡纯太郎撞出画面之外……', portrait: '' },
    { speaker: '小黑', text: '在这个由她的绝望构筑的封闭世界里，复现当时的线索，得出事件的真相吧。', portrait: '' }
  ];

  function log(msg) {
    if (root.console && root.console.info) root.console.info('[VN · deduction] ' + msg);
  }

  function chapterEl() { return document.getElementById('vnChapterTitle'); }

  /* 超过这个字数的提示按「整句话」排版（收字号、放宽行距），见 css/deduction.css ⑥ */
  var LONG_AT = 14;

  /*  物品栏：9 件证物（desc = 右键查看的物品栏介绍） */
  var ITEMS = [
    { id: 'sakura',    name: '【窗外的樱花树】',     desc: '南乡家院落中种植了许多樱树，打理精致，风景优美。' },
    { id: 'tv',        name: '【电视】',             desc: '一台电视机，是近年的型号，不能开机。' },
    { id: 'phone',     name: '【电话机的通话记录】', desc: '电话机上记录了事故当天的四次通话。分别是南乡菊子与丈夫南乡纯太郎，儿子南乡纯也与某刑警的通话记录。' },
    { id: 'briefcase', name: '【商务座与公文包】',   desc: '我也想把我的猫窝修成这种皮质。' },
    { id: 'photo',     name: '【餐桌上的合影照】',   desc: '桌上有两人年轻时在樱花树下的合影。' },
    { id: 'mural',     name: '【壁画】',             desc: '画有樱花树的风景画，似乎有着纪念意义。' },
    { id: 'diary',     name: '【菊子的日记】',       desc: '记录了南乡纯太郎半年来性情的异常。' },
    { id: 'letter',    name: '【口袋中的“遗书”】',   desc: '在南乡纯太郎的口袋中发现的遗书。笔迹确实是本人，但被雨水打湿后只能辨别清楚部分文字了。' },
    { id: 'sign',      name: '【社区警示牌】',       desc: '来到南乡家路上看见的警示牌' }
  ];

  /*  点某张卡之后的走向 */
  var OUTCOMES = {};

  /* 第一次卡片选择的三条分支
     ①【电话机的通话记录】→ 打字六段 → 第二次卡片选择
     ②【菊子的日记】/【口袋中的“遗书”】→ 打字两段 → chapter 式「沉重的枷锁」
        → 五句结局台词（与开场台词同一套 css/js）→ 跳到 plot 的 Chapter 2
     ③ 其余六张 → 打字「这是无效的证据，请再次选择。」→ 重新进行第一次选择 */

  /* ① 电话分支 */
  var PHONE_LINES = [
    '“看看第二通电话的记录吧。一个早上告诉你他会晚归，所以不用帮他准备晚餐，然后在傍晚时分回到家附近，打电话确认妻子是否用过晚餐？”',
    '“正常来说，一个准备要自杀的男人，会在意妻子是否吃过晚餐吗？”',
    '菊子一时语塞，表情微微亮起希望的光芒：“他想和我在外面吃饭……？”',
    '“宾果！他是在计划一场Surprise（惊喜）！”',
    '菊子摇了摇头：“他是不会做这种事的。从以前到现在，他从来没这么做过，而且那一天也不是什么纪念日……”',
    '“仔细想想那天究竟是什么特殊的日子？结合你们家中的布置，回忆一下。”'
  ];

  /* ② 坏结局分支 */
  var BADEND_ASK_LINES = [
    '菊子的情绪变得更加崩溃，她紧紧抱住头，梦境中的雨势瞬间暴涨。',
    '“这遗书就是警方断定他自杀的证据！日记里也写了他最近半年来对我的冷淡！你这只猫到底懂什么！”'
  ];

  /* ② 坏结局 */
  var BADEND_TITLE = { kicker: '结局', text: '沉重的枷锁' };

  /* ② 坏结局：五句结局台词 */
  var BADEND_LINES = [
    { speaker: '小黑', text: '“是啊……他太累了，而我不仅没能成为他的支柱，还成了压垮他的重担。”菊子的双眼彻底失去了高光。', portrait: '' },
    { speaker: '小黑', text: '就在那一瞬间，梦境崩塌了。不是消散，而是被无尽的黑雨彻底淹没。', portrait: '' },
    { speaker: '小黑', text: '我眼睁睁看着那辆卡车在斑马线前一次又一次、无情地将纯太郎撞飞，每一次碾压都伴随着菊子撕心裂肺的惨叫。', portrait: '' },
    { speaker: '小黑', text: '我被巨大的精神排斥力弹出了梦境。醒来后的菊子，眼神比死水还要沉寂。几天后，她冷漠地拒绝了明子的同住邀请，认为在这栋空虚寂寥的房子中腐朽凋零便是自己的义务。', portrait: '' },
    { speaker: '小黑', text: '我看向角落，作为地缚灵的纯太郎眼睁睁看着妻子枯萎。绝望与痛苦交织，他微弱的光芒逐渐被怨气吞噬，最终在悲哀中失去理智，沦为一只永远徘徊在和室、无法被超度的可悲怨灵。', portrait: '' }
  ];

  /* ③ 无效证据 */
  var INVALID_LINE = '这是无效的证据，请再次选择。';

  /* 第二次卡片选择的分支
     情况1【餐桌上的合影照】/【壁画】/【窗外的樱花树】→ 打字五段
        （前四段是剧情，最后一段是「请提交能证明纯太郎为什么要冲到卡车前面的证物。」）
        → 进入第三次卡片选择
     情况三 其余卡片 → 打字「这是无效的证据，请再次选择。」→ 重新进行第二次选择
     （情况二待你描述，届时加在 round2Outcome 里即可） */
  var ROUND2_LINES = [
    '“樱花……4月上旬，你送丈夫出门时，庭院的樱花正值盛开吧。”',
    '菊子突然睁大双眼，沙哑的声音从颤抖的嘴唇流泻而出：“不会吧……他还记得我们初次相遇那天的事……”',
    '“对南乡纯太郎来说，与你邂逅的日子远比结婚纪念日或生日重要，他计划了一场他不习惯的晚餐惊喜。”',
    '“但是……如果是这样，纯太郎为什么要自己冲到卡车前面……而且他手里明明什么都没拿……”。',
    '请提交能证明纯太郎为什么要冲到卡车前面的证物。'
  ];
  var ROUND2_OK_IDS = { photo: 1, mural: 1, sakura: 1 };

  /* 第三次卡片选择的分支
     情况1【商务座与公文包】/【社区警示牌】→ 打字七段 → chapter 式幻境卡
        「现实中，菊子猛然惊醒。」（字体与 chapter 不同，走 .is-dream 虚幻风）
     情况2【菊子的日记】→ chapter 式「结局 · 荒谬的遗憾」→ 六句结局台词
     情况3 其余卡片 → 打字「这是无效的证据，请再次选择。」→ 重新进行第三次选择 */
  var ROUND3_LINES = [
    '“就是抢劫啊。”',
    '“这一带似乎变态和抢劫频传。他准备了礼物，装著那份礼物的包包却被人抢走了，所以他才满脑子只想著要追上去，留意四周的余裕都没有。”',
    '菊子的手微微颤抖，颤抖随后从手一路扩散到全身。',
    '在梦境彻底结束前，我必须指出那个被抢走的包包，到底被慌不择路的抢劫犯扔在了哪里。',
    '第一次遇见南乡纯太郎的时候，他嘴里一直说着“随便”……',
    '有没有可能，随便是指……',
    '“去水边！”在推理梦境崩塌前的最后一秒，我大声喊道。'
  ];
  var ROUND3_OK_IDS = { briefcase: 1, sign: 1 };
  var ROUND3_DIARY_ID = 'diary';

  /* 情况1 收束：chapter 式浮现的一句话（幻境字体，见 css/deduction.css ⑨） */
  var DREAM_TEXT = '现实中，菊子猛然惊醒。';

  /* 情况2 结局：荒谬的遗憾 + 六句结局台词 */
  var FALSE_END_TITLE = { kicker: '结局', text: '荒谬的遗憾' };
  var FALSE_END_LINES = [
    { speaker: '小黑', text: '“他一定是因为太疲惫，或者年纪大了脚底打滑，才不小心跌进车道里的吧。”我试着用最符合常理的意外来解释这一切。', portrait: '' },
    { speaker: '小黑', text: '菊子愣住了，随后她缓缓捂住脸庞，这一次，她没有绝望地痛哭，而是流下了释然的眼泪。她接受了丈夫其实深爱着自己、只是死于一场无妄之灾的设定。', portrait: '' },
    { speaker: '小黑', text: '梦境温和地消散。菊子从梦中醒来，稍稍释怀了对“遗书”的恐惧。她重新拉开了檐廊的防雨门板，开始打理家务。', portrait: '' },
    { speaker: '小黑', text: '但是，作为死神的我却发现，南乡纯太郎的魂魄依然没有成佛。', portrait: '' },
    { speaker: '小黑', text: '我虽然缓解了菊子的抑郁，却未能解开地缚灵真正的依恋。', portrait: '' },
    { speaker: '小黑', text: '到底真相是什么？', portrait: '' }
  ];

  /* 跳到 plot 时用的返回键。
     ★ 必须与剧情页写下的键**完全一致**：plot.html 没有引入 userStore.js，
       main.js 的 beginExit() 永远写裸键 vn_minigame_return；
       这里若用 userStore.key('vn_minigame_return')（登录后＝u:<用户>:vn_minigame_return）
       就会读不到返回点 → 退化成「先播 CG 过场再回剧情」，同一支 CG 会连播两遍。 */
  var RETURN_KEY = 'vn_minigame_return';

  /* ---------------- 推理页背景音乐 ----------------
     音乐/READ ME.docx：福尔摩斯（循环）→「线索板(deduction)推理，仅在该界面使用，
     跳转坏结局不用」。deduction.html 与 deduction2.html 共用本文件，两页都会播。
     音量/静音沿用游戏内设置（VN.bgm）；引擎遇到同一首正在播会跳过，不会重头来。 */
  var BOARD_BGM = '福尔摩斯';

  /* 坏结局专用曲：Life Sentence（福尔摩斯让位） */
  var BADEND_BGM = 'Life Sentence';
  function badEndBgm(on) {
    var bgm = root.VN && root.VN.bgm;
    if (!bgm) return;
    if (on) {
      if (bgm.play) bgm.play(BADEND_BGM);
    } else if (bgm.stop && bgm.current && bgm.current() === BADEND_BGM) {
      bgm.stop();
    }
  }


  function boardBgm(on) {
    var bgm = root.VN && root.VN.bgm;
    if (!bgm) return;
    if (on) {
      if (bgm.play) bgm.play(BOARD_BGM);
    } else if (bgm.stop && bgm.current && bgm.current() === BOARD_BGM) {
      bgm.stop();
    }
  }

  /* 打字机（速度跟随设置页 vn_text_speed，毫秒/字；分账号存储，默认 75 = 滑条正中） */
  var TYPE_SPEED = (function () {
    try {
      var k = (root.VN && root.VN.userStore) ? root.VN.userStore.key('vn_text_speed') : 'vn_text_speed';
      var s = parseFloat(root.localStorage.getItem(k));
      if (isFinite(s)) return Math.min(200, Math.max(0, s));
    } catch (e) {}
    return 75;
  })();
  var PUNCT_DELAY = {
    '。': 180, '！': 220, '？': 220, '…': 180, '～': 160,
    '，': 80, '、': 70, '；': 110, '：': 100, '—': 140,
    '.': 90, '!': 220, '?': 220, ',': 60
  };
  var reducedMotion =
    root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var invOpen = false;      /* 物品栏是否已打开 */
  var typing = false;       /* 当前这一段是否正在逐字打出 */
  var typeTimer = null;
  var typeDone = null;      /* 当前这次打字的「立即补全」 */
  var cardsReady = false;   /* 问句全部打完 → 卡片可选 */
  var selected = null;      /* 当前选中的线索 */
  var wrongCount = 0;       /* 本次推理累计选错次数（无效证据 / 坏结局 / 假结局） */

  /* 成就上报（侦探之上 / 助手之下）：推理成功收束的当下由 achieve.js 判定解锁 */
  function reportDeductionResult() {
    try {
      if (root.VN && root.VN.achieve && typeof root.VN.achieve.reportDeduction === 'function') {
        root.VN.achieve.reportDeduction('d1', wrongCount === 0, wrongCount);
      }
    } catch (e) { log('成就上报失败：' + e); }
  }
  var picking = false;      /* 正在播「出示」动画，防连点 */
  var openedAt = 0;         /* 打开时刻，用于忽略「打开那一下」的点击 */
  var ASK_LINES = [];       /* 问句各段原文，boot 时从 HTML 的 [data-ask] 段落读出（默认两段） */
  var askLines = [];        /* 本轮实际要打的若干段（openInventory 传入，默认同上） */
  var askIdx = 0;           /* 正在打第几段 */
  var askWaiting = false;   /* 一段打完、等空格/点击进入下一段 */
  var round = 1;            /* 第几次卡片选择（1 / 2） */
  var onTyped = null;       /* 本次文字打完后接管的回调（可选，用于自定分支） */
  var phase = 'opening';    /* opening：开场台词；badend：坏结局台词 */

  function invEl() { return document.getElementById('dcInv'); }
  function askEls() {
    var box = document.getElementById('dcInvAsk');
    return box ? Array.prototype.slice.call(box.querySelectorAll('[data-ask]')) : [];
  }

  function setHint(msg) {
    var h = document.getElementById('dcInvHint');
    if (h) h.textContent = msg;
  }

  function clearType() { if (typeTimer) { root.clearTimeout(typeTimer); typeTimer = null; } }

  /*  把某一段逐字打出，打完调用 onDone  */
  function typeLine(el, text, onDone) {
    var full = String(text === undefined || text === null ? '' : text);
    var shown = 0;
    clearType();
    typing = true;
    if (el) {
      el.textContent = '';
      el.classList.add('is-typing');
    }

    function finish() {
      typing = false;
      clearType();
      if (el) {
        el.textContent = full;
        el.classList.remove('is-typing');
      }
      if (typeof onDone === 'function') onDone();
    }
    typeDone = finish;

    if (!full.length || reducedMotion || TYPE_SPEED <= 0) { finish(); return; }

    function tick() {
      if (!typing) return;
      shown++;
      if (el) el.textContent = full.slice(0, shown);
      if (shown >= full.length) { finish(); return; }
      var ch = full.charAt(shown - 1);
      typeTimer = root.setTimeout(tick, TYPE_SPEED + (PUNCT_DELAY[ch] || 0));
    }
    typeTimer = root.setTimeout(tick, TYPE_SPEED);
  }

  /* 问句流程：逐段打字 → 全部打完进入卡片选择 */

  /* 把本次要打的若干段铺进问句框 */
  function renderAskLines(lines) {
    var box = document.getElementById('dcInvAsk');
    if (!box) return;
    askEls().forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    var hint = document.getElementById('dcInvHint');
    (lines || []).forEach(function (t) {
      var p = document.createElement('p');
      p.className = 'dialogue-box__text';
      p.setAttribute('data-ask', '');
      p.textContent = String(t === undefined || t === null ? '' : t);
      if (hint) box.insertBefore(p, hint); else box.appendChild(p);
    });
  }

  function resetAsk() {
    askEls().forEach(function (el) {
      el.textContent = '';
      el.classList.remove('is-typing');
    });
    askIdx = 0;
    askWaiting = false;
    clearType();
    typing = false;
  }

  function typeAsk() {
    var els = askEls();
    var el = els[askIdx];
    if (!el) { finishAsk(); return; }
    setHint('按空格快进');
    typeLine(el, askLines[askIdx], function () {
      if (askIdx >= askLines.length - 1) { finishAsk(); return; }
      askWaiting = true;                 /* 还有下一段：等玩家按空格/点击 */
      setHint('按空格继续');
    });
  }

  function finishAsk() {
    askWaiting = false;
    if (typeof onTyped === 'function') {         /* 自定义去向（如坏结局分支） */
      var cb = onTyped;
      onTyped = null;
      setHint('');
      cb();
      return;
    }
    setHint('右键点击线索查看详情，左键点击线索选中，再按「出示线索」提交');
    setCardsLocked(false);
    var grid = document.getElementById('dcInvGrid');
    var first = grid ? grid.querySelector('.clue-item') : null;
    if (first && first.focus) first.focus();
    log('问句打完，进入第 ' + round + ' 次卡片选择（' + ITEMS.length + ' 条线索）。');
  }

  /* 空格 / 点击*/
  function advanceAsk() {
    if (typing) { skipTyping(); return true; }
    if (askWaiting) {
      askWaiting = false;
      askIdx++;
      typeAsk();
      return true;
    }
    return false;
  }

  function skipTyping() {
    if (typing && typeof typeDone === 'function') { typeDone(); return true; }
    return false;
  }

  /*  生成一张线索卡*/
  function buildCard(item) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'clue-item';
    btn.setAttribute('data-item', item.id);
    btn.setAttribute('aria-label', '线索 ' + item.name);
    btn.setAttribute('aria-pressed', 'false');

    var bg = document.createElement('span');
    bg.className = 'clue-bg';
    bg.setAttribute('aria-hidden', 'true');

    var top = document.createElement('span');
    top.className = 'clue-top';
    var name = document.createElement('span');
    name.className = 'clue-name';
    name.textContent = item.name;
    top.appendChild(name);

    var desc = document.createElement('span');
    desc.className = 'clue-desc';
    desc.textContent = item.desc || '';

    btn.appendChild(bg);
    btn.appendChild(top);
    btn.appendChild(desc);
    btn.addEventListener('click', function () { selectCard(item, btn); });
    return btn;
  }

  /*  选中一张线索卡  */
  function selectCard(item, card) {
    if (!cardsReady || picking) return;
    var grid = document.getElementById('dcInvGrid');
    if (grid) {
      Array.prototype.forEach.call(grid.querySelectorAll('.clue-item'), function (c) {
        var on = (c === card);
        c.classList.toggle('is-selected', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    selected = item;
    updateSubmit();
    log('选中线索：' + item.name);
  }

  function updateSubmit() {
    var btn = document.getElementById('dcInvSubmit');
    if (btn) btn.disabled = !(cardsReady && selected && !picking);
  }

  /*  按下「出示线索」*/
  function submitClue() {
    if (!cardsReady || !selected || picking) return;
    var card = document.querySelector('.clue-item.is-selected');
    pickItem(selected, card);
  }

  /*  卡片锁定 / 解锁 */
  function setCardsLocked(locked) {
    cardsReady = !locked;
    var grid = document.getElementById('dcInvGrid');
    var inv = invEl();
    if (inv) {
      inv.classList.toggle('is-locked', locked);
      inv.classList.toggle('is-ready', !locked);   /* css 的解锁态/光标隐藏都挂在这上面 */
    }
    if (grid) {
      grid.classList.toggle('is-ready', !locked);
      Array.prototype.forEach.call(grid.querySelectorAll('.clue-item'), function (c) {
        c.setAttribute('aria-disabled', locked ? 'true' : 'false');
        c.tabIndex = locked ? -1 : 0;
        if (locked) {                                /* 锁定时清掉选中态 */
          c.classList.remove('is-selected');
          c.setAttribute('aria-pressed', 'false');
        }
      });
    }
    if (locked) selected = null;
    updateSubmit();
  }

  /*  打开物品栏
      opts.lines   ：本次要逐段打出的文字
      opts.round   ：第几次卡片选择（1 / 2），决定提交后走哪套分支
      opts.onTyped ：全部打完后接管 */
  function openInventory(opts) {
    opts = opts || {};
    var el = invEl();
    var grid = document.getElementById('dcInvGrid');
    if (!el || !grid) { log('未找到物品栏容器（#dcInv / #dcInvGrid）。'); return; }

    boardBgm(true);                        /* 线索板专用曲（已在播则跳过） */

    round = opts.round || 1;
    onTyped = (typeof opts.onTyped === 'function') ? opts.onTyped : null;
    var lines = (opts.lines && opts.lines.length) ? opts.lines : ASK_LINES;

    if (!grid.childElementCount) {
      ITEMS.forEach(function (it) { grid.appendChild(buildCard(it)); });
    }
    Array.prototype.forEach.call(grid.querySelectorAll('.clue-item'), function (c) {
      c.classList.remove('is-picked', 'is-selected');
      c.setAttribute('aria-pressed', 'false');
    });
    selected = null;

    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    invOpen = true;
    openedAt = Date.now();
    setCardsLocked(true);

    var text = root.VN && root.VN.text;
    if (text && text.setEnabled) text.setEnabled(false);   /* 物品栏期间不推进剧情 */

    renderAskLines(lines);      /* 本次的段落铺进问句框 */
    askLines = lines.slice();   /* 打字时读这一份 */
    resetAsk();                 /* 清空后从第一段开始逐字打出 */
    typeAsk();
    log('物品栏已打开（第 ' + round + ' 轮），开始打出 ' + lines.length + ' 段文字。');
  }

  function closeInventory() {
    var el = invEl();
    clearType();
    typing = false;
    cardsReady = false;
    if (el) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); }
    invOpen = false;
  }

  /* 出示 */
  function pickItem(item, card) {
    if (picking || !cardsReady) return;             /* 问句没打完不能提交 */
    picking = true;
    updateSubmit();
    if (card) card.classList.add('is-picked');
    log('出示线索：' + item.name);
    root.setTimeout(function () {
      picking = false;
      closeInventory();
      showOutcome(item);
    }, 620);
  }

  /*  提交后的去向 */
  function showOutcome(item) {
    /* 自定义分支表 */
    var o = OUTCOMES[item.id];
    if (o) {
      log('进入：' + (o.title || item.id));
      if (typeof o.enter === 'function') { o.enter(item); return; }
      if (o.lines) {
        var dlg0 = root.VN && root.VN.dialog;
        var text0 = root.VN && root.VN.text;
        if (dlg0 && dlg0.show) dlg0.show();
        if (text0 && text0.setEnabled) text0.setEnabled(true);
        if (text0 && text0.queue) text0.queue(o.lines);
      }
      return;
    }

    if (round === 3) { round3Outcome(item); return; }      /* 第三次选择：分支待接入 */
    if (round === 2) { round2Outcome(item); return; }      /* 第二次选择 */

    if (item.id === 'phone') { phoneBranch(item); return; }                       /* ① */
    if (item.id === 'diary' || item.id === 'letter') { badEndBranch(item); return; } /* ② */
    invalidBranch(item);                                                          /* ③ */
  }

  /* ①【电话机的通话记录】*/
  function phoneBranch(item) {
    log('分支①「' + item.name + '」→ 打出六段 → 第二次卡片选择');
    openInventory({ lines: PHONE_LINES, round: 2 });
  }

  /* ②【菊子的日记】/【口袋中的“遗书”】跳 Chapter 2 */
  function badEndBranch(item) {
    wrongCount++;                          /* 选错：坏结局 */
    log('分支②「' + item.name + '」→ 结局：' + BADEND_TITLE.text);
    openInventory({
      lines: BADEND_ASK_LINES,
      round: 1,
      onTyped: function () { playBadEnding(); }
    });
  }

  /*  坏结局对话背景：第一组案发现场（南乡家 1-1），播完收起  */
  var BADEND_BG_SRC = '../images/maps/RPG1-1.jpg';
  function showBadEndBg() {
    var img = document.getElementById('vnBgImg');
    var bg = document.getElementById('vnBg');
    if (img) img.setAttribute('src', BADEND_BG_SRC);
    if (bg) bg.classList.add('is-dim');
  }
  function hideBadEndBg() {
    var img = document.getElementById('vnBgImg');
    var bg = document.getElementById('vnBg');
    if (img) img.removeAttribute('src');
    if (bg) bg.classList.remove('is-dim');
  }

  function playBadEnding() {
    closeInventory();
    badEndBgm(true);                       /* 结局分支：不用线索板曲（README） */
    var text = root.VN && root.VN.text;
    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();
    showBadEndBg();

    /* chapter 式标题卡：结局 · 沉重的枷锁 */
    playNotices([BADEND_TITLE], function () {
      var dlg = root.VN && root.VN.dialog;
      if (dlg && dlg.show) dlg.show();
      if (text && text.setEnabled) text.setEnabled(true);
      phase = 'badend';                       /* 五句播完后由 queueEnd 跳 Chapter 2 */
      if (text && text.queue) text.queue(BADEND_LINES);
      log('坏结局五句开始播放（共 ' + BADEND_LINES.length + ' 句）。');
    });
  }

  /* ③ 无效证据*/
  function invalidBranch(item) {
    wrongCount++;                          /* 选错：无效证据 */
    log('分支③「' + item.name + '」→ 无效证据，重新选择');
    openInventory({ lines: [INVALID_LINE], round: 1 });
  }

  /* 第二次选择的走向：
     情况1 合影照 / 壁画 / 樱花树 → 打字五段 → 第三次卡片选择
     情况三 其余卡片 → 无效证据 → 重新进行第二次选择 */
  function round2Outcome(item) {
    if (ROUND2_OK_IDS[item.id]) {
      log('第二次选择 · 情况1「' + item.name + '」→ 打出五段 → 第三次卡片选择');
      openInventory({ lines: ROUND2_LINES, round: 3 });
      return;
    }
    log('第二次选择 · 情况三「' + item.name + '」→ 无效证据，重新进行第二次选择');
    wrongCount++;                          /* 选错：无效证据 */
    openInventory({ lines: [INVALID_LINE], round: 2 });
  }

  /* 第三次选择的走向：
     情况1 商务座与公文包 / 社区警示牌 → 打字七段 → 「现实中，菊子猛然惊醒。」
     情况2 菊子的日记 → 结局「荒谬的遗憾」→ 六句结局台词
     情况3 其余卡片 → 无效证据 → 重新进行第三次选择 */
  function round3Outcome(item) {
    if (ROUND3_OK_IDS[item.id]) {
      log('第三次选择 · 情况1「' + item.name + '」→ 打出七段 → 梦境收束');
      openInventory({
        lines: ROUND3_LINES,
        round: 3,
        onTyped: function () { playDreamAwake(); }
      });
      return;
    }
    if (item.id === ROUND3_DIARY_ID) {
      wrongCount++;                        /* 选错：假结局「荒谬的遗憾」 */
      log('第三次选择 · 情况2「' + item.name + '」→ 结局：' + FALSE_END_TITLE.text);
      playFalseEnding();
      return;
    }
    log('第三次选择 · 情况3「' + item.name + '」→ 无效证据，重新进行第三次选择');
    wrongCount++;                          /* 选错：无效证据 */
    openInventory({ lines: [INVALID_LINE], round: 3 });
  }

  /* 情况1 收束 */
  function playDreamAwake() {
    closeInventory();
    reportDeductionResult();               /* 推理完成：上报战绩（全对→侦探之上 / 累计选错>10→助手之下） */
    boardBgm(false);                       /* 收束离开本页前先停线索板曲 */
    var text = root.VN && root.VN.text;
    var el = chapterEl();
    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();

    if (el) el.classList.add('is-dream');       /* 换一套「虚幻」字体 */
    playNotices([{ kicker: '', text: DREAM_TEXT }], function () {
      if (el) el.classList.remove('is-dream');
      log('「' + DREAM_TEXT + '」播完，衔接 ' + RETURN_CG + ' 并回到视觉小说。');
      returnToStory();                          /* 衔接 CG（随剧情或过场页）→ 回 plot 续播 */
    });
  }

  /* 情况2：chapter 式结局卡 */
  function playFalseEnding() {
    closeInventory();
    badEndBgm(true);                       /* 结局分支：不用线索板曲（README） */
    var text = root.VN && root.VN.text;
    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();
    showBadEndBg();

    playNotices([FALSE_END_TITLE], function () {
      var dlg = root.VN && root.VN.dialog;
      if (dlg && dlg.show) dlg.show();
      if (text && text.setEnabled) text.setEnabled(true);
      phase = 'falseend';                        /* 六句播完由 queueEnd 送回第三次选择 */
      if (text && text.queue) text.queue(FALSE_END_LINES);
      log('结局「' + FALSE_END_TITLE.text + '」六句台词开始播放。');
    });
  }

  /* 跳回 plot 的章节 */
  function chapterIndexAt(name) {
    var marks = (root.VN && root.VN.storyMarks) || [];
    for (var i = 0; i < marks.length; i++) {
      if (String(marks[i].name || '').indexOf(name) >= 0) return marks[i].at;
    }
    return -1;
  }

  function gotoStory(idx, chapterName) {
    if (idx < 0) {
      log('找不到该章节起点，退回主菜单。');
      root.location.href = 'hall.html';
      return;
    }
    var lines = (root.VN && root.VN.storyLines) || [];
    try {
      root.localStorage.setItem(RETURN_KEY, JSON.stringify({
        kind: 'auto',
        time: Date.now(),
        index: idx,
        item: lines[idx] || { speaker: '', text: '', portrait: '' },
        bgKey: null,
        chapter: chapterName || ''
      }));
    } catch (e) { log('写入返回点失败：' + e); }

    log('跳转 plot → ' + (chapterName || '') + '（第 ' + idx + ' 句）');
    root.location.href = 'plot.html?save=' + encodeURIComponent(RETURN_KEY);
  }

  function gotoChapter2() {
    gotoStory(chapterIndexAt('Chapter 2'), 'Chapter 2 二重身的研究室');
  }

  /* ---------------- 推理结束后的去向：衔接一支 CG，再回到视觉小说 ----------------
     页面用 <body data-return-cg="CG1"> 指定本阶段结束后要衔接的 CG
     （deduction.html → CG1；deduction2.html → CG2）。
     优先沿用剧情进入小游戏时写下的返回点（vn_minigame_return ＝ 夜跑那句的下一句）：
       · 返回点那句本身就带这支 CG  → 直接回剧情（CG 随该句播放，只播一次）
       · 返回点那句没有这支 CG      → 先跳到 CG 过场页播完，再回到同一返回点
     两种情形都不会跳过中间剧情、也不会重复播放。
     若没有返回点（例如直接打开推理页调试），退到「该 CG 所在的那一句」。 */
  var RETURN_CG = (document.body && document.body.getAttribute('data-return-cg')) || 'CG1';
  log('推理页配置：收束后衔接 ' + RETURN_CG + '，再回到视觉小说。');

  function savedReturnIndex() {
    try {
      var raw = root.localStorage.getItem(RETURN_KEY);
      if (!raw) return -1;
      var s = JSON.parse(raw);
      return (s && typeof s.index === 'number' && s.index >= 0) ? s.index : -1;
    } catch (e) { return -1; }
  }

  function cgLineIndex(key) {
    var lines = (root.VN && root.VN.storyLines) || [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] && String(lines[i].cg) === String(key)) return i;
    }
    return -1;
  }

  function returnToStory() {
    var lines = (root.VN && root.VN.storyLines) || [];
    var idx = savedReturnIndex();
    var cgIdx = cgLineIndex(RETURN_CG);

    /* ① 返回点自带这支 CG → 直接回剧情，CG 会随那一句播放 */
    if (idx >= 0 && lines[idx] && String(lines[idx].cg) === String(RETURN_CG)) {
      log('衔接 ' + RETURN_CG + '：返回点 #' + idx + ' 自带该 CG，直接回剧情。');
      gotoStory(idx, '剧情 · ' + RETURN_CG);
      return;
    }

    /* ② 返回点没有这支 CG → 先播 CG 过场，播完再回同一返回点 */
    if (idx >= 0 || cgIdx >= 0) {
      var back = 'plot.html?save=' + encodeURIComponent(RETURN_KEY);
      if (idx < 0) {                       /* 没有返回点：退到该 CG 所在句 */
        try {
          root.localStorage.setItem(RETURN_KEY, JSON.stringify({
            kind: 'auto', time: Date.now(), index: cgIdx,
            item: lines[cgIdx] || { speaker: '', text: '', portrait: '' },
            bgKey: null, chapter: '剧情 · ' + RETURN_CG
          }));
        } catch (eW) {}
        back = 'plot.html?save=' + encodeURIComponent(RETURN_KEY);
        log('衔接 ' + RETURN_CG + '：无返回点，退到该 CG 所在句 #' + cgIdx + '。');
      } else {
        log('衔接 ' + RETURN_CG + '：先播 CG 过场，再回返回点 #' + idx + '。');
      }
      root.location.href = 'cgplay.html?key=' + encodeURIComponent(RETURN_CG) +
        '&next=' + encodeURIComponent(back);
      return;
    }

    /* ③ 既没有返回点也没有该 CG：退回 Chapter 2（保底） */
    log('衔接 ' + RETURN_CG + ' 失败（找不到返回点与该 CG），退回 Chapter 2。');
    gotoChapter2();
  }

  /*  物品栏键盘 */
  function onInvKey(e) {
    if (!invOpen) return;
    var isSpace = (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');

    if ((typing || askWaiting) && (isSpace || e.key === 'Enter')) {
      e.preventDefault();
      e.stopPropagation();
      advanceAsk();
      return;
    }
    if (!cardsReady) return;

    var grid = document.getElementById('dcInvGrid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.clue-item'));
    var i = cards.indexOf(document.activeElement);
    if (i < 0) return;

    var to = -1, col = i % 3;
    if (e.key === 'ArrowRight') to = col < 2 ? i + 1 : i;
    else if (e.key === 'ArrowLeft') to = col > 0 ? i - 1 : i;
    else if (e.key === 'ArrowDown') to = i + 3 < cards.length ? i + 3 : i;
    else if (e.key === 'ArrowUp') to = i - 3 >= 0 ? i - 3 : i;
    else return;

    e.preventDefault();
    e.stopPropagation();
    if (to >= 0 && cards[to]) cards[to].focus();
  }
  document.addEventListener('keydown', onInvKey, true);

  /*  点击问句框/空白处 */
  document.addEventListener('click', function (e) {
    if (!invOpen || (!typing && !askWaiting)) return;
    if (Date.now() - openedAt < 150) return;
    if (e.target && e.target.closest && e.target.closest('.clue-item')) return;
    advanceAsk();
  }, true);

  /*  右键证物卡：居中弹出物品栏介绍（纯文字），点击任意处/Esc 关闭 */
  var descMask = null;
  function itemById(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }
  function closeDesc() {
    if (descMask) { descMask.parentNode.removeChild(descMask); descMask = null; }
  }
  document.addEventListener('contextmenu', function (e) {
    var card = e.target && e.target.closest && e.target.closest('.clue-item');
    if (!card) return;
    e.preventDefault();
    var item = itemById(card.getAttribute('data-item'));
    if (!item) return;
    closeDesc();
    descMask = document.createElement('div');
    descMask.className = 'clue-desc-mask';
    descMask.innerHTML =
      '<div class="clue-desc-box">' +
        '<div class="clue-desc-name">' + item.name + '</div>' +
        '<div class="clue-desc-text">' + (item.desc || '（暂无详细描述）') + '</div>' +
      '</div>';
    descMask.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    descMask.addEventListener('click', closeDesc);
    document.body.appendChild(descMask);
  }, false);
  document.addEventListener('keydown', function (e) {
    if (descMask && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault(); e.stopPropagation();
      closeDesc();
    }
  }, true);

  /*  依次播放一串「系统提示」卡
      opts.keepBlack：整串卡（含最后一张）都留在黑场里不揭幕，由调用方自己揭幕。
      默认行为：前几张留在黑场，只在最后一张揭幕 —— 两张卡之间若是揭幕露出
      视觉小说的背景，就会出现一闪（如「推理阶段开始」→「您需要根据…」之间）。 */
  function playNotices(list, onDone, opts) {
    opts = opts || {};
    var scene = root.VN && root.VN.scene;
    var el = chapterEl();
    var i = 0;

    if (el) el.classList.add('is-notice');     /* 系统提示专用排版 */

    function step() {
      if (i >= list.length) {
        if (el) el.classList.remove('is-notice', 'is-long');
        if (typeof onDone === 'function') onDone();
        return;
      }
      var n = list[i++];
      var isLast = (i >= list.length);
      var title = n.kicker ? (n.kicker + ' · ' + n.text) : n.text;
      if (el) el.classList.toggle('is-long', String(n.text || '').length > LONG_AT);
      log('呈现系统提示 ' + i + '/' + list.length + '：' + n.text);

      if (scene && typeof scene.playChapterIntro === 'function') {
        /* 与 chapter 完全相同的转场；连续多张时前几张留在黑场不揭幕 */
        scene.playChapterIntro(title, step, undefined, {
          keepBlack: isLast ? (opts.keepBlack === true) : true
        });
      } else {
        step();                                /* 场景层不可用：跳过，保证流程不卡死 */
      }
    }
    step();
  }

  /*  系统提示播完 → 开场台词  */
  function startDeduction() {
    var text = root.VN && root.VN.text;
    var dlg = root.VN && root.VN.dialog;

    if (dlg && dlg.show) dlg.show();             
    if (text && typeof text.queue === 'function') {
      text.queue(DEDUCTION_LINES);       
      log('开始播放开场台词（共 ' + DEDUCTION_LINES.length + ' 句）。');
    } else {
      log('未找到 VN.text，台词无法播放。');
    }
  }

  /*  开场  */
  function boot() {
    var text = root.VN && root.VN.text;

    /* 整页背景音乐：福尔摩斯（循环）—— 一进推理页就起，贯穿开场提示、开场台词
       与之后所有线索板选择；只有进入「结局分支」时才让位，回到选择时会自动接上。 */
    boardBgm(true);
    log('推理页背景音乐：' + BOARD_BGM + '（循环）。');

    /* 问句各段原文写在 HTML 的 [data-ask] 段落里，这里读一次备用 */
    ASK_LINES = askEls().map(function (el) { return String(el.textContent || '').trim(); });

    /* 底部「出示线索」按钮 */
    var submitBtn = document.getElementById('dcInvSubmit');
    if (submitBtn) submitBtn.addEventListener('click', submitClue);

    /* 提示期间不接受点击 / 空格推进 */
    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();

    /* 台词全部播完 → 按当前阶段分流：
       opening ：开场四句播完 → 打开物品栏（问句打字 → 第一次卡片选择）
       badend  ：坏结局五句播完 → 重新进行第一次卡片选择
       falseend：结局「荒谬的遗憾」六句播完 → 重新进行第三次卡片选择 */
    if (text && typeof text.on === 'function') {
      text.on('queueEnd', function () {
        if (phase === 'badend') {
          phase = 'retry';
          hideBadEndBg();                      /* 结局播完：收起案发现场背景 */
          log('坏结局台词播放完毕，重新进行第一次卡片选择。');
          openInventory();                       /* 默认两段问句 + 第一次选择 */
          return;
        }
        if (phase === 'falseend') {
          phase = 'retry3';
          hideBadEndBg();
          log('结局「' + FALSE_END_TITLE.text + '」台词播放完毕，重新进行第三次卡片选择。');
          openInventory({ lines: ROUND3_LINES, round: 3 });
          return;
        }
        if (phase !== 'opening') return;
        log('开场台词播放完毕，打开物品栏。');
        openInventory();
      });
    }

    playNotices(NOTICES, function () {
      if (text && text.setEnabled) text.setEnabled(true);
      startDeduction();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

  /*  对外接口*/
  root[NS].deduction = {
    NOTICES: NOTICES,
    LINES: DEDUCTION_LINES,
    ITEMS: ITEMS,
    OUTCOMES: OUTCOMES,
    PHONE_LINES: PHONE_LINES,
    BADEND_LINES: BADEND_LINES,
    playNotices: playNotices,
    start: startDeduction,
    /* 物品栏 */
    openInventory: openInventory,
    closeInventory: closeInventory,
    select: selectCard,
    submit: submitClue,
    pick: pickItem,
    skipTyping: skipTyping,
    advanceAsk: advanceAsk,
    getRound: function () { return round; },     /* 调试/测试用：当前是第几次卡片选择 */
    /* 分支 / 跳转 */
    gotoChapter2: gotoChapter2,
    gotoStory: gotoStory,
    RETURN_CG: RETURN_CG,                        /* 本页要衔接的 CG（由 body[data-return-cg] 指定） */
    returnToStory: returnToStory                 /* 推理收束 → 衔接 CG → 回视觉小说 */
  };
})();
