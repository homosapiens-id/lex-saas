import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const lexBase = "https://lex.homosapiens.id";

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

async function proxyJson(res, upstreamPath, body, timeout = 60_000) {
  try {
    const r = await fetch(`${lexBase}${upstreamPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(timeout)
    });
    const text = await r.text();
    return res.status(r.status).type("application/json").send(text);
  } catch (e) {
    return res.status(503).json({
      status: "source_unavailable",
      detail: e.message,
      human_review_required: true,
      no_invention_policy: true
    });
  }
}

app.get("/health", async (_req, res) => {
  try {
    const r = await fetch(`${lexBase}/health`, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    res.status(r.ok ? 200 : 503).json({
      status: r.ok ? "ok" : "degraded",
      service: "homosapiens-legal-saas",
      backend: d.version || null
    });
  } catch {
    res.status(503).json({ status: "degraded", service: "homosapiens-legal-saas" });
  }
});

app.get("/api/ai/readiness", async (_req, res) => {
  try {
    const r = await fetch(`${lexBase}/v1/ai/readiness`, { signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (e) {
    res.status(503).json({ status: "source_unavailable", detail: e.message });
  }
});

app.post("/api/search", (req, res) => proxyJson(res, "/v1/search/global", req.body, 45_000));
app.post("/api/analyze", (req, res) => proxyJson(res, "/v1/ai/analyze", req.body, 75_000));

app.use(express.static(path.join(__dirname, "public"), { etag: true, maxAge: 300000 }));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`HomoSapiens Legal SaaS listening on ${port}`);
});