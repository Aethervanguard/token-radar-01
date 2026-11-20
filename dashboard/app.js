// Token Radar's dashboard (radar-10). No network: every byte it shows is in data.js.
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
  function launchOf(row, model) {
    var cal = DATA.calibration || {};
    var hazard = (cal.launch_hazard === null || cal.launch_hazard === undefined) ? 0.0002 : cal.launch_hazard;
    var fRef = (cal.launch_f_ref === null || cal.launch_f_ref === undefined) ? 0.3 : cal.launch_f_ref;
    var a = (row.age_days === null || row.age_days === undefined) ? model.unknown_age_days : row.age_days;
    var f = 1 - Math.exp(-hazard * a);
    var ageF = model.launch_age_floor + (1 - model.launch_age_floor) * Math.min(1, f / fRef);
    var catF = (row.launch_cat_factor === null || row.launch_cat_factor === undefined) ? 1 : row.launch_cat_factor;
    var chainF = (row.launch_chain_factor === null || row.launch_chain_factor === undefined)
      ? ((row.chains || []).indexOf('Ethereum') >= 0 ? (cal.chain_eth_factor || 1.1254) : (cal.chain_noneth_factor || 0.8686))
      : row.launch_chain_factor;
    return ageF * catF * chainF;
  }
  function impliedOf(row, model) {
    var baseline = (row.growth_baseline === null || row.growth_baseline === undefined) ? 0 : row.growth_baseline;
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? baseline : row.change_7d));
    var rel = Math.round((growth - baseline) * 100) / 100;
    var w = rel >= 0 ? model.growth_weight_up : model.growth_weight_down;
    var growthMult = 1 + (rel / 100) * w;
    var launch = launchOf(row, model);
    var alpha = (row.size_alpha === null || row.size_alpha === undefined) ? model.size_alpha : row.size_alpha;
    var k = (row.size_k === null || row.size_k === undefined) ? 0 : row.size_k;
    return Math.max(1, Math.round(k * Math.pow(row.tvl_usd, alpha) * growthMult * launch));
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
  // Gas per tx, $: Ethereum ~12, big L2s ~0.50, cheap chains ~0.10, else ~2.
  function gasFor(chain) {
    if (chain === 'Ethereum') return '12';
    if (/Arbitrum|Optimism|Base|zkSync|Scroll|Linea|Unichain|Mantle|Blast|Mode|Ink|Soneium/.test(chain)) return '0.50';
    if (/Binance|Solana|Polygon|Avalanche|Tron|Sui|Aptos|Fantom|Celo|xDai|Berachain|Sonic|Sei|TON|Cardano|Gnosis|Hyperliquid/.test(chain)) return '0.10';
    return '2';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var gas = gasFor(chain);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days, p.signal);
    var half = Math.max(25, Math.round(capital / 2));
    var cross = (p.chains && p.chains.length > 1)
      ? 'Bridge $' + half + ' of USDC to ' + p.chains[1] + ' through ' + p.name + ' and repeat the core action there, so the position counts on two chains.'
      : 'Increase the position by $' + half + ' and confirm the new balance on ' + p.name + '\'s own page.';
    var changeText = (p.change_7d === null || p.change_7d === undefined) ? 'no change reported' : fmtPct(p.change_7d);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm on ' + p.name + ', and keep its seed phrase offline.', cost: 'about $' + gas + ' of gas for the first transaction on ' + chain, time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: '$' + half + ' of capital and about $' + gas + ' of gas', time: '10 minutes to set up' },
      { text: cross, cost: '$' + half + ' of capital and about $' + gas + ' of gas', time: '10 minutes to set up' },
      { text: weeklyActionFor(p, chain), cost: 'about $' + gas + ' of gas a week', time: '10 minutes a week' },
      { text: 'Check ' + p.name + '\'s TVL and your points balance once a week and write both numbers in the farm log: TVL is ' + fmtUsd(p.tvl_usd) + ' and moved ' + changeText + ' in the last week, so a drop of more than 10% from here shows up first.', cost: 'nothing but the log', time: '5 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + (capital + half) + ' stays in the position', time: hold + ' days' },
      { text: 'Open ' + p.name + '\'s own points or rewards page on ' + chain + ', complete any quests it lists, and confirm the position is counted before the next snapshot.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the unwind rule in the farm log before the first deposit: claim within a week of a launch, and unwind if ' + p.name + '\'s TVL falls below ' + fmtUsd(Math.round(p.tvl_usd / 2)) + ', half its snapshot value.', cost: 'nothing but the log', time: '5 minutes' },
      { text: 'Claim only from the link ' + p.name + ' itself publishes, never from a link in a message, and log the wallet, the dates and every transaction.', cost: 'nothing but the log', time: '10 minutes' },
      { text: 'Check the radar\'s own figures before adding more: ' + p.name + ' holds ' + fmtUsd(p.tvl_usd) + ' of TVL, moved ' + changeText + ' in the last week, and has run ' + (p.age_days === null || p.age_days === undefined ? 'an unlisted age' : p.age_days + ' days') + ' with no token on record. If the seven-day change has turned negative since the snapshot, wait a week before adding more.', cost: 'nothing but the log', time: '5 minutes' },
      { text: 'The radar prices a launch at ' + fmtUsd(p.implied_value_usd) + '. Do not size the position to that number: keep the deposit at $' + (capital + half) + ' and treat any launch as a bonus, not a payback.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function planSummary(p) {
    var chain = chainOf(p);
    var gas = parseFloat(gasFor(chain));
    var capital = capitalFor(p);
    var half = Math.max(25, Math.round(capital / 2));
    var hold = holdDaysFor(p.age_days, p.signal);
    return 'Plan total: $' + (capital + half * 2) + ' of capital in four transactions on ' + chain + ', about $' + (4 * gas).toFixed(2).replace(/\.00$/, '') + ' of gas to set up ($' + gasFor(chain) + ' a transaction), about 75 minutes of work, then 15 minutes a week, hold at least ' + hold + ' days.';
  }

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

  /** Each row's rank in a pure TVL order: the model-line shows it next to the model rank, so the reader sees where the model moved a row. */
  var tvlRank = (function () {
    var out = {};
    DATA.rows.slice().sort(function (a, b) { return b.tvl_usd - a.tvl_usd; }).forEach(function (r, i) { out[r.slug] = i + 1; });
    return out;
  })();

  /** Farm this week: the five Prime launches to work first, each with its plan total, so the board ends in an action list, not just a ranking. Reuses the chart rows: name, bar, value, plan. */
  function farmWeek() {
    var top = DATA.rows.filter(function (r) { return r.signal === 'Prime'; }).slice(0, 5);
    if (top.length === 0) return null;
    var max = top[0].implied_value_usd || 1;
    return el('section', { class: 'panel catchart' },
      el('h2', null, 'Farm this week: ', el('span', { text: 'the five Prime launches first' })),
      el('p', { class: 'sub', text: 'The strongest Prime rows, each with its plan total.' }),
      el('div', { class: 'cat-rows' }, top.map(function (r) {
        return el('button', { type: 'button', class: 'cat-row', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'cat-name', text: '#' + r.rank + ' ' + r.name }),
          el('span', { class: 'cat-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'cat-val num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'cat-count', text: planSummary(r) })
        );
      }))
    );
  }

  function whyFarm(row) {
    var st = catStats[row.slug] || { rank: row.rank, count: DATA.board_size, tvlShare: 0 };
    var cat = row.category || 'Other';
    var share = Math.round(st.tvlShare * 100);
    var rel = row.relative_growth_pct;
    var growthPart = rel >= 0
      ? 'growing ' + fmtPct(rel) + ' ahead of its category while the category runs ' + fmtPct(row.growth_baseline)
      : 'growing ' + fmtPct(rel) + ' behind its category, which runs ' + fmtPct(row.growth_baseline);
    var agePart;
    if (row.age_days === null || row.age_days === undefined) agePart = 'its listing age is unreported, so the radar prices it at a year';
    else if (row.launch_age_factor >= 0.9) agePart = 'at ' + fmtAge(row.age_days) + ' it is high on the launch curve';
    else if (row.launch_age_factor >= 0.7) agePart = 'at ' + fmtAge(row.age_days) + ' it is climbing the launch curve';
    else agePart = 'at ' + fmtAge(row.age_days) + ' it is young on the launch curve';
    var catPart = 'its category launches a token ' + Math.round((row.launch_rate || 0) * 100) + '% of the time';
    var cal = DATA.calibration || {};
    var chainPart = (row.chains || []).indexOf('Ethereum') >= 0
      ? 'it runs on Ethereum, where protocols launch ' + Math.round((cal.chain_eth_rate || 0.242) * 100) + '% of the time'
      : 'it runs off Ethereum, where protocols launch ' + Math.round((cal.chain_noneth_rate || 0.143) * 100) + '% of the time';
    return row.name + ' is #' + st.rank + ' of ' + st.count + ' ' + cat + ' launches on the radar and holds ' + share + '% of the category\'s TVL, ' + growthPart + ', ' + agePart + ', ' + catPart + ', and ' + chainPart + '. ' + row.signal + ' signal.';
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
        el('span', { class: 'pill' }, 'DefiLlama index'),
        el('span', { class: 'pill' }, 'Model ', el('b', { text: DATA.model_version }))
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', null, DATA.watchlist_size + ' watchlist protocols, ranked by ', el('span', { class: 'gold', text: 'implied launch value' })),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' below that floor, and ' + (DATA.boundary_size || 0) + ' more above it, flagged Boundary. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('small', { text: 'every slug' })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) }), el('small', { text: DATA.early_size + ' early + ' + (DATA.boundary_size || 0) + ' boundary rows' })),
        el('div', { class: 'fact' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(totalImplied()) }), el('small', { text: 'across the board' })),
        el('div', { class: 'fact' }, el('span', { text: 'Prime signals' }), el('b', { text: String(signalCount('Prime')) }), el('small', { text: signalCount('Watch') + ' on Watch, the rest Early' }))
      )
    );
  }

  /** One bar chart of the five strongest groups by implied value, shared by the category and chain panels: same shape, different key. */
  function topChart(head, gold, sub, keyOf, onPick) {
    var byKey = {};
    DATA.rows.forEach(function (r) {
      var k = keyOf(r);
      if (!byKey[k]) byKey[k] = { total: 0, count: 0, best: null };
      byKey[k].total += r.implied_value_usd;
      byKey[k].count += 1;
      if (!byKey[k].best || r.implied_value_usd > byKey[k].best.implied_value_usd) byKey[k].best = r;
    });
    var items = Object.keys(byKey).map(function (c) { return { name: c, total: byKey[c].total, count: byKey[c].count, best: byKey[c].best }; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
    var max = items.length ? items[0].total : 1;
    return el('section', { class: 'panel catchart' },
      el('h2', null, head, el('span', { text: gold })),
      el('p', { class: 'sub', text: sub }),
      el('div', { class: 'cat-rows' }, items.map(function (c) {
        return el('button', { type: 'button', class: 'cat-row', onclick: function () { onPick(c.name); writeHash(); render(); } },
          el('span', { class: 'cat-name', text: c.name }),
          el('span', { class: 'cat-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((c.total / max) * 100)) + '%' })),
          el('span', { class: 'cat-val num', text: fmtUsd(c.total) }),
          el('span', { class: 'cat-count', text: c.count + ' protocol' + (c.count === 1 ? '' : 's') + ' · top ' + c.best.name })
        );
      }))
    );
  }

  function categoryChart() {
    return topChart('Where the implied value sits ', 'by category', 'By implied launch value.',
      function (r) { return r.category || 'Other'; }, function (name) { state.category = name; });
  }

  /** Where the implied value sits by chain: the first chain a row names is its home chain. Picking a chain searches the board for it. */
  function chainChart() {
    var cal = DATA.calibration || {};
    return topChart('Where the implied value sits ', 'by chain', 'Ethereum launches ' + (cal.chain_eth_rate !== undefined ? (cal.chain_eth_rate * 100).toFixed(1) + '%' : '24.2%') + ' in the mature window, ' + (cal.chain_noneth_rate !== undefined ? (cal.chain_noneth_rate * 100).toFixed(1) + '%' : '14.3%') + ' off it.',
      function (r) { return (r.chains && r.chains.length) ? r.chains[0] : 'Unnamed'; }, function (name) { state.q = name; });
  }

  function spotlight() {
    var top = DATA.rows.slice(0, 10);
    return el('section', { class: 'spot' },
      el('h2', null, 'Top 10 ', el('span', { text: 'by implied value' })),
      el('p', { text: 'The strongest launches on the radar.' }),
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
        el('h2', { text: 'No matches' }),
        el('p', { text: 'Clear the filters.' }),
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
          el('span', { class: 'model-line', text: 'x' + r.category_multiple + ' · ' + fmtPct(r.relative_growth_pct) + ' vs cat · ' + r.launch_factor + ' launch · #' + (catStats[r.slug] ? catStats[r.slug].rank : r.rank) + ' in ' + (r.category || 'Other') + ' · TVL #' + (tvlRank[r.slug] || r.rank) })
        )),
        el('td', null, signalBadge(r.signal)),
        el('td', null, r.boundary ? el('span', { class: 'status bnd', text: 'no token · boundary' }) : el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: DATA.board_size + ' rows · watchlist ' + DATA.watchlist_size + '/' + DATA.watchlist_size + ' · Prime ' + signalCount('Prime') + ' · strongest first — click a row for its plan' }),
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
          el('caption', { class: 'sub', text: 'Live token: market cap is a fact, not a model.' }),
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
    var alpha = (cal.size_alpha === null || cal.size_alpha === undefined) ? m.size_alpha : cal.size_alpha;
    var bands = cal.size_bands || [];
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures; no name is special-cased.' }),
      el('div', { class: 'formula' },
        'implied = round( K x tvl^' + alpha + ' x growth x launch )\n' +
        'K = category level: median(market cap / tvl^' + alpha + ') over its live-token protocols, shrunk to global K 132.7633 (pseudo-count 10); thin categories use the global K\n' +
        'growth = 1 + (clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') - baseline) / 100 x ' + m.growth_weight_up + ' ahead, x ' + m.growth_weight_down + ' behind\n' +
        'launch = age x category x chain: age = ' + m.launch_age_floor + ' + ' + (1 - m.launch_age_floor).toFixed(2) + ' x min(1, F(age) / 0.3778), F(age) = 1 - exp(-0.00026 x age); category = 0.5 + 0.5 x (rate / 19.4%), clamped ' + m.launch_cat_min + '-' + m.launch_cat_max + '; chain = 1.1254 on Ethereum, 0.8686 off it'
      ),
      el('ul', null,
        el('li', null, el('b', { text: 'The market pays less per TVL dollar as protocols get bigger. ' }), 'Across the ' + (cal.live_count || 0) + ' live-token protocols, market cap grows as TVL^' + alpha + ', not TVL: doubling TVL adds about 55%. The median ratio falls from ' + (bands.length > 0 ? bands[0].median_ratio : '0.42') + ' under $50M to ' + (bands.length > 0 ? bands[bands.length - 1].median_ratio : '0.01') + ' above $10B, and each row shows its effective multiple.'),
        el('li', null, el('b', { text: 'The level K is calibrated per category, not guessed — and shrunk toward the global level. ' }), 'Each category\'s K is the median of market cap / TVL^' + alpha + ' over its own live-token protocols, pulled toward the global K 132.7633 with a pseudo-count of 10: shrinking cuts the leave-one-out error from 2.25 to 2.12. Thin categories use the global K.'),
        el('li', null, el('b', { text: 'Out of sample, the power law beats the flat multiple. ' }), 'Leave-one-out over the 128 live-token protocols: a flat median multiple errs 2.309 log units, the global power law 2.106, the shrunk category levels 2.12 — so the levels are shrunk toward the global curve. The power law ranks the live tokens with a Spearman correlation of 0.417: the model ranks, it does not price exactly.'),
        el('li', null, el('b', { text: 'Launch likelihood is read from the snapshot, not drawn as a triangle. ' }), 'The share with a token rises with age and never falls, so the age factor climbs a fitted curve. The hazard (0.00026 a day) is fitted by maximum likelihood; a Weibull hazard is not significantly better.'),
        el('li', null, el('b', { text: 'Categories launch at different rates. ' }), 'In the mature window Basis Trading launches 40% and RWA 30%, while Risk Curators launch 6% and Onchain Capital Allocators 5%. Each row uses its category\'s rate, shrunk toward the global ' + (cal.launch_global_rate !== undefined ? (cal.launch_global_rate * 100).toFixed(1) + '%' : '19.4%') + ' and clamped.'),
        el('li', null, el('b', { text: 'The chain matters: Ethereum protocols launch more often. ' }), 'In the mature window protocols on Ethereum launch ' + (cal.chain_eth_rate !== undefined ? (cal.chain_eth_rate * 100).toFixed(1) + '%' : '24.2%') + ' against ' + (cal.chain_noneth_rate !== undefined ? (cal.chain_noneth_rate * 100).toFixed(1) + '%' : '14.3%') + ' off it. A logit with full category controls still gives the Ethereum dummy z = +2.0, so the launch factor is ' + (cal.chain_eth_factor !== undefined ? cal.chain_eth_factor : '1.13') + ' on Ethereum and ' + (cal.chain_noneth_factor !== undefined ? cal.chain_noneth_factor : '0.87') + ' off it. The chain count itself carries nothing (z = +0.23): Ethereum specifically, not "a big chain".'),
        el('li', null, el('b', { text: 'Growth is measured against the category, and earns only a small premium. ' }), 'The baseline is the median seven-day change of the rankable protocols in that category, so growth is priced at ' + m.growth_weight_up + ' up and ' + m.growth_weight_down + ' down.'),
        el('li', null, el('b', { text: 'Two tempting value signals were tested and rejected out of sample. ' }), 'Log age looks strong in-sample (t = +2.9), but leave-one-out says adding it makes prediction worse; growth\'s t-statistic swings from -1.1 to -3.2 with the specification. Neither enters the price.'),
        el('li', null, el('b', { text: 'The signal is derived — and growth does not veto Prime. ' }), 'Prime means top-quarter implied value, a launch factor of at least 0.5, and 180 days. Growth carries no link to launching (logit z = -0.76), so a top-value protocol is Prime even when its TVL fell last week — the fall is flagged as a risk.'),
        el('li', null, el('b', { text: '"No token" means no token on record. ' }), 'The snapshot records no token for these protocols; it does not prove none exists.')
      ),
      el('h3', { class: 'cal-title', text: 'The size curve, in the snapshot\'s numbers' }),
      el('p', { class: 'sub', text: 'The median market-cap-to-TVL ratio in each TVL band — it falls with size, the evidence for K x TVL^' + alpha + '.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'cal' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'TVL band' }),
            el('th', { scope: 'col', text: 'Protocols' }),
            el('th', { scope: 'col', text: 'Median mcap / TVL' })
          )),
          el('tbody', null, bands.map(function (b) {
            var hi = (b.hi_usd === null || b.hi_usd === undefined) ? 'over $' + Math.round(b.lo_usd / 1e9) + 'B' : '$' + Math.round(b.lo_usd / 1e6) + 'M – $' + (b.hi_usd >= 1e9 ? Math.round(b.hi_usd / 1e9) + 'B' : Math.round(b.hi_usd / 1e6) + 'M');
            return el('tr', null,
              el('td', null, el('b', { text: hi })),
              el('td', { class: 'num', text: String(b.n) }),
              el('td', { class: 'num', text: String(b.median_ratio) })
            );
          }))
        )
      ),
      el('h3', { class: 'cal-title', text: 'The launch curve, in the snapshot\'s numbers' }),
      el('p', { class: 'sub', text: 'The share that already trade a token, by age — it rises and never falls.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'cal' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Age' }),
            el('th', { scope: 'col', text: 'Share with a token' }),
            el('th', { scope: 'col', text: 'Fitted curve' })
          )),
          el('tbody', null, (cal.launch_bands || []).map(function (b) {
            var hz = (cal.launch_hazard === null || cal.launch_hazard === undefined) ? 0.0002 : cal.launch_hazard;
            var fit = 1 - Math.exp(-hz * Math.round((b.lo_days + b.hi_days) / 2));
            return el('tr', null,
              el('td', null, el('b', { text: b.lo_days + '–' + b.hi_days + 'd (' + b.n + ')' })),
              el('td', { class: 'num', text: (b.frac * 100).toFixed(1) + '%' }),
              el('td', { class: 'num', text: (fit * 100).toFixed(1) + '%' })
            );
          }))
        )
      ),
      el('h3', { class: 'cal-title', text: 'Calibrated by category' }),
      el('p', { class: 'sub', text: 'Each category: the multiple at $100M of TVL its level K pays (with the middle half of its live-token ratios), its mature-window launch share, and its rankable protocols\' seven-day change.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'cal' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', text: 'Multiple at $100M (n)' }),
            el('th', { scope: 'col', text: 'Ratio IQR' }),
            el('th', { scope: 'col', text: 'Launches (n)' }),
            el('th', { scope: 'col', text: '7d baseline (n)' })
          )),
          el('tbody', null, cats.map(function (c) {
            var kRef = (c.size_k_ref === null || c.size_k_ref === undefined) ? c.multiple : c.size_k_ref;
            return el('tr', null,
              el('td', null, el('b', { text: c.category })),
              el('td', { class: 'num', text: String(kRef) + ' (' + c.size_n + ')' }),
              el('td', { class: 'num', text: String(c.ratio_q1) + ' – ' + String(c.ratio_q3) }),
              el('td', { class: 'num', text: ((c.launch_rate || 0) * 100).toFixed(1) + '% (' + (c.launch_n || 0) + ') x' + (c.launch_factor || 1) }),
              el('td', { class: 'num', text: fmtPct(c.growth_baseline) + ' (' + c.growth_n + ')' })
            );
          }))
        )
      ),
      el('h3', { class: 'cal-title', text: 'Not ranked, on purpose' }),
      el('p', { class: 'sub', text: (DATA.excluded_above_floor || 0) + ' pre-token protocols above the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor are left off the board: centralised exchanges, wrapped, staked or bridged products of tokens that already trade, or versioned pools — and ' + (DATA.boundary_size || 0) + ' above-floor protocols the snapshot\'s own fields say are clean are ranked instead, flagged Boundary.' }),
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
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot; age is the time since first listing (unlisted ages use ' + m.unknown_age_days + ' days. The early radar is every pre-token protocol below the watchlist floor, by TVL.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function riskNote(row) {
    var notes = [];
    if ((row.relative_growth_pct !== undefined ? row.relative_growth_pct : 0) < -10) notes.push('TVL shrinking fast against its category (' + fmtPct(row.relative_growth_pct) + ' vs baseline)');
    if ((row.launch_factor !== undefined ? row.launch_factor : 1) < 0.5) notes.push('a low launch factor (' + row.launch_factor + '): its age, category and chain rarely launch');
    if (!row.chains || row.chains.length === 1) notes.push('single chain');
    if (row.tvl_usd < 10000000) notes.push('TVL under $10M');
    if (notes.length === 0) return 'No single red flag: growth at or above its category, launch factor at or above 0.5, more than one chain, TVL over $10M.';
    return 'Fragile where: ' + notes.join('; ') + '.';
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    var m = DATA.model;
    var catEntry = (DATA.calibration && DATA.calibration.categories ? DATA.calibration.categories : []).filter(function (c) { return c.category === (row.category || 'Other'); })[0];
    var catOwn = catEntry && catEntry.size_n >= (m.category_min_sample || 5);
    var multLabel = catOwn ? (row.category || 'Other') + ' level K, calibrated' : 'global level K';
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
        el('div', null, el('span', { text: 'Category level K' }), el('b', { class: 'num', text: String(row.size_k !== undefined ? row.size_k : '') })),
        el('div', null, el('span', { text: 'Effective multiple' }), el('b', { class: 'num', text: String(row.category_multiple !== undefined ? row.category_multiple : '') })),
        el('div', null, el('span', { text: '7-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Category baseline' }), el('b', { class: 'num', text: fmtPct(row.growth_baseline) })),
        el('div', null, el('span', { text: 'Growth vs category' }), el('b', { class: 'num', text: fmtPct(row.relative_growth_pct) })),
        el('div', null, el('span', { text: 'Age, no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Launch age factor' }), el('b', { class: 'num', text: String(row.launch_age_factor !== undefined ? row.launch_age_factor : '') })),
        el('div', null, el('span', { text: 'Launch category factor' }), el('b', { class: 'num', text: String(row.launch_cat_factor !== undefined ? row.launch_cat_factor : '') + ' (' + Math.round((row.launch_rate || 0) * 100) + '% launch rate)' })),
        el('div', null, el('span', { text: 'Launch chain factor' }), el('b', { class: 'num', text: String(row.launch_chain_factor !== undefined ? row.launch_chain_factor : '') + ((row.chains || []).indexOf('Ethereum') >= 0 ? ' (on Ethereum)' : ' (off Ethereum)') })),
        el('div', null, el('span', { text: 'Launch factor' }), el('b', { class: 'num', text: String(row.launch_factor) })),
        el('div', { class: 'hl' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Per $100 farmed' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd / (capitalFor(row) / 100)) + ' per $100' }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ' (' + multLabel + '): at this TVL the effective multiple is ' + (row.category_multiple !== undefined ? row.category_multiple : m.base_multiple) + ' — a $100M protocol in this category would be priced at ' + (row.size_k_ref !== undefined ? row.size_k_ref : m.base_multiple) + '. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + (row.boundary ? ' Boundary row: above the watchlist floor, ranked because the snapshot\'s own fields say it is clean.' : '') })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Why farm this one' }),
      el('p', { class: 'why', text: whyFarm(row) })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'What could go wrong' }),
      el('p', { class: 'why', text: riskNote(row) })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('p', { class: 'sub', text: planSummary(row) }),
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
      el('p', { text: 'Source: ' + DATA.source + '. Floor: $' + (DATA.floor_usd / 1e6) + 'M TVL. Model ' + DATA.model_version + '. Watchlist plus ' + DATA.early_size + ' early rows below the floor and ' + (DATA.boundary_size || 0) + ' boundary rows above it.' }),
      el('p', { text: 'Pre-token means the snapshot records no token for it. That is a record, not proof.' })
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(categoryChart());
    shell.appendChild(chainChart());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') { var fw = farmWeek(); if (fw) shell.appendChild(fw); }
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
