const test = require('node:test');
const assert = require('node:assert/strict');
const PokerApp = require('../app.js');

test('fmtMoney', async (t) => {
  await t.test('formats whole dollars without trailing cents', () => {
    assert.equal(PokerApp.fmtMoney(20), '$20');
  });

  await t.test('formats cents with two decimal places', () => {
    assert.equal(PokerApp.fmtMoney(12.5), '$12.50');
  });

  await t.test('formats negative amounts with a leading minus', () => {
    assert.equal(PokerApp.fmtMoney(-15), '-$15');
  });

  await t.test('formats zero', () => {
    assert.equal(PokerApp.fmtMoney(0), '$0');
  });
});

test('chipsToDollars / dollarsToChips', async (t) => {
  await t.test('converts chips to dollars at the given ratio', () => {
    assert.equal(PokerApp.chipsToDollars(40, 4), 10);
  });

  await t.test('rounds to the nearest cent', () => {
    assert.equal(PokerApp.chipsToDollars(10, 3), 3.33);
  });

  await t.test('returns 0 when chipsPerDollar is 0', () => {
    assert.equal(PokerApp.chipsToDollars(40, 0), 0);
  });

  await t.test('converts dollars to chips at the given ratio', () => {
    assert.equal(PokerApp.dollarsToChips(10, 4), 40);
  });

  await t.test('round-trips cleanly for a 1:1 ratio', () => {
    assert.equal(PokerApp.dollarsToChips(PokerApp.chipsToDollars(25, 1), 1), 25);
  });
});

test('generateGameId returns unique, url-friendly values', () => {
  const a = PokerApp.generateGameId();
  const b = PokerApp.generateGameId();
  assert.notEqual(a, b);
  assert.match(a, /^[a-z0-9]+$/);
});

test('createPlayer', () => {
  const player = PokerApp.createPlayer('Alice');
  assert.equal(player.name, 'Alice');
  assert.equal(player.buyins, 1);
  assert.equal(player.cashout, null);
  assert.ok(player.id);
});

test('computePlayerBuyinCost', () => {
  const player = { buyins: 3, cashout: null };
  assert.equal(PokerApp.computePlayerBuyinCost(player, 20), 60);
});

test('computePlayerNet', async (t) => {
  await t.test('treats a missing cash-out as zero', () => {
    const player = { buyins: 2, cashout: null };
    assert.equal(PokerApp.computePlayerNet(player, 20), -40);
  });

  await t.test('computes a winning net', () => {
    const player = { buyins: 2, cashout: 100 };
    assert.equal(PokerApp.computePlayerNet(player, 20), 60);
  });

  await t.test('computes a losing net', () => {
    const player = { buyins: 5, cashout: 30 };
    assert.equal(PokerApp.computePlayerNet(player, 20), -70);
  });
});

test('computeTotals', async (t) => {
  await t.test('sums buy-ins and cash-outs across players', () => {
    const state = {
      buyinValue: 20,
      players: [
        { buyins: 2, cashout: 50 },
        { buyins: 3, cashout: 10 }
      ]
    };
    const totals = PokerApp.computeTotals(state);
    assert.equal(totals.totalBuyins, 100);
    assert.equal(totals.totalCashout, 60);
  });

  await t.test('flags balanced when cash-outs equal buy-ins', () => {
    const state = {
      buyinValue: 20,
      players: [
        { buyins: 2, cashout: 60 },
        { buyins: 1, cashout: -20 } // negative cash-out is a valid stake-in-the-bank edge case
      ]
    };
    const totals = PokerApp.computeTotals(state);
    assert.equal(totals.totalBuyins, 60);
    assert.equal(totals.totalCashout, 40);
    assert.equal(totals.balanced, false);
  });

  await t.test('balances exactly when totals match', () => {
    const state = {
      buyinValue: 20,
      players: [
        { buyins: 2, cashout: 30 },
        { buyins: 1, cashout: 10 }
      ]
    };
    const totals = PokerApp.computeTotals(state);
    assert.equal(totals.totalBuyins, 60);
    assert.equal(totals.totalCashout, 40);
    assert.equal(totals.balanced, false);
  });

  await t.test('is null (unknown) while any cash-out is missing', () => {
    const state = {
      buyinValue: 20,
      players: [
        { buyins: 2, cashout: 40 },
        { buyins: 1, cashout: null }
      ]
    };
    const totals = PokerApp.computeTotals(state);
    assert.equal(totals.anyCashoutMissing, true);
    assert.equal(totals.balanced, null);
  });

  await t.test('is null (unknown) with no players', () => {
    const totals = PokerApp.computeTotals({ buyinValue: 20, players: [] });
    assert.equal(totals.balanced, null);
  });

  await t.test('treats tiny floating point drift as balanced', () => {
    const state = {
      buyinValue: 0.1,
      players: [{ buyins: 3, cashout: 0.3 }]
    };
    const totals = PokerApp.computeTotals(state);
    assert.equal(totals.balanced, true);
  });
});

test('normalizeLoadedState', async (t) => {
  await t.test('returns null for garbage input', () => {
    assert.equal(PokerApp.normalizeLoadedState(null), null);
    assert.equal(PokerApp.normalizeLoadedState({}), null);
    assert.equal(PokerApp.normalizeLoadedState({ players: 'nope' }), null);
  });

  await t.test('defaults a missing buyinValue to 20', () => {
    const result = PokerApp.normalizeLoadedState({ players: [] });
    assert.equal(result.buyinValue, 20);
  });

  await t.test('preserves a valid buyinValue', () => {
    const result = PokerApp.normalizeLoadedState({ buyinValue: 50, players: [] });
    assert.equal(result.buyinValue, 50);
  });

  await t.test('defaults a missing chipsPerDollar to 1', () => {
    const result = PokerApp.normalizeLoadedState({ players: [] });
    assert.equal(result.chipsPerDollar, 1);
  });

  await t.test('preserves a valid chipsPerDollar', () => {
    const result = PokerApp.normalizeLoadedState({ chipsPerDollar: 4, players: [] });
    assert.equal(result.chipsPerDollar, 4);
  });

  await t.test('rejects a non-positive chipsPerDollar back to 1', () => {
    const result = PokerApp.normalizeLoadedState({ chipsPerDollar: 0, players: [] });
    assert.equal(result.chipsPerDollar, 1);
  });

  await t.test('sanitizes malformed player entries', () => {
    const result = PokerApp.normalizeLoadedState({
      buyinValue: 20,
      players: [
        { id: 'p1', name: 'Bob', buyins: 4, cashout: 80 },
        { id: 'p2', name: 'Eve' }, // missing buyins/cashout
        {} // missing everything
      ]
    });
    assert.equal(result.players.length, 3);
    assert.deepEqual(result.players[0], { id: 'p1', name: 'Bob', buyins: 4, cashout: 80 });
    assert.equal(result.players[1].buyins, 0);
    assert.equal(result.players[1].cashout, null);
    assert.equal(result.players[2].name, 'Player');
    assert.ok(result.players[2].id);
  });

  await t.test('treats an empty-string cashout as not-yet-cashed-out', () => {
    const result = PokerApp.normalizeLoadedState({
      buyinValue: 20,
      players: [{ id: 'p1', name: 'Bob', buyins: 1, cashout: '' }]
    });
    assert.equal(result.players[0].cashout, null);
  });
});

test('serializeState round-trips through normalizeLoadedState', () => {
  const state = {
    buyinValue: 25,
    chipsPerDollar: 4,
    players: [PokerApp.createPlayer('Carl', 'p1')]
  };
  state.players[0].buyins = 4;
  state.players[0].cashout = 75;

  const json = PokerApp.serializeState(state);
  const restored = PokerApp.normalizeLoadedState(JSON.parse(json));
  assert.deepEqual(restored, state);
});

test('defaultState', () => {
  assert.deepEqual(PokerApp.defaultState(), { buyinValue: 20, chipsPerDollar: 1, players: [] });
});

test('generateId returns unique values', () => {
  const a = PokerApp.generateId();
  const b = PokerApp.generateId();
  assert.notEqual(a, b);
});
