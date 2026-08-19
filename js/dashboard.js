/* dashboard.js — Finance & Reporting view (Req 11, P2 reconciliation, P9 refunds). */
(function () {
  "use strict";
  var money = function (n, c) { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(n); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var toastEl = document.getElementById("toast"), toastTimer;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600); }

  function withinRange(iso, from, to) {
    if (!from && !to) return true;
    var t = new Date(iso).getTime();
    if (from && t < new Date(from + "T00:00:00").getTime()) return false;
    if (to && t > new Date(to + "T23:59:59").getTime()) return false;
    return true;
  }

  function render() {
    var from = document.getElementById("fromDate").value;
    var to = document.getElementById("toDate").value;
    var source = document.getElementById("sourceFilter").value;
    var rangeError = document.getElementById("rangeError");
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) { rangeError.style.display = "block"; return; }
    rangeError.style.display = "none";

    var revenue = window.Orders.loadRevenue().filter(function (r) { return withinRange(r.recordedAt, from, to) && (source === "ALL" || r.attributionSource === source); });
    var orders = window.Orders.loadOrders();
    var summary = window.Commission.summarize(revenue, source);
    document.getElementById("sOrders").textContent = summary.orderCount;
    document.getElementById("sGross").textContent = money(summary.totalGross);
    document.getElementById("sCommission").textContent = money(summary.totalCommission);
    document.getElementById("sPayable").textContent = money(summary.totalSupplierPayable);

    var banner = document.getElementById("reconBanner");
    if (summary.reconciles) { banner.className = "vq-recon ok"; banner.textContent = "Reconciliation: commission (" + money(summary.totalCommission) + ") + supplier payable (" + money(summary.totalSupplierPayable) + ") = gross revenue (" + money(summary.totalGross) + ") ✓ (P2)"; }
    else { banner.className = "vq-recon bad"; banner.textContent = "Reconciliation FAILED — commission + payable ≠ gross revenue."; }

    var primary = revenue.filter(function (r) { return !r.isReversal; });
    var rowsEl = document.getElementById("rows");
    if (primary.length === 0) { rowsEl.innerHTML = '<tr><td colspan="9" class="vq-empty">No revenue records in this range. Place an order or seed demo data.</td></tr>'; return; }
    primary.sort(function (a, b) { return new Date(b.recordedAt) - new Date(a.recordedAt); });
    rowsEl.innerHTML = primary.map(function (r) {
      var order = orders.find(function (o) { return o.orderId === r.orderId; });
      var status = order ? order.status : "—";
      var reversed = r.reversed;
      var cls = reversed ? ' class="reversed"' : "";
      var shortId = r.orderId.slice(0, 8);
      var canRefund = order && (order.status === "CONFIRMED" || order.status === "FULFILLED");
      var action = reversed ? '<span class="vq-tag">Refunded</span>' : (canRefund ? '<button class="vq-btn vq-btn--ghost refund-btn" data-order="' + r.orderId + '" style="padding:6px 10px; font-size:12px;">Refund</button>' : "");
      return '<tr' + cls + '><td title="' + esc(r.orderId) + '">' + esc(shortId) + '…</td><td>' + new Date(r.recordedAt).toLocaleDateString() + '</td><td>' + esc(r.attributionSource) + '</td><td>' + esc(status) + '</td><td class="num">' + money(r.grossRevenue, r.currency) + '</td><td class="num">' + r.commissionRatePercent + '%</td><td class="num">' + money(r.veeqoCommission, r.currency) + '</td><td class="num">' + money(r.supplierPayable, r.currency) + '</td><td class="num">' + action + '</td></tr>';
    }).join("");
    rowsEl.querySelectorAll(".refund-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { var res = window.Orders.refundOrder(btn.getAttribute("data-order")); toast(res.success ? "Order refunded — revenue reversed (P9)" : "Refund failed: " + res.message); render(); });
    });
  }

  function seed() {
    return window.Catalog.load().then(function () {
      var active = window.Catalog.listActive({});
      if (active.length === 0) { toast("Catalog not loaded."); return; }
      var sources = ["VEEQO", "VEEQO", "VEEQO", "DIRECT", "OTHER"];
      var made = 0;
      sources.forEach(function (src, i) {
        var picks = [active[i % active.length], active[(i + 2) % active.length]];
        var lines = picks.map(function (p, j) { var qty = (j + 1) * 2 + i; return { sku: p.sku, name: p.name, emoji: p.emoji, unitPrice: p.unitPrice, quantity: qty, currency: p.currency, lineTotal: Math.round(p.unitPrice * qty * 100) / 100 }; });
        var subtotal = Math.round(lines.reduce(function (s, l) { return s + l.lineTotal; }, 0) * 100) / 100;
        var shipping = subtotal >= 150 ? 0 : 9.95;
        var tax = Math.round(subtotal * 0.0825 * 100) / 100;
        var totals = { lines: lines, subtotal: subtotal, shipping: shipping, tax: tax, orderValue: Math.round((subtotal + shipping + tax) * 100) / 100, currency: "USD" };
        var attribution = { source: src, token: src === "VEEQO" ? "veeqo-seed-" + i : "", capturedAt: new Date().toISOString() };
        for (var attempt = 0; attempt < 4; attempt++) { var res = window.Orders.placeOrder(totals, attribution); if (res.success) { made++; break; } }
      });
      toast("Seeded " + made + " demo orders.");
      render();
    });
  }

  function reset() { try { localStorage.removeItem("vq_orders"); localStorage.removeItem("vq_revenue"); } catch (e) {} toast("All orders + revenue cleared."); render(); }

  var rate = window.Commission.activeRateInfo();
  document.getElementById("rateBadge").textContent = rate.error ? "Commission rate: " + rate.error : "Commission " + rate.ratePercent + "% of " + (rate.basis === "ORDER_VALUE" ? "order value" : "subtotal");
  document.getElementById("applyBtn").addEventListener("click", render);
  document.getElementById("sourceFilter").addEventListener("change", render);
  document.getElementById("seedBtn").addEventListener("click", seed);
  document.getElementById("resetBtn").addEventListener("click", reset);
  render();
})();
