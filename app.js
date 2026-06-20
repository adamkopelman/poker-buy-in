(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PokerApp = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'pokerBuyInTracker.v1';

  function defaultState() {
    return { buyinValue: 20, chipsPerDollar: 1, players: [] };
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Short, URL-friendly id for shared game links (not cryptographically
  // significant — the game data itself has no auth, just an unguessable slug).
  function generateGameId() {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
  }

  function roundToCents(n) {
    return Math.round(n * 100) / 100;
  }

  function chipsToDollars(chips, chipsPerDollar) {
    if (!chipsPerDollar) return 0;
    return roundToCents(chips / chipsPerDollar);
  }

  function dollarsToChips(dollars, chipsPerDollar) {
    return roundToCents(dollars * chipsPerDollar);
  }

  function createPlayer(name, id) {
    return { id: id || generateId(), name: name, buyins: 1, cashout: null };
  }

  // Sanitizes a raw buy-in count (e.g. from a number input) into a
  // non-negative integer, defaulting to 0 for anything invalid.
  function clampBuyins(value) {
    var n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  // Converts a total dollar amount into a whole number of buy-ins at the
  // given buy-in value, rounding away floating point drift before
  // flooring (so e.g. 60 / 20 reliably yields 3, not 2.9999999998).
  function dollarsToBuyins(dollars, buyinValue) {
    if (!buyinValue) return 0;
    var raw = dollars / buyinValue;
    return clampBuyins(Math.round(raw * 1e6) / 1e6);
  }

  function sanitizePlayer(p) {
    return {
      id: (p && p.id) || generateId(),
      name: (p && p.name) || 'Player',
      buyins: p && Number.isFinite(p.buyins) ? p.buyins : 0,
      cashout: !p || p.cashout === null || p.cashout === undefined || p.cashout === ''
        ? null
        : Number(p.cashout)
    };
  }

  // Validates/normalizes a parsed JSON blob into well-formed state, or
  // returns null if the blob doesn't look like saved state at all.
  function normalizeLoadedState(parsed) {
    if (!parsed || !Array.isArray(parsed.players)) return null;
    return {
      buyinValue: typeof parsed.buyinValue === 'number' ? parsed.buyinValue : 20,
      chipsPerDollar: typeof parsed.chipsPerDollar === 'number' && parsed.chipsPerDollar > 0
        ? parsed.chipsPerDollar
        : 1,
      players: parsed.players.map(sanitizePlayer)
    };
  }

  function serializeState(state) {
    return JSON.stringify(state);
  }

  function fmtMoney(n) {
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toFixed(2).replace(/\.00$/, '');
  }

  function computePlayerBuyinCost(player, buyinValue) {
    return player.buyins * buyinValue;
  }

  function computePlayerNet(player, buyinValue) {
    var cashout = player.cashout === null ? 0 : player.cashout;
    return cashout - computePlayerBuyinCost(player, buyinValue);
  }

  // Aggregates totals across all players plus a balance check between
  // total buy-ins and total cash-outs (only meaningful once everyone has
  // a cash-out entered).
  function computeTotals(state) {
    var totalBuyins = 0;
    var totalCashout = 0;
    var anyCashoutMissing = false;

    state.players.forEach(function (p) {
      totalBuyins += computePlayerBuyinCost(p, state.buyinValue);
      if (p.cashout === null) anyCashoutMissing = true;
      else totalCashout += p.cashout;
    });

    var diff = Math.round((totalCashout - totalBuyins) * 100) / 100;
    var balanced = state.players.length > 0 && !anyCashoutMissing
      ? Math.abs(diff) <= 0.005
      : null;

    return {
      totalBuyins: totalBuyins,
      totalCashout: totalCashout,
      anyCashoutMissing: anyCashoutMissing,
      diff: diff,
      balanced: balanced
    };
  }

  // Reduces everyone's net win/loss to a minimal-ish list of who-pays-whom
  // settlements, by greedily matching the biggest debtor against the
  // biggest creditor until everyone's balance is zero. A missing cash-out
  // is treated as 0 (same as computePlayerNet).
  function computeSettlements(state) {
    var debtors = [];
    var creditors = [];

    state.players.forEach(function (p) {
      var net = roundToCents(computePlayerNet(p, state.buyinValue));
      if (net < -0.005) debtors.push({ name: p.name, amount: -net });
      else if (net > 0.005) creditors.push({ name: p.name, amount: net });
    });

    debtors.sort(function (a, b) { return b.amount - a.amount; });
    creditors.sort(function (a, b) { return b.amount - a.amount; });

    var transactions = [];
    var i = 0;
    var j = 0;
    while (i < debtors.length && j < creditors.length) {
      var debtor = debtors[i];
      var creditor = creditors[j];
      var amount = roundToCents(Math.min(debtor.amount, creditor.amount));

      if (amount > 0.005) {
        transactions.push({ from: debtor.name, to: creditor.name, amount: amount });
      }

      debtor.amount = roundToCents(debtor.amount - amount);
      creditor.amount = roundToCents(creditor.amount - amount);

      if (debtor.amount <= 0.005) i++;
      if (creditor.amount <= 0.005) j++;
    }

    return transactions;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    defaultState: defaultState,
    generateId: generateId,
    generateGameId: generateGameId,
    createPlayer: createPlayer,
    sanitizePlayer: sanitizePlayer,
    clampBuyins: clampBuyins,
    dollarsToBuyins: dollarsToBuyins,
    normalizeLoadedState: normalizeLoadedState,
    serializeState: serializeState,
    fmtMoney: fmtMoney,
    roundToCents: roundToCents,
    chipsToDollars: chipsToDollars,
    dollarsToChips: dollarsToChips,
    computeSettlements: computeSettlements,
    computePlayerBuyinCost: computePlayerBuyinCost,
    computePlayerNet: computePlayerNet,
    computeTotals: computeTotals
  };
});
