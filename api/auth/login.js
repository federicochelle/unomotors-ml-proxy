export default function handler(req, res) {
  const clientId = process.env.MI_CLIENT_ID;
  const redirectUri = process.env.MI_REDIRECT_URI;

  const authUrl = `https://auth.mercadolibre.com.uy/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(authUrl);
}
