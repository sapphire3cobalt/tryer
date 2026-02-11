const STORAGE_KEY = "eu_cop_watchdog_v1";

const companies = [
  "OpenAI",
  "Anthropic",
  "Google DeepMind",
  "Meta",
  "xAI",
  "Mistral",
];

const commitments = [
  {
    id: "3.1",
    title: "Maintain a documented systemic-risk governance framework.",
  },
  {
    id: "3.2",
    title: "Define and test clear risk thresholds for severe misuse and loss-of-control scenarios.",
  },
  {
    id: "3.3",
    title: "Conduct pre-deployment evaluations including adversarial stress testing.",
  },
  {
    id: "3.4",
    title: "Use state-of-the-art risk estimation methods for probability and severity of systemic risks.",
  },
  {
    id: "3.5",
    title: "Implement robust post-deployment monitoring and incident reporting channels.",
  },
  {
    id: "3.6",
    title: "Apply proportionate cybersecurity controls and model-weight protection.",
  },
  {
    id: "3.7",
    title: "Maintain secure disclosure and coordinated vulnerability handling processes.",
  },
  {
    id: "3.8",
    title: "Commit to independent review, documentation transparency, and regulator cooperation.",
  },
];

const statuses = [
  { value: "not_assessed", label: "Not assessed", score: 0 },
  { value: "non_compliant", label: "Non-compliant", score: 0 },
  { value: "partial", label: "Partial", score: 0.4 },
  { value: "substantial", label: "Substantial", score: 0.75 },
  { value: "compliant", label: "Compliant", score: 1 },
];

const statusLookup = Object.fromEntries(statuses.map((s) => [s.value, s]));
const allPairs = commitments.flatMap((c) => companies.map((company) => ({ id: c.id, company })));

const state = loadState();

const nodes = {
  kpis: document.getElementById("kpis"),
  companyFilter: document.getElementById("companyFilter"),
  statusFilter: document.getElementById("statusFilter"),
  commitmentFilter: document.getElementById("commitmentFilter"),
  matrixTable: document.getElementById("matrixTable"),
  detailCompany: document.getElementById("detailCompany"),
  detailCommitment: document.getElementById("detailCommitment"),
  severity: document.getElementById("severity"),
  probability: document.getElementById("probability"),
  evidence: document.getElementById("evidence"),
  gapNotes: document.getElementById("gapNotes"),
  nextActions: document.getElementById("nextActions"),
  gapForm: document.getElementById("gapForm"),
  alerts: document.getElementById("alerts"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
};

function loadState() {
  const base = {
    ratings: Object.fromEntries(allPairs.map((p) => [`${p.company}|${p.id}`, "not_assessed"])),
    notes: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      ratings: { ...base.ratings, ...(parsed.ratings || {}) },
      notes: parsed.notes || {},
    };
  } catch {
    return base;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pairKey(company, commitmentId) {
  return `${company}|${commitmentId}`;
}

function scoreFromStatus(status) {
  return statusLookup[status]?.score ?? 0;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function fillSelectors() {
  const companyOptions = ['<option value="all">All companies</option>']
    .concat(companies.map((c) => `<option value="${c}">${c}</option>`))
    .join("");
  nodes.companyFilter.innerHTML = companyOptions;

  nodes.detailCompany.innerHTML = companies
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");

  nodes.detailCommitment.innerHTML = commitments
    .map((c) => `<option value="${c.id}">${c.id} — ${c.title}</option>`)
    .join("");

  nodes.statusFilter.innerHTML += statuses
    .map((s) => `<option value="${s.value}">${s.label}</option>`)
    .join("");
}

function renderKpis() {
  const ratings = Object.values(state.ratings);
  const avg = ratings.reduce((sum, st) => sum + scoreFromStatus(st), 0) / ratings.length;
  const assessed = ratings.filter((st) => st !== "not_assessed").length;

  const worstCompany = companies
    .map((company) => {
      const vals = commitments.map((c) => scoreFromStatus(state.ratings[pairKey(company, c.id)]));
      return { company, score: vals.reduce((a, b) => a + b, 0) / vals.length };
    })
    .sort((a, b) => a.score - b.score)[0];

  const alerts = highRiskNotes();

  nodes.kpis.innerHTML = `
    <article class="kpi"><span>Overall compliance</span><strong>${percent(avg)}</strong></article>
    <article class="kpi"><span>Assessed commitments</span><strong>${assessed}/${ratings.length}</strong></article>
    <article class="kpi"><span>Lowest scoring company</span><strong>${worstCompany.company}</strong><small>${percent(worstCompany.score)}</small></article>
    <article class="kpi"><span>Priority alerts</span><strong>${alerts.length}</strong></article>
  `;
}

function renderMatrix() {
  const companyFilter = nodes.companyFilter.value;
  const statusFilter = nodes.statusFilter.value;
  const commitmentFilter = nodes.commitmentFilter.value.trim().toLowerCase();
  const visibleCompanies = companyFilter === "all" ? companies : [companyFilter];

  const head = `
    <thead>
      <tr>
        <th class="commitment-title">Commitment</th>
        ${visibleCompanies.map((c) => `<th>${c}</th>`).join("")}
      </tr>
    </thead>
  `;

  const bodyRows = commitments
    .filter((c) => !commitmentFilter || c.id.toLowerCase().includes(commitmentFilter))
    .map((commitment) => {
      const cells = visibleCompanies
        .map((company) => {
          const key = pairKey(company, commitment.id);
          const current = state.ratings[key];
          if (statusFilter !== "all" && current !== statusFilter) {
            return "";
          }

          return `
            <td>
              <select class="status-pill status-${current}" data-company="${company}" data-commitment="${commitment.id}">
                ${statuses
                  .map(
                    (s) =>
                      `<option value="${s.value}" ${current === s.value ? "selected" : ""}>${s.label}</option>`
                  )
                  .join("")}
              </select>
            </td>
          `;
        })
        .join("");

      if (!cells.trim()) return "";

      return `
        <tr>
          <th>
            <strong>${commitment.id}</strong><br />
            <small>${commitment.title}</small>
          </th>
          ${cells}
        </tr>
      `;
    })
    .join("");

  nodes.matrixTable.innerHTML = `${head}<tbody>${bodyRows || '<tr><td colspan="100">No rows match current filters.</td></tr>'}</tbody>`;

  nodes.matrixTable.querySelectorAll(".status-pill").forEach((select) => {
    select.addEventListener("change", (event) => {
      const company = event.target.dataset.company;
      const commitmentId = event.target.dataset.commitment;
      state.ratings[pairKey(company, commitmentId)] = event.target.value;
      event.target.className = `status-pill status-${event.target.value}`;
      saveState();
      renderAll();
    });
  });
}

function loadGapDetail() {
  const key = pairKey(nodes.detailCompany.value, nodes.detailCommitment.value);
  const note = state.notes[key] || {
    severity: 0,
    probability: 0,
    evidence: "",
    notes: "",
    actions: "",
  };

  nodes.severity.value = note.severity;
  nodes.probability.value = note.probability;
  nodes.evidence.value = note.evidence;
  nodes.gapNotes.value = note.notes;
  nodes.nextActions.value = note.actions;
}

function highRiskNotes() {
  return Object.entries(state.notes)
    .map(([key, note]) => {
      const [company, commitmentId] = key.split("|");
      const risk = Number(note.severity || 0) * Number(note.probability || 0);
      const rating = state.ratings[key] || "not_assessed";
      return { company, commitmentId, risk, note, rating };
    })
    .filter((item) => item.risk >= 12 && item.rating !== "compliant")
    .sort((a, b) => b.risk - a.risk);
}

function renderAlerts() {
  const alerts = highRiskNotes();
  if (!alerts.length) {
    nodes.alerts.innerHTML = "<li>No high-risk unresolved gaps right now.</li>";
    return;
  }

  nodes.alerts.innerHTML = alerts
    .map(
      (a) => `
      <li class="alert">
        <strong>${a.company} — Commitment ${a.commitmentId}</strong>
        <div>Risk score: ${a.risk} · Status: ${statusLookup[a.rating]?.label}</div>
        <small>${a.note.notes || "No narrative provided yet."}</small>
      </li>
    `
    )
    .join("");
}

function wireEvents() {
  [nodes.companyFilter, nodes.statusFilter, nodes.commitmentFilter].forEach((el) => {
    el.addEventListener("input", renderMatrix);
  });

  [nodes.detailCompany, nodes.detailCommitment].forEach((el) => {
    el.addEventListener("change", loadGapDetail);
  });

  nodes.gapForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const key = pairKey(nodes.detailCompany.value, nodes.detailCommitment.value);
    state.notes[key] = {
      severity: Number(nodes.severity.value),
      probability: Number(nodes.probability.value),
      evidence: nodes.evidence.value.trim(),
      notes: nodes.gapNotes.value.trim(),
      actions: nodes.nextActions.value.trim(),
    };
    saveState();
    renderKpis();
    renderAlerts();
  });

  nodes.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eu-cop-watchdog-export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  nodes.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const incoming = JSON.parse(text);
      state.ratings = { ...state.ratings, ...(incoming.ratings || {}) };
      state.notes = incoming.notes || {};
      saveState();
      renderAll();
      loadGapDetail();
    } catch {
      alert("Invalid JSON file.");
    }

    event.target.value = "";
  });

  nodes.resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all local compliance data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

function renderAll() {
  renderKpis();
  renderMatrix();
  renderAlerts();
}

fillSelectors();
wireEvents();
renderAll();
loadGapDetail();
