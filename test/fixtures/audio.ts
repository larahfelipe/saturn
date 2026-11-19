import { fileURLToPath } from 'node:url';

export type FakeFfmpeg = 'failing' | 'no-opus' | 'passthrough' | 'stalled';

export function fakeFfmpeg(name: FakeFfmpeg): string {
  return fileURLToPath(new URL(`ffmpeg/${name}.ts`, import.meta.url));
}

export const FRAME_MS = 20;
const SAMPLES_PER_FRAME = 960;
const SERIAL = 0x5a_7e;
const SILENT_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index << 24;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 0x80_00_00_00 ? (crc << 1) ^ 0x04_c1_1d_b7 : crc << 1;
  return crc >>> 0;
});

export function oggOpus(frames: number): Buffer {
  const pages = [oggOpusHeaders()];
  for (let sequence = 2, start = 0; start < frames; start += 50, sequence++) {
    const count = Math.min(50, frames - start);
    const last = start + count >= frames;
    const packets = Array.from({ length: count }, () => SILENT_FRAME);
    pages.push(oggPage(packets, sequence, (start + count) * SAMPLES_PER_FRAME, last ? 0x04 : 0));
  }
  return Buffer.concat(pages);
}

export function oggOpusHeaders(): Buffer {
  const head = Buffer.alloc(19);
  head.write('OpusHead', 0, 'latin1');
  head.writeUInt8(1, 8);
  head.writeUInt8(2, 9);
  head.writeUInt16LE(312, 10);
  head.writeUInt32LE(48_000, 12);
  const vendor = Buffer.from('saturn-test');
  const tags = Buffer.alloc(16 + vendor.length);
  tags.write('OpusTags', 0, 'latin1');
  tags.writeUInt32LE(vendor.length, 8);
  vendor.copy(tags, 12);
  return Buffer.concat([oggPage([head], 0, 0, 0x02), oggPage([tags], 1, 0)]);
}

function oggCrc(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data)
    crc = ((crc << 8) ^ (CRC_TABLE[((crc >>> 24) ^ byte) & 0xff] ?? 0)) >>> 0;
  return crc;
}

function oggPage(packets: readonly Buffer[], sequence: number, granule: number, flags = 0): Buffer {
  const lacing = packets.flatMap((packet) => [
    ...Array.from({ length: Math.floor(packet.length / 255) }, () => 255),
    packet.length % 255,
  ]);
  const header = Buffer.alloc(27);
  header.write('OggS', 0, 'latin1');
  header.writeUInt8(flags, 5);
  header.writeBigInt64LE(BigInt(granule), 6);
  header.writeUInt32LE(SERIAL, 14);
  header.writeUInt32LE(sequence, 18);
  header.writeUInt8(lacing.length, 26);
  const page = Buffer.concat([header, Buffer.from(lacing), ...packets]);
  page.writeUInt32LE(oggCrc(page), 22);
  return page;
}
