// The token radar's model, radar-4: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// every rankable pre-token protocol below the watchlist floor: the early rows the radar exists to
// find. A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko
// id, no symbol); the snapshot's live-token protocols are kept apart and shown as the market's own
// values, never mixed into the ranked board. The live-token protocols also calibrate the model,
// twice over: the base multiple is the median market-cap-to-TVL ratio of the live-token protocols
// in the same category (a category earns its own multiple only when at least five of its tokens
// already trade; thinner categories fall back to the global median), and the maturity peak is the
// median age of the live-token protocols, easing by their 90th percentile. So every number in the
// model is read from the data, not hardcoded.
//
// Implied value follows only from the snapshot's own figures, and from no protocol name:
//
//   base       = tvl_usd x CATEGORY_MULTIPLE (calibrated per category, see above)
//   growth     = clamp(change_7d, -80, 200) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_UP    when growth >= 0
//              = 1 + (growth / 100) x GROWTH_DOWN  when growth < 0
//   maturity   = a peak, not a staircase: a protocol is most likely to launch once it has run about
//                as long as the live-token protocols typically took to trade one, and less likely the
//                longer it goes past that without one.
//                0.5 at day 0, rising to 1.0 at PEAK_DAYS, then easing to OLD_MULT by OLD_DAYS.
//   implied    = max(1, round(base x growthMult x maturity))
//
// Growth is asymmetric on purpose: a shrinking protocol still holds its TVL, so a fall costs less
// than a rise of the same size pays, and a fast grower earns a real premium. Age is a peak on
// purpose: a protocol that has run far past the typical token age without launching one has had
// that long to do it and has not, so it is worth less than a protocol at the peak age of the same
// size. No protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them.
 * The base multiple and the maturity peak are NOT hardcoded: buildRadar calibrates them from the
 * snapshot's own live-token protocols (a per-category median market-cap-to-TVL ratio, and the
 * median and 90th percentile of their ages), so the numbers follow from the data, and the values
 * below are only the fallbacks when a snapshot carries no live-token protocol to read. */
export interface ModelConstants {
  base_multiple: number;
  category_min_sample: number;
  growth_weight_up: number;
  growth_weight_down: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_peak: number;
  maturity_peak_days: number;
  maturity_old: number;
  maturity_old_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.2,
  category_min_sample: 5,
  growth_weight_up: 0.8,
  growth_weight_down: 0.5,
  growth_floor: -80,
  growth_cap: 200,
  maturity_floor: 0.5,
  maturity_peak: 1.0,
  maturity_peak_days: 730,
  maturity_old: 0.55,
  maturity_old_days: 1825,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL.
 * radar-3 carries every rankable one (no cap): the early radar is the whole field below the
 * floor, not a top slice of it. */
export const EARLY_ROWS = 10000;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A launch signal: a derived tier, never a name. Prime = top value, in the launch window, growing. */
export type LaunchSignal = 'Prime' | 'Watch' | 'Early';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  signal: LaunchSignal;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  signal: LaunchSignal;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One calibrated category multiple: the median market-cap-to-TVL ratio of the live-token
 * protocols in that category, how many of them there are, and the multiple the board uses. */
export interface CategoryMultiple {
  category: string;
  live_count: number;
  median_ratio: number;
  multiple: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: {
    base_multiple: number;
    live_count: number;
    median_ratio: number;
    peak_days: number;
    old_days: number;
    categories: CategoryMultiple[];
  };
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  excluded_above_floor: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The maturity multiplier: rises from the floor to the peak at PEAK_DAYS, then eases to OLD by OLD_DAYS. */
export function maturityMultiplier(age: number | null, model: ModelConstants): number {
  const a = age ?? model.unknown_age_days;
  if (a <= model.maturity_peak_days) {
    return model.maturity_floor + (model.maturity_peak - model.maturity_floor) * (a / model.maturity_peak_days);
  }
  const past = Math.min(a - model.maturity_peak_days, model.maturity_old_days - model.maturity_peak_days);
  return model.maturity_peak - (model.maturity_peak - model.maturity_old) * (past / (model.maturity_old_days - model.maturity_peak_days));
}

/** The three multipliers and the implied value one protocol gets under `model`, priced at its
 * category's calibrated multiple: a lending protocol's token is worth a different share of its
 * TVL than a DEX's, because the tokens that already trade say so. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiple: number,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const weight = growthPct >= 0 ? model.growth_weight_up : model.growth_weight_down;
  const growthMult = 1 + (growthPct / 100) * weight;
  const maturityMult = maturityMultiplier(age, model);
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

/** A row's launch signal, from its rank, its age and its growth alone: no name is consulted. */
export function launchSignal(rank: number, boardSize: number, age: number | null, growthPct: number): LaunchSignal {
  const top = rank <= Math.max(10, Math.ceil(boardSize * 0.25));
  const inWindow = age !== null && age >= 180 && age <= 1095;
  if (top && inWindow && growthPct >= -10) return 'Prime';
  if (top || growthPct > 5) return 'Watch';
  return 'Early';
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** Calibrate the base multiple from the snapshot's own live-token protocols: the median
 * market-cap-to-TVL ratio of every live-token protocol that reports both a market cap and a
 * TVL. A token's launch value is estimated from what tokens that already trade are worth
 * against the TVL behind them, read from this snapshot, not from a hardcoded multiple.
 * The median is robust to the outliers (a few protocols trade at many times their TVL) and
 * the clamp keeps the multiple sane when a snapshot carries few live-token protocols. */
export function calibrateBaseMultiple(snapshot: Snapshot): { multiple: number; live_count: number; median_ratio: number } {
  const ratios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      ratios.push(p.mcap_usd / p.tvl_usd);
    }
  }
  ratios.sort((a, b) => a - b);
  const n = ratios.length;
  if (n === 0) return { multiple: MODEL.base_multiple, live_count: 0, median_ratio: MODEL.base_multiple };
  const median = n % 2 === 1 ? ratios[(n - 1) / 2]! : (ratios[n / 2 - 1]! + ratios[n / 2]!) / 2;
  const multiple = Math.min(1.0, Math.max(0.05, Math.round(median * 100) / 100));
  return { multiple, live_count: n, median_ratio: Math.round(median * 10000) / 10000 };
}

/** The q-th percentile of a sorted array, linearly interpolated; null when it is empty. */
function percentile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** Calibrate the maturity peak from the snapshot's own live-token protocols: the peak is the
 * median age of the protocols that already trade a token, and the old age is their 90th
 * percentile. A pre-token protocol is most likely to launch once it has run about as long as
 * the protocols that already trade one, and worth less the further it runs past that without
 * one. Falls back to the model's constants when the snapshot carries no dated live-token
 * protocol. */
export function calibrateAgePeak(snapshot: Snapshot): { peak_days: number; old_days: number } {
  const ages: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0) {
      const a = ageDays(snapshot.as_of, p.listed_at);
      if (a !== null) ages.push(a);
    }
  }
  ages.sort((a, b) => a - b);
  const peak = percentile(ages, 0.5);
  const old = percentile(ages, 0.9);
  return {
    peak_days: peak === null ? MODEL.maturity_peak_days : Math.round(peak),
    old_days: old === null ? MODEL.maturity_old_days : Math.round(old),
  };
}

/** Calibrate one multiple per category from the snapshot's own live-token protocols: the median
 * market-cap-to-TVL ratio of the live-token protocols in that category. A category earns its
 * own multiple only when at least `minSample` of its tokens already trade: one token's ratio
 * is one observation, not a calibration, and a single outlier (a token trading at hundreds of
 * times its TVL) must never set the multiple for a whole category. Thinner categories, and
 * protocols with no category at all, fall back to the global median. The list is sorted by
 * category name, so the dashboard's table is deterministic. */
export function calibrateCategoryMultiples(
  snapshot: Snapshot,
  globalMultiple: number,
  minSample: number = MODEL.category_min_sample,
): CategoryMultiple[] {
  const byCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const key = p.category ?? 'Other';
      const list = byCategory.get(key);
      if (list === undefined) byCategory.set(key, [p.mcap_usd / p.tvl_usd]);
      else list.push(p.mcap_usd / p.tvl_usd);
    }
  }
  const out: CategoryMultiple[] = [];
  for (const category of [...byCategory.keys()].sort()) {
    const ratios = byCategory.get(category)!.sort((a, b) => a - b);
    const n = ratios.length;
    const median = n % 2 === 1 ? ratios[(n - 1) / 2]! : (ratios[n / 2 - 1]! + ratios[n / 2]!) / 2;
    const multiple =
      n >= minSample
        ? Math.min(1.0, Math.max(0.05, Math.round(median * 100) / 100))
        : globalMultiple;
    out.push({ category, live_count: n, median_ratio: Math.round(median * 10000) / 10000, multiple });
  }
  return out;
}

/** The multiple one protocol is priced at: its category's calibrated multiple, or the global
 * median when its category earned none. */
export function multipleFor(category: string | null, multiples: CategoryMultiple[], globalMultiple: number): number {
  const found = multiples.find((m) => m.category === (category ?? 'Other'));
  return found === undefined ? globalMultiple : found.multiple;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. Each row is priced at its
 * category's calibrated multiple, so two protocols of the same TVL, growth and age can still
 * rank apart when their categories' tokens trade at different shares of TVL. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  multiples: CategoryMultiple[] = [],
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const multiple = multipleFor(p.category, multiples, model.base_multiple);
    const { implied, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, model, multiple);
    return { p, implied, growthPct, growthMult, maturityMult, age, multiple };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const boardSize = scored.length;
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    signal: launchSignal(i + 1, boardSize, s.age, s.growthPct),
    model: {
      base_multiple: s.multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second action: a different, complementary position in the same protocol, so the
 * plan is a real position with two legs rather than a single deposit. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.max(25, Math.round(capital / 2));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply a second $${half} of a different asset to ${name} on ${chain} and keep both positions open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Add $${half} of liquidity to a second pool on ${name} and keep both positions open.`;
  if (c.includes('bridge')) return `Bridge a second $${half} of USDC through ${name} to a different destination chain.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake a second $${half} of the staking asset through ${name} and keep both receipts.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Open a second small position in the opposite direction on ${name} as a hedge.`;
  if (c.includes('prediction')) return `Place a second position on a different market outcome on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${half} into a second ${name} vault with a different risk profile.`;
  if (c.includes('stable')) return `Mint a second tranche of $${half} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint a second tranche of $${half} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy a second cover of $${half} from ${name} on ${chain} for a different risk.`;
  return `Make a second deposit of $${half} into ${name} on ${chain} and keep both positions open.`;
}

/**
 * A protocol's farm plan: ten steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * It builds a two-leg position, counts it on a second chain when the protocol runs on one, tracks
 * the position weekly in a log, holds it across snapshots, checks the protocol's own points or
 * rewards page, decides the unwind before the excitement, and claims only from the link the
 * protocol publishes.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const half = Math.max(25, Math.round(capital / 2));
  const cross =
    p.chains.length > 1
      ? `Bridge $${half} of USDC to ${p.chains[1]} through ${p.name} and repeat the core action there, so the position counts on two chains.`
      : `Increase the position by $${half} and confirm the new balance on ${p.name}'s own page.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `$${half} of capital and about $3 of gas`,
      time: '10 minutes to set up',
    },
    {
      text: cross,
      cost: `$${half} of capital and about $4 of gas`,
      time: '10 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Check the protocol's TVL and your points balance once a week and write both numbers in the farm log, so a drop or a missed snapshot shows up before it costs the position.`,
      cost: 'nothing but the log',
      time: '5 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital + half} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open ${p.name}'s own points or rewards page, complete any quests it lists, and confirm the position is counted before the next snapshot.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the unwind rule in the farm log before the first deposit: claim within a week of a launch, and unwind if the position falls below half its starting value, so the exit is decided before the excitement.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Claim only from the link ${p.name} itself publishes, never from a link in a message, and write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    signal: row.signal,
    category_multiple: row.model.base_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** The whole radar: the board and the dashboard's data, from one snapshot. The base multiple, the
 * per-category multiples and the maturity peak are all calibrated from the snapshot's live-token
 * protocols before the board is built, so every implied value in the board uses the calibrated
 * numbers. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const base = calibrateBaseMultiple(snapshot);
  const categories = calibrateCategoryMultiples(snapshot, base.multiple, model.category_min_sample);
  const agePeak = calibrateAgePeak(snapshot);
  const effective: ModelConstants = {
    ...model,
    base_multiple: base.multiple,
    maturity_peak_days: agePeak.peak_days,
    maturity_old_days: agePeak.old_days,
  };
  const board = buildBoard(snapshot, effective, categories);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  // Pre-token protocols above the floor that the snapshot's own watchlist rule leaves out: mostly
  // wrapped, staked or bridged products of tokens that already trade. The board leaves them out
  // on purpose, and the dashboard says so, so the reader sees the exclusion is a decision, not
  // an oversight.
  const excluded = snapshot.protocols.filter(
    (p) => p.tvl_usd >= snapshot.floor_usd && !snapshot.watchlist.includes(p.slug) && isRankable(p),
  ).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: effective,
    model_version: MODEL_VERSION,
    calibration: {
      base_multiple: base.multiple,
      live_count: base.live_count,
      median_ratio: base.median_ratio,
      peak_days: agePeak.peak_days,
      old_days: agePeak.old_days,
      categories,
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    excluded_above_floor: excluded,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
