import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  type Claim,
  type ClaimHistoryEvent,
  type ClaimType,
  claimGet,
  claimHistory,
  type TaskDto,
  type WorkflowStartReq,
  type WorkflowStartRes,
  type WorkflowState,
  wfCompleteTask,
  wfStart,
  wfState,
  wfTasksByClaim,
} from "./api";

type Role = "customer" | "expert";
type Session = { username: string; role: Role };

const SESSION_KEY = "claimsUiSession";
const DOCS_KEY = "claimDocsProvidedByClaimId"; // localStorage map: { [claimId]: boolean }
const RECENT_KEY = "recentClaims";

const CLAIM_TYPES: ClaimType[] = ["ACCIDENT", "THEFT", "FIRE", "HEALTH", "OTHER"];

const DEMO_POLICIES: Array<{ policyNumber: string; label: string; notes: string }> = [
  { policyNumber: "P-1001", label: "Standard policy (happy path)", notes: "Covers all claim types, limit 5000." },
  { policyNumber: "P-1006", label: "THEFT not covered", notes: "Same as P-1001 but excludes THEFT (demo rejection)." },
  { policyNumber: "P-1999", label: "Low coverage limit", notes: "Low limit 500 (demo LIMIT_EXCEEDED)." },
  { policyNumber: "P-0000", label: "Invalid / expired", notes: "Invalid policy (demo POLICY_INVALID)." },
];

// ---------- session helpers ----------
function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.username || !s?.role) return null;
    if (s.role !== "customer" && s.role !== "expert") return null;
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  if (!s) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

// ---------- small UI helpers ----------
function fmt(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function statusDot(status?: string) {
  const s = (status ?? "").toUpperCase();
  if (s.includes("APPROVED") || s.includes("AUTHORIZED") || s.includes("VERIFIED") || s.includes("VALID")) return "good";
  if (s.includes("REJECT") || s.includes("FAILED") || s.includes("INVALID")) return "bad";
  if (s.includes("SUSPEND") || s.includes("REVIEW")) return "warn";
  return "";
}

// ---------- simulated docs ----------
function readDocsMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
function writeDocsMap(map: Record<string, boolean>) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(map));
}
function setDocsProvided(claimId: string, value: boolean) {
  const m = readDocsMap();
  m[claimId] = value;
  writeDocsMap(m);
}
function getDocsProvided(claimId: string): boolean {
  const m = readDocsMap();
  return Boolean(m[claimId]);
}

// ---------- toast ----------
type ToastKind = "info" | "success" | "error" | "warn";
function Toast({ kind, text, onClose }: { kind: ToastKind; text: string; onClose: () => void }) {
  return (
    <div className={`toast ${kind}`} role="status" aria-live="polite">
      <div className="toastInner">
        <div className="toastText">{text}</div>
        <button className="toastClose" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------- process steps (logic based on history + activity + final state) ----------
type StepTone = "" | "good" | "warn" | "bad";

type ProcessStep = {
  key: string;
  title: string;
  hint: string;
  // tokens found in (status/message)
  tokens?: string[];
  // becomes active (yellow) if activity matches
  activeWhenActivity?: string[];
};

const PROCESS_STEPS: ProcessStep[] = [
  {
    key: "submitted",
    title: "Claim submitted (REST)",
    hint: "Customer submits the claim to the REST claim service.",
    tokens: ["SUBMITTED"],
  },
  {
    key: "identity",
    title: "Identity verification (SOAP)",
    hint: "Workflow calls SOAP identity service (WSDL contract).",
    tokens: ["IDENTITY", "SOAP", "VERIFIED"],
  },
  {
    key: "policy",
    title: "Policy validation (GraphQL)",
    hint: "Workflow checks policy coverage via GraphQL policy service.",
    tokens: ["POLICY", "COVER", "VALID", "GRAPHQL"],
  },
  {
    key: "fraud",
    title: "Fraud detection (gRPC)",
    hint: "Workflow calls gRPC fraud service → returns a risk level.",
    tokens: ["FRAUD", "RISK", "GRPC"],
  },
  {
    key: "docs",
    title: "Document review (User Task)",
    hint: "Triggered when workflow waits for expert to validate docs.",
    activeWhenActivity: ["ut_docs"],
    tokens: ["DOC", "DOCUMENT", "UT_DOCS"],
  },
  {
    key: "expert",
    title: "Expert assessment (User Task)",
    hint: "Triggered when workflow waits for expert approval/rejection.",
    activeWhenActivity: ["ut_expert"],
    tokens: ["EXPERT", "UT_EXPERT"],
  },
  {
    key: "payment",
    title: "Payment authorization",
    hint: "Payment is simulated in this demo. If authorized → approved.",
    tokens: ["PAY", "PAYMENT", "AUTHORIZED", "PAID"],
  },
  {
    key: "done",
    title: "Completed",
    hint: "Final decision sent to customer (approved or rejected).",
    tokens: ["APPROVED", "REJECTED", "COMPLETED", "FINISHED"],
  },
];

function historyText(e: ClaimHistoryEvent) {
  return `${e.status ?? ""} ${e.message ?? ""}`.toUpperCase();
}

function includesAny(text: string, tokens?: string[]) {
  if (!tokens?.length) return false;
  return tokens.some((t) => text.includes(t));
}

function activityToStepIndex(activity?: string): number {
  // Fallback when backend does not log explicit step events
  // We assume: if we're at ut_docs => identity+policy+fraud already done.
  const a = (activity ?? "").toLowerCase();
  if (!a) return 0;
  if (a === "ut_docs") return 4;
  if (a === "ut_expert") return 5;
  return 0;
}

function computeStepTones(
  steps: ProcessStep[],
  history: ClaimHistoryEvent[],
  wfState?: string,
  activity?: string,
  claimStatus?: string
): StepTone[] {
  const wf = (wfState ?? "").toUpperCase();
  const final = (claimStatus ?? "").toUpperCase();

  const rejected = final.includes("REJECT");
  const approved = final.includes("APPROVED");

  // build a "reached index" based on:
  // - explicit history tokens
  // - OR activity fallback
  let reached = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const found = history.some((h) => includesAny(historyText(h), step.tokens));
    if (found) reached = Math.max(reached, i + 1);
  }

  reached = Math.max(reached, activityToStepIndex(activity));

  // if finished, we consider all reached
  if (wf === "FINISHED" || wf === "COMPLETED") reached = steps.length;

  // compute tones
  return steps.map((s, idx) => {
    // final reject makes remaining red-ish for clarity
    if (rejected) {
      // keep already-reached green-ish, but remaining red
      return idx < reached ? "good" : "bad";
    }

    // active user tasks
    if (s.activeWhenActivity?.length && activity && s.activeWhenActivity.includes(activity)) return "warn";

    // payment: if approved we show it good
    if (approved && (s.key === "payment" || s.key === "done")) return "good";

    // reached earlier steps
    if (idx < reached) return "good";

    return "";
  });
}

function getNowMessage(activity?: string, wfState?: string, status?: string) {
  const wf = (wfState ?? "").toUpperCase();
  const st = (status ?? "").toUpperCase();

  if (wf === "FINISHED" || wf === "COMPLETED") {
    if (st.includes("APPROVED")) return "✅ Approved. Payment authorized (demo).";
    if (st.includes("REJECT")) return "❌ Rejected. Customer will see the decision in the portal.";
    return "Process finished.";
  }

  if (activity === "ut_docs") return "Waiting for expert to validate documents (Docs OK / Docs Missing).";
  if (activity === "ut_expert") return "Waiting for expert to approve or reject the claim.";
  if (activity) return `Workflow is running (${activity}).`;
  return "Workflow is progressing...";
}

// ---------- login ----------
function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [username, setUsername] = useState("customer");
  const [password, setPassword] = useState("customer");
  const [error, setError] = useState("");

  function submit() {
    setError("");
    if (username === "customer" && password === "customer") return onLogin({ username, role: "customer" });
    if (username === "gaaloul" && password === "expert") return onLogin({ username, role: "expert" });
    setError("Invalid credentials. Try: customer/customer or gaaloul/expert");
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="header">
        <div className="title">
          <div className="badge">
            <span className="dot warn"></span>
            <span className="mono">Insurance Claims Portal</span>
          </div>
          <div>
            <h1>Sign in</h1>
            <p>Use separate tabs for separate roles (session is per-tab).</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Demo accounts</h2>
        <div className="small">
          <div>
            <b>Customer</b>: username <span className="mono">customer</span> · password <span className="mono">customer</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Expert</b>: username <span className="mono">gaaloul</span> · password <span className="mono">expert</span>
          </div>
        </div>

        <div className="hr"></div>

        <div className="row">
          <div>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>

        <div className="actions">
          <button className="primary" onClick={submit}>
            Sign in
          </button>
          <button
            onClick={() => {
              setUsername("customer");
              setPassword("customer");
            }}
          >
            Fill customer
          </button>
          <button
            onClick={() => {
              setUsername("gaaloul");
              setPassword("expert");
            }}
          >
            Fill expert
          </button>
        </div>

        {error && (
          <>
            <div className="hr"></div>
            <div className="errorBox">{error}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- main ----------
export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const [form, setForm] = useState<WorkflowStartReq>({
    customerId: "CUST-1",
    fullName: "Yahya Farehan",
    policyNumber: "P-1001",
    claimType: "ACCIDENT",
    claimedAmount: 2500,
    description: "Broken screen",
  });

  const [selectedClaimId, setSelectedClaimId] = useState<string>("");
  const [startRes, setStartRes] = useState<WorkflowStartRes | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [history, setHistory] = useState<ClaimHistoryEvent[]>([]);
  const [wf, setWf] = useState<WorkflowState | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [expertClaimInput, setExpertClaimInput] = useState<string>("");

  // toast state (customer payment notif)
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);
  const lastPaymentToastKey = useRef<string>("");

  const recentClaims = useMemo(() => {
    const raw = localStorage.getItem(RECENT_KEY);
    try {
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }, [selectedClaimId]);

  function pushRecent(id: string) {
    const raw = localStorage.getItem(RECENT_KEY);
    let arr: string[] = [];
    try {
      arr = raw ? JSON.parse(raw) : [];
    } catch {}
    arr = [id, ...arr.filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
  }

  async function refreshAll(targetClaimId?: string) {
    const id = targetClaimId ?? selectedClaimId;
    if (!id) return;

    setErr("");
    try {
      const [c, h, w, t] = await Promise.all([claimGet(id), claimHistory(id), wfState(id), wfTasksByClaim(id)]);
      setClaim(c);
      setHistory(h);
      setWf(w);
      setTasks(t);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    if (!autoRefresh) return;
    if (!selectedClaimId) return;
    const t = setInterval(() => refreshAll(), 1500);
    return () => clearInterval(t);
  }, [autoRefresh, selectedClaimId]);

  function validateForm(): string | null {
    if (!form.customerId.trim()) return "Customer ID is required.";
    if (!form.fullName.trim()) return "Full name is required.";
    if (!form.policyNumber.trim()) return "Policy number is required.";
    if (!form.description.trim()) return "Description is required.";

    const amt = Number(form.claimedAmount);
    if (!Number.isFinite(amt)) return "Claimed amount must be a valid number.";
    if (amt <= 0) return "Claimed amount must be greater than 0.";
    if (amt > 1_000_000) return "Claimed amount is too large for this demo (max 1,000,000).";

    return null;
  }

  async function onStart() {
    const v = validateForm();
    if (v) {
      setErr(v);
      return;
    }

    setBusy(true);
    setErr("");
    try {
      const res = await wfStart(form);
      setStartRes(res);
      if (!res.businessKey) throw new Error("Workflow started but claimId (businessKey) is empty");

      // docs simulation defaults to "not provided"
      setDocsProvided(res.businessKey, false);

      setSelectedClaimId(res.businessKey);
      pushRecent(res.businessKey);
      await refreshAll(res.businessKey);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function loadExisting(id: string) {
    setSelectedClaimId(id);
    setStartRes(null);
    await refreshAll(id);
  }

  async function completeTask(task: TaskDto, vars: Record<string, any>) {
    setBusy(true);
    setErr("");
    try {
      await wfCompleteTask(task.id, vars);
      await refreshAll();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const runningActivity = wf?.activityId?.[0] ?? "";
  const runningLabel =
    runningActivity === "ut_docs"
      ? "Document Review (waiting for expert)"
      : runningActivity === "ut_expert"
      ? "Expert Assessment (waiting for expert)"
      : runningActivity
      ? `Running: ${runningActivity}`
      : "";

  // Payment toast logic (customer only)
  useEffect(() => {
    if (!session || session.role !== "customer") return;
    if (!selectedClaimId) return;

    const st = (claim?.status ?? "").toUpperCase();
    const wfSt = (wf?.state ?? "").toUpperCase();
    const htxt = history.map(historyText).join(" | ");

    const paymentDetected =
      st.includes("APPROVED") ||
      htxt.includes("PAY") ||
      htxt.includes("PAID") ||
      htxt.includes("AUTHORIZED") ||
      (wfSt === "FINISHED" && st.includes("APPROVED"));

    if (!paymentDetected) return;

    const key = `${selectedClaimId}:${st}:${wfSt}`;
    if (lastPaymentToastKey.current === key) return;
    lastPaymentToastKey.current = key;

    setToast({
      kind: "success",
      text: `Payment update for ${selectedClaimId}: ${
        st.includes("APPROVED") ? "✅ Payment authorized (demo)." : "✅ Payment event detected."
      }`,
    });
  }, [session, selectedClaimId, claim?.status, wf?.state, history]);

  if (!session) {
    return (
      <Login
        onLogin={(s) => {
          setSession(s);
          saveSession(s);
        }}
      />
    );
  }

  const isCustomer = session.role === "customer";
  const isExpert = session.role === "expert";
  const docsProvided = selectedClaimId ? getDocsProvided(selectedClaimId) : false;

  const stepTones = computeStepTones(PROCESS_STEPS, history, wf?.state, runningActivity, claim?.status);

  return (
    <div className="container">
      {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

      <div className="header">
        <div className="title">
          <div className="badge">
            <span className={`dot ${isCustomer ? "good" : "warn"}`}></span>
            <span className="mono">Insurance Claims Portal</span>
          </div>
          <div>
            <h1>{isCustomer ? "Customer" : "Expert"} Session</h1>
            <p>
              Signed in as <span className="mono">{session.username}</span>
              {isCustomer ? " — Submit & track your claim" : " — Review tasks (Docs / Expert)"}
            </p>
          </div>
        </div>

        <div className="actions">
          <button onClick={() => refreshAll()} disabled={!selectedClaimId || busy}>
            Refresh
          </button>
          <button onClick={() => setAutoRefresh((v) => !v)} className={autoRefresh ? "good" : ""}>
            Auto-refresh: {autoRefresh ? "ON" : "OFF"}
          </button>
          <button
            className="danger"
            onClick={() => {
              saveSession(null);
              setSession(null);
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="grid">
        {/* LEFT */}
        <div className="card">
          {isCustomer ? (
            <>
              <h2>1) Submit a new claim</h2>

              <div className="row">
                <div>
                  <label>Customer ID</label>
                  <input value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} />
                </div>
                <div>
                  <label>Full name</label>
                  <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <div>
                  <label>Policy number</label>
                  <input value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />

                  <div className="small" style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Demo policies</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {DEMO_POLICIES.map((p) => (
                        <li key={p.policyNumber}>
                          <b>{p.policyNumber}</b> — {p.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <label>Claim type</label>
                  <select value={form.claimType} onChange={(e) => setForm({ ...form, claimType: e.target.value as ClaimType })}>
                    {CLAIM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <div>
                  <label>Claimed amount</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.claimedAmount}
                    onChange={(e) => setForm({ ...form, claimedAmount: Number(e.target.value) })}
                  />
                  {Number(form.claimedAmount) > 10000 && (
                    <div className="small" style={{ marginTop: 6 }}>
                      Note: High amounts may increase fraud risk (demo rule).
                    </div>
                  )}
                </div>
                <div>
                  <label>Description</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              <div className="actions">
                <button className="primary" onClick={onStart} disabled={busy}>
                  {busy ? "Starting..." : "Start workflow"}
                </button>
                <button onClick={() => setForm({ ...form, policyNumber: "P-1001" })} disabled={busy}>
                  Happy path preset
                </button>
                <button className="danger" onClick={() => setForm({ ...form, policyNumber: "P-1000" })} disabled={busy}>
                  Force Identity Fail (…0)
                </button>
              </div>

              {/* docs simulation */}
              {selectedClaimId && (
                <>
                  <div className="hr"></div>
                  <h2>2) Documents (simulated)</h2>
                  <div className="small">
                    This demo does not upload real files. We simulate “documents provided” so the expert can accept/reject during the user task.
                  </div>
                  <div className="actions" style={{ marginTop: 10 }}>
                    <button
                      className={docsProvided ? "good" : ""}
                      disabled={!selectedClaimId}
                      onClick={() => {
                        if (!selectedClaimId) return;
                        setDocsProvided(selectedClaimId, true);
                        setToast({ kind: "success", text: `Documents marked as uploaded for ${selectedClaimId} (simulated).` });
                      }}
                    >
                      Mark documents as uploaded ✅
                    </button>
                    <button
                      className="danger"
                      disabled={!selectedClaimId}
                      onClick={() => {
                        if (!selectedClaimId) return;
                        setDocsProvided(selectedClaimId, false);
                        setToast({ kind: "warn", text: `Documents cleared for ${selectedClaimId} (simulated).` });
                      }}
                    >
                      Clear documents ❌
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h2>1) Expert desk</h2>
              <div className="small">Load a claim, then complete user tasks (Document Review / Expert Assessment).</div>

              <div className="row" style={{ marginTop: 10 }}>
                <div>
                  <label>Load claim by ID</label>
                  <input placeholder="CLM-xxxx" value={expertClaimInput} onChange={(e) => setExpertClaimInput(e.target.value)} />
                </div>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <button className="primary" disabled={!expertClaimInput.trim() || busy} onClick={() => loadExisting(expertClaimInput.trim())}>
                    Load
                  </button>
                </div>
              </div>

              {selectedClaimId && (
                <>
                  <div className="hr"></div>
                  <h2>2) Documents status</h2>
                  <div className="badge">
                    <span className={`dot ${docsProvided ? "good" : "warn"}`}></span>
                    <span>
                      Documents provided (simulated): <b>{docsProvided ? "YES" : "NO"}</b>
                    </span>
                  </div>
                  {!docsProvided && <div className="small" style={{ marginTop: 6 }}>If customer didn’t provide documents, choose “Docs Missing”.</div>}
                </>
              )}
            </>
          )}

          <div className="hr"></div>

          <h2>Recent claims</h2>
          <div className="list">
            {recentClaims.length === 0 && <div className="small">No recent claims yet.</div>}
            {recentClaims.map((id) => (
              <div key={id} className="pill" onClick={() => loadExisting(id)} title={isCustomer ? "Load claim" : "Open case"}>
                <span className="mono">{id}</span>
                <span className="small">{isCustomer ? "track" : "open"}</span>
              </div>
            ))}
          </div>

          {err && (
            <>
              <div className="hr"></div>
              <div className="errorBox">{err}</div>
            </>
          )}
        </div>

        {/* MIDDLE: Process steps */}
        <div className="card">
          <h2>2) Process steps</h2>
          <div className="small">Computed from claim history + current workflow activity (fallback when history is sparse).</div>

          <div className="timeline" style={{ marginTop: 10 }}>
            {PROCESS_STEPS.map((s, idx) => (
              <div key={s.key} className="event">
                <span className={`dot ${stepTones[idx]}`}></span>
                <div className="meta">
                  <b>{s.title}</b>
                  <small>{s.hint}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="card">
          <h2>3) Claim tracking</h2>

          {!selectedClaimId && <div className="small">Select a claim to see details here.</div>}

          {selectedClaimId && (
            <>
              <div className="row">
                <div className="badge">
                  <span className={`dot ${statusDot(claim?.status)}`}></span>
                  <span>
                    Status: <b>{claim?.status ?? "—"}</b>
                  </span>
                </div>

                <div className="badge">
                  <span className={`dot ${wf?.state === "RUNNING" ? "warn" : "good"}`}></span>
                  <span>
                    Workflow: <b>{wf?.state ?? "—"}</b>
                  </span>
                </div>

                {runningLabel && (
                  <div className="badge">
                    <span className="dot warn"></span>
                    <span>
                      <b>{runningLabel}</b>
                    </span>
                  </div>
                )}
              </div>

              <div className="card" style={{ marginTop: 10 }}>
                <b>What happens now?</b>
                <p className="small">{getNowMessage(runningActivity, wf?.state, claim?.status)}</p>
              </div>

              <div className="kv" style={{ marginTop: 12 }}>
                <div className="key">Claim ID</div>
                <div className="mono">{selectedClaimId}</div>
                <div className="key">ProcessInstance</div>
                <div className="mono">{wf?.processInstanceId ?? startRes?.processInstanceId ?? "—"}</div>
                <div className="key">Created</div>
                <div>{fmt(claim?.createdAt)}</div>
                <div className="key">Policy</div>
                <div className="mono">{claim?.policyNumber ?? form.policyNumber}</div>
              </div>

              <div className="hr"></div>

              <h2>4) User tasks</h2>
              {isCustomer && <div className="small">Customer view is read-only. User tasks are completed from the Expert session.</div>}

              {tasks.length === 0 ? (
                <div className="small">No active user tasks right now.</div>
              ) : (
                <div className="timeline">
                  {tasks.map((t) => (
                    <div key={t.id} className="event">
                      <span className="dot warn"></span>
                      <div className="meta">
                        <b>{t.name}</b>
                        <small className="mono">
                          {t.taskDefinitionKey} · {t.id}
                        </small>

                        {isExpert ? (
                          <div className="actions">
                            {t.taskDefinitionKey === "ut_docs" && (
                              <>
                                <button className="good" disabled={busy} onClick={() => completeTask(t, { docsOk: true })}>
                                  Docs OK ✅
                                </button>
                                <button className="danger" disabled={busy} onClick={() => completeTask(t, { docsOk: false })}>
                                  Docs Missing ❌
                                </button>
                              </>
                            )}

                            {t.taskDefinitionKey === "ut_expert" && (
                              <>
                                <button className="good" disabled={busy} onClick={() => completeTask(t, { expertDecision: "APPROVE" })}>
                                  Approve ✅
                                </button>
                                <button className="danger" disabled={busy} onClick={() => completeTask(t, { expertDecision: "REJECT" })}>
                                  Reject ❌
                                </button>
                              </>
                            )}

                            {t.taskDefinitionKey !== "ut_docs" && t.taskDefinitionKey !== "ut_expert" && (
                              <button disabled={busy} onClick={() => completeTask(t, {})}>
                                Complete
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="small">Pending expert action.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="hr"></div>

              <h2>5) Claim history</h2>
              <div className="timeline">
                {(history ?? []).map((e, idx) => (
                  <div key={idx} className="event">
                    <span className={`dot ${statusDot(e.status)}`}></span>
                    <div className="meta">
                      <b>{e.status}</b>
                      <small>
                        {fmt(e.at)} · {e.message}
                      </small>
                    </div>
                  </div>
                ))}
                {history.length === 0 && <div className="small">No history yet.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
