# Acuity Ledger — Project Context

## App
Commodity scrap metal trading P&L tracker (Electron desktop, Windows).
Multi-currency, landing cost calculator, deal-level P&L, counterparties.

## Tech
- Electron (main.js)
- Vanilla JS (app.js)
- Chart.js CDN (loaded async)
- localStorage persistence
- Live exchange rates from open.er-api.com (5s timeout, static fallback)
- Font Awesome CDN for icons
- Dark/light theme via CSS class (`dark-mode`)

## Key Files
- `index.html` — full UI (sidebar, dashboard, trades, reports, settings, modal)
- `app.js` — core logic, render, P&L calc, modal CRUD, export, settings
- `style.css` — design system (glassmorphism → solid dark since blur crashed GPU)
- `main.js` — Electron entry, GPU acceleration disabled
- `package.json` — scripts: `npm start`, `npm run build`

## What's Done
- Data model: trades (buy/sell legs, grades, counterparties, incoterms, commission)
- Dashboard: KPIs (open deals, MT volume, net P&L, avg margin), cumulative P&L trend chart, P&L by grade doughnut
- Trades: sortable table, filters (grade, status, date range), search, CSV export, bulk clear
- Trade modal: buy leg (price, currency, incoterm, supplier), sell leg (price, currency, incoterm, buyer), qty, commission, status, notes
- Landing Cost Calculator per trade: freight, insurance, inspection, duties, other (each with own currency)
- Gross P&L → landing costs → commission → net P&L with true cost/MT and margin %
- Reports: closed trades count, total volume, total P&L, monthly bar chart, grade breakdown, monthly summary, period comparison
- Settings: business name, base currency (live exchange rates), grade management, JSON backup/restore, reset
- Migration: auto-clears old personal-finance localStorage data (has `categories` without `grades`)
- Error handling: window.onerror red banner, unhandledrejection handler, try-catch on all major functions, Chart.js existence guard
- GPU crash fixes: removed all `backdrop-filter: blur()` and `filter: blur()` from CSS, disabled hardware acceleration in Electron

### Menu Bar Removed (Added June 17 2026)
- Removed native Electron menu bar (File, Edit, View, Window, Help) by setting `autoHideMenuBar: true` and `menu: null` in `main.js:34-35`
- App has no use for the default menu items; keyboard shortcuts (Ctrl+C, etc.) still work

### Accounting Module (Full 5 Phases — Added June 2026)
- **Chart of Accounts**: 11 default accounts (revenue, expense, asset, liability, equity), CRUD modal, type badges, running balance per account
- **Transactions**: Record expenses/revenue/salary/transfer against accounts, filter by account/type/date, CSV export, vendor & reference tracking
- **Employees**: Employee directory with name, role, salary, pay frequency, contact info; linked to salary transactions
- **Bank Accounts**: Card-based UI, opening balance, auto-computed running balance from linked transactions
- **Consolidated Reports**: Accounting Summary tab showing expenses, payroll, trading revenue, net operating result, expense breakdown by account with progress bars
- **Dashboard Accounting KPIs**: Total Expenses, Payroll, Trading P&L, Net Result for the selected period
- **Sidebar**: New "Accounting" section group with nav items for Accounts, Transactions, Employees, Bank Accounts; section dividers and labels

### Code Signing (Self-Signed — Added June 15 2026)
- **Self-signed certificate** created via `New-SelfSignedCertificate -Type CodeSigning`
- Installed to **LocalMachine\Root** (Trusted Root) so Windows trusts it locally
- **PKCS#12 backup**: stored outside the repository (not committed — contains the private key)
- `sign-build.ps1` — signs a given EXE using the cert (by thumbprint lookup)
- `sign-dist.ps1` — signs the latest NSIS installer from `dist-installer\`
- `npm run pack` auto-signs the portable EXE after building
- `npm run dist` auto-signs the installer after building
- **Limitation**: Self-signed certs are blocked by **Smart App Control**. User must disable SAC or add an exclusion for the EXE.
- If cert thumbprint ever changes, update `sign-build.ps1` and the `pack` script.

## What's Known to Be Blocked / Not Working
- (none currently)

## Next Steps / Potential Enhancements
- Any additional features, bugs, or polish the user wants

## Last Session (June 26 2026)
- **Reports bento grid**: Restructured Reports view from stacked full-width sections into a 4-column bento grid with `grid-template-areas` (chart 3 cols + grade 1 col tall, CMR full-width, period comparison + accounting trends side by side, accounting summary full-width). New CSS classes: `.bento-reports`, `.bento-rpt-*` area classes, colored accent bars per card. Responsive at 1024px/768px. Removed old nested grid classes (`.bento-reports-charts`, `.bento-reports-side-by-side`).
- **Monthly combined CSV export**: Added Export button on Combined Monthly Report card that downloads a CSV of the selected month including trading P&L, volume, expenses, payroll, net result, margin, grade breakdown, and expense-by-account breakdown. New function `exportMonthlyReportCSV()` in `app.js`, new button `#btnExportMonthlyCSV` in `index.html`.
- **Number overflow fix**: Added `overflow-wrap: break-word` / `word-break: break-word` to `.bento-kpi-value`, `.report-kpi-value`, `.summary-value`, and `.bento-pnlwide .bento-kpi-value` so long currency amounts wrap to next line instead of clipping.
- **Installer rebuilt + signed**: `npm run dist` rebuilt and signed `Acuity Ledger Setup 1.0.0.exe` with all above changes.

## Last Session (June 24 2026)
- **Bento Grid UI**: Replaced all old `.card`/`.kpi-grid`/`.dashboard-charts-grid` layouts with a CSS bento grid system across all 8 views
  - Dashboard uses `grid-template-areas` with asymmetric card spans (Net P&L = 2 cols, chart = 3 cols × 2 rows tall, P&L by Grade = narrow right column)
  - New CSS classes: `.bento-grid`, `.bento-card`, `.bento-kpi-*`, `.bento-chart-area`, `.bento-filter-bar`, `.bento-card-header`, `.bento-card-body`
  - Hover effects: colored accent bar per card type (green for P&L, blue for chart, amber for grade), dot pattern corner, lift -4px with stronger shadow
  - Icon glows: gradient backgrounds + box-shadow glow on KPI icons
  - Responsive breakpoints at 1024px (2-col) and 768px (stacked)
  - All app.js `className` assignments updated from `kpi-value`/`kpi-trend` to `bento-kpi-value`/`bento-kpi-trend`
- **Lighter dark theme**: Lightened all dark mode background variables (was `#13131b`/`#1a1a28`/`#1e1e30`, now `#1c1c26`/`#22222e`/`#282836`) for a charcoal aesthetic; updated title bar overlay color
- **Installer rebuilt + signed**: `npm run dist` rebuilt and signed `Acuity Ledger Setup 1.0.0.exe` with bento grid changes
- **Installed**: Fresh install from new installer to `%LOCALAPPDATA%\Programs\Acuity Ledger\`

## Last Session (June 17 2026)
- **Minor bugs fixed**: Removed unused `marginPct` field from `calcTradePnL`; fixed expense breakdown in Accounting Summary and Combined Monthly Report to show salary items (purple) separately from expenses (red); added `buyOtherCost` column to CSV export; removed unused `chartLabels`/`pnlPoints`/`volPoints` from `renderReports`
- **Currency selects unified**: All currency `<select>` elements (employee salary, transactions, bank accounts, trade buy/sell, landing costs, commission) now dynamically populate from a shared `MAJOR_CURRENCIES` array in JS via `populateCurrencySelects()` — eliminates hardcoded mismatches (employee had only 3, landing costs had 4, etc.)
- **Installer rebuilt + signed**: `npm run dist` rebuilt and signed `Acuity Ledger Setup 1.0.0.exe`

## Last Session (June 17 2026) — Earlier
- **Menu bar removed**: Added `autoHideMenuBar: true` + `menu: null` to `main.js` to hide native Electron menu bar
- **Codebase analyzed**: AGENTS.md review; no known blockers; app is feature-complete
- **Sale readiness discussed**: User opted to not prep for sale now, just keep app optimized
- **Future features explored**: Trade templates, bulk actions, audit log, PDF export, inventory tracking, payment tracking, market price view, CSV import, email confirmations, multi-user sync, mobile companion, tax reports, AI features (NLP entry, insights, anomaly alerts) — none implemented yet pending user go-ahead

## Last Session (June 15 2026)
- **Fixed**: Settings form was missing a Save button — added `type="submit"` button before Danger Zone
- **Smart App Control**: Turned Off via registry (`VerifiedAndReputablePolicyState` = 0)
- **Self-signed cert**: Created, installed to `LocalMachine\Root`, exported as `acuity-ledger-cert.pfx`
- **Build pipeline**: `npm run pack` and `npm run dist` both auto-sign outputs
- **Data storage**: All data in `localStorage` (`acuity_ledger_state`), persists across restarts at `%APPDATA%\acuity-ledger\Local Storage\leveldb\`
- **Installer**: Rebuilt + signed at `dist-installer\Acuity Ledger Setup 1.0.0.exe`
- **End state**: User was reinstalling the app via the NSIS installer, then took a break

## UI Polish Applied (June 2026)
- Page transitions: `fadeInUp` animation re-triggers on every view switch (double rAF)
- Toast notifications: close button, animated progress bar, smoother entry/exit
- Status badges: CSS-class-based pills with icons (`status-badge-open` / `status-badge-closed`)
- Table row entry: staggered `rowIn` animation on trades table and recent trades
- KPI count-up: numbers animate from 0 to target with ease-out cubic on dashboard
- CSS cleanup: removed leftover `);` and `-webkit-);` artifacts from GPU crash fix
- **Bento Grid UI**: Full bento grid layout system with asymmetric card spans, accent bars, icon glows, dot patterns, charcoal dark theme
