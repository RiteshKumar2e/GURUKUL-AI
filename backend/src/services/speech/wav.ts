/**
 * Minimal WAV helpers to join several PCM WAV clips into one file.
 * Sarvam returns one WAV per text chunk; the client gets a single playable file.
 */

interface ParsedWav {
  fmt: Buffer; // the "fmt " chunk body
  data: Buffer; // PCM samples
}

export function parseWav(buf: Buffer): ParsedWav {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file');
  }
  let offset = 12;
  let fmt: Buffer | null = null;
  let data: Buffer | null = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, Math.min(buf.length, offset + 8 + size));
    if (id === 'fmt ') fmt = Buffer.from(body);
    if (id === 'data') data = Buffer.from(body);
    offset += 8 + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || !data) throw new Error('WAV is missing fmt or data chunk');
  return { fmt, data };
}

export function buildWav(fmt: Buffer, data: Buffer): Buffer {
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + (8 + fmt.length) + (8 + data.length), 4);
  header.write('WAVE', 8, 'ascii');
  const fmtHead = Buffer.alloc(8);
  fmtHead.write('fmt ', 0, 'ascii');
  fmtHead.writeUInt32LE(fmt.length, 4);
  const dataHead = Buffer.alloc(8);
  dataHead.write('data', 0, 'ascii');
  dataHead.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, fmtHead, fmt, dataHead, data]);
}

/** Concatenates WAV clips that share the same format. */
export function concatWav(clips: Buffer[]): Buffer {
  if (clips.length === 1) return clips[0];
  const parsed = clips.map(parseWav);
  const fmt = parsed[0].fmt;
  if (!parsed.every((p) => p.fmt.equals(fmt))) throw new Error('WAV clips have different formats');
  return buildWav(fmt, Buffer.concat(parsed.map((p) => p.data)));
}
