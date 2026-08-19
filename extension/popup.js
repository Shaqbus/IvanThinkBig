/* popup.js — load/save the extension settings (storefront URL + seller id). */
(function () {
  "use strict";
  var DEFAULTS = {
    storefrontUrl: "https://shaqbus.github.io/IvanThinkBig/",
    sellerId: "veeqo-seller"
  };
  var urlEl = document.getElementById("url");
  var sellerEl = document.getElementById("seller");
  var statusEl = document.getElementById("status");

  chrome.storage.sync.get(DEFAULTS, function (cfg) {
    urlEl.value = cfg.storefrontUrl;
    sellerEl.value = cfg.sellerId;
  });

  document.getElementById("save").addEventListener("click", function () {
    var cfg = {
      storefrontUrl: urlEl.value.trim() || DEFAULTS.storefrontUrl,
      sellerId: sellerEl.value.trim() || DEFAULTS.sellerId
    };
    chrome.storage.sync.set(cfg, function () {
      statusEl.textContent = "Saved ✓";
      setTimeout(function () { statusEl.textContent = ""; }, 1600);
    });
  });
})();
