const MODULES = [
  'identity',
  'organization',
  'pets',
  'catalog',
  'scheduling',
  'triage',
  'clinical',
  'billing',
  'sales',
  'notification',
  'reporting',
];

const crossModuleZones = MODULES.flatMap((target) =>
  MODULES.filter((source) => source !== target).map((source) => ({
    target: `./src/modules/${source}`,
    from: `./src/modules/${target}`,
    except: [
      './domain/entities',
      './application/index.ts',

      `./${target}.module.ts`,
      
      './auth.module.ts',
      './users.module.ts',
      './customers.module.ts',
      './permissions.module.ts',
      './employees.module.ts',
    ],
    message:
      `Module "${source}" khong duoc voi vao ben trong module "${target}". ` +
      `Chi duoc import tu "${target}/domain/entities", barrel "${target}/application", ` +
      `hoac module goc "${target}.module.ts".`,
  })),
);

const layerZones = MODULES.flatMap((mod) => [
  {
    target: `./src/modules/${mod}/domain`,
    from: `./src/modules/${mod}/infrastructure`,
    message: `Tang domain cua "${mod}" khong duoc phu thuoc vao infrastructure - domain phai test duoc ma khong can CSDL.`,
  },
  {
    target: `./src/modules/${mod}/domain`,
    from: `./src/modules/${mod}/presentation`,
    message: `Tang domain cua "${mod}" khong duoc phu thuoc vao presentation.`,
  },
  {
    target: `./src/modules/${mod}/domain`,
    from: `./src/modules/${mod}/application`,
    message: `Tang domain cua "${mod}" khong duoc phu thuoc vao application - chieu phu thuoc la application -> domain.`,
  },
  {
    target: `./src/modules/${mod}/application`,
    from: `./src/modules/${mod}/infrastructure`,
    message:
      `Tang application cua "${mod}" khong duoc goi thang vao infrastructure. ` +
      `Dinh nghia mot port trong application/ports/ va cho module dang ky adapter o composition root.`,
  },
]);

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'import'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
  settings: {
    'import/resolver': {
      typescript: { project: 'tsconfig.json' },
    },
  },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          ...crossModuleZones,
          ...layerZones,
          {

            target: './src/shared',
            from: './src/modules',
            except: ['../shared/database/entity-registry.ts'],
            message:
              'Tang shared khong duoc phu thuoc vao module nghiep vu. ' +
              'Ngoai le duy nhat la shared/database/entity-registry.ts.',
          },
        ],
      },
    ],
  },
  overrides: [
    {

      files: ['src/shared/database/entity-registry.ts'],
      rules: { 'import/no-restricted-paths': 'off' },
    },
  ],
};
