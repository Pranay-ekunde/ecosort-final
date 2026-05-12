import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

// ═══════════════════════════════════════════════════════
// pages/Login.jsx
// ═══════════════════════════════════════════════════════

export function Login() {
  const [form, setForm]   = useState({ email:"", password:"" });
  const [busy, setBusy]   = useState(false);
  const { login }         = useAuth();
  const navigate          = useNavigate();

  const handle = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await login(form.email, form.password); toast.success("Welcome back!"); navigate("/"); }
    catch (err) { toast.error(err.response?.data?.message || "Login failed"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:20 }}>
      <div className="card" style={{ width:"100%", maxWidth:400, padding:"40px 36px" }}>
        <div style={{ fontSize:24, fontWeight:700, textAlign:"center", marginBottom:20 }}>
          <span style={{ color:"var(--green)" }}>Eco</span>Sort
        </div>
        <h2 style={{ fontSize:20, fontWeight:600, textAlign:"center", marginBottom:6 }}>Sign in</h2>
        <p style={{ fontSize:13, color:"var(--muted)", textAlign:"center", marginBottom:24 }}>Classify waste. Earn rewards.</p>
        <form onSubmit={handle} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <label style={{ fontSize:13, fontWeight:500, color:"var(--muted)" }}>Email</label>
            <input type="email" placeholder="you@example.com" required value={form.email}
              onChange={e => setForm(p => ({ ...p, email:e.target.value }))} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <label style={{ fontSize:13, fontWeight:500, color:"var(--muted)" }}>Password</label>
            <input type="password" placeholder="••••••••" required value={form.password}
              onChange={e => setForm(p => ({ ...p, password:e.target.value }))} />
          </div>
          <button className="btn btn-primary" style={{ width:"100%", marginTop:8 }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ textAlign:"center", fontSize:13, color:"var(--muted)", marginTop:20 }}>
          No account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// pages/Register.jsx
// ═══════════════════════════════════════════════════════
export function Register() {
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [busy, setBusy] = useState(false);
  const { register }    = useAuth();
  const navigate        = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be 6+ characters");
    setBusy(true);
    try { await register(form.name, form.email, form.password); toast.success("Account created! 50 welcome points added 🎉"); navigate("/"); }
    catch (err) { toast.error(err.response?.data?.message || "Registration failed"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:20 }}>
      <div className="card" style={{ width:"100%", maxWidth:400, padding:"40px 36px" }}>
        <div style={{ fontSize:24, fontWeight:700, textAlign:"center", marginBottom:20 }}>
          <span style={{ color:"var(--green)" }}>Eco</span>Sort
        </div>
        <h2 style={{ fontSize:20, fontWeight:600, textAlign:"center", marginBottom:6 }}>Create account</h2>
        <p style={{ fontSize:13, color:"var(--muted)", textAlign:"center", marginBottom:24 }}>Get 50 free points on signup!</p>
        <form onSubmit={handle} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {[["Full name","text","Your name","name"],["Email","email","you@example.com","email"],["Password","password","Min 6 characters","password"]].map(([label,type,ph,key]) => (
            <div key={key} style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:13, fontWeight:500, color:"var(--muted)" }}>{label}</label>
              <input type={type} placeholder={ph} required value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]:e.target.value }))} />
            </div>
          ))}
          <button className="btn btn-primary" style={{ width:"100%", marginTop:8 }} disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p style={{ textAlign:"center", fontSize:13, color:"var(--muted)", marginTop:20 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
