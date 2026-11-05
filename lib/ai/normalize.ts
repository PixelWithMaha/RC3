// RES-4: skill normalization (prompt does most of it; this alias map makes it deterministic).

const ALIASES: Record<string, string> = {
  js: "JavaScript", javascript: "JavaScript", ecmascript: "JavaScript", es6: "JavaScript",
  ts: "TypeScript", typescript: "TypeScript",
  react: "React", reactjs: "React", "react.js": "React",
  reactnative: "React Native",
  next: "Next.js", nextjs: "Next.js",
  vue: "Vue.js", vuejs: "Vue.js",
  angular: "Angular", angularjs: "Angular",
  node: "Node.js", nodejs: "Node.js",
  express: "Express", expressjs: "Express",
  py: "Python", python: "Python", python3: "Python",
  django: "Django", djangorestframework: "Django REST Framework", drf: "Django REST Framework",
  flask: "Flask", fastapi: "FastAPI",
  postgres: "PostgreSQL", postgresql: "PostgreSQL", psql: "PostgreSQL", pgsql: "PostgreSQL",
  mysql: "MySQL", sqlite: "SQLite", mssql: "SQL Server", sqlserver: "SQL Server",
  mongo: "MongoDB", mongodb: "MongoDB",
  redis: "Redis",
  docker: "Docker", dockerfile: "Docker",
  k8s: "Kubernetes", kubernetes: "Kubernetes",
  aws: "AWS", amazonwebservices: "AWS",
  gcp: "Google Cloud", googlecloud: "Google Cloud", googlecloudplatform: "Google Cloud",
  azure: "Azure",
  golang: "Go", go: "Go",
  "c#": "C#", csharp: "C#",
  "c++": "C++", cpp: "C++",
  rest: "REST API", restapi: "REST API", restful: "REST API", restfulapi: "REST API", restapis: "REST API",
  graphql: "GraphQL",
  git: "Git", github: "GitHub",
  cicd: "CI/CD", "ci/cd": "CI/CD",
  ml: "Machine Learning", machinelearning: "Machine Learning",
  ai: "Artificial Intelligence",
  html: "HTML", html5: "HTML", css: "CSS", css3: "CSS",
  tailwind: "Tailwind CSS", tailwindcss: "Tailwind CSS",
  sql: "SQL",
  linux: "Linux",
};

/** Lookup key: lowercase, strip spaces, dots (except in "c++"/"c#"), hyphens, underscores. */
export function skillKey(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower === "c++" || lower === "c#" || lower === "ci/cd") return lower;
  return lower.replace(/[\s.\-_]+/g, "");
}

export function normalizeSkill(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const key = skillKey(trimmed);
  return ALIASES[key] ?? ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** Normalize + dedupe, keeping the first (preferring a verified) entry per canonical skill. */
export function normalizeSkillList<T extends { name: string; verified?: boolean }>(skills: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const s of skills) {
    const name = normalizeSkill(s.name);
    if (!name) continue;
    const key = skillKey(name);
    const item = { ...s, name };
    const existing = byKey.get(key);
    if (!existing || (!existing.verified && item.verified)) byKey.set(key, item);
  }
  return [...byKey.values()];
}

export function sameSkill(a: string, b: string): boolean {
  return skillKey(normalizeSkill(a)) === skillKey(normalizeSkill(b));
}
