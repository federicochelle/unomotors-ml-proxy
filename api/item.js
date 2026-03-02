export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const id = req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: "Falta ?id=" });

  try {
    const r = await fetch(`https://api.mercadolibre.com/items/${id}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    const data = await r.json();

    return res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      data,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
