(function () {
  const D = window.FB_DATA;
  const C = D.CATEGORIES;

  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmtPct = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',') + ' %';
  const signed = (v, f = eur0) => (v >= 0 ? '+' : '−') + f.format(Math.abs(v));
  const $ = s => document.querySelector(s);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.color = '#8b93a7';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.plugins.tooltip.backgroundColor = '#1c2130';
  Chart.defaults.plugins.tooltip.borderColor = '#2a3142';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;

  const charts = {};
  function chart(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), config);
  }

  const state = { range: 365, month: 0, search: '', cat: 'all' };
  const RANGE_LABEL = { 30: 'sur 1 mois', 182: 'sur 6 mois', 365: 'sur 1 an', 1095: 'sur 3 ans' };

  // ---------- Helpers budget ----------
  const monthRef = offset => new Date(D.today.getFullYear(), D.today.getMonth() - offset, 1);
  const monthLabel = offset => cap(monthRef(offset).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
  const txOfMonth = offset => {
    const r = monthRef(offset);
    return D.tx.filter(t => t.date.getFullYear() === r.getFullYear() && t.date.getMonth() === r.getMonth());
  };
  function summarize(list) {
    let income = 0, saved = 0;
    const byCat = {};
    for (const t of list) {
      const kind = C[t.cat].kind;
      if (kind === 'income') income += t.amount;
      else if (kind === 'transfer') saved -= t.amount;
      else byCat[t.cat] = (byCat[t.cat] || 0) - t.amount;
    }
    const expenses = Object.values(byCat).reduce((a, b) => a + b, 0);
    return { income, expenses, saved, byCat };
  }

  // ---------- Patrimoine ----------
  function renderPatrimoine() {
    const n = D.netWorth.length;
    const start = Math.max(0, n - 1 - state.range);
    const dates = D.dates.slice(start);
    const values = D.netWorth.slice(start);
    const last = values[values.length - 1], first = values[0];
    const diff = last - first;

    $('#nw-value').textContent = eur.format(last);
    const delta = $('#nw-delta');
    delta.className = 'delta ' + (diff >= 0 ? 'up' : 'down');
    delta.textContent = `${signed(diff)} (${fmtPct((diff / first) * 100)}) ${RANGE_LABEL[state.range]}`;

    const ctx = document.getElementById('nw-chart').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(233,196,106,0.30)');
    grad.addColorStop(1, 'rgba(233,196,106,0)');

    chart('nw-chart', {
      type: 'line',
      data: {
        labels: dates.map(d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })),
        datasets: [{
          data: values, borderColor: '#e9c46a', backgroundColor: grad, fill: true,
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25,
        }],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: c => eur.format(c.parsed.y) } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          y: { ticks: { callback: v => eur0.format(v), maxTicksLimit: 5 } },
        },
      },
    });

    const totals = {};
    for (const a of D.ACCOUNTS) totals[a.cls] = (totals[a.cls] || 0) + a.balance;
    const gross = Object.values(totals).reduce((a, b) => a + b, 0);
    const invested = totals.bourse + totals.assurance + totals.crypto;

    $('#hero-stats').innerHTML = [
      ['Actifs bruts', eur0.format(gross)],
      ['Dettes', eur0.format(D.LOAN.balance)],
      ['Liquidités', eur0.format(totals.liquidites)],
      ['Investissements', eur0.format(invested)],
    ].map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="v">${v}</div></div>`).join('');

    const classes = Object.keys(D.CLASSES).sort((a, b) => totals[b] - totals[a]);
    chart('alloc-chart', {
      type: 'doughnut',
      data: {
        labels: classes.map(k => D.CLASSES[k].label),
        datasets: [{ data: classes.map(k => totals[k]), backgroundColor: classes.map(k => D.CLASSES[k].color), borderColor: '#11141b', borderWidth: 3 }],
      },
      options: {
        maintainAspectRatio: false, cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${eur0.format(c.parsed)}` } } },
      },
    });
    $('#alloc-legend').innerHTML = classes.map(k => `
      <li><span class="dot" style="background:${D.CLASSES[k].color}"></span>
      <span class="name">${D.CLASSES[k].label}</span>
      <span class="amt">${eur0.format(totals[k])}</span>
      <span class="pc">${((totals[k] / gross) * 100).toFixed(1).replace('.', ',')} %</span></li>`).join('');

    // Comptes, groupés par classe, avec la variation sur 1 an
    const yearAgo = n - 366;
    const accRow = (name, inst, balance, change) => `
      <div class="acc">
        <div><div class="n">${name}</div><div class="i">${inst}</div></div>
        <div class="r"><div class="b">${eur.format(balance)}</div>
        <div class="c ${change >= 0 ? 'up' : 'down'}">${signed(change)} sur 1 an</div></div>
      </div>`;
    let html = classes.map(k => {
      const factor = D.series[k][yearAgo] / D.series[k][n - 1];
      const rows = D.ACCOUNTS.filter(a => a.cls === k)
        .map(a => accRow(a.name, a.inst, a.balance, a.balance * (1 - factor))).join('');
      return `<div class="acc-group"><div class="acc-group-head"><span>${D.CLASSES[k].label}</span><span>${eur0.format(totals[k])}</span></div>${rows}</div>`;
    }).join('');
    const loanChange = D.series.dettes[n - 1] - D.series.dettes[yearAgo];
    html += `<div class="acc-group"><div class="acc-group-head"><span>Dettes</span><span>${eur0.format(D.LOAN.balance)}</span></div>
      ${accRow(D.LOAN.name, D.LOAN.inst, D.LOAN.balance, loanChange)}</div>`;
    $('#accounts').innerHTML = html;
  }

  // ---------- Navigation mensuelle ----------
  function renderMonthNav() {
    document.querySelectorAll('.month-nav').forEach(el => {
      el.innerHTML = `<button data-dir="1" aria-label="Mois précédent" ${state.month >= 11 ? 'disabled' : ''}>‹</button>
        <span class="month-label">${monthLabel(state.month)}</span>
        <button data-dir="-1" aria-label="Mois suivant" ${state.month <= 0 ? 'disabled' : ''}>›</button>`;
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.month-nav button');
    if (!b || b.disabled) return;
    state.month = Math.min(11, Math.max(0, state.month + Number(b.dataset.dir)));
    route();
  });

  // ---------- Budget ----------
  function renderBudget() {
    renderMonthNav();
    const s = summarize(txOfMonth(state.month));
    const net = s.income - s.expenses;
    const rate = s.income ? (net / s.income) * 100 : 0;
    const budgetTotal = Object.values(C).reduce((a, c) => a + (c.budget || 0), 0);

    $('#budget-kpis').innerHTML = [
      ['Revenus', eur.format(s.income), 'Salaire et virements reçus', ''],
      ['Dépenses', eur.format(s.expenses), `${Math.round((s.expenses / budgetTotal) * 100)} % du budget de ${eur0.format(budgetTotal)}`, ''],
      ['Reste à vivre', signed(net, eur), `dont ${eur0.format(s.saved)} versés sur le Livret A`, net >= 0 ? 'up' : 'down'],
      ["Taux d'épargne", `${rate.toFixed(1).replace('.', ',')} %`, 'Revenus − dépenses', rate >= 0 ? 'up' : 'down'],
    ].map(([l, v, sub, cls]) => `<div class="card kpi"><div class="label">${l}</div><div class="v ${cls}">${v}</div><div class="s">${sub}</div></div>`).join('');

    // Repère de rythme : où on devrait en être dans le mois
    let pace = null;
    if (state.month === 0) {
      const dim = new Date(D.today.getFullYear(), D.today.getMonth() + 1, 0).getDate();
      pace = (D.today.getDate() / dim) * 100;
    }
    const cats = Object.keys(C).filter(k => C[k].budget);
    $('#budget-list').innerHTML = cats.map(k => {
      const spent = Math.max(0, s.byCat[k] || 0);
      const budget = C[k].budget;
      const p = (spent / budget) * 100;
      const over = spent > budget;
      const foot = over
        ? `Dépassement de ${eur0.format(spent - budget)} · ${Math.round(p)} %`
        : `Reste ${eur0.format(budget - spent)} · ${Math.round(p)} %`;
      return `<div class="bud-row ${over ? 'over' : ''}">
        <div class="bud-head"><span class="dot" style="background:${C[k].color}"></span>
          <span class="bud-name">${C[k].label}</span>
          <span class="bud-amt"><b>${eur0.format(spent)}</b> / ${eur0.format(budget)}</span></div>
        <div class="bar"><div class="fill" style="width:${Math.min(100, p)}%;background:${over ? 'var(--down)' : C[k].color}"></div>
          ${pace !== null ? `<div class="pace" style="left:${pace}%"></div>` : ''}</div>
        <div class="bud-foot">${foot}</div></div>`;
    }).join('') + (pace !== null ? `<div class="pace-note">Le trait vertical indique l'avancement du mois (${Math.round(pace)} %).</div>` : '');

    const months = [];
    for (let k = 11; k >= 0; k--) months.push({ k, label: cap(monthRef(k).toLocaleDateString('fr-FR', { month: 'short' })), ...summarize(txOfMonth(k)) });
    const highlight = (base, k) => (k === state.month ? base : base + '66');

    chart('cashflow-chart', {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          { label: 'Revenus', data: months.map(m => m.income), backgroundColor: months.map(m => highlight('#3ecf8e', m.k)), borderRadius: 4 },
          { label: 'Dépenses', data: months.map(m => m.expenses), backgroundColor: months.map(m => highlight('#f97362', m.k)), borderRadius: 4 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label} : ${eur0.format(c.parsed.y)}` } },
        },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => eur0.format(v), maxTicksLimit: 5 } } },
        onClick: (_, els) => { if (els.length) { state.month = months[els[0].index].k; route(); } },
      },
    });

    chart('rate-chart', {
      type: 'line',
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          data: months.map(m => (m.income ? ((m.income - m.expenses) / m.income) * 100 : 0)),
          borderColor: '#e9c46a', backgroundColor: '#e9c46a', borderWidth: 2, tension: 0.3,
          pointRadius: months.map(m => (m.k === state.month ? 5 : 2)),
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: c => `${c.parsed.y.toFixed(1).replace('.', ',')} %` } } },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => v + ' %', maxTicksLimit: 4 } } },
      },
    });
  }

  // ---------- Dépenses ----------
  function renderDepenses() {
    renderMonthNav();
    const list = txOfMonth(state.month);
    const s = summarize(list);
    const cats = Object.keys(s.byCat).filter(k => s.byCat[k] > 0).sort((a, b) => s.byCat[b] - s.byCat[a]);

    chart('spend-chart', {
      type: 'doughnut',
      data: {
        labels: cats.map(k => C[k].label),
        datasets: [{ data: cats.map(k => s.byCat[k]), backgroundColor: cats.map(k => C[k].color), borderColor: '#11141b', borderWidth: 3 }],
      },
      options: {
        maintainAspectRatio: false, cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${eur.format(c.parsed)}` } } },
      },
    });
    $('#spend-legend').innerHTML = cats.map(k => `
      <li><span class="dot" style="background:${C[k].color}"></span>
      <span class="name">${C[k].label}</span>
      <span class="amt">${eur0.format(s.byCat[k])}</span>
      <span class="pc">${((s.byCat[k] / s.expenses) * 100).toFixed(1).replace('.', ',')} %</span></li>`).join('')
      + `<li class="muted" style="margin-top:4px">Total : <b style="color:var(--text);margin-left:auto">${eur.format(s.expenses)}</b></li>`;

    // Dépenses cumulées jour par jour : mois choisi vs mois précédent
    const cumul = (offset, cutoff) => {
      const r = monthRef(offset);
      const dim = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
      const daily = new Array(dim).fill(0);
      for (const t of txOfMonth(offset)) if (C[t.cat].kind === 'expense') daily[t.date.getDate() - 1] -= t.amount;
      let acc = 0;
      return daily.map((v, i) => (cutoff && i + 1 > cutoff ? null : (acc += v)));
    };
    const cur = cumul(state.month, state.month === 0 ? D.today.getDate() : null);
    const prevAvailable = state.month < 11;
    const prev = prevAvailable ? cumul(state.month + 1) : [];
    const len = Math.max(cur.length, prev.length);
    const datasets = [{
      label: monthLabel(state.month), data: cur, borderColor: '#f97362', backgroundColor: 'rgba(249,115,98,0.12)',
      fill: true, borderWidth: 2, pointRadius: 0, tension: 0.2,
    }];
    if (prevAvailable) datasets.push({
      label: monthLabel(state.month + 1), data: prev, borderColor: '#5b6378', borderDash: [5, 4],
      borderWidth: 2, pointRadius: 0, tension: 0.2,
    });
    chart('cumul-chart', {
      type: 'line',
      data: { labels: Array.from({ length: len }, (_, i) => i + 1), datasets },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3 } },
          tooltip: { callbacks: { title: i => `Jour ${i[0].label}`, label: c => ` ${c.dataset.label} : ${eur0.format(c.parsed.y)}` } },
        },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { callback: v => eur0.format(v), maxTicksLimit: 5 } } },
      },
    });

    // Top commerçants
    const merch = {};
    for (const t of list) if (C[t.cat].kind === 'expense' && t.amount < 0) {
      merch[t.label] = merch[t.label] || { total: 0, cat: t.cat, n: 0 };
      merch[t.label].total -= t.amount;
      merch[t.label].n++;
    }
    const top = Object.entries(merch).sort((a, b) => b[1].total - a[1].total).slice(0, 7);
    const max = top.length ? top[0][1].total : 1;
    $('#merchants').innerHTML = top.map(([name, m]) => `
      <div class="merch">
        <div class="merch-head"><span>${esc(name)} <span class="muted">· ${m.n}×</span></span><span>${eur0.format(m.total)}</span></div>
        <div class="bar"><div class="fill" style="width:${(m.total / max) * 100}%;background:${C[m.cat].color}"></div></div>
      </div>`).join('') || '<div class="empty">Aucune dépense ce mois-ci.</div>';

    renderTxList(list);
  }

  function renderTxList(list) {
    const q = state.search.trim().toLowerCase();
    const filtered = list.filter(t =>
      (state.cat === 'all' || t.cat === state.cat) &&
      (!q || t.label.toLowerCase().includes(q) || C[t.cat].label.toLowerCase().includes(q)));
    if (!filtered.length) {
      $('#tx-list').innerHTML = '<div class="empty">Aucune transaction trouvée.</div>';
      return;
    }
    let html = '', lastDay = '';
    for (const t of filtered) {
      const day = cap(t.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
      if (day !== lastDay) { html += `<div class="tx-day">${day}</div>`; lastDay = day; }
      const c = C[t.cat];
      const initials = t.label.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
      html += `<div class="tx">
        <div class="tx-ico" style="background:${c.color}22;color:${c.color}">${initials}</div>
        <div class="tx-main"><div class="tx-label">${esc(t.label)}</div><div class="tx-cat">${c.label}</div></div>
        <div class="tx-amt ${t.amount > 0 ? 'pos' : ''}">${signed(t.amount, eur)}</div></div>`;
    }
    $('#tx-list').innerHTML = html;
  }

  $('#tx-cat').innerHTML = '<option value="all">Toutes les catégories</option>' +
    Object.keys(C).map(k => `<option value="${k}">${C[k].label}</option>`).join('');
  $('#tx-search').addEventListener('input', e => { state.search = e.target.value; renderTxList(txOfMonth(state.month)); });
  $('#tx-cat').addEventListener('change', e => { state.cat = e.target.value; renderTxList(txOfMonth(state.month)); });

  $('#range-seg').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.range = Number(b.dataset.range);
    document.querySelectorAll('#range-seg button').forEach(x => x.classList.toggle('active', x === b));
    renderPatrimoine();
  });

  // ---------- Routeur ----------
  const VIEWS = {
    patrimoine: { title: 'Patrimoine', sub: 'Vue d’ensemble de vos comptes et de leur évolution', render: renderPatrimoine },
    budget: { title: 'Budget', sub: 'Suivi mensuel de vos revenus, dépenses et objectifs', render: renderBudget },
    depenses: { title: 'Dépenses', sub: 'Analyse détaillée de vos transactions', render: renderDepenses },
  };
  function route() {
    const key = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'patrimoine';
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + key));
    document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.dataset.view === key));
    $('#page-title').textContent = VIEWS[key].title;
    $('#page-sub').textContent = VIEWS[key].sub;
    VIEWS[key].render();
  }
  window.addEventListener('hashchange', route);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(route);
})();
