#!/usr/bin/env node
import { pipeline } from 'node:stream/promises';

if (process.argv.includes('-encoders')) {
  process.stdout.write(' A....D libopus              libopus Opus (codec opus)\n');
} else {
  await pipeline(process.stdin, process.stdout);
}
