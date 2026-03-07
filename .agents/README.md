# PartyPal Agent Pipeline

## Pipeline Flow

```
Bug/Feature Intake → [YOU APPROVE TICKET] → Dev Agent → Code Review Agent
→ [YOU REVIEW DIFF] → Test Agent → Sandbox Deploy → Shiproom Agent → [YOU SHIP]
```

Two human gates: after ticket creation and after code review.

## Agents

| # | Agent | Command | Purpose |
|---|-------|---------|---------|
| 0 | Sandbox Deploy | `npm run agent:sandbox` | Deploy preview + smoke tests |
| 1 | Bug Triage | `npm run agent:triage` | Classify bugs, assign severity |
| 2 | Feature Prioritize | `npm run agent:prioritize` | Score and rank feature requests |
| 3 | Dev Agent | `npm run agent:dev` | Write code to resolve tickets |
| 4 | Code Review | `npm run agent:review` | Review diffs for safety/quality |
| 5 | Test Agent | `npm run agent:test` | Generate + run tests |
| 6 | Shiproom | `npm run agent:shiproom` | Pre-ship summary + risk flags |

## Full Pipeline

```bash
npm run agent:pipeline          # Run full pipeline (interactive)
npm run agent:pipeline:auto     # Run with auto-advance between agents
```

## Inbox

Drop bug reports or feature requests as `.md` files in `.agents/inbox/`:

```
.agents/inbox/bug-login-crash.md
.agents/inbox/feature-dark-mode.md
```

## Reports

Agent outputs are written to `.agents/reports/`.
