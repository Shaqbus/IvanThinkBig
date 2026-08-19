/* catalog.js — Catalog reads + cart pricing validation (Req 3, 4; P8). */
(function (global) {
  "use strict";
  var _products = [], _meta = {}, _loaded = false;

  function load() {
    if (_loaded) return Promise.resolve(_products);
    return fetch("data/products.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("catalog fetch failed: " + r.status); return r.json(); })
      .then(function (data) {
        _products = (data.products || []).map(normalize);
        _meta = { syncedAt: data.syncedAt, supplier: data.supplier };
        _loaded = true;
        return _products;
      });
  }

  function normalize(p) {
    return {
      sku: String(p.sku || "").trim(), name: p.name || "", description: p.description || "",
      unitPrice: Number(p.unitPrice) || 0, supplierCost: Number(p.supplierCost) || 0,
      // Illustrative "Market Price" reference + savings %, used for the strikethrough
      // price comparison on product cards. Preserved only when present/valid; otherwise
      // left undefined so priceBlock() falls back to the plain price.
      marketPrice: (typeof p.marketPrice === "number" && p.marketPrice > 0) ? p.marketPrice : undefined,
      savingsPct: (typeof p.savingsPct === "number") ? p.savingsPct : undefined,
      currency: p.currency || "USD", stockStatus: p.stockStatus || "OUT_OF_STOCK",
      active: p.active === true, emoji: p.emoji || "📦", category: p.category || "Other"
    };
  }

  function isValid(p) { return p.sku.length > 0 && p.unitPrice >= 0 && p.supplierCost >= 0 && /^[A-Z]{3}$/.test(p.currency); }
  function meta() { return _meta; }

  function listActive(filter) {
    filter = filter || {};
    return _products.filter(function (p) {
      if (!p.active || !isValid(p)) return false;
      if (filter.category && p.category !== filter.category) return false;
      if (filter.query) {
        var q = filter.query.toLowerCase();
        if (p.name.toLowerCase().indexOf(q) === -1 && p.sku.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function categories() {
    var set = {};
    _products.forEach(function (p) { if (p.active) set[p.category] = true; });
    return Object.keys(set).sort();
  }

  function getProduct(sku) { return _products.find(function (p) { return p.sku === sku; }) || null; }

  function validateCartPricing(cart) {
    var issues = [];
    cart.forEach(function (line) {
      var p = getProduct(line.sku);
      if (!p) issues.push({ sku: line.sku, reason: "no_longer_available" });
      else if (!p.active) issues.push({ sku: line.sku, reason: "inactive", name: p.name });
      else if (Number(line.unitPrice.toFixed(2)) !== Number(p.unitPrice.toFixed(2)))
        issues.push({ sku: line.sku, reason: "price_changed", name: p.name, oldPrice: line.unitPrice, newPrice: p.unitPrice });
    });
    return { valid: issues.length === 0, issues: issues };
  }

  global.Catalog = { load: load, meta: meta, listActive: listActive, categories: categories, getProduct: getProduct, validateCartPricing: validateCartPricing };
})(window);
