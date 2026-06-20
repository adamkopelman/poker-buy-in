(function (root) {
  'use strict';

  function loadState() {
    try {
      var raw = localStorage.getItem(PokerApp.STORAGE_KEY);
      if (raw) {
        var normalized = PokerApp.normalizeLoadedState(JSON.parse(raw));
        if (normalized) return normalized;
      }
    } catch (e) {
      console.warn('Failed to load saved data, starting fresh.', e);
    }
    return PokerApp.defaultState();
  }

  function ensureFirebase() {
    var cfg = root.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') return false;
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    return true;
  }

  // Wires up the "Share live game" panel for a page. `opts`:
  //   getState() -> current state object
  //   setState(state) -> replace local state with a normalized remote state
  //   onRemoteChange() -> called after setState from a remote update; page should re-render
  //   onShareChange(gameId|null) -> called whenever sharing starts/stops, so the
  //     page can keep its nav links pointing at the same shared game
  //   elements: { startBtn, copyBtn, stopBtn, linkBox, linkInput, status }
  function createSyncController(opts) {
    var els = opts.elements;
    var dbRef = null;
    var gameId = null;
    var isApplyingRemoteUpdate = false;
    var lastSyncedJson = null;

    function setStatus(text, cls) {
      if (!els.status) return;
      els.status.textContent = text;
      els.status.className = 'sync-status' + (cls ? ' ' + cls : '');
    }

    function updateShareUI() {
      var sharing = !!gameId;
      if (els.startBtn) els.startBtn.style.display = sharing ? 'none' : '';
      if (els.copyBtn) els.copyBtn.style.display = sharing ? '' : 'none';
      if (els.stopBtn) els.stopBtn.style.display = sharing ? '' : 'none';
      if (els.linkBox) els.linkBox.style.display = sharing ? 'flex' : 'none';
      if (sharing && els.linkInput) els.linkInput.value = location.href;
      if (opts.onShareChange) opts.onShareChange(gameId);
    }

    function connect(id) {
      if (dbRef) dbRef.off();
      gameId = id;
      dbRef = firebase.database().ref('games/' + id);

      dbRef.on('value', function (snapshot) {
        var val = snapshot.val();
        if (!val) {
          lastSyncedJson = JSON.stringify(opts.getState());
          dbRef.set(opts.getState());
          setStatus('Connected — live syncing with everyone on this link.', 'connected');
          return;
        }
        var incomingJson = JSON.stringify(val);
        if (incomingJson === lastSyncedJson) {
          setStatus('Connected — live syncing with everyone on this link.', 'connected');
          return;
        }
        var normalized = PokerApp.normalizeLoadedState(val);
        if (!normalized) return;
        lastSyncedJson = incomingJson;
        isApplyingRemoteUpdate = true;
        opts.setState(normalized);
        localStorage.setItem(PokerApp.STORAGE_KEY, PokerApp.serializeState(normalized));
        opts.onRemoteChange();
        isApplyingRemoteUpdate = false;
        setStatus('Connected — live syncing with everyone on this link.', 'connected');
      }, function (err) {
        setStatus('Sync error: ' + err.message, 'error');
      });

      var url = new URL(location.href);
      url.searchParams.set('game', id);
      history.pushState(null, '', url);
      updateShareUI();
    }

    function disconnect() {
      if (dbRef) dbRef.off();
      dbRef = null;
      gameId = null;
      var url = new URL(location.href);
      url.searchParams.delete('game');
      history.pushState(null, '', url);
      setStatus('', '');
      updateShareUI();
    }

    if (els.startBtn) {
      els.startBtn.addEventListener('click', function () {
        if (!ensureFirebase()) {
          setStatus("Live sharing isn't set up yet. See README for Firebase setup.", 'error');
          return;
        }
        connect(PokerApp.generateGameId());
      });
    }

    if (els.stopBtn) els.stopBtn.addEventListener('click', disconnect);

    if (els.copyBtn) {
      els.copyBtn.addEventListener('click', function () {
        if (!navigator.clipboard) {
          if (els.linkInput) els.linkInput.select();
          return;
        }
        navigator.clipboard.writeText(location.href).then(function () {
          var original = els.copyBtn.textContent;
          els.copyBtn.textContent = 'Copied!';
          setTimeout(function () { els.copyBtn.textContent = original; }, 1500);
        }).catch(function () {
          if (els.linkInput) els.linkInput.select();
        });
      });
    }

    var initialGameId = new URLSearchParams(location.search).get('game');
    if (initialGameId) {
      if (ensureFirebase()) {
        connect(initialGameId);
      } else {
        setStatus("This link shares a live game, but live sync isn't configured on this deployment.", 'error');
      }
    }

    return {
      saveLocalAndSync: function (state) {
        localStorage.setItem(PokerApp.STORAGE_KEY, PokerApp.serializeState(state));
        if (dbRef && !isApplyingRemoteUpdate) {
          lastSyncedJson = JSON.stringify(state);
          dbRef.set(state);
        }
      },
      getGameId: function () { return gameId; }
    };
  }

  root.PokerShared = {
    loadState: loadState,
    ensureFirebase: ensureFirebase,
    createSyncController: createSyncController
  };
})(typeof window !== 'undefined' ? window : this);
