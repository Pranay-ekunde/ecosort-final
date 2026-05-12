import { useState, useRef, useCallback, useEffect } from "react";
import { scanAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const CAT = {
  recyclable:     { label:"Recyclable",     color:"#25a244", bg:"#d4f0dc", bin:"Green bin ♻️" },
  non_recyclable: { label:"Non-Recyclable", color:"#2563eb", bg:"#dbeafe", bin:"Blue bin 🗑️"  },
  hazardous:      { label:"Hazardous",      color:"#e03434", bg:"#fdeaea", bin:"Red bin ☠️"   },
};

function LimitBar({ label, used, max }) {
  const pct    = Math.min(100, Math.round((used/max)*100));
  const danger = pct >= 80;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
        <span style={{ color:"var(--muted)" }}>{label}</span>
        <span style={{ fontWeight:600, color:danger?"var(--red)":"var(--text)" }}>{used}/{max}</span>
      </div>
      <div style={{ background:"var(--surface2)", borderRadius:999, height:6, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:danger?"var(--red)":"var(--green)", borderRadius:999, transition:"width .4s" }} />
      </div>
    </div>
  );
}

function Countdown({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left<=0) { onDone?.(); return; }
    const t = setTimeout(() => setLeft(l=>l-1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div style={{ textAlign:"center", padding:"10px 0", color:"var(--muted)", fontSize:13 }}>
      ⏱ Wait <strong style={{ color:"var(--text)" }}>{left}s</strong> before next scan
    </div>
  );
}

export default function Classify() {
  const { refreshUser }         = useAuth();
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [result,   setResult]   = useState(null);
  const [scanning, setScanning] = useState(false);
  const [drag,     setDrag]     = useState(false);
  const [webcam,   setWebcam]   = useState(false);
  const [stream,   setStream]   = useState(null);
  const [limits,   setLimits]   = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const fileRef   = useRef();
  const videoRef  = useRef();
  const canvasRef = useRef();

  const fetchLimits = async () => {
    try {
      const r = await scanAPI.getLimits();
      setLimits(r.data.limits);
      setCooldown(r.data.limits.cooldownSeconds || 0);
    } catch {}
  };

  useEffect(() => { fetchLimits(); }, []);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) handleFile(f);
  }, []);

  const classify = async () => {
    if (!file) return;
    setScanning(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const r = await scanAPI.classify(form);
      setResult(r.data);
      await refreshUser();
      await fetchLimits();
      if (r.data.scan.isDuplicate) {
        toast.error("Duplicate image — no points awarded", { duration:5000 });
      } else {
        toast.success(`+${r.data.scan.pointsEarned} points earned!`);
        r.data.milestones?.forEach(m => toast.success(m, { duration:5000 }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Classification failed");
      if (err.response?.data?.limitExceeded) await fetchLimits();
    } finally { setScanning(false); }
  };

  const startWebcam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
      setStream(s); setWebcam(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject=s; }, 100);
    } catch { toast.error("Could not access webcam"); }
  };

  const captureFrame = () => {
    const v=videoRef.current, c=canvasRef.current;
    if (!v||!c) return;
    c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    c.toBlob(blob=>{
      handleFile(new File([blob],"webcam.jpg",{type:"image/jpeg"}));
      stopWebcam();
    },"image/jpeg");
  };

  const stopWebcam = () => {
    stream?.getTracks().forEach(t=>t.stop());
    setStream(null); setWebcam(false);
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); };

  const canScan = !scanning && cooldown===0 &&
    (limits?.remainingThisHour??1)>0 &&
    (limits?.remainingToday??1)>0;

  return (
    <div className="page">
      <h1 className="page-title">Classify Waste</h1>

      {limits && (
        <div className="card" style={{ marginBottom:16, padding:"14px 18px" }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:12 }}>
            🛡 Scan Limits
            <span style={{ fontSize:11, color:"var(--muted)", fontWeight:400, marginLeft:8 }}>— prevents reward abuse</span>
          </div>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:140 }}><LimitBar label="This hour" used={limits.scansLastHour} max={limits.maxPerHour} /></div>
            <div style={{ flex:1, minWidth:140 }}><LimitBar label="Today" used={limits.scansToday} max={limits.maxPerDay} /></div>
          </div>
          {cooldown>0 && <Countdown seconds={cooldown} onDone={()=>{setCooldown(0); fetchLimits();}} />}
        </div>
      )}

      {!result ? (
        <>
          {!webcam && (
            <div className="card"
              style={{ border:`2px dashed ${drag?"var(--green)":"var(--border)"}`, textAlign:"center", padding:"48px 24px", cursor:"pointer", marginBottom:16 }}
              onDragOver={e=>{e.preventDefault();setDrag(true);}}
              onDragLeave={()=>setDrag(false)}
              onDrop={onDrop}
              onClick={()=>fileRef.current?.click()}>
              {preview
                ? <img src={preview} alt="" style={{ maxHeight:240, maxWidth:"100%", borderRadius:8, marginBottom:12 }} />
                : <>
                    <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
                    <div style={{ fontWeight:600, marginBottom:6 }}>Drop an image here</div>
                    <div style={{ fontSize:13, color:"var(--muted)" }}>or click to browse · JPG, PNG, WEBP · max 5MB</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:10 }}>💡 Duplicate images earn 0 points</div>
                  </>}
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e=>handleFile(e.target.files[0])} />
            </div>
          )}

          {webcam && (
            <div className="card" style={{ marginBottom:16 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", borderRadius:8, maxHeight:360, objectFit:"cover" }} />
              <canvas ref={canvasRef} style={{ display:"none" }} />
              <div style={{ display:"flex", gap:10, marginTop:14 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={captureFrame}>📷 Capture</button>
                <button className="btn btn-secondary" onClick={stopWebcam}>Stop</button>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {!webcam && <button className="btn btn-secondary" onClick={startWebcam} disabled={!canScan}>📷 Use Webcam</button>}
            {file && !webcam && (
              <>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={classify} disabled={!canScan||scanning}>
                  {scanning?"Analysing…":cooldown>0?`⏱ Wait ${cooldown}s`:!canScan?"Limit reached":"🔍 Classify"}
                </button>
                <button className="btn btn-secondary" onClick={reset}>✕ Clear</button>
              </>
            )}
          </div>
        </>
      ) : (
        <div>
          {result.scan.isDuplicate && (
            <div style={{ marginBottom:16, padding:"14px 18px", background:"#fef3c7", border:"1px solid #f59e0b", borderLeft:"4px solid #f59e0b", borderRadius:10 }}>
              <div style={{ fontWeight:600, color:"#78350f", marginBottom:4 }}>⚠️ Duplicate Image Detected</div>
              <div style={{ fontSize:13, color:"#92400e" }}>{result.warning}</div>
            </div>
          )}
          <div className="grid-2" style={{ marginBottom:20 }}>
            <div style={{ position:"relative" }}>
              <img src={result.scan.imageUrl} alt="" style={{ width:"100%", borderRadius:12, maxHeight:300, objectFit:"cover", display:"block" }} />
                          </div>
            <div className="card" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ fontSize:12, color:"var(--muted)", marginBottom:6 }}>Classification Result</div>
                <div style={{ background:CAT[result.scan.prediction]?.bg, color:CAT[result.scan.prediction]?.color, padding:"12px 18px", borderRadius:10, fontWeight:700, fontSize:20 }}>
                  {CAT[result.scan.prediction]?.label}
                </div>
              </div>
              {["recyclable","non_recyclable","hazardous"].map(cls => (
                <div key={cls}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                    <span style={{ color:"var(--muted)" }}>{CAT[cls].label}</span>
                    <span style={{ fontWeight:600, color:CAT[cls].color }}>{Math.round((result.scan.allScores?.[cls]||0)*100)}%</span>
                  </div>
                  <div style={{ background:"var(--surface2)", borderRadius:999, height:8, overflow:"hidden" }}>
                    <div style={{ width:`${Math.round((result.scan.allScores?.[cls]||0)*100)}%`, height:"100%", background:CAT[cls].color, borderRadius:999 }} />
                  </div>
                </div>
              ))}
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:13, color:"var(--muted)", marginBottom:4 }}>💡 Disposal</div>
                <div style={{ fontWeight:600, color:CAT[result.scan.prediction]?.color }}>{CAT[result.scan.prediction]?.bin}</div>
              </div>
              <div style={{ textAlign:"center", fontWeight:700, fontSize:20, color:result.scan.isDuplicate?"var(--muted)":"var(--green)" }}>
                {result.scan.isDuplicate?"0 points (duplicate)":`+${result.scan.pointsEarned} points earned!`}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={reset} style={{ width:"100%" }}>🔍 Classify another item</button>
        </div>
      )}
    </div>
  );
}
