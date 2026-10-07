/* ============================================================
   PORTFOLIO API  (Netlify Function v2 + Netlify Blobs)
   Routes, all under /api:
     GET  /api/health              -> { ok: true }
     GET  /api/content             -> { content, updatedAt }   (public)
     PUT  /api/content             -> save site content         (admin)
     POST /api/login               -> { token }
     PUT  /api/credentials         -> change admin login        (admin)
     POST /api/media               -> upload image / PDF        (admin)
     GET  /api/media/:id           -> serve an uploaded file    (public)
   ============================================================ */
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const DEFAULT_USER = "BIM Engineer";
const DEFAULT_PASS = "TUM@123";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const MAX_CONTENT_BYTES = 8 * 1024 * 1024;   // text + URLs only (images are separate files) - hundreds of projects fit easily
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;      // per uploaded file
const ALLOWED_MEDIA = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "image/svg+xml": "svg", "application/pdf": "pdf"
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });

const sha = (s) => crypto.createHash("sha256").update(s).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(String(a)), sha(String(b)));

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

export function createHandler(openStore) {
  const store = () => openStore();

  async function getSecret() {
    if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
    const s = store();
    let secret = await s.get("auth-secret");
    if (!secret) {
      secret = crypto.randomBytes(32).toString("hex");
      await s.set("auth-secret", secret);
    }
    return secret;
  }

  async function sign(payload) {
    const secret = await getSecret();
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return body + "." + sig;
  }

  async function verify(token) {
    if (!token || token.indexOf(".") < 0) return false;
    const [body, sig] = token.split(".");
    const secret = await getSecret();
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    if (!safeEqual(sig, expected)) return false;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString());
      return payload.exp > Date.now();
    } catch (e) { return false; }
  }

  async function isAdmin(req) {
    const h = req.headers.get("authorization") || "";
    return verify(h.replace(/^Bearer\s+/i, ""));
  }

  async function checkLogin(username, password) {
    const saved = await store().get("credentials", { type: "json" });
    if (saved) {
      const { hash } = hashPassword(password, saved.salt);
      return safeEqual(username, saved.username) && safeEqual(hash, saved.hash);
    }
    const u = process.env.ADMIN_USER || DEFAULT_USER;
    const p = process.env.ADMIN_PASS || DEFAULT_PASS;
    return safeEqual(username, u) && safeEqual(password, p);
  }

  return async function handler(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
    const method = req.method.toUpperCase();

    try {
      if (path === "health" && method === "GET") return json({ ok: true });

      /* ---------- public content ---------- */
      if (path === "content" && method === "GET") {
        const data = await store().get("content", { type: "json" });
        return json(data || { content: null, updatedAt: null });
      }

      /* ---------- login ---------- */
      if (path === "login" && method === "POST") {
        const body = await req.json().catch(() => ({}));
        const ok = await checkLogin(String(body.username || ""), String(body.password || ""));
        if (!ok) {
          await new Promise((r) => setTimeout(r, 600)); // slow down guessing
          return json({ error: "Incorrect username or password." }, 401);
        }
        const token = await sign({ exp: Date.now() + TOKEN_TTL_MS });
        return json({ token, expiresIn: TOKEN_TTL_MS });
      }

      /* ---------- media: public read ---------- */
      if (path.startsWith("media/") && method === "GET") {
        const id = path.slice(6);
        if (!/^[a-z0-9-]+\.[a-z0-9]+$/i.test(id)) return json({ error: "Bad id" }, 400);
        const item = await store().getWithMetadata("media/" + id, { type: "arrayBuffer" });
        if (!item) return json({ error: "Not found" }, 404);
        return new Response(item.data, {
          headers: {
            "content-type": (item.metadata && item.metadata.type) || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
            "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox"
          }
        });
      }

      /* ---------- everything below needs the admin token ---------- */
      if (!(await isAdmin(req))) return json({ error: "Not signed in." }, 401);

      if (path === "content" && method === "PUT") {
        const text = await req.text();
        if (text.length > MAX_CONTENT_BYTES) return json({ error: "Content is too large to save." }, 413);
        let content;
        try { content = JSON.parse(text); } catch (e) { return json({ error: "Invalid JSON." }, 400); }
        if (!content || typeof content !== "object" || Array.isArray(content)) return json({ error: "Invalid content." }, 400);
        const record = { content, updatedAt: new Date().toISOString() };
        await store().setJSON("content", record);
        return json({ ok: true, updatedAt: record.updatedAt });
      }

      if (path === "credentials" && method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const u = String(body.username || "").trim();
        const p = String(body.password || "");
        if (!u || p.length < 6) return json({ error: "Username is required and the password needs at least 6 characters." }, 400);
        const { salt, hash } = hashPassword(p);
        await store().setJSON("credentials", { username: u, salt, hash });
        return json({ ok: true });
      }

      if (path === "media" && method === "POST") {
        const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const ext = ALLOWED_MEDIA[type];
        if (!ext) return json({ error: "Only JPG, PNG, WebP, GIF, SVG and PDF files can be uploaded." }, 415);
        const buf = await req.arrayBuffer();
        if (buf.byteLength > MAX_MEDIA_BYTES) return json({ error: "File is too large (limit is about 8 MB)." }, 413);
        if (!buf.byteLength) return json({ error: "Empty file." }, 400);
        const id = crypto.randomUUID() + "." + ext;
        await store().set("media/" + id, buf, { metadata: { type } });
        return json({ ok: true, url: "/api/media/" + id });
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error("API error:", err);
      return json({ error: "Server error. Please try again." }, 500);
    }
  };
}

const handler = createHandler(() => getStore({ name: "portfolio-site", consistency: "strong" }));
export default (req) => handler(req);
export const config = { path: "/api/*" };
