/**
 * KitchenBuddy Stage 4D — automatic, conservative reminder maintenance.
 *
 * The existing Stage 4C scheduler is the only writer of individual/grouped
 * expiry requests. This coordinator waits for durable Pantry writes, runs its
 * full reconciliation, and independently assesses the read-only native audit.
 *
 * NEVER invokes the manual legacy cleanup, cancels unknown requests, rebuilds
 * recurring water alarms, or drops water/expiry snoozes.
 *
 * Call startNotificationMaintenance() ONCE after successful Pantry hydration.
 * Existing incremental sync remains in features/pantry/persistence.ts.
 */
import { AppState, type AppStateStatus } from "react-native";
import { usePantryStore } from "@/features/pantry/store";
import { loadReminderSettings } from "./reminderStorage";
import { buildHybridExpiryPlan } from "./hybridExpiryPlanner";
import { syncExpiryReminders } from "./pantryReminderSync";
import { waitForExpiryReminderIdle } from "./expiryReminders";
import { waitForWaterReminderIdle } from "./waterReminders";
import { auditScheduledNotifications } from "./notificationAudit";
import {
  assessHybridNotificationIntegrity,
  type HybridIntegrityAssessment,
} from "./notificationIntegrity";

export type MaintenanceTrigger = "startup" | "foreground" | "manual";
export type MaintenanceResult = {
  trigger: MaintenanceTrigger;
  status: "healthy" | "attention" | "deferred";
  assessed: HybridIntegrityAssessment | null;
  /** Only the existing hybrid expiry scheduler is allowed to repair automatically. */
  expiryReconciled: boolean;
  pendingTotal: number | null;
};

type MaintenanceOptions = {
  /** Must flush the debounced Pantry writer AND await its save queue. */
  waitForPantryWrites: () => Promise<void>;
};

let installed = false;
let waitForPantryWrites: (() => Promise<void>) | null = null;
let activeRun: Promise<MaintenanceResult> | null = null;
let rerunRequested = false;
let nextTrigger: MaintenanceTrigger = "foreground";
let wentToBackground = false;

function assertHydrated(): void {
  const state = usePantryStore.getState();
  if (!state.hydrated || state.hydrationError) {
    throw new Error(
      "Notification maintenance requires a successfully hydrated Pantry.",
    );
  }
}

async function waitForQueues(): Promise<void> {
  // The two native schedulers have independent write queues. These are barriers,
  // not an invented cross-queue atomic lock. Reads remain observational only.
  await waitForExpiryReminderIdle();
  await waitForWaterReminderIdle();
}

async function inspectStableSchedule(): Promise<{
  status: MaintenanceResult["status"];
  assessment: HybridIntegrityAssessment | null;
  pendingTotal: number | null;
}> {
  assertHydrated();
  const pantryReference = usePantryStore.getState().pantry;
  const settings = await loadReminderSettings();
  const plan = buildHybridExpiryPlan(pantryReference, settings);
  let audit = await auditScheduledNotifications();
  let assessment = assessHybridNotificationIntegrity(plan, audit);

  // Another screen may be finishing a water reschedule. A second read is safe;
  // do not attempt destructive repair based on a potentially transient snapshot.
  if (!assessment.healthy) {
    await waitForQueues();
    audit = await auditScheduledNotifications();
    assessment = assessHybridNotificationIntegrity(plan, audit);
  }
  const after = usePantryStore.getState();
  const latestSettings = await loadReminderSettings();
  if (
    after.pantry !== pantryReference ||
    JSON.stringify(latestSettings) !== JSON.stringify(settings)
  ) {
    return {
      status: "deferred",
      assessment: null,
      pendingTotal: audit.pending.total,
    };
  }
  return {
    status: assessment.healthy ? "healthy" : "attention",
    assessment,
    pendingTotal: audit.pending.total,
  };
}

async function performMaintenance(
  trigger: MaintenanceTrigger,
): Promise<MaintenanceResult> {
  assertHydrated();
  const wait = waitForPantryWrites;
  if (!wait)
    throw new Error(
      "Call startNotificationMaintenance before requesting maintenance.",
    );
  // Do not let an old startup snapshot overwrite a new receipt/import write.
  await wait();
  await syncExpiryReminders();
  // If the user edited Pantry during the full pass, its incremental writer runs
  // after that durable save. Await it before looking at native/index state.
  await wait();
  await waitForQueues();
  const inspected = await inspectStableSchedule();
  const result: MaintenanceResult = {
    trigger,
    status: inspected.status,
    assessed: inspected.assessment,
    expiryReconciled: true,
    pendingTotal: inspected.pendingTotal,
  };
  if (__DEV__) {
    console.log("[KB Reminder Maintenance]", {
      trigger,
      status: result.status,
      expectedExpiry: result.assessed?.expectedExpiry.total ?? null,
      actualExpiry: result.assessed?.actualExpiry.total ?? null,
      pendingTotal: result.pendingTotal,
      discrepancies: result.assessed?.discrepancies ?? null,
      warnings: result.assessed?.warnings ?? [],
      // Deliberately does not log Pantry names, tracking IDs or raw native data.
    });
  }
  if (result.status === "attention") {
    console.warn(
      "[KB Reminder Maintenance] Unresolved notification discrepancy; unsafe/ambiguous requests were preserved.",
    );
  }
  return result;
}

/**
 * Public optional manual diagnostic. Concurrent calls coalesce; a request
 * during an active pass schedules at most one additional pass afterward.
 */
export function requestNotificationMaintenance(
  trigger: MaintenanceTrigger = "manual",
): Promise<MaintenanceResult> {
  if (activeRun) {
    rerunRequested = true;
    nextTrigger = trigger;
    return activeRun;
  }
  const job = (async () => {
    let kind = trigger;
    let result: MaintenanceResult;
    do {
      rerunRequested = false;
      result = await performMaintenance(kind);
      kind = nextTrigger;
    } while (rerunRequested);
    return result;
  })();
  activeRun = job;
  // Clear on either resolve or reject; don't create an unhandled finally promise.
  void job.then(
    () => {
      if (activeRun === job) activeRun = null;
    },
    () => {
      if (activeRun === job) activeRun = null;
    },
  );
  return job;
}

function onAppState(next: AppStateStatus): void {
  if (next === "background") {
    wentToBackground = true;
    return;
  }
  if (next !== "active" || !wentToBackground) return;
  wentToBackground = false;
  void requestNotificationMaintenance("foreground").catch((error) => {
    console.warn("[KB Reminder Maintenance] Foreground check failed:", error);
  });
}

/** Idempotent setup; install from the existing hydrated Pantry persistence path. */
export function startNotificationMaintenance(
  options: MaintenanceOptions,
): void {
  if (installed) return;
  if (typeof options?.waitForPantryWrites !== "function") {
    throw new Error(
      "Notification maintenance needs the durable Pantry writer barrier.",
    );
  }
  assertHydrated();
  installed = true;
  waitForPantryWrites = options.waitForPantryWrites;
  AppState.addEventListener("change", onAppState);
  void requestNotificationMaintenance("startup").catch((error) => {
    console.warn("[KB Reminder Maintenance] Startup check failed:", error);
  });
}
