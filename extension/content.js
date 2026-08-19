/* content.js — injects the "Packaging Marketplace" button into the Veeqo
 * header. Clicking it link-outs to the storefront carrying a Veeqo attribution
 * token (?ref=<token>&source=veeqo), which the storefront captures (P4).
 *
 * The storefront URL + a seller identifier are configurable from the popup and
 * stored in chrome.storage. Defaults point at the GitHub Pages deployment.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    storefrontUrl: "https://shaqbus.github.io/IvanThinkBig/",
    sellerId: "veeqo-seller"
  };

  var BTN_ID = "vq-pkg-marketplace-btn";

  function buildToken(sellerId) {
    // Opaque-ish attribution token: seller + timestamp + random nonce.
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

  /* Preferred target: the Veeqo primary top navbar (a <ul> tagged
   * data-pensieve-feature="top-navbar"). We append a real nav <li> at the end
   * (after Settings / Export Codes) so the button sits inline in the dark top
   * bar as a first-class nav item — NOT on the order-view filter-tab row.
   *
   * Veeqo is built with styled-components, so class names are hashed and change
   * between builds. We copy the nav-item classes off an existing <li> at
   * runtime instead of hard-coding them, then fall back to stable structural
   * hooks, then finally a floating button. */
  function injectIntoTopNav() {
    var nav = document.querySelector('ul[data-pensieve-feature="top-navbar"]');
    if (!nav) return false;

    var li = document.createElement("li");
    // Mirror the styling of a sibling nav <li> so spacing/height match.
    var sampleLi = nav.querySelector("li");
    if (sampleLi && sampleLi.className) li.className = sampleLi.className;

    var btn = makeButton();
    btn.classList.add("vq-pkg-btn--navitem");
    li.appendChild(btn);
    nav.appendChild(li);
    return true;
  }

  /* Try the top navbar first; then a couple of stable structural hooks; then a
   * fixed floating button pinned to the top-right so the overlay always
   * appears even if the header markup changes. The old generic "header"/"nav"
   * selectors were removed because they matched the order-view filter row and
   * caused the button to overlap the Ready-To-Ship / Shipped tabs. */
  function inject() {
    if (document.getElementById(BTN_ID)) return true;

    // 1) Preferred: real nav item in the Veeqo top navbar.
    if (injectIntoTopNav()) return true;

    // 2) Structural fallbacks that are still part of the top navbar region,
    //    never the filter-tab strip.
    var fallbackHosts = [
      '[data-pensieve-feature="top-navbar"]',
      'nav[aria-label="Primary"]'
    ];
    for (var i = 0; i < fallbackHosts.length; i++) {
      var host = document.querySelector(fallbackHosts[i]);
      if (host) {
        var b = makeButton();
        b.classList.add("vq-pkg-btn--inline");
        host.appendChild(b);
        return true;
      }
    }

    // 3) Last resort: floating button pinned to the top-right corner (kept
    //    clear of the filter row).
    var floated = makeButton();
    floated.classList.add("vq-pkg-btn--float");
    document.body.appendChild(floated);
    return true;
  }

  // Veeqo is a single-page app; re-inject on DOM churn.
  inject();
  var observer = new MutationObserver(function () {
    if (!document.getElementById(BTN_ID)) inject();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
