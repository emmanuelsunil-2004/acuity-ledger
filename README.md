# Acuity Ledger

A Windows desktop application for commodity (scrap metal) trading companies that need to know what each deal actually earns after freight, insurance, duties, inspection and commission.

Built with Electron, vanilla JavaScript and Chart.js. Data persists locally in `localStorage`; no backend required.

## The problem

A trader quotes in one currency, buys in a second, ships under an incoterm that shifts cost responsibility, and pays a commission on top. The invoice price says nothing about whether the deal made money. Acuity Ledger models that full chain per deal.

## What it calculates

    gross P&L     = (sell price - buy price) x quantity
    net P&L       = gross P&L - landed costs - commission
    true cost/MT  = (buy cost + landed costs + commission) / quantity
    margin %      = net P&L / revenue

Landed costs = freight + insurance + inspection + duties + other, each entered in its own currency and converted to the base currency using live FX rates (`open.er-api.com`) with a static fallback when the API is unreachable.

## Features

- **Deals** — buy/sell legs, metal grades, incoterms, counterparties, status, notes
- **Dashboard** — open deals, tonnage, net P&L, average margin, cumulative P&L trend, P&L by grade
- **Reports** — monthly P&L, grade breakdown, period comparison, combined monthly CSV export
- **Accounting** — chart of accounts, transactions, payroll, bank accounts, consolidated operating result
- **Data** — CSV export per view, full JSON backup and restore
- **UX** — bento-grid layout, dark/light theme, KPI count-up, filterable sortable tables

## Run it

    npm install
    npm start

## Build a Windows installer

    npm run dist

The build pipeline signs the output with a local certificate if one is configured (`sign-build.ps1`, `sign-dist.ps1`). The signing key is deliberately **not** in this repository.

## Notes

- Data is stored in `localStorage` under `acuity_ledger_state`
- GPU compositing is disabled in `main.js` after `backdrop-filter` blur crashed rendering on low-end GPUs
- Legacy personal-finance data is migrated away automatically on first run of the trading build

## Built with AI assistance

Architecture, data model, calculation logic, testing and release process: **Emmanuel Sunil**. Implementation was developed with AI coding assistants (Claude, Cursor), then reviewed, tested and iterated against real use.

---

Emmanuel Sunil · emmanuelsunil959@gmail.com · [github.com/emmanuelsunil-2004](https://github.com/emmanuelsunil-2004)
