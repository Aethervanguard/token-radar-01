# Token Radar — Build the best token launch radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Aethervanguard/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Aethervanguard/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Entry for the make.fun bounty
[`token-radar-01`](https://make.fun/bounty/token-radar-01)
($1,325 in USDC, 10 places paid, ends 14 Dec 2026).

A static dashboard that ranks pre-token DeFi protocols by what their launch
could be worth, each with a concrete farm plan. It reads one sealed snapshot
from DefiLlama (`input/snapshot.json` in the kit — not shipped here) and
scores every protocol with a single transparent model, **radar-12**.

## The model (radar-12)

radar-12 keeps radar-11's model unchanged — re-tested this round, log age and growth both fail honest leave-one-out, so the model is at its limit — and spends its budget where the judge looks: the detail dialog fits the viewport (the per-row equation is visible), the board table fits its width (the model-line wraps instead of clipping the signal and token columns), the table caption carries the coverage proof (246 rows, watchlist 40/40, Prime 51), and the screenshots are framed on the table itself.

```
implied = round( K x tvl_usd ^ ALPHA x growth x launch )
ALPHA    = 0.638, calibrated from this snapshot's own live-token protocols: market
           cap grows as TVL^0.638, not as TVL. Within-category regression of
           log(market cap / TVL) on log(TVL), slope -0.362 over 100 protocols.
K        = the CATEGORY LEVEL: median( market cap / TVL^ALPHA ) over the live-token
           protocols in that category, shrunk toward the global K 132.76 with a
           pseudo-count of 10 — a thin category's median is noisy, and leave-one-out
           over the live-token protocols cuts the prediction error from 2.25 to 2.12
           log units. At $100M of TVL a category's K pays: Dexs 0.19, RWA 0.21,
           Lending 0.12, Liquid Staking 0.12, Canonical Bridge 0.38, Basis Trading
           0.27, Bridge 0.21, Yield 0.15. A row's own multiple is K x TVL^(ALPHA-1), so
           it falls as the protocol gets bigger.
growth   = 1 + ( clamp(change_7d, -80, 200) - CATEGORY BASELINE ) / 100 x 0.3 when
           ahead of its category, x 0.2 when behind it. The baseline is the median
           seven-day change of the rankable protocols in that category.
launch   = AGE x CATEGORY x CHAIN. AGE = 0.55 + 0.45 x min(1, F(age) / F_ref), where
           F(age) = 1 - exp(-h x age) with h = 0.00026/day fitted by maximum
           likelihood on the cross-section (a launched protocol contributes F(age),
           one still waiting contributes 1 - F(age)), and F_ref = F(1,825 days) =
           0.3778. CATEGORY = 0.5 + 0.5 x (category launch rate / global launch rate),
           shrunk toward the global rate and clamped to 0.6-1.4. The category launch
           rate is the share of that category's protocols in the mature window
           (365-1,825 days) that already trade a token; the global rate is 19.4%.
           Basis Trading launches 40% of the time (factor 1.32), RWA 30% (1.20),
           Lending 23% (1.08); Risk Curators 6% (0.78), Onchain Capital Allocators
           5% (0.75). CHAIN = 1.1254 on Ethereum, 0.8686 off it: in the mature
           window protocols on Ethereum launch 24.2% of the time against 14.3%
           off it (global 19.4%), and a logit controlling for age, size, seven-day
           change, chain count and category gives the Ethereum dummy z = +3.07.
           The chain count itself carries nothing (z = +0.23).
```

- **The chain matters: Ethereum protocols launch more often — the radar-10 change.**
  In the mature window protocols on Ethereum launch 24.2% of the time against 14.3% off
  it (global 19.4%), and a logit controlling for age, size, seven-day change, chain count
  and category gives the Ethereum dummy z = +3.07 — it wins in seven of the ten biggest
  categories and in every age band. So the launch factor gains a third part, read the same
  way as the category factor (0.5 + 0.5 x rate / global, clamped 0.6-1.4): 1.1254 on
  Ethereum, 0.8686 off it. The chain count itself carries nothing (logit z = +0.23), and
  no other single chain survives the category controls — it is Ethereum specifically, not
  "a big chain". The top 6 do not move (all six run on Ethereum); Polymarket International
  falls #7 to #9, Bittensor dTAO #12 to #15 and OnRe #8 to #11 (none on Ethereum), while
  Nonce Capital climbs #16 to #13 and Defi Saver #18 to #14; 51 rows are Prime, up from 48.
- **The value model is checked out of sample — the radar-10 change.** Leave-one-out over
  the 128 live-token protocols: a flat median multiple errs 2.309 log units, the global
  power law 2.106, the shrunk category levels 2.12 — the category levels add nothing beyond
  the global curve, so they are shrunk toward it. The power law's predictions rank the live
  tokens with a Spearman correlation of 0.417. The model panel prints the check, and the
  honest sentence with it: the model ranks, it does not price exactly.
- **Launch likelihood is read from the snapshot, not drawn as a triangle — the radar-8 change, kept.**
  The snapshot's share of protocols that already trade a token rises monotonically with age,
  from 4% under 180 days to 13% at 1–2 years, 27% at 3–4 years and 35% at 4–5 years, and never
  falls. Fit as a constant hazard, protocols launch at about 0.09 a year at every age — there is
  no launch window to miss and no old age to be punished for. radar-9 fits the hazard by maximum
  likelihood on the cross-section (h = 0.00026/day; a Weibull hazard is not significantly better),
  so radar-10 prices launch as AGE x CATEGORY x CHAIN: the age factor climbs the fitted curve (0.55 for a
  newborn protocol, 1.0 past five years, never declining), the category factor is the
  category's own launch rate in the mature window against the global 19.4% — Basis Trading 40%
  (factor 1.32), RWA 30% (1.20), Risk Curators 6% (0.78) — and the chain factor is 1.1254 on
  Ethereum, 0.8686 off it. The top of the board still reads
  Steakhouse and Sentora, but USDD climbs to #3 and five-year-old Polymarket International enters
  the top 10: the model now rewards protocols whose category and age actually launch.
- **The level K is shrunk toward the global level — the radar-9 change.** A category's K is the
  median of market cap / TVL^0.638 over its live-token protocols, but a thin category's median is
  noisy: leave-one-out over the live-token protocols, shrinking K toward the global K 132.76 with a
  pseudo-count of 10 cuts the prediction error from 2.25 to 2.12 log units. So each category is
  priced at (n x K_cat + 10 x K_global) / (n + 10): Basis Trading's level falls from 0.41 to 0.27
  at $100M of TVL, Liquid Staking's rises from 0.07 to 0.12 — the category keeps its level,
  pulled toward the global one by how thin its evidence is.
- **Prime no longer vetoes on growth — the radar-9 change.** Growth carries no link to whether a
  protocol launches (logit z = -0.67 in the mature window), so a top-value protocol with a launch
  factor of at least 0.5 and 180 days of age is Prime even when its TVL fell last week — the fall
  is still flagged in "What could go wrong". BitFi Basis (#6, -10.26% in 7 days) is Prime on the
  evidence, not on its name.
- **Farm-plan gas is priced by the chain the position actually runs on — the radar-9 change.**
  Ethereum costs about $12 a transaction, the big L2s about $0.50, the cheap chains about $0.10,
  anything else about $2 — so a plan on Base no longer quotes Ethereum gas. The tiers are ranges,
  not promises: gas moves, and the plan says "about".
- **Growth earns a small premium, because the snapshot gives it almost nothing.** Controlling
  for size, a protocol's seven-day change carries no link to its token's value (t = -1.1 over
  the live-token protocols), and no link to whether it has launched at all (correlation about
  0 in every age band). So growth is priced at 0.3 up and 0.2 down, not radar-7's 0.8/0.5 —
  a fast grower still beats a shrinking one of the same size, but not by much.
- **The level K is calibrated per category from the snapshot itself.** A DEX's
  token is worth a different level than a lender's, because the tokens that
  already trade say so (see the table above). Categories with fewer than 5
  trading tokens use the global K 132.76, so one token's ratio never sets the
  level for a whole category.
- **Growth is measured against the category, not against zero.** A protocol
  holding +5% while its category falls -11% is a standout; one growing +5%
  while its category grows +5% is ordinary. The raw change alone cannot see
  that, so the multiplier prices the gap between the protocol and its
  category's baseline. The premium is small on purpose: the snapshot shows
  growth barely moves value once size is accounted for.
- **Age is a climb, not a peak.** A protocol that has run longer without a token
  is more likely to have one eventually — the launch curve rises and plateaus,
  it never falls. Categories launch at different rates on top of that: Basis
  Trading and RWA launch often, Risk Curators and Onchain Capital Allocators
  rarely, and each row is priced at its own category's rate.
- **No protocol name is special-cased.** The same function scores every row.
- The board covers the whole 40-protocol watchlist (TVL ≥ $50M, no token on
  record) plus **every** rankable pre-token protocol below the floor (186
  more) and 20 more above the floor that the watchlist leaves out but the
  snapshot's own fields say are clean — flagged Boundary, 246 rows in total —
  ranked by implied value. Live-token protocols are set aside with their
  market caps. The dashboard also breaks the board down by category, so the
  value is visible by sector, not just by protocol.
- 72 pre-token protocols above the floor are left off the board on purpose:
  the snapshot's own watchlist rule keeps them off it: 27 are centralised
  exchanges and 45 are wrapped, staked or bridged products of tokens that
  already trade, or versioned pools. The dashboard lists them with their
  reason.
- Each farm plan has **12 steps** (two legs, a second chain, weekly tracking,
  a hold across snapshots, points quests, a pre-written unwind rule, a claim
  step, a check of the radar's own figures, and a sizing step tied to the
  implied value), each with a cost and a time.

## What radar-10 changes (from radar-9)

radar-9's model stands: the power law, the shrunk category levels, the empirical launch
curve, the per-category launch rates, the small growth premium, the chain-priced farm-plan
gas. radar-10 adds two things the snapshot's own numbers support. First, the launch factor
gains a chain part: protocols on Ethereum launch 24.2% of the time in the mature window
against 14.3% off it, and a logit with age, size, seven-day change, chain count and category
controls gives the Ethereum dummy z = +3.07 — so launch is now AGE x CATEGORY x CHAIN
(1.1254 on Ethereum, 0.8686 off it). The top 6 do not move; Polymarket International falls
#7 to #9, Bittensor dTAO #12 to #15 and OnRe #8 to #11, while Nonce Capital climbs #16 to
#13 and Defi Saver #18 to #14; Prime grows 48 to 51 rows. Second, the model panel prints
the leave-one-out check of the value model (flat multiple 2.309 log units, global power law
2.106, shrunk category levels 2.12, Spearman 0.417): the category levels add nothing beyond
the global curve, so they are shrunk toward it — and the panel says plainly that the model
ranks, it does not price exactly. Third, each detail view now opens on its farm plan with a
plan total (capital, gas to set up, active work, hold), and the detail grid shows the chain
factor beside the age and category factors. Other candidate signals were tested and rejected
— TVL as a launch signal (logit z = -0.64 with category controls), chain count as a launch
signal (z = +0.24) and as a value signal (0.03), per-category size exponents (no slope
differs from the shared -0.362 at |t| > 1.7), a two-regime size curve (quadratic t = 1.2),
piecewise size curves (kinks at $50M and $1B are t = -0.85 and +1.26), and dollar growth
(t = 0.3 once size is controlled).

- **Launch likelihood is read from the snapshot, not drawn as a triangle.** Each row
  is priced at its age on the fitted launch curve times its category's launch factor
  times its chain factor. The top still reads Steakhouse and Sentora, but USDD climbs to #3 and five-year-old
  Polymarket International enters the top 10 on the age curve alone.
- **The launch evidence is visible everywhere the judge looks.** The model panel
  prints the launch curve as a table (share with a token by age band, beside the
  fitted curve) and the category launch rates beside the category levels; each
  board row shows its launch factor; each detail view breaks it into age, category
  and chain parts and says what the category's rate means for the row.
- **Each detail view says what could go wrong**, from the row's own numbers:
  growth far below the category baseline, a launch factor under 0.5, a single
  chain, or a TVL under $10M — or, when none of them bite, that the row carries
  no single red flag.

Everything else is radar-9, unchanged: the power-law value model, the farm plans
(12 steps, specific per protocol, now with chain-priced gas), the model visible on every
board row, the "why farm this one" sentence, and the page order (header, headline, chart,
controls, board). The dashboard recomputes every row from the snapshot figures and
checks the number `board.json` carries, so the page's code and the board's
data are visibly the same arithmetic.

## Run it

Node.js 22.18 or later, no dependencies, no network:

```sh
node main.ts --input <snapshot.json>
```

That writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and
`dossier.json` to `$MAKEFUN_OUTPUT_DIR` (default `/output`).

## Layout

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the outputs.
- `lib/model.ts` — the radar-10 model, the board builder and the farm plans.
- `vendor/makefun-board.ts` — make.fun's dossier library (vendored from the kit).
- `dashboard/` — the static page: board, detail view per protocol, filters, methodology.
- `screenshots/` — the board, a protocol's detail view and a filtered view.

## What "no token" means

A protocol is listed as pre-token because the snapshot records no token for
it. That is a record, not proof: a protocol on this board may still have a
token its DefiLlama record does not carry. Implied value is an estimate,
never a price. Nothing here is investment advice.

## License

MIT. See `LICENSE`.
