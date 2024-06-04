import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import external from 'rollup-plugin-peer-deps-external';
import sourcemaps from 'rollup-plugin-sourcemaps';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import ignore from 'rollup-plugin-ignore';
import copy from 'rollup-plugin-copy';

const name = 'index';
const source = 'src/index.ts';
const options = [
  {
    name,
    format: 'cjs',
    input: source,
  },
  { name, format: 'esm', input: source },
  {
    name,
    format: 'umd',
    input: source,
  },
];

const createRollupConfig = (options) => {
  const name = options.name;
  const extName = options.format === 'esm' ? 'mjs' : 'js';
  const outputName = 'dist/' + [name, options.format, extName].join('.');

  return {
    input: options.input,
    output: {
      file: outputName,
      format: options.format,
      name: 'PdfTableExtractor',
      sourcemap: false,
      exports: 'named',
    },
    plugins: [
      ignore(['./pdf.worker.js']),
      copy({
        targets: [
          {
            src: './node_modules/pdfjs-dist/build/pdf.worker.mjs',
            dest: './dist/',
          },
          {
            src: './node_modules/pdfjs-dist/LICENSE',
            dest: './',
          },
        ],
      }),
      json(),
      resolve(),
      external(),
      typescript({
        tsconfig: 'tsconfig.json',
        clean: true,
      }),
      options.format === 'umd' &&
        commonjs({
          include: /\/node_modules\//,
        }),
      sourcemaps(),
      options.format !== 'esm' &&
        terser({
          output: { comments: false },
          compress: {
            drop_console: true,
          },
        }),
    ].filter(Boolean),
  };
};

export default options.map((option) => createRollupConfig(option));
