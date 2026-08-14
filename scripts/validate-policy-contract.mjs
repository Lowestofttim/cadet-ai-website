// scripts/validate-policy-contract.mjs
//
// WHY THIS EXISTS (audit finding M-10)
//
// The Cadet AI privacy policy existed as FIVE hand-maintained copies across
// three repositories — this page, the legacy GitHub Pages policy site, the app
// repo's docs/PRIVACY_POLICY.md, the in-app Privacy Policy screen, and the Play
// Data safety form — with the obligation to keep them in step written down only
// as a sentence of prose in one README. Nothing checked it. Predictably, each
// surface drifted on its own: they disagreed about who the data controller is,
// about whether a parent can get an under-13 in, about how long a TANGO chat is
// kept, and about which company synthesises the voice.
//
// For an app whose users are children that is not an untidy-docs problem. It is
// two competing NORMATIVE privacy policies, either of which a cadet, a parent,
// the ICO or a Play reviewer could reasonably read as the one that binds us.
//
// The fix has two halves. The other half deletes the competing copy (the legacy
// site is now a redirect). THIS half pins the surviving canonical text to the
// controls that are actually DEPLOYED, so the page cannot quietly drift back
// into describing a system we do not run.
//
// The rule for editing this file: every assertion below must correspond to
// something implemented and evidenced in the repositories. If a control
// changes, change the control's assertion here in the same PR as the policy
// wording — that is the whole point. Do NOT relax an assertion to make a PR go
// green; the failure means the published policy and the product disagree, and
// which of the two is wrong is exactly the question that needs answering.
//
// Convention note: this collects every failure and prints them together
// (validate-links.mjs style) rather than stopping at the first assertion
// (validate-homepage.mjs style). A legal-text gate is much more useful when it
// tells you all seven things that contradict the product in one run.
//
// Deliberately dependency-free (node builtins only, no package.json, no
// network), like the rest of scripts/.
//
// Run:  node scripts/validate-policy-contract.mjs

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const POLICY = 'privacy.html';
const html = fs.readFileSync(path.join(root, POLICY), 'utf8');

const errors = [];

// ── Text extraction ────────────────────────────────────────────────────────
// Assertions run against the prose a READER sees, not the markup. Matching raw
// HTML would make every check hostage to a <strong> being moved, and would also
// let the JSON-LD block (which repeats marketing description text) satisfy an
// assertion that the visible policy does not. So: drop <script>/<style>
// contents, drop tags, decode the entities this site actually uses, and keep
// line structure so "same list item" checks stay meaningful.
const ENTITIES = new Map([
  ['&ldquo;', '"'],
  ['&rdquo;', '"'],
  ['&lsquo;', "'"],
  ['&rsquo;', "'"],
  ['&mdash;', '—'],
  ['&ndash;', '–'],
  ['&nbsp;', ' '],
  ['&middot;', '·'],
  ['&rarr;', '→'],
  ['&hellip;', '…'],
  ['&quot;', '"'],
  ['&apos;', "'"],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&amp;', '&'],
]);

function decode(value) {
  let out = value;
  for (const [entity, char] of ENTITIES) out = out.split(entity).join(char);
  return out.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

const visible = decode(
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    // Block-level boundaries become newlines so a regex cannot run across two
    // unrelated list items and "prove" a pairing that is not on the page.
    .replace(/<\/(?:p|li|h1|h2|h3|div|section|tr|td|th)>/gi, '\n')
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''),
)
  .replace(/[ \t ]+/g, ' ')
  .replace(/\n\s*\n+/g, '\n')
  .trim();

// ── Assertion helpers ──────────────────────────────────────────────────────
const must = (pattern, message) => {
  if (!pattern.test(visible)) errors.push(`MISSING — ${message}`);
};
const mustNot = (pattern, message) => {
  if (pattern.test(visible)) errors.push(`PRESENT — ${message}`);
};
const mustInMarkup = (pattern, message) => {
  if (!pattern.test(html)) errors.push(`MISSING — ${message}`);
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. Data controller
//    UK GDPR Art. 13 requires the controller's identity. The legacy copy named
//    the controller as "Cadet AI" — a product, not a legal person — so a reader
//    could not tell who actually holds their data or who to complain about.
// ═══════════════════════════════════════════════════════════════════════════
must(/MONKEYZOO LTD/, 'the data controller MONKEYZOO LTD is not named');
must(
  /(?:data controller[\s\S]{0,200}MONKEYZOO LTD)|(?:MONKEYZOO LTD[\s\S]{0,200}data controller)/i,
  'MONKEYZOO LTD is named but not identified as the data controller',
);
// Every "data controller" claim on the page must attribute itself. An
// unattributed one is how the legacy page came to name the wrong entity.
for (const match of visible.matchAll(/data controller/gi)) {
  const window = visible.slice(Math.max(0, match.index - 220), match.index + 220);
  if (!/MONKEYZOO LTD/.test(window)) {
    errors.push('UNATTRIBUTED — a "data controller" reference does not name MONKEYZOO LTD nearby');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Age gate — a HARD 13+ floor
//    The gate is server-enforced and there is no parental override. The legacy
//    copy said an under-13 should "have a parent or guardian help instead",
//    which describes a product we do not ship and would invite exactly the
//    signup the gate refuses.
// ═══════════════════════════════════════════════════════════════════════════
must(/aged 13 and over|13 and over|13\+/i, 'the 13+ audience is not stated');
must(
  /under-?13s? cannot create an account/i,
  'the policy does not state plainly that under-13s cannot create an account',
);
must(
  /even with (?:the )?permission (?:from|of) a parent or guardian/i,
  'the policy does not rule out a parental override of the 13+ gate',
);
mustNot(
  /have a parent or guardian help instead/i,
  'legacy wording inviting a parent to set up an under-13 account',
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. Date of birth is used for the age check and then DISCARDED
//    Implemented in user_profile_service.dart / verify_age_and_type: the DOB is
//    checked server-side and thrown away; only the yes/no result and the date
//    of the check survive. Claiming to store less than we do would be a lie in
//    our favour, so this asserts the disposal AND what is kept.
// ═══════════════════════════════════════════════════════════════════════════
must(
  /date of birth[\s\S]{0,240}(?:is not stored|is discarded|we discard|not kept)/i,
  'the policy does not say the date of birth is discarded after the age check',
);
must(
  /(?:yes\/no|age verified|"age verified")/i,
  'the policy does not say what is kept instead of the date of birth (the age-verified result)',
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. Adult (CFAV) accounts
//    The cadet/adult split is what keeps an under-18 and an adult off the same
//    leaderboard, so the policy must describe how an account becomes an adult
//    one -- and must describe the control that is ACTUALLY DEPLOYED.
//
//    FLIPPED 2026-08-14, when M-06 was applied to production. Before that date
//    the deployed control was a server-checked SELF-DECLARATION --
//    continue_as_adult() converted on a date of birth the caller supplied -- so
//    this block pinned that honest description and BANNED the stronger
//    "operator-verified" claim, to stop the policy getting ahead of the control.
//
//    M-06 is now live: continue_as_adult() requires an approved, unused record
//    in private.cfav_verifications and otherwise returns VERIFICATION_REQUIRED.
//    Verified by a live synthetic probe against production on 2026-08-14 -- a
//    fabricated adult date of birth left the account as `cadet`.
//
//    So the assertion is inverted rather than deleted. THE BAN WAS THE PROBLEM
//    AS MUCH AS THE WORDING: once the migration deployed, the cautious sentence
//    became the inaccurate one and the ban actively blocked its correction. A
//    contract pinned to a control's deployment state is only safe if it moves
//    WITH that state, in BOTH directions -- so the ban now points at the
//    superseded wording, and a future change that reverts M-06 has to move this
//    block back rather than quietly leaving a false policy published.
// ═══════════════════════════════════════════════════════════════════════════
must(/CFAV|Cadet Force Adult Volunteer/i, 'adult volunteer (CFAV) accounts are not described');
must(
  /\b18\b[\s\S]{0,200}(?:adult|CFAV)|(?:adult|CFAV)[\s\S]{0,200}\b18\b/i,
  'the policy does not state the 18+ boundary for adult (CFAV) accounts',
);
must(
  /\bwe approve it\b|\bwe check\b[\s\S]{0,120}\brecord that approval\b|operator-(?:verified|approved|checked)/i,
  'the policy does not say that becoming an adult (CFAV) account requires OUR approval -- ' +
    'M-06 is deployed, so a self-declared date of birth no longer converts an account and the ' +
    'policy must describe the approval step that actually gates it',
);
mustNot(
  /becomes an adult \(CFAV\) account when you confirm a date of birth|strengthening this into a checked approval step/i,
  'the policy still describes the SUPERSEDED self-declaration control -- M-06 was applied to ' +
    'production on 2026-08-14, so a caller-supplied date of birth no longer converts an account ' +
    'and this understates the child-safety control that is actually deployed',
);

// ═══════════════════════════════════════════════════════════════════════════
// 5. Retention — the periods the daily purge actually enforces
//    supabase/migrations/20260812103000_privacy_retention_purge.sql:
//      chat_messages           365 days
//      tango_answer_feedback   365 days  (holds a verbatim chat snapshot)
//      tango_content_reports   365 days  (holds a verbatim chat snapshot)
//      app_errors               90 days
//    …cleared by ONE daily job. The two snapshot tables are the interesting
//    part: they are duplicate copies of chat text, so a policy that promises a
//    365-day chat life while those sit unbounded is false. Naming them here is
//    what stops that regression.
// ═══════════════════════════════════════════════════════════════════════════
must(/TANGO chat history[^\n]{0,200}365 days/i, 'chat history is not stated as a 365-day retention');
must(
  /(?:rate|rating|feedback)[^\n]{0,240}365 days/i,
  'the copy of a question and answer kept with answer feedback is not stated as 365 days',
);
must(
  /report[^\n]{0,240}365 days/i,
  'the copy of a question and answer kept with a content report is not stated as 365 days',
);
must(
  /(?:diagnostic|crash report)[^\n]{0,240}90 days/i,
  'diagnostics / crash reports are not stated as a 90-day retention',
);
must(
  /(?:cleared|deleted|removed) automatically by a (?:job|task) that runs (?:once a day|every day|daily)/i,
  'the policy does not say the retention periods are enforced by a single daily purge',
);
// The pre-M-10 text promised only a vague "rolling 12 months" for chat and said
// nothing at all about the duplicate snapshots or diagnostics.
mustNot(
  /chat (?:history|conversation history) is kept in your account until you delete it/i,
  'legacy wording implying chat is kept indefinitely',
);

// ═══════════════════════════════════════════════════════════════════════════
// 6. Diagnostics are built from an ALLOWLIST
//    lib/services/error_reporter_service.dart builds each report from a fixed
//    error code, the platform, the app version, a fatal flag and a normalized
//    stack signature (frame function / package / line). The exception MESSAGE
//    is never transmitted — that is the property its tests pin, and it is the
//    only reason this telemetry is safe to run on a children's app at all.
// ═══════════════════════════════════════════════════════════════════════════
must(/diagnostic|crash report/i, 'the policy does not disclose diagnostics / crash reporting');
must(
  /does not send the error message/i,
  'the policy does not state that the error message text is never transmitted',
);
must(
  /(?:fixed list|allowlist|allow-list)/i,
  'the policy does not state that fault codes come from a fixed list',
);

// ═══════════════════════════════════════════════════════════════════════════
// 7. Processors / sub-processors
//    Required names are the ones evidenced in the repositories. The banned
//    names are the drift that has actually happened or would be unevidenced:
//    the legacy copy named "Google Cloud Text-to-Speech" as the voice provider,
//    which is not what runs. Provider-neutral wording is also required by
//    validate-homepage.mjs, so naming a voice vendor here breaks two gates.
// ═══════════════════════════════════════════════════════════════════════════
for (const provider of ['Supabase', 'OpenAI', 'Google Play']) {
  must(new RegExp(provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `processor ${provider} is not disclosed`);
}
must(/\bGoogle\b/, 'Google (sign-in / speech-to-text) is not disclosed');
must(/voice synthesis provider/i, 'the voice synthesis processor is not disclosed');
for (const banned of [
  'Google Cloud Text-to-Speech',
  'Fish Audio',
  'ElevenLabs',
  'Firebase',
  'Crashlytics',
  'Sentry',
  'Google Analytics',
  'Mixpanel',
  'Amplitude',
]) {
  mustNot(
    new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    `names "${banned}", which is not an evidenced processor for this product`,
  );
}
must(/no advertising SDKs and no third-party analytics/i, 'the no-ads / no-analytics statement is missing');
must(/(?:never sell|do not sell) (?:it|your data)/i, 'the "we never sell your data" statement is missing');

// ═══════════════════════════════════════════════════════════════════════════
// 8. Nickname is separate from the real name; boards are split by account type
// ═══════════════════════════════════════════════════════════════════════════
must(/nickname/i, 'the leaderboard nickname is not described');
must(/real name is (?:\*\*)?never(?:\*\*)? shown/i, 'the policy does not say the real name is never shown on a leaderboard');
must(/separated by account type/i, 'the policy does not say leaderboards are separated by account type');

// ═══════════════════════════════════════════════════════════════════════════
// 9. Deletion and export are available in-app and via the website
// ═══════════════════════════════════════════════════════════════════════════
must(/Delete my account/i, 'the in-app deletion route is not named');
must(/Download my data/i, 'the in-app export route is not named');
must(/export/i, 'the right to export / portability is not stated');
mustInMarkup(/href="delete-account\.html"/, 'the policy does not link to the website deletion page');
mustInMarkup(/mailto:support@cadetai\.co\.uk/, 'the policy does not expose the privacy contact address');

// ═══════════════════════════════════════════════════════════════════════════
// 10. Exactly ONE effective date
//     Two dates on a policy page is how a reader ends up unable to tell which
//     version binds. There must be one, and it must be the "Last updated" one.
// ═══════════════════════════════════════════════════════════════════════════
const DATE = /\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/g;
const dates = visible.match(DATE) ?? [];
if (dates.length !== 1) {
  errors.push(
    `EFFECTIVE DATE — expected exactly one effective date, found ${dates.length}` +
      (dates.length ? `: ${dates.join(', ')}` : ''),
  );
}
must(/Last updated: \d{1,2} \w+ \d{4}/, 'the effective date is not labelled "Last updated: <date>"');

// ═══════════════════════════════════════════════════════════════════════════
// 11. This page is the canonical policy
//     M-10 is only closed while every other surface points here.
// ═══════════════════════════════════════════════════════════════════════════
mustInMarkup(
  /<link\b[^>]*rel="canonical"[^>]*href="https:\/\/cadetai\.co\.uk\/privacy\.html"/,
  'privacy.html does not declare itself canonical at https://cadetai.co.uk/privacy.html',
);

// ── Report ─────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`Policy contract validation FAILED — ${errors.length} problem(s) in ${POLICY}:\n`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error(
    '\nThis page is the ONE canonical Cadet AI privacy policy (audit finding M-10).\n' +
      'Each item above is a place where the published policy and the deployed\n' +
      'product disagree. Fix the policy, or fix the product — do not weaken this check.',
  );
  process.exit(1);
}

console.log('Policy contract validation passed: privacy.html matches the deployed privacy controls');
