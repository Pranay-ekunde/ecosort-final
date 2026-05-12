// ALL imports at the top — fixes the crash bug from previous version
import { useEffect, useState } from "react";
import { adminAPI } from "../api/client";
import toast from "react-hot-toast";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Tooltip, Legend,
} from "chart.js";

Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const CAT   = { recyclable:"tag-recyclable", non_recyclable:"tag-non_recyclable", hazardous:"tag-hazardous" };
const LBL   = { recyclable:"Recyclable",     non_recyclable:"Non-Recyclable",     hazardous:"Hazardous"     };

// ═══════════════════════════════════════════════════════
// AdminScans
// ═══════════════════════════════════════════════════════
export function AdminScans() {
  const [scans,   setScans]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [cat,     setCat]     = useState("");
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = (p = 1, c = cat) => {
    setLoading(true);
    adminAPI.scans({ page:p, limit:LIMIT, category:c })
      .then(r => { setScans(r.data.scans); setTotal(r.data.pagination.total); setPage(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1, cat); }, [cat]);

  const del = async (id) => {
    if (!confirm("Delete this scan permanently?")) return;
    await adminAPI.deleteScan(id);
    toast.success("Deleted");
    load(page);
  };

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>
          All Scans <span style={{ fontSize:15, color:"var(--muted)", fontWeight:400 }}>({total.toLocaleString()})</span>
        </h1>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ width:180 }}>
          <option value="">All categories</option>
          <option value="recyclable">Recyclable</option>
          <option value="non_recyclable">Non-Recyclable</option>
          <option value="hazardous">Hazardous</option>
        </select>
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            {/* Header */}
            <div style={{ display:"grid", gridTemplateColumns:"56px 2fr 2fr 1.2fr 1fr 1fr 70px", gap:8, padding:"10px 16px", background:"var(--surface2)", fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase" }}>
              <span>Img</span><span>User</span><span>Category</span><span>Confidence</span><span>Points</span><span>Date</span><span>Del</span>
            </div>

            {scans.map(sc => (
              <div key={sc._id} style={{ display:"grid", gridTemplateColumns:"56px 2fr 2fr 1.2fr 1fr 1fr 70px", gap:8, padding:"10px 16px", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                <img src={sc.imageUrl} alt="" style={{ width:44, height:44, borderRadius:6, objectFit:"cover", background:"var(--surface2)" }}
                  onError={e => { e.target.style.display="none"; }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{sc.user?.name || "—"}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{sc.user?.email}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <span className={`badge ${CAT[sc.prediction]}`} style={{ fontSize:11, width:"fit-content" }}>{LBL[sc.prediction]}</span>
                  {sc.isDuplicate && <span style={{ fontSize:10, color:"var(--amber)" }}>duplicate</span>}
                </div>
                <div style={{ fontSize:13 }}>{Math.round(sc.confidence*100)}%</div>
                <div style={{ fontSize:13, color: sc.isDuplicate?"var(--muted)":"var(--green)", fontWeight:600 }}>
                  {sc.isDuplicate ? "0" : `+${sc.pointsEarned}`}
                </div>
                <div style={{ fontSize:12, color:"var(--muted)" }}>{new Date(sc.createdAt).toLocaleDateString("en-IN")}</div>
                <button onClick={() => del(sc._id)}
                  style={{ fontSize:12, color:"var(--red)", background:"none", border:"none", cursor:"pointer" }}>
                  🗑
                </button>
              </div>
            ))}

            {scans.length === 0 && (
              <div className="empty-state"><p>No scans found</p></div>
            )}
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:20 }}>
            <button className="btn btn-secondary" disabled={page===1} onClick={() => load(page-1)}>← Prev</button>
            <span style={{ alignSelf:"center", fontSize:13, color:"var(--muted)" }}>Page {page} of {Math.ceil(total/LIMIT)||1}</span>
            <button className="btn btn-secondary" disabled={page>=Math.ceil(total/LIMIT)} onClick={() => load(page+1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// AdminCoupons
// ═══════════════════════════════════════════════════════
export function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [filter,  setFilter]  = useState("");
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = (p = 1, f = filter) => {
    setLoading(true);
    adminAPI.coupons({ page:p, limit:LIMIT, redeemed:f })
      .then(r => { setCoupons(r.data.coupons); setTotal(r.data.pagination.total); setPage(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1, filter); }, [filter]);

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>
          All Coupons <span style={{ fontSize:15, color:"var(--muted)", fontWeight:400 }}>({total.toLocaleString()})</span>
        </h1>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width:160 }}>
          <option value="">All</option>
          <option value="false">Active</option>
          <option value="true">Redeemed</option>
        </select>
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1.5fr 2fr 1.5fr 1fr 1fr 1fr 1fr", gap:8, padding:"10px 16px", background:"var(--surface2)", fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase" }}>
              <span>Code</span><span>User</span><span>Brand</span><span>Discount</span><span>Cost</span><span>Expires</span><span>Status</span>
            </div>

            {coupons.map(c => (
              <div key={c._id} style={{ display:"grid", gridTemplateColumns:"1.5fr 2fr 1.5fr 1fr 1fr 1fr 1fr", gap:8, padding:"10px 16px", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700 }}>{c.code}</div>
                <div>
                  <div style={{ fontSize:13 }}>{c.user?.name}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{c.user?.email}</div>
                </div>
                <div style={{ fontSize:13 }}>{c.brand}</div>
                <div style={{ fontSize:13, color:"var(--green)", fontWeight:600 }}>{c.discount}</div>
                <div style={{ fontSize:13 }}>{c.pointsCost} pts</div>
                <div style={{ fontSize:11, color:"var(--muted)" }}>{new Date(c.expiresAt).toLocaleDateString("en-IN")}</div>
                <span className={`badge ${c.isRedeemed?"badge-amber":"badge-green"}`} style={{ fontSize:11, width:"fit-content" }}>
                  {c.isRedeemed ? "Used" : "Active"}
                </span>
              </div>
            ))}

            {coupons.length === 0 && <div className="empty-state"><p>No coupons found</p></div>}
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:20 }}>
            <button className="btn btn-secondary" disabled={page===1} onClick={() => load(page-1)}>← Prev</button>
            <span style={{ alignSelf:"center", fontSize:13, color:"var(--muted)" }}>Page {page} of {Math.ceil(total/LIMIT)||1}</span>
            <button className="btn btn-secondary" disabled={page>=Math.ceil(total/LIMIT)} onClick={() => load(page+1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// AdminAnalytics
// ═══════════════════════════════════════════════════════
export function AdminAnalytics() {
  const [data,    setData]    = useState(null);
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminAPI.analytics(days)
      .then(r => setData(r.data.analytics))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="spinner" />;

  const { dailyScans, dailyUsers, tierDist } = data;

  const chartOpts = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ ticks:{ color:"#5e7a5e", font:{ size:10 } }, grid:{ display:false } },
      y:{ ticks:{ color:"#5e7a5e" }, grid:{ color:"#1e2a1e" } },
    },
  };

  const scanData = {
    labels: dailyScans.map(d => d._id?.slice(5)),
    datasets: [{ label:"Scans", data:dailyScans.map(d=>d.count), backgroundColor:"rgba(37,162,68,.7)", borderColor:"#25a244", borderWidth:1 }],
  };

  const userLineData = {
    labels: dailyUsers.map(d => d._id?.slice(5)),
    datasets: [{ label:"New users", data:dailyUsers.map(d=>d.count), borderColor:"#2563eb", backgroundColor:"rgba(37,99,235,.15)", fill:true, tension:.4 }],
  };

  const tierMap = {};
  tierDist.forEach(({ _id, count }) => { tierMap[_id] = count; });

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>Platform Analytics</h1>
        <select value={days} onChange={e => setDays(+e.target.value)} style={{ width:140 }}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
        </select>
      </div>

      <div className="grid-2" style={{ marginBottom:20 }}>
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:14 }}>Daily Scan Volume</div>
          <div style={{ height:200 }}>
            {dailyScans.length > 0
              ? <Bar data={scanData} options={chartOpts} />
              : <div className="empty-state"><p>No data</p></div>}
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:14 }}>New User Registrations</div>
          <div style={{ height:200 }}>
            {dailyUsers.length > 0
              ? <Line data={userLineData} options={chartOpts} />
              : <div className="empty-state"><p>No data</p></div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight:600, marginBottom:16 }}>User Tier Distribution</div>
        <div className="grid-4">
          {[
            { label:"Bronze",   key:"bronze",   color:"#cd7f32" },
            { label:"Silver",   key:"silver",   color:"#aaa"    },
            { label:"Gold",     key:"gold",     color:"#ffd700" },
            { label:"Platinum", key:"platinum", color:"#e5e4e2" },
          ].map(({ label, key, color }) => (
            <div key={key} className="stat-card" style={{ borderLeft:`3px solid ${color}` }}>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{tierMap[key] || 0}</div>
              <div className="stat-sub">users</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// AdminSystem
// ═══════════════════════════════════════════════════════
export function AdminSystem() {
  const [health,  setHealth]  = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminAPI.system()
      .then(r => setHealth(r.data.health))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="spinner" />;

  const mb   = v  => `${(v/1024/1024).toFixed(1)} MB`;
  const up   = () => {
    const s = Math.floor(health.uptime);
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`;
  };

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>System Health</h1>
        <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
      </div>

      <div className="grid-2" style={{ marginBottom:20 }}>
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:16 }}>Service Status</div>
          {[
            { label:"Database",     value:health.database,    ok: health.database==="connected" },
            { label:"Backend API",  value:"Running",          ok: true },
            { label:"Node Version", value:health.nodeVersion, ok: true },
            { label:"Uptime",       value:up(),               ok: true },
          ].map(({ label, value, ok }, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:14 }}>{label}</span>
              <span style={{ fontSize:13, fontWeight:600, color: ok?"var(--green)":"var(--red)" }}>
                {ok ? "✅ " : "❌ "}{value}
              </span>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight:600, marginBottom:16 }}>Memory Usage</div>
          {[
            { label:"Heap Used",  value:mb(health.memory.heapUsed)  },
            { label:"Heap Total", value:mb(health.memory.heapTotal) },
            { label:"RSS",        value:mb(health.memory.rss)       },
            { label:"External",   value:mb(health.memory.external)  },
          ].map(({ label, value }, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:14 }}>{label}</span>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--green)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight:600, marginBottom:14 }}>Quick Links</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button className="btn btn-secondary" onClick={load}>🔄 Refresh Status</button>
          <a href="https://cloud.mongodb.com" target="_blank" rel="noreferrer" className="btn btn-secondary">🍃 MongoDB Atlas →</a>
          <a href="http://localhost:5000/health" target="_blank" rel="noreferrer" className="btn btn-secondary">🔗 Backend Health →</a>
          <a href="http://localhost:8000/health" target="_blank" rel="noreferrer" className="btn btn-secondary">🤖 AI Service →</a>
        </div>
        <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface2)", borderRadius:8, fontSize:12, color:"var(--muted)" }}>
          Last checked: {new Date(health.timestamp).toLocaleString("en-IN")}
        </div>
      </div>
    </div>
  );
}
