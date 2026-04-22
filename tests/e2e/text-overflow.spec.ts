import { test, expect } from '@playwright/test';

// Reproduces the regression where long message labels clipped at the SVG
// right edge. The Auth→DB message is deliberately long.
const LONG_LABEL_DIAGRAM = `@startuml
participant User
participant Browser
participant API
participant Auth
participant DB

User -> Browser: Enter credentials
Browser -> API: POST /auth/login
API -> Auth: validateCredentials(email, pwd)
Auth -> DB: SELECT * FROM users WHERE email = 'user@example.com'
DB --> Auth: user row
Auth --> API: JWT token
API --> Browser: 200 OK { token }
Browser --> User: Redirect to dashboard
@enduml`;

test.describe('SVG text overflow', () => {
  test('long message labels do not overflow the SVG viewport', async ({ page }) => {
    await page.goto('/');

    await page.locator('#source').fill(LONG_LABEL_DIAGRAM);

    // Wait until the preview SVG contains text from our diagram
    // (proves the re-render from the filled source completed)
    await expect(page.locator('#preview svg')).toContainText(
      'validateCredentials',
      { timeout: 5000 },
    );

    const overflowDescription = await page.evaluate(() => {
      const svgEl = document.querySelector<SVGSVGElement>('#preview svg');
      if (!svgEl) return 'no SVG element found';

      const svgRight = svgEl.getBoundingClientRect().right;
      for (const t of svgEl.querySelectorAll('text')) {
        const tRight = t.getBoundingClientRect().right;
        // Allow 1 px for sub-pixel rounding
        if (tRight > svgRight + 1) {
          const label = t.textContent?.trim() ?? '';
          return `"${label}" overflows by ${(tRight - svgRight).toFixed(1)}px`;
        }
      }
      return null;
    });

    expect(overflowDescription, 'a text element clips outside the SVG viewport').toBeNull();
  });

  test('basic diagram renders a visible SVG', async ({ page }) => {
    await page.goto('/');
    // The demo app loads the canonical sequence example on startup
    await expect(page.locator('#preview svg')).toBeVisible({ timeout: 5000 });
  });
});
