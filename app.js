import { KATEGORIEN, ZUSTAENDE, PREISARTEN, VERSAND, TITEL_MAX, BESCHREIBUNG_MAX, AUFGEBEN_URL } from './kategorien.js';
import { analysiere, MODELLE } from './ki.js';

const VERSION = '1.0.0';
const MAX_FOTOS = 10, MAX_KANTE = 1600, QUALITAET = 0.85, MAX_VERLAUF = 20;
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
};

// ---------- Einstellungen (nur lokal) ----------
const S = {
  get key() { return localStorage.getItem('fi.key') || ''; }, set key(v) { v ? localStorage.setItem('fi.key', v) : localStorage.removeItem('fi.key'); },
  get modell() { return localStorage.getItem('fi.modell') || MODELLE[0].id; }, set modell(v) { localStorage.setItem('fi.modell', v); },
  get plz() { return localStorage.getItem('fi.plz') || ''; }, set plz(v) { localStorage.setItem('fi.plz', v); }
};

// ---------- IndexedDB-Verlauf ----------
const db = new Promise((res, rej) => {
  const r = indexedDB.open('foto-inserat', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('entwuerfe', { keyPath: 'id' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function store(mode) { return (await db).transaction('entwuerfe', mode).objectStore('entwuerfe'); }
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function verlaufAlle() { const all = await req((await store('readonly')).getAll()); return all.sort((a, b) => b.zeit - a.zeit); }
async function verlaufSpeichern(e) {
  const s = await store('readwrite'); await req(s.put(e));
  const all = await verlaufAlle();
  for (const alt of all.slice(MAX_VERLAUF)) await req((await store('readwrite')).delete(alt.id));
}
async function verlaufLoeschen(id) { await req((await store('readwrite')).delete(id)); }
async function verlaufLeeren() { await req((await store('readwrite')).clear()); }

// ---------- Bilder: verkleinern + Metadaten entfernen ----------
// Das Neuzeichnen auf ein Canvas und erneute JPEG-Kodieren übernimmt keine EXIF-/GPS-/XMP-Daten.
async function verarbeiteBild(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild nicht lesbar')); i.src = URL.createObjectURL(file); });
  }
  const w0 = bmp.width, h0 = bmp.height, f = Math.min(1, MAX_KANTE / Math.max(w0, h0));
  const w = Math.round(w0 * f), h = Math.round(h0 * f);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', QUALITAET));
  return { blob, w, h, original: file.size };
}
const blobZuBase64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(b); });

// ---------- Zustand ----------
let fotos = [];      // [{blob,url,w,h}]
let aktuell = null;  // { id, zeit, fotos:[blob], ergebnis, meta, plz, hinweise }

function zeige(view) {
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== 'v-' + view;
  window.scrollTo(0, 0);
  if (view === 'verlauf') renderVerlauf();
  if (view === 'einstellungen') renderEinstellungen();
  if (view === 'start') $('#kein-key').hidden = !!S.key;
}
let toastT;
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, 2200); }

async function kopiere(text, was = 'Text') {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = el('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast(`✓ ${was} kopiert`);
}

// ---------- Start ----------
function renderThumbs() {
  const box = $('#thumbs'); box.replaceChildren();
  fotos.forEach((f, i) => box.append(el('div', { class: 'thumb' }, el('img', { src: f.url, alt: `Foto ${i + 1}` }),
    el('button', { 'aria-label': 'Foto entfernen', text: '✕', onclick: () => { URL.revokeObjectURL(f.url); fotos.splice(i, 1); renderThumbs(); } }))));
  $('#btn-erstellen').disabled = fotos.length === 0;
  const kb = fotos.reduce((s, f) => s + f.blob.size, 0) / 1024;
  $('#foto-info').textContent = fotos.length
    ? `${fotos.length}/${MAX_FOTOS} Fotos, zusammen ${Math.round(kb)} KB (verkleinert auf max. ${MAX_KANTE} px, ohne EXIF/GPS).`
    : 'Fotos werden im Gerät verkleinert; Standort- und Kameradaten (EXIF/GPS) werden entfernt.';
}
async function fotosHinzu(files) {
  const liste = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
  const frei = MAX_FOTOS - fotos.length;
  if (liste.length > frei) toast(`Maximal ${MAX_FOTOS} Fotos – ${liste.length - frei} ignoriert`);
  for (const f of liste.slice(0, Math.max(0, frei))) {
    try { const b = await verarbeiteBild(f); fotos.push({ ...b, url: URL.createObjectURL(b.blob) }); renderThumbs(); }
    catch { toast('Ein Foto konnte nicht gelesen werden (Format?)'); }
  }
}
$('#in-kamera').addEventListener('change', e => { fotosHinzu(e.target.files); e.target.value = ''; });
$('#in-galerie').addEventListener('change', e => { fotosHinzu(e.target.files); e.target.value = ''; });

$('#btn-erstellen').addEventListener('click', async () => {
  if (!S.key) { toast('Bitte zuerst den API-Key eintragen'); zeige('einstellungen'); return; }
  const hinweise = $('#in-hinweise').value.trim(), plz = $('#in-plz').value.trim();
  zeige('laden');
  try {
    const images = await Promise.all(fotos.map(async f => ({ mime: 'image/jpeg', base64: await blobZuBase64(f.blob) })));
    const { ergebnis, meta } = await analysiere({ apiKey: S.key, modell: S.modell, images, hinweise, plz,
      onStatus: t => $('#laden-status').textContent = t });
    aktuell = { id: String(Date.now()), zeit: Date.now(), fotos: fotos.map(f => f.blob), ergebnis, meta, plz, hinweise };
    await verlaufSpeichern(aktuell).catch(() => {});
    renderErgebnis(); zeige('ergebnis');
  } catch (e) {
    zeige('start');
    $('#v-start').prepend(el('div', { class: 'banner err', text: `⚠️ ${e.message}` }));
    if (e.status === 400 || e.status === 403) setTimeout(() => zeige('einstellungen'), 1500);
  }
});

// ---------- Ergebnis ----------
function feldText(e) {
  const r = aktuell.ergebnis;
  return {
    titel: r.titel,
    kategorie: `${r.kategorie} > ${r.unterkategorie}`,
    zustand: r.zustand,
    preis: r.preisart === 'Zu verschenken' ? 'Zu verschenken' : `${r.preis} € ${r.preisart}`,
    attribute: r.attribute.map(a => `${a.name}: ${a.wert}`).join('\n'),
    beschreibung: r.beschreibung,
    versand: [r.versand, r.versand_hinweis].filter(Boolean).join(' – '),
    plz: aktuell.plz || ''
  }[e];
}
function allesText() {
  const r = aktuell.ergebnis;
  return [`Titel: ${r.titel}`, `Kategorie: ${feldText('kategorie')}`, `Zustand: ${r.zustand}`, `Preis: ${feldText('preis')}`,
    r.attribute.length ? `Merkmale:\n${feldText('attribute')}` : '', `Versand: ${feldText('versand')}`, aktuell.plz ? `PLZ/Ort: ${aktuell.plz}` : '',
    '', r.beschreibung].filter(x => x !== '').join('\n').replace(/\n\n\n+/g, '\n\n');
}
function speichernSpaeter() { clearTimeout(speichernSpaeter.t); speichernSpaeter.t = setTimeout(() => verlaufSpeichern(aktuell).catch(() => {}), 600); }

function feldBox(key, titel, inhalt, extra) {
  const r = aktuell.ergebnis;
  const u = r.unsicher.find(x => x.feld === key || (key === 'kategorie' && x.feld === 'unterkategorie'));
  const box = el('div', { class: 'feld' + (u ? ' unsicher' : ''), 'data-feld': key },
    el('div', { class: 'feld-kopf' }, el('b', { text: titel }), u ? el('span', { class: 'badge', text: 'prüfen' }) : null,
      el('button', { class: 'btn mini', 'aria-label': `${titel} kopieren`, text: '📋 Kopieren', onclick: () => kopiere(feldText(key), titel) })),
    inhalt, extra || null, u ? el('p', { class: 'grund', text: `KI unsicher: ${u.grund}` }) : null);
  box.addEventListener('input', () => {   // bearbeitet = vom Nutzer geprüft
    r.unsicher = r.unsicher.filter(x => !(x.feld === key || (key === 'kategorie' && x.feld === 'unterkategorie')));
    box.classList.remove('unsicher'); box.querySelector('.badge')?.remove(); box.querySelector('.grund')?.remove();
    speichernSpaeter();
  });
  return box;
}
function auswahl(werte, wert, onchange) {
  const s = el('select', { class: 'inp', onchange: e => onchange(e.target.value) });
  for (const w of werte) s.append(el('option', { value: w, text: w, selected: w === wert }));
  if (!werte.includes(wert) && wert) s.prepend(el('option', { value: wert, text: wert, selected: true }));
  return s;
}
function zaehler(inp, max) {
  const z = el('div', { class: 'zaehler' });
  const upd = () => { z.textContent = `${inp.value.length}/${max} Zeichen`; z.classList.toggle('zu', inp.value.length > max); };
  inp.addEventListener('input', upd); upd(); return z;
}

function renderErgebnis() {
  const r = aktuell.ergebnis;
  // Warnungen
  const w = $('#erg-warnungen'); w.replaceChildren();
  if (r.mehrere_artikel) w.append(el('div', { class: 'banner warn' }, el('b', { text: '⚠️ Mehrere unterschiedliche Artikel erkannt. ' }), r.artikel_hinweis || 'Besser einzeln inserieren oder als Set kennzeichnen.'));
  const n = r.unsicher.length;
  w.append(el('div', { class: n ? 'banner warn' : 'banner info', text: n ? `${n} Feld(er) orange markiert – bitte prüfen. Bearbeiten entfernt die Markierung.` : 'Entwurf fertig. Bitte trotzdem alles kurz prüfen.' }));
  // Fotos
  const fb = $('#erg-fotos'); fb.replaceChildren();
  aktuell.fotos.forEach((b, i) => fb.append(el('div', { class: 'thumb' }, el('img', { src: URL.createObjectURL(b), alt: `Foto ${i + 1}` }))));
  // Felder
  const f = $('#erg-felder'); f.replaceChildren();
  const tIn = el('textarea', { class: 'inp titel', rows: 2, maxlength: 80, oninput: e => { e.target.value = e.target.value.replace(/\n/g, ' '); r.titel = e.target.value; } }); tIn.value = r.titel;
  f.append(feldBox('titel', 'Titel', tIn, zaehler(tIn, TITEL_MAX)));

  const ober = auswahl(Object.keys(KATEGORIEN), r.kategorie, v => { r.kategorie = v; r.unterkategorie = KATEGORIEN[v][0]; unter.replaceWith(unter = neueUnter()); });
  const neueUnter = () => auswahl(KATEGORIEN[r.kategorie] || [], r.unterkategorie, v => r.unterkategorie = v);
  let unter = neueUnter();
  f.append(feldBox('kategorie', 'Kategorie', el('div', {}, ober, el('div', { class: 'small muted', text: 'Unterkategorie:' }), unter)));

  f.append(feldBox('zustand', 'Zustand', auswahl(ZUSTAENDE, r.zustand, v => r.zustand = v),
    el('p', { class: 'small muted', text: 'Zustand-Auswahl gibt es bei Kleinanzeigen nicht in jeder Kategorie.' })));

  const pIn = el('input', { class: 'inp', type: 'number', inputmode: 'numeric', min: 0, value: r.preis, oninput: e => r.preis = Number(e.target.value || 0) });
  const pArt = auswahl(PREISARTEN, r.preisart, v => { r.preisart = v; if (v === 'Zu verschenken') { r.preis = 0; pIn.value = 0; } });
  f.append(feldBox('preis', 'Preis', el('div', { class: 'row' }, pIn, el('span', { text: '€' }), pArt),
    el('p', { class: 'small muted', text: `KI-Schätzung: ${r.preis_min}–${r.preis_max} €. ${r.preis_begruendung || ''}` })));

  const attrBox = el('div');
  const renderAttr = () => {
    attrBox.replaceChildren();
    r.attribute.forEach((a, i) => attrBox.append(el('div', { class: 'attr' + (a.unsicher ? ' unsicher' : '') },
      el('input', { class: 'inp', value: a.name, 'aria-label': 'Merkmal', oninput: e => a.name = e.target.value }),
      el('input', { class: 'inp', value: a.wert, 'aria-label': a.name, oninput: e => { a.wert = e.target.value; a.unsicher = false; e.target.parentElement.classList.remove('unsicher'); } }),
      el('button', { class: 'btn mini', 'aria-label': `${a.name} kopieren`, text: '📋', onclick: () => kopiere(a.wert, a.name) }))));
    attrBox.append(el('button', { class: 'btn mini', text: '+ Merkmal', onclick: () => { r.attribute.push({ name: '', wert: '', unsicher: false }); renderAttr(); } }));
  };
  renderAttr();
  f.append(feldBox('attribute', 'Merkmale', attrBox, el('p', { class: 'small muted', text: 'Orange = geschätzt. In der App unter „Details/Merkmale“ eintragen.' })));

  const bIn = el('textarea', { class: 'inp', rows: 12, oninput: e => r.beschreibung = e.target.value }); bIn.value = r.beschreibung;
  f.append(feldBox('beschreibung', 'Beschreibung', bIn, zaehler(bIn, BESCHREIBUNG_MAX)));

  const vHin = el('input', { class: 'inp', value: r.versand_hinweis || '', oninput: e => r.versand_hinweis = e.target.value });
  f.append(feldBox('versand', 'Versand / Abholung', el('div', {}, auswahl(VERSAND, r.versand, v => r.versand = v), vHin)));

  const plzIn = el('input', { class: 'inp', value: aktuell.plz || '', placeholder: 'PLZ / Ort', oninput: e => aktuell.plz = e.target.value });
  f.append(feldBox('plz', 'PLZ / Ort', plzIn, el('p', { class: 'small muted', text: 'Nur PLZ/Ort – keine genaue Adresse veröffentlichen.' })));

  const t = $('#erg-tipps'); t.replaceChildren();
  if (r.foto_tipps.length) t.append(el('div', { class: 'card' }, el('b', { text: '📸 Foto-Tipps' }), el('ul', {}, r.foto_tipps.map(x => el('li', { class: 'small', text: x })))));
  const m = aktuell.meta || {};
  $('#erg-meta').textContent = `Erstellt ${new Date(aktuell.zeit).toLocaleString('de-DE')} · Modell ${m.modell || '?'} · ${m.ms ? (m.ms / 1000).toFixed(1) + ' s' : ''}${m.versuche > 1 ? ` · ${m.versuche} Versuche` : ''} · KI-Entwurf, ohne Gewähr`;
}

const dateien = () => aktuell.fotos.map((b, i) => new File([b], `inserat-foto-${i + 1}.jpg`, { type: 'image/jpeg' }));
$('#btn-alles').addEventListener('click', () => kopiere(allesText(), 'Inserat'));
$('#btn-teilen').addEventListener('click', async () => {
  const files = dateien(), text = allesText(), title = aktuell.ergebnis.titel;
  try {
    if (navigator.canShare && navigator.canShare({ files })) await navigator.share({ files, title, text });
    else if (navigator.share) await navigator.share({ title, text });
    else { await kopiere(text, 'Inserat'); toast('Teilen nicht verfügbar – Text kopiert'); }
  } catch (e) { if (e.name !== 'AbortError') kopiere(text, 'Inserat'); }
});
$('#btn-fotos').addEventListener('click', async () => {
  const files = dateien();
  try { if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  files.forEach((f, i) => setTimeout(() => { const a = el('a', { href: URL.createObjectURL(f), download: f.name }); document.body.append(a); a.click(); a.remove(); }, i * 400));
  toast(`${files.length} Foto(s) werden gespeichert`);
});
$('#btn-ka').href = AUFGEBEN_URL;
$('#btn-neu').addEventListener('click', () => {
  fotos.forEach(f => URL.revokeObjectURL(f.url)); fotos = []; renderThumbs();
  $('#in-hinweise').value = ''; $('#in-plz').value = S.plz; document.querySelectorAll('#v-start .banner.err').forEach(b => b.remove());
  zeige('start');
});

// ---------- Verlauf ----------
async function renderVerlauf() {
  const box = $('#verlauf-liste'); box.replaceChildren();
  const all = await verlaufAlle().catch(() => []);
  if (!all.length) { box.append(el('p', { class: 'muted', text: 'Noch keine Entwürfe.' })); return; }
  for (const e of all) {
    box.append(el('div', { class: 'v-item' },
      e.fotos[0] ? el('img', { src: URL.createObjectURL(e.fotos[0]), alt: '' }) : el('img', { alt: '' }),
      el('div', { class: 'txt' }, el('b', { text: e.ergebnis.titel }),
        el('span', { class: 'small muted', text: `${e.ergebnis.preisart === 'Zu verschenken' ? 'Zu verschenken' : e.ergebnis.preis + ' € ' + e.ergebnis.preisart} · ${new Date(e.zeit).toLocaleDateString('de-DE')}` })),
      el('button', { class: 'btn mini', text: 'Öffnen', onclick: () => { aktuell = e; renderErgebnis(); zeige('ergebnis'); } }),
      el('button', { class: 'btn mini danger', 'aria-label': 'Entwurf löschen', text: '🗑', onclick: async () => { await verlaufLoeschen(e.id); renderVerlauf(); } })));
  }
}

// ---------- Einstellungen ----------
function keyStatus(t, ok) { const s = $('#key-status'); s.textContent = t; s.className = 'small ' + (ok === false ? 'grund' : ok ? '' : 'muted'); }
function renderEinstellungen() {
  $('#in-key').value = S.key; $('#in-key').type = 'password';
  keyStatus(S.key ? `✓ Key gespeichert (endet auf …${S.key.slice(-4)})` : 'Noch kein Key gespeichert.', S.key ? true : null);
  const sel = $('#in-modell'); sel.replaceChildren(...MODELLE.map(m => el('option', { value: m.id, text: m.name, selected: m.id === S.modell })));
  $('#in-plz-standard').value = S.plz;
  $('#version').textContent = `Version ${VERSION}.`;
}
$('#btn-key-zeigen').addEventListener('click', () => { const i = $('#in-key'); i.type = i.type === 'password' ? 'text' : 'password'; });
$('#btn-key-speichern').addEventListener('click', () => {
  const v = $('#in-key').value.trim();
  if (!v) { toast('Bitte Key einfügen'); return; }
  if (!/^[A-Za-z0-9_\-.]{20,}$/.test(v)) { keyStatus('Das sieht nicht wie ein API-Key aus (beginnt meist mit „AIza“).', false); return; }
  S.key = v; renderEinstellungen(); toast('Key lokal gespeichert');
});
$('#btn-key-testen').addEventListener('click', async () => {
  const k = $('#in-key').value.trim() || S.key; if (!k) { keyStatus('Kein Key eingegeben.', false); return; }
  keyStatus('Teste …');
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${S.modell}`, { headers: { 'x-goog-api-key': k } });
    keyStatus(r.ok ? `✓ Key funktioniert (${S.modell} erreichbar).` : `✗ Key abgelehnt (HTTP ${r.status}).`, r.ok);
  } catch { keyStatus('✗ Keine Verbindung.', false); }
});
$('#btn-key-loeschen').addEventListener('click', () => { S.key = ''; renderEinstellungen(); toast('Key gelöscht'); });
$('#btn-einst-speichern').addEventListener('click', () => { S.modell = $('#in-modell').value; S.plz = $('#in-plz-standard').value.trim(); if (!$('#in-plz').value) $('#in-plz').value = S.plz; toast('Gespeichert'); });
$('#btn-verlauf-loeschen').addEventListener('click', async () => { if (confirm('Alle Entwürfe auf diesem Gerät löschen?')) { await verlaufLeeren(); toast('Verlauf gelöscht'); } });

// ---------- Navigation ----------
$('#btn-home').addEventListener('click', () => zeige('start'));
$('#btn-verlauf').addEventListener('click', () => zeige('verlauf'));
$('#btn-einstellungen').addEventListener('click', () => zeige('einstellungen'));
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); zeige(g.dataset.go); } });

$('#in-plz').value = S.plz;
renderThumbs(); zeige('start');
if (!S.key) $('#kein-key').hidden = false;
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Test-Haken (nur für automatisierte Tests): Fotos ohne Datei-Dialog hinzufügen.
window.__fotoInserat = { fotosHinzu, get fotos() { return fotos; }, get aktuell() { return aktuell; } };
