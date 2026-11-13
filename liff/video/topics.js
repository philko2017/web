// 「從題材庫挑」元件（水晶呢喃 M20）：IG 貼文產生器、短影片題材產生器共用同一份（igpost 頁用 ../video/topics.js 載入）。
// 題材在 Notion「題材庫」，由 n8n 流程 <客戶>-topics 列出；挑一個就填進頁面的輸入框當方向，標題與內容由各工具自己衍伸。
// 用法：const picker = TopicPicker.mount({ host, tool: "ig" | "video", fetch: async fields => 回應的 JSON, demo, onPick(text) })
//       送出產生時呼叫 picker.used(輸入框的字)：輸入框裡還留著挑的那句，就把題材庫那一列的「用過」加 1（同一次挑選只記一次）
(() => {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // 顏色跟著各頁自己的變數走；短影片頁沒有 --brand，就用墨色
  const CSS = `
.tp { display: grid; gap: 10px; min-width: 0; }
.tp-open { font: inherit; font-size: 14px; font-weight: 700; width: 100%; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 8px;
  color: var(--brand, var(--ink)); background: var(--brand-soft, var(--bg)); border: 1px dashed var(--brand, var(--line)); border-radius: 12px; padding: 11px 14px; }
.tp-open i { font-style: normal; transition: transform .15s; }
.tp-open[aria-expanded="true"] i { transform: rotate(180deg); }
.tp-panel { border: 1px solid var(--line); border-radius: 14px; padding: 12px; display: grid; gap: 10px; background: var(--card); min-width: 0; }
.tp-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: var(--bg); border-radius: 10px; padding: 4px; }
.tp-tab { font: inherit; font-size: 14px; font-weight: 700; border: 0; background: none; color: var(--muted); padding: 8px 4px; border-radius: 8px; cursor: pointer; }
.tp-tab[aria-selected="true"] { background: var(--brand, var(--ink)); color: var(--on-brand, var(--bg)); }
.tp-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
.tp-chip { flex: none; font: inherit; font-size: 13px; cursor: pointer; border: 1px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 999px; padding: 6px 13px; }
.tp-chip[aria-pressed="true"] { background: var(--brand, var(--ink)); color: var(--on-brand, var(--bg)); border-color: var(--brand, var(--ink)); }
.tp-list { display: grid; gap: 8px; max-height: 46vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.tp-head { margin: 6px 0 0; font-size: 12px; letter-spacing: .04em; color: var(--muted); font-weight: 700; }
.tp-head:first-child { margin-top: 0; }
.tp-item { font: inherit; font-size: 15px; line-height: 1.5; width: 100%; text-align: left; cursor: pointer; color: var(--ink); background: var(--bg);
  border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; display: grid; gap: 3px; overflow-wrap: anywhere; }
.tp-item small { font-size: 12px; color: var(--muted); }
.tp-item .tp-used { color: var(--brand, var(--ink)); font-weight: 700; }
.tp-msg { margin: 0; font-size: 13px; color: var(--muted); }
.tp-retry { font: inherit; font-size: 13px; cursor: pointer; background: none; color: var(--ink); border: 1px solid var(--line); border-radius: 10px; padding: 6px 12px; justify-self: start; }
.tp-picked { margin: 0; font-size: 13px; color: var(--muted); }`;

  const DEMO = [
    { id: "d1", text: "我適合哪一種水晶？從五行喜忌找到適合自己的選擇", cat: "水晶小白", month: 0, theme: "", note: "", ig: 2, video: 0 },
    { id: "d2", text: "水晶手鍊戴左手還是右手？不同戴法有哪些說法？", cat: "水晶小白", month: 0, theme: "", note: "", ig: 0, video: 1 },
    { id: "d3", text: "雙 11 買水晶怎麼避雷？天然、染色與人工合成怎麼分辨？", cat: "年度話題", month: 11, theme: "購物季、單身話題", note: "", ig: 0, video: 0 },
    { id: "d4", text: "第一次買水晶，預算有限該怎麼挑？大顆、漂亮和適合自己，哪個更重要？", cat: "年度話題", month: 11, theme: "購物季、單身話題", note: "", ig: 1, video: 0 },
    { id: "d5", text: "聖誕交換禮物送水晶，預算內有哪些選擇？", cat: "年度話題", month: 12, theme: "聖誕節、跨年", note: "", ig: 0, video: 0 },
    { id: "d6", text: "過年想招財，黃水晶、綠幽靈和鈦晶怎麼選？", cat: "年度話題", month: 2, theme: "農曆新年、西洋情人節", note: "農曆新年有時落在 1 月，可依當年日期調整。", ig: 0, video: 0 },
  ];

  function mount({ host, tool, fetch: send, demo, onPick }) {
    if (!document.getElementById("tp-css")) {
      const st = document.createElement("style"); st.id = "tp-css"; st.textContent = CSS; document.head.append(st);
    }
    const countKey = tool === "video" ? "video" : "ig";
    let items = null, loading = false, failed = false, tab = "now", group = "", picked = null;
    host.classList.add("tp");
    host.innerHTML = `<button type="button" class="tp-open" aria-expanded="false"><span>從題材庫挑一個方向</span><i aria-hidden="true">▾</i></button>
      <div class="tp-panel" hidden></div><p class="tp-picked" hidden></p>`;
    const btn = host.querySelector(".tp-open"), panel = host.querySelector(".tp-panel"), pickedEl = host.querySelector(".tp-picked");

    // 台灣時間的月份（手機時區不一定是台灣）
    const month = () => new Date(Date.now() + 8 * 3600e3).getUTCMonth() + 1;
    const groupOf = t => (t.month ? t.month + "月" : t.cat || "其他");
    const groups = () => {
      const cats = [], months = [];
      items.forEach(t => { const g = groupOf(t); (t.month ? months : cats).includes(g) || (t.month ? months : cats).push(g); });
      return [...cats, ...months.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))];
    };
    const itemHtml = t => {
      const n = t[countKey] || 0;
      const meta = [n ? `<span class="tp-used">已用過 ${n} 次</span>` : "", esc(t.note)].filter(Boolean).join(" · ");
      return `<button type="button" class="tp-item" data-id="${esc(t.id)}">${esc(t.text)}${meta ? `<small>${meta}</small>` : ""}</button>`;
    };
    const section = (m, list) => `<p class="tp-head">${m} 月${list[0].theme ? "｜" + esc(list[0].theme) : ""}</p>` + list.map(itemHtml).join("");

    function render() {
      if (loading) { panel.innerHTML = `<p class="tp-msg">讀取題材庫…</p>`; return; }
      if (failed || !items) { panel.innerHTML = `<p class="tp-msg">題材庫讀取失敗。</p><button type="button" class="tp-retry">再試一次</button>`;
        panel.querySelector(".tp-retry").onclick = load; return; }
      if (!items.length) { panel.innerHTML = `<p class="tp-msg">題材庫還沒有上架的題材。到 Notion「題材庫」加一列就會出現。</p>`; return; }
      const m1 = month(), m2 = m1 % 12 + 1;
      let body;
      if (tab === "now") {
        const parts = [m1, m2].map(m => [m, items.filter(t => t.month === m)]).filter(([, l]) => l.length);
        body = parts.length ? parts.map(([m, l]) => section(m, l)).join("") : `<p class="tp-msg">這兩個月還沒有題材，到「全部」看看。</p>`;
      } else {
        const gs = groups();
        if (!gs.includes(group)) group = gs[0];
        body = items.filter(t => groupOf(t) === group).map(itemHtml).join("");
        const head = items.find(t => groupOf(t) === group && t.month && t.theme);
        if (head) body = `<p class="tp-head">${esc(head.theme)}</p>` + body;
      }
      panel.innerHTML = `<div class="tp-tabs" role="tablist">
          <button type="button" class="tp-tab" role="tab" data-tab="now" aria-selected="${tab === "now"}">這兩個月</button>
          <button type="button" class="tp-tab" role="tab" data-tab="all" aria-selected="${tab === "all"}">全部</button></div>
        ${tab === "all" ? `<div class="tp-chips">${groups().map(g => `<button type="button" class="tp-chip" aria-pressed="${g === group}">${esc(g)}</button>`).join("")}</div>` : ""}
        <div class="tp-list">${body}</div>
        <p class="tp-msg">點一個題材當方向，AI 會照它衍伸新的標題和內容，不會照抄。</p>`;
      panel.querySelectorAll(".tp-tab").forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
      panel.querySelectorAll(".tp-chip").forEach(b => b.onclick = () => { group = b.textContent; render(); });
      panel.querySelectorAll(".tp-item").forEach(b => b.onclick = () => choose(b.dataset.id));
      const on = panel.querySelector('.tp-chip[aria-pressed="true"]');
      if (on) on.scrollIntoView({ block: "nearest", inline: "center" });
    }

    async function load() {
      loading = true; failed = false; render();
      try {
        if (demo) { await new Promise(r => setTimeout(r, 300)); items = JSON.parse(JSON.stringify(DEMO)); }
        else {
          const r = await send({ mode: "list" });
          if (!r || !r.ok || !Array.isArray(r.items)) throw 0;
          items = r.items;
        }
      } catch { failed = true; }
      loading = false; render();
    }

    function toggle(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open && !items && !loading) load();
    }
    btn.onclick = () => toggle(panel.hidden);

    function choose(id) {
      const t = items.find(x => x.id === id);
      if (!t) return;
      picked = { id: t.id, text: t.text, counted: false };
      toggle(false);
      pickedEl.hidden = false;
      pickedEl.textContent = "已帶入題材庫的方向，可以直接產生，也可以在框裡再補幾個字。";
      onPick(t.text, t);
    }

    return {
      // 產生時呼叫：輸入框裡還留著挑的那句才算用過；同一次挑選只記一次。記不到不影響產生，所以不報錯
      used(value) {
        if (!picked || picked.counted || !String(value || "").includes(picked.text)) return;
        picked.counted = true;
        const t = items && items.find(x => x.id === picked.id);
        if (t) { t[countKey] = (t[countKey] || 0) + 1; if (!panel.hidden) render(); }
        if (!demo) Promise.resolve().then(() => send({ mode: "use", id: picked.id, tool: countKey })).catch(() => {});
      },
    };
  }

  window.TopicPicker = { mount };
})();
