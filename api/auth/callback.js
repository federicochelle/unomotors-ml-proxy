import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).send("Missing code");
    }

    const clientId = process.env.MI_CLIENT_ID;
    const clientSecret = process.env.MI_CLIENT_SECRET;
    const redirectUri = process.env.MI_REDIRECT_URI;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
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
        error: data?.message || "ML token exchange failed",
        status: data?.status || response.status,
        code: data?.error || data?.code || "unknown_error",
      });
    }

    // Solo validamos refresh_token
    if (!data.refresh_token) {
      return res.status(500).send("Missing refresh_token");
    }

    // Modo 1 seller
    const key = "ml:refresh_token";

    await redis.set(key, data.refresh_token);

    return res.status(200).send("OK autorizado (refresh_token guardado)");
  } catch (err) {
    return res.status(500).send("Internal error");
  }
}
