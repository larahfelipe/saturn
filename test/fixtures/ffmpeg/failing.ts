#!/usr/bin/env node
// Stand-in for FFmpeg: rejects its input.
process.stderr.write('pipe:0: Invalid data found when processing input\n');
process.exit(1);
