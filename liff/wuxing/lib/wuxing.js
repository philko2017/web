/* 生日五行（加權）＋日主旺衰與用神（滴天髓扶抑法）＋台灣夏令時間修正：Crystal Whispers 水晶呢喃
   八字用 lunar-javascript：年柱以立春、月柱以節的交節時刻為界；晚子時（23 點後）日柱算隔天（和流亡者排盤相同）。
   加權：天干每個 1 分；地支每個 1 分，依藏干拆開（本氣 0.6／中氣 0.3／餘氣 0.1，兩個藏干 0.7／0.3）；月支（月令）再乘 2。
   不知道時辰就只算年、月、日三柱。 */
(function (root) {
  var STEM_EL = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var HIDDEN = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'],
    午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
  };
  var SPLIT = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
  var MONTH_WEIGHT = 2;
  var ELS = ['木', '火', '土', '金', '水'];
  // 時辰：0 早子（0–1 點）、1 丑 … 11 亥、12 晚子（23–24 點）；-1 不知道
  var HOURS = [
    { name: '早子', range: '0–1', h: 0, m: 30 }, { name: '丑', range: '1–3', h: 2 }, { name: '寅', range: '3–5', h: 4 },
    { name: '卯', range: '5–7', h: 6 }, { name: '辰', range: '7–9', h: 8 }, { name: '巳', range: '9–11', h: 10 },
    { name: '午', range: '11–13', h: 12 }, { name: '未', range: '13–15', h: 14 }, { name: '申', range: '15–17', h: 16 },
    { name: '酉', range: '17–19', h: 18 }, { name: '戌', range: '19–21', h: 20 }, { name: '亥', range: '21–23', h: 22 },
    { name: '晚子', range: '23–24', h: 23, m: 30 },
  ];
  var DAY_MASTER = {
    甲: '像一棵大樹：正直、有擔當，喜歡一直往上長。',
    乙: '像花草藤蔓：柔軟有韌性，很懂得變通。',
    丙: '像太陽：熱情大方，走到哪裡都亮。',
    丁: '像燭光：細膩溫暖，能照亮身邊的人。',
    戊: '像一座山：穩重可靠，讓人有安全感。',
    己: '像田園的土：包容踏實，很會照顧人。',
    庚: '像礦石刀劍：果斷講義氣，做事俐落。',
    辛: '像珠寶：精緻有品味，很重視細節。',
    壬: '像江河大海：聰明有遠見，喜歡自由。',
    癸: '像雨露：溫柔敏銳，直覺很準。',
  };
  var MEANING = { 木: '成長、計畫、人緣', 火: '熱情、行動、表達', 土: '穩定、信任、累積', 金: '決斷、紀律、貴人', 水: '智慧、溝通、靈活' };

  function pad(n) { return String(n).padStart(2, '0'); }

  // ===== 夏令時間（台灣）：這些期間時鐘比標準時間（UTC+8）快 1 小時，排八字要先減回來 =====
  // 依 IANA 時區資料庫 Asia/Taipei；每段是 [開始日, 結束日]（含），日治時期 1937/10/1–1945/9/20 用東京時間也一樣處理
  var DST = [
    ['1937-10-01', '1945-09-20'], ['1946-05-15', '1946-09-30'], ['1947-04-15', '1947-10-31'], ['1948-05-01', '1948-09-30'],
    ['1949-05-01', '1949-09-30'], ['1950-05-01', '1950-09-30'], ['1951-05-01', '1951-09-30'], ['1952-03-01', '1952-10-31'],
    ['1953-04-01', '1953-10-31'], ['1954-04-01', '1954-10-31'], ['1955-04-01', '1955-09-30'], ['1956-04-01', '1956-09-30'],
    ['1957-04-01', '1957-09-30'], ['1958-04-01', '1958-09-30'], ['1959-04-01', '1959-09-30'], ['1960-06-01', '1960-09-30'],
    ['1961-06-01', '1961-09-30'], ['1974-04-01', '1974-09-30'], ['1975-04-01', '1975-09-30'], ['1979-07-01', '1979-09-30'],
  ];
  function dstOf(ymd) {
    for (var i = 0; i < DST.length; i++) if (ymd >= DST[i][0] && ymd <= DST[i][1]) return DST[i][0] < '1946' ? '日治時期東京時間' : '夏令時間';
    return '';
  }
  var hourIndex = function (h) { return h === 23 ? 12 : h === 0 ? 0 : Math.floor((h + 1) / 2); };

  // ===== 十神分組：以日主五行為中心 =====
  var GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 生
  var CTRL = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };  // 剋
  function groups(D) {
    var yin = ELS.filter(function (e) { return GEN[e] === D; })[0];     // 生我＝印
    var guan = ELS.filter(function (e) { return CTRL[e] === D; })[0];   // 剋我＝官殺
    return { 比劫: D, 印: yin, 食傷: GEN[D], 財: CTRL[D], 官殺: guan };
  }
  var SEASON = { 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土' };

  // ===== 滴天髓旺衰法（扶抑）：看日主得不得令、有沒有根、同類（比劫＋印）占多少，決定身強身弱與用神 =====
  function strength(pillars, score, D) {
    var G = groups(D);
    var monthBr = pillars[1].gz[1], mEl = STEM_EL[HIDDEN[monthBr][0]];
    var season = mEl === D ? '旺' : GEN[mEl] === D ? '相' : GEN[D] === mEl ? '休' : CTRL[D] === mEl ? '囚' : '死';
    var deLing = season === '旺' || season === '相';
    // 有根：地支藏干裡有和日主同五行的字
    var roots = pillars.filter(function (p) { return HIDDEN[p.gz[1]].some(function (s) { return STEM_EL[s] === D; }); }).map(function (p) { return p.label + '支' + p.gz[1]; });
    var total = ELS.reduce(function (a, e) { return a + score[e]; }, 0) - 1;   // 不算日主自己
    var same = score[D] - 1 + score[G.印];
    var ratio = total > 0 ? same / total : 0;
    var g = {}; Object.keys(G).forEach(function (k) { g[k] = k === '比劫' ? score[G[k]] - 1 : score[G[k]]; });
    var level, use, like, avoid, why;
    if (ratio >= 0.8) {
      level = '從強';
      use = g.比劫 >= g.印 ? '比劫' : '印'; like = use === '比劫' ? '印' : '比劫'; avoid = '官殺';
      why = '命局幾乎都是幫你的力量，順著這股勢，用同類的五行最好，不宜硬去剋它。';
    } else if (ratio < 0.2 && !roots.length) {
      level = '從弱';
      use = ['財', '官殺', '食傷'].sort(function (a, b) { return g[b] - g[a]; })[0];
      like = use === '財' ? '食傷' : use === '官殺' ? '財' : '財'; avoid = '印';
      why = '自己的力量很少又沒有根，順著命局最強的那股勢走，反而比較順。';
    } else if (ratio >= 0.5) {
      level = ratio >= 0.6 ? '身強' : '中和偏強';
      if (g.印 > g.比劫) { use = '財'; like = '食傷'; why = '幫你的力量以「印」為主，用財來平衡（財剋印）。'; }
      else if (g.官殺 >= 0.5) { use = '官殺'; like = '財'; why = '同類的力量多，用官殺來約束、讓力量有方向。'; }
      else { use = '食傷'; like = '財'; why = '同類的力量多，用食傷把能量發揮出去。'; }
      avoid = '印';
    } else {
      level = ratio < 0.4 ? '身弱' : '中和偏弱';
      var heavy = ['財', '官殺', '食傷'].sort(function (a, b) { return g[b] - g[a]; })[0];
      if (heavy === '財') { use = '比劫'; like = '印'; avoid = '官殺'; why = '壓力主要來自「財」，用同類的比劫幫身扛住。'; }
      else { use = '印'; like = '比劫'; avoid = '財'; why = heavy === '官殺' ? '壓力主要來自官殺，用印來化解並生扶自己。' : '力量被食傷洩得多，用印來補充、也制住食傷。'; }
    }
    // 調候（寒暖燥濕）：冬天出生火太少、夏天出生水太少時另外提醒
    var tiao = '';
    var pct = function (e) { return score[e] / (total + 1) * 100; };
    if ('亥子丑'.indexOf(monthBr) >= 0 && pct('火') < 10) tiao = '冬天出生、命局偏寒，另外喜「火」來暖局。';
    if ('巳午未'.indexOf(monthBr) >= 0 && pct('水') < 10) tiao = '夏天出生、命局偏燥，另外喜「水」來潤局。';
    return {
      level: level, ratio: Math.round(ratio * 1000) / 10, season: season, deLing: deLing, roots: roots,
      use: G[use], useGod: use, like: G[like], likeGod: like, avoid: G[avoid], avoidGod: avoid, why: why, tiao: tiao, groups: G,
    };
  }

  // input: { y, m, d, lunar: bool, leap: bool, hour: -1..12, time: 'HH:MM'（可省略，有填就以它為準） }
  function calc(input, L) {
    L = L || root;
    var hour = input.hour == null ? -1 : +input.hour;
    var solarDay;
    if (input.lunar) {
      var lm = input.leap ? -Math.abs(input.m) : +input.m;
      var lu = L.Lunar.fromYmd(+input.y, lm, +input.d);
      // lunar-javascript 對不存在的閏月或日數不一定會報錯，換算回去比對
      if (lu.getYear() !== +input.y || lu.getMonth() !== lm || lu.getDay() !== +input.d) throw new Error('農曆日期不存在');
      solarDay = lu.getSolar();
    } else {
      var js = new Date(+input.y, +input.m - 1, +input.d);
      if (js.getFullYear() !== +input.y || js.getMonth() !== +input.m - 1 || js.getDate() !== +input.d) throw new Error('日期不存在');
      solarDay = L.Solar.fromYmd(+input.y, +input.m, +input.d);
    }
    var ymd = solarDay.getYear() + '-' + pad(solarDay.getMonth()) + '-' + pad(solarDay.getDay());
    var dst = dstOf(ymd), exact = /^\d{1,2}:\d{2}$/.test(input.time || '') ? input.time : '';
    var solar, clock = '', corrected = '';
    if (exact) {
      var hm = exact.split(':').map(Number);
      clock = pad(hm[0]) + ':' + pad(hm[1]);
      // 夏令時間：減 1 小時（可能跨回前一天）
      var t = new Date(Date.UTC(solarDay.getYear(), solarDay.getMonth() - 1, solarDay.getDay(), hm[0], hm[1]) - (dst ? 3600e3 : 0));
      solar = L.Solar.fromYmdHms(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), 0);
      corrected = dst ? pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) : '';
      hour = hourIndex(t.getUTCHours());
    } else {
      var H = hour >= 0 ? HOURS[hour] : { h: 12, m: 0 };
      solar = L.Solar.fromYmdHms(solarDay.getYear(), solarDay.getMonth(), solarDay.getDay(), H.h, H.m || 0, 0);
    }
    var lunar = solar.getLunar();
    var ec = lunar.getEightChar();
    ec.setSect(1); // 晚子時日柱算隔天
    var pillars = [
      { label: '年', gz: ec.getYear() },
      { label: '月', gz: ec.getMonth() },
      { label: '日', gz: ec.getDay() },
    ];
    if (hour >= 0) pillars.push({ label: '時', gz: ec.getTime() });

    var score = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    pillars.forEach(function (p) {
      score[STEM_EL[p.gz[0]]] += 1;
      var hs = HIDDEN[p.gz[1]], w = p.label === '月' ? MONTH_WEIGHT : 1;
      hs.forEach(function (s, i) { score[STEM_EL[s]] += SPLIT[hs.length][i] * w; });
    });
    var total = ELS.reduce(function (a, e) { return a + score[e]; }, 0);
    var pct = {};
    ELS.forEach(function (e) { pct[e] = Math.round(score[e] / total * 1000) / 10; });
    var order = ELS.slice().sort(function (a, b) { return score[b] - score[a]; });
    var dayStem = pillars[2].gz[0];
    return {
      solar: ymd,
      lunarText: (lunar.getYearInGanZhi() + '年 ' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese()).replace(/闰/g, '閏').replace(/腊/g, '臘'),
      hour: hour, hourName: hour >= 0 ? HOURS[hour].name + '時' : '不知道時辰',
      clock: clock, corrected: corrected, dst: dst,
      pillars: pillars,
      score: score, pct: pct,
      strong: order[0],
      weak: order[4],
      weak2: order[3],
      missing: ELS.filter(function (e) { return pct[e] < 5; }),
      dayMaster: { stem: dayStem, el: STEM_EL[dayStem], text: DAY_MASTER[dayStem] },
      power: strength(pillars, score, STEM_EL[dayStem]),
    };
  }

  var api = { calc: calc, HOURS: HOURS, ELS: ELS, MEANING: MEANING, STEM_EL: STEM_EL, HIDDEN: HIDDEN, dstOf: dstOf, groups: groups };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WuXing = api;
})(typeof self !== 'undefined' ? self : this);
