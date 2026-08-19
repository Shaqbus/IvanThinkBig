# Veeqo Packaging Marketplace

A concept build of the **Veeqo Packaging Marketplace** — a standalone storefront
that link-outs from Veeqo and sells packaging materials (boxes, mailers, tape,
labels, void fill) sourced from and fulfilled by an external supplier. Veeqo holds
no inventory; it runs the storefront, processes checkout, and earns a configurable
commission on every order.

Derived directly from the approved **Requirements** and **Design** documents in
[`docs/`](docs/).

**Live site:** https://shaqbus.github.io/IvanThinkBig/

## Two pieces

| Piece | What it is | Where it runs |
|-------|-----------|---------------|
| **Storefront (repo root)** | The web page: catalog, cart, checkout, order confirmation, and a finance/revenue dashboard. Served by GitHub Pages. | Browser (static hosting) |
| **`extension/`** | A Chrome extension (Manifest V3) that injects a **Packaging Marketplace** button into the Veeqo app header. Clicking it link-outs to the storefront carrying a Veeqo attribution token. | Chrome, on `*.veeqo.com` |

The extension is the "Veeqo link-out with attribution token"; the site is the
"Storefront Web App." Together they realize the design's attribution flow.

## What's real vs. simulated

Everything is client-side, so it deploys to GitHub Pages with no backend. The
concept logic is genuine; the external systems are mocked:

- **Real:** attribution capture (P4), cart/order math (P7), commission computation
  and the split (P1, P2, P3), idempotent revenue recording (P5), order status
  transitions, refunds and revenue reversal (P9), revenue reporting with
  reconciliation (P11).
- **Simulated:** the payment provider (a mock PSP reference, ~8% random decline),
  the supplier fulfillment hand-off (~5% random failure to show the retry path),
  and the catalog "sync" (a static `data/products.json`).

Orders and revenue records persist in the browser's `localStorage`, standing in
for the operational datastore.

## Project structure

The storefront lives at the **repo root** so GitHub Pages serves it directly.

```
IvanThinkBig/
├── index.html            # catalog + cart + checkout
├── confirmation.html     # order confirmation (order id + supplier order id)
├── dashboard.html        # finance / revenue dashboard
├── css/styles.css        # Veeqo-styled design system
├── js/
│   ├── attribution.js    # Veeqo link-out token capture (Req 1 / P4)
│   ├── catalog.js         # catalog reads + cart pricing validation (Req 3, 4)
│   ├── commission.js      # commission math + reconciliation (Req 7, 8; P1–P3, P5, P9)
│   ├── cart.js            # cart + subtotal/order-value math (P7)
│   ├── order.js           # order lifecycle + place-order orchestration (Req 5, 6, 9, 14)
│   ├── storefront.js      # shop page wiring
│   └── dashboard.js       # dashboard wiring
├── data/products.json    # sample supplier catalog
├── extension/            # Chrome MV3 overlay
│   ├── manifest.json
│   ├── content.js
│   ├── overlay.css
│   ├── popup.html / popup.js
│   └── icons/
├── docs/                 # source Requirements + Design (JSON)
└── verify.js             # headless property tests (run: node verify.js)
```

## Run the site locally

The storefront reads `data/products.json` with `fetch()`, so it must be served
over HTTP — opening `index.html` from the file system will not load the catalog.

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000/>. Try the flow:

1. Add products to the cart and check out (payment is simulated).
2. Land on the confirmation page with your order id + supplier order id.
3. Open **Finance Dashboard** → click **Seed demo data** to populate revenue,
   watch the reconciliation banner, and try a **Refund** to see revenue reverse.

To simulate arriving from Veeqo, add an attribution token to the URL:
`http://localhost:8000/?ref=veeqo-abc123&source=veeqo` — the header badge switches
to "Referred by Veeqo" and orders are attributed to `VEEQO`.

## Load the Chrome extension

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open the extension's popup and set the **Storefront URL** (defaults to the
   GitHub Pages URL above).
5. Visit `https://app.veeqo.com` — a teal **Packaging Marketplace** button appears
   in the header. Clicking it opens the storefront with a fresh Veeqo attribution
   token.

## Enabling GitHub Pages

Repo **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` /
`/ (root)` → **Save**. The site publishes at
`https://shaqbus.github.io/IvanThinkBig/`.

## Traceability to the design

| Requirement / Property | Where |
|------------------------|-------|
| Req 1 / P4 — attribution capture | `js/attribution.js` |
| Req 3, 4 — catalog reads, pricing validation | `js/catalog.js` |
| Req 5, 14 — order creation + orchestration | `js/order.js` |
| Req 6 — payment (PSP ref only) | `js/order.js` (`authorizePayment`) |
| Req 7, 8 / P1, P2, P3, P5 — commission + revenue | `js/commission.js` |
| Req 9 — supplier fulfillment hand-off | `js/order.js` (`submitFulfillment`) |
| Req 10 / P9 — refunds + reversal | `js/order.js`, `js/dashboard.js` |
| Req 11 — revenue reporting + reconciliation | `js/dashboard.js` |
| P7 — subtotal / order-value integrity | `js/cart.js` |
| P8 — inactive products unpurchasable | `js/catalog.js`, `js/order.js` |

## Status

Concept demo. To become a production system it needs a real backend (payment
provider, supplier integration, a datastore, server-side commission recording) —
GitHub Pages would then host only the storefront front end.
