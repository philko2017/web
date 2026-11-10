/* 生日五行（加權）：Crystal Whispers 水晶呢喃
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

  // input: { y, m, d, lunar: bool, leap: bool, hour: -1..12 }
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
    var H = hour >= 0 ? HOURS[hour] : { h: 12, m: 0 };
    var solar = L.Solar.fromYmdHms(solarDay.getYear(), solarDay.getMonth(), solarDay.getDay(), H.h, H.m || 0, 0);
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
      solar: solar.getYear() + '-' + pad(solar.getMonth()) + '-' + pad(solar.getDay()),
      lunarText: (lunar.getYearInGanZhi() + '年 ' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese()).replace(/闰/g, '閏').replace(/腊/g, '臘'),
      hour: hour, hourName: hour >= 0 ? HOURS[hour].name + '時' : '不知道時辰',
      pillars: pillars,
      score: score, pct: pct,
      strong: order[0],
      weak: order[4],
      weak2: order[3],
      missing: ELS.filter(function (e) { return pct[e] < 5; }),
      dayMaster: { stem: dayStem, el: STEM_EL[dayStem], text: DAY_MASTER[dayStem] },
    };
  }

  var api = { calc: calc, HOURS: HOURS, ELS: ELS, MEANING: MEANING, STEM_EL: STEM_EL, HIDDEN: HIDDEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WuXing = api;
})(typeof self !== 'undefined' ? self : this);
