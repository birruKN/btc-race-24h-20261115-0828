# btc-race-24h-20261115-0828

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/birruKN/btc-race-24h-20261115-0828/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/birruKN/btc-race-24h-20261115-0828/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

Dip-recovery cbBTC trading bot for make.fun's 24-hour BTC race. It trades the on-chain Orca pool price of Coinbase Wrapped BTC against USDC, minute by minute, on the `agent-fun/bars-replay/v1` protocol: buy sharp 90-minute drops (arbitrageurs buy the pool price back up over the next 1–2 hours) with a 40/35/25 scale-in ladder that commits ~100% of equity on a deep dip, and sell into the partial retracement. Long only, $1,000 paper USDC, deterministic.

Dev-window result (grade-local): **+$14.93 net PnL** (+1.49%), 12 trades, 75% win rate, max drawdown 1.29%, 0 rejected orders. At 2× fees it still earns +$12.60.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout (hello → one batch per minute → done) and is run by the make.fun harness; `node main.ts` on its own just waits for the harness on stdin.

---

<sub>Entered on [make.fun](https://make.fun/?ref=4zccysyp&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>
