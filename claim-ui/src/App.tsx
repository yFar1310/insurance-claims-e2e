import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
  claimList,
  claimDelete
} from "./api";

import {
  LogIn,
  LogOut,
  RefreshCw,
  Shield,
  User,
  Users,
  Trash2,
  Plus,
  Search,
  ClipboardCopy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Gavel,
  CreditCard,
  ListChecks,
} from "lucide-react";

/* ------------------ types + constants ------------------ */

type Role = "customer" | "expert" | "admin";
type Session = { username: string; role: Role; displayName: string; customerId?: string };

type ClaimSummary = Pick<Claim, "id" | "fullName" | "claimedAmount" | "description" | "status" | "createdAt">;

const SESSION_KEY = "claimsUiSession";
const DOCS_KEY = "claimDocsProvidedByClaimId";
const RECENT_KEY = "recentClaims";

// Admin demo "user management" (UI-only)
const USERS_KEY = "demoUsersV1";

const CLAIM_TYPES: ClaimType[] = ["ACCIDENT", "THEFT", "FIRE", "HEALTH", "OTHER"];

const DEMO_POLICIES: Array<{ policyNumber: string; label: string; notes: string }> = [
  { policyNumber: "P-1001", label: "Standard policy (happy path)", notes: "Covers all claim types, limit 5000." },
  { policyNumber: "P-1006", label: "THEFT not covered", notes: "Same as P-1001 but excludes THEFT (demo rejection)." },
  { policyNumber: "P-1999", label: "Low coverage limit", notes: "Low limit 500 (demo LIMIT_EXCEEDED)." },
  { policyNumber: "P-0000", label: "Invalid / expired", notes: "Invalid policy (demo POLICY_INVALID)." },
];

const DEMO_CUSTOMERS = [
  { customerId: "CUST-1", fullName: "Yahya Farehan" },
  { customerId: "CUST-2", fullName: "Sara El Amrani" },
  { customerId: "CUST-3", fullName: "Adam Benali" },
];

const DEMO_EXPERTS = [{ username: "gaaloul", displayName: "Claims Expert" }];

/* ------------------ storage helpers ------------------ */

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.username || !s?.role) return null;
    if (!["customer", "expert", "admin"].includes(s.role)) return null;
    return s;
  } catch {
    return null;
  }
}
function saveSession(s: Session | null) {
  if (!s) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

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

function readRecentClaims(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function writeRecentClaims(ids: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
}

type DemoUser = { id: string; role: Role; username: string; displayName: string; customerId?: string };
function seedUsersIfMissing(): DemoUser[] {
  const existing = readUsers();
  if (existing.length) return existing;

  const seeded: DemoUser[] = [
    ...DEMO_CUSTOMERS.map((c) => ({
      id: crypto.randomUUID(),
      role: "customer" as const,
      username: "customer",
      displayName: c.fullName,
      customerId: c.customerId,
    })),
    ...DEMO_EXPERTS.map((e) => ({
      id: crypto.randomUUID(),
      role: "expert" as const,
      username: e.username,
      displayName: e.displayName,
    })),
    {
      id: crypto.randomUUID(),
      role: "admin",
      username: "admin",
      displayName: "System Admin",
    },
  ];
  localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
  return seeded;
}
function readUsers(): DemoUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as DemoUser[]) : [];
  } catch {
    return [];
  }
}
function writeUsers(users: DemoUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/* ------------------ UI helpers ------------------ */

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function fmt(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).slice(0, 2);
  const a = (parts[0]?.[0] ?? "U").toUpperCase();
  const b = (parts[1]?.[0] ?? "").toUpperCase();
  return `${a}${b}`;
}

function fmtAmount(n?: number) {
  const v = Number(n ?? 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(v);
  } catch {
    return String(v);
  }
}

function truncate(s: string, max = 70) {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

type Tone = "good" | "warn" | "bad" | "muted";
function toneFromStatus(status?: unknown): Tone {
  const s = String(status ?? "").toUpperCase();
  if (s.includes("APPROVED") || s.includes("AUTHORIZED") || s.includes("VERIFIED") || s.includes("VALID")) return "good";
  if (s.includes("REJECT") || s.includes("FAILED") || s.includes("INVALID")) return "bad";
  if (s.includes("SUSPEND") || s.includes("REVIEW")) return "warn";
  return "muted";
}

function ToneDot({ tone }: { tone: Tone }) {
  return (
    <span
      className={cx(
        "inline-block h-2.5 w-2.5 rounded-full",
        tone === "good" && "bg-emerald-400",
        tone === "warn" && "bg-amber-400",
        tone === "bad" && "bg-rose-400",
        tone === "muted" && "bg-slate-600"
      )}
    />
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------ toast ------------------ */

type ToastKind = "info" | "success" | "error" | "warn";
function Toast({
  kind,
  text,
  onClose,
}: {
  kind: ToastKind;
  text: string;
  onClose: () => void;
}) {
  const Icon =
    kind === "success" ? CheckCircle2 : kind === "error" ? XCircle : kind === "warn" ? AlertTriangle : FileText;

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))]">
      <div
        className={cx(
          "rounded-2xl border px-4 py-3 shadow-xl backdrop-blur",
          "bg-slate-900/70 border-slate-700"
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <Icon className={cx("mt-0.5 h-5 w-5",
            kind === "success" && "text-emerald-300",
            kind === "warn" && "text-amber-300",
            kind === "error" && "text-rose-300",
            kind === "info" && "text-sky-300"
          )} />
          <div className="flex-1 text-sm text-slate-100">{text}</div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------ process steps ------------------ */

type StepTone = "" | "good" | "warn" | "bad";
type ProcessStep = {
  key: string;
  title: string;
  hint: string;
  tokens?: string[];
  activeWhenActivity?: string[];
};

const PROCESS_STEPS: ProcessStep[] = [
  { key: "submitted", title: "Claim submitted (REST)", hint: "Customer submits the claim to the REST claim service.", tokens: ["SUBMITTED"] },
  { key: "identity", title: "Identity verification (SOAP)", hint: "Workflow calls SOAP identity service (WSDL contract).", tokens: ["IDENTITY", "SOAP", "VERIFIED"] },
  { key: "policy", title: "Policy validation (GraphQL)", hint: "Workflow checks policy coverage via GraphQL policy service.", tokens: ["POLICY", "COVER", "VALID", "GRAPHQL"] },
  { key: "fraud", title: "Fraud detection (gRPC)", hint: "Workflow calls gRPC fraud service → returns a risk level.", tokens: ["FRAUD", "RISK", "GRPC"] },
  { key: "docs", title: "Document review (User Task)", hint: "Triggered when workflow waits for expert to validate docs.", activeWhenActivity: ["ut_docs"], tokens: ["DOC", "DOCUMENT", "UT_DOCS"] },
  { key: "expert", title: "Expert assessment (User Task)", hint: "Triggered when workflow waits for expert approval/rejection.", activeWhenActivity: ["ut_expert"], tokens: ["EXPERT", "UT_EXPERT"] },
  { key: "payment", title: "Payment authorization", hint: "Payment is simulated in this demo. If authorized → approved.", tokens: ["PAY", "PAYMENT", "AUTHORIZED", "PAID"] },
  { key: "done", title: "Completed", hint: "Final decision sent to customer (approved or rejected).", tokens: ["APPROVED", "REJECTED", "COMPLETED", "FINISHED"] },
];

function historyText(e: ClaimHistoryEvent) {
  return `${e.status ?? ""} ${e.message ?? ""}`.toUpperCase();
}
function includesAny(text: string, tokens?: string[]) {
  if (!tokens?.length) return false;
  return tokens.some((t) => text.includes(t));
}
function activityToStepIndex(activity?: string): number {
  const a = (activity ?? "").toLowerCase();
  if (!a) return 0;
  if (a === "ut_docs") return 4;
  if (a === "ut_expert") return 5;
  return 0;
}
function computeStepTones(
  steps: ProcessStep[],
  history: unknown,
  wfState?: string,
  activity?: string,
  claimStatus?: string
): StepTone[] {
  const hist: ClaimHistoryEvent[] = Array.isArray(history) ? (history as ClaimHistoryEvent[]) : [];

  const wf = String(wfState ?? "").toUpperCase();
  const final = String(claimStatus ?? "").toUpperCase();

  const rejected = final.includes("REJECT");
  const approved = final.includes("APPROVED");

  let reached = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const found = hist.some((h) => includesAny(historyText(h), step.tokens));
    if (found) reached = Math.max(reached, i + 1);
  }

  reached = Math.max(reached, activityToStepIndex(activity));
  if (wf === "FINISHED" || wf === "COMPLETED") reached = steps.length;

  return steps.map((s, idx) => {
    if (rejected) return idx < reached ? "good" : "bad";
    if (s.activeWhenActivity?.length && activity && s.activeWhenActivity.includes(activity)) return "warn";
    if (approved && (s.key === "payment" || s.key === "done")) return "good";
    if (idx < reached) return "good";
    return "";
  });
}

function getNowMessage(activity?: string, wfState?: string, status?: string) {
  const wf = String(wfState ?? "").toUpperCase();
  const st = String(status ?? "").toUpperCase();

  if (wf === "FINISHED" || wf === "COMPLETED") {
    if (st.includes("APPROVED")) return "Approved. Payment authorized (demo).";
    if (st.includes("REJECT")) return "Rejected. Customer will see the decision in the portal.";
    return "Process finished.";
  }
  if (activity === "ut_docs") return "Waiting for expert to validate documents (Docs OK / Docs Missing).";
  if (activity === "ut_expert") return "Waiting for expert to approve or reject the claim.";
  if (activity) return `Workflow is running (${activity}).`;
  return "Workflow is progressing...";
}

/* ------------------ shared UI primitives ------------------ */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)]">
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 rounded-xl border border-slate-800 bg-slate-950/40 p-2 text-slate-200">
            {icon}
          </div>
        )}
        <div>
          <div className="text-base font-semibold text-slate-100">{title}</div>
          {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "secondary",
  leftIcon,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  leftIcon?: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-500",
        variant === "secondary" && "bg-white/5 text-slate-100 hover:bg-white/10 border border-slate-800",
        variant === "danger" && "bg-rose-600/90 text-white hover:bg-rose-500",
        variant === "ghost" && "text-slate-200 hover:bg-white/10",
        className
      )}
    >
      {leftIcon}
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
    >
      {children}
    </select>
  );
}

/* ------------------ routing helpers ------------------ */

function routeForRole(role: Role) {
  if (role === "customer") return "/customer";
  if (role === "expert") return "/expert";
  return "/admin";
}

function RequireSession({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  const loc = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function RequireRole({
  session,
  role,
  children,
}: {
  session: Session | null;
  role: Role;
  children: React.ReactNode;
}) {
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to={routeForRole(session.role)} replace />;
  return <>{children}</>;
}

/* ------------------ pages ------------------ */

function LoginPage({ onLogin, session }: { onLogin: (s: Session) => void; session: Session | null }) {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (session) nav(routeForRole(session.role), { replace: true });
  }, [session]);

  const [username, setUsername] = useState("customer");
  const [password, setPassword] = useState("customer");
  const [error, setError] = useState("");
  const [customerProfile, setCustomerProfile] = useState(DEMO_CUSTOMERS[0]);

  useEffect(() => {
    seedUsersIfMissing();
  }, []);

  function submit() {
    setError("");

    if (username === "customer" && password === "customer") {
      const s: Session = {
        username,
        role: "customer",
        displayName: customerProfile.fullName,
        customerId: customerProfile.customerId,
      };
      onLogin(s);
      nav("/customer", { replace: true });
      return;
    }

    if (username === "gaaloul" && password === "expert") {
      const s: Session = { username, role: "expert", displayName: "Claims Expert" };
      onLogin(s);
      nav("/expert", { replace: true });
      return;
    }

    if (username === "admin" && password === "admin") {
      const s: Session = { username, role: "admin", displayName: "System Admin" };
      onLogin(s);
      nav("/admin", { replace: true });
      return;
    }

    setError("Invalid credentials. Try: customer/customer • gaaloul/expert • admin/admin");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-3xl">
          <Card>
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-indigo-600/15 border border-indigo-500/20 p-3">
                  <Shield className="h-6 w-6 text-indigo-300" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Insurance Claims Portal</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Session is per-tab (open customer and expert in two tabs).
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-xs text-slate-300">
                Demo UI
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="text-sm font-semibold">Demo accounts</div>
                <div className="mt-2 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-300" />
                    <span>
                      Customer: <span className="font-mono">customer / customer</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-slate-300" />
                    <span>
                      Expert: <span className="font-mono">gaaloul / expert</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-300" />
                    <span>
                      Admin: <span className="font-mono">admin / admin</span>
                    </span>
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4"
              >
                <div className="text-sm font-semibold">Sign in</div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Username</div>
                    <Input value={username} onChange={setUsername} />
                  </div>

                  <div>
                    <div className="text-xs text-slate-400 mb-1">Password</div>
                    <Input value={password} onChange={setPassword} type="password" />
                  </div>

                  {username === "customer" && (
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Customer profile</div>
                      <Select
                        value={customerProfile.customerId}
                        onChange={(v) =>
                          setCustomerProfile(DEMO_CUSTOMERS.find((x) => x.customerId === v) ?? DEMO_CUSTOMERS[0])
                        }
                      >
                        {DEMO_CUSTOMERS.map((c) => (
                          <option key={c.customerId} value={c.customerId}>
                            {c.fullName} ({c.customerId})
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Btn type="submit" variant="primary" leftIcon={<LogIn className="h-4 w-4" />}>
                      Sign in
                    </Btn>

                    <Btn
                      variant="secondary"
                      leftIcon={<User className="h-4 w-4" />}
                      onClick={() => {
                        setUsername("customer");
                        setPassword("customer");
                      }}
                    >
                      Fill customer
                    </Btn>

                    <Btn
                      variant="secondary"
                      leftIcon={<Gavel className="h-4 w-4" />}
                      onClick={() => {
                        setUsername("gaaloul");
                        setPassword("expert");
                      }}
                    >
                      Fill expert
                    </Btn>

                    <Btn
                      variant="secondary"
                      leftIcon={<Shield className="h-4 w-4" />}
                      onClick={() => {
                        setUsername("admin");
                        setPassword("admin");
                      }}
                    >
                      Fill admin
                    </Btn>
                  </div>

                  {error && (
                    <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      {error}
                    </div>
                  )}
                </div>
              </form>
            </div>
          </Card>

          {loc.state?.from && (
            <div className="mt-3 text-center text-xs text-slate-500">
              You were redirected from <span className="font-mono">{String(loc.state.from)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({
  session,
  onLogout,
  onRefresh,
  selectedClaimId,
  busy,
  autoRefresh,
  setAutoRefresh,
}: {
  session: Session;
  onLogout: () => void;
  onRefresh: () => void;
  selectedClaimId: string;
  busy: boolean;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
}) {
  const roleLabel = session.role === "customer" ? "Customer" : session.role === "expert" ? "Expert" : "Admin";
  const roleTone: Tone = session.role === "customer" ? "good" : session.role === "expert" ? "warn" : "bad";

  return (
    <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-2xl border border-slate-800 bg-white/5 px-3 py-2 flex items-center gap-2">
            <ToneDot tone={roleTone} />
            <div className="text-sm font-semibold truncate">Insurance Claims Portal</div>
          </div>

          <div className="hidden md:block min-w-0">
            <div className="text-sm font-semibold truncate">{roleLabel} workspace</div>
            <div className="text-xs text-slate-400 truncate">
              Signed in as <span className="font-mono">{session.username}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Btn
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={onRefresh}
            disabled={!selectedClaimId || busy}
          >
            Refresh
          </Btn>

          <Btn
            variant={autoRefresh ? "primary" : "secondary"}
            leftIcon={<ListChecks className="h-4 w-4" />}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto: {autoRefresh ? "ON" : "OFF"}
          </Btn>

          <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-800 bg-white/5 px-3 py-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 grid place-items-center text-xs font-bold">
              {initials(session.displayName)}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold">{session.displayName}</div>
              <div className="text-[11px] text-slate-400">{roleLabel}</div>
            </div>
          </div>

          <Btn variant="danger" leftIcon={<LogOut className="h-4 w-4" />} onClick={onLogout}>
            Sign out
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ------------------ Workspace hook (shared customer/expert/admin) ------------------ */

function useWorkspace(session: Session) {
  const [form, setForm] = useState<WorkflowStartReq>({
    customerId: session.customerId ?? "CUST-1",
    fullName: session.displayName ?? "Customer",
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

  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);
  const lastPaymentToastKey = useRef<string>("");

  const [recentClaims, setRecentClaims] = useState<string[]>(() => readRecentClaims());
  const [recentFilter, setRecentFilter] = useState("");
  const [summaries, setSummaries] = useState<Record<string, ClaimSummary | null>>({});

  // keep customer form synced with selected customer session
  useEffect(() => {
    if (session.role !== "customer") return;
    setForm((f) => ({
      ...f,
      fullName: session.displayName,
      customerId: session.customerId ?? f.customerId,
    }));
  }, [session.role, session.displayName, session.customerId]);

  const filteredRecents = useMemo(() => {
    const f = recentFilter.trim().toLowerCase();
    if (!f) return recentClaims;
    return recentClaims.filter((id) => id.toLowerCase().includes(f));
  }, [recentClaims, recentFilter]);

  function pushRecent(id: string) {
    const next = [id, ...recentClaims.filter((x) => x !== id)].slice(0, 20);
    setRecentClaims(next);
    writeRecentClaims(next);
  }

  async function refreshAll(targetClaimId?: string) {
    const id = targetClaimId ?? selectedClaimId;
    if (!id) return;

    setErr("");
    try {
      const [c, h, w, t] = await Promise.all([claimGet(id), claimHistory(id), wfState(id), wfTasksByClaim(id)]);
      setClaim(c);
      setHistory(Array.isArray(h) ? h : []); 
      setWf(w);
      setTasks(Array.isArray(t) ? t : []);
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

  // Scroll to top when opening a claim (prevents "stuck" feeling)
  useEffect(() => {
    if (!selectedClaimId) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedClaimId]);

  function validateForm(): string | null {
    if (!String(form.customerId ?? "").trim()) return "Customer ID is required.";
    if (!String(form.fullName ?? "").trim()) return "Full name is required.";
    if (!String(form.policyNumber ?? "").trim()) return "Policy number is required.";
    if (!String(form.description ?? "").trim()) return "Description is required.";
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

      setDocsProvided(res.businessKey, false);
      setSelectedClaimId(res.businessKey);
      pushRecent(res.businessKey);
      await refreshAll(res.businessKey);

      setToast({ kind: "success", text: `Claim created: ${res.businessKey}` });
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function loadExisting(id: string) {
    setSelectedClaimId(id);
    setStartRes(null);
    pushRecent(id);
    await refreshAll(id);
  }

  async function completeTask(task: TaskDto, vars: Record<string, any>) {
    setBusy(true);
    setErr("");
    try {
      await wfCompleteTask(task.id, vars);
      await refreshAll();
      setToast({ kind: "success", text: `Task completed: ${task.name}` });
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setToast({ kind: "error", text: "Task completion failed." });
    } finally {
      setBusy(false);
    }
  }

  // fetch summaries for recents (show full name + amount)
  useEffect(() => {
    if (recentClaims.length === 0) return;

    const missing = recentClaims.filter((id) => summaries[id] === undefined);
    if (missing.length === 0) return;

    let cancelled = false;

    (async () => {
      const results = await Promise.allSettled(missing.map((id) => claimGet(id)));

      if (cancelled) return;

      setSummaries((prev) => {
        const next = { ...prev };
        for (let i = 0; i < missing.length; i++) {
          const id = missing[i];
          const r = results[i];

          if (r.status === "fulfilled") {
            const c = r.value;
            next[id] = {
              id: c.id,
              fullName: c.fullName,
              claimedAmount: c.claimedAmount,
              description: c.description,
              status: c.status,
              createdAt: c.createdAt,
            };
          } else {
            next[id] = null;
          }
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [recentClaims, summaries]);

  // Payment toast (customer only)
  useEffect(() => {
    if (session.role !== "customer") return;
    if (!selectedClaimId) return;

    const st = String(claim?.status ?? "").toUpperCase();
    const wfSt = String(wf?.state ?? "").toUpperCase();
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
      text: `Payment update for ${selectedClaimId}: payment authorized (demo).`,
    });
  }, [session.role, selectedClaimId, claim?.status, wf?.state, history]);

  const runningActivity = wf?.activityId?.[0] ?? "";
  const stepTones = computeStepTones(PROCESS_STEPS, history, wf?.state, runningActivity, claim?.status);
  const docsProvided = selectedClaimId ? getDocsProvided(selectedClaimId) : false;

  function deleteClaimLocal(id: string) {
    // UI-only delete: remove from recent list + clear docs flag
    const next = recentClaims.filter((x) => x !== id);
    setRecentClaims(next);
    writeRecentClaims(next);
    const dm = readDocsMap();
    delete dm[id];
    writeDocsMap(dm);

    if (selectedClaimId === id) {
      setSelectedClaimId("");
      setClaim(null);
      setHistory([]);
      setWf(null);
      setTasks([]);
    }
    setToast({ kind: "warn", text: `Deleted locally: ${id} (demo UI).` });
  }

  return {
    form,
    setForm,
    selectedClaimId,
    setSelectedClaimId,
    startRes,
    claim,
    history,
    wf,
    tasks,
    autoRefresh,
    setAutoRefresh,
    busy,
    err,
    refreshAll,
    onStart,
    loadExisting,
    completeTask,
    expertClaimInput,
    setExpertClaimInput,
    recentClaims,
    filteredRecents,
    recentFilter,
    setRecentFilter,
    summaries,
    stepTones,
    runningActivity,
    docsProvided,
    toast,
    setToast,
    deleteClaimLocal,
  };
}

/* ------------------ blocks ------------------ */

function ProcessStepsBlock({ stepTones }: { stepTones: StepTone[] }) {
  return (
    <Card>
      <SectionHeader
        title="Process steps"
        subtitle="Computed from history + current activity."
        icon={<ListChecks className="h-5 w-5" />}
      />
      <div className="mt-4 space-y-3">
        {PROCESS_STEPS.map((s, idx) => {
          const tone: Tone =
            stepTones[idx] === "good" ? "good" : stepTones[idx] === "warn" ? "warn" : stepTones[idx] === "bad" ? "bad" : "muted";

          const StepIcon =
            s.key === "submitted"
              ? FileText
              : s.key === "identity"
              ? Shield
              : s.key === "policy"
              ? Shield
              : s.key === "fraud"
              ? AlertTriangle
              : s.key === "docs"
              ? FileText
              : s.key === "expert"
              ? Gavel
              : s.key === "payment"
              ? CreditCard
              : CheckCircle2;

          return (
            <div
              key={s.key}
              className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3 flex items-start gap-3"
            >
              <div className="mt-0.5 flex items-center gap-2">
                <ToneDot tone={tone} />
                <StepIcon className="h-4 w-4 text-slate-300" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">{s.title}</div>
                <div className="mt-1 text-xs text-slate-400">{s.hint}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ClaimDetailsBlock({
  mode,
  selectedClaimId,
  claim,
  wf,
  history,
  tasks,
  runningActivity,
  stepTones,
  busy,
  startRes,
  docsProvided,
  onCompleteTask,
  onCopy,
  onMarkDocs,
  err,
  policyFallback,
}: {
  mode: Role;
  selectedClaimId: string;
  claim: Claim | null;
  wf: WorkflowState | null;
  history: ClaimHistoryEvent[];
  tasks: TaskDto[];
  runningActivity: string;
  stepTones: StepTone[];
  busy: boolean;
  startRes: WorkflowStartRes | null;
  docsProvided: boolean;
  onCompleteTask: (t: TaskDto, vars: Record<string, any>) => void;
  onCopy: () => void;
  onMarkDocs?: (v: boolean) => void;
  err?: string;
  policyFallback?: string;
}) {
  if (!selectedClaimId) {
    return (
      <Card>
        <SectionHeader title="Case" subtitle="Select a claim to see details." icon={<FileText className="h-5 w-5" />} />
        <div className="mt-4 text-sm text-slate-400">No claim selected.</div>
      </Card>
    );
  }

  const statusTone = toneFromStatus(claim?.status);
  const wfTone: Tone = String(wf?.state ?? "").toUpperCase() === "RUNNING" ? "warn" : "good";

  const runningLabel =
    runningActivity === "ut_docs"
      ? "Document Review (waiting for expert)"
      : runningActivity === "ut_expert"
      ? "Expert Assessment (waiting for expert)"
      : runningActivity
      ? `Running: ${runningActivity}`
      : "";

  return (
    <Card>
      <SectionHeader
        title="Case overview"
        subtitle="Timeline + tasks"
        icon={<FileText className="h-5 w-5" />}
        right={
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-slate-800 bg-white/5 px-3 py-1 text-xs text-slate-200 flex items-center gap-2">
              <ToneDot tone={statusTone} />
              <span className="font-semibold">{claim?.status ?? "—"}</span>
            </div>
            <div className="rounded-full border border-slate-800 bg-white/5 px-3 py-1 text-xs text-slate-200 flex items-center gap-2">
              <ToneDot tone={wfTone} />
              <span className="font-semibold">{wf?.state ?? "—"}</span>
            </div>
          </div>
        }
      />

      {runningLabel && (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">{runningLabel}</span>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-xs text-slate-400">Customer</div>
          <div className="mt-1 text-sm font-semibold">{claim?.fullName ?? "—"}</div>
          <div className="mt-1 text-xs text-slate-400 font-mono">{claim?.customerId ?? "—"}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-xs text-slate-400">Claimed amount</div>
          <div className="mt-1 text-sm font-semibold">{fmtAmount(claim?.claimedAmount)}</div>
          <div className="mt-1 text-xs text-slate-400">Policy: <span className="font-mono">{claim?.policyNumber ?? policyFallback ?? "—"}</span></div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="text-xs text-slate-400">Description</div>
        <div className="mt-1 text-sm text-slate-100">{claim?.description ?? "—"}</div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="text-sm font-semibold">What happens now?</div>
        <div className="mt-1 text-xs text-slate-400">{getNowMessage(runningActivity, wf?.state, claim?.status)}</div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-xs text-slate-400">Claim ID</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="font-mono text-sm text-slate-100 truncate">{selectedClaimId}</div>
            <Btn variant="secondary" leftIcon={<ClipboardCopy className="h-4 w-4" />} onClick={onCopy}>
              Copy
            </Btn>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-xs text-slate-400">Process instance</div>
          <div className="mt-1 font-mono text-xs text-slate-100 break-all">
            {wf?.processInstanceId ?? startRes?.processInstanceId ?? "—"}
          </div>
        </div>
      </div>

      {mode === "customer" && onMarkDocs && selectedClaimId && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Documents (simulated)</div>
              <div className="mt-1 text-xs text-slate-400">
                Status: <span className="font-semibold">{docsProvided ? "Uploaded" : "Missing"}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Btn
                variant="secondary"
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => onMarkDocs(true)}
                disabled={busy}
              >
                Mark uploaded
              </Btn>
              <Btn
                variant="danger"
                leftIcon={<XCircle className="h-4 w-4" />}
                onClick={() => onMarkDocs(false)}
                disabled={busy}
              >
                Clear
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-slate-800 pt-4">
        <SectionHeader title="User tasks" subtitle={mode === "customer" ? "Read-only (expert will complete)" : "Complete tasks here"} icon={<Gavel className="h-5 w-5" />} />

        {tasks.length === 0 ? (
          <div className="mt-3 text-sm text-slate-400">No active user tasks right now.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {tasks.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="mt-1 text-xs text-slate-400 font-mono break-all">
                      {t.taskDefinitionKey} · {t.id}
                    </div>
                  </div>

                  {mode !== "customer" ? (
                    <div className="flex flex-wrap gap-2">
                      {t.taskDefinitionKey === "ut_docs" && (
                        <>
                          <Btn
                            variant="primary"
                            leftIcon={<CheckCircle2 className="h-4 w-4" />}
                            disabled={busy}
                            onClick={() => onCompleteTask(t, { docsOk: true })}
                          >
                            Docs OK
                          </Btn>
                          <Btn
                            variant="danger"
                            leftIcon={<XCircle className="h-4 w-4" />}
                            disabled={busy}
                            onClick={() => onCompleteTask(t, { docsOk: false })}
                          >
                            Docs Missing
                          </Btn>
                        </>
                      )}

                      {t.taskDefinitionKey === "ut_expert" && (
                        <>
                          <Btn
                            variant="primary"
                            leftIcon={<CheckCircle2 className="h-4 w-4" />}
                            disabled={busy}
                            onClick={() => onCompleteTask(t, { expertDecision: "APPROVE" })}
                          >
                            Approve
                          </Btn>
                          <Btn
                            variant="danger"
                            leftIcon={<XCircle className="h-4 w-4" />}
                            disabled={busy}
                            onClick={() => onCompleteTask(t, { expertDecision: "REJECT" })}
                          >
                            Reject
                          </Btn>
                        </>
                      )}

                      {t.taskDefinitionKey !== "ut_docs" && t.taskDefinitionKey !== "ut_expert" && (
                        <Btn variant="secondary" disabled={busy} onClick={() => onCompleteTask(t, {})}>
                          Complete
                        </Btn>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">Pending expert action</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <SectionHeader title="Claim history" subtitle="Events from the claim service" icon={<FileText className="h-5 w-5" />} />
        <div className="mt-4 space-y-3">
          {history.length === 0 && <div className="text-sm text-slate-400">No history yet.</div>}
          {history.map((e, idx) => {
            const t = toneFromStatus(e.status);
            return (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="flex items-start gap-2">
                  <ToneDot tone={t} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{String(e.status ?? "—")}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {fmt(e.at)} · {String(e.message ?? "")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {err && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {err}
        </div>
      )}
    </Card>
  );
}

/* ------------------ Customer page ------------------ */

function CustomerPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const w = useWorkspace(session);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {w.toast && <Toast kind={w.toast.kind} text={w.toast.text} onClose={() => w.setToast(null)} />}

      <TopBar
        session={session}
        onLogout={onLogout}
        onRefresh={() => w.refreshAll()}
        selectedClaimId={w.selectedClaimId}
        busy={w.busy}
        autoRefresh={w.autoRefresh}
        setAutoRefresh={w.setAutoRefresh}
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-12 items-start">
          {/* Left column */}
          <div className="lg:col-span-4 space-y-4">
            <Card>
              <SectionHeader
                title="Submit a new claim"
                subtitle="Customer"
                icon={<Plus className="h-5 w-5" />}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Customer ID</div>
                  <Input value={w.form.customerId} onChange={(v) => w.setForm({ ...w.form, customerId: v })} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Full name</div>
                  <Input value={w.form.fullName} onChange={(v) => w.setForm({ ...w.form, fullName: v })} />
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Policy number</div>
                  <Input value={w.form.policyNumber} onChange={(v) => w.setForm({ ...w.form, policyNumber: v })} />
                  <div className="mt-2 text-xs text-slate-400">
                    Demo policies:
                    <div className="mt-1 space-y-1">
                      {DEMO_POLICIES.map((p) => (
                        <div key={p.policyNumber} className="text-xs text-slate-300">
                          <span className="font-mono text-slate-200">{p.policyNumber}</span> — {p.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1">Claim type</div>
                  <Select value={w.form.claimType} onChange={(v) => w.setForm({ ...w.form, claimType: v as ClaimType })}>
                    {CLAIM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Claimed amount</div>
                  <Input
                    value={String(w.form.claimedAmount)}
                    type="number"
                    onChange={(v) => w.setForm({ ...w.form, claimedAmount: Number(v) })}
                  />
                  {Number(w.form.claimedAmount) > 10000 && (
                    <div className="mt-1 text-xs text-amber-200/80">
                      Note: High amounts may increase fraud risk (demo rule).
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1">Description</div>
                  <Input value={w.form.description} onChange={(v) => w.setForm({ ...w.form, description: v })} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Btn variant="primary" onClick={w.onStart} disabled={w.busy} leftIcon={<Plus className="h-4 w-4" />}>
                  {w.busy ? "Starting..." : "Start workflow"}
                </Btn>
                <Btn
                  variant="secondary"
                  onClick={() => w.setForm({ ...w.form, policyNumber: "P-1001" })}
                  disabled={w.busy}
                >
                  Happy path preset
                </Btn>
                <Btn
                  variant="danger"
                  onClick={() => w.setForm({ ...w.form, policyNumber: "P-1000" })}
                  disabled={w.busy}
                >
                  Force Identity Fail (…0)
                </Btn>
              </div>

              {w.err && (
                <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {w.err}
                </div>
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Track a claim"
                subtitle="Paste a Claim ID (businessKey) to open it instantly."
                icon={<Search className="h-5 w-5" />}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Claim ID</div>
                  <Input
                    value={w.expertClaimInput}
                    onChange={w.setExpertClaimInput}
                    placeholder="CLM-xxxxxxx"
                  />
                </div>
                <Btn
                  variant="primary"
                  leftIcon={<Search className="h-4 w-4" />}
                  disabled={!w.expertClaimInput.trim() || w.busy}
                  onClick={() => w.loadExisting(w.expertClaimInput.trim())}
                >
                  Open
                </Btn>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="text-sm font-semibold">Recent claims</div>
                <div className="text-xs text-slate-400">{w.recentClaims.length}</div>
              </div>

              <div className="mt-2">
                <Input value={w.recentFilter} onChange={w.setRecentFilter} placeholder="Filter claim id…" />
              </div>

              <div className="mt-3 space-y-2">
                {w.filteredRecents.length === 0 && <div className="text-sm text-slate-400">No recent claims yet.</div>}

                {w.filteredRecents.map((id) => {
                  const s = w.summaries[id];
                  const tone = toneFromStatus(s?.status);

                  return (
                    <button
                      key={id}
                      onClick={() => w.loadExisting(id)}
                      className={cx(
                        "w-full text-left rounded-2xl border p-3 transition",
                        id === w.selectedClaimId
                          ? "border-indigo-500/40 bg-indigo-500/10"
                          : "border-slate-800 bg-slate-950/30 hover:bg-white/5"
                      )}
                      title="Open case"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ToneDot tone={tone} />
                            <div className="text-sm font-semibold truncate">
                              {s === undefined ? "Loading…" : s === null ? "Unknown customer" : s.fullName}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-2">
                            <span className="font-mono">{id}</span>
                            {s && (
                              <>
                                <span>·</span>
                                <span>{fmtAmount(s.claimedAmount)}</span>
                              </>
                            )}
                          </div>
                          {s?.description && <div className="mt-1 text-xs text-slate-400">{truncate(s.description)}</div>}
                        </div>
                        <div className="text-xs text-slate-400">open</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Middle */}
          <div className="lg:col-span-4">
            <ProcessStepsBlock stepTones={w.stepTones} />
          </div>

          {/* Right */}
          <div className="lg:col-span-4 space-y-4">
            <ClaimDetailsBlock
              mode="customer"
              selectedClaimId={w.selectedClaimId}
              claim={w.claim}
              wf={w.wf}
              history={w.history}
              tasks={w.tasks}
              runningActivity={w.runningActivity}
              stepTones={w.stepTones}
              busy={w.busy}
              startRes={w.startRes}
              docsProvided={w.docsProvided}
              onCompleteTask={w.completeTask}
              onCopy={async () => {
                const ok = await copyToClipboard(w.selectedClaimId);
                w.setToast({ kind: ok ? "success" : "error", text: ok ? "Claim ID copied." : "Copy failed." });
              }}
              onMarkDocs={(v) => {
                if (!w.selectedClaimId) return;
                setDocsProvided(w.selectedClaimId, v);
                w.setToast({
                  kind: v ? "success" : "warn",
                  text: v ? `Documents marked as uploaded for ${w.selectedClaimId} (simulated).` : `Documents cleared for ${w.selectedClaimId} (simulated).`,
                });
              }}
              err={w.err}
              policyFallback={w.form.policyNumber}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------ Expert page ------------------ */

function ExpertPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const w = useWorkspace(session);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {w.toast && <Toast kind={w.toast.kind} text={w.toast.text} onClose={() => w.setToast(null)} />}

      <TopBar
        session={session}
        onLogout={onLogout}
        onRefresh={() => w.refreshAll()}
        selectedClaimId={w.selectedClaimId}
        busy={w.busy}
        autoRefresh={w.autoRefresh}
        setAutoRefresh={w.setAutoRefresh}
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-12 items-start">
          {/* Left */}
          <div className="lg:col-span-4 space-y-4">
            <Card>
              <SectionHeader title="Expert desk" subtitle="Load a claim + complete tasks" icon={<Gavel className="h-5 w-5" />} />

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Load claim by ID</div>
                  <Input value={w.expertClaimInput} onChange={w.setExpertClaimInput} placeholder="CLM-xxxxxxx" />
                </div>
                <Btn
                  variant="primary"
                  leftIcon={<Search className="h-4 w-4" />}
                  disabled={!w.expertClaimInput.trim() || w.busy}
                  onClick={() => w.loadExisting(w.expertClaimInput.trim())}
                >
                  Load
                </Btn>
              </div>

              {w.selectedClaimId && (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Documents status</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Documents provided (simulated): <span className="font-semibold">{w.docsProvided ? "YES" : "NO"}</span>
                      </div>
                    </div>
                    <ToneDot tone={w.docsProvided ? "good" : "warn"} />
                  </div>
                  {!w.docsProvided && (
                    <div className="mt-2 text-xs text-amber-200/80">
                      If customer didn’t provide documents, choose “Docs Missing”.
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm font-semibold">Recent cases</div>
                <div className="text-xs text-slate-400">{w.recentClaims.length}</div>
              </div>

              <div className="mt-2">
                <Input value={w.recentFilter} onChange={w.setRecentFilter} placeholder="Filter claim id…" />
              </div>

              <div className="mt-3 space-y-2">
                {w.filteredRecents.length === 0 && <div className="text-sm text-slate-400">No recent claims yet.</div>}
                {w.filteredRecents.map((id) => (
                  <button
                    key={id}
                    onClick={() => w.loadExisting(id)}
                    className={cx(
                      "w-full text-left rounded-2xl border px-3 py-2 transition flex items-center justify-between",
                      id === w.selectedClaimId
                        ? "border-indigo-500/40 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-950/30 hover:bg-white/5"
                    )}
                  >
                    <span className="font-mono text-xs text-slate-200">{id}</span>
                    <span className="text-xs text-slate-400">open</span>
                  </button>
                ))}
              </div>

              {w.err && (
                <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {w.err}
                </div>
              )}
            </Card>
          </div>

          {/* Right */}
          <div className="lg:col-span-8 space-y-4">
            <ProcessStepsBlock stepTones={w.stepTones} />

            <ClaimDetailsBlock
              mode="expert"
              selectedClaimId={w.selectedClaimId}
              claim={w.claim}
              wf={w.wf}
              history={w.history}
              tasks={w.tasks}
              runningActivity={w.runningActivity}
              stepTones={w.stepTones}
              busy={w.busy}
              startRes={w.startRes}
              docsProvided={w.docsProvided}
              onCompleteTask={w.completeTask}
              onCopy={async () => {
                const ok = await copyToClipboard(w.selectedClaimId);
                w.setToast({ kind: ok ? "success" : "error", text: ok ? "Claim ID copied." : "Copy failed." });
              }}
              err={w.err}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------ Admin page (UI-only controls for now) ------------------ */

function AdminPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const w = useWorkspace(session);

  const [users, setUsers] = useState<DemoUser[]>(() => seedUsersIfMissing());
  const [newRole, setNewRole] = useState<Role>("customer");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");

  // --- REAL claims list (from REST) ---
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [claimsQ, setClaimsQ] = useState("");
  const [claimsBusy, setClaimsBusy] = useState(false);

  async function reloadClaims() {
    setClaimsBusy(true);
    w.setToast(null);
    try {
      const list = await claimList();
      setAllClaims(Array.isArray(list) ? list : []);
    } catch (e: any) {
      w.setToast({ kind: "error", text: String(e?.message ?? e) });
    } finally {
      setClaimsBusy(false);
    }
  }

  useEffect(() => {
    reloadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAllClaims = useMemo(() => {
    const q = claimsQ.trim().toLowerCase();
    if (!q) return allClaims;
    return allClaims.filter((c) =>
      [c.id, c.fullName, c.customerId, c.policyNumber, c.status, c.description]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q))
    );
  }, [allClaims, claimsQ]);

  async function deleteClaimReal(id: string) {
    const ok = window.confirm(`Delete claim ${id}?`);
    if (!ok) return;

    setClaimsBusy(true);
    try {
      await claimDelete(id);
      setAllClaims((prev) => prev.filter((c) => c.id !== id));

      // also keep UI consistent
      w.deleteClaimLocal(id);

      w.setToast({ kind: "success", text: `Claim deleted: ${id}` });
    } catch (e: any) {
      w.setToast({ kind: "error", text: String(e?.message ?? e) });
    } finally {
      setClaimsBusy(false);
    }
  }

  function addUser() {
    const u: DemoUser = {
      id: crypto.randomUUID(),
      role: newRole,
      username: newUsername.trim() || (newRole === "customer" ? "customer" : newRole === "expert" ? "expert" : "admin"),
      displayName: newDisplayName.trim() || "New user",
      customerId: newRole === "customer" ? (newCustomerId.trim() || `CUST-${Math.floor(Math.random() * 9999)}`) : undefined,
    };
    const next = [u, ...users];
    setUsers(next);
    writeUsers(next);
    w.setToast({ kind: "success", text: `User created (demo UI): ${u.displayName}` });

    setNewUsername("");
    setNewDisplayName("");
    setNewCustomerId("");
  }

  function removeUser(id: string) {
    const next = users.filter((u) => u.id !== id);
    setUsers(next);
    writeUsers(next);
    w.setToast({ kind: "warn", text: "User deleted (demo UI)." });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {w.toast && <Toast kind={w.toast.kind} text={w.toast.text} onClose={() => w.setToast(null)} />}

      <TopBar
        session={session}
        onLogout={onLogout}
        onRefresh={() => {
          w.refreshAll();
          reloadClaims();
        }}
        selectedClaimId={w.selectedClaimId}
        busy={w.busy || claimsBusy}
        autoRefresh={w.autoRefresh}
        setAutoRefresh={w.setAutoRefresh}
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-12 items-start">
          {/* Left: users (demo) */}
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <SectionHeader title="Admin console" subtitle="Full control (demo UI)" icon={<Shield className="h-5 w-5" />} />

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> User management (demo)
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Role</div>
                    <Select value={newRole} onChange={(v) => setNewRole(v as Role)}>
                      <option value="customer">customer</option>
                      <option value="expert">expert</option>
                      <option value="admin">admin</option>
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs text-slate-400 mb-1">Username</div>
                    <Input value={newUsername} onChange={setNewUsername} placeholder="e.g. expert2" />
                  </div>

                  <div>
                    <div className="text-xs text-slate-400 mb-1">Display name</div>
                    <Input value={newDisplayName} onChange={setNewDisplayName} placeholder="e.g. John Expert" />
                  </div>

                  {newRole === "customer" ? (
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Customer ID</div>
                      <Input value={newCustomerId} onChange={setNewCustomerId} placeholder="e.g. CUST-9" />
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="mt-3">
                  <Btn variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={addUser}>
                    Create user
                  </Btn>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{u.displayName}</div>
                      <div className="mt-1 text-xs text-slate-400 font-mono">
                        {u.role} · {u.username} {u.customerId ? `· ${u.customerId}` : ""}
                      </div>
                    </div>
                    <Btn variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => removeUser(u.id)}>
                      Delete
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right: claims (REAL) */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <SectionHeader
                title="Claims control"
                subtitle="List / open / delete (REST)"
                icon={<FileText className="h-5 w-5" />}
                right={
                  <Btn
                    variant="secondary"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                    onClick={reloadClaims}
                    disabled={claimsBusy}
                  >
                    Refresh list
                  </Btn>
                }
              />

              <div className="mt-4">
                <Input value={claimsQ} onChange={setClaimsQ} placeholder="Search by id, customer, status..." />
              </div>

              <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/30">
                {filteredAllClaims.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No claims.</div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {filteredAllClaims.map((c) => {
                      const tone = toneFromStatus(c.status);
                      return (
                        <div key={c.id} className="p-3 flex items-start justify-between gap-3">
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => w.loadExisting(c.id)}
                            title="Open claim"
                          >
                            <div className="flex items-center gap-2">
                              <ToneDot tone={tone} />
                              <div className="text-sm font-semibold truncate">{c.fullName}</div>
                              <div className="text-xs text-slate-400 truncate">{fmtAmount(c.claimedAmount)}</div>
                            </div>
                            <div className="mt-1 text-xs text-slate-400 font-mono truncate">{c.id}</div>
                            {c.description && <div className="mt-1 text-xs text-slate-400">{truncate(c.description)}</div>}
                          </button>

                          <div className="flex flex-col gap-2">
                            <Btn
                              variant="secondary"
                              leftIcon={<Search className="h-4 w-4" />}
                              onClick={() => w.loadExisting(c.id)}
                              disabled={claimsBusy}
                            >
                              Open
                            </Btn>

                            <Btn
                              variant="danger"
                              leftIcon={<Trash2 className="h-4 w-4" />}
                              onClick={() => deleteClaimReal(c.id)}
                              disabled={claimsBusy}
                            >
                              Delete
                            </Btn>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Delete is executed on the REST claim service (and also cleans local “recents/docs” in UI).
              </div>
            </Card>

            <ClaimDetailsBlock
              mode="admin"
              selectedClaimId={w.selectedClaimId}
              claim={w.claim}
              wf={w.wf}
              history={w.history}
              tasks={w.tasks}
              runningActivity={w.runningActivity}
              stepTones={w.stepTones}
              busy={w.busy || claimsBusy}
              startRes={w.startRes}
              docsProvided={w.docsProvided}
              onCompleteTask={w.completeTask}
              onCopy={async () => {
                const ok = await copyToClipboard(w.selectedClaimId);
                w.setToast({ kind: ok ? "success" : "error", text: ok ? "Claim ID copied." : "Copy failed." });
              }}
              err={w.err}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------ App root ------------------ */

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  function onLogin(s: Session) {
    setSession(s);
    saveSession(s);
  }
  function onLogout() {
    saveSession(null);
    setSession(null);
  }

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to={routeForRole(session.role)} replace /> : <Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginPage onLogin={onLogin} session={session} />} />

      <Route
        path="/customer"
        element={
          <RequireRole session={session} role="customer">
            <CustomerPage session={session as Session} onLogout={onLogout} />
          </RequireRole>
        }
      />

      <Route
        path="/expert"
        element={
          <RequireRole session={session} role="expert">
            <ExpertPage session={session as Session} onLogout={onLogout} />
          </RequireRole>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireRole session={session} role="admin">
            <AdminPage session={session as Session} onLogout={onLogout} />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
