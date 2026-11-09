/* אלגוריתם איזון הכוחות. מגדיר את globalThis.TeamAlgo. */
(function () {
  'use strict';
  const FIT_NUM = { low: 1, mid: 2, high: 3 };
  const W_BALANCE = 20, W_SPREAD = 0.3, W_FITNESS = 2.2, PREF_W = 60;
  const TOLERANCE = 0.10; /* עד 10% סטייה בין ממוצעי הדירוג (רמת איזון ≥ 90%) */
  const FIT_TOL = 0.5;    /* פער ממוצעי כושר (סולם 1–3) בין הקבוצות */

  /* opts: {players:[{id,rating,fitness}], selected:[id], keep:{id:id}, split:{id:id}, strict:bool}
     מחזיר מערך של 3 קבוצות (מערכי id), או null אם יש פחות מ-3 שחקנים */
  function makeTeams(opts) {
    const byId = new Map((opts.players || []).map(p => [p.id, p]));
    const selected = (opts.selected || []).filter(i => byId.has(i));
    const keep = opts.keep || {}, split = opts.split || {}, strict = !!opts.strict;
    if (selected.length < 3) return null;
    const rating = i => +(byId.get(i)?.rating) || 0;
    const fit = i => FIT_NUM[byId.get(i)?.fitness] || 2;
    const sum = t => t.reduce((s, i) => s + rating(i), 0);
    const fitSum = t => t.reduce((s, i) => s + fit(i), 0);
    const shuffleArr = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    /* העדפות שיבוץ: keep — באותה קבוצה, split — בקבוצות שונות */
    function prefMisses(t) {
      const where = {}; t.forEach((a, k) => a.forEach(i => where[i] = k)); let v = 0;
      for (const a in keep) { const b = keep[a]; if (where[a] != null && where[b] != null && where[a] !== where[b]) v++; }
      for (const a in split) { const b = split[a]; if (where[a] != null && where[b] != null && where[a] === where[b]) v++; }
      return v;
    }
    const overall = selected.map(rating).sort((a, b) => b - a);
    const cut1 = overall[Math.floor(overall.length / 3) - 1] ?? 5, cut2 = overall[Math.floor(overall.length * 2 / 3) - 1] ?? 0;
    function score(t) {
      const means = t.map(a => a.length ? sum(a) / a.length : 0), avg = means.reduce((a, b) => a + b, 0) / 3;
      let c = means.reduce((s, x) => s + (x - avg) ** 2, 0) * W_BALANCE;
      for (const threshold of [cut1, cut2]) {
        const counts = t.map(a => a.filter(i => rating(i) >= threshold).length);
        c += counts.reduce((s, x) => s + (x - counts.reduce((a, b) => a + b, 0) / 3) ** 2, 0) * W_SPREAD;
      }
      /* איזון כושר גופני בין הקבוצות */
      const fitSums = t.map(fitSum), fitAvg = fitSums.reduce((a, b) => a + b, 0) / 3;
      c += fitSums.reduce((s, x) => s + (x - fitAvg) ** 2, 0) * W_FITNESS;
      /* העדפות — רק במצב strict */
      if (strict) c += prefMisses(t) * PREF_W;
      return c;
    }

    const ranked = [...selected].sort((a, b) => rating(b) - rating(a) || String(a).localeCompare(String(b)));
    const N = ranked.length, useAnchors = N >= 6;
    const topAnchors = useAnchors ? ranked.slice(0, 3) : [], bottomAnchors = useAnchors ? ranked.slice(N - 3) : [];
    const anchorSet = new Set([...topAnchors, ...bottomAnchors]);
    const middle = ranked.filter(i => !anchorSet.has(i));
    const cls = i => topAnchors.indexOf(i) >= 0 ? 0 : bottomAnchors.indexOf(i) >= 0 ? 1 : 2; /* 0 עליון · 1 תחתון · 2 אמצע */
    /* סטיית הממוצעים (max-min)/avg, ופער ממוצעי הכושר — לסינון מועמדים */
    const meanSpread = t => { const m = t.map(a => a.length ? sum(a) / a.length : 0), av = (m[0] + m[1] + m[2]) / 3; return av > 0 ? (Math.max(...m) - Math.min(...m)) / av : 0; };
    const fitSpread = t => { const m = t.map(a => a.length ? fitSum(a) / a.length : 0); return Math.max(...m) - Math.min(...m); };
    const inRange = t => meanSpread(t) <= TOLERANCE && fitSpread(t) <= FIT_TOL;

    let best = null, bestCost = Infinity; const candidates = [];
    const consider = t => { if (inRange(t)) candidates.push({ t: t.map(x => [...x]), v: strict ? prefMisses(t) : 0 }); };
    for (let trial = 0; trial < 120; trial++) {
      const t = [[], [], []];
      if (useAnchors) { const to = shuffleArr([0, 1, 2]), bo = shuffleArr([0, 1, 2]); topAnchors.forEach((pid, k) => t[to[k]].push(pid)); bottomAnchors.forEach((pid, k) => t[bo[k]].push(pid)); }
      shuffleArr(middle).forEach(pid => { t.reduce((m, x) => x.length < m.length ? x : m).push(pid); });
      /* גם החלוקה האקראית הגולמית (לפני שיפור) היא מועמדת אם היא בטווח — מגדיל את הרנדומליות */
      consider(t);
      let cur = score(t);
      for (let step = 0; step < 200; step++) {
        let improvement = false;
        for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (let i = 0; i < t[a].length; i++) for (let j = 0; j < t[b].length; j++) {
          if (useAnchors && cls(t[a][i]) !== cls(t[b][j])) continue;
          [t[a][i], t[b][j]] = [t[b][j], t[a][i]]; const v = score(t);
          if (v + 1e-9 < cur) { cur = v; improvement = true; } else[t[a][i], t[b][j]] = [t[b][j], t[a][i]];
        }
        if (!improvement) break;
      }
      if (cur < bestCost) { bestCost = cur; best = t.map(x => [...x]); }
      consider(t);
    }
    /* במצב strict: רק המועמדים עם מינימום החטאות העדפה; ואז בחירה אקראית ביניהם */
    let pool = candidates;
    if (strict && pool.length) { const minV = Math.min(...pool.map(c => c.v)); pool = pool.filter(c => c.v === minV); if (best && prefMisses(best) < minV) pool = []; }
    const teams = pool.length ? pool[Math.floor(Math.random() * pool.length)].t : best;
    /* הליכה אקראית: החלפות בתוך אותה מחלקה שנשארות בטווח — מגוון בין הגרלות */
    const baseV = strict ? prefMisses(teams) : 0;
    for (let k = 0; k < 400; k++) {
      const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3, i = Math.floor(Math.random() * teams[a].length), j = Math.floor(Math.random() * teams[b].length);
      if (useAnchors && cls(teams[a][i]) !== cls(teams[b][j])) continue;
      [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
      if (!inRange(teams) || (strict && prefMisses(teams) > baseV)) [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
    }
    return teams;
  }

  /* הגרלה ממצב מחזור שמור (round): strict=true בהגרלה ראשונה */
  function fromRound(players, round, strict) {
    const ids = new Set((players || []).map(p => p.id));
    return makeTeams({ players, selected: (round.selected || []).filter(i => ids.has(i)), keep: round.keep, split: round.split, strict });
  }

  globalThis.TeamAlgo = { makeTeams, fromRound, FIT_NUM };
})();
