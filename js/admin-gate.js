/* admin-gate.js — DEMO admin gate for the Finance Dashboard.
 *
 * SECURITY NOTICE (read this):
 * This is a CLIENT-SIDE DETERRENT, NOT real authentication. The site is a
 * static GitHub Pages deployment with no backend, so there is no server to
 * enforce access. Anyone who opens DevTools, views source, or reads the public
 * repo can bypass this. It keeps casual/unauthorized sellers out of a demo; it
 * does NOT protect real financial data. For real protection, host the dashboard
 * behind server-side auth (Netlify/Cloudflare Access, or a backend that checks
 * Veeqo admin SSO) — see project README.
 *
 * Behaviour:
 *  - On load, hides the dashboard and shows a Veeqo-branded passcode overlay.
 *  - Correct passcode sets a sessionStorage flag and reveals the dashboard.
 *  - The flag lasts for the browser session (cleared when the tab/browser
 *    closes) or until "Sign out" is clicked.
 */
(function () {
  "use strict";

  // Session flag key. Value is a simple marker, not a credential.
  var SESSION_KEY = "vq_admin_authed";

  /* Demo passcode. Kept out of an obvious inline comment, but note: on a static
   * site this is still discoverable in the shipped JS. Do not reuse a real
   * password here. Change via this constant. */
  var DEMO_PASSCODE = "veeqo-admin-2026";

  function isAuthed() {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; }
    catch (e) { return false; }
  }

  function setAuthed() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
  }

  function clearAuthed() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function buildGate() {
    var overlay = document.createElement("div");
    overlay.id = "vq-admin-gate";
    overlay.className = "vq-gate";
    overlay.innerHTML =
      '<div class="vq-gate__card" role="dialog" aria-modal="true" aria-labelledby="vq-gate-title">' +
        '<div class="vq-gate__brand">' +
          '<span class="vq-logo__mark">V</span>' +
          '<span>Veeqo <span class="vq-logo__sub">Admin</span></span>' +
        '</div>' +
        '<h1 id="vq-gate-title" class="vq-gate__title">Finance Dashboard</h1>' +
        '<p class="vq-gate__sub">Restricted to authorized Veeqo admins. Enter your admin passcode to continue.</p>' +
        '<form id="vq-gate-form" class="vq-gate__form" autocomplete="off">' +
          '<label class="vq-gate__label" for="vq-gate-pass">Admin passcode</label>' +
          '<input class="vq-gate__input" id="vq-gate-pass" type="password" ' +
            'placeholder="Enter passcode" autocomplete="current-password" />' +
          '<button class="vq-btn vq-gate__btn" id="vq-gate-submit" type="submit">Unlock dashboard</button>' +
          '<div class="vq-gate__error" id="vq-gate-error" aria-live="polite"></div>' +
        '</form>' +
        '<p class="vq-gate__note">Demo access gate. Not a substitute for server-side authentication.</p>' +
      '</div>';
    return overlay;
  }

  function showGate() {
    if (document.getElementById("vq-admin-gate")) return;

    // Hide the real page content while locked.
    document.body.classList.add("vq-locked");

    var overlay = buildGate();
    document.body.appendChild(overlay);

    var form = overlay.querySelector("#vq-gate-form");
    var input = overlay.querySelector("#vq-gate-pass");
    var error = overlay.querySelector("#vq-gate-error");

    input.focus();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = (input.value || "").trim();
      if (val === DEMO_PASSCODE) {
        setAuthed();
        unlock();
      } else {
        error.textContent = "Incorrect passcode. Access denied.";
        input.value = "";
        input.focus();
      }
    });
  }

  function unlock() {
    document.body.classList.remove("vq-locked");
    var overlay = document.getElementById("vq-admin-gate");
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    injectSignOut();
  }

  /* Adds a small "Sign out" control into the header so an admin can lock the
   * dashboard again without closing the tab. */
  function injectSignOut() {
    if (document.getElementById("vq-admin-signout")) return;
    var nav = document.querySelector(".vq-nav");
    if (!nav) return;
    var btn = document.createElement("a");
    btn.id = "vq-admin-signout";
    btn.href = "#";
    btn.textContent = "Sign out";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      clearAuthed();
      location.reload();
    });
    nav.appendChild(btn);
  }

  // Run as early as possible.
  function init() {
    if (isAuthed()) {
      injectSignOut();
    } else {
      showGate();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
