// Gemini-Aufruf direkt aus dem Browser (REST generateContent). Der Key kommt aus den Einstellungen des Geräts.
import { KATEGORIEN, ZUSTAENDE, PREISARTEN, VERSAND, TITEL_MAX, BESCHREIBUNG_MAX, PRIVAT_HINWEIS } from './kategorien.js';

export const MODELLE = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Standard)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Ausweichmodell)' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (schnell, ungenauer)' }
];
export const FALLBACK = 'gemini-3.5-flash';
const TIMEOUT_MS = 75000; // je Versuch; Gemini hängt bei Überlast manchmal minutenlang
const FELDER = ['titel', 'kategorie', 'unterkategorie', 'zustand', 'preis', 'attribute', 'beschreibung', 'versand'];

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    mehrere_artikel: { type: 'BOOLEAN', description: 'true, wenn mehrere unterschiedliche Artikel zu sehen sind' },
    artikel_hinweis: { type: 'STRING', description: 'Bei mehreren Artikeln: welche, und Empfehlung (einzeln oder als Set). Sonst leer.' },
    titel: { type: 'STRING' },
    kategorie: { type: 'STRING', enum: Object.keys(KATEGORIEN) },
    unterkategorie: { type: 'STRING' },
    zustand: { type: 'STRING', enum: ZUSTAENDE },
    preis: { type: 'INTEGER', description: 'Preisvorschlag in Euro, 0 bei Zu verschenken' },
    preisart: { type: 'STRING', enum: PREISARTEN },
    preis_min: { type: 'INTEGER' }, preis_max: { type: 'INTEGER' },
    preis_begruendung: { type: 'STRING' },
    attribute: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      name: { type: 'STRING' }, wert: { type: 'STRING' }, unsicher: { type: 'BOOLEAN' } }, required: ['name', 'wert', 'unsicher'] } },
    beschreibung: { type: 'STRING' },
    versand: { type: 'STRING', enum: VERSAND },
    versand_hinweis: { type: 'STRING' },
    unsicher: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      feld: { type: 'STRING', enum: FELDER }, grund: { type: 'STRING' } }, required: ['feld', 'grund'] } },
    foto_tipps: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['mehrere_artikel', 'artikel_hinweis', 'titel', 'kategorie', 'unterkategorie', 'zustand', 'preis', 'preisart',
    'preis_min', 'preis_max', 'preis_begruendung', 'attribute', 'beschreibung', 'versand', 'versand_hinweis', 'unsicher', 'foto_tipps']
};

export function buildPrompt({ hinweise, plz, anzahl }) {
  const baum = Object.entries(KATEGORIEN).map(([k, u]) => `- ${k}: ${u.join(' | ')}`).join('\n');
  return `Du hilfst einer Privatperson in Deutschland, einen gebrauchten Artikel auf Kleinanzeigen (kleinanzeigen.de) zu verkaufen.
Du bekommst ${anzahl} Foto(s) desselben Verkaufs. Erstelle einen fertigen Inserats-Entwurf auf Deutsch.

REGELN
- titel: höchstens ${TITEL_MAX} Zeichen inkl. Leerzeichen (hartes Kleinanzeigen-Limit). Suchbegriffe zuerst: Artikelart, Marke, Modell, wichtigstes Merkmal. Keine Werbefloskeln, keine Emojis, kein "TOP!!!", keine Großbuchstaben-Wörter.
- kategorie + unterkategorie: genau aus dieser Kleinanzeigen-Liste wählen (Schreibweise übernehmen):
${baum}
- zustand: genau eine Kleinanzeigen-Stufe: Neu (unbenutzt), Sehr Gut (kaum Spuren), Gut (normale Gebrauchsspuren), In Ordnung (deutliche Spuren, funktioniert), Defekt (funktioniert nicht/Ersatzteil). Ein Foto zeigt keine Funktion: Zustand ist eine Schätzung, deshalb in "unsicher" aufnehmen, außer die Angaben des Verkäufers bestätigen ihn.
- preis: realistischer Gebrauchtpreis auf Kleinanzeigen in ganzen Euro, eher etwas zügig verkaufbar. preisart: "VB" ist üblich; "Festpreis" bei sehr günstigen Kleinteilen; "Zu verschenken" nur bei nahezu wertlosen Dingen (dann preis=0). preis_min/preis_max = plausible Spanne. preis_begruendung: 1 kurzer Satz. Preise sind Schätzungen ohne Marktdaten → "preis" in "unsicher", wenn Modell/Zustand nicht klar ist.
- attribute: kategorietypische Merkmale, wie Kleinanzeigen sie abfragt bzw. Käufer sie suchen (z. B. Marke, Modell, Art, Farbe, Größe, Material, Maße, Teilenummer/Herstellernummer, Fahrzeug-Kompatibilität, Speicher). Nur was sichtbar ist oder angegeben wurde; geschätzte Werte (z. B. Maße, Kompatibilität) mit unsicher=true. Nichts erfinden: Unbekanntes weglassen.
- beschreibung: freundlich, ehrlich, sachlich, kurze Absätze, max. ${BESCHREIBUNG_MAX} Zeichen. Inhalt: was es ist, sichtbare Merkmale/Beschriftungen, Lieferumfang (nur Sichtbares bzw. Angaben), Zustand und ALLE auf dem Foto erkennbaren Mängel/Gebrauchsspuren konkret benennen, Versand/Abholung. Keine erfundenen Fakten (Kaufdatum, Funktion, Herkunft) – was der Verkäufer ergänzen sollte, als [bitte ergänzen: …] markieren. Keine Telefonnummer, Adresse oder Namen. Letzte Zeile exakt: "${PRIVAT_HINWEIS}"
- versand: "Versand möglich" für kleine/mittlere versandfähige Dinge, "Nur Abholung" für Großes, Schweres, Zerbrechliches ohne gute Verpackung, Möbel, Pflanzen. versand_hinweis: konkret, z. B. "Versand als Päckchen/Paket S, ca. 4–6 € zzgl." oder "Abholung in [Ort/PLZ]"; keine exakten Portopreise erfinden, nur grobe Spannen.
- mehrere_artikel: true, wenn auf den Fotos mehrere UNTERSCHIEDLICHE Artikel zu sehen sind (nicht: Zubehör desselben Artikels, Paar Schuhe, Set gleicher Teile). Dann artikel_hinweis kurz: welche Artikel, und ob einzeln inserieren oder als Set; der Entwurf beschreibt dann sinnvollerweise das Set bzw. den Hauptartikel.
- unsicher: jedes Feld, bei dem du nicht sicher bist, mit kurzem Grund (z. B. "Modell nicht lesbar", "Funktion auf Foto nicht prüfbar").
- foto_tipps: 0–3 kurze Tipps für bessere Fotos (z. B. Typenschild, Mängel nah, Tageslicht). Auch Hinweis, wenn Personen/Gesichter/Kennzeichen/Adressen sichtbar sind.

ANGABEN DES VERKÄUFERS (haben Vorrang vor dem Foto)
${hinweise ? hinweise : '- keine'}
${plz ? `PLZ/Ort für Abholung: ${plz}` : ''}

Antworte nur mit JSON gemäß Schema.`;
}

// Nachbearbeitung: Limits und Pflichtangaben durchsetzen, Unsicherheiten ergänzen.
export function nachbearbeiten(r) {
  const unsicher = new Map((r.unsicher || []).map(u => [u.feld, u.grund]));
  const titel = (r.titel || '').replace(/\s+/g, ' ').trim();
  if (titel.length > TITEL_MAX) {
    let t = titel.slice(0, TITEL_MAX); const i = t.lastIndexOf(' ');
    r.titel = (i > 40 ? t.slice(0, i) : t).trim();
    unsicher.set('titel', `Titel war ${titel.length} Zeichen lang und wurde auf ${TITEL_MAX} gekürzt`);
  } else r.titel = titel;
  if (!KATEGORIEN[r.kategorie]) unsicher.set('kategorie', 'Kategorie nicht in der Kleinanzeigen-Liste');
  else if (!KATEGORIEN[r.kategorie].includes(r.unterkategorie)) {
    unsicher.set('unterkategorie', `„${r.unterkategorie}“ ist keine bekannte Unterkategorie von „${r.kategorie}“`);
  }
  if (!ZUSTAENDE.includes(r.zustand)) { unsicher.set('zustand', 'Zustand unbekannt'); }
  if (r.preisart === 'Zu verschenken') r.preis = 0;
  if (!PREISARTEN.includes(r.preisart)) r.preisart = 'VB';
  let b = (r.beschreibung || '').trim();
  if (!b.includes('Privatverkauf, keine Garantie oder Rücknahme')) b += `\n\n${PRIVAT_HINWEIS}`;
  if (b.length > BESCHREIBUNG_MAX) { b = b.slice(0, BESCHREIBUNG_MAX - PRIVAT_HINWEIS.length - 3).trim() + `\n\n${PRIVAT_HINWEIS}`; unsicher.set('beschreibung', 'Beschreibung wurde auf 4000 Zeichen gekürzt'); }
  r.beschreibung = b;
  if ((r.attribute || []).some(a => a.unsicher) && !unsicher.has('attribute')) unsicher.set('attribute', 'Einzelne Merkmale sind geschätzt');
  r.unsicher = [...unsicher].map(([feld, grund]) => ({ feld, grund }));
  r.attribute = r.attribute || []; r.foto_tipps = r.foto_tipps || [];
  return r;
}

export class KiFehler extends Error { constructor(msg, status) { super(msg); this.status = status; } }

// images: [{ base64, mime }]
export async function analysiere({ apiKey, modell, images, hinweise, plz, onStatus = () => {} }) {
  if (!apiKey) throw new KiFehler('Kein Gemini-API-Key gespeichert. Bitte in den Einstellungen eintragen.');
  const body = {
    contents: [{ role: 'user', parts: [
      ...images.map(i => ({ inline_data: { mime_type: i.mime, data: i.base64 } })),
      { text: buildPrompt({ hinweise, plz, anzahl: images.length }) }
    ] }],
    generationConfig: {
      responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4,
      mediaResolution: images.length <= 3 ? 'MEDIA_RESOLUTION_HIGH' : 'MEDIA_RESOLUTION_MEDIUM',
      thinkingConfig: { thinkingLevel: 'low' }
    }
  };
  const plan = modell === FALLBACK ? [FALLBACK, FALLBACK] : [modell, modell, FALLBACK, FALLBACK];
  const fehler = []; let letzter;
  for (let i = 0; i < plan.length; i++) {
    const m = plan[i];
    onStatus(i === 0 ? `KI analysiert (${m}) …` : `Neuer Versuch mit ${m} …`);
    const t0 = performance.now();
    let res, txt;
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body), signal: ac.signal
      });
      txt = await res.text();
    } catch (e) {
      const zeit = e.name === 'AbortError';
      letzter = new KiFehler(zeit ? 'Die KI hat nicht rechtzeitig geantwortet (überlastet). Bitte gleich nochmal versuchen.' : 'Keine Verbindung zur KI (Internet prüfen).');
      fehler.push(`${m}: ${zeit ? `Zeitüberschreitung nach ${TIMEOUT_MS / 1000} s` : 'Netzwerkfehler'}`);
      // nach Zeitüberschreitung direkt zum Ausweichmodell
      if (zeit && m !== FALLBACK) while (i + 1 < plan.length && plan[i + 1] !== FALLBACK) i++;
      continue;
    } finally { clearTimeout(timer); }
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      let msg = ''; try { msg = JSON.parse(txt).error.message; } catch { msg = txt.slice(0, 200); }
      fehler.push(`${m}: HTTP ${res.status}`);
      if (res.status === 400 && /API key/i.test(msg)) throw new KiFehler('Der API-Key ist ungültig. Bitte in den Einstellungen prüfen.', 400);
      if (res.status === 403) throw new KiFehler('Der API-Key hat keinen Zugriff (403). Ist die Gemini API für den Key freigeschaltet?', 403);
      letzter = new KiFehler(res.status === 429 ? 'Kontingent des Keys erschöpft (429). Später erneut versuchen.' : `KI-Fehler HTTP ${res.status}: ${msg}`, res.status);
      if (res.status === 429 && m !== FALLBACK) { while (i + 1 < plan.length && plan[i + 1] !== FALLBACK) i++; continue; }
      if ([429, 500, 503, 504].includes(res.status)) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); continue; }
      throw letzter;
    }
    const data = JSON.parse(txt);
    const cand = data.candidates && data.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
    let parsed;
    try { parsed = JSON.parse(text); } catch { fehler.push(`${m}: ungültiges JSON (${cand && cand.finishReason})`); letzter = new KiFehler('Antwort der KI war unvollständig.'); continue; }
    return { ergebnis: nachbearbeiten(parsed), meta: { modell: data.modelVersion || m, ms, versuche: i + 1, fehler, tokens: data.usageMetadata || {} } };
  }
  throw letzter || new KiFehler('KI nicht erreichbar.');
}
