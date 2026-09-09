import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { publicId, randomId } from "@/lib/mivo-core";
import { assertSameOrigin, jsonError, requireViewer } from "@/lib/server-foundation";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("control"), key: z.enum(["maintenance", "matchmaking", "messaging", "media_uploads"]), enabled: z.boolean(), message: z.string().max(300).optional() }),
  z.object({ action: z.literal("feature_flag"), key: z.string().regex(/^[a-z0-9_]{3,60}$/), enabled: z.boolean(), rolloutPercent: z.number().int().min(0).max(100) }),
  z.object({ action: z.literal("announcement"), title: z.string().trim().min(3).max(100), body: z.string().trim().min(5).max(1500), severity: z.enum(["info", "warning", "critical"]), durationHours: z.number().int().min(1).max(24 * 30) }),
]);

function admin(viewer: { role: string }) { if (viewer.role !== "ADMIN") throw new Error("ADMIN_REQUIRED"); }

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request); admin(viewer);
    const [controls, flags, announcements, metrics] = await Promise.all([
      getDatabase().prepare("SELECT key, value_json, updated_at FROM system_settings ORDER BY key").all(),
      getDatabase().prepare("SELECT key, enabled, rollout_percent, description, updated_at FROM feature_flags ORDER BY key").all(),
      getDatabase().prepare("SELECT public_id, title, severity, active_from, active_until, created_at FROM announcements ORDER BY created_at DESC LIMIT 20").all(),
      getDatabase().prepare(`SELECT
        (SELECT COUNT(*) FROM users WHERE status = 'active' AND role = 'USER') AS active_users,
        (SELECT COUNT(*) FROM rooms WHERE created_at >= ?) AS matches_24h,
        (SELECT COUNT(*) FROM messages WHERE created_at >= ? AND deleted_at IS NULL) AS messages_24h,
        (SELECT COUNT(*) FROM reports WHERE created_at >= ?) AS reports_24h,
        (SELECT COUNT(*) FROM moderation_appeals WHERE status = 'open') AS open_appeals`).bind(new Date(Date.now()-86_400_000).toISOString(), new Date(Date.now()-86_400_000).toISOString(), new Date(Date.now()-86_400_000).toISOString()).first(),
    ]);
    return Response.json({ controls: controls.results, flags: flags.results, announcements: announcements.results, metrics }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await requireViewer(request); admin(viewer);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Admin control V5 tidak valid." }, { status: 400 });
    const body = parsed.data; const now = new Date().toISOString();
    if (body.action === "control") {
      await getDatabase().prepare(`INSERT INTO system_settings (key, value_json, updated_by_id, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by_id = excluded.updated_by_id, updated_at = excluded.updated_at`)
        .bind(body.key, JSON.stringify({ enabled: body.enabled, message: body.message ?? "" }), viewer.id, now).run();
    } else if (body.action === "feature_flag") {
      await getDatabase().prepare(`INSERT INTO feature_flags (key, enabled, rollout_percent, description, updated_by_id, updated_at) VALUES (?, ?, ?, '', ?, ?)
        ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, rollout_percent = excluded.rollout_percent, updated_by_id = excluded.updated_by_id, updated_at = excluded.updated_at`)
        .bind(body.key, body.enabled ? 1 : 0, body.rolloutPercent, viewer.id, now).run();
    } else {
      const until = new Date(Date.now() + body.durationHours * 3_600_000).toISOString();
      await getDatabase().prepare("INSERT INTO announcements (id, public_id, title, body, severity, audience, active_from, active_until, created_by_id, created_at) VALUES (?, ?, ?, ?, ?, 'all', ?, ?, ?, ?)")
        .bind(randomId("ann"), publicId("announcement"), body.title, body.body, body.severity, now, until, viewer.id, now).run();
    }
    await getDatabase().prepare("INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, 'platform_control_changed', 'platform', NULL, ?, ?)")
      .bind(randomId("aud"), viewer.id, JSON.stringify(body), now).run();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
