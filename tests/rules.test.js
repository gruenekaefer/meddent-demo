// Checks that the demo's rules match core/services.py in meddent-lms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allAnswered, canTakePost, caseValid, emptyProgress, isPassed, moduleState,
  nextStep, overallPercent, pdfAllowed, roundHalfEven, scoreQuiz,
} from '../assets/js/rules.js';

const { modules } = JSON.parse(readFileSync(new URL('../data/modules.json', import.meta.url)));
const bls = modules[0];

const finished = () => ({
  lessons: bls.lessons.map(l => l.id),
  materials: bls.materials.filter(m => m.required).map(m => m.id),
  caseResponse: 'Our team checked safety, called for help and the AED.',
  reflection: 'Dentistry knew the clinic layout.',
});
const pre = { stage: 'pre', score: 67, passed: false };
const fail = { stage: 'post', score: 67, passed: false };
const pass = { stage: 'post', score: 100, passed: true };

test('rounds halves to even, like Python', () => {
  assert.equal(roundHalfEven(2.5), 2);
  assert.equal(roundHalfEven(3.5), 4);
  assert.equal(roundHalfEven(0.5), 0);
  assert.equal(roundHalfEven(16.67), 17);
  assert.equal(roundHalfEven(83.33), 83);
});

test('a new module starts at zero and points to the pre-test', () => {
  const s = moduleState(bls);
  assert.equal(s.total, 2 + bls.lessons.length + 1 + 1);
  assert.equal(s.percent, 0);
  assert.equal(s.status, 'new');
  assert.equal(s.preDone, false);
  assert.equal(s.attemptsLeft, bls.maxAttempts);
  assert.equal(nextStep(bls, s).label, 'Take pre-test');
  assert.equal(canTakePost(s), false);
});

test('submitting the pre-test starts progress but does not unlock the post-test', () => {
  const s = moduleState(bls, emptyProgress(), [pre]);
  assert.equal(s.status, 'progress');
  assert.equal(s.percent, 17);
  assert.equal(nextStep(bls, s).label, 'Continue learning');
  assert.equal(canTakePost(s), false);
});

test('lessons, the required PDF and the case together unlock the post-test', () => {
  const s = moduleState(bls, finished(), [pre]);
  assert.equal(s.materialsDone, true);
  assert.equal(s.percent, 83);
  assert.equal(canTakePost(s), true);
  assert.equal(nextStep(bls, s).label, 'Take post-test');
});

test('the case needs both a response and a reflection', () => {
  const s = moduleState(bls, { ...finished(), reflection: '' }, [pre]);
  assert.equal(s.caseDone, false);
  assert.equal(s.materialsDone, false);
});

test('optional materials do not count towards progress', () => {
  const withOptional = { ...bls, materials: [...bls.materials, { id: 'extra', required: false }] };
  assert.equal(moduleState(withOptional).total, moduleState(bls).total);
});

test('two failed attempts close the post-test and open feedback', () => {
  const s = moduleState(bls, finished(), [pre, fail, fail]);
  assert.equal(s.attemptsLeft, 0);
  assert.equal(s.feedbackOpen, true);
  assert.equal(canTakePost(s), false);
  assert.equal(s.bestScore, 67);
});

test('an extra attempt from the instructor reopens the post-test', () => {
  const s = moduleState(bls, finished(), [pre, fail, fail], { extraAttempts: 1 });
  assert.equal(s.attemptsLeft, 1);
  assert.equal(s.feedbackOpen, false);
  assert.equal(canTakePost(s), true);
});

test('passing the post-test completes the module', () => {
  const s = moduleState(bls, finished(), [pre, pass]);
  assert.equal(s.status, 'completed');
  assert.equal(s.percent, 100);
  assert.equal(s.feedbackOpen, true);
  assert.equal(nextStep(bls, s).label, 'Review module');
});

test('scoring and the pass mark', () => {
  const q = bls.postTest;
  const right = Object.fromEntries(q.map(x => [x.id, x.correct]));
  const oneWrong = { ...right, [q[0].id]: q[0].options.find(o => o.id !== q[0].correct).id };
  assert.equal(scoreQuiz(q, right), 100);
  assert.equal(scoreQuiz(q, oneWrong), 67);
  assert.equal(isPassed('post', 67, 80), false);
  assert.equal(isPassed('post', 100, 80), true);
  assert.equal(isPassed('pre', 100, 80), false);
});

test('every question must have a valid answer', () => {
  const q = bls.preTest;
  assert.equal(allAnswered(q, {}), false);
  assert.equal(allAnswered(q, Object.fromEntries(q.map(x => [x.id, 'Z']))), false);
  assert.equal(allAnswered(q, Object.fromEntries(q.map(x => [x.id, x.correct]))), true);
});

test('case length limits match the real form', () => {
  assert.equal(caseValid('x'.repeat(29), 'y'.repeat(15)), false);
  assert.equal(caseValid('x'.repeat(30), 'y'.repeat(14)), false);
  assert.equal(caseValid('x'.repeat(30), 'y'.repeat(15)), true);
});

test('overall progress averages the modules', () => {
  assert.equal(overallPercent([{ percent: 44 }, { percent: 0 }]), 22);
  assert.equal(overallPercent([]), 0);
});

test('only PDFs up to 25 MB are accepted', () => {
  assert.equal(pdfAllowed('reading.pdf', 1000), true);
  assert.equal(pdfAllowed('reading.PDF', 25 * 1024 * 1024), true);
  assert.equal(pdfAllowed('reading.pdf', 25 * 1024 * 1024 + 1), false);
  assert.equal(pdfAllowed('reading.docx', 1000), false);
});

test('sample content is complete and consistent', () => {
  for (const m of modules) {
    for (const q of [...m.preTest, ...m.postTest]) {
      assert.ok(q.options.some(o => o.id === q.correct), `${m.slug} ${q.id} has a valid answer`);
      assert.match(q.stem, /^Sample question:/, `${m.slug} ${q.id} is labelled as a sample`);
    }
    assert.ok(m.materials.some(x => x.required), `${m.slug} has a required PDF`);
  }
});
