/* content.js — injects the "Packaging Marketplace" button into the Veeqo
 * header. Clicking it link-outs to the storefront carrying a Veeqo attribution
 * token (?ref=<token>&source=veeqo), which the storefront captures (P4).
 */
(function () {
  "use strict";

  var DEFAULTS = {
    storefrontUrl: "https://shaqbus.github.io/IvanThinkBig/",
    sellerId: "veeqo-seller"
  };

  var BTN_ID = "vq-pkg-marketplace-btn";

  function buildToken(sellerId) {
    var nonce = Math.random().toString(36).slice(2, 8);
    return "vq-" + (sellerId || "seller") + "-" + Date.now().toString(36) + "-" + nonce;
  }

  function openStorefront(cfg) {
    var base = cfg.storefrontUrl || DEFAULTS.storefrontUrl;
    if (!/^https?:\/\//i.test(base)) base = "https://" + base;
    var sep = base.indexOf("?") === -1 ? "?" : "&";
    var token = buildToken(cfg.sellerId);
    var url = base + sep + "ref=" + encodeURIComponent(token) + "&source=veeqo";
    window.open(url, "_blank", "noopener");
  }

  function makeButton() {
    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.className = "vq-pkg-btn";
    btn.innerHTML =
      '<span class="vq-pkg-btn__icon">📦</span>' +
      '<span class="vq-pkg-btn__label">Packaging Marketplace</span>';
    btn.addEventListener("click", function () {
      var store = (window.chrome && chrome.storage && chrome.storage.sync);
      if (store) {
        chrome.storage.sync.get(DEFAULTS, function (cfg) { openStorefront(cfg); });
      } else {
        openStorefront(DEFAULTS);
      }
    });
    return btn;
  }

  function inject() {
    if (document.getElementById(BTN_ID)) return true;
    var selectors = ["header nav", "header .navbar", 'header [role="navigation"]', "header", ".app-header", ".topbar", "nav.navbar"];
    for (var i = 0; i < selectors.length; i++) {
      var host = document.querySelector(selectors[i]);
      if (host) {
        var btn = makeButton();
        btn.classList.add("vq-pkg-btn--inline");
        host.appendChild(btn);
        return true;
      }
    }
    var floated = makeButton();
    floated.classList.add("vq-pkg-btn--float");
    document.body.appendChild(floated);
    return true;
  }

  inject();
  var observer = new MutationObserver(function () {
    if (!document.getElementById(BTN_ID)) inject();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
