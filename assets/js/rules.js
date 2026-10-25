// Learning rules for the demo.
// Mirrors core/services.py and the quiz view in the private meddent-lms repository.
// When those rules change, update this file and tests/rules.test.js together.

// Python's round() rounds halves to the nearest even number. Match it so that
// percentages here equal the real site's.
export function roundHalfEven(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(x);
}

export function emptyProgress() {
  return { lessons: [], materials: [], caseResponse: '', reflection: '' };
}

// module: { lessons:[{id}], materials:[{id, required}], maxAttempts }
// progress: { lessons:[ids], materials:[ids], caseResponse, reflection }
// attempts: [{ stage:'pre'|'post', score, passed }] in submission order
export function moduleState(module, progress = emptyProgress(), attempts = [], { extraAttempts = 0, practical = 'pending' } = {}) {
  const pre = attempts.filter(a => a.stage === 'pre');
  const post = attempts.filter(a => a.stage === 'post');
  const lessonIds = module.lessons.map(l => l.id);
  const doneLessons = lessonIds.filter(id => progress.lessons.includes(id));
  const required = module.materials.filter(m => m.required);
  const doneMaterials = required.filter(m => progress.materials.includes(m.id)).map(m => m.id);
  const caseDone = Boolean(progress.caseResponse && progress.reflection);
  const materialsDone = doneLessons.length === lessonIds.length && doneMaterials.length === required.length && caseDone;
  const postPassed = post.some(a => a.passed);
  const total = 2 + lessonIds.length + required.length + 1;
  const completed = Number(pre.length > 0) + doneLessons.length + doneMaterials.length + Number(caseDone) + Number(postPassed);
  const percent = total ? roundHalfEven((100 * completed) / total) : 0;
  const maxAttempts = module.maxAttempts + extraAttempts;
  const status = postPassed && materialsDone && pre.length ? 'completed' : (attempts.length || completed ? 'progress' : 'new');
  const scores = post.map(a => a.score);
  return {
    pre: pre.length ? pre[pre.length - 1] : null,
    post,
    preDone: pre.length > 0,
    postPassed,
    materialsDone,
    doneLessons,
    doneMaterials,
    caseDone,
    percent,
    completed,
    total,
    status,
    bestScore: scores.length ? Math.max(...scores) : null,
    attemptsLeft: Math.max(0, maxAttempts - post.length),
    maxAttempts,
    feedbackOpen: postPassed || post.length >= maxAttempts,
    practical,
  };
}

export function nextStep(module, state) {
  if (!state.preDone) return { label: 'Take pre-test', path: `modules/${module.slug}/quiz/pre` };
  if (!state.materialsDone) return { label: 'Continue learning', path: `modules/${module.slug}?materials` };
  if (!state.postPassed) return { label: 'Take post-test', path: `modules/${module.slug}/quiz/post` };
  return { label: 'Review module', path: `modules/${module.slug}` };
}

export function allAnswered(questions, answers) {
  return questions.every(q => q.options.some(o => o.id === answers[q.id]));
}

export function scoreQuiz(questions, answers) {
  const correct = questions.filter(q => answers[q.id] === q.correct).length;
  return roundHalfEven((100 * correct) / questions.length);
}

export function isPassed(stage, score, passPercent) {
  return stage === 'post' && score >= passPercent;
}

export function canTakePost(state) {
  return state.preDone && state.materialsDone && !state.postPassed && state.attemptsLeft > 0;
}

// The real case form requires at least 30 characters of response and 15 of reflection.
export function caseValid(response, reflection) {
  return String(response).trim().length >= 30 && String(reflection).trim().length >= 15;
}

export function overallPercent(states) {
  return states.length ? roundHalfEven(states.reduce((sum, s) => sum + s.percent, 0) / states.length) : 0;
}

// The real site limits PDFs to 25 MB (MAX_PDF_BYTES).
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export function pdfAllowed(name, size) {
  return /\.pdf$/i.test(name) && size <= MAX_PDF_BYTES;
}
