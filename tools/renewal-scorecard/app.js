/* CSM Renewal Scorecard: scoring logic (v2).
   Pure functions at the top (testable in node); DOM wiring below.
   Worst section governs the verdict. Section D (framework lens) appears
   when a framework is selected and counts as a fourth section. */
'use strict';

var DEP_ITEMS = [
  { key: 'intro', label: 'Introduced us',
    rec: 'Get a second introducer: ask your champion to introduce a colleague in the first 30 days.' },
  { key: 'training', label: 'Runs training',
    rec: 'Train a second person. A renewal that depends on one trainer dies when they leave.' },
  { key: 'billing', label: 'Handles invoices & renewals',
    rec: 'Get a second contact on invoices and renewals, ideally in finance. One billing contact is a single point of failure.' },
  { key: 'contact', label: 'First call on issues',
    rec: 'Add a second escalation contact. Two names on the issue path, not one.' },
  { key: 'qbr', label: 'Attends the QBRs',
    rec: "Bring a second person to the QBR, ideally the champion's boss. QBRs with one attendee are not QBRs." }
];

var VALUE_ITEMS = [
  { key: 'goals', label: 'Goals decoded',
    rec0: "Decode the goals: sit down with the customer and write down what success looks like for them, and how it is measured. No decoded goals, no value story.",
    rec1: "Get the goals and their measures in writing, in the customer's words. Verbal goals get reinterpreted later.",
    fw: {
      meddpicc: { tag: 'MEDDPICC: Metrics', tip: "Goals decoded are the Metrics. Get them in the customer's words." }
    } },
  { key: 'roadmap', label: 'Roadmap',
    rec0: 'Build the roadmap: the steps the customer takes and the inputs you provide. No roadmap, no path to value.',
    rec1: 'Put owners and dates on the roadmap steps. A roadmap without dates is a wish list.',
    fw: {} },
  { key: 'wins', label: 'Quick wins',
    rec0: 'Deliver a quick win fast: one visible improvement in the first 30 days. No quick win, no buy-in.',
    rec1: 'Name the next quick win and the date it lands. Momentum needs a next win.',
    fw: {} },
  { key: 'measured', label: 'Measured',
    rec0: 'Start measuring: pick the metrics the customer cares about and track them. Unmeasured value is invisible value.',
    rec1: "Share the measurements with the customer regularly. Metrics nobody sees don't build the renewal case.",
    fw: {
      meddpicc: { tag: 'MEDDPICC: Metrics', tip: 'Measured means the Metrics are tracked, not assumed.' }
    } },
  { key: 'demonstrated', label: 'Demonstrated',
    rec0: "Demonstrate the results: benchmark actuals against projections and show them. Undemonstrated value doesn't renew.",
    rec1: 'Put the demonstration in front of the economic buyer, not just the users. Users do not sign renewals.',
    fw: {} },
  { key: 'growth', label: 'Growth identified',
    rec0: 'Identify the growth: where could this account go next, and what is it worth? No growth story, no expansion.',
    rec1: 'Put a number on the growth scenario and share it with the customer. Growth without a number is a hunch.',
    fw: {
      challenger: { tag: 'Challenger: Commercial Teaching', tip: 'Growth identified is the teach: show the customer the gain they have not seen.' }
    } },
  { key: 'sponsor', label: 'Executive sponsorship',
    rec0: 'Find the executive sponsor. A renewal without one is a procurement decision.',
    rec1: 'Get the sponsor to the QBR. Their presence is the proof the value is real.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Economic Buyer', tip: 'The executive sponsor is the Economic Buyer. Know who signs.' }
    } }
];

var HEALTH_ITEMS = [
  { key: 'works', label: 'It works',
    rec0: 'Fix the product first. A renewal conversation cannot save an account where the product is broken. Escalate the defects today.',
    rec1: 'Close the open defects and confirm with the users. Partial fixes need a date.',
    fw: {} },
  { key: 'adoption', label: 'Adoption is deep',
    rec0: "Deepen adoption: get the right users on the right features. Shelfware doesn't renew.",
    rec1: 'Find the next user group to onboard and set a date. Adoption grows by plan, not by hope.',
    fw: {} },
  { key: 'support', label: 'Support load is normal',
    rec0: 'Find out why this account eats support time, and fix the cause. A support-heavy account is a churn risk wearing a renewal\'s clothes.',
    rec1: 'Track the support load weekly until it is normal. A falling trend is the story; a flat one is not.',
    fw: {} },
  { key: 'usage', label: 'Usage is stable or growing',
    rec0: 'Find out why usage is falling and address it directly with the customer. Declining usage is the earliest churn signal.',
    rec1: 'Watch usage weekly and act on the first dip. A second dip is a pattern.',
    fw: {} },
  { key: 'decision', label: 'Decision process',
    rec0: 'Map the renewal decision process now: who signs, by when, what could delay it. A renewal without a process is a surprise.',
    rec1: 'Confirm the sign-off date with the economic buyer. Dates from the champion are guesses.',
    fw: {
      meddpicc: { tag: 'MEDDPICC: Decision Process', tip: 'Who signs, by when, what could delay it.' },
      sandler: { tag: 'Sandler: Upfront Contract', tip: 'Agree the renewal process upfront, no surprises.' }
    } }
];

var FW_NOTE_A = {
  meddpicc: 'MEDDPICC reads this as Champion risk: a single-threaded account has no champion, it has a point of failure.',
  bant: 'BANT reads this as Authority risk: if one person holds the relationship, they hold the renewal.',
  challenger: 'Challenger reads this as a mobilizer problem: one person cannot mobilize an organization.'
};

var PLANS = {
  good: [
    'Confirm the renewal date and the sign-off process in writing.',
    'Bring the expansion conversation to the economic buyer with the demonstrated value.',
    'Keep widening relationships: one new stakeholder per quarter.'
  ],
  warn: [
    'Fix the worst section first, in the order listed above.',
    'The most urgent fix is usually champion dependency: get a second person into the room.',
    "Demonstrate the value in the customer's numbers before the renewal date.",
    'Re-score monthly until the renewal is safe.'
  ],
  bad: [
    'Escalate internally today: this account needs a save plan, not a check-in.',
    'Get an executive sponsor engaged on both sides.',
    'Address the technical health first: a broken product does not renew.',
    'Do not pitch expansion until the renewal is safe.'
  ]
};

/* Framework-aware first plan step: when a framework is active, the plan opens
   with the framework's core check for this tool, then the verdict plan follows. */
var FW_PLAN_STEPS = {
  meddpicc: 'Run the renewal through MEDDPICC: the Champion letter is Section A. A single-threaded account has no champion, it has a point of failure.',
  bant: 'Run it through BANT: Authority is the renewal signer, Budget is the renewal number, Timeline is the renewal date. A No on any one of those three is a risk.',
  challenger: 'Run it through Challenger: teach the customer what the renewal is worth in their numbers, and find the mobilizer who can defend it internally.',
  spin: 'Run it through SPIN: the implication is the cost of losing the product. If the customer cannot say what it does for them, the renewal has no case.',
  sandler: 'Run it through Sandler: pain confirmed, decision process and budget agreed upfront. A renewal with surprises at the end is a churn.',
  solution: 'Run it through Solution Selling: the renewal is the vision working, not a new sale. The customer should be able to describe the value without you.'
};

var VERDICT_WORDS = { good: 'Safe, renew and expand', warn: 'At risk', bad: 'Churn risk, escalate now' };

function depBand(pct) {
  if (pct >= 81) return { band: 'bad', label: 'Crisis mode: one change away from churn' };
  if (pct >= 51) return { band: 'warn', label: 'High risk: widen relationships now' };
  if (pct >= 21) return { band: 'warn', label: 'Some risk, manageable' };
  return { band: 'good', label: 'We can survive a departure' };
}

function sectionBand(pct) {
  if (pct < 40) return 'bad';
  if (pct < 70) return 'warn';
  return 'good';
}

/* dep: {intro:bool, ...}: true where a single person owns it.
   value/health: {goals:0|1|2, ...}: missing keys count as unanswered.
   fwAnswers: {fw-champion:0|1|2, ...}: only when a framework is active.
   fwDefs: [{key, label, rec0, rec1}] from V2.bonusQuestions(framework). */
function scoreRenewal(dep, value, health, fwAnswers, fwDefs, frameworkKey) {
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

  var fw = null;
  if (fwDefs && fwDefs.length > 0) {
    fw = pctOf(fwDefs, fwAnswers || {});
    fw.band = sectionBand(fw.pct);
  }

  var answered = depAnswered + v.answered + h.answered + (fw ? fw.answered : 0);
  var total = DEP_ITEMS.length + VALUE_ITEMS.length + HEALTH_ITEMS.length + (fw ? fwDefs.length : 0);

  var worst = 'good';
  var bands = [depInfo.band, vBand, hBand];
  if (fw) bands.push(fw.band);
  bands.forEach(function (b) {
    if (b === 'bad') worst = 'bad';
    else if (b === 'warn' && worst === 'good') worst = 'warn';
  });
  var worstPct = Math.min(depPct, v.pct, h.pct, fw ? fw.pct : 100);

  var verdict, body;
  if (answered < total) {
    verdict = 'idle';
    body = 'Score all sections to get a verdict. The worst section governs.';
  } else if (worst === 'bad') {
    verdict = 'bad';
    body = 'Churn risk, escalate now. At least one section is in the red: the relationship is single-threaded, the value is invisible, or the product is the problem. Fix that section first; no renewal conversation saves an account in this state.';
  } else if (worst === 'warn') {
    verdict = 'warn';
    body = 'At risk, fix these before the renewal conversation. The account renews, but only if the gaps below get closed. Widen the relationships, demonstrate the value, or fix the product, whichever section is yellow.';
  } else {
    verdict = 'good';
    body = 'Safe, renew and expand. The relationship is broad, the value is visible and measured, and the product works. This is the account to grow, not just keep.';
  }

  var fixes = [], improvements = [];
  DEP_ITEMS.forEach(function (d) {
    if (dep[d.key] === true) fixes.push({ label: d.label, text: d.rec });
  });
  VALUE_ITEMS.forEach(function (it) {
    if (value[it.key] === 0) fixes.push({ label: it.label, text: it.rec0 });
    else if (value[it.key] === 1) improvements.push({ label: it.label, text: it.rec1 });
  });
  HEALTH_ITEMS.forEach(function (it) {
    if (health[it.key] === 0) fixes.push({ label: it.label, text: it.rec0 });
    else if (health[it.key] === 1) improvements.push({ label: it.label, text: it.rec1 });
  });
  if (fwDefs) {
    fwDefs.forEach(function (it) {
      var val = fwAnswers ? fwAnswers[it.key] : undefined;
      if (val === 0) fixes.push({ label: it.label, text: it.rec0 });
      else if (val === 1) improvements.push({ label: it.label, text: it.rec1 });
    });
  }

  return {
    depPct: depPct, depBand: depInfo.band, depLabel: depInfo.label,
    valuePct: v.pct, valueBand: vBand,
    healthPct: h.pct, healthBand: hBand,
    fwPct: fw ? fw.pct : null, fwBand: fw ? fw.band : null,
    worstPct: worstPct,
    answered: answered, total: total,
    verdict: verdict, body: body,
    fixes: fixes, improvements: improvements,
    plan: verdict === 'idle' ? [] : ((frameworkKey && frameworkKey !== 'general' && FW_PLAN_STEPS[frameworkKey]) ? [FW_PLAN_STEPS[frameworkKey]].concat(PLANS[verdict]) : PLANS[verdict])
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreRenewal: scoreRenewal, DEP_ITEMS: DEP_ITEMS, VALUE_ITEMS: VALUE_ITEMS, HEALTH_ITEMS: HEALTH_ITEMS, FW_NOTE_A: FW_NOTE_A, PLANS: PLANS, FW_PLAN_STEPS: FW_PLAN_STEPS };
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
  var sFwWrap = document.getElementById('s-fw-wrap');
  var sFw = document.getElementById('s-fw');
  var fixlistEl = document.getElementById('fixlist');
  var fixitemsEl = document.getElementById('fixitems');
  var planEl = document.getElementById('plan');
  var planitemsEl = document.getElementById('planitems');
  var promptboxEl = document.getElementById('promptbox');
  var prompttextEl = document.getElementById('prompttext');
  var copyBtn = document.getElementById('copyprompt');
  var fwSelect = document.getElementById('fw');
  var fwSection = document.getElementById('framework-sec');
  var fwNameEl = document.getElementById('fw-name');
  var bonusItems = document.getElementById('bonus-items');
  var fwNoteA = document.getElementById('fw-note-a');

  function readBool(name) {
    var sel = document.querySelector('input[name="' + name + '"]:checked');
    return sel ? sel.value === '1' : undefined;
  }
  function readNum(name) {
    var sel = document.querySelector('input[name="' + name + '"]:checked');
    return sel ? parseInt(sel.value, 10) : undefined;
  }

  function currentFramework() { return fwSelect ? fwSelect.value : 'general'; }
  function bonusDefs() { return currentFramework() === 'general' ? [] : V2.bonusQuestions(currentFramework()); }

  /* Add an empty fw-slot to every Section B/C criterion; filled on framework change. */
  document.querySelectorAll('#value .criterion, #health .criterion').forEach(function (el) {
    var slot = document.createElement('div');
    slot.className = 'fw-slot';
    el.appendChild(slot);
  });

  function renderBonus() {
    var fw = currentFramework();
    var defs = bonusDefs();
    if (defs.length === 0) {
      fwSection.hidden = true;
      bonusItems.innerHTML = '';
      return;
    }
    fwNameEl.textContent = V2.frameworkName(fw);
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
    fwSection.hidden = false;
  }

  function renderFwTags() {
    var fw = currentFramework();
    var note = FW_NOTE_A[fw];
    if (note) {
      fwNoteA.textContent = note;
      fwNoteA.hidden = false;
    } else {
      fwNoteA.hidden = true;
    }
    var all = VALUE_ITEMS.concat(HEALTH_ITEMS);
    document.querySelectorAll('#value .criterion[data-key], #health .criterion[data-key]').forEach(function (el) {
      var slot = el.querySelector('.fw-slot');
      if (!slot) return;
      var it = null;
      all.forEach(function (x) { if (x.key === el.getAttribute('data-key')) it = x; });
      var m = it && it.fw && it.fw[fw];
      slot.innerHTML = m
        ? '<div class="fw-tag">' + m.tag + '</div><div class="fw-tip">' + m.tip + '</div>'
        : '';
    });
  }

  function render() {
    var dep = {}, value = {}, health = {}, fwAns = {};
    DEP_ITEMS.forEach(function (d) { var v = readBool(d.key); if (typeof v !== 'undefined') dep[d.key] = v; });
    VALUE_ITEMS.forEach(function (it) { var v = readNum(it.key); if (typeof v !== 'undefined') value[it.key] = v; });
    HEALTH_ITEMS.forEach(function (it) { var v = readNum(it.key); if (typeof v !== 'undefined') health[it.key] = v; });
    var defs = bonusDefs();
    defs.forEach(function (b) { var v = readNum(b.key); if (typeof v !== 'undefined') fwAns[b.key] = v; });
    var r = scoreRenewal(dep, value, health, fwAns, defs, currentFramework());

    verdictEl.className = 'verdict ' + r.verdict;
    var scoreWord = { idle: '—', good: 'Safe', warn: 'At risk', bad: 'Churn risk' };
    scoreEl.textContent = scoreWord[r.verdict];
    titleEl.textContent = r.verdict === 'idle'
      ? (defs.length > 0 ? 'Score all four sections.' : 'Score all three sections.')
      : ({ good: 'Renew and expand.', warn: 'Fix these before the renewal conversation.', bad: 'Escalate now.' })[r.verdict];
    bodyEl.textContent = r.body;

    if (r.answered > 0) {
      sDep.textContent = r.depPct + '% · ' + r.depLabel;
      sVal.textContent = r.valuePct + '%';
      sHealth.textContent = r.healthPct + '%';
      if (defs.length > 0) {
        sFw.textContent = r.fwPct + '%';
        sFwWrap.hidden = false;
      } else {
        sFwWrap.hidden = true;
      }
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

    if (r.plan.length > 0) {
      planitemsEl.innerHTML = r.plan.map(function (s) { return '<li>' + s + '</li>'; }).join('');
      planEl.hidden = false;
    } else {
      planEl.hidden = true;
    }

    if (r.verdict !== 'idle') {
      var lines = [
        { label: 'Champion dependency', value: r.depPct + '%, ' + r.depLabel },
        { label: 'Value realized', value: r.valuePct + '%' },
        { label: 'Technical health', value: r.healthPct + '%' }
      ];
      if (defs.length > 0) {
        lines.push({ label: 'Framework lens (' + V2.frameworkName(currentFramework()) + ')', value: r.fwPct + '%' });
      }
      prompttextEl.value = V2.buildPrompt({
        tool: 'renewal',
        frameworkKey: currentFramework(),
        frameworkName: V2.frameworkName(currentFramework()),
        coach: 'customer success coach',
        subject: 'renewal',
        linesHeader: 'My section scores:',
        lines: lines,
        flags: [],
        verdictWord: VERDICT_WORDS[r.verdict],
        pct: r.worstPct
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
  document.querySelectorAll('input[type="radio"]').forEach(function (el) {
    el.addEventListener('change', render);
  });
  copyBtn.addEventListener('click', function () {
    V2.copyText(prompttextEl.value, copyBtn);
  });
  document.getElementById('reset').addEventListener('click', function () {
    document.querySelectorAll('input[type="radio"]').forEach(function (el) { el.checked = false; });
    fwSelect.value = 'general';
    renderBonus();
    renderFwTags();
    render();
  });
  renderBonus();
  renderFwTags();
  render();
}
