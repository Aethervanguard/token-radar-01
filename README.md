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
scores every protocol with a single transparent model, **radar-2**.

## The model (radar-2)

```
implied = round( tvl_usd x 0.25 x growth x maturity )
growth   = 1 + clamp(change_7d, -60, 120) / 100 x 0.6 when growing, x 0.4 when shrinking
maturity = 0.6 at day 0, rising to 1.0 at 730 days, easing to 0.7 by 1,825 days
```

- **Growth is asymmetric.** A shrinking protocol still holds its TVL, so a
  fall costs less than a rise of the same size pays.
- **Age is a peak, not a staircase.** A protocol is most likely to launch
  once it has run about two years with no token; one that has run four years
  without launching has had four years to do it.
- **No protocol name is special-cased.** The same function scores every row.
- The board covers the whole 40-protocol watchlist (TVL ≥ $50M, no token on
  record) plus 160 early pre-token protocols below the floor, ranked by
  implied value. Live-token protocols are set aside with their market caps.

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
- `lib/model.ts` — the radar-2 model, the board builder and the farm plans.
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
