// src/App.tsx
import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import Login from "./Login";
import { apiLogout } from "./api";

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);

  // przy starcie sprawdzamy, czy jest token w localStorage
  useEffect(() => {
    const t = localStorage.getItem("token");
    setLoggedIn(!!t);
  }, []);

  function handleLoginSuccess() {
    // apiLogin zapisuje token w localStorage,
    // tutaj tylko odświeżamy stan aplikacji
    setLoggedIn(true);
  }

  function handleLogout() {
    apiLogout(); // czyści token z localStorage
    setLoggedIn(false);
  }

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        minHeight: "100vh",
        color: "#ffffff",
      }}
    >
      {/* Pasek u góry - zawsze widoczny */}
      <header
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid #333",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px" }}>Measurement Dashboard</h1>

        <div>
          {loggedIn ? (
            <>
              <span style={{ marginRight: 12, fontSize: "14px" }}>
                Zalogowano jako <strong>admin</strong>
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Wyloguj
              </button>
            </>
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )}
        </div>
      </header>

      {/* Dashboard zawsze widoczny,
          uprawnienia zależą od isAdmin */}
      <main style={{ padding: "16px 24px" }}>
        <Dashboard onLogout={handleLogout} isAdmin={loggedIn} />
      </main>
    </div>
  );
}