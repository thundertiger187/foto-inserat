// Ende-zu-Ende-Test mit echtem Gemini-Aufruf.
// Aufruf: GEMINI_API_KEY=… node tests/e2e.mjs [BASIS_URL]
// Der Key wird nur zur Laufzeit in den flüchtigen Browser-Kontext gegeben; er wird nicht gespeichert, nicht geloggt.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCREENS = path.join(ROOT, 'screens'), OUT = path.join(ROOT, 'tests', 'ergebnisse');
fs.mkdirSync(SCREENS, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const KEY = process.env.GEMINI_API_KEY;
const NUR = process.env.NUR ? process.env.NUR.split(',') : null;
let base = process.argv[2], server;
if (!base) {
  server = spawn('python3', ['-m', 'http.server', '8787', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800)); base = 'http://127.0.0.1:8787/';
}
const FAELLE = [
  { id: 'foto1_controller', dateien: ['testfotos/foto1_controller.jpg'], plz: '40699 Erkrath', hinweise: 'funktioniert einwandfrei, kabelgebunden, kaum benutzt' },
  { id: 'foto2_lichtmaschine_regler', dateien: ['testfotos/foto2_lichtmaschine_regler.jpg'], plz: '40699 Erkrath', hinweise: '' },
  { id: 'foto3_bonsaischalen', dateien: ['testfotos/foto3_bonsaischalen.jpg'], plz: '40699 Erkrath', hinweise: 'gebraucht, gereinigt' }
];
const shot = (p, name, full = false) => p.screenshot({ path: path.join(SCREENS, name), fullPage: full });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE',
  permissions: ['clipboard-read', 'clipboard-write'],
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
const logs = []; page.on('console', m => logs.push(`${m.type()}: ${m.text()}`)); page.on('pageerror', e => logs.push(`pageerror: ${e.message}`));
const bericht = { zeit: new Date().toISOString(), basis: base, faelle: [], checks: {} };

try {
  await page.goto(base); await page.waitForSelector('#v-start:not([hidden])');
  bericht.checks.kein_key_banner = await page.isVisible('#kein-key');
  await shot(page, '01_start_erster_start.png');
  await page.click('#btn-einstellungen'); await page.waitForSelector('#v-einstellungen:not([hidden])');
  await shot(page, '03_einstellungen.png', true);

  // EXIF/GPS-Test (ohne API-Aufruf)
  await page.click('#btn-home');
  await page.setInputFiles('#in-galerie', path.join(ROOT, 'tests/exif_gps_test.jpg'));
  await page.waitForFunction(() => window.__fotoInserat.fotos.length === 1);
  bericht.checks.exif = await page.evaluate(async () => {
    const f = window.__fotoInserat.fotos[0]; const u = new Uint8Array(await f.blob.arrayBuffer());
    const s = Array.from(u.slice(0, 4096), c => String.fromCharCode(c)).join('');
    return { exif_marker: s.includes('Exif'), gps_text: s.includes('GPS-Test') || s.includes('TestCam'), groesse: [f.w, f.h], bytes: u.length };
  });
  await page.click('#thumbs .thumb button');

  if (!KEY) throw new Error('GEMINI_API_KEY fehlt – KI-Teil übersprungen');
  await page.evaluate(k => localStorage.setItem('fi.key', k), KEY);   // nur im flüchtigen Kontext

  for (const f of FAELLE) {
    if (NUR && !NUR.includes(f.id)) continue;
    await page.goto(base); await page.waitForSelector('#v-start:not([hidden])');
    await page.setInputFiles('#in-galerie', f.dateien.map(d => path.join(ROOT, d)));
    await page.waitForFunction(n => window.__fotoInserat.fotos.length === n, f.dateien.length);
    await page.fill('#in-plz', f.plz); await page.fill('#in-hinweise', f.hinweise);
    if (f.id === 'foto1_controller') await shot(page, '02_start_mit_foto.png');
    const t0 = Date.now();
    await page.click('#btn-erstellen');
    await page.waitForSelector('#v-ergebnis:not([hidden]), #v-start .banner.err', { timeout: 300000 });
    const ms = Date.now() - t0;
    const fehler = await page.$eval('#v-start .banner.err', e => e.textContent).catch(() => null);
    if (fehler) { bericht.faelle.push({ id: f.id, fehler, ms }); await shot(page, `fehler_${f.id}.png`); continue; }
    const a = await page.evaluate(() => JSON.parse(JSON.stringify({ ergebnis: window.__fotoInserat.aktuell.ergebnis, meta: window.__fotoInserat.aktuell.meta })));
    fs.writeFileSync(path.join(OUT, `${f.id}.json`), JSON.stringify({ fall: f, gesamt_ms_im_browser: ms, ...a }, null, 2));
    await shot(page, `04_ergebnis_${f.id}.png`);
    await shot(page, `05_ergebnis_${f.id}_ganz.png`, true);
    // Kopieren testen
    await page.click('[data-feld="titel"] .btn.mini');
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    bericht.faelle.push({ id: f.id, ms, modell: a.meta.modell, versuche: a.meta.versuche, api_fehler: a.meta.fehler, tokens: a.meta.tokens,
      titel: a.ergebnis.titel, titel_laenge: a.ergebnis.titel.length, kategorie: `${a.ergebnis.kategorie} > ${a.ergebnis.unterkategorie}`,
      zustand: a.ergebnis.zustand, preis: `${a.ergebnis.preis} € ${a.ergebnis.preisart}`, spanne: `${a.ergebnis.preis_min}–${a.ergebnis.preis_max} €`,
      versand: a.ergebnis.versand, mehrere_artikel: a.ergebnis.mehrere_artikel, artikel_hinweis: a.ergebnis.artikel_hinweis,
      unsicher: a.ergebnis.unsicher.map(u => u.feld), privat_hinweis: a.ergebnis.beschreibung.includes('Privatverkauf, keine Garantie oder Rücknahme'),
      kopieren_titel_ok: clip === a.ergebnis.titel });
  }
  // Verlauf
  await page.click('#btn-verlauf'); await page.waitForSelector('#v-verlauf:not([hidden])');
  await page.waitForTimeout(300);
  bericht.checks.verlauf_eintraege = await page.$$eval('.v-item', l => l.length);
  await shot(page, '06_verlauf.png');
  // Kein Key in Screenshots/Ergebnissen: Ergebnisdateien prüfen
  bericht.checks.key_in_ergebnisdateien = fs.readdirSync(OUT).some(d => fs.readFileSync(path.join(OUT, d), 'utf8').includes(KEY));
} catch (e) { bericht.abbruch = e.message.replace(KEY || '§§', '***'); }
finally {
  bericht.browser_logs = logs.map(l => KEY ? l.split(KEY).join('***') : l).slice(0, 50);
  const alt = fs.existsSync(path.join(OUT, 'bericht.json')) && NUR ? JSON.parse(fs.readFileSync(path.join(OUT, 'bericht.json'), 'utf8')) : null;
  if (alt) bericht.faelle = [...alt.faelle.filter(x => !bericht.faelle.some(y => y.id === x.id)), ...bericht.faelle];
  fs.writeFileSync(path.join(OUT, 'bericht.json'), JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify(bericht, null, 2));
  await browser.close(); if (server) server.kill();
}
