# Skill Registry — TaskList (my-first-cap)

**Generated**: 2026-06-18
**Scope**: User-level skills
**Source Dirs**:
- `~/.config/opencode/skills/` (primary)
- `~/.claude/skills/` (mirror)
- `~/.copilot/skills/` (additional SAP-specific)

## Rules
- `sdd-*`, `_shared`, `skill-registry` skills are excluded (SDD workflow managed by orchestrator).
- Project-level skills take precedence over user-level. None found at project root.
- Treat registry as an index — subagents read full SKILL.md for source of truth.

## Registered Skills

| Name | Trigger | Path |
|------|---------|------|
| branch-pr | PRs over 400 lines, stacked PRs, review slices | `~/.config/opencode/skills/branch-pr/SKILL.md` |
| chained-pr | PRs over 400 lines, stacked PRs, review slices | `~/.config/opencode/skills/chained-pr/SKILL.md` |
| cognitive-doc-design | Writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs | `~/.config/opencode/skills/cognitive-doc-design/SKILL.md` |
| comment-writer | PR feedback, issue replies, reviews, Slack messages, or GitHub comments | `~/.config/opencode/skills/comment-writer/SKILL.md` |
| go-testing | Go tests, go test coverage, Bubbletea teatest, golden files | `~/.config/opencode/skills/go-testing/SKILL.md` |
| issue-creation | Creating GitHub issues, bug reports, or feature requests | `~/.claude/skills/issue-creation/SKILL.md` |
| judgment-day | Judgment day, dual review, adversarial review, juzgar | `~/.config/opencode/skills/judgment-day/SKILL.md` |
| skill-creator | New skills, agent instructions, documenting AI usage patterns | `~/.config/opencode/skills/skill-creator/SKILL.md` |
| skill-improver | Improve skills, audit skills, refactor skills, skill quality | `~/.config/opencode/skills/skill-improver/SKILL.md` |
| work-unit-commits | Implementation, commit splitting, chained PRs, or keeping tests and docs with code | `~/.config/opencode/skills/work-unit-commits/SKILL.md` |
| customize-opencode | Editing/creating opencode's own configuration files | `~/.config/opencode/skills/customize-opencode/SKILL.md` |
| data-product-integration | Finding, exploring, integrating, connecting, consuming data products in SAP CAP | `~/.copilot/skills/data-product-integration/SKILL.md` |
| sap-bas | Creating, scaffolding, or modifying projects in SAP Business Application Studio | `~/.copilot/skills/sap-bas/SKILL.md` |
| sap-cap | Creating or editing CAP applications | `~/.copilot/skills/sap-cap/SKILL.md` |
| sap-fiori | Creating or editing Fiori UIs in CAP context | `~/.copilot/skills/sap-fiori/SKILL.md` |
| sapui5 | Creating or editing SAPUI5 UIs in CAP context | `~/.copilot/skills/sapui5/SKILL.md` |
| service-integration | Finding, exploring, integrating, connecting SAP OData services into CAP | `~/.copilot/skills/service-integration/SKILL.md` |
| onb-ai-instructions | General AI instructions and agent rules | `~/.config/opencode/AGENTS.md` |

## Project Convention Files

None found (no `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `copilot-instructions.md` at project root).

## Notes
- `.copilot/skills/` contains SAP-specific skills (sap-cap, sap-bas, sap-fiori, sapui5, data-product-integration, service-integration) — relevant for this CAP project.
- `~/.config/opencode/skills/` is the primary skill directory for OpenCode.
- `~/.claude/skills/` mirrors the same set.
- No project-level skills found in any scanned location.
- Project convention files (`AGENTS.md`, `CLAUDE.md`, etc.) are absent.
