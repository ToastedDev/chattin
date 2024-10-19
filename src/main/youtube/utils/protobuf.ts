import { Buffer } from "node:buffer";

export enum B64Type {
  B1 = "b1",
  B2 = "b2",
}

interface CVPair {
  channelId: string;
  videoId: string;
}

const _btoa = globalThis.btoa as ((data: string) => string) | undefined;

const u8tob64 = _btoa
  ? (data: Uint8Array) => _btoa(String.fromCharCode.apply(null, data as any))
  : (data: Uint8Array) => Buffer.from(data).toString("base64");

function urlsafeB64e(payload: Uint8Array): string {
  return encodeURIComponent(u8tob64(payload));
}

function b64e(payload: Uint8Array, type: B64Type): string {
  switch (type) {
    case B64Type.B1:
      return urlsafeB64e(payload);
    case B64Type.B2:
    {
      const urlsafe = urlsafeB64e(payload);
      const encoded = new TextEncoder().encode(urlsafe);
      return u8tob64(encoded);
      // return u8tob64(new TextEncoder().encode(urlsafeB64e(payload)));
    }
    default:
      throw new Error(`Invalid b64type: ${type}`);
  }
}

function cvToken(p: CVPair) {
  return ld(5, [ld(1, p.channelId), ld(2, p.videoId)]);
}

function hdt(tgt: CVPair): string {
  return u8tob64(
    cc([ld(1, cvToken(tgt)), ld(3, ld(48687757, ld(1, tgt.videoId))), vt(4, 1)]),
  );
}

/**
 * Builder
 */

function ld(
  fid: bigint | number,
  payload: Uint8Array[] | Uint8Array | string,
): Uint8Array {
  const b
    = typeof payload === "string"
      ? new TextEncoder().encode(payload)
      : Array.isArray(payload)
        ? cc(payload)
        : payload;
  const bLen = b.byteLength;
  return cc([bitou8(pbh(fid, 2)), bitou8(encv(BigInt(bLen))), b]);
}

function vt(fid: bigint | number, payload: bigint | number): Uint8Array {
  return cc([bitou8(pbh(fid, 0)), bitou8(payload)]);
}

// function f3(fid: bigint | number, payload: bigint): Buffer {
//   while (payload >> 8n) {
//     const b = payload & 8n;
//   }
// }

function pbh(fid: bigint | number, type: number): bigint {
  return encv((BigInt(fid) << 3n) | BigInt(type));
}

function encv(n: bigint): bigint {
  let s = 0n;
  while (n >> 7n) {
    s = (s << 8n) | 0x80n | (n & 0x7Fn);
    n >>= 7n;
  }
  s = (s << 8n) | n;
  return s;
}

function hextou8(data: string): Uint8Array {
  data
    = data.startsWith("0x") || data.startsWith("0X") ? data.substring(2) : data;
  const out = new Uint8Array(data.length / 2);
  for (let i = 0; i < out.length; ++i) {
    out[i] = Number.parseInt(data.substr(i * 2, 2), 16);
  }
  return out;
}

function bitou8(n: bigint | number): Uint8Array {
  let hv = n.toString(16);
  hv = "".padStart(hv.length % 2, "0") + hv;
  return hextou8(hv);
}

function cc(args: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (let i = 0; i < args.length; ++i) {
    totalLength += args[i].length;
  }
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < args.length; ++i) {
    out.set(args[i], offset);
    offset += args[i].length;
  }
  return out;
}

export function getLiveChatContinuation(origin: CVPair) {
  return b64e(
    ld(119693434, [ld(3, hdt(origin)), vt(6, 1), ld(16, vt(1, 4))]),
    B64Type.B1,
  );
}
