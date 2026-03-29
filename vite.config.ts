/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import { generateManifest } from './src/workers/manifestUtils';

function manifestPlugin(): Plugin {
  return {
    name: 'manifest-plugin',
    closeBundle: async () => {
      const shardsDir = resolve(__dirname, 'dist/index-shards');
      let files: string[];
      try {
        files = (await readdir(shardsDir)).filter((f) => f.endsWith('.json'));
      } catch {
        // dist/index-shards may not exist (e.g. during tests)
        return;
      }

      const shardContents = new Map<string, string>();
      for (const file of files) {
        const content = await readFile(resolve(shardsDir, file), 'utf-8');
        shardContents.set(file, content);
      }

      const manifest = generateManifest(shardContents);
      await writeFile(
        resolve(__dirname, 'dist/manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      );
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/phonetic2word/' : '/',
  plugins: [react(), manifestPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
});
