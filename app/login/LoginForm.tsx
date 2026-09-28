"use client";

import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";

function guessDeviceName() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh/.test(ua)) return "Mac laptop";
  if (/Windows/.test(ua)) return "Windows laptop";
  return "Laptop";
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function friendly(e: unknown) {
  const err = e as { name?: string; message?: string };
  if (err?.name === "NotAllowedError") return "Cancelled, or no passkey for this site on this device.";
  if (err?.name === "InvalidStateError") return "This device is already registered. Use Sign in.";
  return err?.message || "Something went wrong.";
}

export default function LoginForm({ deviceCount, invite: inviteFromUrl }: { deviceCount: number; invite: string }) {
  const [mode, setMode] = useState<"signin" | "setup" | "join">(
    inviteFromUrl ? "join" : deviceCount === 0 ? "setup" : "signin"
  );
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState(inviteFromUrl);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setName(guessDeviceName());
    setSupported(browserSupportsWebAuthn());
  }, []);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const { options } = await post("/api/auth/login/options");
      const assertion = await startAuthentication({ optionsJSON: options });
      await post("/api/auth/login/verify", assertion);
      window.location.href = "/";
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }

  async function register(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      const options = await post("/api/auth/register/options", mode === "join" ? { invite, name } : { code, name });
      const attestation = await startRegistration({ optionsJSON: options });
      await post("/api/auth/register/verify", attestation);
      window.location.href = "/";
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <header className="masthead">
          <div className="wordmark">
            Hours <span>/ timecard</span>
          </div>
        </header>

        {!supported && <p className="error">This browser doesn&apos;t support passkeys. Use Safari or Chrome.</p>}

        {mode === "signin" ? (
          <div className="stack">
            <p className="muted">Sign in with Face ID or Touch ID on a registered device.</p>
            <button className="btn solid" onClick={signIn} disabled={busy || deviceCount === 0}>
              {busy ? "Waiting for passkey…" : "Sign in with passkey"}
            </button>
            <button className="linkbtn" onClick={() => setMode("join")}>
              Got an invite? Join
            </button>
            <button className="linkbtn" onClick={() => setMode("setup")}>
              Owner: set up a new device
            </button>
          </div>
        ) : mode === "join" ? (
          <form onSubmit={register} className="stack">
            <p className="muted">Create your own private account. You&apos;ll only ever see your own hours.</p>
            <label className="field">
              <span>Invite code</span>
              <input value={invite} onChange={(e) => setInvite(e.target.value.trim())} autoComplete="off" required />
            </label>
            <label className="field">
              <span>Device name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </label>
            <button className="btn solid" disabled={busy || !invite}>
              {busy ? "Waiting for Face ID / Touch ID…" : "Create my passkey"}
            </button>
            <button type="button" className="linkbtn" onClick={() => setMode("signin")}>
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={register} className="stack">
            <p className="muted">Owner only: register this device with the setup code from your Vercel settings.</p>
            <label className="field">
              <span>Setup code</span>
              <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
            </label>
            <label className="field">
              <span>Device name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </label>
            <button className="btn solid" disabled={busy}>
              {busy ? "Waiting for Face ID / Touch ID…" : "Register this device"}
            </button>
            {deviceCount > 0 && (
              <button type="button" className="linkbtn" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            )}
          </form>
        )}

        {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </main>
  );
}
