const state = {
  orders: [],
  categories: [],
  items: [],
  settings: {},
  activeTab: "orders"
};

const els = {
  loginView: document.getElementById("loginView"),
  dashboardView: document.getElementById("dashboardView"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginForm: document.getElementById("loginForm"),
  passwordInput: document.getElementById("passwordInput"),
  loginAlert: document.getElementById("loginAlert"),
  globalAlert: document.getElementById("globalAlert"),
  ordersBody: document.getElementById("ordersBody"),
  menuBody: document.getElementById("menuBody"),
  categoriesBody: document.getElementById("categoriesBody"),
  refreshOrdersBtn: document.getElementById("refreshOrdersBtn"),
  addItemBtn: document.getElementById("addItemBtn"),
  addCategoryForm: document.getElementById("addCategoryForm"),
  newCatName: document.getElementById("newCatName"),
  newCatEmoji: document.getElementById("newCatEmoji"),
  settingsForm: document.getElementById("settingsForm"),
  settingStoreName: document.getElementById("settingStoreName"),
  settingBanner: document.getElementById("settingBanner"),
  settingStoreOpen: document.getElementById("settingStoreOpen"),
  itemModal: document.getElementById("itemModal"),
  itemModalTitle: document.getElementById("itemModalTitle"),
  closeItemModalBtn: document.getElementById("closeItemModalBtn"),
  itemForm: document.getElementById("itemForm"),
  itemId: document.getElementById("itemId"),
  itemImageId: document.getElementById("itemImageId"),
  itemName: document.getElementById("itemName"),
  itemCategory: document.getElementById("itemCategory"),
  itemPrice: document.getElementById("itemPrice"),
  itemEmoji: document.getElementById("itemEmoji"),
  itemDesc: document.getElementById("itemDesc"),
  itemActive: document.getElementById("itemActive"),
  itemImageFile: document.getElementById("itemImageFile"),
  imagePreviewWrap: document.getElementById("imagePreviewWrap"),
  imagePreview: document.getElementById("imagePreview"),
  imageInfo: document.getElementById("imageInfo"),
  clearImageBtn: document.getElementById("clearImageBtn"),
  saveItemBtn: document.getElementById("saveItemBtn")
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rm(val) {
  return `RM ${Number(val || 0).toFixed(2)}`;
}

function showAlert(msg, type = "success") {
  els.globalAlert.textContent = msg;
  els.globalAlert.className = `alert ${type === "error" ? "alert-error" : "alert-success"}`;
  els.globalAlert.classList.remove("hidden");
  clearTimeout(showAlert._timer);
  showAlert._timer = setTimeout(() => els.globalAlert.classList.add("hidden"), 4500);
}

function showLogin(errorMsg = "") {
  els.dashboardView.classList.add("hidden");
  els.logoutBtn.classList.add("hidden");
  els.loginView.classList.remove("hidden");
  if (errorMsg) {
    els.loginAlert.textContent = errorMsg;
    els.loginAlert.classList.remove("hidden");
  } else {
    els.loginAlert.classList.add("hidden");
  }
}

function showDashboard() {
  els.loginView.classList.add("hidden");
  els.dashboardView.classList.remove("hidden");
  els.logoutBtn.classList.remove("hidden");
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 503) {
    showLogin(data.error || "Sila log masuk.");
    throw new Error(data.error || "Unauthorized");
  }
  if (!res.ok) {
    throw new Error(data.error || `Ralat (${res.status})`);
  }
  return data;
}

async function loadAll() {
  const [orders, menu] = await Promise.all([
    api("/api/admin/orders"),
    api("/api/menu")
  ]);
  state.orders = orders;
  state.categories = menu.categories || [];
  state.items = menu.items || [];
  state.settings = menu.settings || {};
  renderOrders();
  renderMenu();
  renderCategories();
  renderSettings();
}

function renderOrders() {
  if (!state.orders.length) {
    els.ordersBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted);">Belum ada pesanan.</td></tr>`;
    return;
  }
  const statuses = ["baru", "disediakan", "siap", "selesai", "dibatalkan"];
  els.ordersBody.innerHTML = state.orders.map(o => `
    <tr>
      <td><strong>${escapeHtml(o.queue_number)}</strong></td>
      <td>${o.order_type === "takeaway" ? "🛍️ Bungkus" : "🍽️ Makan Sini"}</td>
      <td>${escapeHtml(o.items || "-")}</td>
      <td><strong>${rm(o.total)}</strong></td>
      <td><span class="badge badge-${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td>
      <td>
        <select data-order-status="${o.id}" style="padding:5px 8px; border-radius:8px; border:1px solid var(--border);">
          ${statuses.map(s => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>
  `).join("");
}

function renderMenu() {
  const catMap = new Map(state.categories.map(c => [c.id, c]));
  els.menuBody.innerHTML = state.items.map(item => {
    const cat = catMap.get(item.category_id);
    const thumb = item.image_id
      ? `<img src="/api/images/${item.image_id}" class="thumb" alt="" onerror="this.outerHTML='<div class=thumb>${escapeHtml(item.emoji)}</div>'" />`
      : `<div class="thumb">${escapeHtml(item.emoji || "🍽️")}</div>`;
    return `
      <tr>
        <td>${thumb}</td>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          <div style="font-size:0.82rem; color:var(--muted);">${cat ? `${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}` : "-"}</div>
        </td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" step="0.01" min="0" class="inline-price" value="${Number(item.price).toFixed(2)}" data-price-input="${item.id}" />
            <button type="button" class="btn btn-sm" data-save-price="${item.id}">Simpan</button>
          </div>
        </td>
        <td>
          <button type="button" class="btn btn-sm" data-toggle-item="${item.id}" data-active="${item.active ? 1 : 0}">
            ${item.active ? "✅ Aktif" : "⛔ Nyahaktif"}
          </button>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn-sm" data-edit-item="${item.id}">Edit</button>
            <button type="button" class="btn btn-sm" data-copy-item="${item.id}">Salin</button>
            <button type="button" class="btn btn-sm btn-danger" data-del-item="${item.id}">Padam</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderCategories() {
  els.categoriesBody.innerHTML = state.categories.map(c => `
    <tr>
      <td style="font-size:1.3rem;">${escapeHtml(c.emoji)}</td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>
        <button type="button" class="btn btn-sm" data-toggle-cat="${c.id}" data-active="${c.active ? 1 : 0}">
          ${c.active ? "✅ Aktif" : "⛔ Nyahaktif"}
        </button>
      </td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-sm" data-edit-cat="${c.id}">Edit</button>
          <button type="button" class="btn btn-sm btn-danger" data-del-cat="${c.id}">Padam</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderSettings() {
  els.settingStoreName.value = state.settings.store_name || "Laparlahh";
  els.settingBanner.value = state.settings.banner || "";
  els.settingStoreOpen.checked = state.settings.store_open === "1";
}

function populateCategorySelect(selectedId = null) {
  els.itemCategory.innerHTML = state.categories.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.emoji)} ${escapeHtml(c.name)}</option>`
  ).join("");
}

function setImagePreview(imageId, infoText = "") {
  els.itemImageId.value = imageId || "";
  if (imageId) {
    els.imagePreview.src = `/api/images/${imageId}`;
    els.imageInfo.textContent = infoText || `ID Gambar: ${imageId}`;
    els.imagePreviewWrap.classList.remove("hidden");
  } else {
    els.imagePreview.src = "";
    els.imageInfo.textContent = "";
    els.imagePreviewWrap.classList.add("hidden");
  }
}

function openItemModal(item = null, isCopy = false) {
  els.itemImageFile.value = "";
  populateCategorySelect(item?.category_id || state.categories[0]?.id);
  if (item) {
    els.itemModalTitle.textContent = isCopy ? "Salin Item Menu" : "Edit Item Menu";
    els.itemId.value = isCopy ? "" : String(item.id);
    els.itemName.value = isCopy ? `${item.name} (Salinan)` : item.name;
    els.itemPrice.value = Number(item.price).toFixed(2);
    els.itemEmoji.value = item.emoji || "🍽️";
    els.itemDesc.value = item.description || "";
    els.itemActive.checked = item.active === 1;
    setImagePreview(item.image_id);
  } else {
    els.itemModalTitle.textContent = "Tambah Item Menu";
    els.itemId.value = "";
    els.itemName.value = "";
    els.itemPrice.value = "";
    els.itemEmoji.value = "🍽️";
    els.itemDesc.value = "";
    els.itemActive.checked = true;
    setImagePreview(null);
  }
  els.itemModal.classList.remove("hidden");
}

async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

    const maxSide = 480;
    let scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    for (let attempt = 0; attempt < 4; attempt++) {
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      // White background for transparent PNGs
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      for (const quality of [0.85, 0.72, 0.58, 0.45, 0.32]) {
        const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
        if (blob && blob.size < 95 * 1024) {
          return blob;
        }
      }
      scale *= 0.8;
    }
    throw new Error("Gambar terlalu besar walaupun selepas dimampatkan (< 95 KB).");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Event Listeners
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.activeTab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
    ["orders", "menu", "categories", "settings"].forEach(t => {
      document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== state.activeTab);
    });
  });
});

els.loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  els.loginAlert.classList.add("hidden");
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: els.passwordInput.value })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      els.loginAlert.textContent = data.error || "Log masuk gagal.";
      els.loginAlert.classList.remove("hidden");
      return;
    }
    els.passwordInput.value = "";
    showDashboard();
    await loadAll();
  } catch {
    els.loginAlert.textContent = "Ralat rangkaian.";
    els.loginAlert.classList.remove("hidden");
  }
});

els.logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  showLogin();
});

els.refreshOrdersBtn.addEventListener("click", () => loadAll().catch(err => showAlert(err.message, "error")));

els.ordersBody.addEventListener("change", async e => {
  const sel = e.target.closest("[data-order-status]");
  if (!sel) return;
  try {
    await api(`/api/admin/orders/${sel.dataset.orderStatus}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: sel.value })
    });
    showAlert("Status pesanan dikemaskini.");
    await loadAll();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

els.addItemBtn.addEventListener("click", () => openItemModal());
els.closeItemModalBtn.addEventListener("click", () => els.itemModal.classList.add("hidden"));
els.clearImageBtn.addEventListener("click", () => setImagePreview(null));

els.itemImageFile.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  els.saveItemBtn.disabled = true;
  els.imageInfo.textContent = "Memampatkan & memuat naik...";
  els.imagePreviewWrap.classList.remove("hidden");
  try {
    const blob = await compressImage(file);
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "content-type": blob.type },
      body: blob
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 503) {
      els.itemModal.classList.add("hidden");
      showLogin(data.error);
      return;
    }
    if (!res.ok) throw new Error(data.error || "Gagal muat naik gambar.");
    setImagePreview(data.id, `Dimuat naik (${(blob.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    showAlert(err.message, "error");
    setImagePreview(els.itemImageId.value || null);
  } finally {
    els.saveItemBtn.disabled = false;
  }
});

els.itemForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id = els.itemId.value;
  const payload = {
    name: els.itemName.value.trim(),
    category_id: Number(els.itemCategory.value),
    price: Number(els.itemPrice.value),
    emoji: els.itemEmoji.value.trim() || "🍽️",
    description: els.itemDesc.value.trim(),
    image_id: els.itemImageId.value ? Number(els.itemImageId.value) : null,
    active: els.itemActive.checked
  };
  try {
    await api(id ? `/api/admin/menu/${id}` : "/api/admin/menu", {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    els.itemModal.classList.add("hidden");
    showAlert(id ? "Item berjaya dikemaskini." : "Item berjaya ditambah.");
    await loadAll();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

els.menuBody.addEventListener("click", async e => {
  const savePrice = e.target.closest("[data-save-price]");
  if (savePrice) {
    const id = Number(savePrice.dataset.savePrice);
    const input = els.menuBody.querySelector(`[data-price-input="${id}"]`);
    try {
      await api(`/api/admin/menu/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ price: Number(input.value) })
      });
      showAlert("Harga dikemaskini.");
      await loadAll();
    } catch (err) {
      showAlert(err.message, "error");
    }
    return;
  }

  const toggleItem = e.target.closest("[data-toggle-item]");
  if (toggleItem) {
    const id = Number(toggleItem.dataset.toggleItem);
    const nextActive = toggleItem.dataset.active !== "1";
    try {
      await api(`/api/admin/menu/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: nextActive })
      });
      await loadAll();
    } catch (err) {
      showAlert(err.message, "error");
    }
    return;
  }

  const editItem = e.target.closest("[data-edit-item]");
  if (editItem) {
    const item = state.items.find(i => i.id === Number(editItem.dataset.editItem));
    if (item) openItemModal(item, false);
    return;
  }

  const copyItem = e.target.closest("[data-copy-item]");
  if (copyItem) {
    const item = state.items.find(i => i.id === Number(copyItem.dataset.copyItem));
    if (item) openItemModal(item, true);
    return;
  }

  const delItem = e.target.closest("[data-del-item]");
  if (delItem) {
    if (!confirm("Padam item menu ini?")) return;
    try {
      await api(`/api/admin/menu/${delItem.dataset.delItem}`, { method: "DELETE" });
      showAlert("Item dipadam.");
      await loadAll();
    } catch (err) {
      showAlert(err.message, "error");
    }
  }
});

els.addCategoryForm.addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/admin/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: els.newCatName.value.trim(), emoji: els.newCatEmoji.value.trim() || "🍽️" })
    });
    els.newCatName.value = "";
    showAlert("Kategori ditambah.");
    await loadAll();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

els.categoriesBody.addEventListener("click", async e => {
  const toggleCat = e.target.closest("[data-toggle-cat]");
  if (toggleCat) {
    const id = Number(toggleCat.dataset.toggleCat);
    const nextActive = toggleCat.dataset.active !== "1";
    try {
      await api(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: nextActive })
      });
      await loadAll();
    } catch (err) {
      showAlert(err.message, "error");
    }
    return;
  }

  const editCat = e.target.closest("[data-edit-cat]");
  if (editCat) {
    const cat = state.categories.find(c => c.id === Number(editCat.dataset.editCat));
    if (!cat) return;
    const name = prompt("Nama kategori:", cat.name);
    if (name === null) return;
    const emoji = prompt("Emoji kategori:", cat.emoji);
    if (emoji === null) return;
    try {
      await api(`/api/admin/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emoji: emoji.trim() || "🍽️" })
      });
      showAlert("Kategori dikemaskini.");
      await loadAll();
    } catch (err) {
      showAlert(err.message, "error");
    }
    return;
  }

  const delCat = e.target.closest("[data-del-cat]");
  if (delCat) {
    if (!confirm("Padam kategori ini?")) return;
    try {
      await api(`/api/admin/categories/${delCat.dataset.delCat}`, { method: "DELETE" });
      showAlert("Kategori dipadam.");
      await loadAll();
    } catch (err) {
      showAlert(err.message, "error");
    }
  }
});

els.settingsForm.addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        store_name: els.settingStoreName.value.trim(),
        banner: els.settingBanner.value.trim(),
        store_open: els.settingStoreOpen.checked
      })
    });
    showAlert("Tetapan kedai disimpan.");
    await loadAll();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

// Init
(async function init() {
  try {
    await loadAll();
    showDashboard();
  } catch {
    // showLogin already triggered by api() on 401/503
  }
})();
