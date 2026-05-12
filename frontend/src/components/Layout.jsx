// Layout.jsx — user sidebar
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const TIER_COLORS = { bronze:"#cd7f32", silver:"#c0c0c0", gold:"#ffd700", platinum:"#e5e4e2" };

const NAV = [
  { to:"/",             icon:"⊞", label:"Dashboard",  end:true },
  { to:"/classify",     icon:"🔍", label:"Classify"         },
  { to:"/history",      icon:"📋", label:"History"          },
  { to:"/analytics",    icon:"📊", label:"Analytics"        },
  { to:"/rewards",      icon:"⭐", label:"Rewards"          },
  { to:"/coupons",      icon:"🎫", label:"Coupons"          },
  { to:"/leaderboard",  icon:"🏆", label:"Leaderboard"      },
  { to:"/profile",      icon:"👤", label:"Profile"          },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div style={{ display:"flex", minHeight:"100vh" }}>
      <aside style={{ width:220, flexShrink:0, background:"var(--surface)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", padding:"20px 0", position:"sticky", top:0, height:"100vh", overflowY:"auto" }}>
        <div style={{ padding:"0 20px 18px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:20, fontWeight:700 }}>
            <span style={{ color:"var(--green)" }}>Eco</span>Sort
          </div>
          <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16, flexShrink:0 }}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>

        {user && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 20px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--green)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:15, flexShrink:0 }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:500 }}>{user.name}</div>
              <div style={{ fontSize:11, fontWeight:600, color: TIER_COLORS[user.tier] }}>
                {user.tier?.toUpperCase()} · {user.points} pts
              </div>
            </div>
          </div>
        )}

        <nav style={{ flex:1, padding:"12px 10px", display:"flex", flexDirection:"column", gap:2 }}>
          {NAV.map(({ to, icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <span style={{ width:20, textAlign:"center", fontSize:16 }}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink to="/admin"
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <span style={{ width:20, textAlign:"center" }}>🛡</span>
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>

        <button onClick={() => { logout(); navigate("/login"); }}
          style={{ margin:"10px", padding:"10px 12px", background:"transparent", color:"var(--muted)", fontSize:13, borderRadius:8, textAlign:"left", border:"none", cursor:"pointer" }}>
          ↩ Logout
        </button>
      </aside>

      <main style={{ flex:1, overflowY:"auto", background:"var(--bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}