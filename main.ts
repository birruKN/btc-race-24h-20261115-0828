// Dip-recovery bot for the btc-race-24h-20261115-0828 competition.
//
// Idea: the replayed price is the on-chain Orca pool price, which only moves when
// someone trades on it. A sharp sell-off pushes the pool price below where the
// wider market would put it, and arbitrageurs buy it back up over the next hour
// or two. The bot therefore buys sharp 90-minute drops and sells into the
// partial retracement, with a stop-loss and a time cap. It never chases breakouts
// (they lose on this data: every momentum variant tested went negative) and it
// never holds through a slow drift — it is flat most of the time.
//
// Entry (on a bar's close, filled at the next bar's open):
//   - first tranche: the 90-bar log return is at or below -1.5% -> buy 25% of equity
//   - scale-in: while holding, if the 90-bar log return reaches -2.5% -> buy
//     another 75% of equity (one scale-in per position)
// Exit (whole position):
//   - retracement: the position's value reaches cost + 40% of the gap between its
//     cost and its value at the reference price (the close 90 bars before entry)
//   - stop-loss: the position's value falls to 98.5% of its cost
//   - time cap: 240 bars after the first entry
//
// Sizing is in fractions of equity so the bot scales with its own capital, and
// the small first tranche keeps the price-impact cost of a false dip low: a
// full-size round trip costs roughly 40 bps at the pool depths in this window,
// so a trade has to catch a move well above that to pay. The exit target is a
// retracement of the drop itself, so the expected move scales with the signal.
//
// Everything is deterministic: float64 log ratios of the closes the harness sent,
// no clock, no environment, no randomness.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Lookback, in bars, for the drop that triggers an entry. */
const LOOKBACK = 90;
/** 90-bar log return at or below which the first tranche is bought.
 *  -1.5%: the -1.2% variant graded after this one earned less (+$18.13 vs
 *  +$21.57) for one extra roughly breakeven round trip, so the deeper
 *  threshold stays: the deep -2.5% scale-in does the heavy lifting either
 *  way, and the first tranche's job is to be cheap insurance while the
 *  position waits for it. */
const DIP1 = -0.015;
/** Fraction of equity for the first tranche. */
const SIZE1_NUM = 1n;
const SIZE1_DEN = 4n;
/** 90-bar log return at or below which the scale-in fires while holding. */
const DIP2 = -0.025;
/** Fraction of equity for the scale-in. */
const SIZE2_NUM = 3n;
const SIZE2_DEN = 4n;
/** Exit when the position has retraced this share of the drop. */
const RETRACE_NUM = 2n;
const RETRACE_DEN = 5n;
/** Stop-loss: exit when the position's value falls to this share of its cost. */
const STOP_NUM = 197n;
const STOP_DEN = 200n;
/** Exit at the latest this many bars after the first entry. */
const MAX_HOLD_BARS = 240;
/** Slippage cap on every order, measured from the latest close. */
const MAX_SLIPPAGE_BPS = 150;

/** Closes of CBBTC, oldest first, kept to LOOKBACK + 1 entries. */
const closes: number[] = [];
/** Seq of the batch that opened the current position, -1 when flat. */
let entrySeq = -1;
/** The close LOOKBACK bars before the first entry of the current position. */
let refClose = 0;
/** Whether the scale-in has fired for the current position. */
let scaledIn = false;

await runBars({
  onBatch(state: BarsState) {
    // Track closes from this batch's bars (state.latest already holds them).
    const bar = state.latest.get(SYMBOL);
    if (bar !== undefined) {
      closes.push(Number(bar.c));
      if (closes.length > LOOKBACK + 1) closes.splice(0, closes.length - (LOOKBACK + 1));
    }
    // Warm-up batches build history but never trade.
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null || closes.length < LOOKBACK + 1) return [];
    const now = Number(close);
    const ref = closes[closes.length - 1 - LOOKBACK];
    const drop = Math.log(now / ref);
    const held = state.positions.get(SYMBOL);
    const orders: (BuyInput | SellInput)[] = [];

    if (held !== undefined && held.qty > 0n) {
      // Position value now, and what it would be worth at the reference price
      // (the close LOOKBACK bars before the first entry, fixed at entry time).
      const value = state.value(SYMBOL, held.qty);
      const valueAtRef = state.value(SYMBOL, held.qty, BigInt(refClose));
      // Retracement target: cost + RETRACE * (valueAtRef - cost), in quote units.
      const target =
        (held.cost * (RETRACE_DEN - RETRACE_NUM) + valueAtRef * RETRACE_NUM) / RETRACE_DEN;
      const atTarget = value >= target;
      const atStop = value * STOP_DEN <= held.cost * STOP_NUM;
      const atHoldLimit = entrySeq >= 0 && state.seq - entrySeq >= MAX_HOLD_BARS;
      if (atTarget || atStop || atHoldLimit) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        return orders;
      }
      // Scale-in on a deeper drop, once per position.
      if (!scaledIn && drop <= DIP2) {
        scaledIn = true;
        const amount = (state.equity * SIZE2_NUM) / SIZE2_DEN;
        const spend = amount < state.cash ? amount : state.cash;
        if (spend >= 1_000_000n) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
      return orders;
    }

    // Flat: enter on a sharp 90-bar drop.
    if (drop <= DIP1) {
      entrySeq = state.seq;
      refClose = ref;
      scaledIn = false;
      const amount = (state.equity * SIZE1_NUM) / SIZE1_DEN;
      const spend = amount < state.cash ? amount : state.cash;
      if (spend >= 1_000_000n) {
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
    }
    return orders;
  },
});
