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
    return { buyinValue: 20, players: [] };
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function createPlayer(name, id) {
    return { id: id || generateId(), name: name, buyins: 1, cashout: null };
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

  return {
    STORAGE_KEY: STORAGE_KEY,
    defaultState: defaultState,
    generateId: generateId,
    createPlayer: createPlayer,
    sanitizePlayer: sanitizePlayer,
    normalizeLoadedState: normalizeLoadedState,
    serializeState: serializeState,
    fmtMoney: fmtMoney,
    computePlayerBuyinCost: computePlayerBuyinCost,
    computePlayerNet: computePlayerNet,
    computeTotals: computeTotals
  };
});
