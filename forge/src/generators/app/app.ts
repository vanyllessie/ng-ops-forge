import {
  formatFiles,
  generateFiles,
  Tree,
  readProjectConfiguration,
} from '@nx/devkit';
import { applicationGenerator } from '@nx/angular/generators';
import * as path from 'path';
import { AppGeneratorSchema } from './schema';

export async function appGenerator(tree: Tree, options: AppGeneratorSchema) {
  // Set environment variable to bypass unsupported TS setup in base plugin workspace
  process.env.NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true';

  // 1. Initializar Angular App Subyacente (Standalone por defecto)
  await applicationGenerator(tree, {
    name: options.name,
    directory: `apps/${options.name}`,
    style: options.style || 'scss',
    routing: options.routing ?? true,
    standalone: true,
    skipFormat: true,
  });

  // 2. Obtener el root de nuestro proyecto generado
  const project = readProjectConfiguration(tree, options.name);
  const projectRoot = project.root;

  // 3. Generar la Arquitectura Limpia basada en templates (AST/EJS)
  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);

  await formatFiles(tree);
}

export default appGenerator;
