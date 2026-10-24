import { test, expect } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import { type Rectangle, luminanceAboveBackgroundInRectangle } from './helpers/pixels';

test.describe('catalog: veil', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(CATALOG_SITE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('over a still field (reduced motion), a veil looks darker at its centre than at its edges: compared with the same field without a veil, which holds the same ticks, the zone at its centre keeps at most 0.8 times the brightness each zone at the middle of its left, right, top and bottom edges keeps', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* The visitor asks for reduced motion: each field is drawn once, complete, and stays
       still. Time stands still from before the page loads, until the test advances it. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/voile/`);
    /* The two tick-fields of the page (tests/fixtures/catalog/content/voile.md), side by
       side, of the same size, with no text and the same solid background: one bare, the
       other holding a veil. */
    const fields = page.getByRole('main').locator('tick-field');
    await expect(fields).toHaveCount(2);
    const veil = page.locator('.veil');
    const bare = fields.filter({ hasNot: veil });
    const veiled = fields.filter({ has: veil });
    await expect(bare).toHaveCount(1);
    await expect(veiled).toHaveCount(1);
    await expect(bare).toBeInViewport();
    await expect(veiled).toBeInViewport();
    /* A few animation frames: both fields are drawn. */
    await page.clock.runFor(100);

    const bareBox = await bare.boundingBox();
    const veiledBox = await veiled.boundingBox();
    expect(bareBox, 'the bare tick-field has a box on screen').not.toBeNull();
    expect(veiledBox, 'the veiled tick-field has a box on screen').not.toBeNull();
    /* Of the same size, the two fields draw the same ticks at the same places. */
    expect(veiledBox!.width, 'width of the veiled tick-field, that of the bare one').toBeCloseTo(bareBox!.width, 0);
    expect(veiledBox!.height, 'height of the veiled tick-field, that of the bare one').toBeCloseTo(bareBox!.height, 0);
    const { width, height } = bareBox!;

    /* 32px squares: one at the centre of the field, and one against each edge, at its
       middle. */
    const SIDE = 32;
    const centre: Rectangle = { x: width / 2 - SIDE / 2, y: height / 2 - SIDE / 2, width: SIDE, height: SIDE };
    const edges: { name: string; rectangle: Rectangle }[] = [
      { name: 'left', rectangle: { x: 0, y: height / 2 - SIDE / 2, width: SIDE, height: SIDE } },
      { name: 'right', rectangle: { x: width - SIDE, y: height / 2 - SIDE / 2, width: SIDE, height: SIDE } },
      { name: 'top', rectangle: { x: width / 2 - SIDE / 2, y: 0, width: SIDE, height: SIDE } },
      { name: 'bottom', rectangle: { x: width / 2 - SIDE / 2, y: height - SIDE, width: SIDE, height: SIDE } },
    ];

    const bareShot = await bare.screenshot();
    const veiledShot = await veiled.screenshot();
    /* The share of the bare field's brightness above the background that the veiled field
       keeps in a zone: as both hold the same ticks there, only the veil can lower it. */
    const keptBrightness = async (rectangle: Rectangle): Promise<{ bare: number; veiled: number; kept: number }> => {
      const bareBrightness = await luminanceAboveBackgroundInRectangle(bare, bareShot, rectangle);
      const veiledBrightness = await luminanceAboveBackgroundInRectangle(veiled, veiledShot, rectangle);
      return { bare: bareBrightness, veiled: veiledBrightness, kept: veiledBrightness / bareBrightness };
    };

    const atCentre = await keptBrightness(centre);
    expect(atCentre.bare, 'brightness above the background of the bare field at its centre: ticks are drawn there').toBeGreaterThan(0);

    const notDarkerThanCentre: string[] = [];
    for (const edge of edges) {
      const atEdge = await keptBrightness(edge.rectangle);
      expect(atEdge.bare, `brightness above the background of the bare field at its ${edge.name} edge: ticks are drawn there`).toBeGreaterThan(0);
      if (!(atCentre.kept <= 0.8 * atEdge.kept)) {
        notDarkerThanCentre.push(
          `${edge.name}: keeps ${atEdge.kept.toFixed(2)} (${Math.round(atEdge.veiled)} of ${Math.round(atEdge.bare)})`,
        );
      }
    }
    expect(
      notDarkerThanCentre,
      `edges of the ${Math.round(width)}×${Math.round(height)}px veiled field where it does not keep at least 1.25 times the share of brightness it keeps at its centre, ${atCentre.kept.toFixed(2)} (${Math.round(atCentre.veiled)} of ${Math.round(atCentre.bare)})`,
    ).toEqual([]);
  });
});
