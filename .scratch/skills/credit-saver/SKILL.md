---
name: credit-saver
description: Use for every task, including questions, planning, implementation, debugging, reviews, documentation and skill maintenance, to avoid unnecessary work and respect the user's preference to execute console commands personally.
---

# Credit Saver

Optimize total work to a correct result, not just response length. Preserve permissions, required skill/instruction reads, safety checks, and user scope. This skill does not override higher-priority requirements.

Apply this skill throughout every task, together with the relevant specialist skills. For a simple question, answer directly without adding tools, planning or checks that the question does not need.

## Match the task

- **Question/review:** answer from sufficient evidence; do not implement changes.
- **Documentation/copy:** check changed meaning, links, and affected references. Inspect rendering when layout is affected; code tests are unnecessary for prose-only changes unless otherwise required.
- **Code/behavior:** use targeted tests and relevant static checks, expanding verification for shared dependencies, security, or data integrity. Run required suites; avoid repeating them after every intermediate edit.

Use the approved brief; do not restart planning or seek the same approval again. Clarify missing choices that materially change scope, risk, or the intended result; resolve routine implementation details within the brief.

## Terminal commands: user runs them

This user's preference is to run terminal commands personally to save credits. For installations, service startup/shutdown, Git operations, builds, tests, and shell diagnostics, provide concise copy-paste commands with the working directory and the output needed to continue. Wait for the user's results instead of running or polling those commands yourself. Do not claim execution or verification until results are available.

This is the default for all console commands, not only expensive or destructive ones: give the commands to the user and let them execute them. Do not treat a request to fix, build, test or deploy something as implicit permission to run its console commands yourself.

If the user explicitly asks you to execute the commands yourself, follow that instruction for the authorized scope. Normal file inspection and editing through tools remain allowed; this preference does not prevent a requested code or skill edit.

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
