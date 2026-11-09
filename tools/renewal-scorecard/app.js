/* CSM Renewal Scorecard — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Worst section governs the verdict. */
'use strict';

var DEP_ITEMS = [
  { key: 'intro', label: 'Introduced us' },
  { key: 'training', label: 'Runs training' },
  { key: 'billing', label: 'Handles invoices & renewals' },
  { key: 'contact', label: 'First call on issues' },
  { key: 'qbr', label: 'Attends the QBRs' }
];

var VALUE_ITEMS = [
  { key: 'goals', label: 'Goals decoded' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'wins', label: 'Quick wins' },
  { key: 'measured', label: 'Measured' },
  { key: 'demonstrated', label: 'Demonstrated' },
  { key: 'growth', label: 'Growth identified' }
];

var HEALTH_ITEMS = [
  { key: 'works', label: 'It works' },
  { key: 'adoption', label: 'Adoption is deep' },
  { key: 'support', label: 'Support load is normal' },
  { key: 'usage', label: 'Usage is stable or growing' }
];

function depBand(pct) {
  if (pct >= 81) return { band: 'bad', label: 'Crisis mode — one change away from churn' };
  if (pct >= 51) return { band: 'warn', label: 'High risk — widen relationships now' };
  if (pct >= 21) return { band: 'warn', label: 'Some risk, manageable' };
  return { band: 'good', label: 'We can survive a departure' };
}

function sectionBand(pct) {
  if (pct < 40) return 'bad';
  if (pct < 70) return 'warn';
  return 'good';
}

/* dep: {intro:bool, ...} — true where a single person owns it.
   value/health: {goals:0|1|2, ...} — missing keys count as unanswered. */
function scoreRenewal(dep, value, health) {
  var depYes = 0, depAnswered = 0;
  DEP_ITEMS.forEach(function (d) {
    if (typeof dep[d.key] === 'boolean') { depAnswered++; if (dep[d.key]) depYes++; }
  });
  var depPct = Math.round((depYes / DEP_ITEMS.length) * 100);
  var depInfo = depBand(depPct);

  function pctOf(items, ans) {
    var got = 0, answered = 0;
    items.forEach(function (it) {
      if (typeof ans[it.key] === 'number') { answered++; got += ans[it.key]; }
    });
    return { pct: Math.round((got / (items.length * 2)) * 100), answered: answered, got: got };
  }
  var v = pctOf(VALUE_ITEMS, value);
  var h = pctOf(HEALTH_ITEMS, health);
  var vBand = sectionBand(v.pct);
  var hBand = sectionBand(h.pct);

  var answered = depAnswered + v.answered + h.answered;
  var total = DEP_ITEMS.length + VALUE_ITEMS.length + HEALTH_ITEMS.length;

  var worst = 'good';
  [depInfo.band, vBand, hBand].forEach(function (b) {
    if (b === 'bad') worst = 'bad';
    else if (b === 'warn' && worst === 'good') worst = 'warn';
  });

  var verdict, body;
  if (answered < total) {
    verdict = 'idle';
    body = 'Score all three sections to get a verdict. The worst section governs.';
  } else if (worst === 'bad') {
    verdict = 'bad';
    body = 'Churn risk — escalate now. At least one section is in the red: the relationship is single-threaded, the value is invisible, or the product is the problem. Fix that section first; no renewal conversation saves an account in this state.';
  } else if (worst === 'warn') {
    verdict = 'warn';
    body = 'At risk — fix these before the renewal conversation. The account renews, but only if the gaps below get closed. Widen the relationships, demonstrate the value, or fix the product — whichever section is yellow.';
  } else {
    verdict = 'good';
    body = 'Safe — renew and expand. The relationship is broad, the value is visible and measured, and the product works. This is the account to grow, not just keep.';
  }

  var fixes = [], improvements = [];
  DEP_ITEMS.forEach(function (d) {
    if (dep[d.key] === true) fixes.push({ label: d.label, text: 'single-threaded — widen this relationship now.' });
  });
  VALUE_ITEMS.forEach(function (it) {
    if (value[it.key] === 0) fixes.push({ label: it.label, text: 'missing — build this before the renewal.' });
    else if (value[it.key] === 1) improvements.push({ label: it.label, text: 'partial — close the gap in writing.' });
  });
  HEALTH_ITEMS.forEach(function (it) {
    if (health[it.key] === 0) fixes.push({ label: it.label, text: 'failing — this is the renewal case. Fix the product first.' });
    else if (health[it.key] === 1) improvements.push({ label: it.label, text: 'partial — strengthen it before the renewal.' });
  });

  return {
    depPct: depPct, depBand: depInfo.band, depLabel: depInfo.label,
    valuePct: v.pct, valueBand: vBand,
    healthPct: h.pct, healthBand: hBand,
    answered: answered, total: total,
    verdict: verdict, body: body,
    fixes: fixes, improvements: improvements
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreRenewal: scoreRenewal, DEP_ITEMS: DEP_ITEMS, VALUE_ITEMS: VALUE_ITEMS, HEALTH_ITEMS: HEALTH_ITEMS };
}

if (typeof document !== 'undefined') {
  var verdictEl = document.getElementById('verdict');
  var scoreEl = document.getElementById('v-score');
  var titleEl = document.getElementById('v-title');
  var bodyEl = document.getElementById('v-body');
  var subEl = document.getElementById('subscores');
  var sDep = document.getElementById('s-dep');
  var sVal = document.getElementById('s-val');
  var sHealth = document.getElementById('s-health');
  var fixlistEl = document.getElementById('fixlist');
  var fixitemsEl = document.getElementById('fixitems');

  var TITLES = {
    idle: 'Score all three sections.',
    good: 'Renew and expand.',
    warn: 'Fix these before the renewal conversation.',
    bad: 'Escalate now.'
  };

  function readBool(name) {
    var sel = document.querySelector('input[name="' + name + '"]:checked');
    return sel ? sel.value === '1' : undefined;
  }
  function readNum(name) {
    var sel = document.querySelector('input[name="' + name + '"]:checked');
    return sel ? parseInt(sel.value, 10) : undefined;
  }

  function render() {
    var dep = {}, value = {}, health = {};
    DEP_ITEMS.forEach(function (d) { var v = readBool(d.key); if (typeof v !== 'undefined') dep[d.key] = v; });
    VALUE_ITEMS.forEach(function (it) { var v = readNum(it.key); if (typeof v !== 'undefined') value[it.key] = v; });
    HEALTH_ITEMS.forEach(function (it) { var v = readNum(it.key); if (typeof v !== 'undefined') health[it.key] = v; });
    var r = scoreRenewal(dep, value, health);

    verdictEl.className = 'verdict ' + r.verdict;
    var scoreWord = { idle: '—', good: 'Safe', warn: 'At risk', bad: 'Churn risk' };
    scoreEl.textContent = scoreWord[r.verdict];
    titleEl.textContent = TITLES[r.verdict];
    bodyEl.textContent = r.body;

    if (r.answered > 0) {
      sDep.textContent = r.depPct + '% — ' + r.depLabel;
      sVal.textContent = r.valuePct + '%';
      sHealth.textContent = r.healthPct + '%';
      subEl.hidden = false;
    } else {
      subEl.hidden = true;
    }

    var items = [];
    r.fixes.forEach(function (f) { items.push('<li><strong>' + f.label + ':</strong> ' + f.text + '</li>'); });
    if (r.verdict === 'warn' || r.verdict === 'good') {
      r.improvements.forEach(function (f) { items.push('<li><strong>' + f.label + ':</strong> ' + f.text + '</li>'); });
    }
    if (items.length > 0) {
      fixitemsEl.innerHTML = items.join('');
      fixlistEl.hidden = false;
    } else {
      fixlistEl.hidden = true;
    }
  }

  document.querySelectorAll('input[type="radio"]').forEach(function (el) {
    el.addEventListener('change', render);
  });
  document.getElementById('reset').addEventListener('click', function () {
    document.querySelectorAll('input[type="radio"]').forEach(function (el) { el.checked = false; });
    render();
  });
  render();
}
