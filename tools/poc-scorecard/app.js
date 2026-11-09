/* PoC Evaluation Scorecard — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: success criteria x3, everything else x2. Max weighted score 26. */
'use strict';

var CRITERIA = [
  { key: 'problem', label: 'Problem clarity', weight: 2 },
  { key: 'success', label: 'Success criteria', weight: 3 },
  { key: 'data', label: 'Buyer data access', weight: 2 },
  { key: 'fit', label: 'Technical fit', weight: 2 },
  { key: 'buyer', label: 'Economic buyer', weight: 2 },
  { key: 'exit', label: 'Exit criteria', weight: 2 }
];

var FLAGS = {
  noCriteria: 'No success criteria, and no one will define them',
  noData: 'No access to real buyer data',
  noBuyer: 'No economic buyer, and no path to one',
  freeConsulting: 'The "evaluation" is really a free consulting project'
};

/* answers: {problem:0|1|2, success:0|1|2, ...} — missing keys count as unanswered.
   flags: {noCriteria:bool, noData:bool, noBuyer:bool, freeConsulting:bool} */
function scorePoc(answers, flags) {
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
    body = 'Walk away. A red flag overrides the score — this is not an evaluation. Say so early and spend the time on a deal that can actually close.';
  } else if (answered < CRITERIA.length) {
    verdict = 'idle';
    body = 'Score the remaining criteria to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'Run it. The evaluation has a defined problem, agreed success criteria, and a decision at the end. That is a real PoC.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'Fix these gaps first. Do not start the clock on an evaluation that cannot pass — get the missing pieces agreed in writing, then run it.';
  } else {
    verdict = 'bad';
    body = 'Walk away. The fundamentals are not there: no clear problem, no agreed success, or no buyer at the table. A forced evaluation just churns later.';
  }
  return {
    pct: pct, answered: answered, total: CRITERIA.length,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; })
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scorePoc: scorePoc, CRITERIA: CRITERIA, FLAGS: FLAGS };
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
    good: 'Run it.',
    warn: 'Fix these gaps first.',
    bad: 'Walk away.'
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
    var r = scorePoc(state.answers, state.flags);
    verdictEl.className = 'verdict ' + r.verdict;
    scoreEl.textContent = r.answered === 0 && r.flags.length === 0 ? '—' : r.pct + '%';
    titleEl.textContent = TITLES[r.verdict];
    bodyEl.textContent = r.body;
    var items = [];
    r.flags.forEach(function (f) { items.push('<li><strong>Red flag:</strong> ' + f + '</li>'); });
    r.fixes.forEach(function (f) {
      items.push('<li><strong>' + f.label + ':</strong> ' + (f.value === 0 ? 'missing — get this agreed before anything starts.' : 'partial — close the gap in writing before the clock starts.') + '</li>');
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
