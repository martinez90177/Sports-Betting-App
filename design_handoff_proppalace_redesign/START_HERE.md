# Start here

Written for someone new to this. Nothing here needs you to write code — you are
copying files and typing sentences to Claude Code.

## What you have

A folder called `design_handoff_proppalace_redesign`. It contains the design, a
plan, and five ready-made code files. Claude Code does the actual work; your job
is to point it at the right thing and look at the result.

## Step 1 — Put the folder in your project

Unzip the download. Drag the whole `design_handoff_proppalace_redesign` folder
into your `Sports-Betting-App` folder — the same folder that has `package.json`
and the `src` folder in it. It sits alongside them; it does not go inside `src`.

## Step 2 — Open Claude Code in that project

Open Claude Code and make sure it is pointed at the `Sports-Betting-App` folder.
If you normally start it from a terminal, that means being in that folder when
you start it. If you are unsure, ask it:

    What folder are you working in, and does it contain package.json?

## Step 3 — Get the app running so you can see changes

Type this to Claude Code:

    Start the dev server and tell me the URL to open.

It will run the server and give you something like `http://localhost:5173`. Open
that in your browser. Leave it running — the page updates itself as files change.

## Step 4 — Save a restore point

Type:

    Commit everything currently uncommitted with the message "before redesign",
    so I can get back to this exact state if I need to.

This is your undo button for the whole project. Ask for one before every phase.

## Step 5 — Do phase 1

Type exactly:

    Read design_handoff_proppalace_redesign/BUILD_ORDER.md and do phase 1 only.

Wait for it to finish. Then look at your browser tab. Phase 1 should change the
fonts, make the logo read "PROP PALACE", and put team-coloured circles behind the
player photos. Everything else should look the same as before.

If something looks broken, say so plainly:

    The player names are overlapping the numbers on the props page. Fix that.

If it looks wrong in a way you can't describe, take a screenshot and give it to
Claude Code — it reads images.

## Step 6 — Put phase 1 live

When you are happy:

    Run npm run build. If it succeeds, commit with the message "phase 1:
    foundations" and push to master. If the build fails, fix it first and show me
    what was wrong.

The build check matters: your site deploys from `master`, and a failed build
means the live site quietly keeps serving the old version.

## Step 7 — Repeat for phases 2, 3 and 4

Same shape every time. Start a **new** Claude Code conversation for each phase so
it isn't carrying four phases of history:

    Read design_handoff_proppalace_redesign/BUILD_ORDER.md and do phase 2 only.

Between phases, open the matching file from the `reference` folder in your browser
(double-click `reference/news.html`) and compare it to your app side by side.
That comparison is the whole review — if they look the same, the phase is done.

## Things worth knowing

- **You can always ask it to explain.** "What did you just change, in plain
  English?" is a fine question and it will answer.
- **You can always undo.** "Undo your last change" works, and your commits from
  step 4 are the bigger safety net.
- **Stop it if it wanders.** If it starts editing screens the phase didn't ask
  for, say: "Phase 2 only. Revert anything outside that."
- **Phase 3 is the hard one.** Before it builds any interface there, say: "Show
  me the alt-line numbers for one real player as plain text first." If those
  numbers are wrong, nothing built on them will be right.
- **Nothing here can break the live site by accident.** Only step 6 pushes, and
  only after a successful build.
