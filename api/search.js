export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const q = req.query.q || "auto";

    const r = await fetch(
      `https://api.mercadolibre.com/sites/MLU/search?q=${encodeURIComponent(q)}`,
    );

    const data = await r.json();

    return res.status(200).json({
      ok: true,
      total: data.paging?.total,
      results: data.results?.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        thumbnail: item.thumbnail,
      })),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
