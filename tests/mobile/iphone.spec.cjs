const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Avoid external font CDN availability controlling the CI UI tests.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
});
async function noHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.width + 2);
  expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.width + 2);
}

test('iPhone portrait: compact header, world cards and Explorer without keyboard hijack', async ({ page }) => {
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#world .wcrest').first()).toBeVisible();
  const top = await page.locator('.top').boundingBox();
  expect(top.height).toBeLessThan(153);
  await noHorizontalOverflow(page);
  const inputSize = await page.locator('#q').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  expect(inputSize).toBeGreaterThanOrEqual(16);
  await page.locator('#ebtn').click();
  await expect(page.locator('#elog')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe('equery');
  await expect(page.locator('#econtinent')).toBeVisible();
  await page.locator('#elog .eclose').click();
  await expect(page.locator('#elog')).toBeHidden();
});

test('iPhone: continent map points and labelled touch destinations', async ({ page }) => {
  await page.goto('/#/istra', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.map-labels .pin:not(.offscreen) .in').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.mobile-places summary')).toBeVisible();
  await page.locator('.mobile-places summary').click();
  await expect(page.locator('.mobile-places-list a').first()).toBeVisible();
  await noHorizontalOverflow(page);
  const mapHeight = await page.locator('#stage').evaluate(el => Math.round(el.getBoundingClientRect().height));
  expect(mapHeight).toBeGreaterThanOrEqual(245);
});

test('iPhone: journal drawers scroll and close', async ({ page }) => {
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.wcrest').first()).toBeVisible();
  await page.locator('#sbtn').click();
  await expect(page.locator('#slog')).toBeVisible();
  await expect(page.locator('#slog .session-entry').first()).toBeVisible();
  await page.locator('#slog .session-entry summary').first().click();
  await expect(page.locator('#slog .session-entry').first()).toHaveAttribute('open', '');
  await page.locator('#slog .qx').click();
  await expect(page.locator('#slog')).toBeHidden();
  await page.locator('#rbtn').click();
  await expect(page.locator('#rlog')).toBeVisible();
  await page.locator('#rlog .qx').click();
  await page.locator('#qbtn').click();
  await expect(page.locator('#qlog')).toBeVisible();
  await page.locator('#qlog .qx').click();
  await expect(page.locator('#qlog')).toBeHidden();
});

test('iPhone: gallery carousel touch controls remain tappable', async ({ page }) => {
  await page.goto('/#/ink', { waitUntil: 'domcontentloaded' });
  const next = page.locator('.gal .gnav button[data-d="1"]');
  await expect(next).toBeVisible({ timeout: 60000 });
  const dots = page.locator('.gal .gdots button');
  const dotRect = await dots.first().boundingBox();
  expect(dotRect.height).toBeGreaterThanOrEqual(40);
  expect(dotRect.width).toBeGreaterThanOrEqual(30);
  await expect(page.locator('#mapcap')).toBeHidden();
  const first = await page.locator('.gal .sl.act').evaluate(el => [...el.parentElement.children].indexOf(el));
  await next.click();
  const second = await page.locator('.gal .sl.act').evaluate(el => [...el.parentElement.children].indexOf(el));
  expect(second).not.toBe(first);
});


test('iPhone city plan: header scrolls off, map rises then sticks at viewport top', async ({ page }) => {
  await page.goto('/#/roshen-buru', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#scene:not(.is-world) #stage')).toBeVisible({ timeout: 25000 });
  await expect(page.locator('#panel .pin-pad')).toBeVisible({ timeout: 25000 });
  const initial = await page.evaluate(() => {
    const header = document.querySelector('.top');
    const map = document.querySelector('#stage');
    const panel = document.querySelector('#panel');
    return {
      headerHeight: header.getBoundingClientRect().height,
      mapTop: map.getBoundingClientRect().top,
      panelTop: panel.getBoundingClientRect().top,
      docHeight: document.documentElement.scrollHeight,
      viewport: innerHeight,
      headerPosition: getComputedStyle(header).position,
      mapPosition: getComputedStyle(map).position,
    };
  });
  expect(initial.docHeight).toBeGreaterThan(initial.viewport + initial.headerHeight + 140);
  expect(initial.headerPosition).not.toBe('sticky');
  expect(initial.mapPosition).toBe('sticky');
  expect(initial.mapTop).toBeGreaterThan(0);

  // Before the original map top reaches the viewport, it must move with the page.
  const halfway = Math.floor(initial.headerHeight / 2);
  await page.evaluate(y => window.scrollTo(0, y), halfway);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBeGreaterThanOrEqual(halfway - 2);
  const moving = await page.evaluate(() => document.querySelector('#stage').getBoundingClientRect().top);
  expect(moving).toBeLessThan(initial.mapTop - halfway + 3);
  expect(moving).toBeGreaterThan(0);

  // Past the header, the map must sit flush with the top while the fiche advances.
  await page.evaluate(y => window.scrollTo(0, y), Math.ceil(initial.headerHeight + 180));
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(initial.headerHeight + 150);
  const stuck = await page.evaluate(() => ({
    mapTop: document.querySelector('#stage').getBoundingClientRect().top,
    headerBottom: document.querySelector('.top').getBoundingClientRect().bottom,
    panelTop: document.querySelector('#panel').getBoundingClientRect().top
  }));
  expect(stuck.headerBottom).toBeLessThanOrEqual(2);
  expect(stuck.mapTop).toBeGreaterThanOrEqual(-2);
  expect(stuck.mapTop).toBeLessThanOrEqual(2);
  expect(stuck.panelTop).toBeLessThan(initial.panelTop - 170);
  await noHorizontalOverflow(page);
});


test('Outreterre: unlocked crest and Creux d’Azur under the correct continent', async ({ page }) => {
  await page.goto('/#/', { waitUntil:'domcontentloaded' });
  const outreterre = page.locator('#world-outreterre');
  await expect(outreterre).toBeVisible({ timeout:20000 });
  await expect(outreterre).toHaveAttribute('href','#/outreterre');
  await outreterre.click();
  await expect(page.locator('#panel .pin-pad')).toBeVisible();
  await expect(page.locator('#panel a[href="#/creux-d-azur"]').first()).toBeVisible();
  await page.locator('#panel a[href="#/creux-d-azur"]').first().click();
  await expect(page.locator('.head h1')).toContainText("Creux d'Azur");
  const bread = await page.locator('.crumbs').innerText();
  expect(bread).toContain('Outreterre');
});

test('multimodal PNJ gallery: forms stay in frame and load on forward / backward navigation', async ({ page }) => {
  for (const [id, count] of [['ink',7],['liora',4],['absalom',5],['gran-brijit',3]]) {
    await page.goto('/#/' + id, {waitUntil:'domcontentloaded'});
    const slides = page.locator('.gal .sl');
    await expect(slides).toHaveCount(count,{timeout:30000});
    const cutout = page.locator('#stage .cutout img');
    await expect(cutout).toBeVisible({timeout:20000});
    await expect.poll(() => cutout.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
    const oldSrc = await cutout.getAttribute('src');
    const next = page.locator('.gal .gnav button[data-d="1"]');
    await next.click();
    await expect.poll(() => cutout.getAttribute('src')).not.toBe(oldSrc);
    await expect.poll(() => cutout.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
    const size = await page.evaluate(() => {
      const stage=document.querySelector('#stage').getBoundingClientRect();
      const portrait=document.querySelector('#stage .cutout img').getBoundingClientRect();
      return {s:[stage.left,stage.top,stage.right,stage.bottom],
              p:[portrait.left,portrait.top,portrait.right,portrait.bottom],
              w:portrait.width,h:portrait.height};
    });
    expect(size.w).toBeGreaterThan(30);
    expect(size.h).toBeGreaterThan(50);
    expect(size.p[0]).toBeGreaterThanOrEqual(size.s[0]-3);
    expect(size.p[2]).toBeLessThanOrEqual(size.s[2]+3);
    expect(size.p[1]).toBeGreaterThanOrEqual(size.s[1]-4);
    expect(size.p[3]).toBeLessThanOrEqual(size.s[3]+4);
    await page.locator('.gal .gnav button[data-d="-1"]').click();
    await expect.poll(() => cutout.getAttribute('src')).toBe(oldSrc);
  }
});

test('Large scene galleries load their assets without cropping or overflowing', async ({ page }) => {
  await page.goto('/#/malquessar',{waitUntil:'domcontentloaded'});
  // Malquessar shows its residents first, then its ten authored landscapes.
  await expect.poll(() => page.locator('.gal .sl').count(), {timeout:30000}).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.gal .sl')).toHaveCount(18);
  for (let step=0; step<7; step++) {
    const img=page.locator('.gal .sl.act img');
    await expect.poll(() => img.evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);
    const bounds=await img.boundingBox();
    const stage=await page.locator('#stage').boundingBox();
    expect(bounds.width).toBeLessThanOrEqual(stage.width+3);
    expect(bounds.height).toBeLessThanOrEqual(stage.height+3);
    await page.locator('.gal .gnav button[data-d="1"]').click();
  }
});

test('narrow iPhone SE and landscape: no horizontal scrolling or clipped header', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.wcrest').first()).toBeVisible();
  await noHorizontalOverflow(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await noHorizontalOverflow(page);
  const header = await page.locator('.top').boundingBox();
  expect(header.height).toBeLessThan(160);
});

test('iPhone document reader: portrait pages, catalog and no horizontal overflow', async ({ page }) => {
  await page.goto('/#/documents/roshen-rapport-uramei', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#stage .doc-reader-section[aria-label="Rapport d\'enquête sur les Urameï"]')).toBeVisible();
  await expect(page.locator('#stage .doc-paper')).toHaveCount(2);
  await expect(page.locator('#dlog')).toBeHidden();
  await noHorizontalOverflow(page);
  const measures = await page.locator('#stage .doc-paper img').first().evaluate(el => {
    const a=el.getBoundingClientRect(),p=el.closest('.docreader').getBoundingClientRect();
    return { imageWidth:a.width,containerWidth:p.width,right:a.right,containerRight:p.right };
  });
  expect(measures.imageWidth).toBeGreaterThan(200);
  expect(measures.right).toBeLessThanOrEqual(measures.containerRight+2);
  await page.locator('#dbtn').click();
  await expect(page.locator('#dlog .doc-catalog')).toBeVisible();
  await expect(page.locator('#dlog .doc-region-group').first()).toBeVisible();
  await page.locator('#dlog .qx').click();
  await expect(page.locator('#dlog')).toBeHidden();
  await page.evaluate(() => window.scrollTo({left:0,top:280,behavior:'instant'}));
  const overflowDebug = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter(el => {
      const b=el.getBoundingClientRect(),s=getComputedStyle(el);
      return b.width>0 && (b.right > innerWidth+3 || b.left < -3) &&
        s.display!=='none' && s.visibility!=='hidden';
    }).slice(0,20).map(el => {
      const b=el.getBoundingClientRect();
      return { tag:el.tagName, id:el.id, cls:typeof el.className==='string'?el.className.slice(0,90):'', left:Math.round(b.left), right:Math.round(b.right), width:Math.round(b.width) };
    }));
  console.log('DOCUMENT_OVERFLOW_DIAG', JSON.stringify(overflowDebug));
  const scrollDiag = await page.evaluate(() => [...document.querySelectorAll('html, body, .top, .nav, .scene, .stage, .docreader, .doc-paper, .docreader-head')]
    .map(el => ({tag:el.tagName,cls:typeof el.className==='string'?el.className.slice(0,50):'',id:el.id,
      sw:el.scrollWidth,cw:el.clientWidth,ow:el.offsetWidth,overflow:getComputedStyle(el).overflowX,scrollLeft:el.scrollLeft})));
  console.log('DOCUMENT_SCROLLWIDTH_DIAG', JSON.stringify(scrollDiag));
  await noHorizontalOverflow(page);
  await page.goto('/#/magistrature', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#panel a[href="#/documents/roshen-rapport-uramei"]')).toBeVisible({timeout:15000});
  await page.locator('#panel a[href="#/documents/roshen-rapport-uramei"]').click();
  await expect(page.locator('.doc-reader-section[aria-label="Rapport d\'enquête sur les Urameï"]')).toBeVisible();
  await noHorizontalOverflow(page);
});

test('document contextual: keep source fiche on right, restore landscape and scroll', async ({page}) => {
  await page.goto('/#/magistrature', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#panel .pin-pad')).toBeVisible();
  const original = await page.locator('#panel .pin-pad').evaluate(el => el.innerHTML);
  const link = page.locator('#panel a[href="#/documents/roshen-rapport-uramei"]');
  await expect(link).toBeVisible({timeout:20000});
  const sceneScroll = await page.locator('#panel').evaluate(el=>{el.scrollTop=210;return el.scrollTop;});
  await link.click();
  await expect(page.locator('body.document-reading.doc-context')).toBeVisible();
  await expect(page.locator('#panel .pin-pad')).toBeVisible();
  await expect(page.locator('#stage .doc-paper')).toHaveCount(2);
  expect(await page.locator('#panel .pin-pad').evaluate(el=>el.innerHTML)).toBe(original);
  expect(await page.locator('#panel').evaluate(el=>el.scrollTop)).toBe(sceneScroll);
  await expect(page.locator('#dlog')).toBeHidden();
  await noHorizontalOverflow(page);
  await page.locator('#stage .doc-back').click();
  await expect(page).toHaveURL(/#\/magistrature/);
  await expect(page.locator('body.doc-context')).toHaveCount(0);
  await expect(page.locator('#panel .pin-pad')).toBeVisible();
  await expect(page.locator('#stage .docreader')).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test('desktop document catalog: region accordion and one-click preview', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:1440,height:900},isMobile:false,hasTouch:false});
  const page=await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route=>route.abort());
  await page.route('https://fonts.gstatic.com/**', route=>route.abort());
  try {
    await page.goto('http://127.0.0.1:4173/#/documents', {waitUntil:'domcontentloaded'});
    const group=page.locator('#dlog .doc-region-group').filter({has:page.locator('summary', {hasText:'Keras Tauroc'})});
    await expect(group).toBeVisible();
    await group.locator('summary').first().click();
    await expect(group).toHaveAttribute('open','');
    await expect(group.locator('a.doc-list-row').first()).toBeVisible();
    await expect(group.locator('a.doc-list-row').first()).toContainText('missions');
    await group.locator('a.doc-list-row').first().click();
    await expect(page.locator('#stage .doc-reader-section[aria-label="Extrait du livre de missions d\'Hématome"]')).toBeVisible();
    await expect(page.locator('#stage .docreader-head')).toHaveCount(0);
    await expect(page.locator('#dlog')).toBeVisible();
    const width=await page.locator('#stage').evaluate(el=>Math.floor(Math.min(el.clientWidth*.94,el.clientHeight*.88*4/3)));
    const sheet=await page.locator('.doc-paper').first().boundingBox();
    expect(sheet.width).toBeLessThanOrEqual(width+2);
    expect(sheet.width).toBeGreaterThan(100);
    await expect(page.locator('a.doc-open')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('Chronological document order and slim source-only reader', async ({page}) => {
  await page.goto('/#/documents', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#dlog .doc-region-group summary').first()).toContainText('Vesper');
  await expect(page.locator('#stage .docreader-head')).toHaveCount(0);
  const first = page.locator('#stage .doc-paper').first();
  await expect(first).toBeVisible();
  await expect(page.locator('#stage .doc-reader-section h2')).toHaveCount(0);
  const firstImageSrc = await first.locator('img').getAttribute('src');
  expect(firstImageSrc).toContain('le-vesper-lettre');
  const roshenGroup = page.locator('#dlog .doc-region-group').filter({has:page.locator('summary', {hasText:'Roshen Buru'})});
  await roshenGroup.locator('summary').first().click();
  const order = await roshenGroup.locator('a.doc-list-row b').allTextContents();
  expect(order.slice(0,5)).toEqual([
    'Avis officiel à la population','Avis de disparition : Ako','Avis de disparition : Tobiya',
    'Affiche de la boutique de Sumeren Daïko',"Affiche de la boutique d'Oren Sidaï"
  ]);
  expect(order.slice(-2)).toEqual(['Lettre de Brodek Kovacz au magistrat','Parchemin PSA-84']);
  expect(order.indexOf('Lettre adressée à Konya Sokabeï')+1).toBe(order.indexOf('Lettre adressée à Ayano Kaben'));
});
