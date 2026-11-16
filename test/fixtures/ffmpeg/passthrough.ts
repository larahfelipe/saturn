#!/usr/bin/env node
// Stand-in for FFmpeg: copies stdin to stdout and reports a libopus encoder.
import { pipeline } from 'node:stream/promises';

if (process.argv.includes('-encoders')) {
  process.stdout.write(' A....D libopus              libopus Opus (codec opus)\n');
} else {
  await pipeline(process.stdin, process.stdout);
}
