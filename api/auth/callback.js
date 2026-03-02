export default async function handler(req, res) {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ ok: false, error: "Missing code" });
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = await response.json();

    return res.status(response.status).json({
      ok: response.ok,
      data,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
