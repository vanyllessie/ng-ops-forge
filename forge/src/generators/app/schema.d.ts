export interface AppGeneratorSchema {
  name: string;
  style?: 'css' | 'scss' | 'sass' | 'less';
  routing?: boolean;
  state?: 'signals' | 'ngrx' | 'none';
  ui?: 'material' | 'tailwind' | 'none';
  quality?: string;
  cicd?: 'github-actions' | 'gitlab-ci' | 'none';
  storybook?: boolean;
}
