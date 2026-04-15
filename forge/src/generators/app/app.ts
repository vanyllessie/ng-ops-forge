import {
  formatFiles,
  generateFiles,
  Tree,
  readProjectConfiguration,
  addDependenciesToPackageJson,
  updateJson,
} from '@nx/devkit';
import { applicationGenerator } from '@nx/angular/generators';
import * as path from 'path';
import { AppGeneratorSchema } from './schema';

export async function appGenerator(tree: Tree, options: AppGeneratorSchema) {
  process.env.NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true';

  // ─── 1. Angular App Base (Standalone) ────────────────────────────────────────
  await applicationGenerator(tree, {
    name: options.name,
    directory: `apps/${options.name}`,
    style: options.style || 'scss',
    routing: options.routing ?? true,
    standalone: true,
    skipFormat: true,
  });

  const project = readProjectConfiguration(tree, options.name);
  const projectRoot = project.root;
  const qualityTools = options.quality ? options.quality.split(',') : [];

  // ─── 2. Calidad y Compliance ──────────────────────────────────────────────────
  if (qualityTools.includes('husky') || qualityTools.includes('commitlint')) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        husky: '^9.0.0',
        'lint-staged': '^15.0.0',
        '@commitlint/cli': '^19.0.0',
        '@commitlint/config-conventional': '^19.0.0',
      }
    );

    updateJson(tree, 'package.json', (pkg) => {
      pkg['lint-staged'] = {
        '*.{ts,js,html}': 'eslint --fix',
        '*.{ts,js,html,css,scss,json,md}': 'prettier --write',
      };
      if (!pkg.scripts) pkg.scripts = {};
      pkg.scripts['prepare'] = 'husky || true';
      return pkg;
    });

    generateFiles(tree, path.join(__dirname, 'root-files'), '.', options);
  }

  // ─── 3. State Management ─────────────────────────────────────────────────────
  const state = options.state ?? 'none';

  if (state === 'signals') {
    // Genera el servicio de estado basado en Signals
    generateFiles(
      tree,
      path.join(__dirname, 'files-state-signals'),
      projectRoot,
      options
    );
  }

  if (state === 'ngrx') {
    // Agrega dependencias de NgRx
    addDependenciesToPackageJson(
      tree,
      {
        '@ngrx/store': '^19.0.0',
        '@ngrx/effects': '^19.0.0',
        '@ngrx/entity': '^19.0.0',
        '@ngrx/router-store': '^19.0.0',
      },
      {
        '@ngrx/store-devtools': '^19.0.0',
      }
    );

    // Genera los archivos del store NgRx
    generateFiles(
      tree,
      path.join(__dirname, 'files-state-ngrx'),
      projectRoot,
      options
    );

    // Inyectar provideStore() en app.config.ts
    injectNgrxInConfig(tree, projectRoot);
  }

  // ─── 4. Environment Manager ───────────────────────────────────────────────────
  generateFiles(
    tree,
    path.join(__dirname, 'files-environments'),
    projectRoot,
    options
  );

  // ─── 5. Clean Architecture Folders ───────────────────────────────────────────
  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);

  await formatFiles(tree);
}

/**
 * Inyecta provideStore() en el app.config.ts generado por Angular
 */
function injectNgrxInConfig(tree: Tree, projectRoot: string): void {
  const configPath = `${projectRoot}/src/app/app.config.ts`;
  if (!tree.exists(configPath)) return;

  let content = tree.read(configPath, 'utf-8') ?? '';

  if (content.includes('@ngrx/store')) return; // ya inyectado

  // 1. Agregar imports de NgRx al inicio del archivo
  content =
    `import { appReducer } from './core/state/app.store';\n` +
    `import { provideStore } from '@ngrx/store';\n` +
    `import { provideStoreDevtools } from '@ngrx/store-devtools';\n` +
    content;

  // 2. Inyectar providers dentro del array de providers (antes del cierre "]")
  //    Buscamos el último provider existente y añadimos después
  content = content.replace(
    /providers:\s*\[([\s\S]*?)\]/,
    (match, inner) =>
      `providers: [${inner.trimEnd()},\n    provideStore({ app: appReducer }),\n    provideStoreDevtools({ maxAge: 25 })\n  ]`
  );

  tree.write(configPath, content);
}

export default appGenerator;

