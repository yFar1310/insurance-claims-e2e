export type ClaimStatus =
  | "SUBMITTED"
  | "IDENTITY_VERIFIED"
  | "IDENTITY_FAILED"
  | "POLICY_VALID"
  | "POLICY_INVALID"
  | "FRAUD_LOW"
  | "FRAUD_MEDIUM"
  | "FRAUD_HIGH"
  | "REJECTED"
  | "SUSPENDED"
  | "APPROVED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_FAILED"
  | "IN_REVIEW";

export type ClaimType = "ACCIDENT" | "THEFT" | "FIRE" | "HEALTH" | "OTHER";

export interface WorkflowStartReq {
  customerId: string;
  fullName: string;
  policyNumber: string;
  claimType: ClaimType;
  claimedAmount: number;
  description: string;
}

export interface WorkflowStartRes {
  processInstanceId: string;
  businessKey: string; // claimId
}

export interface ClaimHistoryEvent {
  at: string;
  status: ClaimStatus;
  message: string;
}

export interface Claim {
  id: string;
  customerId: string;
  fullName: string;
  policyNumber: string;
  claimType: ClaimType;
  claimedAmount: number;
  description: string;
  status: ClaimStatus;
  createdAt: string;
  history: ClaimHistoryEvent[];
}

export interface WorkflowState {
  processInstanceId: string;
  claimId: string;
  state: "RUNNING" | "FINISHED";
  activityId?: string[]; // e.g. ["ut_docs"]
}

export interface TaskDto {
  id: string;
  name: string;
  taskDefinitionKey: string; // e.g. ut_docs, ut_expert
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}\n${text}`);
  }
  return res.json() as Promise<T>;
}

// Workflow (via proxy /wf -> 8084)
export function wfStart(body: WorkflowStartReq) {
  return fetchJson<WorkflowStartRes>("/wf/api/workflow/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function wfState(claimId: string) {
  return fetchJson<WorkflowState>(`/wf/api/workflow/claims/${encodeURIComponent(claimId)}/state`);
}

export function wfTasksByInstance(processInstanceId: string) {
  return fetchJson<TaskDto[]>(
    `/wf/api/workflow/instances/${encodeURIComponent(processInstanceId)}/tasks`
  );
}

export function wfCompleteTask(taskId: string, vars: Record<string, any>) {
  return fetchJson<{ ok: boolean }>(`/wf/api/workflow/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: "POST",
    body: JSON.stringify(vars ?? {}),
  });
}

// Claim REST (via proxy /claim -> 8081)
export function claimGet(claimId: string) {
  return fetchJson<Claim>(`/claim/claims/${encodeURIComponent(claimId)}`);
}

export function claimHistory(claimId: string) {
  return fetchJson<ClaimHistoryEvent[]>(`/claim/claims/${encodeURIComponent(claimId)}/history`);
}
