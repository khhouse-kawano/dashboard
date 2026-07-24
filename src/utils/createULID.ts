const CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const encodeRandom = (length: number) => {
  let out = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    out += CHARS[array[i] & 31];
  }
  return out;
};

export const generateULID = () => {
  const prefix = "01";              // ← 必ず 01 で始まる
  const timePart = encodeRandom(8); // ← 本来の ULID 時間部分の残り
  const randomPart = encodeRandom(16);
  return prefix + timePart + randomPart;
};
