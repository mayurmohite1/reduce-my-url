import { jwtVerify, SignJWT } from "jose";
import crypto from "node:crypto";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload) {
  const key = getSecretKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setJti(crypto.randomUUID())
    .sign(key);
}

export async function verifyAccessToken(token) {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  return payload;
}

export function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer (.+)$/.exec(h);
  return m ? m[1] : null;
}

export function requireUser() {
  return async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (!token) return res.status(401).json({ error: "missing_token" });
      const payload = await verifyAccessToken(token);
      if (!payload?.sub) return res.status(401).json({ error: "invalid_token" });
      req.user = { id: payload.sub, email: payload.email };
      next();
    } catch {
      return res.status(401).json({ error: "invalid_token" });
    }
  };
}

