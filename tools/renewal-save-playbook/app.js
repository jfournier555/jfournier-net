/* Renewal Save Playbook — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Diagnostic weights: real reason x3, everything else x2. Max weighted score 18.
   The plan is a 30-day spine; the selected situation prepends its own first step. */
'use strict';

var SITUATIONS = {
  champion: {
    label: 'Champion left',
    desc: 'The person who bought it, used it, and defended it is gone.',
    planStep: 'First: the champion is gone, so the account has no memory of why it bought you. Your first job is not the renewal, it is finding the person who feels the pain now and making them the new champion. Everything else waits.',
    message: 'Hi [Name], [Champion] has moved on, and I want to make sure the handover is clean on our side. You were close to the rollout, so I would like 30 minutes this week to hear how the team is using us now and what you need going forward. No agenda beyond that.',
    questions: [
      'Who feels the pain now that [Champion] is gone, and who can drive a decision?',
      'What did [Champion] use the product for that nobody else does?',
      'Who else in the account knows what this costs if it goes away?',
      'What would the team lose in the first week without it?',
      'Who should I be talking to that I am not?'
    ]
  },
  usage: {
    label: 'Usage dropped',
    desc: 'Seats are paid for. Nobody is in the product.',
    planStep: 'First: usage dropped is a value problem wearing an adoption costume. Before you talk renewal, find the three users who stopped and ask them what broke. The answer is your save plan.',
    message: 'Hi [Name], I noticed usage has dropped on your account, and I would rather ask than assume. Can we get 30 minutes this week? I want to hear what is getting in the way for your team, and whether the product is still doing the job you bought it for.',
    questions: [
      'Which three users stopped, and what broke for them?',
      'What were they doing in the product before they stopped?',
      'What did they go back to doing instead?',
      'Who on the team still uses it every day, and why?',
      'What would have to change for the team to come back?'
    ]
  },
  sponsor: {
    label: 'Sponsor gone silent',
    desc: 'The executive who signed it stopped answering.',
    planStep: 'First: a silent sponsor is not a busy sponsor, it is a sponsor who stopped believing. Do not email them the renewal. Get thirty minutes, bring their numbers, and ask what changed. Silence has a reason; find it.',
    message: 'Hi [Name], it has been a while since we talked, and your renewal is coming up. I would like 30 minutes to hear where things stand on your side, in your words, before we get anywhere near the paperwork. What is the honest read?',
    questions: [
      'What is the honest read on where this stands with you?',
      'What changed since you signed: the product, the team, or the priorities?',
      'Who else in the building cares whether this renews?',
      'What would you need to see to defend this renewal internally?',
      'If this did not renew, what breaks first?'
    ]
  },
  budget: {
    label: 'Budget cut',
    desc: 'The renewal number is under review, or already cut.',
    planStep: 'First: a budget cut is a value question, not a price question. Before you offer a discount, prove the number in their math. A discount without a value case teaches the customer to cut you every year.',
    message: 'Hi [Name], I know the budget is under review, and I do not want to guess at the number. Can we get 30 minutes? I will bring what the product has actually delivered for your team, in your numbers, and we can talk about what the renewal should look like from there.',
    questions: [
      'Is the budget cut, or is the value unproven?',
      'What number are you working with, and who set it?',
      'What has the product delivered this year, in your numbers?',
      'What happens to the team if this goes away?',
      'What would the renewal have to look like for you to sign it as-is?'
    ]
  },
  competitor: {
    label: 'Competitor in the account',
    desc: 'Another vendor is in the room, running an evaluation.',
    planStep: 'First: the competitor is in the room because someone inside let them in. Find out who, and why. Your save is not a feature comparison, it is the workflow the buyer lives in. Prove it against their data, not the competitor\u2019s deck.',
    message: 'Hi [Name], I know you are looking at [Competitor], and I would rather have the honest conversation than find out after the fact. Can we get 30 minutes? I want to hear what is driving the look, and I will show you what the product does for your team against your own data.',
    questions: [
      'Who brought the competitor in, and what are they promising?',
      'What is the competitor doing that we are not?',
      'What does the team actually live in every day, our workflow or theirs?',
      'What would it cost the team to switch, in time, not money?',
      'If the competitor disappeared tomorrow, what would you miss about us?'
    ]
  }
};

var CRITERIA = [
  { key: 'reason', label: 'Real reason known', weight: 3,
    rec0: 'Stop. Do not write the save plan. Call the most honest person in the account and ask what changed. The stated reason is almost never the real one.',
    rec1: 'You have a hypothesis, not a fact. Get one person inside to confirm it in their own words before you build anything on it.' },
  { key: 'second', label: 'Second relationship', weight: 2,
    rec0: 'Map the account today: who else uses it, who else feels the pain, who else signs. A single-threaded account has no champion, it has a point of failure.',
    rec1: 'You have a second name, not a second relationship. Get them in a room, on a call, on a problem they care about. A name in the CRM is not a relationship.' },
  { key: 'value', label: 'Value demonstrated', weight: 2,
    rec0: 'Pull their numbers: time saved, tickets avoided, revenue touched. If you cannot show it in their math, you do not have a value case, you have a pitch.',
    rec1: 'You have the numbers, but they are yours, not theirs. Get the customer to say the value in their own words. Their number is a fact; your number is a claim.' },
  { key: 'decision', label: 'Decision process mapped', weight: 2,
    rec0: 'Ask directly: who signs, by when, and what happens if the date slips. No date, no save.',
    rec1: 'You know who signs but not the process around them. Map legal, security, and procurement now, not the week the renewal is due.' }
];

var FLAGS = {
  noRealReason: 'No one inside will tell you the real reason',
  onlyRelationshipLeft: 'The only relationship was the person who left',
  signedCompetitor: 'The customer has already signed with the competitor'
};

var PLANS = {
  good: [
    'Days 1–3: diagnose. Confirm the real reason with one honest person inside, in their words. Write it down.',
    'Week 1: rebuild the relationship map. Two new conversations with people who feel the pain, not just the people who sign.',
    'Week 2: prove the value in their numbers. One page, their math, their words.',
    'Weeks 3–4: the commercial conversation. Renewal terms first, discount last. A discount without a value case is a price cut, not a save.'
  ],
  warn: [
    'Do not start the save yet. Fix the lowest-scored diagnostic first, in the order listed above.',
    'The most important fix is the real reason. Everything else is a plan built on a guess.',
    'Rebuild one relationship before you touch the commercial conversation.',
    'Re-score. If you are still under 80%, keep diagnosing.'
  ],
  bad: [
    'Do not run a save plan on this account. Call it what it is: a churn.',
    'Have the honest conversation: ask what would have changed the outcome, and write it down.',
    'Protect the rest of the book. Check the same risk signals on your other accounts before they become saves.',
    'Re-score only if something real changes: a new relationship, a new reason, a new number.'
  ]
};

var VERDICT_WORDS = { good: 'Saveable, move now', warn: 'Saveable, but thin', bad: 'This is a churn, not a save' };

/* answers: {reason:0|1|2, second:0|1|2, value:0|1|2, decision:0|1|2} — missing keys count as unanswered.
   flags: {noRealReason:bool, onlyRelationshipLeft:bool, signedCompetitor:bool}
   situation: one of the SITUATIONS keys, or null/undefined. */
function scoreSave(answers, flags, situation) {
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
    body = 'This is a churn, not a save. A red flag overrides the score. No one will tell you the real reason, the only relationship walked out the door, or the customer already signed with the competitor. You cannot save an account that has already left.';
  } else if (answered < CRITERIA.length) {
    verdict = 'idle';
    body = 'Score the remaining questions to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'Saveable. You know the real reason, you have more than one relationship, the value is in their numbers, and the decision process is mapped. Move now. The save is a plan, not a hope.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'Saveable, but thin. Something in the diagnosis is missing, and the missing piece is the one that will kill the save. Fix the lowest-scored question first, then move.';
  } else {
    verdict = 'bad';
    body = 'This is a churn, not a save. The fundamentals are not there: you do not know the real reason, you have one thread, or the value was never demonstrated. Running a save plan on this account is a discount conversation in disguise.';
  }
  var plan = [];
  if (verdict !== 'idle') {
    plan = PLANS[verdict].slice();
    if (situation && SITUATIONS[situation]) plan.unshift(SITUATIONS[situation].planStep);
  }
  return {
    pct: pct, answered: answered, total: CRITERIA.length,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; }),
    plan: plan
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreSave: scoreSave, SITUATIONS: SITUATIONS, CRITERIA: CRITERIA, FLAGS: FLAGS, PLANS: PLANS };
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
  var messageEl = document.getElementById('message');
  var messagetextEl = document.getElementById('messagetext');
  var questionsEl = document.getElementById('questions');
  var questionitemsEl = document.getElementById('questionitems');
  var promptboxEl = document.getElementById('promptbox');
  var prompttextEl = document.getElementById('prompttext');
  var copyBtn = document.getElementById('copyprompt');

  var TITLES = {
    idle: 'Diagnose first.',
    good: 'Saveable, move now.',
    warn: 'Saveable, but thin.',
    bad: 'This is a churn, not a save.'
  };

  function readState() {
    var answers = {}, flags = {}, situation = null;
    CRITERIA.forEach(function (c) {
      var sel = document.querySelector('input[name="' + c.key + '"]:checked');
      if (sel) answers[c.key] = parseInt(sel.value, 10);
    });
    document.querySelectorAll('.flag input[type="checkbox"]').forEach(function (cb) {
      var label = cb.closest('.flag');
      flags[label.getAttribute('data-key')] = cb.checked;
      label.classList.toggle('on', cb.checked);
    });
    var sit = document.querySelector('input[name="situation"]:checked');
    if (sit) situation = sit.value;
    return { answers: answers, flags: flags, situation: situation };
  }

  function render() {
    var state = readState();
    var r = scoreSave(state.answers, state.flags, state.situation);
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
      var sit = state.situation && SITUATIONS[state.situation];
      if (sit) {
        messagetextEl.textContent = sit.message;
        questionitemsEl.innerHTML = sit.questions.map(function (q) { return '<li>' + q + '</li>'; }).join('');
      } else {
        messagetextEl.textContent = 'Pick a situation above to see the message for it.';
        questionitemsEl.innerHTML = '<li>Pick a situation above to see the five questions for it.</li>';
      }
      messageEl.hidden = false;
      questionsEl.hidden = false;
      var lines = [{
        label: 'Situation',
        value: sit ? sit.label + ': ' + sit.desc : 'not picked'
      }];
      CRITERIA.forEach(function (c) {
        var v = state.answers[c.key];
        lines.push({ label: c.label + ' (weight x' + c.weight + ')', value: (typeof v === 'number') ? v : 'not scored' });
      });
      prompttextEl.value = V2.buildPrompt({
        tool: 'renewal save',
        frameworkKey: 'general',
        frameworkName: 'General',
        coach: 'post-sales coach',
        subject: 'save',
        lines: lines,
        flags: r.flags,
        verdictWord: VERDICT_WORDS[r.verdict],
        pct: r.pct
      });
      promptboxEl.hidden = false;
    } else {
      messageEl.hidden = true;
      questionsEl.hidden = true;
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
