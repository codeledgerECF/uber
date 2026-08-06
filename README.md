# Uber-Scale Monorepo Demo

Synthetic monorepo demonstrating CodeLedger's dep-graph resolution capabilities
across a realistic Uber-like tech stack: Go multi-module services, Bazel BUILD files,
and Spring Boot Java microservices with DI patterns.

## Structure

```
services/
  auth/        Go module (github.com/uber/auth)     — JWT, handler, session packages
  pricing/     Go module (github.com/uber/pricing)  — surge, model, geo packages
  matching/    Go module (github.com/uber/matching)  — algorithm, geospatial packages
  dispatch/    Go module (github.com/uber/dispatch)  — queue, tracker packages
shared/        Go module (github.com/uber/shared)   — config, observability (imported by all)
java-services/
  surge-pricing/  Spring Boot — ISurgeCalculator interface + DefaultSurge + MLSurge impls
WORKSPACE          Bazel workspace root
go.work            Go workspace linking all modules
```

Every Go service has `BUILD.bazel` files declaring local `//path:target` deps.
All services import `shared/config` and `shared/observability` — making those
the highest-centrality nodes in the dep graph.

## Validated dep-graph numbers

Run against CodeLedger's `buildDepGraph`:

| Metric | Value |
|---|---|
| Total files indexed | 38 |
| Dep-graph edges resolved | **104** |
| Go edges (across 4 service modules) | 82 |
| Java edges (DI interface→impl) | 22 (4 DI) |
| Cross-package edge ratio | **96%** |
| `shared/config` imported by | 16 files |
| Bazel CLI required | None — static parse only |

## The demo scenario

**Task:** "Add ML confidence threshold to surge pricing predictor"

Without CodeLedger: full repo → ~420,000 tokens  
With CodeLedger: 8 targeted files → ~6,800 tokens → **98.4% reduction**

Key files selected:
- `services/pricing/internal/surge/predictor.go` (keyword match)
- `services/pricing/internal/surge/calculator.go` (Bazel BUILD edge)
- `java-services/.../impl/MLSurgeCalculator.java` (DI impl edge)
- `java-services/.../api/ISurgeCalculator.java` (Tier 2 skeleton — interface only)
- `shared/observability/metrics.go` (Tier 2 skeleton — surface auto-include)

## Running the validation

```bash
# Requires codeledger-blackbox built (packages/repo/dist/dep-graph.js)
node validate-all.mjs /path/to/this/repo /path/to/codeledger-blackbox
```

## What this demonstrates

**Go multi-module:** Each `go.mod` is discovered by walking up the directory tree.
Import paths like `github.com/uber/auth/internal/jwt` resolve to the correct files
within the `services/auth/` module boundary — no cross-module bleed.

**Bazel BUILD graphs:** `BUILD.bazel` files are parsed statically for `//local:target`
deps. External `@maven//` and `@bazel_rules_go//` deps are filtered. `BUILD.bazel`
takes precedence over `BUILD` when both exist in the same directory.

**Java DI edges:** `ISurgeCalculator` is an interface in `com.uber.surge.api`.
`DefaultSurgeCalculator` and `MLSurgeCalculator` in `com.uber.surge.impl` both
`implements ISurgeCalculator` — CodeLedger detects these as implicit deps when any
file imports the interface, pulling in all concrete implementations.

**Skeleton tier:** Structural co-commit neighbors and centrality-only files
(like `shared/observability`) receive outline-only excerpts — function signatures
and type surfaces, bodies stripped — at 5–10× lower token cost.
