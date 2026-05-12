import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminAPI } from "../api/client";

const TIER_COLOR = { bronze:"#cd7f32", silver:"#aaa", gold:"#ffd700", platinum:"#e5e4e2" };
const CAT_COLOR  = { recyclable:"var(--green)", non_recyclable:"#2563eb", hazardous:"#e03434" };

export default function AdminOverview() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.stats().then(r => setStats(r.data.stats)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  const { users, scans, coupons, breakdown, topScanner, recentSignups, dailyScans } = stats;

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>Admin Overview</h1>
        <span style={{ fontSize:12, color:"var(--muted)" }}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</span>
      </div>

      <div className="grid-4" style={{ marginBottom:20 }}>
        {[
          { label:"Total Users",    value:users.total,       sub:`+${users.newToday} today`,  color:"var(--green)" },
          { label:"Total Scans",    value:scans.total,        sub:`${scans.today} today` },
          { label:"This Week",      value:scans.thisWeek,     sub:`${scans.thisMonth} this month` },
          { label:"Coupons Issued", value:coupons.total,     sub:`${coupons.redeemed} redeemed` },
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={s.color?{color:s.color}:{}}>{s.value.toLocaleString()}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom:20 }}>
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:14 }}>Waste Breakdown (All Time)</div>
          {["recyclable","non_recyclable","hazardous"].map(key=>{
            const pct=scans.total>0?Math.round((breakdown[key]/scans.total)*100):0;
            const label={recyclable:"Recyclable",non_recyclable:"Non-Recyclable",hazardous:"Hazardous"}[key];
            return (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                  <span>{label}</span>
                  <span style={{ fontWeight:600, color:CAT_COLOR[key] }}>{breakdown[key]?.toLocaleString()} ({pct}%)</span>
                </div>
                <div style={{ background:"var(--surface2)", borderRadius:999, height:8, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:CAT_COLOR[key], borderRadius:999 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div style={{ fontWeight:600, marginBottom:14 }}>Scan Activity (Last 14 Days)</div>
          {dailyScans.length===0?<div className="empty-state"><p>No data yet</p></div>:(
            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:120 }}>
              {(() => {
                const max=Math.max(...dailyScans.map(d=>d.count),1);
                return dailyScans.map((d,i)=>(
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ width:"100%", background:"var(--green)", borderRadius:"3px 3px 0 0", height:`${(d.count/max)*100}px`, minHeight:2 }} title={`${d._id}: ${d.count}`} />
                    <div style={{ fontSize:8, color:"var(--muted)", writingMode:"vertical-rl", transform:"rotate(180deg)" }}>{d._id?.slice(5)}</div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom:20 }}>
        {topScanner&&(
          <div className="card">
            <div style={{ fontWeight:600, marginBottom:14 }}>🏆 Top Scanner</div>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:"var(--green)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:20 }}>{topScanner.name?.[0]?.toUpperCase()}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600 }}>{topScanner.name}</div>
                <div style={{ fontSize:12, color:"var(--muted)" }}>{topScanner.email}</div>
                <div style={{ fontSize:12, color:TIER_COLOR[topScanner.tier], fontWeight:600 }}>{topScanner.tier?.toUpperCase()}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:20, fontWeight:700, color:"var(--green)" }}>{topScanner.totalScans}</div>
                <div style={{ fontSize:11, color:"var(--muted)" }}>scans</div>
              </div>
            </div>
          </div>
        )}
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <span style={{ fontWeight:600 }}>Recent Signups</span>
            <Link to="/admin/users" style={{ fontSize:12 }}>View all →</Link>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recentSignups.map(u=>(
              <div key={u._id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px solid var(--border)" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:"var(--surface2)", color:"var(--green)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, flexShrink:0 }}>{u.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.name}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{new Date(u.createdAt).toLocaleDateString("en-IN")}</div>
                </div>
                <div style={{ fontSize:11, color:TIER_COLOR[u.tier], fontWeight:600 }}>{u.tier}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-4">
        {[
          { to:"/admin/users",    icon:"👥", label:"Manage Users",  sub:`${users.active} active` },
          { to:"/admin/scans",    icon:"📷", label:"All Scans",     sub:`${scans.total} total` },
          { to:"/admin/coupons",  icon:"🎫", label:"Coupons",       sub:`${coupons.redeemed} used` },
          { to:"/admin/system",   icon:"🖥", label:"System Health", sub:"Check status" },
        ].map((q,i)=>(
          <Link key={i} to={q.to} style={{ textDecoration:"none" }}>
            <div className="card" style={{ cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="var(--green)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
              <div style={{ fontSize:24, marginBottom:8 }}>{q.icon}</div>
              <div style={{ fontWeight:600, marginBottom:4 }}>{q.label}</div>
              <div style={{ fontSize:12, color:"var(--muted)" }}>{q.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
