(function () {
  "use strict";

  var GROUP = window.RPG_GROUP || 1;
  var CHAR_DIR = "../images/characters/";
  // 组色调标记：g1=夜曲金（客厅/卧室），g2=冷灰蓝（院子/办公室）
  document.body.classList.add(GROUP === 1 ? "rpg-g1" : "rpg-g2");

  /* ---- 地图配置 ---- */
  var MAPS = GROUP === 1 ? {
    "RPG1-1": {
      name: "客厅",
      mapSrc: "../images/maps/RPG1-1.jpg",
      maskSrc: "../images/masks/RPG1-1.png",
      charSize: 120,
      spawn: { x: 1120, y: 400 },
      teleports: [
        { x0: 1190, y0: 375, x1: 1305, y1: 505, to: "RPG1-2", spawn: { x: 410, y: 615 }, label: "卧室" }
      ],
      /* 线索热点：人物脚部中心进入半径即触发（同 id 视为同一线索）
         text = 按 F 打开的对话框内容（\n 换行）；无 text 的热点走旧的自动提示 */
      hotspots: [
        { id: "window",  label: "窗户",   x: 471,  y: 80,  r: 150,
          text: "从第一次进入南乡家我就发现了\n他们家院中种植了远超平时人家的樱树\n现在正值樱花开放的时节\n哪怕是我也不得不承认这算是picturesque\n从修葺的仔细程度也能看出主人对樱树的用心与喜爱" },
        { id: "window",  label: "窗户",   x: 150,  y: 300, r: 110,
          text: "从第一次进入南乡家我就发现了\n他们家院中种植了远超平时人家的樱树\n现在正值樱花开放的时节\n哪怕是我也不得不承认这算是picturesque\n从修葺的仔细程度也能看出主人对樱树的用心与喜爱" },
        { id: "tv",      label: "电视",   x: 261,  y: 571, r: 140,
          text: "电视没有在播放\n是第一代的SONY BRAVIA\n……奇怪 我怎么知道这个" },
        { id: "phone",   label: "电话机", x: 430,  y: 625, r: 110,
          text: [
            "翻看历史通话应该会很有作用。\n两个月前的今天……200X年4月5日……有了，显示共接入四次电话。\n我尝试按下重播按钮，太好了，至少梦境中这个电话是有录音功能的。",
            "10：12 AM\n……\n……\n您好，这里是南乡家。\n菊子，是我。今天就不用给我准备晚饭了。\n又在公司加班啊？多多保重身体啊，天天不回来吃饭也不是个事。\n嗯。\n……\n……",
            "17：08 PM\n……\n……\n您好，这里是南乡家。\n菊子，是你吗？\n哎呀，老公？怎么了吗？\n呃……那个……\n今天是不是能够早点回家？需要帮助你准备晚餐吗？\n不，不用了。比起这个，你现在在家吗？吃过晚餐了吗？\n我当然在家啊，现在正准备做晚餐呢。\n这样就好，你待在家里就行。\n……\n……",
            "17：56 PM\n……\n……\n（有一阵轻声的啜泣）\n您好，这里是……\n妈！\n纯也？怎么啦，电话中这么大声？\n（沉默）\n发生了很严重的事，希望妈能冷静听我说。\n快别吓唬我了，到底发生什么事？\n妈，刚才公司联络我，说是老爸四十分钟前在家附近的桥上被卡车撞到……人被送去医院了。\n您好，是家属吗？救护车赶到车祸现场时，您先生已经陷入呼吸和心跳停止。医护人员一边替他施以心肺复苏，同时紧急送往医院。到达医院后，由我们接手继续急救。我们采取了心脏按摩、打点滴，给予强心剂，插管接上人工呼吸器等措施，但非常遗憾地，您先生并未恢复生命迹象。到院后四十五分钟，我们判断更多抢救只会造成身体上的损害……\n……\n……",
            "18：02 PM\n……\n……\n您好，我是良镇警察署。请问是南乡纯太郎的夫人吗？\n嗯。\n请节哀顺变。请教一下您先生最近看起来有什么烦恼吗？\n什么？\n他是否有工作不顺利，或者健康上的问题？\n啊……\n我明白您的心情，不过我们需要厘清车祸的原因。根据卡车司机与目击证人的的叙述，南乡先生是在红灯的时候突然冲出来的，还说那大概是自杀吧。\n怎么会……\n这里还有一封类似遗书的笔记，之后给您送过去吧。"
          ] },
        { id: "chair",   label: "商务座", x: 796,  y: 183, r: 120,
          text: "制作考究的商务皮椅。\n可以想象南乡纯太郎社长经常在这里会客。\n座位上放着一个公文包，应该是南乡常带在身上的。" },
        { id: "chair",   label: "商务座", x: 1054, y: 194, r: 120,
          text: "制作考究的商务皮椅。\n可以想象南乡纯太郎社长经常在这里会客。\n座位上放着一个公文包，应该是南乡常带在身上的。" },
        { id: "table",   label: "餐桌",   x: 949,  y: 550, r: 200,
          text: "四人座的餐桌。\n桌面上方有一张照片。\n是年轻时的南乡夫妇。\n南乡纯太郎看起来比较严肃拘谨，南乡菊子年轻时则更加圆润美丽。\n他们看起来在一所大学的校园中，背景樱花盛开。" },
        { id: "painting",label: "壁画",   x: 1335, y: 500, rx: 120, ry: 160,
          text: "依然是樱花树的风景画。\n他们家与樱花树有什么关联吗？" }
        ]
    },
    "RPG1-2": {
      name: "卧室",
      mapSrc: "../images/maps/RPG1-2.jpg",
      maskSrc: "../images/masks/RPG1-2.png",
      charSize: 120,
      spawn: { x: 410, y: 615 },
      teleports: [
        { x0: 200, y0: 470, x1: 335, y1: 645, to: "RPG1-1", spawn: { x: 1120, y: 400 }, label: "客厅" }
      ],
      hotspots: [
        { id: "diary",  label: "日记", x: 496,  y: 236, r: 130,
          text: "这应该是南乡菊子的日记。\n粗略翻了翻，事故那天之前除了日常的流水账外，菊子经常提及丈夫半年来经常加班，原本笨拙的脾气更加沉闷。\n4月4号当天，菊子郑重地问起纯太郎遭遇了什么，并希望两人能出去旅游散心，不过纯太郎提出以后再去。\n4月4日之后，菊子的日记字里行间都是自责的口吻，看的出来日记的内容对她造成了巨大的影响。" },
        { id: "letter", label: "遗书", x: 1030, y: 563, r: 150,
          text: "菊子\n四十年来，　　　容忍　　任性\n对于　　　　　实在　　　　　　心怀憎恨，\n能\n纯" }
      ]
    }
  } : {
    "RPG2-1": {
      name: "院子",
      mapSrc: "../images/maps/RPG2-1.png",
      maskSrc: "../images/masks/RPG2-1.png",
      charSize: 240,
      spawn: { x: 1424, y: 1030 },
      teleports: [
        { x0: 1300, y0: 780, x1: 1550, y1: 945, to: "RPG2-2", spawn: { x: 330, y: 610 }, label: "办公室",
          requireClue: "gate" }
      ],
      /* 线索热点：丰田汽车 → 大门（大门未读丰田线索时也能按 F，但只弹锁定提示，
         不计线索/不入物品栏；大门线索只出现一次，读完即解锁上面的传送功能，
         之后大门处只保留传送） */
      hotspots: [
        { id: "toyota", label: "丰田汽车", x: 2168, y: 1375, r: 340,
          text: "一台白色的丰田成驰。看得出来有很严重的使用痕迹。车胎上全是新溅上的泥土。" },
        { id: "gate",   label: "大门",     x: 1424, y: 680,  r: 280,
          requires: "toyota", once: true,
          lockedText: "实验室外还有未收集的线索。",
          text: "通过这扇门应该可以进入实验大楼。实验室的窗户都是推拉窗，这扇大门应该是唯一的出入口。根据千崎的回忆，小泉死的那天晚上只有他一个人进入了这扇大门。去案发现场看看吧。" }
      ]
    },
    "RPG2-2": {
      name: "办公室",
      mapSrc: "../images/maps/RPG2-2.jpg",
      maskSrc: "../images/masks/RPG2-2.png",
      charSize: 120,
      spawn: { x: 330, y: 610 },
      teleports: [
        { x0: 110, y0: 430, x1: 245, y1: 595, to: "RPG2-1", spawn: { x: 1424, y: 1030 }, label: "院子" }
      ],
      /* 线索热点：四个电脑工位用矩形框（首次进入任意工位按 F 先触发"电脑工位"线索，
         之后才能查看各工位的 笔记本/无/案件报告/诺基亚）；左右墙=门禁/名单 */
      hotspots: [
        { id: "notebook", label: "笔记本", firstId: "pc", firstLabel: "电脑工位",
          firstText: "很典型的办公室，很典型的电脑。这种机器是近不久在人类社会里风靡的工具。我看到电脑上标着松下CF-S51的标志。但没有什么值得注意的信息。",
          text: ["里面密密麻麻地记满了字。最后一页写着“小泉沙耶香案”。记载了千崎刑警、久住刑警与小泉昭良的对话——\n泉：我都说过几百次了！我什么都不知道！\n久：你怎么会什么都不知道？任何事都好，请回想起来吧。被害人可是你老婆啊。事件发生的当晚，你人在哪里？\n泉：同样的问题，你到底要问多少次？我已经说过很多次，我当时待在家里。\n泉：我是自己一个人待在家里，怎么会有证人……\n泉：为什么你们都一口咬定沙耶香是我杀的！我不是犯人！请你们快点找出杀害我妻子的真凶！\n泉：你们这些警察太无能了……\n千：行吧。我注意到那天深夜打电话给你太太的手机时，她并没接电话。一般来说，遇到这种情况，难道不会开始担心吗？\n泉：所以说，我太太在工作啊。\n千：以为她还在工作，对吧？我刚才已经听到你这么说了。但是你不会感到不安吗？搞不好你太太是去别的男人家里也说不一定。\n泉：（愤怒）沙耶香才不会做那种事！",
          "千：小泉先生，我听说你和太太最近常常争吵，好像快要离婚了，那是真的吗？\n泉：是谁乱说话？简直一派胡言！\n千：说起来，小泉先生，你太太有投人身保险吧。\n泉：……那又怎么样？\n千：不不，这只是普通的闲话家常。顺带一提，听说你有负债，是真的吗？\n泉：（站起）你是说我为了钱而杀了沙耶香吗！\n千：那我换个问题。小泉先生，你对于你太太为何被杀有什么想法吗？\n泉：她很开朗，我，我对这点毫无头绪……\n千：泉先生，我记得你和你太太是从药学系的研究所毕业的吧。不过你们在南方制药公司，你从事业务方面的工作，而你太太则是董事长的秘书。这又是为什么呢？\n泉：（垂头）……药品业务需要药学知识，董事长秘书也一样：既然要辅佐制药公司的董事长，自然要有药学知识比较好。我们对研究有兴趣，但终究是上班族，只能做被交办的工作。\n千：有意思。",
          "千：我说小泉先生，你其实对凶手的身分有点头绪吧？我说得没错吧？为什么你要默不吭声呢，难道你不想为老婆报仇吗？\n泉：……凶手的话……我才不知道是谁。\n千：那就是说你对凶手以外有所知情。那是什么？你到底知道些什么？\n千：妻子被人从后面捅了一刀，扔下锈迹斑斑的桥，这么屈辱的死法，你其实很不甘心吧？\n泉：（挣扎）沙耶香她……\n泉：（沉默）我……一无所知。我不知道沙耶香为什么会遭到这种惨事。\n千：喂，你在说什么傻话？你不想让杀死自己老婆的凶手为罪行付出代价吗？\n泉：……我当然想，但是我真的什么都不知道。\n千：……行吧，我知道了。\n千：你可以走了，但请尽量不要离开良镇。"],
          x0: 375, y0: 280, x1: 555, y1: 505 },
        {id: "pc", label: "电脑工位" ,firstId: "pc", firstLabel: "电脑工位",
          firstText: "很典型的办公室，很典型的电脑。这种机器是近不久在人类社会里风靡的工具。我看到电脑上标着松下CF-S51的标志。但没有什么值得注意的信息。",
          text: "很典型的办公室，很典型的电脑。这种机器是近不久在人类社会里风靡的工具。我看到电脑上标着松下CF-S51的标志。但没有什么值得注意的信息。",
          x0: 572, y0: 280, x1: 758, y1: 505 },
        { id: "report", label: "案件报告",   firstId: "pc", firstLabel: "电脑工位",
          firstText: "很典型的办公室，很典型的电脑。这种机器是近不久在人类社会里风靡的工具。我看到电脑上标着松下CF-S51的标志。但没有什么值得注意的信息。",
          text: "这是一份警方的案件总结。一般来说记忆世界中不会出现这种错乱的东西，但是考虑到千崎的灵魂已经待在人间太久，可能发生了时空扰动。\n死者小泉昭良，28岁，于20XX年1月14日凌晨两点许死于南方制药A402研究室中，于当日早上被发现。死者死于喉咙左侧锐器划伤导致的出血过多，凶器为大柄野外求生刀。值得注意的是，这把刀与两日前警方高度怀疑的小泉沙耶香案中出现的凶器为同个凶器。\n…………\n最终，警方以小泉因为杀妻后走投无路，畏罪自杀结案。主要负责这起案件的刑警千崎隆太，因失职被降转到交通科，之后因病主动辞职。",
          x0: 763, y0: 280, x1: 943, y1: 505 },
        { id: "nokia",  label: "诺基亚",     firstId: "pc", firstLabel: "电脑工位",
          firstText: "很典型的办公室，很典型的电脑。这种机器是近不久在人类社会里风靡的工具。我看到电脑上标着松下CF-S51的标志。但没有什么值得注意的信息。",
          text: ["实话说我在读完南乡家的通话记录后真的很不想再读通话记录了……翻开这种叫做手机的东西，里面出现的竟然是文字，我长出一口气。上面写着千崎刑警的备忘录。",
          "20XX年1月13日，我和久住那家伙一直在盯梢着小泉昭良，他从进入面前的研究楼之后便一直没有了动静。明明是业务人员却进入了研究楼，仅凭这一点就值得仔细调查。坐在车里面三个多小时，小泉却依然没从这个唯一的出口出来，倒是我腰部深处涌起的疼痛越来越深了。在和久住交流后，我立马跑进附近的老住宅区，缓缓地按摩着自己的腰部。难道我真得要提前退休了吗？\n胡思乱想时，我的脚步已经不知不觉来到了椿桥。一个穿着连帽夹克的男人驻足在桥上，手扶栏杆看着底下的河水。小泉昭良？几小时之前还曾经在狭小房间内和他面对面相处，我绝对没有看错。但他是怎么出的研究大楼？没有时间责问久住了，小泉低头拔腿离开了。我紧紧跟着他的行踪。他正是从我刚刚休息的旧住宅区来的，拐进一条小巷后，他突然就不见了踪影。小泉是什么时候察觉到自己遭人跟踪？不过外行人不可能这么轻易摆脱专业人士的跟踪。难道他跳进附近人家的庭院了？\n我沿着狭窄的私有道路回到同向双线道的马路上。眼熟的轿车进入我的视野之中。我拉开车门责备久住没有看好小泉，他却十分认真地告诉我小泉没有进来也没有出去。“难道是二重身吗……”久住喃喃自语。\n我刚想问什么是二重身，手机就响了起来。“千崎，你们还在盯梢吗？”“小泉昭良已经在实验室死亡了！”"],
          x0: 945, y0: 280, x1: 1112, y1: 505 },
        { id: "doorlock",  label: "实验室门禁",     x: 287,  y: 346, r: 100,
          text: "来到实验室内部，门旁有一处电子打卡设备。我手动调了一下日期，案发当晚只有21：53分小泉进入实验室的打卡记录。难道当时实验室只有小泉一个人？" },
        { id: "stafflist", label: "研究室人员名单", x: 1224, y: 433, r: 150,
          text: "右边的墙壁上贴着本实验室的人员名单。我眯着眼，辨认着有没有认识的人。南乡诚太郎的照片和名字赫然其上。难道南乡诚太郎就是南方制药公司的董事长？我眯着眼睛看着介绍，果然如此。这是巧合吗？小泉沙耶香……小泉昭良……两人都在里面，介绍部分介绍了两位均来自于游港大学药学系，是峰岸诚教授的学生。两人学业成绩优良，有很多我看不懂的研究，但公告板上又指明了两人现在正在做业务岗。" }
      ]
    }
  };
  var START_MAP = GROUP === 1 ? "RPG1-1" : "RPG2-1";

  /* ---- DOM ---- */
  var stage = document.getElementById("stage");
  var mapImg = document.getElementById("map");
  var debugCv = document.getElementById("debug");
  var playerImg = document.getElementById("player");
  var hud = document.getElementById("hud");
  var tip = document.getElementById("teleport-tip");

  /* ---- 状态 ---- */
  var S = {
    id: null, cfg: null,
    mapW: 0, mapH: 0, ps: 1, mask: null,
    charSize: 120, feetW: 44, feetH: 24, lift: 8, speed: 4.2,
    px: 0, py: 0, facing: "down", moving: false,
    animT: 0, frame: 1,
    canTeleport: null, activeClue: null, clueSeen: {}, clueNear: null, dialog: null, itemOpen: false, busy: true, debug: false,
    jumped: false   // 已触发跳转推理（防重复）
  };

  /* ---- 输入 ---- */
  var keys = {};
  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].indexOf(k) >= 0) e.preventDefault();
    keys[k] = true;
    if ((k === "e" || k === "enter") && S.canTeleport && !S.busy) doTeleport(S.canTeleport);
    if ((k === "e" || k === "enter") && S.dialog) advanceClueDialog();   // 对话中：E/回车也可推进线索
    if (k === "f" || k === " ") {
      if (S.dialog) advanceClueDialog();           // 对话中：E/F/空格/回车 = 全文/下一段/关闭
      else if (k === "f" && S.clueNear && !S.busy) openClueDialog(S.clueEff || S.clueNear); // 圈内：F = 打开线索
    }
    if (k === "escape") {
      if (S.dialog) closeClueDialog();
      else if (invPanelOpen()) closeInvPanel();
    }
    if (k === "b") { S.debug = !S.debug; debugCv.style.display = S.debug ? "block" : "none"; }
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", function () { keys = {}; });

  function loadImage(src) {
    return new Promise(function (ok, bad) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { bad(new Error("图片加载失败: " + src)); };
      im.src = src;
    });
  }

  /* ---- 掩码：读取预生成 PNG（白=可走） ---- */
  function readMask(im) {
    var cv = document.createElement("canvas");
    cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    var ctx = cv.getContext("2d");
    ctx.drawImage(im, 0, 0);
    var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    var m = new Uint8Array(cv.width * cv.height);
    for (var i = 0, p = 0; i < m.length; i++, p += 4) m[i] = d[p] > 127 ? 1 : 0;
    return m;
  }

  /* ---- 掩码：内嵌位图数据（js/masks-data.js，file:// 直开时绕过画布跨域限制） ----
     1 位/像素、MSB 在前，1=可走，与 readMask 的 R>127 判定一致 */
  function decodeMaskData(b64, w, h) {
    var bytes = atob(b64), n = bytes.length;
    var m = new Uint8Array(w * h);
    for (var i = 0; i < n; i++) {
      var b = bytes.charCodeAt(i), base = i * 8;
      if (base + 8 > w * h) { // 末字节补位部分超界，逐位判断
        for (var k = 0; k < 8 && base + k < w * h; k++) m[base + k] = (b >> (7 - k)) & 1;
        break;
      }
      m[base]     = (b >> 7) & 1;
      m[base + 1] = (b >> 6) & 1;
      m[base + 2] = (b >> 5) & 1;
      m[base + 3] = (b >> 4) & 1;
      m[base + 4] = (b >> 3) & 1;
      m[base + 5] = (b >> 2) & 1;
      m[base + 6] = (b >> 1) & 1;
      m[base + 7] = b & 1;
    }
    return m;
  }

  /* ---- 脚部碰撞：5 点采样（4 角 + 中心） ---- */
  function canStand(nx, ny) {
    var m = S.mask;
    if (!m) return true;
    var fx = nx + (S.charSize - S.feetW) / 2;
    var fy = ny + S.charSize - S.feetH - S.lift;
    if (fx < 0 || fy < 0 || fx + S.feetW >= S.MW || fy + S.feetH >= S.MH) return false;
    var x0 = Math.round(fx), x1 = Math.round(fx + S.feetW);
    var y0 = Math.round(fy), y1 = Math.round(fy + S.feetH);
    var xm = Math.round(fx + S.feetW / 2), ym = Math.round(fy + S.feetH / 2);
    return m[y0 * S.MW + x0] && m[y0 * S.MW + x1] &&
           m[y1 * S.MW + x0] && m[y1 * S.MW + x1] &&
           m[ym * S.MW + xm];
  }

  /* ---- 渲染 ---- */
  function render() {
    var dir = S.facing === "left" ? "right" : S.facing;
    var f = S.moving ? S.frame : 1;
    var src = CHAR_DIR + "go_" + dir + f + ".png";
    if (playerImg.getAttribute("data-src") !== src) {
      playerImg.src = src;
      playerImg.setAttribute("data-src", src);
    }
    playerImg.style.left = S.px + "px";
    playerImg.style.top = S.py + "px";
    playerImg.style.width = S.charSize + "px";
    playerImg.style.height = S.charSize + "px";
    playerImg.style.transform = S.facing === "left" ? "scaleX(-1)" : "none";
  }

  function fitStage() {
    var k = Math.min(window.innerWidth / S.mapW, window.innerHeight / S.mapH);
    stage.style.width = S.mapW + "px";
    stage.style.height = S.mapH + "px";
    stage.style.transform = "translate(-50%, -50%) scale(" + k + ")";
  }
  window.addEventListener("resize", fitStage);

  /* ---- 调试层：可走区域红色半透明 ---- */
  function renderDebug() {
    if (!S.debug || !S.mask) return;
    var off = document.createElement("canvas");
    off.width = S.MW; off.height = S.MH;
    var octx = off.getContext("2d");
    var id = octx.createImageData(S.MW, S.MH);
    var d = id.data, m = S.mask;
    for (var i = 0, p = 0; i < m.length; i++, p += 4) {
      if (m[i]) { d[p] = 255; d[p + 1] = 50; d[p + 2] = 50; d[p + 3] = 150; }
    }
    octx.putImageData(id, 0, 0);
    debugCv.width = S.mapW; debugCv.height = S.mapH;
    var ctx = debugCv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, S.mapW, S.mapH);
    ctx.drawImage(off, 0, 0, S.mapW, S.mapH);
    // 线索热点圈/框（青色，便于核对位置与范围）
    var hss = S.cfg.hotspots || [];
    ctx.strokeStyle = "#3be8ff";
    ctx.lineWidth = 2;
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#3be8ff";
    for (var k = 0; k < hss.length; k++) {
      var hp = hss[k];
      if (hp.r != null) {
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, hp.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(hp.label, hp.x - hp.r, hp.y - hp.r - 4);
      } else if (hp.rx != null) {
        ctx.beginPath();
        ctx.ellipse(hp.x, hp.y, hp.rx, hp.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(hp.label, hp.x - hp.rx, hp.y - hp.ry - 4);
      } else {
        ctx.strokeRect(hp.x0, hp.y0, hp.x1 - hp.x0, hp.y1 - hp.y0);
        ctx.fillText(hp.label, hp.x0, hp.y0 - 4);
      }
    }
  }

  /* ---- 线索对话框（像素风，E/F/空格/回车/点击推进；text 可为字符串或多段数组） ---- */
  var dlg = document.createElement("div");
  dlg.id = "clue-dialog";
  dlg.innerHTML = '<div class="cd-title"></div><div class="cd-text"></div><div class="cd-more"><span class="cd-count"></span><span class="cd-arrow">▼</span></div>';
  document.body.appendChild(dlg);
  var dlgTitle = dlg.querySelector(".cd-title");
  var dlgText = dlg.querySelector(".cd-text");
  var dlgMore = dlg.querySelector(".cd-more");
  var dlgCount = dlg.querySelector(".cd-count");
  var dlgArrow = dlg.querySelector(".cd-arrow");
  var dlgSegs = [], dlgSeg = 0, dlgFull = "", dlgPos = 0, dlgTimer = null;
  var dlgClueId = null;   // 当前线索对话框的热点 id（成就触发用：电话机→王牌接听员 / 人员名单→王牌研究员）

  function dlgTyping() { return dlgTimer != null; }
  function dlgShowMore() {
    dlgCount.textContent = dlgSegs.length > 1 ? (dlgSeg + 1) + "/" + dlgSegs.length : "";
  }
  function dlgFinish() {
    if (dlgTimer) { clearInterval(dlgTimer); dlgTimer = null; }
    dlgText.textContent = dlgFull;
    dlgText.scrollTop = dlgText.scrollHeight;
    dlgShowMore();
    dlgMore.classList.add("show");
  }
  function dlgStartSeg() {
    dlgFull = dlgSegs[dlgSeg]; dlgPos = 0;
    dlgText.textContent = "";
    dlgText.scrollTop = 0;
    dlgShowMore();
    dlgMore.classList.remove("show");
    dlgTimer = setInterval(function () {
      dlgPos++;
      dlgText.textContent = dlgFull.slice(0, dlgPos);
      dlgText.scrollTop = dlgText.scrollHeight; // 长线索打字时自动跟随到底部
      if (dlgPos >= dlgFull.length) dlgFinish();
    }, 30);
  }
  // 像素对话框底层：标题（可空，空则隐藏标题栏）+ 多段文本（开场对话也复用这套 UI）
  // big=true 时使用加大字号（开场/完成提示）
  function openPixelDialog(label, segs, big) {
    S.dialog = { id: "__pixel__", label: label }; // 推进判定（空格/F/鼠标/Esc）都挂在这上面
    dlgTitle.textContent = label || "";
    dlg.classList.toggle("no-title", !label);
    dlg.classList.toggle("big-text", !!big);
    dlgSegs = Array.isArray(segs) ? segs : [segs];
    dlgSeg = 0;
    dlg.classList.add("show");
    S.busy = true; // 对话期间暂停移动
    dlgStartSeg();
  }
  function openClueDialog(hs) {
    // 前置线索未读（如未拿丰田线索时按大门）：只弹锁定提示，
    // 不标记已读、不收入物品栏、不触发完成检测
    if (hs.requires && !S.clueSeen[hs.requires]) {
      openPixelDialog(hs.label, hs.lockedText || "似乎还有未收集的线索。");
      return;
    }
    dlgClueId = hs.id;     // 记录本条线索 id（供看完最后一段时触发对应成就）
    S.clueSeen[hs.id] = true; // 标记已读（工位 firstId 两段式据此切换）
    gainItem(hs.id); // 首次读取线索 → 物品栏收入对应物品
    // 两段式：首次触发的是前置线索（如"电脑工位"），同时收入所在工位自己的物品（如"笔记本电脑"）
    if (S.clueNear && S.clueNear.id && S.clueNear.id !== hs.id) gainItem(S.clueNear.id);
    checkAllCluesDone(); // 本组线索全部读完 → 自动跳转推理页
    openPixelDialog(hs.label, hs.text);
  }
  function closeClueDialog() {
    if (dlgTimer) { clearInterval(dlgTimer); dlgTimer = null; }
    dlgClueId = null;           // 对话框关闭：清空线索标记，避免后续对话框误触发成就判定
    dlg.classList.remove("show");
    S.dialog = null;
    S.busy = false;
    if (pendingJump) {            // 全线索完成：最后一条线索对话框关闭后改弹像素风完成提示
      pendingJump = false;
      jumpAfterDialog = true;
      openPixelDialog("", finishHint(), true);
      return;
    }
    if (jumpAfterDialog) {        // 完成提示读完 → 进入推理页（第一组）／回剧情（第二组）
      jumpAfterDialog = false;
      var target = finishTarget();
      if (window.console && console.info) console.info('[rpg] 第 ' + GROUP + ' 组线索完成 → ' + target);
      setTimeout(function () { location.href = target; }, 300);
    }
  }
  /* 线索「看完最后一段」的瞬间即刻解锁的成就：
     · RPGI「电话机」全程听完（4月5日录音回放 4 段 + 开场说明）→ 王牌接听员
     · RPGII「研究室人员名单」（实验室 A402 人员介绍）读完 → 王牌研究员
     只在推进完最后一段时触发；Esc 提前关闭不算看完。
     unlock 自带去重，重复翻看同一线索不会重复弹窗。 */
  function reportClueAchievement() {
    try {
      if (!dlgClueId) return;
      if (GROUP === 1 && dlgClueId === "phone" &&
          window.VN && window.VN.achieve) window.VN.achieve.unlock("operator");
      if (GROUP === 2 && dlgClueId === "stafflist" &&
          window.VN && window.VN.achieve) window.VN.achieve.unlock("researcher");
    } catch (e) { /* 成就系统不可用时静默忽略 */ }
  }
  function advanceClueDialog() {
    if (dlgTyping()) { dlgFinish(); return; }                        // 打字中：直接显示全文
    if (dlgSeg < dlgSegs.length - 1) { dlgSeg++; dlgStartSeg(); return; } // 还有下一段：进入下一段
    reportClueAchievement();                                         // 看完最后一段：即刻解锁对应成就
    closeClueDialog();                                               // 最后一段：关闭
  }
  // 看线索时 E/F/空格/回车/随便点击都能推进/关闭对话框
  document.addEventListener("mousedown", function () {
    if (S.dialog) advanceClueDialog();
  });

  /* ---- 线索热点：光晕层 + 按 F 提示 ---- */
  var glowCv = document.createElement("canvas");
  glowCv.id = "glow";
  stage.insertBefore(glowCv, playerImg);
  var glowCtx = glowCv.getContext("2d");

  var clueHint = document.createElement("div");
  clueHint.id = "clue-hint";
  document.body.appendChild(clueHint);

  function drawGlow(t) {
    glowCtx.clearRect(0, 0, glowCv.width, glowCv.height);
    var hs = S.clueNear;
    if (!hs) return;
    var pulse = 0.5 + 0.5 * Math.sin(t / 320);
    var GR = GROUP === 1 ? "255, 217, 122" : "150, 200, 235"; // g1 金 / g2 冷蓝
    // 圆 {r} / 椭圆 {rx,ry} / 矩形 {x0..y1}：统一换算成"中心 + 基准半径 + 横向压缩"
    var hx, hy, R, sx = 1;
    if (hs.r != null) { hx = hs.x; hy = hs.y; R = hs.r; }
    else if (hs.rx != null) { hx = hs.x; hy = hs.y; R = hs.ry; sx = hs.rx / hs.ry; }
    else {
      hx = (hs.x0 + hs.x1) / 2; hy = (hs.y0 + hs.y1) / 2;
      R = Math.max(hs.x1 - hs.x0, hs.y1 - hs.y0) / 2;
    }
    // 统一在"热点中心=局部原点"的坐标系里画：渐变以 (0,0) 为中心，避免变换叠加错位
    glowCtx.save();
    glowCtx.translate(hx, hy);
    glowCtx.scale(sx, 1);
    var g = glowCtx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, "rgba(" + GR + ", " + (0.18 + 0.14 * pulse).toFixed(3) + ")");
    g.addColorStop(0.65, "rgba(" + GR + ", " + (0.10 + 0.08 * pulse).toFixed(3) + ")");
    g.addColorStop(0.92, "rgba(" + GR + ", 0)");
    g.addColorStop(1, "rgba(" + GR + ", 0)");
    // 不按圆边裁剪：渐变在到达边缘前已衰减为 0，只亮中间填充，边缘无线条无锯齿
    glowCtx.fillStyle = g;
    glowCtx.fillRect(-R, -R, R * 2, R * 2);
    glowCtx.restore();
  }

  /* ---- 旧版自动提示（无 text 的热点仍走这里） ---- */
  var clueToast = document.createElement("div");
  clueToast.id = "clue-toast";
  document.body.appendChild(clueToast);
  var clueTimer = null;

  // 两段式热点：firstId 未读时先触发前置线索（如"电脑工位"）
  function effHs(hs) {
    if (hs && hs.firstId && !S.clueSeen[hs.firstId]) {
      return { id: hs.firstId, label: hs.firstLabel, text: hs.firstText };
    }
    return hs;
  }

  function triggerClue(hs) {
    // 扩展点：在页面里定义 window.RPG_ON_CLUE = function(hs){...} 即可接管线索逻辑
    if (typeof window.RPG_ON_CLUE === "function") { window.RPG_ON_CLUE(hs); return; }
    clueToast.innerHTML = "🔍 发现线索：<b>" + hs.label + "</b>";
    clueToast.classList.add("show");
    if (clueTimer) clearTimeout(clueTimer);
    clueTimer = setTimeout(function () { clueToast.classList.remove("show"); }, 2500);
  }

  /* ---- 主循环 ---- */
  var lastT = 0;
  function loop(t) {
    var dt = t - lastT; lastT = t;
    if (!S.busy && S.mask) {
      var dx = 0, dy = 0;
      if (keys["arrowleft"] || keys["a"]) dx -= 1;
      if (keys["arrowright"] || keys["d"]) dx += 1;
      if (keys["arrowup"] || keys["w"]) dy -= 1;
      if (keys["arrowdown"] || keys["s"]) dy += 1;
      S.moving = !!(dx || dy);
      if (S.moving) {
        if (dx > 0) S.facing = "right";
        else if (dx < 0) S.facing = "left";
        else if (dy > 0) S.facing = "down";
        else if (dy < 0) S.facing = "up";
        var len = Math.sqrt(dx * dx + dy * dy);
        var vx = dx / len * S.speed, vy = dy / len * S.speed;
        // X/Y 轴分离判定，贴边可以滑动
        if (vx && canStand(S.px + vx, S.py)) S.px += vx;
        if (vy && canStand(S.px, S.py + vy)) S.py += vy;
        S.animT += dt;
        S.frame = 1 + (Math.floor(S.animT / 120) % 4);
      } else {
        S.animT = 0; S.frame = 1;
      }

      // 传送区检测（脚部中心）
      S.canTeleport = null;
      var cx = S.px + S.charSize / 2;
      var cy = S.py + S.charSize - S.feetH - S.lift + S.feetH / 2;
      var tps = S.cfg.teleports || [];
      for (var i = 0; i < tps.length; i++) {
        if (tps[i].requireClue && !S.clueSeen[tps[i].requireClue]) continue; // 需先读到指定线索才解锁
        if (cx >= tps[i].x0 && cx <= tps[i].x1 && cy >= tps[i].y0 && cy <= tps[i].y1) {
          S.canTeleport = tps[i]; break;
        }
      }
      if (S.canTeleport) {
        tip.innerHTML = "按 <kbd>E</kbd> 传送到 " + S.canTeleport.label;
        tip.classList.add("show");
      } else {
        tip.classList.remove("show");
      }

      // 线索热点检测（脚部中心进入触发，离开后可重复触发）
      // 圆形 {x,y,r} / 椭圆 {x,rx,ry} / 矩形 {x0,y0,x1,y1}；带 text 的热点：光晕 + F 打开对话框
      // 带 firstId 的热点首次按 F 先触发前置线索（如"电脑工位"）；无 text 的热点走自动提示
      var near = null;
      var hss = S.cfg.hotspots || [];
      for (var j = 0; j < hss.length; j++) {
        var hs = hss[j];
        if (hs.r != null) {
          var dxh = cx - hs.x, dyh = cy - hs.y;
          if (dxh * dxh + dyh * dyh <= hs.r * hs.r) { near = hs; break; }
        } else if (hs.rx != null) {
          var exh = (cx - hs.x) / hs.rx, eyh = (cy - hs.y) / hs.ry;
          if (exh * exh + eyh * eyh <= 1) { near = hs; break; }
        } else if (cx >= hs.x0 && cx <= hs.x1 && cy >= hs.y0 && cy <= hs.y1) {
          near = hs; break;
        }
      }
      // 条件热点：once 线索读完即隐去（大门→只留传送）；requires 未读时仍可见
      //（光晕 + F 提示照常），但按 F 只弹 lockedText 锁定提示，见 openClueDialog
      if (near && near.once && S.clueSeen[near.id]) {
        near = null;
      }
      if (near) {
        var eff = effHs(near);
        if (eff.text) {
          // 文案型热点：光晕常亮 + F 提示（对话框开启时隐藏提示）
          S.clueNear = near;
          S.clueEff = eff;
          if (!S.dialog) {
            clueHint.innerHTML = "按 <kbd>F</kbd> 查看线索：" + eff.label;
            clueHint.classList.add("show");
          } else {
            clueHint.classList.remove("show");
          }
        } else if (S.activeClue !== near.id) {
          S.activeClue = near.id;
          triggerClue({ id: eff.id, label: eff.label });
        }
      } else {
        S.activeClue = null;
        S.clueNear = null;
        S.clueEff = null;
        clueHint.classList.remove("show");
      }

      drawGlow(t);

      render();
      if (S.debug) renderDebug();
    }
    requestAnimationFrame(loop);
  }

  /* ---- 地图切换 ---- */
  function enterMap(id, spawn, resumePos) {
    S.busy = true;
    S.id = id;
    S.cfg = MAPS[id];
    // 切图时清理上一张图的光晕与提示
    S.clueNear = null;
    S.clueEff = null;
    clueHint.classList.remove("show");
    if (glowCtx) glowCtx.clearRect(0, 0, glowCv.width, glowCv.height);

    // 掩码优先用内嵌数据（masks-data.js），file:// 直开也能玩；无数据时回退到读 PNG 像素
    var maskData = window.RPG_MASK_DATA ? window.RPG_MASK_DATA[id] : null;
    var maskP = maskData ? Promise.resolve(null) : loadImage(S.cfg.maskSrc);
    Promise.all([loadImage(S.cfg.mapSrc), maskP]).then(function (imgs) {
      var im = imgs[0];
      var mw, mh, mask;
      if (maskData) {
        mw = maskData.w; mh = maskData.h;
        mask = decodeMaskData(maskData.d, mw, mh);
      } else {
        mw = imgs[1].naturalWidth; mh = imgs[1].naturalHeight;
        mask = readMask(imgs[1]);
      }
      S.mask = mask;
      S.ps = 1;
      S.MW = mw; S.MH = mh;
      S.mapW = im.naturalWidth; S.mapH = im.naturalHeight;
      glowCv.width = S.MW; glowCv.height = S.MH;
      S.charSize = S.cfg.charSize;
      S.feetW = S.charSize * 44 / 120;
      S.feetH = S.charSize * 24 / 120;
      S.lift = S.charSize * 8 / 120;
      S.speed = S.charSize / 28;
      S.px = spawn.x - S.charSize / 2;
      S.py = spawn.y - S.charSize;
      S.facing = "down"; S.frame = 1; S.animT = 0;
      /* 从设置/存档页回来：恢复离开时的精确位置与朝向（快照位置必然可站） */
      if (resumePos) {
        S.px = resumePos.px; S.py = resumePos.py;
        S.facing = resumePos.facing || "down";
      }

      mapImg.src = S.cfg.mapSrc;
      hud.innerHTML = "<b>" + S.cfg.name + "</b>";
      fitStage();
      render();
      // 出生点若不可站，就地微调找空位
      if (!canStand(S.px, S.py)) {
        for (var dy2 = 0; dy2 <= 120; dy2 += 8) {
          if (canStand(S.px, S.py + dy2)) { S.py += dy2; break; }
          if (canStand(S.px, S.py - dy2)) { S.py -= dy2; break; }
        }
      }
      S.busy = false;
      // 开场：地图就绪后弹出像素风开场对话（仅首次；两组各有自己的开场词）
      if (!introStarted) startIntro();
    }).catch(function (err) {
      hud.innerHTML = "加载失败：" + err.message + "（请通过本地 http 服务器打开，勿用 file:// 直开）";
    });
  }

  function doTeleport(t) {
    S.busy = true;
    tip.classList.remove("show");
    enterMap(t.to, t.spawn);
  }

  /* ---- 右上角菜单开关 + 弹框（暂停/跳转共用） ---- */
  var menuBtn = document.createElement("div");
  menuBtn.id = "menu-btn";
  menuBtn.title = "菜单";
  menuBtn.textContent = "☰";
  document.body.appendChild(menuBtn);

  var menuMask = document.createElement("div");
  menuMask.id = "pause-menu";
  menuMask.innerHTML =
    '<div class="pm-box">' +
      '<div class="pm-title">菜 单</div>' +
      '<div class="pm-item" data-act="home">回到主页</div>' +
      '<div class="pm-item" data-act="resume">继续游戏</div>' +
      '<div class="pm-item" data-act="setting">设置</div>' +
      '<div class="pm-item" data-act="load">查看存档</div>' +
    '</div>';
  document.body.appendChild(menuMask);

  function menuOpen() { return menuMask.classList.contains("show"); }
  function openMenu() { menuMask.classList.add("show"); S.busy = true; }
  function closeMenu() { menuMask.classList.remove("show"); S.busy = false; }

  /* ---- 探索进度快照：去设置/存档页前保存，回来时带 ?resume=1 恢复 ----
     只在「设置 / 查看存档」两个菜单入口写入；「回到主页」等其它离开不保留，
     下次从剧情进入仍是全新开始。恢复时不再重播开场对话。 */
  var PAGE_NAME = "rpg" + GROUP + ".html";
  var RESUME_KEY = "vn_rpg_resume_" + GROUP;
  function saveResume() {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({
        map: S.id, px: S.px, py: S.py, facing: S.facing,
        clueSeen: S.clueSeen, jumped: S.jumped, inv: invItems
      }));
    } catch (e) {}
  }
  function readResume() {
    try { return JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null"); }
    catch (e) { return null; }
  }
  function clearResume() {
    try { sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
  }

  menuBtn.addEventListener("click", function () {
    if (menuOpen()) closeMenu(); else openMenu();
  });
  menuMask.addEventListener("click", function (e) {
    var act = e.target.getAttribute && e.target.getAttribute("data-act");
    if (act === "resume") { closeMenu(); return; }
    if (act === "home") { location.href = "hall.html"; return; }
    if (act === "setting") { saveResume(); location.href = "settingPage.html?from=" + PAGE_NAME; return; }
    if (act === "load") { saveResume(); location.href = "loadPage.html?from=" + PAGE_NAME; return; }
    if (e.target === menuMask) closeMenu(); // 点空白处关闭
  });

  /* ---- 物品栏：读线索得物品，点击看描述（两组各自定义物品） ---- */
  var ITEM_DEFS = GROUP === 1 ? {
    window:   { name: "窗户",   img: "../images/items1/window.png",
                desc: "南乡家院落中种植了许多樱树，打理精致，风景优美。" },
    tv:       { name: "电视",   img: "../images/items1/tv.png",
                desc: "一台电视机，是近年的型号，不能开机。" },
    phone:    { name: "电话机", img: "../images/items1/phone.png",
                desc: "电话机上记录了事故当天的四次通话。分别是南乡菊子与丈夫南乡纯太郎，儿子南乡纯也与某刑警的通话记录。" },
    chair:    { name: "商务座", img: "../images/items1/chair.png",
                desc: "我也想把我的猫窝修成这种皮质。" },
    table:    { name: "餐桌",   img: "../images/items1/desk.png",
                desc: "桌上有两人年轻时在樱花树下的合影。" },
    painting: { name: "壁画",   img: "../images/items1/photo.png",
                desc: "画有樱花树的风景画，似乎有着纪念意义。" },
    diary:    { name: "日记",   img: "../images/items1/diary.png",
                desc: "记录了南乡纯太郎半年来性情的异常。" },
    letter:   { name: "遗书",   img: "../images/items1/note.png",
                desc: "在南乡纯太郎的口袋中发现的遗书。笔迹确实是本人，但被雨水打湿后只能辨别清楚部分文字了。" }
  } : {
    toyota:   { name: "丰田汽车",       img: "../images/items2/car.png",
                desc: "一辆久经使用的丰田。根据车内物品推断，是刑警盯梢时使用的。" },
    gate:     { name: "大门",           img: "../images/items2/frontdoor.png",
                desc: "实验大楼唯一的出入口。" },
    pc:       { name: "电脑工位",       img: "../images/items2/computer.png",
                desc: "办公室内的电脑。" },
    notebook: { name: "笔记本",     img: "../images/items2/notebook.png",
                desc: "记录了千崎与久住审问小泉昭良的对话。虽然针对小泉昭良有诸多嫌疑，但似乎千崎不认为他是最终凶手。" },
    report:   { name: "案件报告",       img: "../images/items2/file.png",
                desc: "记载了小泉昭良案的具体线索。千崎在这一案后因为癌症也告别了刑警生涯。" },
    nokia:    { name: "诺基亚",         img: "../images/items2/nokia.png",
                desc: "千崎的手机，里面记录了审讯后两人跟踪小泉昭良发生的怪事。从出现于椿桥到身死实验室，久住都坚称实验楼为密室。" },
    doorlock: { name: "实验室门禁",     img: "../images/items2/system.png",
                desc: "记载了实验室的打卡记录。" },
    stafflist:{ name: "研究室人员名单", img: "../images/items2/board.png",
                desc: "南方制药是南乡诚太郎的公司，小泉夫妇在南乡旗下的实验室工作。这种巧合真是十分有趣。" }
  };
  var ITEM_ORDER = GROUP === 1 ?
    ["window", "tv", "phone", "chair", "table", "painting", "diary", "letter"] :
    ["toyota", "gate", "pc", "notebook", "report", "nokia", "doorlock", "stafflist"];
  var invItems = {};       // id -> true（已获得）
  var invPanel, itemToast, itemTimer = null;
  var invGrid, invPager, invRight;
  var invPageNum = 0, selItemId = null;
  var INV_PAGE_SIZE = 6;   // 每页 3 行 x 2 列

  function invPanelOpen() { return invPanel && invPanel.classList.contains("show"); }
  function ownedIds() {
    return ITEM_ORDER.filter(function (id) { return invItems[id]; });
  }
  // 物品图：noimg（如"无"）才显示像素字占位块；有图片的直接只显示图片
  function itemImgHtml(def, imgCls, wrapCls) {
    if (def.noimg || !def.img) {
      return '<span class="ip-imgwrap ' + (wrapCls || "") + '"><span class="it-fb">' + def.name.charAt(0) + '</span></span>';
    }
    return '<span class="ip-imgwrap ' + (wrapCls || "") + '">' +
           '<img class="' + (imgCls || "") + '" src="' + def.img + '" alt="' + def.name + '"></span>';
  }

  function renderInvGrid(freshId) {
    var ids = ownedIds();
    var totalPages = Math.max(1, Math.ceil(ids.length / INV_PAGE_SIZE));
    if (invPageNum >= totalPages) invPageNum = totalPages - 1;
    var pageIds = ids.slice(invPageNum * INV_PAGE_SIZE, invPageNum * INV_PAGE_SIZE + INV_PAGE_SIZE);
    invGrid.innerHTML = "";
    if (!ids.length) {
      var sp = document.createElement("span");
      sp.className = "ip-empty";
      sp.textContent = "（尚未获得任何物品）";
      invGrid.appendChild(sp);
    } else {
      pageIds.forEach(function (id) {
        var def = ITEM_DEFS[id];
        var cell = document.createElement("div");
        cell.className = "ip-cell" + (id === selItemId ? " sel" : "") + (id === freshId ? " fresh" : "");
        cell.innerHTML = itemImgHtml(def) +
                         '<div class="ip-name">' + def.name + '</div>';
        cell.addEventListener("click", function (e) {
          e.stopPropagation();
          selItemId = id;
          renderInvGrid();
          renderInvDetail();
        });
        invGrid.appendChild(cell);
      });
    }
    // 翻页器（超过一页才显示）
    invPager.innerHTML = "";
    if (totalPages > 1) {
      var prev = document.createElement("span");
      prev.className = "ip-pgbtn";
      prev.textContent = "◀";
      prev.addEventListener("click", function (e) {
        e.stopPropagation();
        invPageNum = (invPageNum + totalPages - 1) % totalPages;
        renderInvGrid();
      });
      var label = document.createElement("span");
      label.className = "ip-pglabel";
      label.textContent = (invPageNum + 1) + " / " + totalPages;
      var next = document.createElement("span");
      next.className = "ip-pgbtn";
      next.textContent = "▶";
      next.addEventListener("click", function (e) {
        e.stopPropagation();
        invPageNum = (invPageNum + 1) % totalPages;
        renderInvGrid();
      });
      invPager.appendChild(prev);
      invPager.appendChild(label);
      invPager.appendChild(next);
    }
  }

  function renderInvDetail() {
    if (!selItemId || !invItems[selItemId]) {
      invRight.innerHTML = '<span class="ip-hint">（点击左侧物品\n查看详细介绍）</span>';
      return;
    }
    var def = ITEM_DEFS[selItemId];
    invRight.innerHTML = itemImgHtml(def, "d-img", "d-imgwrap") +
      '<div class="d-name">' + def.name + '</div>' +
      '<div class="d-desc">' + (def.desc || "……（物品描述待补充）") + '</div>';
  }

  function gainItem(id) {
    if (!ITEM_DEFS || !ITEM_DEFS[id] || invItems[id]) return;
    invItems[id] = true;
    // 翻到新物品所在的那一页并弹出动画
    var count = ownedIds().length;
    invPageNum = Math.floor((count - 1) / INV_PAGE_SIZE);
    renderInvGrid(id);
    renderInvDetail();
    // 获得提示
    if (itemTimer) clearTimeout(itemTimer);
    itemToast.innerHTML = "◆ 获得物品：<b>" + ITEM_DEFS[id].name + "</b>";
    itemToast.classList.add("show");
    itemTimer = setTimeout(function () { itemToast.classList.remove("show"); }, 2200);
  }

  function openInvPanel() {
    renderInvGrid();
    renderInvDetail();
    invPanel.classList.add("show");
    S.busy = true;
  }
  function closeInvPanel() {
    invPanel.classList.remove("show");
    S.busy = false;
  }

  if (ITEM_DEFS) {
    // 开关按钮（三杠左边，背包图标）
    var invBtn = document.createElement("div");
    invBtn.id = "inv-btn";
    invBtn.title = "物品栏";
    invBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' +
        '<path d="M9 7V6a3 3 0 0 1 6 0v1"/>' +
        '<path d="M4.5 7h15l-1.1 12.2a1.6 1.6 0 0 1-1.6 1.3H7.2a1.6 1.6 0 0 1-1.6-1.3L4.5 7z"/>' +
        '<path d="M4.5 11h15"/>' +
      '</svg>';
    document.body.appendChild(invBtn);
    invBtn.addEventListener("click", function () {
      if (invPanelOpen()) closeInvPanel(); else openInvPanel();
    });

    // 书本面板：左页缩略图翻页，右页详情
    invPanel = document.createElement("div");
    invPanel.id = "inv-panel";
    invPanel.innerHTML =
      '<div class="ip-book">' +
        '<div class="ip-booktitle">物 品 栏</div>' +
        '<div class="ip-pages">' +
          '<div class="ip-page ip-page-left"><div class="ip-grid"></div><div class="ip-pager"></div></div>' +
          '<div class="ip-page ip-page-right"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(invPanel);
    invGrid = invPanel.querySelector(".ip-grid");
    invPager = invPanel.querySelector(".ip-pager");
    invRight = invPanel.querySelector(".ip-page-right");
    invPanel.addEventListener("click", function (e) {
      if (e.target === invPanel) closeInvPanel(); // 点空白处关闭
    });

    // 获得物品提示
    itemToast = document.createElement("div");
    itemToast.id = "item-toast";
    document.body.appendChild(itemToast);
  }

  /* ---- 开场：像素风开场对话（复用线索对话框 UI，见 openPixelDialog）
     两组各有一份开场词，样式完全一致（无标题栏 + 加大字号）：
       第一组（南乡家 / 菊子梦境）、第二组（游港大学 / 千崎梦境） ---- */
  var INTRO_SEGS = GROUP === 1 ? [
    "这便是我作为死神的特殊能力。",
    "通过干扰他人的灵魂进入他们的记忆世界——复现当时的线索，得出事件的真相吧。",
    "(可以在右上角的背包查看已经收集的线索。所有线索搜集完会自动进入推理阶段。)"
  ] : [
    "这便是我作为死神（高贵灵体）的特殊能力。",
    "将千崎隆太的魂魄拉进我的梦境世界中——在这片由记忆与执念构筑的纯白走廊里，复现一年半前那一晚的线索，得出“二重身”与密室杀人案的真相吧。",
    "（可以在右上角的背包查看已经收集的线索。所有线索搜集完会自动进入推理阶段。）"
  ];
  var introStarted = false;
  function startIntro() {
    introStarted = true;
    openPixelDialog("", INTRO_SEGS, true); // 不带姓名栏，加大字号
  }

  /* ---- 全线索搜集检测：本组线索全部读过 → 像素风提示 → 跳转 ----
     第一组 → deduction.html（菊子梦境）
     第二组 → **回视觉小说**续播（推理环节不再从这里进，
              改由剧情里那句 goto: 'deduction2.html' 衔接；返回点＝该句的下一句） */
  var DEDUCTION_PAGE = GROUP === 1 ? "deduction.html" : null;
  var STORY_RETURN_KEY = 'vn_minigame_return';
  function finishTarget() {
    if (DEDUCTION_PAGE) return DEDUCTION_PAGE;
    var has = false;
    try { has = !!localStorage.getItem(STORY_RETURN_KEY); } catch (e) { has = false; }
    return has ? ('plot.html?save=' + encodeURIComponent(STORY_RETURN_KEY)) : 'plot.html';
  }
  function finishHint() {
    return DEDUCTION_PAGE
      ? ["🔍 线索已全部搜集完成——即将进入推理环节……"]
      : ["🔍 线索已全部搜集完成——即将回到剧情……"];
  }
  var pendingJump = false, jumpAfterDialog = false;
  function checkAllCluesDone() {
    if ((GROUP !== 1 && GROUP !== 2) || S.jumped) return;
    for (var i = 0; i < ITEM_ORDER.length; i++) if (!S.clueSeen[ITEM_ORDER[i]]) return;
    S.jumped = true;
    pendingJump = true; // 等当前线索对话框关闭后再弹出完成提示（见 closeClueDialog）
  }

  /* ---- 启动 ----
     掩码已内嵌（masks-data.js），file:// 双击直开与 http 服务器均可运行
     带 ?resume=1 且有快照 → 恢复探索进度（从设置/存档页返回）；
     否则为全新进入（并清掉可能残留的快照，避免旧档串场）。 */
  (function bootEnter() {
    var isResume = /[?&]resume=1/.test(location.search || "");
    var snap = isResume ? readResume() : null;
    clearResume();
    if (snap && snap.map && MAPS[snap.map]) {
      introStarted = true;                       // 恢复进度不重播开场对话
      S.clueSeen = snap.clueSeen || {};          // 已读线索（热点两段式/传送解锁据此判断）
      S.jumped = !!snap.jumped;
      if (snap.inv) { invItems = {}; for (var k in snap.inv) invItems[k] = true; }
      enterMap(snap.map, MAPS[snap.map].spawn, { px: snap.px, py: snap.py, facing: snap.facing });
      return;
    }
    enterMap(START_MAP, MAPS[START_MAP].spawn);
  })();
  requestAnimationFrame(loop);
})();
