const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'../CWZ_v6_7_6.html')))});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})});
after(async()=>{if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok))});
test('CWZ 6.7.6 duration slider, lengths, immediate group feedback and voice buttons',{timeout:60000},async()=>{
const ctx=await browser.newContext();const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto(url+'/#groups');
await page.locator('#durationSlider').fill('2');assert.equal(await page.locator('#duration').inputValue(),'2');
await page.locator('#duration').fill('3');assert.equal(await page.locator('#durationSlider').inputValue(),'3');
await page.locator('#duration').fill('1');
await page.locator('#groupLength').selectOption('3');await page.locator('#generate').click();
const first=await page.evaluate(()=>state.groups[0]);assert.equal(first.length,3);
const cells=page.locator('#answerGrid .cw-group').first().locator('.cw-cell');
for(let i=0;i<3;i++)await cells.nth(i).fill(i===1?(first[i]==='K'?'A':'K'):first[i]);
assert.equal(await cells.nth(0).evaluate(el=>el.classList.contains('cw-correct')),true);
assert.equal(await cells.nth(1).evaluate(el=>el.classList.contains('cw-wrong')),true);
await cells.nth(1).fill(first[1]);assert.equal(await cells.nth(1).evaluate(el=>el.classList.contains('cw-correct')),true);
await cells.nth(2).fill('');assert.equal(await cells.nth(0).evaluate(el=>el.classList.contains('cw-correct')),false);
await page.goto(url+'/#voice');await page.locator('#voiceCountSlider').fill('35');assert.equal(await page.locator('#voiceCount').inputValue(),'35');
await page.locator('#voiceCount').fill('41');assert.equal(await page.locator('#voiceCountSlider').inputValue(),'41');
for(const id of ['voiceResume','voicePause','voiceEnd','voiceRepeat','voiceListen','voiceSkip','voiceReveal'])assert((await page.locator('#'+id).getAttribute('aria-label'))?.length>0);
assert.deepEqual(errors,[]);
}finally{await ctx.close()}
});