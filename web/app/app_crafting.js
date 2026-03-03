// -------------------- Crafting UI (recipes + forage/hunt) --------------------
(() => {
  const craftBtn = document.getElementById("craftBtn");
  const craftModal = document.getElementById("craftModal");
  const craftCloseBtn = document.getElementById("craftClose");
  const craftSubEl = document.getElementById("craftSub");

  const tabBtns = Array.from(document.querySelectorAll(".craftTabs .miniTab[data-crafttab]"));
  const panels = Array.from(document.querySelectorAll(".craftBody .craftPanel[data-craftpanel]"));

  const craftSearchEl = document.getElementById("craftSearch");
  const craftRefreshBtn = document.getElementById("craftRefresh");
  const craftRecipeListEl = document.getElementById("craftRecipeList");

  const forageBiomeEl = document.getElementById("forageBiome");
  const huntBiomeEl = document.getElementById("huntBiome");
  const forageGoBtn = document.getElementById("forageGo");
  const huntGoBtn = document.getElementById("huntGo");

  const BIOMES = [
    { id: "forest", label: "Forest" },
    { id: "plains", label: "Plains" },
    { id: "marsh", label: "Marsh / Wetlands" },
    { id: "desert", label: "Arid / Salt Flats" },
    { id: "tundra", label: "Cold Reaches" },
    { id: "coast", label: "Coast / Riverlands" },
  ];

  let craftOpen = false;
  let craftTab = "recipes";
  let craftData = { region: "", biome: "", loc: "", recipes: [] };
  let socketBound = false;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setCraftTab(next) {
    craftTab = String(next || "recipes").toLowerCase();
    for (const b of tabBtns) {
      const on = String(b.dataset.crafttab || "").toLowerCase() === craftTab;
      b.classList.toggle("active", on);
    }
    for (const p of panels) {
      const on = String(p.dataset.craftpanel || "").toLowerCase() === craftTab;
      p.classList.toggle("active", on);
    }
  }

  function fillBiomeSelect(sel, prefer) {
    if (!sel) return;
    const pref = String(prefer || "").trim().toLowerCase();
    sel.innerHTML = "";
    for (const b of BIOMES) {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.label;
      sel.appendChild(opt);
    }
    if (pref) {
      const hit = BIOMES.some(b => b.id === pref);
      if (hit) sel.value = pref;
    }
  }

  function requestCraftList() {
    try { if (!socket) connectSocketIfNeeded(); } catch {}
    try {
      if (socket && joined && activeRoomId) socket.emit("craft_list", {});
    } catch {}
  }

  function renderRecipes() {
    if (!craftRecipeListEl) return;

    const q = String(craftSearchEl?.value || "").trim().toLowerCase();
    const list = Array.isArray(craftData?.recipes) ? craftData.recipes : [];

    const filtered = q
      ? list.filter(r => {
          const hay = `${r.name || ""} ${r.category || ""} ${r.description || ""}`.toLowerCase();
          return hay.includes(q);
        })
      : list;

    if (!filtered.length) {
      craftRecipeListEl.innerHTML = `<div class="craftEmpty">(No recipes found.)</div>`;
      return;
    }

    let lastCat = "";
    const chunks = [];
    for (const r of filtered) {
      const cat = String(r.category || "Misc").trim();
      if (cat && cat !== lastCat) {
        chunks.push(`<div class="craftCat">${escapeHtml(cat)}</div>`);
        lastCat = cat;
      }

      const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
        .filter(x => x && x.item)
        .map(x => `${Number(x.qty || 1) || 1}× ${x.item}`)
        .join(", ");

      const outputs = (Array.isArray(r.outputs) ? r.outputs : [])
        .filter(x => x && x.item)
        .map(x => `${Number(x.qty || 1) || 1}× ${x.item}`)
        .join(", ");

      const missing = (Array.isArray(r.missing) ? r.missing : [])
        .map(m => `${m.item} (${m.have}/${m.need})`)
        .join(", ");

      const rid = escapeHtml(r.id);
      const can = !!r.craftable;

      chunks.push(`
        <div class="craftRow ${can ? "" : "cant"}" data-recipe="${rid}">
          <div class="craftRowTop">
            <div class="craftName">${escapeHtml(r.name || r.id || "Recipe")}</div>
            <div class="craftRight">
              <input class="craftQty" type="number" min="1" max="99" value="1" />
              <button class="craftMake ${can ? "primary" : "ghost"}" ${can ? "" : "disabled"} type="button">
                Craft
              </button>
            </div>
          </div>
          ${r.description ? `<div class="craftDesc">${escapeHtml(r.description)}</div>` : ``}
          <div class="craftLine"><span class="craftLabel">Needs:</span> ${escapeHtml(ingredients || "—")}</div>
          <div class="craftLine"><span class="craftLabel">Makes:</span> ${escapeHtml(outputs || "—")}</div>
          ${(!can && missing) ? `<div class="craftMissing">Missing: ${escapeHtml(missing)}</div>` : ``}
        </div>
      `);
    }

    craftRecipeListEl.innerHTML = chunks.join("");

    // Wire craft buttons
    for (const row of Array.from(craftRecipeListEl.querySelectorAll(".craftRow[data-recipe]"))) {
      const recipeId = String(row.getAttribute("data-recipe") || "");
      const btn = row.querySelector("button.craftMake");
      const qtyEl = row.querySelector("input.craftQty");

      if (!btn) continue;
      btn.addEventListener("click", () => {
        const qty = Math.max(1, Math.min(99, Math.floor(Number(qtyEl?.value || 1))));
        try { if (!socket) connectSocketIfNeeded(); } catch {}
        try {
          if (socket && joined && activeRoomId) socket.emit("craft_make", { recipeId, qty });
        } catch {}
      }, { once: true });
    }
  }

  function openCraft() {
    if (!craftModal) return;
    craftOpen = true;
    setCraftTab(craftTab);
    craftModal.classList.remove("hidden");
    requestCraftList();
  }

  function closeCraft() {
    craftOpen = false;
    if (!craftModal) return;
    craftModal.classList.add("hidden");
  }

  // Public hooks for other scripts
  window.AETH_CRAFT = window.AETH_CRAFT || {};
  window.AETH_CRAFT.onCanonUpdate = () => {
    if (!craftOpen) return;
    requestCraftList();
  };
  window.AETH_CRAFT.bindSocket = (sock) => {
    if (!sock || socketBound) return;
    socketBound = true;

    sock.on("craft_list", (payload) => {
      try {
        craftData = payload && typeof payload === "object" ? payload : craftData;
        const b = String(craftData?.biome || "").trim().toLowerCase();
        fillBiomeSelect(forageBiomeEl, b);
        fillBiomeSelect(huntBiomeEl, b);

        if (craftSubEl) {
          const loc = String(craftData?.loc || "").trim();
          const region = String(craftData?.region || "").trim();
          const parts = [];
          if (loc) parts.push(loc);
          if (region) parts.push(region);
          if (b) parts.push(b);
          craftSubEl.textContent = parts.length ? parts.join(" • ") : "Recipes, foraging, hunting.";
        }
      } catch {}
      try { renderRecipes(); } catch {}
    });

    sock.on("craft_done", (_payload) => {
      try { if (craftOpen) requestCraftList(); } catch {}
    });
  };

  // Wire controls
  craftBtn?.addEventListener("click", () => {
    if (craftBtn?.disabled) return;
    openCraft();
  });
  craftCloseBtn?.addEventListener("click", closeCraft);

  // Tab buttons
  for (const b of tabBtns) {
    b.addEventListener("click", () => setCraftTab(String(b.dataset.crafttab || "recipes")));
  }

  craftSearchEl?.addEventListener("input", () => {
    try { renderRecipes(); } catch {}
  });

  craftRefreshBtn?.addEventListener("click", requestCraftList);

  forageGoBtn?.addEventListener("click", () => {
    const biome = String(forageBiomeEl?.value || "forest");
    try { if (!socket) connectSocketIfNeeded(); } catch {}
    try {
      if (socket && joined && activeRoomId) socket.emit("gather_start", { kind: "forage", biome });
    } catch {}
  });

  huntGoBtn?.addEventListener("click", () => {
    const biome = String(huntBiomeEl?.value || "forest");
    try { if (!socket) connectSocketIfNeeded(); } catch {}
    try {
      if (socket && joined && activeRoomId) socket.emit("gather_start", { kind: "hunt", biome });
    } catch {}
  });

  // Escape to close
  document.addEventListener("keydown", (e) => {
    if (!craftOpen) return;
    if (e.key === "Escape") closeCraft();
  });

  // Initial fill (default)
  fillBiomeSelect(forageBiomeEl, "");
  fillBiomeSelect(huntBiomeEl, "");
})();
