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

  const id = String(req.query.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "Missing ?id=" });

  try {
    const accessToken = await getAccessToken();

    // 1) Item base
    const itemResp = await fetch(`https://api.mercadolibre.com/items/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const item = await itemResp.json();

    if (!itemResp.ok) {
      return res.status(itemResp.status).json({
        ok: false,
        error: item?.message || "Failed to fetch item",
        status: itemResp.status,
      });
    }

    // 2) Descripción (opcional, pero suele estar bueno)
    let description = "";
    try {
      const dResp = await fetch(
        `https://api.mercadolibre.com/items/${id}/description`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const d = await dResp.json();
      if (dResp.ok && d?.plain_text) description = d.plain_text;
    } catch {
      // si falla, no cortamos la request
    }

    // 3) Armamos un payload “detalle” limpio
    const pictures = (item.pictures || [])
      .map((p) => p.secure_url || p.url)
      .filter(Boolean);

    const result = {
      id: item.id,
      title: item.title,
      price: item.price,
      currency_id: item.currency_id,
      permalink: item.permalink,
      status: item.status,
      condition: item.condition,
      available_quantity: item.available_quantity,
      sold_quantity: item.sold_quantity,

      // fotos
      pictures,

      // lo que suele servir para specs
      attributes: (item.attributes || []).map((a) => ({
        id: a.id,
        name: a.name,
        value_name: a.value_name,
      })),

      // texto libre
      description,
    };

    return res.status(200).json({ ok: true, item: result });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}
