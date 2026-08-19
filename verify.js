/* verify.js — headless validation of the commission + order math against the
 * design's correctness properties. Loads the real commission.js in a minimal
 * shim (it only needs a `window` global). Run: node verify.js
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

// --- shim a browser-ish global so commission.js's IIFE can attach to window ---
const window = {};
global.window = window;

const commissionSrc = fs.readFileSync(path.join(__dirname, "js/commission.js"), "utf8");
eval(commissionSrc.replace("})(window);", "})(window);"));

const C = window.Commission;
let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log("  \u2713 " + name); pass++; }
  catch (e) { console.log("  \u2717 " + name + " \u2014 " + e.message); fail++; }
}

function round2(n) { return Math.round(n * 100) / 100; }

function makeOrder(lines, shipping, tax, source) {
  let subtotal = 0;
  const outLines = lines.map(l => {
    const lineTotal = round2(l.unitPrice * l.qty);
    subtotal += lineTotal;
    return { sku: l.sku, quantity: l.qty, unitPriceAtPurchase: l.unitPrice, lineTotal };
  });
  subtotal = round2(subtotal);
  const orderValue = round2(subtotal + shipping + tax);
  return {
    orderId: C._uuid(),
    lines: outLines, subtotal, shipping, tax, orderValue,
    currency: "USD", status: "PAID",
    attribution: { source: source || "VEEQO", token: "t", capturedAt: new Date().toISOString() },
    createdAt: new Date().toISOString()
  };
}

console.log("Commission & order math verification\n");

check("P7: subtotal == SUM(unitPrice*qty), orderValue == subtotal+shipping+tax", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 18.75, qty: 50 }, { sku: "B", unitPrice: 16.40, qty: 10 }], 0, 0, "VEEQO");
  assert.strictEqual(o.subtotal, round2(18.75 * 50 + 16.40 * 10));
  assert.strictEqual(o.orderValue, round2(o.subtotal + o.shipping + o.tax));
});

check("P1: 0 <= commission <= basis, over rate/basis sweep", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 34.00, qty: 3 }], 9.95, 8.42, "VEEQO");
  for (const basis of [C.BASIS.SUBTOTAL, C.BASIS.ORDER_VALUE]) {
    for (const rp of [0, 0.1, 12.5, 50, 99.9, 100]) {
      const rate = { ratePercent: rp, basis, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null };
      const c = C.computeVeeqoCommission(o, rate);
      const basisAmt = basis === C.BASIS.SUBTOTAL ? o.subtotal : o.orderValue;
      assert.ok(c >= 0, `commission negative at ${rp}% ${basis}`);
      assert.ok(c <= basisAmt + 1e-9, `commission ${c} > basis ${basisAmt} at ${rp}% ${basis}`);
    }
  }
});

check("Commission value: 12.5% of ORDER_VALUE computes exactly", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 100, qty: 1 }], 0, 0, "VEEQO");
  const rate = { ratePercent: 12.5, basis: C.BASIS.ORDER_VALUE, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null };
  assert.strictEqual(C.computeVeeqoCommission(o, rate), 12.5);
});

check("P2: commission + supplierPayable == grossRevenue (record level)", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 27.50, qty: 4 }], 9.95, 9.07, "VEEQO");
  const rec = C.recordRevenueAndCommission(o, "VEEQO", []);
  assert.ok(Math.abs((rec.veeqoCommission + rec.supplierPayable) - rec.grossRevenue) < 0.005,
    `${rec.veeqoCommission} + ${rec.supplierPayable} != ${rec.grossRevenue}`);
  assert.strictEqual(rec.grossRevenue, o.orderValue);
});

check("P5: recording twice yields the same single non-reversed record", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 21.90, qty: 2 }], 9.95, 4.02, "VEEQO");
  const r1 = C.recordRevenueAndCommission(o, "VEEQO", []);
  const store = [r1];
  const r2 = C.recordRevenueAndCommission(o, "VEEQO", store);
  assert.strictEqual(r1.recordId, r2.recordId, "second call created a new record");
});

check("P9: reversal record nets gross + commission to zero", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 13.50, qty: 6 }], 9.95, 6.68, "VEEQO");
  const rec = C.recordRevenueAndCommission(o, "VEEQO", []);
  const rev = C.reverseRevenue(rec);
  assert.ok(Math.abs(rec.grossRevenue + rev.grossRevenue) < 0.005, "gross not zeroed");
  assert.ok(Math.abs(rec.veeqoCommission + rev.veeqoCommission) < 0.005, "commission not zeroed");
});

check("P3: record captures commissionRatePercent (immutable snapshot)", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 10, qty: 1 }], 0, 0, "VEEQO");
  const rec = C.recordRevenueAndCommission(o, "VEEQO", []);
  assert.strictEqual(rec.commissionRatePercent, 12.5);
  assert.ok(Object.isFrozen(rec), "record should be immutable/frozen");
});

check("Req 13: no active rate at order time throws (fail closed)", () => {
  const o = makeOrder([{ sku: "A", unitPrice: 10, qty: 1 }], 0, 0, "VEEQO");
  o.createdAt = "2020-01-01T00:00:00Z";
  assert.throws(() => C.recordRevenueAndCommission(o, "VEEQO", []), /NO_ACTIVE_RATE/);
});

check("Req 11: summarize reconciles and counts non-reversed orders", () => {
  const recs = [];
  const o1 = makeOrder([{ sku: "A", unitPrice: 18.75, qty: 50 }], 0, 77.34, "VEEQO");
  const o2 = makeOrder([{ sku: "B", unitPrice: 9.99, qty: 100 }], 0, 82.42, "DIRECT");
  recs.push(C.recordRevenueAndCommission(o1, "VEEQO", recs));
  recs.push(C.recordRevenueAndCommission(o2, "DIRECT", recs));
  const s = C.summarize(recs, "ALL");
  assert.strictEqual(s.orderCount, 2);
  assert.ok(s.reconciles, "aggregate did not reconcile");
});

check("Catalog: products.json valid; >=1 inactive product for P8 demo", () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/products.json"), "utf8"));
  assert.ok(Array.isArray(data.products) && data.products.length >= 5);
  const inactive = data.products.filter(p => p.active === false);
  assert.ok(inactive.length >= 1, "need an inactive product to demonstrate P8");
  data.products.forEach(p => {
    assert.ok(p.sku && p.sku.length > 0, "empty sku");
    assert.ok(p.unitPrice >= 0 && p.supplierCost >= 0, "negative price/cost on " + p.sku);
    assert.ok(/^[A-Z]{3}$/.test(p.currency), "bad currency on " + p.sku);
  });
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
