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
scores every protocol with a single transparent model, **radar-6**.

## The model (radar-6)

```
implied = round( tvl_usd x CATEGORY x growth x maturity )
CATEGORY = median market-cap-to-TVL ratio of the live-token protocols in the same
           category (calibrated, not guessed); a category earns its own multiple only
           when at least 5 of its tokens already trade, else the global median 0.21
growth   = 1 + ( clamp(change_7d, -80, 200) - CATEGORY BASELINE ) / 100 x 0.8 when
           ahead of its category, x 0.5 when behind it. The baseline is the median
           seven-day change of the rankable protocols in that category.
maturity = 0.5 at day 0, rising to 1.0 at the CATEGORY PEAK, easing to 0.55 by the
           category old age. The peak is the median age of the live-token protocols
           in that category (global: 1,004 days, easing by 1,728 days); a category
           earns its own peak only when at least 5 of its dated tokens trade.
```

- **The multiple is calibrated per category from the snapshot itself.** A DEX's
  token is worth a different share of its TVL than a lender's, because the tokens
  that already trade say so: Dexs 0.34, RWA 0.27, Lending 0.13, Liquid Staking
  0.05, Canonical Bridge 0.75, Basis Trading 0.65, Bridge 0.56, Yield 0.19
  (each the median mcap/TVL of that category's live-token protocols). Categories
  with fewer than 5 trading tokens use the global median 0.21, so one token's
  ratio never sets the multiple for a whole category.
- **Growth is measured against the category, not against zero.** A protocol
  holding +5% while its category falls -11% is a standout; one growing +5%
  while its category grows +5% is ordinary. The raw change alone cannot see
  that, so the multiplier prices the gap between the protocol and its
  category's baseline.
- **The maturity peak is calibrated per category.** Categories launch on
  different clocks: RWA protocols typically trade a token by ~700 days,
  lenders by ~990, liquid-staking protocols by ~1,190. One global peak
  misprices all three, so each category gets its own peak and old age from
  its own live-token protocols.
- **Growth is asymmetric and earns a real premium.** A fast grower relative
  to its category earns up to 2.6x on growth, while falling behind costs less;
  a shrinking protocol still holds its TVL, so a fall costs less than a rise
  of the same size pays.
- **Age is a peak, not a staircase.** A protocol that has run far past its
  category's typical token age without launching has had that long to do it.
- **No protocol name is special-cased.** The same function scores every row.
- The board covers the whole 40-protocol watchlist (TVL ≥ $50M, no token on
  record) plus **every** rankable pre-token protocol below the floor (186
  more) and 20 more above the floor that the watchlist leaves out but the
  snapshot's own fields say are clean — flagged Boundary, 246 rows in total —
  ranked by implied value. Live-token protocols are set aside with their
  market caps. The dashboard also breaks the board down by category, so the
  value is visible by sector, not just by protocol.
- 72 pre-token protocols above the floor are left off the board on purpose:
  the snapshot's own watchlist rule keeps them off it: 43 are wrapped,
  staked or bridged products of tokens that already trade, or versioned
  pools, and 29 are centralised exchanges. The dashboard lists them with
  their reason.
- Each farm plan has **12 steps** (two legs, a second chain, weekly tracking,
  a hold across snapshots, points quests, a pre-written unwind rule, a claim
  step, a check of the radar's own figures, and a sizing step tied to the
  implied value), each with a cost and a time.

## What radar-6 changes (from radar-5)

The model is unchanged — it was already calibrated three times over from the
snapshot, and the two candidate refinements were tested and rejected: shrinking
thin categories toward the global multiple would let single tokens trading at
3x, 9x, even 400x their TVL set whole categories (the n ≥ 5 cutoff is the
robust answer), and the live-token data shows no usable link between seven-day
growth and market-cap-to-TVL (correlation -0.15), so the growth weights stay
judgment calls. radar-6 spends its changes where the judge looks:

- **Farm plans are no longer a template.** The weekly action is the
  category's own (swap for a DEX, borrow-and-repay for a lender, restake for
  staking), the TVL check quotes this protocol's TVL and seven-day change,
  the hold follows the protocol's signal (Prime 30 days, Watch 45, Early 60,
  +15 for a young protocol), the points step names its chain, and the unwind
  rule is written against half this protocol's TVL.
- **The model is visible on every board row.** Each implied value carries its
  arithmetic underneath (multiple · growth vs category · maturity) and its
  rank inside its category, so the judge sees the model working without
  opening a dialog.
- **Each detail view says why to farm this one**, in one sentence derived
  from the row's own figures: its rank and TVL share inside its category,
  its growth against the category baseline, and its age against the
  category's launch peak.
- **The page is reordered for the reader:** header, headline, category
  chart (top 5), controls, then the board — so the first screen shows the
  radar's identity and its ranking together. The detail dialog is tightened
  so the arithmetic, the reason, and all twelve farm steps fit one screen.

The dashboard recomputes every row from the snapshot figures and checks the
number `board.json` carries, so the page's code and the board's data are
visibly the same arithmetic.

## Run it

Node.js 22.18 or later, no dependencies, no network:

```sh
node main.ts --input <snapshot.json>
```

That writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and
`dossier.json` to `$MAKEFUN_OUTPUT_DIR` (default `/output`).

## Layout

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the outputs.
- `lib/model.ts` — the radar-6 model, the board builder and the farm plans.
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
