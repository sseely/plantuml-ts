const EPS = 1e-7;
const M_PI = Math.PI;

function aeq0(x: number): boolean {
  return x < EPS && x > -EPS;
}

function cbrt_signed(x: number): number {
  return x < 0 ? -Math.pow(-x, 1.0 / 3.0) : Math.pow(x, 1.0 / 3.0);
}

function solve1(coeff: number[], roots: number[]): number {
  const a = coeff[1]!;
  const b = coeff[0]!;
  if (aeq0(a)) {
    if (aeq0(b)) return 4;
    else return 0;
  }
  roots[0] = -b / a;
  return 1;
}

function solve2(coeff: number[], roots: number[]): number {
  const a = coeff[2]!;
  const b = coeff[1]!;
  const c = coeff[0]!;
  if (aeq0(a)) return solve1(coeff, roots);
  const b_over_2a = b / (2 * a);
  const c_over_a = c / a;
  const disc = b_over_2a * b_over_2a - c_over_a;
  if (disc < 0) return 0;
  if (disc === 0) {
    roots[0] = -b_over_2a;
    return 1;
  }
  roots[0] = -b_over_2a + Math.sqrt(disc);
  roots[1] = -2 * b_over_2a - roots[0];
  return 2;
}

export function solve3(coeff: number[], roots: number[]): number {
  const a = coeff[3]!;
  const b = coeff[2]!;
  const c = coeff[1]!;
  const d = coeff[0]!;
  if (aeq0(a)) return solve2(coeff, roots);
  const b_over_3a = b / (3 * a);
  const c_over_a = c / a;
  const d_over_a = d / a;

  let p = b_over_3a * b_over_3a;
  const q = 2 * b_over_3a * p - b_over_3a * c_over_a + d_over_a;
  p = c_over_a / 3 - p;
  const disc = q * q + 4 * p * p * p;

  let rootn: number;
  if (disc < 0) {
    const r = 0.5 * Math.sqrt(-disc + q * q);
    const theta = Math.atan2(Math.sqrt(-disc), -q);
    const temp = 2 * cbrt_signed(r);
    roots[0] = temp * Math.cos(theta / 3);
    roots[1] = temp * Math.cos((theta + M_PI + M_PI) / 3);
    roots[2] = temp * Math.cos((theta - M_PI - M_PI) / 3);
    rootn = 3;
  } else {
    const alpha = 0.5 * (Math.sqrt(disc) - q);
    const beta = -q - alpha;
    roots[0] = cbrt_signed(alpha) + cbrt_signed(beta);
    if (disc > 0) {
      rootn = 1;
    } else {
      roots[1] = roots[2] = -0.5 * roots[0];
      rootn = 3;
    }
  }

  for (let i = 0; i < rootn; i++) {
    roots[i] = (roots[i] ?? 0) - b_over_3a;
  }
  return rootn;
}
