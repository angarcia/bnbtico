---
name: credit-saver
description: Use for every task, including questions, planning, implementation, debugging, reviews, documentation and skill maintenance, to avoid unnecessary work and respect the user's preference to execute console commands personally.
---

# Credit Saver

Optimize total work to a correct result, not just response length. Preserve permissions, required skill/instruction reads, safety checks, and user scope. This skill does not override higher-priority requirements.

Apply this skill throughout every task, together with the relevant specialist skills. For a simple question, answer directly without adding tools, planning or checks that the question does not need.

## Match the task

- **Conversation and exploration:** when Ana asks a question, compares options or thinks aloud, answer briefly from the available context. Do not turn the exchange into file reads, plans, tests, documentation edits or commits unless needed to answer accurately or requested by Ana. Expand explanations only when they add useful information.
- Treat an explicit request to do the work, or an unambiguous acceptance such as "ok" immediately after a concrete proposal, as authorization for that proposal. Continue already-authorized work without asking for confirmation again; a conversational question does not cancel it.
- **Question/review:** answer from sufficient evidence; do not implement changes.
- **Documentation/copy:** check changed meaning, links, and affected references. Inspect rendering when layout is affected; code tests are unnecessary for prose-only changes unless otherwise required.
- **Code/behavior:** use targeted tests and relevant static checks, expanding verification for shared dependencies, security, or data integrity. Run required suites; avoid repeating them after every intermediate edit.

Use the approved brief; do not restart planning or seek the same approval again. Clarify missing choices that materially change scope, risk, or the intended result; resolve routine implementation details within the brief.

## Proportionate use of Superpowers

Ana explicitly prefers using Superpowers workflows in proportion to the task's complexity and risk. Keep credit-saver active throughout:

- For questions, small reversible edits and straightforward documentation changes, answer or make the scoped edit directly. Do not impose a full brainstorming, design-document, implementation-plan and review cycle, or launch subagents, solely because a generic workflow prescribes it.
- For difficult bugs, significant implementations or architecture changes, use the relevant diagnosis, planning and review techniques when they reduce uncertainty or rework. Reuse an approved brief instead of restarting its approval process.
- For changes affecting permissions, payments, data integrity or deployment, preserve the applicable safeguards and meaningful verification even when the edit is small.

Scale the process, not the required correctness or permissions. Do not edit or disable the installed Superpowers package to apply this preference.

## Savings priorities

Prioritize the total cost of reaching a correct result, in this order:

1. Recommend an adequate available model and reasoning effort; do not default to the strongest setting or downgrade in a way likely to cause expensive retries.
2. Use only the context needed for the task. Reuse reliable evidence, read relevant sections instead of whole files, load only relevant specialist skills and suggest a new chat when the history becomes unwieldy.
3. Avoid unnecessary execution and repeated work: no tool calls for questions answerable from context, no duplicate inspections or checks without a reason, and no delegation unless required or its benefit justifies the added work.
4. Keep conversation and execution distinct. Give concise answers by default, clarify only material uncertainties and carry out an accepted scope without restarting planning or seeking the same approval again.
5. Give Ana the terminal commands and request only the output needed to continue. Batch independent inspections when useful; bound logs and tool outputs.
6. Verify what the change actually affects. Preserve required checks and evidence; broaden testing only when changes, failures or unresolved concerns justify it. Stop when the task is complete.

Do not claim a measured saving from shorter instructions or fewer commands alone. Do not reduce quality by omitting relevant evidence or transfer avoidable work to Ana merely to reduce tool calls.

## Model and context recommendations

Use Ana's current selection, Sol Medium, as a starting point, not as a fixed requirement for all work. For a new task, recommend the least costly available configuration that is likely to meet its requirements:

- Simple questions, summaries and narrow edits: a lighter available model or lower reasoning effort.
- Ordinary implementation and bounded debugging: Sol with medium effort.
- Difficult diagnosis, competing architectural constraints or sensitive changes to permissions, payments or data: consider higher reasoning effort; recommend a more capable model only when the expected benefit justifies it.

These are starting recommendations, not guarantees. Respect the user's chosen model. Distinguish recommending a configuration from changing it: if no supported control can change the current chat's model, tell Ana what to select; never claim the change occurred. Do not create another chat or delegate work just to switch models. Suggest a switch briefly when materially useful, not at every message, and do not delay a simple answer to discuss settings. Confirm available models and current documentation only when needed; do not promise a savings percentage.

When the conversation becomes long, mixes many completed tasks or shows repeated context loss, give a short notice at a natural stopping point suggesting a new chat. If reliable context metrics are available, use them; otherwise explain the observation without inventing token counts or a percentage. Do not repeat the same warning every turn or interrupt already-authorized work. Provide a short handoff with the objective, relevant files, decisions, completed work and next pending step, without copying the full history. Ana decides when to open the new chat.

## Terminal commands: user runs them

This user's preference is to run terminal commands personally to save credits. For installations, service startup/shutdown, Git operations, builds, tests, and shell diagnostics, provide concise copy-paste commands with the working directory and the output needed to continue. Wait for the user's results instead of running or polling those commands yourself. Do not claim execution or verification until results are available.

This is the default for all console commands, not only expensive or destructive ones: give the commands to the user and let them execute them. Do not treat a request to fix, build, test or deploy something as implicit permission to run its console commands yourself.

Ana has given standing authorization to create local commits for completed project-file changes after the required checks have evidence. This exception permits inspecting Git state, staging only the task's files or hunks, checking the staged diff and creating the commit without asking again. Preserve unrelated changes and staging; do not switch branches, discard work, push, merge or deploy under this authorization. If required validation is still pending or the task's changes cannot be isolated safely, explain the remaining condition instead of claiming a completed commit. Other console commands remain user-run.

If the user explicitly asks you to execute other commands yourself, follow that instruction for the authorized scope. Normal file inspection and editing through tools remain allowed; this preference does not prevent a requested code or skill edit.

## Gather only missing evidence

Reuse relevant, complete context from this task. Re-read when files changed, evidence is stale, output was truncated, or an instruction requires it. Read selected mandatory instructions fully; efficiency is not permission to skip them.

Find paths with `rg --files`, locate symbols with scoped `rg`, then read the needed implementation and callers. Bound output before requesting it. After truncation, narrow the query or retrieve the missing section rather than repeat the same dump.

Reuse existing services and browser handles after checking they still match the task. Group independent reads where useful; do not add agents or new processes just for perceived speed.

## Change and verify

Make focused patches, preserving unrelated edits. For requirements, update the established source of truth and affected references. Prefer links over new copies of the same rule. Do not restructure documentation or remove useful context without task justification.

On failure, use the actual error to revise the hypothesis before retrying. Expand investigation when evidence demands it; avoid arbitrary retry loops.

Verification evidence must cover the final changed state. Repeat affected checks after subsequent edits, not unrelated checks with unchanged inputs. Report skipped, blocked, or failed checks accurately.

Stop when the requested outcome is verified or needs new authority. Summarize result, verification, and remaining limitations; do not add unrelated improvements.

## Evaluate savings when requested

Compare the same representative tasks and acceptance criteria before/after, with comparable model, settings, and starting context. Record correctness, tool calls, elapsed time, and tokens when available. Distinguish file word count from token usage and billable credits. Report missing measurements; never infer a savings percentage from a shorter skill alone.
