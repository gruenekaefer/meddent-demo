# MED-DENT Emergencies: interactive demo

A clickable demonstration of the MED-DENT Emergencies learning portal, the joint FK–FKG (Faculty of Medicine and Faculty of Dental Medicine) emergency course at Universitas Airlangga.

**Live demo:** https://gruenekaefer.github.io/meddent-demo/

> **Demo only.** All participants are fictional. The lessons, questions and PDF are sample content written for this demo and awaiting faculty review. Nothing here is course material, and nothing here is for clinical learning.

## What you can try

**As a participant**
1. Take the pre-test. It is diagnostic, with no pass mark, and it unlocks the materials.
2. Read the sample lessons and the demo PDF, marking each as complete.
3. Write a response and reflection for the joint case.
4. Take the post-test: 80% to pass, 2 attempts. Answer feedback opens after a pass or when attempts run out.
5. See your record under **My progress**.

**As the instructor**
- See the fictional cohort of 20, and open any participant.
- Record a practical outcome with feedback, grant an extra attempt, or disable an account.
- View each module's question bank with the answer key.
- "Upload" a PDF. It stays in your browser tab and is never sent anywhere.
- Export results as a CSV.

Participant 01 is you: changes made in the instructor view show up in the participant view. Use **Reset demo** in the top banner to start again.

## How it works

- Plain HTML, CSS and JavaScript modules. No build step, no server, no external requests.
- Progress is saved in your browser (`localStorage`). Nothing is collected or sent.
- The styles and page markup are copied from the real portal so the demo looks the same.
- The unlocking and scoring rules in `assets/js/rules.js` mirror `core/services.py` in the real portal, and `tests/rules.test.js` checks them.
- PDF.js (Apache-2.0) renders the demo PDF.

## Differences from the real portal

| Real portal | Demo |
|---|---|
| Issued usernames and passwords | Choose a view; no sign-in |
| Learner records on a server database | Progress stored only in your browser |
| PDFs uploaded and access-controlled | One public demo PDF; mock uploads stay in the tab |
| Faculty-reviewed lessons and question bank | Short sample lessons and 3 sample questions per test |
| 4 lessons and 5 questions per test | 2 lessons and 3 questions per test |
| Official university logo | Placeholder |

## Run locally

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080/. Opening `index.html` directly from disk does not work, because browsers block loading the data files that way.

Run the rule tests with Node.js 22 or later:

```sh
node --test
```

## Layout

```
index.html               Page shell
assets/css/site.css      Copied from the real portal
assets/fonts/              Playfair Display files (SIL OFL), copied from the real portal's static/fonts
assets/css/demo.css      Demo banner and small additions
assets/js/app.js         Router and all pages
assets/js/rules.js       Unlocking and scoring (mirrors core/services.py)
assets/js/store.js       Browser storage and reset
assets/js/reader.js      PDF reader
assets/js/vendor/pdfjs/  PDF.js and its licence
data/modules.json        Sample module content
data/participants.json   Fictional cohort
demo-material.pdf        Demo PDF
tests/rules.test.js      Rule tests
.github/workflows/       Test, then deploy to GitHub Pages
```

## Deployment

Every push to `main` runs the tests, then publishes the site to GitHub Pages through GitHub Actions. Only `index.html`, `assets/`, `data/` and the demo PDF are published.

## Keeping the demo in step

When the real portal's rules change (unlocking, scoring, pass mark, attempts):

1. Update `assets/js/rules.js` and `tests/rules.test.js`.
2. Run `node --test`.
3. Note the change in both repositories' changelogs.

Never copy real lesson text, real questions, answer keys, participant data or reading packs into this repository. It is public.

## Licence

- **Code:** MIT. See [LICENSE](LICENSE).
- **Sample content** (`data/`, `demo-material.pdf`): © 2026 Yodi Soebadi, all rights reserved.
- **PDF.js:** Apache-2.0. See `assets/js/vendor/pdfjs/LICENSE`.
- University names are used for identification only. The university logo is not included.
