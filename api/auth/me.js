import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function checkAdmin(req) {
  const key = req.headers["x-admin-key"] || req.query.admin_key;
  return key && key === process.env.ADMIN_KEY;
}

async function getAccessToken() {
  const clientId = process.env.MI_CLIENT_ID;
  const clientSecret = process.env.MI_CLIENT_SECRET;

  const refreshToken = await redis.get("ml:refresh_token");
  if (!refreshToken) throw new Error("No refresh_token stored");

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
  if (!response.ok) throw new Error("Failed to refresh token");

  return data.access_token;
}

export default async function handler(req, res) {
  try {
    if (!checkAdmin(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const accessToken = await getAccessToken();

    const response = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

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
