export default function handler(req, res) {
  const clientId = process.env.MI_CLIENT_ID;
  const redirectUri = process.env.MI_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).send("Missing MI_CLIENT_ID or MI_REDIRECT_URI");
  }

  const authUrl =
    `https://auth.mercadolibre.com/authorization` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return res.redirect(authUrl);
}
