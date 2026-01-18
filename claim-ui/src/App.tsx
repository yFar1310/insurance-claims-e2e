import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  claimGet,
  claimHistory,
  wfCompleteTask,
  wfStart,
  wfState,
  wfTasksByInstance,
} from "./api";

function statusDot(status?: string) {
  const s = (status ?? "").toUpperCase();
  if (s.includes("APPROVED") || s.includes("AUTHORIZED") || s.includes("VERIFIED") || s.includes("VALID")) return "good";
  if (s.includes("REJECT") || s.includes("FAILED") || s.includes("INVALID")) return "bad";
  if (s.includes("SUSPEND") || s.includes("REVIEW")) return "warn";
  return "";
}

function fmt(ts?: string) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

const CLAIM_TYPES: ClaimType[] = ["ACCIDENT", "THEFT", "FIRE", "HEALTH", "OTHER"];

export default function App() {
  const [form, setForm] = useState<WorkflowStartReq>({
    customerId: "CUST-1",
    fullName: "Yahya Farehan",
    policyNumber: "P-1001",
    claimType: "ACCIDENT",
    claimedAmount: 2500,
    description: "Broken screen",
  });

  const [startRes, setStartRes] = useState<WorkflowStartRes | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [history, setHistory] = useState<ClaimHistoryEvent[]>([]);
  const [wf, setWf] = useState<WorkflowState | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const claimId = startRes?.businessKey ?? "";

  const recentClaims = useMemo(() => {
    const raw = localStorage.getItem("recentClaims");
    try { return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
  }, [startRes?.businessKey]);

  function pushRecent(id: string) {
    const raw = localStorage.getItem("recentClaims");
    let arr: string[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch {}
    arr = [id, ...arr.filter(x => x !== id)].slice(0, 8);
    localStorage.setItem("recentClaims", JSON.stringify(arr));
  }

  async function refreshAll(targetClaimId?: string, targetPi?: string) {
    const id = targetClaimId ?? claimId;
    const pi = targetPi ?? startRes?.processInstanceId;
    if (!id || !pi) return;

    setErr("");
    try {
      const [c, h, w, t] = await Promise.all([
        claimGet(id),
        claimHistory(id),
        wfState(id),
        wfTasksByInstance(pi),
      ]);
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
    if (!claimId || !startRes?.processInstanceId) return;
    const t = setInterval(() => refreshAll(), 1500);
    return () => clearInterval(t);
  }, [autoRefresh, claimId, startRes?.processInstanceId]);

  async function onStart() {
    setBusy(true);
    setErr("");
    try {
      const res = await wfStart(form);
      setStartRes(res);
      pushRecent(res.businessKey);
      await refreshAll(res.businessKey, res.processInstanceId);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function loadExisting(id: string) {
    // We don't know processInstanceId for an old claim unless you store it.
    // Quick workaround: ask the user to paste processInstanceId if needed.
    // For now we show Claim + History + WF state; tasks need PI id.
    setErr("");
    setStartRes({ businessKey: id, processInstanceId: startRes?.processInstanceId ?? "" });
    try {
      const [c, h, w] = await Promise.all([claimGet(id), claimHistory(id), wfState(id)]);
      setClaim(c);
      setHistory(h);
      setWf(w);
      setTasks([]);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
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
    runningActivity === "ut_docs" ? "Document Review (User Task)" :
    runningActivity === "ut_expert" ? "Expert Assessment (User Task)" :
    runningActivity ? `Running: ${runningActivity}` :
    "";

  return (
    <div className="container">
      <div className="header">
        <div className="title">
          <div className="badge">
            <span className={`dot ${wf?.state === "RUNNING" ? "warn" : "good"}`}></span>
            <span className="mono">Insurance Claims UI</span>
          </div>
          <div>
            <h1>End-to-End Claim Processing</h1>
            <p>Submit → Track → Complete user tasks (Docs / Expert) → Final decision</p>
          </div>
        </div>

        <div className="actions">
          <button onClick={() => refreshAll()} disabled={!claimId || busy}>Refresh</button>
          <button onClick={() => setAutoRefresh(v => !v)} className={autoRefresh ? "good" : ""}>
            Auto-refresh: {autoRefresh ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div className="grid">
        {/* LEFT */}
        <div className="card">
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
              <div className="small">Tip: Identity passes if policy does NOT end with “0”. GraphQL valid accepts P-xxxx.</div>
            </div>
            <div>
              <label>Claim type</label>
              <select value={form.claimType} onChange={(e) => setForm({ ...form, claimType: e.target.value as ClaimType })}>
                {CLAIM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <label>Claimed amount</label>
              <input
                type="number"
                value={form.claimedAmount}
                onChange={(e) => setForm({ ...form, claimedAmount: Number(e.target.value) })}
              />
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
            <button
              onClick={() => setForm({ ...form, policyNumber: "P-1001" })}
              disabled={busy}
            >
              Happy path preset
            </button>
            <button
              className="danger"
              onClick={() => setForm({ ...form, policyNumber: "P-1000" })}
              disabled={busy}
            >
              Force Identity Fail (…0)
            </button>
          </div>

          <div className="hr"></div>

          <h2>Recent claims</h2>
          <div className="list">
            {recentClaims.length === 0 && <div className="small">No recent claims yet.</div>}
            {recentClaims.map((id) => (
              <div key={id} className="pill" onClick={() => loadExisting(id)} title="Load claim">
                <span className="mono">{id}</span>
                <span className="small">load</span>
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

        {/* RIGHT */}
        <div className="card">
          <h2>2) Live tracking</h2>

          {!startRes && (
            <div className="small">Start a workflow to see details here.</div>
          )}

          {startRes && (
            <>
              <div className="row">
                <div className="badge">
                  <span className={`dot ${statusDot(claim?.status)}`}></span>
                  <span>Status: <b>{claim?.status ?? "—"}</b></span>
                </div>

                <div className="badge">
                  <span className={`dot ${wf?.state === "RUNNING" ? "warn" : "good"}`}></span>
                  <span>Workflow: <b>{wf?.state ?? "—"}</b></span>
                </div>

                {runningLabel && (
                  <div className="badge">
                    <span className="dot warn"></span>
                    <span><b>{runningLabel}</b></span>
                  </div>
                )}
              </div>

              <div className="kv" style={{ marginTop: 12 }}>
                <div className="key">Claim ID</div><div className="mono">{startRes.businessKey}</div>
                <div className="key">ProcessInstance</div><div className="mono">{startRes.processInstanceId}</div>
                <div className="key">Created</div><div>{fmt(claim?.createdAt)}</div>
                <div className="key">Policy</div><div className="mono">{claim?.policyNumber ?? form.policyNumber}</div>
              </div>

              <div className="hr"></div>

              <h2>3) User Tasks (Docs / Expert)</h2>
              {tasks.length === 0 ? (
                <div className="small">
                  No active user tasks right now.
                  {wf?.state === "RUNNING" && runningActivity && (
                    <> (Engine says it’s at <span className="mono">{runningActivity}</span>, so tasks should appear after you added the endpoint.)</>
                  )}
                </div>
              ) : (
                <div className="timeline">
                  {tasks.map((t) => (
                    <div key={t.id} className="event">
                      <span className={`dot ${t.taskDefinitionKey === "ut_docs" ? "warn" : "warn"}`}></span>
                      <div className="meta">
                        <b>{t.name}</b>
                        <small className="mono">{t.taskDefinitionKey} · {t.id}</small>

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
                            <button disabled={busy} onClick={() => completeTask(t, {})}>Complete</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="hr"></div>

              <h2>4) Claim history</h2>
              <div className="timeline">
                {(history ?? []).map((e, idx) => (
                  <div key={idx} className="event">
                    <span className={`dot ${statusDot(e.status)}`}></span>
                    <div className="meta">
                      <b>{e.status}</b>
                      <small>{fmt(e.at)} · {e.message}</small>
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
