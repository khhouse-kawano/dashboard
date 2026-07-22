export const get11MonthsAgoString = (date: Date = new Date()) => {
  const d = new Date(date);
  d.setDate(1);                 // ★ まず1日に固定（丸め防止）
  d.setMonth(d.getMonth() - 11);
  return d.toISOString().slice(0, 7);
};
