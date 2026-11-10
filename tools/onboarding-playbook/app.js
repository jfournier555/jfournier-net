/* Onboarding Time-to-Value Playbook — scoring logic.
   Pure functions at the top (testable in node); DOM wiring below.
   Diagnostic: first value x3, everything else x2. Max weighted score 18.
   No framework dropdown: this is not a sales motion. The playbook changes
   with the situation, not with a framework. */
'use strict';

var SITUATIONS = [
  { key: 'new', label: 'New customer, first rollout',
    step: "Start with the customer's words, not your deck. Ask what 'working' looks like for them, then build the first week around that one answer.",
    message: "Hi [Name], before we start, I want to get one thing straight: what does 'working' look like for your team? Name the one workflow that matters most, and what your team should be able to do with it by day 7. That answer sets our plan. Everything else waits behind it.",
    questions: [
      "What does 'working' look like for your team, in your words, not mine?",
      'Who on your side owns this rollout, and can they approve the next step?',
      "What's the one workflow your team needs first, and who uses it every day?",
      "What happens if we're not live by day 30, who feels it?",
      'What would make you say this was worth it at day 60?'
    ] },
  { key: 'newteam', label: 'New team on an existing account',
    step: "Find the new team's owner on day one. The account already works, the new team doesn't know that yet. Your job is one workflow in their hands, not a re-pitch of the platform.",
    message: "Hi [Name], your team is new to this, and I don't want to waste your time re-pitching what the account already has. Who on your team owns this rollout, and what's the one workflow you need working first? We'll get that one working, then build from there.",
    questions: [
      'What does your team need this to do that the current setup doesn\'t?',
      "Who owns the rollout for your team, and do they know they own it?",
      "What's the one workflow we should get working first for your people?",
      'What did the first team get wrong that we should avoid with yours?',
      "How will you know it's working, what are you going to see?"
    ] },
  { key: 'newcase', label: 'New use case on an existing account',
    step: "Treat it like a new sale with a warm customer. The use case needs its own first value, its own owner, and its own dates. The existing relationship doesn't cover for a missing one.",
    message: "Hi [Name], this use case is a new bet, so let's treat it like one. What's the one outcome that would make this worth it for your team, and who owns it on your side? I'll put dates to it once we agree on the outcome.",
    questions: [
      'What outcome makes this use case worth it, and how will we measure it?',
      'Who owns this use case on your side?',
      "What's the one workflow this has to do by day 30?",
      'What happens if we build it and nobody uses it?',
      'If this works, what comes next, is there a bigger use case behind it?'
    ] },
  { key: 'reonboard', label: 'Re-onboarding after a failed rollout',
    step: 'Name what failed, out loud, in the first meeting. The customer already knows. Pretending it didn\'t happen is what kills the second try. Honesty is what makes it possible.',
    message: "Hi [Name], I know the first rollout didn't land, and I don't want to pretend otherwise. Here's what I'd like to do: one short call where we name what went wrong, agree on the one workflow that has to work this time, and put dates to it. If we can't agree on that, I'll say so. I'd rather reset honestly than run the same play again.",
    questions: [
      'What went wrong the first time, in your words?',
      'What has to be different this time for you to trust it?',
      'Who owns the second try on your side?',
      "What's the one workflow that has to work for this to count?",
      'What would make you stop us, and would you tell us before you do?'
    ] },
  { key: 'sponsor', label: 'Executive sponsor changed during onboarding',
    step: "Get in front of the new sponsor in the first week. They didn't buy this, they inherited it. Your job is to show them the value in their words, not the old sponsor's.",
    message: "Hi [Name], I know you inherited this rollout rather than buying it, so let me earn the next 30 minutes, not assume them. Can we meet this week? I want to hear what success looks like for you, and show you the one workflow that's already working for your team.",
    questions: [
      'What does success look like for you, not for the person who bought this?',
      "What have you heard about the rollout so far, good and bad?",
      'Who do you trust inside the account to tell you how it\'s really going?',
      'What would you need to see by day 30 to keep funding this?',
      'If this stalls, who do you want to hear it from first, me, or someone else?'
    ] }
];

var CRITERIA = [
  { key: 'firstvalue', label: 'First value defined', weight: 3,
    rec0: "Stop and define it. Ask the customer: what does one working workflow look like for your team? Write down their exact words. No definition, no onboarding.",
    rec1: "Sharpen it: get the customer's words, not yours. 'Working' means they can name the workflow and the person who uses it." },
  { key: 'owner', label: 'Named owner on the customer side', weight: 2,
    rec0: 'Find the owner. No named owner, no onboarding, you are pushing a rope. Ask who owns the outcome, not who attends the meetings.',
    rec1: "Confirm the owner can approve the next step, not just show up. An owner who can't decide is a spectator." },
  { key: 'plan', label: '30/60-day plan agreed, with dates', weight: 2,
    rec0: 'Write the plan down with dates and get both sides to agree to it. An onboarding without dates is a hope.',
    rec1: 'Get the dates confirmed by the customer owner, in writing. Dates you set alone are guesses.' },
  { key: 'usage', label: 'Usage measured, not just "training complete"', weight: 2,
    rec0: 'Start measuring usage now: who ran the workflow, how often, what came out of it. Training complete is an attendance sheet, not value.',
    rec1: "Tie the usage to the workflow, not the platform. Logins don't count. A completed workflow does." }
];

var FLAGS = {
  noOwner: 'No named owner on the customer side',
  trainingOnly: '"Training complete" is the only success measure',
  sponsorGone: "The sponsor hasn't been in a meeting since the sale"
};

var PLAN_SPINE = [
  'Days 1-7, first value: get one workflow working in the customer\'s hands. Not the whole platform. One workflow, one user, one result they can point at.',
  'Days 8-30, adoption: add the second workflow and document the first win. Get the customer to say what it did for them, in their own words.',
  'Days 31-60, expansion-ready: value demonstrated, growth identified. The renewal case is now a fact, not a pitch, and the expansion conversation has a reason to exist.'
];

var VERDICT_WORDS = { good: 'On track to first value', warn: 'On track, but thin', bad: 'Stalled, reset the onboarding' };

function situationByKey(key) {
  var found = null;
  SITUATIONS.forEach(function (s) { if (s.key === key) found = s; });
  return found;
}

/* answers: {firstvalue:0|1|2, owner:0|1|2, plan:0|1|2, usage:0|1|2} — missing keys count as unanswered.
   flags: {noOwner:bool, trainingOnly:bool, sponsorGone:bool}
   situationKey: one of SITUATIONS keys, or null/undefined when not picked. */
function scoreOnboarding(answers, flags, situationKey) {
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
  var situation = situationByKey(situationKey);
  var verdict, body;
  if (hitFlags.length > 0) {
    verdict = 'bad';
    body = 'Stalled, reset the onboarding. A red flag overrides the score. Fix the flag first: name the owner, measure usage instead of training, or get the sponsor back in the room.';
  } else if (answered < CRITERIA.length) {
    verdict = 'idle';
    body = 'Score the remaining criteria to get a verdict.';
  } else if (pct >= 80) {
    verdict = 'good';
    body = 'On track to first value. First value is defined, someone owns it, the plan has dates, and usage is being measured. Keep the sequence tight and do not let the second workflow slip.';
  } else if (pct >= 50) {
    verdict = 'warn';
    body = 'On track, but thin. The onboarding is moving, but one of the four legs is weak, and thin is how onboardings stall quietly. Fix the lowest-scored criterion first, then run the sequence.';
  } else {
    verdict = 'bad';
    body = 'Stalled, reset the onboarding. The fundamentals are not there: no defined first value, no owner, no agreed plan, or no usage being measured. A reset is not a failure, it is the honest move. Redefine first value, name the owner, agree the dates, and start the sequence again.';
  }
  return {
    pct: pct, answered: answered, total: CRITERIA.length,
    verdict: verdict, body: body,
    fixes: fixes, flags: hitFlags.map(function (k) { return FLAGS[k]; }),
    situation: situation,
    plan: (verdict === 'idle' || !situation) ? [] : [situation.step].concat(PLAN_SPINE)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreOnboarding: scoreOnboarding, SITUATIONS: SITUATIONS, CRITERIA: CRITERIA, FLAGS: FLAGS, PLAN_SPINE: PLAN_SPINE, situationByKey: situationByKey };
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
  var sithintEl = document.getElementById('sithint');
  var promptboxEl = document.getElementById('promptbox');
  var prompttextEl = document.getElementById('prompttext');
  var copyBtn = document.getElementById('copyprompt');

  function readState() {
    var answers = {}, flags = {}, situation = null;
    var sit = document.querySelector('input[name="situation"]:checked');
    if (sit) situation = sit.value;
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
    var r = scoreOnboarding(state.answers, state.flags, state.situation);
    verdictEl.className = 'verdict ' + r.verdict;
    scoreEl.textContent = r.answered === 0 && r.flags.length === 0 ? '—' : r.pct + '%';
    titleEl.textContent = r.verdict === 'idle'
      ? (r.situation ? 'Score the four criteria above.' : 'Pick a situation, then score the four criteria.')
      : VERDICT_WORDS[r.verdict] + '.';
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
    if (r.situation) {
      msgtextEl.textContent = r.situation.message;
      msgboxEl.hidden = false;
      qitemsEl.innerHTML = r.situation.questions.map(function (q) { return '<li>' + q + '</li>'; }).join('');
      qboxEl.hidden = false;
      sithintEl.hidden = true;
    } else {
      msgboxEl.hidden = true;
      qboxEl.hidden = true;
      sithintEl.hidden = false;
    }
    if (r.verdict !== 'idle' && r.situation) {
      var lines = [{ label: 'Situation', value: r.situation.label }];
      CRITERIA.forEach(function (c) {
        var v = state.answers[c.key];
        lines.push({ label: c.label + ' (weight x' + c.weight + ')', value: (typeof v === 'number') ? v : 'not scored' });
      });
      prompttextEl.value = V2.buildPrompt({
        tool: 'onboarding',
        article: 'an',
        frameworkKey: 'general',
        frameworkName: 'General',
        coach: 'post-sales coach',
        subject: 'onboarding',
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
