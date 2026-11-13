// SIMBAD script/ASCII response parsing — shared by the Worker proxy and tests.

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseSimbadIcrs(raPart, decPart) {
  const whole = decPart ? `${raPart}  ${decPart}` : raPart;
  const sex = /(\d+)\s+(\d+)\s+([0-9.]+)\s+([+-]?\d+)\s+(\d+)\s+([0-9.]+)/.exec(whole);
  if (sex) {
    const rah = Number(sex[1]) + Number(sex[2]) / 60 + Number(sex[3]) / 3600;
    const sign = String(sex[4]).startsWith('-') ? -1 : 1;
    const decAbs = Math.abs(Number(sex[4])) + Number(sex[5]) / 60 + Number(sex[6]) / 3600;
    return { ra: rah * 15, dec: sign * decAbs };
  }
  const deg = /([0-9.+-]+)\s+([0-9.+-]+)/.exec(whole);
  if (deg) return { ra: Number(deg[1]), dec: Number(deg[2]) };
  return { ra: null, dec: null };
}

/** Parse the compact SIMBAD script/ASCII response. */
export function parseSimbadAscii(text) {
  if (!text || /No astronomical object found/i.test(text)) return null;
  if (/error/i.test(text) && /not found/i.test(text)) return null;

  const pick = (re) => {
    const m = re.exec(text);
    return m ? m[1].trim() : null;
  };
  const main = pick(/^Object\s+(.+)$/m) || pick(/^Identifier\s*\(.*?\)\s*:\s*(.+)$/m);
  const otype = pick(/^Object type:\s*(.+)$/m) || pick(/^otype:\s*(.+)$/m);
  const spectral = pick(/^Spectral type:\s*(\S+)/m) || pick(/^sp_type:\s*(\S+)/m);
  const coord = /Coordinates\(ICRS[^)]*\):\s*([0-9\s.+-]+?)\s{2,}([0-9\s.+-]+)/.exec(text)
    || /Coordinates\(ICRS[^)]*\):\s*([^\n]+)/.exec(text);
  let ra = null;
  let dec = null;
  if (coord) {
    const parsed = parseSimbadIcrs(coord[1], coord[2]);
    ra = parsed.ra;
    dec = parsed.dec;
  }
  if (!main && otype == null && spectral == null && ra == null) {
    const main2 = pick(/^main_id\s*:\s*(.+)$/m);
    if (!main2) return null;
    return {
      main_id: main2,
      otype: pick(/^otype\s*:\s*(.+)$/m),
      spectral_type: pick(/^sp_type\s*:\s*(\S+)/m),
      ra: num(pick(/^ra\s*:\s*([0-9.+-]+)/m)),
      dec: num(pick(/^dec\s*:\s*([0-9.+-]+)/m)),
    };
  }
  return { main_id: main, otype, spectral_type: spectral, ra, dec };
}
