(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  /* 开场系统提示 */
  var NOTICES = [
    { kicker: '系统提示', text: '推理阶段开始' },
    { kicker: '系统提示',
      text: '您需要根据抛出的疑问，在“物品栏”中出示对应的证物或做出选择。' +
            '错误的选择将导向Bad Ending。' }
  ];

  /* 开场不再有走 VN 对话框的台词（原来在物品栏之前的那两句已删除）。
     案发场景与小黑对千崎的质问改在这里 —— 由「物品栏上方的问句框」逐句打出：
     问句框的内容会一直留在画面上（VN 对话框在物品栏打开时保持收起），
     玩家边翻看/选择线索，边能看见这几句。 */
  var OPENING_ASK_LINES = [
    '走廊尽头的研究室里，倒着小泉昭良的尸体。',
    '“千崎，你也是因为那份报告，一直对他的死怀有强烈的负罪感吧？”',
    '“但你作为一个老刑警，再好好想一想。那天白天你们在审讯室里，他表现出的态度，真的是一个准备寻死的人吗？”'
  ];

  function log(msg) {
    if (root.console && root.console.info) root.console.info('[VN · deduction2] ' + msg);
  }

  function chapterEl() { return document.getElementById('vnChapterTitle'); }

  /* 超过这个字数的提示按「整句话」排版（收字号、放宽行距） */
  var LONG_AT = 14;

  /*  物品栏：8 件证物 */
  var ITEMS = [
    { id: 'toyota',    name: '【丰田汽车】',             desc: '一辆久经使用的丰田。根据车内物品推断，是刑警盯梢时使用的。' },
    { id: 'notebook',  name: '【笔记本】',               desc: '记录了千崎与久住审问小泉昭良的对话。虽然针对小泉昭良有诸多嫌疑，但似乎千崎不认为他是最终凶手。' },
    { id: 'nokia',     name: '【诺基亚（千崎的备忘录）】', desc: '千崎的手机，里面记录了审讯后两人跟踪小泉昭良发生的怪事。从出现于椿桥到身死实验室，久住都坚称实验楼为密室。' },
    { id: 'gate',      name: '【实验室大门】',           desc: '实验大楼唯一的出入口。' },
    { id: 'doorlock',  name: '【实验室门禁】',           desc: '记载了实验室的打卡记录。' },
    { id: 'report',    name: '【案件报告】',             desc: '记载了小泉昭良案的具体线索。千崎在这一案后因为癌症也告别了刑警生涯。' },
    { id: 'pc',        name: '【桌上的电脑】',           desc: '办公室内的电脑。' },
    { id: 'stafflist', name: '【研究室人员名单】',       desc: '南方制药是南乡诚太郎的公司，小泉夫妇在南乡旗下的实验室工作。这种巧合真是十分有趣。' }
  ];

  /*  第一次卡片选择的分支 
     ①【笔记本】→ 打字六段（审讯记录 + 千崎动摇）→ 第二次卡片选择（组合出示）
     ②【案件报告】→ 打字两段 → 结局卡「BE1 沉重的枷锁」→ 五句结局台词 → 重来第一次选择
     ③ 其余卡片 → 「这是无效的证据，请再次选择。」→ 重新进行第一次选择 */

  /* 第一次卡片选择的问句（HTML [data-ask] 缺省时的等价副本，BE1 重试用） */
  var ROUND1_ASK = [
    '“证明给我看——小泉昭良那晚，并不是一个准备寻死的人。”',
    '请出示对应的证物。'
  ];

  /* 分页断开符：ask 列表中出现即开新页（先清空前面已打出的句子再继续） */
  var PAGE_BREAK = '\f';

  /* ① 笔记本分支：第 1 页 5 句（卡片隐藏）→ 翻页 → 第 2 页 1 句 + 卡片同时出现 */
  var NOTEBOOK_LINES = [
    '“回忆这份审讯记录吧。当久住激怒他时，他愤怒地拍桌子大喊『请快点找出杀害我妻子的真凶』。”',
    '“他不是在演戏，他是真的对凶手怀有刻骨的仇恨。一个满心想要复仇的男人，怎么可能在当晚就突然放弃一切，躲进研究室里自杀？”',
    '千崎缓缓点头：“没错……他的怒火直撼肺腑。他那晚去研究大楼，绝对不是为了自杀。”',
    '千崎隆太：“可那天晚上的事情根本说不通！久住一直盯着【实验室大门】，那是唯一的出入口！小泉怎么可能出现在案发地的椿桥，又怎么可能在我眼皮底下消失在旧住宅区？”',
    '“难道……真的是传说中的『二重身』？”',
    PAGE_BREAK,
    '“别开玩笑了，这世上哪有那种刚好帮你脱罪的超自然现象（虽然我会说话这件事本身挺超自然的）。好好想想那个旧住宅区到底藏着什么秘密。（请同时选择两个物品）”'
  ];
  /* 第二轮选择时上方常驻的句子（翻页后 / 错误重试 / BE2 重来都显示这一句） */
  var PAGE2_LINE = NOTEBOOK_LINES[NOTEBOOK_LINES.length - 1];

  /* ② BE1：出示【案件报告】 */
  var BE1_ASK_LINES = [
    '千崎的目光落在那份案件报告上，“警方最初就是这样断定的——畏罪自杀。”',
    '“所以……是我逼死了他。是我用审讯，把一个无辜的人逼上了绝路！”'
  ];
  var BE1_TITLE = { kicker: '结局', text: '沉重的枷锁' };
  var BE1_LINES = [
    { speaker: '', text: '千崎的脸色瞬间变得惨白，他痛苦地抱住头。', portrait: '' },
    { speaker: '', text: '“是啊……长官说得对，是我在讯问时逼得太紧。是我杀了他！”', portrait: '' },
    { speaker: '', text: '梦境开始崩塌。你顺从了警方最初的荒谬推论，千崎彻底接受了“自己逼死嫌疑人”的设定。', portrait: '' },
    { speaker: '', text: '他作为刑警的自尊被完全粉碎，对小泉的愧疚化作了无尽的黑泥，将他的魂魄彻底吞没。', portrait: '' },
    { speaker: '', text: '醒来后，你看着眼前散发着恶臭的暗褐色光球，他已经失去了理智，沦为只会重复着“是我杀了他”的怨灵，再也无法被死神超度。', portrait: '' }
  ];

  /* ③ 无效证据 */
  var INVALID_LINE = '这是无效的证据，请再次选择。';

  /*  第二次卡片选择的分支（组合出示） 
     情况1【诺基亚（千崎的备忘录）】+【研究室人员名单】→ 逐句打出全部真相 → 梦境收束
     情况2【丰田汽车】或【实验室门禁】（占其一即触发）→ 结局卡「视线的死角」→ 五句 → 重来第二次选择
     情况三 其余组合 → 无效证据 → 重新进行第二次选择 */
  var COMBO_OK_IDS = { nokia: 1, stafflist: 1 };
  var BE2_TRIGGER_IDS = { toyota: 1, doorlock: 1 };

  /* 情况1 组合正确：前 2 句在上方问句区打出（不走 VN 对话框），
     点击继续后其余句子走 VN 对话框逐句播放，播完直接进入梦境收束 */
  var COMBO_ASK_LINES = [
    '“你手机里写着，小泉在旧住宅区的一条小巷里消失了。而根据名单，南方制药的董事长是南乡纯太郎！”',
    '“那个旧住宅区，有一栋写着『南乡』门牌的废墟。南乡是个狂热的研究者，他把自家的防空洞改造成了地下研究室！而那条密道，直通这栋研究大楼的地下仓库！”'
  ];
  var COMBO_VN_LINES = [
    '千崎恍然大悟：“吃人的废墟……小泉是利用密道离开了研究大楼，去了椿桥，然后又从密道神不知鬼不觉地回到了这里！”',
    '千崎隆太：“就算是这样，依然说不通！那间研究室的门，必须刷卡才能进！”',
    '“小泉是晚间10点左右刷卡进去的，之后再也没有任何刷卡记录！就算他从密道回来，他也进不了这间研究室！除非……”',
    '小黑：“除非，记录上只有一次刷卡，是因为后来的门，是从『里面』打开的。”',
    '“看看这个门禁记录。晚上9点53分，小泉带着一个『帮手』刷卡进门。帮手留在里面，小泉从密道离开去寻找杀妻仇人。”',
    '“因为有你们在外面『监视』，小泉拥有了完美的不在场证明。”',
    '“两小时后，小泉无功而返，敲响了门。帮手从里面为他开门。小泉毫无防备地走了进去，准备感谢这个帮手……”',
    '“但是！”',
    '“刀子就是最好的证明！如果是小泉自杀，这把杀妻的刀为什么会刚好出现在这里？答案只有一个：那个帮他制造不在场证明的『帮手』，就是杀害他妻子的真凶！”',
    '“凶手割断了小泉的喉咙，把刀塞在他手里，最后从密道从容离开，完成了一场完美的密室嫁祸！”',
    '千崎死死盯着那道黑影，身体剧烈地颤抖着。“原来……是这样。小泉他，直到最后一刻，都在为了妻子而战……”'
  ];

  /* 情况2 BE2：出示【丰田汽车】或【实验室门禁】 */
  var BE2_TITLE = { kicker: '结局', text: '视线的死角' };
  var BE2_LINES = [
    { speaker: '', text: '“久住那小子肯定在车里打瞌睡了！所以小泉才能大摇大摆地走正门出去又回来！”', portrait: '' },
    { speaker: '', text: '你试图用最简单的失职来解释。', portrait: '' },
    { speaker: '', text: '千崎皱起眉头：“就算久住睡着了，门禁系统是不会骗人的。那天晚上，实验室的门禁只有一次开启记录！他怎么出去？又怎么回来？”', portrait: '' },
    { speaker: '', text: '逻辑链在此彻底断裂。你无法解释密室的形成，千崎陷入了死胡同，认为自己果然还是看到了幽灵。', portrait: '' },
    { speaker: '', text: '真相的偏差让他永远困在了“二重身”的怪圈中，执念再也无法解开。', portrait: '' }
  ];

  /* 梦境收束 */
  var DREAM_TEXT = '现实中，千崎隆太缓缓睁开了双眼。';

  /* 回到主线：寻找主线台词里千崎梦醒后的衔接句 */
  var RETURN_LINE_KEY = '……千崎的魂魄彷佛打招呼似地轻轻摇动，我试着露出微笑，不过猫在现实世界中的脸部肌肉似乎无法顺利做出微笑的表情。';
  var RETURN_CHAPTER = 'Chapter 2 二重身的研究室';

  /* ---------------- 推理页背景音乐 ----------------
     音乐/READ ME.docx：福尔摩斯（循环）→「线索板推理」用。
     音量/静音沿用游戏内设置（VN.bgm）；同一首正在播时引擎会跳过，不会重头来。
     结局分支改用 Life Sentence（坏结局曲）；回到线索板时自动换回福尔摩斯。 */
  var BOARD_BGM = '福尔摩斯';
  var BADEND_BGM = 'Life Sentence';
  function boardBgm(on) {
    var bgm = root.VN && root.VN.bgm;
    if (!bgm) return;
    if (on) {
      if (bgm.play) bgm.play(BOARD_BGM);
    } else if (bgm.stop && bgm.current && bgm.current() === BOARD_BGM) {
      bgm.stop();
    }
  }
  function badEndBgm(on) {
    var bgm = root.VN && root.VN.bgm;
    if (!bgm) return;
    if (on) {
      if (bgm.play) bgm.play(BADEND_BGM);
    } else if (bgm.stop && bgm.current && bgm.current() === BADEND_BGM) {
      bgm.stop();
    }
  }


  /* 跳到 plot 时用的返回键。
     ★ 必须与剧情页写下的键**完全一致**：plot.html 没有引入 userStore.js，
       main.js 的 beginExit() 永远写裸键 vn_minigame_return；
       这里若用 userStore.key('vn_minigame_return')（登录后＝u:<用户>:vn_minigame_return）
       就会与剧情页写的键错开。 */
  var RETURN_KEY = 'vn_minigame_return';

  /*  打字机  */
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

  var invOpen = false;
  var typing = false;
  var typeTimer = null;
  var typeDone = null;
  var cardsReady = false;
  var comboMode = false;    /* 本轮是否为「组合出示」（第二次选择） */
  var selected = null;      /* 单选模式：当前选中的线索 */
  var selectedList = [];    /* 组合模式：已选中的线索集合 */
  var picking = false;
  var openedAt = 0;
  var ASK_LINES = [];       /* 问句框的默认文字（取自 HTML 的 [data-ask]；现已无默认句，仅作 openInventory 的兜底） */
  var askLines = [];
  var domEls = [];           /* 与 askLines 对齐的 DOM 段落（分页断开符为 null） */
  var askIdx = 0;
  var askWaiting = false;
  var round = 1;
  var onTyped = null;
  var waitClick = false;     /* 打完问句后等玩家点击/空格再接管（而不是立即回调 onTyped） */
  var afterAsk = false;      /* 「等待点击继续」状态 */
  var afterAskCb = null;     /* 点击继续后要执行的回调 */
  var phase = 'opening';    /* opening / be1 / be2 / truth */
  var wrongCount = 0;       /* 本次推理累计选错次数（无效证据 / 坏结局） */

  /* 成就上报（侦探之上 / 助手之下）：推理成功收束的当下由 achieve.js 判定解锁 */
  function reportDeductionResult() {
    try {
      if (root.VN && root.VN.achieve && typeof root.VN.achieve.reportDeduction === 'function') {
        root.VN.achieve.reportDeduction('d2', wrongCount === 0, wrongCount);
      }
    } catch (e) { log('成就上报失败：' + e); }
  }

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

  function renderAskLines(lines) {
    var box = document.getElementById('dcInvAsk');
    if (!box) return;
    askEls().forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    domEls = [];
    var hint = document.getElementById('dcInvHint');
    (lines || []).forEach(function (t) {
      if (t === PAGE_BREAK) { domEls.push(null); return; }   /* 分页断开：无对应 DOM */
      var p = document.createElement('p');
      p.className = 'dialogue-box__text';
      p.setAttribute('data-ask', '');
      p.textContent = String(t === undefined || t === null ? '' : t);
      if (hint) box.insertBefore(p, hint); else box.appendChild(p);
      domEls.push(p);
    });
  }

  /* 分页断开：只隐藏 askIdx 之前「已打出」的句子，模拟翻页
     （不能遍历整个 domEls——后面的段落还没打，提前加 is-gone 会把第 2 页句子藏掉） */
  function clearAsked() {
    domEls.forEach(function (el, i) {
      if (el && i < askIdx) { el.textContent = ''; el.classList.add('is-gone'); }
    });
  }

  function resetAsk() {
    askEls().forEach(function (el) {
      el.textContent = '';
      el.classList.remove('is-typing', 'is-gone');
    });
    askIdx = 0;
    askWaiting = false;
    clearType();
    typing = false;
  }

  function typeAsk() {
    if (askLines[askIdx] === PAGE_BREAK) {
      clearAsked();                                 /* 翻页：隐藏上一页句子 */
      askIdx++;
      var g = document.getElementById('dcInvGrid');
      if (g) g.classList.remove('is-concealed');    /* 第 2 页：卡片与句子同时出现 */
    }
    var el = domEls[askIdx];
    if (!el) { finishAsk(); return; }
    el.classList.remove('is-gone');                 /* 保险：当前句必须可见 */
    setHint('按空格快进');
    typeLine(el, askLines[askIdx], function () {
      if (askIdx >= askLines.length - 1) { finishAsk(); return; }
      askWaiting = true;
      setHint('按空格继续');
    });
  }

  function finishAsk() {
    askWaiting = false;
    if (typeof onTyped === 'function') {
      var cb = onTyped;
      onTyped = null;
      if (waitClick) {              /* 打完不自动继续：等玩家点击/空格再接管 */
        afterAsk = true;
        afterAskCb = cb;
        setHint('按空格继续');
        return;
      }
      setHint('');
      cb();
      return;
    }
    setHint(comboMode ? '右键点击线索查看详情，左键点击两张线索同时选中，再按「出示线索」提交'
                      : '右键点击线索查看详情，左键点击线索选中，再按「出示线索」提交');
    setCardsLocked(false);
    var grid = document.getElementById('dcInvGrid');
    var first = grid ? grid.querySelector('.clue-item') : null;
    if (first && first.focus) first.focus();
    log('问句打完，进入第 ' + round + ' 次卡片选择（' + ITEMS.length + ' 条线索）。');
  }

  function advanceAsk() {
    if (typing) { skipTyping(); return true; }
    if (afterAsk) {                 /* 「点击继续」：交出控制权 */
      afterAsk = false;
      var cb = afterAskCb;
      afterAskCb = null;
      if (cb) cb();
      return true;
    }
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

  /*  生成一张线索卡（结构同 deduction.js） */
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

  /*  选中线索卡：单选模式唯一选中；第二次选择点击切换多选  */
  function selectCard(item, card) {
    if (!cardsReady || picking) return;
    var grid = document.getElementById('dcInvGrid');

    if (comboMode) {
      var on = selectedList.indexOf(item.id) < 0;
      if (on && selectedList.length >= 2) {          /* 上限：同时最多两张 */
        setHint('最多同时选中两张线索');
        log('组合选择：已选满两张，' + item.name + ' 被忽略。');
        return;
      }
      if (on) selectedList.push(item.id);
      else selectedList = selectedList.filter(function (id) { return id !== item.id; });
      if (grid) {
        Array.prototype.forEach.call(grid.querySelectorAll('.clue-item'), function (c) {
          var id = c.getAttribute('data-item');
          var isOn = selectedList.indexOf(id) >= 0;
          c.classList.toggle('is-selected', isOn);
          c.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        });
      }
      setHint(selectedList.length === 2
        ? '已选满两张，按「出示线索」提交'
        : '右键点击线索查看详情，左键点击两张线索同时选中，再按「出示线索」提交');
      log('组合选择：[' + selectedList.join(', ') + ']');
    } else {
      if (grid) {
        Array.prototype.forEach.call(grid.querySelectorAll('.clue-item'), function (c) {
          var on = (c === card);
          c.classList.toggle('is-selected', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      selected = item;
      log('选中线索：' + item.name);
    }
    updateSubmit();
  }

  function updateSubmit() {
    var btn = document.getElementById('dcInvSubmit');
    var ok = cardsReady && !picking &&
             (comboMode ? selectedList.length === 2 : !!selected);
    if (btn) btn.disabled = !ok;
  }

  function submitClue() {
    if (!cardsReady || picking) return;
    if (comboMode) {
      if (selectedList.length !== 2) return;
      var card = document.querySelector('.clue-item.is-selected');
      pickCombo(selectedList.slice(), card);
      return;
    }
    if (!selected) return;
    var card0 = document.querySelector('.clue-item.is-selected');
    pickItem(selected, card0);
  }

  function setCardsLocked(locked) {
    cardsReady = !locked;
    var grid = document.getElementById('dcInvGrid');
    var inv = invEl();
    if (inv) {
      inv.classList.toggle('is-locked', locked);
      inv.classList.toggle('is-ready', !locked);
    }
    if (grid) {
      grid.classList.toggle('is-ready', !locked);
      Array.prototype.forEach.call(grid.querySelectorAll('.clue-item'), function (c) {
        c.setAttribute('aria-disabled', locked ? 'true' : 'false');
        c.tabIndex = locked ? -1 : 0;
        if (locked) {
          c.classList.remove('is-selected');
          c.setAttribute('aria-pressed', 'false');
        }
      });
    }
    if (locked) { selected = null; selectedList = []; }
    updateSubmit();
  }

  /*  打开物品栏
      opts.lines   ：本次逐段打出的文字
      opts.round   ：第几次卡片选择（1/2/3）
      opts.onTyped ：全部打完后接管 */
  function openInventory(opts) {
    boardBgm(true);                        /* 回到线索板：换回福尔摩斯（结局曲让位） */
    opts = opts || {};
    var el = invEl();
    var grid = document.getElementById('dcInvGrid');
    if (!el || !grid) { log('未找到物品栏容器（#dcInv / #dcInvGrid）。'); return; }

    round = opts.round || 1;
    comboMode = (round === 2);
    onTyped = (typeof opts.onTyped === 'function') ? opts.onTyped : null;
    waitClick = opts.waitClick === true;
    afterAsk = false;
    afterAskCb = null;
    var lines = (opts.lines && opts.lines.length) ? opts.lines : ASK_LINES;

    if (!grid.childElementCount) {
      ITEMS.forEach(function (it) { grid.appendChild(buildCard(it)); });
    }
    /* 分页 ask（含 PAGE_BREAK）或显式 concealGrid：期间卡片隐藏 */
    grid.classList.toggle('is-concealed',
      lines.indexOf(PAGE_BREAK) >= 0 || opts.concealGrid === true);
    Array.prototype.forEach.call(grid.querySelectorAll('.clue-item'), function (c) {
      c.classList.remove('is-picked', 'is-selected');
      c.setAttribute('aria-pressed', 'false');
    });
    selected = null;
    selectedList = [];

    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    invOpen = true;
    openedAt = Date.now();
    setCardsLocked(true);

    var text = root.VN && root.VN.text;
    if (text && text.setEnabled) text.setEnabled(false);

    renderAskLines(lines);
    askLines = lines.slice();
    resetAsk();
    typeAsk();
    log('物品栏已打开（第 ' + round + ' 轮' + (comboMode ? ' · 组合出示' : '') + '），开始打出 ' + lines.length + ' 段文字。');
  }

  function closeInventory() {
    var el = invEl();
    clearType();
    typing = false;
    cardsReady = false;
    if (el) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); }
    invOpen = false;
  }

  /* 出示：卡片点亮动画 → 进入对应情节 */
  function pickItem(item, card) {
    if (picking || !cardsReady) return;
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

  function pickCombo(ids, card) {
    if (picking || !cardsReady) return;
    picking = true;
    updateSubmit();
    if (card) card.classList.add('is-picked');
    log('出示组合：[' + ids.join(', ') + ']');
    root.setTimeout(function () {
      picking = false;
      closeInventory();
      showComboOutcome(ids);
    }, 620);
  }

  /*  第一次选择 */
  function showOutcome(item) {
    if (item.id === 'notebook') {                      /* ① 正解 */
      log('分支①「' + item.name + '」→ 打出两页（5+1 句）→ 第二次卡片选择（组合出示）');
      openInventory({ lines: NOTEBOOK_LINES, round: 2 });
      return;
    }
    if (item.id === 'report') {                        /* ② BE1 */
      wrongCount++;                      /* 选错：坏结局「沉重的枷锁」 */
      log('分支②「' + item.name + '」→ 结局：' + BE1_TITLE.text);
      openInventory({
        lines: BE1_ASK_LINES,
        round: 1,
        onTyped: function () { playBadEnding(BE1_TITLE, BE1_LINES, 'be1'); }
      });
      return;
    }
    log('分支③「' + item.name + '」→ 无效证据，重新选择');   /* ③ 无效 */
    wrongCount++;                        /* 选错：无效证据 */
    openInventory({ lines: [INVALID_LINE], round: 1 });
  }

  /*  第二次选择（最后一轮）*/
  function showComboOutcome(ids) {
    var isCorrect = ids.length === 2 &&
      ids.indexOf('nokia') >= 0 && ids.indexOf('stafflist') >= 0;
    var triggerBE2 = ids.indexOf('toyota') >= 0 || ids.indexOf('doorlock') >= 0;

    if (isCorrect) {
      log('第二次选择 · 情况1 组合正确 [' + ids.join(', ') + '] → 上方打出 2 句 → 点击继续 → VN 对话框播放真相');
      openInventory({
        lines: COMBO_ASK_LINES,
        round: 2,
        waitClick: true,      // 打完等玩家点击再继续
        concealGrid: true,    // 期间隐藏卡片网格
        onTyped: function () { playTruth(); }
      });
      return;
    }
    if (triggerBE2) {
      wrongCount++;                      /* 选错：坏结局「视线的死角」 */
      log('第二次选择 · 情况2 含 [' + ids.join(', ') + '] → 结局：' + BE2_TITLE.text);
      playBadEnding(BE2_TITLE, BE2_LINES, 'be2');
      return;
    }
    log('第二次选择 · 情况三 [' + ids.join(', ') + '] → 无效证据，重新进行第二次选择');
    wrongCount++;                        /* 选错：无效证据 */
    openInventory({ lines: [PAGE2_LINE], round: 2 });   /* 返回后依旧是这一句话 */
  }

  /*  情况1 后半：11 句真相走 VN 对话框，一页一句（与 deduction1 的台词播放一致）
      背景同样使用案发现场 RPG2-2，播完（梦境收束前）收起 */
  function playTruth() {
    closeInventory();
    var text = root.VN && root.VN.text;
    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();
    showBadEndBg();

    var dlg = root.VN && root.VN.dialog;
    if (dlg && dlg.show) dlg.show();
    if (text && text.setEnabled) text.setEnabled(true);
    phase = 'truth';                            /* 播完由 queueEnd 进入梦境收束 */
    var lines = COMBO_VN_LINES.map(function (t) {
      return { speaker: '', text: t, portrait: '' };
    });
    if (text && text.queue) text.queue(lines);
    log('真相 ' + lines.length + ' 句开始播放（VN 对话框）。');
  }

  /*  坏结局对话背景：第二组案发现场（研究大楼 2-2），播完收起  */
  var BADEND_BG_SRC = '../images/maps/RPG2-2.jpg';
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

  /*  坏结局 */
  function playBadEnding(title, lines, key) {
    badEndBgm(true);                       /* 坏结局：Life Sentence */
    closeInventory();
    var text = root.VN && root.VN.text;
    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();
    showBadEndBg();

    playNotices([title], function () {
      var dlg = root.VN && root.VN.dialog;
      if (dlg && dlg.show) dlg.show();
      if (text && text.setEnabled) text.setEnabled(true);
      phase = key;
      if (text && text.queue) text.queue(lines);
      log('坏结局「' + title.text + '」' + lines.length + ' 句开始播放。');
    });
  }

  /* 情况1 收束 */
  function playDreamAwake() {
    badEndBgm(false);
    boardBgm(false);                       /* 收束离开本页：停掉线索板曲 */
    closeInventory();
    reportDeductionResult();   /* 推理完成：上报战绩（全对→侦探之上 / 累计选错>10→助手之下） */
    var text = root.VN && root.VN.text;
    var el = chapterEl();
    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();

    if (el) el.classList.add('is-dream');
    playNotices([{ kicker: '', text: DREAM_TEXT }], function () {
      if (el) el.classList.remove('is-dream');
      log('「' + DREAM_TEXT + '」播完，回到主线。');
      gotoStoryAtText(RETURN_LINE_KEY, RETURN_CHAPTER);
    });
  }

  /*  跳回 plot 的章节  */
  function gotoStoryAtText(substr, chapterName) {
    var lines = (root.VN && root.VN.storyLines) || [];
    var idx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].text || '').indexOf(substr) >= 0) { idx = i; break; }
    }
    if (idx < 0) {
      log('找不到衔接台词「' + substr + '」，退回主菜单。');
      root.location.href = 'hall.html';
      return;
    }
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

  /*  物品栏键盘*/
  function onInvKey(e) {
    if (!invOpen) return;
    var isSpace = (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');

    if ((typing || askWaiting || afterAsk) && (isSpace || e.key === 'Enter')) {
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

  /*  点击问句框/空白处*/
  document.addEventListener('click', function (e) {
    if (!invOpen || (!typing && !askWaiting && !afterAsk)) return;
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
      opts.keepBlack：整串卡（含最后一张）都留在黑场里不揭幕，
      由调用方在 onDone 里自己调 VN.scene.revealBlackout() 揭幕 ——
      供「开场两张提示卡 → 直接进物品栏」使用：否则两张卡之间会把
      视觉小说的背景露出来闪一下。 */
  function playNotices(list, onDone, opts) {
    opts = opts || {};
    var scene = root.VN && root.VN.scene;
    var el = chapterEl();
    var i = 0;

    if (el) el.classList.add('is-notice');

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
        /* 连续多张：前几张一律留在黑场（keepBlack），只在最后一张按调用方的要求揭幕 */
        scene.playChapterIntro(title, step, undefined, {
          keepBlack: isLast ? (opts.keepBlack === true) : true
        });
      } else {
        step();
      }
    }
    step();
  }

  /*  开场  */
  function boot() {
    boardBgm(true);                        /* 整页背景音乐：福尔摩斯（循环） */
    var text = root.VN && root.VN.text;

    ASK_LINES = askEls().map(function (el) { return String(el.textContent || '').trim(); });

    var submitBtn = document.getElementById('dcInvSubmit');
    if (submitBtn) submitBtn.addEventListener('click', submitClue);

    if (text && text.setEnabled) text.setEnabled(false);
    if (root.VN && root.VN.dialog && root.VN.dialog.hide) root.VN.dialog.hide();

    /* 台词全部播完 → 按当前阶段分流（开场已经不再走 VN 对话框，系统提示播完直接开物品栏）：
       be1    ：BE1 播完 → 重新进行第一次卡片选择
       be2    ：BE2 播完 → 重新进行第二次卡片选择（上方仍是「别开玩笑了……」）
       truth  ：真相台词播完 → 梦境收束 */
    if (text && typeof text.on === 'function') {
      text.on('queueEnd', function () {
        if (phase === 'be1') {
          phase = 'opening';
          hideBadEndBg();                      /* 结局播完：收起案发现场背景 */
          log('BE1 台词播放完毕，重新进行第一次卡片选择。');
          openInventory({ lines: ROUND1_ASK, round: 1 });
          return;
        }
        if (phase === 'be2') {
          phase = 'opening';
          hideBadEndBg();
          log('BE2 台词播放完毕，重新进行第二次卡片选择。');
          openInventory({ lines: [PAGE2_LINE], round: 2 });
          return;
        }
        if (phase === 'truth') {
          phase = 'opening';
          hideBadEndBg();                      /* 真相播完：收起案发现场背景再进入梦境收束 */
          log('真相台词播放完毕，进入梦境收束。');
          playDreamAwake();
          return;
        }
      });
    }

    playNotices(NOTICES, function () {
      /* 系统提示播完 → 直接打开物品栏，问句框打出 OPENING_ASK_LINES 三句
         （VN 对话框全程保持收起，开场不再有对话框台词）
         整串提示卡保持黑场不揭幕，这里先把黑场淡掉再开物品栏：
         物品栏自带暗色背板，玩家不会看到视觉小说的背景。 */
      if (text && text.setEnabled) text.setEnabled(true);
      if (root.VN && root.VN.scene && root.VN.scene.revealBlackout) root.VN.scene.revealBlackout();
      log('系统提示播放完毕，直接打开物品栏（问句框打出 ' + OPENING_ASK_LINES.length + ' 句）。');
      openInventory({ lines: OPENING_ASK_LINES, round: 1 });
    }, { keepBlack: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

  /*  对外接口：便于后续步骤复用/调试  */
  root[NS].deduction2 = {
    NOTICES: NOTICES,
    OPENING_ASK_LINES: OPENING_ASK_LINES,
    ITEMS: ITEMS,
    NOTEBOOK_LINES: NOTEBOOK_LINES,
    COMBO_ASK_LINES: COMBO_ASK_LINES,
    COMBO_VN_LINES: COMBO_VN_LINES,
    BE1_LINES: BE1_LINES,
    BE2_LINES: BE2_LINES,
    playNotices: playNotices,
    openInventory: openInventory,
    closeInventory: closeInventory,
    select: selectCard,
    submit: submitClue,
    skipTyping: skipTyping,
    advanceAsk: advanceAsk,
    getRound: function () { return round; },
    getSelected: function () { return comboMode ? selectedList.slice() : (selected && selected.id); },
    gotoStoryAtText: gotoStoryAtText
  };
})();
