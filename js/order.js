/* order.js — Order lifecycle + place-order orchestration (client-side).
 * Req 5 (creation + transition guard), Req 6 (mock payment), Req 14 (orchestration),
 * Req 9 (mock fulfillment), Req 10/P9 (refund). Persists to localStorage. */
(function (global) {
  "use strict";
  var ORDERS_KEY = "vq_orders", REVENUE_KEY = "vq_revenue";
  var STATUS = { PENDING_PAYMENT: "PENDING_PAYMENT", PAID: "PAID", CONFIRMED: "CONFIRMED", FULFILLED: "FULFILLED", CANCELLED: "CANCELLED", REFUNDED: "REFUNDED" };
  var TRANSITIONS = { PENDING_PAYMENT: ["PAID", "CANCELLED"], PAID: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["FULFILLED", "REFUNDED"], FULFILLED: ["REFUNDED"], CANCELLED: [], REFUNDED: [] };

  function canTransition(from, to) { return (TRANSITIONS[from] || []).indexOf(to) !== -1; }
  function loadOrders() { return readArr(ORDERS_KEY); }
  function loadRevenue() { return readArr(REVENUE_KEY); }
  function readArr(k) { try { var r = global.localStorage.getItem(k); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
  function writeArr(k, arr) { try { global.localStorage.setItem(k, JSON.stringify(arr)); } catch (e) {} }
  function saveOrder(order) { var all = loadOrders(); var i = all.findIndex(function (o) { return o.orderId === order.orderId; }); if (i >= 0) all[i] = order; else all.push(order); writeArr(ORDERS_KEY, all); }
  function saveRevenue(record) { var all = loadRevenue(); all.push(record); writeArr(REVENUE_KEY, all); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function createOrder(totals, attribution) {
    if (!totals.lines || totals.lines.length === 0) throw new Error("EMPTY_CART");
    totals.lines.forEach(function (l) {
      if (l.quantity <= 0) throw new Error("BAD_QUANTITY");
      var p = global.Catalog.getProduct(l.sku);
      if (!p || !p.active) throw new Error("INACTIVE_PRODUCT:" + l.sku);
    });
    var now = new Date().toISOString();
    var order = {
      orderId: global.Commission._uuid(),
      lines: totals.lines.map(function (l) { return { sku: l.sku, name: l.name, quantity: l.quantity, unitPriceAtPurchase: l.unitPrice, lineTotal: round2(l.unitPrice * l.quantity) }; }),
      subtotal: totals.subtotal, shipping: totals.shipping, tax: totals.tax, orderValue: totals.orderValue, currency: totals.currency,
      attribution: { source: attribution.source, token: attribution.token, capturedAt: attribution.capturedAt },
      paymentRef: null, supplierOrderId: null, status: STATUS.PENDING_PAYMENT, createdAt: now, updatedAt: now
    };
    saveOrder(order);
    return order;
  }

  function setStatus(order, to, patch) {
    if (!canTransition(order.status, to)) throw new Error("ILLEGAL_TRANSITION:" + order.status + "->" + to);
    order.status = to; order.updatedAt = new Date().toISOString();
    if (patch) Object.keys(patch).forEach(function (k) { order[k] = patch[k]; });
    saveOrder(order);
    return order;
  }

  function authorizePayment(order) { if (Math.random() < 0.08) return { success: false }; return { success: true, paymentRef: "psp_" + Math.random().toString(36).slice(2, 12) }; }
  function submitFulfillment(order) { if (Math.random() < 0.05) return { accepted: false }; return { accepted: true, supplierOrderId: "PS-" + Date.now().toString().slice(-8) }; }

  function placeOrder(cartTotals, attribution) {
    var validation = global.Catalog.validateCartPricing(cartTotals.lines.map(function (l) { return { sku: l.sku, unitPrice: l.unitPrice }; }));
    if (!validation.valid) return { success: false, code: "PRICING", issues: validation.issues };
    var order;
    try { order = createOrder(cartTotals, attribution); } catch (e) { return { success: false, code: "CREATE", message: e.message }; }
    var pay = authorizePayment(order);
    if (!pay.success) { setStatus(order, STATUS.CANCELLED, { cancelReason: "payment_failed" }); return { success: false, code: "PAYMENT", order: order }; }
    setStatus(order, STATUS.PAID, { paymentRef: pay.paymentRef });
    var revenue;
    try { revenue = global.Commission.recordRevenueAndCommission(order, order.attribution.source, loadRevenue()); saveRevenue(revenue); }
    catch (e) { return { success: false, code: "COMMISSION", message: e.message, order: order }; }
    var ack = submitFulfillment(order);
    if (ack.accepted) { setStatus(order, STATUS.CONFIRMED, { supplierOrderId: ack.supplierOrderId }); }
    else { order.fulfillmentPending = true; saveOrder(order); }
    return { success: true, order: order, revenue: revenue };
  }

  function refundOrder(orderId) {
    var orders = loadOrders();
    var order = orders.find(function (o) { return o.orderId === orderId; });
    if (!order) return { success: false, message: "not_found" };
    if (!canTransition(order.status, STATUS.REFUNDED)) return { success: false, message: "cannot_refund_from_" + order.status };
    var revenue = loadRevenue();
    var original = revenue.find(function (r) { return r.orderId === orderId && !r.reversed && !r.isReversal; });
    if (original) {
      var reversal = global.Commission.reverseRevenue(original);
      var idx = revenue.findIndex(function (r) { return r.recordId === original.recordId; });
      revenue[idx] = Object.assign({}, original, { reversed: true });
      revenue.push(reversal);
      writeArr(REVENUE_KEY, revenue);
    }
    setStatus(order, STATUS.REFUNDED, { refundedAt: new Date().toISOString() });
    return { success: true, order: order };
  }

  global.Orders = { STATUS: STATUS, canTransition: canTransition, createOrder: createOrder, placeOrder: placeOrder, refundOrder: refundOrder, loadOrders: loadOrders, loadRevenue: loadRevenue, getOrder: function (id) { return loadOrders().find(function (o) { return o.orderId === id; }) || null; } };
})(window);
