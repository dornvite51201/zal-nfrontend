// src/Login.tsx
import React, { useState } from "react";
import { apiLogin } from "./api";

type LoginProps = {
  onLoginSuccess: () => void;
};

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiLogin(username, password);
      onLoginSuccess();
    } catch (e) {
      setErr("Nieprawidłowe dane logowania");
    } finally {
      setBusy(false);
    }
  }

  // proste style
  const pageStyle: React.CSSProperties = {
    backgroundColor: "#1a1a1a",
    minHeight: "100vh",
    color: "#fff",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: "32px",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: "4px",
    width: "260px",
    padding: "16px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    color: "#fff",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    marginBottom: "4px",
    color: "#ccc",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#1e1e1e",
    border: "1px solid #555",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "13px",
    lineHeight: "1.4",
    padding: "6px 8px",
    marginBottom: "12px",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#2f5fff",
    border: "1px solid #2f5fff",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "1.4",
    padding: "8px",
    cursor: "pointer",
    textAlign: "center" as const,
  };

  const errorBoxStyle: React.CSSProperties = {
    backgroundColor: "#662222",
    border: "1px solid #aa4444",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "12px",
    padding: "6px 8px",
    marginBottom: "12px",
  };

  return (
    <div style={pageStyle}>
      <form style={cardStyle} onSubmit={handleSubmit}>
        <div style={{ fontWeight: 600, marginBottom: "12px", fontSize: "14px" }}>
          Zaloguj się
        </div>

        {err ? <div style={errorBoxStyle}>{err}</div> : null}

        <label style={labelStyle}>Nazwa użytkownika</label>
        <input
          style={inputStyle}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
        />

        <label style={labelStyle}>Hasło</label>
        <input
          style={inputStyle}
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />

        <button type="submit" style={buttonStyle} disabled={busy}>
          {busy ? "Logowanie..." : "Zaloguj"}
        </button>
      </form>
    </div>
  );
}
