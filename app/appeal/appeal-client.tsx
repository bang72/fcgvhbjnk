"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";

export default function AppealClient() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/v5/appeal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, message }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Banding tidak dapat dikirim.");
      setResult({ ok: true, text: `Banding terkirim. ID: ${body.appealPublicId}` });
      setPassword(""); setMessage("");
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : "Banding tidak dapat dikirim." });
    } finally { setBusy(false); }
  }

  return <main className="legal-shell appeal-page">
    <Link className="legal-back" href="/"><ArrowLeft size={17}/> Kembali ke MIVO</Link>
    <p className="eyebrow">MIVO V5 Trust & Safety</p>
    <h1>Ajukan banding</h1>
    <p>Untuk akun yang sedang ditangguhkan atau diban. Kredensial hanya dipakai untuk memverifikasi kepemilikan akun dan tidak disimpan di formulir banding.</p>
    <form className="appeal-form" onSubmit={submit}>
      <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={24}/></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required minLength={10} maxLength={128}/></label>
      <label>Penjelasan banding<textarea value={message} onChange={(e) => setMessage(e.target.value)} required minLength={30} maxLength={2000} rows={8} placeholder="Jelaskan apa yang terjadi dan alasan kamu meminta peninjauan ulang."/></label>
      <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <ShieldCheck/>}{busy ? "Mengirim…" : "Kirim banding"}</button>
    </form>
    {result && <div className={result.ok ? "appeal-result success" : "appeal-result error"}>{result.text}</div>}
  </main>;
}
