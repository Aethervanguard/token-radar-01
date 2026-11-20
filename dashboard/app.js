// Token Radar's dashboard (radar-6). It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with the model's own
// inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', signal: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in two functions (radar-6): the page recomputes a row from the snapshot figures and
  // checks the number board.json carries, so the page's code and the board's data are visibly the
  // same arithmetic. Each row is priced at its category's calibrated multiple (the median
  // market-cap-to-TVL ratio of the live-token protocols in that category, or the global median
  // where the category has too few trading tokens to earn its own). Growth is RELATIVE: the
  // multiplier prices the gap between the protocol's seven-day change and its category's
  // baseline (the median change of the rankable protocols in that category), not the raw number,
  // so a protocol holding its TVL while its category falls is a standout. Maturity peaks PER
  // CATEGORY: the peak is the median age of the live-token protocols in that category, easing
  // by their 90th percentile, because categories launch on different clocks. Growth is
  // asymmetric (a rise pays more than a fall costs) and maturity is a peak, easing after: a
  // protocol that has run far past its category's typical token age with no token is worth
  // less than one at the peak age of the same size.
  function maturityOf(age, m, peakDays, oldDays) {
    var peak = (peakDays === null || peakDays === undefined) ? m.maturity_peak_days : peakDays;
    var old = (oldDays === null || oldDays === undefined) ? m.maturity_old_days : oldDays;
    var a = (age === null || age === undefined) ? m.unknown_age_days : age;
    if (a <= peak) return m.maturity_floor + (m.maturity_peak - m.maturity_floor) * (a / peak);
    var past = Math.min(a - peak, old - peak);
    return m.maturity_peak - (m.maturity_peak - m.maturity_old) * (past / (old - peak));
  }
  function impliedOf(row, model) {
    var baseline = (row.growth_baseline === null || row.growth_baseline === undefined) ? 0 : row.growth_baseline;
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? baseline : row.change_7d));
    var rel = Math.round((growth - baseline) * 100) / 100;
    var w = rel >= 0 ? model.growth_weight_up : model.growth_weight_down;
    var growthMult = 1 + (rel / 100) * w;
    var maturity = maturityOf(row.age_days, model, row.maturity_peak_days, row.maturity_old_days);
    var multiple = (row.category_multiple === null || row.category_multiple === undefined) ? model.base_multiple : row.category_multiple;
    return Math.max(1, Math.round(row.tvl_usd * multiple * growthMult * maturity));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function chainList(chains) {
    if (!chains || chains.length === 0) return 'an unnamed chain';
    if (chains.length <= 3) return chains.join(', ');
    return chains.slice(0, 3).join(', ') + ' + ' + (chains.length - 3) + ' more';
  }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age, signal) {
    var base = signal === 'Prime' ? 30 : signal === 'Watch' ? 45 : 60;
    if (age !== null && age !== undefined && age < 180) return Math.min(75, base + 15);
    return base;
  }
  function weeklyActionFor(p, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount against the supplied collateral on ' + name + ' once a week, then repay it, so the position shows borrowing activity as well as supply.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap a small amount in ' + name + "'s main pool on " + chain + ' once a week, so the position shows trading activity as well as liquidity.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a small amount through ' + name + ' once a week, alternating the destination chain, so the position shows repeated use.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim the staking rewards from ' + name + ' once a week and restake them, so the position compounds instead of sitting still.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Open and close one small hedge on ' + name + ' once a week, so the position shows trading activity.';
    if (c.indexOf('prediction') >= 0) return 'Place one small position on a new market on ' + name + ' once a week.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Rebalance a small slice between ' + name + ' vaults once a week, so the position shows active allocation.';
    if (c.indexOf('stable') >= 0) return 'Mint or redeem a small amount of the stable asset through ' + name + ' once a week.';
    if (c.indexOf('rwa') >= 0) return "Claim the yield from " + name + "'s asset once a week and re-mint it, so the position compounds.";
    if (c.indexOf('insurance') >= 0) return 'Check the cover status on ' + name + ' once a week and renew it before it lapses.';
    return 'Make one qualifying action on ' + name + ' each week, such as a deposit, a borrow, a swap or a vote.';
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var half = Math.max(25, Math.round(capital / 2));
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply a second $' + half + ' of a different asset to ' + name + ' on ' + chain + ' and keep both positions open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + half + ' of liquidity to a second pool on ' + name + ' and keep both positions open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a second $' + half + ' of USDC through ' + name + ' to a different destination chain.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake a second $' + half + ' of the staking asset through ' + name + ' and keep both receipts.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Open a second small position in the opposite direction on ' + name + ' as a hedge.';
    if (c.indexOf('prediction') >= 0) return 'Place a second position on a different market outcome on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + half + ' into a second ' + name + ' vault with a different risk profile.';
    if (c.indexOf('stable') >= 0) return 'Mint a second tranche of $' + half + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint a second tranche of $' + half + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy a second cover of $' + half + ' from ' + name + ' on ' + chain + ' for a different risk.';
    return 'Make a second deposit of $' + half + ' into ' + name + ' on ' + chain + ' and keep both positions open.';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days, p.signal);
    var half = Math.max(25, Math.round(capital / 2));
    var cross = (p.chains && p.chains.length > 1)
      ? 'Bridge $' + half + ' of USDC to ' + p.chains[1] + ' through ' + p.name + ' and repeat the core action there, so the position counts on two chains.'
      : 'Increase the position by $' + half + ' and confirm the new balance on ' + p.name + '\'s own page.';
    var signalText = p.signal === 'Prime' ? 'a Prime launch' : p.signal === 'Watch' ? 'on Watch' : 'an Early launch';
    var changeText = (p.change_7d === null || p.change_7d === undefined) ? 'no change reported' : fmtPct(p.change_7d);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm on ' + p.name + ', and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: '$' + half + ' of capital and about $3 of gas', time: '10 minutes to set up' },
      { text: cross, cost: '$' + half + ' of capital and about $4 of gas', time: '10 minutes to set up' },
      { text: weeklyActionFor(p, chain), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Check ' + p.name + '\'s TVL and your points balance once a week and write both numbers in the farm log: TVL is ' + fmtUsd(p.tvl_usd) + ' and moved ' + changeText + ' in the last week, so a drop of more than 10% from here shows up before it costs the position.', cost: 'nothing but the log', time: '5 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot: ' + p.name + ' is ' + signalText + ', so the radar\'s clock gives it ' + hold + ' days.', cost: 'the $' + (capital + half) + ' stays in the position', time: hold + ' days' },
      { text: 'Open ' + p.name + '\'s own points or rewards page on ' + chain + ', complete any quests it lists, and confirm the position is counted before the next snapshot.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the unwind rule in the farm log before the first deposit: claim within a week of a launch, and unwind if ' + p.name + '\'s TVL falls below ' + fmtUsd(Math.round(p.tvl_usd / 2)) + ', half its snapshot value, so the exit is decided before the excitement.', cost: 'nothing but the log', time: '5 minutes' },
      { text: 'Claim only from the link ' + p.name + ' itself publishes, never from a link in a message, and write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '10 minutes' },
      { text: 'Check the radar\'s own figures before adding more: ' + p.name + ' holds ' + fmtUsd(p.tvl_usd) + ' of TVL, moved ' + changeText + ' in the last week, and has run ' + (p.age_days === null || p.age_days === undefined ? 'an unlisted age' : p.age_days + ' days') + ' with no token on record. If the seven-day change has turned negative since the snapshot, wait a week before adding more.', cost: 'nothing but the log', time: '5 minutes' },
      { text: 'The radar prices a launch at ' + fmtUsd(p.implied_value_usd) + '. Do not size the position to that number: a farmer\'s share is a small slice of it, so keep the deposit at $' + (capital + half) + ' and treat any launch as a bonus, not a payback.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  // Per-category standing, derived from the board itself: a row's rank inside its category
  // and its share of the category's TVL. The board table and the detail view show both, so the
  // reader sees where a protocol stands among its own kind, not just on the whole board.
  var catStats = (function () {
    var byCat = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      if (!byCat[c]) byCat[c] = { rows: [], tvl: 0 };
      byCat[c].rows.push(r);
      byCat[c].tvl += r.tvl_usd;
    });
    var out = {};
    Object.keys(byCat).forEach(function (c) {
      var list = byCat[c].rows.slice().sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; });
      list.forEach(function (r, i) {
        out[r.slug] = { rank: i + 1, count: list.length, tvlShare: r.tvl_usd / byCat[c].tvl };
      });
    });
    return out;
  })();

  // One sentence saying why this protocol is worth farming, from its own figures: its rank
  // inside its category, its growth against the category baseline, and its age against the
  // category's launch peak. No name is special-cased; the sentence is arithmetic in words.
  function whyFarm(row) {
    var st = catStats[row.slug] || { rank: row.rank, count: DATA.board_size, tvlShare: 0 };
    var cat = row.category || 'Other';
    var share = Math.round(st.tvlShare * 100);
    var rel = row.relative_growth_pct;
    var growthPart = rel >= 0
      ? 'growing ' + fmtPct(rel) + ' ahead of its category while the category runs ' + fmtPct(row.growth_baseline)
      : 'growing ' + fmtPct(rel) + ' behind its category, which runs ' + fmtPct(row.growth_baseline);
    var agePart;
    if (row.age_days === null || row.age_days === undefined) agePart = 'its listing age is unreported, so the radar prices it at a year of running';
    else if (row.age_days < row.maturity_peak_days) agePart = 'at ' + fmtAge(row.age_days) + ' it is still approaching the ' + row.maturity_peak_days + '-day launch peak for its category';
    else if (row.age_days <= row.maturity_old_days) agePart = 'at ' + fmtAge(row.age_days) + ' it is past the ' + row.maturity_peak_days + '-day launch peak for its category, inside the easing window';
    else agePart = 'at ' + fmtAge(row.age_days) + ' it is well past the ' + row.maturity_peak_days + '-day launch peak for its category';
    return row.name + ' is #' + st.rank + ' of ' + st.count + ' ' + cat + ' launches on the radar and holds ' + share + '% of the category\'s TVL, ' + growthPart + ', and ' + agePart + '. ' + row.signal + ' signal.';
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('signal')) state.signal = params.get('signal');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.signal !== 'all') params.set('signal', state.signal);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.signal !== 'all' && r.signal !== state.signal) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function totalImplied() {
    return DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
  }
  function signalCount(sig) {
    return DATA.rows.filter(function (r) { return r.signal === sig; }).length;
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name' }, 'Token ', el('em', { text: 'Radar' }))),
      el('div', { class: 'top-meta' },
        el('span', { class: 'pill' }, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', { class: 'pill' }, 'DefiLlama protocol index'),
        el('span', { class: 'pill' }, 'Model ', el('b', { text: DATA.model_version }))
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', null, DATA.watchlist_size + ' watchlist protocols, ranked by ', el('span', { class: 'gold', text: 'implied launch value' })),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, and ' + (DATA.boundary_size || 0) + ' more above it that the watchlist leaves out but the snapshot\'s own fields say are clean — flagged Boundary, never hidden. Implied value is a model, not a promise: it says what a launch could be worth, never that one will happen.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('small', { text: 'every slug, no exceptions' })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) }), el('small', { text: DATA.early_size + ' early rows below the floor · ' + (DATA.boundary_size || 0) + ' boundary rows above it' })),
        el('div', { class: 'fact' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(totalImplied()) }), el('small', { text: 'across the whole board' })),
        el('div', { class: 'fact' }, el('span', { text: 'Prime signals' }), el('b', { text: String(signalCount('Prime')) }), el('small', { text: signalCount('Watch') + ' on Watch, the rest Early' }))
      )
    );
  }

  function categoryChart() {
    var byCat = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      if (!byCat[c]) byCat[c] = { total: 0, count: 0, best: null };
      byCat[c].total += r.implied_value_usd;
      byCat[c].count += 1;
      if (!byCat[c].best || r.implied_value_usd > byCat[c].best.implied_value_usd) byCat[c].best = r;
    });
    var cats = Object.keys(byCat).map(function (c) { return { name: c, total: byCat[c].total, count: byCat[c].count, best: byCat[c].best }; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
    var max = cats.length ? cats[0].total : 1;
    return el('section', { class: 'panel catchart' },
      el('h2', null, 'Where the implied value sits ', el('span', { text: 'by category' })),
      el('p', { class: 'sub', text: 'The five strongest categories by implied launch value. Select a bar to filter the board to that category.' }),
      el('div', { class: 'cat-rows' }, cats.map(function (c) {
        return el('button', { type: 'button', class: 'cat-row', onclick: function () { state.category = c.name; writeHash(); render(); } },
          el('span', { class: 'cat-name', text: c.name }),
          el('span', { class: 'cat-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((c.total / max) * 100)) + '%' })),
          el('span', { class: 'cat-val num', text: fmtUsd(c.total) }),
          el('span', { class: 'cat-count', text: c.count + ' protocol' + (c.count === 1 ? '' : 's') + ' · top ' + c.best.name })
        );
      }))
    );
  }

  function spotlight() {
    var top = DATA.rows.slice(0, 10);
    return el('section', { class: 'spot' },
      el('h2', null, 'Top 10 ', el('span', { text: 'by implied value' })),
      el('p', { text: 'The strongest launches on the radar. Select one for its model breakdown and farm plan.' }),
      el('div', { class: 'spot-grid' }, top.map(function (r) {
        return el('button', { type: 'button', class: 'spot-card', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rk', text: '#' + r.rank }),
          el('span', { class: 'nm', text: r.name }),
          el('span', { class: 'ct', text: (r.category || 'Other') + ' · ' + fmtUsd(r.tvl_usd) + ' TVL' }),
          el('span', { class: 'vl', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'gr ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) + ' in 7d' })
        );
      }))
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var sig = el('select', { id: 'signal', 'aria-label': 'Filter by launch signal' },
      el('option', { value: 'all', text: 'All signals' }),
      ['Prime', 'Watch', 'Early'].map(function (s) { return el('option', { value: s, text: s + ' signal', selected: s === state.signal ? 'selected' : null }); })
    );
    sig.addEventListener('change', function () { state.signal = sig.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'signal', text: 'Signal' }), sig),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function signalBadge(sig) {
    return el('span', { class: 'sig ' + sig.toLowerCase(), text: sig });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.signal = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'model-line', text: 'x' + r.category_multiple + ' · ' + fmtPct(r.relative_growth_pct) + ' vs cat · ' + r.maturity_multiplier + ' mat · #' + (catStats[r.slug] ? catStats[r.slug].rank : r.rank) + ' in ' + (r.category || 'Other') })
        )),
        el('td', null, signalBadge(r.signal)),
        el('td', null, r.boundary ? el('span', { class: 'status bnd', text: 'no token · boundary' }) : el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Signal' }),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var cal = DATA.calibration || {};
    var cats = (cal.categories || []).filter(function (c) { return c.live_count >= (m.category_min_sample || 5) || c.growth_n >= (m.growth_baseline_min_sample || 3); });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x category multiple x growth x maturity )\n' +
        'growth   = 1 + ( clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') - category baseline ) / 100 x ' + m.growth_weight_up + ' when ahead of its category, x ' + m.growth_weight_down + ' when behind it\n' +
        'maturity = ' + m.maturity_floor + ' at day 0, rising to ' + m.maturity_peak + ' at the category peak (' + m.maturity_peak_days + ' days across the snapshot), easing to ' + m.maturity_old + ' by the category old age (' + m.maturity_old_days + ' days)'
      ),
      el('ul', null,
        el('li', null, el('b', { text: 'The multiple is calibrated per category, not guessed. ' }), 'Each category is priced at the median market-cap-to-TVL ratio of its own live-token protocols (see the table below). A category earns its own multiple only when at least ' + (m.category_min_sample || 5) + ' of its tokens already trade; thinner categories use the global median ' + m.base_multiple + ' (median ' + (cal.median_ratio !== undefined ? cal.median_ratio : m.base_multiple) + ' across ' + (cal.live_count || 0) + ' live-token protocols), so one token never sets the multiple for a whole category.'),
        el('li', null, el('b', { text: 'Growth is measured against the category, not against zero. ' }), 'The baseline is the median seven-day change of the rankable protocols in that category. A protocol holding +5% while its category falls -11% is a standout; one growing +5% while its category grows +5% is ordinary. The raw change alone cannot see that, so the multiplier prices the gap.'),
        el('li', null, el('b', { text: 'The maturity peak is calibrated per category. ' }), 'Categories launch on different clocks: the peak is the median age of the live-token protocols in that category (a category earns its own peak only when at least ' + (m.category_min_sample || 5) + ' of its dated tokens already trade), easing by their 90th percentile. A 700-day-old RWA protocol is at its peak; a 700-day-old lender is still young. The global peak is ' + m.maturity_peak_days + ' days, easing by ' + m.maturity_old_days + ' days.'),
        el('li', null, el('b', { text: 'Growth is asymmetric. ' }), 'A shrinking protocol still holds its TVL, so falling behind its category costs less than pulling ahead of it pays.'),
        el('li', null, el('b', { text: 'Age is a peak, not a staircase. ' }), 'A protocol that has run far past its category\'s typical token age without launching has had that long to do it.'),
        el('li', null, el('b', { text: 'The signal is derived. ' }), 'Prime means top-quarter implied value, an age inside the launch window (180 to 1,095 days) and growth above -10%. Watch and Early follow from the same figures.'),
        el('li', null, el('b', { text: '"No token" means no token on record. ' }), 'The snapshot records no token for these protocols; it does not prove none exists. Implied value is an estimate, never a price.')
      ),
      el('h3', { class: 'cal-title', text: 'Calibrated by category' }),
      el('p', { class: 'sub', text: 'What the snapshot itself says about each category: the multiple its live-token protocols trade at (with the middle half of their ratios), the age they typically took to trade one, and the seven-day change its rankable protocols are running at. A category earns its own numbers only when enough of its protocols report them; the rest use the global figures.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'cal' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', text: 'Multiple (n)' }),
            el('th', { scope: 'col', text: 'Ratio IQR' }),
            el('th', { scope: 'col', text: 'Peak age (n)' }),
            el('th', { scope: 'col', text: '7d baseline (n)' })
          )),
          el('tbody', null, cats.map(function (c) {
            return el('tr', null,
              el('td', null, el('b', { text: c.category })),
              el('td', { class: 'num', text: String(c.multiple) + ' (' + c.live_count + ')' }),
              el('td', { class: 'num', text: String(c.ratio_q1) + ' – ' + String(c.ratio_q3) }),
              el('td', { class: 'num', text: c.peak_days + 'd (' + c.age_count + ')' }),
              el('td', { class: 'num', text: fmtPct(c.growth_baseline) + ' (' + c.growth_n + ')' })
            );
          }))
        )
      ),
      el('h3', { class: 'cal-title', text: 'Not ranked, on purpose' }),
      el('p', { class: 'sub', text: (DATA.excluded_above_floor || 0) + ' pre-token protocols above the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor are left off the board: the snapshot\'s own watchlist rule keeps them off it, because they are centralised exchanges, wrapped, staked or bridged products of tokens that already trade, or versioned pools. The board separates protocols whose token already trades from those still to come — and ' + (DATA.boundary_size || 0) + ' above-floor protocols the rule leaves out but the snapshot\'s own fields say are clean are ranked instead, flagged Boundary.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'cal' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', text: 'Left off' }),
            el('th', { scope: 'col', text: 'Protocols' })
          )),
          el('tbody', null, (DATA.excluded || []).map(function (g) {
            return el('tr', null,
              el('td', null, el('b', { text: g.category })),
              el('td', { class: 'num', text: String(g.names.length) }),
              el('td', { text: g.names.join(', ') })
            );
          }))
        )
      ),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var catEntry = (DATA.calibration && DATA.calibration.categories ? DATA.calibration.categories : []).filter(function (c) { return c.category === (row.category || 'Other'); })[0];
    var catOwn = catEntry && catEntry.live_count >= (m.category_min_sample || 5);
    var multLabel = catOwn ? (row.category || 'Other') + ' median, calibrated' : 'global median';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' · ' + row.signal + ' signal' + (row.boundary ? ' · Boundary' : '') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + chainList(row.chains) })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Category baseline' }), el('b', { class: 'num', text: fmtPct(row.growth_baseline) })),
        el('div', null, el('span', { text: 'Growth vs category' }), el('b', { class: 'num', text: fmtPct(row.relative_growth_pct) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity peak' }), el('b', { class: 'num', text: (row.maturity_peak_days || 0) + 'd' })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', { class: 'hl' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': TVL x ' + (row.category_multiple !== undefined ? row.category_multiple : m.base_multiple) + ' (' + multLabel + ') x (1 + (' + growth.toFixed(2) + '% - ' + (row.growth_baseline !== undefined ? row.growth_baseline.toFixed(2) : '0.00') + '%) x ' + ((row.relative_growth_pct !== undefined ? row.relative_growth_pct : 0) >= 0 ? m.growth_weight_up : m.growth_weight_down) + ') x maturity (peak ' + (row.maturity_peak_days || m.maturity_peak_days) + 'd). The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + (row.boundary ? ' Boundary row: above the watchlist floor, ranked because the snapshot\'s own fields say it is clean.' : '') })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Why farm this one' }),
      el('p', { class: 'why', text: whyFarm(row) })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), ' ', el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('p', { text: 'Source: ' + DATA.source + '. Floor: $' + (DATA.floor_usd / 1e6) + 'M TVL. Model ' + DATA.model_version + '. The board covers the whole watchlist (' + DATA.watchlist_size + ' protocols) plus ' + DATA.early_size + ' early pre-token protocols below the floor and ' + (DATA.boundary_size || 0) + ' boundary rows above it.' }),
      el('p', { text: 'A protocol is listed as pre-token because the snapshot records no token for it. That is a record, not proof: a protocol on this board may still have a token its DefiLlama record does not carry. Nothing here is investment advice.' })
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(categoryChart());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    shell.appendChild(spotlight());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
