/* אלגוריתם איזון הכוחות. מגדיר את globalThis.TeamAlgo. */
(function () {
  'use strict';
  const FIT_NUM = { low: 1, mid: 2, high: 3 };
  const MIN_BALANCE = 95.2; /* רמת איזון מינימלית (%) — המדד החשוב ביותר */
  const TOP_N = 5;          /* התוצאה נבחרת באקראי מבין 5 החלוקות הטובות ביותר */
  /* עלות ביחידות של "אחוז איזון": כושר והעדפות רשות שוקלים מעט — לכל היותר בערך חצי אחוז איזון */
  const W_FIT = 0.5, W_SOFT = 0.3, W_HARD = 1000, W_VAR = 20;
  const TRIALS = 200;
  function setup(opts) {
    const byId = new Map((opts.players || []).map(p => [p.id, p]));
    const selected = (opts.selected || []).filter(i => byId.has(i));
    const rating = i => +(byId.get(i)?.rating) || 0;
    const fit = i => FIT_NUM[byId.get(i)?.fitness] || 2;
    const keep = opts.keep || {}, split = opts.split || {}, keepMust = opts.keepMust || {}, splitMust = opts.splitMust || {};
    const strict = !!opts.strict;
    const mean = (a, f) => a.length ? a.reduce((s, i) => s + f(i), 0) / a.length : 0;
    /* רמת איזון: 1 − (ממוצע גבוה − ממוצע נמוך) / ממוצע כללי — זהה לתצוגה באדמין */
    const balance = t => { const m = t.map(a => mean(a, rating)), av = (m[0] + m[1] + m[2]) / 3; return av > 0 ? (1 - (Math.max(...m) - Math.min(...m)) / av) * 100 : 100; };
    const fitGap = t => { const m = t.map(a => mean(a, fit)); return Math.max(...m) - Math.min(...m); };
    /* העדפות שיבוץ: keep — באותה קבוצה, split — בקבוצות שונות; *Must — חובה */
    function misses(t) {
      const where = {}; t.forEach((a, k) => a.forEach(i => where[i] = k)); let hard = 0, soft = 0;
      for (const a in keep) { const b = keep[a]; if (where[a] != null && where[b] != null && where[a] !== where[b]) keepMust[a] ? hard++ : soft++; }
      for (const a in split) { const b = split[a]; if (where[a] != null && where[b] != null && where[a] === where[b]) splitMust[a] ? hard++ : soft++; }
      return { hard, soft };
    }
    function cost(t) {
      const m = t.map(a => mean(a, rating)), av = (m[0] + m[1] + m[2]) / 3;
      let c = (100 - balance(t)) + W_FIT * fitGap(t) + W_VAR * m.reduce((s, x) => s + (x - av) ** 2, 0);
      if (strict) { const x = misses(t); c += W_HARD * x.hard + W_SOFT * x.soft; }
      return c;
    }
    return { selected, rating, balance, fitGap, misses, cost, strict };
  }
  const keyOf = t => t.map(g => [...g].sort().join(',')).sort().join('|');
  const shuffleArr = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /* opts: {players, selected, keep, split, keepMust, splitMust, strict, avoid}
     strict=true — "צור קבוצות"/"הגרל" (מתחשב בהעדפות); false — "הגרל שוב" (מתעלם מהן).
     avoid — החלוקה הנוכחית, כדי שהגרלה חוזרת תיתן תוצאה אחרת. מחזיר 3 קבוצות (מערכי id) או null. */
  function makeTeams(opts) {
    const S = setup(opts), sel = S.selected;
    if (sel.length < 3) return null;
    const ranked = [...sel].sort((a, b) => S.rating(b) - S.rating(a) || String(a).localeCompare(String(b)));
    const N = ranked.length, useAnchors = N >= 6;
    /* 3 החזקים ו-3 החלשים — אחד לכל קבוצה; החלפות רק בתוך אותה מחלקה */
    const top = useAnchors ? ranked.slice(0, 3) : [], bottom = useAnchors ? ranked.slice(N - 3) : [];
    const anchored = new Set([...top, ...bottom]), middle = ranked.filter(i => !anchored.has(i));
    const cls = i => top.includes(i) ? 0 : bottom.includes(i) ? 1 : 2;
    const cands = new Map();
    for (let trial = 0; trial < TRIALS; trial++) {
      const t = [[], [], []];
      if (useAnchors) { const to = shuffleArr([0, 1, 2]), bo = shuffleArr([0, 1, 2]); top.forEach((p, k) => t[to[k]].push(p)); bottom.forEach((p, k) => t[bo[k]].push(p)); }
      shuffleArr(middle).forEach(p => { t.reduce((m, x) => x.length < m.length ? x : m).push(p); });
      let cur = S.cost(t);
      for (let step = 0; step < 200; step++) {
        let improved = false;
        for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (let i = 0; i < t[a].length; i++) for (let j = 0; j < t[b].length; j++) {
          if (useAnchors && cls(t[a][i]) !== cls(t[b][j])) continue;
          [t[a][i], t[b][j]] = [t[b][j], t[a][i]];
          const v = S.cost(t);
          if (v + 1e-9 < cur) { cur = v; improved = true; } else[t[a][i], t[b][j]] = [t[b][j], t[a][i]];
        }
        if (!improved) break;
      }
      const k = keyOf(t);
      if (!cands.has(k)) cands.set(k, { t: t.map(x => [...x]), cost: cur, bal: S.balance(t), hard: S.strict ? S.misses(t).hard : 0 });
    }
    let pool = [...cands.values()];
    /* 1) חובה — כמה שפחות הפרות (רק אם זה לא מוריד מתחת לרמת האיזון המינימלית) */
    const okBal = pool.filter(c => c.bal >= MIN_BALANCE);
    if (okBal.length) {
      pool = okBal;
      if (S.strict) { const minHard = Math.min(...pool.map(c => c.hard)); pool = pool.filter(c => c.hard === minHard); }
    }
    /* 2) מיון לפי עלות (איזון קודם, אחר כך כושר והעדפות רשות) ובחירה אקראית מבין 5 הטובות */
    pool.sort((a, b) => a.cost - b.cost);
    const avoidKey = opts.avoid && opts.avoid.length === 3 ? keyOf(opts.avoid) : null;
    if (avoidKey && pool.length > 1) pool = pool.filter(c => keyOf(c.t) !== avoidKey);
    const top5 = pool.slice(0, TOP_N);
    return top5[Math.floor(Math.random() * top5.length)].t;
  }
  /* מדדים לחלוקה קיימת: רמת איזון (%), פער כושר, והפרות העדפה (חובה/רשות) */
  function check(teams, opts) {
    const S = setup({ ...opts, strict: true });
    const m = S.misses(teams);
    return { balance: S.balance(teams), fitGap: S.fitGap(teams), hardMiss: m.hard, softMiss: m.soft, minBalance: MIN_BALANCE };
  }
  /* הגרלה ממצב מחזור שמור (round): strict=true בהגרלה ראשונה; avoid = החלוקה הנוכחית */
  function fromRound(players, round, strict, avoid) {
    const ids = new Set((players || []).map(p => p.id));
    return makeTeams({ players, selected: (round.selected || []).filter(i => ids.has(i)), keep: round.keep, split: round.split, keepMust: round.keepMust, splitMust: round.splitMust, strict, avoid });
  }

  globalThis.TeamAlgo = { makeTeams, fromRound, check, FIT_NUM, MIN_BALANCE };
})();
