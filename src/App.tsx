import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import Login from "./Login";
import { apiLogout } from "./api";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("token"));
  }, []);

  function handleLoginSuccess() {
    setLoggedIn(true);
  }

  function handleLogout() {
    apiLogout();
    setLoggedIn(false);
  }

  return (
    <div className="app-shell">
      <header className="no-print app-header">
        <div className="spacer" />
        <div className="header-actions">
          {loggedIn ? (
            <>
              <span className="who">
                Zalogowano jako <strong>admin</strong>
              </span>
              <button className="btn" onClick={handleLogout}>Wyloguj</button>
            </>
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )}
        </div>
      </header>

      <main className="app-main">
        <Dashboard onLogout={handleLogout} isAdmin={loggedIn} />
      </main>

      <style>{`
        .app-shell{
          min-height:100vh;
          background:#121212;
          color:#fff;
        }
        .app-header{
          position:sticky; top:0; z-index:10;
          display:flex; align-items:center; justify-content:space-between;
          gap:16px; padding:14px 20px;
          border-bottom:1px solid #2a2a2a;
          background:rgba(18,18,18,.9);
          backdrop-filter:saturate(140%) blur(6px);
        }
        .spacer{flex:1}
        .header-actions{display:flex; align-items:center; gap:12px}
        .who{opacity:.9; font-size:14px}
        .btn{
          height:32px; padding:0 12px; border-radius:6px; border:1px solid #3a3a3a;
          background:#1f1f1f; color:#fff; cursor:pointer;
        }

        /* Pełna szerokość + elastyczne odstępy krawędzi */
        .app-main{
          max-width: 100%;
          padding: clamp(10px, 2vw, 28px);
          margin: 0;
        }

        @media (max-width: 768px){
          .app-main{padding: 12px}
        }
      `}</style>
    </div>
  );
}
