import { useState, useCallback } from "react";

// ─── SF OData API LAYER ───────────────────────────────────────────────────────
// Replace these with your actual SF instance details
const SF_CONFIG = {
  baseUrl: "https://YOUR_INSTANCE.successfactors.com/odata/v2",
  // Auth token obtained via OAuth 2.0 client credentials flow
  // In production: fetch this from your backend proxy, never expose in frontend
  authToken: "YOUR_BEARER_TOKEN",
};

// OData entity endpoints used in recruiting
const ENTITIES = {
  jobApplication: "JobApplication",
  jobRequisition: "JobRequisition",
  candidate: "Candidate",
  jobApplicationStatus: "JobApplicationStatus",
};

// Build OData $filter string from user inputs
function buildODataFilter(filters) {
  const clauses = [];

  if (filters.expMin || filters.expMax) {
    if (filters.expMin) clauses.push(`totalYearsOfExp ge ${filters.expMin}`);
    if (filters.expMax) clauses.push(`totalYearsOfExp le ${filters.expMax}`);
  }
  if (filters.stage) clauses.push(`jobAppStatus eq '${filters.stage}'`);
  if (filters.department) clauses.push(`department eq '${filters.department}'`);
  if (filters.location) clauses.push(`contains(homeAddress, '${filters.location}')`);
  if (filters.recruiter) clauses.push(`contains(recruiterName, '${filters.recruiter}')`);
  if (filters.hiringManager) clauses.push(`contains(hiringManagerName, '${filters.hiringManager}')`);
  if (filters.skills) clauses.push(`contains(skills, '${filters.skills}')`);
  if (filters.dayRange) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(filters.dayRange));
    clauses.push(`applicationDate ge datetime'${cutoff.toISOString()}'`);
  }
  if (filters.stalledDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(filters.stalledDays));
    clauses.push(`lastModifiedDate le datetime'${cutoff.toISOString()}'`);
  }

  return clauses.length ? clauses.join(" and ") : null;
}

// Actual OData fetch — called when connected to real SF instance
async function fetchFromSF(filters) {
  const filterStr = buildODataFilter(filters);
  const params = new URLSearchParams({
    $format: "json",
    $top: "200",
    $select: [
      "candidateId", "firstName", "lastName", "currentTitle",
      "totalYearsOfExp", "jobAppStatus", "applicationDate",
      "lastModifiedDate", "department", "recruiterName",
      "hiringManagerName", "requisitionId", "jobTitle",
      "homeAddress", "skills", "offerLetterStatus"
    ].join(","),
    ...(filterStr ? { $filter: filterStr } : {}),
    $expand: "jobApplicationStatus,jobRequisition",
  });

  const url = `${SF_CONFIG.baseUrl}/${ENTITIES.jobApplication}?${params}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SF_CONFIG.authToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`SF API error: ${res.status}`);
  const data = await res.json();
  return (data.d?.results || []).map(transformSFRecord);
}

function transformSFRecord(r) {
  const appDate = new Date(r.applicationDate?.replace(/\/Date\((\d+)\)\//, (_, ms) => new Date(+ms).toISOString()));
  const lastMod = new Date(r.lastModifiedDate?.replace(/\/Date\((\d+)\)\//, (_, ms) => new Date(+ms).toISOString()));
  const daysStalled = Math.floor((Date.now() - lastMod) / 86400000);
  return {
    id: r.candidateId,
    name: `${r.firstName} ${r.lastName}`,
    title: r.currentTitle || "—",
    exp: parseFloat(r.totalYearsOfExp) || 0,
    stage: r.jobAppStatus || "—",
    appDate: appDate.toLocaleDateString("en-GB"),
    daysStalled,
    department: r.department || "—",
    recruiter: r.recruiterName || "—",
    hiringManager: r.hiringManagerName || "—",
    reqId: r.requisitionId || "—",
    jobTitle: r.jobTitle || "—",
    location: r.homeAddress || "—",
    skills: r.skills || "",
  };
}

// ─── DEMO DATA (used when SF not connected) ──────────────────────────────────
const DEMO_DATA = [
  { id: "C001", name: "Aisha Al Mansoori", title: "SAP FICO Consultant", exp: 7.5, stage: "HM Review", appDate: "14/04/2025", daysStalled: 19, department: "Finance", recruiter: "Sara Ahmed", hiringManager: "Khalid Al Nasser", reqId: "REQ-2041", jobTitle: "Senior SAP FICO Lead", location: "Dubai", skills: "SAP FICO, S/4HANA, Excel" },
  { id: "C002", name: "Rahul Verma", title: "SAP SD Senior Analyst", exp: 9.0, stage: "Phone Screen", appDate: "22/04/2025", daysStalled: 6, department: "Technology", recruiter: "Meera Patel", hiringManager: "James Liu", reqId: "REQ-1998", jobTitle: "SAP SD Specialist", location: "Riyadh", skills: "SAP SD, OTC, ABAP" },
  { id: "C003", name: "Fatima Khalil", title: "SAP HCM Specialist", exp: 6.0, stage: "Phone Screen", appDate: "25/04/2025", daysStalled: 3, department: "HR", recruiter: "Sara Ahmed", hiringManager: "Nour Ibrahim", reqId: "REQ-2055", jobTitle: "SAP HCM Consultant", location: "Abu Dhabi", skills: "SAP HCM, SuccessFactors, Payroll" },
  { id: "C004", name: "James Okonkwo", title: "SAP Basis Administrator", exp: 8.0, stage: "Offer", appDate: "10/04/2025", daysStalled: 2, department: "Technology", recruiter: "Tom Hassan", hiringManager: "James Liu", reqId: "REQ-1977", jobTitle: "SAP Basis Lead", location: "Dubai", skills: "SAP Basis, HANA, System Admin" },
  { id: "C005", name: "Sara Al Rashidi", title: "SF SuccessFactors Lead", exp: 5.5, stage: "HM Review", appDate: "08/04/2025", daysStalled: 24, department: "HR", recruiter: "Meera Patel", hiringManager: "Nour Ibrahim", reqId: "REQ-2063", jobTitle: "SF Recruiting Lead", location: "Riyadh", skills: "SuccessFactors, Recruiting, Onboarding" },
  { id: "C006", name: "Mohammed Farooq", title: "SAP PP/MM Consultant", exp: 10.0, stage: "Application Review", appDate: "28/04/2025", daysStalled: 1, department: "Operations", recruiter: "Tom Hassan", hiringManager: "Rania Saleh", reqId: "REQ-2070", jobTitle: "SAP Supply Chain Specialist", location: "Dubai", skills: "SAP PP, MM, WM, SCM" },
  { id: "C007", name: "Priya Nair", title: "SAP Integration Architect", exp: 12.0, stage: "Interview", appDate: "18/04/2025", daysStalled: 9, department: "Technology", recruiter: "Sara Ahmed", hiringManager: "James Liu", reqId: "REQ-2001", jobTitle: "SAP Integration Lead", location: "Remote", skills: "SAP PI/PO, CPI, API Management" },
  { id: "C008", name: "Omar Shaikh", title: "SAP ABAP Developer", exp: 4.5, stage: "Application Review", appDate: "29/04/2025", daysStalled: 1, department: "Technology", recruiter: "Meera Patel", hiringManager: "James Liu", reqId: "REQ-2078", jobTitle: "SAP ABAP Senior Dev", location: "Dubai", skills: "ABAP, Fiori, OData, BAPI" },
  { id: "C009", name: "Layla Bou Diab", title: "SAP GRC Consultant", exp: 7.0, stage: "HM Review", appDate: "11/04/2025", daysStalled: 16, department: "Finance", recruiter: "Tom Hassan", hiringManager: "Khalid Al Nasser", reqId: "REQ-2033", jobTitle: "SAP GRC Lead", location: "Beirut", skills: "SAP GRC, Access Control, Risk Management" },
  { id: "C010", name: "Vikram Singh", title: "SAP BW/BI Consultant", exp: 8.5, stage: "Rejected", appDate: "05/04/2025", daysStalled: 0, department: "Finance", recruiter: "Sara Ahmed", hiringManager: "Khalid Al Nasser", reqId: "REQ-1990", jobTitle: "SAP Analytics Specialist", location: "Mumbai", skills: "SAP BW, BI, Analytics Cloud" },
  { id: "C011", name: "Reem Al Zaabi", title: "SAP Payroll Specialist", exp: 5.0, stage: "Offer", appDate: "15/04/2025", daysStalled: 3, department: "HR", recruiter: "Sara Ahmed", hiringManager: "Nour Ibrahim", reqId: "REQ-2060", jobTitle: "Payroll Consultant", location: "Abu Dhabi", skills: "SAP Payroll, HCM, WA" },
  { id: "C012", name: "David Mensah", title: "SAP Project Manager", exp: 14.0, stage: "Interview", appDate: "20/04/2025", daysStalled: 7, department: "Operations", recruiter: "Tom Hassan", hiringManager: "Rania Saleh", reqId: "REQ-2045", jobTitle: "SAP Programme Manager", location: "London", skills: "SAP PM, S/4HANA, Agile, PRINCE2" },
];

function applyFilters(data, f) {
  return data.filter(c => {
    if (f.expMin && c.exp < parseFloat(f.expMin)) return false;
    if (f.expMax && c.exp > parseFloat(f.expMax)) return false;
    if (f.stage && c.stage !== f.stage) return false;
    if (f.department && c.department !== f.department) return false;
    if (f.location && !c.location.toLowerCase().includes(f.location.toLowerCase())) return false;
    if (f.recruiter && !c.recruiter.toLowerCase().includes(f.recruiter.toLowerCase())) return false;
    if (f.hiringManager && !c.hiringManager.toLowerCase().includes(f.hiringManager.toLowerCase())) return false;
    if (f.skills && !c.skills.toLowerCase().includes(f.skills.toLowerCase())) return false;
    if (f.stalledDays && c.daysStalled < parseInt(f.stalledDays)) return false;
    if (f.dayRange) {
      const days = parseInt(f.dayRange);
      const parts = c.appDate.split("/");
      const appDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      if (appDate < cutoff) return false;
    }
    return true;
  });
}

// ─── STAGE CONFIG ─────────────────────────────────────────────────────────────
const STAGE_META = {
  "Application Review": { color: "#7c3aed", bg: "#ede9fe" },
  "Phone Screen":       { color: "#1d4ed8", bg: "#dbeafe" },
  "HM Review":          { color: "#b45309", bg: "#fef3c7" },
  "Interview":          { color: "#0369a1", bg: "#e0f2fe" },
  "Offer":              { color: "#047857", bg: "#d1fae5" },
  "Hired":              { color: "#065f46", bg: "#a7f3d0" },
  "Rejected":           { color: "#9f1239", bg: "#ffe4e6" },
};

const STAGES = Object.keys(STAGE_META);
const DEPARTMENTS = ["Finance", "Technology", "HR", "Operations", "Sales"];

// ─── BLANK FILTER STATE ───────────────────────────────────────────────────────
const BLANK = {
  expMin: "", expMax: "", stage: "", department: "",
  location: "", recruiter: "", hiringManager: "",
  skills: "", stalledDays: "", dayRange: "",
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function StagePill({ stage }) {
  const meta = STAGE_META[stage] || { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span style={{
      background: meta.bg, color: meta.color,
      fontSize: 10, fontWeight: 700, padding: "3px 9px",
      borderRadius: 20, letterSpacing: "0.04em", whiteSpace: "nowrap"
    }}>{stage}</span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "16px 20px",
      border: "1px solid #f1f0f5", flex: 1
    }}>
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || "#0f172a", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ results }) {
  const stageCounts = {};
  STAGES.forEach(s => stageCounts[s] = 0);
  results.forEach(r => { if (stageCounts[r.stage] !== undefined) stageCounts[r.stage]++; });
  const max = Math.max(...Object.values(stageCounts), 1);

  return (
    <div style={{ background: "#fff", border: "1px solid #f1f0f5", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Pipeline breakdown</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 60 }}>
        {STAGES.filter(s => s !== "Rejected").map(s => {
          const count = stageCounts[s];
          const height = max > 0 ? Math.max((count / max) * 52, count > 0 ? 6 : 0) : 0;
          const meta = STAGE_META[s];
          return (
            <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? meta.color : "#d1d5db" }}>{count}</div>
              <div style={{ width: "100%", height, background: count > 0 ? meta.bg : "#f9fafb", borderRadius: 4, border: `1px solid ${count > 0 ? meta.color + "40" : "#f1f0f5"}`, transition: "height 0.4s ease" }} />
              <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center", lineHeight: 1.2, fontWeight: 500 }}>{s.split(" ")[0]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [filters, setFilters] = useState(BLANK);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sortCol, setSortCol] = useState("daysStalled");
  const [sortDir, setSortDir] = useState("desc");
  const [useLive, setUseLive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sfUrl, setSfUrl] = useState("");
  const [sfToken, setSfToken] = useState("");
  const [showConnect, setShowConnect] = useState(false);

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const runQuery = useCallback(async () => {
    setLoading(true); setError(null); setSelected(null);
    try {
      let data;
      if (useLive && connected) {
        SF_CONFIG.baseUrl = sfUrl;
        SF_CONFIG.authToken = sfToken;
        data = await fetchFromSF(filters);
      } else {
        await new Promise(r => setTimeout(r, 600));
        data = applyFilters(DEMO_DATA, filters);
      }
      const sorted = sortData(data, sortCol, sortDir);
      setResults(sorted);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [filters, useLive, connected, sfUrl, sfToken, sortCol, sortDir]);

  function sortData(data, col, dir) {
    return [...data].sort((a, b) => {
      const av = a[col], bv = b[col];
      if (typeof av === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }

  function handleSort(col) {
    const newDir = sortCol === col && sortDir === "asc" ? "desc" : "asc";
    setSortCol(col); setSortDir(newDir);
    if (results) setResults(sortData(results, col, newDir));
  }

  function exportCSV() {
    if (!results?.length) return;
    const headers = ["Name", "Title", "Experience (yrs)", "Stage", "Application Date", "Days Stalled", "Department", "Recruiter", "Hiring Manager", "Req ID", "Job Title", "Location", "Skills"];
    const rows = results.map(r => [r.name, r.title, r.exp, r.stage, r.appDate, r.daysStalled, r.department, r.recruiter, r.hiringManager, r.reqId, r.jobTitle, r.location, `"${r.skills}"`]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `sf-candidates-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  const avgExp = results?.length ? (results.reduce((s, c) => s + c.exp, 0) / results.length).toFixed(1) : null;
  const stalled = results?.filter(c => c.daysStalled > 14).length ?? null;
  const openReqs = results ? new Set(results.map(c => c.reqId)).size : null;

  const inp = {
    padding: "8px 12px", borderRadius: 8, border: "1px solid #e8e4f0",
    fontSize: 13, fontFamily: "inherit", background: "#fff",
    color: "#0f172a", outline: "none", width: "100%",
    transition: "border-color 0.15s",
  };

  const colBtn = (col, label) => (
    <span onClick={() => handleSort(col)} style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3 }}>
      {label}
      <span style={{ color: sortCol === col ? "#7c3aed" : "#d1d5db", fontSize: 10 }}>
        {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </span>
  );

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif", background: "#f7f5ff", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div style={{ background: "#0f0a2e", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>S</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.03em" }}>SF Recruit IQ</div>
            <div style={{ color: "#6d5fe6", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>SuccessFactors Query Tool</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: connected ? "#052e16" : "#1e1b4b",
            border: `1px solid ${connected ? "#16a34a" : "#3730a3"}`,
            borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 600
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#22c55e" : "#6366f1", animation: connected ? "none" : "pulse 2s infinite" }} />
            <span style={{ color: connected ? "#4ade80" : "#a5b4fc" }}>{connected ? "Live SF" : "Demo mode"}</span>
          </div>
          <button onClick={() => setShowConnect(true)} style={{
            background: "#1e1b4b", border: "1px solid #3730a3", color: "#a5b4fc",
            borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit"
          }}>Connect SF instance</button>
        </div>
      </div>

      {/* Connect modal */}
      {showConnect && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 460, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>Connect SuccessFactors</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
              Enter your SF instance URL and OAuth 2.0 bearer token. In production, route through a backend proxy — never expose tokens in a browser app.
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 5 }}>SF Instance URL</div>
              <input style={inp} placeholder="https://api.successfactors.com/odata/v2" value={sfUrl} onChange={e => setSfUrl(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 5 }}>Bearer token</div>
              <input style={inp} type="password" placeholder="Paste OAuth 2.0 token" value={sfToken} onChange={e => setSfToken(e.target.value)} />
            </div>
            <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#713f12", marginBottom: 20 }}>
              <strong>OData entities used:</strong> JobApplication, Candidate, JobRequisition, JobApplicationStatus — ensure your SF user has API read access to these.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setConnected(true); setUseLive(true); setShowConnect(false); }} style={{
                flex: 1, background: "#7c3aed", color: "#fff", border: "none",
                borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
              }}>Connect →</button>
              <button onClick={() => setShowConnect(false)} style={{
                background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151",
                borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit"
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: "#fff", width: 420, maxWidth: "95vw", height: "100%", overflowY: "auto", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", letterSpacing: "-0.03em" }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{selected.title}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}><StagePill stage={selected.stage} /></div>
            {[
              ["Requisition", `${selected.reqId} — ${selected.jobTitle}`],
              ["Department", selected.department],
              ["Experience", `${selected.exp} years`],
              ["Applied", selected.appDate],
              ["Days stalled", `${selected.daysStalled} days in current stage`],
              ["Recruiter", selected.recruiter],
              ["Hiring manager", selected.hiringManager],
              ["Location", selected.location],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
              </div>
            ))}
            {selected.skills && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Skills</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selected.skills.split(",").map(s => (
                    <span key={s} style={{ background: "#ede9fe", color: "#4c1d95", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{s.trim()}</span>
                  ))}
                </div>
              </div>
            )}
            {selected.daysStalled > 14 && (
              <div style={{ marginTop: 20, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", marginBottom: 4 }}>⚠ Bottleneck alert</div>
                <div style={{ fontSize: 12, color: "#9a3412", lineHeight: 1.6 }}>
                  This candidate has been in <strong>{selected.stage}</strong> for {selected.daysStalled} days — exceeding the 14-day threshold. Consider following up with the hiring manager.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {/* Query card */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ede9fe", marginBottom: 20, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f5f3ff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "-0.02em" }}>Candidate search</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Set filters and query your SF data in one click — no Story Report needed</div>
            </div>
            <button onClick={() => setFilters(BLANK)} style={{
              background: "none", border: "1px solid #e8e4f0", borderRadius: 8,
              padding: "6px 14px", fontSize: 12, color: "#6b7280", cursor: "pointer", fontFamily: "inherit"
            }}>Clear all</button>
          </div>

          <div style={{ padding: "20px 24px" }}>
            {/* Row 1 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Total experience (yrs)</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input style={{ ...inp, width: "50%" }} type="number" placeholder="Min" value={filters.expMin} onChange={e => set("expMin", e.target.value)} />
                  <span style={{ color: "#d1d5db", fontWeight: 700 }}>–</span>
                  <input style={{ ...inp, width: "50%" }} type="number" placeholder="Max" value={filters.expMax} onChange={e => set("expMax", e.target.value)} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Pipeline stage</div>
                <select style={inp} value={filters.stage} onChange={e => set("stage", e.target.value)}>
                  <option value="">All stages</option>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Department</div>
                <select style={inp} value={filters.department} onChange={e => set("department", e.target.value)}>
                  <option value="">All departments</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Applied within</div>
                <select style={inp} value={filters.dayRange} onChange={e => set("dayRange", e.target.value)}>
                  <option value="">Any time</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="180">Last 6 months</option>
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Skills / keywords</div>
                <input style={inp} placeholder="e.g. SAP FICO, Java, ABAP" value={filters.skills} onChange={e => set("skills", e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Location</div>
                <input style={inp} placeholder="e.g. Dubai, Riyadh" value={filters.location} onChange={e => set("location", e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Hiring manager</div>
                <input style={inp} placeholder="Name search" value={filters.hiringManager} onChange={e => set("hiringManager", e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Stalled more than (days)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input style={{ ...inp, flex: 1 }} type="number" placeholder="e.g. 14" value={filters.stalledDays} onChange={e => set("stalledDays", e.target.value)} />
                  <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>days</span>
                </div>
              </div>
            </div>

            {/* Action row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={runQuery} disabled={loading} style={{
                background: loading ? "#a5b4fc" : "#7c3aed", color: "#fff", border: "none",
                borderRadius: 10, padding: "11px 28px", fontSize: 14, fontWeight: 700,
                cursor: loading ? "default" : "pointer", fontFamily: "inherit",
                letterSpacing: "-0.01em", transition: "background 0.2s"
              }}>
                {loading ? "Querying SF..." : "Search candidates →"}
              </button>
              {results !== null && (
                <button onClick={exportCSV} style={{
                  background: "#fff", border: "1px solid #e8e4f0", color: "#374151",
                  borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit"
                }}>Export CSV</button>
              )}
              {results !== null && (
                <span style={{ fontSize: 13, color: "#7c3aed", fontWeight: 700 }}>
                  {results.length} candidate{results.length !== 1 ? "s" : ""} found
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#9f1239" }}>
            <strong>Query error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {results !== null && (
          <>
            {/* Stats row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <StatCard label="Total candidates" value={results.length} />
              <StatCard label="Avg experience" value={avgExp ? `${avgExp} yrs` : "—"} />
              <StatCard label="Bottlenecks (>14d)" value={stalled} accent={stalled > 0 ? "#dc2626" : "#0f172a"} sub="stalled in stage" />
              <StatCard label="Open requisitions" value={openReqs} />
            </div>

            {/* Funnel */}
            <FunnelBar results={results} />

            {/* Table */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f0f5", overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.8fr 1.4fr", gap: 0, padding: "10px 16px", background: "#faf9ff", borderBottom: "1px solid #f1f0f5" }}>
                {[["name", "Candidate"], ["exp", "Experience"], ["stage", "Stage"], ["daysStalled", "Stalled"], ["department", "Dept"], ["reqId", "Requisition"]].map(([col, label]) => (
                  <div key={col} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {colBtn(col, label)}
                  </div>
                ))}
              </div>

              {results.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  No candidates match your filters. Try broadening the search criteria.
                </div>
              ) : results.map((c, i) => (
                <div key={c.id} onClick={() => setSelected(c)} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.8fr 1.4fr",
                  gap: 0, padding: "12px 16px",
                  borderBottom: i < results.length - 1 ? "1px solid #f9f8ff" : "none",
                  cursor: "pointer", transition: "background 0.1s",
                  background: selected?.id === c.id ? "#faf7ff" : "transparent"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#faf7ff"}
                  onMouseLeave={e => e.currentTarget.style.background = selected?.id === c.id ? "#faf7ff" : "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", background: "#ede9fe",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, color: "#7c3aed", flexShrink: 0
                    }}>
                      {c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{c.title}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", alignSelf: "center" }}>{c.exp} yrs</div>
                  <div style={{ alignSelf: "center" }}><StagePill stage={c.stage} /></div>
                  <div style={{ fontSize: 13, fontWeight: 700, alignSelf: "center", color: c.daysStalled > 14 ? "#dc2626" : c.daysStalled > 7 ? "#d97706" : "#16a34a" }}>
                    {c.daysStalled}d {c.daysStalled > 14 ? "⚠" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>{c.department}</div>
                  <div style={{ alignSelf: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{c.reqId}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{c.jobTitle}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
              {connected ? "Data fetched from SuccessFactors OData API" : "Demo data — connect your SF instance to query live data"}
              {" · "}{results.length} records · Click any row to view full profile
            </div>
          </>
        )}

        {results === null && !loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Set your criteria, hit search</div>
            <div style={{ fontSize: 13, lineHeight: 1.8, maxWidth: 420, margin: "0 auto" }}>
              Filter by experience range, stage, skills, location, stalled days and more — results pull directly from SuccessFactors, no Story Report required.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus, select:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px #ede9fe; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
