import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).send("Method Not Allowed");
    }

    const code = req.query?.code;
    if (!code) {
      return res.status(400).send("Missing code");
    }

    const clientId = process.env.MI_CLIENT_ID;
    const clientSecret = process.env.MI_CLIENT_SECRET;
    const redirectUri = process.env.MI_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).send("Missing OAuth env vars");
    }

    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(500).send("Missing Upstash env vars");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      redirect_uri: redirectUri,
    });

    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await response.json();

    // No logueamos tokens. Solo info útil para debug.
    console.log("ML token exchange:", {
      ok: response.ok,
      status: response.status,
      has_refresh_token: Boolean(data?.refresh_token),
      has_access_token: Boolean(data?.access_token),
      user_id: data?.user_id,
      error: data?.error,
      message: data?.message,
    });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.message || "ML token exchange failed",
        status: data?.status || response.status,
        code: data?.error || data?.code || "unknown_error",
      });
    }

    if (!data?.refresh_token) {
      return res.status(500).json({
        ok: false,
        error: "Missing refresh_token",
        hint: "Mercado Libre no devolvió refresh_token. Revisar redirect_uri (match exacto) y permisos/scopes de la app.",
      });
    }

    // 1 seller: una sola key fija
    await redis.set("ml:refresh_token", data.refresh_token);

    // Respuesta sin tokens
    return res.status(200).json({
      ok: true,
      message: "Authorized. refresh_token stored.",
      user_id: data?.user_id ?? null,
      expires_in: data?.expires_in ?? null,
      scope: data?.scope ?? null,
    });
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).send("Internal error");
  }
}
