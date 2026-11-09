/* Expansion Readiness Scorer — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: value demonstrated x3, everything else x2. Max weighted score 26. */
'use strict';

var CRITERIA = [
  { key: 'value', label: 'Value demonstrated', weight: 3 },
  { key: 'gaps', label: 'Usage gaps', weight: 2 },
  { key: 'adoption', label: 'Adoption depth', weight: 2 },
  { key: 'stakeholders', label: 'Stakeholder coverage', weight: 2 },
  { key: 'signals', label: 'Commercial signals', weight: 2 },
  { key: 'case', label: 'Business case', weight: 2 }
];

var FLAGS = {
  noValue: 'No demonstrated value — the customer cannot say what it did for them',
  atRisk: 'The account is at risk — renewal first, expansion later',
  shelfware: 'The "expansion" is shelfware they already own and do not use',
  noBuyer: 'No economic buyer in the loop'
};

/* answers: {value:0|1|2, gaps:0|1|2, ...} — missing keys count as unanswered.
   flags: {noValue:bool, atRisk:bool, shelfware:bool, noBuyer:bool} */
function scoreExpansion(answers, flags) {
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
    body = 'Not yet. A red flag overrides the score — this is not an expansion, it is a renewal save wearing an expansion\'s clothes. Fix the renewal case first.';
  } else if (answered < CRITERIA.length) {
    verdict = 'idle';
    body = 'Score the remaining criteria to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'Expand now. The value is demonstrated, adoption is deep, the buyers are in the loop, and the business case has a number on it. That is a real expansion.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'Fix these gaps first. Do not pitch the expansion until the value is demonstrated and the account is healthy — otherwise the conversation turns into a discount conversation.';
  } else {
    verdict = 'bad';
    body = 'Not yet. The fundamentals are not there: no demonstrated value, thin adoption, or no buyer in the loop. An expansion here just teaches the customer to ask for a cheaper price.';
  }
  return {
    pct: pct, answered: answered, total: CRITERIA.length,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; })
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreExpansion: scoreExpansion, CRITERIA: CRITERIA, FLAGS: FLAGS };
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
    good: 'Expand now.',
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
    var r = scoreExpansion(state.answers, state.flags);
    verdictEl.className = 'verdict ' + r.verdict;
    scoreEl.textContent = r.answered === 0 && r.flags.length === 0 ? '—' : r.pct + '%';
    titleEl.textContent = TITLES[r.verdict];
    bodyEl.textContent = r.body;
    var items = [];
    r.flags.forEach(function (f) { items.push('<li><strong>Red flag:</strong> ' + f + '</li>'); });
    r.fixes.forEach(function (f) {
      items.push('<li><strong>' + f.label + ':</strong> ' + (f.value === 0 ? 'missing — build this before you pitch the expansion.' : 'partial — close the gap before you pitch the expansion.') + '</li>');
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
