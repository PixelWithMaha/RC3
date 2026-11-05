"use client";

// /promo — a self-playing 1920×1080 SaaS animation of TalentBridge, timed to the voiceover script.
// ?d=<seconds> sets the total duration (match the voiceover), ?t=<seconds> freezes a frame for preview.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

// Script segments with word counts → scene timing proportional to narration.
const SEGMENTS = [
  { id: "noise", words: 14 }, { id: "meet", words: 9 }, { id: "resume", words: 33 }, { id: "rank", words: 45 },
  { id: "sliders", words: 24 }, { id: "fair", words: 23 }, { id: "coach", words: 24 }, { id: "human", words: 23 }, { id: "end", words: 8 },
] as const;
type SceneId = (typeof SEGMENTS)[number]["id"];

const P = "#7C5CFF", M = "#2DD4BF", A = "#F5B544", R = "#F87171", T = "#E6E8F2", MU = "#9AA0BC", S = "#141827", L = "#272C3F", BG = "#0B0D17";
const spring = { type: "spring", stiffness: 220, damping: 24 } as const;

function useClock(total: number) {
  const params = useSearchParams();
  const frozen = params.get("t");
  const [t, setT] = useState(frozen ? Number(frozen) : 0);
  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { const s = (now - t0) / 1000; setT(Math.min(s, total)); if (s < total + 0.5) raf = requestAnimationFrame(tick); };
    // Small lead-in so the recorder catches frame 0.
    const start = setTimeout(() => { (window as unknown as { __promoStart?: number }).__promoStart = Date.now(); raf = requestAnimationFrame(tick); }, 300);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [frozen, total]);
  return t;
}

function Stage() {
  const params = useSearchParams();
  const total = Number(params.get("d") ?? 88);
  const t = useClock(total);
  const words = SEGMENTS.reduce((a, s) => a + s.words, 0);
  let acc = 0;
  const timeline = SEGMENTS.map((s) => { const start = (acc / words) * total; acc += s.words; return { ...s, start, end: (acc / words) * total }; });
  const cur = timeline.find((s) => t >= s.start && t < s.end) ?? timeline[timeline.length - 1];
  const p = Math.min(1, Math.max(0, (t - cur.start) / (cur.end - cur.start)));

  // Scale the fixed 1920×1080 stage to the window.
  const [scale, setScale] = useState(1);
  useEffect(() => { const f = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", display: "grid", placeItems: "center", overflow: "hidden" }}>
      <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "center", position: "relative", overflow: "hidden", background: BG, color: T, fontFamily: "var(--font-sans), Inter, sans-serif" }}>
        <Aurora t={t} />
        <AnimatePresence mode="wait">
          <motion.div key={cur.id} initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -30, filter: "blur(8px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} style={{ position: "absolute", inset: 0 }}>
            <Scene id={cur.id} p={p} />
          </motion.div>
        </AnimatePresence>
        <Brand />
        <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: `${(t / total) * 100}%`, background: `linear-gradient(90deg, ${P}, ${M})` }} />
      </div>
    </div>
  );
}

export default function Promo() {
  return <Suspense><Stage /></Suspense>;
}

// ---------------------------------------------------------------- shared pieces
function Aurora({ t }: { t: number }) {
  return (
    <>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: P, opacity: 0.22, filter: "blur(160px)", left: 1100 + Math.sin(t / 6) * 120, top: -300 + Math.cos(t / 7) * 80 }} />
      <div style={{ position: "absolute", width: 760, height: 760, borderRadius: "50%", background: M, opacity: 0.12, filter: "blur(160px)", left: -200 + Math.cos(t / 5) * 100, top: 600 + Math.sin(t / 8) * 60 }} />
    </>
  );
}
function Brand() {
  return (
    <div style={{ position: "absolute", left: 72, top: 56, display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 30 }}>
      <span style={{ width: 52, height: 52, borderRadius: 999, background: P, display: "grid", placeItems: "center", color: "#fff" }}>T</span>TalentBridge
    </div>
  );
}
const Title = ({ eyebrow, children, top = 170 }: { eyebrow?: string; children: React.ReactNode; top?: number }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center" }}>
    {eyebrow && <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, letterSpacing: 8, textTransform: "uppercase", color: P, marginBottom: 18 }}>{eyebrow}</div>}
    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 72, lineHeight: 1.08 }}>{children}</div>
  </div>
);
const Card = ({ style, children }: { style?: React.CSSProperties; children: React.ReactNode }) => (
  <div style={{ background: S, border: `1px solid ${L}`, borderRadius: 28, padding: 32, boxShadow: "0 40px 120px -30px rgba(124,92,255,.45)", ...style }}>{children}</div>
);
const Chip = ({ c = M, children, style }: { c?: string; children: React.ReactNode; style?: React.CSSProperties }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999, border: `2px solid ${c}88`, background: `${c}1f`, color: c, fontWeight: 600, fontSize: 26, whiteSpace: "nowrap", ...style }}>{children}</span>
);
const at = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

function Ring({ v, size = 260, label }: { v: number; size?: number; label?: string }) {
  const r = size / 2 - 18, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1C2033" strokeWidth={22} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#rg)" strokeWidth={22} strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />
        <defs><linearGradient id="rg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={P} /><stop offset="1" stopColor={M} /></linearGradient></defs>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div><div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: size * 0.32 }}>{Math.round(v)}</div>{label && <div style={{ color: MU, fontSize: 22 }}>{label}</div>}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- scenes
function Scene({ id, p }: { id: SceneId; p: number }) {
  switch (id) {
    case "noise": return <Noise p={p} />;
    case "meet": return <Meet p={p} />;
    case "resume": return <ResumeScene p={p} />;
    case "rank": return <RankScene p={p} />;
    case "sliders": return <Sliders p={p} />;
    case "fair": return <Fair p={p} />;
    case "coach": return <Coach p={p} />;
    case "human": return <Human p={p} />;
    case "end": return <End p={p} />;
  }
}

const KEYWORDS = ["Python?", "5 yrs?", "Django", "keyword match", "ATS score 62", "Java≠JavaScript", "PostgreSQL", "AI score: 71", "black box", "React", "rejected", "Docker", "why?", "SQL"];
function Noise({ p }: { p: number }) {
  return (
    <>
      {KEYWORDS.map((k, i) => {
        const ang = (i / KEYWORDS.length) * Math.PI * 2, rad = 330 + (i % 3) * 90;
        const x = 960 + Math.cos(ang + p * 0.8) * rad * 1.75, y = 540 + Math.sin(ang + p * 0.8) * rad * 0.95;
        return <motion.div key={k} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.85, scale: 1 }} transition={{ delay: i * 0.12 }}
          style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", fontFamily: "var(--font-mono)", fontSize: 30, color: i % 4 === 0 ? R : MU, padding: "10px 18px", border: `1px dashed ${L}`, borderRadius: 14, background: "#0f1222cc" }}>{k}</motion.div>;
      })}
      <Title top={430}>Hiring is <span style={{ color: R }}>noisy.</span></Title>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: p > 0.45 ? 1 : 0 }} style={{ position: "absolute", left: 0, right: 0, top: 540, textAlign: "center", fontSize: 34, color: MU }}>
        Keyword filters miss great people. AI scores are black boxes.
      </motion.div>
    </>
  );
}

function Meet({ p }: { p: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={spring}
          style={{ width: 160, height: 160, borderRadius: 999, background: `linear-gradient(135deg, ${P}, ${M})`, display: "grid", placeItems: "center", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 90, color: "#fff", margin: "0 auto 40px", boxShadow: `0 0 120px ${P}88` }}>T</motion.div>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 120 }}>Talent<span style={{ color: P }}>Bridge</span></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ fontSize: 40, color: MU, marginTop: 18 }}>
          Where candidates and recruiters meet <b style={{ color: M }}>on evidence.</b>
        </motion.div>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 50, opacity: at(p, 0.3, 0.5) }}>
          <Chip c="#E879F9">Candidates share</Chip><span style={{ fontSize: 40, color: MU }}>→</span><Chip c={P}>AI verifies</Chip><span style={{ fontSize: 40, color: MU }}>→</span><Chip c={M}>Recruiters decide</Chip>
        </div>
      </div>
    </div>
  );
}

const LINES: { t: string; hit: string; skill: string }[] = [
  { t: "Built REST APIs in Django and PostgreSQL serving 80k users.", hit: "Django", skill: "Django" },
  { t: "Containerized every service with Docker for CI/CD.", hit: "Docker", skill: "Docker" },
  { t: "Wrote Python services and Celery workers.", hit: "Python", skill: "Python" },
  { t: "Tuned Postgres queries, cutting latency by 40%.", hit: "Postgres", skill: "PostgreSQL" },
];
function ResumeScene({ p }: { p: number }) {
  const shown = Math.floor(at(p, 0.12, 0.62) * (LINES.length + 0.999));
  const fake = p > 0.7;
  return (
    <>
      <Title eyebrow="Resume parsing" top={140}>Every skill, with the line <span style={{ color: M }}>that proves it.</span></Title>
      <Card style={{ position: "absolute", left: 200, top: 400, width: 760, height: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 26 }}>
          <span style={{ background: R, color: "#fff", fontWeight: 700, fontSize: 18, padding: "6px 10px", borderRadius: 8 }}>PDF</span>
          <b style={{ fontSize: 30 }}>ayesha-khan-resume.pdf</b>
        </div>
        <div style={{ display: "grid", gap: 22, fontFamily: "var(--font-mono)", fontSize: 25, color: "#cfd3e6" }}>
          {LINES.map((l, i) => {
            const [a, b] = l.t.split(l.hit);
            return <div key={i}>{a}<span style={{ background: i < shown ? `${M}44` : "transparent", color: i < shown ? M : "#cfd3e6", borderRadius: 6, padding: "0 4px", transition: "all .4s" }}>{l.hit}</span>{b}</div>;
          })}
        </div>
        <motion.div animate={{ top: ["10%", "92%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", left: 0, right: 0, height: 60, borderBottom: `3px solid ${P}`, background: `linear-gradient(transparent, ${P}33)` }} />
      </Card>
      <div style={{ position: "absolute", left: 1040, top: 410, width: 700, display: "grid", gap: 18 }}>
        {LINES.slice(0, shown).map((l) => (
          <motion.div key={l.skill} initial={{ opacity: 0, x: -80, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={spring}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: S, border: `1px solid ${M}55`, borderRadius: 20, padding: "18px 24px" }}>
            <b style={{ fontSize: 30 }}>{l.skill}</b><Chip>✓ Verified</Chip>
          </motion.div>
        ))}
        {fake && (
          <motion.div initial={{ opacity: 0, x: -80 }} animate={{ opacity: 1, x: 0 }} transition={spring}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: S, border: `1px solid ${A}88`, borderRadius: 20, padding: "18px 24px" }}>
            <b style={{ fontSize: 30 }}>Kubernetes</b><Chip c={A}>⚠ Unverified — not in resume</Chip>
          </motion.div>
        )}
      </div>
    </>
  );
}

const BARS = [{ l: "Skills", w: 50, v: 80 }, { l: "Experience", w: 25, v: 92 }, { l: "Projects", w: 15, v: 88 }, { l: "Qualifications", w: 10, v: 78 }];
function RankScene({ p }: { p: number }) {
  const ex = at(p, 0, 0.25), sc = ease(at(p, 0.3, 0.62));
  return (
    <>
      <Title eyebrow="Explainable matching" top={130}>A score you can <span style={{ color: P }}>audit.</span></Title>
      <Card style={{ position: "absolute", left: 160, top: 360, width: 640, height: 560 }}>
        <div style={{ color: MU, fontSize: 24, marginBottom: 14 }}>Job description → AI extraction</div>
        <div style={{ fontSize: 40, fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: 24 }}>Backend Developer</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {["Python · 5", "Django · 5", "PostgreSQL · 4", "Docker · 4"].map((s, i) => (
            <motion.span key={s} initial={{ opacity: 0, y: 20 }} animate={{ opacity: ex > i * 0.22 ? 1 : 0, y: ex > i * 0.22 ? 0 : 20 }} transition={spring}><Chip c={P}>{s}</Chip></motion.span>
          ))}
        </div>
        <div style={{ marginTop: 36, display: "grid", gap: 14, opacity: at(p, 0.65, 0.8) }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}><span>Docker</span><Chip c={A} style={{ fontSize: 20 }}>Missing evidence</Chip></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}><span>Backend (Hina)</span><Chip c={R} style={{ fontSize: 20 }}>Confirmed absence</Chip></div>
        </div>
      </Card>
      <Card style={{ position: "absolute", left: 860, top: 360, width: 900, height: 560, display: "flex", alignItems: "center", gap: 50 }}>
        <Ring v={84 * sc} label="relevance" />
        <div style={{ flex: 1, display: "grid", gap: 22 }}>
          {BARS.map((b, i) => (
            <div key={b.l}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, marginBottom: 8 }}><span>{b.l} <span style={{ color: MU }}>×{b.w}%</span></span><b>{Math.round(b.v * ease(at(p, 0.3 + i * 0.06, 0.62 + i * 0.06)))}</b></div>
              <div style={{ height: 14, borderRadius: 99, background: "#1C2033" }}><div style={{ height: "100%", borderRadius: 99, width: `${b.v * ease(at(p, 0.3 + i * 0.06, 0.62 + i * 0.06))}%`, background: `linear-gradient(90deg, ${P}, ${M})` }} /></div>
            </div>
          ))}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: MU, opacity: at(p, 0.55, 0.65) }}>0.50×80 + 0.25×92 + 0.15×88 + 0.10×78 = 84 · <span style={{ color: M }}>computed in code</span></div>
        </div>
      </Card>
    </>
  );
}

// Illustrative sub-scores: Ayesha leads on skills, Bilal on experience → weighting experience swaps #1.
const PEOPLE = [{ n: "Ayesha Khan", base: [100, 60, 95, 90] }, { n: "Bilal Ahmed", base: [52, 100, 75, 85] }, { n: "Hina Raza", base: [14, 55, 40, 70] }];
function Sliders({ p }: { p: number }) {
  // Experience weight sweeps up then back, ranking re-orders live.
  const k = Math.sin(at(p, 0.1, 0.9) * Math.PI);
  const w = [50 - 30 * k, 25 + 45 * k, 15 - 10 * k, 10 - 5 * k];
  const scored = PEOPLE.map((x) => ({ ...x, s: x.base.reduce((a, v, i) => a + v * w[i], 0) / 100 })).sort((a, b) => b.s - a.s);
  return (
    <>
      <Title eyebrow="Your priorities" top={130}>Drag a slider. <span style={{ color: M }}>The ranking responds.</span></Title>
      <Card style={{ position: "absolute", left: 160, top: 360, width: 620, height: 560 }}>
        {["Skills", "Experience", "Projects", "Qualifications"].map((l, i) => (
          <div key={l} style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, marginBottom: 10 }}><span>{l}</span><b>{Math.round(w[i])}%</b></div>
            <div style={{ position: "relative", height: 10, borderRadius: 99, background: "#1C2033" }}>
              <div style={{ position: "absolute", height: "100%", borderRadius: 99, width: `${w[i]}%`, background: P }} />
              <div style={{ position: "absolute", top: -9, left: `calc(${w[i]}% - 14px)`, width: 28, height: 28, borderRadius: 99, background: T, boxShadow: `0 0 0 6px ${P}55` }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 10, padding: 18, borderRadius: 18, background: "#0f1222", fontSize: 24 }}>
          Stability: {scored[0].n === "Ayesha Khan" && k < 0.35
            ? <><Chip style={{ fontSize: 20, padding: "6px 14px" }}>Stable</Chip> <span style={{ color: MU }}>Ayesha holds #1</span></>
            : <><Chip c={A} style={{ fontSize: 20, padding: "6px 14px" }}>Sensitive</Chip> <span style={{ color: MU }}>Bilal takes #1 if Experience matters more</span></>}
        </div>
      </Card>
      <div style={{ position: "absolute", left: 860, top: 360, width: 900, display: "grid", gap: 22 }}>
        {scored.map((x, i) => (
          <motion.div layout key={x.n} transition={spring}>
            <Card style={{ display: "flex", alignItems: "center", gap: 30, padding: 26 }}>
              <b style={{ fontSize: 34, width: 60, color: i === 0 ? M : MU }}>#{i + 1}</b>
              <Ring v={x.s} size={120} />
              <b style={{ fontSize: 34, flex: 1 }}>{x.n}</b>
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function Fair({ p }: { p: number }) {
  const blur = 12 * ease(at(p, 0.2, 0.5));
  return (
    <>
      <Title eyebrow="Fairness" top={130}>Scored on skills, <span style={{ color: M }}>not identity.</span></Title>
      <Card style={{ position: "absolute", left: 260, top: 380, width: 820, height: 500 }}>
        {[["Name", "Ayesha Khan"], ["Gender", "Female"], ["Age", "27"], ["Address", "Karachi, PK"], ["Email", "ayesha@example.com"]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "18px 0", borderBottom: `1px solid ${L}`, fontSize: 30 }}>
            <span style={{ color: MU }}>{k}</span><span style={{ filter: `blur(${blur}px)` }}>{v}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 20, fontSize: 30 }}><span style={{ color: MU }}>Skills & projects</span><span style={{ color: M }}>Used for scoring</span></div>
      </Card>
      <div style={{ position: "absolute", left: 1180, top: 420, textAlign: "center" }}>
        <div style={{ fontSize: 28, color: MU, marginBottom: 20 }}>Counterfactual test</div>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <Ring v={84} size={200} label="original" />
          <span style={{ fontSize: 50, color: MU }}>=</span>
          <motion.div animate={{ opacity: p > 0.55 ? 1 : 0.2 }}><Ring v={84} size={200} label="swapped" /></motion.div>
        </div>
        <motion.div initial={{ scale: 0 }} animate={{ scale: p > 0.65 ? 1 : 0 }} transition={spring} style={{ marginTop: 30 }}><Chip>✓ Score unchanged</Chip></motion.div>
      </div>
    </>
  );
}

function Coach({ p }: { p: number }) {
  return (
    <>
      <Title eyebrow="Resume coach" top={130}>Tailor your resume. <span style={{ color: A }}>Never invent it.</span></Title>
      <div style={{ position: "absolute", left: 160, right: 160, top: 400, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        <Card>
          <div style={{ color: MU, fontSize: 22, letterSpacing: 2, marginBottom: 14 }}>YOUR LINE</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "#cfd3e6" }}>Built REST endpoints in Flask backed by MySQL.</div>
        </Card>
        <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: p > 0.15 ? 1 : 0, x: p > 0.15 ? 0 : 60 }} transition={spring}>
          <Card style={{ border: `1px solid ${M}66` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><span style={{ color: P, fontSize: 22, letterSpacing: 2 }}>SUGGESTED</span><Chip style={{ fontSize: 20, padding: "6px 14px" }}>Safe to use</Chip></div>
            <div style={{ fontSize: 30 }}>Developed <span style={{ background: `${M}40`, color: M, borderRadius: 6, padding: "0 4px" }}>REST APIs</span> using Flask and MySQL.</div>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: p > 0.5 ? 1 : 0, y: p > 0.5 ? 0 : 30 }} transition={spring} style={{ gridColumn: "span 2" }}>
          <Card style={{ border: `1px solid ${R}66`, display: "flex", alignItems: "center", gap: 24 }}>
            <Chip c={R}>Adds something new</Chip>
            <span style={{ fontSize: 28 }}>“…deployed on <span style={{ background: `${R}40`, color: R, borderRadius: 6, padding: "0 4px" }}>Kubernetes</span>, cutting costs <span style={{ background: `${R}40`, color: R, borderRadius: 6, padding: "0 4px" }}>60%</span>” — not in your resume, flagged.</span>
          </Card>
        </motion.div>
      </div>
    </>
  );
}

function Human({ p }: { p: number }) {
  const clicked = p > 0.45;
  return (
    <>
      <Title eyebrow="Human in control" top={130}>AI recommends. <span style={{ color: P }}>You decide.</span></Title>
      <Card style={{ position: "absolute", left: 360, top: 380, width: 1200, display: "flex", alignItems: "center", gap: 36 }}>
        <Ring v={100} size={150} />
        <div style={{ flex: 1 }}><b style={{ fontSize: 40 }}>Ayesha Khan</b><div style={{ color: MU, fontSize: 26 }}>Backend Developer · AI assessed</div></div>
        <motion.div animate={{ scale: p > 0.38 && p < 0.47 ? 0.92 : 1 }}
          style={{ padding: "22px 40px", borderRadius: 18, fontSize: 30, fontWeight: 700, background: clicked ? `${M}33` : P, color: clicked ? M : "#fff" }}>{clicked ? "✓ Shortlisted" : "Shortlist"}</motion.div>
      </Card>
      <motion.svg width={60} height={60} viewBox="0 0 24 24" style={{ position: "absolute" }}
        animate={{ left: [1700, 1420], top: [900, 520], scale: clicked ? 0.85 : 1 }} transition={{ duration: 1.6, ease: "easeInOut" }}>
        <path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill={T} stroke={BG} strokeWidth="1.4" />
      </motion.svg>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: p > 0.55 ? 1 : 0, y: p > 0.55 ? 0 : 30 }}
        style={{ position: "absolute", left: 360, top: 640, width: 1200, fontFamily: "var(--font-mono)", fontSize: 26, color: MU, background: "#0f1222", border: `1px solid ${L}`, borderRadius: 20, padding: 28 }}>
        audit trail · <span style={{ color: T }}>ai_assessed → <span style={{ color: M }}>shortlisted</span></span> · by recruiter · just now<br />
        <span style={{ color: M }}>statuses changed by AI: 0</span>
      </motion.div>
    </>
  );
}

function End({ p }: { p: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 130 }}>Talent<span style={{ color: P }}>Bridge</span></div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ fontSize: 52, marginTop: 20 }}>
          AI recommends. <span style={{ color: M }}>You decide.</span>
        </motion.div>
        <div style={{ marginTop: 40, fontSize: 26, color: MU, opacity: at(p, 0.2, 0.5) }}>Evidence-based hiring · Next.js · Supabase · pgvector · Gemini</div>
      </div>
    </div>
  );
}
