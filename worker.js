let dbReady = false;

const CATEGORIES = [
  ["Nasi", "🍚"], ["Mi", "🍜"], ["Burger", "🍔"], ["Snek", "🍟"], ["Minuman", "🥤"]
];

const SAMPLE_ITEMS = [
  ["Nasi Lemak Ayam", "Nasi lemak wangi dengan ayam goreng rangup.", 8.90, "🍗", 1],
  ["Nasi Goreng Kampung", "Nasi goreng kampung bersama ikan bilis dan telur.", 7.50, "🍳", 1],
  ["Nasi Ayam", "Ayam panggang, nasi beraroma dan sos istimewa.", 9.90, "🍗", 1],
  ["Nasi Kari", "Nasi putih dengan kuah kari pekat.", 8.50, "🍛", 1],
  ["Mi Goreng Mamak", "Mi goreng mamak pedas manis.", 7.90, 2],
  ["Bihun Goreng", "Bihun goreng ringan dengan sayur segar.", 6.90, "🍝", 2],
  ["Laksa", "Laksa berkuah pekat dengan herba.", 8.90, "🍜", 2],
  ["Mee Kari", "Mi kuning dalam kuah kari berkrim.", 9.50, "🍜", 2],
  ["Burger Ayam", "Burger ayam rangup dengan salad.", 8.90, "🍔", 3],
  ["Burger Daging", "Daging panggang, keju dan sos rumah.", 10.90, "🍔", 3],
  ["Kentang Goreng", "Kentang goreng panas dan rangup.", 4.50, "🍟", 4],
  ["Roti John", "Roti John klasik dengan inti telur dan daging.", 7.90, "🥖", 4],
  ["Teh Ais", "Teh susu ais yang menyegarkan.", 2.90, "🧋", 5],
  ["Kopi O Ais", "Kopi hitam sejuk dan kaw.", 2.50, "☕", 5],
  ["Jus Oren", "Jus oren segar.", 4.90, "🍊", 5]
];

async function ensureDb(db) {
  if (dbReady) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🍽️',
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', price REAL NOT NULL, emoji TEXT NOT NULL DEFAULT '🍽️',
      image_id INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, queue_number TEXT NOT NULL, order_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'baru', total REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, menu_item_id INTEGER,
      name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )`,
    `CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT, data BLOB NOT NULL, content_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    )`
  ];
  for (const sql of statements) await db.prepare(sql).run();

  const categoryCount = await db.prepare("SELECT COUNT(*) AS count FROM categories").first();
  if (!categoryCount || categoryCount.count === 0) {
    const categoryResults = await db.batch(CATEGORIES.map(([name, emoji]) =>
      db.prepare("INSERT INTO categories (name, emoji, active) VALUES (?, ?, 1)").bind(name, emoji)
    ));
    const categoryIds = categoryResults.map(result => result.meta.last_row_id);
    await db.batch(SAMPLE_ITEMS.map(([name, description, price, emoji, categoryIndex]) => {
      if (typeof categoryIndex !== "number") {
        categoryIndex = emoji;
        emoji = "🍽️";
      }
      return db.prepare(
        "INSERT INTO menu_items (category_id, name, description, price, emoji, active) VALUES (?, ?, ?, ?, ?, 1)"
      ).bind(categoryIds[categoryIndex - 1], name, description, price, emoji);
    }));
  }
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('store_name', 'Laparlahh')"),
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('banner', 'Makan sedap, hati pun lapang.')"),
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('store_open', '1')")
  ]);
  dbReady = true;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function isValidText(value, maxLength = 140) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function adminAuthenticated(request, password) {
  if (!password) return false;
  const token = request.headers.get("cookie")?.split(";").map(part => part.trim())
    .find(part => part.startsWith("laparlahh_admin="))?.slice("laparlahh_admin=".length);
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  return (await sign(expires, password)) === signature;
}

function cookieHeader(value, maxAge) {
  return `laparlahh_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return json({ error: "Kata laluan admin belum ditetapkan." }, 503);
  if (!(await adminAuthenticated(request, env.ADMIN_PASSWORD))) return json({ error: "Sila log masuk semula." }, 401);
  return null;
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : NaN;
}

async function handleApi(request, env, url) {
  const { DB: db } = env;
  await ensureDb(db);
  const method = request.method;
  const path = url.pathname;

  if (path === "/api/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD) return json({ error: "Tetapkan ADMIN_PASSWORD di Cloudflare Workers secrets." }, 503);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.password !== "string" || body.password !== env.ADMIN_PASSWORD) {
      return json({ error: "Kata laluan tidak sah." }, 401);
    }
    const expires = String(Math.floor(Date.now() / 1000) + 60 * 60 * 12);
    const token = `${expires}.${await sign(expires, env.ADMIN_PASSWORD)}`;
    return json({ ok: true }, 200, { "set-cookie": cookieHeader(token, 60 * 60 * 12) });
  }
  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": cookieHeader("", 0) });
  }
  if (path === "/api/images" && method === "POST") {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    const contentType = request.headers.get("content-type") || "";
    if (!/^image\/(jpeg|png|webp)$/.test(contentType)) return json({ error: "Format gambar tidak disokong." }, 415);
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 95 * 1024) return json({ error: "Gambar mesti kurang daripada 95 KB." }, 413);
    const inserted = await db.prepare("INSERT INTO images (data, content_type) VALUES (?, ?)")
      .bind(bytes, contentType).run();
    return json({ id: inserted.meta.last_row_id }, 201);
  }
  const imageMatch = path.match(/^\/api\/images\/(\d+)$/);
  if (imageMatch && method === "GET") {
    const row = await db.prepare("SELECT data, content_type FROM images WHERE id = ?").bind(Number(imageMatch[1])).first();
    if (!row) return json({ error: "Gambar tidak ditemui." }, 404);
    const bytes = Uint8Array.from(row.data || []);
    return new Response(bytes, { headers: { "content-type": row.content_type, "cache-control": "public, max-age=31536000, immutable" } });
  }

  if (path === "/api/menu" && method === "GET") {
    const [categories, items, settings] = await Promise.all([
      db.prepare("SELECT id, name, emoji, active FROM categories ORDER BY id").all(),
      db.prepare(`SELECT id, category_id, name, description, price, emoji, image_id, active
        FROM menu_items ORDER BY id`).all(),
      db.prepare("SELECT key, value FROM settings").all()
    ]);
    return json({ categories: categories.results, items: items.results, settings: Object.fromEntries(settings.results.map(x => [x.key, x.value])) });
  }
  if (path === "/api/orders" && method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50 ||
      !["dine-in", "takeaway"].includes(body.orderType)) {
      return json({ error: "Maklumat pesanan tidak lengkap." }, 400);
    }
    const storeOpen = await db.prepare("SELECT value FROM settings WHERE key = 'store_open'").first();
    if (!storeOpen || storeOpen.value !== "1") return json({ error: "Kedai sedang ditutup." }, 409);

    const quantities = new Map();
    for (const item of body.items) {
      const id = Number(item.id);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return json({ error: "Kuantiti pesanan tidak sah." }, 400);
      }
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(",");
    const result = await db.prepare(
      `SELECT id, name, price FROM menu_items WHERE active = 1 AND id IN (${placeholders})`
    ).bind(...ids).all();
    if (result.results.length !== ids.length) return json({ error: "Item menu tidak tersedia." }, 409);
    const byId = new Map(result.results.map(item => [item.id, item]));
    const orderLines = ids.map(id => ({ ...byId.get(id), quantity: quantities.get(id) }));
    const total = money(orderLines.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const inserted = await db.prepare(
      "INSERT INTO orders (queue_number, order_type, status, total) VALUES ('', ?, 'baru', ?)"
    ).bind(body.orderType, total).run();
    const orderId = inserted.meta.last_row_id;
    const queueNumber = `L${String(orderId).padStart(4, "0")}`;
    const batch = [
      db.prepare("UPDATE orders SET queue_number = ? WHERE id = ?").bind(queueNumber, orderId),
      ...orderLines.map(item => db.prepare(
        "INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)"
      ).bind(orderId, item.id, item.name, item.quantity, item.price))
    ];
    await db.batch(batch);
    return json({ id: orderId, queueNumber, total, status: "baru" }, 201);
  }
  const orderMatch = path.match(/^\/api\/orders\/(\d+)$/);
  if (orderMatch && method === "GET") {
    const row = await db.prepare("SELECT id, queue_number, status, total, order_type, created_at FROM orders WHERE id = ?")
      .bind(Number(orderMatch[1])).first();
    return row ? json(row) : json({ error: "Pesanan tidak ditemui." }, 404);
  }

  if (path.startsWith("/api/admin/")) {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
  }
  if (path === "/api/admin/orders" && method === "GET") {
    const result = await db.prepare(`SELECT o.id, o.queue_number, o.order_type, o.status, o.total, o.created_at,
      GROUP_CONCAT(oi.name || ' × ' || oi.quantity, ' · ') AS items
      FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id ORDER BY o.id DESC LIMIT 100`).all();
    return json(result.results);
  }
  if (orderMatch && path.startsWith("/api/admin/orders/") && method === "PATCH") {
    const body = await request.json().catch(() => null);
    const statuses = ["baru", "disediakan", "siap", "selesai", "dibatalkan"];
    if (!body || !statuses.includes(body.status)) return json({ error: "Status tidak sah." }, 400);
    const result = await db.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(body.status, Number(orderMatch[1])).run();
    return result.meta.changes ? json({ ok: true }) : json({ error: "Pesanan tidak ditemui." }, 404);
  }
  if (path === "/api/admin/menu" && method === "POST") {
    const body = await request.json().catch(() => null);
    const price = money(body?.price);
    if (!body || !isValidText(body.name) || !Number.isInteger(Number(body.category_id)) ||
      !Number.isFinite(price) || price < 0 || price > 99999) return json({ error: "Maklumat menu tidak sah." }, 400);
    const exists = await db.prepare("SELECT id FROM categories WHERE id = ?").bind(Number(body.category_id)).first();
    if (!exists) return json({ error: "Kategori tidak ditemui." }, 404);
    const inserted = await db.prepare(`INSERT INTO menu_items
      (category_id, name, description, price, emoji, image_id, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(Number(body.category_id), body.name.trim(),
      typeof body.description === "string" ? body.description.trim().slice(0, 400) : "",
      price, isValidText(body.emoji, 16) ? body.emoji.trim() : "🍽️",
      Number.isInteger(Number(body.image_id)) && Number(body.image_id) > 0 ? Number(body.image_id) : null,
      body.active === false ? 0 : 1).run();
    return json({ id: inserted.meta.last_row_id }, 201);
  }
  const itemMatch = path.match(/^\/api\/admin\/menu\/(\d+)$/);
  if (itemMatch && method === "PATCH") {
    const id = Number(itemMatch[1]);
    const body = await request.json().catch(() => null);
    const current = await db.prepare("SELECT * FROM menu_items WHERE id = ?").bind(id).first();
    if (!current) return json({ error: "Item tidak ditemui." }, 404);
    const name = body?.name === undefined ? current.name : body.name.trim();
    const description = body?.description === undefined ? current.description : body.description.trim().slice(0, 400);
    const price = body?.price === undefined ? current.price : money(body.price);
    const categoryId = body?.category_id === undefined ? current.category_id : Number(body.category_id);
    const emoji = body?.emoji === undefined ? current.emoji : body.emoji;
    const imageId = body?.image_id === undefined ? current.image_id : (Number(body.image_id) || null);
    const active = body?.active === undefined ? current.active : (body.active ? 1 : 0);
    if (!isValidText(name) || !Number.isFinite(price) || price < 0 || !Number.isInteger(categoryId) ||
      !isValidText(emoji, 16)) return json({ error: "Maklumat menu tidak sah." }, 400);
    await db.prepare(`UPDATE menu_items SET category_id = ?, name = ?, description = ?, price = ?,
      emoji = ?, image_id = ?, active = ? WHERE id = ?`).bind(categoryId, name.trim(), description, price, emoji.trim(), imageId, active, id).run();
    return json({ ok: true });
  }
  if (itemMatch && method === "DELETE") {
    await db.prepare("DELETE FROM menu_items WHERE id = ?").bind(Number(itemMatch[1])).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/categories" && method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !isValidText(body.name, 60)) return json({ error: "Nama kategori tidak sah." }, 400);
    const inserted = await db.prepare("INSERT INTO categories (name, emoji, active) VALUES (?, ?, 1)")
      .bind(body.name.trim(), isValidText(body.emoji, 16) ? body.emoji.trim() : "🍽️").run();
    return json({ id: inserted.meta.last_row_id }, 201);
  }
  const categoryMatch = path.match(/^\/api\/admin\/categories\/(\d+)$/);
  if (categoryMatch && method === "PATCH") {
    const body = await request.json().catch(() => null);
    const current = await db.prepare("SELECT * FROM categories WHERE id = ?").bind(Number(categoryMatch[1])).first();
    if (!current) return json({ error: "Kategori tidak ditemui." }, 404);
    const name = body?.name === undefined ? current.name : body.name.trim();
    const emoji = body?.emoji === undefined ? current.emoji : body.emoji.trim();
    const active = body?.active === undefined ? current.active : (body.active ? 1 : 0);
    if (!isValidText(name, 60) || !isValidText(emoji, 16)) return json({ error: "Kategori tidak sah." }, 400);
    await db.prepare("UPDATE categories SET name = ?, emoji = ?, active = ? WHERE id = ?")
      .bind(name, emoji, active, Number(categoryMatch[1])).run();
    return json({ ok: true });
  }
  if (categoryMatch && method === "DELETE") {
    const count = await db.prepare("SELECT COUNT(*) AS count FROM menu_items WHERE category_id = ?")
      .bind(Number(categoryMatch[1])).first();
    if (count.count > 0) return json({ error: "Kategori masih mempunyai item menu." }, 409);
    await db.prepare("DELETE FROM categories WHERE id = ?").bind(Number(categoryMatch[1])).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/settings" && method === "PATCH") {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "Tetapan tidak sah." }, 400);
    const allowed = ["store_name", "banner", "store_open"];
    const statements = [];
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      const value = key === "store_open" ? (body[key] ? "1" : "0") : String(body[key]).trim();
      const max = key === "store_name" ? 80 : 240;
      if (key !== "store_open" && (!value || value.length > max)) return json({ error: "Tetapan tidak sah." }, 400);
      statements.push(db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value));
    }
    if (statements.length) await db.batch(statements);
    return json({ ok: true });
  }
  if (method === "GET" && !path.startsWith("/api/")) return env.ASSETS.fetch(request);
  return json({ error: "Laluan tidak ditemui." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Laparlahh request failed:", error);
      return json({ error: "Ralat pelayan. Sila cuba lagi." }, 500);
    }
  }
};
