import "server-only";
import type {
  Role,
  Privacy,
  SafetyCase,
  CaseView,
  Audit,
} from "@/features/trust/contracts";
import type { TrustCommand } from "@/features/trust/validation";
import type { Outcome } from "@/features/community/contracts";
export class TrustStore {
  private settings = new Map<string, Privacy>();
  private cases = new Map<string, SafetyCase>();
  private audit: Audit[] = [];
  private receipts = new Map<
    string,
    { fingerprint: string; result: Outcome }
  >();
  constructor(
    private roleOf: (id: string) => Role = () => "member",
    private now: () => number = Date.now,
  ) {}
  role(actor: string) {
    return this.roleOf(actor);
  }
  privacy(actor: string): Privacy {
    return {
      ...(this.settings.get(actor) ?? {
        version: 0,
        discoverable: true,
        audience: "public",
        loginAlerts: true,
        sessionReviewReminder: true,
      }),
    };
  }
  discoverable(actor: string) {
    return this.privacy(actor).discoverable;
  }
  private view(c: SafetyCase, actor: string): CaseView {
    // Evidence is never serialized, including to moderators; a specialist provider is unavailable.
    const { reporterId, evidence, ...safe } = c;
    void evidence;
    return {
      ...safe,
      appeal: safe.appeal ? { ...safe.appeal } : null,
      classifier: { ...safe.classifier },
      evidenceAvailable: false,
      canAppeal: reporterId === actor && c.status !== "pending" && !c.appeal,
      overdue:
        (c.status === "pending" || c.appeal?.status === "pending") &&
        this.now() > Date.parse(c.deadline),
      priority: c.category === "intimate-image-abuse" ? "urgent" : "normal",
    };
  }
  reports(actor: string) {
    return [...this.cases.values()]
      .filter((c) => c.reporterId === actor)
      .map((c) => this.view(c, actor));
  }
  queue(actor: string) {
    if (this.role(actor) === "member") return null;
    return [...this.cases.values()]
      .sort(
        (a, b) =>
          Number(b.category === "intimate-image-abuse") -
            Number(a.category === "intimate-image-abuse") ||
          Date.parse(a.deadline) - Date.parse(b.deadline),
      )
      .map((c) => this.view(c, actor));
  }
  audits(actor: string) {
    return this.role(actor) === "admin"
      ? this.audit.map((a) => ({ ...a }))
      : null;
  }
  evidence() {
    return null;
  }
  execute(actor: string, cmd: TrustCommand, requestId: string): Outcome {
    if (cmd.operation === "decision" && this.role(actor) === "member")
      return { ok: false, message: "Moderator access required." };
    const key = `${actor}:${requestId}`,
      fingerprint = JSON.stringify(cmd),
      receipt = this.receipts.get(key);
    if (receipt)
      return receipt.fingerprint === fingerprint
        ? receipt.result
        : {
            ok: false,
            message: "Request identity was reused for different input.",
          };
    const result = this.apply(actor, cmd);
    if (result.ok) {
      if (this.receipts.size >= 500)
        this.receipts.delete(this.receipts.keys().next().value!);
      this.receipts.set(key, { fingerprint, result });
    }
    return result;
  }
  private apply(actor: string, cmd: TrustCommand): Outcome {
    if (cmd.operation === "privacy") {
      const p = this.privacy(actor);
      if (p.version !== cmd.version)
        return {
          ok: false,
          message: "Privacy settings changed. Reload before saving.",
        };
      this.settings.set(actor, {
        version: p.version + 1,
        discoverable: cmd.discoverable,
        audience: cmd.audience,
        loginAlerts: cmd.loginAlerts,
        sessionReviewReminder: cmd.sessionReviewReminder,
      });
      return {
        ok: true,
        message:
          "Development privacy preferences saved. Security notifications are not connected.",
      };
    }
    if (cmd.operation === "report") {
      const id = crypto.randomUUID(),
        time = this.now();
      this.cases.set(id, {
        id,
        reporterId: actor,
        targetKind: cmd.targetKind,
        targetId: cmd.targetId,
        category: cmd.category,
        version: 0,
        submittedAt: new Date(time).toISOString(),
        deadline: new Date(
          time + (cmd.category === "intimate-image-abuse" ? 24 : 72) * 3600000,
        ).toISOString(),
        status: "pending",
        reason: "Awaiting simulated review",
        appeal: null,
        evidence: "restricted-unavailable",
        classifier: { assessment: "uncertain", proof: false },
      });
      this.audit.push({
        id: crypto.randomUUID(),
        caseId: id,
        actorId: actor,
        action: "report-created",
        at: new Date(time).toISOString(),
      });
      return {
        ok: true,
        message:
          "Simulated report recorded. No real moderation team has been contacted.",
      };
    }
    const c = this.cases.get(cmd.id);
    if (!c) return { ok: false, message: "Case unavailable." };
    if (cmd.operation === "appeal" && c.reporterId !== actor)
      return { ok: false, message: "Case unavailable." };
    if (cmd.operation === "decision" && this.role(actor) === "member")
      return { ok: false, message: "Moderator access required." };
    if (c.version !== cmd.version)
      return { ok: false, message: "Case changed. Reload before continuing." };
    if (cmd.operation === "appeal") {
      if (c.status === "pending" || c.appeal)
        return {
          ok: false,
          message: "An appeal is not available for this case.",
        };
      c.appeal = { text: cmd.text, status: "pending" };
      c.deadline = new Date(this.now() + 72 * 3600000).toISOString();
    } else {
      if (
        ["reverse", "uphold"].includes(cmd.decision) &&
        c.appeal?.status !== "pending"
      )
        return { ok: false, message: "A pending appeal is required." };
      if (
        ["restrict", "dismiss"].includes(cmd.decision) &&
        c.status !== "pending"
      )
        return {
          ok: false,
          message: "This initial review already has a decision.",
        };
      if (cmd.decision === "reverse") {
        c.status = "reversed";
        c.appeal!.status = "accepted";
      } else if (cmd.decision === "uphold") c.appeal!.status = "upheld";
      else c.status = cmd.decision === "restrict" ? "restricted" : "dismissed";
      c.reason = cmd.reason;
    }
    c.version++;
    this.audit.push({
      id: crypto.randomUUID(),
      caseId: c.id,
      actorId: actor,
      action: cmd.operation === "appeal" ? "appeal-submitted" : cmd.decision,
      at: new Date(this.now()).toISOString(),
    });
    return {
      ok: true,
      message:
        "Simulated case updated. This does not change publication approval or deliver a real moderation decision.",
    };
  }
}
