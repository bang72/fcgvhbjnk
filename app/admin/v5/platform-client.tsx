"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gauge, LoaderCircle, Megaphone, PauseCircle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

type Control = { key: string; value_json: string; updated_at: string };
type Flag = { key: string; enabled: number; rollout_percent: number; description: string; updated_at: string };
type Payload = { controls: Control[]; flags: Flag[]; announcements: Array<{ public_id: string; title: string; severity: string; created_at: string }>; metrics?: Record<string, number> };

export default function PlatformClient() {
  const [data, setData] = useState<Payload>({ controls: [], flags: [], announcements: [] });
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState({ title: "", body: "", severity: "info", durationHours: 24 });

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/admin/platform", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Control Center gagal dimuat."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(body: object) {
    const r = await fetch("/api/admin/platform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Action failed"); await load();
  }
  async function toggleControl(row: Control) {
    const current = JSON.parse(row.value_json || "{}");
    try { await post({ action: "control", key: row.key, enabled: !Boolean(current.enabled), message: current.message ?? "" }); toast.success(`${row.key} diperbarui.`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal memperbarui control."); }
  }
  async function setFlag(row: Flag, rolloutPercent: number) {
    try { await post({ action: "feature_flag", key: row.key, enabled: rolloutPercent > 0, rolloutPercent }); toast.success(`${row.key}: ${rolloutPercent}%`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal memperbarui feature flag."); }
  }
  async function publishAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    try { await post({ action: "announcement", ...announcement, severity: announcement.severity as "info" | "warning" | "critical" }); setAnnouncement({ title: "", body: "", severity: "info", durationHours: 24 }); toast.success("Announcement dipublikasikan."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Announcement gagal."); }
  }

  return <main className="moderation-shell admin-console">
    <header><Link href="/moderation"><ArrowLeft/> Moderation</Link><div><span>MIVO V5 Control Center</span><strong>OWNER</strong></div></header>
    <section className="admin-main v5-control-main">
      <div className="admin-title"><div><p>Production operations</p><h1>Platform Control</h1></div><button onClick={() => void load()}><RefreshCw/> Refresh</button></div>
      {loading ? <div className="moderation-loading"><LoaderCircle className="spin"/> Memuat status V5…</div> : <>
        <div className="admin-stats">
          {Object.entries(data.metrics ?? {}).map(([key, value]) => <article key={key}><Gauge/><div><span>{key.replaceAll("_", " ")}</span><strong>{Number(value)}</strong></div></article>)}
        </div>
        <div className="admin-overview-grid">
          <article><h2><PauseCircle/> Emergency controls</h2><p>Jeda fitur tertentu tanpa mematikan seluruh aplikasi.</p><div className="v5-control-list">{data.controls.map((row) => { const v = JSON.parse(row.value_json || "{}"); return <button key={row.key} onClick={() => void toggleControl(row)}><span>{row.key}</span><b>{v.enabled ? "ON" : "OFF"}</b></button>; })}</div></article>
          <article><h2><SlidersHorizontal/> Feature rollout</h2><p>Rollout deterministik per user untuk mengurangi risiko rilis.</p><div className="v5-control-list">{data.flags.map((row) => <div key={row.key}><span>{row.key}</span><select value={row.enabled ? row.rollout_percent : 0} onChange={(e) => void setFlag(row, Number(e.target.value))}><option value={0}>Off</option><option value={10}>10%</option><option value={25}>25%</option><option value={50}>50%</option><option value={100}>100%</option></select></div>)}</div></article>
        </div>
        <article className="admin-platform-card"><h2><Megaphone/> Announcement</h2><form className="appeal-form" onSubmit={publishAnnouncement}><label>Judul<input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} required maxLength={100}/></label><label>Pesan<textarea rows={4} value={announcement.body} onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })} required maxLength={1500}/></label><div className="admin-inline-fields"><label>Severity<select value={announcement.severity} onChange={(e) => setAnnouncement({ ...announcement, severity: e.target.value })}><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label><label>Durasi (jam)<input type="number" min={1} max={720} value={announcement.durationHours} onChange={(e) => setAnnouncement({ ...announcement, durationHours: Number(e.target.value) })}/></label></div><button className="primary-button">Publish</button></form></article>
      </>}
    </section>
  </main>;
}
