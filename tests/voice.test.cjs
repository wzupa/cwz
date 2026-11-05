// These exercise the actual HTML with simulated speech-service events.
// Recognition quality, native permissions and hardware timing need a phone test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let browser, server, url;
before(async () => {
  server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(fs.readFileSync(path.join(__dirname, '../CWZ_v6_4.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
});
after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function openPage(kind = 'native', pool = ['K']) {
  const context = await browser.newContext({ viewport: { width: 393, height: 851 } });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.addInitScript(({ kind, pool }) => {
    localStorage.setItem('cw-groups-settings-v1', JSON.stringify({ selected: pool, fields: { charWpm: '60', effWpm: '20', tone: '650', mode: 'custom' } }));
    window.requests = [];
    window.cancelCount = 0;
    if (kind === 'native') {
      window.CwzAndroid = {
        speechInfo: () => JSON.stringify({ available: true, local: true, system: true }),
        cancelSpeech: () => window.cancelCount++,
        startSpeech: (id, mode, language) => {
          window.requests.push({ id, mode, language });
          setTimeout(() => window.CWZVoice.onNativeEvent({ id, type: 'ready' }), 10);
        }
      };
    } else if (kind === 'browser') {
      window.SpeechRecognition = class {
        start() { window.fakeRecognition = this; setTimeout(() => this.onstart?.(), 5); }
        abort() { this.aborted = true; }
      };
      window.webkitSpeechRecognition = undefined;
    } else {
      window.SpeechRecognition = window.webkitSpeechRecognition = undefined;
    }
  }, { kind, pool });
  await page.goto(url + '/#voice');
  return { page, context };
}
async function listening(page) {
  await page.waitForFunction(() => document.getElementById('voiceStatus').textContent.includes('Microfono attivo'));
}
async function nativeResult(page, text) {
  await page.evaluate(text => {
    const id = window.requests.at(-1).id;
    window.CWZVoice.onNativeEvent({ id, type: 'speech', delayMs: 150 });
    window.CWZVoice.onNativeEvent({ id, type: 'result', alternatives: [text] });
  }, text);
}
async function history(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('cwz-voice-history-v1') || '[]')); }

test('native adapter: shared characters, hidden help, commands, corrections, persistence and stats', { timeout: 60000 }, async () => {
  const { page, context } = await openPage();
  try {
    assert.equal(await page.locator('#voicePool').count(), 0);
    assert.equal(await page.locator('#voiceEngine').inputValue(), 'local');
    await page.locator('#voiceTest').click(); await listening(page); await nativeResult(page, 'Chilo');
    assert((await page.locator('#voiceStatus').innerText()).includes('→ K'));
    assert.equal((await history(page)).length, 0);
    await page.locator('#voiceStart').click(); await listening(page);
    assert.equal(await page.locator('#voiceCode').isVisible(), false);
    assert.equal(await page.locator('#voiceCode').textContent(), '');
    await nativeResult(page, 'Kilo'); await page.locator('#voiceConfirm').click();
    let rows = await history(page);
    assert.equal(rows[0].expected, 'K'); assert.equal(rows[0].correct, true);
    assert.equal(rows[0].source, 'voice'); assert.equal(rows[0].help, false);
    assert(rows[0].responseMs >= 150);
    // Pause during feedback must not allow the same answer to be recorded twice.
    await page.locator('#voicePause').click(); await page.locator('#voiceResume').click(); await listening(page);
    await nativeResult(page, 'Ripeti'); await listening(page);
    await nativeResult(page, 'parola sconosciuta');
    assert.equal((await history(page)).length, 1);
    await page.locator('#voiceReveal').click(); assert.equal(await page.locator('#voiceCode').isVisible(), true);
    await page.locator('#voiceListen').click(); await listening(page); await nativeResult(page, 'Bravo');
    await page.locator('#voiceAnswer').fill('K'); await page.locator('#voiceConfirm').click();
    rows = await history(page);
    assert.equal(rows.length, 2); assert.equal(rows[1].expected, 'K');
    assert.equal(rows[1].source, 'typed'); assert.equal(rows[1].corrected, true);
    assert.equal(rows[1].help, true); assert.equal(rows[1].repeats, 1);
    assert.equal(rows[1].recognitionRetries, 1); assert.equal(rows[1].responseMs, null);
    await listening(page); assert.equal(await page.locator('#voiceCode').isVisible(), false);
    await page.getByRole('link', { name: 'Impostazioni CW', exact: true }).first().click();
    assert(await page.evaluate(() => window.cancelCount) > 0);
    await page.locator('#chars').getByRole('button', { name: 'K', exact: true }).click();
    await page.locator('#chars').getByRole('button', { name: 'R', exact: true }).click();
    await page.getByRole('link', { name: 'Allenamento vocale', exact: true }).click();
    await page.locator('#voiceResume').click(); await listening(page);
    await nativeResult(page, 'Romeo'); await page.locator('#voiceConfirm').click();
    rows = await history(page); assert.equal(rows[2].expected, 'R'); assert.equal(rows[2].correct, true);
    await page.locator('#voiceEnd').click();
    const d = page.waitForEvent('download'); await page.locator('#voiceExport').click();
    assert.equal((await d).suggestedFilename(), 'cwz-vocale.json');
    await page.reload(); assert.equal((await history(page)).length, 3);
    assert((await page.locator('#voiceSummary').innerText()).includes('Risposte: 3'));
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('browser adapter: top hypothesis, service failure, manual fallback, no background listening', { timeout: 30000 }, async () => {
  const { page, context } = await openPage('browser', ['?']);
  try {
    await page.locator('#voiceStart').click(); await listening(page);
    await page.evaluate(() => {
      window.fakeRecognition.onspeechstart();
      window.fakeRecognition.onresult({ results: [[{ transcript: 'Bravo' }, { transcript: 'punto interrogativo' }]] });
    });
    assert.equal(await page.locator('#voiceAnswer').inputValue(), 'B');
    await page.locator('#voiceConfirm').click(); assert.equal((await history(page))[0].expected, '?');
    assert.equal((await history(page))[0].correct, false);
    await listening(page);
    await page.evaluate(() => window.fakeRecognition.onerror({ error: 'not-allowed' }));
    assert.equal((await history(page)).length, 1);
    await page.locator('#voiceAnswer').fill('?'); await page.locator('#voiceConfirm').click();
    assert.equal((await history(page))[1].source, 'typed');
    await listening(page); await page.getByRole('link', { name: 'Home', exact: true }).click();
    assert.equal(await page.evaluate(() => window.fakeRecognition.aborted), true);
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('unsupported browser: manual session completes and preserves existing keyboard history', { timeout: 40000 }, async () => {
  const { page, context } = await openPage('manual', ['A']);
  try {
    assert.equal(await page.locator('#voiceEngine').inputValue(), 'manual');
    await page.evaluate(() => localStorage.setItem('cwz-history-v1', JSON.stringify([{ id: 'existing', groups: ['A'], answers: [['A']] }])));
    await page.locator('#voiceStart').click();
    for (let i = 0; i < 10; i++) {
      await page.locator('#voiceAnswer').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('voiceAnswer').disabled);
      assert.equal(await page.locator('#voiceCode').isVisible(), false);
      await page.locator('#voiceAnswer').fill('Alfa'); await page.locator('#voiceConfirm').click();
    }
    await page.waitForFunction(() => document.getElementById('voiceStatus').textContent.includes('Sessione completata'));
    const rows = await history(page); assert.equal(rows.length, 10);
    assert(rows.every(r => r.expected === 'A' && r.correct && r.responseMs === null));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cwz-history-v1'))[0].id), 'existing');
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});
