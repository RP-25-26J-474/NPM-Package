import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import tslib from 'tslib';  

import replace from '@rollup/plugin-replace';
import dotenv from 'dotenv';
dotenv.config();

export default {
  input: 'src/index.tsx',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    peerDepsExternal(),
    resolve(),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      clean: true,
      useTsconfigDeclarationDir: true,
      tslib: tslib
    }),
    replace({
      preventAssignment: true,
      values: {
        'process.env.AURA_RL_BACKEND_API': JSON.stringify(process.env.AURA_RL_BACKEND_API || ''),
        'process.env.AURA_RL_URL': JSON.stringify(process.env.AURA_RL_URL || '')
      }
    })
  ]
};