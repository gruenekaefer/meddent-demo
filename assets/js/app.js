// MED-DENT Emergencies: interactive demo.
// A static, single-page copy of the learning flow. All data is fictional, and
// all state stays in the visitor's browser.
import {
  allAnswered, canTakePost, caseValid, emptyProgress, isPassed, moduleState,
  nextStep, overallPercent, pdfAllowed, scoreQuiz,
} from './rules.js';
import { store, uploadedFiles } from './store.js';
import { formatDate, h, icon, newId, pad } from './util.js';
import { closeReader, openReader } from './reader.js';

const app = document.getElementById('app');
const data = { modules: [], cohort: [] };
const ME = 1; // The visitor is Participant 01.
let flash = null;

// ---------------------------------------------------------------- data access
const moduleBySlug = slug => data.modules.find(m => m.slug === slug);
const isStaff = () => store.get().role === 'instructor';

function materialsFor(module) {
  const uploads = (store.get().uploads[module.slug] || []).map(u => ({ ...u, required: false, upload: true }));
  return [...module.materials, ...uploads];
}

function recordFor(pid) {
  const r = store.get().instructor[pid] || {};
  return { active: r.active !== false, practical: r.practical || {}, notes: r.notes || {}, extra: r.extra || {} };
}

function progressFor(slug) {
  return { ...emptyProgress(), ...(store.get().progress[slug] || {}) };
}

function stateFor(module) {
  const rec = recordFor(ME);
  return moduleState(
    { ...module, materials: materialsFor(module) },
    progressFor(module.slug),
    store.get().attempts.filter(a => a.slug === module.slug),
    { extraAttempts: rec.extra[module.slug] || 0, practical: rec.practical[module.slug] || 'pending' },
  );
}

function participants() {
  const me = { id: ME, username: 'meddent01', name: 'Participant 01 (you)', faculty: 'Medicine', lastLogin: store.get().signedInAt || null };
  return [me, ...data.cohort];
}

// One participant's summary for a module, for the instructor views.
function summaryFor(pid, module) {
  const rec = recordFor(pid);
  if (pid === ME) {
    const s = stateFor(module);
    return { percent: s.percent, pre: s.pre ? s.pre.score : null, best: s.bestScore, attempts: s.post.length, maxAttempts: s.maxAttempts, practical: s.practical, passed: s.postPassed };
  }
  const v = data.cohort.find(p => p.id === pid).modules[module.slug];
  return {
    percent: v.percent, pre: v.pre, best: v.best, attempts: v.attempts,
    maxAttempts: module.maxAttempts + (rec.extra[module.slug] || 0),
    practical: rec.practical[module.slug] || v.practical,
    passed: v.best !== null && v.best >= module.passPercent,
  };
}

function addEvent(s, detail, action) {
  s.events.unshift({ detail, action, actor: s.role === 'instructor' ? 'instructor' : 'meddent01', at: new Date().toISOString() });
  s.events = s.events.slice(0, 20);
}

function updateRecord(s, pid, change) {
  const r = s.instructor[pid] || (s.instructor[pid] = {});
  r.practical ||= {}; r.notes ||= {}; r.extra ||= {};
  change(r);
}

// ---------------------------------------------------------------- navigation
function go(path) {
  const target = `#/${path}`;
  if (location.hash === target) render(); else location.hash = target;
}

function say(text, tone = 'success') { flash = { text, tone }; }

function showFormError(form, text) {
  form.querySelector('.form-error')?.remove();
  form.insertAdjacentHTML('afterbegin', `<div class="message error form-error" role="alert">${h(text)}</div>`);
  form.querySelector('.form-error').scrollIntoView({ block: 'center' });
}

const STATUS = { completed: 'Completed', progress: 'In progress', new: 'Not started' };
const PRACTICAL = { met: 'Standard met', practice: 'Further practice', pending: 'Not yet assessed' };
const STAGE = { pre: 'Pre-test', post: 'Post-test' };

// ---------------------------------------------------------------- layout
const banner = () => `<div class="demo-banner" role="note"><span><strong>Demo</strong> · Fictional data and sample content<span class="long"> · Not for clinical learning</span></span><button type="button" class="demo-reset" data-action="reset">Reset demo</button></div>`;

function shell(nav, content) {
  const staff = isStaff();
  const link = (key, path, ic, label, extra = '') => `<a class="${nav === key ? 'active' : ''}" href="#/${path}">${icon(ic)}${label}${extra}</a>`;
  const message = flash ? `<div class="messages" aria-live="polite"><div class="message ${h(flash.tone)}">${h(flash.text)}</div></div>` : '';
  flash = null;
  return `${banner()}<a class="skip" href="#main">Skip to content</a>
<aside class="sidebar" id="sidebar">
 <a class="brand" href="#/${staff ? 'instructor' : 'dashboard'}"><span class="brand-mark">M<span>+</span>D</span><span>MED-DENT<small>EMERGENCIES</small></span></a>
 <div class="sidebar-university">UNIVERSITAS AIRLANGGA<span>FK &amp; FKG Joint Class · Demo</span></div>
 <span class="nav-caption">LEARNING SPACE</span>
 <nav aria-label="Main navigation">
  ${link('dashboard', 'dashboard', 'grid', staff ? 'Preview modules' : 'Overview')}
  ${staff ? '' : link('modules', 'dashboard?modules', 'book', 'Learning modules', `<span class="nav-count">${data.modules.length}</span>`)}
  ${staff ? '' : link('results', 'results', 'chart', 'My progress')}
  ${staff ? `<span class="nav-caption">TEACHING SPACE</span>${link('instructor', 'instructor', 'sliders', 'Manage learning')}${link('participants', 'instructor/participants', 'users', 'Participants')}` : ''}
 </nav>
 <div class="sidebar-bottom"><div class="mini-plus">✦</div><strong>Learn together.<br>Respond together.</strong><p>Shared knowledge.<br>Better teamwork.</p><img class="unair-logo" src="assets/img/unair-seal.webp" alt="Universitas Airlangga"></div>
</aside>
<div class="workspace"><header class="topbar"><button type="button" class="mobile-menu icon-button" data-action="menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><span class="topbar-title">MED-DENT <span>/</span> ${staff ? 'Instructor demo' : 'Learning portal demo'}</span><div class="topbar-right"><button type="button" class="text-button switch-view" data-action="switch">${staff ? 'Participant view' : 'Instructor view'} ⇄</button><span class="cohort-badge">FK <span>+</span> FKG</span><span class="user-link"><span class="avatar">${staff ? 'I' : 'P'}</span><span>${staff ? 'Instructor' : 'Participant 01'}<small>${staff ? 'Demo instructor' : 'Medicine · demo'}</small></span></span><button type="button" class="icon-button" data-action="signout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div></header>
<main id="main" class="main" tabindex="-1">${message}${content}</main>
<footer class="footer"><span>MED-DENT Emergencies · Demonstration site</span><span>Fictional data · Sample content</span></footer></div>`;
}

function notFound() {
  return { nav: '', title: 'Not found', html: `<div class="panel"><h1 class="smaller">This page is not part of the demo.</h1><p class="muted">The link may be out of date.</p><a class="button" href="#/">Back to the start →</a></div>` };
}

// ---------------------------------------------------------------- sign-in
function signIn() {
  return {
    title: 'Welcome',
    full: `${banner()}<main class="login-shell"><section class="login-story"><span class="brand"><span class="brand-mark">M<span>+</span>D</span><span>MED-DENT<small>EMERGENCIES</small></span></span><div class="login-story-main"><span class="eyebrow light">FK &amp; FKG · UNIVERSITAS AIRLANGGA</span><h1>Two disciplines.<br><em>One response.</em></h1><p>A shared space to build the knowledge, confidence, and teamwork that emergencies demand.</p><div class="faculty-pills"><span>Faculty of Medicine</span><span>Faculty of Dental Medicine</span></div><div class="login-art" aria-hidden="true"><svg viewBox="0 0 520 130"><path d="M0 70H125L145 40 166 100 195 14 227 113 253 70H330L350 45 370 70H520" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="195" cy="14" r="6" fill="currentColor"/></svg></div></div><div class="login-story-footer"><img src="assets/img/unair-seal.webp" alt="Universitas Airlangga"><span>Demonstration site</span></div></section>
<section class="login-form-panel"><div class="login-form"><span class="eyebrow">INTERACTIVE DEMO</span><h2>Try the learning journey.</h2><p class="muted">No account needed. Choose a view to explore the portal with fictional data and sample content.</p>
<div class="role-buttons"><button type="button" class="button wide" data-action="enter" data-role="participant">Enter as a participant <span aria-hidden="true">↗</span></button><button type="button" class="button secondary wide" data-action="enter" data-role="instructor">Enter as the instructor <span aria-hidden="true">↗</span></button></div>
<div class="login-help">${icon('lock')}<div><strong>The real portal uses issued accounts.</strong><p>Participants receive a username and password from their instructor. This demo skips sign-in, and keeps your progress only in this browser.</p></div></div><div class="login-topics"><span>Basic Life Support</span><span>Maxillofacial Trauma</span><span>Dentoalveolar Trauma</span><span>Hypersensitivity Reactions</span><span>Paediatric Dental Trauma</span></div></div><p class="login-copyright">MED-DENT Emergencies · FK–FKG Joint Class · Demo</p></section></main>`,
  };
}

// ---------------------------------------------------------------- participant views
function dashboard(query) {
  const staff = isStaff();
  const cards = data.modules.map(m => ({ m, s: stateFor(m) }));
  const overall = overallPercent(cards.map(c => c.s));
  const complete = cards.filter(c => c.s.status === 'completed').length;
  const resumeCard = cards.find(c => c.s.status !== 'completed') || cards[0];
  const resume = nextStep(resumeCard.m, resumeCard.s);
  const cardHtml = cards.map(({ m, s }) => {
    const step = nextStep(m, s);
    return `<article class="module-card" data-status="${s.status}" data-title="${h(m.title.toLowerCase())}"><a class="card-visual ${m.order === 2 ? 'fractures' : ''}" href="#/modules/${m.slug}" tabindex="-1" aria-hidden="true"><span class="visual-caption">MODULE ${pad(m.order)} <span>FK + FKG</span></span><img src="assets/img/${h(m.visual)}.svg" alt=""><span class="visual-bottom">${h(m.tagline)}</span></a><div class="card-body"><div class="card-meta"><span class="pill ${s.status}">${STATUS[s.status]}</span><span class="duration">${icon('clock')}${m.onlineMinutes} min online</span></div><h3><a href="#/modules/${m.slug}">${h(m.title)}</a></h3><p>${h(m.summary)}</p><div class="card-tags"><span>${m.lessons.length} sample lessons</span><span>Joint case</span><span>Pre &amp; post-test</span></div><div class="progress-label"><span>Learning progress</span><strong>${s.percent}%</strong></div><div class="track" role="progressbar" aria-label="${h(m.title)} progress" aria-valuenow="${s.percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${s.percent}%"></i></div><a class="card-action" href="#/${step.path}">${staff ? 'Preview module' : step.label}<span>↗</span></a></div></article>`;
  }).join('');
  const html = `<div class="page-heading"><div><span class="eyebrow">${staff ? 'INSTRUCTOR PREVIEW' : 'YOUR LEARNING SPACE'}</span><h1>Ready for what comes next.</h1><p>${staff ? 'This is what participants see. Progress shown belongs to Participant 01, the demo participant.' : 'Welcome, Participant 01. Build your skills, one module at a time.'}</p></div><span class="outline-badge">JOINT CLASS <span>FK × FKG</span></span></div>
<section class="hero"><div class="hero-copy"><span class="eyebrow light">MEDICINE MEETS DENTISTRY</span><h2>Better prepared.<br><em>Stronger together.</em></h2><p>Learn the essentials. Share your perspective.<br>Practise a coordinated response to emergencies.</p><a class="button cream" href="#/${resume.path}">${overall ? 'Continue learning' : 'Explore your first module'}<span>↗</span></a></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><span class="orbit-dot"></span><div class="art-tile medical"><svg viewBox="0 0 100 100"><path d="M40 18h20v22h22v20H60v22H40V60H18V40h22Z" fill="none" stroke="currentColor" stroke-width="3"/></svg><small>MEDICINE</small></div><div class="art-tile dental"><svg viewBox="0 0 100 100"><path d="M50 23c-15-13-34-7-31 13 2 13 9 16 10 33 1 18 10 17 13 1 2-11 4-16 8-16s6 5 8 16c3 16 12 17 13-1 1-17 8-20 10-33 3-20-16-26-31-13Z" fill="none" stroke="currentColor" stroke-width="3"/></svg><small>DENTISTRY</small></div><div class="team-label"><span>✦</span> One shared purpose</div></div></section>
<div class="stats-strip"><div><span class="stat-icon">${icon('book')}</span><div><strong>${pad(data.modules.length)}</strong><span>Learning modules</span></div></div><div><span class="stat-icon">${icon('check')}</span><div><strong>${pad(complete)} <small>/ ${pad(data.modules.length)}</small></strong><span>Online modules completed</span></div></div><div><span class="stat-icon">${icon('chart')}</span><div><strong>${overall}<small>%</small></strong><span>${staff ? 'Participant 01 progress' : 'Your overall progress'}</span></div><div class="mini-track"><i style="width:${overall}%"></i></div></div></div>
<section id="modules"><div class="section-heading"><div><span class="eyebrow">LEARN · APPLY · REFLECT</span><h2>${staff ? 'Teaching modules' : 'Your learning modules'}</h2></div><label class="search-field">${icon('search')}<input type="search" id="module-search" placeholder="Find a module" aria-label="Find a module"></label></div><div class="filter-row" role="group" aria-label="Filter modules"><button type="button" class="filter active" data-filter="all" aria-pressed="true">All modules <span>${data.modules.length}</span></button><button type="button" class="filter" data-filter="progress" aria-pressed="false">In progress</button><button type="button" class="filter" data-filter="new" aria-pressed="false">Not started</button><button type="button" class="filter" data-filter="completed" aria-pressed="false">Completed</button></div><div class="module-grid">${cardHtml}</div><p id="no-modules" class="empty hidden">No modules match this filter.</p></section>
<section id="sessions" class="mt"><div class="section-heading"><div><span class="eyebrow">JOINT CLASS · SPEAKERS</span><h2>Programme topics</h2></div></div><div class="session-grid">
<article class="session-card"><div class="session-meta"><span class="host">FK UNAIR</span><span>MODULE 01</span></div><h3>Basic Life Support</h3><p><strong>Dr. Prananda Surya Airlangga, dr., Sp.An., KIC</strong>Faculty of Medicine, Universitas Airlangga</p></article>
<article class="session-card"><div class="session-meta"><span class="host">FK UNAIR</span><span>MODULE 02</span></div><h3>Interprofessional Management of Maxillofacial Trauma</h3><p><strong>Dr. dr. Indri Putri Lakshmi, Sp.BP-RE</strong>Faculty of Medicine, Universitas Airlangga</p></article>
<article class="session-card"><div class="session-meta"><span class="host">FKG UNAIR</span><span>LECTURE</span></div><h3>Management of Dentoalveolar Trauma</h3><p><strong>Dr. Andra Rizqiawan</strong>Faculty of Dental Medicine, Universitas Airlangga</p></article>
<article class="session-card"><div class="session-meta"><span class="host">FKG UNAIR</span><span>LECTURE</span></div><h3>Life-Threatening Hypersensitivity Reactions in Dentistry</h3><p><strong>Dr. Saka Winias</strong>Faculty of Dental Medicine, Universitas Airlangga</p></article>
<article class="session-card"><div class="session-meta"><span class="host">UiTM</span><span>HYBRID LECTURE</span></div><h3>Medical Emergencies and Maxillofacial Trauma</h3><p><strong>Dr. Azmeel Mazlee</strong>Faculty of Dentistry, Universiti Teknologi MARA</p></article>
<article class="session-card"><div class="session-meta"><span class="host">UiTM</span><span>HYBRID LECTURE</span></div><h3>Paediatric Dental Trauma and Special Needs-Related Emergencies</h3><p><strong>Associate Professor Dr. Ilham Wan Mokhtar</strong>Faculty of Dentistry, Universiti Teknologi MARA</p></article>
<article class="session-card"><div class="session-meta"><span class="host">RS UNAIR</span><span>PRACTICAL</span></div><h3>BLS Practice, Skill Stations and Team Simulation</h3><p><strong>Dr. Arinanda L., Sp.An-TI</strong>Universitas Airlangga Hospital</p></article>
</div></section>
<div class="learning-note">${icon('users')}<div><strong>Knowledge is the beginning. Teamwork puts it into practice.</strong><p>Complete your online learning, then join the facilitated session. Practical skills are assessed separately by your instructor.</p></div></div>`;
  return { nav: query === 'modules' ? 'modules' : 'dashboard', title: 'Overview', html, after: wireFilters };
}

function wireFilters(root) {
  let filter = 'all';
  const apply = () => {
    const term = (root.querySelector('#module-search')?.value || '').toLowerCase();
    let count = 0;
    root.querySelectorAll('.module-card').forEach(card => {
      const visible = (filter === 'all' || card.dataset.status === filter) && card.dataset.title.includes(term);
      card.classList.toggle('hidden', !visible);
      if (visible) count++;
    });
    root.querySelector('#no-modules')?.classList.toggle('hidden', count > 0);
  };
  root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    root.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    apply();
  }));
  root.querySelector('#module-search')?.addEventListener('input', apply);
}

function moduleView(slug) {
  const m = moduleBySlug(slug);
  if (!m) return notFound();
  const staff = isStaff();
  const s = stateFor(m);
  const unlocked = s.preDone || staff;
  const locked = '<span class="muted small-text">Locked</span>';
  const row = (done, ic, title, small, action) => `<div class="lesson-row"><span class="row-icon ${done ? 'checked' : ''}">${done ? '✓' : icon(ic)}</span><div><strong>${h(title)}</strong><small>${small}</small></div>${action}</div>`;
  const lessons = m.lessons.map((l, i) => {
    const done = s.doneLessons.includes(l.id);
    return row(done, 'book', l.title, `${l.minutes} min · Lesson ${i + 1}`, unlocked ? `<a class="row-link" href="#/modules/${slug}/lessons/${l.id}">${done ? 'Review' : 'Read'} ↗</a>` : locked);
  }).join('');
  const materials = materialsFor(m).map(mat => {
    const done = s.doneMaterials.includes(mat.id) || (mat.upload && progressFor(slug).materials.includes(mat.id));
    const small = mat.upload ? 'PDF · Optional · Demo upload in this tab' : `PDF · ${mat.required ? 'Required' : 'Optional'} · ${mat.pages} pages`;
    return row(done, 'file', mat.title, small, unlocked ? `<a class="row-link" href="#/modules/${slug}/materials/${mat.id}">Open ↗</a>` : locked);
  }).join('');
  const caseRow = row(s.caseDone, 'users', m.case.title, 'Joint case · Individual reflection', unlocked ? `<a class="row-link" href="#/modules/${slug}/case">${s.caseDone ? 'Review' : 'Begin'} ↗</a>` : locked);
  const preAction = staff ? `<a class="button small" href="#/modules/${slug}/quiz/pre">View questions →</a>` : `<a class="button small" href="#/modules/${slug}/quiz/pre">${s.preDone ? 'View result' : 'Take pre-test'} →</a>`;
  let postAction;
  if (staff) postAction = `<a class="button small" href="#/modules/${slug}/quiz/post">View questions →</a>`;
  else if (s.materialsDone && s.preDone) postAction = `<a class="button small" href="#/modules/${slug}/quiz/post">${s.postPassed || !s.attemptsLeft ? 'View result' : 'Take post-test'} →</a>`;
  else postAction = '<span class="disabled-button">Locked</span>';
  const html = `<a class="back-link" href="#/dashboard?modules">← All modules</a><div class="module-heading"><div><span class="eyebrow">MODULE ${pad(m.order)} · FK &amp; FKG</span><h1>${h(m.title)}</h1><p>${h(m.subtitle)}</p><div class="inline-meta"><span>${m.onlineMinutes} min online</span><span>${m.practicalMinutes} min facilitated</span><span>${m.lessons.length} sample lessons</span></div></div>${staff ? `<a class="button secondary" href="#/instructor/modules/${slug}">Manage module ↗</a>` : ''}</div>
<div class="notice">${staff ? 'Instructor preview. Locks are lifted for you, and progress shown belongs to Participant 01. ' : ''}Sample content written for this demo. It is not the course material.</div>
<div class="module-layout"><div>
<section class="panel intro-panel"><span class="eyebrow">WHY THIS MATTERS</span><h2>Learn with a shared purpose.</h2><p>${h(m.summary)}</p><details><summary>Learning objectives</summary><ol>${m.objectives.map(o => `<li>${h(o)}</li>`).join('')}</ol></details></section>
<section class="stage panel"><div class="stage-heading"><span class="step-number ${s.preDone ? 'done' : ''}">${s.preDone ? '✓' : '01'}</span><div><h2>Pre-test</h2><p>Start with what you know. No passing score required.</p></div><span class="pill ${s.preDone ? 'completed' : ''}">${s.preDone ? 'Submitted' : 'Available'}</span></div><div class="stage-footer"><span>${m.preTest.length} sample questions · Diagnostic assessment</span>${preAction}</div></section>
<section class="stage panel" id="materials"><div class="stage-heading"><span class="step-number ${s.materialsDone ? 'done' : ''}">${s.materialsDone ? '✓' : '02'}</span><div><h2>Learning materials</h2><p>${unlocked ? 'Read, discuss, and reflect at your own pace.' : 'Submit the pre-test to unlock this stage.'}</p></div></div>${lessons}${materials}${caseRow}</section>
<section class="stage panel"><div class="stage-heading"><span class="step-number ${s.postPassed ? 'done' : ''}">${s.postPassed ? '✓' : '03'}</span><div><h2>Post-test</h2><p>${s.materialsDone ? 'Bring your learning together.' : 'Complete the lessons, required PDF, and case to unlock.'}</p></div></div><div class="stage-footer"><span>${m.postTest.length} sample questions · ${m.passPercent}% to pass · ${s.maxAttempts} attempts</span>${postAction}</div></section>
</div><aside class="module-aside"><section class="panel progress-panel"><span class="eyebrow">${staff ? 'PARTICIPANT 01 PROGRESS' : 'YOUR PROGRESS'}</span><div class="progress-big">${s.percent}<span>%</span></div><div class="track"><i style="width:${s.percent}%"></i></div><p>${s.completed} of ${s.total} online steps complete</p><div class="divider"></div><div class="status-line"><span>Pre-test</span><strong>${s.preDone ? `${s.pre.score}%` : 'Not taken'}</strong></div><div class="status-line"><span>Best post-test</span><strong>${s.bestScore !== null ? `${s.bestScore}%` : 'Not taken'}</strong></div></section><section class="panel practice-panel">${icon('users')}<h3>Put learning into practice.</h3><p>${h(m.practical)}</p><span class="pill">${PRACTICAL[s.practical]}</span><p class="small-text">Your instructor records this outcome separately from online completion.</p></section></aside></div>`;
  return { nav: 'modules', title: m.title, html };
}

// Participants must submit the pre-test before opening materials.
function blockedBeforePre(m, s) {
  if (isStaff() || s.preDone) return false;
  say('Submit the pre-test to unlock this stage.', 'info');
  go(`modules/${m.slug}`);
  return true;
}

function lessonView(slug, id) {
  const m = moduleBySlug(slug);
  const lesson = m?.lessons.find(l => l.id === id);
  if (!lesson) return notFound();
  const s = stateFor(m);
  if (blockedBeforePre(m, s)) return null;
  const done = s.doneLessons.includes(id);
  const [lead, ...rest] = lesson.content;
  const action = isStaff()
    ? '<p class="muted">Participants mark each lesson as complete here.</p>'
    : `<form data-form="lesson" data-slug="${slug}" data-id="${id}"><button class="button">${done ? 'Completed · Return to module' : 'Mark lesson as complete'} ✓</button></form><p class="small-text muted">This records your acknowledgement of the lesson. Practical skills are assessed separately.</p>`;
  const html = `<a class="back-link" href="#/modules/${slug}?materials">← ${h(m.title)}</a><div class="reading-layout"><article class="panel reading"><span class="eyebrow">LEARNING MATERIAL · ${lesson.minutes} MIN</span><h1>${h(lesson.title)}</h1><div class="notice">Sample lesson text</div><p class="lead">${h(lead)}</p>${rest.map(p => `<p>${h(p)}</p>`).join('')}<div class="activity-box"><span class="eyebrow">PAUSE &amp; APPLY</span><h2>Your learning activity</h2><p>${h(lesson.activity)}</p></div><div class="divider"></div>${action}</article></div>`;
  return { nav: 'modules', title: lesson.title, html };
}

function caseView(slug) {
  const m = moduleBySlug(slug);
  if (!m) return notFound();
  const s = stateFor(m);
  if (blockedBeforePre(m, s)) return null;
  const p = progressFor(slug);
  const staff = isStaff();
  const disabled = staff ? 'disabled' : '';
  const html = `<a class="back-link" href="#/modules/${slug}?materials">← ${h(m.title)}</a><div class="reading-layout"><article class="panel reading"><span class="eyebrow">JOINT CASE · FK + FKG</span><h1>${h(m.case.title)}</h1><div class="scenario">${h(m.case.scenario)}</div><h2>Work through this together</h2><ol class="task-list">${m.case.tasks.map(t => `<li>${h(t)}</li>`).join('')}</ol><div class="notice">Use the fictional case for this response. Do not enter identifiable patient information. In this demo, your text stays in this browser.</div>${staff ? '<p class="muted">Participants write their team response and reflection here. The instructor reads them on each participant’s page.</p>' : ''}<form data-form="case" data-slug="${slug}" class="stack-form"><label for="response">Your team’s response</label><span class="field-help">Summarize the shared priorities and plan. At least 30 characters.</span><textarea name="response" id="response" rows="7" minlength="30" maxlength="12000" required ${disabled}>${h(p.caseResponse)}</textarea><label for="reflection">Your individual reflection</label><span class="field-help">What did the other profession contribute, and what will you do differently? At least 15 characters.</span><textarea name="reflection" id="reflection" rows="4" minlength="15" maxlength="4000" required ${disabled}>${h(p.reflection)}</textarea><button class="button" ${disabled}>Save response &amp; reflection ✓</button></form></article></div>`;
  return { nav: 'modules', title: m.case.title, html };
}

function quizView(slug, stage) {
  const m = moduleBySlug(slug);
  if (!m) return notFound();
  const questions = stage === 'pre' ? m.preTest : m.postTest;
  const back = `<a class="back-link" href="#/modules/${slug}">← ${h(m.title)}</a>`;
  if (isStaff()) {
    const key = questions.map((q, i) => `<section class="panel question"><p class="question-stem"><span class="question-number">${pad(i + 1)}</span>${h(q.stem)}</p>${q.options.map(o => `<div class="answer-option ${o.id === q.correct ? 'is-correct' : ''}"><span class="option-letter">${o.id}</span><span>${h(o.text)}${o.id === q.correct ? ' <strong>· Correct</strong>' : ''}</span></div>`).join('')}<p class="muted small-text">${h(q.rationale)}</p></section>`).join('');
    return { nav: 'modules', title: `${STAGE[stage]} questions`, html: `${back}<div class="reading-layout"><div class="quiz-title"><span class="eyebrow">${h(m.title)} · INSTRUCTOR VIEW</span><h1>${STAGE[stage]} question bank</h1><p>Sample questions with the answer key. In the real portal, answer keys are visible only to instructors.</p></div>${key}</div>` };
  }
  const s = stateFor(m);
  if (stage === 'pre' && s.preDone) { go(`attempts/${s.pre.id}`); return null; }
  if (stage === 'post') {
    if (!s.preDone || !s.materialsDone) { say('Complete the pre-test, lessons, required PDF, and joint case first.', 'info'); go(`modules/${slug}`); return null; }
    if (s.postPassed || s.attemptsLeft === 0) { go(`attempts/${s.post[s.post.length - 1].id}`); return null; }
  }
  const items = questions.map((q, i) => `<fieldset class="panel question"><legend><span class="question-number">${pad(i + 1)}</span>${h(q.stem)}</legend>${q.options.map(o => `<label class="answer-option"><input type="radio" name="${q.id}" value="${o.id}" required><span class="option-letter">${o.id}</span><span>${h(o.text)}</span></label>`).join('')}</fieldset>`).join('');
  const sub = stage === 'pre' ? 'Pre-test · A diagnostic check. Submit to unlock your materials.' : `Post-test · ${m.passPercent}% to pass. ${s.attemptsLeft} attempt${s.attemptsLeft === 1 ? '' : 's'} remaining.`;
  const html = `${back}<div class="reading-layout"><div class="quiz-title"><span class="eyebrow">${h(m.title)}</span><h1>${stage === 'pre' ? 'Start with what you know.' : 'Bring your learning together.'}</h1><p>${sub}</p></div><form data-form="quiz" data-slug="${slug}" data-stage="${stage}" id="quiz-form">${items}<div class="quiz-submit"><p class="muted">Select one answer per question. Your answers are saved in this browser when you submit.</p><button class="button">Submit ${stage === 'pre' ? 'pre-test' : 'post-test'} →</button></div></form></div>`;
  return { nav: 'modules', title: STAGE[stage], html };
}

function resultView(id) {
  const a = store.get().attempts.find(x => x.id === id);
  if (!a) return notFound();
  const m = moduleBySlug(a.slug);
  const s = stateFor(m);
  const questions = a.stage === 'pre' ? m.preTest : m.postTest;
  let headline;
  let detail;
  if (a.stage === 'pre') { headline = 'Your starting point is recorded.'; detail = 'Your learning materials are now available. This result is diagnostic.'; }
  else if (a.passed) { headline = 'Well done. Knowledge check passed.'; detail = 'Your online result is saved. Check your module page for the separate practical assessment.'; }
  else if (s.attemptsLeft) { headline = 'A chance to revisit and improve.'; detail = `Review the learning materials before your next attempt. ${s.attemptsLeft} remaining.`; }
  else { headline = 'A chance to revisit and improve.'; detail = 'Contact your instructor for feedback and an additional attempt after revision. In this demo, switch to the instructor view to grant one.'; }
  const feedback = s.feedbackOpen
    ? `<div class="section-heading"><h2>Your answer review</h2></div>${questions.map((q, i) => {
      const chosen = q.options.find(o => o.id === a.answers[q.id]);
      const correct = q.options.find(o => o.id === q.correct);
      const ok = a.answers[q.id] === q.correct;
      return `<section class="panel feedback-item"><span class="pill ${ok ? 'completed' : 'review'}">${ok ? 'Correct' : 'Review'}</span><h3>${i + 1}. ${h(q.stem)}</h3><p><strong>Your answer:</strong> ${h(chosen ? chosen.text : '—')}</p>${ok ? '' : `<p><strong>Correct answer:</strong> ${h(correct.text)}</p>`}<p class="muted">${h(q.rationale)}</p></section>`;
    }).join('')}`
    : '<div class="notice">Detailed answer feedback becomes available when your post-test is passed or your allowed attempts are finished.</div>';
  const html = `<a class="back-link" href="#/modules/${m.slug}">← ${h(m.title)}</a><div class="reading-layout"><section class="panel result-hero"><span class="eyebrow">${a.stage === 'pre' ? 'PRE-TEST' : 'POST-TEST'} · SUBMITTED</span><div class="result-score">${a.score}<span>%</span></div><h1>${headline}</h1><p>${detail}</p><a class="button" href="#/modules/${m.slug}">Return to module →</a></section>${feedback}</div>`;
  return { nav: 'modules', title: 'Result', html };
}

function resultsView() {
  const rec = recordFor(ME);
  const panels = data.modules.map(m => {
    const s = stateFor(m);
    const notes = rec.notes[m.slug];
    return `<section class="panel"><span class="eyebrow">MODULE ${pad(m.order)}</span><h2>${h(m.title)}</h2><div class="progress-label"><span>Online progress</span><strong>${s.percent}%</strong></div><div class="track"><i style="width:${s.percent}%"></i></div><div class="divider"></div><div class="status-line"><span>Pre-test</span><strong>${s.preDone ? `${s.pre.score}%` : 'Not taken'}</strong></div><div class="status-line"><span>Best post-test</span><strong>${s.bestScore !== null ? `${s.bestScore}%` : 'Not taken'}</strong></div><div class="status-line"><span>Practical assessment</span><strong>${PRACTICAL[s.practical]}</strong></div>${notes ? `<div class="notice">Instructor feedback: ${h(notes)}</div>` : ''}<a class="card-action" href="#/modules/${m.slug}">Open module ↗</a></section>`;
  }).join('');
  const attempts = store.get().attempts.slice().reverse();
  const rows = attempts.length
    ? attempts.map(a => `<tr><td>${h(moduleBySlug(a.slug).title)}</td><td>${STAGE[a.stage]}</td><td><strong>${a.score}%</strong></td><td>${formatDate(a.submittedAt)}</td><td><a href="#/attempts/${a.id}">View →</a></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">Your assessment history will appear here after your first pre-test.</td></tr>';
  const html = `<div class="page-heading"><div><span class="eyebrow">YOUR LEARNING RECORD</span><h1>Every step counts.</h1><p>Your knowledge checks and practical outcomes, in one place.</p></div></div><div class="two-column">${panels}</div><div class="section-heading"><h2>Assessment history</h2></div><div class="panel table-panel"><table><thead><tr><th>Module</th><th>Assessment</th><th>Score</th><th>Submitted</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return { nav: 'results', title: 'My progress', html };
}

function readerView(slug, materialId) {
  const m = moduleBySlug(slug);
  const mat = m && materialsFor(m).find(x => x.id === materialId);
  if (!mat) return notFound();
  const s = stateFor(m);
  if (blockedBeforePre(m, s)) return null;
  const back = `<a class="back-link" href="#/modules/${slug}?materials">← ${h(m.title)}</a>`;
  const url = mat.upload ? uploadedFiles.get(mat.id) : mat.file;
  if (!url) {
    return { nav: 'modules', title: mat.title, html: `${back}<div class="panel"><h1 class="smaller">${h(mat.title)}</h1><div class="notice">This demo upload is no longer available. Uploaded files stay only in the browser tab where they were added, and disappear when the page reloads. Nothing is stored on a server.</div></div>` };
  }
  const done = progressFor(slug).materials.includes(mat.id);
  const complete = isStaff()
    ? '<div class="panel reading-complete"><div><strong>Participants confirm their reading here.</strong><p>Marking a required PDF as complete counts towards unlocking the post-test.</p></div></div>'
    : `<div class="panel reading-complete"><div><strong>Finished reading?</strong><p>Confirm that you have read this material to update your progress.</p></div><form data-form="acknowledge" data-slug="${slug}" data-id="${h(mat.id)}"><button class="button">${done ? 'Completed · Return to module' : 'Mark as complete'} ✓</button></form></div>`;
  const html = `${back}<div class="section-heading"><div><span class="eyebrow">LEARNING MATERIAL · PDF</span><h1 class="smaller">${h(mat.title)}</h1></div><div class="button-group"><a class="button secondary small" href="${h(url)}" target="_blank" rel="noopener">Open in new tab ↗</a><a class="button secondary small" href="${h(url)}" download="${h(mat.fileName || 'demo-material.pdf')}">Download ↓</a></div></div><section class="pdf-shell" id="pdf-viewer"><div class="pdf-toolbar"><button type="button" class="icon-button" id="pdf-prev" aria-label="Previous page">←</button><span>Page <strong id="pdf-page">—</strong> / <span id="pdf-pages">${mat.pages || '—'}</span></span><button type="button" class="icon-button" id="pdf-next" aria-label="Next page">→</button><span class="toolbar-divider"></span><button type="button" class="icon-button" id="pdf-out" aria-label="Zoom out">−</button><span id="pdf-zoom">100%</span><button type="button" class="icon-button" id="pdf-in" aria-label="Zoom in">+</button><button type="button" class="text-button" id="pdf-fullscreen">Full screen ⛶</button><form id="pdf-search-form" class="pdf-search"><input id="pdf-search" type="search" placeholder="Find text" aria-label="Search this PDF"><button class="text-button">Find</button></form></div><p id="pdf-status" class="pdf-status" role="status">Loading your reading material…</p><div class="canvas-container"><canvas id="pdf-canvas" aria-label="PDF page"></canvas></div><details class="pdf-text"><summary>Accessible text for this page</summary><p id="pdf-text"></p></details></section>${complete}`;
  return { nav: 'modules', title: mat.title, html, after: root => openReader(root.querySelector('#pdf-viewer'), url) };
}

// ---------------------------------------------------------------- instructor views
function instructorView() {
  const people = participants();
  const attemptCount = store.get().attempts.length + data.cohort.reduce((sum, p) => sum + Object.values(p.modules).reduce((n, v) => n + (v.pre !== null ? 1 : 0) + v.attempts, 0), 0);
  const cards = data.modules.map(m => {
    const mats = materialsFor(m);
    const passed = people.filter(p => summaryFor(p.id, m).passed).length;
    return `<section class="panel"><div class="card-meta"><span class="eyebrow">MODULE ${pad(m.order)}</span><span class="pill">Sample</span></div><h2>${h(m.title)}</h2><p class="muted">${h(m.subtitle)}</p><div class="status-line"><span>Uploaded materials</span><strong>${mats.length} / ${mats.length}</strong></div><div class="status-line"><span>Participants passed</span><strong>${passed}</strong></div><div class="status-line"><span>Participant access</span><strong>Preview</strong></div><a class="card-action" href="#/instructor/modules/${m.slug}">Manage this module ↗</a></section>`;
  }).join('');
  const events = store.get().events;
  const activity = events.length
    ? events.map(e => `<div class="activity-row"><span class="activity-dot"></span><div><strong>${h(e.detail)}</strong><small>${h(e.action)} · ${h(e.actor)} · ${formatDate(e.at)}</small></div></div>`).join('')
    : '<p class="muted">Uploads, account changes, and assessment activity will appear here as you use the demo.</p>';
  const html = `<div class="page-heading"><div><span class="eyebrow">INSTRUCTOR WORKSPACE</span><h1>Make room for learning.</h1><p>Prepare materials, support participants, and follow their progress.</p></div><button type="button" class="button secondary" data-action="export">Export results ↓</button></div><div class="metric-grid"><div class="panel"><span class="eyebrow">PARTICIPANTS</span><strong class="metric">${people.length}</strong></div><div class="panel"><span class="eyebrow">LEARNING MODULES</span><strong class="metric">${data.modules.length}</strong></div><div class="panel"><span class="eyebrow">SUBMITTED ASSESSMENTS</span><strong class="metric">${attemptCount}</strong></div></div><div class="section-heading"><h2>Your teaching modules</h2><span class="muted small-text">Participants 02–20 are fictional. Participant 01 is you in the participant view.</span></div><div class="two-column">${cards}</div><div class="section-heading"><h2>Recent activity</h2></div><div class="panel">${activity}</div>`;
  return { nav: 'instructor', title: 'Manage learning', html };
}

function manageView(slug) {
  const m = moduleBySlug(slug);
  if (!m) return notFound();
  const list = materialsFor(m).map(mat => {
    if (mat.upload) {
      const available = uploadedFiles.has(mat.id);
      return `<div class="material-admin"><div><span class="pill completed">Uploaded · this tab only</span><h3>${h(mat.title)}</h3><p class="small-text muted">Optional · ${h(mat.fileName)} · not stored on any server</p></div><div class="button-group">${available ? `<a class="text-button" href="#/modules/${slug}/materials/${h(mat.id)}">Read ↗</a>` : '<span class="muted small-text">File cleared on reload</span>'}<button type="button" class="text-button danger" data-action="remove-upload" data-slug="${slug}" data-id="${h(mat.id)}">Remove</button></div></div>`;
    }
    return `<div class="material-admin"><div><span class="pill completed">Uploaded</span><h3>${h(mat.title)}</h3><p class="small-text muted">${mat.required ? 'Required' : 'Optional'} · ${mat.pages} pages · Version 1</p></div><div class="button-group"><a class="text-button" href="#/modules/${slug}/materials/${mat.id}">Read ↗</a><span class="muted small-text">Built-in sample</span></div></div>`;
  }).join('');
  const html = `<a class="back-link" href="#/instructor">← Manage learning</a><div class="section-heading"><div><span class="eyebrow">MODULE SETTINGS</span><h1 class="smaller">${h(m.title)}</h1></div><a class="button secondary" href="#/modules/${slug}">Preview module ↗</a></div><div class="module-layout"><div><section class="panel"><div class="section-heading"><h2>Learning PDFs</h2><a class="button small" href="#/instructor/modules/${slug}/upload">+ Add PDF</a></div><p class="muted">Upload or replace the reading material for each slot. In the real portal, replacing a file asks participants to acknowledge the new version.</p>${list}</section><section class="panel mt"><h2>Lesson and assessment content</h2><p>In the real portal, instructors edit lesson notes, the case, and question banks here. Previously submitted assessments keep their original questions and scoring.</p><div class="button-group"><a class="button secondary" href="#/modules/${slug}/quiz/pre">Pre-test questions ↗</a><a class="button secondary" href="#/modules/${slug}/quiz/post">Post-test questions ↗</a></div></section></div><aside><section class="panel"><h2>Details &amp; publishing</h2><div class="status-line"><span>Online minutes</span><strong>${m.onlineMinutes}</strong></div><div class="status-line"><span>Practical minutes</span><strong>${m.practicalMinutes}</strong></div><div class="status-line"><span>Pass mark</span><strong>${m.passPercent}%</strong></div><div class="status-line"><span>Post-test attempts</span><strong>${m.maxAttempts}</strong></div><div class="status-line"><span>Faculty review</span><strong>Pending</strong></div><div class="status-line"><span>Participant access</span><strong>Preview</strong></div><p class="small-text muted">Editing settings is switched off in the demo.</p></section></aside></div>`;
  return { nav: 'instructor', title: `Manage ${m.title}`, html };
}

function uploadView(slug) {
  const m = moduleBySlug(slug);
  if (!m) return notFound();
  const html = `<a class="back-link" href="#/instructor/modules/${slug}">← ${h(m.title)}</a><div class="reading-layout"><section class="panel reading"><span class="eyebrow">ADD LEARNING MATERIAL</span><h1 class="smaller">Add a PDF</h1><div class="notice">Demo: the file stays in this browser tab and is never uploaded. It disappears when the page reloads. Demo uploads are always optional, so they never block the post-test.</div><form data-form="upload" data-slug="${slug}" class="stack-form"><label for="upload-title">Title</label><input id="upload-title" name="title" type="text" maxlength="200" required placeholder="e.g. Local emergency checklist"><label for="upload-file">PDF file</label><span class="field-help">PDF only, up to 25 MB, the same limit as the real portal.</span><input id="upload-file" name="file" type="file" accept="application/pdf,.pdf" required><button class="button">Add PDF ✓</button></form></section></div>`;
  return { nav: 'instructor', title: 'Add PDF', html };
}

function participantsView() {
  const rows = participants().map(p => {
    const active = recordFor(p.id).active;
    return `<tr><td><strong>${h(p.name)}</strong></td><td>${h(p.username)}</td><td>${h(p.faculty)}</td><td><span class="pill ${active ? 'completed' : ''}">${active ? 'Active' : 'Disabled'}</span></td><td>${formatDate(p.lastLogin)}</td><td><a href="#/instructor/participants/${p.id}">Manage →</a></td></tr>`;
  }).join('');
  const html = `<div class="page-heading"><div><span class="eyebrow">INSTRUCTOR · YOUR COHORT</span><h1>Learning, together.</h1><p>Manage the 20 issued accounts and record practical assessments. All participants here are fictional.</p></div><button type="button" class="button secondary" data-action="export">Export results ↓</button></div><div class="panel table-panel"><table><thead><tr><th>Participant</th><th>Username</th><th>Faculty</th><th>Access</th><th>Last sign-in</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return { nav: 'participants', title: 'Participants', html };
}

function participantView(pidText) {
  const pid = Number(pidText);
  const p = participants().find(x => x.id === pid);
  if (!p) return notFound();
  const rec = recordFor(pid);
  const panels = data.modules.map(m => {
    const v = summaryFor(pid, m);
    const progress = pid === ME ? progressFor(m.slug) : null;
    const options = ['pending', 'practice', 'met'].map(o => `<option value="${o}" ${v.practical === o ? 'selected' : ''}>${o === 'pending' ? 'Not assessed' : PRACTICAL[o]}</option>`).join('');
    const caseDetails = progress && progress.caseResponse
      ? `<details class="mt"><summary>Case response &amp; reflection</summary><p class="pre-wrap">${h(progress.caseResponse)}</p><strong>Reflection</strong><p class="pre-wrap">${h(progress.reflection)}</p></details>`
      : '';
    return `<section class="panel"><span class="eyebrow">MODULE ${m.order}</span><h2>${h(m.title)}</h2><div class="status-line"><span>Online progress</span><strong>${v.percent}%</strong></div><div class="status-line"><span>Pre-test</span><strong>${v.pre !== null ? `${v.pre}%` : '—'}</strong></div><div class="status-line"><span>Best post-test</span><strong>${v.best !== null ? `${v.best}%` : 'Not taken'}</strong></div><div class="status-line"><span>Post-test attempts</span><strong>${v.attempts} / ${v.maxAttempts}</strong></div><button type="button" class="text-button" data-action="extra" data-pid="${pid}" data-slug="${m.slug}">Grant one additional attempt →</button><div class="divider"></div><h3>Practical assessment</h3><form data-form="practical" data-pid="${pid}" data-slug="${m.slug}" class="stack-form"><label for="practical-${m.order}">Outcome</label><select id="practical-${m.order}" name="practical">${options}</select><label for="notes-${m.order}">Feedback for the participant</label><textarea id="notes-${m.order}" name="notes" rows="3" maxlength="4000">${h(rec.notes[m.slug] || '')}</textarea><button class="button small">Save practical outcome</button></form>${caseDetails}</section>`;
  }).join('');
  const html = `<a class="back-link" href="#/instructor/participants">← Participants</a><div class="page-heading"><div><span class="eyebrow">${h(p.username)} · ${h(p.faculty)}</span><h1>${h(p.name)}</h1>${pid === ME ? '<p>Changes here affect what you see in the participant view.</p>' : ''}</div><div class="button-group"><button type="button" class="button secondary" data-action="reset-password" data-pid="${pid}">Reset password</button><button type="button" class="button secondary" data-action="toggle-active" data-pid="${pid}">${rec.active ? 'Disable account' : 'Enable account'}</button></div></div><div class="two-column">${panels}</div>`;
  return { nav: 'participants', title: p.name, html };
}

// ---------------------------------------------------------------- actions
const actions = {
  enter(el) {
    const role = el.dataset.role === 'instructor' ? 'instructor' : 'participant';
    store.update(s => {
      s.role = role;
      if (role === 'participant') s.signedInAt = new Date().toISOString();
      addEvent(s, `Signed in to the ${role} view`, 'demo sign-in');
    });
    go(role === 'instructor' ? 'instructor' : 'dashboard');
  },
  switch() {
    const role = isStaff() ? 'participant' : 'instructor';
    store.update(s => { s.role = role; if (role === 'participant') s.signedInAt = new Date().toISOString(); });
    say(role === 'instructor' ? 'You are now in the instructor view.' : 'You are now in the participant view.', 'info');
    go(role === 'instructor' ? 'instructor' : 'dashboard');
  },
  signout() {
    store.update(s => { s.role = null; });
    go('');
  },
  reset() {
    if (!window.confirm('Reset the demo? This clears your progress and demo uploads in this browser.')) return;
    uploadedFiles.forEach(url => URL.revokeObjectURL(url));
    uploadedFiles.clear();
    store.reset();
    go('');
  },
  menu(el) {
    const open = el.getAttribute('aria-expanded') !== 'true';
    el.setAttribute('aria-expanded', String(open));
    document.getElementById('sidebar')?.classList.toggle('open', open);
  },
  export() {
    const header = ['Username', 'Name', 'Faculty', 'Module', 'Online progress %', 'Pre-test %', 'Best post-test %', 'Post-test attempts', 'Practical'];
    const lines = [header];
    for (const p of participants()) {
      for (const m of data.modules) {
        const v = summaryFor(p.id, m);
        lines.push([p.username, p.name, p.faculty, m.title, v.percent, v.pre ?? '', v.best ?? '', `${v.attempts}/${v.maxAttempts}`, PRACTICAL[v.practical]]);
      }
    }
    const csv = lines.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meddent-demo-results.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  'remove-upload'(el) {
    const { slug, id } = el.dataset;
    const url = uploadedFiles.get(id);
    if (url) URL.revokeObjectURL(url);
    uploadedFiles.delete(id);
    store.update(s => {
      const item = (s.uploads[slug] || []).find(u => u.id === id);
      s.uploads[slug] = (s.uploads[slug] || []).filter(u => u.id !== id);
      if (s.progress[slug]) s.progress[slug].materials = s.progress[slug].materials.filter(x => x !== id);
      addEvent(s, `Removed "${item ? item.title : 'demo upload'}"`, 'material removed');
    });
    say('Demo upload removed.');
    render();
  },
  'reset-password'(el) {
    store.update(s => addEvent(s, `Password reset requested for participant ${pad(el.dataset.pid)}`, 'password reset'));
    say('In the real portal, a temporary password appears here once, and the participant must change it at next sign-in. The demo does not create passwords.', 'info');
    render();
  },
  'toggle-active'(el) {
    const pid = Number(el.dataset.pid);
    let nowActive;
    store.update(s => updateRecord(s, pid, r => {
      nowActive = r.active === false;
      r.active = nowActive;
      addEvent(s, `Participant ${pad(pid)} ${nowActive ? 'enabled' : 'disabled'}`, 'account change');
    }));
    say(nowActive ? 'Account enabled.' : 'Account disabled. In the real portal, this participant can no longer sign in.');
    render();
  },
  extra(el) {
    const pid = Number(el.dataset.pid);
    const { slug } = el.dataset;
    store.update(s => updateRecord(s, pid, r => {
      r.extra[slug] = (r.extra[slug] || 0) + 1;
      addEvent(s, `Extra post-test attempt for participant ${pad(pid)}`, 'attempt granted');
    }));
    say('One additional post-test attempt granted.');
    render();
  },
};

// ---------------------------------------------------------------- forms
const forms = {
  lesson(form) {
    const { slug, id } = form.dataset;
    const already = progressFor(slug).lessons.includes(id);
    if (!already) {
      store.update(s => {
        const p = s.progress[slug] || (s.progress[slug] = emptyProgress());
        p.lessons.push(id);
      });
      say('Lesson marked as complete.');
    }
    go(`modules/${slug}?materials`);
  },
  acknowledge(form) {
    const { slug, id } = form.dataset;
    if (!progressFor(slug).materials.includes(id)) {
      store.update(s => {
        const p = s.progress[slug] || (s.progress[slug] = emptyProgress());
        p.materials.push(id);
      });
      say('Reading marked as complete.');
    }
    go(`modules/${slug}?materials`);
  },
  case(form) {
    const { slug } = form.dataset;
    const response = form.elements.response.value;
    const reflection = form.elements.reflection.value;
    if (!caseValid(response, reflection)) {
      showFormError(form, 'Write at least 30 characters for the team response and 15 for your reflection.');
      return;
    }
    store.update(s => {
      const p = s.progress[slug] || (s.progress[slug] = emptyProgress());
      p.caseResponse = response.trim();
      p.reflection = reflection.trim();
    });
    say('Response and reflection saved in this browser.');
    go(`modules/${slug}?materials`);
  },
  quiz(form) {
    const { slug, stage } = form.dataset;
    const m = moduleBySlug(slug);
    const s = stateFor(m);
    if (stage === 'pre' && s.preDone) { go(`attempts/${s.pre.id}`); return; }
    if (stage === 'post' && !canTakePost(s)) { go(`modules/${slug}`); return; }
    const questions = stage === 'pre' ? m.preTest : m.postTest;
    const answers = Object.fromEntries(questions.map(q => [q.id, form.elements[q.id].value]));
    if (!allAnswered(questions, answers)) { showFormError(form, 'Please answer every question before submitting.'); return; }
    const score = scoreQuiz(questions, answers);
    const attempt = { id: newId(), slug, stage, score, passed: isPassed(stage, score, m.passPercent), answers, submittedAt: new Date().toISOString() };
    store.update(st => {
      st.attempts.push(attempt);
      addEvent(st, `${STAGE[stage]} submitted for ${m.title} (${score}%)`, 'assessment');
    });
    go(`attempts/${attempt.id}`);
  },
  async upload(form) {
    const { slug } = form.dataset;
    const title = form.elements.title.value.trim();
    const file = form.elements.file.files[0];
    if (!title || !file || !pdfAllowed(file.name, file.size)) { showFormError(form, 'Add a title and choose a PDF file of 25 MB or less.'); return; }
    const head = await file.slice(0, 5).text();
    if (head !== '%PDF-') { showFormError(form, 'This file does not look like a PDF.'); return; }
    const id = `upload-${newId()}`;
    uploadedFiles.set(id, URL.createObjectURL(file));
    store.update(s => {
      (s.uploads[slug] ||= []).push({ id, title, fileName: file.name, size: file.size });
      addEvent(s, `Added "${title}"`, 'material uploaded');
    });
    say('PDF added for this browser tab only. Nothing was uploaded to a server.');
    go(`instructor/modules/${slug}`);
  },
  practical(form) {
    const pid = Number(form.dataset.pid);
    const { slug } = form.dataset;
    const value = form.elements.practical.value;
    const notes = form.elements.notes.value.trim();
    store.update(s => updateRecord(s, pid, r => {
      r.practical[slug] = value;
      r.notes[slug] = notes;
      addEvent(s, `Practical outcome for participant ${pad(pid)}: ${PRACTICAL[value]}`, 'practical recorded');
    }));
    say('Practical outcome saved.');
    render();
  },
};

// ---------------------------------------------------------------- router
const routes = [
  [/^$/, signIn, 'public'],
  [/^dashboard$/, dashboard],
  [/^modules\/([\w-]+)$/, moduleView],
  [/^modules\/([\w-]+)\/lessons\/([\w-]+)$/, lessonView],
  [/^modules\/([\w-]+)\/case$/, caseView],
  [/^modules\/([\w-]+)\/quiz\/(pre|post)$/, quizView],
  [/^modules\/([\w-]+)\/materials\/([\w-]+)$/, readerView],
  [/^attempts\/([\w-]+)$/, resultView],
  [/^results$/, resultsView],
  [/^instructor$/, instructorView, 'instructor'],
  [/^instructor\/modules\/([\w-]+)$/, manageView, 'instructor'],
  [/^instructor\/modules\/([\w-]+)\/upload$/, uploadView, 'instructor'],
  [/^instructor\/participants$/, participantsView, 'instructor'],
  [/^instructor\/participants\/(\d+)$/, participantView, 'instructor'],
];

function render() {
  try { closeReader(); } catch { /* never block navigation */ }
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const role = store.get().role;
  const match = routes.map(([re, view, access]) => ({ found: path.match(re), view, access })).find(r => r.found);
  let out;
  if (!match) out = role ? notFound() : null;
  else if (match.access === 'public') {
    if (role) { go(role === 'instructor' ? 'instructor' : 'dashboard'); return; }
    out = match.view();
  } else if (!role) { go(''); return; }
  else if (match.access === 'instructor' && role !== 'instructor') { say('That page belongs to the instructor view.', 'info'); go('dashboard'); return; }
  else out = match.view(...match.found.slice(1), query);
  if (!match && !role) { go(''); return; }
  if (!out) return; // The view redirected.
  app.innerHTML = out.full ?? shell(out.nav, out.html);
  document.title = `${out.title ? `${out.title} · ` : ''}MED-DENT demo`;
  window.scrollTo(0, 0);
  if (query === 'materials' || query === 'modules') document.getElementById(query)?.scrollIntoView();
  out.after?.(app);
}

app.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  event.preventDefault();
  actions[el.dataset.action](el);
});

app.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]');
  if (!form || !forms[form.dataset.form]) return;
  event.preventDefault();
  forms[form.dataset.form](form);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  document.getElementById('sidebar')?.classList.remove('open');
  document.querySelector('.mobile-menu')?.setAttribute('aria-expanded', 'false');
});

async function boot() {
  try {
    const [modules, cohort] = await Promise.all(['data/modules.json', 'data/participants.json'].map(async url => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(url);
      return response.json();
    }));
    data.modules = modules.modules.sort((a, b) => a.order - b.order);
    data.cohort = cohort.participants;
  } catch {
    app.innerHTML = '<p class="notice demo-loading">The demo could not load its data. If you opened index.html directly from your computer, serve the folder over HTTP instead (see README).</p>';
    return;
  }
  window.addEventListener('hashchange', render);
  render();
}

boot();
