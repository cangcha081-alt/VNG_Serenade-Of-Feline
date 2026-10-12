/* ============================================================
   线索栏（deduction3）
   ------------------------------------------------------------
   借用 deduction 的「物品栏」UI，但只做这一件事：
     沙耶香逐句抛出问题 → 出示线索 → 判定 → 共四轮
   · 十张卡片不使用图片，纯文字竖长条（样式见 css/deduction3.css）
   · 打出的每一句都自动加「沙耶香：」前缀
   · 选错 → 对话框打出「选择错误，请重新选择。」→ 本轮问句直接浮现 → 重选
   想改文案或答案，只改下面的 CLUES / ROUNDS / WRONG_TEXT 三处即可。
   ============================================================ */
(function () {
  'use strict';

  var root = window;
  var NS = 'VN';
  root[NS] = root[NS] || {};

  function log(m) { if (root.console && console.info) console.info('[线索栏] ' + m); }
  function el(id) { return document.getElementById(id); }

  /* ---------- ① 十条线索（卡片文字，顺序＝显示顺序，不要改成其它条数） ---------- */
  var CLUES = [
    '后来他邀请我来到游港大学的理科教学楼天台上，望着良镇的夜景，他说，请和他交往吧，只要互相支持，无论什么样的困难都能跨越……',
    '后来他前往非洲支教，在那边村长的推荐下，他在腰腹部刺刻了一个蛇的图案。和我视频通话时，他甚至打趣这也被某些人视作受诅咒的刺青',
    '然而回国后，他却性情大变。不但对和我发生性生活变得毫无兴趣，而且甚至一个月断联而不知所踪',
    '我找到他，他却说他的反常都是因为目睹非洲村落小孩集体性的病逝而导致的精神压力……他辞退了东京的实习，选择和熟稔的同学一起在小镇的南方制药研究室工作',
    '我本以为能一直与一也相处是好事，但一也却好像在‘诅咒’的影响下变化更加大了。他比以前消瘦，因为睡眠不足而经常双眼布满血丝……他的性格也从开朗阳光变成了闷闷不乐，容易生气',
    '他拋弃了我！他和那家伙一起拋弃了我！完成研究的人的确是那家伙，但我也有付出贡献啊！但是……真是岂有此理……',
    '得意……忘形？',
    '那个研究成果，可是能解决我诅咒的刺青啊！',
    '我们一起生活，成为一家人吧。一也和我……以及我们的小孩。',
    '可是，你还替生病的我担心……。'
  ];

  /* ---------- ② 四轮问答 ----------
     ask   ：本轮在问句框里逐句打出的内容（会自动加「沙耶香：」前缀）
     right ：正确卡片在 CLUES 里的序号（从 0 开始）
     第 4 轮的「正确句子」以 CLUES[8]「我们一起生活，成为一家人吧…」为准
     （你给的原文里那一句其实是本轮的提问句，10 张卡里没有；要改答案改这一个数字即可）。 */
  var ROUNDS = [
    {
      ask: [
        '我想我知道这种病与阿九津异常表现之间的关联了。',
        '麻矢冲我比了一个wink——“请两位回忆一下，知美小姐刚才的叙述吧。”',
        '“其实阿久津得的不是心病，而是身体上的疾病。考虑到HLTV这种疾病的传染性，血液传播，性传播，母婴传播……最有可能的情况是：”'
      ],
      right: 1
    },
    {
      ask: [
        '很有可能阿久津一也是在刺青时感染了这种致命的传染病，在非洲的村落之中，那个诅咒让包括小孩在内的许多人过世，也可以推测出那个诅咒可能已经笼罩在所有人的上空。',
        '“作为药学才俊他选择了呆在良镇，恐怕是因为……”'
      ],
      right: 3
    },
    {
      ask: [
        '他想与南方制药的研究团伙合作，研发出可以治疗HLTV的药物。',
        '在回国的几年间，他有不少次严重的荨麻疹发作。HLTV-1有不少种药物，尽管阿久津只要选择他能够服用的药物服用就好，不过随时间经过，他可能也会开始对那些药物产生过敏反应。',
        '“但是那天晚上他突然情绪失控，甚至自残。让他绝望的是……”'
      ],
      right: 7
    },
    {
      ask: [
        '研究成果被搭档和社长所隐藏，这意味着他治愈自己、与您正常生活的希望被彻底粉碎了。',
        '知美小姐，那晚他之所以用最恶毒的话语将您推开，是因为您当时说了一句触动他底线、让他不得不狠心的话。'
      ],
      right: 8
    }
  ];

  var SPEAKER = '麻矢：';                       /* 每一句打字的前缀 */
  var WRONG_TEXT = '小黑，你确定吗？再用你聪明的脑袋想想。';      /* 选错时的提示 */

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


  /* ---------- 打字机（与 deduction 一致的手感） ---------- */
  var TYPE_SPEED = 55;
  var PUNCT_DELAY = {
    '。': 180, '！': 220, '？': 220, '…': 180, '～': 160,
    '，': 80, '、': 70, '；': 110, '：': 100, '—': 140,
    '.': 90, '!': 220, '?': 220, ',': 60
  };
  var reducedMotion =
    root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var round = 0;             /* 当前轮（0 基） */
  var askEls = [];           /* 本轮问句对应的 <p> */
  var askIdx = 0;            /* 正在打第几段 */
  var askWaiting = false;    /* 一段打完、短暂停顿后自动接下一段 */
  var askTimer = null;       /* 段间自动推进的定时器 */
  var ASK_GAP = 450;         /* 段间停顿（毫秒）；按空格/点击可立刻跳过 */
  var typing = false;
  var typeTimer = null;
  var typeDone = null;
  var cardsReady = false;
  var selected = null;
  var busy = false;

  function clearAskTimer() { if (askTimer) { root.clearTimeout(askTimer); askTimer = null; } }

  function askBox() { return el('dcInvAsk'); }
  function grid() { return el('dcInvGrid'); }
  function hint(msg) { var h = el('dcInvHint'); if (h) h.textContent = msg; }
  function cardEls() {
    var g = grid();
    return g ? Array.prototype.slice.call(g.querySelectorAll('.clue-item')) : [];
  }

  /* ---------- 卡片 ---------- */
  function buildCards() {
    var g = grid();
    if (!g || g.childElementCount) return;
    CLUES.forEach(function (txt, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clue-item';
      btn.setAttribute('data-item', 'c' + (i + 1));
      btn.setAttribute('data-index', String(i));
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', '线索 ' + (i + 1));

      var top = document.createElement('span');
      top.className = 'clue-top';
      var name = document.createElement('span');
      name.className = 'clue-name';
      name.textContent = txt;
      top.appendChild(name);
      btn.appendChild(top);

      btn.addEventListener('click', function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        onCard(i, btn);
      });
      g.appendChild(btn);
    });
    log('线索栏已生成 ' + CLUES.length + ' 张卡片。');
  }

  function setCardState(lock) {
    var inv = el('dcInv');
    if (inv) {
      inv.classList.toggle('is-locked', !!lock);
      inv.classList.toggle('is-ready', !lock);
    }
    cardsReady = !lock;
  }

  /* ---------- 打字 ---------- */
  function clearType() { if (typeTimer) { root.clearTimeout(typeTimer); typeTimer = null; } }

  function typeInto(p, text, onDone) {
    var full = String(text === undefined || text === null ? '' : text);
    var shown = 0;
    clearType();
    typing = true;
    if (p) { p.textContent = ''; p.classList.add('is-typing'); }

    function finish() {
      typing = false;
      clearType();
      if (p) { p.textContent = full; p.classList.remove('is-typing'); }
      if (typeof onDone === 'function') onDone();
    }
    typeDone = finish;

    if (!full.length || reducedMotion || TYPE_SPEED <= 0) { finish(); return; }

    function tick() {
      if (!typing) return;
      shown++;
      if (p) p.textContent = full.slice(0, shown);
      if (shown >= full.length) { finish(); return; }
      var ch = full.charAt(shown - 1);
      var wait = TYPE_SPEED + (PUNCT_DELAY[ch] || 0);
      typeTimer = root.setTimeout(tick, wait);
    }
    tick();
  }

  function skipTyping() {
    if (typing && typeof typeDone === 'function') { typeDone(); return true; }
    return false;
  }

  /* ---------- 一轮 ---------- */
  function startRound(n) {
    var r = ROUNDS[n];
    if (!r) { finishAll(); return; }
    round = n;
    selected = null;
    askIdx = 0;
    askWaiting = false;
    clearAskTimer();
    setCardState(true);
    cardEls().forEach(function (c) {
      c.classList.remove('is-selected', 'is-picked');
      c.setAttribute('aria-pressed', 'false');
    });
    var sub = el('dcInvSubmit');
    if (sub) sub.disabled = true;

    var box = askBox();
    if (box) {
      askEls.forEach(function (p) { if (p && p.parentNode) p.parentNode.removeChild(p); });
      var hintEl = el('dcInvHint');
      askEls = r.ask.map(function () {
        var p = document.createElement('p');
        p.className = 'dialogue-box__text';
        box.insertBefore(p, hintEl || null);
        return p;
      });
    }
    log('第 ' + (n + 1) + ' 轮开始，问句 ' + r.ask.length + ' 句。');
    typeAsk();
  }

  function typeAsk() {
    var r = ROUNDS[round];
    if (!r) return;
    if (askIdx >= askEls.length) { readyForPick(); return; }
    hint('按空格快进');
    typeInto(askEls[askIdx], SPEAKER + r.ask[askIdx], function () {
      askWaiting = true;
      clearAskTimer();
      askTimer = root.setTimeout(function () {     /* 一段打完 → 自动接下一段 */
        askTimer = null;
        if (!askWaiting) return;
        askWaiting = false;
        askIdx++;
        typeAsk();
      }, ASK_GAP);
    });
  }

  function readyForPick() {
    clearAskTimer();
    askWaiting = false;
    selected = null;
    setCardState(false);
    hint('选出对应的线索，再点「出示线索」出示');
    var first = cardEls()[0];
    if (first && first.focus) first.focus();
  }

  /* 空格 / 点击：正在打字→补全；段间停顿→立刻接下一段 */
  function advance() {
    if (typing) { skipTyping(); return true; }
    if (askWaiting) {
      clearAskTimer();
      askWaiting = false;
      askIdx++;
      typeAsk();
      return true;
    }
    return false;
  }

  /* ---------- 判定 ---------- */
  /* 点卡片＝**只选中**（不判定）；出示一律由底部「出示线索」按钮触发。
     曾经这里是「选中后立刻 judge()」，玩家点一下卡片就直接出示了，
     等于绕过了按钮 —— 现已改成「先选卡 → 再点出示线索」。 */
  function onCard(i, btn) {
    if (!cardsReady || busy) return;
    selected = i;
    cardEls().forEach(function (c) {
      var on = (c === btn);
      c.classList.toggle('is-selected', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var sub = el('dcInvSubmit');
    if (sub) sub.disabled = false;
    hint('已选中第 ' + (i + 1) + ' 张线索，点「出示线索」出示');
    log('选中第 ' + (i + 1) + ' 张线索（等待点「出示线索」）。');
  }

  function judge() {
    if (selected === null || !cardsReady || busy) return;
    var r = ROUNDS[round];
    if (!r) return;
    var card = cardEls()[selected];
    var ok = (selected === r.right);
    busy = true;
    setCardState(true);
    if (card) card.classList.add('is-picked');
    log('第 ' + (round + 1) + ' 轮：选中第 ' + (selected + 1) + ' 张 → ' + (ok ? '正确 ✓' : '错误 ✗'));

    root.setTimeout(function () {
      if (card) card.classList.remove('is-picked');
      busy = false;
      if (ok) {
        /* 最后一轮正确出示（「……以及我们的小孩」＝真相揭穿的瞬间）
           → 「律师徽章，再次闪耀！」（与知美的对话中找出真相） */
        if (round === ROUNDS.length - 1 &&
            root.VN && root.VN.achieve && typeof root.VN.achieve.unlock === 'function') {
          try { root.VN.achieve.unlock('cafe'); } catch (eCafe) {}
        }
        root.setTimeout(function () { startRound(round + 1); }, 480);
      } else {
        showWrong(r);
      }
    }, 620);
  }

  /* 选错：对话框打出提示 → 本轮问句直接浮现 → 重新选择（轮次不变） */
  function showWrong(r) {
    setCardState(true);
    hint('请重新选择');
    askIdx = 0;
    askWaiting = false;
    clearAskTimer();
    if (!askEls.length) { startRound(round); return; }
    askEls.forEach(function (p, i) { if (p) { p.textContent = ''; p.classList.remove('is-typing'); } });
    typeInto(askEls[0], SPEAKER + WRONG_TEXT, function () {
      root.setTimeout(function () {
        askEls.forEach(function (p, i) {
          if (p) p.textContent = (r.ask[i] === undefined) ? '' : (SPEAKER + r.ask[i]);
        });
        log('已重新浮现第 ' + (round + 1) + ' 轮问句，请重新选择。');
        readyForPick();
      }, 900);
    });
  }

  function finishAll() {
    boardBgm(false);                       /* 离开前停线索板曲 */
    setCardState(true);
    hint('线索栏 · 四轮推理完成');
    log('四轮全部完成 ✓ → 回到视觉小说');
    /* 回到剧情：沿用剧情进入本页时写下的返回点（vn_minigame_return = 入口句的下一句）。
       这里必须用「?save=」把键名带回去，让存档系统的 bootstrapResume 续播；
       直接跳 plot.html 会从头开始，写死句号又会跳段。
       顺便：自动存档此刻仍停在「入口句」上（读它回来会重进本页，这是预期行为），
       回剧情后第一句播完就会把自动存档更新到入口句之后。 */
    var KEY = 'vn_minigame_return';
    var has = false;
    try { has = !!root.localStorage.getItem(KEY); } catch (e) { has = false; }
    var target = has ? ('plot.html?save=' + encodeURIComponent(KEY)) : 'plot.html';
    root.setTimeout(function () { root.location.href = target; }, 1100);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    boardBgm(true);                        /* 整页背景音乐：福尔摩斯（循环） */
    var inv = el('dcInv');
    if (inv) {
      inv.hidden = false;
      inv.setAttribute('aria-hidden', 'false');
      inv.classList.add('is-locked');
    }
    buildCards();

    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        if (advance()) { if (e.preventDefault) e.preventDefault(); }
      }
    }, false);
    document.addEventListener('click', function () { advance(); }, false);

    var sub = el('dcInvSubmit');
    if (sub) {
      sub.addEventListener('click', function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (typing) { skipTyping(); return; }
        if (askWaiting) { advance(); return; }
        if (selected !== null && cardsReady) judge();
      });
    }

    log('线索栏启动（共 ' + ROUNDS.length + ' 轮选择）。');
    startRound(0);
  }

  root[NS].clueBoard = {
    clues: CLUES,
    rounds: ROUNDS,
    getRound: function () { return round; },
    isReady: function () { return cardsReady; },
    /* 调试/测试用：pick 只负责选卡，出示要另外调 submit() */
    pick: function (i) { var c = cardEls()[i]; if (c) c.click(); },
    submit: function () { judge(); },
    reveal: function () { readyForPick(); },
    skip: function () { return skipTyping(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, false);
  else boot();
})();
