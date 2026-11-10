/* Competitive Displacement Scorer — scoring logic (v2).
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: workflow dependency x3, everything else x2. Base max 34 (8 criteria).
   Framework bonus questions add 2 x weight 1 (max 4) when a framework is active. */
'use strict';

var CRITERIA = [
  { key: 'dependency', label: 'Workflow dependency', weight: 3,
    rec0: 'You have no wedge. Stop talking displacement and start building the workflow the buyer cannot live without. That is the work.',
    rec1: 'Deepen the dependency: find one more workflow the buyer does daily and make yourself part of it before you push the displacement.',
    fw: {
      challenger: { tag: 'Challenger: Teach', tip: "Teach the buyer a new way to see their workflow, then become part of it." }
    } },
  { key: 'integration', label: 'Integration depth', weight: 2,
    rec0: 'Get integrated before you talk displacement. Data flowing, not a sidecar. An unintegrated vendor is easy to cut.',
    rec1: 'Document the integration points and who depends on them. Make the dependency visible to the buyer.',
    fw: {} },
  { key: 'gaps', label: 'Incumbent gaps', weight: 2,
    rec0: 'If nobody feels the gaps, there is no displacement. Find the pain the incumbent causes, or admit this is a feature comparison.',
    rec1: 'Quantify the gaps with the buyer: what do they cost per month? Gaps without a number are complaints.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Competition', tip: "Know the incumbent's gaps better than the incumbent does." },
      challenger: { tag: 'Challenger: Reframe', tip: "Reframe the problem so the incumbent's strength stops mattering." }
    } },
  { key: 'switching', label: 'Switching cost', weight: 2,
    rec0: 'Quantify the switching cost and the migration path before you pitch. An unquantified switch is a leap the buyer will not take.',
    rec1: 'Get the buyer to agree the migration path in writing. A path the buyer has not accepted is a hope.',
    fw: {} },
  { key: 'buyers', label: 'Champion + economic buyer', weight: 2,
    rec0: 'Find a champion and the economic buyer. A displacement without both is a conversation with an evaluator.',
    rec1: "Test the champion: ask them to bring the economic buyer to the next meeting. If they can't, you have a coach, not a champion.",
    fw: {
      meddpicc: { tag: 'MEDDPICC: Economic Buyer / Champion', tip: 'A displacement needs both.' }
    } },
  { key: 'proof', label: 'Proof against their data', weight: 2,
    rec0: "Prove it against the buyer's own data before you claim the displacement. A canned demo proves nothing against an incumbent.",
    rec1: "Run the proof on the buyer's hardest case, not the easiest. The incumbent wins the easy cases.",
    fw: {
      solution: { tag: 'Solution Selling: Vision', tip: 'Prove the future state against their data.' }
    } },
  { key: 'decision', label: 'Decision process', weight: 2,
    rec0: 'Map the decision process before you push the displacement: who decides, in what order, by when. A displacement without a decision process is a demo with extra steps.',
    rec1: 'Confirm the decision process with the economic buyer, not the evaluator. Evaluators describe the process they wish existed.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Decision Process', tip: 'Who decides, in what order, by when.' },
      sandler: { tag: 'Sandler: Upfront Contract', tip: 'Agree what happens next before you push the displacement.' }
    } },
  { key: 'budget', label: 'Budget', weight: 2,
    rec0: 'Confirm budget before you invest in the displacement. An unbudgeted displacement is a free consulting project.',
    rec1: "Get the budget number and the approval path. 'We will find budget' is not budget.",
    fw: {
      bant: { tag: 'BANT: Budget', tip: 'Budget means allocated, with the approver named.' }
    } }
];

var FLAGS = {
  goodEnough: 'The incumbent is "good enough" and nobody inside feels pain',
  noChampion: 'No champion — talking to an evaluator with no pull',
  ripReplace: 'The "displacement" is really a rip-and-replace with no migration path',
  features: 'Competing on features, not on the workflow the buyer lives in'
};

var PLANS = {
  good: [
    'Lead with the workflow dependency, not the feature list.',
    'Put the migration path and the switching cost in writing, with dates.',
    "Run the proof against their hardest case.",
    'Ask for the decision at the exit date you already agreed.'
  ],
  warn: [
    'Do not lead with displacement. Lead with the workflow the buyer cannot live without.',
    'Fix the lowest-scored criteria first, in the order listed above.',
    'Get integrated and prove value against their data before you mention the incumbent.',
    'Re-score. Displacement comes after the wedge, not before.'
  ],
  bad: [
    'Do not pursue this displacement. The fundamentals are not there.',
    'Keep the relationship warm and build the wedge quietly: become load-bearing next to the incumbent.',
    "Revisit when the buyer feels the incumbent's gaps or the dependency is real."
  ]
};

/* Framework-aware first plan step: when a framework is active, the plan opens
   with the framework's core check for this tool, then the verdict plan follows. */
var FW_PLAN_STEPS = {
  meddpicc: 'Run the displacement through MEDDPICC: the Competition letter is the incumbent, and the Champion and Economic Buyer are the two people who decide whether it moves.',
  bant: 'Run it through BANT: Budget, Authority, Need, Timeline. A displacement without budget and authority is a feature comparison.',
  challenger: 'Run it through Challenger: teach the buyer a new way to see their workflow, reframe the incumbent\u2019s strength, and find the mobilizer. Challenger is the displacement methodology.',
  spin: 'Run it through SPIN: the implication is the cost of staying with the incumbent. If that number is not quantified, the buyer has no reason to move.',
  sandler: 'Run it through Sandler: pain confirmed with the buyer, decision process and budget agreed upfront. A displacement with surprises at the end is a lost deal.',
  solution: 'Run it through Solution Selling: vision created, evaluation plan agreed. The buyer should be able to describe life after the incumbent without you.'
};

var VERDICT_WORDS = { good: 'Displace now', warn: 'Build the wedge first', bad: "Don't bother" };

/* answers: {dependency:0|1|2, ...} — missing keys count as unanswered.
   flags: {goodEnough:bool, ...}
   bonusAnswers: {fw-champion:0|1|2, ...} — only when a framework is active.
   bonusDefs: [{key, label, weight, rec0, rec1}] from V2.bonusQuestions(framework). */
function scoreDisplacement(answers, flags, bonusAnswers, bonusDefs, frameworkKey) {
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
    body = "Don't bother. A red flag overrides the score — this is not a displacement, it is a feature comparison the incumbent wins. Build the wedge first, or walk away from this one.";
  } else if (answered < total) {
    verdict = 'idle';
    body = (bonusTotal > 0 && answered >= CRITERIA.length)
      ? 'Score the two framework questions to complete the assessment.'
      : 'Score the remaining criteria to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'Displace now. The buyer depends on your workflows, the incumbent has gaps they feel, the switching cost is accepted, and the proof is against their data. That is a real displacement.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'Build the wedge first. Do not lead with displacement — lead with the workflow the buyer cannot live without. Get the missing pieces in place, then run the displacement.';
  } else {
    verdict = 'bad';
    body = "Don't bother. The fundamentals are not there: no dependency, no felt pain, or no buyer at the table. A head-on displacement here just burns credibility.";
  }
  return {
    pct: pct, answered: answered, total: total,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; }),
    plan: verdict === 'idle' ? [] : ((frameworkKey && frameworkKey !== 'general' && FW_PLAN_STEPS[frameworkKey]) ? [FW_PLAN_STEPS[frameworkKey]].concat(PLANS[verdict]) : PLANS[verdict])
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreDisplacement: scoreDisplacement, CRITERIA: CRITERIA, FLAGS: FLAGS, PLANS: PLANS, FW_PLAN_STEPS: FW_PLAN_STEPS };
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
    good: 'Displace now.',
    warn: 'Build the wedge first.',
    bad: "Don't bother."
  };

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
    var r = scoreDisplacement(state.answers, state.flags, state.bonus, defs, currentFramework());
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
        tool: 'competitive displacement',
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
