import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

import { migrate } from "./migrate.js";
import { query } from "./db.js";
import { redis, redirectCacheKey } from "./redis.js";
import { requireUser, signAccessToken } from "./auth.js";
import { registerSchema, loginSchema, createLinkSchema } from "./validators.js";
import { geoFromHeaders, geoFromIp } from "./geo.js";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await query(
      "insert into users(email, password_hash) values ($1, $2) returning id, email, created_at",
      [email, passwordHash],
    );
    const user = rows[0];
    const token = await signAccessToken({ sub: user.id, email: user.email });
    return res.status(201).json({ user, token });
  } catch (e) {
    // unique violation
    return res.status(409).json({ error: "email_taken" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const { rows } = await query("select id, email, password_hash, created_at from users where email = $1", [email]);
  if (!rows.length) return res.status(401).json({ error: "invalid_credentials" });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = await signAccessToken({ sub: user.id, email: user.email });
  return res.json({ user: { id: user.id, email: user.email, created_at: user.created_at }, token });
});

app.get("/api/me", requireUser(), async (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/links", requireUser(), async (req, res) => {
  const parsed = createLinkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const { targetUrl, title } = parsed.data;
  const code = parsed.data.code ?? nanoid(7);

  try {
    const { rows } = await query(
      "insert into links(user_id, code, target_url, title) values ($1, $2, $3, $4) returning id, code, target_url, title, created_at",
      [req.user.id, code, targetUrl, title ?? null],
    );
    const link = rows[0];
    const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    return res
      .status(201)
      .json({ link: { ...link, shortUrl: `${base.replace(/\/$/, "")}/r/${link.code}` } });
  } catch {
    return res.status(409).json({ error: "code_taken" });
  }
});

app.get("/api/links", requireUser(), async (req, res) => {
  const { rows } = await query(
    "select id, code, target_url, title, created_at from links where user_id = $1 order by created_at desc limit 200",
    [req.user.id],
  );
  const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  const links = rows.map((r) => ({ ...r, shortUrl: `${base.replace(/\/$/, "")}/r/${r.code}` }));
  res.json({ links });
});

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket.remoteAddress ?? null;
}

function resolveGeo(req, ip) {
  const mode = (process.env.GEO_MODE ?? "geoip-lite").toLowerCase();
  if (mode === "off") return { countryCode: "UN", region: null, city: null, source: "off" };

  // prefer headers if present (CDN/proxy), regardless of mode
  const headerGeo = geoFromHeaders(req);
  if (headerGeo) return headerGeo;

  if (mode === "naive") return { countryCode: "UN", region: null, city: null, source: "naive" };

  const ipGeo = geoFromIp(ip);
  if (ipGeo?.countryCode) return ipGeo;

  return { countryCode: "UN", region: null, city: null, source: "fallback" };
}

async function cacheRedirect(code, payload) {
  // keep cache warm but not forever (links can be disabled/changed)
  await redis.set(redirectCacheKey(code), JSON.stringify(payload), "EX", 60 * 30);
}

async function loadRedirectFromDb(code) {
  const { rows } = await query(
    "select id, code, target_url, is_active from links where code = $1",
    [code],
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (!r.is_active) return { inactive: true };
  return { linkId: r.id, targetUrl: r.target_url };
}

app.get("/r/:code", async (req, res) => {
  const code = req.params.code;
  if (!/^[a-zA-Z0-9_-]{4,32}$/.test(code)) return res.status(404).send("Not found");

  let cached = null;
  try {
    const v = await redis.get(redirectCacheKey(code));
    cached = v ? JSON.parse(v) : null;
  } catch {
    cached = null;
  }

  const redirect = cached ?? (await loadRedirectFromDb(code));
  if (!redirect) return res.status(404).send("Not found");
  if (redirect.inactive) return res.status(410).send("Link disabled");

  if (!cached) {
    // async warm
    cacheRedirect(code, redirect).catch(() => { });
  }

  // fire-and-forget analytics insert (best-effort)
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] ?? null;
  const referrer = req.headers.referer ?? null;
  const geo = resolveGeo(req, ip);
  query(
    "insert into click_events(link_id, ip, user_agent, referrer, country_code, region, city) values ($1, $2, $3, $4, $5, $6, $7)",
    [redirect.linkId, ip, userAgent, referrer, geo.countryCode, geo.region, geo.city],
  ).catch(() => { });

  res.redirect(302, redirect.targetUrl);
});

app.get("/api/analytics/:code/summary", requireUser(), async (req, res) => {
  const code = req.params.code;
  const { rows: linkRows } = await query(
    "select id, code, target_url, title, created_at from links where user_id = $1 and code = $2",
    [req.user.id, code],
  );
  if (!linkRows.length) return res.status(404).json({ error: "not_found" });
  const link = linkRows[0];

  const { rows: countRows } = await query("select count(*)::int as clicks from click_events where link_id = $1", [
    link.id,
  ]);
  const clicks = countRows[0]?.clicks ?? 0;

  // last 14 days time series
  const { rows: seriesRows } = await query(
    `
      select date_trunc('day', clicked_at) as day, count(*)::int as clicks
      from click_events
      where link_id = $1 and clicked_at >= now() - interval '14 days'
      group by 1
      order by 1 asc
    `,
    [link.id],
  );

  const { rows: refRows } = await query(
    `
      select coalesce(nullif(referrer, ''), 'direct') as referrer, count(*)::int as clicks
      from click_events
      where link_id = $1
      group by 1
      order by 2 desc
      limit 10
    `,
    [link.id],
  );

  const { rows: geoRows } = await query(
    `
      select coalesce(nullif(country_code, ''), 'UN') as country_code, count(*)::int as clicks
      from click_events
      where link_id = $1
      group by 1
      order by 2 desc
      limit 20
    `,
    [link.id],
  );

  res.json({
    link,
    clicks,
    series: seriesRows.map((r) => ({ day: r.day, clicks: r.clicks })),
    topReferrers: refRows,
    geo: geoRows,
  });
});

async function main() {
  await migrate();

  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`api listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

