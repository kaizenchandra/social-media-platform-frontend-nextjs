import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type { PublicationAdapter } from "./adapter";
import type {
  Publication,
  PublicationResult,
  PublicationState,
  Decision,
} from "@/features/publication/contracts";
import { cancellableStates } from "@/features/publication/contracts";
import {
  publicationCommand,
  type PublicationCommand,
} from "@/features/publication/validation";
import { transition } from "@/features/publication/state-machine";
import type { AuthErrorCode } from "@/features/auth/contracts";
export const publicationFailure = (
  code: AuthErrorCode,
  message: string,
  retryable = false,
): { ok: false; error: import("@/features/auth/contracts").AuthError } => ({
  ok: false,
  error: { code, message, retryable },
});
export function createDevelopmentPublicationAdapter(
  environment: { nodeEnv: string; mode: string },
  active: (id: string) => Promise<boolean>,
  now = () => Date.now(),
): PublicationAdapter {
  if (
    process.env.NODE_ENV === "production" ||
    environment.nodeEnv !== "development" ||
    environment.mode !== "mock"
  )
    throw new Error("Publication preview is disabled.");
  const items = new Map<string, { actorId: string; item: Publication }>();
  const replays = new Map<
    string,
    { fingerprint: string; id: string; expires: number }
  >();
  const locks = new Map<string, Promise<void>>();
  const result = (item: Publication): PublicationResult => ({
    ok: true,
    item: structuredClone(item),
  });
  const denied = () =>
    publicationFailure(
      "forbidden",
      "This content is unavailable or does not belong to this account.",
    );
  async function read(actorId: string, id: string) {
    if (!(await active(actorId)))
      return publicationFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const record = items.get(id);
    return record?.actorId === actorId ? result(record.item) : denied();
  }
  function change(
    item: Publication,
    state: PublicationState,
    explanation: string,
    decision: Decision | null = null,
  ) {
    item.state = transition(item.state, state, decision ?? undefined, true);
    item.explanation = explanation;
    item.decision = decision;
  }
  async function execute(
    actorId: string,
    input: PublicationCommand,
    requestId: string,
  ): Promise<PublicationResult> {
    if (!(await active(actorId)))
      return publicationFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const parsed = publicationCommand.safeParse(input);
    if (!parsed.success || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId))
      return publicationFailure("validation", "Check the supplied values.");
    const command = parsed.data;
    let record = command.id ? items.get(command.id) : undefined;
    if (command.id && record?.actorId !== actorId) return denied();
    // Public distribution is impossible even after a simulated approval/replay.
    if (command.operation === "publish")
      return publicationFailure(
        "forbidden",
        "Public distribution is disabled. A simulated approval is not a backend publication grant.",
      );
    const key = `${actorId}:${requestId}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    for (const [id, replay] of replays)
      if (replay.expires <= now()) replays.delete(id);
    const replay = replays.get(key);
    if (replay) {
      if (replay.fingerprint !== fingerprint)
        return publicationFailure(
          "conflict",
          "The retry changed. Reload before continuing.",
        );
      const current = items.get(replay.id);
      return current?.actorId === actorId ? result(current.item) : denied();
    }
    if (
      record &&
      "version" in command &&
      record.item.version !== command.version
    )
      return publicationFailure(
        "conflict",
        "This content changed. Reload its status before continuing.",
      );
    if (command.operation === "save") {
      if (record && record.item.state !== "DRAFT")
        return publicationFailure(
          "conflict",
          "Create a new draft revision to change content after submission.",
        );
      if (!record) {
        if (
          items.size >= 500 ||
          [...items.values()].filter((r) => r.actorId === actorId).length >= 20
        )
          return publicationFailure(
            "unavailable",
            "The preview draft limit was reached. Restarting development clears its synthetic store.",
          );
        record = {
          actorId,
          item: {
            id: randomUUID(),
            version: 0,
            state: "DRAFT",
            mode: "simulated",
            draft: command.draft,
            progress: 0,
            attempt: 0,
            updatedAt: new Date(now()).toISOString(),
            targetAt: null,
            decision: null,
            retryable: false,
            explanation:
              "Private preview draft saved. File bytes are not stored or transferred.",
            distributionEnabled: false,
          },
        };
        items.set(record.item.id, record);
      }
      record.item.draft = command.draft;
    } else {
      if (!record) return denied();
      const item = record.item;
      if (command.operation === "cancel") {
        if (!cancellableStates.includes(item.state))
          return publicationFailure(
            "conflict",
            "This workflow is not cancellable. Reload its latest state.",
          );
        change(
          item,
          "CANCELLED",
          "Simulation cancelled. No file bytes were transferred and no content was published.",
        );
        item.retryable = false;
      } else if (
        command.operation === "begin" ||
        command.operation === "retry"
      ) {
        if (
          (command.operation === "begin" && item.state !== "DRAFT") ||
          (command.operation === "retry" &&
            (item.state !== "FAILED" || !item.retryable || item.attempt >= 3))
        )
          return publicationFailure(
            "conflict",
            "This workflow cannot start or retry in its current state.",
          );
        change(
          item,
          "VALIDATING",
          "Validating declared metadata in the preview. This is not a file-byte or safety inspection.",
        );
        item.attempt++;
        item.progress = 0;
        item.retryable = false;
        item.targetAt = null;
      } else if (command.operation === "advance") {
        if (item.state === "VALIDATING")
          change(
            item,
            "UPLOADING",
            "Simulated transfer. File bytes remain on your device.",
          );
        else if (item.state === "UPLOADING") {
          if (
            item.draft.scenario === "upload-interruption" &&
            item.attempt === 1 &&
            item.progress >= 50
          ) {
            change(
              item,
              "FAILED",
              "Simulated upload interruption. Retry the same private workflow; nothing was published.",
            );
            item.retryable = true;
          } else if (item.progress < 100) {
            item.progress += 25;
            change(
              item,
              "UPLOADING",
              "Simulated transfer progress only. File bytes remain on your device.",
            );
          } else
            change(
              item,
              "PROCESSING",
              "Transfer simulation completed. Processing is pending; transfer completion does not approve publication.",
            );
        } else if (item.state === "PROCESSING")
          change(
            item,
            "SCREENING",
            "Simulated screening pending. No detector, malware scanner or moderation service is connected.",
          );
        else if (item.state === "SCREENING") {
          const scenario = item.draft.scenario;
          const evidence = (
            reason: string,
            appealEligible: boolean,
          ): Decision => ({
            source: "simulation",
            id: randomUUID(),
            reason,
            appealEligible,
          });
          if (scenario === "review" || scenario === "moderation-timeout") {
            change(
              item,
              "REVIEW_REQUIRED",
              scenario === "review"
                ? "Simulated human review required. The 24-hour target is not publication permission."
                : "Simulated moderation timeout: the review target is overdue. Content stays held; no automatic approval or real escalation occurred.",
            );
            item.targetAt = new Date(
              now() + (scenario === "review" ? 24 * 60 * 60_000 : -60 * 60_000),
            ).toISOString();
          } else if (scenario === "rejected")
            change(
              item,
              "REJECTED",
              "Simulated sexual-content policy rejection fixture. This is a scripted explanation, not analysis of your file. No distribution is permitted.",
              evidence("sexual-content-policy", true),
            );
          else if (scenario === "restricted")
            change(
              item,
              "RESTRICTED",
              "Simulated authenticity/consent concern fixture. This does not prove that media is a deepfake or non-consensual. No distribution is permitted.",
              evidence("authenticity-consent-review", true),
            );
          else
            change(
              item,
              "APPROVED",
              "Simulated low-risk fixture outcome only. No authoritative screening decision exists; publication remains disabled.",
              evidence("low-risk-fixture", false),
            );
        } else
          return publicationFailure(
            "conflict",
            "No further preview step is available. A real decision service is required.",
          );
      }
    }
    record!.item.version++;
    record!.item.updatedAt = new Date(now()).toISOString();
    if (replays.size >= 1000) replays.delete(replays.keys().next().value!);
    replays.set(key, {
      fingerprint,
      id: record!.item.id,
      expires: now() + 5 * 60_000,
    });
    return result(record!.item);
  }
  return {
    read,
    async list(actorId) {
      if (!(await active(actorId)))
        return publicationFailure(
          "unauthorized",
          "Your session expired. Sign in again.",
        );
      return {
        ok: true,
        items: [...items.values()]
          .filter((record) => record.actorId === actorId)
          .map((record) => structuredClone(record.item))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      };
    },
    async execute(actorId, command, requestId) {
      const previous = locks.get(actorId);
      let release!: () => void;
      const current = new Promise<void>((done) => {
        release = done;
      });
      locks.set(actorId, current);
      try {
        await previous;
        return await execute(actorId, command, requestId);
      } finally {
        release();
        if (locks.get(actorId) === current) locks.delete(actorId);
      }
    },
  };
}
