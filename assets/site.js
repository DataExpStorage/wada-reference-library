// Document picker (type -> document -> edition) and edition links that keep the article anchor.
(function () {
  const base = document.body.dataset.base || "";
  const here = document.body.dataset.url || "";
  // contents list collapsed on phones (the text comes first)
  if (window.matchMedia("(max-width: 860px)").matches) document.querySelectorAll(".toc details").forEach(d => d.removeAttribute("open"));
  const kSel = document.getElementById("pick-kind"), dSel = document.getElementById("pick-doc"), eSel = document.getElementById("pick-ed");
  // keep the #anchor when switching editions via links
  document.querySelectorAll("a.keephash").forEach(a => a.addEventListener("click", ev => {
    if (location.hash) { ev.preventDefault(); location.href = a.href.split("#")[0] + location.hash; }
  }));
  fetch(base + "/assets/nav.json").then(r => r.json()).then(nav => {
    let cur = null, curKind = "code";
    for (const [k, v] of Object.entries(nav)) for (const d of v.docs) if (d.editions.some(e => e.url === here)) { cur = d; curKind = k; }
    const opt = (v, t, sel) => { const o = document.createElement("option"); o.value = v; o.textContent = t; if (sel) o.selected = true; return o; };
    function fillKinds() { kSel.innerHTML = ""; for (const [k, v] of Object.entries(nav)) kSel.append(opt(k, v.name, k === curKind)); }
    function fillDocs(kind, keep) {
      dSel.innerHTML = "";
      if (!keep) dSel.append(opt("", "— choose —", true));
      for (const d of nav[kind].docs) dSel.append(opt(d.lineage, d.lineage + " – " + d.title.slice(0, 70), keep && cur && d.lineage === cur.lineage));
    }
    function fillEds(kind, lineage) {
      eSel.innerHTML = "";
      const d = nav[kind].docs.find(x => x.lineage === lineage);
      if (!d) { eSel.append(opt("", "—", true)); return; }
      for (const e of d.editions) eSel.append(opt(e.url, e.label + (e.status === "current" ? " (current)" : ""), e.url === here));
    }
    fillKinds(); fillDocs(curKind, !!cur); fillEds(curKind, cur ? cur.lineage : "");
    kSel.onchange = () => { curKind = kSel.value; fillDocs(curKind, false); fillEds(curKind, ""); };
    dSel.onchange = () => {
      const d = nav[kSel.value].docs.find(x => x.lineage === dSel.value);
      if (d) location.href = base + d.default;
    };
    eSel.onchange = () => { if (eSel.value) location.href = base + eSel.value + location.hash; };
  });
})();
