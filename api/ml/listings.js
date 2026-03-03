// api/ml/listings.js
import { getAccessToken } from "../_ml";

export default async function handler(req, res) {
  // Si tu web está en GitHub Pages, podés restringir este Origin después.
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const accessToken = await getAccessToken();

    // 1) Obtener sellerId (cuenta conectada)
    const meResp = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = await meResp.json();

    if (!meResp.ok) {
      return res.status(meResp.status).json({
        ok: false,
        error: me?.message || "Failed to fetch /users/me",
        detail: me,
      });
    }

    const sellerId = me.id;

    // 2) IDs de publicaciones del seller
    const idsResp = await fetch(
      `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const idsData = await idsResp.json();

    if (!idsResp.ok) {
      return res.status(idsResp.status).json({
        ok: false,
        error: idsData?.message || "Failed to fetch seller items ids",
        detail: idsData,
      });
    }

    const ids = Array.isArray(idsData?.results) ? idsData.results : [];
    if (ids.length === 0) {
      return res.status(200).json({
        ok: true,
        seller_id: sellerId,
        total: idsData?.paging?.total ?? 0,
        results: [],
      });
    }

    // 3) Traer detalle en batch (mucho mejor que 20 requests)
    const batchResp = await fetch(
      `https://api.mercadolibre.com/items?ids=${ids.join(",")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const batch = await batchResp.json();

    if (!batchResp.ok) {
      return res.status(batchResp.status).json({
        ok: false,
        error: "Failed to fetch items batch",
        detail: batch,
      });
    }

    // 4) Respuesta "limpia" para tus cards
    // Nota: batch viene como [{code, body}, ...]
    const results = (Array.isArray(batch) ? batch : [])
      .map((row) => row?.body)
      .filter(Boolean)
      .map((it) => ({
        id: it.id,
        title: it.title,
        price: it.price,
        currency_id: it.currency_id,
        thumbnail: it.thumbnail, // para la card
        year:
          it?.attributes?.find((a) => a.id === "VEHICLE_YEAR")?.value_name ||
          null,
        km:
          it?.attributes?.find((a) => a.id === "KILOMETERS")?.value_name ||
          it?.attributes?.find((a) => a.id === "KILOMETER")?.value_name ||
          null,
        permalink: it.permalink,
        status: it.status,
      }));

    // Cache cortito para que no pegue siempre a ML (podés ajustar)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

    return res.status(200).json({
      ok: true,
      seller_id: sellerId,
      total: idsData?.paging?.total ?? results.length,
      results,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: err?.message || String(err) });
  }
}
