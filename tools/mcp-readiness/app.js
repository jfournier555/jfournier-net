/* MCP Readiness Checker — scoring logic (v2).
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: use cases x3, everything else x2. Max weighted score 26.
   No framework dropdown: this is not a sales motion. */
'use strict';

var CRITERIA = [
  { key: 'usecases', label: 'Use cases defined', weight: 3,
    rec0: "Stop. Do not build anything. Run a 30-minute workshop and name one use case with a measurable outcome. 'We should do AI' is not a use case.",
    rec1: 'Sharpen the use case: one named outcome, one owner, one metric. Vague use cases produce vague pilots.' },
  { key: 'data', label: 'Data access', weight: 2,
    rec0: 'Map the data the agent needs and who can grant access. No data access, no pilot.',
    rec1: 'Confirm the access covers the real data, not a sandbox. A pilot on toy data proves nothing.' },
  { key: 'surface', label: 'MCP / API surface', weight: 2,
    rec0: 'Check for an API or MCP surface before you build. If the only path is screenshots, the pilot is not ready.',
    rec1: 'Confirm the API covers the actions the agent needs, not just reads. An agent that can only read is a dashboard.' },
  { key: 'governance', label: 'Governance', weight: 2,
    rec0: 'Set governance before the pilot: what the agent can touch, what it cannot, who approves. No governance, no pilot.',
    rec1: 'Get the governance rules in writing from the owner. Verbal rules get forgotten at the first incident.' },
  { key: 'champion', label: 'Internal champion', weight: 2,
    rec0: 'Find the internal champion who owns the outcome and can approve the next step. No owner, no pilot.',
    rec1: "Confirm the champion can approve the next step, not just cheer. Cheerleaders don't ship pilots." },
  { key: 'success', label: 'Success criteria', weight: 2,
    rec0: 'Define success before the pilot: one metric, one threshold, one date. No criteria, no way to call it a win.',
    rec1: 'Get the criteria agreed by the champion and the team that will use it. Criteria from one person get disputed.' }
];

var FLAGS = {
  noUseCase: 'No named use case, just "we should do AI"',
  badAccess: 'The agent would need credentials or data it should not have',
  noOwner: 'No one inside owns it or can approve the next step',
  screenshots: 'Feeding the agent screenshots because there is no API or MCP access'
};

var PLANS = {
  good: [
    'Pick the sharpest use case and run a 2-week pilot with a named owner.',
    'Define the success metric and the decision date now.',
    'Run it against real data, not a sandbox.',
    'At the decision date, scale, fix, or stop.'
  ],
  warn: [
    'Do not start the pilot yet. Fix the lowest-scored criteria first, in the order listed above.',
    'The most important fixes are use cases and data access.',
    'Confirm governance and the champion before you build.',
    "Re-score. If you are still under 80%, keep fixing."
  ],
  bad: [
    'Do not build the pilot. The fundamentals are not there.',
    'Start with the use case workshop: one outcome, one owner, one metric.',
    'Map the data access and the API surface.',
    'Re-score when the wiring is real.'
  ]
};

var VERDICT_WORDS = { good: 'Ready to pilot', warn: 'Fix these gaps first', bad: 'Not yet' };

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
      if (v < 2) fixes.push({ key: c.key, label: c.label, value: v, text: v === 0 ? c.rec0 : c.rec1 });
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
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; }),
    plan: verdict === 'idle' ? [] : PLANS[verdict]
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreMcp: scoreMcp, CRITERIA: CRITERIA, FLAGS: FLAGS, PLANS: PLANS };
}

if (typeof document !== 'undefined') {
  var verdictEl = document.getElementById('verdict');
  var scoreEl = document.getElementById('v-score');
  var titleEl = document.getElementById('v-title');
  var bodyEl = document.getElementById('v-body');
  var fixlistEl = document.getElementById('fixlist');
  var fixitemsEl = document.getElementById('fixitems');
  var planEl = document.getElementById('plan');
  var planitemsEl = document.getElementById('planitems');
  var promptboxEl = document.getElementById('promptbox');
  var prompttextEl = document.getElementById('prompttext');
  var copyBtn = document.getElementById('copyprompt');

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
      items.push('<li><strong>' + f.label + ':</strong> ' + f.text + '</li>');
    });
    if (items.length > 0) {
      fixitemsEl.innerHTML = items.join('');
      fixlistEl.hidden = false;
    } else {
      fixlistEl.hidden = true;
    }
    if (r.plan.length > 0) {
      planitemsEl.innerHTML = r.plan.map(function (s) { return '<li>' + s + '</li>'; }).join('');
      planEl.hidden = false;
    } else {
      planEl.hidden = true;
    }
    if (r.verdict !== 'idle') {
      var lines = [];
      CRITERIA.forEach(function (c) {
        var v = state.answers[c.key];
        lines.push({ label: c.label + ' (weight x' + c.weight + ')', value: (typeof v === 'number') ? v : 'not scored' });
      });
      prompttextEl.value = V2.buildPrompt({
        tool: 'MCP readiness',
        article: 'an',
        frameworkKey: 'general',
        frameworkName: 'General',
        coach: 'AI adoption advisor',
        subject: 'pilot',
        lines: lines,
        flags: r.flags,
        verdictWord: VERDICT_WORDS[r.verdict],
        pct: r.pct
      });
      promptboxEl.hidden = false;
    } else {
      promptboxEl.hidden = true;
    }
  }

  document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (el) {
    el.addEventListener('change', render);
  });
  copyBtn.addEventListener('click', function () {
    V2.copyText(prompttextEl.value, copyBtn);
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
