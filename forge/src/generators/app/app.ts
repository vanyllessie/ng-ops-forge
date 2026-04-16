import {
  formatFiles,
  generateFiles,
  Tree,
  readProjectConfiguration,
  addDependenciesToPackageJson,
  updateJson,
} from '@nx/devkit';
import {
  applicationGenerator,
  setupTailwindGenerator,
  storybookConfigurationGenerator,
} from '@nx/angular/generators';
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
    generateFiles(
      tree,
      path.join(__dirname, 'files-state-signals'),
      projectRoot,
      options
    );
  }

  if (state === 'ngrx') {
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

    generateFiles(
      tree,
      path.join(__dirname, 'files-state-ngrx'),
      projectRoot,
      options
    );

    injectNgrxInConfig(tree, projectRoot);
  }

  // ─── 4. Environment Manager ───────────────────────────────────────────────────
  generateFiles(
    tree,
    path.join(__dirname, 'files-environments'),
    projectRoot,
    options
  );

  // ─── 5. UI Framework ─────────────────────────────────────────────────────────
  const ui = options.ui ?? 'none';

  if (ui === 'tailwind') {
    // Ejecutar generador oficial de Nx para Tailwind
    await setupTailwindGenerator(tree, { project: options.name });

    // Sobreescribir con nuestro tailwind.config.js y styles.scss pre-configurados
    generateFiles(
      tree,
      path.join(__dirname, 'files-ui-tailwind'),
      projectRoot,
      options
    );
  }

  if (ui === 'material') {
    // Instalar Angular Material
    addDependenciesToPackageJson(
      tree,
      {
        '@angular/material': '^20.0.0',
        '@angular/cdk': '^20.0.0',
      },
      {}
    );

    // Inyectar provideAnimationsAsync en app.config.ts
    injectMaterialInConfig(tree, projectRoot);

    // Inyectar estilos de Angular Material con tema personalizado
    generateFiles(
      tree,
      path.join(__dirname, 'files-ui-material'),
      projectRoot,
      options
    );
  }

  // ─── 6. Storybook ────────────────────────────────────────────────────────────
  if (options.storybook) {
    // Instalar @nx/storybook si no está presente
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/storybook': '^22.6.5',
        '@storybook/angular': '^8.0.0',
        '@storybook/addon-essentials': '^8.0.0',
        '@storybook/addon-a11y': '^8.0.0',
        '@storybook/addon-interactions': '^8.0.0',
      }
    );

    // Configurar Storybook para el proyecto vía generador oficial
    await storybookConfigurationGenerator(tree, {
      project: options.name,
      linter: 'eslint',
      interactionTests: true,
      generateStories: false,
    });
  }

  // ─── 7. Compodoc ─────────────────────────────────────────────────────────────
  // Siempre incluimos Compodoc como herramienta de doc técnica
  addDependenciesToPackageJson(
    tree,
    {},
    {
      '@compodoc/compodoc': '^1.1.25',
    }
  );

  // Agregar script de Compodoc al package.json
  updateJson(tree, 'package.json', (pkg) => {
    if (!pkg.scripts) pkg.scripts = {};
    pkg.scripts['doc:serve'] =
      `compodoc -p tsconfig.doc.json -s --theme material`;
    pkg.scripts['doc:build'] =
      `compodoc -p tsconfig.doc.json --theme material`;
    return pkg;
  });

  // Generar tsconfig.doc.json y estilos de compodoc
  generateFiles(tree, path.join(__dirname, 'root-files-docs'), '.', options);

  // ─── 8. CI/CD Workflow ───────────────────────────────────────────────────────
  if (options.cicd === 'github-actions') {
    generateFiles(
      tree,
      path.join(__dirname, 'root-files-cicd'),
      '.',
      options
    );
  }

  // ─── 9. Clean Architecture Folders + Interceptors + README ───────────────────
  // Los interceptores viven en files/src/app/core/interceptors/
  // El README vive en files/README.md
  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);

  // ─── 10. Wire interceptors in app.config.ts ───────────────────────────────────
  injectInterceptorsInConfig(tree, projectRoot);

  // ─── 11. Update Root Workspace Config (Workspaces + Plugins) ──────────────────
  updateRootConfig(tree);

  await formatFiles(tree);
}

/**
 * Asegura que el workspace raíz tenga configurado el auto-descubrimiento
 * de la carpeta 'apps' y el plugin de Angular.
 */
function updateRootConfig(tree: Tree): void {
  // 1. Actualizar package.json workspaces
  updateJson(tree, 'package.json', (pkg) => {
    if (!pkg.workspaces) pkg.workspaces = [];
    if (Array.isArray(pkg.workspaces)) {
      if (!pkg.workspaces.includes('apps/*')) {
        pkg.workspaces.push('apps/*');
      }
    }
    return pkg;
  });

  // 2. Actualizar nx.json plugins
  updateJson(tree, 'nx.json', (nx) => {
    if (!nx.plugins) nx.plugins = [];
    
    const hasAngularPlugin = nx.plugins.some((p: any) => 
      (typeof p === 'string' && p === '@nx/angular/plugin') || 
      (typeof p === 'object' && p.plugin === '@nx/angular/plugin')
    );

    if (!hasAngularPlugin) {
      nx.plugins.unshift({
        plugin: '@nx/angular/plugin',
        options: {
          targetName: 'build'
        }
      });
    }
    return nx;
  });

  // 3. Actualizar .vscode/settings.json
  updateJson(tree, '.vscode/settings.json', (settings) => {
    return {
      ...settings,
      'editor.formatOnSave': true,
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
      '[typescript]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[html]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      'editor.codeActionsOnSave': {
        'source.fixAll.eslint': 'explicit',
      },
      'eslint.validate': ['javascript', 'typescript', 'html'],
      'eslint.useFlatConfig': true,
    };
  });

  // 4. Actualizar .prettierrc
  updateJson(tree, '.prettierrc', (prettier) => {
    return {
      ...prettier,
      singleQuote: true,
      semi: true,
      tabWidth: 2,
      printWidth: 100,
      bracketSpacing: true,
      arrowParens: 'avoid',
      overrides: [
        ...(prettier.overrides || []),
        {
          files: '*.html',
          options: {
            parser: 'angular',
          },
        },
      ],
    };
  });

  // 5. Actualizar eslint.config.mjs (Flat Config)
  updateEslintConfig(tree);
}

/**
 * Inyecta eslint-config-prettier en el eslint.config.mjs raíz
 */
function updateEslintConfig(tree: Tree): void {
  const eslintPath = 'eslint.config.mjs';
  if (!tree.exists(eslintPath)) return;

  let content = tree.read(eslintPath, 'utf-8') ?? '';

  if (content.includes('eslint-config-prettier')) return;

  // 1. Agregar import
  content = `import prettier from 'eslint-config-prettier';\n` + content;

  // 2. Agregar prettier al final del array export default
  content = content.replace(/\s*\];\s*$/, ',\n  prettier,\n];');

  tree.write(eslintPath, content);
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

/**
 * Inyecta provideAnimationsAsync() en app.config.ts para Angular Material
 */
function injectMaterialInConfig(tree: Tree, projectRoot: string): void {
  const configPath = `${projectRoot}/src/app/app.config.ts`;
  if (!tree.exists(configPath)) return;

  let content = tree.read(configPath, 'utf-8') ?? '';

  if (content.includes('provideAnimationsAsync')) return; // ya inyectado

  // 1. Agregar import
  content =
    `import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';\n` +
    content;

  // 2. Inyectar provider al final del array
  content = content.replace(
    /providers:\s*\[([\s\S]*?)\]/,
    (match, inner) =>
      `providers: [${inner.trimEnd()},\n    provideAnimationsAsync()\n  ]`
  );

  tree.write(configPath, content);
}

/**
 * Inyecta provideHttpClient con los interceptores de observabilidad
 * en el app.config.ts generado por Angular.
 */
function injectInterceptorsInConfig(tree: Tree, projectRoot: string): void {
  const configPath = `${projectRoot}/src/app/app.config.ts`;
  if (!tree.exists(configPath)) return;

  let content = tree.read(configPath, 'utf-8') ?? '';

  if (content.includes('withInterceptors')) return; // ya inyectado

  // 1. Agregar imports de HttpClient e interceptores
  content =
    `import { provideHttpClient, withInterceptors } from '@angular/common/http';\n` +
    `import { loggingInterceptor } from './core/interceptors/logging.interceptor';\n` +
    `import { authInterceptor } from './core/interceptors/auth.interceptor';\n` +
    content;

  // 2. Inyectar provideHttpClient en el array de providers
  content = content.replace(
    /providers:\s*\[([\s\S]*?)\]/,
    (match, inner) => {
      // Limpiar comas sobrantes antes de agregar el nuevo provider
      const cleaned = inner.trimEnd().replace(/,\s*,/g, ',').replace(/,\s*$/, '');
      return `providers: [${cleaned},\n    provideHttpClient(withInterceptors([loggingInterceptor, authInterceptor]))\n  ]`;
    }
  );

  tree.write(configPath, content);
}

export default appGenerator;
