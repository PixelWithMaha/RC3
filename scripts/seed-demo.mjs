// Demo seed (PRD §12). Usage:
//   node scripts/seed-demo.mjs pdfs                       -> writes public/demo/*.pdf (no network)
//   DEMO_PASSWORD=... node --env-file=.env.local scripts/seed-demo.mjs accounts
//       -> creates confirmed demo accounts (recruiter + 3 candidates) via the Supabase admin API.
// AI parsing/scoring is NOT faked here: upload the PDFs through the app so the real pipeline runs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const RESUMES = {
  "strong-ayesha-khan.pdf": [
    "Ayesha Khan | ayesha.khan@example.com | +92 300 1110001 | Karachi",
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

const ACCOUNTS = [
  { email: "recruiter@rc3.demo", role: "recruiter", full_name: "Demo Recruiter" },
  { email: "ayesha@rc3.demo", role: "candidate", full_name: "Ayesha Khan" },
  { email: "bilal@rc3.demo", role: "candidate", full_name: "Bilal Ahmed" },
  { email: "hina@rc3.demo", role: "candidate", full_name: "Hina Raza" },
];

async function accounts() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set DEMO_PASSWORD (min 8 chars)");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Run with --env-file=.env.local (needs SUPABASE_SECRET_KEY)");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
  for (const a of ACCOUNTS) {
    const { error } = await admin.auth.admin.createUser({
      email: a.email, password, email_confirm: true, user_metadata: { role: a.role, full_name: a.full_name },
    });
    console.log(error ? `• ${a.email}: ${error.message}` : `✓ ${a.email} (${a.role})`);
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
} else {
  console.log("Usage: node scripts/seed-demo.mjs pdfs | accounts");
}
