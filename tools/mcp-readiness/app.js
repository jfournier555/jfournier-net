/* MCP Readiness Checker — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: use cases x3, everything else x2. Max weighted score 26. */
'use strict';

var CRITERIA = [
  { key: 'usecases', label: 'Use cases defined', weight: 3 },
  { key: 'data', label: 'Data access', weight: 2 },
  { key: 'surface', label: 'MCP / API surface', weight: 2 },
  { key: 'governance', label: 'Governance', weight: 2 },
  { key: 'champion', label: 'Internal champion', weight: 2 },
  { key: 'success', label: 'Success criteria', weight: 2 }
];

var FLAGS = {
  noUseCase: 'No named use case, just "we should do AI"',
  badAccess: 'The agent would need credentials or data it should not have',
  noOwner: 'No one inside owns it or can approve the next step',
  screenshots: 'Feeding the agent screenshots because there is no API or MCP access'
};

/* answers: {usecases:0|1|2, data:0|1|2, ...} — missing keys count as unanswered.
   flags: {noUseCase:bool, badAccess:bool, noOwner:bool, screenshots:bool} */
function scoreMcp(answers, flags) {
  var max = 0, got = 0, answered = 0, fixes = [];
  CRITERIA.forEach(function (c) {
    max += 2 * c.weight;
    var v = answers[c.key];
    if (typeof v === 'number') {
      answered++;
      got += v * c.weight;
      if (v < 2) fixes.push({ key: c.key, label: c.label, value: v });
    }
  });
  fixes.sort(function (a, b) { return a.value - b.value; });
  var pct = max ? Math.round((got / max) * 100) : 0;
  var hitFlags = Object.keys(FLAGS).filter(function (k) { return flags && flags[k]; });
  var verdict, body;
  if (hitFlags.length > 0) {
    verdict = 'bad';
    body = 'Not yet. A red flag overrides the score — this is not a pilot, it is a wish. Fix the flag first: name the use case, scope the access, or find the owner.';
  } else if (answered < CRITERIA.length) {
    verdict = 'idle';
    body = 'Score the remaining criteria to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'Ready to pilot. The question is sharp, the data is reachable, access is governed, and someone owns the next step. Run one use case, measure it, then decide.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'Fix these gaps first. Do not start a pilot that cannot answer its own question — get the missing pieces agreed, then run it.';
  } else {
    verdict = 'bad';
    body = 'Not yet. The fundamentals are not there: no named use case, no reachable data, or no one to own it. An agent with nothing to do is a demo that goes nowhere.';
  }
  return {
    pct: pct, answered: answered, total: CRITERIA.length,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; })
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreMcp: scoreMcp, CRITERIA: CRITERIA, FLAGS: FLAGS };
}

if (typeof document !== 'undefined') {
  var verdictEl = document.getElementById('verdict');
  var scoreEl = document.getElementById('v-score');
  var titleEl = document.getElementById('v-title');
  var bodyEl = document.getElementById('v-body');
  var fixlistEl = document.getElementById('fixlist');
  var fixitemsEl = document.getElementById('fixitems');

  var TITLES = {
    idle: 'Score the six criteria above.',
    good: 'Ready to pilot.',
    warn: 'Fix these gaps first.',
    bad: 'Not yet.'
  };

  function readState() {
    var answers = {}, flags = {};
    CRITERIA.forEach(function (c) {
      var sel = document.querySelector('input[name="' + c.key + '"]:checked');
      if (sel) answers[c.key] = parseInt(sel.value, 10);
    });
    document.querySelectorAll('.flag input[type="checkbox"]').forEach(function (cb) {
      var label = cb.closest('.flag');
      flags[label.getAttribute('data-key')] = cb.checked;
      label.classList.toggle('on', cb.checked);
    });
    return { answers: answers, flags: flags };
  }

  function render() {
    var state = readState();
    var r = scoreMcp(state.answers, state.flags);
    verdictEl.className = 'verdict ' + r.verdict;
    scoreEl.textContent = r.answered === 0 && r.flags.length === 0 ? '—' : r.pct + '%';
    titleEl.textContent = TITLES[r.verdict];
    bodyEl.textContent = r.body;
    var items = [];
    r.flags.forEach(function (f) { items.push('<li><strong>Red flag:</strong> ' + f + '</li>'); });
    r.fixes.forEach(function (f) {
      items.push('<li><strong>' + f.label + ':</strong> ' + (f.value === 0 ? 'missing — get this agreed before anything starts.' : 'partial — close the gap before the pilot starts.') + '</li>');
    });
    if (items.length > 0) {
      fixitemsEl.innerHTML = items.join('');
      fixlistEl.hidden = false;
    } else {
      fixlistEl.hidden = true;
    }
  }

  document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (el) {
    el.addEventListener('change', render);
  });
  document.getElementById('reset').addEventListener('click', function () {
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (el) {
      el.checked = false;
      var label = el.closest('.flag');
      if (label) label.classList.remove('on');
    });
    render();
  });
  render();
}
