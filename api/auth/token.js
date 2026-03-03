import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const clientId = process.env.MI_CLIENT_ID;
    const clientSecret = process.env.MI_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ ok: false, error: "Missing ML env vars" });
    }

    // 1 seller => key fija
    const key = "ml:refresh_token";
    const refreshToken = await redis.get(key);

    if (!refreshToken) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing refresh_token in storage" });
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
      return res.status(response.status).json({
        ok: false,
        error: data?.message || "ML refresh failed",
        status: data?.status || response.status,
        code: data?.error || data?.code || "unknown_error",
      });
    }

    // ML a veces rota refresh_token: si viene uno nuevo, lo guardamos
    if (data.refresh_token && data.refresh_token !== refreshToken) {
      await redis.set(key, data.refresh_token);
    }

    // Importante: NO devolvemos access_token por seguridad
    return res.status(200).json({
      ok: true,
      message: "Access token generated",
      expires_in: data.expires_in,
      scope: data.scope,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
