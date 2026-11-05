// 計算の移し替え（yorozu-plans D484・企画書 102 の 4 章）の同値性: 同じ入力の出力を、移す前の元のファイルと移した後の正本で突き合わせる
// 使い方: cases(mods) → { 名前: 出力 }。mods = { loan, pension, kaitei, gakunen, yakudoshi }（pension・gakunen・yakudoshi は値を __values・__K に添える）
// calc-before.json は、移す前の元のファイル（loan-sim 82a4466 の calc.js、seido-keisan ec10790 の lib/kuriage.js・kuriage-values.js・kaitei-values.js、
// gengo 0d637e5 の calc.js・constants.js）にこの入力を通した出力の JSON の SHA-256（先頭 16 桁）。2026-11-05 に 1 回だけ作った。作り直さない（作り直すと突き合わせにならない）
const J = (x) => JSON.parse(JSON.stringify(x));
const MAN = 10000;
function loanCases(C) {
  const base = (o) => Object.assign({ principal: 3000 * MAN, months: 420, method: 'annuity', rates: [{ from: 1, rate: 1.0 }], rule5: false, rule125: false, prepayments: [], prepayFee: 0 }, o);
  const inputs = [
    base(),
    base({ principal: 2000 * MAN, months: 300, rates: [{ from: 1, rate: 0.5 }] }),
    base({ method: 'principal' }),
    base({ rates: [{ from: 1, rate: 0.5 }, { from: 61, rate: 2.5 }, { from: 121, rate: 4 }], rule5: true, rule125: true }),
    base({ rates: [{ from: 1, rate: 0.4 }, { from: 13, rate: 6 }], rule5: true, rule125: true }),
    base({ prepayments: [{ month: 60, amount: 300 * MAN, type: 'shorten' }, { month: 120, amount: 200 * MAN, type: 'reduce' }], prepayFee: 33000 }),
    base({ method: 'principal', prepayments: [{ month: 24, amount: 500 * MAN, type: 'reduce' }] }),
    base({ rates: [{ from: 1, rate: 0 }], months: 120 }),
    base({ principal: 0 }),
    base({ prepayments: [{ month: 12, amount: 9999 * MAN, type: 'shorten' }] }),
  ];
  const out = {};
  inputs.forEach((x, i) => {
    const r = C.simulate(x);
    out['loan.simulate.' + i] = J(r);
    if (r.rows.length) out['loan.yearly.' + i] = J(C.yearly(r.rows, 2026, 4));
  });
  out['loan.toCSV.0'] = C.toCSV(C.simulate(inputs[0]).rows, 2026, 4);
  out['loan.annuityPayment'] = [C.annuityPayment(3e7, 0.01 / 12, 420), C.annuityPayment(1e7, 0, 100), C.annuityPayment(5e6, 0.02 / 12, 0)];
  out['loan.monthsToRepay'] = J([C.monthsToRepay(3e7, 0.01 / 12, 84686), C.monthsToRepay(1e6, 0, 3000), C.monthsToRepay(1e7, 0.05 / 12, 10), C.monthsToRepay(0, 0.01, 1)]);
  out['loan.loanFromPurchase'] = [C.loanFromPurchase(4000 * MAN, 500 * MAN, 200 * MAN), C.loanFromPurchase('3000', '', '0')];
  return out;
}
function pensionCases(C) {
  const out = {};
  const births = ['1952-04-01', '1962-04-01', '1962-04-02', '1966-05-10', '1970-01-20', '1985-07-31', '1990-02-29', '1999-12-01'];
  let i = 0;
  for (const birth of births) for (const age of [60, 62, 64, 65, 66, 68, 70, 72, 75]) for (const mon of [0, 6]) {
    out['pension.calc.' + (i++)] = J(C.calc({ birth, kiso: 831700, kosei: 1200000, age, mon }, '2026-11'));
  }
  out['pension.calc.sep'] = J(C.calc({ birth: '1966-05-10', kiso: 847300, kosei: 1200000, age: 65, sep: true, kAge: 70, kMon: 3 }, '2026-11'));
  out['pension.calc.zairo'] = J(C.calc({ birth: '1966-05-10', kiso: 847300, kosei: 2400000, age: 70, wage: 600000, workTo: 70 }, '2026-11'));
  out['pension.calc.kisoOnly'] = J(C.calc({ birth: '1970-01-20', kiso: 847301, age: 60 }, '2026-11'));
  out['pension.kuriageRate'] = births.map((b) => J([C.kuriageRate && C.kuriageRate(b), C.kurisageMax(b)]));
  out['pension.values'] = J(C.__values);
  return out;
}
function gakunenCases(G) {
  const out = {};
  for (let fy = 2018; fy <= 2032; fy++) out['gakunen.gradeTable.' + fy] = J(G.gradeTable(fy));
  const births = [];
  for (const [y, m, d] of [[2019, 4, 1], [2019, 4, 2], [2020, 4, 1], [2020, 2, 29], [2018, 12, 31], [2010, 1, 1], [1985, 4, 2], [2000, 4, 1], [2024, 7, 15]]) births.push({ y, m, d });
  births.forEach((b, i) => {
    out['gakunen.isHayaumare.' + i] = G.isHayaumare(b);
    out['gakunen.schoolEntryYear.' + i] = G.schoolEntryYear(b);
    out['gakunen.schoolHistory.' + i] = J(G.schoolHistory(b));
    out['gakunen.gradeAt.' + i] = [[2026, 3, 31], [2026, 4, 1], [2026, 4, 2], [2030, 11, 5], [2045, 6, 1], [1980, 1, 1]].map(([y, m, d]) => J(G.gradeAt(b, { y, m, d })));
    out['gakunen.gradeNumber.' + i] = [2020, 2026, 2040].map((fy) => G.gradeNumber(b, fy));
    for (const final of ['high', 'senmon', 'tandai', 'kosen', 'univ4', 'univ6', 'master', 'doctor', 'doctor6', 'nope', undefined]) out['gakunen.resumeHistory.' + i + '.' + final] = J(G.resumeHistory(b, { final }));
    out['gakunen.resumeHistory.' + i + '.opt'] = J(G.resumeHistory(b, { final: 'master', years: { high: 4, univ4: 5, junior: 'x' }, ronin: 2 }));
  });
  out['gakunen.resumeHistory.invalid'] = J(G.resumeHistory({ y: 2001, m: 2, d: 29 }, {}));
  out['gakunen.fiscalYearOf'] = [[2026, 3, 31], [2026, 4, 1], [2026, 12, 31]].map(([y, m, d]) => G.fiscalYearOf({ y, m, d }));
  out['gakunen.values'] = J([G.__K.schoolLength, G.__K.gradSchoolLength]);
  return out;
}
function yakudoshiCases(Y) {
  const out = {};
  for (let y = 2020; y <= 2032; y++) {
    out['yakudoshi.yakuTable.' + y] = J([Y.yakuTable(y), Y.yakuTable(y, 'kazoe'), Y.yakuTable(y, 'mannen')]);
    out['yakudoshi.toshiiwaiTable.' + y] = J(Y.toshiiwaiTable(y));
  }
  for (const by of [1957, 1965, 1966, 1984, 1985, 1990, 1994, 2001, 2008]) for (const y of [2025, 2026, 2027]) {
    out['yakudoshi.yakuOf.' + by + '.' + y] = J([Y.yakuOf(by, 'male', y), Y.yakuOf(by, 'female', y), Y.yakuOf(by, 'male', y, 'mannen'), Y.yakuOf(by, 'female', y, 'mannen')]);
    out['yakudoshi.toshiiwaiOf.' + by + '.' + y] = J(Y.toshiiwaiOf(by, y));
    out['yakudoshi.kazoeAge.' + by + '.' + y] = Y.kazoeAge(by, y);
  }
  out['yakudoshi.values'] = J([Y.__K.yakudoshi, Y.__K.toshiiwai]);
  return out;
}
module.exports = function cases(m) {
  return Object.assign({}, loanCases(m.loan), pensionCases(m.pension), { 'kaitei.values': J(m.kaitei) }, gakunenCases(m.gakunen), yakudoshiCases(m.yakudoshi));
};
