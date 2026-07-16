export const LETTER_SEQUENCE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const LETTER_LIBRARY = {
  A: {
    strokes: [
      { hint: "Trace the left slant down.", points: [[26, 92], [50, 10]] },
      { hint: "Trace the right slant down.", points: [[50, 10], [74, 92]] },
      { hint: "Trace the middle line across.", points: [[36, 56], [64, 56]] },
    ],
  },
  B: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the top bump.", points: [[24, 10], [58, 10], [70, 20], [70, 38], [58, 48], [24, 48]] },
      { hint: "Trace the bottom bump.", points: [[24, 48], [60, 48], [74, 60], [74, 82], [60, 92], [24, 92]] },
    ],
  },
  C: {
    strokes: [
      { hint: "Trace the big curve around.", points: [[72, 18], [58, 10], [36, 12], [22, 28], [18, 50], [22, 74], [36, 90], [58, 92], [72, 84]] },
    ],
  },
  D: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the curve around.", points: [[24, 10], [52, 10], [72, 26], [76, 50], [72, 76], [52, 92], [24, 92]] },
    ],
  },
  E: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the top line across.", points: [[24, 10], [74, 10]] },
      { hint: "Trace the middle line across.", points: [[24, 50], [62, 50]] },
      { hint: "Trace the bottom line across.", points: [[24, 92], [74, 92]] },
    ],
  },
  F: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the top line across.", points: [[24, 10], [74, 10]] },
      { hint: "Trace the middle line across.", points: [[24, 50], [60, 50]] },
    ],
  },
  G: {
    strokes: [
      { hint: "Trace the big curve around.", points: [[72, 18], [58, 10], [36, 12], [22, 28], [18, 50], [22, 74], [36, 90], [58, 92], [72, 84], [72, 60]] },
      { hint: "Trace the short line in.", points: [[72, 60], [54, 60]] },
    ],
  },
  H: {
    strokes: [
      { hint: "Trace the left line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the right line down.", points: [[74, 10], [74, 92]] },
      { hint: "Trace the middle line across.", points: [[24, 50], [74, 50]] },
    ],
  },
  I: {
    strokes: [
      { hint: "Trace the top line across.", points: [[22, 10], [76, 10]] },
      { hint: "Trace the middle line down.", points: [[49, 10], [49, 92]] },
      { hint: "Trace the bottom line across.", points: [[22, 92], [76, 92]] },
    ],
  },
  J: {
    strokes: [
      { hint: "Trace the top line across.", points: [[26, 10], [76, 10]] },
      { hint: "Trace the curve down and around.", points: [[56, 10], [56, 78], [48, 90], [34, 92], [22, 82]] },
    ],
  },
  K: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the upper diagonal.", points: [[24, 54], [74, 10]] },
      { hint: "Trace the lower diagonal.", points: [[24, 54], [74, 92]] },
    ],
  },
  L: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the bottom line across.", points: [[24, 92], [74, 92]] },
    ],
  },
  M: {
    strokes: [
      { hint: "Trace the left line down.", points: [[20, 92], [20, 10]] },
      { hint: "Trace the first diagonal up.", points: [[20, 10], [48, 54]] },
      { hint: "Trace the second diagonal down.", points: [[48, 54], [76, 10]] },
      { hint: "Trace the right line down.", points: [[76, 10], [76, 92]] },
    ],
  },
  N: {
    strokes: [
      { hint: "Trace the left line down.", points: [[24, 92], [24, 10]] },
      { hint: "Trace the diagonal across.", points: [[24, 10], [74, 92]] },
      { hint: "Trace the right line down.", points: [[74, 92], [74, 10]] },
    ],
  },
  O: {
    strokes: [
      { hint: "Trace the round shape around.", points: [[50, 10], [68, 16], [80, 30], [84, 50], [80, 72], [68, 86], [50, 92], [32, 86], [20, 72], [16, 50], [20, 30], [32, 16], [50, 10]] },
    ],
  },
  P: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the top loop.", points: [[24, 10], [58, 10], [72, 22], [72, 40], [58, 52], [24, 52]] },
    ],
  },
  Q: {
    strokes: [
      { hint: "Trace the round shape around.", points: [[50, 10], [68, 16], [80, 30], [84, 50], [80, 72], [68, 86], [50, 92], [32, 86], [20, 72], [16, 50], [20, 30], [32, 16], [50, 10]] },
      { hint: "Trace the small tail.", points: [[58, 76], [78, 96]] },
    ],
  },
  R: {
    strokes: [
      { hint: "Trace the tall line down.", points: [[24, 10], [24, 92]] },
      { hint: "Trace the top loop.", points: [[24, 10], [58, 10], [72, 22], [72, 40], [58, 52], [24, 52]] },
      { hint: "Trace the diagonal leg.", points: [[24, 52], [74, 92]] },
    ],
  },
  S: {
    strokes: [
      { hint: "Trace the winding curve.", points: [[74, 18], [58, 10], [36, 12], [24, 26], [30, 42], [48, 50], [66, 58], [72, 74], [60, 88], [36, 90], [20, 82]] },
    ],
  },
  T: {
    strokes: [
      { hint: "Trace the top line across.", points: [[20, 10], [80, 10]] },
      { hint: "Trace the middle line down.", points: [[50, 10], [50, 92]] },
    ],
  },
  U: {
    strokes: [
      { hint: "Trace the curve down and up.", points: [[24, 10], [24, 66], [32, 84], [50, 92], [68, 84], [76, 66], [76, 10]] },
    ],
  },
  V: {
    strokes: [
      { hint: "Trace the left slant down.", points: [[22, 10], [50, 92]] },
      { hint: "Trace the right slant up.", points: [[50, 92], [78, 10]] },
    ],
  },
  W: {
    strokes: [
      { hint: "Trace the first slant down.", points: [[16, 10], [30, 92]] },
      { hint: "Trace the second slant up.", points: [[30, 92], [50, 34]] },
      { hint: "Trace the third slant down.", points: [[50, 34], [70, 92]] },
      { hint: "Trace the last slant up.", points: [[70, 92], [84, 10]] },
    ],
  },
  X: {
    strokes: [
      { hint: "Trace the first diagonal.", points: [[22, 10], [78, 92]] },
      { hint: "Trace the second diagonal.", points: [[78, 10], [22, 92]] },
    ],
  },
  Y: {
    strokes: [
      { hint: "Trace the left diagonal.", points: [[24, 10], [50, 44]] },
      { hint: "Trace the right diagonal.", points: [[76, 10], [50, 44]] },
      { hint: "Trace the line down.", points: [[50, 44], [50, 92]] },
    ],
  },
  Z: {
    strokes: [
      { hint: "Trace the top line across.", points: [[20, 10], [80, 10]] },
      { hint: "Trace the diagonal down.", points: [[80, 10], [20, 92]] },
      { hint: "Trace the bottom line across.", points: [[20, 92], [80, 92]] },
    ],
  },
};

export const LOWERCASE_LETTER_SEQUENCE = "abcdefghijklmnopqrstuvwxyz".split("");

export const LOWERCASE_LETTER_LIBRARY = {
  a: { strokes: [{ hint: "Trace the round part.", points: [[64, 48], [56, 40], [40, 40], [28, 50], [28, 66], [40, 76], [56, 76], [64, 66], [64, 48]] }, { hint: "Trace the short line down.", points: [[64, 48], [64, 76]] }] },
  b: { strokes: [{ hint: "Trace the tall line down.", points: [[28, 12], [28, 76]] }, { hint: "Trace the round bump.", points: [[28, 48], [40, 40], [56, 40], [68, 50], [68, 66], [56, 76], [40, 76], [28, 68]] }] },
  c: { strokes: [{ hint: "Trace the little curve around.", points: [[66, 48], [56, 40], [40, 40], [28, 50], [28, 66], [40, 76], [56, 76], [66, 68]] }] },
  d: { strokes: [{ hint: "Trace the round part.", points: [[64, 48], [56, 40], [40, 40], [28, 50], [28, 66], [40, 76], [56, 76], [64, 66], [64, 48]] }, { hint: "Trace the tall line up.", points: [[64, 76], [64, 12]] }] },
  e: { strokes: [{ hint: "Trace the little loop.", points: [[30, 58], [66, 58], [60, 44], [42, 40], [28, 52], [30, 68], [42, 76], [58, 76], [68, 68]] }] },
  f: { strokes: [{ hint: "Trace the tall curve down.", points: [[56, 12], [44, 12], [38, 22], [38, 76]] }, { hint: "Trace the short line across.", points: [[26, 42], [60, 42]] }] },
  g: { strokes: [{ hint: "Trace the round part.", points: [[64, 48], [56, 40], [40, 40], [28, 50], [28, 66], [40, 76], [56, 76], [64, 66], [64, 48]] }, { hint: "Trace the tail down and around.", points: [[64, 48], [64, 88], [56, 96], [40, 96], [32, 88]] }] },
  h: { strokes: [{ hint: "Trace the tall line down.", points: [[28, 12], [28, 76]] }, { hint: "Trace the hump over.", points: [[28, 50], [40, 40], [56, 42], [64, 52], [64, 76]] }] },
  i: { strokes: [{ hint: "Trace the short line down.", points: [[48, 40], [48, 76]] }, { hint: "Trace the dot.", points: [[48, 22], [48, 22]] }] },
  j: { strokes: [{ hint: "Trace the line down and curve around.", points: [[52, 40], [52, 88], [44, 96], [32, 96]] }, { hint: "Trace the dot.", points: [[52, 22], [52, 22]] }] },
  k: { strokes: [{ hint: "Trace the tall line down.", points: [[28, 12], [28, 76]] }, { hint: "Trace the upper slant.", points: [[64, 40], [28, 60]] }, { hint: "Trace the lower slant.", points: [[40, 56], [66, 76]] }] },
  l: { strokes: [{ hint: "Trace the tall line down.", points: [[48, 12], [48, 76]] }] },
  m: { strokes: [{ hint: "Trace the first line and hump.", points: [[24, 76], [24, 42], [36, 40], [46, 50], [46, 76]] }, { hint: "Trace the second hump.", points: [[46, 50], [56, 40], [68, 50], [68, 76]] }] },
  n: { strokes: [{ hint: "Trace the line up and down.", points: [[30, 76], [30, 42], [30, 76]] }, { hint: "Trace the hump over.", points: [[30, 50], [42, 40], [58, 42], [66, 52], [66, 76]] }] },
  o: { strokes: [{ hint: "Trace the little round shape.", points: [[48, 40], [62, 44], [70, 56], [68, 68], [56, 76], [40, 76], [28, 66], [26, 54], [34, 44], [48, 40]] }] },
  p: { strokes: [{ hint: "Trace the long line down.", points: [[28, 40], [28, 96]] }, { hint: "Trace the round bump.", points: [[28, 48], [40, 40], [56, 42], [66, 52], [66, 64], [56, 76], [40, 76], [28, 68]] }] },
  q: { strokes: [{ hint: "Trace the round part.", points: [[60, 48], [52, 40], [38, 40], [28, 50], [28, 66], [38, 76], [52, 76], [60, 66], [60, 48]] }, { hint: "Trace the tail down.", points: [[60, 40], [60, 96]] }] },
  r: { strokes: [{ hint: "Trace the short line up and down.", points: [[30, 76], [30, 42], [30, 76]] }, { hint: "Trace the little curve over.", points: [[30, 50], [42, 40], [58, 44], [64, 50]] }] },
  s: { strokes: [{ hint: "Trace the winding curve.", points: [[64, 46], [54, 40], [40, 42], [32, 50], [40, 58], [56, 60], [64, 68], [56, 76], [40, 76], [30, 70]] }] },
  t: { strokes: [{ hint: "Trace the tall line down.", points: [[48, 18], [48, 72], [56, 76]] }, { hint: "Trace the short line across.", points: [[32, 42], [62, 42]] }] },
  u: { strokes: [{ hint: "Trace the curve down and up.", points: [[30, 40], [30, 66], [40, 76], [54, 76], [64, 66], [64, 40]] }, { hint: "Trace the short line down.", points: [[64, 40], [64, 76]] }] },
  v: { strokes: [{ hint: "Trace the left slant down.", points: [[28, 40], [48, 76]] }, { hint: "Trace the right slant up.", points: [[48, 76], [68, 40]] }] },
  w: { strokes: [{ hint: "Trace the first slant down.", points: [[20, 40], [34, 76]] }, { hint: "Trace the next slant up.", points: [[34, 76], [48, 48]] }, { hint: "Trace the next slant down.", points: [[48, 48], [62, 76]] }, { hint: "Trace the last slant up.", points: [[62, 76], [76, 40]] }] },
  x: { strokes: [{ hint: "Trace the first diagonal.", points: [[30, 40], [66, 76]] }, { hint: "Trace the second diagonal.", points: [[66, 40], [30, 76]] }] },
  y: { strokes: [{ hint: "Trace the first curve down and up.", points: [[28, 40], [40, 70], [52, 76], [64, 40]] }, { hint: "Trace the tail down and around.", points: [[64, 40], [56, 88], [48, 96], [34, 96]] }] },
  z: { strokes: [{ hint: "Trace the top line across.", points: [[28, 40], [68, 40]] }, { hint: "Trace the diagonal down.", points: [[68, 40], [28, 76]] }, { hint: "Trace the bottom line across.", points: [[28, 76], [68, 76]] }] },
};
