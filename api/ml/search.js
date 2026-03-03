import { getAccessToken } from "../_ml";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const accessToken = await getAccessToken();

    // 1) seller id (si querés, lo podés fijar en una env SELLER_ID para no llamar /users/me)
    let sellerId = process.env.SELLER_ID;

    if (!sellerId) {
      const meResp = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const me = await meResp.json();

      if (!meResp.ok) {
        return res.status(meResp.status).json({
          ok: false,
          error: me?.message || "Failed to fetch /users/me",
        });
      }

      sellerId = String(me.id);
    }

    // 2) ids de publicaciones del seller
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const searchUrl = `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=${limit}&offset=${offset}`;

    const sResp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const sData = await sResp.json();

    if (!sResp.ok) {
      return res.status(sResp.status).json({
        ok: false,
        error: sData?.message || "Failed to fetch seller items",
      });
    }

    const ids = Array.isArray(sData?.results) ? sData.results : [];

    if (ids.length === 0) {
      return res.status(200).json({
        ok: true,
        seller_id: sellerId,
        total: sData?.paging?.total ?? 0,
        results: [],
      });
    }

    // 3) batch de detalles (mucho más rápido que 20 fetchs)
    const detailsUrl = `https://api.mercadolibre.com/items?ids=${ids
      .slice(0, limit)
      .join(",")}`;

    const dResp = await fetch(detailsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const dData = await dResp.json();

    if (!dResp.ok) {
      return res.status(dResp.status).json({
        ok: false,
        error: dData?.message || "Failed to fetch items details",
      });
    }

    // dData viene como [{ code, body }, ...]
    const results = (Array.isArray(dData) ? dData : [])
      .map((row) => row?.body)
      .filter(Boolean)
      .map((it) => ({
        id: it.id,
        title: it.title,
        price: it.price,
        currency_id: it.currency_id,
        thumbnail: it.thumbnail,
        pictures: (it.pictures || [])
          .slice(0, 6)
          .map((p) => p.secure_url || p.url)
          .filter(Boolean),
        permalink: it.permalink,
        status: it.status,
      }));

    return res.status(200).json({
      ok: true,
      seller_id: sellerId,
      total: sData?.paging?.total ?? ids.length,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}
