(function () {
  'use strict';

  var config = (typeof window !== 'undefined' && window.CthruConfig) || {};
  var writeKey = (document.currentScript && document.currentScript.getAttribute('data-key')) || config.writeKey || '';
  var host = (document.currentScript && document.currentScript.getAttribute('data-host')) || config.host || window.location.origin;

  var ANON_KEY = 'cthru_anon_id';
  var SESSION_KEY = 'cthru_last_seen';
  var SESSION_GAP_MS = 30 * 60 * 1000;

  // ── anonymous_id ────────────────────────────────────────────────────────────
  function getOrCreateAnonId() {
    var id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  }

  // ── identity context (set by identify()) ────────────────────────────────────
  var ctx = { userId: null, email: null };

  // ── event queue ─────────────────────────────────────────────────────────────
  var queue = [];

  function enqueue(name, source, properties) {
    queue.push({
      name: name,
      source: source,
      anonymousId: getOrCreateAnonId(),
      userId: ctx.userId || undefined,
      email: ctx.email || undefined,
      occurredAt: new Date().toISOString(),
      properties: properties || {},
    });
  }

  // ── flush ───────────────────────────────────────────────────────────────────
  function flush() {
    if (!queue.length) return;
    var batch = queue.splice(0);
    fetch(host + '/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writeKey: writeKey, events: batch }),
    })
      .then(function (res) { return res.json(); })
      .then(function (results) {
        var retry = batch.filter(function (_, i) {
          return Array.isArray(results) && results[i] && !results[i].accepted;
        });
        if (retry.length) queue.unshift.apply(queue, retry);
      })
      .catch(function () {
        // Network failure — re-queue everything for next flush
        queue.unshift.apply(queue, batch);
      });
  }

  // ── session start ───────────────────────────────────────────────────────────
  function checkSession() {
    var last = parseInt(localStorage.getItem(SESSION_KEY) || '0', 10);
    if (!last || Date.now() - last > SESSION_GAP_MS) {
      enqueue('session_start', 'auto', {});
    }
    localStorage.setItem(SESSION_KEY, String(Date.now()));
  }

  // ── rage click detection ────────────────────────────────────────────────────
  var rageTracker = { x: 0, y: 0, count: 0 };
  function onClickForRage(e) {
    var dx = Math.abs(e.clientX - rageTracker.x);
    var dy = Math.abs(e.clientY - rageTracker.y);
    if (dx < 10 && dy < 10) {
      rageTracker.count += 1;
      if (rageTracker.count >= 3) {
        enqueue('rage_click', 'auto', { x: e.clientX, y: e.clientY });
        rageTracker.count = 0;
        flush();
      }
    } else {
      rageTracker = { x: e.clientX, y: e.clientY, count: 1 };
    }
  }

  // ── auto-capture ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    enqueue('pageview', 'auto', { url: window.location.href, referrer: document.referrer });
    flush();
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    enqueue('click', 'auto', {
      tag: t.tagName,
      id: t.id || null,
      text: (t.textContent || '').slice(0, 100),
    });
    onClickForRage(e);
    flush();
  });

  document.addEventListener('submit', function (e) {
    var f = e.target;
    enqueue('form_submit', 'auto', { id: f.id || null, action: f.action || null });
    flush();
  });

  // SPA support: intercept history.pushState
  var _pushState = history.pushState.bind(history);
  history.pushState = function () {
    _pushState.apply(history, arguments);
    enqueue('pageview', 'auto', { url: window.location.href });
    flush();
  };

  // ── public API ──────────────────────────────────────────────────────────────
  window.cthru = {
    identify: function (userId, traits) {
      ctx.userId = userId || null;
      ctx.email = (traits && traits.email) || null;
      enqueue('identify', 'custom', { userId: userId, traits: traits || {} });
      flush();
    },
    track: function (name, properties) {
      enqueue(name, 'custom', properties || {});
      flush();
    },
  };

  // ── init ────────────────────────────────────────────────────────────────────
  checkSession();
  setInterval(flush, 5000);
})();
