const state = {
  categories: [],
  items: [],
  settings: { store_name: "Laparlahh", banner: "Makan sedap, hati pun lapang.", store_open: "1" },
  activeCategoryId: "all",
  cart: new Map(), // itemId -> quantity
  orderType: "dine-in",
  activeOrderId: null,
  pollTimer: null
};

const els = {
  storeName: document.getElementById("storeName"),
  storeBanner: document.getElementById("storeBanner"),
  storeStatus: document.getElementById("storeStatus"),
  closedNotice: document.getElementById("closedNotice"),
  categoryBar: document.getElementById("categoryBar"),
  menuGrid: document.getElementById("menuGrid"),
  cartCount: document.getElementById("cartCount"),
  cartItems: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotal"),
  submitOrderBtn: document.getElementById("submitOrderBtn"),
  orderError: document.getElementById("orderError"),
  orderModal: document.getElementById("orderModal"),
  modalQueue: document.getElementById("modalQueue"),
  modalMeta: document.getElementById("modalMeta"),
  statusSteps: document.getElementById("statusSteps"),
  statusText: document.getElementById("statusText"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  newOrderBtn: document.getElementById("newOrderBtn"),
  trackLastBtn: document.getElementById("trackLastBtn")
};

function rm(val) {
  return `RM ${Number(val || 0).toFixed(2)}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isStoreOpen() {
  return state.settings.store_open === "1";
}

function activeCategoryIds() {
  return new Set(state.categories.filter(c => c.active === 1).map(c => c.id));
}

function renderHeader() {
  els.storeName.textContent = state.settings.store_name || "Laparlahh";
  document.title = `${els.storeName.textContent} — Tempahan Layan Diri`;
  els.storeBanner.textContent = state.settings.banner || "";
  const open = isStoreOpen();
  els.storeStatus.textContent = open ? "● Dibuka" : "● Ditutup";
  els.storeStatus.className = `status-pill ${open ? "open" : "closed"}`;
  els.closedNotice.classList.toggle("hidden", open);
}

function renderCategories() {
  const activeCats = state.categories.filter(c => c.active === 1);
  if (state.activeCategoryId !== "all" && !activeCats.some(c => c.id === state.activeCategoryId)) {
    state.activeCategoryId = "all";
  }
  const chips = [
    `<button type="button" class="cat-chip ${state.activeCategoryId === "all" ? "active" : ""}" data-cat="all">🍽️ Semua</button>`,
    ...activeCats.map(c =>
      `<button type="button" class="cat-chip ${state.activeCategoryId === c.id ? "active" : ""}" data-cat="${c.id}">${escapeHtml(c.emoji)} ${escapeHtml(c.name)}</button>`
    )
  ];
  els.categoryBar.innerHTML = chips.join("");
}

function renderMenu() {
  const validCats = activeCategoryIds();
  const visibleItems = state.items.filter(item => {
    if (item.active !== 1 || !validCats.has(item.category_id)) return false;
    return state.activeCategoryId === "all" || item.category_id === state.activeCategoryId;
  });

  if (!visibleItems.length) {
    els.menuGrid.innerHTML = `<div class="cart-empty" style="grid-column: 1 / -1;">Tiada item menu tersedia dalam kategori ini.</div>`;
    return;
  }

  const open = isStoreOpen();
  els.menuGrid.innerHTML = visibleItems.map(item => {
    const qty = state.cart.get(item.id) || 0;
    const mediaHtml = item.image_id
      ? `<img src="/api/images/${item.image_id}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.remove(); this.parentElement.querySelector('.menu-emoji').classList.remove('hidden');" /><span class="menu-emoji hidden">${escapeHtml(item.emoji || "🍽️")}</span>`
      : `<span class="menu-emoji">${escapeHtml(item.emoji || "🍽️")}</span>`;

    const actionHtml = qty > 0
      ? `<div class="qty-control">
          <button type="button" class="qty-btn" data-dec="${item.id}" aria-label="Kurangkan">-</button>
          <span class="qty-val">${qty}</span>
          <button type="button" class="qty-btn" data-inc="${item.id}" ${!open ? "disabled" : ""} aria-label="Tambah">+</button>
        </div>`
      : `<button type="button" class="btn btn-primary btn-sm" data-inc="${item.id}" ${!open ? "disabled" : ""}>+ Tambah</button>`;

    return `
      <article class="menu-card">
        <div class="menu-media">${mediaHtml}</div>
        <div class="menu-body">
          <h3 class="menu-title">${escapeHtml(item.name)}</h3>
          <p class="menu-desc">${escapeHtml(item.description)}</p>
          <div class="menu-footer">
            <span class="price">${rm(item.price)}</span>
            ${actionHtml}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderCart() {
  const itemMap = new Map(state.items.map(i => [i.id, i]));
  let count = 0;
  let total = 0;
  const rows = [];

  for (const [id, qty] of state.cart.entries()) {
    const item = itemMap.get(id);
    if (!item || item.active !== 1) {
      state.cart.delete(id);
      continue;
    }
    count += qty;
    const sub = item.price * qty;
    total += sub;
    rows.push(`
      <div class="cart-row">
        <div class="cart-row-info">
          <div class="cart-row-name">${escapeHtml(item.emoji)} ${escapeHtml(item.name)}</div>
          <div class="cart-row-sub">${rm(item.price)} × ${qty} = <strong>${rm(sub)}</strong></div>
        </div>
        <div class="qty-control">
          <button type="button" class="qty-btn" data-dec="${item.id}">-</button>
          <span class="qty-val">${qty}</span>
          <button type="button" class="qty-btn" data-inc="${item.id}">+</button>
        </div>
      </div>
    `);
  }

  els.cartCount.textContent = `${count} item`;
  els.cartTotal.textContent = rm(total);
  els.cartItems.innerHTML = rows.length
    ? rows.join("")
    : `<div class="cart-empty">Troli masih kosong. Pilih menu kegemaran anda!</div>`;
  els.submitOrderBtn.disabled = count === 0 || !isStoreOpen();
}

function updateQty(id, delta) {
  const next = (state.cart.get(id) || 0) + delta;
  if (next <= 0) state.cart.delete(id);
  else if (next <= 99) state.cart.set(id, next);
  renderMenu();
  renderCart();
}

async function loadMenu() {
  const res = await fetch("/api/menu");
  const data = await res.json();
  state.categories = data.categories || [];
  state.items = data.items || [];
  state.settings = data.settings || state.settings;
  renderHeader();
  renderCategories();
  renderMenu();
  renderCart();
}

function renderOrderStatus(order) {
  els.modalQueue.textContent = order.queue_number || order.queueNumber;
  const typeLabel = order.order_type === "takeaway" ? "🛍️ Bungkus" : "🍽️ Makan Sini";
  els.modalMeta.textContent = `${typeLabel} · Jumlah: ${rm(order.total)}`;

  const steps = [
    { key: "baru", label: "Baru" },
    { key: "disediakan", label: "Disediakan" },
    { key: "siap", label: "Siap" },
    { key: "selesai", label: "Selesai" }
  ];

  const labels = {
    baru: "Pesanan diterima, menunggu dapur...",
    disediakan: "Dapur sedang menyediakan makanan anda.",
    siap: "Pesanan anda sudah SIAP! Sila ambil di kaunter.",
    selesai: "Pesanan selesai. Terima kasih!",
    dibatalkan: "Maaf, pesanan ini telah dibatalkan."
  };

  if (order.status === "dibatalkan") {
    els.statusSteps.innerHTML = `<div class="step-item cancelled" style="grid-column: 1 / -1;">Pesanan Dibatalkan</div>`;
  } else {
    const idx = steps.findIndex(s => s.key === order.status);
    els.statusSteps.innerHTML = steps.map((s, i) => {
      let cls = "step-item";
      if (i < idx) cls += " done";
      else if (i === idx) cls += " active";
      return `<div class="${cls}">${s.label}</div>`;
    }).join("");
  }

  els.statusText.textContent = labels[order.status] || order.status;
}

async function pollOrder(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}`);
    if (!res.ok) return;
    const order = await res.json();
    renderOrderStatus(order);
    if (order.status === "selesai" || order.status === "dibatalkan") {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  } catch {
    // Ignore transient network errors while polling
  }
}

function openOrderTracker(orderId, initialOrder = null) {
  state.activeOrderId = orderId;
  localStorage.setItem("laparlahh_last_order", String(orderId));
  els.trackLastBtn.classList.remove("hidden");
  els.orderModal.classList.remove("hidden");
  if (initialOrder) renderOrderStatus(initialOrder);
  if (state.pollTimer) clearInterval(state.pollTimer);
  pollOrder(orderId);
  state.pollTimer = setInterval(() => pollOrder(orderId), 4000);
}

async function submitOrder() {
  els.orderError.classList.add("hidden");
  els.submitOrderBtn.disabled = true;
  els.submitOrderBtn.textContent = "Menghantar...";

  try {
    const items = [...state.cart.entries()].map(([id, quantity]) => ({ id, quantity }));
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderType: state.orderType, items })
    });
    const data = await res.json();
    if (!res.ok) {
      els.orderError.textContent = data.error || "Gagal menghantar pesanan.";
      els.orderError.classList.remove("hidden");
      await loadMenu();
      return;
    }
    state.cart.clear();
    renderMenu();
    renderCart();
    openOrderTracker(data.id, {
      id: data.id,
      queue_number: data.queueNumber,
      order_type: state.orderType,
      total: data.total,
      status: data.status
    });
  } catch {
    els.orderError.textContent = "Ralat rangkaian. Sila cuba lagi.";
    els.orderError.classList.remove("hidden");
  } finally {
    els.submitOrderBtn.textContent = "Hantar Pesanan";
    renderCart();
  }
}

// Event Listeners
els.categoryBar.addEventListener("click", e => {
  const btn = e.target.closest("[data-cat]");
  if (!btn) return;
  const val = btn.dataset.cat;
  state.activeCategoryId = val === "all" ? "all" : Number(val);
  renderCategories();
  renderMenu();
});

document.addEventListener("click", e => {
  const inc = e.target.closest("[data-inc]");
  if (inc) return updateQty(Number(inc.dataset.inc), 1);
  const dec = e.target.closest("[data-dec]");
  if (dec) return updateQty(Number(dec.dataset.dec), -1);
});

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.orderType = btn.dataset.type;
    document.querySelectorAll(".type-btn").forEach(b => b.classList.toggle("active", b === btn));
  });
});

els.submitOrderBtn.addEventListener("click", submitOrder);

els.closeModalBtn.addEventListener("click", () => {
  els.orderModal.classList.add("hidden");
});

els.newOrderBtn.addEventListener("click", () => {
  els.orderModal.classList.add("hidden");
});

els.trackLastBtn.addEventListener("click", () => {
  const saved = Number(localStorage.getItem("laparlahh_last_order"));
  if (saved) openOrderTracker(saved);
});

// Init
const savedOrderId = Number(localStorage.getItem("laparlahh_last_order"));
if (savedOrderId) els.trackLastBtn.classList.remove("hidden");
loadMenu();
