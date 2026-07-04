/**
 * Per-slug drill-down for the DOT-sync report: prints the oracle's svek DOT and
 * ours side by side, then the per-check StructuralDiff with the underlying
 * values for each failing check. Split out of dot-sync-report.ts (file-size
 * limit); owns the check list so the report can aggregate over the same set.
 */
import type { DotInputGraph } from '../src/core/graph-layout.js';
import { toSvekDot } from '../src/core/svek-dot-emit.js';
import {
  parseSvekDot,
  compareStructural,
  degreeSequence,
  type StructuralGraph,
  type StructuralDiff,
} from '../tests/oracle/svek-dot.js';

export const CHECKS = [
  'nodeCountOk',
  'edgeCountOk',
  'degreeOk',
  'minlenOk',
  'shapeOk',
  'labelOk',
  'clusterOk',
  'rankdirOk',
  'nodesepOk',
  'ranksepOk',
] as const;
export type Check = (typeof CHECKS)[number];

const shapesOf = (g: StructuralGraph): string[] => g.nodes.map((n) => n.shape).sort();
const minlensOf = (g: StructuralGraph): number[] =>
  g.edges.map((e) => e.minlen).sort((x, y) => x - y);
const clusterSizesOf = (g: StructuralGraph): number[] =>
  g.clusters.map((c) => c.memberCount).sort((x, y) => x - y);
const labelCountsOf = (g: StructuralGraph): [number, number, number] => [
  g.edges.filter((e) => e.hasLabel).length,
  g.edges.filter((e) => e.hasTailLabel).length,
  g.edges.filter((e) => e.hasHeadLabel).length,
];

interface CheckDetail {
  label: string;
  values: (o: StructuralGraph, c: StructuralGraph) => [unknown, unknown];
}

/** One entry per CHECKS member — extend here when new checks land. */
const CHECK_DETAILS: Record<Check, CheckDetail> = {
  nodeCountOk: { label: 'node count', values: (o, c) => [o.nodes.length, c.nodes.length] },
  edgeCountOk: { label: 'edge count', values: (o, c) => [o.edges.length, c.edges.length] },
  degreeOk: { label: 'degree sequence', values: (o, c) => [degreeSequence(o), degreeSequence(c)] },
  minlenOk: { label: 'minlen multiset', values: (o, c) => [minlensOf(o), minlensOf(c)] },
  shapeOk: { label: 'shape multiset', values: (o, c) => [shapesOf(o), shapesOf(c)] },
  labelOk: { label: 'label counts [label,tail,head]', values: (o, c) => [labelCountsOf(o), labelCountsOf(c)] },
  clusterOk: { label: 'cluster-size list', values: (o, c) => [clusterSizesOf(o), clusterSizesOf(c)] },
  rankdirOk: { label: 'rankdir', values: (o, c) => [o.rankdir, c.rankdir] },
  nodesepOk: { label: 'nodesep (in)', values: (o, c) => [o.nodesep, c.nodesep] },
  ranksepOk: { label: 'ranksep (in)', values: (o, c) => [o.ranksep, c.ranksep] },
};

function printGraphAttrs(label: string, g: StructuralGraph): void {
  console.log(
    '  ' + label + ': rankdir=' + g.rankdir + ' nodesep=' + g.nodesep + ' ranksep=' + g.ranksep +
    ' remincross=' + g.remincross + ' searchsize=' + g.searchsize,
  );
}

function printCheckDetails(o: StructuralGraph, c: StructuralGraph, d: StructuralDiff): void {
  let anyFail = false;
  for (const check of CHECKS) {
    if (d[check]) continue;
    anyFail = true;
    const detail = CHECK_DETAILS[check];
    const [ov, cv] = detail.values(o, c);
    console.log('  FAIL ' + check + ' (' + detail.label + '):');
    console.log('    oracle:    ' + JSON.stringify(ov));
    console.log('    candidate: ' + JSON.stringify(cv));
  }
  if (!anyFail) console.log('  all structural checks pass (structurallyEqual=' + d.structurallyEqual + ')');
  console.log('  maxSizeDeltaIn: ' + d.maxSizeDeltaIn.toFixed(4));
}

export function drillDownGraph(
  i: number,
  oracleDot: string | undefined,
  input: DotInputGraph | undefined,
): void {
  console.log('\n--- graph #' + i + ' ---');
  if (oracleDot !== undefined) {
    console.log('\n[oracle svek DOT]');
    console.log(oracleDot);
  } else {
    console.log('[oracle svek DOT] — none (oracle produced fewer graphs)');
  }
  const candidateDot = input === undefined ? undefined : toSvekDot(input);
  if (candidateDot !== undefined) {
    console.log('\n[our svek DOT — via toSvekDot]');
    console.log(candidateDot);
  } else {
    console.log('[our svek DOT] — none (we produced fewer graphs)');
  }
  if (oracleDot === undefined || candidateDot === undefined) return;
  const oracleGraph = parseSvekDot(oracleDot);
  const candidateGraph = parseSvekDot(candidateDot);
  console.log('\n[graph attrs]');
  printGraphAttrs('oracle   ', oracleGraph);
  printGraphAttrs('candidate', candidateGraph);
  console.log('\n[per-check diff]');
  printCheckDetails(oracleGraph, candidateGraph, compareStructural(oracleGraph, candidateGraph));
}
