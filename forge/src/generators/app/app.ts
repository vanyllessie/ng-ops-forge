import {
  formatFiles,
  generateFiles,
  Tree,
  readProjectConfiguration,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { applicationGenerator } from '@nx/angular/generators';
import * as path from 'path';
import { AppGeneratorSchema } from './schema';

export async function appGenerator(tree: Tree, options: AppGeneratorSchema) {
  process.env.NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true';

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

  if (qualityTools.includes('husky') || qualityTools.includes('commitlint')) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        'husky': '^9.0.0',
        'lint-staged': '^15.0.0',
        '@commitlint/cli': '^19.0.0',
        '@commitlint/config-conventional': '^19.0.0',
      }
    );
    
    // Configurar lint-staged en package.json
    const packageJsonContent = tree.read('package.json', 'utf-8');
    if (packageJsonContent) {
      const packageJson = JSON.parse(packageJsonContent);
      packageJson['lint-staged'] = {
        '*.{ts,js,html}': 'eslint --fix',
        '*.{ts,js,html,css,scss,json,md}': 'prettier --write'
      };
      
      // Agregar script de commitlint si no existe
      if (!packageJson.scripts) packageJson.scripts = {};
      packageJson.scripts['prepare'] = 'husky || true';

      tree.write('package.json', JSON.stringify(packageJson, null, 2));
    }

    // Generar archivos root (Husky y Commitlint)
    generateFiles(tree, path.join(__dirname, 'root-files'), '.', options);
  }

  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);

  await formatFiles(tree);
}

export default appGenerator;
