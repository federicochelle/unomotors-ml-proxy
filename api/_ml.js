import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function getAccessToken() {
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

  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await r.json();

  if (!r.ok) {
    const msg = data?.message || "ML refresh failed";
    throw new Error(msg);
  }

  // Si ML rota refresh_token, lo guardamos
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await redis.set("ml:refresh_token", data.refresh_token);
  }

  return data.access_token;
}
