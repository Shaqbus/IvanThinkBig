/* attribution.js — Veeqo link-out attribution capture (Req 1 / P4). */
(function (global) {
  "use strict";
  var STORAGE_KEY = "vq_attribution";
  var SOURCE = { VEEQO: "VEEQO", DIRECT: "DIRECT", OTHER: "OTHER" };

  function readFromUrl() {
    var params = new URLSearchParams(global.location.search);
    var token = params.get("ref") || params.get("vq_token") || "";
    var srcParam = (params.get("source") || "").toUpperCase();
    var source = SOURCE.DIRECT;
    if (srcParam === "VEEQO" || token) source = SOURCE.VEEQO;
    else if (srcParam === "OTHER") source = SOURCE.OTHER;
    return { source: source, token: token };
  }

  function capture() {
    var existing = load();
    if (existing && existing.source === SOURCE.VEEQO && existing.token) return existing;
    var url = readFromUrl();
    if (url.source === SOURCE.VEEQO && !url.token) url.source = SOURCE.DIRECT;
    var attribution = { source: url.source, token: url.token, capturedAt: new Date().toISOString() };
    save(attribution);
    return attribution;
  }

  function save(attr) { try { global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attr)); } catch (e) {} }
  function load() { try { var raw = global.sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function get() { return load() || capture(); }

  global.Attribution = { SOURCE: SOURCE, capture: capture, get: get, load: load };
})(window);
