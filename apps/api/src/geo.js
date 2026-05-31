import geoip from "geoip-lite";

function normalizeIp(ip) {
  if (!ip) return null;
  // Node may present IPv4 as ::ffff:127.0.0.1
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (m) return m[1];
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

export function geoFromHeaders(req) {
  const h = req.headers["cf-ipcountry"] || req.headers["x-country-code"];
  if (typeof h === "string" && /^[A-Z]{2}$/.test(h)) {
    return { countryCode: h, region: null, city: null, source: "header" };
  }
  return null;
}

export function geoFromIp(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized) return null;

  const hit = geoip.lookup(normalized);
  if (!hit) return null;

  return {
    countryCode: hit.country ?? null,
    region: hit.region ?? null,
    city: hit.city ?? null,
    source: "geoip-lite",
  };
}

