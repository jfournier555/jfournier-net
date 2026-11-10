/* Expansion Readiness Scorer — scoring logic (v2).
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: value demonstrated x3, everything else x2. Base max 34 (8 criteria).
   Framework bonus questions add 2 x weight 1 (max 4) when a framework is active. */
'use strict';

var CRITERIA = [
  { key: 'value', label: 'Value demonstrated', weight: 3,
    rec0: "Stop. Do not pitch the expansion. First, get the customer to say what the product did for them, in their own metrics. No demonstrated value, no expansion.",
    rec1: "Get the value statement in writing from the customer, with their numbers. Your numbers are a claim; their numbers are the case.",
    fw: {
      meddpicc: { tag: 'MEDDPICC: Metrics', tip: 'Value demonstrated is the Metrics. Get them from the customer.' },
      solution: { tag: 'Solution Selling: Vision', tip: 'The expansion is the next chapter of the vision, not a new sale.' }
    } },
  { key: 'gaps', label: 'Usage gaps', weight: 2,
    rec0: "Find the real usage gaps: features they own but don't use, seats that would get used. No gaps, no expansion.",
    rec1: 'Quantify the gaps: how many seats, which features, what outcome? Gaps without numbers are guesses.',
    fw: {} },
  { key: 'adoption', label: 'Adoption depth', weight: 2,
    rec0: 'Deepen adoption first. An expansion on top of thin adoption is shelfware with a bigger invoice.',
    rec1: 'Get the right users on the right features before you expand. One power user is not adoption.',
    fw: {} },
  { key: 'stakeholders', label: 'Stakeholder coverage', weight: 2,
    rec0: 'Widen the relationships before you pitch. A single-threaded expansion dies when the thread leaves.',
    rec1: 'Get the economic buyer and a second sponsor into the expansion conversation. One thread is a risk.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Champion / Economic Buyer', tip: 'Expansion needs both, not a single thread.' }
    } },
  { key: 'signals', label: 'Commercial signals', weight: 2,
    rec0: 'Check the account health first. Usage falling or support load spiking means renewal first, expansion later.',
    rec1: 'Confirm usage is stable or growing and support load is normal. Then pitch.',
    fw: {} },
  { key: 'case', label: 'Business case', weight: 2,
    rec0: 'Build the business case: a metric it moves and a number attached. No number, no expansion.',
    rec1: "Get the customer to agree the number. A business case they haven't agreed to is your slide, not their decision.",
    fw: {
      bant: { tag: 'BANT: Budget', tip: 'The business case is the budget conversation.' },
      challenger: { tag: 'Challenger: Commercial Teaching', tip: 'Teach the customer what the expansion is worth.' }
    } },
  { key: 'decision', label: 'Decision process', weight: 2,
    rec0: 'Map the decision process for the expansion: who decides, in what order, by when. An expansion without a decision process is a conversation, not a deal.',
    rec1: 'Confirm the decision process with the economic buyer, not the champion. Champions describe the process they wish existed.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Decision Process', tip: 'Who decides, in what order, by when.' },
      sandler: { tag: 'Sandler: Upfront Contract', tip: 'Agree what happens next before you pitch the expansion.' }
    } },
  { key: 'budget', label: 'Budget', weight: 2,
    rec0: 'Confirm budget before you pitch the expansion. An unbudgeted expansion is a discount conversation waiting to happen.',
    rec1: "Get the budget number and the approver. 'We will find it' is not budget.",
    fw: {
      bant: { tag: 'BANT: Budget', tip: 'Budget means allocated, with the approver named.' }
    } }
];

var FLAGS = {
  noValue: 'No demonstrated value — the customer cannot say what it did for them',
  atRisk: 'The account is at risk — renewal first, expansion later',
  shelfware: 'The "expansion" is shelfware they already own and do not use',
  noBuyer: 'No economic buyer in the loop'
};

var PLANS = {
  good: [
    'Lead with the value the customer already stated, in their numbers.',
    'Put the business case in writing with the metric and the number.',
    'Bring the economic buyer into the conversation early.',
    "Close with a date, not a 'let's circle back.'"
  ],
  warn: [
    'Do not pitch the expansion yet. Fix the lowest-scored criteria first, in the order listed above.',
    'The most important fix is demonstrated value: get the customer to state it.',
    'Check account health and widen the relationships.',
    "Re-score. If you are still under 80%, keep fixing."
  ],
  bad: [
    'Do not pitch the expansion. The fundamentals are not there.',
    'Focus on the renewal case and adoption depth.',
    'Revisit when the value is demonstrated and the account is healthy. An expansion pitched too early teaches the customer to ask for a discount.'
  ]
};

/* Framework-aware first plan step: when a framework is active, the plan opens
   with the framework's core check for this tool, then the verdict plan follows. */
var FW_PLAN_STEPS = {
  meddpicc: 'Run the expansion through MEDDPICC: Metrics are the demonstrated value, and the Economic Buyer and Champion are the two people who have to say yes.',
  bant: 'Run it through BANT: Budget, Authority, Need, Timeline. An expansion without budget is a discount conversation.',
  challenger: 'Run it through Challenger: teach the customer what the expansion is worth in their own numbers, and find the mobilizer who can sell it internally.',
  spin: 'Run it through SPIN: the need-payoff is the value the customer states in their own words. If they cannot say it, the expansion has no case.',
  sandler: 'Run it through Sandler: pain confirmed, budget and decision process agreed upfront. An expansion pitched without the upfront contract becomes a discount.',
  solution: 'Run it through Solution Selling: the expansion is the next chapter of the vision, not a new sale. The customer should be able to describe it without you.'
};

var VERDICT_WORDS = { good: 'Expand now', warn: 'Fix these gaps first', bad: 'Not yet' };

/* answers: {value:0|1|2, ...} — missing keys count as unanswered.
   flags: {noValue:bool, ...}
   bonusAnswers: {fw-champion:0|1|2, ...} — only when a framework is active.
   bonusDefs: [{key, label, weight, rec0, rec1}] from V2.bonusQuestions(framework). */
function scoreExpansion(answers, flags, bonusAnswers, bonusDefs, frameworkKey) {
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
    body = "Not yet. A red flag overrides the score — this is not an expansion, it is a renewal save wearing an expansion's clothes. Fix the renewal case first.";
  } else if (answered < total) {
    verdict = 'idle';
    body = (bonusTotal > 0 && answered >= CRITERIA.length)
      ? 'Score the two framework questions to complete the assessment.'
      : 'Score the remaining criteria to get a verdict.';
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
    pct: pct, answered: answered, total: total,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; }),
    plan: verdict === 'idle' ? [] : ((frameworkKey && frameworkKey !== 'general' && FW_PLAN_STEPS[frameworkKey]) ? [FW_PLAN_STEPS[frameworkKey]].concat(PLANS[verdict]) : PLANS[verdict])
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreExpansion: scoreExpansion, CRITERIA: CRITERIA, FLAGS: FLAGS, PLANS: PLANS, FW_PLAN_STEPS: FW_PLAN_STEPS };
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
    good: 'Expand now.',
    warn: 'Fix these gaps first.',
    bad: 'Not yet.'
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
    var r = scoreExpansion(state.answers, state.flags, state.bonus, defs, currentFramework());
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
        tool: 'expansion readiness',
        article: 'an',
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
