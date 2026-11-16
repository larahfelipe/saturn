#!/usr/bin/env node
// Stand-in for FFmpeg: consumes its input, never produces output and never exits.
process.stdin.resume();
setInterval(() => undefined, 60_000);
