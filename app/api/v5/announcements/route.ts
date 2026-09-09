import { getDatabase } from "@/lib/database";
import { jsonError, requireViewer } from "@/lib/server-foundation";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const now = new Date().toISOString();
    const rows = await getDatabase().prepare(`SELECT a.public_id, a.title, a.body, a.severity, a.active_from, a.active_until,
      CASE WHEN ar.user_id IS NULL THEN 0 ELSE 1 END AS is_read
      FROM announcements a LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
      WHERE a.active_from <= ? AND (a.active_until IS NULL OR a.active_until > ?) AND a.audience IN ('all', ?)
      ORDER BY a.active_from DESC LIMIT 30`).bind(viewer.id, now, now, viewer.role.toLowerCase()).all();
    return Response.json({ announcements: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
