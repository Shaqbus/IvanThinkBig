/* commission.js — Revenue & Commission service (client-side).
 * P1 bounds, P2 reconciliation, P3 rate immutability, P5 idempotency, P9 reversal.
 * Money handled in integer cents to avoid float drift. */
(function (global) {
  "use strict";
  var BASIS = { SUBTOTAL: "SUBTOTAL", ORDER_VALUE: "ORDER_VALUE" };
  var _rates = [ { ratePercent: 12.5, basis: BASIS.ORDER_VALUE, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null } ];

  function toCents(d) { return Math.round(Number(d) * 100); }
  function toDollars(c) { return c / 100; }
  function roundCents(c) { return Math.round(c); }

  function getActiveCommissionRate(atTime) {
    var t = new Date(atTime).getTime();
    var matches = _rates.filter(function (r) {
      var from = new Date(r.effectiveFrom).getTime();
      var to = r.effectiveTo ? new Date(r.effectiveTo).getTime() : Infinity;
      return from <= t && t < to;
    });
    if (matches.length === 0) throw new Error("NO_ACTIVE_RATE");
    if (matches.length > 1) throw new Error("AMBIGUOUS_RATE");
    return matches[0];
  }

  function commissionBasisAmount(order, rate) { return rate.basis === BASIS.SUBTOTAL ? order.subtotal : order.orderValue; }

  function computeVeeqoCommission(order, rate) {
    if (rate.ratePercent < 0 || rate.ratePercent > 100) throw new Error("RATE_OUT_OF_RANGE");
    var basisCents = toCents(commissionBasisAmount(order, rate));
    var commissionCents = roundCents(basisCents * rate.ratePercent / 100);
    if (commissionCents < 0) commissionCents = 0;
    if (commissionCents > basisCents) commissionCents = basisCents;
    return toDollars(commissionCents);
  }

  function recordRevenueAndCommission(order, attributionSource, existingRecords) {
    existingRecords = existingRecords || [];
    var priorActive = existingRecords.find(function (r) { return r.orderId === order.orderId && !r.reversed && !r.isReversal; });
    if (priorActive) return priorActive;
    var rate = getActiveCommissionRate(order.createdAt);
    var grossCents = toCents(order.orderValue);
    var commissionCents = toCents(computeVeeqoCommission(order, rate));
    var supplierPayableCents = grossCents - commissionCents;
    return Object.freeze({
      recordId: uuid(), orderId: order.orderId, grossRevenue: toDollars(grossCents),
      commissionBasisAmount: commissionBasisAmount(order, rate), commissionRatePercent: rate.ratePercent,
      commissionBasis: rate.basis, veeqoCommission: toDollars(commissionCents), supplierPayable: toDollars(supplierPayableCents),
      currency: order.currency, attributionSource: attributionSource, recordedAt: new Date().toISOString(),
      reversed: false, isReversal: false
    });
  }

  function reverseRevenue(record) {
    return Object.freeze({
      recordId: uuid(), orderId: record.orderId, grossRevenue: -record.grossRevenue,
      commissionBasisAmount: -record.commissionBasisAmount, commissionRatePercent: record.commissionRatePercent,
      commissionBasis: record.commissionBasis, veeqoCommission: -record.veeqoCommission, supplierPayable: -record.supplierPayable,
      currency: record.currency, attributionSource: record.attributionSource, recordedAt: new Date().toISOString(),
      reversed: false, isReversal: true, reversesRecordId: record.recordId
    });
  }

  function summarize(records, source) {
    var totalGross = 0, totalCommission = 0, totalPayable = 0, counted = {};
    records.forEach(function (r) {
      if (source && source !== "ALL" && r.attributionSource !== source) return;
      totalGross += r.grossRevenue; totalCommission += r.veeqoCommission; totalPayable += r.supplierPayable;
      if (!r.isReversal) counted[r.orderId] = true;
    });
    return {
      orderCount: Object.keys(counted).length, totalGross: round2(totalGross),
      totalCommission: round2(totalCommission), totalSupplierPayable: round2(totalPayable),
      reconciles: Math.abs((totalCommission + totalPayable) - totalGross) < 0.005
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }
  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0; var v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
    });
  }
  function activeRateInfo() { try { var r = getActiveCommissionRate(new Date().toISOString()); return { ratePercent: r.ratePercent, basis: r.basis }; } catch (e) { return { error: e.message }; } }

  global.Commission = { BASIS: BASIS, getActiveCommissionRate: getActiveCommissionRate, computeVeeqoCommission: computeVeeqoCommission, recordRevenueAndCommission: recordRevenueAndCommission, reverseRevenue: reverseRevenue, summarize: summarize, activeRateInfo: activeRateInfo, _uuid: uuid };
})(window);
