const BASE = "http://localhost:4000";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  final_text: string | null;
  assignment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  document_id: string;
  start_time: string;
  end_time: string | null;
  active_time_seconds: number;
  idle_time_seconds: number;
}

export interface Snapshot {
  id: string;
  session_id: string;
  version: number;
  word_count: number | null;
  created_at: string;
}

export interface KeystrokeEvent {
  timestamp: string;
  event_type: "insert" | "delete" | "paste" | "pause" | "resume";
  char_count_delta: number;
  cursor_position: number;
  paragraph_index?: number;
}

export interface Assignment {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  code: string;
  created_at: string;
  submission_count?: number;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  document_id: string;
  submitted_at: string;
}

export interface ConfidenceBreakdownItem {
  label: string;
  score: number;
  max: number;
}

export interface SubmissionWithDetails extends Submission {
  student_name: string;
  student_email: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidence_score: number;
  confidence_breakdown: ConfidenceBreakdownItem[];
}

function getToken() {
  return localStorage.getItem("token");
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export const api = {
  auth: {
    register: (body: { name: string; email: string; password: string; role?: string }) =>
      request<{ token: string; user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    me: () => request<User>("/api/auth/me"),
  },
  documents: {
    list: () => request<Document[]>("/api/documents"),
    create: (title: string, assignment_id?: string) =>
      request<Document>("/api/documents", {
        method: "POST",
        body: JSON.stringify({ title, assignment_id }),
      }),
    get: (id: string) => request<Document>(`/api/documents/${id}`),
    update: (id: string, body: Partial<{ title: string; final_text: string }>) =>
      request<Document>(`/api/documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<void>(`/api/documents/${id}`, { method: "DELETE" }),
  },
  sessions: {
    start: (document_id: string) =>
      request<Session>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ document_id }),
      }),
    update: (
      id: string,
      body: { active_time_seconds?: number; idle_time_seconds?: number; end?: boolean }
    ) =>
      request<Session>(`/api/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    list: (document_id: string) =>
      request<Session[]>(`/api/sessions?document_id=${document_id}`),
  },
  snapshots: {
    save: (body: { session_id: string; content: string; word_count?: number }) =>
      request<Snapshot>("/api/snapshots", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    list: (session_id: string) =>
      request<Snapshot[]>(`/api/snapshots?session_id=${session_id}`),
  },
  events: {
    ingest: (session_id: string, events: KeystrokeEvent[]) =>
      request<{ inserted: number }>("/api/events", {
        method: "POST",
        body: JSON.stringify({ session_id, events }),
      }),
  },
  assignments: {
    list: () => request<Assignment[]>("/api/assignments"),
    create: (body: { title: string; description?: string; deadline?: string }) =>
      request<Assignment>("/api/assignments", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    get: (id: string) => request<Assignment>(`/api/assignments/${id}`),
    delete: (id: string) =>
      request<void>(`/api/assignments/${id}`, { method: "DELETE" }),
    getSubmissions: (id: string) =>
      request<SubmissionWithDetails[]>(`/api/assignments/${id}/submissions`),
    join: (code: string) =>
      request<Assignment>("/api/assignments/join", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
  },
  submissions: {
    submit: (body: { assignment_id: string; document_id: string }) =>
      request<Submission>("/api/submissions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    mySubmissions: () => request<Submission[]>("/api/submissions/my"),
  },
  ai: {
    feedback: (document_id: string) =>
      request<{ feedback: FeedbackItem[] }>("/api/ai/feedback", {
        method: "POST",
        body: JSON.stringify({ document_id }),
      }),
    detect: (document_id: string) =>
      request<AiDetectionResult>("/api/ai/detect", {
        method: "POST",
        body: JSON.stringify({ document_id }),
      }),
    nudge: (document_id: string) =>
      request<{ nudges: string[] }>("/api/ai/nudge", {
        method: "POST",
        body: JSON.stringify({ document_id }),
      }),
    narrative: (document_id: string) =>
      request<{ narrative: string }>("/api/ai/narrative", {
        method: "POST",
        body: JSON.stringify({ document_id }),
      }),
    processRisk: (document_id: string) =>
      request<ProcessRiskResult>("/api/ai/process-risk", {
        method: "POST",
        body: JSON.stringify({ document_id }),
      }),
  },
};

export interface FeedbackItem {
  type: "clarity" | "grammar" | "argument";
  location: string;
  note: string;
}

export interface AiDetectionFlag {
  excerpt: string;
  reason: string;
}

export interface ProcessRiskFlag {
  signal: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export interface ProcessRiskResult {
  risk: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  flags: ProcessRiskFlag[];
}

export interface AiDetectionResult {
  score: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  flags: AiDetectionFlag[];
}
