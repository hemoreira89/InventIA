import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from './Login.jsx'
import { supabase, getSession, signOut } from './supabase.js'

function Root() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then(s => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    // Lê tema diretamente do localStorage (componentes ainda não montaram)
    let isLight = true;
    try {
      const saved = localStorage.getItem("inventia_theme");
      isLight = saved !== "dark";
    } catch {}
    const bg = isLight ? "#f5f6f8" : "#000000";
    const border = isLight ? "#e5e7eb" : "#1a1a25";
    return (
      <div style={{
        minHeight: "100vh",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: `3px solid ${border}`,
          borderTopColor: "#7b61ff",
          animation: "spin .9s linear infinite"
        }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!session) {
    return <Login onAuth={setSession}/>;
  }

  return <App session={session} onLogout={async () => { await signOut(); setSession(null); }}/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root/>
  </React.StrictMode>
)
