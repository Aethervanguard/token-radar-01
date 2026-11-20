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
scores every protocol with a single transparent model, **radar-4**.

## The model (radar-4)

```
implied = round( tvl_usd x CATEGORY x growth x maturity )
CATEGORY = median market-cap-to-TVL ratio of the live-token protocols in the same
           category (calibrated, not guessed); a category earns its own multiple only
           when at least 5 of its tokens already trade, else the global median 0.21
growth   = 1 + clamp(change_7d, -80, 200) / 100 x 0.8 when growing, x 0.5 when shrinking
maturity = 0.5 at day 0, rising to 1.0 at 1,004 days, easing to 0.55 by 1,728 days
           (the median and 90th percentile of the live-token protocols' ages)
```

- **The multiple is calibrated per category from the snapshot itself.** A DEX's
  token is worth a different share of its TVL than a lender's, because the tokens
  that already trade say so: Dexs 0.34, RWA 0.27, Lending 0.13, Liquid Staking
  0.05, Canonical Bridge 0.75, Basis Trading 0.65, Bridge 0.56, Yield 0.19
  (each the median mcap/TVL of that category's live-token protocols). Categories
  with fewer than 5 trading tokens use the global median 0.21, so one token's
  ratio never sets the multiple for a whole category.
- **The maturity peak is calibrated too.** Protocols in this snapshot typically
  trade a token by 1,004 days (the median age of the live-token protocols), so a
  pre-token protocol is most likely to launch around then; the curve eases by
  1,728 days, their 90th percentile.
- **Growth is asymmetric and earns a real premium.** A fast-growing protocol
  earns up to 2.6x on growth, while a shrinking one loses at most half its
  growth term; a shrinking protocol still holds its TVL, so a fall costs less
  than a rise of the same size pays.
- **Age is a peak, not a staircase.** A protocol that has run far past the typical
  token age without launching has had that long to do it.
- **No protocol name is special-cased.** The same function scores every row.
- The board covers the whole 40-protocol watchlist (TVL ≥ $50M, no token on
  record) plus **every** rankable pre-token protocol below the floor (186
  more, 226 rows in total), ranked by implied value. Live-token protocols
  are set aside with their market caps. The dashboard also breaks the board
  down by category, so the value is visible by sector, not just by protocol.
- 63 pre-token protocols above the floor are left off the board on purpose:
  the snapshot's own watchlist rule keeps them off it, because most are
  wrapped, staked or bridged products of tokens that already trade.
- Each farm plan has **10 steps** (two legs, a second chain, weekly tracking,
  a hold across snapshots, points quests, a pre-written unwind rule, and a
  claim step), each with a cost and a time.

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
- `lib/model.ts` — the radar-3 model, the board builder and the farm plans.
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
