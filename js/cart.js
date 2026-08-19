/* cart.js — shopper cart with subtotal/order-value math (P7). */
(function (global) {
  "use strict";
  var STORAGE_KEY = "vq_cart";
  var SHIPPING_FLAT = 9.95, SHIPPING_FREE_OVER = 150, TAX_RATE = 0.0825;
  var _lines = load(), _subscribers = [];

  function load() { try { var raw = global.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; } }
  function persist() { try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(_lines)); } catch (e) {} _subscribers.forEach(function (fn) { fn(snapshot()); }); }
  function subscribe(fn) { _subscribers.push(fn); fn(snapshot()); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function add(product, qty) {
    qty = Math.max(1, parseInt(qty || 1, 10));
    var existing = _lines.find(function (l) { return l.sku === product.sku; });
    if (existing) { existing.quantity += qty; existing.unitPrice = product.unitPrice; }
    else { _lines.push({ sku: product.sku, name: product.name, emoji: product.emoji, unitPrice: product.unitPrice, currency: product.currency, quantity: qty }); }
    persist();
  }

  function setQty(sku, qty) {
    qty = parseInt(qty, 10);
    var line = _lines.find(function (l) { return l.sku === sku; });
    if (!line) return;
    if (isNaN(qty) || qty <= 0) { remove(sku); return; }
    line.quantity = qty; persist();
  }

  function remove(sku) { _lines = _lines.filter(function (l) { return l.sku !== sku; }); persist(); }
  function clear() { _lines = []; persist(); }
  function count() { return _lines.reduce(function (n, l) { return n + l.quantity; }, 0); }

  function totals() {
    var subtotal = 0;
    var lines = _lines.map(function (l) {
      var lineTotal = round2(l.unitPrice * l.quantity); subtotal += lineTotal;
      return { sku: l.sku, name: l.name, emoji: l.emoji, unitPrice: l.unitPrice, quantity: l.quantity, currency: l.currency, lineTotal: lineTotal };
    });
    subtotal = round2(subtotal);
    var shipping = _lines.length === 0 ? 0 : (subtotal >= SHIPPING_FREE_OVER ? 0 : SHIPPING_FLAT);
    var tax = round2(subtotal * TAX_RATE);
    var orderValue = round2(subtotal + shipping + tax);
    return { lines: lines, subtotal: subtotal, shipping: shipping, tax: tax, orderValue: orderValue, currency: (_lines[0] && _lines[0].currency) || "USD" };
  }

  function snapshot() { return { lines: _lines.slice(), count: count(), totals: totals() }; }
  function raw() { return _lines.slice(); }

  global.Cart = { add: add, setQty: setQty, remove: remove, clear: clear, count: count, totals: totals, snapshot: snapshot, subscribe: subscribe, raw: raw, SHIPPING_FLAT: SHIPPING_FLAT, SHIPPING_FREE_OVER: SHIPPING_FREE_OVER, TAX_RATE: TAX_RATE };
})(window);
