import { useState } from "react";
import { apiLogin } from "./api";

type Props = { onLoginSuccess: () => void };

export default function Login({ onLoginSuccess }: Props) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      await apiLogin(username, password);
      onLoginSuccess();
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setMsg("Niepoprawne dane logowania");
      } else if (typeof err?.response?.data?.detail === "string") {
        setMsg(err.response.data.detail);
      } else {
        setMsg("Wystąpił błąd. Spróbuj ponownie.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "inline-flex", gap: 8 }}>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Login"
        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #444", background: "#222", color: "#fff" }}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Hasło"
        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #444", background: "#222", color: "#fff" }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #666", background: "#2f7d32", color: "#fff" }}
      >
        {loading ? "Loguję…" : "Zaloguj"}
      </button>
      {msg && <span style={{ marginLeft: 8, color: "#f88" }}>{msg}</span>}
    </form>
  );
}
