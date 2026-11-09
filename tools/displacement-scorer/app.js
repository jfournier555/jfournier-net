/* Competitive Displacement Scorer — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: workflow dependency x3, everything else x2. Max weighted score 26. */
'use strict';

var CRITERIA = [
  { key: 'dependency', label: 'Workflow dependency', weight: 3 },
  { key: 'integration', label: 'Integration depth', weight: 2 },
  { key: 'gaps', label: 'Incumbent gaps', weight: 2 },
  { key: 'switching', label: 'Switching cost', weight: 2 },
  { key: 'buyers', label: 'Champion + economic buyer', weight: 2 },
  { key: 'proof', label: 'Proof against their data', weight: 2 }
];

var FLAGS = {
  goodEnough: 'The incumbent is "good enough" and nobody inside feels pain',
  noChampion: 'No champion — talking to an evaluator with no pull',
  ripReplace: 'The "displacement" is really a rip-and-replace with no migration path',
  features: 'Competing on features, not on the workflow the buyer lives in'
};

/* answers: {dependency:0|1|2, integration:0|1|2, ...} — missing keys count as unanswered.
   flags: {goodEnough:bool, noChampion:bool, ripReplace:bool, features:bool} */
function scoreDisplacement(answers, flags) {
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
    body = 'Don\'t bother. A red flag overrides the score — this is not a displacement, it is a feature comparison the incumbent wins. Build the wedge first, or walk away from this one.';
  } else if (answered < CRITERIA.length) {
    verdict = 'idle';
    body = 'Score the remaining criteria to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'Displace now. The buyer depends on your workflows, the incumbent has gaps they feel, the switching cost is accepted, and the proof is against their data. That is a real displacement.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'Build the wedge first. Do not lead with displacement — lead with the workflow the buyer cannot live without. Get the missing pieces in place, then run the displacement.';
  } else {
    verdict = 'bad';
    body = 'Don\'t bother. The fundamentals are not there: no dependency, no felt pain, or no buyer at the table. A head-on displacement here just burns credibility.';
  }
  return {
    pct: pct, answered: answered, total: CRITERIA.length,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; })
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreDisplacement: scoreDisplacement, CRITERIA: CRITERIA, FLAGS: FLAGS };
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
    good: 'Displace now.',
    warn: 'Build the wedge first.',
    bad: 'Don\'t bother.'
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
    var r = scoreDisplacement(state.answers, state.flags);
    verdictEl.className = 'verdict ' + r.verdict;
    scoreEl.textContent = r.answered === 0 && r.flags.length === 0 ? '—' : r.pct + '%';
    titleEl.textContent = TITLES[r.verdict];
    bodyEl.textContent = r.body;
    var items = [];
    r.flags.forEach(function (f) { items.push('<li><strong>Red flag:</strong> ' + f + '</li>'); });
    r.fixes.forEach(function (f) {
      items.push('<li><strong>' + f.label + ':</strong> ' + (f.value === 0 ? 'missing — build this before you talk displacement.' : 'partial — close the gap before you push the displacement.') + '</li>');
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
