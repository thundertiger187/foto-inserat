// Kategorien für Verkaufsanzeigen, Namen wie auf https://www.kleinanzeigen.de/s-kategorien.html (Stand 30.10.2026).
// Jobs, Immobilien, Dienstleistungen, Unterricht, Tiere und Tickets sind bewusst weggelassen (kein Foto-Artikel).
export const KATEGORIEN = {
  'Auto, Rad & Boot': ['Autoteile & Reifen', 'Boote & Bootszubehör', 'Fahrräder & Zubehör', 'Motorradteile & Zubehör', 'Weiteres Auto, Rad & Boot'],
  'Elektronik': ['Audio & Hifi', 'Foto', 'Haushaltsgeräte', 'Kommunikation & Funk', 'Konsolen', 'Laptops & Notebooks', 'PCs', 'PC-Zubehör & Software', 'Smartphones', 'Smartphone Zubehör', 'Tablets & Reader', 'Telefone & Fax', 'TV & Video', 'Videospiele', 'Wearables', 'Wearables Zubehör', 'Weitere Elektronik'],
  'Haus & Garten': ['Badezimmer', 'Büro', 'Dekoration', 'Gartenzubehör & Pflanzen', 'Heimtextilien', 'Heimwerken', 'Küche & Esszimmer', 'Lampen & Licht', 'Schlafzimmer', 'Wohnzimmer', 'Weiteres Haus & Garten'],
  'Familie, Kind & Baby': ['Baby- & Kinderkleidung', 'Baby- & Kinderschuhe', 'Baby-Ausstattung', 'Babyschalen & Kindersitze', 'Kinderwagen & Buggys', 'Kinderzimmermöbel', 'Spielzeug', 'Weiteres Familie, Kind & Baby'],
  'Mode & Beauty': ['Beauty & Gesundheit', 'Damenbekleidung', 'Damenschuhe', 'Herrenbekleidung', 'Herrenschuhe', 'Taschen & Accessoires', 'Uhren & Schmuck', 'Weiteres Mode & Beauty'],
  'Freizeit, Hobby & Nachbarschaft': ['Essen & Trinken', 'Handarbeit, Basteln & Kunsthandwerk', 'Kunst & Antiquitäten', 'Modellbau', 'Sammeln', 'Sport & Camping', 'Trödel', 'Weiteres Freizeit, Hobby & Nachbarschaft'],
  'Musik, Filme & Bücher': ['Bücher & Zeitschriften', 'Büro & Schreibwaren', 'Comics', 'Fachbücher, Schule & Studium', 'Film & DVD', 'Musik & CDs', 'Musikinstrumente', 'Weitere Musik, Filme & Bücher'],
  'Haustiere': ['Zubehör'],
  'Verschenken & Tauschen': ['Verschenken', 'Tauschen']
};
// Zustand-Stufen wie in den Kleinanzeigen-Filtern (z. B. Elektronik > Handy & Telefon).
export const ZUSTAENDE = ['Neu', 'Sehr Gut', 'Gut', 'In Ordnung', 'Defekt'];
export const PREISARTEN = ['Festpreis', 'VB', 'Zu verschenken'];
export const VERSAND = ['Versand möglich', 'Nur Abholung'];
export const TITEL_MAX = 65;
export const BESCHREIBUNG_MAX = 4000;
export const PRIVAT_HINWEIS = 'Privatverkauf, keine Garantie oder Rücknahme.';
export const AUFGEBEN_URL = 'https://www.kleinanzeigen.de/p-anzeige-aufgeben.html';
