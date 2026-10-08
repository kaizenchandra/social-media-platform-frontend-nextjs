export type Role = "member" | "moderator" | "admin";
export type Privacy = {
  version: number;
  discoverable: boolean;
  audience: "public" | "friends" | "private";
  loginAlerts: boolean;
  sessionReviewReminder: boolean;
};
export type ReportCategory =
  "harassment" | "deepfake" | "intimate-image-abuse" | "spam" | "other";
export type SafetyCase = {
  id: string;
  reporterId: string;
  targetKind: "content" | "user" | "message" | "community";
  targetId: string;
  category: ReportCategory;
  version: number;
  submittedAt: string;
  deadline: string;
  status: "pending" | "restricted" | "dismissed" | "reversed";
  reason: string;
  appeal: null | { text: string; status: "pending" | "upheld" | "accepted" };
  evidence: "restricted-unavailable";
  classifier: { assessment: "uncertain"; proof: false };
};
export type CaseView = Omit<SafetyCase, "reporterId" | "evidence"> & {
  evidenceAvailable: false;
  canAppeal: boolean;
  overdue: boolean;
  priority: "urgent" | "normal";
};
export type Audit = {
  id: string;
  caseId: string;
  actorId: string;
  action: string;
  at: string;
};
