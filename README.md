# NG-Ops Forge 🔥

> Enterprise Angular Scaffolding CLI — built on top of Nx Generators

NG-Ops Forge es una herramienta de generación dinámica de código diseñada para estandarizar el desarrollo de aplicaciones Angular con un enfoque riguroso en **Calidad**, **DevOps** y **Mantenibilidad**.

## Quick Start

```bash
# Clonar el repositorio base
git clone https://github.com/your-org/ng-ops-forge.git
cd ng-ops-forge
npm install

# Generar una nueva aplicación (modo interactivo)
npx nx g @ng-ops/forge:app --name=mi-proyecto

# Generar con todas las opciones (fast-track)
npx nx g @ng-ops/forge:app \
  --name=interview-project \
  --style=scss \
  --routing=true \
  --state=signals \
  --ui=material \
  --quality=husky,commitlint,eslint \
  --cicd=github-actions \
  --storybook=true
```

## Capabilities

| Module | Options | Description |
|---|---|---|
| **Quality** | `eslint`, `prettier`, `husky`, `commitlint` | Git hooks, linting, Conventional Commits |
| **State** | `signals`, `ngrx`, `none` | Angular Signals service or full NgRx suite |
| **UI** | `material`, `tailwind`, `none` | Design system with dark/light theming |
| **CI/CD** | `github-actions`, `none` | Workflow with Nx cache (Install → Lint → Test → Build) |
| **Docs** | Always included | Compodoc + optional Storybook with A11y addon |

## Generated Architecture

```
src/app/
├── core/           # Singletons, guards, interceptors (not exported)
│   ├── interceptors/
│   │   ├── auth.interceptor.ts       # Bearer token + 401 handling
│   │   └── logging.interceptor.ts    # Request/response observability
│   └── state/
│       ├── app-state.service.ts      # (--state=signals)
│       └── app.store.ts              # (--state=ngrx)
├── shared/         # Dumb components, pipes, directives
├── features/       # Smart components (business logic by domain)
└── data/           # Contracts, models, API services

src/environments/
├── environment.development.ts
├── environment.staging.ts
└── environment.production.ts
```

## Repository Structure

```
forge/                          # Nx Plugin source
└── src/generators/app/
    ├── schema.json             # CLI schema & prompts
    ├── app.ts                  # Generator orchestrator
    ├── files/                  # Clean architecture templates
    ├── files-state-signals/    # Angular Signals templates
    ├── files-state-ngrx/       # NgRx Store templates
    ├── files-environments/     # Environment manager templates
    ├── files-ui-material/      # Angular Material theme
    ├── files-ui-tailwind/      # Tailwind CSS config
    ├── root-files/             # Husky + Commitlint hooks
    ├── root-files-docs/        # Compodoc config
    └── root-files-cicd/        # GitHub Actions workflow
```

## License

MIT
