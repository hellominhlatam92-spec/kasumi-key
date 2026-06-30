const NPOINT_ID = "5d09d5f7bfe2604887875";
const NPOINT_URL = "https://api.npoint.io/" + NPOINT_ID;
const SECRET = "ks9x7mKp2qRw4nL";

async function readData() {
  try { const r = await fetch(NPOINT_URL); return await r.json(); }
  catch (e) { return { ids: [], keys: [] }; }
}

async function writeData(data) {
  await fetch(NPOINT_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H };

  /* ==============================
     GET /api/{api_key}
     Trả hồ sơ ID theo API key
     ============================== */
  if (event.httpMethod === "GET") {
    try {
      const apiKey = (event.queryStringParameters && event.queryStringParameters.api) || "";
      if (!apiKey) return { statusCode: 400, headers: H, body: JSON.stringify({ status: "error", message: "Thieu api key" }) };

      const data = await readData();
      const found = (data.ids || []).find(i => i.api_key === apiKey);

      if (!found) return { statusCode: 200, headers: H, body: JSON.stringify({ status: "error", valid: false, message: "API key khong ton tai" }) };

      /* Đếm số key đã tạo bởi ID này */
      const keyCount = (data.keys || []).filter(k => k.uid === found.uid).length;

      return { statusCode: 200, headers: H, body: JSON.stringify({
        status: "success",
        valid: found.status === "active",
        uid: found.uid,
        api_key: found.api_key,
        id_status: found.status,
        created_at: found.created_at,
        total_keys: keyCount
      })};
    } catch (e) { return { statusCode: 500, headers: H, body: JSON.stringify({ status: "error", message: e.message }) }; }
  }

  /* ==============================
     POST: Xử lý các action
     ============================== */
  if (event.httpMethod === "POST") {
    try {
      const b = JSON.parse(event.body || "{}");
      if (b.secret !== SECRET) return { statusCode: 401, headers: H, body: JSON.stringify({ status: "error", message: "Unauthorized" }) };

      const data = await readData();
      if (!data.ids) data.ids = [];
      if (!data.keys) data.keys = [];

      /* --- Đăng ký ID mới --- */
      if (b.action === "register_id") {
        if (!b.uid || !b.api_key) return { statusCode: 400, headers: H, body: JSON.stringify({ status: "error", message: "Thieu du lieu" }) };

        const exists = data.ids.find(i => i.uid === b.uid);
        if (!exists) {
          data.ids.push({ uid: b.uid, api_key: b.api_key, created_at: new Date().toISOString(), status: "active" });
          await writeData(data);
        }
        return { statusCode: 200, headers: H, body: JSON.stringify({ status: "success" }) };
      }

      /* --- Lưu key getkey --- */
      if (b.action === "save_key") {
        if (!b.key || !b.uid) return { statusCode: 400, headers: H, body: JSON.stringify({ status: "error", message: "Thieu du lieu" }) };
        if (data.keys.find(k => k.key === b.key)) return { statusCode: 409, headers: H, body: JSON.stringify({ status: "error", message: "Key da ton tai" }) };
        data.keys.push({ key: b.key, uid: b.uid, created_at: new Date().toISOString(), status: "active" });
        await writeData(data);
        return { statusCode: 200, headers: H, body: JSON.stringify({ status: "success" }) };
      }

      /* --- Revoke key getkey --- */
      if (b.action === "revoke") {
        if (!b.key) return { statusCode: 400, headers: H, body: JSON.stringify({ status: "error", message: "Thieu key" }) };
        const f = data.keys.find(k => k.key === b.key);
        if (f) {
          f.status = "revoked";
          f.revoked_at = new Date().toISOString();
          await writeData(data);
          return { statusCode: 200, headers: H, body: JSON.stringify({ status: "success" }) };
        }
        return { statusCode: 404, headers: H, body: JSON.stringify({ status: "error", message: "Not found" }) };
      }

      return { statusCode: 400, headers: H, body: JSON.stringify({ status: "error", message: "Action khong hop le" }) };
    } catch (e) { return { statusCode: 500, headers: H, body: JSON.stringify({ status: "error", message: e.message }) }; }
  }

  return { statusCode: 405, headers: H, body: JSON.stringify({ status: "error", message: "Method not allowed" }) };
};
