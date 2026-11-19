import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { include: ['test/unit/**/*.test.ts'], name: 'unit' } },
      { extends: true, test: { include: ['test/integration/**/*.test.ts'], name: 'integration' } },
      { extends: true, test: { include: ['test/ffmpeg/**/*.test.ts'], name: 'ffmpeg' } },
    ],
    restoreMocks: true,
  },
});
