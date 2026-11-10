/* PoC Evaluation Scorecard — scoring logic (v2).
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: success criteria x3, everything else x2. Base max 34 (8 criteria).
   Framework bonus questions add 2 x weight 1 (max 4) when a framework is active. */
'use strict';

var CRITERIA = [
  { key: 'problem', label: 'Problem clarity', weight: 2,
    rec0: "Stop and define the problem in one sentence, in the buyer's words. If you can't, the PoC has no target.",
    rec1: "Pressure-test the problem statement with the champion: is this the problem they lose sleep over, or the one that's easiest to demo?",
    fw: {
      spin: { tag: 'SPIN: Implication', tip: 'Quantify the cost of the problem before you pitch the solution.' },
      sandler: { tag: 'Sandler: Pain', tip: "Confirm the pain is real and urgent, in the buyer's words." }
    } },
  { key: 'success', label: 'Success criteria', weight: 3,
    rec0: "Do not start the PoC. Run a 30-minute criteria workshop first and get the criteria in writing, in the buyer's words. No criteria, no PoC.",
    rec1: "Get the criteria signed off by the economic buyer, not just the evaluator. Criteria from an evaluator get rewritten at the end.",
    fw: {
      meddpicc: { tag: 'MEDDPICC: Metrics / Decision Criteria', tip: "Success criteria are the Metrics and Decision Criteria. Get them in the buyer's words." }
    } },
  { key: 'data', label: 'Buyer data access', weight: 2,
    rec0: "No real buyer data, no real PoC. Ask for a data sample before the kickoff; if they won't share it, the evaluation isn't real.",
    rec1: 'Confirm the data covers the hard cases, not the happy path. A PoC on clean sample data proves nothing.',
    fw: {} },
  { key: 'fit', label: 'Technical fit', weight: 2,
    rec0: 'Run a technical fit check before the PoC: does the product do the job on their stack, or are you hoping? Hope is not a fit criterion.',
    rec1: 'List the fit gaps explicitly and agree which ones the PoC must close. Unnamed gaps become objections at the end.',
    fw: {} },
  { key: 'buyer', label: 'Economic buyer', weight: 2,
    rec0: 'Find the economic buyer before the PoC starts. A PoC without the buyer is a science project the buyer never sees.',
    rec1: 'Get the economic buyer to the kickoff, even for 15 minutes. Their presence is the proof the PoC matters.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Economic Buyer', tip: 'The Economic Buyer signs. Know who they are and what they care about.' },
      bant: { tag: 'BANT: Authority', tip: 'Authority means the person who can say yes to the spend.' }
    } },
  { key: 'exit', label: 'Exit criteria', weight: 2,
    rec0: 'Agree the exit criteria in writing: what happens when the PoC ends, win or lose. No exit criteria, no end date.',
    rec1: 'Put the decision date on the calendar now. A PoC that can run forever will.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Decision Process', tip: 'Exit criteria are the Decision Process. Agree them before you start.' }
    } },
  { key: 'decision', label: 'Decision process', weight: 2,
    rec0: 'Map the decision process before the kickoff: who decides, in what order, by when. A PoC without a decision process is a demo with extra steps.',
    rec1: 'Confirm the decision process with the economic buyer, not the evaluator. Evaluators describe the process they wish existed.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Decision Process', tip: 'Who decides, in what order, by when.' },
      sandler: { tag: 'Sandler: Upfront Contract', tip: 'Agree what happens next before you demo anything.' }
    } },
  { key: 'timeline', label: 'Timeline', weight: 2,
    rec0: 'Get a date and a cost of slipping it. A PoC with no date drifts until it dies.',
    rec1: "Confirm the date and the consequence of missing it with the buyer. 'ASAP' is not a timeline.",
    fw: {
      bant: { tag: 'BANT: Timeline', tip: 'A timeline without a date is a wish.' }
    } }
];

var FLAGS = {
  noCriteria: 'No success criteria, and no one will define them',
  noData: 'No access to real buyer data',
  noBuyer: 'No economic buyer, and no path to one',
  freeConsulting: 'The "evaluation" is really a free consulting project'
};

var PLANS = {
  good: [
    'Send the criteria and exit criteria in writing today, with the decision date on the calendar.',
    'Kick off with the economic buyer in the room, even for 15 minutes.',
    "Run the PoC against the buyer's real data and report progress against the criteria weekly.",
    'At the exit date, decide: close, extend once with new criteria, or walk away.'
  ],
  warn: [
    'Do not start the PoC yet. Fix the lowest-scored criteria first, in the order listed above.',
    'The single most important fix is success criteria: get them in writing from the buyer.',
    'Confirm the economic buyer and the decision process before the kickoff.',
    "Re-score. If you are still under 80%, keep fixing, don't start."
  ],
  bad: [
    'Do not run this PoC. The fundamentals are not there.',
    'Tell the buyer honestly what is missing and what would change your answer.',
    "If they fix it, re-score. If they won't, you just saved weeks of free consulting."
  ]
};

/* Framework-aware first plan step: when a framework is active, the plan opens
   with the framework's core check for this tool, then the verdict plan follows. */
var FW_PLAN_STEPS = {
  meddpicc: 'Run the evaluation through MEDDPICC before the kickoff: Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Pain, Champion, Competition. The lowest-scored criterion tells you which letter is missing.',
  bant: 'Run it through BANT: Budget, Authority, Need, Timeline. A No on any one of those four is a stop, not a gap.',
  challenger: 'Run it through Challenger: did you teach the buyer something they did not know, and did you find the mobilizer who can drive the change?',
  spin: 'Run it through SPIN: Situation, Problem, Implication, Need-payoff. If the implication is not quantified in the buyer\u2019s numbers, the urgency is not real.',
  sandler: 'Run it through Sandler: pain confirmed, budget and decision process agreed upfront. No surprises after the demo.',
  solution: 'Run it through Solution Selling: vision created, evaluation plan agreed. The buyer should be able to describe the future state without you.'
};

var VERDICT_WORDS = { good: 'Run it', warn: 'Fix these gaps first', bad: 'Walk away' };

/* answers: {problem:0|1|2, ...} — missing keys count as unanswered.
   flags: {noCriteria:bool, ...}
   bonusAnswers: {fw-champion:0|1|2, ...} — only when a framework is active.
   bonusDefs: [{key, label, weight, rec0, rec1}] from V2.bonusQuestions(framework). */
function scorePoc(answers, flags, bonusAnswers, bonusDefs, frameworkKey) {
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
  var bonusTotal = 0;
  (bonusDefs || []).forEach(function (b) {
    max += 2 * b.weight;
    bonusTotal++;
    var v = bonusAnswers ? bonusAnswers[b.key] : undefined;
    if (typeof v === 'number') {
      answered++;
      got += v * b.weight;
      if (v < 2) fixes.push({ key: b.key, label: b.label, value: v, text: v === 0 ? b.rec0 : b.rec1, bonus: true });
    }
  });
  var total = CRITERIA.length + bonusTotal;
  fixes.sort(function (a, b) { return a.value - b.value; });
  var pct = max ? Math.round((got / max) * 100) : 0;
  var hitFlags = Object.keys(FLAGS).filter(function (k) { return flags && flags[k]; });
  var verdict, body;
  if (hitFlags.length > 0) {
    verdict = 'bad';
    body = 'Walk away. A red flag overrides the score — this is not an evaluation. Say so early and spend the time on a deal that can actually close.';
  } else if (answered < total) {
    verdict = 'idle';
    body = (bonusTotal > 0 && answered >= CRITERIA.length)
      ? 'Score the two framework questions to complete the assessment.'
      : 'Score the remaining criteria to get a verdict.';
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
    pct: pct, answered: answered, total: total,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; }),
    plan: verdict === 'idle' ? [] : ((frameworkKey && frameworkKey !== 'general' && FW_PLAN_STEPS[frameworkKey]) ? [FW_PLAN_STEPS[frameworkKey]].concat(PLANS[verdict]) : PLANS[verdict])
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scorePoc: scorePoc, CRITERIA: CRITERIA, FLAGS: FLAGS, PLANS: PLANS, FW_PLAN_STEPS: FW_PLAN_STEPS };
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
  var fwSelect = document.getElementById('fw');
  var bonusWrap = document.getElementById('bonus');
  var bonusLabel = document.getElementById('bonus-label');
  var bonusItems = document.getElementById('bonus-items');

  var TITLES = {
    idle: 'Score the eight criteria above.',
    good: 'Run it.',
    warn: 'Fix these gaps first.',
    bad: 'Walk away.'
  };

  /* Add an empty fw-slot to every base criterion; filled on framework change. */
  document.querySelectorAll('#criteria .criterion').forEach(function (el) {
    var slot = document.createElement('div');
    slot.className = 'fw-slot';
    el.appendChild(slot);
  });

  function currentFramework() { return fwSelect ? fwSelect.value : 'general'; }
  function bonusDefs() { return currentFramework() === 'general' ? [] : V2.bonusQuestions(currentFramework()); }

  function renderBonus() {
    var fw = currentFramework();
    var defs = bonusDefs();
    if (defs.length === 0) {
      bonusWrap.hidden = true;
      bonusItems.innerHTML = '';
      return;
    }
    bonusLabel.textContent = 'Framework questions: ' + V2.frameworkName(fw);
    bonusItems.innerHTML = '';
    defs.forEach(function (b) {
      var div = document.createElement('div');
      div.className = 'criterion bonus';
      div.setAttribute('data-key', b.key);
      div.innerHTML = '<h3>' + b.label + ' <span class="b">BONUS · ' + V2.frameworkName(fw).toUpperCase() + '</span></h3>'
        + '<p>' + b.desc + '</p>'
        + '<div class="opts">'
        + '<label><input type="radio" name="' + b.key + '" value="0"><span>No</span></label>'
        + '<label><input type="radio" name="' + b.key + '" value="1"><span>Partial</span></label>'
        + '<label><input type="radio" name="' + b.key + '" value="2"><span>Yes</span></label>'
        + '</div>';
      bonusItems.appendChild(div);
    });
    bonusItems.querySelectorAll('input[type="radio"]').forEach(function (el) {
      el.addEventListener('change', render);
    });
    bonusWrap.hidden = false;
  }

  function renderFwTags() {
    var fw = currentFramework();
    document.querySelectorAll('#criteria .criterion[data-key]').forEach(function (el) {
      var slot = el.querySelector('.fw-slot');
      if (!slot) return;
      var c = null;
      CRITERIA.forEach(function (cc) { if (cc.key === el.getAttribute('data-key')) c = cc; });
      var m = c && c.fw && c.fw[fw];
      slot.innerHTML = m
        ? '<div class="fw-tag">' + m.tag + '</div><div class="fw-tip">' + m.tip + '</div>'
        : '';
    });
  }

  function readState() {
    var answers = {}, flags = {}, bonus = {};
    CRITERIA.forEach(function (c) {
      var sel = document.querySelector('input[name="' + c.key + '"]:checked');
      if (sel) answers[c.key] = parseInt(sel.value, 10);
    });
    bonusDefs().forEach(function (b) {
      var sel = document.querySelector('input[name="' + b.key + '"]:checked');
      if (sel) bonus[b.key] = parseInt(sel.value, 10);
    });
    document.querySelectorAll('.flag input[type="checkbox"]').forEach(function (cb) {
      var label = cb.closest('.flag');
      flags[label.getAttribute('data-key')] = cb.checked;
      label.classList.toggle('on', cb.checked);
    });
    return { answers: answers, flags: flags, bonus: bonus };
  }

  function promptLines(state, defs) {
    var lines = [];
    CRITERIA.forEach(function (c) {
      var v = state.answers[c.key];
      lines.push({ label: c.label + ' (weight x' + c.weight + ')', value: (typeof v === 'number') ? v : 'not scored' });
    });
    defs.forEach(function (b) {
      var v = state.bonus[b.key];
      lines.push({ label: b.label + ' (' + V2.frameworkName(currentFramework()) + ', weight x' + b.weight + ')', value: (typeof v === 'number') ? v : 'not scored' });
    });
    return lines;
  }

  function render() {
    var state = readState();
    var defs = bonusDefs();
    var r = scorePoc(state.answers, state.flags, state.bonus, defs, currentFramework());
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
      prompttextEl.value = V2.buildPrompt({
        tool: 'PoC evaluation',
        frameworkKey: currentFramework(),
        frameworkName: V2.frameworkName(currentFramework()),
        coach: 'sales coach',
        subject: 'deal',
        lines: promptLines(state, defs),
        flags: r.flags,
        verdictWord: VERDICT_WORDS[r.verdict],
        pct: r.pct
      });
      promptboxEl.hidden = false;
    } else {
      promptboxEl.hidden = true;
    }
  }

  fwSelect.addEventListener('change', function () {
    renderBonus();
    renderFwTags();
    render();
  });
  document.querySelectorAll('#criteria input[type="radio"], .flag input[type="checkbox"]').forEach(function (el) {
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
    fwSelect.value = 'general';
    renderBonus();
    renderFwTags();
    render();
  });
  renderBonus();
  renderFwTags();
  render();
}
