// Prohibited List 2027 table: filters, search, expandable rows. Data: ./data.json (built by pltable.py).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const tbody = document.querySelector("#pl-table tbody");
  if (!tbody) return;
  const PAGE = 150;
  let data = null, shown = PAGE, filtered = [];

  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fold = (s) => String(s || "").toLowerCase().normalize("NFKC")
    .replace(/ß/g, "β").replace(/ɑ/g, "α").replace(/[‐‑‒–—−]/g, "-").replace(/[’′]/g, "'")
    .replace(/α/g, "alpha").replace(/β/g, "beta").replace(/δ/g, "delta").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c));
  const key = (s) => fold(s).replace(/[\s\-'(),\[\]]/g, "");
  const val = (v, basis, link) => {
    if (!v) return "";
    const cls = basis === "implicit" ? ' class="impl"' : "";
    return link ? `<a${cls} href="${esc(link)}">${esc(v)}</a>` : `<span${cls}>${esc(v)}</span>`;
  };
  const catShort = (c) => c
    .replace("Not listed in TD ATP for this matrix", "Not in TD ATP (matrix)");
  const catClass = (c) => c.startsWith("Routine") || c.startsWith("Mandatory") ? "c-mand" :
    c.startsWith("Special analysis (all") ? "c-add" : c.startsWith("Special analysis (some") ? "c-opt" : "c-none";

  // TD/TL notes that apply to this row's matrix (TLs are written for urine; '' = all matrices)
  const notesFor = (r) => (data.notes[r.id] || []).filter((n) => !r.matrix || !n.matrices || n.matrices.split("; ").includes(r.matrix));

  function fillSelect(id, values) {
    const s = $(id);
    [...new Set(values.filter(Boolean))].sort().forEach((v) => s.insertAdjacentHTML("beforeend", `<option>${esc(v)}</option>`));
  }

  function rowsAll() {
    const r = data.rows.slice();
    if ($("pl-np").checked) {
      data.np.forEach((n) => r.push({ ...n, matrix: "", atp_category: n.listed_as,
        atp_basis: "", np: true }));
    }
    return r;
  }

  function apply() {
    const q = key($("pl-q").value);
    const f = { cls: $("pl-class").value, proh: $("pl-proh").value, mat: $("pl-matrix").value, atp: $("pl-atp").value,
      basis: $("pl-basis").value, lim: $("pl-limit").value, tag: $("pl-tag").value };
    filtered = rowsAll().filter((r) =>
      (!q || r._k.includes(q)) && (!f.cls || r.group_code === f.cls) && (!f.proh || r.prohibition === f.proh) &&
      (!f.mat || r.matrix === f.mat) && (!f.atp || r.atp_category === f.atp) && (!f.basis || r.atp_basis === f.basis) &&
      (!f.lim || r[f.lim]) && (!f.tag || (r.tdtl_tags || "").split("; ").includes(f.tag)));
    shown = PAGE;
    render();
    try { localStorage.setItem("pl-filters", JSON.stringify({ q: $("pl-q").value, ...f, np: $("pl-np").checked })); } catch (e) { /* storage unavailable */ }
  }

  function render() {
    const subs = new Set(filtered.map((r) => r.id)).size;
    $("pl-count").textContent = `${filtered.length} rows · ${subs} substances/methods`;
    tbody.innerHTML = filtered.slice(0, shown).map((r, i) => {
      const m = data.meta[r.id] || {};
      const notes = notesFor(r);
      const sec = [r.group_code, r.subsubgroup_code || r.subgroup_code].filter(Boolean).join(" · ");
      return `<tr class="pl-row${r.np ? " np" : ""}" data-i="${i}">
        <td><button class="pl-open" aria-expanded="false" title="Details">▸</button> <b>${esc(r.substance)}</b>
          ${r.aliases ? `<div class="pl-al">${esc(r.aliases)}</div>` : ""}
          ${m.parent ? `<div class="pl-al">in: ${esc(m.parent)}</div>` : ""}</td>
        <td><a href="${esc(r.list_link)}">${esc(sec)}</a></td>
        <td>${esc(r.prohibition)}${r.specified ? `<div class="pl-al">${esc(r.specified)}</div>` : ""}${m.soa ? '<div class="pl-al">Substance of Abuse</div>' : ""}</td>
        <td>${esc(r.matrix)}</td>
        <td><span class="cat ${catClass(r.atp_category || "")}">${esc(catShort(r.atp_category || ""))}</span>
          ${r.atp_basis ? `<span class="${r.atp_basis === "implicit" ? "impl" : "expl"}"> ${esc(r.atp_basis)}</span>` : ""}
          ${r.wada_specific ? '<div class="pl-al">WADA-specific ATP</div>' : ""}</td>
        <td>${esc(r.analysis_type)}</td>
        <td>${val(r.mrpl, r.mrpl_basis, r.mrpl_link)}</td>
        <td>${val(r.mrl, r.mrl_basis, r.mrl_link)}</td>
        <td>${val(r.dl, r.dl_basis, r.dl_link)}</td>
        <td>${notes.map((n) => `<a href="${esc(n.link)}" title="${esc(n.title)}">${esc(n.doc)}</a>`).join(", ")}</td>
      </tr>`;
    }).join("");
    $("pl-more").hidden = filtered.length <= shown;
  }

  function details(r) {
    const notes = notesFor(r);
    const m = data.meta[r.id] || {};
    const li = (label, v) => v ? `<li><b>${label}:</b> ${esc(v)}</li>` : "";
    return `<tr class="pl-det"><td colspan="10"><ul>
      ${li("List comments", r.list_comments)}${li("Sports (P1)", m.sports)}
      ${li("ATP entries", r.atp_all)}${li("ATP conditions", r.atp_conditions)}${li("ATP target analyte", r.target_analyte)}
      ${li("ATP: link to substance", r.atp_via)}${li("MRPL target", r.mrpl_target)}${li("MRL target", r.mrl_target)}${li("DL target", r.dl_target)}${li("MRPL note", r.mrpl_note)}${li("MRL note", r.mrl_note)}${li("DL note", r.dl_note)}
      ${r.atp_link ? `<li><a href="${esc(r.atp_link)}">TD ATP table</a> · <a href="${esc(r.list_link)}">List section</a>${m.pdf ? ` · <a href="${esc(m.pdf)}">WADA PDF p. ${esc(m.page)}</a>` : ""}</li>` : ""}
      </ul>${notes.map((n) => `<div class="pl-note"><a href="${esc(n.link)}">${esc(n.doc)}</a> <span class="muted">${esc(n.title)}</span>
        <span class="pl-tags">${esc(n.tags)}${n.basis === "implicit" ? " · implicit" : ""}${n.matrices ? " · " + esc(n.matrices) : ""}</span><p>${esc(n.note)}</p></div>`).join("")}
    </td></tr>`;
  }

  tbody.addEventListener("click", (e) => {
    const b = e.target.closest(".pl-open");
    if (!b) return;
    const tr = b.closest("tr");
    const next = tr.nextElementSibling;
    if (next && next.classList.contains("pl-det")) { next.remove(); b.textContent = "▸"; b.setAttribute("aria-expanded", "false"); return; }
    tr.insertAdjacentHTML("afterend", details(filtered[+tr.dataset.i]));
    b.textContent = "▾"; b.setAttribute("aria-expanded", "true");
  });
  $("pl-more").addEventListener("click", () => { shown += PAGE; render(); });
  $("pl-reset").addEventListener("click", () => {
    document.querySelectorAll(".pl-filters select").forEach((s) => (s.value = ""));
    $("pl-q").value = ""; $("pl-np").checked = false; apply();
  });
  document.querySelectorAll(".pl-filters select, #pl-np").forEach((el) => el.addEventListener("change", apply));
  let t = null;
  $("pl-q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 150); });

  fetch("data.json").then((r) => r.json()).then((d) => {
    data = d;
    const prep = (r) => { r._k = key([r.substance, r.aliases, (data.meta[r.id] || {}).parent, r.target_analyte].join(" ")); };
    data.rows.forEach(prep); data.np.forEach(prep);
    fillSelect("pl-class", data.rows.map((r) => r.group_code));
    fillSelect("pl-proh", data.rows.map((r) => r.prohibition));
    fillSelect("pl-matrix", data.rows.map((r) => r.matrix));
    fillSelect("pl-atp", data.rows.map((r) => r.atp_category));
    fillSelect("pl-tag", data.rows.flatMap((r) => (r.tdtl_tags || "").split("; ")));
    const qs = new URLSearchParams(location.search);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("pl-filters") || "{}"); } catch (e) { /* storage unavailable */ }
    if (qs.get("q")) saved = { q: qs.get("q") };
    $("pl-q").value = saved.q || "";
    [["pl-class", "cls"], ["pl-proh", "proh"], ["pl-matrix", "mat"], ["pl-atp", "atp"], ["pl-basis", "basis"],
     ["pl-limit", "lim"], ["pl-tag", "tag"]].forEach(([id, k]) => { if (saved[k]) $(id).value = saved[k]; });
    $("pl-np").checked = !!saved.np;
    apply();
    if (qs.get("open")) {                       // deep link: ?q=salbutamol&open=1 expands the first row
      const b = tbody.querySelector(".pl-open");
      if (b) b.click();
    }
  }).catch(() => { $("pl-count").textContent = "The table data could not be loaded."; });
})();
