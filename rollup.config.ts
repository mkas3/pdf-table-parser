import { generateRollupConfig } from '@mkas3/rollup';

import pkg from './package.json';

export default generateRollupConfig({
  pkg,
  tsconfigPath: 'tsconfig.json',
  configs: {
    babel: {},
    typescript: {
      compilerOptions: {
        noEmit: false
      },
      noForceEmit: false,
      tsconfig: 'tsconfig.json',
      include: 'node_modules/**'
    },
    dts: {
      tsconfig: 'tsconfig.json'
    }
  },
  output: {
    main: {},
    module: {
      exports: 'auto'
    }
  },
  input: { ignorePattern: 'src/**/*.{demo,test,stories}.{ts,tsx}' }
});
