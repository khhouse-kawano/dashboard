export const getFiscalYearMonthsFromJune = (year) => {
  const months: string[] = [];
  const startYear = year - 1; // 年度は前年6月から始まる

  // 前年6月〜12月
  for (let m = 6; m <= 12; m++) {
    months.push(`${startYear}/${String(m).padStart(2, '0')}`);
  }

  // 当年1月〜5月
  for (let m = 1; m <= 5; m++) {
    months.push(`${year}/${String(m).padStart(2, '0')}`);
  }

  return months;
};
