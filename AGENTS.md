# oc-portfolio-theme

Public Hugo theme for Olivier Charvoz's portfolio. The content lives in a
separate, private repository, `oc-portfolio-site`, which imports this theme
as a Hugo module (`github.com/gtolivier/oc-portfolio-theme`). The original
design comes from the Claude Design project "Portfolio".

## Layout

- `layouts/`, `assets/`, `i18n/`: the theme.
- `exampleSite/`: bilingual demo site (FR by default, EN). The tests run
  against it; its content is fictional.
- `tests/`: Playwright e2e tests, run against `exampleSite`.

The roadmap (one conversation per feature) lives in the private repository
`oc-portfolio-site`, next to this one: `../site/ROADMAP.md`.

## Commands

- `hugo server --source exampleSite`: example site, locally.
- `npx playwright test --project=chromium --project=mobile-chrome`: the
  test command — desktop and mobile Chromium. The TDD cycles run this one.
- `npx playwright test --project=chromium {files}`: the focused test
  command, for working runs on a few test files.
- `npm test`: all 5 Playwright projects (starts Hugo on its own, port
  1314). Left to the CI, which runs it on every pull request.
- `npm run typecheck`: TypeScript type check (theme script in
  `assets/js/`, tests, Playwright configuration). Hugo compiles the script
  with `js.Build`.
- `npm run format`: formats the repository with Prettier (`.prettierrc.json`);
  `npm run format:check` only checks, as the CI does. `.prettierignore`
  leaves out the Go templates of `layouts/` and of the archetypes, which
  Prettier would break, the fictional content of `exampleSite/content/` and
  the Markdown of the test fixtures.

## Rules

- **Language**: code is in English — identifiers, file and folder names,
  components, CSS classes, test titles, code comments — and so is this file,
  written for agents. So are commit messages, PR titles and descriptions,
  issues and release notes, review comments and replies, and the build
  errors the templates raise (`errorf`) for whoever fills in the content.
  Text meant for the user stays in French: the conversation, the prompt that
  starts the next step and the roadmap. Site content, `i18n/` strings and the
  fictional content of `exampleSite/` and of the test fixtures keep their
  language, and so do the names visitors see in an address: content file
  names, which set the slug (`page-avec-alias.md`), and the HTML ids used as
  anchors (`#contenu`). Renaming them would break published links.
- **TDD required**: every feature goes through the `tdd:feature` skill
  (dedicated branch, red/green/refactor cycles, pull request). No production
  code without a failing test first. Only exception: a tuning value the
  tests deliberately leave open (a delay, a duration, a light curve), or a
  gap from the design that no test can catch without measuring pixels
  finely, is tuned by eye, in its own commit; the suite must stay green.
- **Design fidelity**: the tests pin behaviors, never the look, and the
  green step never sees the design, so TDD alone does not converge on the
  mockup. For a step that has a mockup:
  - the behaviors cover what a test states well (content, links,
    accessibility, phone and desktop layout in broad strokes, reading
    without JavaScript, `prefers-reduced-motion`), not each detail of the
    layout: no red/green cycle for what the mockup's CSS already gives;
  - right after the last cycle, one "port the mockup" commit carries over
    its values (fonts, sizes, spacing, colours, opacities, borders,
    alignment), adapting only what the tests or the phone layout require,
    and says which values it kept from the theme and why;
  - before the pull request, the section is compared with the mockup side
    by side, in screenshots at 390 and 1280 px, by the agent, not left to
    the user.
- **Playwright e2e tests**: a test describes a behavior the visitor can see
  (text, link, navigation, rendering at a screen size), not an
  implementation detail. Only exception: a content error (badly filled
  front matter) that must make the site build fail is tested through the
  failure of `hugo build` and its message, since no page results from it.
- **Test granularity**: keep the suite short and stable.
  - One test per behavior a visitor would see break: content, links,
    navigation, languages, accessibility, no horizontal overflow, the
    phone and desktop layout in broad strokes, reading without JavaScript,
    `prefers-reduced-motion`, build errors on badly filled content.
  - Assert relations ("below the header", "aligned with the logo",
    "brighter than before") rather than exact pixels or milliseconds,
    unless the design itself depends on that value.
  - A decorative component (animation, canvas) gets a handful of tests:
    it appears, it reveals, it reacts to the pointer and to a click, it
    stops under `prefers-reduced-motion`. No test per tuning parameter.
  - No new pixel-analysis helper in `tests/helpers/` without the user's
    agreement.
  - CSS first: no JavaScript for a behavior that CSS delivers with an
    acceptable gap from the design.
  - Tests that read the pixels of a canvas carry the `@pixels` tag;
    `playwright.config.ts` runs them on Chromium only (`chromium`,
    `mobile-chrome`). Text and layout tests stay on every project, even
    when they drive the fake clock (a scramble-text decoding).
- **Mobile first**: base styles target phones; wider screens are enhanced
  through `@media (min-width: …)`. The Playwright projects `mobile-chrome`
  and `mobile-safari` check every behavior on a phone, except the `@pixels`
  tests, which run on `mobile-chrome` only.
- **Static site**: no JavaScript required to read the content. Animations
  are an enhancement and respect `prefers-reduced-motion`.
- **Deterministic tools**: go through the CLIs (`hugo`, `npm`, `npx`, `git`,
  `gh`) rather than a manual edit whenever they cover the operation.
- **Formatting**: run `npm run format` before every commit; in a TDD cycle,
  the orchestrator runs it after each step's report, before committing the
  step. Never format by hand what Prettier formats. A commit that only
  reformats goes in `.git-blame-ignore-revs`, listed after the branch's last
  rebase, and its PR is merged with a merge commit, so that its SHA reaches
  `main`; the other PRs are squash-merged.
- **Pull requests**: every change goes through a branch and a PR, even a
  simple documentation fix; never a direct commit on `main` (a GitHub rule
  enforces it too). Merge only with the user's explicit agreement.
- **Before publishing**: before every push and any other publication on
  this public repository (PR, issue, release, comment), reread everything
  that goes out: diff, commit messages, branch name, PR title and
  description, reviews and replies Claude posts. Nothing that is a secret
  (key, password, token), personal data (see "No personal data"), an
  internal URL (deployment, webhook) or a local detail: a path on the
  user's machine, an installed tool version, the content or location of
  their configuration and private instruction files, content of the
  private repository `oc-portfolio-site` other than the title of the
  roadmap step the PR delivers and the working rules shared by both
  repositories. Still allowed: versions the repository pins itself (CI,
  `package.json`), paths relative to the repository (such as
  `../site/ROADMAP.md`) and the attribution lines of commits and PRs. If
  such a detail shows up in the diff, a commit or the branch name, do not
  push and tell the user, who decides how to fix it; in the title, the
  description, a review or a reply, remove it before publishing, rewording
  review findings without dropping any. If it is already public (pushed,
  in `main`, or published by Claude or by CodeRabbit, whose reviews are
  reread as soon as they arrive), tell the user at once, who decides what
  comes next. The site repository has the same rule, adapted to a private
  repository: any change to what they share is carried over to the other.
- **CodeRabbit**: its policy for small open-source repositories keeps it
  from reviewing PRs on its own ("Review skipped"). Start it by commenting
  `@coderabbitai review` when the PR opens. If commits followed that first
  CodeRabbit pass, start it once more, after the triage of the last Claude
  review the skill calls for and before the approval request. Its findings
  are triaged like the others: the skill says whether their fixes call for
  a new Claude review, and the approval request lists those no Claude
  review covered. If, after that second pass, a commit other than a triage
  fix arrives ("triage fix", as the skill defines it; an approved proposal
  never is one), start it once more before asking for approval again. Its
  findings that arrive before the merge are triaged before merging; if one
  leads to a fix, ask for approval again. If it reports a limit reached, do
  not wait for it: say so in the approval request. If its automatic review
  starts working, stop starting it.
- **Claude review**: on every PR, when `/code-review` is available, run
  `/code-review high <number>` (without `--comment`). Post its findings,
  triage all those on the PR (Claude, CodeRabbit, user), rerun the review,
  ask for approval and triage late findings as the `tdd:feature` skill
  describes in "Pull request and reviews" from "Collect the reviews", then
  "Approval" and "After approval"; outside TDD, skip what assumes a
  behavior list. It needs version 0.9.0 or later (`claude plugin list`);
  otherwise, update it before the review.
  - **Triage**: outside TDD, it directly fixes the documentation, the
    repository configuration (`.github/`, `.coderabbit.yaml`) and the PR
    description; any other finding (templates, styles, `i18n/`,
    `exampleSite/`, scripts, tests, npm or Playwright configuration)
    becomes a proposal, to be handled in a TDD PR.
- **No personal data** in this public repository: the real content
  (projects, background, contact details) goes in `oc-portfolio-site`.
