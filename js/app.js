/* ============================================================
   Expense & Budget Visualizer — app.js
   All 5 optional challenges:
     1. Custom categories     — add/remove your own spending categories
     2. Monthly summary view  — browse totals month-by-month with a bar chart
     3. Sort transactions     — newest · oldest · $ high · $ low · category
     4. Highlight over limit  — balance card + each transaction row is flagged
     5. Dark / Light mode     — toggle persisted in localStorage
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════
   Constants
══════════════════════════════════════════════════════════ */

const BUILTIN_CATEGORIES = [
  { name: 'Food',      color: '#f59e0b' },
  { name: 'Transport', color: '#3b82f6' },
  { name: 'Fun',       color: '#ec4899' },
];

// Rotating palette for custom categories
const AUTO_COLORS = [
  '#10b981', '#f43f5e', '#a855f7', '#06b6d4',
  '#84cc16', '#fb923c', '#e879f9', '#38bdf8',
];

const DEFAULT_LIMIT = 200;

// USD → IDR exchange rate (approximate)
const USD_TO_IDR = 15800;

// Month names used throughout
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

/* ══════════════════════════════════════════════════════════
   State
══════════════════════════════════════════════════════════ */

let transactions     = JSON.parse(localStorage.getItem('eb_transactions') || '[]');
let customCategories = JSON.parse(localStorage.getItem('eb_custom_cats')  || '[]');
let spendLimit       = parseFloat(localStorage.getItem('eb_limit')        || DEFAULT_LIMIT);
let sortKey          = localStorage.getItem('eb_sort')  || 'newest';
let theme            = localStorage.getItem('eb_theme') || 'dark';
let currency         = localStorage.getItem('eb_currency') || 'USD'; // 'USD' or 'IDR'

// Summary view: which month/year is currently shown
let summaryDate = new Date();   // .getMonth() / .getFullYear()

let pieChartInstance = null;
let barChartInstance = null;

/* ══════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════ */

function allCategories() {
  return [...BUILTIN_CATEGORIES, ...customCategories];
}

function colorFor(name) {
  const cat = allCategories().find(c => c.name === name);
  return cat ? cat.color : '#64748b';
}

/** Format a timestamp as "YYYY-MM" key */
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Human-readable month name from "YYYY-MM" */
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

/** Escape HTML to prevent XSS */
function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/** Get the CSS variable value from :root (or body for light mode) */
function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/* ══════════════════════════════════════════════════════════
   Persistence
══════════════════════════════════════════════════════════ */

function save() {
  localStorage.setItem('eb_transactions', JSON.stringify(transactions));
  localStorage.setItem('eb_custom_cats',  JSON.stringify(customCategories));
  localStorage.setItem('eb_limit',        spendLimit);
  localStorage.setItem('eb_sort',         sortKey);
  localStorage.setItem('eb_theme',        theme);
  localStorage.setItem('eb_currency',     currency);
}

/* ══════════════════════════════════════════════════════════
   DOM references
══════════════════════════════════════════════════════════ */

const balanceCardEl  = document.getElementById('balanceCard');
const balanceEl      = document.getElementById('balance');
const limitBadgeEl   = document.getElementById('limitBadge');
const overLimitBanner= document.getElementById('overLimitBanner');

const form           = document.getElementById('txForm');
const itemNameEl     = document.getElementById('itemName');
const amountEl       = document.getElementById('amount');
const categoryEl     = document.getElementById('category');
const nameErr        = document.getElementById('nameErr');
const amountErr      = document.getElementById('amountErr');
const catErr         = document.getElementById('catErr');

const txListEl       = document.getElementById('txList');

const pieChartEmpty  = document.getElementById('chartEmpty');
const pieChartWrap   = document.getElementById('chartWrapper');
const legendEl       = document.getElementById('legend');
const pieCanvas      = document.getElementById('pieChart');

const themeBtn       = document.getElementById('themeBtn');
const currencyBtn    = document.getElementById('currencyBtn');

const limitInput     = document.getElementById('limitInput');
const saveLimitBtn   = document.getElementById('saveLimitBtn');
const limitMsg       = document.getElementById('limitMsg');

const customInput    = document.getElementById('customCatInput');
const addCatBtn      = document.getElementById('addCatBtn');
const chipList       = document.getElementById('chipList');
const catInputErr    = document.getElementById('catInputErr');

// Monthly summary
const monthLabelEl   = document.getElementById('monthLabel');
const prevMonthBtn   = document.getElementById('prevMonth');
const nextMonthBtn   = document.getElementById('nextMonth');
const summaryTotals  = document.getElementById('summaryTotals');
const summaryChartWrap = document.getElementById('summaryChartWrap');
const barCanvas      = document.getElementById('barChart');
const allMonthsEl    = document.getElementById('allMonths');

/* ══════════════════════════════════════════════════════════
   Currency conversion — USD ↔ IDR
══════════════════════════════════════════════════════════ */

/** Format an amount (always stored in USD) for display in the active currency */
function formatAmount(usdAmount) {
  if (currency === 'IDR') {
    const idr = usdAmount * USD_TO_IDR;
    // Use compact Indonesian formatting: Rp 1.580.000
    return 'Rp ' + Math.round(idr).toLocaleString('id-ID');
  }
  return '$' + usdAmount.toFixed(2);
}

/** Currency symbol / prefix for labels */
function currencySymbol() {
  return currency === 'IDR' ? 'Rp' : '$';
}

function applyCurrency() {
  const isIDR = currency === 'IDR';
  currencyBtn.textContent = isIDR ? '🇺🇸 USD' : '🇮🇩 IDR';
  currencyBtn.setAttribute('aria-label', isIDR ? 'Switch to USD' : 'Switch to IDR');

  // Update form label
  const amountLabel = document.getElementById('amountLabel');
  if (amountLabel) amountLabel.textContent = isIDR ? 'Amount (Rp)' : 'Amount ($)';

  // Update limit label
  const limitLabel = document.getElementById('limitLabel');
  if (limitLabel) limitLabel.textContent = isIDR
    ? 'Alert me when total exceeds (Rp)'
    : 'Alert me when total exceeds ($)';

  // Update limit input placeholder / value shown
  limitInput.value = isIDR
    ? Math.round(spendLimit * USD_TO_IDR)
    : spendLimit;
}

currencyBtn.addEventListener('click', () => {
  // If switching away from IDR, convert the limit input back to USD first
  if (currency === 'IDR') {
    currency = 'USD';
  } else {
    currency = 'IDR';
  }
  save();
  applyCurrency();
  render();
});

/* ══════════════════════════════════════════════════════════
   Challenge 5 — Dark / Light mode toggle
══════════════════════════════════════════════════════════ */

function applyTheme() {
  document.body.classList.toggle('light', theme === 'light');
  themeBtn.textContent = theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode';
}

themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
  // Redraw charts so their border colours match the new surface
  refreshChartBorders();
});

function refreshChartBorders() {
  const surface = cssVar('--surface') || '#1e293b';
  if (pieChartInstance) {
    pieChartInstance.data.datasets[0].borderColor = surface;
    pieChartInstance.update();
  }
  if (barChartInstance) {
    barChartInstance.update();
  }
}

/* ══════════════════════════════════════════════════════════
   Tab navigation
══════════════════════════════════════════════════════════ */

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Deactivate all
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);

    // Activate clicked
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(`tab-${tab.dataset.tab}`).hidden = false;

    // Render summary when switching to that tab
    if (tab.dataset.tab === 'summary') renderSummary();
  });
});

/* ══════════════════════════════════════════════════════════
   Challenge 4 — Highlight spending over limit
══════════════════════════════════════════════════════════ */

function renderBalance() {
  const total    = transactions.reduce((s, t) => s + t.amount, 0);
  const exceeded = total > spendLimit;

  balanceEl.textContent = formatAmount(total);
  balanceEl.classList.toggle('over-limit', exceeded);

  const overBy = formatAmount(total - spendLimit);
  limitBadgeEl.textContent = exceeded
    ? `⚠️ Over limit by ${overBy}`
    : `Limit: ${formatAmount(spendLimit)}`;
  limitBadgeEl.classList.toggle('exceeded', exceeded);

  // Show/hide the full-width banner
  overLimitBanner.hidden = !exceeded;

  // Shake the card once when first exceeded
  if (exceeded) {
    balanceCardEl.classList.remove('shake');
    void balanceCardEl.offsetWidth; // reflow to restart animation
    balanceCardEl.classList.add('shake');
  } else {
    balanceCardEl.classList.remove('shake');
  }
}

/* ══════════════════════════════════════════════════════════
   Challenge 1 — Custom categories
══════════════════════════════════════════════════════════ */

function nextAutoColor() {
  return AUTO_COLORS[customCategories.length % AUTO_COLORS.length];
}

function addCustomCategory() {
  const name = customInput.value.trim();
  catInputErr.textContent = '';

  if (!name) {
    catInputErr.textContent = 'Category name cannot be empty.';
    return;
  }
  if (allCategories().some(c => c.name.toLowerCase() === name.toLowerCase())) {
    catInputErr.textContent = 'That category already exists.';
    return;
  }

  customCategories.push({ name, color: nextAutoColor() });
  customInput.value = '';
  save();
  renderCategoryUI();
  render();
}

addCatBtn.addEventListener('click', addCustomCategory);
customInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); }
});

function removeCustomCategory(name) {
  customCategories = customCategories.filter(c => c.name !== name);
  // Drop any transactions that belonged to the deleted category
  transactions = transactions.filter(t => t.category !== name);
  save();
  renderCategoryUI();
  render();
}

/** Rebuild the <select> and the chip list. */
function renderCategoryUI() {
  // <select> options
  const current = categoryEl.value;
  categoryEl.innerHTML = '<option value="">Select category…</option>';
  allCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    const emoji = { Food: '🍔', Transport: '🚗', Fun: '🎉' }[cat.name] || '🏷️';
    opt.textContent = `${emoji} ${cat.name}`;
    categoryEl.appendChild(opt);
  });
  // Restore previous selection if still valid
  if ([...categoryEl.options].some(o => o.value === current)) {
    categoryEl.value = current;
  }

  // Chip list (custom only)
  chipList.innerHTML = '';
  if (customCategories.length === 0) {
    const hint = document.createElement('span');
    hint.style.cssText = 'font-size:.74rem;color:var(--text-muted)';
    hint.textContent   = 'No custom categories yet.';
    chipList.appendChild(hint);
    return;
  }
  customCategories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cat.color}"></span>
      ${escHtml(cat.name)}
      <button class="chip-remove" aria-label="Remove ${escHtml(cat.name)}" data-name="${escHtml(cat.name)}">✕</button>
    `;
    chipList.appendChild(chip);
  });
}

chipList.addEventListener('click', e => {
  const btn = e.target.closest('.chip-remove');
  if (btn) removeCustomCategory(btn.dataset.name);
});

/* ══════════════════════════════════════════════════════════
   Challenge 3 — Sort transactions
══════════════════════════════════════════════════════════ */

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sortKey = btn.dataset.sort;
    save();
    updateSortButtons();
    renderList();
  });
});

function updateSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sortKey);
  });
}

function getSortedTransactions() {
  const copy = [...transactions];
  switch (sortKey) {
    case 'newest':       return copy.reverse();
    case 'oldest':       return copy;
    case 'amount-desc':  return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':   return copy.sort((a, b) => a.amount - b.amount);
    case 'category':     return copy.sort((a, b) => a.category.localeCompare(b.category));
    default:             return copy.reverse();
  }
}

/* ══════════════════════════════════════════════════════════
   Spend limit — settings
══════════════════════════════════════════════════════════ */

limitInput.value = spendLimit;

saveLimitBtn.addEventListener('click', () => {
  const val = parseFloat(limitInput.value);
  if (isNaN(val) || val <= 0) {
    limitMsg.style.color = 'var(--danger)';
    limitMsg.textContent = 'Enter a positive number.';
    return;
  }
  // Always store spendLimit in USD
  spendLimit = currency === 'IDR' ? val / USD_TO_IDR : val;
  limitMsg.style.color = 'var(--success)';
  limitMsg.textContent = `✓ Limit saved as ${formatAmount(spendLimit)}`;
  setTimeout(() => { limitMsg.textContent = ''; }, 2500);
  save();
  renderBalance();
  renderList(); // re-flag items
});

/* ══════════════════════════════════════════════════════════
   Form validation
══════════════════════════════════════════════════════════ */

function validate() {
  let valid = true;
  nameErr.textContent   = '';
  amountErr.textContent = '';
  catErr.textContent    = '';
  itemNameEl.classList.remove('error');
  amountEl.classList.remove('error');
  categoryEl.classList.remove('error');

  if (!itemNameEl.value.trim()) {
    nameErr.textContent = 'Item name is required.';
    itemNameEl.classList.add('error');
    valid = false;
  }

  const amt = parseFloat(amountEl.value);
  if (!amountEl.value || isNaN(amt) || amt <= 0) {
    amountErr.textContent = 'Enter a valid amount greater than 0.';
    amountEl.classList.add('error');
    valid = false;
  }

  if (!categoryEl.value) {
    catErr.textContent = 'Please select a category.';
    categoryEl.classList.add('error');
    valid = false;
  }

  return valid;
}

/* ══════════════════════════════════════════════════════════
   Add / Delete transactions
══════════════════════════════════════════════════════════ */

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!validate()) return;

  transactions.push({
    id:        crypto.randomUUID(),
    name:      itemNameEl.value.trim(),
    amount:    parseFloat(parseFloat(amountEl.value).toFixed(2)),
    category:  categoryEl.value,
    timestamp: Date.now(),
  });

  save();
  render();

  itemNameEl.value = '';
  amountEl.value   = '';
  categoryEl.value = '';
  itemNameEl.focus();
});

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
}

/* ══════════════════════════════════════════════════════════
   Render: transaction list (with Challenge 4 flagging)
══════════════════════════════════════════════════════════ */

function renderList() {
  const sorted   = getSortedTransactions();
  const total    = transactions.reduce((s, t) => s + t.amount, 0);
  const exceeded = total > spendLimit;

  if (sorted.length === 0) {
    txListEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">💸</div>
        No transactions yet. Add one above!
      </div>`;
    return;
  }

  txListEl.innerHTML = '';
  sorted.forEach(t => {
    const color = colorFor(t.category);
    const div   = document.createElement('div');
    // Flag every item if the total is over limit
    div.className = 'tx-item' + (exceeded ? ' flagged' : '');
    div.innerHTML = `
      <span class="category-dot" style="background:${color}"></span>
      <div class="tx-info">
        <div class="tx-name">${escHtml(t.name)}</div>
        <div class="tx-category">${escHtml(t.category)}</div>
      </div>
      <span class="tx-amount">-${formatAmount(t.amount)}</span>
      <button class="btn-delete" aria-label="Delete ${escHtml(t.name)}" data-id="${t.id}">✕</button>
    `;
    txListEl.appendChild(div);
  });

  // Delegated click for delete buttons
  txListEl.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete');
    if (btn) deleteTransaction(btn.dataset.id);
  }, { once: true });
}

/* ══════════════════════════════════════════════════════════
   Render: doughnut chart
══════════════════════════════════════════════════════════ */

function renderPieChart() {
  if (transactions.length === 0) {
    pieChartEmpty.style.display = '';
    pieChartWrap.style.display  = 'none';
    legendEl.style.display      = 'none';
    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
    return;
  }

  pieChartEmpty.style.display = 'none';
  pieChartWrap.style.display  = '';
  legendEl.style.display      = '';

  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const labels = Object.keys(totals);
  const data   = Object.values(totals);
  const colors = labels.map(l => colorFor(l));
  const surface = cssVar('--surface') || '#1e293b';

  if (pieChartInstance) {
    pieChartInstance.data.labels                      = labels;
    pieChartInstance.data.datasets[0].data            = data;
    pieChartInstance.data.datasets[0].backgroundColor = colors;
    pieChartInstance.data.datasets[0].borderColor     = surface;
    pieChartInstance.update();
  } else {
    pieChartInstance = new Chart(pieCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor:     surface,
          borderWidth:     3,
          hoverOffset:     8,
        }],
      },
      options: {
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                return ` ${formatAmount(ctx.parsed)}  (${Math.round(ctx.parsed / sum * 100)}%)`;
              },
            },
          },
        },
        animation: { duration: 350 },
      },
    });
  }

  legendEl.innerHTML = labels.map((l, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      ${escHtml(l)} &mdash; ${formatAmount(totals[l])}
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════════
   Challenge 2 — Monthly summary view
══════════════════════════════════════════════════════════ */

prevMonthBtn.addEventListener('click', () => {
  summaryDate = new Date(summaryDate.getFullYear(), summaryDate.getMonth() - 1, 1);
  renderSummary();
});
nextMonthBtn.addEventListener('click', () => {
  summaryDate = new Date(summaryDate.getFullYear(), summaryDate.getMonth() + 1, 1);
  renderSummary();
});

function renderSummary() {
  const year  = summaryDate.getFullYear();
  const month = summaryDate.getMonth(); // 0-indexed
  const key   = `${year}-${String(month + 1).padStart(2, '0')}`;

  monthLabelEl.textContent = `${MONTH_NAMES[month]} ${year}`;

  // Transactions for selected month
  const monthTx = transactions.filter(t => {
    const d = new Date(t.timestamp);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  /* ── Per-category breakdown with mini progress bars ── */
  if (monthTx.length === 0) {
    summaryTotals.innerHTML = '<div class="summary-empty">No expenses this month.</div>';
    summaryChartWrap.style.display = 'none';
    if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
  } else {
    const catTotals = {};
    monthTx.forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });
    const monthTotal = Object.values(catTotals).reduce((a, b) => a + b, 0);

    summaryTotals.innerHTML = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => {
        const pct   = Math.round(amt / monthTotal * 100);
        const color = colorFor(cat);
        return `
          <div class="summary-row">
            <span class="category-dot" style="background:${color}; flex-shrink:0"></span>
            <div class="summary-row-info">
              <div class="summary-cat-name">${escHtml(cat)} <small style="color:var(--text-muted)">${pct}%</small></div>
              <div class="summary-bar-wrap">
                <div class="summary-bar-fill" style="width:${pct}%; background:${color}"></div>
              </div>
            </div>
            <span class="summary-row-amount">${formatAmount(amt)}</span>
          </div>`;
      }).join('');

    /* ── Bar chart: daily totals for the selected month ── */
    renderBarChart(monthTx, year, month);
  }

  /* ── All-months history list ── */
  renderAllMonths();
}

function renderBarChart(monthTx, year, month) {
  // Build daily buckets
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyTotals = Array(daysInMonth).fill(0);
  monthTx.forEach(t => {
    const day = new Date(t.timestamp).getDate() - 1; // 0-indexed
    dailyTotals[day] += t.amount;
  });

  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const surface2 = cssVar('--surface2') || '#293548';
  const textMuted = cssVar('--text-muted') || '#94a3b8';

  summaryChartWrap.style.display = '';

  if (barChartInstance) {
    barChartInstance.data.labels        = labels;
    barChartInstance.data.datasets[0].data = dailyTotals;
    barChartInstance.update();
  } else {
    barChartInstance = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Daily spend ($)',
          data:  dailyTotals,
          backgroundColor: '#6366f1cc',
          borderColor:     '#6366f1',
          borderWidth:     1,
          borderRadius:    4,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => `Day ${ctx[0].label}`,
              label: ctx => ` ${formatAmount(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textMuted, font: { size: 10 } },
            grid:  { color: 'rgba(148,163,184,.1)' },
          },
          y: {
            ticks: {
              color: textMuted,
              font:  { size: 10 },
              callback: v => formatAmount(v),
            },
            grid: { color: 'rgba(148,163,184,.1)' },
          },
        },
        animation: { duration: 350 },
      },
    });
  }
}

function renderAllMonths() {
  // Group transactions by month key
  const groups = {};
  transactions.forEach(t => {
    const k = monthKey(t.timestamp);
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  });

  const keys = Object.keys(groups).sort().reverse(); // newest first

  if (keys.length === 0) {
    allMonthsEl.innerHTML = '<div class="summary-empty">No data yet.</div>';
    return;
  }

  allMonthsEl.innerHTML = keys.map(k => {
    const txs   = groups[k];
    const total = txs.reduce((s, t) => s + t.amount, 0);
    return `
      <div class="month-row" data-key="${k}">
        <div>
          <div class="month-row-name">${monthLabel(k)}</div>
          <div class="month-row-count">${txs.length} transaction${txs.length !== 1 ? 's' : ''}</div>
        </div>
        <span class="month-row-total">${formatAmount(total)}</span>
      </div>`;
  }).join('');

  // Click a row → jump to that month in the navigator
  allMonthsEl.querySelectorAll('.month-row').forEach(row => {
    row.addEventListener('click', () => {
      const [y, m] = row.dataset.key.split('-').map(Number);
      summaryDate = new Date(y, m - 1, 1);
      renderSummary();
      // Scroll to top of summary panel
      document.getElementById('tab-summary').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ══════════════════════════════════════════════════════════
   Master render (called after any state change)
══════════════════════════════════════════════════════════ */

function render() {
  renderBalance();
  renderList();
  renderPieChart();
  // Re-render summary only if that tab is currently visible
  if (!document.getElementById('tab-summary').hidden) {
    renderSummary();
  }
}

/* ══════════════════════════════════════════════════════════
   Boot
══════════════════════════════════════════════════════════ */

applyTheme();
applyCurrency();
updateSortButtons();
renderCategoryUI();
render();
