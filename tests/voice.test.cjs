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
    response.end(fs.readFileSync(path.join(__dirname, '../CWZ_v6_7_1.html')));
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
        setScreenAwake: enabled => { window.screenAwake = enabled; },
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
  // Historical single-character tests exercise the manual approval path.
  // A separate test below verifies that auto-approval defaults to enabled.
  await page.locator('#voiceAutoConfirm').uncheck();
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
    assert.equal(await page.locator('#voiceAdaptive').inputValue(), '40');
    await page.locator('#voiceAdaptive').evaluate(input => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('#voiceMix').textContent(), '100% casuale · 0% adattivo');
    assert.equal(await page.locator('#voiceEngine').inputValue(), 'local');
    await page.locator('#voiceTest').click(); await listening(page); await nativeResult(page, 'Chilo');
    assert((await page.locator('#voiceStatus').innerText()).includes('→ K'));
    assert.equal((await history(page)).length, 0);
    await page.locator('#voiceStart').click(); await listening(page);
    assert.equal(await page.evaluate(() => window.screenAwake), true);
    assert.equal(await page.locator('#voiceAdaptive').isEnabled(), true);
    await page.locator('#voiceAdaptive').evaluate(input => { input.value = '100'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('#voiceMix').textContent(), '0% casuale · 100% adattivo');
    assert.equal(await page.locator('#voiceCode').isVisible(), false);
    assert.equal(await page.locator('#voiceCode').textContent(), '');
    await nativeResult(page, 'Kilo'); await page.locator('#voiceConfirm').click();
    let rows = await history(page);
    assert.equal(rows[0].expected, 'K'); assert.equal(rows[0].correct, true);
    assert.equal(rows[0].source, 'voice'); assert.equal(rows[0].help, false);
    assert(rows[0].responseMs >= 150);
    // Pause during feedback must not allow the same answer to be recorded twice.
    await page.locator('#voicePause').click();
    assert.equal(await page.evaluate(() => window.screenAwake), false);
    await page.locator('#voiceResume').click(); await listening(page);
    assert.equal(await page.evaluate(() => window.screenAwake), true);
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
    await page.waitForFunction(() => window.screenAwake === false);
    assert(await page.evaluate(() => window.cancelCount) > 0);
    await page.locator('#chars').getByRole('button', { name: 'K', exact: true }).click();
    await page.locator('#chars').getByRole('button', { name: 'R', exact: true }).click();
    await page.getByRole('link', { name: 'Allenamento vocale', exact: true }).click();
    await page.locator('#voiceResume').click(); await listening(page);
    await nativeResult(page, 'Romeo'); await page.locator('#voiceConfirm').click();
    rows = await history(page); assert.equal(rows[2].expected, 'R'); assert.equal(rows[2].correct, true);
    await page.locator('#voiceEnd').click();
    assert.equal(await page.evaluate(() => window.screenAwake), false);
    await page.getByRole('link', {name:'Statistiche',exact:true}).first().click();
    assert((await page.locator('#voiceSessionState').textContent()).includes('Terminata prima della fine'));
    assert((await page.locator('#voiceSessionScore').textContent()).includes('3/3 corrette (100%)'));
    const d = page.waitForEvent('download'); await page.locator('#voiceExport').click();
    assert.equal((await d).suggestedFilename(), 'cwz-vocale.json');
    await page.reload(); assert.equal((await history(page)).length, 3);
    assert((await page.locator('#voiceSessionScore').textContent()).includes('3/3 corrette (100%)'));
    assert.equal(await page.locator('#voiceAdaptive').inputValue(), '100');
    assert((await page.locator('#voiceSummary').innerText()).includes('Risposte: 3'));
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('browser wake lock: pending lock is released after pause and an acquired lock after session end', async () => {
  const { page, context } = await openPage('manual', ['A']);
  try {
    await page.addInitScript(() => {
      window.wakeRequests = 0; window.wakeReleases = 0;
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
        request: () => { window.wakeRequests++; return new Promise(resolve => {
          window.resolveWake = () => resolve({ addEventListener() {}, release() { window.wakeReleases++; return Promise.resolve(); } });
        }); }
      } });
    });
    await page.reload(); await page.locator('#voiceStart').click();
    assert.equal(await page.evaluate(() => window.wakeRequests), 1);
    await page.locator('#voicePause').click();
    await page.evaluate(() => window.resolveWake());
    await page.waitForFunction(() => window.wakeReleases === 1);
    await page.locator('#voiceResume').click();
    assert.equal(await page.evaluate(() => window.wakeRequests), 2);
    await page.evaluate(() => window.resolveWake());
    await page.waitForFunction(() => document.getElementById('voiceAwake').textContent.startsWith('Schermo mantenuto'));
    await page.locator('#voiceEnd').click();
    await page.waitForFunction(() => window.wakeReleases === 2);
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('compact statistics: arithmetic mean, valid sample counts, confusion matrix and collapsed details', async () => {
  const { page, context } = await openPage();
  try {
    await page.evaluate(() => {
      const base = { expected: 'K', answer: 'K', correct: true, source: 'voice', help: false, repeats: 0 };
      localStorage.setItem('cwz-voice-history-v1', JSON.stringify([
        ...[1000, 2000, 6000].map(responseMs => ({ ...base, responseMs })),
        { ...base, answer: 'M', correct: false, responseMs: 500 },
        { ...base, help: true, responseMs: 9000 },
        { ...base, expected: 'M', answer: '', correct: false, source: 'skipped', responseMs: null }
      ]));
    });
    await page.reload();
    await page.getByRole('link', {name:'Statistiche',exact:true}).first().click();
    const cells = await page.locator('#voiceLetters tbody tr').first().locator('td').allTextContents();
    assert.deepEqual(cells, ['K', '4/5', '3.00 s', '3', '1.00×']);
    assert((await page.locator('#voiceSummary').textContent()).includes('Tempo medio: 3.00 s'));
    const rows = page.locator('#voiceMatrix tbody tr');
    assert.deepEqual(await rows.nth(0).locator('td').allTextContents(), ['4', '1', '·']);
    assert.deepEqual(await rows.nth(1).locator('td').allTextContents(), ['·', '·', '1']);
    assert.equal(await page.locator('#voiceRecent').isVisible(), false);
    await page.getByText('Dettagli e ultime risposte', { exact: true }).click();
    assert.equal(await page.locator('#voiceRecent').isVisible(), true);
    assert(!/\d+\.\d+ s/.test(await page.locator('#voiceRecent').textContent()));
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('last session ranks its own confusions and does not include older errors', async () => {
  const { page, context } = await openPage();
  try {
    await page.evaluate(() => {
      const rows = [
        ...Array(8).fill({ session: 'old', expected: 'Z', answer: 'X', correct: false, source: 'typed' }),
        ...Array(2).fill({ session: 'last', expected: 'R', answer: 'K', correct: false, source: 'typed' }),
        { session: 'last', expected: 'T', answer: 'E', correct: false, source: 'typed' },
        { session: 'last', expected: 'R', answer: 'R', correct: true, source: 'typed' }
      ];
      localStorage.setItem('cwz-voice-history-v1', JSON.stringify(rows));
      localStorage.setItem('cwz-voice-last-session-v1', JSON.stringify({ id: 'last', planned: 4, completed: true }));
    });
    await page.reload();
    await page.getByRole('link', {name:'Statistiche',exact:true}).first().click();
    assert((await page.locator('#voiceSessionScore').textContent()).includes('1/4 corrette (25%)'));
    assert.equal(await page.locator('#voiceSessionErrors').textContent(), 'Confusioni più frequenti: R → K ×2 · T → E ×1');
    assert((await page.locator('#voiceSessionWeak').textContent()).includes('R (2/3)'));
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#voiceClear').click();
    assert.equal(await page.locator('#voiceSessionSummary').isVisible(), false);
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
    await page.waitForFunction(() => window.fakeRecognition?.aborted === true);
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('unsupported browser: manual session completes and preserves existing keyboard history', { timeout: 40000 }, async () => {
  const { page, context } = await openPage('manual', ['A']);
  try {
    assert.equal(await page.locator('#voiceEngine').inputValue(), 'manual');
    await page.evaluate(() => {
      localStorage.setItem('cwz-history-v1', JSON.stringify([{ id: 'existing', groups: ['A'], answers: [['A']] }]));
      localStorage.setItem('cwz-voice-history-v1', JSON.stringify([{ id: 'old', session: 'old-session', expected: 'Z', answer: 'X', correct: false, source: 'typed' }]));
    });
    await page.reload();
    await page.locator('#voiceStart').click();
    for (let i = 0; i < 10; i++) {
      await page.locator('#voiceAnswer').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('voiceAnswer').disabled);
      assert.equal(await page.locator('#voiceCode').isVisible(), false);
      await page.locator('#voiceAnswer').fill('Alfa'); await page.locator('#voiceConfirm').click();
    }
    await page.waitForFunction(() => document.getElementById('voiceStatus').textContent.includes('Sessione completata'));
    const rows = await history(page); assert.equal(rows.length, 11);
    assert(rows.slice(1).every(r => r.expected === 'A' && r.correct && r.responseMs === null));
    assert((await page.locator('#voiceSessionScore').textContent()).includes('10/10 corrette (100%)'));
    assert(!(await page.locator('#voiceSessionErrors').textContent()).includes('Z'));
    assert((await page.locator('#voiceSummary').textContent()).includes('Risposte: 11'));
    await page.reload();
    assert((await page.locator('#voiceSessionScore').textContent()).includes('10/10 corrette (100%)'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cwz-history-v1'))[0].id), 'existing');
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('6.7 voice defaults and full NATO group: provisional cells, omissions and colour coding', { timeout: 40000 }, async () => {
  const { page, context } = await openPage('native', ['K']);
  try {
    await page.reload();
    assert.equal(await page.locator('#voiceAutoConfirm').isChecked(), true, 'automatic approval is enabled by default');
    await page.locator('#voiceGroupMode').selectOption('fixed');
    await page.locator('#voiceGroupLength').evaluate(input => { input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#voiceStart').click();
    await listening(page);
    assert.equal(await page.locator('#voiceCells .voice-letter-cell').count(), 5);
    await page.evaluate(() => {
      const id = window.requests.at(-1).id;
      window.CWZVoice.onNativeEvent({id, type:'speech', delayMs:100});
      window.CWZVoice.onNativeEvent({id, type:'partial', alternatives:['Kilo India']});
    });
    assert.deepEqual(await page.locator('#voiceCells .voice-letter-cell').evaluateAll(cells => cells.map(el => el.dataset.state)), ['tentative','tentative','pending','pending','pending']);
    await nativeResult(page, 'Kilo India Vuoto Kilo Passa');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cwz-voice-history-v1')||'[]').length===5);
    assert.deepEqual((await history(page)).map(r => r.answer), ['K','I','','K','']);
    assert.deepEqual(await page.locator('#voiceCells .voice-letter-cell').evaluateAll(cells => cells.map(el => el.dataset.state)), ['correct','wrong','wrong','correct','wrong']);
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('6.7 late final result after speech onset does not timeout or land in a later group', { timeout: 40000 }, async () => {
  const { page, context } = await openPage('native', ['K']);
  try {
    await page.locator('#voiceAutoConfirm').check();
    await page.locator('#voiceGroupMode').selectOption('fixed');
    await page.locator('#voiceGroupLength').evaluate(input => { input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#voiceDeadline').selectOption('1');
    await page.locator('#voiceStart').click(); await listening(page);
    const oldId = await page.evaluate(() => {
      const id = window.requests.at(-1).id;
      window.CWZVoice.onNativeEvent({id, type:'speech', delayMs:50});
      return id;
    });
    await page.waitForTimeout(1300);
    assert.equal((await history(page)).length, 0, 'speech onset suspends deadline even if final ASR is late');
    await page.evaluate(id => window.CWZVoice.onNativeEvent({id, type:'result', alternatives:['Kilo Kilo']}), oldId);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cwz-voice-history-v1')||'[]').length===2);
    await listening(page);
    await page.evaluate(id => window.CWZVoice.onNativeEvent({id, type:'result', alternatives:['Kilo Kilo']}), oldId);
    assert.equal((await history(page)).length, 2, 'stale recognition result must not affect next group');
    await page.locator('#voiceEnd').click();
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('6.7 timer expires invisibly and records omissions for all unanswered cells', { timeout: 30000 }, async () => {
  const { page, context } = await openPage('native', ['K']);
  try {
    await page.locator('#voiceGroupMode').selectOption('fixed');
    await page.locator('#voiceGroupLength').evaluate(input => { input.value = '3'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#voiceDeadline').selectOption('1');
    await page.locator('#voiceStart').click(); await listening(page);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cwz-voice-history-v1')||'[]').length===3);
    assert.deepEqual((await history(page)).map(r => r.answer), ['','','']);
    assert.deepEqual(await page.locator('#voiceCells .voice-letter-cell').evaluateAll(cells => cells.map(el => el.dataset.state)), ['wrong','wrong','wrong']);
    assert.equal(await page.locator('#voiceDeadlineRemaining').count(), 0);
    assert.deepEqual(page.errors, []);
  } finally { await context.close(); }
});

test('6.7 complete groups over two recognition segments and preserve NATO index positions', { timeout: 30000 }, async () => {
  const {page,context}=await openPage('native',['K']);
  try {
    await page.locator('#voiceAutoConfirm').check();
    await page.locator('#voiceGroupMode').selectOption('fixed');
    await page.locator('#voiceGroupLength').evaluate(input => { input.value='4'; input.dispatchEvent(new Event('input',{bubbles:true})); });
    await page.locator('#voiceStart').click(); await listening(page);
    await nativeResult(page,'Kilo India'); await listening(page);
    assert.equal((await history(page)).length,0);
    await nativeResult(page,'Vuoto Kilo');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cwz-voice-history-v1')||'[]').length===4);
    assert.deepEqual((await history(page)).map(r=>r.answer),['K','I','','K']);
    assert.deepEqual(page.errors,[]);
  } finally {await context.close()}
});

test('6.7.1 settings are shared, no exercise shortcut, voice statistics are in general stats', async () => {
 const {page,context}=await openPage('native',['K']);
 try {
  await page.getByRole('link',{name:'Impostazioni CW',exact:true}).first().click();
  assert.equal(await page.getByText('Vai a Gruppi di codice').count(),0);
  await page.locator('#saveDefaults').waitFor({state:'visible'});
  await page.getByRole('link',{name:'Statistiche',exact:true}).first().click();
  await page.locator('#statsSummary').waitFor({state:'visible'});
  await page.locator('#voiceSummary').waitFor({state:'visible'});
  assert.equal(await page.locator('#voiceLetters').isVisible(),true);
  await page.getByRole('link',{name:'Allenamento vocale',exact:true}).first().click();
  await page.locator('#voiceStart').waitFor({state:'visible'});
  assert.equal(await page.locator('#voiceSummary').isVisible(),false);
  assert.deepEqual(page.errors,[]);
 }finally{await context.close()}
});

test('6.7.1 each repetition corresponds to one complete group and Passo / Passa skip a position', {timeout:30000},async()=>{
 const {page,context}=await openPage('native',['K']);
 try{
  await page.locator('#voiceAutoConfirm').check();
  await page.locator('#voiceGroupMode').selectOption('fixed');
  await page.locator('#voiceGroupLength').evaluate(input=>{input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('#voiceCount').selectOption('10');
  await page.locator('#voiceStart').click();await listening(page);
  assert.equal(await page.locator('#voiceProgress').textContent().then(x=>x.includes('Ripetizione 1 di 10')),true);
  assert.equal(await page.locator('#voiceCells .voice-letter-cell').count(),3);
  await nativeResult(page,'Passo Kilo Passa');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cwz-voice-history-v1')||'[]').length===3);
  assert.deepEqual((await history(page)).map(r=>r.answer),['','K','']);
  await listening(page);
  assert((await page.locator('#voiceProgress').textContent()).includes('Ripetizione 2 di 10'));
  assert.equal(await page.locator('#voiceCells .voice-letter-cell').count(),3);
  await page.locator('#voiceEnd').click();
  await page.getByRole('link',{name:'Statistiche',exact:true}).first().click();
  assert((await page.locator('#voiceSessionScore').textContent()).includes('1/3 corrette'));
  assert.deepEqual(page.errors,[]);
 } finally {await context.close()}
});
