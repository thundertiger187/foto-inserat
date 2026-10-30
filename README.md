# Foto-Inserat – Kleinanzeigen-Entwurf per Foto

Smartphone-Web-App (PWA): Artikel fotografieren → die KI (Google Gemini) schreibt einen fertigen Inserats-Entwurf im Kleinanzeigen-Stil → prüfen, Felder kopieren und selbst in der Kleinanzeigen-App einfügen.

**App öffnen:** <https://thundertiger187.github.io/foto-inserat/> (QR-Code: `qr.png`)

Kleinanzeigen bietet Privatleuten keine öffentliche API. Die App veröffentlicht deshalb **nichts automatisch**. Sie braucht **keinen Kleinanzeigen-Login** und liest **keine Daten von Kleinanzeigen aus**. Sie öffnet nur die Aufgeben-Seite (`https://www.kleinanzeigen.de/p-anzeige-aufgeben.html`). Auf dem Handy öffnet sich dabei gegebenenfalls die Kleinanzeigen-App.

## Erster Start (einmalig, ca. 2 Minuten)

1. Link oder QR-Code am Handy öffnen (Chrome auf Android, Safari auf dem iPhone).
2. Optional installieren: In Chrome über ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“, in Safari über Teilen → „Zum Home-Bildschirm“.
3. ⚙️ **Einstellungen** öffnen. Auf <https://aistudio.google.com/apikey> mit einem Google-Konto anmelden und auf „API-Schlüssel erstellen“ tippen. Den Schlüssel kopieren, einfügen, **Speichern** und danach **Testen** tippen.
4. Optional eine Standard-PLZ eintragen.

Der Key wird **nur im Browser dieses Geräts** gespeichert (localStorage). Er wird nur bei der Analyse direkt an Google gesendet (`generativelanguage.googleapis.com`, im Header `x-goog-api-key`). Er steht nicht im Code und nicht im Repo, und es gibt keinen eigenen Server. „Löschen“ in den Einstellungen entfernt ihn.

## Benutzung in 3 Schritten

1. **Fotografieren:** „Foto aufnehmen“ öffnet die Kamera. Über „Aus Galerie“ lassen sich bis zu 10 Fotos wählen. Optional kommen PLZ und Hinweise dazu (z. B. „kaum benutzt, OVP dabei“).
2. **Prüfen:** Alle Felder lassen sich bearbeiten. **Orange** markierte Felder sind unsicher und zeigen den Grund. Wer ein Feld bearbeitet, entfernt die Markierung.
3. **Übernehmen:** „Teilen“ gibt Fotos und Text an die Kleinanzeigen-App oder eine andere App weiter. „Fotos speichern“ legt die Fotos in der Galerie ab. Danach „Kleinanzeigen öffnen“ tippen und jedes Feld mit 📋 kopieren und einfügen, oder alles auf einmal mit „Alles kopieren“. Veröffentlichen musst du selbst.

Der Verlauf (⏱) speichert die letzten 20 Entwürfe samt Fotos nur auf dem Gerät (IndexedDB).

## Was die KI liefert

| Feld | Regel |
|---|---|
| Titel | max. **65 Zeichen** (Kleinanzeigen-Limit laut [themen.kleinanzeigen.de](https://themen.kleinanzeigen.de/gute-anzeigen-schlechte-anzeigen/)). Die App kürzt notfalls und markiert den Titel. Mit Zeichenzähler. |
| Kategorie / Unterkategorie | Auswahl aus den echten Kleinanzeigen-Namen ([s-kategorien.html](https://www.kleinanzeigen.de/s-kategorien.html), Stand 30.10.2026), siehe `kategorien.js`. Unbekannte Werte werden markiert. |
| Zustand | **Neu, Sehr Gut, Gut, In Ordnung, Defekt**, also die Stufen und die Schreibweise aus den Kleinanzeigen-Filtern. Nicht jede Kategorie hat ein Zustand-Feld. |
| Preis | Vorschlag in € mit **Festpreis / VB / Zu verschenken** sowie einer Spanne und einer kurzen Begründung. Das ist eine KI-Schätzung ohne Marktdaten. |
| Merkmale | kategorietypisch (Marke, Modell, Farbe, Größe, Material, Teilenummer …). Geschätzte Werte sind orange. |
| Beschreibung | freundlich und ehrlich, mit sichtbaren Mängeln, Lücken als `[bitte ergänzen: …]`, max. 4000 Zeichen. Der Satz **„Privatverkauf, keine Garantie oder Rücknahme.“** wird immer angehängt. |
| Versand | „Versand möglich“ / „Nur Abholung“ plus Hinweis (z. B. Päckchen, grobe Portospanne). |
| Mehrere Artikel | Sind mehrere unterschiedliche Artikel zu sehen, zeigt die App einen Warnhinweis mit Empfehlung (einzeln oder als Set). |
| Foto-Tipps | 0–3 Tipps, z. B. „Typenschild fotografieren“ |

## Datenschutz und Sicherheit

- Fotos werden im Browser auf max. 1600 px verkleinert und über ein Canvas neu als JPEG kodiert. Dabei gehen **EXIF, GPS und XMP verloren** (getestet, siehe unten).
- Die Fotos gehen nur an Google Gemini. Hinweis: Im kostenlosen Gemini-Kontingent darf Google Eingaben zur Produktverbesserung nutzen. Deshalb keine Fotos mit Personen oder Dokumenten verwenden.
- Eine Content-Security-Policy erlaubt Verbindungen nur zur eigenen Seite und zu `generativelanguage.googleapis.com`. Es gibt keine Tracker und keine externen Skripte.
- Der Service Worker speichert nur die App-Dateien zwischen, nie KI-Anfragen.

## KI-Modell und Ausfallsicherheit

Standard ist `gemini-3.8-flash` (in den Einstellungen umstellbar). Bei HTTP 503/500/504, bei einer Zeitüberschreitung (75 s je Versuch) oder bei 429 (Kontingent erschöpft) wechselt die App automatisch: 2× gewähltes Modell → 2× `gemini-3.5-flash` → zuletzt `gemini-3.5-flash-lite`. Strukturierte JSON-Ausgabe (`responseSchema`), `thinkingLevel: low`. Die Logik stammt aus `/workspace/prototyp-ki/lib/gemini.js` und wurde für den Browser übernommen.

Die Gemini-REST-API erlaubt Aufrufe direkt aus dem Browser. Geprüft wurde das per CORS-Preflight von `https://thundertiger187.github.io` aus: `access-control-allow-origin` wird gespiegelt, `x-goog-api-key` ist erlaubt.

## Tests (30.10.2026)

`GEMINI_API_KEY=… node tests/e2e.mjs https://thundertiger187.github.io/foto-inserat/`. Playwright und headless Chrome laufen im Viewport 375×812 (Mobilmodus) gegen die **veröffentlichte** Seite. Der Key wird nur zur Laufzeit in den flüchtigen Browser-Kontext gegeben. Ergebnisse stehen in `tests/ergebnisse/`, Screenshots in `screens/`, Fotos und Lizenzen in `testfotos/QUELLEN.md`.

| Foto | Titel | Kategorie | Zustand | Preis | Modell (Dauer) | Auffälligkeiten |
|---|---|---|---|---|---|---|
| Xbox-360-Controller (Elektronik, PD) | Xbox 360 Controller Schwarz USB Kabel gebunden PC (49 Z.) | Elektronik > PC-Zubehör & Software | Sehr Gut | 15 € VB (10–20) | 3.5-flash nach Timeout von 3.8 und einem 503 (91,0 s) | Die Kategorie schwankt zwischen den Läufen: In einem lokalen Vorlauf mit 3.8-flash kam „Konsolen“. „Sehr Gut“ stammt aus dem Hinweis „kaum benutzt“. |
| Bosch-Lichtmaschinenregler (Autoteil, CC BY-SA 4.0) | Bosch Lichtmaschinenregler 1 197 311 021 EL 14V 4C Regler (57 Z.) | Auto, Rad & Boot > Autoteile & Reifen | In Ordnung | 10 € VB (5–15) | 3.8-flash (60,3 s) | Die Teilenummer wurde korrekt vom Aufdruck gelesen. Zustand und Preis sind als unsicher markiert, weil die Funktion nicht prüfbar ist. Die Finger im Bild wurden nicht als Personen-Hinweis gemeldet. |
| 7 Bonsaischalen (CC BY-SA 3.0) | Bonsaischalen Set 7 Stück Keramik Tontöpfe Bonsai Schalen (57 Z.) | Haus & Garten > Gartenzubehör & Pflanzen | Gut | 45 € VB (35–60) | 3.5-flash nach Timeout von 3.8 (80,0 s) | **„Mehrere Artikel“-Hinweis ausgelöst** (Empfehlung: Set oder einzeln). „Versand möglich“ ist bei Keramik diskutabel. |

Weitere Prüfungen im selben Lauf: Banner „kein Key“ beim ersten Start ✓; EXIF/GPS-Testbild (`tests/exif_gps_test.jpg`) → nach der Verarbeitung keine EXIF-Markierung und kein GPS-Text mehr ✓; „Kopieren“ (Titel) landet in der Zwischenablage ✓; Privatverkauf-Satz in allen Beschreibungen ✓; Verlauf mit 3 Einträgen ✓; Key in keiner Ergebnisdatei ✓.

Verfügbarkeit während der Tests: Vorher brach ein Lauf bei 2 von 3 Fotos mit HTTP 503 auf beiden Modellen ab, und einmal hing eine Anfrage über 5 Minuten. Daraus entstanden das 75-s-Zeitlimit und Flash-Lite als letzte Stufe. Die Dauer schwankte zwischen 6 und 91 s.

Nicht automatisch getestet: Web Share mit Dateien, Kamera-Aufnahme und Installation auf einem echten Handy. Diese Funktionen hängen vom Gerät ab und lassen sich headless nicht prüfen.

## Bekannte Grenzen

- **Verfügbarkeit und Kontingent:** Das kostenlose Gemini-Kontingent ist klein (beim Test-Key z. B. 20 Anfragen pro Tag für `gemini-3.8-flash`), und die Modelle sind oft überlastet (503). Dann dauert es länger oder es kommt eine Fehlermeldung. Fotos und Hinweise bleiben erhalten, man tippt einfach erneut auf „Inserat erstellen“.
- **Preise** sind Schätzungen ohne Marktdaten. Am besten vorher ähnliche Anzeigen in der Kleinanzeigen-App ansehen.
- **Zustand und Funktion** lassen sich auf einem Foto nicht prüfen. Hinweise wie „funktioniert“ verbessern das Ergebnis.
- **Kategorien:** Die Liste ist fest hinterlegt (Stand 30.10.2026). Kleinanzeigen fragt in manchen Kategorien eine dritte Ebene oder eigene Merkmale ab (z. B. „Art“), die man in der App selbst wählt.
- **Teilen:** Web Share mit Dateien funktioniert in aktuellem Chrome (Android) und Safari (iOS). Ob die Kleinanzeigen-App im Teilen-Menü auftaucht, hängt von der App ab. Sonst „Fotos speichern“ wählen und die Fotos in der App aus der Galerie hinzufügen. Am Desktop werden die Fotos als Dateien heruntergeladen.
- Verlauf und Key liegen im Browser-Speicher. Wer Browserdaten löscht, verliert beides.

## Aufbau

```
index.html  style.css  app.js     Oberfläche, Fotos (Canvas), Verlauf (IndexedDB), Kopieren/Teilen
ki.js                             Gemini-Aufruf, Prompt, responseSchema, Fallback, Nachbearbeitung (Limits)
kategorien.js                     Kleinanzeigen-Kategorien, Zustände, Limits, Aufgeben-URL
manifest.webmanifest  sw.js  icons/   PWA
tests/e2e.mjs                     Ende-zu-Ende-Test (Playwright), Ergebnisse in tests/ergebnisse/
```

Lokal starten: `python3 -m http.server 8787`, dann <http://localhost:8787> öffnen. Es gibt keinen Build-Schritt.
