import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

function loadToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

function saveToken(token) {
  try {
    if (!token) localStorage.removeItem("token");
    else localStorage.setItem("token", token);
  } catch {
    // ignore
  }
}

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error ? String(data.error) : `http_${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function App() {
  const [token, setToken] = useState(() => loadToken());
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const [links, setLinks] = useState([]);
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedCode, setSelectedCode] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!token) return;
    api("/api/links", { token })
      .then((d) => setLinks(d.links ?? []))
      .catch((e) => setStatus(e.message));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedCode) return;
    api(`/api/analytics/${selectedCode}/summary`, { token })
      .then((d) => setAnalytics(d))
      .catch((e) => setStatus(e.message));
  }, [token, selectedCode]);

  const series = useMemo(() => {
    if (!analytics?.series) return [];
    return analytics.series.map((p) => ({
      day: new Date(p.day).toISOString().slice(5, 10),
      clicks: p.clicks,
    }));
  }, [analytics]);

  async function onAuthSubmit(e) {
    e.preventDefault();
    setStatus("");
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const d = await api(path, { method: "POST", body: { email, password } });
      saveToken(d.token);
      setToken(d.token);
      setPassword("");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function onCreateLink(e) {
    e.preventDefault();
    setStatus("");
    try {
      const d = await api("/api/links", {
        token,
        method: "POST",
        body: { targetUrl },
      });
      setLinks((prev) => [d.link, ...prev]);
      setTargetUrl("");
    } catch (err) {
      setStatus(err.message);
    }
  }

  function logout() {
    saveToken("");
    setToken(null);
    setLinks([]);
    setSelectedCode(null);
    setAnalytics(null);
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto", textAlign: "left" }}>
        <h2>Reduce My URL</h2>
        <p style={{ opacity: 0.8 }}>
          Login/register to create short links and view analytics.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode("login")}
            style={{ opacity: mode === "login" ? 1 : 0.6 }}
          >
            Login
          </button>
          <button
            onClick={() => setMode("register")}
            style={{ opacity: mode === "register" ? 1 : 0.6 }}
          >
            Register
          </button>
        </div>

        <form onSubmit={onAuthSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 8 chars"
            />
          </label>
          <button type="submit">
            {mode === "register" ? "Create account" : "Login"}
          </button>
          {status ? <div style={{ color: "#ff7b7b" }}>{status}</div> : null}
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "32px auto", textAlign: "left" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Reduce My URL</h2>
          <div style={{ opacity: 0.7, fontSize: 14 }}>API: {API_BASE}</div>
        </div>
        <button onClick={logout}>Logout</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginTop: 24,
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            padding: 16,
            borderRadius: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Create short link</h3>
          <form onSubmit={onCreateLink} style={{ display: "grid", gap: 10 }}>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/very/long/url"
            />
            <button type="submit">Shorten</button>
          </form>
          {status ? (
            <div style={{ color: "#ff7b7b", marginTop: 12 }}>{status}</div>
          ) : null}
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            padding: 16,
            borderRadius: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Your links</h3>
          <div style={{ display: "grid", gap: 10, maxHeight: 260, overflow: "auto" }}>
            {links.map((l) => (
              <div
                key={l.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  padding: 10,
                  borderRadius: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <a href={l.shortUrl} target="_blank" rel="noreferrer">
                    {l.shortUrl}
                  </a>
                  <button onClick={() => setSelectedCode(l.code)}>Analytics</button>
                </div>
                <div style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>
                  {l.target_url ?? l.targetUrl}
                </div>
              </div>
            ))}
            {!links.length ? <div style={{ opacity: 0.7 }}>No links yet.</div> : null}
          </div>
        </div>
      </div>

      {analytics ? (
        <div
          style={{
            marginTop: 24,
            border: "1px solid rgba(255,255,255,0.12)",
            padding: 16,
            borderRadius: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Analytics: /{analytics.link.code}</h3>
          <div style={{ opacity: 0.75, marginBottom: 12 }}>
            {analytics.link.target_url}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Total clicks</div>
              <div style={{ fontSize: 28 }}>{analytics.clicks}</div>
            </div>
          </div>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="clicks" fill="#7c5cff" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
            <div>
              <h4 style={{ margin: "0 0 10px 0" }}>Top referrers</h4>
              <div style={{ display: "grid", gap: 6 }}>
                {(analytics.topReferrers ?? []).map((r) => (
                  <div key={r.referrer} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.referrer}
                    </div>
                    <div style={{ opacity: 0.85 }}>{r.clicks}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ margin: "0 0 10px 0" }}>Geo</h4>
              <div style={{ display: "grid", gap: 6 }}>
                {(analytics.geo ?? []).map((g) => (
                  <div key={g.country_code} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>{g.country_code}</div>
                    <div style={{ opacity: 0.85 }}>{g.clicks}</div>
                  </div>
                ))}
              </div>
              <div style={{ opacity: 0.6, fontSize: 12, marginTop: 10 }}>
                Geo uses `cf-ipcountry`/`x-country-code` header when available; otherwise `UN`.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
