import { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../api/client";
import toast from "react-hot-toast";

const TIER_COLOR = { bronze:"#cd7f32", silver:"#aaa", gold:"#ffd700", platinum:"#e5e4e2" };

export default function AdminUsers() {
  const [users,    setUsers]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [tier,     setTier]     = useState("");
  const [sort,     setSort]     = useState("-createdAt");
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [award,    setAward]    = useState({ points:"", reason:"" });
  const LIMIT = 15;

  const load = useCallback((p = 1) => {
    setLoading(true);
    adminAPI.users({ page:p, limit:LIMIT, search, tier, sort })
      .then(r => { setUsers(r.data.users); setTotal(r.data.pagination.total); setPage(p); })
      .finally(() => setLoading(false));
  }, [search, tier, sort]);

  useEffect(() => { load(1); }, [search, tier, sort]);

  const openDetail = async (id) => {
    setSelected(id);
    const r = await adminAPI.userDetail(id);
    setDetail(r.data);
  };

  const ban = async (id) => {
    if (!confirm("Ban this user?")) return;
    await adminAPI.banUser(id);
    toast.success("User banned");
    load(page);
    if (detail?.user?._id === id) setDetail(null);
  };

  const unban = async (id) => {
    await adminAPI.unbanUser(id);
    toast.success("User unbanned");
    load(page);
    if (detail?.user?._id === id) openDetail(id);
  };

  const toggleAdmin = async (id, role) => {
    const newRole = role === "admin" ? "user" : "admin";
    await adminAPI.updateUser(id, { role: newRole });
    toast.success(`Role changed to ${newRole}`);
    load(page);
    if (selected === id) openDetail(id);
  };

  const givePoints = async () => {
    const pts = parseInt(award.points);
    if (!pts || pts <= 0) return toast.error("Enter valid points");
    await adminAPI.awardPoints(selected, { points: pts, reason: award.reason });
    toast.success(`${pts} points awarded!`);
    setAward({ points:"", reason:"" });
    openDetail(selected);
    load(page);
  };

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
      {/* List panel */}
      <div style={{ flex:1, overflowY:"auto", padding:"28px 24px" }}>
        <h1 className="page-title">User Management</h1>

        {/* Filters */}
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <input placeholder="🔍 Search name or email…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:200 }} />
          <select value={tier} onChange={e => setTier(e.target.value)} style={{ width:140 }}>
            <option value="">All tiers</option>
            {["bronze","silver","gold","platinum"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ width:160 }}>
            <option value="-createdAt">Newest first</option>
            <option value="createdAt">Oldest first</option>
            <option value="-points">Most points</option>
            <option value="-totalScans">Most scans</option>
          </select>
        </div>

        <div style={{ fontSize:13, color:"var(--muted)", marginBottom:12 }}>{total} users found</div>

        {loading ? <div className="spinner" /> : (
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {/* Header row */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1fr", gap:8, padding:"8px 12px", background:"var(--surface2)", borderRadius:8, fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase" }}>
              <span>Name</span><span>Email</span><span>Tier</span><span>Points</span><span>Scans</span><span>Status</span>
            </div>

            {users.map(u => (
              <div key={u._id} onClick={() => openDetail(u._id)}
                style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1fr", gap:8, padding:"10px 12px", background:selected===u._id?"rgba(37,162,68,.08)":"var(--surface)", borderRadius:8, cursor:"pointer", border:`1px solid ${selected===u._id?"var(--green)":"var(--border)"}`, marginBottom:2, transition:"all .15s" }}>
                <div style={{ fontWeight:500, fontSize:13 }}>
                  {u.name}
                  {u.role==="admin" && <span style={{ marginLeft:6, fontSize:10, background:"#7c3aed", color:"#fff", padding:"1px 6px", borderRadius:999 }}>ADMIN</span>}
                </div>
                <div style={{ fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                <div style={{ fontSize:12, fontWeight:600, color:TIER_COLOR[u.tier] }}>{u.tier}</div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--green)" }}>{u.points}</div>
                <div style={{ fontSize:13 }}>{u.totalScans}</div>
                <span className={`badge ${u.isActive?"badge-green":"badge-red"}`} style={{ fontSize:11, width:"fit-content" }}>
                  {u.isActive?"Active":"Banned"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:20 }}>
          <button className="btn btn-secondary" disabled={page===1} onClick={() => load(page-1)}>← Prev</button>
          <span style={{ alignSelf:"center", fontSize:13, color:"var(--muted)" }}>Page {page} of {Math.ceil(total/LIMIT)||1}</span>
          <button className="btn btn-secondary" disabled={page>=Math.ceil(total/LIMIT)} onClick={() => load(page+1)}>Next →</button>
        </div>
      </div>

      {/* Detail panel */}
      {detail && (
        <div style={{ width:340, borderLeft:"1px solid var(--border)", background:"var(--surface)", overflowY:"auto", padding:"20px 18px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontWeight:600 }}>User Detail</span>
            <button onClick={() => { setDetail(null); setSelected(null); }}
              style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:18 }}>✕</button>
          </div>

          {/* Avatar + info */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, padding:12, background:"var(--surface2)", borderRadius:10 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"var(--green)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:18 }}>
              {detail.user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight:600 }}>{detail.user.name}</div>
              <div style={{ fontSize:12, color:"var(--muted)" }}>{detail.user.email}</div>
              <div style={{ fontSize:11, color:TIER_COLOR[detail.user.tier], fontWeight:600, marginTop:2 }}>
                {detail.user.tier?.toUpperCase()} · {detail.user.points} pts
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid-2" style={{ marginBottom:16, gap:8 }}>
            {[["Total Scans",detail.user.totalScans],["Points",detail.user.points],["Recyclable",detail.user.scanStats?.recyclable||0],["Hazardous",detail.user.scanStats?.hazardous||0]].map(([l,v],i) => (
              <div key={i} style={{ background:"var(--bg)", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:11, color:"var(--muted)" }}>{l}</div>
                <div style={{ fontWeight:700, fontSize:18 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            <button className="btn btn-secondary" style={{ fontSize:12 }}
              onClick={() => toggleAdmin(detail.user._id, detail.user.role)}>
              {detail.user.role==="admin" ? "🔽 Remove Admin" : "🔼 Make Admin"}
            </button>
            {detail.user.isActive
              ? <button className="btn btn-danger" style={{ fontSize:12 }} onClick={() => ban(detail.user._id)}>🚫 Ban User</button>
              : <button className="btn btn-primary" style={{ fontSize:12 }} onClick={() => unban(detail.user._id)}>✅ Unban User</button>
            }
          </div>

          {/* Award points */}
          <div style={{ background:"var(--surface2)", borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontWeight:600, marginBottom:10, fontSize:13 }}>⭐ Award Bonus Points</div>
            <input type="number" placeholder="Points (e.g. 100)" value={award.points}
              onChange={e => setAward(p => ({ ...p, points:e.target.value }))} style={{ marginBottom:8 }} />
            <input placeholder="Reason (optional)" value={award.reason}
              onChange={e => setAward(p => ({ ...p, reason:e.target.value }))} style={{ marginBottom:10 }} />
            <button className="btn btn-primary" style={{ width:"100%", fontSize:12 }} onClick={givePoints}>Award Points</button>
          </div>

          {/* Recent scans */}
          <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Recent Scans</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {detail.scans.length === 0
              ? <div style={{ fontSize:12, color:"var(--muted)" }}>No scans yet</div>
              : detail.scans.slice(0,5).map(sc => (
                <div key={sc._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", background:"var(--bg)", borderRadius:6 }}>
                  <span className={`badge tag-${sc.prediction}`} style={{ fontSize:10 }}>{sc.prediction}</span>
                  <span style={{ fontSize:11, color:"var(--muted)" }}>{new Date(sc.createdAt).toLocaleDateString("en-IN")}</span>
                  <span style={{ fontSize:11, color: sc.isDuplicate?"var(--muted)":"var(--green)", fontWeight:600 }}>
                    {sc.isDuplicate ? "dup" : `+${sc.pointsEarned}`}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
