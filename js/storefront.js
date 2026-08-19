/* storefront.js — wires the shop page: attribution badge, catalog grid, cart, checkout. */
(function () {
  "use strict";
  var grid = document.getElementById("grid");
  var catFilter = document.getElementById("catFilter");
  var searchBox = document.getElementById("searchBox");
  var cartLinesEl = document.getElementById("cartLines");
  var cartTotalsEl = document.getElementById("cartTotals");
  var checkoutBtn = document.getElementById("checkoutBtn");
  var toastEl = document.getElementById("toast");
  var modal = document.getElementById("checkoutModal");
  var money = function (n, c) { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(n); };
  var toastTimer;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600); }

  function renderAttribution() {
    var attr = window.Attribution.get();
    var badge = document.getElementById("attrBadge");
    if (attr.source === "VEEQO") { badge.textContent = "Referred by Veeqo"; badge.classList.remove("is-direct"); badge.title = "Attribution token: " + attr.token; }
    else { badge.textContent = attr.source === "OTHER" ? "Other source" : "Direct visit"; badge.classList.add("is-direct"); }
  }

  var STOCK_LABEL = { IN_STOCK: ["in", "In stock"], LOW_STOCK: ["low", "Low stock"], OUT_OF_STOCK: ["out", "Out of stock"] };

  function renderGrid() {
    var products = window.Catalog.listActive({ category: catFilter.value || null, query: searchBox.value.trim() || null });
    if (products.length === 0) { grid.innerHTML = '<p class="vq-empty">No products match your filters.</p>'; return; }
    grid.innerHTML = products.map(function (p) {
      var s = STOCK_LABEL[p.stockStatus] || STOCK_LABEL.OUT_OF_STOCK;
      var soldOut = p.stockStatus === "OUT_OF_STOCK";
      return '<div class="vq-card"><div class="vq-card__media">' + p.emoji + '</div><div class="vq-card__body">' +
        '<span class="vq-card__sku">' + p.sku + '</span><span class="vq-card__name">' + esc(p.name) + '</span>' +
        '<span class="vq-card__desc">' + esc(p.description) + '</span><div class="vq-card__row">' +
        '<span class="vq-price">' + money(p.unitPrice, p.currency) + '</span><span class="vq-stock ' + s[0] + '">' + s[1] + '</span></div>' +
        '<button class="vq-btn vq-btn--dark vq-btn--block add-btn" data-sku="' + p.sku + '" ' + (soldOut ? "disabled" : "") + ' style="margin-top:10px;">' + (soldOut ? "Unavailable" : "Add to cart") + '</button></div></div>';
    }).join("");
    Array.prototype.forEach.call(grid.querySelectorAll(".add-btn"), function (btn) {
      btn.addEventListener("click", function () { var p = window.Catalog.getProduct(btn.getAttribute("data-sku")); if (p && p.active) { window.Cart.add(p, 1); toast(p.name + " added to cart"); } });
    });
  }

  function renderCart(snap) {
    var t = snap.totals;
    document.getElementById("cartCount").textContent = snap.count;
    if (snap.lines.length === 0) { cartLinesEl.innerHTML = '<p class="vq-empty">Your cart is empty.</p>'; cartTotalsEl.style.display = "none"; checkoutBtn.disabled = true; return; }
    cartLinesEl.innerHTML = t.lines.map(function (l) {
      return '<div class="vq-line"><span style="font-size:22px;">' + (l.emoji || "📦") + '</span>' +
        '<span class="vq-line__name">' + esc(l.name) + '<small>' + money(l.unitPrice, l.currency) + ' each</small></span>' +
        '<span class="vq-qty"><button data-act="dec" data-sku="' + l.sku + '">−</button>' +
        '<input type="text" value="' + l.quantity + '" data-sku="' + l.sku + '" />' +
        '<button data-act="inc" data-sku="' + l.sku + '">+</button></span>' +
        '<span class="vq-line__total">' + money(l.lineTotal, l.currency) + '</span>' +
        '<button class="vq-line__rm" data-sku="' + l.sku + '" title="Remove">×</button></div>';
    }).join("");
    document.getElementById("tSubtotal").textContent = money(t.subtotal, t.currency);
    document.getElementById("tShipping").textContent = t.shipping === 0 ? "FREE" : money(t.shipping, t.currency);
    document.getElementById("tTax").textContent = money(t.tax, t.currency);
    document.getElementById("tOrderValue").textContent = money(t.orderValue, t.currency);
    cartTotalsEl.style.display = "block"; checkoutBtn.disabled = false;
    bindCartControls();
  }

  function bindCartControls() {
    cartLinesEl.querySelectorAll(".vq-qty button").forEach(function (b) {
      b.addEventListener("click", function () {
        var sku = b.getAttribute("data-sku");
        var line = window.Cart.raw().find(function (l) { return l.sku === sku; });
        if (!line) return;
        var q = b.getAttribute("data-act") === "inc" ? line.quantity + 1 : line.quantity - 1;
        window.Cart.setQty(sku, q);
      });
    });
    cartLinesEl.querySelectorAll(".vq-qty input").forEach(function (inp) { inp.addEventListener("change", function () { window.Cart.setQty(inp.getAttribute("data-sku"), inp.value); }); });
    cartLinesEl.querySelectorAll(".vq-line__rm").forEach(function (rm) { rm.addEventListener("click", function () { window.Cart.remove(rm.getAttribute("data-sku")); }); });
  }

  function openCheckout() { var t = window.Cart.totals(); if (t.lines.length === 0) return; document.getElementById("payAmount").textContent = money(t.orderValue, t.currency); modal.classList.add("show"); }
  function closeCheckout() { modal.classList.remove("show"); }

  function pay() {
    var payBtn = document.getElementById("payBtn");
    payBtn.disabled = true; payBtn.textContent = "Processing…";
    var totals = window.Cart.totals();
    var attribution = window.Attribution.get();
    setTimeout(function () {
      var result = window.Orders.placeOrder(totals, attribution);
      payBtn.disabled = false; payBtn.textContent = "Pay now";
      if (!result.success) {
        closeCheckout();
        if (result.code === "PAYMENT") toast("Payment failed. Please try again.");
        else if (result.code === "PRICING") { toast("Prices changed — please review your cart."); renderGrid(); }
        else if (result.code === "COMMISSION") toast("Order on hold — finance review required.");
        else toast("Could not place order: " + (result.message || result.code));
        return;
      }
      try { sessionStorage.setItem("vq_last_order", result.order.orderId); } catch (e) {}
      window.Cart.clear();
      closeCheckout();
      window.location.href = "confirmation.html?order=" + encodeURIComponent(result.order.orderId);
    }, 700);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  window.Attribution.capture();
  renderAttribution();
  window.Catalog.load().then(function () {
    var cats = window.Catalog.categories();
    cats.forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; catFilter.appendChild(o); });
    var m = window.Catalog.meta();
    document.getElementById("syncInfo").textContent = "Synced from " + (m.supplier || "supplier");
    renderGrid();
  }).catch(function (e) { grid.innerHTML = '<p class="vq-empty">Could not load catalog. If you opened this file directly, run it through a local web server (see README).</p>'; });

  catFilter.addEventListener("change", renderGrid);
  searchBox.addEventListener("input", renderGrid);
  window.Cart.subscribe(renderCart);
  checkoutBtn.addEventListener("click", openCheckout);
  document.getElementById("cartToggle").addEventListener("click", function () { document.querySelector(".vq-panel").scrollIntoView({ behavior: "smooth" }); });
  document.getElementById("cancelCheckout").addEventListener("click", closeCheckout);
  document.getElementById("payBtn").addEventListener("click", pay);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeCheckout(); });
})();
