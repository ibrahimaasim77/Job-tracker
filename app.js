// ── Firebase ────────────────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyBaVwMsUvOZN1K3o6I8GDaHlyvnNtMAP9c",
  authDomain: "job-t-2dbe8.firebaseapp.com",
  databaseURL: "https://job-t-2dbe8-default-rtdb.firebaseio.com",
  projectId: "job-t-2dbe8",
  storageBucket: "job-t-2dbe8.firebasestorage.app",
  messagingSenderId: "719925891210",
  appId: "1:719925891210:web:1a7dd86ab448dadc4cdd73"
});
const db = firebase.database();
const COL = db.ref("applications");

// ── Constants ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  { id:"company",  label:"Company",   q:"What company is this?",              type:"text" },
  { id:"role",     label:"Role",      q:"What's the job title?",              type:"text" },
  { id:"location", label:"Location",  q:"Where is this role?",
    choices:["Remote","Hybrid","Bay Area, CA","Seattle, WA","New York, NY","Austin, TX","Los Angeles, CA","Other"] },
  { id:"type",     label:"Role type", q:"What category fits best?",
    choices:["SWE","ML / AI","Data","PM","Design","Research","Fintech","Other"] },
  { id:"status",   label:"Status",    q:"Current status on this one?",
    choices:["Wishlist","Applied","OA Received","Phone Screen","Interviewing","Offer","Rejected","Withdrawn"] },
  { id:"priority", label:"Priority",  q:"How excited are you about this role?",
    choices:["High","Medium","Low"] },
  { id:"salary",   label:"Salary",    q:"Any pay info in the posting?",
    choices:["Not listed","< $25/hr","$25–35/hr","$35–50/hr","> $50/hr","$5–7k/mo","$7–10k/mo","> $10k/mo"] },
  { id:"notes",    label:"Notes",     q:"Quick notes? (optional)",            type:"notes" },
];

const STATUS_CLASSES = {
  "Wishlist":"b-wish", "Applied":"b-applied", "OA Received":"b-oa",
  "Phone Screen":"b-phone", "Interviewing":"b-interview", "Offer":"b-offer",
  "Rejected":"b-rejected", "Withdrawn":"b-withdrawn"
};

// ── State ────────────────────────────────────────────────────────────────────
let answers = {}, prefilled = {};
let rows = [];

// ── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll(".tab").forEach((t,i) => t.classList.toggle("active", ["add","log","dash"][i]===id));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.getElementById("tab-"+id).classList.add("active");
  if (id === "dash") renderDash();
  if (id === "log") renderLog();
  updateHeader();
}

// ── Add Application ──────────────────────────────────────────────────────────
async function fetchAndQuiz() {
  const url = document.getElementById("urlInput").value.trim();
  if (!url) { setStatus("Paste a URL first.", "err"); return; }
  const btn = document.getElementById("analyzeBtn");
  btn.disabled = true; btn.textContent = "Analyzing…";
  setStatus("Fetching posting details…", "");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 600,
        system: `Extract job posting details from the URL provided. Return ONLY valid JSON with keys: company, role, location, type, salary, notes.
- location: city/state or "Remote" or "Hybrid"
- type: SWE / ML / AI / Data / PM / Design / Research / Fintech / Other
- salary: text from posting or "Not listed"
- notes: one concise sentence, or ""
If URL is inaccessible, infer from URL string. No markdown, just JSON.`,
        messages: [{ role: "user", content: `URL: ${url}` }]
      })
    });
    const data = await res.json();
    const raw = data.content?.find(b => b.type === "text")?.text || "{}";
    try { prefilled = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
    catch(e) { prefilled = {}; }
    setStatus("Details extracted — confirm below.", "ok");
  } catch(e) {
    setStatus("Couldn't fetch — fill in manually.", "err");
    prefilled = {};
  }

  btn.disabled = false; btn.textContent = "Analyze ↗";
  buildQuiz();
}

function buildQuiz() {
  answers = {};
  const c = document.getElementById("qContainer");
  c.innerHTML = "";
  QUESTIONS.forEach((q, qi) => {
    const div = document.createElement("div");
    div.className = "q-card";
    let html = `<div class="q-meta">${q.label} &nbsp;·&nbsp; ${qi+1}/${QUESTIONS.length}</div>`;
    html += `<div class="q-text">${q.q}</div>`;
    if (q.type === "text") {
      const v = prefilled[q.id] || "";
      if (v) answers[q.id] = v;
      html += `<input class="text-input" id="ti-${q.id}" value="${v}" placeholder="Type here…"
        oninput="answers['${q.id}']=this.value;updateProg();" />`;
    } else if (q.type === "notes") {
      const v = prefilled.notes || "";
      html += `<textarea class="text-input" id="ti-${q.id}" rows="2" placeholder="Optional…"
        oninput="answers['${q.id}']=this.value;" style="resize:vertical;">${v}</textarea>`;
    } else {
      let choices = [...q.choices];
      const pre = prefilled[q.id];
      if (pre && !choices.find(c => c.toLowerCase() === pre.toLowerCase())) choices.push(pre);
      html += `<div class="choices" id="ch-${q.id}">`;
      choices.forEach(ch => {
        const isSel = pre && ch.toLowerCase() === pre.toLowerCase();
        if (isSel) answers[q.id] = ch;
        html += `<button class="choice${isSel?" sel":""}" onclick="pick('${q.id}',this,'${ch.replace(/'/g,"&#39;")}')">${ch}</button>`;
      });
      html += `<button class="choice" onclick="toggleOther('${q.id}',this)">Other…</button></div>`;
      html += `<div class="other-wrap" id="ow-${q.id}"><input class="text-input" placeholder="Type custom value…"
        oninput="answers['${q.id}']=this.value;updateProg();" /></div>`;
    }
    div.innerHTML = html;
    c.appendChild(div);
  });
  document.getElementById("quizWrap").style.display = "block";
  updateProg();
}

function pick(id, btn, val) {
  answers[id] = val;
  document.querySelectorAll(`#ch-${id} .choice`).forEach(b => { b.classList.remove("sel","dim"); b.classList.add("dim"); });
  btn.classList.remove("dim"); btn.classList.add("sel");
  document.getElementById(`ow-${id}`).style.display = "none";
  updateProg();
}

function toggleOther(id, btn) {
  const ow = document.getElementById(`ow-${id}`);
  const open = ow.style.display === "block";
  document.querySelectorAll(`#ch-${id} .choice`).forEach(b => b.classList.remove("sel","dim"));
  if (!open) { ow.style.display = "block"; btn.classList.add("sel"); delete answers[id]; }
  else { ow.style.display = "none"; }
  updateProg();
}

function updateProg() {
  let filled = 0;
  QUESTIONS.forEach(q => {
    if (q.type === "notes") { filled++; return; }
    const ti = document.getElementById(`ti-${q.id}`);
    if (ti && ti.value.trim()) { filled++; return; }
    if (answers[q.id]) filled++;
  });
  const pct = Math.round(filled / (QUESTIONS.length - 1) * 100);
  document.getElementById("progFill").style.width = Math.min(pct, 100) + "%";
}

function getVal(id) {
  const ti = document.getElementById(`ti-${id}`);
  if (ti) return ti.value.trim();
  return answers[id] || "";
}

async function addToLog() {
  const company = getVal("company");
  if (!company) { setStatus("At least fill in the company name.", "err"); return; }
  const row = {
    id: Date.now(),
    company,
    role: getVal("role") || "—",
    location: getVal("location") || "—",
    type: getVal("type") || "—",
    status: getVal("status") || "Wishlist",
    priority: getVal("priority") || "Medium",
    salary: getVal("salary") || "Not listed",
    notes: getVal("notes") || "",
    date: new Date().toISOString().split("T")[0],
    url: document.getElementById("urlInput").value.trim(),
  };
  await COL.push(row);
  toast(`Saved: ${row.company}`);
  setStatus("", "");
  resetQuiz();
}

async function deleteRow(id) {
  await db.ref("applications/" + id).remove();
}

function resetQuiz() {
  document.getElementById("urlInput").value = "";
  document.getElementById("quizWrap").style.display = "none";
  document.getElementById("qContainer").innerHTML = "";
  answers = {}; prefilled = {};
  setStatus("", "");
}

function setStatus(msg, type) {
  const el = document.getElementById("statusLine");
  el.textContent = msg;
  el.className = "status-line" + (type ? " " + type : "");
}

// ── Log ──────────────────────────────────────────────────────────────────────
function renderLog() {
  const tbody = document.getElementById("logBody");
  document.getElementById("logTitle").textContent = `Applications (${rows.length})`;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty"><span>📋</span>No applications yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="td-company">${r.company}</td>
      <td class="td-role">${r.role}</td>
      <td>${r.location}</td>
      <td>${r.type}</td>
      <td><span class="badge ${STATUS_CLASSES[r.status]||"b-wish"}">${r.status}</span></td>
      <td style="color:${r.priority==='High'?'var(--red)':r.priority==='Medium'?'var(--amber)':'var(--text3)'};font-size:12px;">${r.priority}</td>
      <td style="font-family:var(--mono);font-size:12px;">${r.date}</td>
      <td style="font-size:12px;max-width:160px;">${r.notes}</td>
      <td><button class="del-btn" onclick="deleteRow('${r._key}')" title="Remove">×</button></td>
    </tr>`).join("");
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function renderDash() {
  const total    = rows.filter(r => !["Wishlist"].includes(r.status)).length;
  const active   = rows.filter(r => ["OA Received","Phone Screen","Interviewing"].includes(r.status)).length;
  const offers   = rows.filter(r => r.status === "Offer").length;
  const rejected = rows.filter(r => r.status === "Rejected").length;
  document.getElementById("dTotal").textContent    = total;
  document.getElementById("dActive").textContent   = active;
  document.getElementById("dOffers").textContent   = offers;
  document.getElementById("dRejected").textContent = rejected;

  const statuses = ["Wishlist","Applied","OA Received","Phone Screen","Interviewing","Offer","Rejected","Withdrawn"];
  const max = Math.max(...statuses.map(s => rows.filter(r => r.status === s).length), 1);
  document.getElementById("sbBreakdown").innerHTML = statuses.map(s => {
    const cnt = rows.filter(r => r.status === s).length;
    const pct = Math.round(cnt / max * 100);
    return `<div class="sb-row">
      <span class="sb-label"><span class="badge ${STATUS_CLASSES[s]||"b-wish"}" style="margin-right:8px;">${s}</span></span>
      <div class="sb-bar-wrap"><div class="sb-bar" style="width:${pct}%"></div></div>
      <span class="sb-count">${cnt}</span>
    </div>`;
  }).join("");
}

// ── Header ───────────────────────────────────────────────────────────────────
function updateHeader() {
  const total  = rows.length;
  const active = rows.filter(r => ["OA Received","Phone Screen","Interviewing"].includes(r.status)).length;
  const offers = rows.filter(r => r.status === "Offer").length;
  document.getElementById("hTotal").textContent  = total;
  document.getElementById("hActive").textContent = active;
  document.getElementById("hOffers").textContent = offers;
  document.getElementById("logTitle").textContent = `Applications (${total})`;
}

// ── Export ───────────────────────────────────────────────────────────────────
function getExportData() {
  return [
    ["Company","Role / Position","Location","Type","Source / Link","Date Applied","Status","Priority","Salary Est.","Notes"],
    ...rows.map(r => [r.company, r.role, r.location, r.type, r.url, r.date, r.status, r.priority, r.salary, r.notes])
  ];
}

function exportCSV() {
  const csv = getExportData().map(r => r.map(v => `"${String(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
  dl(new Blob([csv], { type:"text/csv" }), "internship_log.csv");
}

function exportXLSX() {
  const ws = XLSX.utils.aoa_to_sheet(getExportData());
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Applications");
  XLSX.writeFile(wb, "internship_log.xlsx");
}

function copyForExcel() {
  const text = rows.map(r => [r.company,r.role,r.location,r.type,r.url,r.date,r.status,r.priority,r.salary,r.notes].join("\t")).join("\n");
  navigator.clipboard.writeText(text).then(() => toast("Copied! Paste into your tracker spreadsheet."));
}

function dl(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

// ── Firebase real-time listener ──────────────────────────────────────────────
COL.on("value", snap => {
  const val = snap.val() || {};
  rows = Object.entries(val).map(([key, data]) => ({ ...data, _key: key }));
  rows.sort((a, b) => b.id - a.id);
  updateHeader();
  if (document.getElementById("tab-log").classList.contains("active")) renderLog();
  if (document.getElementById("tab-dash").classList.contains("active")) renderDash();
});
