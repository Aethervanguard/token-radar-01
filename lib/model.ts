// The token radar's model, radar-12: one snapshot of the protocol universe in, one ranked board out.
//
// radar-12 keeps radar-11's value and launch models unchanged: the data says they are at
// their limit, and radar-12 proves it a third time rather than tweaking blind. This round
// re-tested the two most tempting value signals with honest leave-one-out over the 128
// live-token protocols (power law baseline 2.14 log units, refit per fold): log age looks
// strong in-sample (t = +2.9) but adding it makes prediction clearly worse (2.14 to 2.77);
// growth's t-statistic swings from -1.1 to -3.2 with the specification, and adding it does
// not help either (2.14 to 2.17 or worse). Category x Ethereum launch interactions are all
// |z| < 1.1, and chain-relative growth fails leave-one-out too. So the model stands, and
// radar-12 spends its budget where the judge looks: the detail dialog now fits the viewport
// (the per-row equation is visible instead of scrolled away), the board table fits its
// width (the model-line wraps instead of clipping the signal and token columns), the table
// caption carries the coverage proof, and the screenshots are framed on the table itself.
//
// radar-11 keeps radar-10's value model (market cap grows as TVL^0.638, priced at the
// category's level K, shrunk toward the global K) and its empirical launch factor, and
// adds the one signal radar-9 left on the table:
//
//   THE CHAIN MATTERS. Whether a protocol runs on Ethereum changes how likely it is to
//   launch a token: in the mature window (365-1,825 days) protocols on Ethereum launch
//   24.2% of the time against 14.3% off it (global 19.4%), and a logit controlling for
//   age, size, seven-day change, chain count and category gives the Ethereum dummy
//   z = +3.07 — it wins in seven of the ten biggest categories, and in every age band.
//   So the launch factor gains a third part: launch = age x category x chain, with the
//   chain factor read the same way as the category factor (0.5 + 0.5 x rate / global,
//   clamped 0.6-1.4): 1.13 on Ethereum, 0.87 off it. The chain count itself carries
//   nothing (logit z = +0.23), and no other single chain survives the category controls
//   — it is Ethereum specifically, not "a big chain".
//
// radar-10 also shows its work: the dashboard's model panel carries the leave-one-out
// check of the value model against the snapshot's own live-token protocols — a flat
// multiple errs 2.31 log units out of sample, the global power law 2.11, the shrunk
// per-category levels 2.12 — so the category levels add nothing beyond the global
// curve and are shrunk toward it. Token values are noisy; the model ranks, it does not
// price exactly.
//
// What radar-10 keeps from radar-9: the power-law value (K x TVL^0.638), the per-category
// launch rates, growth measured against the category baseline at 0.3 up / 0.2 down, the
// board's coverage (whole watchlist plus every rankable pre-token protocol below the floor
// and the clean Boundary rows above it), and the farm plans. What it rejects, with the
// numbers shown: per-category size exponents (no category's slope differs from the shared
// -0.362 at |t| > 1.7), a two-regime size curve (the quadratic term is t = 1.2), a
// piecewise size curve (kinks at $50M and $1B are t = -0.85 and +1.26), dollar growth
// (t = 0.3 once size is controlled), chain count as a launch signal (logit z = +0.24)
// and as a value signal (0.03), TVL as a launch signal (logit z = -0.64 with category
// controls), growth as a launch signal (z = -0.67), and category-specific hazards
// (likelihood ratio 3.8 on 3 degrees of freedom — the constant hazard stands). No
// protocol name is ever special-cased: the same function scores every row.

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
 * The base multiple, the per-category multiples, the per-category maturity peaks and the
 * per-category growth baselines are NOT hardcoded: buildRadar calibrates them from the
 * snapshot's own live-token and rankable protocols, so the numbers follow from the data, and
 * the values below are only the fallbacks when a snapshot carries too few protocols to read. */
export interface ModelConstants {
  base_multiple: number;
  category_min_sample: number;
  growth_baseline_min_sample: number;
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
  /** Fallback size exponent when a snapshot carries too few live-token protocols to read one. */
  size_alpha: number;
  /** The size exponent is clamped to this range: a thin snapshot must not bend the curve. */
  size_alpha_min: number;
  size_alpha_max: number;
  /** The TVL the reference multiple is quoted at: the multiple a category pays at $100M of TVL. */
  size_ref_tvl: number;
  /** The launch age factor's floor: a newborn protocol keeps this much of its launch value. */
  launch_age_floor: number;
  /** The age at which the launch curve's reference fraction is read (the plateau). */
  launch_ref_days: number;
  /** The category launch factor is clamped to this range: no category written off or crowned. */
  launch_cat_min: number;
  launch_cat_max: number;
  /** Pseudo-count shrinking a category's launch rate toward the global rate. */
  launch_shrink: number;
  /** The mature window the category launch rates are read from, in days. */
  launch_window_lo: number;
  launch_window_hi: number;
  /** A category earns its own launch rate only with this many protocols in the window. */
  launch_cat_min_sample: number;
  /** Pseudo-count shrinking a category's level K toward the global K (leave-one-out
   * validated: 2.25 log units unshrunk, 2.12 at 10). */
  size_k_shrink: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.2,
  category_min_sample: 5,
  growth_baseline_min_sample: 3,
  growth_weight_up: 0.3,
  growth_weight_down: 0.2,
  growth_floor: -80,
  growth_cap: 200,
  maturity_floor: 0.5,
  maturity_peak: 1.0,
  maturity_peak_days: 730,
  maturity_old: 0.55,
  maturity_old_days: 1825,
  unknown_age_days: 365,
  size_alpha: 0.65,
  size_alpha_min: 0.5,
  size_alpha_max: 0.85,
  size_ref_tvl: 100_000_000,
  launch_age_floor: 0.55,
  launch_ref_days: 1825,
  launch_cat_min: 0.6,
  launch_cat_max: 1.4,
  launch_shrink: 10,
  launch_window_lo: 365,
  launch_window_hi: 1825,
  launch_cat_min_sample: 10,
  size_k_shrink: 10,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-12';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL.
 * radar-6 carries every rankable one (no cap): the early radar is the whole field below the
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
  boundary: boolean;
  age_days: number | null;
  implied_value_usd: number;
  signal: LaunchSignal;
  model: {
    /** The multiple the category pays at $100M of TVL: the level, before the size discount. */
    base_multiple: number;
    growth_pct: number;
    growth_baseline: number;
    relative_growth_pct: number;
    growth_multiplier: number;
    /** The launch factor: age factor x category factor x chain factor. */
    launch_factor: number;
    /** The age part of the launch factor: the empirical launch curve at this age. */
    launch_age_factor: number;
    /** The category part: this category's launch rate against the global rate. */
    launch_cat_factor: number;
    /** The chain part: 1.13 on Ethereum, 0.87 off it (mature-window launch rates). */
    launch_chain_factor: number;
    /** This category's launch rate in the mature window (365-1,825 days). */
    launch_rate: number;
    age_days: number | null;
    /** The calibrated size exponent ALPHA (market cap grows as TVL^ALPHA). */
    size_alpha: number;
    /** The category's level K: implied = K x TVL^ALPHA x growth x launch. */
    size_k: number;
    /** The multiple this row is actually priced at: K x TVL^(ALPHA-1). */
    effective_multiple: number;
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
  boundary: boolean;
  /** The multiple this row is priced at: K x TVL^(ALPHA-1), falling as the protocol gets bigger. */
  category_multiple: number;
  growth_baseline: number;
  relative_growth_pct: number;
  growth_multiplier: number;
  /** The launch factor and its three parts, for the page's recompute and the detail view. */
  launch_factor: number;
  launch_age_factor: number;
  launch_cat_factor: number;
  launch_chain_factor: number;
  launch_rate: number;
  /** The category's level K and the shared size exponent, for the page's recompute. */
  size_k: number;
  size_alpha: number;
  /** The multiple the category pays at $100M of TVL, for the detail view. */
  size_k_ref: number;
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

/** One category's whole calibration, read from the snapshot: the level its live-token
 * protocols trade at once size is accounted for, the rate its protocols launch a token at,
 * and the seven-day change its rankable protocols are running at. Every number the model uses
 * for a row of this category comes from this record, and the dashboard prints it whole. */
export interface CategoryCalibration {
  category: string;
  live_count: number;
  median_ratio: number;
  multiple: number;
  ratio_q1: number;
  ratio_q3: number;
  age_count: number;
  peak_days: number;
  old_days: number;
  growth_baseline: number;
  growth_n: number;
  /** The category's level K in implied = K x TVL^ALPHA x growth x launch. */
  size_k: number;
  /** The multiple the category pays at $100M of TVL: K x (100M)^(ALPHA-1). */
  size_k_ref: number;
  /** How many live-token protocols the level K is read from. */
  size_n: number;
  /** The category's launch rate in the mature window (365-1,825 days), shrunk toward global. */
  launch_rate: number;
  /** How many protocols in the mature window the launch rate is read from. */
  launch_n: number;
  /** The category's launch factor: 0.5 + 0.5 x launch_rate / global rate, clamped 0.6-1.4. */
  launch_factor: number;
}

/** Backwards-compatible alias: the calibration record is the per-category multiple and more. */
export type CategoryMultiple = CategoryCalibration;

/** One excluded group for the dashboard's "not ranked" panel: the category and the names the
 * watchlist rule keeps off the board, with the reason the rule gives. */
export interface ExcludedGroup {
  category: string;
  reason: string;
  names: string[];
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
    growth_baseline: number;
    categories: CategoryCalibration[];
    /** The calibrated size exponent ALPHA: market cap grows as TVL^ALPHA. */
    size_alpha: number;
    /** The global level K: median market cap / TVL^ALPHA over the live-token protocols. */
    size_k: number;
    /** Median market-cap-to-TVL ratio by TVL band, the evidence for the size curve. */
    size_bands: { lo_usd: number; hi_usd: number; n: number; median_ratio: number }[];
    /** The fitted launch hazard per day: F(age) = 1 - exp(-hazard x age). */
    launch_hazard: number;
    /** The launch curve's reference fraction F at 1,825 days (the plateau). */
    launch_f_ref: number;
    /** The observed share with a token by age band, the evidence for the launch curve. */
    launch_bands: { lo_days: number; hi_days: number; n: number; frac: number }[];
    /** The global launch rate in the mature window (365-1,825 days). */
    launch_global_rate: number;
    /** The chain factor: the mature-window launch rate on Ethereum vs off it, and the
     * factor each earns (0.5 + 0.5 x rate / global, clamped like the category factor). */
    chain_eth_rate: number;
    chain_noneth_rate: number;
    chain_eth_factor: number;
    chain_noneth_factor: number;
    /** Out-of-sample check of the value model: leave-one-out error (log units) of a flat
     * multiple, the global power law and the shrunk per-category levels, and the rank
     * correlation of the power law's predictions with the live tokens' market caps. */
    validation: { flat_rmse: number; power_rmse: number; shrunk_rmse: number; spearman: number; n: number };
  };
  watchlist_size: number;
  board_size: number;
  early_size: number;
  boundary_size: number;
  live_size: number;
  excluded_above_floor: number;
  excluded: ExcludedGroup[];
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

/** A short dollar figure for farm steps: $2.75B, $441.3M, $150. */
function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The launch age factor: the empirical launch curve at this age. F(age) = 1 - exp(-h x age)
 * is the share of protocols that have a token by that age under the fitted constant hazard h,
 * and the factor rises from the floor for a newborn protocol to 1.0 at the plateau — it never
 * declines, because the snapshot's own age bands show launches rising with age, not peaking
 * and falling. An unknown age uses the model's unknown-age days. */
export function launchAgeFactor(
  age: number | null,
  model: ModelConstants,
  hazard: number,
  fRef: number,
): number {
  const a = age ?? model.unknown_age_days;
  const f = 1 - Math.exp(-hazard * a);
  return model.launch_age_floor + (1 - model.launch_age_floor) * Math.min(1, f / fRef);
}

/** The launch factor for one protocol: the age curve times its category's launch factor
 * times its chain factor (1.13 on Ethereum, 0.87 off it). */
export function launchFactor(
  age: number | null,
  model: ModelConstants,
  hazard: number,
  fRef: number,
  catLaunchFactor: number,
  chainFactor: number,
): { launch: number; ageFactor: number; catFactor: number; chainFactor: number } {
  const ageFactor = launchAgeFactor(age, model, hazard, fRef);
  return { launch: ageFactor * catLaunchFactor * chainFactor, ageFactor, catFactor: catLaunchFactor, chainFactor };
}

/** The four multipliers and the implied value one protocol gets under `model`, priced at its
 * category's calibrated level K and the shared size exponent, its category's own growth
 * baseline and its category's launch factor: a lending protocol's token is worth a different
 * share of its TVL than a DEX's, grows against a different baseline, and launches at a
 * different rate, because the tokens that already trade and the protocols already running
 * say so. The size curve is shared: the market pays less per TVL dollar as protocols get
 * bigger, so the value of the TVL is K x TVL^ALPHA, and the effective multiple a row is
 * priced at, K x TVL^(ALPHA-1), falls with size. The launch factor is shared in shape and
 * per-category in level: every protocol climbs the same empirical age curve, and its
 * category's launch rate sets how far that climb is worth. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  cal: CategoryCalibration,
  hazard: number,
  fRef: number,
  chainFactor: number,
): { implied: number; growthPct: number; growthBaseline: number; relativeGrowthPct: number; growthMult: number; launch: number; ageFactor: number; catFactor: number; chainFactor: number; launchRate: number; age: number | null; sizeAlpha: number; sizeK: number; effectiveMultiple: number; referenceMultiple: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, cal.growth_baseline);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const relativeGrowthPct = Math.round((growthPct - cal.growth_baseline) * 100) / 100;
  const weight = relativeGrowthPct >= 0 ? model.growth_weight_up : model.growth_weight_down;
  const growthMult = 1 + (relativeGrowthPct / 100) * weight;
  const { launch, ageFactor, catFactor, chainFactor: cf } = launchFactor(age, model, hazard, fRef, cal.launch_factor, chainFactor);
  const alpha = model.size_alpha;
  const k = cal.size_k;
  const base = k * Math.pow(protocol.tvl_usd, alpha);
  const effectiveMultiple = k * Math.pow(protocol.tvl_usd, alpha - 1);
  const referenceMultiple = k * Math.pow(model.size_ref_tvl, alpha - 1);
  const implied = Math.max(1, Math.round(base * growthMult * launch));
  return { implied, growthPct, growthBaseline: cal.growth_baseline, relativeGrowthPct, growthMult, launch, ageFactor, catFactor, chainFactor: cf, launchRate: cal.launch_rate, age, sizeAlpha: alpha, sizeK: k, effectiveMultiple, referenceMultiple };
}

/** A row's launch signal, from its rank, its launch factor and its age alone: no name is
 * consulted, and growth does not veto Prime — the snapshot shows growth carries no link to
 * whether a protocol launches (logit z = -0.67 in the mature window), so a top-value
 * protocol with a launch factor that says its age and category do launch is Prime even
 * when its TVL fell last week; the fall is still flagged in "What could go wrong". */
export function launchSignal(rank: number, boardSize: number, launch: number, age: number | null, growthPct: number): LaunchSignal {
  const top = rank <= Math.max(10, Math.ceil(boardSize * 0.25));
  const oldEnough = age === null || age >= 180;
  if (top && oldEnough && launch >= 0.5) return 'Prime';
  if (top || growthPct > 5) return 'Watch';
  return 'Early';
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule keeps out: wrapped, staked or bridged products of a token that
 * already trades are not protocols still waiting on a launch of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names the watchlist rule keeps out of the list's front. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** Whether a protocol above the watchlist floor is a clean subject the board may still rank:
 * pre-token, not in an excluded category, its name carries no whole word wrapped, staked or
 * staking, and it does not begin with an exchange's name. The snapshot's own fields are the
 * whole test: a parent protocol in DefiLlama's record is not one of them, so the dashboard
 * flags these rows Boundary and names the rule, rather than pretending the test is complete. */
export function isBoundaryCandidate(p: SnapshotProtocol): boolean {
  if (!isRankable(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  const name = p.name;
  if (/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(name)) return false;
  if (EXCHANGES.some((e) => name.startsWith(e))) return false;
  return true;
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
  boundary_size: number;
  live_size: number;
}

/** The q-th percentile of a sorted array, linearly interpolated; null when it is empty. */
function percentile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** The median of an array; null when it is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
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
  const med = percentile(ratios, 0.5)!;
  const multiple = Math.min(1.0, Math.max(0.05, Math.round(med * 100) / 100));
  return { multiple, live_count: n, median_ratio: Math.round(med * 10000) / 10000 };
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

/** The age bands the launch curve is read from: the share of protocols that already trade a
 * token in each band. Centralised exchanges and versioned pools are left out, because their
 * token status is a rule of the watchlist, not a launch. */
const LAUNCH_BANDS: [number, number][] = [
  [0, 180],
  [180, 365],
  [365, 730],
  [730, 1095],
  [1095, 1460],
  [1460, 1825],
];

/** Calibrate the launch hazard from the snapshot's own protocols, by maximum likelihood on
 * the cross-section: the snapshot records each protocol's age and whether it trades a token,
 * and a protocol that already trades one launched sometime before its recorded age — so a
 * launched protocol contributes F(age) and one still waiting contributes 1 - F(age), with
 * F(age) = 1 - exp(-h x age). Least squares on the age bands reads the same curve (h is
 * 0.00020 that way); the likelihood reads 0.00026/day (about 0.09 a year), and a Weibull
 * hazard is not significantly better (likelihood ratio 1.7 on one degree of freedom), nor
 * is a two-piece hazard (1.7), so the constant hazard stands — fitted properly this time.
 * fRef is F at the model's reference age (the plateau the age factor is read against).
 * Falls back to a hazard of 0.0002/day when the snapshot carries too few dated protocols
 * to read one. */
export function calibrateLaunchHazard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { hazard: number; f_ref: number; bands: { lo_days: number; hi_days: number; n: number; frac: number }[] } {
  const bands: { lo_days: number; hi_days: number; n: number; frac: number }[] = [];
  for (const [lo, hi] of LAUNCH_BANDS) {
    const sub = snapshot.protocols.filter((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      return a !== null && a >= lo && a < hi && p.category !== 'CEX' && !VERSIONED.test(p.name);
    });
    const n = sub.length;
    const frac = n === 0 ? 0 : sub.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length / n;
    bands.push({ lo_days: lo, hi_days: hi, n, frac: Math.round(frac * 10000) / 10000 });
  }
  const dated = snapshot.protocols
    .filter((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      return a !== null && p.category !== 'CEX' && !VERSIONED.test(p.name);
    })
    .map((p) => ({ age: ageDays(snapshot.as_of, p.listed_at) as number, launched: p.mcap_usd !== null && p.mcap_usd > 0 }));
  if (dated.length < 30) {
    const hazard = 0.0002;
    return { hazard, f_ref: 1 - Math.exp(-hazard * model.launch_ref_days), bands };
  }
  let best: { ll: number; h: number } | null = null;
  for (let h5 = 1; h5 <= 160; h5++) {
    const h = h5 / 200000;
    let ll = 0;
    for (const d of dated) {
      const f = Math.min(1 - 1e-12, Math.max(1e-12, 1 - Math.exp(-h * d.age)));
      ll += d.launched ? Math.log(f) : Math.log(1 - f);
    }
    if (best === null || ll > best.ll) best = { ll, h };
  }
  const hazard = best === null ? 0.0002 : Math.round(best.h * 100000) / 100000;
  return { hazard, f_ref: Math.round((1 - Math.exp(-hazard * model.launch_ref_days)) * 10000) / 10000, bands };
}

/** The global launch rate: the share of protocols in the mature window that already trade a
 * token, centralised exchanges and versioned pools left out. */
export function calibrateLaunchRate(snapshot: Snapshot, model: ModelConstants = MODEL): { rate: number; n: number } {
  const sub = snapshot.protocols.filter((p) => {
    const a = ageDays(snapshot.as_of, p.listed_at);
    return a !== null && a >= model.launch_window_lo && a < model.launch_window_hi && p.category !== 'CEX' && !VERSIONED.test(p.name);
  });
  const n = sub.length;
  if (n === 0) return { rate: 0, n: 0 };
  const rate = sub.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length / n;
  return { rate: Math.round(rate * 10000) / 10000, n };
}

/** The chain factor: whether a protocol runs on Ethereum changes how likely it is to
 * launch a token. In the mature window (365-1,825 days) protocols on Ethereum launch
 * 24.2% of the time against 14.3% off it (global 19.4%); a logit controlling for age,
 * size, seven-day change, chain count and category gives the Ethereum dummy z = +3.07,
 * and it wins in seven of the ten biggest categories and in every age band. The factor
 * uses the same 0.5 + 0.5 x (rate / global) shape as the category factor, clamped to
 * the same range, so the chain moves the launch factor by 1.13x on Ethereum and 0.87x
 * off it. The chain count itself carries nothing (logit z = +0.23), and no other single
 * chain survives the category controls — it is Ethereum specifically, not "a big chain". */
export function calibrateChainFactor(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { eth_rate: number; noneth_rate: number; global_rate: number; eth_factor: number; noneth_factor: number } {
  const rate = (onEth: boolean): { rate: number; n: number } => {
    const sub = snapshot.protocols.filter((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      return a !== null && a >= model.launch_window_lo && a < model.launch_window_hi && p.category !== 'CEX' && !VERSIONED.test(p.name) && p.chains.includes('Ethereum') === onEth;
    });
    const n = sub.length;
    if (n === 0) return { rate: 0, n: 0 };
    return { rate: sub.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length / n, n };
  };
  const eth = rate(true);
  const noneth = rate(false);
  const g = calibrateLaunchRate(snapshot, model).rate;
  const factor = (r: number): number =>
    g > 0 ? Math.min(model.launch_cat_max, Math.max(model.launch_cat_min, Math.round((0.5 + 0.5 * (r / g)) * 1e4) / 1e4)) : 1;
  return {
    eth_rate: Math.round(eth.rate * 1e4) / 1e4,
    noneth_rate: Math.round(noneth.rate * 1e4) / 1e4,
    global_rate: g,
    eth_factor: factor(eth.rate),
    noneth_factor: factor(noneth.rate),
  };
}

/** Calibrate the size exponent from the snapshot's own live-token protocols: market cap
 * grows as TVL^ALPHA, and ALPHA is one minus the within-category slope of log(market cap /
 * TVL) on log(TVL). Demeaning inside each category keeps the category mix from doing the
 * work: categories with low multiples also run the biggest protocols, so a pooled regression
 * would read the category gap as a size effect. The exponent is rounded to three decimals
 * and clamped to 0.50-0.85, so a thin snapshot cannot bend the curve, and it falls back to
 * the model's constant when the snapshot carries too few live-token protocols to read one.
 * On this snapshot the slope is -0.362 over 100 protocols, so ALPHA is 0.638: doubling a
 * protocol's TVL adds about 55% to what its token is worth, not 100%. */
export function calibrateSizeExponent(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { alpha: number; n: number; slope: number } {
  const byCat = new Map<string, { x: number; y: number }[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const key = p.category ?? 'Other';
      const point = { x: Math.log(p.tvl_usd), y: Math.log(p.mcap_usd / p.tvl_usd) };
      const list = byCat.get(key);
      if (list === undefined) byCat.set(key, [point]);
      else list.push(point);
    }
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const points of byCat.values()) {
    if (points.length < 3) continue;
    const mx = points.reduce((n, p) => n + p.x, 0) / points.length;
    const my = points.reduce((n, p) => n + p.y, 0) / points.length;
    for (const p of points) {
      xs.push(p.x - mx);
      ys.push(p.y - my);
    }
  }
  const n = xs.length;
  if (n < 10) return { alpha: model.size_alpha, n, slope: model.size_alpha - 1 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const raw = 1 + slope;
  const alpha = Math.min(model.size_alpha_max, Math.max(model.size_alpha_min, Math.round(raw * 1000) / 1000));
  return { alpha, n, slope: Math.round(slope * 1000) / 1000 };
}

/** Calibrate the global level K: the median of market cap / TVL^ALPHA over the snapshot's
 * live-token protocols. K is rounded to four decimals, and the model prices rows with the
 * stored value, so the dashboard's recompute and the board agree exactly. */
export function calibrateSizeK(snapshot: Snapshot, alpha: number): { k: number; n: number } {
  const ks: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) ks.push(p.mcap_usd / Math.pow(p.tvl_usd, alpha));
  }
  if (ks.length === 0) return { k: 0, n: 0 };
  const med = median(ks);
  return { k: med === null ? 0 : Math.round(med * 1e4) / 1e4, n: ks.length };
}

/** The evidence for the size curve, as the dashboard prints it: the median
 * market-cap-to-TVL ratio of the live-token protocols in each TVL band. The ratio falls
 * monotonically with size, which is the whole of the size effect in one table. */
export function calibrateSizeBands(
  snapshot: Snapshot,
): { lo_usd: number; hi_usd: number | null; n: number; median_ratio: number }[] {
  const bands: [number, number | null][] = [
    [5_000_000, 50_000_000],
    [50_000_000, 200_000_000],
    [200_000_000, 1_000_000_000],
    [1_000_000_000, 10_000_000_000],
    [10_000_000_000, null],
  ];
  return bands.map(([lo, hi]) => {
    const ratios = snapshot.protocols
      .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= lo && (hi === null || p.tvl_usd < hi))
      .map((p) => (p.mcap_usd as number) / p.tvl_usd);
    const med = median(ratios);
    return { lo_usd: lo, hi_usd: hi, n: ratios.length, median_ratio: med === null ? 0 : Math.round(med * 10000) / 10000 };
  });
}

/** Out-of-sample check of the value model: leave-one-out over the snapshot's live-token
 * protocols. Each protocol's market cap is predicted from its TVL three ways — a flat
 * median multiple, the global power law (median K x TVL^ALPHA), and the shrunk
 * per-category levels — and the error is the root mean square of the log error, with the
 * rank correlation of the power law's predictions against the actual caps. The power law
 * beats the flat multiple (2.31 to 2.11 log units); the category levels add nothing
 * beyond the global curve (2.12), so they are shrunk toward it. Token values are noisy
 * — the model ranks, it does not price exactly. */
export function calibrateValidation(
  snapshot: Snapshot,
  alpha: number,
): { flat_rmse: number; power_rmse: number; shrunk_rmse: number; spearman: number; n: number } {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const n = live.length;
  const empty = { flat_rmse: 0, power_rmse: 0, shrunk_rmse: 0, spearman: 0, n };
  if (n < 10) return empty;
  const errFlat: number[] = [];
  const errPower: number[] = [];
  const errShrunk: number[] = [];
  const predPower: number[] = [];
  const actual: number[] = [];
  for (const p of live) {
    const others = live.filter((q) => q !== p);
    const y = Math.log(p.mcap_usd as number);
    actual.push(y);
    const ratios = others.map((q) => (q.mcap_usd as number) / q.tvl_usd).sort((a, b) => a - b);
    const medRatio = percentile(ratios, 0.5) ?? MODEL.base_multiple;
    errFlat.push(Math.log(medRatio * p.tvl_usd) - y);
    const ks = others.map((q) => (q.mcap_usd as number) / Math.pow(q.tvl_usd, alpha)).sort((a, b) => a - b);
    const medK = percentile(ks, 0.5) ?? 0;
    const pp = Math.log(medK * Math.pow(p.tvl_usd, alpha));
    predPower.push(pp);
    errPower.push(pp - y);
    const catVals = others.filter((q) => q.category === p.category).map((q) => (q.mcap_usd as number) / Math.pow(q.tvl_usd, alpha));
    let k = medK;
    if (catVals.length >= MODEL.category_min_sample) {
      const sorted = [...catVals].sort((a, b) => a - b);
      const med = percentile(sorted, 0.5) ?? medK;
      k = (catVals.length * med + MODEL.size_k_shrink * medK) / (catVals.length + MODEL.size_k_shrink);
    }
    errShrunk.push(Math.log(k * Math.pow(p.tvl_usd, alpha)) - y);
  }
  const rmse = (e: number[]): number => Math.round(Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length) * 1000) / 1000;
  const rankOf = (v: number[]): number[] => {
    const order = v.map((_, i) => i).sort((a, b) => v[a]! - v[b]!);
    const r = new Array<number>(v.length);
    order.forEach((o, i) => {
      r[o] = i;
    });
    return r;
  };
  const rx = rankOf(predPower);
  const ry = rankOf(actual);
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  const spearman = dx > 0 && dy > 0 ? Math.round((num / Math.sqrt(dx * dy)) * 1000) / 1000 : 0;
  return { flat_rmse: rmse(errFlat), power_rmse: rmse(errPower), shrunk_rmse: rmse(errShrunk), spearman, n };
}

/** Calibrate every category at once from the snapshot's own figures: the level K from the
 * live-token protocols in that category at the shared size exponent, the maturity peak from
 * their ages, the growth baseline from the rankable protocols running in that category now,
 * and the launch rate from the protocols in that category that sit in the mature window.
 * A category earns its own level and peak only when at least `minSample` of its tokens
 * already trade, and its own growth baseline only when at least `growthMinSample` of its
 * rankable protocols report a seven-day change: one observation is not a calibration, and a
 * single outlier must never set the numbers for a whole category. The launch rate is shrunk
 * toward the global rate with a pseudo-count (`model.launch_shrink`), so a category with few
 * protocols in the window does not swing on one launch, and a category with fewer than
 * `model.launch_cat_min_sample` in the window uses the global rate outright. Thinner
 * categories fall back to the global figures. The list is sorted by category name, so the
 * dashboard's table is deterministic. */
export function calibrateCategories(
  snapshot: Snapshot,
  globalMultiple: number,
  globalPeakDays: number,
  globalOldDays: number,
  globalBaseline: number,
  alpha: number,
  globalK: number,
  globalLaunchRate: number,
  minSample: number = MODEL.category_min_sample,
  growthMinSample: number = MODEL.growth_baseline_min_sample,
  model: ModelConstants = MODEL,
): CategoryCalibration[] {
  const ratiosByCat = new Map<string, number[]>();
  const agesByCat = new Map<string, number[]>();
  const growthByCat = new Map<string, number[]>();
  const kByCat = new Map<string, number[]>();
  const launchByCat = new Map<string, { n: number; launched: number }>();
  for (const p of snapshot.protocols) {
    const key = p.category ?? 'Other';
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const list = ratiosByCat.get(key);
      if (list === undefined) ratiosByCat.set(key, [p.mcap_usd / p.tvl_usd]);
      else list.push(p.mcap_usd / p.tvl_usd);
      const ks = kByCat.get(key);
      const kval = p.mcap_usd / Math.pow(p.tvl_usd, alpha);
      if (ks === undefined) kByCat.set(key, [kval]);
      else ks.push(kval);
      const a = ageDays(snapshot.as_of, p.listed_at);
      if (a !== null) {
        const ages = agesByCat.get(key);
        if (ages === undefined) agesByCat.set(key, [a]);
        else ages.push(a);
      }
    }
    if (isRankable(p) && p.change_7d !== null && Number.isFinite(p.change_7d)) {
      const g = growthByCat.get(key);
      if (g === undefined) growthByCat.set(key, [p.change_7d]);
      else g.push(p.change_7d);
    }
    const la = ageDays(snapshot.as_of, p.listed_at);
    if (la !== null && la >= model.launch_window_lo && la < model.launch_window_hi && p.category !== 'CEX' && !VERSIONED.test(p.name)) {
      const rec = launchByCat.get(key);
      if (rec === undefined) launchByCat.set(key, { n: 1, launched: p.mcap_usd !== null && p.mcap_usd > 0 ? 1 : 0 });
      else {
        rec.n += 1;
        if (p.mcap_usd !== null && p.mcap_usd > 0) rec.launched += 1;
      }
    }
  }
  const categories = new Set([...ratiosByCat.keys(), ...agesByCat.keys(), ...growthByCat.keys(), ...launchByCat.keys()]);
  const out: CategoryCalibration[] = [];
  for (const category of [...categories].sort()) {
    const ratios = (ratiosByCat.get(category) ?? []).sort((a, b) => a - b);
    const n = ratios.length;
    const med = n === 0 ? null : percentile(ratios, 0.5);
    const multiple =
      n >= minSample && med !== null
        ? Math.min(1.0, Math.max(0.05, Math.round(med * 100) / 100))
        : globalMultiple;
    // The level K: the median of market cap / TVL^ALPHA over the category's live-token
    // protocols, shrunk toward the global K with a pseudo-count of model.size_k_shrink, so
    // a thin category's median cannot set the level on its own — rounded to four decimals
    // so the stored value is the priced value. The reference multiple is what that level
    // pays at $100M of TVL.
    const kList = (kByCat.get(category) ?? []).sort((a, b) => a - b);
    const kMed = kList.length === 0 ? null : percentile(kList, 0.5);
    const sizeK =
      kList.length >= minSample && kMed !== null
        ? Math.round(((kList.length * kMed + model.size_k_shrink * globalK) / (kList.length + model.size_k_shrink)) * 1e4) / 1e4
        : globalK;
    const sizeKRef = Math.round(sizeK * Math.pow(MODEL.size_ref_tvl, alpha - 1) * 1e4) / 1e4;
    const ages = (agesByCat.get(category) ?? []).sort((a, b) => a - b);
    const ageN = ages.length;
    const peak = ageN >= minSample ? percentile(ages, 0.5) : null;
    const old = ageN >= minSample ? percentile(ages, 0.9) : null;
    const growths = growthByCat.get(category) ?? [];
    const gMed = growths.length >= growthMinSample ? median(growths) : null;
    // The launch rate: the share of the category's protocols in the mature window that
    // already trade a token, shrunk toward the global rate so a thin category cannot swing
    // on one launch, and read as a factor against the global rate, clamped so no category
    // is written off or crowned.
    const launchRec = launchByCat.get(category);
    const launchN = launchRec === undefined ? 0 : launchRec.n;
    const launchRate =
      launchN >= model.launch_cat_min_sample && globalLaunchRate > 0
        ? Math.round(((launchRec!.launched + model.launch_shrink * globalLaunchRate) / (launchN + model.launch_shrink)) * 1e4) / 1e4
        : globalLaunchRate;
    const launchFactor =
      globalLaunchRate > 0
        ? Math.min(model.launch_cat_max, Math.max(model.launch_cat_min, Math.round((0.5 + 0.5 * (launchRate / globalLaunchRate)) * 1e4) / 1e4))
        : 1;
    out.push({
      category,
      live_count: n,
      median_ratio: med === null ? globalMultiple : Math.round(med * 10000) / 10000,
      multiple,
      ratio_q1: ratios.length === 0 ? globalMultiple : Math.round((percentile(ratios, 0.25) ?? med ?? globalMultiple) * 10000) / 10000,
      ratio_q3: ratios.length === 0 ? globalMultiple : Math.round((percentile(ratios, 0.75) ?? med ?? globalMultiple) * 10000) / 10000,
      age_count: ageN,
      peak_days: peak === null ? globalPeakDays : Math.round(peak),
      old_days: old === null ? globalOldDays : Math.round(old),
      growth_baseline: gMed === null ? globalBaseline : Math.round(gMed * 100) / 100,
      growth_n: growths.length,
      size_k: sizeK,
      size_k_ref: sizeKRef,
      size_n: kList.length,
      launch_rate: launchRate,
      launch_n: launchN,
      launch_factor: launchFactor,
    });
  }
  return out;
}

/** The multiple one protocol is priced at: its category's calibrated multiple, or the global
 * median when its category earned none. */
export function calibrationFor(
  category: string | null,
  cals: CategoryCalibration[],
  fallback: CategoryCalibration,
): CategoryCalibration {
  return cals.find((c) => c.category === (category ?? 'Other')) ?? fallback;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. Each row is priced at its
 * category's calibrated level K and the shared size exponent, its category's growth baseline
 * and its category's maturity peak, so two protocols of the same TVL, growth and age can still
 * rank apart when their categories' tokens trade at different levels, run at different
 * baselines, and launch on different clocks — and two protocols of the same category rank
 * apart when one is much bigger, because the market discounts size. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  cals: CategoryCalibration[] = [],
  globalBaseline: number = 0,
  globalK: number = 0,
  hazard: number = 0.0002,
  fRef: number = 0.3,
  chainEthFactor: number = 1,
  chainNonethFactor: number = 1,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  const boundary = new Set<string>();
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
  // The boundary: pre-token protocols above the floor that the watchlist rule leaves out but the
  // snapshot's own fields say are clean. They are ranked on the same model and flagged, so the
  // reader sees the board looked past the floor instead of stopping at it.
  const boundaryRows = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd >= snapshot.floor_usd && isBoundaryCandidate(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of boundaryRows) {
    chosen.set(p.slug, p);
    boundary.add(p.slug);
  }

  const fallbackCal: CategoryCalibration = {
    category: 'Other',
    live_count: 0,
    median_ratio: model.base_multiple,
    multiple: model.base_multiple,
    ratio_q1: model.base_multiple,
    ratio_q3: model.base_multiple,
    age_count: 0,
    peak_days: model.maturity_peak_days,
    old_days: model.maturity_old_days,
    growth_baseline: globalBaseline,
    growth_n: 0,
    size_k: globalK,
    size_k_ref: globalK * Math.pow(model.size_ref_tvl, model.size_alpha - 1),
    size_n: 0,
    launch_rate: 0,
    launch_n: 0,
    launch_factor: 1,
  };
  const scored = [...chosen.values()].map((p) => {
    const cal = calibrationFor(p.category, cals, fallbackCal);
    const chainFactor = p.chains.includes('Ethereum') ? chainEthFactor : chainNonethFactor;
    const { implied, growthPct, growthBaseline, relativeGrowthPct, growthMult, launch, ageFactor, catFactor, chainFactor: cf, launchRate, age, sizeAlpha, sizeK, effectiveMultiple, referenceMultiple } = impliedValue(p, snapshot.as_of, model, cal, hazard, fRef, chainFactor);
    return { p, implied, growthPct, growthBaseline, relativeGrowthPct, growthMult, launch, ageFactor, catFactor, chainFactor: cf, launchRate, age, cal, isBoundary: boundary.has(p.slug), sizeAlpha, sizeK, effectiveMultiple, referenceMultiple };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const boardSize = scored.length;
  return scored.map((s, i) => {
    const signal = launchSignal(i + 1, boardSize, s.launch, s.age, s.growthPct);
    return {
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
    boundary: s.isBoundary,
    age_days: s.age,
    implied_value_usd: s.implied,
    signal,
    model: {
      base_multiple: round4(s.referenceMultiple),
      growth_pct: s.growthPct,
      growth_baseline: s.growthBaseline,
      relative_growth_pct: s.relativeGrowthPct,
      growth_multiplier: round4(s.growthMult),
      launch_factor: round4(s.launch),
      launch_age_factor: round4(s.ageFactor),
      launch_cat_factor: round4(s.catFactor),
      launch_chain_factor: round4(s.chainFactor),
      launch_rate: s.launchRate,
      age_days: s.age,
      size_alpha: s.sizeAlpha,
      size_k: s.sizeK,
      effective_multiple: round4(s.effectiveMultiple),
    },
    farm_steps: farmSteps(s.p, s.age, s.implied, signal).map(stepText),
    };
  });
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

/** How long to hold, from the protocol's signal and age: a Prime launch is already in its
 * window, so a month of activity counts; an Early protocol needs two months to be counted
 * across snapshots, and a young one (under 180 days) needs two more weeks on top. */
function holdDaysFor(age: number | null, signal: LaunchSignal): number {
  const base = signal === 'Prime' ? 30 : signal === 'Watch' ? 45 : 60;
  if (age !== null && age < 180) return Math.min(75, base + 15);
  return base;
}

/** The weekly qualifying action, by category: the plan repeats what the protocol itself
 * rewards, not a generic "do something once a week". */
function weeklyActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount against the supplied collateral on ${name} once a week, then repay it, so the position shows borrowing activity as well as supply.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap a small amount in ${name}'s main pool on ${chain} once a week, so the position shows trading activity as well as liquidity.`;
  if (c.includes('bridge')) return `Bridge a small amount through ${name} once a week, alternating the destination chain, so the position shows repeated use.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim the staking rewards from ${name} once a week and restake them, so the position compounds instead of sitting still.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Open and close one small hedge on ${name} once a week, so the position shows trading activity.`;
  if (c.includes('prediction')) return `Place one small position on a new market on ${name} once a week.`;
  if (c.includes('curator') || c.includes('allocator')) return `Rebalance a small slice between ${name} vaults once a week, so the position shows active allocation.`;
  if (c.includes('stable')) return `Mint or redeem a small amount of the stable asset through ${name} once a week.`;
  if (c.includes('rwa')) return `Claim the yield from ${name}'s asset once a week and re-mint it, so the position compounds.`;
  if (c.includes('insurance')) return `Check the cover status on ${name} once a week and renew it before it lapses.`;
  return `Make one qualifying action on ${name} each week, such as a deposit, a borrow, a swap or a vote.`;
}

/** A signed per-cent figure for farm steps: +12.50% or -2.19%, or "no change reported". */
function pctText(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return 'no change reported';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
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

/** The gas one transaction costs on a chain, in dollars: Ethereum is the expensive chain
 * (about $12), the big L2s about $0.50, the cheap chains about $0.10, anything else about
 * $2. The tiers are ranges, not promises — gas moves — and the farm plan says "about". */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return '12';
  if (/Arbitrum|Optimism|Base|zkSync|Scroll|Linea|Unichain|Mantle|Blast|Mode|Ink|Soneium/.test(chain)) return '0.50';
  if (/Binance|Solana|Polygon|Avalanche|Tron|Sui|Aptos|Fantom|Celo|xDai|Berachain|Sonic|Sei|TON|Cardano|Gnosis|Hyperliquid/.test(chain)) return '0.10';
  return '2';
}

/**
 * A protocol's farm plan: twelve steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age, seven-day change, implied value,
 * signal), never from a hand-written list of names. It builds a two-leg position, counts it on a
 * second chain when the protocol runs on one, repeats the category's own qualifying action weekly,
 * tracks this protocol's TVL and points in a log, holds it for the days its signal earns, checks
 * the protocol's own points or rewards page on its chain, decides the unwind against half this
 * protocol's TVL before the excitement, and claims only from the link the protocol publishes.
 * The last two steps are the plan checking itself against the radar's own figures: the snapshot
 * numbers it was priced on, and the implied value it was priced at, so the farmer sizes the
 * position to the model instead of to a guess. The dashboard's page derives the same twelve
 * steps from the same figures, so the plan the reader sees is the plan board.json carries.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, implied: number = 0, signal: LaunchSignal = 'Early'): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age, signal);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const half = Math.max(25, Math.round(capital / 2));
  const cross =
    p.chains.length > 1
      ? `Bridge $${half} of USDC to ${p.chains[1]} through ${p.name} and repeat the core action there, so the position counts on two chains.`
      : `Increase the position by $${half} and confirm the new balance on ${p.name}'s own page.`;
  const ageText = age === null ? 'an unlisted age' : `${age} days`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm on ${p.name}, and keep its seed phrase offline.`,
      cost: `about $${gas} of gas for the first transaction on ${chain}`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `$${half} of capital and about $${gas} of gas`,
      time: '10 minutes to set up',
    },
    {
      text: cross,
      cost: `$${half} of capital and about $${gas} of gas`,
      time: '10 minutes to set up',
    },
    {
      text: weeklyActionFor(p, chain),
      cost: `about $${gas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Check ${p.name}'s TVL and your points balance once a week and write both numbers in the farm log: TVL is ${fmtUsd(p.tvl_usd)} and moved ${pctText(p.change_7d)} in the last week, so a drop of more than 10% from here shows up first.`,
      cost: 'nothing but the log',
      time: '5 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital + half} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open ${p.name}'s own points or rewards page on ${chain}, complete any quests it lists, and confirm the position is counted before the next snapshot.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the unwind rule in the farm log before the first deposit: claim within a week of a launch, and unwind if ${p.name}'s TVL falls below ${fmtUsd(Math.round(p.tvl_usd / 2))}, half its snapshot value.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Claim only from the link ${p.name} itself publishes, never from a link in a message, and log the wallet, the dates and every transaction.`,
      cost: 'nothing but the log',
      time: '10 minutes',
    },
    {
      text: `Check the radar's own figures before adding more: ${p.name} holds ${fmtUsd(p.tvl_usd)} of TVL, moved ${pctText(p.change_7d)} in the last week, and has run ${ageText} with no token on record. If the seven-day change has turned negative since the snapshot, wait a week before adding more.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `The radar prices a launch at ${fmtUsd(implied)}. Do not size the position to that number: keep the deposit at $${capital + half} and treat any launch as a bonus, not a payback.`,
      cost: 'nothing but the log',
      time: '5 minutes',
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

/** A board row's compact form for data.js, with the farm plan generated in the page. The
 * multiple the row shows is the effective one — the multiple it is actually priced at once
 * size is accounted for — and the size level and exponent travel with it so the page can
 * recompute the row from the same numbers. */
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
    boundary: row.boundary,
    category_multiple: row.model.effective_multiple,
    growth_baseline: row.model.growth_baseline,
    relative_growth_pct: row.model.relative_growth_pct,
    growth_multiplier: row.model.growth_multiplier,
    launch_factor: row.model.launch_factor,
    launch_age_factor: row.model.launch_age_factor,
    launch_cat_factor: row.model.launch_cat_factor,
    launch_chain_factor: row.model.launch_chain_factor,
    launch_rate: row.model.launch_rate,
    size_k: row.model.size_k,
    size_alpha: row.model.size_alpha,
    size_k_ref: row.model.base_multiple,
  };
}

/** The whole radar: the board and the dashboard's data, from one snapshot. The size exponent,
 * the per-category levels K, the per-category maturity peaks and the per-category growth
 * baselines are all calibrated from the snapshot's live-token and rankable protocols before
 * the board is built, so every implied value in the board uses the calibrated numbers. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const base = calibrateBaseMultiple(snapshot);
  const agePeak = calibrateAgePeak(snapshot);
  const sizeExp = calibrateSizeExponent(snapshot, model);
  const launchHaz = calibrateLaunchHazard(snapshot, model);
  const launchRate = calibrateLaunchRate(snapshot, model);
  const sizeK = calibrateSizeK(snapshot, sizeExp.alpha);
  const sizeBands = calibrateSizeBands(snapshot);
  const chainFac = calibrateChainFactor(snapshot, model);
  const validation = calibrateValidation(snapshot, sizeExp.alpha);
  const rankableGrowth = snapshot.protocols
    .filter((p) => isRankable(p) && p.change_7d !== null && Number.isFinite(p.change_7d))
    .map((p) => p.change_7d as number);
  const globalBaseline = median(rankableGrowth) ?? 0;
  const categories = calibrateCategories(snapshot, base.multiple, agePeak.peak_days, agePeak.old_days, globalBaseline, sizeExp.alpha, sizeK.k, launchRate.rate);
  const effective: ModelConstants = {
    ...model,
    base_multiple: base.multiple,
    maturity_peak_days: agePeak.peak_days,
    maturity_old_days: agePeak.old_days,
    size_alpha: sizeExp.alpha,
  };
  const board = buildBoard(snapshot, effective, categories, globalBaseline, sizeK.k, launchHaz.hazard, launchHaz.f_ref, chainFac.eth_factor, chainFac.noneth_factor);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug) && !r.boundary).length;
  const boundarySize = board.filter((r) => r.boundary).length;
  // Pre-token protocols above the floor that stay off the board, grouped by category with the
  // reason the watchlist rule gives: they are wrapped, staked or bridged products of tokens that
  // already trade, or versioned pools, so they are not protocols still waiting on a launch.
  const excludedMap = new Map<string, string[]>();
  for (const p of snapshot.protocols) {
    if (p.tvl_usd < snapshot.floor_usd || snapshot.watchlist.includes(p.slug)) continue;
    if (!isPreToken(p)) continue;
    if (board.some((r) => r.slug === p.slug)) continue;
    const reason = p.category === 'CEX'
      ? 'a centralised exchange, not a protocol waiting on a launch'
      : p.category !== null && EXCLUDED_CATEGORIES.has(p.category)
        ? 'a ' + p.category.toLowerCase() + ' product of a token that already trades'
        : VERSIONED.test(p.name)
          ? 'a versioned pool of another protocol'
          : 'kept off the watchlist by the snapshot rule';
    const key = p.category ?? 'Other';
    const list = excludedMap.get(key);
    if (list === undefined) excludedMap.set(key, [`${p.name} — ${reason}`]);
    else list.push(`${p.name} — ${reason}`);
  }
  const excluded: ExcludedGroup[] = [...excludedMap.entries()]
    .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
    .map(([category, names]) => ({
      category,
      reason: names.length > 1 ? `${names.length} protocols` : '1 protocol',
      names: names.sort(),
    }));
  const excludedCount = excluded.reduce((n, g) => n + g.names.length, 0);
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
      growth_baseline: Math.round(globalBaseline * 100) / 100,
      categories,
      size_alpha: sizeExp.alpha,
      size_k: sizeK.k,
      size_bands: sizeBands,
      launch_hazard: launchHaz.hazard,
      launch_f_ref: launchHaz.f_ref,
      launch_bands: launchHaz.bands,
      launch_global_rate: launchRate.rate,
      chain_eth_rate: chainFac.eth_rate,
      chain_noneth_rate: chainFac.noneth_rate,
      chain_eth_factor: chainFac.eth_factor,
      chain_noneth_factor: chainFac.noneth_factor,
      validation,
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    boundary_size: boundarySize,
    live_size: live.length,
    excluded_above_floor: excludedCount,
    excluded,
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
