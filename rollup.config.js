import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

import replace from '@rollup/plugin-replace';
import dotenv from 'dotenv';
dotenv.config();

export default {
  input: 'src/index.tsx',
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.mjs',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    peerDepsExternal(),

    replace({
      preventAssignment: true,
      values: {
        "process.env.AURA_RL_BACKEND_API": JSON.stringify(
          process.env.AURA_RL_BACKEND_API || ""
        ),
        "process.env.AURA_RL_URL": JSON.stringify(
          process.env.AURA_RL_URL || ""
        ),
        "process.env.AURA_API_ENDPOINT": JSON.stringify(
          process.env.AURA_API_ENDPOINT ||
            "https://optimization-engine-ten.vercel.app/api"
        ),
        "process.env.AURA_RL_ENDPOINT": JSON.stringify(
          process.env.AURA_RL_ENDPOINT || "https://rl-service.fly.dev"
        ),
      },
    }),

    typescript({
      tsconfig: "./tsconfig.json",
    }),

    resolve({
      extensions: [".mjs", ".js", ".jsx", ".json", ".ts", ".tsx"],
    }),

    commonjs(),
    json(),
  ],
};
