function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const defaultAccounts = [
    { id: 'acc-revenue', code: '4000', name: 'Trading Revenue', type: 'revenue', description: 'Revenue from metal sales' },
    { id: 'acc-cogs', code: '5000', name: 'Cost of Goods Sold', type: 'expense', description: 'Direct scrap purchase costs' },
    { id: 'acc-salaries', code: '5100', name: 'Salaries Expense', type: 'expense', description: 'Employee wages and salaries' },
    { id: 'acc-rent', code: '5200', name: 'Rent & Utilities', type: 'expense', description: 'Office rent and utilities' },
    { id: 'acc-admin', code: '5300', name: 'Admin Expenses', type: 'expense', description: 'Office supplies, admin costs' },
    { id: 'acc-travel', code: '5400', name: 'Travel & Logistics', type: 'expense', description: 'Business travel and transport' },
    { id: 'acc-bank', code: '1000', name: 'Cash at Bank', type: 'asset', description: 'Main operating bank account' },
    { id: 'acc-ar', code: '1100', name: 'Accounts Receivable', type: 'asset', description: 'Money owed to the company' },
    { id: 'acc-ap', code: '2000', name: 'Accounts Payable', type: 'liability', description: 'Money the company owes' },
    { id: 'acc-equity', code: '3000', name: 'Retained Earnings', type: 'equity', description: 'Accumulated retained earnings' },
];

const state = {
    settings: {
        currency: '$',
        currencyCustom: '',
        currencyCode: '',
        currencyPosition: 'prefix',
        businessName: 'My Trading Co.'
    },
    grades: [],
    trades: [],
    accounts: [],
    transactions: [],
    employees: [],
    bankAccounts: [],
    journalEntries: []
};

const uiState = {
    activeView: 'dashboard',
    sortField: 'date',
    sortOrder: 'desc',
    filters: {
        search: '',
        grade: 'all',
        status: 'all',
        dateRange: 'all',
        startDate: '',
        endDate: '',
        txnAccount: 'all',
        txnType: 'all',
        txnDateRange: 'all',
        txnStart: '',
        txnEnd: ''
    },
    dashboardDateRange: 'this-month',
    dashboardStartDate: '',
    dashboardEndDate: '',
    ledgerAccountId: '',
    ledgerPeriod: 'all',
    ledgerStart: '',
    ledgerEnd: '',
    stmtPeriod: 'all',
    stmtStart: '',
    stmtEnd: ''
};

let balanceChartInstance = null;
let categoryChartInstance = null;
let cashFlowChartInstance = null;

let exchangeRates = { USD: 1.0, EUR: 0.92, GBP: 0.79, INR: 83.3, JPY: 156.0, ILS: 3.7 };

const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'ILS'];

function populateCurrencySelects() {
    document.querySelectorAll('.currency-select').forEach(sel => {
        const current = sel.value;
        sel.innerHTML = '';
        MAJOR_CURRENCIES.forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = code;
            sel.appendChild(opt);
        });
        if (MAJOR_CURRENCIES.includes(current)) sel.value = current;
    });
}

async function fetchExchangeRates() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error('API response not ok');
        const data = await res.json();
        if (data && data.rates) exchangeRates = data.rates;
    } catch (e) {
        console.warn('Failed to fetch exchange rates. Using fallback rates.', e);
    }
}

const defaultGrades = [
    { id: 'grade-hms12', name: 'HMS 1&2', color: '#ef4444' },
    { id: 'grade-shredded', name: 'Shredded', color: '#3b82f6' },
    { id: 'grade-pns', name: 'PNS', color: '#f59e0b' },
    { id: 'grade-copper', name: 'Copper', color: '#d97706' },
    { id: 'grade-brass', name: 'Brass', color: '#eab308' },
    { id: 'grade-aluminum', name: 'Aluminum', color: '#9ca3af' },
    { id: 'grade-ss304', name: 'Stainless Steel 304', color: '#6b7280' },
    { id: 'grade-ss430', name: 'Stainless Steel 430', color: '#4b5563' },
    { id: 'grade-other', name: 'Other', color: '#6b7280' }
];

function setSplashStatus(msg, pct) {
    const el = document.getElementById('splashStatus');
    const bar = document.getElementById('splashProgress');
    if (el) el.textContent = msg;
    if (bar && pct !== undefined) bar.style.width = Math.min(pct, 100) + '%';
}

async function initApp() {
    setSplashStatus('Loading exchange rates…', 10);
    try {
        await fetchExchangeRates();
    } catch (e) {
        console.warn('Exchange rate fetch failed, using fallback', e);
    }
    setSplashStatus('Loading data…', 30);
    const stored = localStorage.getItem('acuity_ledger_state');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.categories && !parsed.grades) {
                localStorage.removeItem('acuity_ledger_state');
                setSplashStatus('Upgrading data module…', 45);
                loadDefaults();
                setupEventListeners();
                populateGradeDropdowns();
                populateCurrencySelects();
                updateUI();
                hideSplash();
                showToast('Upgraded to Trading Module — old data cleared', 'info');
                return;
            }
            state.settings = parsed.settings || state.settings;
            state.grades = parsed.grades && parsed.grades.length ? parsed.grades : defaultGrades;
            state.trades = parsed.trades || [];
            state.accounts = parsed.accounts && parsed.accounts.length ? parsed.accounts : defaultAccounts.map(a => ({ ...a }));
            state.transactions = parsed.transactions || [];
            state.employees = parsed.employees || [];
            state.bankAccounts = parsed.bankAccounts || [];
            state.journalEntries = parsed.journalEntries || [];
            if (!state.settings.businessName) state.settings.businessName = 'My Trading Co.';
        } catch (e) {
            console.error('Failed to parse state, loading defaults.', e);
            loadDefaults();
        }
    } else {
        loadDefaults();
    }
    setSplashStatus('Building interface…', 60);
    try {
        setupEventListeners();
        populateGradeDropdowns();
        populateAccountDropdowns();
        populateCurrencySelects();
        setSplashStatus('Rendering…', 80);
        updateUI();
        setSplashStatus('Ready!', 100);
        setTimeout(hideSplash, 400);
        showToast('Acuity Ledger loaded — Trading Module', 'info');
    } catch (e) {
        console.error('Init error after data load:', e);
        const el = document.getElementById('splashStatus');
        if (el) {
            el.textContent = 'Failed to load';
            el.style.color = '#ef4444';
        }
        const bar = document.getElementById('splashProgress');
        if (bar) bar.style.background = '#ef4444';
        showToast('App failed to initialize', 'danger');
    }
}

function hideSplash() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 500);
    }
}

function loadDefaults() {
    state.settings = {
        currency: '$',
        currencyCustom: '',
        currencyCode: '',
        currencyPosition: 'prefix',
        businessName: 'My Trading Co.'
    };
    state.grades = [...defaultGrades];
    state.trades = [];
    state.accounts = defaultAccounts.map(a => ({ ...a }));
    state.transactions = [];
    state.employees = [];
    state.bankAccounts = [];
    state.journalEntries = [];
    saveState();
}

function saveState() {
    localStorage.setItem('acuity_ledger_state', JSON.stringify(state));
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'danger') icon = 'fa-triangle-exclamation';
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span class="toast-content">${message}</span>
        <button class="toast-close" onclick="(function(el){el.closest('.toast').classList.add('toast-out');setTimeout(()=>el.closest('.toast').remove(),300)})(this)"><i class="fa-solid fa-xmark"></i></button>
        <div class="toast-progress" style="width:100%"></div>
    `;
    container.appendChild(toast);
    const progress = toast.querySelector('.toast-progress');
    const duration = 3500;
    const start = performance.now();
    function tick(now) {
        const elapsed = now - start;
        const pct = Math.max(0, 1 - elapsed / duration) * 100;
        progress.style.width = pct + '%';
        if (pct > 0) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    setTimeout(() => {
        if (!toast.classList.contains('toast-out')) {
            toast.classList.add('toast-out');
        }
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function changeView(viewId) {
    uiState.activeView = viewId;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-target') === viewId);
    });
    document.querySelectorAll('.content-view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${viewId}`);
    });
    const newView = document.getElementById(`view-${viewId}`);
    if (newView) {
        newView.style.animation = 'none';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                newView.style.animation = '';
            });
        });
    }
    const title = document.getElementById('pageTitle');
    const labels = { dashboard: 'Dashboard', trades: 'Trades', accounts: 'Chart of Accounts', transactions: 'Transactions', employees: 'Employees', banks: 'Bank Accounts', journal: 'Journal Entries', ledger: 'Ledger', statements: 'Financial Statements', reports: 'Reports', settings: 'Settings' };
    title.textContent = labels[viewId] || viewId;
    updateUI();
    document.getElementById('sidebar').classList.remove('active');
}

function populateGradeDropdowns() {
    const ids = ['tradeGrade', 'filterGrade'];
    ids.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '';
        if (id === 'filterGrade') {
            const opt = document.createElement('option');
            opt.value = 'all';
            opt.textContent = 'All Grades';
            sel.appendChild(opt);
        }
        state.grades.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            sel.appendChild(opt);
        });
        if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
        else sel.selectedIndex = 0;
    });
}

function updateUI() {
    try {
        const userNameEl = document.querySelector('.user-name');
        if (userNameEl) userNameEl.textContent = state.settings.businessName || 'My Trading Co.';
        const roleEl = document.querySelector('.user-role');
        if (roleEl) roleEl.textContent = 'Commodity Trading';
        const bizEl = document.getElementById('setBusinessName');
        if (bizEl) bizEl.value = state.settings.businessName || '';
        const curEl = document.getElementById('setUserCurrency');
        if (curEl) curEl.value = state.settings.currency;
        const cusEl = document.getElementById('setUserCustomCurrency');
        if (cusEl) cusEl.value = state.settings.currencyCustom || '';
        const codeEl = document.getElementById('setUserCustomCurrencyCode');
        if (codeEl) codeEl.value = state.settings.currencyCode || '';
        const cw = document.getElementById('customCurrencyWrapper');
        if (cw) {
            if (state.settings.currency === 'custom') cw.classList.remove('hidden');
            else cw.classList.add('hidden');
        }
        const pos = state.settings.currencyPosition || 'prefix';
        const radio = document.querySelector(`input[name="currencyPosition"][value="${pos}"]`);
        if (radio) radio.checked = true;
        if (uiState.activeView === 'dashboard') renderDashboard();
        else if (uiState.activeView === 'trades') renderTradesTable();
        else if (uiState.activeView === 'accounts') renderAccounts();
        else if (uiState.activeView === 'transactions') renderTransactions();
        else if (uiState.activeView === 'employees') renderEmployees();
        else if (uiState.activeView === 'banks') renderBanks();
        else if (uiState.activeView === 'journal') renderJournal();
        else if (uiState.activeView === 'ledger') renderLedger();
        else if (uiState.activeView === 'statements') renderStatements();
        else if (uiState.activeView === 'reports') renderReports();
        else if (uiState.activeView === 'settings') renderSettings();
    } catch (e) { console.error('updateUI error:', e); throw e; }
}

function getBaseCurrencyCode() {
    if (state.settings.currency === 'custom') return state.settings.currencyCode || 'USD';
    const map = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY', '₪': 'ILS' };
    return map[state.settings.currency] || 'USD';
}

function convertToBase(amount, fromCurrency) {
    const base = getBaseCurrencyCode();
    if (fromCurrency === base) return amount;
    const rates = exchangeRates;
    const rateFrom = rates[fromCurrency] || 1.0;
    const rateBase = rates[base] || 1.0;
    const inUSD = amount / rateFrom;
    return inUSD * rateBase;
}

function animateKPI(elId, target, suffix = '', isCurrency = false, decimals = 0) {
    const el = document.getElementById(elId);
    if (!el) return;
    const startTime = performance.now();
    const duration = 800;
    el.classList.add('animating');
    function format(v) {
        if (isCurrency) return formatCurrency(v);
        if (decimals > 0) return v.toFixed(decimals) + suffix;
        return Math.round(v).toLocaleString() + suffix;
    }
    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;
        el.textContent = format(current);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = format(target);
            setTimeout(() => el.classList.remove('animating'), 600);
        }
    }
    requestAnimationFrame(step);
}

function formatCurrency(amount) {
    const formatted = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const prefix = amount < 0 ? '-' : '';
    const symbol = state.settings.currency === 'custom' ? (state.settings.currencyCustom || '') : state.settings.currency;
    const pos = state.settings.currencyPosition || 'prefix';
    if (pos === 'suffix') return `${prefix}${formatted} ${symbol}`;
    return `${prefix}${symbol}${formatted}`;
}

function formatTableDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcTradePnL(trade) {
    const buyBase = convertToBase(trade.buyPrice, trade.buyCurrency);
    const sellBase = convertToBase(trade.sellPrice, trade.sellCurrency);

    const buyOther = trade.buyOtherCost ? convertToBase(trade.buyOtherCost, trade.buyOtherCurrency || trade.buyCurrency) : 0;
    const freight = trade.freightCost ? convertToBase(trade.freightCost, trade.freightCurrency || trade.buyCurrency) : 0;
    const insurance = trade.insuranceCost ? convertToBase(trade.insuranceCost, trade.insuranceCurrency || trade.buyCurrency) : 0;
    const inspection = trade.inspectionCost ? convertToBase(trade.inspectionCost, trade.inspectionCurrency || trade.buyCurrency) : 0;
    const duties = trade.dutiesCost ? convertToBase(trade.dutiesCost, trade.dutiesCurrency || trade.buyCurrency) : 0;
    const other = trade.otherCost ? convertToBase(trade.otherCost, trade.otherCostCurrency || trade.buyCurrency) : 0;

    const totalLandingCosts = freight + insurance + inspection + duties + other + buyOther;
    const landingCostPerMT = trade.quantity > 0 ? totalLandingCosts / trade.quantity : 0;

    const grossMarginPerMT = sellBase - buyBase;
    const grossPnL = grossMarginPerMT * trade.quantity;
    const commissionBase = trade.commission ? convertToBase(trade.commission, trade.commissionCurrency || trade.buyCurrency) : 0;
    const netPnL = grossPnL - commissionBase - totalLandingCosts;
    const netMarginPerMT = trade.quantity > 0 ? netPnL / trade.quantity : 0;
    const trueCostPerMT = buyBase + landingCostPerMT;

    return { grossMarginPerMT, grossPnL, commissionBase, totalLandingCosts, landingCostPerMT, netPnL, netMarginPerMT, trueCostPerMT, buyBase, sellBase, freight, insurance, inspection, duties, other, buyOther };
}

function getPeriodBoundaries() {
    const range = uiState.dashboardDateRange || 'this-month';
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (range === 'custom') {
        const s = uiState.dashboardStartDate ? new Date(uiState.dashboardStartDate) : null;
        const e = uiState.dashboardEndDate ? new Date(uiState.dashboardEndDate) : null;
        return { start: s || new Date(0), end: e || new Date(864e13), prevStart: null, prevEnd: null };
    }
    if (range === 'all') return { start: new Date(0), end: new Date(864e13), prevStart: null, prevEnd: null };
    let start, end, prevStart, prevEnd;
    if (range === 'this-month') {
        start = new Date(y, m, 1);
        end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        prevStart = new Date(y, m - 1, 1);
        prevEnd = new Date(y, m, 0, 23, 59, 59, 999);
    } else if (range === 'last-month') {
        start = new Date(y, m - 1, 1);
        end = new Date(y, m, 0, 23, 59, 59, 999);
        prevStart = new Date(y, m - 2, 1);
        prevEnd = new Date(y, m - 1, 0, 23, 59, 59, 999);
    } else if (range === 'this-year') {
        start = new Date(y, 0, 1);
        end = new Date(y, 11, 31, 23, 59, 59, 999);
        prevStart = new Date(y - 1, 0, 1);
        prevEnd = new Date(y - 1, 11, 31, 23, 59, 59, 999);
    }
    return { start, end, prevStart, prevEnd };
}

function getPeriodLabel() {
    const labels = { 'this-month': 'this month', 'last-month': 'last month', 'this-year': 'this year', 'all': 'all time', 'custom': 'selected period' };
    return labels[uiState.dashboardDateRange] || 'selected period';
}

// ===== DASHBOARD =====
function renderDashboard() {
    try {
    document.getElementById('dashboardDateRange').value = uiState.dashboardDateRange || 'this-month';
    const ci = document.getElementById('dashboardCustomRange');
    if (uiState.dashboardDateRange === 'custom') ci.classList.remove('hidden');
    else ci.classList.add('hidden');

    const { start, end, prevStart, prevEnd } = getPeriodBoundaries();
    const hasPrev = prevStart && prevEnd;

    const closedTrades = state.trades.filter(t => t.status === 'closed');
    const allTrades = state.trades.filter(t => t.status === 'open' || t.status === 'closed');

    let curPnL = 0, curVolume = 0, curBuys = 0;
    let prevPnL = 0, prevVolume = 0;
    let openDeals = 0;

    allTrades.forEach(t => {
        const d = new Date(t.date);
        if (d >= start && d <= end) {
            curVolume += t.quantity;
            if (t.status === 'open') openDeals++;
        }
        if (hasPrev && d >= prevStart && d <= prevEnd) {
            prevVolume += t.quantity;
        }
    });

    closedTrades.forEach(t => {
        const d = new Date(t.date);
        const pnl = calcTradePnL(t);
        if (d >= start && d <= end) {
            curPnL += pnl.netPnL;
            curBuys += convertToBase(t.buyPrice * t.quantity, t.buyCurrency);
        }
        if (hasPrev && d >= prevStart && d <= prevEnd) {
            prevPnL += pnl.netPnL;
        }
    });

    const avgMargin = curBuys > 0 ? (curPnL / curBuys) * 100 : 0;

    animateKPI('valOpenDeals', openDeals);
    animateKPI('valTotalVolume', curVolume, ' MT');
    document.getElementById('valTotalPnL').className = `bento-kpi-value ${curPnL >= 0 ? 'text-success' : 'text-danger'}`;
    animateKPI('valTotalPnL', curPnL, '', true);
    document.getElementById('valAvgMargin').className = `bento-kpi-value ${avgMargin >= 0 ? 'text-success' : 'text-danger'}`;
    animateKPI('valAvgMargin', avgMargin, '%', false, 1);

    renderDashboardAccounting(start, end);

    const label = getPeriodLabel();
    if (hasPrev) {
        updateTrend('trendPnL', curPnL, prevPnL, `vs previous ${label}`, true);
        updateTrend('trendVolume', curVolume, prevVolume, `vs previous ${label}`, true);
    } else {
        document.getElementById('trendPnL').innerHTML = '<i class="fa-solid fa-minus"></i> No previous period data';
        document.getElementById('trendPnL').className = 'bento-kpi-trend neutral';
        document.getElementById('trendVolume').innerHTML = '<i class="fa-solid fa-minus"></i> No previous period data';
        document.getElementById('trendVolume').className = 'bento-kpi-trend neutral';
    }

    const pnlTrend = document.getElementById('trendTotal');
    pnlTrend.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> ${curPnL >= 0 ? '+' : ''}${formatCurrency(curPnL)} net ${label}`;
    pnlTrend.className = `bento-kpi-trend ${curPnL >= 0 ? 'text-success' : 'text-danger'}`;

    const marginTrend = document.getElementById('trendMargin');
    if (avgMargin >= 5) {
        marginTrend.innerHTML = '<i class="fa-solid fa-circle-check"></i> Healthy margin (>=5%)';
        marginTrend.className = 'bento-kpi-trend text-success';
    } else {
        marginTrend.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Below 5% target margin';
        marginTrend.className = 'bento-kpi-trend text-info';
    }

    // Recent Trades
    const sorted = [...state.trades].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 5);
    const tbody = document.getElementById('recentTradesBody');
    const empty = document.getElementById('noTradesMsg');
    tbody.innerHTML = '';
    if (recent.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        recent.forEach((t, i) => {
            const g = state.grades.find(g => g.id === t.gradeId) || { name: 'Unknown', color: '#6b7280' };
            const pnl = calcTradePnL(t);
            const tr = document.createElement('tr');
            const costBreakdown = pnl.totalLandingCosts > 0
                ? `<div style="font-size:11px;color:var(--color-text-muted);">Costs: ${formatCurrency(pnl.totalLandingCosts)}</div>`
                : '';
            tr.innerHTML = `
                <td>${formatTableDate(t.date)}</td>
                <td><span class="tx-category-badge" style="background:${g.color}15;color:${g.color};border-color:${g.color}30">${g.name}</span></td>
                <td>${t.quantity} MT</td>
                <td>${formatCurrency(convertToBase(t.buyPrice, t.buyCurrency))}/MT</td>
                <td>${formatCurrency(convertToBase(t.sellPrice, t.sellCurrency))}/MT</td>
                <td class="text-right">
                    <div class="${pnl.netPnL >= 0 ? 'text-success' : 'text-danger'}" style="font-weight:600">${formatCurrency(pnl.netPnL)}</div>
                    ${costBreakdown}
                </td>
                <td class="text-center"><span class="status-badge status-badge-${t.status}"><i class="fa-solid ${t.status === 'closed' ? 'fa-circle-check' : 'fa-clock'}"></i> ${t.status === 'closed' ? 'Closed' : 'Open'}</span></td>
                <td class="text-center">
                    <div class="action-buttons">
                        <button class="btn-icon-edit" onclick="openEditModal('${t.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon-delete" onclick="deleteTrade('${t.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tr.style.animation = `rowIn 0.3s ease-out forwards`;
            tr.style.animationDelay = `${i * 0.06}s`;
            tbody.appendChild(tr);
        });
    }
    buildDashboardCharts();
    } catch (e) { console.error('renderDashboard error:', e); throw e; }
}

function updateTrend(elId, current, past, text, isUpGood) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (past === 0) {
        el.innerHTML = '<i class="fa-solid fa-minus"></i> No baseline data';
        el.className = 'bento-kpi-trend neutral';
        return;
    }
    const pct = ((current - past) / past) * 100;
    const sign = pct >= 0 ? '+' : '';
    const arrow = pct >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    el.innerHTML = `<i class="fa-solid ${arrow}"></i> ${sign}${pct.toFixed(0)}% ${text}`;
    el.className = `bento-kpi-trend ${isUpGood ? (pct >= 0 ? 'text-success' : 'text-danger') : (pct >= 0 ? 'text-danger' : 'text-success')}`;
}

function buildDashboardCharts() {
    try {
    if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded'); return; }
    const ctx = document.getElementById('balanceChart');
    if (!ctx) return;
    const sorted = [...state.trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cumulative = 0;
    const dateBalances = {};
    sorted.forEach(t => {
        if (t.status === 'closed') {
            const pnl = calcTradePnL(t);
            cumulative += pnl.netPnL;
            dateBalances[t.date] = cumulative;
        }
    });
    const timeframe = document.getElementById('chartTimeframe').value;
    const now = new Date();
    let cutoff = new Date();
    if (timeframe === '6m') cutoff.setMonth(now.getMonth() - 6);
    else if (timeframe === '12m') cutoff.setFullYear(now.getFullYear() - 1);
    else cutoff = new Date('1970-01-01');
    const labels = [], data = [];
    const dates = Object.keys(dateBalances).filter(d => new Date(d) >= cutoff).sort();
    if (dates.length === 0) {
        labels.push(now.toISOString().split('T')[0]);
        data.push(0);
    } else {
        dates.forEach(d => { labels.push(formatTableDate(d)); data.push(dateBalances[d]); });
    }
    if (balanceChartInstance) balanceChartInstance.destroy();
    const isDark = document.body.classList.contains('dark-mode');
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? '#9ca3af' : '#475569';
    balanceChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Cumulative P&L',
                data,
                borderColor: '#10b981',
                borderWidth: 3,
                pointBackgroundColor: '#10b981',
                pointHoverRadius: 6,
                fill: true,
                backgroundColor: (c) => {
                    const g = c.chart.ctx.createLinearGradient(0, 0, 0, 300);
                    g.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
                    g.addColorStop(1, 'rgba(16, 185, 129, 0)');
                    return g;
                },
                tension: 0.35
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#141821' : '#fff',
                    titleColor: isDark ? '#fff' : '#0f172a',
                    bodyColor: isDark ? '#f3f4f6' : '#475569',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    borderWidth: 1, displayColors: false,
                    callbacks: { label: (ctx) => `P&L: ${formatCurrency(ctx.parsed.y)}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 11 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 11 }, callback: (val) => formatCurrency(val) } }
            }
        }
    });

    // Grade P&L Distribution
    const catCtx = document.getElementById('categoryChart');
    if (!catCtx) return;
    const gradePnL = {};
    let totalPnL = 0;
    state.trades.forEach(t => {
        if (t.status === 'closed') {
            const pnl = calcTradePnL(t);
            gradePnL[t.gradeId] = (gradePnL[t.gradeId] || 0) + pnl.netPnL;
            totalPnL += pnl.netPnL;
        }
    });
    const chartLabels = [], chartData = [], chartColors = [];
    Object.keys(gradePnL).forEach(gId => {
        const g = state.grades.find(g => g.id === gId) || { name: 'Unknown', color: '#6b7280' };
        chartLabels.push(g.name);
        chartData.push(gradePnL[gId]);
        chartColors.push(g.color);
    });
    const overlay = document.getElementById('noChartData');
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (totalPnL === 0) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
        categoryChartInstance = new Chart(catCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: chartColors,
                    borderWidth: isDark ? 2 : 1,
                    borderColor: isDark ? '#141821' : '#fff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 11 }, padding: 14, usePointStyle: true } },
                    tooltip: {
                        backgroundColor: isDark ? '#141821' : '#fff',
                        titleColor: isDark ? '#fff' : '#0f172a',
                        bodyColor: isDark ? '#f3f4f6' : '#475569',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        borderWidth: 1,
                        callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed)}` }
                    }
                },
                cutout: '65%'
            }
        });
    }
    } catch (e) { console.error('buildDashboardCharts error:', e); }
}

function renderDashboardAccounting(start, end) {
    try {
    let totalExpenses = 0, totalPayroll = 0;
    state.transactions.forEach(t => {
        const d = new Date(t.date);
        if (d < start || d > end) return;
        const amt = convertToBase(t.amount, t.currency);
        if (t.type === 'expense') totalExpenses += amt;
        else if (t.type === 'salary') totalPayroll += amt;
    });

    let tradingPnL = 0;
    state.trades.forEach(t => {
        if (t.status === 'closed') {
            const d = new Date(t.date);
            if (d >= start && d <= end) {
                tradingPnL += calcTradePnL(t).netPnL;
            }
        }
    });

    const netResult = tradingPnL - totalExpenses - totalPayroll;

    document.getElementById('valTotalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('valTotalExpenses').className = `bento-kpi-value ${totalExpenses > 0 ? 'text-danger' : ''}`;
    document.getElementById('valDashboardPayroll').textContent = formatCurrency(totalPayroll);
    document.getElementById('valDashboardPayroll').className = `bento-kpi-value ${totalPayroll > 0 ? 'text-info' : ''}`;
    document.getElementById('valDashboardTradingPnL').textContent = formatCurrency(tradingPnL);
    document.getElementById('valDashboardTradingPnL').className = `bento-kpi-value ${tradingPnL >= 0 ? 'text-success' : 'text-danger'}`;
    document.getElementById('valNetResult').textContent = formatCurrency(netResult);
    document.getElementById('valNetResult').className = `bento-kpi-value ${netResult >= 0 ? 'text-success' : 'text-danger'}`;
    } catch (e) { console.error('renderDashboardAccounting error:', e); }
}

// ===== TRADES VIEW =====
function getFilteredTrades() {
    return state.trades.filter(t => {
        if (uiState.filters.search) {
            const q = uiState.filters.search.toLowerCase();
            const supplierMatch = t.supplier.toLowerCase().includes(q);
            const buyerMatch = t.buyer.toLowerCase().includes(q);
            const notesMatch = t.notes ? t.notes.toLowerCase().includes(q) : false;
            const grade = state.grades.find(g => g.id === t.gradeId);
            const gradeMatch = grade ? grade.name.toLowerCase().includes(q) : false;
            if (!supplierMatch && !buyerMatch && !notesMatch && !gradeMatch) return false;
        }
        if (uiState.filters.grade !== 'all' && t.gradeId !== uiState.filters.grade) return false;
        if (uiState.filters.status !== 'all' && t.status !== uiState.filters.status) return false;
        if (uiState.filters.dateRange !== 'all') {
            const d = new Date(t.date);
            const now = new Date();
            if (uiState.filters.dateRange === 'this-month') {
                if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
            } else if (uiState.filters.dateRange === 'last-month') {
                const lm = new Date(); lm.setMonth(now.getMonth() - 1);
                if (d.getMonth() !== lm.getMonth() || d.getFullYear() !== lm.getFullYear()) return false;
            } else if (uiState.filters.dateRange === 'this-year') {
                if (d.getFullYear() !== now.getFullYear()) return false;
            } else if (uiState.filters.dateRange === 'custom') {
                if (uiState.filters.startDate && new Date(t.date) < new Date(uiState.filters.startDate)) return false;
                if (uiState.filters.endDate && new Date(t.date) > new Date(uiState.filters.endDate)) return false;
            }
        }
        return true;
    });
}

function renderTradesTable() {
    try {
    const tbody = document.getElementById('tradesTableBody');
    const empty = document.getElementById('tradesEmptyMsg');
    tbody.innerHTML = '';
    let filtered = getFilteredTrades();
    filtered.sort((a, b) => {
        let va, vb;
        if (uiState.sortField === 'date') { va = new Date(a.date); vb = new Date(b.date); }
        else if (uiState.sortField === 'grade') {
            const ga = state.grades.find(g => g.id === a.gradeId)?.name || '';
            const gb = state.grades.find(g => g.id === b.gradeId)?.name || '';
            va = ga.toLowerCase(); vb = gb.toLowerCase();
        } else if (uiState.sortField === 'quantity') { va = a.quantity; vb = b.quantity; }
        else if (uiState.sortField === 'pnl') { va = calcTradePnL(a).netPnL; vb = calcTradePnL(b).netPnL; }
        else if (uiState.sortField === 'supplier') { va = a.supplier.toLowerCase(); vb = b.supplier.toLowerCase(); }
        else if (uiState.sortField === 'buyer') { va = a.buyer.toLowerCase(); vb = b.buyer.toLowerCase(); }
        if (va < vb) return uiState.sortOrder === 'asc' ? -1 : 1;
        if (va > vb) return uiState.sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    if (filtered.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        filtered.forEach((t, i) => {
            const g = state.grades.find(g => g.id === t.gradeId) || { name: 'Unknown', color: '#6b7280' };
            const pnl = calcTradePnL(t);
            const tr = document.createElement('tr');
            const costBreakdown = pnl.totalLandingCosts > 0
                ? `<div style="font-size:11px;color:var(--color-text-muted);">Costs: ${formatCurrency(pnl.totalLandingCosts)} (${formatCurrency(pnl.landingCostPerMT)}/MT)</div>`
                : '';
            tr.innerHTML = `
                <td>${formatTableDate(t.date)}</td>
                <td><span class="tx-category-badge" style="background:${g.color}15;color:${g.color};border-color:${g.color}30">${g.name}</span></td>
                <td>${t.quantity} MT</td>
                <td>${t.supplier}</td>
                <td>${t.buyer}</td>
                <td class="text-right">${formatCurrency(convertToBase(t.buyPrice, t.buyCurrency))}</td>
                <td class="text-right">${formatCurrency(convertToBase(t.sellPrice, t.sellCurrency))}</td>
                <td class="text-right">
                    <div class="${pnl.netPnL >= 0 ? 'text-success' : 'text-danger'}" style="font-weight:600">${formatCurrency(pnl.netPnL)}</div>
                    ${costBreakdown}
                </td>
                <td class="text-center"><span class="status-badge status-badge-${t.status}"><i class="fa-solid ${t.status === 'closed' ? 'fa-circle-check' : 'fa-clock'}"></i> ${t.status === 'closed' ? 'Closed' : 'Open'}</span></td>
                <td class="text-center">
                    <div class="action-buttons">
                        <button class="btn-icon-edit" onclick="openEditModal('${t.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon-delete" onclick="deleteTrade('${t.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tr.style.animation = `rowIn 0.3s ease-out forwards`;
            tr.style.animationDelay = `${i * 0.04}s`;
            tbody.appendChild(tr);
        });
    }
    document.querySelectorAll('.trades-table th.sortable').forEach(th => {
        const field = th.getAttribute('data-sort');
        const icon = th.querySelector('i');
        if (field === uiState.sortField) {
            icon.className = uiState.sortOrder === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            icon.style.color = 'var(--color-primary)';
        } else {
            icon.className = 'fa-solid fa-sort';
            icon.style.color = 'var(--color-text-muted)';
        }
    });
    } catch (e) { console.error('renderTradesTable error:', e); throw e; }
}

// ===== REPORTS =====
function renderReports() {
    try {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    const monthly = {};
    state.trades.forEach(t => {
        if (t.status === 'closed') {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[key]) monthly[key] = { pnl: 0, volume: 0, label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) };
            const pnl = calcTradePnL(t);
            monthly[key].pnl += pnl.netPnL;
            monthly[key].volume += t.quantity;
        }
    });
    const months = Object.keys(monthly).sort();
    let totalPnL = 0, totalVol = 0;
    months.forEach(m => {
        totalPnL += monthly[m].pnl;
        totalVol += monthly[m].volume;
    });
    document.getElementById('valTotalTrades').textContent = state.trades.filter(t => t.status === 'closed').length;
    document.getElementById('valTotalVolumeReport').textContent = totalVol.toLocaleString() + ' MT';
    document.getElementById('valTotalPnLReport').textContent = formatCurrency(totalPnL);
    document.getElementById('valTotalPnLReport').className = `report-kpi-value ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`;
    const avgMarginEl = document.getElementById('valAvgMarginReport');
    if (avgMarginEl) avgMarginEl.textContent = totalVol > 0 ? formatCurrency(totalPnL / totalVol) + '/MT' : formatCurrency(0);

    renderReportChart();

    // P&L by Grade
    const gradePnL = {};
    let totalExp = 0;
    state.trades.forEach(t => {
        if (t.status === 'closed') {
            const pnl = calcTradePnL(t);
            gradePnL[t.gradeId] = (gradePnL[t.gradeId] || 0) + pnl.netPnL;
            totalExp += pnl.netPnL;
        }
    });
    const list = document.getElementById('reportsCategoryList');
    const noMsg = document.getElementById('reportsNoCategoryMsg');
    list.innerHTML = '';
    if (totalExp === 0) {
        noMsg.classList.remove('hidden');
    } else {
        noMsg.classList.add('hidden');
        const sorted = Object.keys(gradePnL).sort((a, b) => gradePnL[b] - gradePnL[a]);
        sorted.forEach(gId => {
            const amt = gradePnL[gId];
            const pct = totalExp !== 0 ? Math.abs((amt / totalExp) * 100).toFixed(1) : 0;
            const g = state.grades.find(g => g.id === gId) || { name: 'Unknown', color: '#6b7280', icon: 'fa-solid fa-tag' };
            const row = document.createElement('div');
            row.className = 'category-row-spend';
            row.innerHTML = `
                <div class="category-row-header">
                    <div class="category-row-title">
                        <div class="category-row-badge" style="background:${g.color}20;color:${g.color}"><i class="${g.icon}"></i></div>
                        <span>${g.name}</span>
                    </div>
                    <div class="category-row-amount"><span class="${amt >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(amt)}</span> (${pct}%)</div>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="background:${g.color};width:${pct}%"></div></div>
            `;
            list.appendChild(row);
        });
    }

    // Monthly Summary, Accounting Trends & Period Comparison
    populateMonthSelectors();
    renderCombinedMonthlyReport();
    renderAccountingTrendChart();
    renderPeriodComparison();
    renderAccountingSummary();
    } catch (e) { console.error('renderReports error:', e); throw e; }
}

function renderReportChart() {
    try {
    const sel = document.getElementById('reportChartType');
    const type = sel ? sel.value : 'pnl';
    const titleEl = document.getElementById('reportChartTitle');
    const titles = { pnl: 'Monthly P&L', 'pnl-vs-expenses': 'P&L vs Expenses', margin: 'Margin Trend', cumulative: 'Cumulative P&L', volume: 'Volume' };
    if (titleEl) titleEl.textContent = titles[type] || 'Monthly P&L';

    const monthly = {};
    state.trades.forEach(t => {
        if (t.status === 'closed') {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[key]) monthly[key] = { pnl: 0, volume: 0, buys: 0, label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) };
            const p = calcTradePnL(t);
            monthly[key].pnl += p.netPnL;
            monthly[key].volume += t.quantity;
            monthly[key].buys += convertToBase(t.buyPrice * t.quantity, t.buyCurrency);
        }
    });

    const txnMonthly = {};
    state.transactions.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!txnMonthly[key]) txnMonthly[key] = { expenses: 0, payroll: 0 };
        const amt = convertToBase(t.amount, t.currency);
        if (t.type === 'expense') txnMonthly[key].expenses += amt;
        else if (t.type === 'salary') txnMonthly[key].payroll += amt;
    });

    const allKeys = new Set([...Object.keys(monthly), ...Object.keys(txnMonthly)]);
    const sorted = Array.from(allKeys).sort();
    const labels = [];
    const dataSets = [];

    if (type === 'pnl') {
        sorted.forEach(k => { labels.push(monthly[k]?.label || monthLabelFromKey(k)); });
        const points = sorted.map(k => monthly[k]?.pnl || 0);
        dataSets.push({ label: 'Net P&L', data: points.length ? points : [0], backgroundColor: points.map(v => v >= 0 ? '#10b981' : '#ef4444'), borderRadius: 4 });
    } else if (type === 'pnl-vs-expenses') {
        sorted.forEach(k => { labels.push(monthly[k]?.label || monthLabelFromKey(k)); });
        const pnlPoints = sorted.map(k => monthly[k]?.pnl || 0);
        const expPoints = sorted.map(k => txnMonthly[k] ? (txnMonthly[k].expenses + txnMonthly[k].payroll) : 0);
        dataSets.push({ label: 'Trading P&L', data: pnlPoints.length ? pnlPoints : [0], backgroundColor: '#10b981', borderRadius: 4 });
        dataSets.push({ label: 'Expenses', data: expPoints.length ? expPoints : [0], backgroundColor: '#ef4444', borderRadius: 4 });
    } else if (type === 'margin') {
        sorted.forEach(k => {
            labels.push(monthly[k]?.label || monthLabelFromKey(k));
        });
        const points = sorted.map(k => {
            const m = monthly[k];
            return m && m.buys > 0 ? (m.pnl / m.buys) * 100 : 0;
        });
        dataSets.push({
            label: 'Margin %', data: points.length ? points : [0],
            borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)',
            type: 'line', fill: true, tension: 0.35, pointBackgroundColor: '#8b5cf6', borderWidth: 3
        });
    } else if (type === 'cumulative') {
        sorted.forEach(k => { labels.push(monthly[k]?.label || monthLabelFromKey(k)); });
        let cum = 0;
        const points = sorted.map(k => { cum += monthly[k]?.pnl || 0; return cum; });
        dataSets.push({
            label: 'Cumulative P&L', data: points.length ? points : [0],
            borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
            type: 'line', fill: true, tension: 0.35, pointBackgroundColor: '#10b981', borderWidth: 3
        });
    } else if (type === 'volume') {
        sorted.forEach(k => { labels.push(monthly[k]?.label || monthLabelFromKey(k)); });
        const points = sorted.map(k => monthly[k]?.volume || 0);
        dataSets.push({ label: 'Volume (MT)', data: points.length ? points : [0], backgroundColor: '#3b82f6', borderRadius: 4 });
    }

    const ctx = document.getElementById('reportsCashFlowChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

    if (cashFlowChartInstance) cashFlowChartInstance.destroy();
    cashFlowChartInstance = new Chart(ctx.getContext('2d'), {
        type: dataSets[0]?.type === 'line' ? 'line' : 'bar',
        data: { labels: labels.length ? labels : ['No Data'], datasets: dataSets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor, font: { family: 'Inter' } } },
                tooltip: {
                    backgroundColor: isDark ? '#141821' : '#fff',
                    titleColor: isDark ? '#fff' : '#0f172a',
                    bodyColor: isDark ? '#f3f4f6' : '#475569',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.dataset.label === 'Margin %') return ` ${ctx.parsed.y.toFixed(1)}%`;
                            if (ctx.dataset.label === 'Volume (MT)') return ` ${ctx.parsed.y.toLocaleString()} MT`;
                            return ` ${formatCurrency(ctx.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter' } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter' }, callback: (val) => {
                    if (type === 'margin') return val.toFixed(1) + '%';
                    if (type === 'volume') return val.toLocaleString();
                    return formatCurrency(val);
                } } }
            }
        }
    });
    } catch (e) { console.error('renderReportChart error:', e); }
}

function renderAccountingSummary() {
    try {
    const period = document.getElementById('reportAccountingPeriod')?.value || 'this-month';
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let cutoff = new Date(0);
    if (period === 'this-month') cutoff = new Date(y, m, 1);
    else if (period === 'last-month') cutoff = new Date(y, m - 1, 1);
    else if (period === 'this-year') cutoff = new Date(y, 0, 1);

    let endDate = new Date(864e13);
    if (period === 'this-month') endDate = new Date(y, m + 1, 0, 23, 59, 59);
    else if (period === 'last-month') endDate = new Date(y, m, 0, 23, 59, 59);
    else if (period === 'this-year') endDate = new Date(y, 11, 31, 23, 59, 59);

    let totalExpenses = 0, totalPayroll = 0;
    const expByAccount = {};
    state.transactions.forEach(t => {
        const d = new Date(t.date);
        if (d < cutoff || d > endDate) return;
        const amt = convertToBase(t.amount, t.currency);
        if (t.type === 'expense') {
            totalExpenses += amt;
            if (!expByAccount[t.accountId]) expByAccount[t.accountId] = { expense: 0, salary: 0 };
            expByAccount[t.accountId].expense += amt;
        } else if (t.type === 'salary') {
            totalPayroll += amt;
            if (!expByAccount[t.accountId]) expByAccount[t.accountId] = { expense: 0, salary: 0 };
            expByAccount[t.accountId].salary += amt;
        }
    });

    // Trading revenue (from closed trades in period)
    let tradingRevenue = 0;
    state.trades.forEach(t => {
        if (t.status === 'closed') {
            const d = new Date(t.date);
            if (d >= cutoff && d <= endDate) {
                tradingRevenue += calcTradePnL(t).netPnL;
            }
        }
    });

    const opResult = tradingRevenue - totalExpenses - totalPayroll;

    document.getElementById('reportTotalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('reportTotalExpenses').className = `summary-value ${totalExpenses > 0 ? 'text-danger' : ''}`;
    document.getElementById('reportTotalPayroll').textContent = formatCurrency(totalPayroll);
    document.getElementById('reportTotalPayroll').className = `summary-value ${totalPayroll > 0 ? 'text-info' : ''}`;
    document.getElementById('reportTradingRevenue').textContent = formatCurrency(tradingRevenue);
    document.getElementById('reportTradingRevenue').className = `summary-value text-success`;
    document.getElementById('reportOperatingResult').textContent = formatCurrency(opResult);
    document.getElementById('reportOperatingResult').className = `summary-value ${opResult >= 0 ? 'text-success' : 'text-danger'}`;

    const list = document.getElementById('reportExpenseBreakdown');
    const noMsg = document.getElementById('reportNoExpenses');
    list.innerHTML = '';
    const expItems = [], salItems = [];
    Object.keys(expByAccount).forEach(accId => {
        if (expByAccount[accId].expense > 0) expItems.push({ accountId: accId, amt: expByAccount[accId].expense });
        if (expByAccount[accId].salary > 0) salItems.push({ accountId: accId, amt: expByAccount[accId].salary });
    });
    if (expItems.length === 0 && salItems.length === 0) {
        noMsg.classList.remove('hidden');
    } else {
        noMsg.classList.add('hidden');
        const allItems = [...expItems, ...salItems];
        const totalExp = totalExpenses + totalPayroll;
        const maxAmt = Math.max(...allItems.map(i => i.amt), 1);
        allItems.forEach(item => {
            const isSal = salItems.some(s => s.accountId === item.accountId && s.amt === item.amt);
            const acc = state.accounts.find(a => a.id === item.accountId) || { name: 'Unknown' };
            const color = isSal ? '#8b5cf6' : '#ef4444';
            const label = isSal ? `${acc.name} (Payroll)` : acc.name;
            const pct = totalExp > 0 ? (item.amt / totalExp) * 100 : 0;
            const row = document.createElement('div');
            row.className = 'category-row-spend';
            row.innerHTML = `
                <div class="category-row-header">
                    <div class="category-row-title"><span style="font-weight:600">${label}</span></div>
                    <div class="category-row-amount"><span style="color:${color}">${formatCurrency(item.amt)}</span> <span>(${pct.toFixed(1)}%)</span></div>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="background:${color};width:${pct}%"></div></div>
            `;
            list.appendChild(row);
        });
    }
    } catch (e) { console.error('renderAccountingSummary error:', e); }
}

function getMonthKeys() {
    const m = new Set();
    state.trades.forEach(t => { const d = new Date(t.date); m.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); });
    state.transactions.forEach(t => { const d = new Date(t.date); m.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); });
    return Array.from(m).sort();
}

function monthLabelFromKey(key) {
    const [y, m] = key.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function populateMonthSelectors() {
    const months = getMonthKeys();
    ['summaryMonth', 'comparePeriod1', 'comparePeriod2'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '';
        months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = monthLabelFromKey(m);
            sel.appendChild(opt);
        });
        if (cur && months.includes(cur)) sel.value = cur;
        else if (months.length > 0) {
            if (id === 'comparePeriod1' && months.length > 1) sel.value = months[months.length - 2];
            else sel.value = months[months.length - 1];
        }
    });
}

function renderCombinedMonthlyReport() {
    const sel = document.getElementById('summaryMonth');
    if (!sel || !sel.value) return;
    const [year, month] = sel.value.split('-');
    const mn = parseInt(month), yr = parseInt(year);
    const startDate = new Date(yr, mn - 1, 1);
    const endDate = new Date(yr, mn, 0, 23, 59, 59, 999);

    let tradePnL = 0, volume = 0, buys = 0;
    const gradeData = {};
    state.trades.forEach(t => {
        const d = new Date(t.date);
        if (d.getMonth() === mn - 1 && d.getFullYear() === yr) {
            volume += t.quantity;
            buys += convertToBase(t.buyPrice * t.quantity, t.buyCurrency);
            if (t.status === 'closed') {
                const p = calcTradePnL(t);
                tradePnL += p.netPnL;
                gradeData[t.gradeId] = (gradeData[t.gradeId] || 0) + p.netPnL;
            }
        }
    });

    let totalExpenses = 0, payroll = 0;
    const expByAccount = {};
    state.transactions.forEach(t => {
        const d = new Date(t.date);
        if (d >= startDate && d <= endDate) {
            const amt = convertToBase(t.amount, t.currency);
            if (t.type === 'expense') {
                totalExpenses += amt;
                if (!expByAccount[t.accountId]) expByAccount[t.accountId] = { expense: 0, salary: 0 };
                expByAccount[t.accountId].expense += amt;
            } else if (t.type === 'salary') {
                payroll += amt;
                if (!expByAccount[t.accountId]) expByAccount[t.accountId] = { expense: 0, salary: 0 };
                expByAccount[t.accountId].salary += amt;
            }
        }
    });

    const netResult = tradePnL - totalExpenses - payroll;
    const margin = buys > 0 ? (tradePnL / buys) * 100 : 0;

    document.getElementById('combinedTradePnL').textContent = formatCurrency(tradePnL);
    document.getElementById('combinedTradePnL').className = `summary-value ${tradePnL >= 0 ? 'text-success' : 'text-danger'}`;
    document.getElementById('combinedVolume').textContent = volume.toLocaleString() + ' MT';
    document.getElementById('combinedExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('combinedExpenses').className = `summary-value ${totalExpenses > 0 ? 'text-danger' : ''}`;
    document.getElementById('combinedPayroll').textContent = formatCurrency(payroll);
    document.getElementById('combinedPayroll').className = `summary-value ${payroll > 0 ? 'text-info' : ''}`;
    document.getElementById('combinedNetResult').textContent = formatCurrency(netResult);
    document.getElementById('combinedNetResult').className = `summary-value ${netResult >= 0 ? 'text-success' : 'text-danger'}`;
    document.getElementById('combinedMargin').textContent = margin.toFixed(1) + '%';
    document.getElementById('combinedMargin').className = `summary-value ${margin >= 5 ? 'text-success' : 'text-info'}`;

    // Grade breakdown
    const gradeList = document.getElementById('summaryCategoryList');
    const gradeNoData = document.getElementById('summaryNoData');
    gradeList.innerHTML = '';
    const gradeKeys = Object.keys(gradeData).sort((a, b) => gradeData[b] - gradeData[a]);
    if (gradeKeys.length === 0) {
        gradeNoData.classList.remove('hidden');
    } else {
        gradeNoData.classList.add('hidden');
        const maxAmt = Math.max(...Object.values(gradeData).map(Math.abs), 1);
        gradeKeys.slice(0, 5).forEach(gId => {
            const amt = gradeData[gId];
            const g = state.grades.find(g => g.id === gId) || { name: 'Unknown', color: '#6b7280', icon: 'fa-solid fa-tag' };
            const barPct = Math.abs(amt / maxAmt) * 100;
            const row = document.createElement('div');
            row.innerHTML = `
                <div class="summary-category-row">
                    <div class="summary-category-left"><i class="${g.icon}" style="color:${g.color};width:16px"></i><span>${g.name}</span></div>
                    <div style="text-align:right"><div style="font-weight:600;font-family:var(--font-heading);" class="${amt >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(amt)}</div></div>
                </div>
                <div class="summary-category-bar"><div class="summary-category-bar-fill" style="width:${barPct}%;background:${g.color}"></div></div>
            `;
            gradeList.appendChild(row);
        });
    }

    // Expense breakdown
    const expList = document.getElementById('combinedExpenseBreakdown');
    const expNoData = document.getElementById('combinedNoExpenses');
    expList.innerHTML = '';
    const expItems = [], salItems = [];
    Object.keys(expByAccount).forEach(accId => {
        const entry = expByAccount[accId];
        if (entry.expense > 0) expItems.push({ accountId: accId, amt: entry.expense });
        if (entry.salary > 0) salItems.push({ accountId: accId, amt: entry.salary });
    });
    if (expItems.length === 0 && salItems.length === 0) {
        expNoData.classList.remove('hidden');
    } else {
        expNoData.classList.add('hidden');
        const allItems = [...expItems, ...salItems];
        const maxAmt = Math.max(...allItems.map(i => i.amt), 1);
        allItems.forEach(item => {
            const acc = state.accounts.find(a => a.id === item.accountId) || { name: 'Unknown' };
            const isSalary = item.amt === (expByAccount[item.accountId]?.salary || 0) && item.amt !== (expByAccount[item.accountId]?.expense || 0) ? expByAccount[item.accountId]?.salary > 0 && expByAccount[item.accountId]?.expense === 0 : item.amt === (expByAccount[item.accountId]?.salary || 0);
            // Determine if this item is salary by checking the salary map
            const isSal = salItems.some(s => s.accountId === item.accountId && s.amt === item.amt);
            const color = isSal ? '#8b5cf6' : '#ef4444';
            const label = isSal ? `${acc.name} (Payroll)` : acc.name;
            const barPct = (item.amt / maxAmt) * 100;
            const row = document.createElement('div');
            row.innerHTML = `
                <div class="summary-category-row">
                    <div class="summary-category-left"><span>${label}</span></div>
                    <div style="text-align:right"><div style="font-weight:600;font-family:var(--font-heading);" style="color:${color}">${formatCurrency(item.amt)}</div></div>
                </div>
                <div class="summary-category-bar"><div class="summary-category-bar-fill" style="width:${barPct}%;background:${color}"></div></div>
            `;
            expList.appendChild(row);
        });
    }
}

let accountingTrendChartInstance = null;

function renderAccountingTrendChart() {
    try {
    const ctx = document.getElementById('accountingTrendChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

    const monthly = {};
    state.transactions.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthly[key]) monthly[key] = { expenses: 0, payroll: 0, label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) };
        const amt = convertToBase(t.amount, t.currency);
        if (t.type === 'expense') monthly[key].expenses += amt;
        else if (t.type === 'salary') monthly[key].payroll += amt;
    });

    const tradeMonthly = {};
    state.trades.forEach(t => {
        if (t.status === 'closed') {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!tradeMonthly[key]) tradeMonthly[key] = 0;
            tradeMonthly[key] += calcTradePnL(t).netPnL;
        }
    });

    const allMonths = new Set([...Object.keys(monthly), ...Object.keys(tradeMonthly)]);
    const sorted = Array.from(allMonths).sort();
    const labels = [], expData = [], payrollData = [], tradeData = [];
    sorted.forEach(m => {
        labels.push(monthly[m] ? monthly[m].label : monthLabelFromKey(m));
        expData.push(monthly[m]?.expenses || 0);
        payrollData.push(monthly[m]?.payroll || 0);
        tradeData.push(tradeMonthly[m] || 0);
    });

    if (accountingTrendChartInstance) accountingTrendChartInstance.destroy();
    accountingTrendChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [
                {
                    label: 'Trading P&L',
                    data: tradeData.length ? tradeData : [0],
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Expenses',
                    data: expData.length ? expData : [0],
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                },
                {
                    label: 'Payroll',
                    data: payrollData.length ? payrollData : [0],
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor, font: { family: 'Inter' } } },
                tooltip: {
                    backgroundColor: isDark ? '#141821' : '#fff',
                    titleColor: isDark ? '#fff' : '#0f172a',
                    bodyColor: isDark ? '#f3f4f6' : '#475569',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    borderWidth: 1,
                    callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter' } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter' }, callback: (val) => formatCurrency(val) } }
            }
        }
    });
    } catch (e) { console.error('renderAccountingTrendChart error:', e); }
}

function renderPeriodComparison() {
    const s1 = document.getElementById('comparePeriod1');
    const s2 = document.getElementById('comparePeriod2');
    if (!s1 || !s2 || !s1.value || !s2.value) return;
    document.getElementById('compareHeader1').textContent = monthLabelFromKey(s1.value);
    document.getElementById('compareHeader2').textContent = monthLabelFromKey(s2.value);
    function getData(key) {
        const [y, m] = key.split('-');
        const mn = parseInt(m), yr = parseInt(y);
        let pnl = 0, volume = 0, buys = 0, sells = 0;
        const grades = {};
        state.trades.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === mn - 1 && d.getFullYear() === yr) {
                volume += t.quantity;
                buys += convertToBase(t.buyPrice * t.quantity, t.buyCurrency);
                sells += convertToBase(t.sellPrice * t.quantity, t.sellCurrency);
                if (t.status === 'closed') {
                    const p = calcTradePnL(t);
                    pnl += p.netPnL;
                    grades[t.gradeId] = (grades[t.gradeId] || 0) + p.netPnL;
                }
            }
        });
        return { pnl, volume, buys, sells, grades };
    }
    const d1 = getData(s1.value), d2 = getData(s2.value);
    const tbody = document.getElementById('comparisonBody');
    const noData = document.getElementById('comparisonNoData');
    tbody.innerHTML = '';
    if (d1.volume === 0 && d2.volume === 0) { noData.classList.remove('hidden'); return; }
    noData.classList.add('hidden');
    function addRow(label, v1, v2, isCurrency = true) {
        const diff = v2 - v1;
        const pct = v1 !== 0 ? (diff / v1) * 100 : (v2 !== 0 ? 100 : 0);
        const cls = diff > 0 ? 'diff-positive' : (diff < 0 ? 'diff-negative' : 'diff-neutral');
        const pctDisp = (v1 !== 0 || v2 !== 0) ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:500">${label}</td>
            <td class="text-right">${isCurrency ? formatCurrency(v1) : v1.toFixed(1) + '%'}</td>
            <td class="text-right">${isCurrency ? formatCurrency(v2) : v2.toFixed(1) + '%'}</td>
            <td class="text-right ${cls}">${isCurrency ? formatCurrency(diff) : (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%'}</td>
            <td class="text-right ${cls}">${pctDisp}</td>
        `;
        tbody.appendChild(tr);
    }
    addRow('Total P&L', d1.pnl, d2.pnl);
    addRow('Volume (MT)', d1.volume, d2.volume, false);
    addRow('Total Buy Value', d1.buys, d2.buys);
    addRow('Total Sell Value', d1.sells, d2.sells);
    addRow('Avg Margin %', d1.buys > 0 ? (d1.pnl / d1.buys) * 100 : 0, d2.buys > 0 ? (d2.pnl / d2.buys) * 100 : 0, false);
    const allG = new Set([...Object.keys(d1.grades), ...Object.keys(d2.grades)]);
    if (allG.size > 0) {
        const sep = document.createElement('tr');
        sep.innerHTML = '<td colspan="5" style="padding:8px 18px;font-size:11px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-bottom:1px solid var(--border-color);background:var(--bg-surface);">By Grade</td>';
        tbody.appendChild(sep);
        Array.from(allG).sort((a, b) => Math.max(d1.grades[a] || 0, d2.grades[a] || 0) - Math.max(d1.grades[b] || 0, d2.grades[b] || 0)).reverse().forEach(gId => {
            const g = state.grades.find(g => g.id === gId) || { name: 'Unknown' };
            addRow(g.name, d1.grades[gId] || 0, d2.grades[gId] || 0);
        });
    }
}

// ===== SETTINGS =====
function renderExchangeRates() {
    const container = document.getElementById('exchangeRatesDisplay');
    if (!container) return;
    container.innerHTML = '';
    const codes = Object.keys(exchangeRates).sort();
    codes.forEach(code => {
        const card = document.createElement('div');
        card.className = 'exchange-rate-card';
        card.innerHTML = `<span class="exchange-rate-code">${code}</span><span class="exchange-rate-value">${exchangeRates[code].toFixed(4)}</span><span class="exchange-rate-base">${code === 'USD' ? 'base' : ''}</span>`;
        container.appendChild(card);
    });
    const ts = document.getElementById('ratesTimestamp');
    if (ts) ts.textContent = `Rates updated: ${new Date().toLocaleString()}`;
}

async function refreshExchangeRates() {
    const btn = document.getElementById('btnRefreshRates');
    if (btn) btn.disabled = true;
    showToast('Refreshing exchange rates...', 'info');
    await fetchExchangeRates();
    renderExchangeRates();
    if (btn) btn.disabled = false;
    showToast('Exchange rates updated', 'success');
}

function renderSettings() {
    try {
    const list = document.getElementById('settingsGradesList');
    list.innerHTML = '';
    state.grades.forEach(g => {
        const li = document.createElement('li');
        li.className = 'category-item-row';
        li.innerHTML = `
            <div class="category-item-info">
                <div class="category-item-icon" style="background:${g.color}20;color:${g.color};border:1px solid ${g.color}40"><i class="fa-solid fa-cube"></i></div>
                <span class="category-item-name">${g.name}</span>
            </div>
            <button class="btn-remove-category" onclick="deleteGrade('${g.id}')" title="Remove Grade"><i class="fa-solid fa-trash-can"></i></button>
        `;
        list.appendChild(li);
    });
    renderExchangeRates();
    } catch (e) { console.error('renderSettings error:', e); throw e; }
}

// ===== ACCOUNTING: HELPERS =====
function getAccountBalance(accountId) {
    let balance = 0;
    state.transactions.forEach(t => {
        if (t.accountId === accountId) {
            const amt = convertToBase(t.amount, t.currency);
            if (t.type === 'revenue') balance += amt;
            else balance -= amt;
        }
    });
    return balance;
}

function getTotalExpenses() {
    let total = 0;
    state.transactions.forEach(t => {
        if (t.type === 'expense' || t.type === 'salary') {
            total += convertToBase(t.amount, t.currency);
        }
    });
    return total;
}

function getTotalPayroll() {
    let total = 0;
    state.transactions.forEach(t => {
        if (t.type === 'salary') {
            total += convertToBase(t.amount, t.currency);
        }
    });
    return total;
}

function getTxnTypeIcon(type) {
    const map = { expense: 'fa-arrow-up', revenue: 'fa-arrow-down', salary: 'fa-users', transfer: 'fa-arrow-right-arrow-left' };
    return map[type] || 'fa-circle';
}

// ===== ACCOUNTING: ACCOUNTS =====
function renderAccounts() {
    try {
    const tbody = document.getElementById('accountsTableBody');
    const empty = document.getElementById('accountsEmptyMsg');
    tbody.innerHTML = '';
    if (state.accounts.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        state.accounts.forEach((a, i) => {
            const bal = getAccountBalance(a.id);
            const tr = document.createElement('tr');
            tr.style.animation = `rowIn 0.3s ease-out forwards`;
            tr.style.animationDelay = `${i * 0.03}s`;
            tr.innerHTML = `
                <td style="font-family:monospace;font-weight:600">${a.code}</td>
                <td><strong>${a.name}</strong>${a.description ? `<div style="font-size:11px;color:var(--color-text-muted)">${a.description}</div>` : ''}</td>
                <td><span class="account-type-badge ${a.type}">${a.type}</span></td>
                <td class="text-right" style="font-weight:600;font-family:var(--font-heading);${bal >= 0 ? 'color:var(--color-success)' : 'color:var(--color-danger)'}">${formatCurrency(bal)}</td>
                <td class="text-center">
                    <div class="action-buttons">
                        <button class="btn-icon-edit" onclick="openEditAccountModal('${a.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon-delete" onclick="deleteAccount('${a.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    } catch (e) { console.error('renderAccounts error:', e); throw e; }
}

function openAddAccountModal() {
    document.getElementById('accountModalTitle').textContent = 'New Account';
    document.getElementById('editAccountId').value = '';
    document.getElementById('accountForm').reset();
    document.getElementById('accCode').value = '';
    document.getElementById('accName').value = '';
    document.getElementById('accDescription').value = '';
    document.getElementById('accountModal').classList.add('active');
}

function openEditAccountModal(accountId) {
    const a = state.accounts.find(x => x.id === accountId);
    if (!a) return;
    document.getElementById('accountModalTitle').textContent = 'Edit Account';
    document.getElementById('editAccountId').value = a.id;
    document.getElementById('accCode').value = a.code;
    document.getElementById('accName').value = a.name;
    document.getElementById('accType').value = a.type;
    document.getElementById('accDescription').value = a.description || '';
    document.getElementById('accountModal').classList.add('active');
}

function closeAccountModal() {
    document.getElementById('accountModal').classList.remove('active');
}

function saveAccount(e) {
    try {
    e.preventDefault();
    const id = document.getElementById('editAccountId').value;
    const code = document.getElementById('accCode').value.trim();
    const name = document.getElementById('accName').value.trim();
    const type = document.getElementById('accType').value;
    const description = document.getElementById('accDescription').value.trim();
    if (!code || !name) { showToast('Account code and name are required', 'danger'); return; }
    if (id) {
        const idx = state.accounts.findIndex(x => x.id === id);
        if (idx !== -1) { state.accounts[idx] = { ...state.accounts[idx], code, name, type, description }; showToast('Account updated', 'success'); }
    } else {
        state.accounts.push({ id: generateId(), code, name, type, description });
        showToast('Account created', 'success');
    }
    saveState();
    closeAccountModal();
    renderAccounts();
    } catch (e) { console.error('saveAccount error:', e); throw e; }
}

function deleteAccount(accountId) {
    const count = state.transactions.filter(t => t.accountId === accountId).length;
    if (count > 0) { showToast(`Cannot delete — ${count} transaction(s) use this account`, 'danger'); return; }
    if (state.accounts.length <= 1) { showToast('Keep at least one account', 'danger'); return; }
    if (confirm('Delete this account permanently?')) {
        state.accounts = state.accounts.filter(a => a.id !== accountId);
        saveState();
        renderAccounts();
        showToast('Account deleted', 'success');
    }
}

function populateAccountDropdowns() {
    const ids = ['txnAccount', 'filterTxnAccount'];
    ids.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '';
        if (id === 'filterTxnAccount') {
            const opt = document.createElement('option');
            opt.value = 'all'; opt.textContent = 'All Accounts';
            sel.appendChild(opt);
        }
        state.accounts.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = `${a.code} — ${a.name}`;
            sel.appendChild(opt);
        });
        if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
    });
    // Also populate transaction modal employee/bank dropdowns
    populateEmployeeTxnDropdown();
    populateBankTxnDropdown();
}

// ===== ACCOUNTING: TRANSACTIONS =====
function getFilteredTransactions() {
    return state.transactions.filter(t => {
        if (uiState.filters.txnAccount && uiState.filters.txnAccount !== 'all' && t.accountId !== uiState.filters.txnAccount) return false;
        if (uiState.filters.txnType && uiState.filters.txnType !== 'all' && t.type !== uiState.filters.txnType) return false;
        if (uiState.filters.txnDateRange && uiState.filters.txnDateRange !== 'all') {
            const d = new Date(t.date);
            const now = new Date();
            if (uiState.filters.txnDateRange === 'this-month') {
                if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
            } else if (uiState.filters.txnDateRange === 'last-month') {
                const lm = new Date(); lm.setMonth(now.getMonth() - 1);
                if (d.getMonth() !== lm.getMonth() || d.getFullYear() !== lm.getFullYear()) return false;
            } else if (uiState.filters.txnDateRange === 'this-year') {
                if (d.getFullYear() !== now.getFullYear()) return false;
            } else if (uiState.filters.txnDateRange === 'custom') {
                if (uiState.filters.txnStart && new Date(t.date) < new Date(uiState.filters.txnStart)) return false;
                if (uiState.filters.txnEnd && new Date(t.date) > new Date(uiState.filters.txnEnd)) return false;
            }
        }
        return true;
    });
}

function renderTransactions() {
    try {
    populateAccountDropdowns();
    const tbody = document.getElementById('transactionsTableBody');
    const empty = document.getElementById('txnsEmptyMsg');
    tbody.innerHTML = '';
    document.getElementById('filterTxnAccount').value = uiState.filters.txnAccount || 'all';
    document.getElementById('filterTxnType').value = uiState.filters.txnType || 'all';
    document.getElementById('filterTxnDateRange').value = uiState.filters.txnDateRange || 'all';
    let filtered = getFilteredTransactions();
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (filtered.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        filtered.forEach((t, i) => {
            const acc = state.accounts.find(a => a.id === t.accountId) || { name: 'Unknown' };
            const tr = document.createElement('tr');
            tr.style.animation = `rowIn 0.3s ease-out forwards`;
            tr.style.animationDelay = `${i * 0.03}s`;
            const isSalary = t.type === 'salary';
            const emp = isSalary && t.employeeId ? state.employees.find(e => e.id === t.employeeId) : null;
            const displayDesc = isSalary && emp ? `Salary: ${emp.name}` : t.description;
            tr.innerHTML = `
                <td>${formatTableDate(t.date)}</td>
                <td><strong>${acc.name}</strong></td>
                <td>${displayDesc}</td>
                <td>${t.vendor || (isSalary && emp ? emp.name : '') || '-'}</td>
                <td class="text-right" style="font-weight:600;font-family:var(--font-heading);${t.type === 'revenue' ? 'color:var(--color-success)' : 'color:var(--color-danger)'}">${formatCurrency(convertToBase(t.amount, t.currency))}</td>
                <td><span class="txn-type-badge ${t.type}"><i class="fa-solid ${getTxnTypeIcon(t.type)}"></i> ${t.type}</span></td>
                <td style="font-size:12px;color:var(--color-text-muted)">${t.reference || '-'}</td>
                <td class="text-center">
                    <div class="action-buttons">
                        <button class="btn-icon-edit" onclick="openEditTxnModal('${t.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon-delete" onclick="deleteTransaction('${t.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    } catch (e) { console.error('renderTransactions error:', e); throw e; }
}

function openAddTxnModal() {
    try {
    populateAccountDropdowns();
    document.getElementById('txnModalTitle').textContent = 'New Transaction';
    document.getElementById('editTxnId').value = '';
    document.getElementById('transactionForm').reset();
    document.getElementById('txnDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('txnCurrency').value = getBaseCurrencyCode();
    document.getElementById('transactionModal').classList.add('active');
    } catch (e) { console.error('openAddTxnModal error:', e); throw e; }
}

function openEditTxnModal(txnId) {
    try {
    populateAccountDropdowns();
    const t = state.transactions.find(x => x.id === txnId);
    if (!t) return;
    document.getElementById('txnModalTitle').textContent = 'Edit Transaction';
    document.getElementById('editTxnId').value = t.id;
    document.getElementById('txnDate').value = t.date;
    document.getElementById('txnType').value = t.type;
    document.getElementById('txnAccount').value = t.accountId;
    document.getElementById('txnDescription').value = t.description;
    document.getElementById('txnAmount').value = t.amount;
    document.getElementById('txnCurrency').value = t.currency;
    document.getElementById('txnVendor').value = t.vendor || '';
    document.getElementById('txnReference').value = t.reference || '';
    document.getElementById('txnEmployee').value = t.employeeId || '';
    document.getElementById('txnBankAccount').value = t.bankAccountId || '';
    document.getElementById('transactionModal').classList.add('active');
    } catch (e) { console.error('openEditTxnModal error:', e); throw e; }
}

function closeTxnModal() {
    document.getElementById('transactionModal').classList.remove('active');
}

function saveTransaction(e) {
    try {
    e.preventDefault();
    const id = document.getElementById('editTxnId').value;
    const date = document.getElementById('txnDate').value;
    const type = document.getElementById('txnType').value;
    const accountId = document.getElementById('txnAccount').value;
    const description = document.getElementById('txnDescription').value.trim();
    const amount = parseFloat(document.getElementById('txnAmount').value);
    const currency = document.getElementById('txnCurrency').value;
    const vendor = document.getElementById('txnVendor').value.trim();
    const reference = document.getElementById('txnReference').value.trim();
    const employeeId = document.getElementById('txnEmployee').value || null;
    const bankAccountId = document.getElementById('txnBankAccount').value || null;
    if (!date || !accountId || !description || !amount || amount <= 0) {
        showToast('Please fill in all required fields', 'danger');
        return;
    }
    const data = { date, type, accountId, description, amount, currency, vendor, reference, employeeId, bankAccountId };
    if (id) {
        const idx = state.transactions.findIndex(t => t.id === id);
        if (idx !== -1) { state.transactions[idx] = { ...state.transactions[idx], ...data }; showToast('Transaction updated', 'success'); }
    } else {
        data.id = generateId();
        state.transactions.push(data);
        showToast('Transaction recorded', 'success');
    }
    saveState();
    closeTxnModal();
    renderTransactions();
    } catch (e) { console.error('saveTransaction error:', e); throw e; }
}

function deleteTransaction(txnId) {
    if (confirm('Delete this transaction permanently?')) {
        state.transactions = state.transactions.filter(t => t.id !== txnId);
        saveState();
        renderTransactions();
        showToast('Transaction deleted', 'success');
    }
}

function exportTxnsCSV() {
    if (state.transactions.length === 0) { showToast('No transactions to export', 'danger'); return; }
    const filtered = getFilteredTransactions();
    if (filtered.length === 0) { showToast('No transactions match filters', 'danger'); return; }
    let csv = "\uFEFF";
    csv += 'Date,Account,Type,Description,Vendor,Amount (Base),Currency,Reference,Employee\n';
    filtered.forEach(t => {
        const acc = state.accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
        const emp = t.employeeId ? (state.employees.find(e => e.id === t.employeeId)?.name || '') : '';
        csv += `${t.date},${acc},${t.type},"${t.description.replace(/"/g,'""')}","${(t.vendor||'').replace(/"/g,'""')}",${convertToBase(t.amount,t.currency).toFixed(2)},${t.currency},"${(t.reference||'').replace(/"/g,'""')}","${emp.replace(/"/g,'""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `acuity_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Transactions exported', 'success');
}

// ===== ACCOUNTING: EMPLOYEES =====
function renderEmployees() {
    try {
    const tbody = document.getElementById('employeesTableBody');
    const empty = document.getElementById('employeesEmptyMsg');
    tbody.innerHTML = '';
    if (state.employees.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        state.employees.forEach((e, i) => {
            const tr = document.createElement('tr');
            tr.style.animation = `rowIn 0.3s ease-out forwards`;
            tr.style.animationDelay = `${i * 0.04}s`;
            tr.innerHTML = `
                <td><strong>${e.name}</strong></td>
                <td>${e.role || '-'}</td>
                <td class="text-right" style="font-weight:600;font-family:var(--font-heading)">${e.salary ? formatCurrency(convertToBase(e.salary, e.salaryCurrency || 'USD')) : '-'}</td>
                <td>${e.payFrequency || 'monthly'}</td>
                <td>${e.phone || ''}${e.email ? `<br><span style="font-size:11px;color:var(--color-text-muted)">${e.email}</span>` : ''}</td>
                <td><span class="${e.isActive !== false ? 'emp-status-active' : 'emp-status-inactive'}">${e.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                <td class="text-center">
                    <div class="action-buttons">
                        <button class="btn-icon-edit" onclick="openEditEmployeeModal('${e.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon-delete" onclick="deleteEmployee('${e.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    } catch (e) { console.error('renderEmployees error:', e); throw e; }
}

function openAddEmployeeModal() {
    document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    document.getElementById('editEmployeeId').value = '';
    document.getElementById('employeeForm').reset();
    document.getElementById('empStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('empSalaryCurrency').value = getBaseCurrencyCode();
    document.getElementById('employeeModal').classList.add('active');
}

function openEditEmployeeModal(empId) {
    const e = state.employees.find(x => x.id === empId);
    if (!e) return;
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
    document.getElementById('editEmployeeId').value = e.id;
    document.getElementById('empName').value = e.name;
    document.getElementById('empRole').value = e.role || '';
    document.getElementById('empSalary').value = e.salary || '';
    document.getElementById('empSalaryCurrency').value = e.salaryCurrency || 'USD';
    document.getElementById('empFrequency').value = e.payFrequency || 'monthly';
    document.getElementById('empStartDate').value = e.startDate || '';
    document.getElementById('empPhone').value = e.phone || '';
    document.getElementById('empEmail').value = e.email || '';
    document.getElementById('empNotes').value = e.notes || '';
    document.getElementById('employeeModal').classList.add('active');
}

function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('active');
}

function saveEmployee(e) {
    try {
    e.preventDefault();
    const id = document.getElementById('editEmployeeId').value;
    const name = document.getElementById('empName').value.trim();
    const role = document.getElementById('empRole').value.trim();
    const salary = parseFloat(document.getElementById('empSalary').value) || 0;
    const salaryCurrency = document.getElementById('empSalaryCurrency').value;
    const payFrequency = document.getElementById('empFrequency').value;
    const startDate = document.getElementById('empStartDate').value;
    const phone = document.getElementById('empPhone').value.trim();
    const email = document.getElementById('empEmail').value.trim();
    const notes = document.getElementById('empNotes').value.trim();
    if (!name) { showToast('Employee name is required', 'danger'); return; }
    const data = { name, role, salary, salaryCurrency, payFrequency, startDate, phone, email, notes, isActive: true };
    if (id) {
        const idx = state.employees.findIndex(x => x.id === id);
        if (idx !== -1) { state.employees[idx] = { ...state.employees[idx], ...data }; showToast('Employee updated', 'success'); }
    } else {
        data.id = generateId();
        state.employees.push(data);
        showToast('Employee added', 'success');
    }
    saveState();
    closeEmployeeModal();
    renderEmployees();
    } catch (e) { console.error('saveEmployee error:', e); throw e; }
}

function deleteEmployee(empId) {
    const count = state.transactions.filter(t => t.employeeId === empId).length;
    if (count > 0) { showToast(`Cannot delete — ${count} salary transaction(s) linked`, 'danger'); return; }
    if (confirm(`Delete this employee permanently?`)) {
        state.employees = state.employees.filter(e => e.id !== empId);
        saveState();
        renderEmployees();
        showToast('Employee removed', 'success');
    }
}

function populateEmployeeTxnDropdown() {
    const sel = document.getElementById('txnEmployee');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— None —</option>';
    state.employees.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.name;
        sel.appendChild(opt);
    });
    if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
}

// ===== ACCOUNTING: BANK ACCOUNTS =====
function renderBanks() {
    try {
    const grid = document.getElementById('bankCardsGrid');
    const empty = document.getElementById('banksEmptyMsg');
    grid.innerHTML = '';
    if (state.bankAccounts.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        state.bankAccounts.forEach((b, i) => {
            let txnNet = 0;
            state.transactions.forEach(t => {
                if (t.bankAccountId === b.id) {
                    const amt = convertToBase(t.amount, t.currency);
                    txnNet += (t.type === 'revenue' || t.type === 'transfer') ? amt : -amt;
                }
            });
            const balance = b.openingBalance + txnNet;
            const card = document.createElement('div');
            card.className = 'bank-card';
            card.style.animation = `fadeInUp 0.3s ease-out forwards`;
            card.style.animationDelay = `${i * 0.05}s`;
            card.innerHTML = `
                <div class="bank-card-header">
                    <div>
                        <div class="bank-card-name">${b.name}</div>
                        <div class="bank-card-institution">${b.institution || ''}</div>
                    </div>
                    <div style="font-size:12px;color:var(--color-text-muted);font-weight:600">${b.currency}</div>
                </div>
                <div class="bank-card-balance ${balance >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(balance)}</div>
                <div class="bank-card-footer">
                    <span class="bank-card-number">${b.accountNumber || ''}</span>
                    <div class="bank-card-actions">
                        <button class="btn-icon-edit" onclick="openEditBankModal('${b.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon-delete" onclick="deleteBankAccount('${b.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }
    } catch (e) { console.error('renderBanks error:', e); throw e; }
}

function openAddBankModal() {
    document.getElementById('bankModalTitle').textContent = 'New Bank Account';
    document.getElementById('editBankId').value = '';
    document.getElementById('bankForm').reset();
    document.getElementById('bankCurrency').value = getBaseCurrencyCode();
    document.getElementById('bankBalance').value = 0;
    document.getElementById('bankModal').classList.add('active');
}

function openEditBankModal(bankId) {
    const b = state.bankAccounts.find(x => x.id === bankId);
    if (!b) return;
    document.getElementById('bankModalTitle').textContent = 'Edit Bank Account';
    document.getElementById('editBankId').value = b.id;
    document.getElementById('bankName').value = b.name;
    document.getElementById('bankInstitution').value = b.institution || '';
    document.getElementById('bankNumber').value = b.accountNumber || '';
    document.getElementById('bankCurrency').value = b.currency;
    document.getElementById('bankBalance').value = b.openingBalance;
    document.getElementById('bankNotes').value = b.notes || '';
    document.getElementById('bankModal').classList.add('active');
}

function closeBankModal() {
    document.getElementById('bankModal').classList.remove('active');
}

function saveBankAccount(e) {
    try {
    e.preventDefault();
    const id = document.getElementById('editBankId').value;
    const name = document.getElementById('bankName').value.trim();
    const institution = document.getElementById('bankInstitution').value.trim();
    const accountNumber = document.getElementById('bankNumber').value.trim();
    const currency = document.getElementById('bankCurrency').value;
    const openingBalance = parseFloat(document.getElementById('bankBalance').value) || 0;
    const notes = document.getElementById('bankNotes').value.trim();
    if (!name) { showToast('Account name is required', 'danger'); return; }
    const data = { name, institution, accountNumber, currency, openingBalance, notes };
    if (id) {
        const idx = state.bankAccounts.findIndex(x => x.id === id);
        if (idx !== -1) { state.bankAccounts[idx] = { ...state.bankAccounts[idx], ...data }; showToast('Bank account updated', 'success'); }
    } else {
        data.id = generateId();
        state.bankAccounts.push(data);
        showToast('Bank account added', 'success');
    }
    saveState();
    closeBankModal();
    renderBanks();
    } catch (e) { console.error('saveBankAccount error:', e); throw e; }
}

function deleteBankAccount(bankId) {
    const count = state.transactions.filter(t => t.bankAccountId === bankId).length;
    if (count > 0) { showToast(`Cannot delete — ${count} transaction(s) linked`, 'danger'); return; }
    if (confirm('Delete this bank account?')) {
        state.bankAccounts = state.bankAccounts.filter(b => b.id !== bankId);
        saveState();
        renderBanks();
        showToast('Bank account removed', 'success');
    }
}

function populateBankTxnDropdown() {
    const sel = document.getElementById('txnBankAccount');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— None —</option>';
    state.bankAccounts.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.name} (${b.currency})`;
        sel.appendChild(opt);
    });
    if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
}

// ===== DOUBLE-ENTRY: HELPERS =====
function getJournalLines() {
    const lines = [];
    state.journalEntries.forEach(je => {
        (je.lines || []).forEach(l => {
            lines.push({
                entryId: je.id,
                date: je.date,
                reference: je.reference || '',
                memo: je.memo || '',
                currency: je.currency || getBaseCurrencyCode(),
                accountId: l.accountId,
                debit: parseFloat(l.debit) || 0,
                credit: parseFloat(l.credit) || 0,
                note: l.note || ''
            });
        });
    });
    return lines;
}

function getAccountDrCr(accountId, startDate, endDate) {
    let dr = 0, cr = 0;
    getJournalLines().forEach(l => {
        if (l.accountId !== accountId) return;
        if (startDate && l.date < startDate) return;
        if (endDate && l.date > endDate) return;
        dr += convertToBase(l.debit, l.currency);
        cr += convertToBase(l.credit, l.currency);
    });
    return { dr, cr };
}

function accountNormalSide(type) {
    return (type === 'asset' || type === 'expense') ? 'debit' : 'credit';
}

function accountSignedBalance(account) {
    const { dr, cr } = getAccountDrCr(account.id);
    const side = accountNormalSide(account.type);
    const bal = side === 'debit' ? dr - cr : cr - dr;
    return { bal, side, dr, cr };
}

function nextJournalRef() {
    const max = state.journalEntries.reduce((m, je) => {
        const n = parseInt(String(je.reference || '').replace(/[^0-9]/g, ''), 10);
        return (!isNaN(n) && n > m) ? n : m;
    }, 0);
    return 'JE-' + String(max + 1).padStart(3, '0');
}

function toggleCustomRange(id, value) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', value !== 'custom');
}

// ===== DOUBLE-ENTRY: JOURNAL =====
function renderJournal() {
    try {
        const tbody = document.getElementById('journalTableBody');
        const empty = document.getElementById('journalEmptyMsg');
        tbody.innerHTML = '';
        const entries = [...state.journalEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (entries.length === 0) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            entries.forEach((je, i) => {
                const total = je.lines.reduce((s, l) => s + convertToBase(parseFloat(l.debit) || 0, je.currency || getBaseCurrencyCode()), 0);
                const tr = document.createElement('tr');
                tr.style.animation = `rowIn 0.3s ease-out forwards`;
                tr.style.animationDelay = `${i * 0.03}s`;
                tr.innerHTML = `
                    <td>${formatTableDate(je.date)}</td>
                    <td><strong>${je.reference || '-'}</strong></td>
                    <td>${je.memo || ''}</td>
                    <td><span class="txn-type-badge expense">${je.lines.length} line${je.lines.length !== 1 ? 's' : ''}</span></td>
                    <td class="text-right" style="font-weight:600;font-family:var(--font-heading)">${formatCurrency(total)}</td>
                    <td style="font-size:12px;color:var(--color-text-muted)">${je.currency || getBaseCurrencyCode()}</td>
                    <td class="text-center">
                        <div class="action-buttons">
                            <button class="btn-icon-edit" onclick="openEditJournalModal('${je.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-icon-delete" onclick="deleteJournalEntry('${je.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { console.error('renderJournal error:', e); }
}

function openAddJournalModal() {
    document.getElementById('journalModalTitle').textContent = 'New Journal Entry';
    document.getElementById('editJournalId').value = '';
    document.getElementById('journalForm').reset();
    document.getElementById('journalDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('journalRef').value = nextJournalRef();
    document.getElementById('journalCurrency').value = getBaseCurrencyCode();
    const container = document.getElementById('journalLinesContainer');
    container.innerHTML = '';
    addJournalLineRow();
    addJournalLineRow();
    recalcJournalTotals();
    document.getElementById('journalModal').classList.add('active');
}

function openEditJournalModal(id) {
    const je = state.journalEntries.find(e => e.id === id);
    if (!je) return;
    document.getElementById('journalModalTitle').textContent = 'Edit Journal Entry';
    document.getElementById('editJournalId').value = je.id;
    document.getElementById('journalForm').reset();
    document.getElementById('journalDate').value = je.date;
    document.getElementById('journalRef').value = je.reference || '';
    document.getElementById('journalMemo').value = je.memo || '';
    document.getElementById('journalCurrency').value = je.currency || getBaseCurrencyCode();
    const container = document.getElementById('journalLinesContainer');
    container.innerHTML = '';
    (je.lines && je.lines.length ? je.lines : [{}]).forEach(l => addJournalLineRow(l.accountId, l.debit, l.credit, l.note));
    recalcJournalTotals();
    document.getElementById('journalModal').classList.add('active');
}

function closeJournalModal() {
    document.getElementById('journalModal').classList.remove('active');
}

function addJournalLineRow(accountId, debit, credit, note) {
    const container = document.getElementById('journalLinesContainer');
    const row = document.createElement('div');
    row.className = 'journal-line';
    row.innerHTML = `
        <select class="select-md js-line-account"><option value="">Select account</option></select>
        <input type="number" class="input-md js-line-debit" step="0.01" min="0" placeholder="0.00" value="${debit || ''}">
        <input type="number" class="input-md js-line-credit" step="0.01" min="0" placeholder="0.00" value="${credit || ''}">
        <input type="text" class="input-md js-line-note" placeholder="Note (optional)" value="${note || ''}">
        <button type="button" class="btn-icon-delete js-line-remove" title="Remove line"><i class="fa-solid fa-xmark"></i></button>
    `;
    const accSel = row.querySelector('.js-line-account');
    state.accounts.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.code} — ${a.name}`;
        accSel.appendChild(opt);
    });
    if (accountId && accSel.querySelector(`option[value="${accountId}"]`)) accSel.value = accountId;
    const recalc = () => recalcJournalTotals();
    row.querySelector('.js-line-remove').addEventListener('click', () => { row.remove(); recalc(); });
    row.querySelector('.js-line-debit').addEventListener('input', recalc);
    row.querySelector('.js-line-credit').addEventListener('input', recalc);
    container.appendChild(row);
}

function recalcJournalTotals() {
    const rows = document.querySelectorAll('#journalLinesContainer .journal-line');
    let dr = 0, cr = 0;
    rows.forEach(r => {
        dr += parseFloat(r.querySelector('.js-line-debit').value) || 0;
        cr += parseFloat(r.querySelector('.js-line-credit').value) || 0;
    });
    const diff = dr - cr;
    const el = document.getElementById('journalBalanced');
    if (el) {
        if (rows.length === 0) {
            el.textContent = '';
            el.style.color = 'var(--color-text-muted)';
        } else if (Math.abs(diff) < 0.001) {
            el.textContent = 'Balanced: Debits = Credits';
            el.style.color = 'var(--color-success)';
        } else {
            el.textContent = `Difference: ${formatCurrency(Math.abs(diff))} (${diff > 0 ? 'Debit' : 'Credit'})`;
            el.style.color = 'var(--color-danger)';
        }
    }
}

function saveJournalEntry(e) {
    try {
        e.preventDefault();
        const id = document.getElementById('editJournalId').value;
        const date = document.getElementById('journalDate').value;
        const reference = document.getElementById('journalRef').value.trim() || nextJournalRef();
        const memo = document.getElementById('journalMemo').value.trim();
        const currency = document.getElementById('journalCurrency').value;
        if (!date) { showToast('Date is required', 'danger'); return; }
        const rows = document.querySelectorAll('#journalLinesContainer .journal-line');
        const lines = [];
        let dr = 0, cr = 0;
        rows.forEach(r => {
            const accountId = r.querySelector('.js-line-account').value;
            const debit = parseFloat(r.querySelector('.js-line-debit').value) || 0;
            const credit = parseFloat(r.querySelector('.js-line-credit').value) || 0;
            if (!accountId && debit === 0 && credit === 0) return;
            if (!accountId) { showToast('Every line needs an account', 'danger'); return; }
            if (debit > 0 && credit > 0) { showToast('A line cannot have both debit and credit', 'danger'); return; }
            if (debit === 0 && credit === 0) { showToast('Every line needs a debit or credit amount', 'danger'); return; }
            dr += debit; cr += credit;
            lines.push({ accountId, debit, credit, note: r.querySelector('.js-line-note').value.trim() });
        });
        if (lines.length < 2) { showToast('A journal entry needs at least two lines', 'danger'); return; }
        if (Math.abs(dr - cr) > 0.001) { showToast('Debits and credits must balance', 'danger'); return; }
        const data = { date, reference, memo, currency, lines };
        if (id) {
            const idx = state.journalEntries.findIndex(je => je.id === id);
            if (idx !== -1) { state.journalEntries[idx] = { ...state.journalEntries[idx], ...data }; showToast('Journal entry updated', 'success'); }
        } else {
            data.id = generateId();
            state.journalEntries.push(data);
            showToast('Journal entry recorded', 'success');
        }
        saveState();
        closeJournalModal();
        renderJournal();
        if (uiState.activeView === 'ledger') renderLedger();
        if (uiState.activeView === 'statements') renderStatements();
    } catch (err) { console.error('saveJournalEntry error:', err); }
}

function deleteJournalEntry(id) {
    if (confirm('Delete this journal entry permanently? This removes its lines from ledgers and statements.')) {
        state.journalEntries = state.journalEntries.filter(je => je.id !== id);
        saveState();
        renderJournal();
        if (uiState.activeView === 'ledger') renderLedger();
        if (uiState.activeView === 'statements') renderStatements();
        showToast('Journal entry deleted', 'success');
    }
}

// ===== DOUBLE-ENTRY: LEDGER =====
function populateLedgerAccountSelect() {
    const sel = document.getElementById('ledgerAccount');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    state.accounts.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.code} — ${a.name}`;
        sel.appendChild(opt);
    });
    if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
}

function getLedgerPeriod() {
    const p = uiState.ledgerPeriod || 'all';
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const iso = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0];
    if (p === 'this-month') return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    if (p === 'last-month') return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    if (p === 'this-year') return { start: `${y}-01-01`, end: `${y}-12-31` };
    if (p === 'custom') return { start: uiState.ledgerStart || null, end: uiState.ledgerEnd || null };
    return { start: null, end: null };
}

function renderLedger() {
    try {
        populateLedgerAccountSelect();
        if (uiState.ledgerAccountId && document.getElementById('ledgerAccount').querySelector(`option[value="${uiState.ledgerAccountId}"]`)) {
            document.getElementById('ledgerAccount').value = uiState.ledgerAccountId;
        }
        const sel = document.getElementById('ledgerAccount');
        uiState.ledgerAccountId = sel.value;
        document.getElementById('ledgerPeriod').value = uiState.ledgerPeriod || 'all';
        toggleCustomRange('ledgerCustomRange', uiState.ledgerPeriod || 'all');
        document.getElementById('ledgerStart').value = uiState.ledgerStart || '';
        document.getElementById('ledgerEnd').value = uiState.ledgerEnd || '';

        const account = state.accounts.find(a => a.id === sel.value);
        const tbody = document.getElementById('ledgerTableBody');
        const empty = document.getElementById('ledgerEmptyMsg');
        tbody.innerHTML = '';
        const acctName = document.getElementById('ledgerAccountName');
        if (!account) {
            if (acctName) acctName.textContent = '';
            document.getElementById('ledgerOpening').textContent = '—';
            document.getElementById('ledgerTotalDr').textContent = '—';
            document.getElementById('ledgerTotalCr').textContent = '—';
            document.getElementById('ledgerClosing').textContent = '—';
            empty.classList.remove('hidden');
            return;
        }
        if (acctName) acctName.textContent = `${account.code} — ${account.name}`;

        const { start, end } = getLedgerPeriod();
        let openingDr = 0, openingCr = 0;
        const lines = [];
        getJournalLines().forEach(l => {
            if (l.accountId !== account.id) return;
            if (start && l.date < start) { openingDr += convertToBase(l.debit, l.currency); openingCr += convertToBase(l.credit, l.currency); return; }
            if (end && l.date > end) return;
            lines.push(l);
        });
        lines.sort((a, b) => new Date(a.date) - new Date(b.date));

        const side = accountNormalSide(account.type);
        let running = side === 'debit' ? openingDr - openingCr : openingCr - openingDr;
        document.getElementById('ledgerOpening').textContent = running === 0 ? '—' : formatCurrency(running);
        if (lines.length === 0) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            lines.forEach((l, i) => {
                const tr = document.createElement('tr');
                tr.style.animation = `rowIn 0.3s ease-out forwards`;
                tr.style.animationDelay = `${i * 0.02}s`;
                const bal = running + (side === 'debit' ? convertToBase(l.debit, l.currency) - convertToBase(l.credit, l.currency) : convertToBase(l.credit, l.currency) - convertToBase(l.debit, l.currency));
                running = bal;
                const balLabel = bal === 0 ? '—' : `${formatCurrency(bal)} <span style="font-size:11px;color:var(--color-text-muted)">${bal > 0 ? (side === 'debit' ? 'Dr' : 'Cr') : (side === 'debit' ? 'Cr' : 'Dr')}</span>`;
                tr.innerHTML = `
                    <td>${formatTableDate(l.date)}</td>
                    <td>${l.reference || '-'}</td>
                    <td>${l.note || l.memo || ''}</td>
                    <td class="text-right">${l.debit ? formatCurrency(convertToBase(l.debit, l.currency)) : ''}</td>
                    <td class="text-right">${l.credit ? formatCurrency(convertToBase(l.credit, l.currency)) : ''}</td>
                    <td class="text-right" style="font-weight:600;font-family:var(--font-heading)">${balLabel}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        const totDr = lines.reduce((s, l) => s + convertToBase(l.debit, l.currency), 0);
        const totCr = lines.reduce((s, l) => s + convertToBase(l.credit, l.currency), 0);
        document.getElementById('ledgerTotalDr').textContent = totDr ? formatCurrency(totDr) : '—';
        document.getElementById('ledgerTotalCr').textContent = totCr ? formatCurrency(totCr) : '—';
        document.getElementById('ledgerClosing').textContent = running === 0 ? '—' : formatCurrency(running);
    } catch (e) { console.error('renderLedger error:', e); }
}

function exportLedgerCSV() {
    try {
        const accountId = document.getElementById('ledgerAccount').value;
        const account = state.accounts.find(a => a.id === accountId);
        if (!account) { showToast('No account selected', 'danger'); return; }
        const { start, end } = getLedgerPeriod();
        const lines = getJournalLines().filter(l => l.accountId === accountId && (!start || l.date >= start) && (!end || l.date <= end)).sort((a, b) => new Date(a.date) - new Date(b.date));
        if (lines.length === 0) { showToast('No ledger lines to export', 'danger'); return; }
        let csv = "\uFEFF";
        csv += `Date,Reference,Memo,Debit (${getBaseCurrencyCode()}),Credit (${getBaseCurrencyCode()}),Currency\n`;
        lines.forEach(l => {
            csv += `${l.date},${(l.reference || '').replace(/"/g, '""')},"${(l.note || l.memo || '').replace(/"/g, '""')}",${convertToBase(l.debit, l.currency).toFixed(2)},${convertToBase(l.credit, l.currency).toFixed(2)},${l.currency}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ledger_${account.code}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Ledger exported', 'success');
    } catch (e) { console.error('exportLedgerCSV error:', e); }
}

// ===== DOUBLE-ENTRY: STATEMENTS =====
function getStmtRange() {
    const p = uiState.stmtPeriod || 'all';
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const iso = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0];
    if (p === 'this-month') return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    if (p === 'last-month') return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    if (p === 'this-year') return { start: `${y}-01-01`, end: `${y}-12-31` };
    if (p === 'custom') return { start: uiState.stmtStart || null, end: uiState.stmtEnd || null };
    return { start: null, end: null };
}

function renderStatements() {
    try {
        document.getElementById('stmtPeriod').value = uiState.stmtPeriod || 'all';
        toggleCustomRange('stmtCustomRange', uiState.stmtPeriod || 'all');
        document.getElementById('stmtStart').value = uiState.stmtStart || '';
        document.getElementById('stmtEnd').value = uiState.stmtEnd || '';
        const { start, end } = getStmtRange();

        // Trial Balance
        const tbBody = document.getElementById('tbBody');
        tbBody.innerHTML = '';
        let totalDr = 0, totalCr = 0;
        state.accounts.forEach(a => {
            const { dr, cr } = getAccountDrCr(a.id, start, end);
            if (dr === 0 && cr === 0) return;
            totalDr += dr; totalCr += cr;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${a.code}</strong></td>
                <td>${a.name}</td>
                <td class="text-right">${dr ? formatCurrency(dr) : ''}</td>
                <td class="text-right">${cr ? formatCurrency(cr) : ''}</td>
            `;
            tbBody.appendChild(tr);
        });
        document.getElementById('tbTotalDr').textContent = formatCurrency(totalDr);
        document.getElementById('tbTotalCr').textContent = formatCurrency(totalCr);
        const diff = totalDr - totalCr;
        const tbDiff = document.getElementById('tbDiff');
        tbDiff.textContent = Math.abs(diff) < 0.001 ? 'Trial Balance is balanced' : `Out of balance by ${formatCurrency(diff)}`;
        tbDiff.style.color = Math.abs(diff) < 0.001 ? 'var(--color-success)' : 'var(--color-danger)';

        // P&L
        const incomeRows = [], expenseRows = [];
        let income = 0, expenses = 0;
        state.accounts.forEach(a => {
            const { dr, cr } = getAccountDrCr(a.id, start, end);
            if (a.type === 'revenue') {
                const net = cr - dr;
                if (Math.abs(net) > 0.001) incomeRows.push({ name: a.name, amt: net });
                income += net;
            } else if (a.type === 'expense') {
                const net = dr - cr;
                if (Math.abs(net) > 0.001) expenseRows.push({ name: a.name, amt: net });
                expenses += net;
            }
        });
        document.getElementById('plBody').innerHTML = '';
        incomeRows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.name}</td><td class="text-right" style="color:var(--color-success)">${formatCurrency(r.amt)}</td>`;
            document.getElementById('plBody').appendChild(tr);
        });
        document.getElementById('plExpenseBody').innerHTML = '';
        expenseRows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.name}</td><td class="text-right" style="color:var(--color-danger)">${formatCurrency(r.amt)}</td>`;
            document.getElementById('plExpenseBody').appendChild(tr);
        });
        document.getElementById('plIncome').textContent = formatCurrency(income);
        document.getElementById('plExpenses').textContent = formatCurrency(expenses);
        const netIncome = income - expenses;
        const plNet = document.getElementById('plNet');
        plNet.textContent = formatCurrency(netIncome);
        plNet.style.color = netIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
        const plNetLabel = document.getElementById('plNetLabel');
        if (plNetLabel) plNetLabel.textContent = netIncome >= 0 ? 'Net Income' : 'Net Loss';

        // Balance Sheet (cumulative to period end)
        const bsBody = document.getElementById('bsBody');
        bsBody.innerHTML = '';
        const liabBody = document.getElementById('bsLiabBody');
        liabBody.innerHTML = '';
        let totalAssets = 0, totalLiab = 0;
        state.accounts.forEach(a => {
            const { dr, cr } = getAccountDrCr(a.id, null, end);
            if (a.type === 'asset') {
                const net = dr - cr;
                if (Math.abs(net) > 0.001) {
                    totalAssets += net;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${a.name}</td><td class="text-right">${formatCurrency(net)}</td>`;
                    bsBody.appendChild(tr);
                }
            } else if (a.type === 'liability') {
                const net = cr - dr;
                if (Math.abs(net) > 0.001) {
                    totalLiab += net;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${a.name}</td><td class="text-right">${formatCurrency(net)}</td>`;
                    liabBody.appendChild(tr);
                }
            } else if (a.type === 'equity') {
                totalLiab += (cr - dr);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${a.name}</td><td class="text-right">${formatCurrency(cr - dr)}</td>`;
                liabBody.appendChild(tr);
            }
        });
        let cumIncome = 0;
        state.accounts.forEach(a => {
            if (a.type !== 'revenue' && a.type !== 'expense') return;
            const { dr, cr } = getAccountDrCr(a.id, null, end);
            cumIncome += (a.type === 'revenue') ? (cr - dr) : -(dr - cr);
        });
        totalLiab += cumIncome;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>Retained Earnings (${cumIncome >= 0 ? 'Profit' : 'Loss'})</td><td class="text-right">${formatCurrency(cumIncome)}</td>`;
        liabBody.appendChild(tr);
        document.getElementById('bsAssets').textContent = formatCurrency(totalAssets);
        document.getElementById('bsTotal').textContent = formatCurrency(totalLiab);
        const bsMatch = document.getElementById('bsMatch');
        const bsDiff = totalAssets - totalLiab;
        bsMatch.textContent = Math.abs(bsDiff) < 0.001 ? 'Balance Sheet is balanced' : `Off by ${formatCurrency(bsDiff)}`;
        bsMatch.style.color = Math.abs(bsDiff) < 0.001 ? 'var(--color-success)' : 'var(--color-danger)';
    } catch (e) { console.error('renderStatements error:', e); }
}

// ===== MODAL / CRUD =====
function openAddModal() {
    try {
    document.getElementById('modalTitle').textContent = 'New Trade';
    document.getElementById('editTradeId').value = '';
    document.getElementById('tradeForm').reset();
    document.getElementById('tradeDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('tradeBuyCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeSellCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeCommissionCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeFreightCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeInsuranceCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeInspectionCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeDutiesCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeOtherCostCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeBuyOtherCurrency').value = getBaseCurrencyCode();
    document.getElementById('tradeStatus').value = 'open';
    document.getElementById('tradeModal').classList.add('active');
    } catch (e) { console.error('openAddModal error:', e); throw e; }
}

function openEditModal(tradeId) {
    try {
    const t = state.trades.find(t => t.id === tradeId);
    if (!t) return;
    document.getElementById('modalTitle').textContent = 'Edit Trade';
    document.getElementById('editTradeId').value = t.id;
    document.getElementById('tradeDate').value = t.date;
    document.getElementById('tradeGrade').value = t.gradeId;
    document.getElementById('tradeQuantity').value = t.quantity;
    document.getElementById('tradeBuyPrice').value = t.buyPrice;
    document.getElementById('tradeBuyCurrency').value = t.buyCurrency;
    document.getElementById('tradeBuyIncoterm').value = t.buyIncoterm;
    document.getElementById('tradeSupplier').value = t.supplier;
    document.getElementById('tradeSellPrice').value = t.sellPrice;
    document.getElementById('tradeSellCurrency').value = t.sellCurrency;
    document.getElementById('tradeSellIncoterm').value = t.sellIncoterm;
    document.getElementById('tradeBuyer').value = t.buyer;
    document.getElementById('tradeCommission').value = t.commission || '';
    document.getElementById('tradeCommissionCurrency').value = t.commissionCurrency || t.buyCurrency;
    document.getElementById('tradeCommissionTo').value = t.commissionTo || '';
    document.getElementById('tradeStatus').value = t.status;
    document.getElementById('tradeNotes').value = t.notes || '';
    document.getElementById('tradeFreightCost').value = t.freightCost || '';
    document.getElementById('tradeFreightCurrency').value = t.freightCurrency || t.buyCurrency;
    document.getElementById('tradeInsuranceCost').value = t.insuranceCost || '';
    document.getElementById('tradeInsuranceCurrency').value = t.insuranceCurrency || t.buyCurrency;
    document.getElementById('tradeInspectionCost').value = t.inspectionCost || '';
    document.getElementById('tradeInspectionCurrency').value = t.inspectionCurrency || t.buyCurrency;
    document.getElementById('tradeDutiesCost').value = t.dutiesCost || '';
    document.getElementById('tradeDutiesCurrency').value = t.dutiesCurrency || t.buyCurrency;
    document.getElementById('tradeOtherCost').value = t.otherCost || '';
    document.getElementById('tradeOtherCostCurrency').value = t.otherCostCurrency || t.buyCurrency;
    document.getElementById('tradeOtherCostLabel').value = t.otherCostLabel || 'Other';
    document.getElementById('tradeBuyOtherCost').value = t.buyOtherCost || '';
    document.getElementById('tradeBuyOtherCurrency').value = t.buyOtherCurrency || t.buyCurrency;
    document.getElementById('tradeModal').classList.add('active');
    } catch (e) { console.error('openEditModal error:', e); throw e; }
}

function closeTradeModal() {
    document.getElementById('tradeModal').classList.remove('active');
}

function saveTrade(e) {
    try {
    e.preventDefault();
    const id = document.getElementById('editTradeId').value;
    const date = document.getElementById('tradeDate').value;
    const gradeId = document.getElementById('tradeGrade').value;
    const quantity = parseFloat(document.getElementById('tradeQuantity').value);
    const buyPrice = parseFloat(document.getElementById('tradeBuyPrice').value);
    const buyCurrency = document.getElementById('tradeBuyCurrency').value;
    const buyIncoterm = document.getElementById('tradeBuyIncoterm').value;
    const supplier = document.getElementById('tradeSupplier').value.trim();
    const sellPrice = parseFloat(document.getElementById('tradeSellPrice').value);
    const sellCurrency = document.getElementById('tradeSellCurrency').value;
    const sellIncoterm = document.getElementById('tradeSellIncoterm').value;
    const buyer = document.getElementById('tradeBuyer').value.trim();
    const commission = parseFloat(document.getElementById('tradeCommission').value) || 0;
    const commissionCurrency = document.getElementById('tradeCommissionCurrency').value;
    const commissionTo = document.getElementById('tradeCommissionTo').value.trim();
    const status = document.getElementById('tradeStatus').value;
    const notes = document.getElementById('tradeNotes').value.trim();

    const freightCost = parseFloat(document.getElementById('tradeFreightCost').value) || 0;
    const freightCurrency = document.getElementById('tradeFreightCurrency').value || buyCurrency;
    const insuranceCost = parseFloat(document.getElementById('tradeInsuranceCost').value) || 0;
    const insuranceCurrency = document.getElementById('tradeInsuranceCurrency').value || buyCurrency;
    const inspectionCost = parseFloat(document.getElementById('tradeInspectionCost').value) || 0;
    const inspectionCurrency = document.getElementById('tradeInspectionCurrency').value || buyCurrency;
    const dutiesCost = parseFloat(document.getElementById('tradeDutiesCost').value) || 0;
    const dutiesCurrency = document.getElementById('tradeDutiesCurrency').value || buyCurrency;
    const otherCost = parseFloat(document.getElementById('tradeOtherCost').value) || 0;
    const otherCostCurrency = document.getElementById('tradeOtherCostCurrency').value || buyCurrency;
    const otherCostLabel = document.getElementById('tradeOtherCostLabel').value.trim() || 'Other';
    const buyOtherCost = parseFloat(document.getElementById('tradeBuyOtherCost').value) || 0;
    const buyOtherCurrency = document.getElementById('tradeBuyOtherCurrency').value || buyCurrency;

    if (!date || !quantity || quantity <= 0 || !buyPrice || buyPrice <= 0 || !sellPrice || sellPrice <= 0 || !supplier || !buyer) {
        showToast('Please fill in all required fields', 'danger');
        return;
    }

    const data = { date, gradeId, quantity, buyPrice, buyCurrency, buyIncoterm, supplier, sellPrice, sellCurrency, sellIncoterm, buyer, commission, commissionCurrency, commissionTo, status, notes, freightCost, freightCurrency, insuranceCost, insuranceCurrency, inspectionCost, inspectionCurrency, dutiesCost, dutiesCurrency, otherCost, otherCostCurrency, otherCostLabel, buyOtherCost, buyOtherCurrency };

    if (id) {
        const idx = state.trades.findIndex(t => t.id === id);
        if (idx !== -1) { state.trades[idx] = { ...state.trades[idx], ...data }; showToast('Trade updated', 'success'); }
    } else {
        data.id = 'td-' + Date.now();
        state.trades.push(data);
        showToast('Trade recorded', 'success');
    }
    saveState();
    closeTradeModal();
    updateUI();
    } catch (e) { console.error('saveTrade error:', e); throw e; }
}

function deleteTrade(tradeId) {
    if (confirm('Delete this trade permanently?')) {
        state.trades = state.trades.filter(t => t.id !== tradeId);
        saveState();
        updateUI();
        showToast('Trade deleted', 'success');
    }
}

function clearAllTrades() {
    const c = state.trades.length;
    if (c === 0) { showToast('No trades to clear', 'info'); return; }
    if (confirm(`Delete all ${c} trades permanently?`)) {
        state.trades = [];
        saveState();
        updateUI();
        showToast(`All ${c} trades cleared`, 'success');
    }
}

// ===== GRADE MANAGEMENT =====
function addGrade() {
    const name = document.getElementById('newGradeName').value.trim();
    const color = document.getElementById('newGradeColor').value;
    if (!name) { showToast('Enter a grade name', 'danger'); return; }
    if (state.grades.find(g => g.name.toLowerCase() === name.toLowerCase())) {
        showToast('Grade already exists', 'danger');
        return;
    }
    state.grades.push({ id: 'grade-' + Date.now(), name, color });
    saveState();
    document.getElementById('newGradeName').value = '';
    populateGradeDropdowns();
    renderSettings();
    showToast(`Grade "${name}" added`, 'success');
}

function deleteGrade(gradeId) {
    const count = state.trades.filter(t => t.gradeId === gradeId).length;
    if (count > 0) { showToast(`Cannot delete — used in ${count} trade(s)`, 'danger'); return; }
    if (state.grades.length <= 1) { showToast('Keep at least one grade', 'danger'); return; }
    const g = state.grades.find(g => g.id === gradeId);
    state.grades = state.grades.filter(g => g.id !== gradeId);
    saveState();
    populateGradeDropdowns();
    renderSettings();
    showToast(`Grade "${g.name}" removed`, 'success');
}

// ===== EXPORT/IMPORT =====
function exportToCSV() {
    const filtered = getFilteredTrades();
    if (filtered.length === 0) { showToast('No trades to export', 'danger'); return; }
    let csv = "\uFEFF";
    const base = getBaseCurrencyCode();
    csv += `Trade ID,Date,Grade,Quantity (MT),Buy Price (${base}),Buy Currency,Buy Incoterm,Supplier,Sell Price (${base}),Sell Currency,Sell Incoterm,Buyer,Gross P&L (${base}),Freight (${base}),Insurance (${base}),Inspection (${base}),Duties (${base}),Other Costs (${base}),Buy Other Cost (${base}),Total Landing Costs (${base}),Commission (${base}),Net P&L (${base}),Commission To,Status,Notes\n`;
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(t => {
        const pnl = calcTradePnL(t);
        const g = state.grades.find(g => g.id === t.gradeId)?.name || 'Unknown';
        const esc = (s) => `"${(s || '').replace(/"/g, '""')}"`;
        csv += `${t.id},${t.date},${esc(g)},${t.quantity},${convertToBase(t.buyPrice, t.buyCurrency).toFixed(2)},${t.buyCurrency},${esc(t.buyIncoterm)},${esc(t.supplier)},${convertToBase(t.sellPrice, t.sellCurrency).toFixed(2)},${t.sellCurrency},${esc(t.sellIncoterm)},${esc(t.buyer)},${pnl.grossPnL.toFixed(2)},${pnl.freight.toFixed(2)},${pnl.insurance.toFixed(2)},${pnl.inspection.toFixed(2)},${pnl.duties.toFixed(2)},${pnl.other.toFixed(2)},${pnl.buyOther.toFixed(2)},${pnl.totalLandingCosts.toFixed(2)},${pnl.commissionBase.toFixed(2)},${pnl.netPnL.toFixed(2)},${esc(t.commissionTo)},${t.status},${esc(t.notes)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `acuity_trades_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Trades exported to CSV', 'success');
}

function exportToJSON() {
    const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 4));
    const link = document.createElement('a');
    link.href = data;
    link.download = 'acuity_ledger_backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Backup exported', 'success');
}

function triggerImportJSON() { document.getElementById('importJSONInput').click(); }

function importFromJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const p = JSON.parse(evt.target.result);
            if (p.settings && p.grades && p.trades) {
                state.settings = p.settings; state.grades = p.grades; state.trades = p.trades;
                saveState();
                populateGradeDropdowns();
                populateCurrencySelects();
                updateUI();
                showToast('Data restored successfully', 'success');
            } else showToast('Invalid backup file', 'danger');
        } catch (err) { showToast('Failed to parse backup file', 'danger'); }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function exportMonthlyReportCSV() {
    const sel = document.getElementById('summaryMonth');
    if (!sel || !sel.value) { showToast('No month selected', 'danger'); return; }
    const [year, month] = sel.value.split('-');
    const mn = parseInt(month), yr = parseInt(year);
    const startDate = new Date(yr, mn - 1, 1);
    const endDate = new Date(yr, mn, 0, 23, 59, 59, 999);
    const monthLabel = monthLabelFromKey(sel.value);
    let tradePnL = 0, volume = 0, buys = 0;
    const gradeData = {};
    state.trades.forEach(t => {
        const d = new Date(t.date);
        if (d.getMonth() === mn - 1 && d.getFullYear() === yr) {
            volume += t.quantity;
            buys += convertToBase(t.buyPrice * t.quantity, t.buyCurrency);
            if (t.status === 'closed') { const p = calcTradePnL(t); tradePnL += p.netPnL; gradeData[t.gradeId] = (gradeData[t.gradeId] || 0) + p.netPnL; }
        }
    });
    let totalExpenses = 0, payroll = 0;
    const expByAccount = {};
    state.transactions.forEach(t => {
        const d = new Date(t.date);
        if (d >= startDate && d <= endDate) {
            const amt = convertToBase(t.amount, t.currency);
            if (t.type === 'expense') { totalExpenses += amt; if (!expByAccount[t.accountId]) expByAccount[t.accountId] = { expense: 0, salary: 0 }; expByAccount[t.accountId].expense += amt; }
            else if (t.type === 'salary') { payroll += amt; if (!expByAccount[t.accountId]) expByAccount[t.accountId] = { expense: 0, salary: 0 }; expByAccount[t.accountId].salary += amt; }
        }
    });
    const netResult = tradePnL - totalExpenses - payroll;
    const margin = buys > 0 ? (tradePnL / buys) * 100 : 0;
    if (volume === 0 && tradePnL === 0 && totalExpenses === 0 && payroll === 0) { showToast('No data for this month', 'danger'); return; }
    let csv = '\uFEFF';
    const esc = (s) => `"${(s || '').toString().replace(/"/g, '""')}"`;
    csv += `Monthly Report: ${monthLabel}\n`;
    csv += 'Metric,Value\n';
    csv += `Trading P&L,${tradePnL.toFixed(2)}\n`;
    csv += `Volume (MT),${volume}\n`;
    csv += `Total Expenses,${totalExpenses.toFixed(2)}\n`;
    csv += `Payroll,${payroll.toFixed(2)}\n`;
    csv += `Net Result,${netResult.toFixed(2)}\n`;
    csv += `Margin (%),${margin.toFixed(1)}\n`;
    csv += '\nP&L by Grade\nGrade,P&L\n';
    const gradeKeys = Object.keys(gradeData).sort((a, b) => gradeData[b] - gradeData[a]);
    if (gradeKeys.length === 0) { csv += 'No closed trades,0.00\n'; }
    else { gradeKeys.forEach(gId => { const g = state.grades.find(g => g.id === gId) || { name: 'Unknown' }; csv += `${esc(g.name)},${gradeData[gId].toFixed(2)}\n`; }); }
    csv += '\nExpenses by Account\nAccount,Amount\n';
    const expItems = [], salItems = [];
    Object.keys(expByAccount).forEach(accId => {
        if (expByAccount[accId].expense > 0) expItems.push({ accountId: accId, amt: expByAccount[accId].expense });
        if (expByAccount[accId].salary > 0) salItems.push({ accountId: accId, amt: expByAccount[accId].salary });
    });
    if (expItems.length === 0 && salItems.length === 0) { csv += 'No expenses,0.00\n'; }
    else {
        [...expItems, ...salItems].forEach(item => {
            const isSal = salItems.some(s => s.accountId === item.accountId && s.amt === item.amt);
            const acc = state.accounts.find(a => a.id === item.accountId) || { name: 'Unknown' };
            csv += `${esc(isSal ? `${acc.name} (Payroll)` : acc.name)},${item.amt.toFixed(2)}\n`;
        });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `acuity_monthly_${sel.value}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Monthly report exported', 'success');
}

function saveGeneralSettings(e) {
    e.preventDefault();
    const currency = document.getElementById('setUserCurrency').value;
    const currencyCustom = document.getElementById('setUserCustomCurrency').value.trim();
    const currencyCode = document.getElementById('setUserCustomCurrencyCode').value.trim().toUpperCase();
    const currencyPosition = document.querySelector('input[name="currencyPosition"]:checked').value;
    const businessName = document.getElementById('setBusinessName').value.trim();
    const symbolToCode = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY', '₪': 'ILS' };
    state.settings = {
        currency: currency || '$',
        currencyCustom: currency === 'custom' ? currencyCustom : '',
        currencyCode: currency === 'custom' ? currencyCode : (symbolToCode[currency] || ''),
        currencyPosition: currencyPosition || 'prefix',
        businessName: businessName || 'My Trading Co.'
    };
    saveState();
    updateUI();
    showToast('Settings saved', 'success');
}

function resetAllData() {
    if (confirm('WARNING: This deletes ALL trades, grades, and settings permanently. Continue?')) {
        localStorage.removeItem('acuity_ledger_state');
        loadDefaults();
        populateGradeDropdowns();
        populateCurrencySelects();
        changeView('dashboard');
        showToast('All data reset', 'danger');
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            changeView(item.getAttribute('data-target'));
        });
    });

    document.getElementById('sidebarToggle').addEventListener('click', () => document.getElementById('sidebar').classList.add('active'));
    document.getElementById('sidebarClose').addEventListener('click', () => document.getElementById('sidebar').classList.remove('active'));

    document.getElementById('themeToggle').addEventListener('click', () => {
        const body = document.body;
        const icon = document.querySelector('#themeToggle i');
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode'); body.classList.add('light-mode');
            icon.className = 'fa-solid fa-sun';
        } else {
            body.classList.remove('light-mode'); body.classList.add('dark-mode');
            icon.className = 'fa-solid fa-moon';
        }
        if (uiState.activeView === 'dashboard') buildDashboardCharts();
        else if (uiState.activeView === 'reports') renderReports();
    });

    document.getElementById('btnOpenAddModal').addEventListener('click', openAddModal);
    document.getElementById('btnCloseModal').addEventListener('click', closeTradeModal);
    document.getElementById('btnCancelModal').addEventListener('click', closeTradeModal);
    document.getElementById('tradeModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeTradeModal(); });
    document.getElementById('tradeForm').addEventListener('submit', saveTrade);

    document.getElementById('globalSearch').addEventListener('input', (e) => {
        uiState.filters.search = e.target.value.trim();
        document.getElementById('tradesSearch').value = e.target.value.trim();
        if (uiState.activeView !== 'trades') changeView('trades');
        else renderTradesTable();
    });

    document.getElementById('tradesSearch').addEventListener('input', (e) => {
        uiState.filters.search = e.target.value.trim();
        document.getElementById('globalSearch').value = e.target.value.trim();
        renderTradesTable();
    });

    document.getElementById('filterGrade').addEventListener('change', (e) => { uiState.filters.grade = e.target.value; renderTradesTable(); });
    document.getElementById('filterStatus').addEventListener('change', (e) => { uiState.filters.status = e.target.value; renderTradesTable(); });
    document.getElementById('filterDateRange').addEventListener('change', (e) => {
        uiState.filters.dateRange = e.target.value;
        const ci = document.getElementById('customDateRangeInputs');
        if (e.target.value === 'custom') ci.classList.remove('hidden');
        else ci.classList.add('hidden');
        renderTradesTable();
    });
    document.getElementById('filterStartDate').addEventListener('change', (e) => { uiState.filters.startDate = e.target.value; renderTradesTable(); });
    document.getElementById('filterEndDate').addEventListener('change', (e) => { uiState.filters.endDate = e.target.value; renderTradesTable(); });

    document.querySelectorAll('.trades-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const f = th.getAttribute('data-sort');
            if (uiState.sortField === f) uiState.sortOrder = uiState.sortOrder === 'asc' ? 'desc' : 'asc';
            else { uiState.sortField = f; uiState.sortOrder = 'desc'; }
            renderTradesTable();
        });
    });

    document.getElementById('btnExportCSV').addEventListener('click', exportToCSV);
    document.getElementById('btnExportJSON').addEventListener('click', exportToJSON);
    document.getElementById('btnTriggerImport').addEventListener('click', triggerImportJSON);
    document.getElementById('importJSONInput').addEventListener('change', importFromJSON);
    document.getElementById('btnClearTrades').addEventListener('click', clearAllTrades);

    document.getElementById('chartTimeframe').addEventListener('change', () => { if (uiState.activeView === 'dashboard') buildDashboardCharts(); });

    document.getElementById('dashboardDateRange').addEventListener('change', (e) => {
        uiState.dashboardDateRange = e.target.value;
        const ci = document.getElementById('dashboardCustomRange');
        if (e.target.value === 'custom') ci.classList.remove('hidden');
        else ci.classList.add('hidden');
        if (uiState.activeView === 'dashboard') renderDashboard();
    });
    document.getElementById('dashboardStartDate').addEventListener('change', (e) => { uiState.dashboardStartDate = e.target.value; if (uiState.activeView === 'dashboard') renderDashboard(); });
    document.getElementById('dashboardEndDate').addEventListener('change', (e) => { uiState.dashboardEndDate = e.target.value; if (uiState.activeView === 'dashboard') renderDashboard(); });

    document.getElementById('linkViewAllTrades').addEventListener('click', (e) => { e.preventDefault(); changeView('trades'); });

    document.getElementById('btnAddGrade').addEventListener('click', addGrade);
    document.getElementById('settingsForm').addEventListener('submit', saveGeneralSettings);
    document.getElementById('setUserCurrency').addEventListener('change', (e) => {
        const w = document.getElementById('customCurrencyWrapper');
        if (e.target.value === 'custom') w.classList.remove('hidden');
        else w.classList.add('hidden');
    });
    document.getElementById('btnRefreshRates').addEventListener('click', refreshExchangeRates);
    document.getElementById('btnResetAllData').addEventListener('click', resetAllData);

    document.getElementById('summaryMonth')?.addEventListener('change', renderCombinedMonthlyReport);
    document.getElementById('btnExportMonthlyCSV')?.addEventListener('click', exportMonthlyReportCSV);
    document.getElementById('comparePeriod1')?.addEventListener('change', renderPeriodComparison);
    document.getElementById('comparePeriod2')?.addEventListener('change', renderPeriodComparison);
    document.getElementById('reportChartType')?.addEventListener('change', renderReportChart);

    // === ACCOUNTING EVENT LISTENERS ===
    document.getElementById('btnAddAccount').addEventListener('click', openAddAccountModal);
    document.getElementById('btnCloseAccountModal').addEventListener('click', closeAccountModal);
    document.getElementById('btnCancelAccount').addEventListener('click', closeAccountModal);
    document.getElementById('accountModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeAccountModal(); });
    document.getElementById('accountForm').addEventListener('submit', saveAccount);

    document.getElementById('btnAddTransaction').addEventListener('click', openAddTxnModal);
    document.getElementById('btnCloseTxnModal').addEventListener('click', closeTxnModal);
    document.getElementById('btnCancelTxn').addEventListener('click', closeTxnModal);
    document.getElementById('transactionModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeTxnModal(); });
    document.getElementById('transactionForm').addEventListener('submit', saveTransaction);
    document.getElementById('btnExportTxnsCSV').addEventListener('click', exportTxnsCSV);
    document.getElementById('txnAccount')?.addEventListener('change', function() {
        const accId = this.value;
        if (!accId) return;
        const acc = state.accounts.find(a => a.id === accId);
        if (!acc) return;
        const typeEl = document.getElementById('txnType');
        const descEl = document.getElementById('txnDescription');
        if (acc.type === 'revenue') {
            typeEl.value = 'revenue';
            if (!descEl.value) descEl.placeholder = 'e.g. Metal sale revenue';
        } else if (acc.type === 'expense') {
            if (acc.id === 'acc-salaries' || acc.name.toLowerCase().includes('salary') || acc.name.toLowerCase().includes('payroll')) {
                typeEl.value = 'salary';
                if (!descEl.value) descEl.placeholder = 'e.g. Monthly salary payment';
            } else {
                typeEl.value = 'expense';
                if (!descEl.value) descEl.placeholder = 'e.g. Office rent payment';
            }
        } else {
            if (!typeEl.value) typeEl.value = 'expense';
        }
    });

    document.getElementById('filterTxnAccount').addEventListener('change', (e) => { uiState.filters.txnAccount = e.target.value; renderTransactions(); });
    document.getElementById('filterTxnType').addEventListener('change', (e) => { uiState.filters.txnType = e.target.value; renderTransactions(); });
    document.getElementById('filterTxnDateRange').addEventListener('change', (e) => {
        uiState.filters.txnDateRange = e.target.value;
        const ci = document.getElementById('txnCustomRange');
        if (e.target.value === 'custom') ci.classList.remove('hidden');
        else ci.classList.add('hidden');
        renderTransactions();
    });
    document.getElementById('filterTxnStart').addEventListener('change', (e) => { uiState.filters.txnStart = e.target.value; renderTransactions(); });
    document.getElementById('filterTxnEnd').addEventListener('change', (e) => { uiState.filters.txnEnd = e.target.value; renderTransactions(); });

    document.getElementById('btnAddEmployee').addEventListener('click', openAddEmployeeModal);
    document.getElementById('btnCloseEmployeeModal').addEventListener('click', closeEmployeeModal);
    document.getElementById('btnCancelEmployee').addEventListener('click', closeEmployeeModal);
    document.getElementById('employeeModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeEmployeeModal(); });
    document.getElementById('employeeForm').addEventListener('submit', saveEmployee);

    document.getElementById('btnAddBankAccount').addEventListener('click', openAddBankModal);
    document.getElementById('btnCloseBankModal').addEventListener('click', closeBankModal);
    document.getElementById('btnCancelBank').addEventListener('click', closeBankModal);
    document.getElementById('bankModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeBankModal(); });
    document.getElementById('bankForm').addEventListener('submit', saveBankAccount);

    // === DOUBLE-ENTRY EVENT LISTENERS ===
    document.getElementById('btnAddJournal').addEventListener('click', openAddJournalModal);
    document.getElementById('btnCloseJournalModal').addEventListener('click', closeJournalModal);
    document.getElementById('btnCancelJournal').addEventListener('click', closeJournalModal);
    document.getElementById('journalModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeJournalModal(); });
    document.getElementById('journalForm').addEventListener('submit', saveJournalEntry);
    document.getElementById('btnAddJournalLine').addEventListener('click', () => { addJournalLineRow(); recalcJournalTotals(); });
    document.getElementById('journalLinesContainer').addEventListener('input', recalcJournalTotals);

    document.getElementById('ledgerAccount').addEventListener('change', (e) => { uiState.ledgerAccountId = e.target.value; renderLedger(); });
    document.getElementById('ledgerPeriod').addEventListener('change', (e) => { uiState.ledgerPeriod = e.target.value; toggleCustomRange('ledgerCustomRange', e.target.value); renderLedger(); });
    document.getElementById('ledgerStart').addEventListener('change', (e) => { uiState.ledgerStart = e.target.value; renderLedger(); });
    document.getElementById('ledgerEnd').addEventListener('change', (e) => { uiState.ledgerEnd = e.target.value; renderLedger(); });
    document.getElementById('btnExportLedgerCSV').addEventListener('click', exportLedgerCSV);

    document.getElementById('stmtPeriod').addEventListener('change', (e) => { uiState.stmtPeriod = e.target.value; toggleCustomRange('stmtCustomRange', e.target.value); renderStatements(); });
    document.getElementById('stmtStart').addEventListener('change', (e) => { uiState.stmtStart = e.target.value; renderStatements(); });
    document.getElementById('stmtEnd').addEventListener('change', (e) => { uiState.stmtEnd = e.target.value; renderStatements(); });

    document.getElementById('reportAccountingPeriod')?.addEventListener('change', renderAccountingSummary);
}

window.openEditModal = openEditModal;
window.deleteTrade = deleteTrade;
window.deleteGrade = deleteGrade;
window.openEditAccountModal = openEditAccountModal;
window.deleteAccount = deleteAccount;
window.openEditTxnModal = openEditTxnModal;
window.deleteTransaction = deleteTransaction;
window.openEditEmployeeModal = openEditEmployeeModal;
window.deleteEmployee = deleteEmployee;
window.openEditBankModal = openEditBankModal;
window.deleteBankAccount = deleteBankAccount;
window.openEditJournalModal = openEditJournalModal;
window.deleteJournalEntry = deleteJournalEntry;

document.addEventListener('DOMContentLoaded', initApp);
