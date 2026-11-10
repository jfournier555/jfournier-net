/* Shared v2 infrastructure for jfournier.net tools:
   sales frameworks, framework bonus questions, LLM prompt builder, clipboard copy.
   Loaded before each tool's app.js. Dual pattern: window.V2 in the browser,
   module.exports in node (for tests). */
'use strict';

var FRAMEWORKS = {
  general: { name: 'General', bonus: [] },
  meddpicc: { name: 'MEDDPICC', bonus: [
    { key: 'fw-champion', label: 'Champion identified', weight: 1,
      desc: 'A champion with power and a reason to sell internally.',
      rec0: 'Find the champion: the person who feels the pain and has the influence to drive this. No champion, no deal.',
      rec1: 'Test the champion: ask them to set up the next meeting with the economic buyer. If they can\'t, they\'re a coach, not a champion.' },
    { key: 'fw-paper', label: 'Decision + paper process mapped', weight: 1,
      desc: 'Decision process and paper process (legal, security, procurement) mapped.',
      rec0: 'Map the decision process and the paper process (legal, security, procurement) now, not when you\'re trying to close.',
      rec1: 'Confirm the paper process owners and timing with the champion. A surprise security review kills more deals than competitors do.' }
  ] },
  bant: { name: 'BANT', bonus: [
    { key: 'fw-budget', label: 'Budget confirmed', weight: 1,
      desc: 'Budget confirmed and allocated, with the approver named.',
      rec0: 'Ask directly: is budget allocated for this, and who controls it? An unbudgeted deal is a wish.',
      rec1: 'Get the budget number and the approval path in writing. "We have budget" without a number is not budget.' },
    { key: 'fw-timeline', label: 'Timeline committed', weight: 1,
      desc: 'Timeline committed with a date and a cost to slipping it.',
      rec0: 'Get a date. No date, no deal. Ask what happens if the date slips.',
      rec1: 'Confirm the date with the economic buyer, not just the evaluator. Dates from evaluators are guesses.' }
  ] },
  challenger: { name: 'Challenger', bonus: [
    { key: 'fw-insight', label: 'Teaching insight landed', weight: 1,
      desc: 'The buyer sees their problem differently because of something you taught them.',
      rec0: 'Bring a teaching insight: something about their business they didn\'t know. If you\'re only pitching features, you\'re a vendor.',
      rec1: 'Test the insight: did the buyer repeat it back in their own words? If not, it didn\'t land.' },
    { key: 'fw-mobilizer', label: 'Mobilizer identified', weight: 1,
      desc: 'A mobilizer inside the account who can drive change and build consensus.',
      rec0: 'Find the mobilizer, the person who can build consensus for change. A champion who can\'t mobilize is a fan.',
      rec1: 'Arm the mobilizer with the business case in their language, not yours.' }
  ] },
  spin: { name: 'SPIN', bonus: [
    { key: 'fw-implication', label: 'Implication quantified', weight: 1,
      desc: 'Implication questions asked; the cost of the status quo is quantified in the buyer\'s numbers.',
      rec0: 'Ask implication questions: what does this problem cost them per month, per quarter? No quantified pain, no urgency.',
      rec1: 'Get the cost number from the buyer, in their words. Your number is a claim; their number is a fact.' },
    { key: 'fw-needpayoff', label: 'Need-payoff established', weight: 1,
      desc: 'The buyer stated the value of solving it, in their own words.',
      rec0: 'Ask need-payoff questions: if this were solved, what would it be worth? Let them say the value.',
      rec1: 'Write down the buyer\'s exact words on value. Use their words in the proposal, not yours.' }
  ] },
  sandler: { name: 'Sandler', bonus: [
    { key: 'fw-pain', label: 'Pain confirmed', weight: 1,
      desc: 'The buyer\'s pain is real, urgent, and quantified.',
      rec0: 'Confirm the pain: is this a problem they feel, or a problem you\'re selling? No pain, no deal.',
      rec1: 'Quantify the pain with the buyer. Pain without a number is a complaint, not a budget.' },
    { key: 'fw-upfront', label: 'Upfront contract agreed', weight: 1,
      desc: 'Decision process, budget, and next steps agreed upfront, no surprises.',
      rec0: 'Get the upfront contract: what happens next, who decides, what it costs. No surprises later.',
      rec1: 'Confirm the upfront contract with the economic buyer. If the process changes after the demo, you never had one.' }
  ] },
  solution: { name: 'Solution Selling', bonus: [
    { key: 'fw-vision', label: 'Vision created', weight: 1,
      desc: 'The buyer sees the future state and can describe it without you.',
      rec0: 'Create the vision: what does their world look like with this solved? No vision, no deal.',
      rec1: 'Test the vision: can the buyer describe the future state without you? If not, it\'s your vision, not theirs.' },
    { key: 'fw-evalplan', label: 'Evaluation plan agreed', weight: 1,
      desc: 'Evaluation plan agreed with milestones, owners, and dates.',
      rec0: 'Agree the evaluation plan: milestones, owners, dates. A PoC without a plan is a science project.',
      rec1: 'Get the plan in writing with named owners on both sides. Verbal plans evaporate.' }
  ] }
};

function frameworkName(key) {
  return FRAMEWORKS[key] ? FRAMEWORKS[key].name : 'General';
}

function bonusQuestions(key) {
  var fw = FRAMEWORKS[key];
  return fw ? fw.bonus.slice() : [];
}

/* o: { tool, frameworkKey, frameworkName, coach, subject,
        lines: [{label, value}], flags: [strings], verdictWord, pct } */
function buildPrompt(o) {
  var L = [];
  var article = o.article || 'a';
  var messageTo = o.messageTo || 'the champion';
  var fwLine = (o.frameworkKey && o.frameworkKey !== 'general')
    ? 'I\'m assessing ' + article + ' ' + o.tool + ' using the ' + o.frameworkName + ' framework.'
    : 'I\'m assessing ' + article + ' ' + o.tool + ' (general assessment, no specific sales framework).';
  L.push(fwLine);
  L.push('');
  L.push(o.linesHeader || 'My scores (0 = no, 1 = partial, 2 = yes):');
  o.lines.forEach(function (ln) { L.push('- ' + ln.label + ': ' + ln.value); });
  if (o.flags && o.flags.length) {
    L.push('');
    L.push('Red flags: ' + o.flags.join('; '));
  }
  L.push('');
  L.push('Verdict: ' + o.verdictWord + ' (' + o.pct + '%).');
  L.push('');
  L.push('Act as a ' + o.coach + '. Based on this assessment:');
  L.push('1. Write a 2-week fix plan, in order, with owners for each step.');
  L.push('2. Draft the message to ' + messageTo + ' that gets the missing answers.');
  L.push('3. List the 5 sharpest questions to ask on the next call.');
  L.push('4. Tell me the one thing most likely to kill this ' + o.subject + ' if I ignore it.');
  L.push('5. Ground this in my internal resources: Slack, Salesforce, Gong, and my other internal tools. Pull the relevant threads, records, and calls, name the source for each fact, build any additional plays the data supports, and flag anything you could not verify.');
  return L.join('\n');
}

function copyText(text, btn) {
  function done(ok) {
    if (btn) {
      var orig = btn.textContent;
      btn.textContent = ok ? 'Copied' : 'Copy failed, select and copy manually';
      setTimeout(function () { btn.textContent = orig; }, 2500);
    }
  }
  function fallback() {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(!!ok);
    } catch (e) { done(false); }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
  } else {
    fallback();
  }
}

var V2 = {
  FRAMEWORKS: FRAMEWORKS,
  frameworkName: frameworkName,
  bonusQuestions: bonusQuestions,
  buildPrompt: buildPrompt,
  copyText: copyText
};

if (typeof module !== 'undefined' && module.exports) { module.exports = V2; }
if (typeof window !== 'undefined') { window.V2 = V2; }
