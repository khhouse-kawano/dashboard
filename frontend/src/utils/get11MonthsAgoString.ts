/**
 * 11か月前の年月（'YYYY-MM'）。日本時間で数える。
 *
 * ⚠️ v2.2.277: 以前は日付を1日にしてから toISOString()（UTC）で文字にしていたため、
 *   日本時間の0〜9時に開くと UTC では前月の末日になり、どの日でも1か月前にずれていた（12か月前になる）。
 *   ⚠️ 日本時間（UTC+9）の年月から数えるようにした。
 */
export const get11MonthsAgoString = (date: Date = new Date()) => {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  // ⚠️ jst は「UTC の値として日本時間を持つ」日付。年月は getUTC* で読む
  const monthIndex = jst.getUTCFullYear() * 12 + jst.getUTCMonth() - 11;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12 + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
};
