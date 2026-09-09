import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { normalizeUsername, publicId, randomId, verifyPassword } from "@/lib/mivo-core";
import { consumeRateLimit, runtimeValue } from "@/lib/server-foundation";
import { featureEnabled } from "@/lib/v5-platform";

const schema = z.object({
  username: z.string().min(3).max(24),
  password: z.string().min(10).max(128),
  message: z.string().trim().min(30).max(2000),
});

export async function POST(request: Request) {
  if (!(await consumeRateLimit(request, "public_appeal_v5", 5, 3600))) return Response.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Isi username, password, dan penjelasan banding minimal 30 karakter." }, { status: 400 });
  const username = normalizeUsername(parsed.data.username);
  const account = await getDatabase().prepare(`SELECT u.id, u.status, c.password_hash, c.password_salt, c.password_algorithm, c.password_iterations
    FROM users u JOIN credentials c ON c.user_id = u.id WHERE u.username = ? LIMIT 1`).bind(username).first<{
      id: string; status: string; password_hash: string; password_salt: string; password_algorithm: string; password_iterations: number;
    }>();
  const pepper = runtimeValue("PASSWORD_PEPPER") ?? "";
  if (!account || pepper.length < 32 || !(await verifyPassword(parsed.data.password, pepper, account.password_salt, account.password_hash, account.password_algorithm, account.password_iterations))) {
    return Response.json({ error: "Kredensial tidak valid." }, { status: 401 });
  }
  if (!(await featureEnabled("appeals_v5", account.id))) return Response.json({ error: "Appeal sedang tidak tersedia." }, { status: 503 });
  if (!['suspended','banned'].includes(account.status)) return Response.json({ error: "Banding hanya tersedia untuk akun yang sedang ditangguhkan atau diban." }, { status: 409 });
  const existing = await getDatabase().prepare("SELECT 1 AS ok FROM moderation_appeals WHERE user_id = ? AND status = 'open' LIMIT 1").bind(account.id).first();
  if (existing) return Response.json({ error: "Kamu masih memiliki banding yang sedang ditinjau." }, { status: 409 });
  const now = new Date().toISOString();
  const id = randomId("appeal");
  const appealPublicId = publicId("appeal");
  await getDatabase().batch([
    getDatabase().prepare("INSERT INTO moderation_appeals (id, public_id, user_id, message, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', 0, ?, ?)").bind(id, appealPublicId, account.id, parsed.data.message, now, now),
    getDatabase().prepare("INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, 'moderation_appeal_submitted', 'appeal', ?, '{}', ?)").bind(randomId("aud"), account.id, id, now),
  ]);
  return Response.json({ ok: true, appealPublicId }, { status: 201 });
}
