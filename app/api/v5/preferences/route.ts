import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { assertSameOrigin, jsonError, requireViewer } from "@/lib/server-foundation";

const schema = z.object({
  languageCode: z.enum(["id", "en", "bilingual"]).optional(),
  regionMatchMode: z.enum(["anywhere", "same_region"]).optional(),
  incognitoMode: z.boolean().optional(),
  defaultRetentionDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  matchNotifications: z.boolean().optional(),
  messageNotifications: z.boolean().optional(),
  safetyNotifications: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const row = await getDatabase().prepare(`SELECT language_code, region_match_mode, incognito_mode, default_retention_days,
      quiet_hours_start, quiet_hours_end, match_notifications, message_notifications, safety_notifications
      FROM preferences WHERE user_id = ?`).bind(viewer.id).first();
    return Response.json({ preferences: row }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await requireViewer(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Preferensi V5 tidak valid." }, { status: 400 });
    const body = parsed.data;
    const current = await getDatabase().prepare(`SELECT language_code, region_match_mode, incognito_mode, default_retention_days,
      quiet_hours_start, quiet_hours_end, match_notifications, message_notifications, safety_notifications
      FROM preferences WHERE user_id = ?`).bind(viewer.id).first<Record<string, unknown>>();
    const now = new Date().toISOString();
    await getDatabase().prepare(`UPDATE preferences SET language_code = ?, region_match_mode = ?, incognito_mode = ?, default_retention_days = ?,
      quiet_hours_start = ?, quiet_hours_end = ?, match_notifications = ?, message_notifications = ?, safety_notifications = ?, updated_at = ? WHERE user_id = ?`)
      .bind(
        body.languageCode ?? current?.language_code ?? "id",
        body.regionMatchMode ?? current?.region_match_mode ?? "anywhere",
        body.incognitoMode === undefined ? Number(current?.incognito_mode ?? 0) : body.incognitoMode ? 1 : 0,
        body.defaultRetentionDays ?? Number(current?.default_retention_days ?? 7),
        body.quietHoursStart === undefined ? current?.quiet_hours_start ?? null : body.quietHoursStart,
        body.quietHoursEnd === undefined ? current?.quiet_hours_end ?? null : body.quietHoursEnd,
        body.matchNotifications === undefined ? Number(current?.match_notifications ?? 1) : body.matchNotifications ? 1 : 0,
        body.messageNotifications === undefined ? Number(current?.message_notifications ?? 1) : body.messageNotifications ? 1 : 0,
        body.safetyNotifications === undefined ? Number(current?.safety_notifications ?? 1) : body.safetyNotifications ? 1 : 0,
        now, viewer.id,
      ).run();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
