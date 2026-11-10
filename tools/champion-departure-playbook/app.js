/* Champion Departure Playbook — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Weights: second relationship x3, everything else x2. Max weighted score 18.
   No framework dropdown: this is a rebuild, not a sales motion. */
'use strict';

var CRITERIA = [
  { key: 'second', label: 'A second relationship in the account', weight: 3,
    rec0: 'You have no second relationship. That is the whole problem. Start with the person closest to the champion\u2019s work and earn one conversation. Don\u2019t pitch. Ask what they need.',
    rec1: 'Your second relationship is thin. Give them a reason to talk to you: a result they care about, in their numbers, not yours.' },
  { key: 'successor', label: 'The successor is known', weight: 2,
    rec0: 'Find the name. Ask the champion before they go dark, ask the admin, ask anyone who will answer. A rebuild without a name is a guess.',
    rec1: 'Confirm the successor actually decides. A name that can\u2019t approve anything is a detour, not a path.' },
  { key: 'value-doc', label: 'Value is documented', weight: 2,
    rec0: 'Write the value down now: what the product did, in the customer\u2019s numbers, on one page. A successor who can\u2019t see the value won\u2019t defend it.',
    rec1: 'Put the value in the successor\u2019s terms. Your metrics are not their metrics. Translate them before the first meeting.' },
  { key: 'renewal-known', label: 'Renewal date and decision process known', weight: 2,
    rec0: 'Get the date and the decider. A rebuild without a deadline drifts, and drifting accounts churn.',
    rec1: 'Confirm the date and the decider with the successor, not just the champion. Dates from a departing champion are guesses.' }
];

var FLAGS = {
  'only-30': 'The champion was the only relationship and the renewal is within 30 days',
  'competitor-in': 'The successor has already brought in a competitor',
  'no-meeting': 'No one inside will take a meeting'
};

/* The rebuild spine: the same 7/14/30 plan for a rebuildable verdict.
   The exit plan replaces it when the verdict is too late to rebuild. */
var SPINE = [
  'Days 1\u20137: map the account and reach the successor. List every person the champion touched, find the successor, and get one meeting. Say it once, clearly: the champion left, you are here, and the value is real.',
  'Days 8\u201314: re-prove the value in the successor\u2019s terms. Bring the documented results, in their numbers, and ask what they need to see to believe it.',
  'Days 15\u201330: the new champion\u2019s first win, then the renewal conversation. Get the successor one visible win with the product, then talk about the renewal. Never before.'
];

var EXIT = [
  'Stop rebuilding. The first week is gone and the account is too thin to rebuild.',
  'Salvage the relationship: one honest conversation with whoever will take it, about what the product did and why it mattered.',
  'Document what happened: the dependency, the departure, the missed signals. So the next account doesn\u2019t repeat it.',
  'Keep the door open. A churned account with a good exit is a future expansion. A burned account is just gone.'
];

var PLANS = { good: SPINE, warn: SPINE, bad: EXIT };

var SITUATIONS = {
  'no-successor': {
    label: 'Champion left, no successor named',
    step: 'No successor is named, so the first job is finding the decider. Call the champion before they go dark and ask one question: who decides now? Then call that person within 48 hours.',
    message: 'Hi [name], I worked closely with [champion] on [product], and I wanted to reach out directly now that they have moved on. You have results from us already, and I can put them on one page in your numbers. Can we take 20 minutes this week? You tell me what matters to you now, and I will show you what we have delivered.',
    questions: [
      'Who decides on [product] now, you, or someone else I should meet?',
      'What did [champion] tell you about us before they left?',
      'What would you need to see from us in the next 30 days to believe this is worth keeping?',
      'Who else on your team uses the product, and what do they think of it?',
      'If we disappeared tomorrow, what would break first?'
    ]
  },
  'new-successor': {
    label: 'Champion left, successor named but new',
    step: 'The successor is new, so they inherited a decision they didn\u2019t make. Your first meeting is not a pitch. It is a question: what do you need this product to do for you?',
    message: 'Hi [name], I know you have just inherited [product], and I don\u2019t want to assume you know what it does for your team. Can we take 20 minutes this week? I will bring the results so far, and I would rather hear what you need from us than pitch you on what we have already done.',
    questions: [
      'What did you inherit that you actually want, and what did you inherit that you would cut?',
      'How do you measure whether [product] is working for your team?',
      'What is the one result you would want to show your boss in 30 days?',
      'Who on your team is the real power user, and can I meet them?',
      'What would make you confident enough to defend this renewal internally?'
    ]
  },
  promoted: {
    label: 'Champion was promoted internally',
    step: 'The champion was promoted, not lost. That is the best version of this problem: they still work there, they still believe, and they can introduce you to their replacement. Ask for the introduction before their calendar fills with their new job.',
    message: 'Hi [name], [champion] spoke highly of you when they moved into their new role, and they suggested we connect. I would like 20 minutes to show you what [product] has delivered for your team so far, and to hear what you would want it to do next.',
    questions: [
      'What did [champion] hand you, and what did they leave out?',
      'How does [product] fit the team you are running now?',
      'What is the first thing you would change about how we work together?',
      'Who should I be talking to that I haven\u2019t met yet?',
      'What does a good next 90 days look like from your side?'
    ]
  },
  competitor: {
    label: 'Champion left for a competitor',
    step: 'The champion left for a competitor, so assume the competitor is already in the room. Your rebuild is not about the product anymore. It is about the value the account already has, in numbers the successor can\u2019t argue with.',
    message: 'Hi [name], I know [champion] has moved on, and I want to be straight with you: the value your team already gets from [product] is documented, and I can show it to you in your own numbers. Twenty minutes, no pitch. If the numbers don\u2019t hold up, I will tell you that myself.',
    questions: [
      'What has the competitor shown you that we haven\u2019t?',
      'What would you need to see from us to keep the conversation open?',
      'Is the decision about the product, or about the relationship?',
      'What does [product] do for your team that you would miss if it were gone?',
      'Who else is in the room on this decision, and what do they care about?'
    ]
  },
  'renewal-90': {
    label: 'Champion left and the renewal is within 90 days',
    step: 'The renewal is within 90 days, so the rebuild has a deadline. Work backward from the renewal date: the successor needs one win before the conversation, and the win needs to happen in the first 30 days.',
    message: 'Hi [name], your renewal is coming up, and I would rather talk to you now than surprise you later. Can we take 20 minutes this week? I will bring what [product] has delivered so far, and we can decide together what the next term should look like.',
    questions: [
      'What does the renewal need to look like for you to sign it?',
      'Who else has to say yes, and what do they need to hear?',
      'What is the one result from this term you would want to see again next term?',
      'If budget is the issue, what would you cut first, and what would you protect?',
      'What would have to be true in 30 days for this renewal to be easy?'
    ]
  }
};

var VERDICT_WORDS = { good: 'Rebuildable, move now', warn: 'Rebuildable, but thin', bad: 'Too late to rebuild, protect the exit' };

/* answers: {second:0|1|2, successor:0|1|2, ...} — missing keys count as unanswered.
   flags: {'only-30':bool, 'competitor-in':bool, 'no-meeting':bool}
   situationKey: one of the SITUATIONS keys, or null. */
function scoreChampion(answers, flags, situationKey) {
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
  var sit = (situationKey && SITUATIONS[situationKey]) ? SITUATIONS[situationKey] : null;
  var verdict, body;
  if (hitFlags.length > 0) {
    verdict = 'bad';
    body = 'A red flag overrides the score. Whatever the score says, the rebuild is over. The job now is the exit: one honest conversation, a written record of what happened, and a door left open.';
  } else if (answered < CRITERIA.length) {
    verdict = 'idle';
    body = 'Score the remaining criteria to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'Rebuildable. You have a second relationship, a named successor, documented value, and a known renewal. Move in the first week. The successor\u2019s first impression of you is the rebuild.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'Rebuildable, but thin. The rebuild works, but it has a hole in it. Fix the lowest-scored criteria first, then run the plan. A thin rebuild that moves fast beats a perfect rebuild that starts late.';
  } else {
    verdict = 'bad';
    body = 'Too late to rebuild. The account has no second relationship, no successor, no documented value, or no known renewal, and the first week is already gone. Protect the exit: salvage the relationship, document what happened, and keep the door open.';
  }
  var plan = verdict === 'idle' ? [] : (sit ? [sit.step] : []).concat(PLANS[verdict]);
  return {
    pct: pct, answered: answered, total: CRITERIA.length,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; }),
    plan: plan, situation: sit
  };
}

/* Lines for the AI prompt: the situation first, then the diagnostic scores. */
function promptLinesFor(situationKey, answers) {
  var lines = [];
  var sit = (situationKey && SITUATIONS[situationKey]) ? SITUATIONS[situationKey] : null;
  lines.push({ label: 'Situation', value: sit ? sit.label : 'not selected' });
  CRITERIA.forEach(function (c) {
    var v = answers[c.key];
    lines.push({ label: c.label + ' (weight x' + c.weight + ')', value: (typeof v === 'number') ? v : 'not scored' });
  });
  return lines;
}

/* Full prompt text. buildPrompt is passed in so this stays testable in node:
   pass V2.buildPrompt (window.V2 in the browser, require('../tool-v2.js') in node).
   This tool talks to the successor, so messageTo is 'the successor' instead of
   the shared default 'the champion'. */
function buildChampionPrompt(buildPrompt, situationKey, answers, r) {
  return buildPrompt({
    tool: 'champion rebuild',
    frameworkKey: 'general',
    frameworkName: 'General',
    coach: 'post-sales coach',
    subject: 'rebuild',
    messageTo: 'the successor',
    linesHeader: 'My situation and scores:',
    lines: promptLinesFor(situationKey, answers),
    flags: r.flags,
    verdictWord: VERDICT_WORDS[r.verdict],
    pct: r.pct
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreChampion: scoreChampion, promptLinesFor: promptLinesFor, buildChampionPrompt: buildChampionPrompt, CRITERIA: CRITERIA, FLAGS: FLAGS, PLANS: PLANS, SPINE: SPINE, EXIT: EXIT, SITUATIONS: SITUATIONS, VERDICT_WORDS: VERDICT_WORDS };
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
  var msgboxEl = document.getElementById('msgbox');
  var msgtextEl = document.getElementById('msgtext');
  var qboxEl = document.getElementById('qbox');
  var qitemsEl = document.getElementById('qitems');
  var sitnoteEl = document.getElementById('sitnote');
  var promptboxEl = document.getElementById('promptbox');
  var prompttextEl = document.getElementById('prompttext');
  var copyBtn = document.getElementById('copyprompt');

  var TITLES = {
    idle: 'Score the four criteria above.',
    good: 'Rebuildable, move now.',
    warn: 'Rebuildable, but thin.',
    bad: 'Too late to rebuild, protect the exit.'
  };

  function readState() {
    var answers = {}, flags = {}, situation = null;
    var sitSel = document.querySelector('input[name="situation"]:checked');
    if (sitSel) situation = sitSel.value;
    CRITERIA.forEach(function (c) {
      var sel = document.querySelector('input[name="' + c.key + '"]:checked');
      if (sel) answers[c.key] = parseInt(sel.value, 10);
    });
    document.querySelectorAll('.flag input[type="checkbox"]').forEach(function (cb) {
      var label = cb.closest('.flag');
      flags[label.getAttribute('data-key')] = cb.checked;
      label.classList.toggle('on', cb.checked);
    });
    return { answers: answers, flags: flags, situation: situation };
  }

  function render() {
    var state = readState();
    var r = scoreChampion(state.answers, state.flags, state.situation);
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
    if (r.situation) {
      sitnoteEl.hidden = true;
      msgtextEl.textContent = r.situation.message;
      msgboxEl.hidden = false;
      qitemsEl.innerHTML = r.situation.questions.map(function (q) { return '<li>' + q + '</li>'; }).join('');
      qboxEl.hidden = false;
    } else {
      sitnoteEl.hidden = false;
      msgboxEl.hidden = true;
      qboxEl.hidden = true;
    }
    if (r.plan.length > 0 && r.situation) {
      planitemsEl.innerHTML = r.plan.map(function (s) { return '<li>' + s + '</li>'; }).join('');
      planEl.hidden = false;
    } else {
      planEl.hidden = true;
    }
    if (r.verdict !== 'idle' && r.situation) {
      prompttextEl.value = buildChampionPrompt(V2.buildPrompt, state.situation, state.answers, r);
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
