// Demo seed (PRD §12). Usage:
//   node scripts/seed-demo.mjs pdfs        -> writes public/demo/*.pdf (no network)
//   DEMO_PASSWORD=... node --env-file=.env.local scripts/seed-demo.mjs accounts
//       -> creates confirmed demo accounts via the Supabase admin API
//   DEMO_PASSWORD=... SEED_BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/seed-demo.mjs all
//       -> accounts + jobs + resumes + applications + a few recruiter actions, all through the REAL
//          app routes (/api/jobs, /api/resume/parse, /api/match) so Gemini actually parses and scores.
// Nothing AI-generated is hardcoded here. Safe to re-run: existing rows are reused.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const RESUMES = {
  "strong-ayesha-khan.pdf": [
    "Ayesha Khan | ayesha.khan@example.com | +92 300 1110001 | Karachi",
    "linkedin.com/in/rc3-demo-ayesha | github.com/rc3-demo-ayesha | ayesha.example.com",
    "Summary: Backend engineer with 5 years of experience building Python web services.",
    "Skills: Python, Django, Django REST Framework, PostgreSQL, Docker, Redis, Celery, Git",
    "",
    "Experience",
    "Senior Backend Developer, Nimbus Tech (2021 - 2025)",
    "- Built REST APIs in Django and PostgreSQL serving 80k daily users.",
    "- Containerized every service with Docker and Docker Compose for CI/CD.",
    "- Tuned PostgreSQL queries and indexes, cutting p95 latency by 40%.",
    "Backend Developer, CodeWorks (2020 - 2021)",
    "- Wrote Python services and Celery workers for billing jobs.",
    "",
    "Projects",
    "ShopAPI: e-commerce backend with Django REST Framework, PostgreSQL and Docker.",
    "TaskFlow: Dockerized Django app deployed to AWS with GitHub Actions.",
    "",
    "Education",
    "BSc Computer Science, FAST NUCES, 2016 - 2020",
  ],
  "partial-bilal-ahmed.pdf": [
    "Bilal Ahmed | bilal.ahmed@example.com | +92 321 2220002 | Lahore",
    "linkedin.com/in/rc3-demo-bilal | github.com/rc3-demo-bilal",
    "Summary: Python developer with 3 years of experience in web APIs.",
    "Skills: Python, Flask, MySQL, REST APIs, Git, Linux",
    "",
    "Experience",
    "Software Engineer, DataBridge (2022 - 2025)",
    "- Built REST endpoints in Flask backed by MySQL for a logistics dashboard.",
    "- Wrote Python ETL scripts and unit tests with pytest.",
    "Junior Developer, WebNest (2021 - 2022)",
    "- Maintained Flask admin tools and MySQL reports.",
    "",
    "Projects",
    "FleetTrack: Flask API with MySQL for vehicle tracking.",
    "",
    "Education",
    "BS Software Engineering, COMSATS, 2017 - 2021",
  ],
  "weak-hina-raza.pdf": [
    "Hina Raza | hina.raza@example.com | +92 333 3330003 | Islamabad",
    "linkedin.com/in/rc3-demo-hina | hina.example.com",
    "Summary: Frontend developer focused on React interfaces. No backend experience yet.",
    "Skills: JavaScript, React, HTML, CSS, Tailwind CSS, Figma",
    "",
    "Experience",
    "Frontend Developer, PixelHouse (2022 - 2025)",
    "- Built React dashboards and reusable component libraries in JS.",
    "- Worked with designers in Figma to ship responsive UIs.",
    "",
    "Projects",
    "PortfolioKit: React and Tailwind CSS portfolio builder.",
    "",
    "Education",
    "BS Computer Science, NUST, 2018 - 2022",
  ],
  "frontend-zara-malik.pdf": [
    "Zara Malik | zara.malik@example.com | +92 300 4440004 | Lahore",
    "linkedin.com/in/rc3-demo-zara | github.com/rc3-demo-zara | zara.example.com",
    "Summary: Frontend engineer with 4 years building fast, accessible web apps.",
    "Skills: TypeScript, JavaScript, React, Next.js, Tailwind CSS, Jest, Testing Library, Figma",
    "",
    "Experience",
    "Frontend Engineer, Lumen Labs (2021 - 2025)",
    "- Built a Next.js and TypeScript storefront used by 120k monthly visitors.",
    "- Wrote Jest and Testing Library suites, raising coverage to 85%.",
    "- Led an accessibility pass that fixed 200+ WCAG issues.",
    "",
    "Projects",
    "DesignKit: React component library in TypeScript with Storybook.",
    "",
    "Education",
    "BS Computer Science, LUMS, 2017 - 2021",
  ],
  "data-omar-farooq.pdf": [
    "Omar Farooq | omar.farooq@example.com | +92 301 5550005 | Karachi",
    "linkedin.com/in/rc3-demo-omar",
    "Summary: Data analyst with 3 years turning messy data into business decisions.",
    "Skills: Python, SQL, Pandas, Tableau, Excel, Statistics, PostgreSQL",
    "",
    "Experience",
    "Data Analyst, RetailCo (2022 - 2025)",
    "- Wrote SQL on PostgreSQL to build weekly sales and churn reports.",
    "- Built Tableau dashboards used by 40 store managers.",
    "- Ran A/B test analysis in Python with Pandas and statistics libraries.",
    "",
    "Projects",
    "ChurnLens: Python and Pandas churn model with a Tableau front end.",
    "",
    "Education",
    "BS Economics, IBA Karachi, 2018 - 2022",
  ],
  "devops-usman-tariq.pdf": [
    "Usman Tariq | usman.tariq@example.com | +92 322 6660006 | Islamabad",
    "linkedin.com/in/rc3-demo-usman | github.com/rc3-demo-usman",
    "Summary: DevOps engineer with 4 years automating infrastructure and deployments.",
    "Skills: Docker, Kubernetes, AWS, Terraform, CI/CD, GitHub Actions, Linux, Python",
    "",
    "Experience",
    "DevOps Engineer, CloudNest (2021 - 2025)",
    "- Migrated 30 services to Kubernetes on AWS with Terraform modules.",
    "- Built GitHub Actions CI/CD pipelines cutting deploy time from 40 to 8 minutes.",
    "- Containerized legacy apps with Docker and set up Prometheus alerting.",
    "",
    "Projects",
    "InfraKit: Terraform modules for AWS VPC, EKS and RDS.",
    "",
    "Education",
    "BS Computer Engineering, NUST, 2017 - 2021",
  ],
};

/** Minimal valid text PDF (Helvetica, one page). */
function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (m) => "\\" + m);
  const stream = "BT /F1 11 Tf 50 790 Td 16 TL\n" + lines.map((l) => `(${esc(l)}) Tj T*`).join("\n") + "\nET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

const RECRUITERS = [
  { email: "recruiter@rc3.demo", full_name: "Demo Recruiter" },
  { email: "talent@rc3.demo", full_name: "Talent Lead" },
];
const CANDIDATES = [
  { email: "ayesha@rc3.demo", full_name: "Ayesha Khan", pdf: "strong-ayesha-khan.pdf" },
  { email: "bilal@rc3.demo", full_name: "Bilal Ahmed", pdf: "partial-bilal-ahmed.pdf" },
  { email: "hina@rc3.demo", full_name: "Hina Raza", pdf: "weak-hina-raza.pdf" },
  { email: "zara@rc3.demo", full_name: "Zara Malik", pdf: "frontend-zara-malik.pdf" },
  { email: "omar@rc3.demo", full_name: "Omar Farooq", pdf: "data-omar-farooq.pdf" },
  { email: "usman@rc3.demo", full_name: "Usman Tariq", pdf: "devops-usman-tariq.pdf" },
];
const sk = (...pairs) => pairs.map(([name, importance]) => ({ name, importance }));
const JOBS = [
  {
    owner: "recruiter@rc3.demo", title: "Backend Developer", department: "Engineering", location: "Lahore (hybrid)", type: "full-time",
    salary_min: 250000, salary_max: 400000,
    description: "We're hiring a Backend Developer to build and scale our APIs. You must have strong Python and Django experience and solid PostgreSQL skills (schema design, query tuning). Experience containerizing services with Docker is required. 3+ years of professional backend experience. Bachelor's degree in Computer Science or related field. Nice to have: AWS, Redis, CI/CD pipelines.",
    required_skills: sk(["Python", 5], ["Django", 5], ["PostgreSQL", 4], ["Docker", 4]),
    preferred_skills: sk(["AWS", 2], ["Redis", 2], ["CI/CD", 2]),
    min_experience_years: 3, qualifications: ["Bachelor's degree in Computer Science or related field"],
  },
  {
    owner: "recruiter@rc3.demo", title: "Data Analyst", department: "Analytics", location: "Karachi", type: "full-time",
    salary_min: 180000, salary_max: 280000,
    description: "Analyse sales and customer data, build dashboards and run experiments. Strong SQL and Python (Pandas) required, plus Tableau or a similar BI tool. Comfortable with statistics and A/B testing. 2+ years experience.",
    required_skills: sk(["SQL", 5], ["Python", 4], ["Pandas", 4], ["Tableau", 3], ["Statistics", 3]),
    preferred_skills: sk(["PostgreSQL", 2], ["Excel", 2]),
    min_experience_years: 2, qualifications: ["Bachelor's degree in a quantitative field"],
  },
  {
    owner: "talent@rc3.demo", title: "Frontend Developer", department: "Product", location: "Remote", type: "remote",
    salary_min: 220000, salary_max: 350000,
    description: "Build our customer-facing web app in React and TypeScript with Next.js. You care about accessibility and testing (Jest). 3+ years of frontend experience. Nice to have: design system work, Tailwind CSS.",
    required_skills: sk(["React", 5], ["TypeScript", 5], ["Next.js", 4], ["JavaScript", 4], ["Jest", 3]),
    preferred_skills: sk(["Tailwind CSS", 2], ["Figma", 1]),
    min_experience_years: 3, qualifications: [],
  },
  {
    owner: "talent@rc3.demo", title: "DevOps Engineer", department: "Platform", location: "Islamabad", type: "full-time",
    salary_min: 260000, salary_max: 420000,
    description: "Own our cloud platform: Kubernetes on AWS, infrastructure as code with Terraform, and CI/CD pipelines. Docker and Linux expertise required. 3+ years experience. Nice to have: Python scripting, monitoring with Prometheus.",
    required_skills: sk(["Kubernetes", 5], ["AWS", 5], ["Terraform", 4], ["Docker", 4], ["CI/CD", 4]),
    preferred_skills: sk(["Python", 2], ["Linux", 2]),
    min_experience_years: 3, qualifications: [],
  },
];
// [candidate, job title]. Backend Developer = the official PRD demo trio (left at "AI assessed" for the live demo).
const APPLICATIONS = [
  ["ayesha@rc3.demo", "Backend Developer"], ["bilal@rc3.demo", "Backend Developer"], ["hina@rc3.demo", "Backend Developer"],
  ["zara@rc3.demo", "Frontend Developer"], ["hina@rc3.demo", "Frontend Developer"],
  ["omar@rc3.demo", "Data Analyst"], ["bilal@rc3.demo", "Data Analyst"],
  ["usman@rc3.demo", "DevOps Engineer"], ["ayesha@rc3.demo", "DevOps Engineer"],
];
// Recruiter decisions on the NON-demo jobs so dashboards, funnel and interviews have data.
const ACTIONS = [
  { candidate: "zara@rc3.demo", job: "Frontend Developer", to: ["shortlisted", "interview"], reason: "Strong React/TypeScript evidence", interview: { inDays: 2, hour: 11, interviewer: "Talent Lead", type: "technical" } },
  { candidate: "omar@rc3.demo", job: "Data Analyst", to: ["shortlisted"], reason: "SQL + Tableau proven in work" },
  { candidate: "usman@rc3.demo", job: "DevOps Engineer", to: ["shortlisted"], reason: "Kubernetes on AWS at scale" },
  { candidate: "ayesha@rc3.demo", job: "DevOps Engineer", to: ["rejected"], reason: "Better fit for the backend role" },
];

function env() {
  const e = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secret: process.env.SUPABASE_SECRET_KEY, password: process.env.DEMO_PASSWORD,
    base: (process.env.SEED_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  };
  if (!e.password || e.password.length < 6) throw new Error("Set DEMO_PASSWORD (min 6 chars, Supabase minimum)");
  if (!e.url || !e.anon || !e.secret) throw new Error("Run with --env-file=.env.local (needs Supabase URL, publishable and secret keys)");
  return e;
}

async function ensureAccounts(E, admin) {
  const all = [...RECRUITERS.map((r) => ({ ...r, role: "recruiter" })), ...CANDIDATES.map((c) => ({ ...c, role: "candidate" }))];
  for (const a of all) {
    const { error } = await admin.auth.admin.createUser({
      email: a.email, password: E.password, email_confirm: true, user_metadata: { role: a.role, full_name: a.full_name },
    });
    console.log(error ? `• ${a.email}: ${error.message}` : `✓ account ${a.email} (${a.role})`);
  }
}

async function accounts() {
  const E = env();
  const { createClient } = await import("@supabase/supabase-js");
  await ensureAccounts(E, createClient(E.url, E.secret, { auth: { persistSession: false } }));
}

async function all() {
  const E = env();
  const { createClient } = await import("@supabase/supabase-js");
  const { readFileSync } = await import("node:fs");
  const admin = createClient(E.url, E.secret, { auth: { persistSession: false } });
  await ensureAccounts(E, admin);

  // Sign each user in → a JWT the app routes accept (Authorization: Bearer)
  const sessions = {};
  for (const email of [...RECRUITERS, ...CANDIDATES].map((x) => x.email)) {
    const anon = createClient(E.url, E.anon, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password: E.password });
    if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
    sessions[email] = {
      id: data.user.id, token: data.session.access_token,
      db: createClient(E.url, E.anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } }),
    };
  }
  const api = async (email, path, body, method = "POST") => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(E.base + path, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessions[email].token}` }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) return json;
      if (attempt === 2 || res.status < 500) throw new Error(`${path} ${res.status}: ${json.error ?? "failed"}`);
      console.log(`  … ${path} ${res.status}, retrying`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  };

  // Jobs (validated + embedded by /api/jobs)
  const jobIds = {};
  for (const { owner, ...job } of JOBS) {
    const { db, id } = sessions[owner];
    const { data: existing } = await db.from("jobs").select("id").eq("recruiter_id", id).eq("title", job.title).limit(1).maybeSingle();
    jobIds[job.title] = existing?.id ?? (await api(owner, "/api/jobs", job)).id;
    console.log(`${existing ? "•" : "✓"} job ${job.title}`);
  }

  // Resumes: upload → row → real AI parse
  for (const c of CANDIDATES) {
    const { db, id } = sessions[c.email];
    const { data: done } = await db.from("resumes").select("id").eq("candidate_id", id).eq("parse_status", "success").limit(1).maybeSingle();
    if (done) { console.log(`• resume ${c.email} already parsed`); continue; }
    const path = `${id}/seed-${c.pdf}`;
    const bytes = readFileSync(new URL(`../public/demo/${c.pdf}`, import.meta.url));
    const up = await db.storage.from("resumes").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Error(`Upload failed for ${c.email}: ${up.error.message}`);
    const { data: row, error } = await db.from("resumes").insert({ candidate_id: id, file_path: path, file_name: c.pdf }).select("id").single();
    if (error) throw new Error(`Resume row failed for ${c.email}: ${error.message}`);
    const r = await api(c.email, "/api/resume/parse", { resumeId: row.id });
    console.log(`✓ resume ${c.email}: ${r.parse_status}, ${r.parsed?.skills?.length ?? 0} skills`);
  }

  // Applications → real AI match
  const appIds = {};
  for (const [email, title] of APPLICATIONS) {
    const { db, id } = sessions[email];
    const jobId = jobIds[title];
    let { data: app } = await db.from("applications").select("id, ai_score").eq("job_id", jobId).eq("candidate_id", id).maybeSingle();
    if (!app) {
      const { data: resume } = await db.from("resumes").select("id").eq("candidate_id", id).eq("parse_status", "success").order("created_at", { ascending: false }).limit(1).single();
      const ins = await db.from("applications").insert({ job_id: jobId, candidate_id: id, resume_id: resume.id }).select("id, ai_score").single();
      if (ins.error) throw new Error(`Apply failed ${email} → ${title}: ${ins.error.message}`);
      app = ins.data;
    }
    appIds[`${email}|${title}`] = app.id;
    if (app.ai_score == null) {
      const m = await api(email, "/api/match", { applicationId: app.id });
      console.log(`✓ ${email} → ${title}: score ${m.ai_score}`);
    } else console.log(`• ${email} → ${title}: already scored ${app.ai_score}`);
  }

  // Recruiter decisions (manual actions, audited by the DB)
  for (const a of ACTIONS) {
    const owner = JOBS.find((j) => j.title === a.job).owner;
    const { db, id: recruiterId } = sessions[owner];
    const appId = appIds[`${a.candidate}|${a.job}`];
    const { data: cur } = await db.from("applications").select("status").eq("id", appId).single();
    for (const to of a.to) {
      if (cur.status === to || (to === "shortlisted" && ["interview", "selected"].includes(cur.status)) || cur.status === "rejected") continue;
      if (to === "interview" && a.interview) {
        const when = new Date(); when.setDate(when.getDate() + a.interview.inDays); when.setHours(a.interview.hour, 0, 0, 0);
        const iv = await db.from("interviews").insert({
          application_id: appId, scheduled_at: when.toISOString(), duration_min: 60,
          interviewer_name: a.interview.interviewer, type: a.interview.type, created_by: recruiterId,
        });
        if (iv.error) throw new Error(`Interview failed: ${iv.error.message}`);
      }
      const { error } = await db.rpc("change_application_status", { p_application_id: appId, p_to_status: to, p_reason: a.reason });
      if (error) throw new Error(`Status ${to} failed for ${a.candidate}: ${error.message}`);
      cur.status = to;
      console.log(`✓ ${a.candidate} (${a.job}) → ${to}`);
    }
  }
  console.log("\nDone. Sign in as recruiter@rc3.demo or talent@rc3.demo (password = DEMO_PASSWORD).");
}

/** Re-upload each demo PDF over the candidate's existing resume file and run the real parser again. */
async function reparse() {
  const E = env();
  const { createClient } = await import("@supabase/supabase-js");
  const { readFileSync } = await import("node:fs");
  for (const c of CANDIDATES) {
    const anon = createClient(E.url, E.anon, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: c.email, password: E.password });
    if (error) { console.log(`• ${c.email}: ${error.message}`); continue; }
    const token = data.session.access_token;
    const db = createClient(E.url, E.anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: r } = await db.from("resumes").select("id, file_path").eq("candidate_id", data.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!r) { console.log(`• ${c.email}: no resume yet (run seed:all)`); continue; }
    const up = await db.storage.from("resumes").upload(r.file_path, readFileSync(new URL(`../public/demo/${c.pdf}`, import.meta.url)), { contentType: "application/pdf", upsert: true });
    if (up.error) { console.log(`• ${c.email}: upload failed ${up.error.message}`); continue; }
    const res = await fetch(E.base + "/api/resume/parse", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ resumeId: r.id }) });
    const j = await res.json().catch(() => ({}));
    console.log(res.ok ? `✓ ${c.email}: ${j.parsed?.skills?.length ?? 0} skills, ${j.parsed?.contact?.links?.length ?? 0} links` : `• ${c.email}: ${res.status} ${j.error ?? ""}`);
  }
}

/** Set the same password on every demo account (admin API). Usage: NEW_PASSWORD=... npm run seed:set-password */
async function setPassword() {
  const pw = process.env.NEW_PASSWORD;
  if (!pw || pw.length < 6) throw new Error("Set NEW_PASSWORD (min 6 chars, Supabase minimum)");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const emails = new Set([...RECRUITERS, ...CANDIDATES].map((a) => a.email));
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  for (const u of data.users.filter((u) => emails.has(u.email ?? ""))) {
    const r = await admin.auth.admin.updateUserById(u.id, { password: pw });
    console.log(r.error ? `• ${u.email}: ${r.error.message}` : `✓ ${u.email}`);
  }
}

const cmd = process.argv[2];
if (cmd === "pdfs") {
  for (const [name, lines] of Object.entries(RESUMES)) {
    writeFileSync(join("public/demo", name), makePdf(lines));
    console.log("✓ public/demo/" + name);
  }
} else if (cmd === "accounts") {
  await accounts();
} else if (cmd === "all") {
  await all();
} else if (cmd === "reparse") {
  await reparse();
} else if (cmd === "set-password") {
  await setPassword();
} else {
  console.log("Usage: node scripts/seed-demo.mjs pdfs | accounts | all | reparse | set-password");
}
