interface CryptoIdSource {
  randomUUID?: () => string;
  getRandomValues?: Crypto["getRandomValues"];
}

let fallbackSequence = 0;

function formatUuid(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .replace(
      /^(........)(....)(....)(....)(............)$/,
      "$1-$2-$3-$4-$5"
    );
}

/** Creates a unique ID without assuming crypto.randomUUID support. */
export function createId(
  prefix: string,
  cryptoSource: CryptoIdSource | null | undefined = globalThis.crypto
): string {
  if (typeof cryptoSource?.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }

  if (typeof cryptoSource?.getRandomValues === "function") {
    const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuid(bytes);
  }

  fallbackSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackSequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
