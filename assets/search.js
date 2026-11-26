// Full-text search with scopes (Pagefind) and jump-to-article ("ISL 5.3.6").
const base = document.body.dataset.base || "";
const params = new URLSearchParams(location.search);
const q = (params.get("q") || "").trim();
const scope = params.get("scope") || "current";
const lin = params.get("lin") || "";
const ed = params.get("ed") || "";
const out = document.getElementById("results");
const note = document.getElementById("scope-note");
const form = document.querySelector(".searchform");
form.q.value = q;
form.lin.value = lin; form.ed.value = ed;
[...form.scope.options].forEach(o => { o.selected = o.value === scope; if ((o.value === "edition" || o.value === "document") && !lin) o.disabled = true; });

const ALIAS = { ISTI: "IST", ISPPPI: "ISDP", EAAS: "USM", BAR: "HEM", CGLH: "CG/LH", "THE CODE": "CODE", WADC: "CODE" };
async function tryJump(text) {
  const m = text.match(/^(?:ISL\s+)?(?:TD\s*)?([A-Za-z][A-Za-z/]*(?:\s?\d\d)?)\s+(?:Art(?:icle)?\.?\s*)?([A-Z]?\.?\d+(?:\.\d+)*|Annex\s+[A-Z])$/i);
  if (!m) return false;
  let key = m[1].toUpperCase().replace(/\s+/g, "");
  key = ALIAS[key] || key;
  const jump = await (await fetch(base + "/assets/jump.json")).json();
  const d = jump[key];
  if (!d) return false;
  const num = m[2].replace(/^Annex\s+/i, "");
  const cands = [/^[A-Z]$/i.test(num) ? "annex-" + num.toLowerCase() : null,
    "art-" + num, "annex-" + num.toLowerCase()].filter(Boolean);
  let parts = num.split(".");
  while (parts.length) { cands.push("art-" + parts.join(".")); parts = parts.slice(0, -1); }
  const hit = cands.find(a => d.anchors.includes(a));
  if (!hit) return false;
  location.href = base + d.url + "#" + hit;
  return true;
}

function filters() {
  if (scope === "edition" && ed) return { edition: ed };
  if (scope === "document" && lin) return { lineage: lin };
  if (scope === "current") return { status: "current" };
  return {};
}

(async () => {
  if (!q) { out.innerHTML = "<p>Enter a search term above.</p>"; return; }
  if (await tryJump(q)) return;
  const labels = { edition: "this edition of " + lin, document: "all editions of " + lin, current: "all current documents", all: "all documents, all editions" };
  // "quoted text" = exact phrase: Pagefind finds pages with all the words, then we keep only
  // pages where the words occur consecutively and show each occurrence with its article link
  const phrases = [...q.matchAll(/["“”„]([^"“”„]+)["“”„]/g)].map(m => m[1].trim()).filter(Boolean);
  const words = q.replace(/["“”„*]/g, " ").trim();
  note.textContent = "Searching " + (labels[scope] || "all documents") + " for " +
    (phrases.length ? "the exact phrase " + phrases.map(p => "“" + p + "”").join(" and ") : "“" + q + "”") + ".";
  const pagefind = await import(base + "/pagefind/pagefind.js");
  await pagefind.options({ baseUrl: base + "/" });
  const res = await pagefind.search(words, { filters: filters() });
  if (!res.results.length) { out.innerHTML = "<p>No results.</p>"; return; }
  if (phrases.length) return phraseResults(res.results, phrases);
  out.innerHTML = "<p class='muted'>" + res.results.length + " document(s) found. Put words in quotes to search for an exact phrase.</p>";
  for (const r of res.results.slice(0, 40)) {
    const d = await r.data();
    const div = document.createElement("div"); div.className = "result";
    const subs = (d.sub_results || []).slice(0, 4).map(s =>
      `<div class="sub"><a href="${s.url}">${s.title}</a> – ${s.excerpt}</div>`).join("");
    div.innerHTML = `<div><a href="${d.url}"><strong>${d.meta.title || d.url}</strong></a></div>
      <div class="meta">${d.filters.type || ""} · edition ${d.meta.edition || ""} · ${(d.filters.status || [""])[0]}</div>
      ${subs || `<div class="sub">${d.excerpt}</div>`}`;
    out.append(div);
  }
})();

const norm = w => w.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, "");
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// word positions (in the page's content words) of every occurrence of a phrase
function findPhrase(tokens, phrase) {
  const p = phrase.split(/\s+/).map(w => (norm(w) + (w.endsWith("*") ? "*" : ""))).filter(w => w && w !== "*");
  const idx = [], words = [];                     // non-empty normalised tokens with their positions
  tokens.forEach((t, i) => { const n = norm(t); if (n) { idx.push(i); words.push(n); } });
  const hits = [];
  for (let i = 0; i + p.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length && ok; j++) {
      const w = words[i + j], q = p[j];
      // last word may be a prefix ("failure" matches "failures") only if the user typed a *
      ok = w === q || (q.endsWith("*") && w.startsWith(q.slice(0, -1)));
    }
    if (ok) hits.push([idx[i], idx[i + p.length - 1]]);
  }
  return hits;
}

async function phraseResults(results, phrases) {
  out.innerHTML = "<p class='muted'>Checking " + results.length + " page(s) for the exact phrase…</p>";
  const found = [];
  for (const r of results) {
    const d = await r.data();
    const tokens = d.content.split(/\s+/);
    // every phrase must occur; occurrences of the first phrase are listed
    const all = phrases.map(p => findPhrase(tokens, p));
    if (all.some(h => !h.length)) continue;
    found.push({ d, tokens, hits: all[0] });
  }
  if (!found.length) { out.innerHTML = "<p>No page contains the exact phrase.</p>"; return; }
  const n = found.reduce((a, f) => a + f.hits.length, 0);
  out.innerHTML = `<p class='muted'>${n} occurrence(s) in ${found.length} document(s).</p>`;
  for (const { d, tokens, hits } of found) {
    // nearest preceding article/annex/definition anchor and page label for each occurrence
    // (Pagefind lists every element with an id and its word position in d.anchors)
    const anchors = (d.anchors || []).filter(a => a.location != null).sort((a, b) => a.location - b.location);
    const pageUrl = d.url.split("#")[0];
    // annex-b → Annex B; annex-b.1.1 → Annex B, B.1.1; annex-b-2.1 → Annex B, 2.1
    const label = id => id.replace(/^art-/, "Art. ")
      .replace(/^(annex|appendix)-([a-z0-9]+)(?:([.-])(.+))?$/, (m, k, x, sep, r) => {
        const X = x.toUpperCase();
        return (k === "annex" ? "Annex " : "Appendix ") + X + (r ? ", " + (sep === "." ? X + "." + r : r) : "");
      })
      .replace(/^def-/, "Definition: ").replace(/^code-/, "Code Art. ").replace(/^comment-/, "Comment to ")
      .replace(/^part-/, "Part ");
    const items = hits.slice(0, 8).map(([s, e]) => {
      let prov = null, pg = null;
      for (const a of anchors) {
        if (a.location > s) break;
        if (/^p-\d+$/.test(a.id)) pg = a; else if (/^(art|annex|appendix|def|code|comment|part)-/.test(a.id)) prov = a;
      }
      const ctx = esc(tokens.slice(Math.max(0, s - 14), s).join(" ")) + " <mark>" +
        esc(tokens.slice(s, e + 1).join(" ")) + "</mark> " + esc(tokens.slice(e + 1, e + 15).join(" "));
      const target = prov || pg;
      const link = target ? `<a href="${pageUrl}#${target.id}">${esc(prov ? label(prov.id) : "")}${prov && pg ? ", " : ""}${pg ? "p. " + pg.id.slice(2) : ""}</a> – ` : "";
      return `<div class="sub">${link}…${ctx}…</div>`;
    }).join("");
    const more = hits.length > 8 ? `<div class="sub muted">… ${hits.length - 8} more occurrence(s) in this document</div>` : "";
    const div = document.createElement("div"); div.className = "result";
    div.innerHTML = `<div><a href="${d.url}"><strong>${esc(d.meta.title || d.url)}</strong></a> <span class="muted">(${hits.length})</span></div>
      <div class="meta">${d.filters.type || ""} · edition ${d.meta.edition || ""} · ${(d.filters.status || [""])[0]}</div>${items}${more}`;
    out.append(div);
  }
}
