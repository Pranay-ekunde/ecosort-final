import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { analyticsAPI, scanAPI } from "../api/client";

const TIER_COLOR = { bronze:"#cd7f32", silver:"#aaa", gold:"#ffd700", platinum:"#e5e4e2" };
const CAT_BADGE  = { recyclable:"tag-recyclable", non_recyclable:"tag-non_recyclable", hazardous:"tag-hazardous" };
const CAT_LABEL  = { recyclable:"Recyclable", non_recyclable:"Non-Recyclable", hazardous:"Hazardous" };

export default function Dashboard() {
  const { user }           = useAuth();
  const [summary, setSummary] = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([analyticsAPI.summary(), scanAPI.getRecent()])
      .then(([s, r]) => { setSummary(s.data.summary); setRecent(r.data.scans); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const tierPct = (() => {
    const t = { bronze:[0,500], silver:[500,2000], gold:[2000,5000], platinum:[5000,5000] };
    const [lo, hi] = t[user?.tier] || [0,500];
    if (hi === lo) return 100;
    return Math.min(100, Math.round(((user?.points-lo)/(hi-lo))*100));
  })();

  return (
    <div className="page">
      <h1 className="page-title">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>

      <div className="grid-4" style={{ marginBottom:24 }}>
        {[
          { label:"Total Points",  value:user?.points ?? 0,              sub:`${user?.tier?.toUpperCase()} tier`, color:TIER_COLOR[user?.tier] },
          { label:"Total Scans",   value:summary?.totalScans ?? 0,        sub:"all time" },
          { label:"This Month",    value:summary?.monthlyScans ?? 0,      sub:"scans" },
          { label:"Recyclable",    value:summary?.breakdown?.recyclable ?? 0, sub:"sorted correctly" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={s.color?{color:s.color}:{}}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontWeight:600 }}>Tier Progress</span>
          <span style={{ color:TIER_COLOR[user?.tier], fontWeight:600 }}>{user?.tier?.toUpperCase()}</span>
        </div>
        <div style={{ background:"var(--surface2)", borderRadius:999, height:10, overflow:"hidden" }}>
          <div style={{ width:`${tierPct}%`, height:"100%", background:"var(--green)", borderRadius:999, transition:"width 0.6s" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--muted)", marginTop:6 }}>
          <span>{user?.points} pts</span>
          <span>{user?.tier==="platinum" ? "Max tier!" : `${Math.max(0,({bronze:500,silver:2000,gold:5000}[user?.tier]||0)-user?.points)} pts to next tier`}</span>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom:24 }}>
        {[
          { to:"/classify", icon:"🔍", label:"Classify Waste",  sub:"Upload or use webcam",      color:"var(--green)" },
          { to:"/rewards",  icon:"⭐", label:"Your Points",     sub:`${user?.points} pts available`, color:"var(--amber)" },
          { to:"/coupons",  icon:"🎫", label:"Redeem Coupons",  sub:"Exchange for discounts",    color:"var(--blue)"  },
        ].map((a, i) => (
          <Link key={i} to={a.to} style={{ textDecoration:"none" }}>
            <div className="card" style={{ cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=a.color}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
              <div style={{ fontSize:28, marginBottom:8 }}>{a.icon}</div>
              <div style={{ fontWeight:600, marginBottom:4 }}>{a.label}</div>
              <div style={{ fontSize:13, color:"var(--muted)" }}>{a.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontWeight:600 }}>Recent Scans</span>
          <Link to="/history" style={{ fontSize:13 }}>View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📷</div>
            <p>No scans yet. <Link to="/classify">Classify your first item!</Link></p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {recent.slice(0,5).map(scan => (
              <div key={scan._id} style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
                <img src={scan.imageUrl} alt="" style={{ width:48, height:48, borderRadius:8, objectFit:"cover", background:"var(--surface2)", flexShrink:0 }}
                  onError={e=>{e.target.style.display="none";}} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span className={`badge ${CAT_BADGE[scan.prediction]}`}>{CAT_LABEL[scan.prediction]}</span>
                    {scan.isDuplicate && <span style={{ fontSize:11, color:"var(--amber)" }}>duplicate</span>}
                    <span style={{ fontSize:12, color:"var(--muted)" }}>{Math.round(scan.confidence*100)}%</span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:3 }}>
                    {new Date(scan.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
                  </div>
                </div>
                <div style={{ fontSize:13, color: scan.isDuplicate?"var(--muted)":"var(--green)", fontWeight:600 }}>
                  {scan.isDuplicate ? "0 pts" : `+${scan.pointsEarned} pts`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
