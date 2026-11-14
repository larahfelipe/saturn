import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    restoreMocks: true,
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/unit/**/*.test.ts'] } },
      { extends: true, test: { name: 'integration', include: ['test/integration/**/*.test.ts'] } },
    ],
  },
});
