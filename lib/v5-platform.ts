import { getDatabase } from "@/lib/database";
import { sha256 } from "@/lib/mivo-core";

export type OperationalFeature = "matchmaking" | "messaging" | "media_uploads";

export type MatchSignals = {
  vibeOverlap: number;
  sameLanguage: boolean;
  sameRegion: boolean;
  regionRequested: boolean;
  trustScore: number;
  safetyScore: number;
  priorMatches: number;
  priorSkips: number;
  waitingSeconds: number;
};

export function v5MatchScore(signals: MatchSignals) {
  const vibe = Math.max(0, signals.vibeOverlap) * 30;
  const language = signals.sameLanguage ? 18 : -8;
  const region = signals.regionRequested ? (signals.sameRegion ? 14 : -18) : signals.sameRegion ? 3 : 0;
  const trust = Math.max(0, Math.min(20, signals.trustScore / 3));
  const safety = Math.max(-25, Math.min(18, (signals.safetyScore - 50) / 2.5));
  const repeatPenalty = Math.min(30, signals.priorMatches * 8 + signals.priorSkips * 12);
  const waitingBoost = Math.min(20, Math.max(0, signals.waitingSeconds) / 15);
  return Math.round(vibe + language + region + trust + safety + waitingBoost - repeatPenalty);
}

export async function operationalState(key: OperationalFeature | "maintenance") {
  const row = await getDatabase().prepare("SELECT value_json FROM system_settings WHERE key = ? LIMIT 1").bind(key).first<{ value_json: string }>();
  if (!row) return { enabled: key === "maintenance" ? false : true, message: "" };
  try {
    const value = JSON.parse(row.value_json) as { enabled?: boolean; message?: string };
    return { enabled: Boolean(value.enabled), message: typeof value.message === "string" ? value.message : "" };
  } catch {
    return { enabled: key === "maintenance" ? false : true, message: "" };
  }
}

export async function assertOperational(feature: OperationalFeature) {
  const maintenance = await operationalState("maintenance");
  if (maintenance.enabled) throw new Error("MAINTENANCE_MODE");
  const state = await operationalState(feature);
  if (!state.enabled) throw new Error(`FEATURE_PAUSED_${feature.toUpperCase()}`);
}

export async function featureEnabled(key: string, userId = "anonymous") {
  const row = await getDatabase().prepare("SELECT enabled, rollout_percent FROM feature_flags WHERE key = ? LIMIT 1").bind(key).first<{ enabled: number; rollout_percent: number }>();
  if (!row || !row.enabled) return false;
  const rollout = Math.max(0, Math.min(100, Number(row.rollout_percent) || 0));
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  const digest = await sha256(`${key}:${userId}`);
  const bucket = Number.parseInt(digest.slice(0, 8), 16) % 100;
  return bucket < rollout;
}
