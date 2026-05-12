import { useEffect, useState } from "react";
import { scanAPI } from "../api/client";
import toast from "react-hot-toast";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from "chart.js";
import { analyticsAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { rewardAPI } from "../api/client";
import { couponAPI } from "../api/client";
import { leaderboardAPI } from "../api/client";
import api from "../api/client";

// History.jsx

const CAT = { recyclable:"tag-recyclable", non_recyclable:"tag-non_recyclable", hazardous:"tag-hazardous" };
const LBL = { recyclable:"Recyclable", non_recyclable:"Non-Recyclable", hazardous:"Hazardous" };

export function History() {
  const [scans,  setScans]  = useState([]);
  const [total,  setTotal]  = useState(0);
  const [page,   setPage]   = useState(1);
  const [filter, setFilter] = useState("");
  const [loading,setLoading]= useState(true);
  const LIMIT = 12;

  const load = (p=1, cat=filter) => {
    setLoading(true);
    const params = { page:p, limit:LIMIT };
    if (cat) params.category = cat;
    scanAPI.getAll(params).then(r => { setScans(r.data.scans); setTotal(r.data.pagination.total); setPage(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1, filter); }, [filter]);

  const del = async (id) => {
    if (!confirm("Delete this scan?")) return;
    await scanAPI.delete(id);
    toast.success("Deleted"); load(page);
  };

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>Scan History</h1>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ width:180 }}>
          <option value="">All categories</option>
          <option value="recyclable">Recyclable</option>
          <option value="non_recyclable">Non-Recyclable</option>
          <option value="hazardous">Hazardous</option>
        </select>
      </div>
      {loading ? <div className="spinner" /> : scans.length===0 ? (
        <div className="empty-state"><div className="icon">📋</div><p>No scans found.</p></div>
      ) : (
        <>
          <div className="grid-3">
            {scans.map(scan => (
              <div key={scan._id} className="card" style={{ padding:0, overflow:"hidden" }}>
                <img src={scan.imageUrl} alt="" style={{ width:"100%", height:160, objectFit:"cover" }}
                  onError={e=>{e.target.style.display="none";}} />
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <span className={`badge ${CAT[scan.prediction]}`}>{LBL[scan.prediction]}</span>
                    <span style={{ fontSize:13, color:scan.isDuplicate?"var(--muted)":"var(--green)", fontWeight:600 }}>
                      {scan.isDuplicate?"0 pts":`+${scan.pointsEarned} pts`}
                    </span>
                  </div>
                  {scan.isDuplicate && <div style={{ fontSize:11, color:"var(--amber)", marginBottom:6 }}>⚠ duplicate — 0 points</div>}
                  <div style={{ fontSize:12, color:"var(--muted)", marginBottom:8 }}>
                    {Math.round(scan.confidence*100)}% · {new Date(scan.createdAt).toLocaleDateString("en-IN")}
                  </div>
                  <button onClick={()=>del(scan._id)} style={{ fontSize:12, color:"var(--red)", background:"none", border:"none", cursor:"pointer" }}>🗑 Delete</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:24 }}>
            <button className="btn btn-secondary" disabled={page===1} onClick={()=>load(page-1)}>← Prev</button>
            <span style={{ alignSelf:"center", fontSize:13, color:"var(--muted)" }}>Page {page} of {Math.ceil(total/LIMIT)}</span>
            <button className="btn btn-secondary" disabled={page>=Math.ceil(total/LIMIT)} onClick={()=>load(page+1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

// Analytics.jsx
Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export function Analytics() {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [global,  setGlobal]  = useState(null);
  const [months,  setMonths]  = useState(6);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([analyticsAPI.summary(), analyticsAPI.monthly(months), analyticsAPI.global()])
      .then(([s,m,g]) => { setSummary(s.data.summary); setMonthly(m.data.data); setGlobal(g.data.stats); })
      .finally(() => setLoading(false));
  }, [months]);

  if (loading) return <div className="spinner" />;

  const barData = {
    labels: monthly.map(d=>d.month),
    datasets: [
      { label:"Recyclable",     data:monthly.map(d=>d.recyclable),     backgroundColor:"#25a244" },
      { label:"Non-Recyclable", data:monthly.map(d=>d.non_recyclable), backgroundColor:"#2563eb" },
      { label:"Hazardous",      data:monthly.map(d=>d.hazardous),      backgroundColor:"#e03434" },
    ],
  };
  const donutData = {
    labels: ["Recyclable","Non-Recyclable","Hazardous"],
    datasets: [{ data:[summary?.breakdown?.recyclable||0,summary?.breakdown?.non_recyclable||0,summary?.breakdown?.hazardous||0],
      backgroundColor:["#25a244","#2563eb","#e03434"], borderWidth:0 }],
  };
  const opts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} },
    scales:{ x:{ticks:{color:"#5e7a5e"},grid:{display:false}}, y:{ticks:{color:"#5e7a5e"},grid:{color:"#1e2a1e"}} } };

  return (
    <div className="page">
      <h1 className="page-title">Analytics</h1>
      <div className="grid-4" style={{ marginBottom:24 }}>
        {[{ label:"Total Scans",value:summary?.totalScans??0 },{ label:"This Month",value:summary?.monthlyScans??0 },
          { label:"Points",value:summary?.points??0 },{ label:"Global Users",value:global?.totalUsers??0 }].map((s,i)=>(
          <div key={i} className="stat-card"><div className="stat-label">{s.label}</div><div className="stat-value">{s.value}</div></div>
        ))}
      </div>
      <div className="grid-2" style={{ marginBottom:24 }}>
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontWeight:600 }}>Monthly Breakdown</span>
            <select value={months} onChange={e=>setMonths(+e.target.value)} style={{ width:110 }}>
              <option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option>
            </select>
          </div>
          <div style={{ height:240 }}>
            {monthly.length>0?<Bar data={barData} options={opts}/>:<div className="empty-state"><p>No data</p></div>}
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:16 }}>All-Time Split</div>
          <div style={{ height:200, display:"flex", justifyContent:"center" }}>
            <Doughnut data={donutData} options={{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, cutout:"65%" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:16 }}>
            {[["#25a244","Recyclable",summary?.breakdown?.recyclable??0],["#2563eb","Non-Recyclable",summary?.breakdown?.non_recyclable??0],["#e03434","Hazardous",summary?.breakdown?.hazardous??0]].map(([color,label,val])=>(
              <div key={label} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ width:12, height:12, borderRadius:3, background:color, flexShrink:0 }} />
                <span style={{ fontSize:13, flex:1 }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:600 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Rewards.jsx

export function Rewards() {
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([rewardAPI.balance(), rewardAPI.history()])
      .then(([b,h]) => { setBalance(b.data.balance); setHistory(h.data.rewards); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const TIER_COLOR = { bronze:"#cd7f32", silver:"#aaa", gold:"#ffd700", platinum:"#e5e4e2" };

  return (
    <div className="page">
      <h1 className="page-title">Rewards</h1>
      <div className="card" style={{ marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
        <div>
          <div style={{ fontSize:13, color:"var(--muted)", marginBottom:4 }}>Your Balance</div>
          <div style={{ fontSize:48, fontWeight:700, color:"var(--green)", lineHeight:1 }}>{balance?.points??0}</div>
          <div style={{ fontSize:14, color:"var(--muted)", marginTop:4 }}>points</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:13, color:"var(--muted)", marginBottom:4 }}>Tier</div>
          <div style={{ fontSize:22, fontWeight:700, color:TIER_COLOR[balance?.tier] }}>{balance?.tier?.toUpperCase()}</div>
          {balance?.nextTier && <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>{balance.pointsToNextTier} pts to {balance.nextTier}</div>}
        </div>
      </div>
      <div className="card" style={{ marginBottom:24 }}>
        <div style={{ fontWeight:600, marginBottom:14 }}>How to Earn Points</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[["Classify Recyclable","+10 pts","#25a244"],["Classify Non-Recyclable","+5 pts","#2563eb"],["Classify Hazardous","+15 pts","#e03434"],["Welcome bonus (signup)","+50 pts","var(--amber)"],["10-scan milestone","+50 pts","var(--amber)"],["50-scan milestone","+100 pts","var(--amber)"]].map(([a,p,c],i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:14 }}>{a}</span>
              <span style={{ color:c, fontWeight:700 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div style={{ fontWeight:600, marginBottom:16 }}>Transaction History</div>
        {history.length===0?<div className="empty-state"><div className="icon">⭐</div><p>No transactions yet</p></div>:(
          <div style={{ display:"flex", flexDirection:"column" }}>
            {history.map(tx=>(
              <div key={tx._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize:14 }}>{tx.description}</div>
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{new Date(tx.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                  <span style={{ fontWeight:700, color:tx.type==="earn"?"var(--green)":"var(--red)" }}>{tx.type==="earn"?"+":""}{tx.points} pts</span>
                  <span style={{ fontSize:11, color:"var(--muted)" }}>Bal: {tx.balanceAfter}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Coupons.jsx

const CAT_ICON = { grocery:"🛒",electronics:"💻",clothing:"👕",food:"🍔",transport:"🚗",other:"🎁" };

export function Coupons() {
  const { user, refreshUser } = useAuth();
  const [tab,       setTab]      = useState("catalogue");
  const [catalogue, setCatalogue]= useState([]);
  const [mine,      setMine]     = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [redeeming, setRedeeming]= useState(null);

  const load = () => Promise.all([couponAPI.catalogue(), couponAPI.my()])
    .then(([c,m]) => { setCatalogue(c.data.catalogue); setMine(m.data.coupons); })
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const redeem = async (idx) => {
    const item = catalogue[idx];
    if ((user?.points??0) < item.pointsCost) { toast.error(`Need ${item.pointsCost} pts, you have ${user?.points}`); return; }
    if (!confirm(`Redeem "${item.discount}" at ${item.brand} for ${item.pointsCost} pts?`)) return;
    setRedeeming(idx);
    try { await couponAPI.redeem(idx); toast.success("Coupon redeemed!"); await refreshUser(); await load(); setTab("mine"); }
    catch (err) { toast.error(err.response?.data?.message||"Failed"); }
    finally { setRedeeming(null); }
  };

  const markUsed = async (code) => {
    try { await couponAPI.use(code); toast.success("Marked as used"); await load(); }
    catch (err) { toast.error(err.response?.data?.message||"Error"); }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>Coupons</h1>
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:4, display:"flex", gap:4 }}>
          {["catalogue","mine"].map(t=>(
            <button key={t} className={`btn ${tab===t?"btn-primary":""}`} style={{ padding:"6px 16px", fontSize:13 }} onClick={()=>setTab(t)}>
              {t==="catalogue"?"🛍 Catalogue":`🎫 Mine (${mine.filter(c=>!c.isRedeemed).length})`}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:20 }}>⭐</span>
        <span>You have <strong style={{ color:"var(--green)" }}>{user?.points??0} points</strong> to redeem</span>
      </div>
      {tab==="catalogue"?(
        <div className="grid-3">
          {catalogue.map((item,idx)=>{
            const ok=(user?.points??0)>=item.pointsCost;
            return (
              <div key={idx} className="card" style={{ opacity:ok?1:0.6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                  <span style={{ fontSize:28 }}>{CAT_ICON[item.category]}</span>
                  <span className={`badge ${ok?"badge-green":"badge-amber"}`}>{item.pointsCost} pts</span>
                </div>
                <div style={{ fontWeight:700, fontSize:18, color:"var(--green)", marginBottom:4 }}>{item.discount}</div>
                <div style={{ fontWeight:600, marginBottom:6 }}>{item.brand}</div>
                <div style={{ fontSize:13, color:"var(--muted)", marginBottom:16 }}>{item.description}</div>
                <button className={`btn ${ok?"btn-primary":"btn-secondary"}`} style={{ width:"100%" }}
                  disabled={!ok||redeeming===idx} onClick={()=>redeem(idx)}>
                  {redeeming===idx?"Redeeming…":ok?"Redeem":"Not enough points"}
                </button>
              </div>
            );
          })}
        </div>
      ):(
        mine.length===0?<div className="empty-state"><div className="icon">🎫</div><p>No coupons yet. Redeem from catalogue!</p></div>:(
          <div className="grid-2">
            {mine.map(c=>(
              <div key={c._id} className="card" style={{ opacity: c.isRedeemed ? 0.5 : 1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontWeight:700, fontSize:17, color:c.isRedeemed?"var(--muted)":"var(--green)" }}>{c.discount}</span>
                  <span className={`badge ${c.isRedeemed?"badge-amber":"badge-green"}`}>{c.isRedeemed?"Used":"Active"}</span>
                </div>
                <div style={{ fontWeight:600, marginBottom:4 }}>{c.brand}</div>
                <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, letterSpacing:2, background:"var(--surface2)", padding:"8px 12px", borderRadius:6, marginBottom:10 }}>{c.code}</div>
                <div style={{ fontSize:12, color:"var(--muted)", marginBottom:12 }}>Expires: {new Date(c.expiresAt).toLocaleDateString("en-IN")}</div>
                {!c.isRedeemed&&<button className="btn btn-danger" style={{ width:"100%", fontSize:13 }} onClick={()=>markUsed(c.code)}>Mark as Used</button>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// Leaderboard.jsx

const TIER_COLOR = { bronze:"#cd7f32", silver:"#aaa", gold:"#ffd700", platinum:"#e5e4e2" };
const RANK_ICON  = ["🥇","🥈","🥉"];

export function Leaderboard() {
  const { user }              = useAuth();
  const [tab,  setTab]        = useState("overall");
  const [data, setData]       = useState([]);
  const [rank, setRank]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "weekly") setRank(null);
    const fn = tab==="overall" ? leaderboardAPI.overall() : leaderboardAPI.weekly();
    fn.then(r => { setData(r.data.leaderboard); if(tab==="overall") setRank(r.data.userRank); })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>Leaderboard 🏆</h1>
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:4, display:"flex", gap:4 }}>
          {["overall","weekly"].map(t=>(
            <button key={t} className={`btn ${tab===t?"btn-primary":""}`} style={{ padding:"6px 16px", fontSize:13 }} onClick={()=>setTab(t)}>
              {t==="overall"?"All Time":"This Week"}
            </button>
          ))}
        </div>
      </div>
      {tab==="overall"&&rank&&(
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 18px", marginBottom:20 }}>
          📍 Your rank: <strong style={{ color:"var(--green)" }}>#{rank}</strong>
        </div>
      )}
      {loading?<div className="spinner"/>:(
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          {data.map((u,i)=>{
            const isMe=u._id===user?._id||u.name===user?.name;
            return (
              <div key={u._id||i} style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 20px", borderBottom:"1px solid var(--border)", background:isMe?"rgba(37,162,68,.07)":"transparent" }}>
                <div style={{ width:32, textAlign:"center", fontSize:i<3?22:14, color:i>=3?"var(--muted)":undefined, fontWeight:600 }}>{i<3?RANK_ICON[i]:`#${i+1}`}</div>
                <div style={{ width:38, height:38, borderRadius:"50%", background:"var(--green)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:15, flexShrink:0 }}>{u.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
                    {u.name}{isMe&&<span className="badge badge-green">You</span>}
                  </div>
                  <div style={{ fontSize:12, color:TIER_COLOR[u.tier], fontWeight:600, marginTop:2 }}>{u.tier?.toUpperCase()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:700, color:"var(--green)" }}>{tab==="overall"?`${u.points} pts`:`${u.weeklyPoints} pts`}</div>
                  <div style={{ fontSize:12, color:"var(--muted)" }}>{tab==="overall"?`${u.totalScans} scans`:`${u.weeklyScans} scans`}</div>
                </div>
              </div>
            );
          })}
          {data.length===0&&<div className="empty-state"><p>No data yet</p></div>}
        </div>
      )}
    </div>
  );
}

// Profile.jsx

export function Profile() {
  const { user, refreshUser }         = useAuth();
  const [name,      setName]          = useState(user?.name||"");
  const [saving,    setSaving]        = useState(false);
  const [pwForm,    setPwForm]        = useState({ currentPassword:"", newPassword:"" });
  const [pwLoading, setPwLoading]     = useState(false);
  const TIER_COLOR = { bronze:"#cd7f32", silver:"#aaa", gold:"#ffd700", platinum:"#e5e4e2" };

  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.put("/users/profile", { name }); await refreshUser(); toast.success("Profile updated"); }
    catch { toast.error("Update failed"); }
    finally { setSaving(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword.length<6) return toast.error("New password must be 6+ chars");
    setPwLoading(true);
    try {
      const { authAPI } = await import("../api/client");
      await authAPI.changePassword(pwForm);
      toast.success("Password changed"); setPwForm({ currentPassword:"", newPassword:"" });
    } catch (err) { toast.error(err.response?.data?.message||"Failed"); }
    finally { setPwLoading(false); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>
      <div className="grid-2">
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:"var(--green)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:26 }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:18 }}>{user?.name}</div>
                <div style={{ fontSize:13, color:"var(--muted)" }}>{user?.email}</div>
                <div style={{ fontSize:13, color:TIER_COLOR[user?.tier], fontWeight:600, marginTop:2 }}>{user?.tier?.toUpperCase()} Tier</div>
              </div>
            </div>
            <form onSubmit={saveProfile} style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:13, color:"var(--muted)", display:"block", marginBottom:6 }}>Display Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />
              </div>
              <button className="btn btn-primary" disabled={saving}>{saving?"Saving…":"Save Changes"}</button>
            </form>
          </div>
          <div className="card">
            <div style={{ fontWeight:600, marginBottom:14 }}>Change Password</div>
            <form onSubmit={changePassword} style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:13, color:"var(--muted)", display:"block", marginBottom:6 }}>Current Password</label>
                <input type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(p=>({...p,currentPassword:e.target.value}))} placeholder="••••••" />
              </div>
              <div>
                <label style={{ fontSize:13, color:"var(--muted)", display:"block", marginBottom:6 }}>New Password</label>
                <input type="password" value={pwForm.newPassword} onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))} placeholder="Min 6 characters" />
              </div>
              <button className="btn btn-secondary" disabled={pwLoading}>{pwLoading?"Updating…":"Change Password"}</button>
            </form>
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:14 }}>Your Stats</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[["Total Points",user?.points??0,"var(--green)"],["Total Scans",user?.totalScans??0],["Recyclable scans",user?.scanStats?.recyclable??0,"#25a244"],["Non-recyclable",user?.scanStats?.non_recyclable??0,"#2563eb"],["Hazardous scans",user?.scanStats?.hazardous??0,"#e03434"],["Member since",user?.createdAt?new Date(user.createdAt).toLocaleDateString("en-IN",{month:"long",year:"numeric"}):"—"]].map(([l,v,c],i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:14, color:"var(--muted)" }}>{l}</span>
                <span style={{ fontWeight:600, color:c||"var(--text)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
