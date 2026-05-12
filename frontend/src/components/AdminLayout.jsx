import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const ANAV = [
  { to:"/admin",            icon:"⊞", label:"Overview",      end:true },
  { to:"/admin/users",      icon:"👥", label:"Users"               },
  { to:"/admin/scans",      icon:"📷", label:"All Scans"           },
  { to:"/admin/coupons",    icon:"🎫", label:"Coupons"             },
  { to:"/admin/analytics",  icon:"📊", label:"Analytics"           },
  { to:"/admin/system",     icon:"🖥", label:"System Health"       },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div style={{ display:"flex", minHeight:"100vh" }}>
      <aside style={{ width:220, flexShrink:0, background:"var(--surface)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", padding:"20px 0", position:"sticky", top:0, height:"100vh", overflowY:"auto" }}>
        <div style={{ padding:"0 20px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:18, fontWeight:700 }}>
            <span style={{ color:"var(--green)" }}>Eco</span>Sort
            <span style={{ fontSize:11, background:"#7c3aed", color:"#fff", padding:"2px 8px", borderRadius:999, marginLeft:8, fontWeight:600 }}>ADMIN</span>
          </div>
          <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16, flexShrink:0 }}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        <div style={{ fontSize:12, color:"var(--muted)", marginTop:8, padding:"0 20px" }}>{user?.name}</div>

        <nav style={{ flex:1, padding:"12px 10px", display:"flex", flexDirection:"column", gap:2 }}>
          {ANAV.map(({ to, icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <span style={{ width:20, textAlign:"center" }}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding:"10px" }}>
          <NavLink to="/" style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:8, color:"var(--muted)", fontSize:13, textDecoration:"none", marginBottom:4 }}>
            ← Back to App
          </NavLink>
          <button onClick={() => { logout(); navigate("/login"); }}
            style={{ width:"100%", padding:"10px 12px", background:"transparent", color:"var(--muted)", fontSize:13, borderRadius:8, textAlign:"left", border:"none", cursor:"pointer" }}>
            ↩ Logout
          </button>
        </div>
      </aside>

      <main style={{ flex:1, overflowY:"auto", background:"var(--bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}