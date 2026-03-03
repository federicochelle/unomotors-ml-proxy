import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function checkAdmin(req) {
  const key = req.headers["x-admin-key"] || req.query.admin_key;
  return Boolean(key) && key === process.env.ADMIN_KEY;
}

async function getAccessToken() {
  const clientId = process.env.MI_CLIENT_ID;
  const clientSecret = process.env.MI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing MI_CLIENT_ID or MI_CLIENT_SECRET");
  }

  const refreshToken = await redis.get("ml:refresh_token");
  if (!refreshToken) {
    throw new Error("No refresh_token stored");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to refresh token");
  }

  // Si ML rota el refresh_token, guardamos el nuevo
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await redis.set("ml:refresh_token", data.refresh_token);
  }

  if (!data.access_token) {
    throw new Error("No access_token returned by ML");
  }

  return data.access_token;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    if (!process.env.ADMIN_KEY) {
      return res.status(500).json({ ok: false, error: "Missing ADMIN_KEY" });
    }

    if (!checkAdmin(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const accessToken = await getAccessToken();

    const response = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.message || "ML users/me failed",
        status: data?.status || response.status,
      });
    }

    return res.status(200).json({
      ok: true,
      user: {
        id: data.id,
        nickname: data.nickname,
        site_id: data.site_id,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
