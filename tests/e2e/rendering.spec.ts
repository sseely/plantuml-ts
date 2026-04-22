import { test, expect, type Page } from '@playwright/test';

const SIMPLE_DIAGRAM = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi
@enduml`;

const THREE_PARTICIPANT_DIAGRAM = `@startuml
Alice -> Bob: Hello
Bob -> Carol: Forward
Carol --> Bob: Ack
Bob --> Alice: Done
@enduml`;

const MANY_MESSAGES_DIAGRAM = `@startuml
Alice -> Bob: message 1
Bob --> Alice: reply 1
Alice -> Bob: message 2
Bob --> Alice: reply 2
Alice -> Bob: message 3
Bob --> Alice: reply 3
Alice -> Bob: message 4
Bob --> Alice: reply 4
@enduml`;

const NO_BLOCK_SOURCE = `this is not a valid plantuml diagram`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fill the source editor and wait until the preview SVG contains the given
 * text — confirming the re-render from our source completed (not stale).
 */
async function fillAndWait(
  page: Page,
  source: string,
  waitFor: string,
): Promise<void> {
  await page.locator('#source').fill(source);
  await expect(page.locator('#preview svg')).toContainText(waitFor, { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('SVG rendering correctness', () => {
  test('participant boxes do not overlap each other', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, THREE_PARTICIPANT_DIAGRAM, 'Carol');

    const overlap = await page.evaluate(() => {
      const svgEl = document.querySelector<SVGSVGElement>('#preview svg');
      if (!svgEl) return 'no SVG found';

      const svgWidth = parseFloat(svgEl.getAttribute('width') ?? '0');

      // Header participant boxes: y=0, narrower than the full-width background rect
      const boxes = [...svgEl.querySelectorAll('rect')]
        .filter(
          (r) =>
            parseFloat(r.getAttribute('y') ?? '1') === 0 &&
            parseFloat(r.getAttribute('width') ?? '0') < svgWidth * 0.9,
        )
        .map((r) => r.getBoundingClientRect())
        .sort((a, b) => a.left - b.left);

      for (let i = 0; i < boxes.length - 1; i++) {
        const curr = boxes[i]!;
        const next = boxes[i + 1]!;
        if (curr.right > next.left + 1) {
          return `Box ${i} right(${curr.right.toFixed(1)}) overlaps box ${i + 1} left(${next.left.toFixed(1)})`;
        }
      }
      return null;
    });

    expect(overlap, 'participant boxes overlap').toBeNull();
  });

  test('theme selector switches SVG background color', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#preview svg')).toBeVisible({ timeout: 5000 });

    // Default theme — white background encoded in SVG fill attributes
    await expect
      .poll(() => page.locator('#preview').innerHTML(), { timeout: 5000 })
      .toContain('#FFFFFF');

    // Switch to dark theme and wait for re-render
    await page.locator('#theme').selectOption('dark');
    await expect
      .poll(() => page.locator('#preview').innerHTML(), { timeout: 5000 })
      .toContain('#1E1E1E');

    // Switch back to default
    await page.locator('#theme').selectOption('default');
    await expect
      .poll(() => page.locator('#preview').innerHTML(), { timeout: 5000 })
      .toContain('#FFFFFF');
  });

  test('SVG height grows with more messages', async ({ page }) => {
    await page.goto('/');

    await fillAndWait(page, SIMPLE_DIAGRAM, 'Hello');
    const shortHeight = parseFloat(
      (await page.locator('#preview svg').getAttribute('height')) ?? '0',
    );

    await fillAndWait(page, MANY_MESSAGES_DIAGRAM, 'message 4');
    const tallHeight = parseFloat(
      (await page.locator('#preview svg').getAttribute('height')) ?? '0',
    );

    expect(tallHeight).toBeGreaterThan(shortHeight);
  });

  test('invalid source renders a visible error SVG', async ({ page }) => {
    await page.goto('/');
    await page.locator('#source').fill(NO_BLOCK_SOURCE);
    // The error SVG contains this text in an SVG <text> element
    await expect(page.locator('#preview svg')).toContainText('No diagram found', {
      timeout: 5000,
    });
  });

  test('header and footer participant boxes share the same x position', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, THREE_PARTICIPANT_DIAGRAM, 'Carol');

    const mismatch = await page.evaluate(() => {
      const svgEl = document.querySelector<SVGSVGElement>('#preview svg');
      if (!svgEl) return 'no SVG found';

      const svgWidth = parseFloat(svgEl.getAttribute('width') ?? '0');
      const rects = [...svgEl.querySelectorAll('rect')];

      // Header boxes: y=0, not the full-width background rect
      const headers = rects.filter(
        (r) =>
          parseFloat(r.getAttribute('y') ?? '1') === 0 &&
          parseFloat(r.getAttribute('width') ?? '0') < svgWidth * 0.9,
      );

      for (const header of headers) {
        const x = header.getAttribute('x');
        const w = header.getAttribute('width');
        const hasMatchingFooter = rects.some(
          (r) =>
            r !== header &&
            r.getAttribute('x') === x &&
            r.getAttribute('width') === w &&
            parseFloat(r.getAttribute('y') ?? '0') > 0,
        );
        if (!hasMatchingFooter) {
          return `Header rect at x=${x} w=${w} has no matching footer rect`;
        }
      }
      return null;
    });

    expect(mismatch, 'header and footer participant boxes are misaligned').toBeNull();
  });
});
