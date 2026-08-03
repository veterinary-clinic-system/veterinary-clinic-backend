const MODULES = [
  'identity',
  'organization',
  'pets',
  'catalog',
  'scheduling',
  'triage',
  'clinical',
  'billing',
  'notification',
  'reporting',
];

/**
 * Luat 1 - CAM GOI XUYEN MODULE VAO BEN TRONG.
 *
 * Module A chi duoc cham vao module B qua hai cua:
 *   - `B/domain/entities/*`   : cac entity tao nen mot luoc do quan he duy nhat,
 *                               khoa ngoai bat buoc phai tham chieu duoc lan nhau
 *   - `B/application` (barrel): API cong khai cua B
 *
 * Moi thu khac cua B - application/<file cu the>, infrastructure/, presentation/ -
 * la noi bo. Nho vay, neu sau nay can tach B thanh service rieng thi be mat can doi
 * sang HTTP da duoc gioi han san va biet truoc.
 */
const crossModuleZones = MODULES.flatMap((target) =>
  MODULES.filter((source) => source !== target).map((source) => ({
    target: `./src/modules/${source}`,
    from: `./src/modules/${target}`,
    except: [
      './domain/entities',
      './application/index.ts',
      // Module goc cua bounded context: NestJS BAT BUOC phai import module cua B thi
      // moi dung duoc provider ma B export. Day la day noi DI, khong phai lot vao
      // chi tiet ben trong - be mat van chi la nhung gi B ghi trong `exports`.
      `./${target}.module.ts`,
      // identity gom hai module con; module goc cua no la identity.module.ts.
      './auth.module.ts',
      './users.module.ts',
    ],
    message:
      `Module "${source}" khong duoc voi vao ben trong module "${target}". ` +
      `Chi duoc import tu "${target}/domain/entities", barrel "${target}/application", ` +
      `hoac module goc "${target}.module.ts".`,
  })),
);

/**
 * Luat 2 - CHIEU PHU THUOC BEN TRONG MOT MODULE.
 *
 * presentation -> application -> domain, va infrastructure cam vao qua interface.
 * Cu the: `domain` la tang trong cung, khong duoc biet gi ve ba tang con lai;
 * `application` khong duoc goi thang vao `infrastructure` (phai qua port).
 */
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

    // Bien quy tac kien truc o Phan III tai lieu tu "loi hua trong tai lieu" thanh
    // rang buoc may kiem duoc. Khong co luat nay thi ranh gioi module se muc dan sau
    // vai thang, va viec tach module ve sau tro thanh bat kha thi.
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          ...crossModuleZones,
          ...layerZones,
          {
            // shared/ la ha tang dung chung, no khong duoc biet den module nghiep vu nao.
            // Ngoai le duy nhat: entity-registry.ts, noi TypeORM buoc phai thay tat ca
            // entity o mot cho de dung do thi quan he.
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
      // entity-registry.ts la diem dang ky entity cho TypeORM: no BAT BUOC phai import
      // tu moi module. Tat luat o dung mot file nay thay vi noi long luat cho ca shared/.
      files: ['src/shared/database/entity-registry.ts'],
      rules: { 'import/no-restricted-paths': 'off' },
    },
  ],
};
