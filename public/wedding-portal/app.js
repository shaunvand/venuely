
// ── PDF.js worker ────────────────────────────────────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ══════════════════════════════════════════════════════════════════════════════
// WHITE-LABEL CONFIG — swap these values for each venue
// ══════════════════════════════════════════════════════════════════════════════
const VENUE = {
  name: 'Pat Busch Mountain Reserve',
  tagline: 'An intimate wilderness wedding experience',
  location: 'Bergendal Road, Klaasvoogds West, Robertson, Western Cape, 6705',
  mapUrl: 'https://maps.google.com/?q=Pat+Busch+Mountain+Reserve+Robertson',
  website: 'https://www.patbusch.co.za/',
  email: 'info@patbusch.co.za',
  phone: '+27 23 626 3716',
  couple: { name1: 'Heather', name2: 'Shaun', date: '2027-01-07', displayDate: '7 January 2027' }
};

const CATALOGUE_ITEM_IMAGES = {
  'F4': 'assets/img/4cbb54c58e2e.png',
  'F9': 'assets/img/9c6e54639154.png',
  'F10': 'assets/img/980de070589a.png',
  'F16': 'assets/img/4ebaaf445f15.png',
  'F18': 'assets/img/35b6f6e1217b.png',
  'F24': 'assets/img/03cd07100e23.png',
  'F28': 'assets/img/2c4b9ac0df09.png',
  'F33': 'assets/img/951ec7a42baa.png',
  'F36': 'assets/img/66cbfd961fe3.png',
  'F84': 'assets/img/4921d6813328.png',
  'F99': 'assets/img/4e1e98447a73.png',
  'F112': 'assets/img/f2a4f7e5a316.png',
  'F113': 'assets/img/377342265b03.png',
  'F114': 'assets/img/5ac1840ade3a.png',
  'F115': 'assets/img/7457e1e11cef.png',
  'F118': 'assets/img/09279fe11fbf.png',
  'F119': 'assets/img/080e0def2a77.png',
  'F120': 'assets/img/40adf8ab82ee.png',
  'F121': 'assets/img/508c211b299f.png',
  'F122': 'assets/img/8d0d1bc7c020.png',
  'F125': 'assets/img/6525f29620e6.png',
  'F155': 'assets/img/792c19211a5e.png',
  'F127': 'assets/img/fc1c570d1aa0.png',
  'F129': 'assets/img/1814b069c346.png',
  'F130': 'assets/img/2c7cbabfbeb8.png',
  'F131': 'assets/img/89a4a8895fe3.png',
  'F133': 'assets/img/aa0f03fff9cb.png',
  'F135': 'assets/img/0f7bbccd8c22.png',
  'F136': 'assets/img/db7fd499a8e9.png',
  'F137': 'assets/img/01c4716a7b23.png',
  'F138': 'assets/img/1795b8f5f230.png',
  'F139': 'assets/img/a4cc08f0ec53.png',
  'F140': 'assets/img/3a2ccabec044.png',
  'F141': 'assets/img/ebe5b4790876.png',
  'F142': 'assets/img/bb5c6b423c8b.png',
  'F145': 'assets/img/31c5fffcf6cc.png',
  'F146': 'assets/img/b916b2395fc5.png',
  'F152': 'assets/img/794f401f9cdb.png',
  'F153': 'assets/img/6e715c98e220.png',
  'F154': 'assets/img/b674de378e31.png',
  'F156': 'assets/img/22e921e48548.png',
  'F158': 'assets/img/e1723dba2080.png',
  'F159': 'assets/img/0a3ab9c9d9d7.png',
  'F162': 'assets/img/82b7c464de12.png',
  'F161': 'assets/img/7cee3c281671.png'
};

let CATALOGUE_ITEMS = [
  { code: 'F1', imgKey: 'F4', cat: 'Glassware & Serveware', name: 'Champagne Flutes, Wine & Beer Glasses', desc: '200× Champagne Flutes, Universal Wine glasses (red & white), Willy Beer glasses & Zombie glasses. Sufficient for all areas for up to 120 guests.', qty: '200', type: 'included' },
  { code: 'F7', imgKey: 'F9', cat: 'Glassware & Serveware', name: 'White Dinner Plates, Side Plates & Soup Bowls', desc: '120× Marola broad-rim white catering crockery — formal wedding stock, all matching. Farmhouse Erika has its own informal crockery which does not match.', qty: '120', type: 'included' },
  { code: 'F10', imgKey: 'F10', cat: 'Glassware & Serveware', name: 'White Coffee / Tea Mugs', desc: '70–100× Straight-sided catering mugs, no saucer. For Farewell Breakfast, late-night tea/coffee & hot chocolate station.', qty: '70–100', type: 'included' },
  { code: 'F11', imgKey: 'F16', cat: 'Glassware & Serveware', name: 'Dinner Cutlery & Salt & Pepper Shakers', desc: '120× Dinner Knives, Forks, Dessert Spoons, Teaspoons & Cake Forks (Munich style stainless steel) — formal wedding cutlery. Plus 30 Salt & Pepper shaker sets.', qty: '120', type: 'included' },
  { code: 'F17', imgKey: 'F18', cat: 'Glassware & Serveware', name: 'Champagne Bowls & Ice Buckets (Large)', desc: '2× XL ice buckets/bowls + 1× upright bucket. Large steel ice bowls — great for white wine, champagne, ice, beers & ciders.', qty: '2+1', type: 'included' },
  { code: 'F19', imgKey: 'F24', cat: 'Glassware & Serveware', name: 'Jugs, Carafes & Ashtrays', desc: '15× variety of Water Jugs, Vintage Juice Jugs & Carafes — enough for all tables. Great for punch, water, juices & iced tea. Plus glass & ceramic ashtrays.', qty: '15', type: 'included' },
  { code: 'F25', imgKey: 'F28', cat: 'Glassware & Serveware', name: 'Ice Buckets — Stainless Steel (various)', desc: 'Variety of SS ice buckets from large 5L with handles to smaller sizes. For ice on tables, at the bar, or chilling white wine & beers.', qty: 'Various', type: 'included' },
  { code: 'F29', imgKey: 'F33', cat: 'Glassware & Serveware', name: 'Sundry Bar & Wedding Cake Utensils', desc: 'Ice tongs, waiters\' friends, serving spoons, wedding cake lifter & knife set. Catering-grade serving items for bar, harvest & buffet tables.', qty: 'Set', type: 'included' },
  { code: 'F34', imgKey: 'F36', cat: 'Glassware & Serveware', name: 'Wood Platters & Boards', desc: '16× variety of Oak Barrel Head platters with rope handles, Oval Long Platters & Rectangular wood platters. Great for harvest table, cheese boards, pizzas & breads.', qty: '16', type: 'included' },
  { code: 'F69', imgKey: 'F84', cat: 'Décor & Display', name: 'Rustic Cake Stands & Fly Chasers', desc: 'Wood tree-slice rustic cake stands on stands. Battery-operated swirling fly chasers for harvest table.', qty: 'Set', type: 'included' },
  { code: 'F99', imgKey: 'F99', cat: 'Kitchen & Braai', name: 'Cast-Iron Potjie Pots, Braai Grids & Utensils', desc: '1× full set: Variety of No.3 to No.14 XXL cast-iron rounded potjie pots (small to HUGE), flat-bottomed pots, braai grids, braai tongs, braai spades, wooden spoons, etc. For M&G catering, potjie competitions & large-group braais.', qty: 'Full set', type: 'included' },
  { code: 'F110', imgKey: 'F112', cat: 'Rustic Vessels', name: 'Galvanised Metal Rustic Buckets', desc: '20+ galvanised metal buckets with handles — Small, Medium & Large. Weathered metal patina. Great as rustic ice buckets for drinks, or for flowers & confetti. Not for ice used in drinks.', qty: '20+', type: 'included' },
  { code: 'F113', imgKey: 'F113', cat: 'Rustic Vessels', name: 'Half Oak Barrels — Round (with tub liners)', desc: '5× half oak barrels cut across width, round. Includes tub liners to prevent leaking. For cooling "help-yourself" drinks stacked high with ice, flowers & décor, or turned over as coffee tables.', qty: '5', type: 'included' },
  { code: 'F114', imgKey: 'F114', cat: 'Rustic Vessels', name: 'Half Oak Barrel — Oval (with rope handles)', desc: '2× half oak barrels cut lengthwise, oval-shaped with rope handles. Great for décor, flowers, confetti, umbrellas, breads, gifts, or transporting drinks.', qty: '2', type: 'included' },
  { code: 'F115', imgKey: 'F115', cat: 'Rustic Vessels', name: 'Wheel Barrows — Rustic & Patinaed', desc: '2× rustic patinaed wheelbarrows. For transporting drinks or as rustic wedding décor — great for presenting mineral waters on ice at the ceremony or help-yourself iced beers & ciders.', qty: '2', type: 'included' },
  { code: 'F116', imgKey: 'F118', cat: 'Tables & Seating', name: 'Dinner Tables — Pine Whitewashed', desc: '15× Pine whitewashed wedding tabletops (2.5m × 0.9m) on dark-stained trestle legs. For the reception dinner tables or elsewhere.', qty: '15', type: 'included' },
  { code: 'F119', imgKey: 'F119', cat: 'Tables & Seating', name: 'Kids Tables — Chalkboard Tabletops', desc: '2× fun chalkboard tabletops for kids to eat at and draw on. Usually set up on straw bales — chalk supplied in a jar.', qty: '2', type: 'included' },
  { code: 'F120', imgKey: 'F120', cat: 'Tables & Seating', name: 'Pine White-Washed Ceremony Benches', desc: '30× pine whitewashed ceremony benches with darker stained legs. For ceremony seating on level ground, seating at trestle tables, or around fire baskets & lounges.', qty: '30', type: 'included' },
  { code: 'F121', imgKey: 'F121', cat: 'Tables & Seating', name: 'Extra Tables — Slatted Pine (white)', desc: '4× slatted pine tabletops (2.4m × 0.75m, white). For buffet tables, bar tops, harvest tables, display & décor, cake table, satellite bar, etc.', qty: '4', type: 'included' },
  { code: 'F122', imgKey: 'F122', cat: 'Tables & Seating', name: 'Harvest Tabletops — Extra Large', desc: '2× very large harvest tabletops (3m × 1.2m) — one stained pine, one white. For harvest tables, buffet tables or bar tops. Usually set up on two oak barrels (bar height).', qty: '2', type: 'included' },
  { code: 'F123', imgKey: 'F125', cat: 'Tables & Seating', name: 'Extra Tables — Oregon Pine, Teak Square & Rectangular', desc: '10× variety: Oregon Pine Square Tables (90×90cm), Teak Square café tables (90×90cm), Teak Rectangular Tables (150×95cm). For DJ, cake, décor, gifts, drinks station, coffee & tea setup, memory table, etc.', qty: '10', type: 'included' },
  { code: 'F126', imgKey: 'F155', cat: 'Tables & Seating', name: 'Rustic Coffee Tables from Reclaimed Pallet Wood', desc: '5× rustic coffee tables (1m × 0.9m). For lounge pockets at pre-drinks, near fire baskets, or for lawn games.', qty: '5', type: 'included' },
  { code: 'F127', imgKey: 'F127', cat: 'Barrels & Crates', name: 'Oak Wine Barrels — Full Size', desc: '10× full-size oak barrels (90cm high). For building bars, placing harvest tabletops on, general décor, ad-hoc tables, flowers, ceremony aisle ends, lawn games, etc.', qty: '10', type: 'included' },
  { code: 'F128', imgKey: 'F129', cat: 'Barrels & Crates', name: 'Harvest Bin / Pallet Apple Crates', desc: '5× raw wood + 4× white-washed harvest bin crates. For building rustic satellite bars, harvest tables, or extending existing bars.', qty: '5+4', type: 'included' },
  { code: 'F130', imgKey: 'F130', cat: 'Soft Décor & Fabric', name: 'White Fabric Satin Draping — 7m', desc: '1× long white satin draping for the oak tree, wrapped around the wedding arch, or ceremony use, etc.', qty: '1', type: 'included' },
  { code: 'F131', imgKey: 'F131', cat: 'Soft Décor & Fabric', name: 'White Flagged Bunting — approx 100m', desc: '1× set of various triangular white flagged bunting pieces which can be joined. Creates a festive festival atmosphere, or cordons off areas.', qty: '~100m', type: 'included' },
  { code: 'F132', imgKey: 'F133', cat: 'Signage & Chalkboards', name: '"Cheers", "Mr & Mrs" Signs & Cutout Letters', desc: '1× "Cheers" sign on board, 1× "Mr & Mrs" sign on board, plus larger "Mr" & "Mrs" cutout loose letters (approx 25cm high).', qty: 'Set', type: 'included' },
  { code: 'F134', imgKey: 'F135', cat: 'Rustic Vessels', name: 'Vintage Galvanised Watering Can & Milk Can', desc: '1× large vintage galvanised watering can + 1× large galvanised milk can, both rustic patinaed metal. For general décor or flowers.', qty: '1 each', type: 'included' },
  { code: 'F136', imgKey: 'F136', cat: 'Signage & Chalkboards', name: 'Rustic Wood Step Ladder — Small', desc: '1× small rustic wood step ladder with vintage patina. Great for displaying blankets & throws, seating plans, welcome drinks stand, cocktail display, or general décor.', qty: '1', type: 'included' },
  { code: 'F137', imgKey: 'F137', cat: 'Signage & Chalkboards', name: 'White-Washed Framed Chalkboard', desc: '2× white-washed framed chalkboards (93×62cm board, 120×90cm with frame). For menus, seating plans, timeline, DJ lineup, cocktails, wedding poetry, etc.', qty: '2', type: 'included' },
  { code: 'F138', imgKey: 'F138', cat: 'Signage & Chalkboards', name: 'Rustic Pine Framed Chalkboard (Natural)', desc: '1× rustic natural pine framed chalkboard (111×61cm board). For menus, seating plans, timeline, schedule, poetry, DJ lineup, cocktails, etc.', qty: '1', type: 'included' },
  { code: 'F139', imgKey: 'F139', cat: 'Frames, Easels & Mirrors', name: 'Painted Framed Mirrors — Large on Easel', desc: '2× large painted framed mirrors, usually placed on easels wherever the Bride & Groom are getting ready. Also used as décor or signage.', qty: '2', type: 'included' },
  { code: 'F140', imgKey: 'F140', cat: 'Signage & Chalkboards', name: 'Ornate Gilded Framed Chalkboard', desc: '1× beautiful ornately gilded framed chalkboard on stand (80×143cm). For menus, seating plans, quotes, etc. — chalk supplied. Perfect at the entrance to reception or ceremony.', qty: '1', type: 'included' },
  { code: 'F141', imgKey: 'F141', cat: 'Frames, Easels & Mirrors', name: 'Large Stained Wood "Photo" Frame', desc: '1× large stained wood photo frame. Hung on poles at pre-drinks or reception — great for guests to pose behind, or to frame the mountain view.', qty: '1', type: 'included' },
  { code: 'F142', imgKey: 'F142', cat: 'Frames, Easels & Mirrors', name: 'Easels — Whitewashed Wood, Large Floorstanding', desc: '4× large whitewashed wood floorstanding easels. For chalkboards, mirrors, seating plans, DJ line-ups, menus, schedule of events, etc.', qty: '4', type: 'included' },
  { code: 'F143', imgKey: 'F145', cat: 'Signage & Chalkboards', name: 'Smaller A4 Chalkboards in Wood Frame', desc: '8× various A4-sized chalkboards in wood frames. For signage, menus, quirky one-liners, harvest table display, cocktail ingredients, etc.', qty: '8', type: 'included' },
  { code: 'F146', imgKey: 'F146', cat: 'Baskets & Rustic Décor', name: 'Sundry Wood Crates (Jonkeer, Coca Cola & Bashews)', desc: '6× various wood crates. For décor, stacked display, storage & transport, flower or gift crates, or to build levels on the harvest table.', qty: '6', type: 'included' },
  { code: 'F148', imgKey: 'F152', cat: 'Baskets & Rustic Décor', name: 'Woven Cane & Harvest Baskets', desc: '4× large & small woven baskets (round & square). For décor, flowers, confetti, cooldrinks, umbrellas, blankets, throws, breads, fruits, etc.', qty: '4', type: 'included' },
  { code: 'F153', imgKey: 'F153', cat: 'Baskets & Rustic Décor', name: 'Rustic Wooden Log Arch (180×200cm)', desc: '1× rustic wooden log arch. Used at the ceremony area draped with cloth, macramé or flowers. Also as general décor or prop.', qty: '1', type: 'included' },
  { code: 'F154', imgKey: 'F154', cat: 'Baskets & Rustic Décor', name: 'Wood Branch Blocks — Name / Card Holders', desc: '100× wood branch blocks with slot for names, menus, cocktail cards, etc. Bring your own cards to slide into the slot.', qty: '100', type: 'included' },
  { code: 'F156', imgKey: 'F156', cat: 'Signage & Chalkboards', name: 'Rustic Wooden Pallet Chalkboard', desc: '1× rustic wooden pallet chalkboard for signage, directional info, menus, DJ lineup, Happy Hour, etc.', qty: '1', type: 'included' },
  { code: 'F157', imgKey: 'F158', cat: 'Baskets & Rustic Décor', name: 'Hearts — Chalkboard & Woven Twig Hearts', desc: '2× white-washed heart-shaped chalkboard hearts, plain chalkboard hearts & woven hearts of twigs & branches. For signage or décor.', qty: '2', type: 'included' },
  { code: 'F159', imgKey: 'F159', cat: 'Baskets & Rustic Décor', name: 'Slender Metal Bird Cages — Black', desc: '3× slender black metal bird cages. Hanging décor from trees or on tables — can hold tealight candles in the evening.', qty: '3', type: 'included' },
  { code: 'F160', imgKey: 'F162', cat: 'Frames, Easels & Mirrors', name: 'Tabletop Easels — Blackwood, Pine & White Metal', desc: '5× variety of tabletop easels. For menus, cocktails, notices, seating plans, DJ info, or holding smaller framed chalkboards.', qty: '5', type: 'included' },
  { code: 'F161', imgKey: 'F161', cat: 'Signage & Chalkboards', name: 'Signage Stand Sets', desc: '2× signage stands — one rustic trellis poles with chalkboard signs, one with neat printed signs on a wood stand. Directional & fun, to show guests where to go.', qty: '2', type: 'included' },
];

let CATALOGUE_CATS = ['Glassware & Serveware','Kitchen & Braai','Rustic Vessels','Tables & Seating','Barrels & Crates','Soft Décor & Fabric','Signage & Chalkboards','Frames, Easels & Mirrors','Baskets & Rustic Décor','Décor & Display'];

// ── Accommodation Data ─────────────────────────────────────────────────────
let ACCOMMODATION = [
  // ── STANDARD COTTAGES (Family Lodge Units) ──────────────────────────────
  { id: 'oak', name: 'Oak Cottage', sleeps: 2, bedrooms: 1, type: 'Bridal Suite', description: 'Open-plan cottage with double bed, slipper bath, air con, walk-in shower, fireplace, stoep & braai. Situated right next to the Barn Venue and Wedding Meadow — the natural choice as a Bridal Suite.', amenities: ['Double bed','Slipper bath','Walk-in shower','Air con','Fireplace','Stoep & braai','Next to Barn Venue'] },
  { id: 'fig', name: 'Fig Cottage', sleeps: 3, bedrooms: 1, type: 'Standard', description: 'Open-plan cottage with double bed, shower, and a single bed in an alcove off the lounge. Fireplace & braai. Suits a couple and a single, or two singles sharing.', amenities: ['Double bed','Single bed alcove','Shower','Fireplace','Braai'] },
  { id: 'quince', name: 'Quince Cottage', sleeps: 4, bedrooms: 2, type: 'Standard', description: 'Separate bedroom with double bed, plus double bunk in a curtained alcove off the lounge for kids or young adults. Fireplace & braai. Part of the Family Lodge cluster.', amenities: ['Double bed (bedroom)','Double bunk (alcove)','Fireplace','Braai'] },
  { id: 'pine', name: 'Pine Cottage', sleeps: 4, bedrooms: 2, type: 'Standard', description: 'Separate bedroom with two single beds, plus a double bed in an alcove off the open-plan lounge near the fireplace. Braai on the stoep. Part of the Family Lodge cluster.', amenities: ['2× single beds (bedroom)','Double bed alcove','Fireplace','Braai on stoep'] },
  // ── EXCLUSIVE COTTAGES ───────────────────────────────────────────────────
  { id: 'nightjar', name: 'Nightjar', sleeps: 4, bedrooms: 2, type: 'Exclusive', description: 'Two-bedroom exclusive cottage with spa bath, walk-in shower, wood-fired hot tub, air con, hammocks, fireplace & braai. Queen bed + two ¾ beds. Situated near the Shop & Reception, fully self-catering.', amenities: ['Queen bed','2× ¾ beds','Spa bath','Walk-in shower','Wood-fired hot tub','Air con','Hammocks','Fireplace','Braai'] },
  { id: 'hadeda', name: 'Hadeda', sleeps: 4, bedrooms: 2, type: 'Exclusive', description: 'Two-bedroom exclusive cottage with spa bath, walk-in shower, wood-fired hot tub, air con, hammocks, fireplace & braai. Queen bed + double bed — perfect for two couples each with their own room.', amenities: ['Queen bed','Double bed','Spa bath','Walk-in shower','Wood-fired hot tub','Air con','Hammocks','Fireplace','Braai'] },
  // ── FARMHOUSE ERIKA & GARDEN FLAT ────────────────────────────────────────
  { id: 'erika', name: 'Farmhouse Erika & Garden Flat', sleeps: 28, bedrooms: 8, type: 'Farmhouse', description: 'The heart of the wedding — a large fully equipped farmhouse with 6 bedrooms (Rooms 1–6) plus a Garden Flat underneath the stoep with 2 bedrooms and a lounge that sleeps up to 5 more. 4 shared bathrooms. Bedding, linen & towels all included. Sleeps 23–28 guests total.', amenities: ['6 bedrooms + Garden Flat','4 shared bathrooms (1 en-suite option in Room 3)','Full kitchen','Multiple lounges','Front & back stoep','Baby cot in Room 3','Garden Flat with private bathroom','Electric blankets'] },
  // ── AFRICAMPS @ PAT BUSCH (10 Boutique Tents) ────────────────────────────
  { id: 'africamps1', name: 'Africamps — Tent 1', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Nearest to pool & venue. Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above. Sleeps 2 couples or a family of 5.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai','Closest to pool'] },
  { id: 'africamps2', name: 'Africamps — Tent 2', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai'] },
  { id: 'africamps3', name: 'Africamps — Tent 3', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above. Wi-Fi available.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai','Wi-Fi'] },
  { id: 'africamps4', name: 'Africamps — Tent 4', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai'] },
  { id: 'africamps5', name: 'Africamps — Tent 5', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above. Wi-Fi available.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai','Wi-Fi'] },
  { id: 'africamps6', name: 'Africamps — Tent 6', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai'] },
  { id: 'africamps7', name: 'Africamps — Tent 7', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above. Wi-Fi available.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai','Wi-Fi'] },
  { id: 'africamps8', name: 'Africamps — Tent 8', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai'] },
  { id: 'africamps9', name: 'Africamps — Tent 9', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai'] },
  { id: 'africamps10', name: 'Africamps — Tent 10', sleeps: 5, bedrooms: 2, type: 'Africamps', description: 'Furthest from pool — most private. Spacious safari tent, 2 bedrooms, bathroom with shower, air con, fireplace, kitchen, deck with braai. Double bed + double bed with single bunk above.', amenities: ['2 bedrooms','Shower','Air con','Fireplace','Kitchen','Deck & braai','Most private'] },
];

const RENTAL_ITEM_IMAGES = {
  'R1': 'assets/img/4fd8b606820a.jpg',
  'R2': 'assets/img/742b828adc39.jpg',
  'R3': 'assets/img/da49e44dfa76.jpg',
  'R4': 'assets/img/ce05af0aa5b2.jpg',
  'R5': 'assets/img/b5462c2fa77c.jpg',
  'R6': 'assets/img/40d5a1c38b36.jpg',
  'R7': 'assets/img/39f9761b62fd.jpg',
  'R8': 'assets/img/5613bf37a434.jpg',
  'R9': 'assets/img/2893bddb4554.jpg',
  'R11a': 'assets/img/29b891be6ce5.jpg',
  'R11b': 'assets/img/18a801dfe47f.jpg',
  'R10': 'assets/img/c187b54f17fe.jpg',
  'R12': 'assets/img/4a647d4a416a.jpg',
  'R14': 'assets/img/79bdb7c94513.jpg',
  'R17': 'assets/img/78ff05f35054.jpg',
  'R18': 'assets/img/bee8dd5dca0f.jpg',
  'R19': 'assets/img/49c73220e11d.jpg',
  'R20': 'assets/img/82755c2332c1.jpg',
  'R21': 'assets/img/686bc6688704.jpg',
  'R22': 'assets/img/4c299c951231.jpg',
  'R23': 'assets/img/c0dc3af445f5.jpg',
  'R24': 'assets/img/847634247162.jpg',
  'R25': 'assets/img/273a04c12b35.jpg',
  'R26': 'assets/img/9b35bf5f9ce7.jpg',
  'R31a': 'assets/img/e803808c7583.jpg',
  'R31b': 'assets/img/82daede19d1d.jpg',
  'R32': 'assets/img/c1f632b2a54b.jpg',
  'R33': 'assets/img/5267f46438ad.jpg',
  'R34': 'assets/img/9513b084ec21.jpg',
  'R35': 'assets/img/34aa1d7de8c2.jpg',
  'R36': 'assets/img/d1dcbf18baa0.jpg',
  'R37': 'assets/img/f7f68c4d2406.jpg',
  'R39': 'assets/img/4b3bb4a33264.jpg',
  'R40': 'assets/img/64fc599d6180.jpg',
  'R41': 'assets/img/bcec0f7f2c51.jpg',
  'R42': 'assets/img/5e008843cd66.jpg',
  'R43': 'assets/img/a2f58f38effd.jpg',
  'R44': 'assets/img/991bcfbbdf1d.jpg',
  'R45': 'assets/img/acda277091fd.jpg',
  'R46': 'assets/img/e2d1744eeaae.jpg',
  'R47': 'assets/img/f50824ef0822.jpg',
  'R49': 'assets/img/81169e6293d5.jpg',
  'R50': 'assets/img/2a77c6218dcc.jpg',
  'R51': 'assets/img/8694a830f2e4.jpg',
  'R76': 'assets/img/56c0af976dbd.jpg',
  'R52a': 'assets/img/4d68eecd095f.jpg',
  'R52b': 'assets/img/651ff018f176.jpg',
  'R53': 'assets/img/3896b79e0bc2.jpg',
  'R54a': 'assets/img/0bb3dd893964.jpg',
  'R54b': 'assets/img/802b76a57680.jpg',
  'R55': 'assets/img/7f2d84511ee5.jpg',
  'R56': 'assets/img/e61d710be767.jpg',
  'R57': 'assets/img/03bf63a73e1f.jpg',
  'R58': 'assets/img/a9f6955f49f9.jpg',
  'R59': 'assets/img/b50fb251972d.jpg',
  'R60': 'assets/img/79f63a151956.jpg',
  'R61': 'assets/img/85830a4b34b1.jpg',
  'R62': 'assets/img/3452ab2d5bd3.jpg',
  'R63': 'assets/img/7ff8ff3c1f49.jpg',
  'R64': 'assets/img/d7dbf1ab6744.jpg',
  'R65': 'assets/img/51c7f802dea9.jpg',
  'R66': 'assets/img/2e5ea9a47e33.jpg',
  'R67': 'assets/img/08429c6618d2.jpg',
  'R68': 'assets/img/91e87674dccc.jpg',
  'R69': 'assets/img/2b7cf61c8aac.jpg',
  'R71': 'assets/img/1796cf0cfb63.jpg',
  'R74': 'assets/img/a181c6eae87a.jpg',
  'R75': 'assets/img/d6e7dfee1348.jpg',
  'R77': 'assets/img/00c97b8fcfb1.jpg',
  'R78': 'assets/img/83a2ffdbd561.jpg'
};
let RENTAL_ITEMS = [
  // ☕ Catering & Beverages
  { code:'R1',  cat:'Catering & Beverages', maxQty:1,   name:'Basic DIY Coffee & Tea Station', desc:'Urn, mugs, instant coffee, Ceylon & Rooibos, hot chocolate, milk, sweeteners, sugar', rate:850,  rateType:'flat',       repl:2500 },
  { code:'R2',  cat:'Catering & Beverages', maxQty:1,   name:'Gourmet DIY Coffee & Tea', desc:'Percolator rental R400 + R600/brew (~50 cups) incl. Tea Station setup', rate:1000, rateType:'flat',       repl:8000 },
  { code:'R3',  cat:'Catering & Beverages', maxQty:1,   name:'Gourmet Bean-to-Cup Jura X8 Coffee', desc:'+ R25 per cup. Full Tea Station. Breakfast setup only.', rate:1000, rateType:'special',     repl:60000, specialNote:'+ R25/cup' },
  { code:'R69', cat:'Catering & Beverages', maxQty:1,   name:'Hot Water Urn (Large)', desc:'Incl. S/S & Plastic drip tray', rate:200,  rateType:'flat',       repl:2000 },
  { code:'R70', cat:'Catering & Beverages', maxQty:1,   name:'Coffee Percolator', desc:'Incl. internal flute & basket', rate:400,  rateType:'flat',       repl:8000 },
  { code:'R71', cat:'Catering & Beverages', maxQty:1,   name:'Cake Lifter & Knife Set — Ornate', desc:'Upmarket set for wedding cake', rate:50,   rateType:'flat',       repl:500 },
  // 🏕️ Outdoor & Décor
  { code:'R4',  cat:'Outdoor & Décor',      maxQty:13,  name:'Café Parasols (2.5×2.5m)', desc:'Incl. bases — each', rate:250,  rateType:'perUnit',    repl:2500 },
  { code:'R5',  cat:'Outdoor & Décor',      maxQty:5,   name:'Vintage Glass Dispensers with Taps', desc:'Various sizes 4–8l — each', rate:50,   rateType:'perUnit',    repl:400 },
  { code:'R6',  cat:'Outdoor & Décor',      maxQty:2,   name:'Glass Tear-Drop Dispensers with Taps', desc:'9l each', rate:100,  rateType:'perUnit',    repl:900 },
  { code:'R7',  cat:'Outdoor & Décor',      maxQty:24,  name:'White Oval Serving Platters', desc:'Each', rate:20,   rateType:'perUnit',    repl:250 },
  { code:'R8',  cat:'Outdoor & Décor',      maxQty:1,   name:'Wedding Gift & Card Box', desc:'White painted rustic wood, 45×45cm', rate:50,   rateType:'flat',       repl:500 },
  { code:'R9',  cat:'Outdoor & Décor',      maxQty:2,   name:'Leather Vintage Suitcase (L)', desc:'For honeymoon fund, cards, gifts — each', rate:200,  rateType:'perUnit',    repl:1000 },
  { code:'R10', cat:'Outdoor & Décor',      maxQty:1,   name:'Gold Steel Signage Frame / Stand', desc:'75cm (w) × 118cm (h)', rate:100,  rateType:'flat',       repl:500 },
  // 🍺 Bar Setup
  { code:'R11a',cat:'Bar Setup',            maxQty:1,   name:'White Bar Setup — INDOORS', desc:'Incl. bar, freezer, bins & crates', rate:700,  rateType:'flat',       repl:8000 },
  { code:'R11b',cat:'Bar Setup',            maxQty:1,   name:'White Bar Setup — OUTDOORS', desc:'Incl. bar, freezer, bins, sink, pallet wall, 4 apple crates, fairy light curtain, signage', rate:950,  rateType:'flat',       repl:8000 },
  // ✨ Lighting
  { code:'R12', cat:'Lighting',             maxQty:2,   name:'Fairy Light Curtains — Cool White', desc:'Like fresh starlight — each', rate:200,  rateType:'perUnit',    repl:2500 },
  { code:'R13', cat:'Lighting',             maxQty:2,   name:'Fairy Light Curtains — Warm White', desc:'Like candlelight — each', rate:200,  rateType:'perUnit',    repl:2500 },
  { code:'R14', cat:'Lighting',             maxQty:4,   name:'40m Fairy Lights WW — Black Wire', desc:'Incl. outdoor setup with poles — each', rate:350,  rateType:'perUnit',    repl:3000 },
  { code:'R15', cat:'Lighting',             maxQty:2,   name:'40m Fairy Lights WW — White Wire', desc:'Incl. indoor HALL AREA setup — each', rate:350,  rateType:'perUnit',    repl:3000 },
  { code:'R16', cat:'Lighting',             maxQty:1,   name:'40m Fairy Lights WW — Green Wire', desc:'Incl. outdoor setup with poles', rate:350,  rateType:'flat',       repl:3000 },
  { code:'R17', cat:'Lighting',             maxQty:1,   name:'2 × 25m Vintage Bistro / Festoon Lights', desc:'Delicate bistro string lights', rate:750,  rateType:'flat',       repl:12000 },
  { code:'R23', cat:'Lighting',             maxQty:20,  name:'Consol Solar Jar Lights', desc:'With Black Shepherd Crooks included — each', rate:30,   rateType:'perUnit',    repl:450 },
  { code:'R24', cat:'Lighting',             maxQty:20,  name:'Shepherd Crooks', desc:'14× low black, 6× tall white — each', rate:20,   rateType:'perUnit',    repl:250 },
  // 🪑 Chairs & Seating
  { code:'R18',  cat:'Chairs & Seating',   maxQty:130, name:'White Stella Chairs', desc:'Each', rate:10,   rateType:'perUnit',    repl:400 },
  { code:'R52a', cat:'Chairs & Seating',   maxQty:6,   name:'Teak Benches — DRESSED', desc:'Incl. cushions & throws — each', rate:250,  rateType:'perUnit',    repl:4000 },
  { code:'R52b', cat:'Chairs & Seating',   maxQty:6,   name:'Teak Benches — NAKED', desc:'Seats 3 — each', rate:200,  rateType:'perUnit',    repl:4000 },
  { code:'R53a', cat:'Chairs & Seating',   maxQty:4,   name:'Park Bench at Pool — NAKED (if moved)', desc:'2-seater — free if left in situ at pool', rate:150,  rateType:'perUnit',    repl:1500 },
  { code:'R53b', cat:'Chairs & Seating',   maxQty:4,   name:'Park Bench at Pool — DRESSED', desc:'2-seater incl. cushions & throws', rate:200,  rateType:'perUnit',    repl:1500 },
  { code:'R54a', cat:'Chairs & Seating',   maxQty:8,   name:'Malawian Reed Chair — NAKED', desc:'Single, no adornment — each', rate:100,  rateType:'perUnit',    repl:1500 },
  { code:'R54b', cat:'Chairs & Seating',   maxQty:8,   name:'Malawian Reed Chair — DRESSED', desc:'Incl. seat cushion & throw — each', rate:150,  rateType:'perUnit',    repl:1500 },
  { code:'R56',  cat:'Chairs & Seating',   maxQty:9,   name:'Cane Patio Chairs — Dressed', desc:'Singles with cushion seat — each', rate:150,  rateType:'perUnit',    repl:1500 },
  { code:'R57',  cat:'Chairs & Seating',   maxQty:1,   name:'Cane Patio Couch — Dressed', desc:'Double seater with cushion seat', rate:200,  rateType:'flat',       repl:2500 },
  // 🌾 Hay Bales & Rustic Seating
  { code:'R19', cat:'Hay Bales & Rustic',  maxQty:13,  name:'Picnic Benches (if moved)', desc:'Free in situ — R450 each if moved. 3 @ pool, 10 @ Erika', rate:450,  rateType:'perUnit',    repl:4000 },
  { code:'R39', cat:'Hay Bales & Rustic',  maxQty:40,  name:'Straw / Hay Bales', desc:'Incl. 3.6m whitewashed pine planks for seating — each', rate:25,   rateType:'perUnit',    repl:250 },
  { code:'R40', cat:'Hay Bales & Rustic',  maxQty:36,  name:'Straw Bale Covers', desc:'Each covers 2 bales — price is for ALL 36 covers', rate:200,  rateType:'flat',       repl:200 },
  // 🛋️ Comfort & Furnishings
  { code:'R20', cat:'Comfort & Furnishings', maxQty:2, name:'Timbavati Mats (XL)', desc:'For picnics, bedouin seating — each', rate:250,  rateType:'perUnit',    repl:2500 },
  { code:'R21', cat:'Comfort & Furnishings', maxQty:20,name:'Cushions — Earth Tones & Geometrics', desc:'Price for ALL 20 cushions', rate:400,  rateType:'flat',       repl:250 },
  { code:'R22', cat:'Comfort & Furnishings', maxQty:30,name:'Woven Throws / Picnic Blankets', desc:'Earth tones — price for ALL 30 throws', rate:400,  rateType:'flat',       repl:250 },
  { code:'R55', cat:'Comfort & Furnishings', maxQty:4, name:'Malawian Reed Side Table / Coffee Table', desc:'Each', rate:90,   rateType:'perUnit',    repl:750 },
  { code:'R58', cat:'Comfort & Furnishings', maxQty:20,name:'Linseed Oiled Tree Stumps', desc:'Various heights — each', rate:20,   rateType:'perUnit',    repl:0 },
  // 🔥 Fire & Heating
  { code:'R25', cat:'Fire & Heating',      maxQty:3,   name:'Fire Baskets — Full Setup', desc:'Incl. ~4 crates wood each', rate:450,  rateType:'perUnit',    repl:2500 },
  { code:'R26', cat:'Fire & Heating',      maxQty:2,   name:'Portable Half-Barrel Braais', desc:'Incl. braai equipment, cleaning, 2 bags wood, firelighters & charcoal', rate:350,  rateType:'perUnit',    repl:2000 },
  { code:'R27', cat:'Fire & Heating',      maxQty:99,  name:'Extra Firewood — Crate', desc:'For firepit & fire baskets', rate:60,   rateType:'consumable', repl:0 },
  { code:'R28', cat:'Fire & Heating',      maxQty:99,  name:'Extra Firelighters', desc:'Per pack', rate:35,   rateType:'consumable', repl:0 },
  { code:'R29', cat:'Fire & Heating',      maxQty:99,  name:'Extra Charcoal', desc:'For caterer / braais', rate:70,   rateType:'consumable', repl:0 },
  { code:'R30', cat:'Fire & Heating',      maxQty:99,  name:'Extra Firewood — Bag', desc:'For braaing or fireplaces', rate:45,   rateType:'consumable', repl:0 },
  { code:'R33', cat:'Fire & Heating',      maxQty:3,   name:'Patio Gas Heater', desc:'Incl. full gas cylinder & setup — each', rate:500,  rateType:'perUnit',    repl:3000 },
  // 🍳 Kitchen & Utilities
  { code:'R31a',cat:'Kitchen & Utilities', maxQty:1,   name:'Kitchen Fee — Under 90 Pax', desc:'Cleaning, gas, electricity, 1 scullery staff night shift (5–11pm)', rate:1000, rateType:'flat',       repl:0 },
  { code:'R31b',cat:'Kitchen & Utilities', maxQty:1,   name:'Kitchen Fee — Over 90 Pax', desc:'Cleaning, gas, electricity, 2 scullery staff night shift (5–11pm)', rate:1500, rateType:'flat',       repl:0 },
  { code:'R32', cat:'Kitchen & Utilities', maxQty:2,   name:'Generators AVR', desc:'7.5kVA & 8.5kVA incl. one tank of fuel each', rate:500,  rateType:'perUnit',    repl:14000 },
  { code:'R34', cat:'Kitchen & Utilities', maxQty:1,   name:'Portable 4-Burner Gas Stove for Caterer', desc:'Incl. setup & gas', rate:400,  rateType:'flat',       repl:2000 },
  // 🎤 Audio / Visual
  { code:'R35', cat:'Audio / Visual',      maxQty:1,   name:'HDTV Projector — Samsung Freestyle Gen 2', desc:'1080P, incl. free screen — or project onto wall / hanging material', rate:1000, rateType:'flat',       repl:15000 },
  { code:'R36', cat:'Audio / Visual',      maxQty:1,   name:'Portable PA System — JBL 320 Party Box', desc:'Bluetooth & rechargeable. Excl. microphones. Perfect for ceremony, M&G or after DJ', rate:1500, rateType:'flat',       repl:15000 },
  { code:'R37', cat:'Audio / Visual',      maxQty:2,   name:'JBL Wireless Microphones (set of 2)', desc:'For use with JBL Party Box — vows, speeches', rate:250,  rateType:'flat',       repl:2500 },
  { code:'R38', cat:'Audio / Visual',      maxQty:1,   name:'Projector Screen — Parrot Portable', desc:'', rate:250,  rateType:'flat',       repl:3000 },
  // 🎯 Games & Entertainment
  { code:'R41', cat:'Games & Entertainment', maxQty:2, name:'Bean Bag / Corn Hole Toss', desc:'1 board & 2 sets of 5 beanbags per board — each', rate:100,  rateType:'perUnit',    repl:750 },
  { code:'R42', cat:'Games & Entertainment', maxQty:1, name:'Beer Pong Table', desc:'Incl. setup (excl. beer)', rate:100,  rateType:'flat',       repl:500 },
  { code:'R43', cat:'Games & Entertainment', maxQty:2, name:'Swing Ball Sets with Bats', desc:'Each', rate:75,   rateType:'perUnit',    repl:350 },
  { code:'R44', cat:'Games & Entertainment', maxQty:1, name:'Giant Lawn Wooden O\'s & X\'s', desc:'', rate:50,   rateType:'flat',       repl:500 },
  { code:'R45', cat:'Games & Entertainment', maxQty:1, name:'Ring Toss', desc:'A-frame with pegs & 5 rope rings', rate:75,   rateType:'flat',       repl:500 },
  { code:'R46', cat:'Games & Entertainment', maxQty:2, name:'Boule / Pétanque / Bocce', desc:'Each', rate:100,  rateType:'perUnit',    repl:650 },
  { code:'R47', cat:'Games & Entertainment', maxQty:2, name:'Tabletop O\'s & X\'s (both sets)', desc:'Large wood on coffee table', rate:100,  rateType:'flat',       repl:500 },
  { code:'R48', cat:'Games & Entertainment', maxQty:2, name:'Tabletop Dominoes (both sets)', desc:'Large wood on coffee table', rate:100,  rateType:'flat',       repl:500 },
  { code:'R49', cat:'Games & Entertainment', maxQty:1, name:'Giant Jenga', desc:'In a box, setup on a crate table', rate:100,  rateType:'flat',       repl:1000 },
  { code:'R50', cat:'Games & Entertainment', maxQty:1, name:'Rugby Toss', desc:'Mini-rugby balls & wooden frame', rate:150,  rateType:'flat',       repl:1500 },
  { code:'R51', cat:'Games & Entertainment', maxQty:1, name:'Horse Shoe Toss & Metal Pegs', desc:'', rate:75,   rateType:'flat',       repl:250 },
  { code:'R76', cat:'Games & Entertainment', maxQty:2, name:'Croquet Sets (both)', desc:'Set for 4 players + set for 6 players', rate:175,  rateType:'flat',       repl:2500 },
  // 🏛️ Décor & Structures
  { code:'R59', cat:'Décor & Structures',  maxQty:1,   name:'Double Wooden Barn Doors in Frame', desc:'Setup on meadow', rate:650,  rateType:'flat',       repl:5000 },
  { code:'R60', cat:'Décor & Structures',  maxQty:2,   name:'Vintage Wooden Rustic Ladders (1.8m)', desc:'For décor, display, shelving — each', rate:150,  rateType:'perUnit',    repl:1000 },
  { code:'R61', cat:'Décor & Structures',  maxQty:1,   name:'Steel Curved Arch', desc:'Straight sides, round top — 255cm (h) × 154cm (w)', rate:250,  rateType:'flat',       repl:3500 },
  { code:'R62', cat:'Décor & Structures',  maxQty:1,   name:'Steel Round Wedding Arch', desc:'Fully round & circular — 2m (h) × 190cm across', rate:250,  rateType:'flat',       repl:4500 },
  // 🗺️ Extra Areas
  { code:'R63', cat:'Extra Areas',         maxQty:1,   name:'Extra Area — Pool, Oak Tree & Hall', desc:'Areas other than Erika for M&G / Farewell Breakfast, plus kitchen fees', rate:2000, rateType:'flat',       repl:0 },
  { code:'R64', cat:'Extra Areas',         maxQty:1,   name:'Extra Area — Dam & Meadow', desc:'Any other areas other than Erika for M&G / Farewell Breakfast, plus kitchen fees', rate:2500, rateType:'flat',       repl:0 },
  { code:'R65', cat:'Extra Areas',         maxQty:1,   name:'Extra Area — Dam Wall, Jetty & Reservoir', desc:'', rate:2500, rateType:'flat',       repl:0 },
  { code:'R66', cat:'Extra Areas',         maxQty:1,   name:'Extra Area — Poplar Forest', desc:'Incl. hay bale & plank seating', rate:2750, rateType:'flat',       repl:0 },
  { code:'R67', cat:'Extra Areas',         maxQty:1,   name:'Extra Area — Pine Forest', desc:'Excl. seating options', rate:2500, rateType:'flat',       repl:0 },
  { code:'R68', cat:'Extra Areas',         maxQty:1,   name:'Extra Area — Any Other Areas', desc:'Costs start at R2,500+', rate:2500, rateType:'flat',       repl:0 },
  // ➕ Extras & Add-ons
  { code:'R72', cat:'Extras & Add-ons',    maxQty:999, name:'Additional Wedding Guests over 120', desc:'Per extra guest', rate:100,  rateType:'consumable', repl:0 },
  { code:'R73', cat:'Extras & Add-ons',    maxQty:999, name:'Additional M&G / Farewell Breakfast over 100', desc:'Per person', rate:50,   rateType:'consumable', repl:0 },
  { code:'R74', cat:'Extras & Add-ons',    maxQty:999, name:'Additional Onsite Campers', desc:'Own tents or glamping — R100 per person, per night', rate:100,  rateType:'consumable', repl:0 },
  { code:'R75', cat:'Extras & Add-ons',    maxQty:1,   name:'Red Massey-Ferguson Tractor', desc:'Guest or bride & groom transport', rate:1000, rateType:'flat',       repl:75000 },
  { code:'R77', cat:'Extras & Add-ons',    maxQty:2,   name:'Gorilla Carts (×2)', desc:'For service providers or guests', rate:200,  rateType:'perUnit',    repl:3000 },
];

let RENTAL_CATS = ['Catering & Beverages','Outdoor & Décor','Bar Setup','Lighting','Chairs & Seating','Hay Bales & Rustic','Comfort & Furnishings','Fire & Heating','Kitchen & Utilities','Audio / Visual','Games & Entertainment','Décor & Structures','Extra Areas','Extras & Add-ons'];
const RENTAL_CAT_ICONS = {'Catering & Beverages':'☕','Outdoor & Décor':'🏕️','Bar Setup':'🍺','Lighting':'✨','Chairs & Seating':'🪑','Hay Bales & Rustic':'🌾','Comfort & Furnishings':'🛋️','Fire & Heating':'🔥','Kitchen & Utilities':'🍳','Audio / Visual':'🎤','Games & Entertainment':'🎯','Décor & Structures':'🏛️','Extra Areas':'🗺️','Extras & Add-ons':'➕'};

// ── Venue-injected inventory (Pass 2b) ────────────────────────────────────
// When the [wedding] route is rendered, the server inlines the live venue
// catalogue/rentals/accommodation as window globals BEFORE this file loads.
// Override the hardcoded defaults so the couple sees whatever the venue
// admin has currently configured.
if (typeof window !== 'undefined' && Array.isArray(window.VENUE_CATALOGUE_ITEMS) && window.VENUE_CATALOGUE_ITEMS.length) {
  CATALOGUE_ITEMS = window.VENUE_CATALOGUE_ITEMS;
  if (Array.isArray(window.VENUE_CATALOGUE_CATS) && window.VENUE_CATALOGUE_CATS.length) CATALOGUE_CATS = window.VENUE_CATALOGUE_CATS;
}
if (typeof window !== 'undefined' && Array.isArray(window.VENUE_RENTAL_ITEMS) && window.VENUE_RENTAL_ITEMS.length) {
  RENTAL_ITEMS = window.VENUE_RENTAL_ITEMS;
  if (Array.isArray(window.VENUE_RENTAL_CATS) && window.VENUE_RENTAL_CATS.length) RENTAL_CATS = window.VENUE_RENTAL_CATS;
}
if (typeof window !== 'undefined' && Array.isArray(window.VENUE_ACCOMMODATION) && window.VENUE_ACCOMMODATION.length) {
  ACCOMMODATION = window.VENUE_ACCOMMODATION;
}

// ── Venue-injected profile/identity (multi-tenant) ─────────────────────────
// Overlay the live wedding + venue identity onto VENUE so the couple sees
// THEIR names/date and THIS venue's contact details. Every assignment guards
// on the global existing, so the hardcoded Pat Busch fallback still works in
// local/dev where no globals are injected.
if (typeof window !== 'undefined') {
  if (window.WEDDING_VENUE && window.WEDDING_VENUE.name) VENUE.name = window.WEDDING_VENUE.name;
  if (typeof window.WEDDING_COUPLE === 'string' && window.WEDDING_COUPLE.trim()) {
    var _parts = window.WEDDING_COUPLE.split('&');
    var _n1 = (_parts[0] || '').trim();
    var _n2 = (_parts[1] || '').trim();
    if (_n1) VENUE.couple.name1 = _n1;
    if (_n2) VENUE.couple.name2 = _n2;
  }
  if (typeof window.WEDDING_DATE === 'string' && window.WEDDING_DATE) {
    VENUE.couple.date = window.WEDDING_DATE;
    try {
      VENUE.couple.displayDate = new Date(window.WEDDING_DATE + 'T00:00:00')
        .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {}
  }
  if (window.VENUE_CONTACT && window.VENUE_CONTACT.email) VENUE.email = window.VENUE_CONTACT.email;
  if (window.VENUE_CONTACT && window.VENUE_CONTACT.phone) VENUE.phone = window.VENUE_CONTACT.phone;
  if (window.VENUE_WEBSITE) VENUE.website = window.VENUE_WEBSITE;
  if (window.VENUE_MAP_URL) VENUE.mapUrl = window.VENUE_MAP_URL;
  // In server/multi-tenant mode the route does not inject a one-line address,
  // so clear the hardcoded Pat-Busch location/map so it never leaks into
  // another venue's portal. Fall back to the venue name, and only keep a map
  // link if one was actually injected.
  if (window.WEDDING_USE_SERVER) {
    VENUE.location = (window.WEDDING_VENUE && window.WEDDING_VENUE.name) ? window.WEDDING_VENUE.name : '';
    if (!window.VENUE_MAP_URL) VENUE.mapUrl = '';
    if (!window.VENUE_WEBSITE) VENUE.website = '';
  }
}

// ── Default Suppliers ─────────────────────────────────────────────────────
const DEFAULT_SUPPLIERS = [
  // ── YOUR BOOKED SUPPLIER ──────────────────────────────────────────────────
  { id: 1001, name: 'Duane Smith Photography', category: 'Photography', contact: '071 858 9653 · info@dsmith.co.za', price: 'R25,000', status: 'pending', preferred: true, notes: 'Collection Two — Full Day Coverage. 9 hrs · 2 photographers · Wedding Timeline Assistance · On-site venue walkthrough · 1-week preview · 800+ edited HD images · Complimentary engagement shoot.', deposit: 'R12,500', depositDue: '2026-05-02', depositPaid: false, finalPayment: 'R12,500', finalPaymentDue: '2026-12-24', finalPaymentPaid: false, bankDetails: 'FNB · Business Cheque 627 404 30004 · Branch 250655 · Ref: Heather', invoiceRef: 'Invoice #20260502' },
  // ── COORDINATORS & PLANNERS ───────────────────────────────────────────────
  { id: 2001, name: 'Niki Events', category: 'Coordinator', contact: 'Niki de Vries · 084 620 7703 · info@niki.events', price: '', status: 'pending', preferred: true, notes: 'Wedding Planning, Flowers & Décor. Based in Paarl.' },
  { id: 2002, name: 'Ebb & Flow Events', category: 'Coordinator', contact: 'Angela Millar · 082 310 6365 · info@ebbandflowevents.co.za', price: '', status: 'pending', preferred: true, notes: 'Flowers, Yoga & Event Management. LOCAL & ONSITE — based in Robertson.' },
  { id: 2003, name: 'Nu Experiences', category: 'Coordinator', contact: 'Margot · 083 259 1357 · events@nuexperiences.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent Coordinator & Planner. Cape Town.' },
  { id: 2004, name: 'The Planner', category: 'Coordinator', contact: 'Helmare vd Merwe · 079 898 9746 · info@metheplanner.co.za', price: '', status: 'pending', preferred: true, notes: 'Super Coordinator & Planner. LOCAL — Villiersdorp.' },
  { id: 2005, name: 'The Event Planners', category: 'Coordinator', contact: 'Niki Denner · 079 183 5006 · niki@theeventplanners.co.za', price: '', status: 'pending', preferred: true, notes: 'Coordinator & Planner. Cape Town.' },
  { id: 2006, name: 'Heartistry', category: 'Coordinator', contact: 'Nancy Hoepner · 078 893 4040 · nancy@heartistry-cpt.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent Coordinator & Planner. Cape Town.' },
  { id: 2007, name: 'Flamboijant Events', category: 'Coordinator', contact: 'Lizl Pieterse · 084 620 7703 · info@flamboijant.co.za', price: '', status: 'pending', preferred: false, notes: 'Coordinator & Planner, Décor, Furniture, Flowers & more. LOCAL — Bonnievale.' },
  { id: 2008, name: 'Antoinette Events', category: 'Coordinator', contact: 'Nikkie · 084 839 7137 · events@antoinetteevents.co.za', price: '', status: 'pending', preferred: false, notes: 'Coordinator & Planner, Décor, Furniture, Catering, Flowers & Utensils. Cape Town.' },
  { id: 2009, name: 'Celeste Styled Events', category: 'Coordinator', contact: 'Celeste Potgieter · 082 393 1239 · celeste@celestestyledevents.co.za', price: '', status: 'pending', preferred: false, notes: 'Coordinator & Planner. Cape Town.' },
  { id: 2010, name: 'The Wedding Fairy', category: 'Coordinator', contact: 'Rebecca Butler · 084 268 9881 · rebecca@theweddingfairy.co.za', price: '', status: 'pending', preferred: false, notes: 'Coordinator & Planner. Cape Town.' },
  { id: 2011, name: 'Lavender Creations', category: 'Coordinator', contact: 'Shannon Lavender · 082 924 7548 · shannon@lavendercreations.org', price: '', status: 'pending', preferred: false, notes: 'Planner & Coordinator. Cape Town.' },
  { id: 2012, name: 'The Bloom Room', category: 'Coordinator', contact: 'Cindy Du Toit · 072 240 6044 · cindy@thebloomroom.co.za', price: '', status: 'pending', preferred: false, notes: 'Coordinator, Planner, Flowers — also has musician & DJ contacts. George.' },
  { id: 2013, name: 'Boutique Events', category: 'Coordinator', contact: 'Ursula Forrest · 071 333 1111 · ursula@boutiqueevents.co.za', price: '', status: 'pending', preferred: false, notes: 'Luxury Weddings & Celebrations. Cape Town.' },
  // ── CATERING & PRIVATE CHEFS ──────────────────────────────────────────────
  { id: 3001, name: 'The Field Kitchen', category: 'Catering', contact: 'Chef Darryl Burger · 076 711 2669 · darryl@thefieldkitchen.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent Private Chef — highly rated. Cape Town.' },
  { id: 3002, name: 'The Flying Pan', category: 'Catering', contact: 'Chef Mathew Hoepner · 081 385 5589 / 078 055 6393 · info@theflyingpan.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent Catering & Chef. Cape Town.' },
  { id: 3003, name: 'Plum Kitchen', category: 'Catering', contact: 'Di Doms · 082 560 3166 · di@plumkitchen.co.za', price: '', status: 'pending', preferred: true, notes: 'Superb & Top Class Local Caterer. LOCAL — Robertson. Note: generally closed mid-December to early January.' },
  { id: 3004, name: 'Leeftijd Catering', category: 'Catering', contact: 'Belia King · 072 169 6794 · info@leeftijd.co.za', price: '', status: 'pending', preferred: true, notes: 'Event, Wedding & Party Catering. LOCAL — from Montagu.' },
  { id: 3005, name: 'Antoinette Events (Catering)', category: 'Catering', contact: 'Nikkie · 084 839 7137 · events@antoinetteevents.co.za', price: '', status: 'pending', preferred: true, notes: 'Very Good Catering — also coordinates, plans & supplies décor & flowers. Cape Town.' },
  { id: 3006, name: 'YOYO Spitbraai', category: 'Catering', contact: 'Jacques · 072 186 1381 · info@yoyospitbraais.co.za', price: '', status: 'pending', preferred: false, notes: 'Spitbraais, catering & more. Cape Town.' },
  { id: 3007, name: 'Lotus Food Truck & More', category: 'Catering', contact: '072 128 6752 · info@lotusfoodtruck.co.za', price: '', status: 'pending', preferred: false, notes: 'Eastern inspired cuisine. Prefers to cook in venue kitchen due to distance. Cape Town.' },
  { id: 3008, name: 'Spit Braai Functions', category: 'Catering', contact: 'Riaan & Jackie · 066 286 9938 / 076 123 0099 · info@spitbraaifunctions.co.za', price: '', status: 'pending', preferred: false, notes: 'Braai, Spitbraai & Potjiekos catering & events. Cape & Garden Route.' },
  { id: 3009, name: 'Wynand Malan — SpitBraai', category: 'Catering', contact: 'Wynand · 082 378 8778', price: '', status: 'pending', preferred: false, notes: 'Local Spitbraai Caterer, down to earth & affordable. LOCAL — Robertson. Great for Meet & Greet gathering.' },
  // ── FOOD TRUCKS ───────────────────────────────────────────────────────────
  { id: 3101, name: 'Jack Rabbit', category: 'Food Trucks', contact: 'Marc & Vasti Vonk · 083 414 1181 / 079 885 4534 · vasti.jackrabbit@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Brilliant Gourmet Burger Food Truck. Cape Town.' },
  { id: 3102, name: 'Earth Fire Pizza', category: 'Food Trucks', contact: 'Melissa · 021 785 3560 · info@earthfirepizza.co.za', price: '', status: 'pending', preferred: true, notes: 'Fantastic Pizza Truck. Cape Town.' },
  { id: 3103, name: 'Boulevard 82 Food Truck', category: 'Food Trucks', contact: 'Stan or Ryan · 074 252 0990 / 079 613 5041 · blvd82foods@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Great Food Truck & Street Food. Cape Town.' },
  // ── COFFEE & ICE CREAM ────────────────────────────────────────────────────
  { id: 3201, name: 'The Blend Coffee & More', category: 'Coffee & Drinks', contact: 'Benitha Gouws · 082 802 4843 · benithagouws@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Gourmet Coffee. LOCAL — McGregor.' },
  { id: 3202, name: "L'Chaim Coffee — Robertson", category: 'Coffee & Drinks', contact: '073 491 1687 · lchaimcoffee@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Mobile Coffee Suppliers. LOCAL — Robertson.' },
  { id: 3203, name: 'Plato Coffee VW Kombi', category: 'Coffee & Drinks', contact: 'Roelof · 081 465 9947 · hello@plato.coffee', price: '', status: 'pending', preferred: true, notes: 'Mobile Coffee from a vintage VW Kombi. Western Cape.' },
  { id: 3204, name: 'Hustle Ice Cream', category: 'Coffee & Drinks', contact: 'Hadley Kent · 060 500 5797 · hustlecapetown@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Premium Soft Serve Gelato. Cape Town.' },
  { id: 3205, name: 'Road Rage Coffee', category: 'Coffee & Drinks', contact: 'Henry Britz · 076 203 8025 · roadragecoffee21@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Gourmet Coffee. Cape Town.' },
  // ── CAKES & DESSERTS ──────────────────────────────────────────────────────
  { id: 3301, name: 'Marinel Cakes', category: 'Cakes & Desserts', contact: 'Marinel Nel · 083 372 1673', price: '', status: 'pending', preferred: true, notes: 'Local Cakes & Desserts. LOCAL — Robertson.' },
  { id: 3302, name: 'Beswik Cakes', category: 'Cakes & Desserts', contact: 'Bronwen Beswik · 071 869 7172 · bronbesbb@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Local Cakes & Desserts. LOCAL — Bonnievale.' },
  { id: 3303, name: "Louretta's Cake Boutique", category: 'Cakes & Desserts', contact: '023 626 5133', price: '', status: 'pending', preferred: true, notes: 'Local Cakes, Bakes & Desserts. LOCAL — Robertson.' },
  { id: 3304, name: 'Joyce DeWet — Special Event Cakes', category: 'Cakes & Desserts', contact: 'Joyce De Wet · 079 524 0972 · joycedewet1@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Local Cakes & Desserts. LOCAL — Robertson.' },
  // ── TENTS, MARQUEES & STRUCTURES ─────────────────────────────────────────
  { id: 4001, name: 'The Tentmen', category: 'Tents & Structures', contact: 'Ilse & Con Viljoen · 076 337 5407 / 082 775 8737 · thetentmen@gmail.com', price: '', status: 'pending', preferred: true, notes: 'BEST CHOICE for stretch tents, dance floor, great lights & more. LOCAL — Bonnievale.' },
  { id: 4002, name: '4 Every Event', category: 'Tents & Structures', contact: 'Nadia Strauss · 082 875 582 · nadia@4everyevent.co.za', price: '', status: 'pending', preferred: true, notes: 'Great Stretch tents, Furniture & Décor. Elgin.' },
  { id: 4003, name: 'Best Events Tents & Décor', category: 'Tents & Structures', contact: 'Sherylene · 023 004 0475 / 023 347 4923 · info@bestevents.co.za', price: '', status: 'pending', preferred: false, notes: 'Stretch tents, Furniture, Décor & Utensils. Worcester.' },
  { id: 4004, name: 'Chattels', category: 'Tents & Structures', contact: 'Anneke van Rhyn · 021 593 7705 · anneke@chattels.co.za', price: '', status: 'pending', preferred: false, notes: 'Marquee, Clearspan & Structures. Cape Town.' },
  { id: 4005, name: 'Downing Marquee Hire', category: 'Tents & Structures', contact: '081 365 6777', price: '', status: 'pending', preferred: false, notes: 'Marquee, Clearspan & Structures. Cape Town.' },
  { id: 4006, name: 'Elite', category: 'Tents & Structures', contact: 'Byron · 083 449 4612 · byron@marquees.co.za', price: '', status: 'pending', preferred: false, notes: 'Marquee, Clearspan & Structures. Cape Town.' },
  // ── DÉCOR & FURNITURE ─────────────────────────────────────────────────────
  { id: 4101, name: 'Flamboijant Events (Décor)', category: 'Décor & Furniture', contact: 'Lizl Pieterse · 084 620 7703 · info@flamboijant.co.za', price: '', status: 'pending', preferred: true, notes: 'Superb Décor, Flowers, Utensils, Glassware & more. LOCAL — Bonnievale.' },
  { id: 4102, name: 'Baie Goeters', category: 'Décor & Furniture', contact: 'Nicola Kaden · 067 784 3019 · enquiries@baiegoeters.co.za', price: '', status: 'pending', preferred: true, notes: 'Décor, Furniture, Utensils & More. Wellington.' },
  { id: 4103, name: '4 Every Event (Décor)', category: 'Décor & Furniture', contact: 'Nadia Strauss · 082 875 582 · nadia@4everyevent.co.za', price: '', status: 'pending', preferred: true, notes: 'Tents, Décor, Furniture & More. Elgin.' },
  { id: 4104, name: 'Ten of Cups', category: 'Décor & Furniture', contact: 'Eddie van Lamp · 079 696 5167 · admin@tenofcups.co.za', price: '', status: 'pending', preferred: false, notes: 'Décor, Furniture & Equipment. Stellenbosch.' },
  { id: 4105, name: 'Sitting Pretty Bespoke Event Design', category: 'Décor & Furniture', contact: '083 235 6282 / 082 687 9163 · hello@sitting-pretty.co.za', price: '', status: 'pending', preferred: false, notes: 'Décor, Furniture, Flowers & Equipment. Stellenbosch.' },
  { id: 4106, name: 'Best Events (Décor)', category: 'Décor & Furniture', contact: 'Sherylene · 023 004 0475 / 023 347 4923 · info@bestevents.co.za', price: '', status: 'pending', preferred: false, notes: 'Décor, Tents, Furniture & Utensils. Worcester.' },
  // ── GLAMPING & EXTRA ACCOMMODATION ───────────────────────────────────────
  { id: 4201, name: 'Expedition Glamping', category: 'Glamping', contact: 'Camille or Rian · 079 928 3951 / 083 273 9905 · info@expeditionglamping.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent Bespoke Onsite Glamping in furnished Canvas Bell Tents. Note: R100 per camper per night venue fee applies.' },
  { id: 4202, name: 'You2Camp', category: 'Glamping', contact: 'Ryno Wade · 076 085 3696 · admin@you2camp.com', price: '', status: 'pending', preferred: true, notes: 'Various camping options with showers, bathrooms & catering. Note: R100 per camper per night venue fee applies.' },
  { id: 4203, name: 'Zulu Overland', category: 'Glamping', contact: 'Du Toit van Niekerk · 073 198 9992 · dutoit@zuluoverland.co.za', price: '', status: 'pending', preferred: false, notes: 'Onsite camping options. Cape Town.' },
  // ── FLORISTRY ─────────────────────────────────────────────────────────────
  { id: 4301, name: 'Flamboijant Events (Flowers)', category: 'Floristry', contact: 'Niki de Vries / Lizl Pieterse · 084 620 7703 · niki@flamboijant.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent Flowers, Décor, Planning, Utensils, Glassware & More. LOCAL — Bonnievale.' },
  { id: 4302, name: 'Ebb & Flow Events (Flowers)', category: 'Floristry', contact: 'Angela Millar · 082 310 6365 · info@ebbandflowevents.co.za', price: '', status: 'pending', preferred: true, notes: 'Flowers, Yoga & Event Management. LOCAL & ONSITE — Robertson.' },
  { id: 4303, name: 'Blommeprag', category: 'Floristry', contact: 'Anne-Marie · 082 378 3993 · lerouxs@barvallei.co.za', price: '', status: 'pending', preferred: true, notes: 'Local Flowers. LOCAL — Bonnievale.' },
  { id: 4304, name: 'Flowers By Arlene', category: 'Floristry', contact: 'Arlene Lloyd · 082 929 7054 · arlene@flowersbyarlene.co.za', price: '', status: 'pending', preferred: false, notes: 'Flowers. Cape Town.' },
  // ── ALCOHOL & DRINKS ──────────────────────────────────────────────────────
  { id: 5001, name: 'Nomad Event Solutions', category: 'Alcohol & Bar', contact: 'Gandre · 061 476 9143 · gandre@nomadevent.solutions', price: '', status: 'pending', preferred: true, notes: 'BEST OPTION for a Cash Bar! Includes on consignment stock, staff, liquor licence, tills, POS, credit card & more. Cape Town.' },
  { id: 5002, name: 'Grapevine — Blue Bottle Store', category: 'Alcohol & Bar', contact: 'Jurgens Heyns · 082 378 3564 · jurgens@grapevineliquors.co.za', price: '', status: 'pending', preferred: true, notes: 'Great DIY option: bottle store including delivery & stock on consignment. LOCAL — Robertson.' },
  { id: 5003, name: 'Saggy Stone Craft Beer, Gin & More', category: 'Alcohol & Bar', contact: 'Jackie · 021 834 6300 · jackie@saggystone.co.za', price: '', status: 'pending', preferred: true, notes: 'Great Craft Beer, Craft Gin & more. LOCAL — Worcester.' },
  { id: 5004, name: 'Pat Busch Reserve (ICE, WATER & MIXERS)', category: 'Alcohol & Bar', contact: 'Lesley · 023 626 2033 · stay@patbusch.co.za', price: '', status: 'pending', preferred: true, notes: 'ICE, Waters, Cooldrinks & Mixers delivered. LOCAL — Robertson.' },
  { id: 5005, name: 'Spar — Tops at Spar', category: 'Alcohol & Bar', contact: 'Louise Blom · 023 626 1552 · robertson2@retail.spar.co.za', price: '', status: 'pending', preferred: false, notes: 'Bottle Store on consignment. LOCAL — Robertson.' },
  { id: 5006, name: 'Vuilhond', category: 'Alcohol & Bar', contact: 'Andre · 079 257 0570 · andre@vuilhond.co.za', price: '', status: 'pending', preferred: false, notes: 'Brandy on Tap.' },
  // ── WAITRONS & STAFFING ───────────────────────────────────────────────────
  { id: 5101, name: 'Nomad Event Solutions (Bar Staff)', category: 'Waitrons & Staff', contact: 'Gandre · 061 476 9143 · gandre@nomadevent.solutions', price: '', status: 'pending', preferred: true, notes: 'Cash Bar — BEST OPTION! Incl. on consignment stock, staff, licence, tills, POS & more. Cape Town.' },
  { id: 5102, name: 'The Barmen Crew & More', category: 'Waitrons & Staff', contact: 'Malcolm Donaldson · 082 474 1295 · malcolm36donaldson@gmail.com', price: 'R11,050', status: 'pending', preferred: true, notes: 'RECOMMENDED: Waitrons & Bar staff. LOCAL — Robertson.' },
  { id: 5103, name: 'Hero Events', category: 'Waitrons & Staff', contact: 'Ludwig · 072 987 3542 · heroevents@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Upmarket Waitrons & Bar Staff. Cape Town.' },
  { id: 5104, name: 'Saucy Events & Staffing', category: 'Waitrons & Staff', contact: 'Rosemary · 068 321 3715 / 078 821 0858 · sauceyevents@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Superb Waitrons & Bar Staff. Cape Town.' },
  { id: 5105, name: 'West Staff Services', category: 'Waitrons & Staff', contact: 'Robert Van Noie · 084 885 7760 · info@weststaffservices.co.za', price: '', status: 'pending', preferred: false, notes: 'Waitrons & Bar Staff. Cape Town.' },
  { id: 5106, name: 'JT Events', category: 'Waitrons & Staff', contact: 'Johan Potgieter · 076 509 7338 · jtevents@lantic.net', price: '', status: 'pending', preferred: false, notes: 'Waitrons & Bar Staff. Cape Region.' },
  { id: 5107, name: 'Fernhout Staffing Services', category: 'Waitrons & Staff', contact: 'Charlize Loois · 082 826 4140', price: '', status: 'pending', preferred: false, notes: 'Staffing (Bar & Waitrons). LOCAL — Robertson.' },
  // ── BATHROOMS & TOILETS ───────────────────────────────────────────────────
  { id: 5201, name: 'Lookor', category: 'Bathrooms', contact: '072 672 446 · boland@lookor.com', price: '', status: 'pending', preferred: true, notes: 'Portable Lux Loos & Generators. LOCAL — Robertson.' },
  { id: 5202, name: 'Sales Hire', category: 'Bathrooms', contact: '021 931 2560 · toilets@saleshire.co.za', price: '', status: 'pending', preferred: true, notes: 'Portable Lux Loos & Shower Stalls. Cape Town.' },
  { id: 5203, name: 'Boland Toilets', category: 'Bathrooms', contact: '086 111 5193 · info@jmgrp.co.za', price: '', status: 'pending', preferred: false, notes: 'Portable Lux Loos. Ceres.' },
  // ── GENERATORS & HIRE ─────────────────────────────────────────────────────
  { id: 5301, name: 'Robertson Tool Hire', category: 'Generators', contact: '023 626 1618', price: '', status: 'pending', preferred: false, notes: 'Generators & more. LOCAL — Robertson.' },
  { id: 5302, name: 'AH Marais', category: 'Generators', contact: '023 626 3071 · info@ahm.co.za', price: '', status: 'pending', preferred: false, notes: 'Generators & more. LOCAL — Robertson.' },
  { id: 5303, name: 'BreedeRivier Tool Hire', category: 'Generators', contact: '023 626 1345 / 023 100 0943', price: '', status: 'pending', preferred: false, notes: 'Generators & more. LOCAL — Robertson.' },
  // ── HAIR & MAKEUP ─────────────────────────────────────────────────────────
  { id: 6001, name: 'Marnel Toerien Make-Up Artist', category: 'Hair & Makeup', contact: 'Marnel Toerien · 072 337 3226 · info@marneltoerien.co.za', price: '', status: 'pending', preferred: true, notes: 'Make-Up Artist. Cape Town.' },
  { id: 6002, name: 'Candice Harker — Mobile Make-Up', category: 'Hair & Makeup', contact: 'Candice Harker · 078 476 1409 · candice@mobilemakeupartist.co.za', price: '', status: 'pending', preferred: true, notes: 'Make-Up Artist. Boland.' },
  { id: 6003, name: 'Make You Up', category: 'Hair & Makeup', contact: 'Jodine Swanepoel · 072 299 6704 · jodine@barvallei.co.za', price: '', status: 'pending', preferred: true, notes: 'Make-Up. LOCAL — Robertson.' },
  { id: 6004, name: 'Madeleine Hair & Make-up', category: 'Hair & Makeup', contact: 'Madeleine · 084 812 5087 · info@madeleinehairandmakeup.co.za', price: '', status: 'pending', preferred: true, notes: 'Hair & Make-Up Artist. Cape Town.' },
  { id: 6005, name: 'Blusch Professional MakeUp', category: 'Hair & Makeup', contact: 'Mariette · 083 608 1141', price: '', status: 'pending', preferred: false, notes: 'Make-Up. LOCAL — Robertson.' },
  { id: 6006, name: 'Illusions Hair Design', category: 'Hair & Makeup', contact: 'Cornel Hough · 071 241 4526 · cornelhough@live.co.za', price: '', status: 'pending', preferred: false, notes: 'Hair Stylist. LOCAL — Robertson.' },
  { id: 6007, name: 'Isabeau Skincare Clinic', category: 'Hair & Makeup', contact: '072 406 4375 · info@isabeauskincareclinic.co.za', price: '', status: 'pending', preferred: false, notes: 'Local Skincare. LOCAL — Robertson.' },
  { id: 6008, name: 'Glamourize Hair', category: 'Hair & Makeup', contact: 'Melissa Marais · 064 656 0222', price: '', status: 'pending', preferred: false, notes: 'Hair Stylist. LOCAL — Robertson.' },
  { id: 6009, name: 'Maryna Kirsten Hair & MakeUp', category: 'Hair & Makeup', contact: 'Maryna Kirsten · 076 402 4218 · kirstenmaryna@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Hair & Make-Up Artist. De Doorns.' },
  { id: 6010, name: 'Elizabeth Rae Hair & Make-Up', category: 'Hair & Makeup', contact: 'Elizabeth Rae · 082 452 9469 · elizabethraemua@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Hair & Make-Up Artist. Rawsonville.' },
  { id: 6011, name: 'Suzette Erasmus Make-Up', category: 'Hair & Makeup', contact: 'Suzette Erasmus · 072 794 0164', price: '', status: 'pending', preferred: false, notes: 'Make-Up. LOCAL.' },
  { id: 6012, name: 'Candice Make-Up', category: 'Hair & Makeup', contact: 'Candice · 072 573 0771', price: '', status: 'pending', preferred: false, notes: 'Make-Up. LOCAL — Robertson.' },
  // ── PHOTOGRAPHY & VIDEOGRAPHY ─────────────────────────────────────────────
  { id: 7001, name: 'Ty and Eri Photo & Film', category: 'Photography', contact: 'Tyron Mackensie · 074 870 6697 · info@tyanderi.com', price: '', status: 'pending', preferred: true, notes: 'Photography & Videos.' },
  { id: 7002, name: 'Andy & Szerdi Photography', category: 'Photography', contact: 'Szerdi · 076 335 5708 · hello@andyandszerdi.com', price: '', status: 'pending', preferred: true, notes: 'Brilliant Photography. UK-based.' },
  { id: 7003, name: 'Lauren Pretorius Photography', category: 'Photography', contact: 'Lauren Pretorius · 071 337 8840 · info@laurenpretoriusphotography.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent Photography.' },
  { id: 7004, name: 'Yeah Yeah Photography', category: 'Photography', contact: 'Helena Krige · 083 260 0435 · helena@yeahyeah.co.za', price: '', status: 'pending', preferred: true, notes: 'Photography.' },
  { id: 7005, name: 'Lara Jess Photographer', category: 'Photography', contact: 'Lara Thomas · 072 222 5170', price: '', status: 'pending', preferred: true, notes: 'Photography & Marriage Officiant. Cape Town.' },
  { id: 7006, name: 'Dillon Kin Photography', category: 'Photography', contact: 'Dillon Kin · 084 730 8628 · hello@dillonkin.com', price: '', status: 'pending', preferred: true, notes: 'Photography. Cape Town.' },
  { id: 7007, name: 'Micke Creative', category: 'Photography', contact: 'Micke · 073 609 5607 · hello@mickcreative.co.za', price: '', status: 'pending', preferred: true, notes: 'Photographer. Durbanville.' },
  { id: 7008, name: 'Vinyl Rae Photography', category: 'Photography', contact: 'Kelly Rae Du Plooy · 071 526 3422 · vinylraephoto@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Photography.' },
  { id: 7009, name: 'Sarah Isaacs Photography', category: 'Photography', contact: 'Sarah & Oliver · 073 537 8290 · sarah@sarahisaacs.com', price: '', status: 'pending', preferred: false, notes: 'Excellent Photography. Cape Town.' },
  { id: 7010, name: 'Koringkriek Photography & Videos', category: 'Photography', contact: 'Stefan Lous · 074 190 3796 / 083 424 1297 · stefan@koringkriek.com', price: '', status: 'pending', preferred: false, notes: 'Photography & Videos.' },
  { id: 7011, name: 'Helene Viljoen Photography', category: 'Photography', contact: 'Helene Viljoen · 082 326 2679 · heleneviljoen@barvallei.co.za', price: '', status: 'pending', preferred: false, notes: 'Photography. LOCAL — Robertson.' },
  { id: 7012, name: 'Kikito Photography', category: 'Photography', contact: 'Skillie / Corrie · 084 840 0141 · motion@kikitography.com', price: '', status: 'pending', preferred: false, notes: 'Superb Photographer. Cape Town.' },
  { id: 7013, name: 'Light Lounge Studios', category: 'Photography', contact: 'Nelis Engelbrecht · 084 205 6676 · info@nelisengelbrecht.co.za', price: '', status: 'pending', preferred: false, notes: 'Photography & Videos.' },
  { id: 7014, name: 'Michiel and Annie Wedding Films', category: 'Photography', contact: 'Annie · 079 680 2014', price: '', status: 'pending', preferred: false, notes: 'Videography.' },
  { id: 7015, name: 'Orpen Film Co', category: 'Photography', contact: 'Terrence Orpen · 083 555 4328 · hi@orpenfilms.co.za', price: '', status: 'pending', preferred: false, notes: 'Videography.' },
  { id: 7016, name: 'Mint Tea Photography', category: 'Photography', contact: 'Sarah Da Silva · 083 323 4038 · sarahdasilva00@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Photography.' },
  { id: 7017, name: 'Misha Lee Photography', category: 'Photography', contact: 'Misha Lee Tame · 082 819 9079 · hello@mishalee.co.za', price: '', status: 'pending', preferred: false, notes: 'Photography.' },
  { id: 7018, name: 'Mustard Seed Films & Photography', category: 'Photography', contact: 'Craig · 073 923 1112 · info@mustardseedfilms.co.za', price: '', status: 'pending', preferred: false, notes: 'Photography & Videos.' },
  { id: 7019, name: 'Nadine Aucamp Photography', category: 'Photography', contact: 'Nadine Aucamp · 083 441 7630 · ndnaucamp@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Photography.' },
  { id: 7020, name: 'Striped Fox Photography', category: 'Photography', contact: 'Lee · 078 948 3282 · info@stripedfoxphotography.com', price: '', status: 'pending', preferred: false, notes: 'Photography. Paarl.' },
  { id: 7021, name: 'Teagan Smith Photography', category: 'Photography', contact: 'Teagan Smith · 072 523 2838 · 4teagansmithphotography@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Photography. Cape Town.' },
  { id: 7022, name: 'Zeven Media (Light + Lark)', category: 'Photography', contact: 'Lindie van der Burgh · 060 786 2621 · chrisvdburgh@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Photography & Videos.' },
  // ── DJ / MUSIC / ENTERTAINMENT ────────────────────────────────────────────
  { id: 8001, name: 'That DJ Guy', category: 'Music & DJ', contact: 'David Matfield · 071 643 7330 · dj@thatdjguy.co.za', price: '', status: 'pending', preferred: true, notes: 'Excellent DJ & Equipment.' },
  { id: 8002, name: 'Southern Sound', category: 'Music & DJ', contact: 'DJ U-One & Christelle Theron · 074 107 2885 · Southern.Sound.CPT@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Sound & DJs.' },
  { id: 8003, name: 'Silk Music', category: 'Music & DJ', contact: 'Ryan Engelbrecht · 073 257 7612 · ryan@silkmusic.co.za', price: '', status: 'pending', preferred: true, notes: "DJs, Music & Live Entertainment. Western Cape." },
  { id: 8004, name: 'Shaza Live Entertainment', category: 'Music & DJ', contact: 'Shaza The Musician · 084 034 8006 · admin@shazamusic.co.za', price: '', status: 'pending', preferred: true, notes: 'Solo Live Entertainment, Drums & Vocals — EXCELLENT! RSA.' },
  { id: 8005, name: 'Simply Strings', category: 'Music & DJ', contact: 'Annemi Phillips · 079 528 9575 · annemi@simplystrings.co.za', price: '', status: 'pending', preferred: true, notes: 'Superb Strings Trio, various options & great audience participation.' },
  { id: 8006, name: 'My Oh My Entertainment', category: 'Music & DJ', contact: 'Marne & Carla · 084 428 2195 / 071 609 1353 · info@myohmy.co.za', price: '', status: 'pending', preferred: true, notes: 'Various Brilliant live acts & musicians.' },
  { id: 8007, name: 'Christoff Beukes / ARK Music', category: 'Music & DJ', contact: 'Christoff Beukes · 073 306 6405', price: '', status: 'pending', preferred: false, notes: 'Musician, original live music & covers, DJ & Sound Equipment. George.' },
  { id: 8008, name: 'Sound Print Studio', category: 'Music & DJ', contact: 'Alaric von Molendorff · 083 996 9573 · alaric@soundprint.co.za', price: '', status: 'pending', preferred: false, notes: "DJs & Equipment." },
  { id: 8009, name: 'DJ Dino Moran (DJ Top Hat)', category: 'Music & DJ', contact: 'mail@dinomoran.com', price: '', status: 'pending', preferred: false, notes: 'Renowned DJ & state of the art equipment.' },
  { id: 8010, name: 'DJ Pepe', category: 'Music & DJ', contact: '', price: '', status: 'pending', preferred: false, notes: 'Mobile DJ.' },
  { id: 8011, name: 'Cape Town Jam', category: 'Music & DJ', contact: '084 568 0310 · capetownjambookings@gmail.com', price: '', status: 'pending', preferred: false, notes: "DJs & Equipment." },
  { id: 8012, name: 'Dynamic Sound', category: 'Music & DJ', contact: 'Mike Dickinson · 072 606 3131', price: '', status: 'pending', preferred: false, notes: 'Mobile DJ.' },
  { id: 8013, name: 'Empire Alight Band', category: 'Music & DJ', contact: 'Mark Mcree · 083 652 2566 · empirealight@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Great 4 piece band.' },
  { id: 8014, name: 'The DJ Company', category: 'Music & DJ', contact: '082 527 4968 · bookings@thedjcompany.co.za', price: '', status: 'pending', preferred: false, notes: 'Various DJ options.' },
  { id: 8015, name: 'Absolute Music', category: 'Music & DJ', contact: 'DJ Neil Dallas · 083 270 8234 · neil@absolutemusic.co.za', price: '', status: 'pending', preferred: false, notes: "DJs & Juke Box options. Cape Town." },
  { id: 8016, name: 'Clued Up Entertainment', category: 'Music & DJ', contact: 'Scot · 082 295 1419 · scot@cluedupentertainment.co.za', price: '', status: 'pending', preferred: false, notes: 'Sound options, DJs, lighting and more.' },
  // ── OFFICIANTS ────────────────────────────────────────────────────────────
  { id: 9001, name: 'I Do Weddings', category: 'Officiants', contact: 'Dion Goldie · 079 931 2427 / 083 800 6076 · enquiries@idoweddings.co.za', price: '', status: 'pending', preferred: true, notes: 'Marriage Officiant. Cape Town.' },
  { id: 9002, name: 'Tie the Knot', category: 'Officiants', contact: 'Symi & Ava · 083 459 6859 / 083 305 8221 · ourday@tietheknotcapetown.co.za', price: '', status: 'pending', preferred: true, notes: 'Marriage Officiant. Grabouw.' },
  { id: 9003, name: 'Pierre Muller', category: 'Officiants', contact: 'Pierre Muller · 082 964 2909 · pinministries@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Marriage Officiant. Cape Town.' },
  { id: 9004, name: 'The Wedding Guy', category: 'Officiants', contact: 'John · 083 305 5441 · john@weddingguy.co.za', price: '', status: 'pending', preferred: false, notes: 'Marriage Officiant. Cape Town.' },
  { id: 9005, name: 'Lara Marriage Officer', category: 'Officiants', contact: 'Lara Jess · 072 222 5170 · marriageofficerlara@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Marriage Officiant & Photographer. Cape Town.' },
  { id: 9006, name: 'Rupert De Koning', category: 'Officiants', contact: 'Rupert De Koning · 073 366 3777', price: '', status: 'pending', preferred: false, notes: 'NG Kerk. LOCAL — Montagu.' },
  { id: 9007, name: 'DS Marius Joubert', category: 'Officiants', contact: 'Marius Joubert · 082 557 5985', price: '', status: 'pending', preferred: false, notes: 'LOCAL — Robertson.' },
  { id: 9008, name: 'Hello Marriage Officer', category: 'Officiants', contact: 'Kobus Massyn · 083 353 5678 · info@hello-marriageofficer.co.za', price: '', status: 'pending', preferred: false, notes: 'Helderberg.' },
  { id: 9009, name: 'Heila Downey SSN', category: 'Officiants', contact: 'Heila Downey · 023 626 3515 · heila.downey@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Non-denominational. LOCAL — Robertson.' },
  { id: 9010, name: 'Troy Marriage Officer', category: 'Officiants', contact: 'Troy Goldie · 082 852 4571 / 021 930 5119 · weddings@telkomsa.net', price: '', status: 'pending', preferred: false, notes: 'Cape Town.' },
  // ── INSURANCE ─────────────────────────────────────────────────────────────
  { id: 9101, name: 'I Do Insure', category: 'Insurance', contact: 'Melissa Kloppers · 011 312 6784 · melissa@idoinsure.co.za', price: '', status: 'pending', preferred: true, notes: 'Wedding Insurance Cover: Peace of Mind for nearly any eventuality with regards to your celebration. JHB / Online.' },
  // ── TRANSPORT & SHUTTLES ──────────────────────────────────────────────────
  { id: 9201, name: 'Robertson Transfers', category: 'Transport', contact: '076 126 1867', price: '', status: 'pending', preferred: true, notes: 'Personalised Transfer Service — airport transfers & more. LOCAL — Robertson.' },
  { id: 9202, name: 'Vintage Cars — Montagu Hotel', category: 'Transport', contact: '023 614 3125 · res@montagucountryhotel.co.za', price: '', status: 'pending', preferred: true, notes: 'Vintage Cars for the wedding. Montagu.' },
  { id: 9203, name: 'Route Runners', category: 'Transport', contact: 'Hennie Botha · 076 938 2837 · henniebotha08@gmail.com', price: '', status: 'pending', preferred: true, notes: 'Wedding Transfers, airport, wine tours. LOCAL — Robertson.' },
  { id: 9204, name: 'Swannies Bus Services', category: 'Transport', contact: '023 111 0006', price: '', status: 'pending', preferred: false, notes: 'Bus Service. LOCAL — Robertson.' },
  { id: 9205, name: 'Van Schoor Shuttles', category: 'Transport', contact: '082 678 1142', price: '', status: 'pending', preferred: false, notes: 'Shuttle Service. LOCAL — Robertson.' },
  { id: 9206, name: 'Piet Pompies', category: 'Transport', contact: 'Piet Pompies · 072 115 5895', price: '', status: 'pending', preferred: false, notes: 'Transfers. LOCAL — Robertson.' },
  { id: 9207, name: 'Rob Visagie Taxis', category: 'Transport', contact: 'Rob Visagie · 082 592 1451 · visagieeunice25@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Taxis & Transfers. LOCAL — Robertson.' },
  { id: 9208, name: 'Die Bus — Robertson', category: 'Transport', contact: 'J.D. Cotze · 081 369 3405 / 071 879 9394 · diebus22@gmail.com', price: '', status: 'pending', preferred: false, notes: 'Bus Service. LOCAL — Robertson.' },
  // ── CHILD MINDERS ─────────────────────────────────────────────────────────
  { id: 9301, name: 'Robertson Hospice', category: 'Child Minders', contact: '023 626 5710', price: '', status: 'pending', preferred: true, notes: 'Contact directly for a list of trained & vetted local childcare professionals with experience (first aid etc.). LOCAL — Robertson.' },
  { id: 9302, name: 'Holiday Nannies', category: 'Child Minders', contact: 'Alicia · 082 573 9200 · info@holidaynannies.co.za', price: '', status: 'pending', preferred: false, notes: 'Various Nannies & Childminders. Cape Town.' },
  { id: 9303, name: 'Winelands Nannies', category: 'Child Minders', contact: 'Sue · sue@winelandnannies.com', price: '', status: 'pending', preferred: false, notes: 'Various Nannies & Childminders. Franschhoek.' },
];

// ── Checklist ──────────────────────────────────────────────────────────────
const DEFAULT_CHECKLIST = {
  '12+ Months Before': [
    'Set your overall wedding budget','Confirm your wedding date with Pat Busch',
    'Book your photographer','Start your guest list','Begin dress & suit shopping',
    'Book officiant / marriage officer','Book caterer from approved list'
  ],
  '9–12 Months Before': [
    'Send save-the-dates','Book florist','Book hair & makeup artist',
    'Plan your honeymoon','Set up a gift registry','Book entertainment / DJ',
    'Confirm all on-site accommodation bookings'
  ],
  '6–9 Months Before': [
    'Send wedding invitations','Order the wedding cake','Plan rehearsal dinner',
    'Book transport for guests','Plan seating chart',
    'Visit the venue for a walkthrough','Book engagement shoot'
  ],
  '3–6 Months Before': [
    'Final dress fitting','Confirm all vendor contracts & deposits',
    'Obtain marriage certificate','Write your vows',
    'Create your day-of timeline','Plan ceremony order of events',
    'Assign accommodation to guests'
  ],
  'Final Month': [
    'Final headcount to caterer','Confirm all vendor arrival times',
    'Pick up wedding rings','Break in your wedding shoes',
    'Pack for honeymoon','Deliver décor items to venue',
    'Brief your bridal party on the day plan'
  ],
  'Final Week': [
    'Rest and take care of yourselves','Rehearsal dinner',
    'Pack overnight bags for the Honeymoon Suite',
    'Confirm venue coordinator contact details',
    'Hand venue music/playlist to DJ','Enjoy every moment — you\'ve planned it perfectly ♡'
  ],
};

// ── Default Timeline ───────────────────────────────────────────────────────
const DEFAULT_TIMELINE = [
  // ── Meet & Greet — Tue 6 Jan ────────────────────────────────
  { id: 3001, day: 'mg',  time: '14:00', title: 'Check-in Opens',                location: 'Reception / Farmhouse Erika', notes: 'Guests arrive and check into their cottages and Africamps tents.', duration: 60,  category: 'logistics' },
  { id: 3002, day: 'mg',  time: '16:00', title: 'Welcome Drinks on the Terrace', location: 'The Dam Terrace',             notes: 'Sundowners, snacks and lawn games. Relaxed meet-and-greet for the full wedding party.', duration: 120, category: 'drinks' },
  { id: 3003, day: 'mg',  time: '18:00', title: 'Braai & Pre-Wedding Dinner',    location: 'The Farmhouse Garden',        notes: 'Casual outdoor braai. Salads, sides and dessert provided.', duration: 120, category: 'food' },
  { id: 3004, day: 'mg',  time: '20:00', title: 'Bonfire & Acoustic Music',      location: 'The Fire Pit Area',           notes: 'Acoustic set or playlist around the fire. Stars over the Robertson valley.', duration: 120, category: 'music' },
  { id: 3005, day: 'mg',  time: '22:00', title: 'Bar Closes — Early Night',      location: 'Farmhouse Erika',             notes: 'Early night — big day tomorrow!', duration: 0, category: 'logistics' },
  // ── Wedding Day — Wed 7 Jan ─────────────────────────────────
  { id: 2001, day: 'wed', time: '10:00', title: 'Bridal Party Arrives & Prep Begins', location: 'The Farmhouse',           notes: 'Hair, makeup and getting ready. Champagne breakfast served.', duration: 240, category: 'prep' },
  { id: 2002, day: 'wed', time: '12:00', title: 'Photographer & Videographer Arrive', location: 'The Farmhouse',           notes: 'Getting ready shots, detail photos, dress and rings.', duration: 60, category: 'photography' },
  { id: 2003, day: 'wed', time: '13:00', title: 'Groom & Groomsmen Arrive',           location: 'The Barn Suite',          notes: 'Final prep, buttonholes, group photos.', duration: 60, category: 'prep' },
  { id: 2004, day: 'wed', time: '13:30', title: 'Guests Begin Arriving',              location: 'Main Entrance',           notes: 'Welcome drinks served at the terrace.', duration: 30, category: 'logistics' },
  { id: 2005, day: 'wed', time: '14:00', title: 'Ceremony Begins',                    location: 'Ceremony Arch — Lakeside', notes: 'Guests seated 15 minutes before. Processional music cued.', duration: 45, category: 'ceremony' },
  { id: 2006, day: 'wed', time: '14:45', title: 'Cocktail Hour',                      location: 'The Dam Terrace',         notes: 'Canapés, welcome drinks, lawn games. Couple away for portraits.', duration: 75, category: 'drinks' },
  { id: 2007, day: 'wed', time: '15:00', title: 'Couple Portraits',                   location: 'Around the Reserve',     notes: 'Photographer leads couple through the fynbos and vineyard for golden-hour portraits.', duration: 60, category: 'photography' },
  { id: 2008, day: 'wed', time: '16:30', title: 'Reception Hall Opens',               location: 'The Barn — Reception',   notes: 'Guests invited inside. Background music plays. Table seating.', duration: 30, category: 'logistics' },
  { id: 2009, day: 'wed', time: '17:00', title: 'Welcome & Speeches',                 location: 'Reception',              notes: 'MC welcome, father of bride, best man, matron of honour.', duration: 45, category: 'speeches' },
  { id: 2010, day: 'wed', time: '18:00', title: 'Dinner Served',                      location: 'Reception',              notes: 'Three-course sit-down dinner. Background playlist.', duration: 90, category: 'food' },
  { id: 2011, day: 'wed', time: '19:30', title: 'Cake Cutting',                       location: 'Reception',              notes: 'Cake cutting ceremony. Dessert & coffee served.', duration: 20, category: 'food' },
  { id: 2012, day: 'wed', time: '20:00', title: 'First Dance',                        location: 'Dance Floor',            notes: 'Couple first dance, then parent dances. DJ takes over.', duration: 30, category: 'music' },
  { id: 2013, day: 'wed', time: '20:30', title: 'Dancing & Celebrations',             location: 'Dance Floor',            notes: 'Open dance floor. DJ set. Bar open.', duration: 150, category: 'music' },
  { id: 2014, day: 'wed', time: '23:00', title: 'Last Dance & Send-Off',              location: 'Main Entrance',          notes: 'Sparkler send-off. Couple retired to Honeymoon Suite.', duration: 30, category: 'ceremony' },
  // ── Farewell Breakfast — Thu 8 Jan ─────────────────────────
  { id: 4001, day: 'fb',  time: '08:00', title: 'Farewell Breakfast Served',          location: 'The Farmhouse — Stoep',  notes: 'Full breakfast spread — eggs, toast, fruit, coffee & juice for all guests.', duration: 90, category: 'food' },
  { id: 4002, day: 'fb',  time: '09:30', title: 'Final Toasts & Memories',            location: 'The Stoep',              notes: 'A short toast to the newlyweds. Share your favourite moments.', duration: 30, category: 'speeches' },
  { id: 4003, day: 'fb',  time: '11:00', title: 'Check-out & Farewell',               location: 'Main Entrance',          notes: 'All guests to vacate rooms by 11:00. Safe travels to everyone!', duration: 60, category: 'logistics' },
];

const TIMELINE_CATEGORIES = {
  prep:        { label: 'Prep & Getting Ready', color: '#c09050' },
  ceremony:    { label: 'Ceremony',             color: '#4a7c59' },
  drinks:      { label: 'Drinks & Welcome',     color: '#b89745' },
  food:        { label: 'Food & Dining',        color: '#a05340' },
  speeches:    { label: 'Speeches & Toasts',    color: '#8a6e32' },
  music:       { label: 'Music & Dancing',      color: '#6b5b8a' },
  photography: { label: 'Photography',          color: '#2e7a8a' },
  activity:    { label: 'Activities',           color: '#5a7030' },
  logistics:   { label: 'Logistics',            color: '#777777' },
};
const TIMELINE_DAYS = [
  { id: 'mg',  emoji: '🥂', title: 'Meet & Greet',       date: 'Tue 6 Jan 2027' },
  { id: 'wed', emoji: '💒', title: 'Wedding Day',         date: 'Wed 7 Jan 2027' },
  { id: 'fb',  emoji: '☀️',  title: 'Farewell Breakfast', date: 'Thu 8 Jan 2027' },
];


// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════
let state = {
  totalBudget: '',
  rentalSelections: {},
  catalogueSelections: {},
  suppliers: [],
  checklist: {},
  timeline: [],
  guests: [],
  roomAssignments: {},
  galleryImages: [],
  layout: { notes: '', tables: [] },
  editingSupplierId: null,
  editingEventId: null,
  editingDietaryGuest: null,
  guestDietary: {},
};

// ── Storage ────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
let _saveWarnShown = false;
function _storageKey() {
  return 'venuePortal_v1__' + (window.WEDDING_SLUG || 'default');
}
// Debounced server sync — every save() schedules a PUT 600ms later.
let _serverSaveTimer = null;
let _serverSavePending = false;
function _serverSave() {
  if (!window.WEDDING_USE_SERVER || !window.WEDDING_SLUG) return;
  if (_serverSavePending) return;
  _serverSavePending = true;
  fetch('/api/wedding/' + encodeURIComponent(window.WEDDING_SLUG) + '/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(state),
  }).catch(function(e) { console.warn('Server save failed:', e); })
    .finally(function() { _serverSavePending = false; });
}
function save() {
  try {
    localStorage.setItem(_storageKey(), JSON.stringify(state));
    _saveWarnShown = false;
  } catch(e) {
    if (!_saveWarnShown) {
      _saveWarnShown = true;
      const b = document.getElementById('saveWarningBanner');
      if (b) b.style.display = 'flex';
      console.warn('Venue Portal: localStorage save failed —', e.message);
    }
  }
  // Mirror to server (debounced).
  if (window.WEDDING_USE_SERVER) {
    clearTimeout(_serverSaveTimer);
    _serverSaveTimer = setTimeout(_serverSave, 600);
  }
}
function load() {
  // Server-injected initial state takes priority over localStorage.
  if (window.WEDDING_USE_SERVER && window.WEDDING_INITIAL_STATE && Object.keys(window.WEDDING_INITIAL_STATE).length) {
    state = { ...state, ...window.WEDDING_INITIAL_STATE };
  } else {
    try {
      const raw = localStorage.getItem(_storageKey());
      if (raw) { const loaded = JSON.parse(raw); state = { ...state, ...loaded }; }
    } catch(e) {}
  }

  // The DEFAULT_SUPPLIERS / DEFAULT_CHECKLIST below are Pat-Busch-specific
  // (Heather's booked photographer, Robertson-local vendors, PB deadlines).
  // Only seed them as a local/dev fallback — i.e. when this portal is NOT
  // running against a live venue backend. A real venue's couple must start
  // with an empty list, not someone else's suppliers/checklist.
  var _seedPatBuschDefaults = !window.WEDDING_USE_SERVER;

  // Seed default suppliers if none saved, or merge in any new defaults not yet in state
  if (!state.suppliers) state.suppliers = [];
  if (_seedPatBuschDefaults) {
    if (!state.suppliers.length) {
      state.suppliers = DEFAULT_SUPPLIERS.map(s => ({...s}));
    } else {
      // Merge in any DEFAULT_SUPPLIERS entries whose id doesn't already exist in saved state
      const existingIds = new Set(state.suppliers.map(s => s.id));
      const newDefaults = DEFAULT_SUPPLIERS.filter(s => !existingIds.has(s.id));
      if (newDefaults.length) {
        state.suppliers = [...state.suppliers, ...newDefaults.map(s => ({...s}))];
      }
    }
  }
  // Seed checklist
  if (!state.checklist) state.checklist = {};
  if (_seedPatBuschDefaults) {
    if (!Object.keys(state.checklist).length) {
      for (const [section, items] of Object.entries(DEFAULT_CHECKLIST)) {
        state.checklist[section] = items.map(t => ({ text: t, done: false }));
      }
    } else {
      // Ensure all default sections/items exist
      for (const [section, items] of Object.entries(DEFAULT_CHECKLIST)) {
        if (!state.checklist[section]) {
          state.checklist[section] = items.map(t => ({ text: t, done: false }));
        }
      }
    }
  }
  // Seed timeline
  if (!state.timeline || !state.timeline.length) {
    state.timeline = DEFAULT_TIMELINE.map(e => ({...e}));
  }
  if (!state.guests) state.guests = [];
  if (!state.roomAssignments) state.roomAssignments = {};
  if (!state.galleryImages) state.galleryImages = [];
  if (!state.guestDietary) state.guestDietary = {};
  // Layout planner state (notes + simple table list). Tolerate older saves that
  // never had this key, or a partially-shaped object.
  if (!state.layout || typeof state.layout !== 'object') state.layout = { notes: '', tables: [] };
  if (typeof state.layout.notes !== 'string') state.layout.notes = '';
  if (!Array.isArray(state.layout.tables)) state.layout.tables = [];
  // Migrate timeline events without a day or category
  if (state.timeline) state.timeline.forEach(function(e) {
    if (!e.day) e.day = 'wed';
    // Re-apply category from defaults if it's still the generic 'logistics' fallback
    var defEvt = DEFAULT_TIMELINE.find(function(d){ return d.id === e.id; });
    if (defEvt && (!e.category || e.category === 'logistics')) e.category = defEvt.category || 'logistics';
  });
  // Seed M&G and Farewell events if they don't exist yet
  var existingDays = new Set((state.timeline||[]).map(function(e){return e.day;}));
  if (!existingDays.has('mg')) {
    DEFAULT_TIMELINE.filter(function(e){return e.day==='mg';}).forEach(function(e){ state.timeline.push(Object.assign({},e)); });
  }
  if (!existingDays.has('fb')) {
    DEFAULT_TIMELINE.filter(function(e){return e.day==='fb';}).forEach(function(e){ state.timeline.push(Object.assign({},e)); });
  }
  // Seed rental selections
  if (!state.rentalSelections) state.rentalSelections = {};
  RENTAL_ITEMS.forEach(function(item) {
    if (!state.rentalSelections[item.code]) {
      state.rentalSelections[item.code] = { sel: false, qty: item.maxQty === 1 ? 1 : 0, mg: false, wed: true, fb: false, note: '' };
    }
  });
  // Seed catalogue selections
  if (!state.catalogueSelections) state.catalogueSelections = {};
  CATALOGUE_ITEMS.forEach(function(item) {
    if (!state.catalogueSelections[item.code]) {
      state.catalogueSelections[item.code] = { sel: false, mg: false, wed: true, fb: false };
    }
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────
function showTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  const renders = { dashboard: renderDashboard, catalogue: renderCatalogue, accommodation: renderAccommodation, guests: renderGuests, suppliers: renderSuppliers, budget: renderBudget, timeline: renderTimeline, checklist: renderChecklist, venue: renderVenue, rentals: renderRentals, floorplans: renderFloorPlans, rooming: renderRooming, layout: renderLayout };
  if (renders[name]) renders[name]();
}

// ── Countdown ──────────────────────────────────────────────────────────────
function updateCountdown() {
  const target = new Date(VENUE.couple.date + 'T00:00:00');
  const now = new Date();
  const diff = target - now;
  if (diff <= 0) { document.getElementById('countdown').innerHTML = '<div class="countdown-unit"><div class="countdown-num" style="font-size:1.4rem;color:var(--gold-light)">Today is the day! ♡</div></div>'; return; }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  document.getElementById('countdown').innerHTML = `
    <div class="countdown-unit"><div class="countdown-num">${d}</div><div class="countdown-lbl">Days</div></div>
    <div class="countdown-unit"><div class="countdown-num">${h}</div><div class="countdown-lbl">Hours</div></div>
    <div class="countdown-unit"><div class="countdown-num">${m}</div><div class="countdown-lbl">Minutes</div></div>`;
}

// ── Money helpers ──────────────────────────────────────────────────────────
function parseMoney(s) { return parseFloat((s||'').replace(/[^0-9.]/g,'')) || 0; }
function fmt(n) { return 'R ' + Math.abs(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 }); }
function fmtDate(s) { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }); }
function isPast(s) { if (!s) return false; return new Date(s + 'T00:00:00') < new Date(); }
function isSoon(s) { if (!s) return false; const d = new Date(s + 'T00:00:00'); const now = new Date(); return d >= now && (d - now) < 30 * 86400000; }

// ── Dashboard ──────────────────────────────────────────────────────────────
function renderDashboard() {
  // Stats
  const booked = state.suppliers.filter(s => s.status === 'booked').length;
  const totalSpend = state.suppliers.filter(s => s.price).reduce((a, s) => a + parseMoney(s.price), 0);
  const budget = parseMoney(state.totalBudget);
  const allTasks = Object.values(state.checklist).flat();
  const doneTasks = allTasks.filter(t => t.done).length;
  const totalGuests = state.guests.length;
  const placedGuests = Object.values(state.roomAssignments).flat().length;

  document.getElementById('dashStats').innerHTML = `
    <div class="dash-stat"><div class="dash-stat-val">${Math.floor((new Date(VENUE.couple.date+'T00:00:00') - new Date()) / 86400000)}</div><div class="dash-stat-lbl">Days to go</div></div>
    <div class="dash-stat"><div class="dash-stat-val">${booked}</div><div class="dash-stat-lbl">Vendors booked</div></div>
    <div class="dash-stat"><div class="dash-stat-val">${budget ? Math.round((totalSpend/budget)*100)+'%' : fmt(totalSpend)}</div><div class="dash-stat-lbl">${budget ? 'Budget used' : 'Committed'}</div></div>
    <div class="dash-stat"><div class="dash-stat-val">${doneTasks}/${allTasks.length}</div><div class="dash-stat-lbl">Tasks done</div></div>
    <div class="dash-stat"><div class="dash-stat-val">${placedGuests}/${totalGuests||'—'}</div><div class="dash-stat-lbl">Guests housed</div></div>`;

  // Alerts
  const alerts = [];
  state.suppliers.forEach(s => {
    if (s.deposit && !s.depositPaid && isPast(s.depositDue)) alerts.push({ type: 'red', msg: `⚠ Deposit for <strong>${s.name}</strong> (${s.deposit}) was due ${fmtDate(s.depositDue)} — overdue` });
    else if (s.deposit && !s.depositPaid && isSoon(s.depositDue)) alerts.push({ type: 'amber', msg: `📅 Deposit for <strong>${s.name}</strong> (${s.deposit}) due ${fmtDate(s.depositDue)}` });
    if (s.finalPayment && !s.finalPaymentPaid && isPast(s.finalPaymentDue)) alerts.push({ type: 'red', msg: `⚠ Final payment for <strong>${s.name}</strong> (${s.finalPayment}) was due ${fmtDate(s.finalPaymentDue)} — overdue` });
    else if (s.finalPayment && !s.finalPaymentPaid && isSoon(s.finalPaymentDue)) alerts.push({ type: 'amber', msg: `📅 Final payment for <strong>${s.name}</strong> (${s.finalPayment}) due ${fmtDate(s.finalPaymentDue)}` });
  });
  if (!alerts.length) alerts.push({ type: 'green', msg: '✓ No overdue or upcoming payments — you\'re on track!' });
  document.getElementById('dashAlerts').innerHTML = alerts.map(a => `<div class="alert-card alert-${a.type}">${a.msg}</div>`).join('');

  // Upcoming payments
  const payVendors = state.suppliers.filter(s => (s.deposit && !s.depositPaid) || (s.finalPayment && !s.finalPaymentPaid));
  document.getElementById('dashPayments').innerHTML = payVendors.length ? payVendors.map(s => `
    <div class="card" style="margin-bottom:10px;padding:14px 16px">
      <div style="font-size:0.82rem;font-weight:500;color:var(--forest);margin-bottom:6px">${s.name}</div>
      ${s.deposit && !s.depositPaid ? `<div style="font-size:0.78rem;color:${isPast(s.depositDue)?'#c0392b':'var(--text-light)'}">Deposit ${s.deposit} — due ${fmtDate(s.depositDue)||'TBC'}${isPast(s.depositDue)?' ⚠':''}</div>` : ''}
      ${s.finalPayment && !s.finalPaymentPaid ? `<div style="font-size:0.78rem;color:${isPast(s.finalPaymentDue)?'#c0392b':'var(--text-light)'}">Balance ${s.finalPayment} — due ${fmtDate(s.finalPaymentDue)||'TBC'}</div>` : ''}
    </div>`).join('') : '<div style="color:var(--text-light);font-size:0.83rem;font-style:italic">No outstanding payments 🎉</div>';

  // Next tasks
  const pending = allTasks.filter(t => !t.done).slice(0, 5);
  document.getElementById('dashTasks').innerHTML = pending.length ? pending.map(t => `
    <div class="card" style="margin-bottom:8px;padding:10px 14px;font-size:0.82rem;color:var(--text-light);display:flex;align-items:center;gap:8px">
      <span style="color:var(--border)">○</span> ${t.text}
    </div>`).join('') : '<div style="color:var(--sage);font-size:0.83rem">All tasks complete — well done! 🎉</div>';
}

// ── Venue ──────────────────────────────────────────────────────────────────
// Pat-Busch fallbacks for the "Our Venue" tab — used only when the server has
// not injected venue-profile globals (i.e. local/dev or the original PB portal).
const PB_VENUE_ABOUT = "Pat Busch Mountain Reserve is a private nature reserve in the Robertson Valley, Western Cape. Nestled between mountains and fynbos, it offers an intimate, wild, and utterly private backdrop for your celebration. The reserve sleeps up to 49 guests across the main property (Oak, Fig, Quince, Pine, Nightjar, Hadeda cottages + Farmhouse Erika), plus a further 50 guests in 10 Africamps boutique safari tents — your whole wedding party under one sky.";
const PB_VENUE_INCLUDED = [
  'Exclusive reserve use','Accommodation — 49 guests + 50 in Africamps','Bedding, linen & towels in every unit',
  'Braai equipment & potjies','Electric blankets (Exclusive Cottages)','Barn Venue & Wedding Meadow',
  'Full glassware, crockery & cutlery','Kitchen facilities for caterer','Parking — 3 areas on site',
  'Catalogue furniture & décor items','Pool with a View','Hiking trails — Karin, Middelrug, Hermit',
  'Grounds keeper & coordinator on the day'
];
const PB_VENUE_AREAS = [
  { name: 'Barn Venue', description: 'Main wedding reception & ceremony hall, adjacent to Oak Cottage' },
  { name: 'Wedding Meadow', description: 'Open-air ceremony space next to the Barn & the ancient Oak Tree' },
  { name: 'Oak Tree Area', description: 'Iconic ancient oak tree — a stunning backdrop for ceremonies & photos' },
  { name: 'Pool with a View', description: 'Shared pool between Africamps tents and the main venue area' },
  { name: 'Poplar Forest', description: 'Atmospheric forest, accessible via Hermit Trail (no vehicles)' },
  { name: 'Pine Forest', description: 'Upper pine forest area, accessible via Karin Trail' },
  { name: 'Dam & Echo Dam', description: 'Scenic dam with picnic spots, accessible via Middelrug Trail' },
  { name: 'Lapa', description: 'Covered outdoor entertainment area near the Barn Venue' },
  { name: 'Shop & Reception', description: 'At the reserve entrance, near Hadeda & Nightjar cottages' }
];
const PB_VENUE_DIRECTIONS = '<strong>From Cape Town:</strong> Take the N1 to Worcester (±100km).<br>Turn right onto the <strong>R60 towards Robertson</strong> and drive through Worcester following signs to Robertson (±50km).<br>Continue straight through Robertson towards Ashton on the R60. Cross the traffic circle as you leave Robertson — after <strong>10km</strong> take the road on the <strong>left</strong> up towards the mountain: <strong>KLAASVOOGDS WEST</strong>.<br>3km up Klaasvoogds West: <strong>right</strong> at the first T-junction, <strong>left</strong> at the second T-junction, then 3km up the gravel road.<br>🔐 <strong>Security gate:</strong> enter the code emailed to you.';

function renderVenue() {
  // ── Location / map / contact (guard each lookup — template may restructure) ──
  const locEl = document.getElementById('venueLocation');
  if (locEl) locEl.textContent = VENUE.location;
  const mapEl = document.getElementById('venueMapLink');
  if (mapEl) {
    if (VENUE.mapUrl) { mapEl.href = VENUE.mapUrl; mapEl.style.display = ''; }
    else { mapEl.removeAttribute('href'); mapEl.style.display = 'none'; }
  }
  const contactEl = document.getElementById('venueContact');
  if (contactEl) contactEl.innerHTML = `<a href="mailto:${escHtml(VENUE.email)}" class="info-link">${escHtml(VENUE.email)}</a><br>${escHtml(VENUE.phone)}${VENUE.website ? `<br><a href="${escHtml(VENUE.website)}" class="info-link" target="_blank">${escHtml(VENUE.website)}</a>` : ''}`;

  // ── About (venue story/blurb) ──
  const aboutEl = document.getElementById('venueAbout');
  if (aboutEl) {
    const about = (window.VENUE_DESCRIPTION != null && String(window.VENUE_DESCRIPTION).trim())
      ? escHtml(window.VENUE_DESCRIPTION) : (window.WEDDING_USE_SERVER ? '' : escHtml(PB_VENUE_ABOUT));
    aboutEl.innerHTML = about
      ? `<div class="info-label">About the Venue</div><div class="info-val" style="margin-top:6px;line-height:1.8">${about.replace(/\n/g,'<br>')}</div>`
      : '';
    aboutEl.style.display = about ? '' : 'none';
  }

  // ── Directions ──
  const dirEl = document.getElementById('venueDirections');
  if (dirEl) {
    let dir = '';
    if (window.VENUE_DIRECTIONS != null && String(window.VENUE_DIRECTIONS).trim()) dir = escHtml(window.VENUE_DIRECTIONS).replace(/\n/g,'<br>');
    else if (!window.WEDDING_USE_SERVER) dir = PB_VENUE_DIRECTIONS;
    dirEl.innerHTML = dir
      ? `<div class="info-label">Directions</div><div class="info-val" style="font-size:0.82rem;line-height:1.9">${dir}</div>`
      : '';
  }

  // ── What's Included ──
  const incEl = document.getElementById('venueIncluded');
  if (incEl) {
    let included = Array.isArray(window.VENUE_INCLUDED) && window.VENUE_INCLUDED.length
      ? window.VENUE_INCLUDED : (window.WEDDING_USE_SERVER ? [] : PB_VENUE_INCLUDED);
    incEl.innerHTML = included.length
      ? `<div class="info-label" style="margin-bottom:4px">What's Included in Your Booking</div>
         <div class="included-chips">${included.map(i => `<span class="included-chip"><span class="chip-check">✓</span>${escHtml(i)}</span>`).join('')}</div>`
      : '';
  }

  // ── Venue Areas & Spaces ──
  const areasEl = document.getElementById('venueAreas');
  if (areasEl) {
    let areas = Array.isArray(window.VENUE_AREAS) && window.VENUE_AREAS.length
      ? window.VENUE_AREAS : (window.WEDDING_USE_SERVER ? [] : PB_VENUE_AREAS);
    areasEl.innerHTML = areas.length
      ? `<div class="info-label" style="margin-bottom:4px">Venue Areas &amp; Spaces</div>
         <div class="venue-areas-grid">${areas.map(a => `
           <div class="venue-area-card">
             <div class="venue-area-icon">📍</div>
             <div class="venue-area-name">${escHtml(a.name)}</div>
             ${a.description ? `<div class="venue-area-desc">${escHtml(a.description)}</div>` : ''}
           </div>`).join('')}</div>`
      : '';
  }

  const gallery = document.getElementById('venueGallery');
  if (!gallery) return;
  const slots = 8;
  const venueMedia = (window.VENUE_GALLERY || []);
  let html = venueMedia.map(m => m.kind === 'video'
    ? `<div class="gallery-slot"><video src="${m.src}" controls style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 7px;border-radius:99px">${m.category || ''}</div></div>`
    : `<div class="gallery-slot"><img src="${m.src}" alt=""><div style="position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 7px;border-radius:99px">${m.category || ''}</div></div>`
  ).join('');
  html += state.galleryImages.map((img, i) => `
    <div class="gallery-slot">
      <img src="${img.src}" alt="">
      <div class="g-overlay">
        <button class="g-btn" onclick="removeGalleryImg(${i})">Remove</button>
      </div>
    </div>`).join('');
  for (let i = state.galleryImages.length; i < slots; i++) {
    html += `<div class="gallery-slot" onclick="document.getElementById('galleryFileInput').click()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg><span>Add Photo</span></div>`;
  }
  gallery.innerHTML = html;
}
function addGalleryImages(input) {
  const files = [...input.files];
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      state.galleryImages.push({ src: e.target.result });
      loaded++;
      if (loaded === files.length) { save(); renderVenue(); showToast('Photos added ✦'); }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
function removeGalleryImg(i) {
  state.galleryImages.splice(i, 1); save(); renderVenue();
}

// ── Catalogue ─────────────────────────────────────────────────────────────
let catFilter = 'all';
let catSearch = '';
function setCatFilter(f, btn) {
  catFilter = f;
  btn.closest('.cat-toolbar').querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCatalogue();
}
function buildCatalogueHTML() {
  var container = document.getElementById('catalogueOutput');
  if (!container) return;
  var q = catSearch.toLowerCase();
  var cats = catFilter === 'all' ? CATALOGUE_CATS : [catFilter];
  var html = '';
  cats.forEach(function(cat) {
    var items = CATALOGUE_ITEMS.filter(function(i) {
      return i.cat === cat && (!q || i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
    });
    if (!items.length) return;
    var safeId = cat.replace(/[^a-z0-9]/gi, '_');
    var rowsHtml = '';
    items.forEach(function(item) {
      var s = state.catalogueSelections[item.code] || {};
      var catImg = item.img || CATALOGUE_ITEM_IMAGES[item.imgKey];
      var imgHtml = catImg
        ? '<div class="cat-thumb-wrap"><img class="cat-thumb" src="' + catImg + '" alt="' + item.name + '"></div>'
        : '';
      rowsHtml +=
        '<div class="catalogue-row ' + (s.sel ? 'rental-selected' : '') + '" id="cat-row-' + item.code + '">' +
          '<div class="rental-check-wrap">' +
            '<input type="checkbox" class="rental-checkbox" id="cc-' + item.code + '" ' + (s.sel ? 'checked' : '') + ' onchange="toggleCatSel(\'' + item.code + '\')">' +
            '<label for="cc-' + item.code + '" class="rental-code">' + item.code + '</label>' +
          '</div>' +
          '<div class="rental-info">' +
            imgHtml +
            '<div class="rental-info-text">' +
              '<div class="rental-name">' + item.name + '</div>' +
              (item.desc ? '<div class="rental-desc">' + item.desc + '</div>' : '') +
              '<div style="margin-top:4px"><span class="cat-badge badge-inc">✓ Included Free</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="rental-qty-wrap"><span style="font-size:0.85rem;color:var(--sage);font-weight:600">' + item.qty + '</span></div>' +
          '<div class="rental-day-check"><label><input type="checkbox" ' + (s.mg  ? 'checked' : '') + ' onchange="toggleCatDay(\'' + item.code + '\',\'mg\')"> M&amp;G</label></div>' +
          '<div class="rental-day-check"><label><input type="checkbox" ' + (s.wed ? 'checked' : '') + ' onchange="toggleCatDay(\'' + item.code + '\',\'wed\')"> Wed</label></div>' +
          '<div class="rental-day-check"><label><input type="checkbox" ' + (s.fb  ? 'checked' : '') + ' onchange="toggleCatDay(\'' + item.code + '\',\'fb\')"> FB</label></div>' +
        '</div>';
    });
    html +=
      '<div class="rental-category">' +
        '<div class="rental-cat-header" onclick="toggleCatSection(\'' + safeId + '\')">' +
          '<span>' + cat + '</span>' +
          '<div style="display:flex;align-items:center;gap:16px">' +
            '<span class="rental-cat-arrow" id="cat-arrow-' + safeId + '">▾</span>' +
          '</div>' +
        '</div>' +
        '<div class="rental-cat-body" id="cat-body-' + safeId + '">' +
          '<div class="rental-items-header" style="grid-template-columns:80px 1fr 80px 52px 52px 52px">' +
            '<span></span><span>Item</span><span style="text-align:center">Qty</span>' +
            '<span style="text-align:center">M&amp;G</span><span style="text-align:center">Wed</span><span style="text-align:center">FB</span>' +
          '</div>' +
          rowsHtml +
        '</div>' +
      '</div>';
  });
  container.innerHTML = html;
}
function renderCatalogue() {
  catSearch = (document.getElementById('catSearch') || {value:''}).value.toLowerCase();
  buildCatalogueHTML();
}
function toggleCatSection(safeId) {
  const body = document.getElementById('cat-body-' + safeId);
  const arrow = document.getElementById('cat-arrow-' + safeId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
}
function toggleCatSel(code) {
  state.catalogueSelections[code].sel = !state.catalogueSelections[code].sel;
  const row = document.getElementById('cat-row-' + code);
  if (row) row.classList.toggle('rental-selected', state.catalogueSelections[code].sel);
  save();
}
function toggleCatDay(code, day) {
  state.catalogueSelections[code][day] = !state.catalogueSelections[code][day];
  save();
}

// ── Accommodation ──────────────────────────────────────────────────────────
let selectedGuest = null;
function renderAccommodation() {
  // Show "try new view" banner if available
  const linkBanner = document.getElementById('accommNewBanner');
  if (linkBanner && window.VENUE_ACCOMMODATION_LINK) {
    linkBanner.innerHTML = `<a href="${window.VENUE_ACCOMMODATION_LINK}" style="display:inline-flex;align-items:center;gap:8px;background:var(--forest,#2d4a3a);color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;text-decoration:none">✨ Try the new Airbnb-style accommodation view →</a>`;
  }
  // Guest pool
  const placed = new Set(Object.values(state.roomAssignments).flat());
  const pool = document.getElementById('guestPool');
  pool.innerHTML = state.guests.map(g => `
    <div class="pool-chip ${placed.has(g) ? 'placed' : selectedGuest === g ? 'sel' : ''}" style="display:inline-flex;align-items:center;gap:2px" onclick="selectGuest(${escHtml(JSON.stringify(g))})">
      ${getDietaryDot(g)}<span>${g}</span>
      <button class="chip-pencil" onclick="event.stopPropagation();openDietaryModal(${escHtml(JSON.stringify(g))})">✎</button>
      ${!placed.has(g) ? `<span onclick="event.stopPropagation();removeGuest(${escHtml(JSON.stringify(g))});" style="opacity:0.45;font-size:0.7rem;padding-left:2px;cursor:pointer">×</span>` : ''}
    </div>`).join('') || '<div style="font-size:0.8rem;color:var(--text-light);font-style:italic">No guests added yet — click "+ Add Guest" to get started</div>';


  const total = state.guests.length;
  const placedCount = placed.size;
  document.getElementById('guestPoolCount').textContent = `${placedCount} of ${total} guests assigned`;

  // Rooms
  const grid = document.getElementById('accomGrid');
  grid.innerHTML = ACCOMMODATION.map(room => {
    const assigned = state.roomAssignments[room.id] || [];
    const pct = Math.min((assigned.length / room.sleeps) * 100, 100);
    const full = assigned.length >= room.sleeps;
    return `<div class="accom-card">
      <div class="accom-hd">
        <div>
          <div class="accom-name">${room.name}</div>
          <div class="accom-meta">
            <span class="accom-meta-item">🛏 ${room.bedrooms} bedroom${room.bedrooms>1?'s':''}</span>
            <span class="accom-meta-item">👥 Sleeps ${room.sleeps}</span>
          </div>
        </div>
        <span class="accom-type-tag">${room.type}</span>
      </div>
      <div class="accom-body">
        <div class="accom-desc">${room.description}</div>
        <div class="amenity-wrap">${room.amenities.map(a => `<span class="amenity">${a}</span>`).join('')}</div>
        <div class="cap-label">${assigned.length} / ${room.sleeps} guests assigned</div>
        <div class="cap-bar"><div class="cap-fill ${full?'full':''}" style="width:${pct}%"></div></div>
        <div class="guest-chips">${assigned.map(g => `<div class="gchip" style="display:inline-flex;align-items:center;gap:3px">${getDietaryDot(g)}<span>${g}</span><button class="chip-pencil" onclick="event.stopPropagation();openDietaryModal(${escHtml(JSON.stringify(g))})">✎</button><span onclick="unassignGuest('${room.id}',${escHtml(JSON.stringify(g))})">✕</span></div>`).join('')}</div>
        ${!full ? `<button class="btn btn-secondary btn-sm" style="width:100%;margin-top:6px" onclick="assignSelectedGuest('${room.id}')">
          ${selectedGuest ? `Assign ${selectedGuest} here` : 'Select a guest above to assign'}
        </button>` : `<div style="font-size:0.75rem;color:#c0392b;text-align:center;margin-top:6px">Room full</div>`}
      </div>
    </div>`;
  }).join('');
  renderCatererSheet();
}
function selectGuest(name) {
  const placed = new Set(Object.values(state.roomAssignments).flat());
  if (placed.has(name)) return;
  selectedGuest = selectedGuest === name ? null : name;
  renderAccommodation();
}
function assignSelectedGuest(roomId) {
  if (!selectedGuest) { showToast('Select a guest from the pool above first'); return; }
  const room = ACCOMMODATION.find(r => r.id === roomId);
  if (!state.roomAssignments[roomId]) state.roomAssignments[roomId] = [];
  if (state.roomAssignments[roomId].length >= room.sleeps) { showToast('This room is full'); return; }
  if (!state.roomAssignments[roomId].includes(selectedGuest)) state.roomAssignments[roomId].push(selectedGuest);
  selectedGuest = null;
  save(); renderAccommodation(); showToast('Guest assigned ✦');
}
function unassignGuest(roomId, name) {
  state.roomAssignments[roomId] = (state.roomAssignments[roomId] || []).filter(g => g !== name);
  save(); renderAccommodation();
}
function removeGuest(name) {
  state.guests = state.guests.filter(g => g !== name);
  Object.keys(state.roomAssignments).forEach(r => { state.roomAssignments[r] = state.roomAssignments[r].filter(g => g !== name); });
  if (selectedGuest === name) selectedGuest = null;
  save(); renderAccommodation();
}
function openGuestModal() { document.getElementById('guestNames').value = ''; document.getElementById('guestModal').classList.add('open'); }
function saveGuests() {
  const names = document.getElementById('guestNames').value.split('\n').map(n => n.trim()).filter(n => n);
  names.forEach(n => { if (!state.guests.includes(n)) state.guests.push(n); });
  save(); closeModal('guestModal'); renderAccommodation(); if(document.getElementById('tab-guests').classList.contains('active')) renderGuests(); renderDashboard(); showToast(`${names.length} guest${names.length!==1?'s':''} added ✦`);
}

// ── Rentals ───────────────────────────────────────────────────────────────
function calcItemCost(item) {
  const s = state.rentalSelections[item.code];
  if (!s || !s.sel) return 0;
  const qty = Math.max(0, Math.min(parseInt(s.qty) || 0, item.maxQty));
  if (item.rateType === 'consumable') return item.rate * qty;
  const days = (s.mg ? 1 : 0) + (s.wed ? 1 : 0) + (s.fb ? 1 : 0);
  if (days === 0) return 0;
  if (item.rateType === 'flat' || item.rateType === 'special') return item.rate * days;
  return item.rate * qty * days;
}
function calcRentalTotal() {
  return RENTAL_ITEMS.reduce(function(sum, item) { return sum + calcItemCost(item); }, 0);
}
function buildRentalHTML() {
  const container = document.getElementById('rentalCategoriesContainer');
  if (!container || container.children.length > 0) return;
  container.innerHTML = RENTAL_CATS.map(function(cat) {
    const items = RENTAL_ITEMS.filter(function(i) { return i.cat === cat; });
    const icon = RENTAL_CAT_ICONS[cat] || '•';
    const safeId = cat.replace(/[^a-z0-9]/gi,'_');
    return '<div class="rental-category">' +
      '<div class="rental-cat-header" onclick="toggleRentalCat(\'' + safeId + '\')">' +
        '<span>' + icon + ' ' + cat + '</span>' +
        '<div style="display:flex;align-items:center;gap:16px">' +
          '<span class="rental-cat-total" id="rental-cat-total-' + safeId + '"></span>' +
          '<span class="rental-cat-arrow" id="rental-arrow-' + safeId + '">▾</span>' +
        '</div>' +
      '</div>' +
      '<div class="rental-cat-body" id="rental-body-' + safeId + '">' +
        '<div class="rental-items-header">' +
          '<span></span><span>Item</span><span style="text-align:center">Qty</span><span style="text-align:center">Rate/day</span>' +
          '<span style="text-align:center">M&amp;G</span><span style="text-align:center">Wed</span><span style="text-align:center">FB</span>' +
          '<span style="text-align:right">Subtotal</span>' +
        '</div>' +
        items.map(function(item) {
          const s = state.rentalSelections[item.code] || {};
          const isConsumable = item.rateType === 'consumable';
          const needsQty = item.rateType === 'perUnit' || isConsumable;
          const rateLabel = item.rateType === 'special'
            ? 'R' + item.rate.toLocaleString('en-ZA') + ' ' + item.specialNote
            : 'R' + item.rate.toLocaleString('en-ZA') + (isConsumable ? '/unit' : '/day');
          return '<div class="rental-item ' + (s.sel ? 'rental-selected' : '') + '" id="rental-row-' + item.code + '">' +
            '<div class="rental-check-wrap">' +
              '<input type="checkbox" class="rental-checkbox" id="rc-' + item.code + '" ' + (s.sel ? 'checked' : '') + ' onchange="toggleRentalSel(\'' + item.code + '\')">' +
              '<label for="rc-' + item.code + '" class="rental-code">' + item.code.replace('a','').replace('b','') + '</label>' +
            '</div>' +
            '<div class="rental-info">' +
              ((item.img || RENTAL_ITEM_IMAGES[item.code]) ? '<div class="rental-thumb-wrap"><img class="rental-thumb" src="' + (item.img || RENTAL_ITEM_IMAGES[item.code]) + '" alt="' + item.name + '"></div>' : '') +
              '<div class="rental-info-text">' +
                '<div class="rental-name">' + item.name + '</div>' +
                (item.desc ? '<div class="rental-desc">' + item.desc + '</div>' : '') +
                (item.repl ? '<div class="rental-repl">Replacement value: R' + item.repl.toLocaleString('en-ZA') + '</div>' : '') +
              '</div>' +
            '</div>' +
            '<div class="rental-qty-wrap">' +
              (needsQty
                ? '<input type="number" class="rental-qty-input" value="' + (s.qty||0) + '" min="0" max="' + item.maxQty + '" onchange="setRentalQty(\'' + item.code + '\',this.value)" oninput="setRentalQty(\'' + item.code + '\',this.value)" placeholder="0"><div class="rental-max">of ' + item.maxQty + '</div>'
                : '<span style="font-size:0.75rem;color:var(--text-light)">—</span>') +
            '</div>' +
            '<div class="rental-rate">' + rateLabel + '</div>' +
            (isConsumable
              ? '<div class="rental-day-check" style="grid-column:span 3;text-align:center;font-size:0.72rem;color:var(--text-light);font-style:italic">consumable — no day selection</div>'
              : '<div class="rental-day-check"><label><input type="checkbox" ' + (s.mg ? 'checked' : '') + ' onchange="toggleRentalDay(\'' + item.code + '\',\'mg\')"> M&amp;G</label></div>' +
                '<div class="rental-day-check"><label><input type="checkbox" ' + (s.wed ? 'checked' : '') + ' onchange="toggleRentalDay(\'' + item.code + '\',\'wed\')"> Wed</label></div>' +
                '<div class="rental-day-check"><label><input type="checkbox" ' + (s.fb ? 'checked' : '') + ' onchange="toggleRentalDay(\'' + item.code + '\',\'fb\')"> FB</label></div>') +
            '<div class="rental-cost" id="rental-cost-' + item.code + '">—</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }).join('');
}
function renderRentals() {
  buildRentalHTML();
  const total = calcRentalTotal();
  const count = RENTAL_ITEMS.filter(function(i) { return state.rentalSelections[i.code] && state.rentalSelections[i.code].sel; }).length;
  const totalEl = document.getElementById('rentalTotalAmount');
  const countEl = document.getElementById('rentalItemCount');
  if (totalEl) totalEl.textContent = 'R ' + total.toLocaleString('en-ZA');
  if (countEl) countEl.textContent = count + ' item' + (count !== 1 ? 's' : '') + ' selected';
  RENTAL_CATS.forEach(function(cat) {
    const items = RENTAL_ITEMS.filter(function(i) { return i.cat === cat; });
    const catTotal = items.reduce(function(s, i) { return s + calcItemCost(i); }, 0);
    const safeId = cat.replace(/[^a-z0-9]/gi,'_');
    const catEl = document.getElementById('rental-cat-total-' + safeId);
    if (catEl) catEl.textContent = catTotal > 0 ? 'R ' + catTotal.toLocaleString('en-ZA') : '';
    items.forEach(function(item) {
      const cost = calcItemCost(item);
      const costEl = document.getElementById('rental-cost-' + item.code);
      if (costEl) costEl.textContent = cost > 0 ? 'R ' + cost.toLocaleString('en-ZA') : '—';
    });
  });
}
function selectAllRentals() {
  RENTAL_ITEMS.forEach(function(item) { state.rentalSelections[item.code].sel = true; });
  save(); renderRentals();
}
function deselectAllRentals() {
  RENTAL_ITEMS.forEach(function(item) { state.rentalSelections[item.code].sel = false; });
  save(); renderRentals();
}
function toggleRentalSel(code) {
  state.rentalSelections[code].sel = !state.rentalSelections[code].sel;
  const row = document.getElementById('rental-row-' + code);
  if (row) row.classList.toggle('rental-selected', state.rentalSelections[code].sel);
  save(); renderRentals();
}
function setRentalQty(code, val) {
  const item = RENTAL_ITEMS.find(function(i) { return i.code === code; });
  const qty = Math.max(0, Math.min(parseInt(val) || 0, item.maxQty));
  state.rentalSelections[code].qty = qty;
  if (qty > 0) state.rentalSelections[code].sel = true;
  const row = document.getElementById('rental-row-' + code);
  if (row) row.classList.toggle('rental-selected', state.rentalSelections[code].sel);
  save(); renderRentals();
}
function toggleRentalDay(code, day) {
  state.rentalSelections[code][day] = !state.rentalSelections[code][day];
  save(); renderRentals();
}
function setRentalNote(code, val) {
  state.rentalSelections[code].note = val;
  save();
}
function toggleRentalCat(safeId) {
  const body = document.getElementById('rental-body-' + safeId);
  const arrow = document.getElementById('rental-arrow-' + safeId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
}
// ── Suppliers ──────────────────────────────────────────────────────────────
let supFilter = 'all';
function setSupFilter(f, btn) {
  supFilter = f;
  btn.closest('.cat-toolbar').querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSuppliers();
}
const VENDOR_TYPE_LABELS = { caterer:'Catering', planner:'Planning', florist:'Florist', dj:'DJ / Music', photographer:'Photography', decor:'Decor', bar:'Bar' };

function addRecommendedToMyList(vendorId) {
  const v = (window.VENUE_VENDORS || []).find(x => x.id === vendorId);
  if (!v) return;
  if (state.suppliers.some(s => s.fromVendorId === vendorId)) { showToast('Already on your list'); return; }
  const cat = VENDOR_TYPE_LABELS[v.vendor_type] || v.vendor_type;
  state.suppliers.push({
    id: Date.now(),
    fromVendorId: vendorId,
    name: v.name,
    category: cat,
    status: 'pending',
    preferred: true,
    contact: [v.contact_phone, v.contact_email].filter(Boolean).join(' · '),
    price: v.price_from ? ('R' + Number(v.price_from).toLocaleString()) : '',
    notes: v.description || '',
  });
  save(); renderSuppliers(); renderBudget(); showToast('Added to your suppliers');
}

function renderRecommendedVendors() {
  const host = document.getElementById('recommendedVendors');
  if (!host) return;
  const vendors = window.VENUE_VENDORS || [];
  if (!vendors.length) { host.innerHTML = ''; return; }
  const groups = {};
  vendors.forEach(v => { (groups[v.vendor_type] = groups[v.vendor_type] || []).push(v); });
  const sections = Object.keys(groups).map(t => {
    const label = VENDOR_TYPE_LABELS[t] || t;
    const cards = groups[t].map(v => {
      const onList = state.suppliers.some(s => s.fromVendorId === v.id);
      return `<div class="sup-card" style="border-left:3px solid var(--gold,#b8762a)">
        ${v.image_url ? `<img src="${escHtml(v.image_url)}" alt="" style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:8px">` : ''}
        <div class="sup-cat">${escHtml(label)}</div>
        <div class="sup-name">${escHtml(v.name)}</div>
        <div class="sup-preferred">★ Recommended by ${escHtml(window.WEDDING_VENUE?.name || 'the venue')}</div>
        ${v.description ? `<div class="sup-notes">${escHtml(v.description)}</div>` : ''}
        ${v.price_from ? `<div class="sup-price">From R${Number(v.price_from).toLocaleString()}</div>` : ''}
        ${v.contact_phone ? `<div class="sup-contact">📞 ${escHtml(v.contact_phone)}</div>` : ''}
        ${v.contact_email ? `<div class="sup-contact">✉ ${escHtml(v.contact_email)}</div>` : ''}
        ${v.website_url ? `<div class="sup-contact"><a href="${escHtml(v.website_url)}" target="_blank" rel="noopener noreferrer">↗ Website</a></div>` : ''}
        <div class="sup-actions">
          ${onList
            ? `<button class="btn btn-booked btn-sm" disabled>✓ On your list</button>`
            : `<button class="btn btn-book btn-sm" onclick="addRecommendedToMyList('${v.id}')">+ Add to my list</button>`}
        </div>
      </div>`;
    }).join('');
    return `<details open style="margin-bottom:14px"><summary style="cursor:pointer;font-weight:600;color:var(--text-dark);margin-bottom:10px">★ Recommended ${escHtml(label)} (${groups[t].length})</summary><div class="supplier-grid">${cards}</div></details>`;
  }).join('');
  host.innerHTML = `<div style="background:#fdfaf3;border:1px solid #e6dcc6;border-radius:10px;padding:16px 18px"><div style="font-size:13px;color:#7a6a4a;margin-bottom:12px">These vendors are hand-picked by your venue. Tap <b>+ Add to my list</b> to track and book them like any other supplier.</div>${sections}</div>`;
}

function renderSuppliers() {
  renderRecommendedVendors();
  const list = supFilter === 'all' ? state.suppliers : state.suppliers.filter(s => s.category === supFilter);
  const grid = document.getElementById('supplierGrid');
  if (!list.length) { grid.innerHTML = `<div style="color:var(--text-light);font-style:italic;padding:20px 0;grid-column:1/-1">No suppliers in this category yet.</div>`; return; }
  grid.innerHTML = list.map(s => {
    const statusClass = s.status === 'booked' ? 'status-booked' : s.status === 'contacted' ? 'status-contacted' : 'status-pending';
    return `<div class="sup-card">
      <div class="sup-cat">${escHtml(s.category)}</div>
      <div class="sup-name">${escHtml(s.name)}</div>
      ${s.preferred ? '<div class="sup-preferred">★ Venue Preferred Supplier</div>' : ''}
      <div class="sup-status ${statusClass}"><span class="status-dot"></span>${s.status === 'booked' ? 'Booked' : s.status === 'contacted' ? 'Contacted' : 'Pending'}</div>
      ${s.contact ? `<div class="sup-contact">📞 ${escHtml(s.contact)}</div>` : ''}
      ${s.price ? `<div class="sup-price">${escHtml(s.price)}</div>` : ''}
      ${s.notes ? `<div class="sup-notes">${escHtml(s.notes)}</div>` : ''}
      <div class="sup-actions">
        ${s.status === 'booked'
          ? `<button class="btn btn-booked btn-sm" onclick="toggleBookedStatus(${s.id})" title="Click to unbook">✓ Booked</button>`
          : `<button class="btn btn-book btn-sm" onclick="toggleBookedStatus(${s.id})">Mark Booked</button>`}
        <button class="btn btn-secondary btn-sm" onclick="openSupplierModal(${s.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSupplier(${s.id})">Remove</button>
      </div>
    </div>`;
  }).join('');
}
function openSupplierModal(id, fromBudget) {
  state.editingSupplierId = id || null;
  const s = id ? state.suppliers.find(x => x.id === id) : null;
  document.getElementById('supplierModalTitle').textContent = s ? 'Edit Supplier' : 'Add Supplier';
  document.getElementById('sName').value = s?.name || '';
  document.getElementById('sCategory').value = s?.category || 'Photography';
  document.getElementById('sContact').value = s?.contact || '';
  document.getElementById('sPrice').value = s?.price || '';
  document.getElementById('sStatus').value = s?.status || 'pending';
  document.getElementById('sDeposit').value = s?.deposit || '';
  document.getElementById('sDepositDue').value = s?.depositDue || '';
  document.getElementById('sFinalAmt').value = s?.finalPayment || '';
  document.getElementById('sFinalDue').value = s?.finalPaymentDue || '';
  document.getElementById('sBankDetails').value = s?.bankDetails || '';
  document.getElementById('sNotes').value = s?.notes || '';
  document.getElementById('sDepositPaid').checked = !!s?.depositPaid;
  document.getElementById('sFinalPaid').checked = !!s?.finalPaymentPaid;
  document.getElementById('sPreferred').checked = !!s?.preferred;
  document.getElementById('supplierModal').classList.add('open');
}
function saveSupplier() {
  const name = document.getElementById('sName').value.trim();
  if (!name) { showToast('Please enter a supplier name'); return; }
  const dep = document.getElementById('sDeposit').value.trim();
  const fin = document.getElementById('sFinalAmt').value.trim();
  const supplier = {
    id: state.editingSupplierId || Date.now(),
    name, category: document.getElementById('sCategory').value,
    contact: document.getElementById('sContact').value.trim(),
    price: document.getElementById('sPrice').value.trim(),
    status: document.getElementById('sStatus').value,
    notes: document.getElementById('sNotes').value.trim(),
    preferred: document.getElementById('sPreferred').checked,
    deposit: dep || undefined, depositDue: document.getElementById('sDepositDue').value || undefined,
    depositPaid: dep ? document.getElementById('sDepositPaid').checked : undefined,
    finalPayment: fin || undefined, finalPaymentDue: document.getElementById('sFinalDue').value || undefined,
    finalPaymentPaid: fin ? document.getElementById('sFinalPaid').checked : undefined,
    bankDetails: document.getElementById('sBankDetails').value.trim() || undefined,
  };
  if (state.editingSupplierId) {
    const idx = state.suppliers.findIndex(s => s.id === state.editingSupplierId);
    if (idx !== -1) state.suppliers[idx] = supplier; else state.suppliers.push(supplier);
  } else state.suppliers.push(supplier);
  state.editingSupplierId = null;
  save(); closeModal('supplierModal'); renderSuppliers(); renderBudget();
  showToast('Supplier saved ✦');
}
function deleteSupplier(id) {
  if (!confirm('Remove this supplier?')) return;
  state.suppliers = state.suppliers.filter(s => s.id !== id);
  save(); renderSuppliers(); renderBudget();
}
function toggleBookedStatus(id) {
  const s = state.suppliers.find(x => x.id === id);
  if (!s) return;
  s.status = s.status === 'booked' ? 'pending' : 'booked';
  save(); renderSuppliers(); renderDashboard();
  showToast(s.status === 'booked' ? s.name + ' marked as booked ✦' : s.name + ' marked as pending');
}
function toggleDepositPaid(id) { const s = state.suppliers.find(x => x.id === id); if (s) { s.depositPaid = !s.depositPaid; save(); renderBudget(); } }
function toggleFinalPaid(id) { const s = state.suppliers.find(x => x.id === id); if (s) { s.finalPaymentPaid = !s.finalPaymentPaid; save(); renderBudget(); } }

// ── Guests ────────────────────────────────────────────────────────────────
function renderGuests() {
  const placed = new Set(Object.values(state.roomAssignments).flat());
  const q = (document.getElementById('guestSearch')?.value || '').toLowerCase();
  const guests = q ? state.guests.filter(g => g.toLowerCase().includes(q)) : state.guests;

  // Stats
  const total = state.guests.length;
  const assigned = placed.size;
  const unassigned = total - assigned;
  document.getElementById('guestStats').innerHTML = [
    { val: total, lbl: 'Total Guests' },
    { val: assigned, lbl: 'Assigned' },
    { val: unassigned, lbl: 'Unassigned' },
    { val: ACCOMMODATION.reduce((a,r)=>a+r.sleeps,0), lbl: 'Total Capacity' }
  ].map(s => `<div class="guest-stat"><div class="guest-stat-val">${s.val}</div><div class="guest-stat-lbl">${s.lbl}</div></div>`).join('');

  // Build room lookup
  const roomFor = {};
  ACCOMMODATION.forEach(r => {
    (state.roomAssignments[r.id] || []).forEach(g => { roomFor[g] = r.name; });
  });

  const tbody = document.getElementById('guestListBody');
  const empty = document.getElementById('guestListEmpty');
  if (!guests.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = guests.map((g, i) => {
    const room = roomFor[g];
    return `<tr>
      <td style="color:var(--text-light);width:36px">${state.guests.indexOf(g)+1}</td>
      <td><strong>${g}</strong></td>
      <td>${getDietaryBadge(g)} <button class="chip-pencil" style="font-size:0.8rem;opacity:0.5" onclick="openDietaryModal(${escHtml(JSON.stringify(g))})">✎</button></td>
      <td>${room
        ? `<span class="guest-assigned-tag">✓ ${room}</span>`
        : `<span class="guest-unassigned-tag">Unassigned</span>`}</td>
      <td style="text-align:right;white-space:nowrap">
        ${room ? `<button class="btn btn-secondary btn-sm" style="font-size:0.65rem" onclick="unassignGuestFromList(${escHtml(JSON.stringify(g))})">Unassign</button> ` : ''}
        <button class="btn btn-danger btn-sm" style="font-size:0.65rem" onclick="removeGuestFromList(${escHtml(JSON.stringify(g))})">Remove</button>
      </td>
    </tr>`;

  }).join('');
}
function unassignGuestFromList(name) {
  Object.keys(state.roomAssignments).forEach(r => {
    state.roomAssignments[r] = state.roomAssignments[r].filter(g => g !== name);
  });
  save(); renderGuests();
  showToast(name + ' unassigned');
}
function removeGuestFromList(name) {
  if (!confirm('Remove ' + name + ' from the guest list?')) return;
  state.guests = state.guests.filter(g => g !== name);
  Object.keys(state.roomAssignments).forEach(r => {
    state.roomAssignments[r] = state.roomAssignments[r].filter(g => g !== name);
  });
  save(); renderGuests(); renderDashboard();
  showToast(name + ' removed ✦');
}

// ── Dietary tracking ───────────────────────────────────────────────────────
function getDietaryColor(key) {
  const map = { vegetarian:'#4caf50', vegan:'#8bc34a', 'gluten-free':'#795548', 'dairy-free':'#2196f3', halal:'#ff9800', kosher:'#e64a19', 'nut-free':'#f44336', other:'#9e9e9e' };
  return map[key] || null;
}
function getDietaryDot(guestName) {
  const d = state.guestDietary && state.guestDietary[guestName];
  if (!d || !d.dietary) return '';
  const color = getDietaryColor(d.dietary);
  if (!color) return '';
  const tip = d.dietary + (d.allergies ? ' · ' + d.allergies : '');
  return `<span class="dietary-dot d-${d.dietary}" title="${tip}"></span>`;
}
function getDietaryBadge(guestName) {
  const d = state.guestDietary && state.guestDietary[guestName];
  if (!d || !d.dietary) return '<span class="dietary-badge db-none">Standard</span>';
  const labels = { vegetarian:'Vegetarian', vegan:'Vegan', 'gluten-free':'Gluten-Free', 'dairy-free':'Dairy-Free', halal:'Halal', kosher:'Kosher', 'nut-free':'Nut-Free', other:'Other' };
  return `<span class="dietary-badge db-${d.dietary}">${getDietaryDot(guestName)}${labels[d.dietary] || d.dietary}</span>`;
}
function openDietaryModal(name) {
  state.editingDietaryGuest = name;
  document.getElementById('dietaryGuestName').textContent = name;
  const d = (state.guestDietary && state.guestDietary[name]) || {};
  document.getElementById('dietaryType').value = d.dietary || '';
  document.getElementById('dietaryAllergies').value = d.allergies || '';
  document.getElementById('dietaryNotes').value = d.notes || '';
  document.getElementById('dietaryModal').classList.add('open');
}
function saveDietary() {
  const name = state.editingDietaryGuest;
  if (!name) return;
  if (!state.guestDietary) state.guestDietary = {};
  state.guestDietary[name] = {
    dietary: document.getElementById('dietaryType').value,
    allergies: document.getElementById('dietaryAllergies').value.trim(),
    notes: document.getElementById('dietaryNotes').value.trim()
  };
  save(); closeModal('dietaryModal');
  if (document.getElementById('tab-accommodation').classList.contains('active')) renderAccommodation();
  if (document.getElementById('tab-guests').classList.contains('active')) renderGuests();
  showToast(name + ' dietary info saved ✦');
}
function renderCatererSheet() {
  const el = document.getElementById('catererSheet');
  if (!el) return;
  if (!state.guests || !state.guests.length) { el.innerHTML = ''; return; }
  const roomFor = {};
  ACCOMMODATION.forEach(r => { (state.roomAssignments[r.id]||[]).forEach(g=>{ roomFor[g]=r.name; }); });
  const rows = state.guests.map((g,i) => {
    const d = (state.guestDietary && state.guestDietary[g]) || {};
    const badge = getDietaryBadge(g);
    const room = roomFor[g] ? `<span class="guest-assigned-tag" style="font-size:0.7rem">${roomFor[g]}</span>` : '<span style="color:var(--text-light)">—</span>';
    const gEsc = g; // name now safely escaped via escHtml(JSON.stringify()) at render time
    return `<tr>
      <td style="width:32px;color:var(--text-light)">${i+1}</td>
      <td><strong>${g}</strong></td>
      <td>${badge}</td>
      <td style="font-size:0.8rem;color:var(--text)">${d.allergies || '<span style="color:var(--text-light)">—</span>'}</td>
      <td>${room}</td>
      <td style="font-size:0.78rem;color:var(--text-light);max-width:180px">${d.notes || '—'}</td>
      <td><button class="btn btn-secondary btn-sm" style="font-size:0.6rem;white-space:nowrap" onclick="openDietaryModal('${gEsc}')">✎ Edit</button></td>
    </tr>`;
  }).join('');
  const hasDietary = state.guests.some(g => state.guestDietary && state.guestDietary[g] && state.guestDietary[g].dietary);
  el.innerHTML = `
    <div class="caterer-section-title">Guest Details — Caterer Sheet</div>
    <div class="caterer-section-sub">${state.guests.length} guest${state.guests.length!==1?'s':''} · ${hasDietary ? 'dietary requirements noted below' : 'click ✎ on any guest to set dietary requirements'}</div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="caterer-table">
        <thead><tr>
          <th>#</th><th>Name</th><th>Dietary</th><th>Allergies</th><th>Room</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Print / Export ─────────────────────────────────────────────────────────
function exportSummary() {
  const v = VENUE;
  const c = v.couple;
  const placed = new Set(Object.values(state.roomAssignments).flat());
  const booked = state.suppliers.filter(s => s.status === 'booked');
  const allSupWithCost = state.suppliers.filter(s => s.price || s.deposit || s.finalPayment);
  const totalSpend = allSupWithCost.reduce((a,s)=>a+parseMoney(s.price),0);
  const allTasks = Object.values(state.checklist).flat();
  const doneTasks = allTasks.filter(t=>t.done).length;
  const roomFor = {};
  ACCOMMODATION.forEach(r => { (state.roomAssignments[r.id]||[]).forEach(g=>{ roomFor[g]=r.name; }); });

  const rows = (arr, fn) => arr.map(fn).join('');

  const w = window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${c.name1} &amp; ${c.name2} — Wedding Summary</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Georgia',serif;color:#1e2a1e;background:#fff;padding:40px;max-width:860px;margin:0 auto}
  h1{font-size:2.2rem;font-weight:400;color:#1e3a1e;margin-bottom:4px}
  h2{font-size:1rem;letter-spacing:3px;text-transform:uppercase;color:#c4902a;font-weight:400;border-bottom:1px solid #e8e0d0;padding-bottom:8px;margin:28px 0 14px}
  .meta{font-size:0.85rem;color:#666;margin-bottom:28px}
  .divider{text-align:center;color:#c4902a;font-size:1.2rem;margin:6px 0 20px}
  table{width:100%;border-collapse:collapse;font-size:0.82rem;margin-bottom:8px}
  th{text-align:left;font-size:0.7rem;letter-spacing:1.5px;text-transform:uppercase;color:#888;padding:6px 10px;border-bottom:2px solid #e8e0d0;font-family:sans-serif}
  td{padding:7px 10px;border-bottom:1px solid #f0ebe0;vertical-align:top}
  .tag{display:inline-block;background:#edf7f0;color:#4a7c59;border-radius:8px;padding:1px 8px;font-size:0.72rem}
  .tag-pend{background:#fef9ec;color:#8a6010}
  .total{font-weight:700;font-size:0.9rem}
  .stat-row{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px}
  .stat{text-align:center;min-width:100px}
  .stat-val{font-size:1.6rem;color:#1e3a1e}
  .stat-lbl{font-size:0.65rem;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-family:sans-serif}
  .timeline-item{display:flex;gap:14px;margin-bottom:12px;font-size:0.83rem}
  .t-time{min-width:50px;color:#c4902a;font-weight:700}
  .checklist-section{margin-bottom:12px}
  .cl-heading{font-size:0.75rem;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px;font-family:sans-serif}
  .cl-item{display:flex;gap:8px;align-items:center;font-size:0.82rem;margin-bottom:3px}
  .cl-done{color:#4a7c59}.cl-todo{color:#888}
  @media print{body{padding:20px}h2{margin-top:20px}}
</style></head><body>
<h1>${c.name1} &amp; ${c.name2}</h1>
<div class="meta">${v.name} &nbsp;·&nbsp; ${c.displayDate} &nbsp;·&nbsp; ${Math.floor((new Date(c.date+'T00:00:00')-new Date())/86400000)} days to go</div>
<div class="divider">✦</div>

<h2>Suppliers &amp; Budget</h2>
<div class="stat-row">
  <div class="stat"><div class="stat-val">${state.suppliers.length}</div><div class="stat-lbl">On List</div></div>
  <div class="stat"><div class="stat-val">${booked.length}</div><div class="stat-lbl">Booked</div></div>
  <div class="stat"><div class="stat-val">${fmt(totalSpend)}</div><div class="stat-lbl">Committed</div></div>
  ${state.totalBudget ? `<div class="stat"><div class="stat-val">${fmt(parseMoney(state.totalBudget)-totalSpend)}</div><div class="stat-lbl">Remaining</div></div>` : ''}
</div>
<table>
<thead><tr><th>Supplier</th><th>Category</th><th>Price</th><th>Status</th></tr></thead>
<tbody>${rows(allSupWithCost.length ? allSupWithCost : booked, s=>`<tr>
  <td><strong>${s.name}</strong>${s.notes?`<br><span style="color:#999;font-size:0.75rem">${s.notes}</span>`:''}</td>
  <td style="color:#666">${s.category}</td>
  <td>${s.price||'—'}</td>
  <td><span class="${s.status==='booked'?'tag':'tag tag-pend'}">${s.status}</span></td>
</tr>`)}</tbody></table>

<h2>Accommodation &amp; Guests</h2>
<div class="stat-row">
  <div class="stat"><div class="stat-val">${state.guests.length}</div><div class="stat-lbl">Total Guests</div></div>
  <div class="stat"><div class="stat-val">${placed.size}</div><div class="stat-lbl">Assigned</div></div>
  <div class="stat"><div class="stat-val">${state.guests.length - placed.size}</div><div class="stat-lbl">Unassigned</div></div>
</div>
${state.guests.length ? `<table>
<thead><tr><th>Guest</th><th>Room</th><th>Dietary</th><th>Allergies</th><th>Notes</th></tr></thead>
<tbody>${rows(state.guests, g=>{
  const d = (state.guestDietary && state.guestDietary[g]) || {};
  return `<tr>
  <td>${g}</td>
  <td>${roomFor[g]?`<span class="tag">${roomFor[g]}</span>`:`<span style="color:#aaa">Unassigned</span>`}</td>
  <td>${d.dietary||'<span style="color:#aaa">—</span>'}</td>
  <td>${d.allergies||'<span style="color:#aaa">—</span>'}</td>
  <td>${d.notes||'<span style="color:#aaa">—</span>'}</td>
</tr>`;})}</tbody></table>` : '<p style="color:#aaa;font-style:italic;font-size:0.83rem">No guests added yet.</p>'}

<h2>Wedding Day Timeline</h2>
${state.timeline.length ? state.timeline.map(e=>`<div class="timeline-item">
  <div class="t-time">${e.time}</div>
  <div>
    <strong>${e.title}</strong>${e.location?` <span style="color:#888;font-size:0.78rem">— ${e.location}</span>`:''}
    ${e.notes?`<div style="color:#888;font-size:0.78rem;margin-top:2px">${e.notes}</div>`:''}
  </div>
</div>`).join('') : '<p style="color:#aaa;font-style:italic;font-size:0.83rem">No timeline events yet.</p>'}

<h2>Planning Checklist (${doneTasks}/${allTasks.length} done)</h2>
${Object.entries(state.checklist).map(([section, items])=>`
  <div class="checklist-section">
    <div class="cl-heading">${section}</div>
    ${items.map(t=>`<div class="cl-item ${t.done?'cl-done':'cl-todo'}">${t.done?'☑':'☐'} ${t.text}</div>`).join('')}
  </div>`).join('')}

<div style="margin-top:40px;text-align:center;color:#ccc;font-size:0.75rem;border-top:1px solid #f0ebe0;padding-top:16px">
  Generated from ${v.name} Wedding Portal · ${new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})}
</div>
<script>window.onload=function(){window.print()}<\/script>

</body></html>`);
  w.document.close();
}

// ── Budget ─────────────────────────────────────────────────────────────────
function renderBudget() {
  if (state.totalBudget) document.getElementById('totalBudgetInput').value = state.totalBudget;
  const total = parseMoney(state.totalBudget);
  const withPrice = state.suppliers.filter(s => s.price);
  const spent = withPrice.reduce((a, s) => a + parseMoney(s.price), 0);
  const remaining = total - spent;
  const payVendors = state.suppliers.filter(s => s.deposit || s.finalPayment);
  const unpaid = payVendors.reduce((a, s) => {
    if (s.deposit && !s.depositPaid) a += parseMoney(s.deposit);
    if (s.finalPayment && !s.finalPaymentPaid) a += parseMoney(s.finalPayment);
    return a;
  }, 0);

  document.getElementById('budgetSummary').innerHTML = `
    <div class="bstat"><div class="bstat-lbl">Total Budget</div><div class="bstat-val">${total ? fmt(total) : '—'}</div></div>
    <div class="bstat"><div class="bstat-lbl">Committed</div><div class="bstat-val">${fmt(spent)}</div></div>
    <div class="bstat"><div class="bstat-lbl">Remaining</div><div class="bstat-val ${remaining < 0 ? 'over' : ''}">${total ? (remaining < 0 ? '−' : '') + fmt(Math.abs(remaining)) : '—'}</div></div>
    <div class="bstat"><div class="bstat-lbl">Outstanding Payments</div><div class="bstat-val ${unpaid > 0 ? 'over' : ''}">${unpaid > 0 ? fmt(unpaid) : '✓ None'}</div></div>`;

  let html = '';
  if (payVendors.length) {
    html += `<div class="section-title" style="font-size:1.1rem;margin-bottom:14px;margin-top:4px">Payment Schedule</div>`;
    html += payVendors.map(s => {
      const rows = [];
      if (s.deposit) {
        const od = !s.depositPaid && isPast(s.depositDue);
        rows.push(`<div class="pay-row">
          <div><div class="pay-lbl">50% Deposit</div><div class="pay-amt">${s.deposit}</div><div class="pay-due ${od?'overdue':''}">${s.depositDue ? 'Due: ' + fmtDate(s.depositDue) + (od ? ' ⚠ Overdue' : '') : ''}</div></div>
          <button class="pay-btn" onclick="toggleDepositPaid(${s.id})" style="border-color:${s.depositPaid?'var(--sage)':od?'#c0392b':'var(--border)'};background:${s.depositPaid?'var(--sage)':'transparent'};color:${s.depositPaid?'#fff':od?'#c0392b':'var(--text-light)'}">
            ${s.depositPaid ? '✓ Paid' : 'Mark Paid'}
          </button>
        </div>`);
      }
      if (s.finalPayment) {
        const od = !s.finalPaymentPaid && isPast(s.finalPaymentDue);
        rows.push(`<div class="pay-row">
          <div><div class="pay-lbl">Final Balance</div><div class="pay-amt">${s.finalPayment}</div><div class="pay-due ${od?'overdue':''}">${s.finalPaymentDue ? 'Due: ' + fmtDate(s.finalPaymentDue) + (od ? ' ⚠ Overdue' : '') : ''}</div></div>
          <button class="pay-btn" onclick="toggleFinalPaid(${s.id})" style="border-color:${s.finalPaymentPaid?'var(--sage)':od?'#c0392b':'var(--border)'};background:${s.finalPaymentPaid?'var(--sage)':'transparent'};color:${s.finalPaymentPaid?'#fff':od?'#c0392b':'var(--text-light)'}">
            ${s.finalPaymentPaid ? '✓ Paid' : 'Mark Paid'}
          </button>
        </div>`);
      }
      return `<div class="bbar-card" style="padding:14px 18px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <span style="font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:var(--forest)">${s.name} <span style="font-size:0.8rem;font-family:'Jost',sans-serif;color:var(--text-light);font-weight:300">${s.category}</span></span>
          ${s.invoiceRef ? `<span style="font-size:0.72rem;color:var(--text-light)">${s.invoiceRef}</span>` : ''}
        </div>
        ${rows.join('')}
        ${s.bankDetails ? `<div style="margin-top:10px;padding:9px 12px;background:var(--cream);border-radius:6px;font-size:0.74rem;color:var(--text-light);line-height:1.7"><span style="font-size:0.65rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);font-weight:600">Bank Details</span><br>${s.bankDetails}</div>` : ''}
      </div>`;
    }).join('');
    html += `<div class="section-title" style="font-size:1.1rem;margin-bottom:14px;margin-top:24px">Budget Breakdown</div>`;
  }
  renderPayPanel();
  if (!withPrice.length) { document.getElementById('budgetBars').innerHTML = html + `<div style="color:var(--text-light);font-style:italic;padding:16px 0">Upload an invoice or add vendors with prices to see the breakdown.</div>`; return; }
  html += withPrice.map(s => {
    const amt = parseMoney(s.price); const pct = total ? Math.min((amt/total)*100,100) : 0;
    return `<div class="bbar-card"><div class="bbar-hd"><span class="bbar-name">${s.name} <span style="font-weight:300;color:var(--text-light)">(${s.category})</span></span><span class="bbar-amt">${s.price}${total ? ' · ' + pct.toFixed(0) + '%' : ''}</span></div><div class="btrack"><div class="bfill ${total&&amt>total?'over':''}" style="width:${pct}%"></div></div></div>`;
  }).join('');
  document.getElementById('budgetBars').innerHTML = html;
}

// ── PDF Invoice Scanner ────────────────────────────────────────────────────
async function handleInvoiceUpload(input) {
  const file = input.files[0]; if (!file) return;
  input.value = '';
  if (typeof pdfjsLib === 'undefined') { showToast('PDF reader not loaded — check your connection'); return; }
  showToast('Scanning invoice…');
  try {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    const parsed = parseInvoiceText(text, file.name);
    populateInvoiceModal(parsed, text);
    document.getElementById('invoiceModal').classList.add('open');
  } catch(e) {
    showToast('Could not read this PDF — try a different file');
    console.error(e);
  }
}
function parseInvoiceText(text, filename) {
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(l => l.length > 1);

  // Amounts
  const allAmounts = [...text.matchAll(/R\s*([\d\s,]+(?:\.\d{2})?)/gi)]
    .map(m => parseFloat(m[1].replace(/[\s,]/g, '')))
    .filter(n => n > 100 && n < 10000000);

  // Total — look for 'Total' label
  const totalLineMatch = text.match(/[Tt]otal\s+R\s*([\d\s,]+(?:\.\d{2})?)/);
  const total = totalLineMatch ? parseFloat(totalLineMatch[1].replace(/[\s,]/g, '')) : (allAmounts.length ? Math.max(...allAmounts) : 0);

  // Payment rows (lines mentioning Unpaid, Due, Deposit)
  const payLines = lines.filter(l => /unpaid|overdue/i.test(l));

  // Dates in text
  const dateMatches = [...text.matchAll(/(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\w*\s+(\d{4})/gi)];
  const dates = dateMatches.map(m => {
    const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const mon = m[2].substring(0,3).toLowerCase();
    const d = new Date(parseInt(m[3]), months[mon], parseInt(m[1]));
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }).filter(Boolean);

  // ISO dates
  const isoDates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]);
  const allDates = [...new Set([...dates, ...isoDates])].sort();

  // Amounts by payment row: associate with payLines
  let deposit = '', depositDue = '', finalPayment = '', finalDue = '';
  // Look for two payment rows with amounts and dates
  const payRowAmounts = [];
  payLines.forEach(line => {
    const amtMatch = line.match(/R\s*([\d\s,]+(?:\.\d{2})?)/i);
    if (amtMatch) payRowAmounts.push(parseFloat(amtMatch[1].replace(/[\s,]/g, '')));
  });

  if (payRowAmounts.length >= 2) {
    deposit = 'R ' + payRowAmounts[0].toLocaleString('en-ZA', { maximumFractionDigits: 0 });
    finalPayment = 'R ' + payRowAmounts[1].toLocaleString('en-ZA', { maximumFractionDigits: 0 });
  } else if (total > 0) {
    const half = total / 2;
    deposit = 'R ' + half.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
    finalPayment = 'R ' + half.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
  }
  if (allDates.length >= 1) depositDue = allDates[0];
  if (allDates.length >= 2) finalDue = allDates[1];

  // Bank details
  const accountMatch = text.match(/(?:business\s+cheque|account|acc(?:ount)?|chq)[:\s]*(\d{8,12})/i);
  const branchMatch = text.match(/[Bb]ranch[:\s]*(\d{5,6})/);
  const swiftMatch = text.match(/[Ss]wift(?:\s+code)?[:\s]*([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/i);
  const bankNameMatch = text.match(/\b(FNB|Absa|Standard Bank|Nedbank|Capitec|Investec|Bidvest)\b/i);
  let bankDetails = '';
  if (bankNameMatch) bankDetails += bankNameMatch[1];
  if (accountMatch) bankDetails += (bankDetails ? ' · Account: ' : 'Account: ') + accountMatch[1];
  if (branchMatch) bankDetails += ' · Branch: ' + branchMatch[1];
  if (swiftMatch) bankDetails += ' · Swift: ' + swiftMatch[1].toUpperCase();

  // Reference
  const refMatch = text.match(/(?:reference|ref(?:erence)?)[:\s]+([^\n\r,·]{2,30})/i);
  const ref = refMatch ? refMatch[1].trim() : '';

  // Invoice number
  const invMatch = text.match(/(?:invoice|inv)(?:\s+(?:id|no|num(?:ber)?)?)[:\s#]*([A-Z0-9-]{4,20})/i) || filename.match(/(\d{8,})/);
  const invoiceRef = invMatch ? 'Invoice #' + invMatch[1] : '';

  // Vendor name — look for FROM section or first long line
  let vendorName = '';
  const fromMatch = text.match(/\bFROM\b\s*\n?\s*([^\n\r]{4,60})/i);
  if (fromMatch) vendorName = fromMatch[1].trim();
  if (!vendorName) vendorName = lines.find(l => l.length > 4 && l.length < 60 && !/invoice|date|phone|email|from|to|for|ref|dear|thank/i.test(l)) || '';

  // Contact
  const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  const phoneMatch = text.match(/(\+27[\s\d]{9,12}|0[6-8]\d[\s\d]{7,9})/);
  const contact = [emailMatch?.[1], phoneMatch?.[1]].filter(Boolean).join(' · ');

  return { vendorName: vendorName.replace(/[^\w\s&.'"()-]/g,'').trim(), total: total ? 'R ' + total.toLocaleString('en-ZA', { maximumFractionDigits: 0 }) : '', contact, deposit, depositDue, finalPayment, finalDue, bankDetails, ref, invoiceRef, allDates, allAmounts };
}
function populateInvoiceModal(p, rawText) {
  document.getElementById('iName').value = p.vendorName;
  document.getElementById('iContact').value = p.contact;
  document.getElementById('iTotal').value = p.total;
  document.getElementById('iDeposit').value = p.deposit;
  document.getElementById('iDepositDue').value = p.depositDue;
  document.getElementById('iFinal').value = p.finalPayment;
  document.getElementById('iFinalDue').value = p.finalDue;
  document.getElementById('iBankDetails').value = p.bankDetails;
  document.getElementById('iRef').value = p.invoiceRef;
  document.getElementById('iNotes').value = '';
  // Show a snippet of raw text
  const snippet = escHtml(rawText.replace(/\s+/g,' ').slice(0, 300));
  document.getElementById('scanRawPreview').innerHTML = `<strong style="font-size:0.68rem;letter-spacing:1px;text-transform:uppercase;color:var(--gold)">Extracted text preview</strong><br><span style="font-family:monospace;font-size:0.72rem">${snippet}…</span>`;
}
function saveScannedInvoice() {
  const name = document.getElementById('iName').value.trim();
  if (!name) { showToast('Please enter the vendor name'); return; }
  const dep = document.getElementById('iDeposit').value.trim();
  const fin = document.getElementById('iFinal').value.trim();
  const supplier = {
    id: Date.now(), name,
    category: document.getElementById('iCategory').value,
    contact: document.getElementById('iContact').value.trim(),
    price: document.getElementById('iTotal').value.trim(),
    status: 'pending', preferred: false,
    notes: document.getElementById('iNotes').value.trim(),
    deposit: dep || undefined, depositDue: document.getElementById('iDepositDue').value || undefined, depositPaid: false,
    finalPayment: fin || undefined, finalPaymentDue: document.getElementById('iFinalDue').value || undefined, finalPaymentPaid: false,
    bankDetails: document.getElementById('iBankDetails').value.trim() || undefined,
    invoiceRef: document.getElementById('iRef').value.trim() || undefined,
  };
  state.suppliers.push(supplier);
  save(); closeModal('invoiceModal'); renderBudget(); renderSuppliers();
  showToast('Vendor added from invoice ✦');
}

// Drag-and-drop for invoice zone
const zone = document.getElementById('invoiceZone');
if (zone) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') handleInvoiceUpload({ files: [file], value: '' });
    else showToast('Please drop a PDF file');
  });
}

// ── Timeline ───────────────────────────────────────────────────────────────
let tlActiveDay = 'mg';
function setTimelineDay(day) {
  tlActiveDay = day;
  document.querySelectorAll('.day-tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('day-tab-' + day);
  if (btn) btn.classList.add('active');
  renderTimeline();
}
function fmtDur(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h && m ? h + 'h ' + m + 'min' : h ? h + 'h' : m + 'min';
}
function renderTimeline() {
  const list = document.getElementById('tlList');
  const stats = document.getElementById('tlStats');
  if (!list) return;
  const events = state.timeline.filter(e => e.day === tlActiveDay).sort((a,b) => a.time.localeCompare(b.time));
  const totalMins = events.reduce((s,e) => s + (parseInt(e.duration)||0), 0);
  stats.innerHTML = `
    <div class="tl-stat"><strong>${events.length}</strong> events</div>
    <div class="tl-stat"><strong>${fmtDur(totalMins)||'—'}</strong> total time</div>
    ${events.length ? `<div class="tl-stat"><strong>${events[0].time}</strong> first event</div><div class="tl-stat"><strong>${events[events.length-1].time}</strong> last event</div>` : ''}
  `;
  if (!events.length) {
    list.innerHTML = '<div class="tl-empty">No events yet — click “+ Add Event” to build this day’s schedule</div>';
    return;
  }
  list.innerHTML = events.map(ev => {
    const cat = TIMELINE_CATEGORIES[ev.category] || TIMELINE_CATEGORIES.logistics;
    return `<div class="tl-event">
      <div class="tl-time">${ev.time}</div>
      <div class="tl-dot" style="background:${cat.color};box-shadow:0 0 0 2px ${cat.color}40"></div>
      <div class="tl-card" style="border-left-color:${cat.color}">
        <div class="tl-card-top">
          <div class="tl-title">${ev.title}</div>
          <div class="tl-actions">
            <button class="tl-btn" onclick="openEventModal(${ev.id},'${tlActiveDay}')" title="Edit">✎</button>
            <button class="tl-btn" onclick="deleteEvent(${ev.id})" title="Remove">✕</button>
          </div>
        </div>
        <div class="tl-meta">
          <span class="tl-cat-tag" style="background:${cat.color}">${cat.label}</span>
          ${ev.duration ? `<span class="tl-dur">${fmtDur(parseInt(ev.duration))}</span>` : ''}
        </div>
        ${ev.location ? `<div class="tl-loc">📍 ${ev.location}</div>` : ''}
        ${ev.notes ? `<div class="tl-notes">${ev.notes}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}
function openEventModal(id, dayId) {
  state.editingEventId = id || null;
  const ev = id ? state.timeline.find(e => e.id === id) : null;
  document.getElementById('eventModalTitle').textContent = ev ? 'Edit Event' : 'Add Event';
  document.getElementById('eDay').value = ev ? ev.day : (dayId || 'wed');
  document.getElementById('eCategory').value = ev ? (ev.category || 'logistics') : 'logistics';
  document.getElementById('eTime').value = ev ? ev.time : '';
  document.getElementById('eDuration').value = ev ? (ev.duration || '') : '';
  document.getElementById('eTitle').value = ev ? ev.title : '';
  document.getElementById('eLocation').value = ev ? (ev.location || '') : '';
  document.getElementById('eNotes').value = ev ? (ev.notes || '') : '';
  document.getElementById('eventModal').classList.add('open');
}
function saveEvent() {
  const time = document.getElementById('eTime').value;
  const title = document.getElementById('eTitle').value.trim();
  if (!time || !title) { showToast('Time and event name are required'); return; }
  const ev = {
    id: state.editingEventId || Date.now(),
    day: document.getElementById('eDay').value || 'wed',
    category: document.getElementById('eCategory').value || 'logistics',
    time, title,
    location: document.getElementById('eLocation').value.trim(),
    notes: document.getElementById('eNotes').value.trim(),
    duration: parseInt(document.getElementById('eDuration').value) || 0
  };
  if (state.editingEventId) {
    const idx = state.timeline.findIndex(e => e.id === state.editingEventId);
    if (idx !== -1) state.timeline[idx] = ev; else state.timeline.push(ev);
  } else {
    state.timeline.push(ev);
  }
  state.editingEventId = null;
  save(); closeModal('eventModal'); renderTimeline(); showToast('Event saved ✦');
}
function deleteEvent(id) {
  if (!confirm('Remove this event?')) return;
  state.timeline = state.timeline.filter(e => e.id !== id);
  save(); renderTimeline();

}

// ── Checklist ──────────────────────────────────────────────────────────────
function renderChecklist() {
  const allItems = Object.values(state.checklist).flat();
  const done = allItems.filter(t => t.done).length;
  document.getElementById('checklistProgress').textContent = `${done} of ${allItems.length} tasks complete`;
  let html = '';
  for (const [section, items] of Object.entries(state.checklist)) {
    const secDone = items.filter(t => t.done).length;
    html += `<div class="cl-section"><div class="cl-hd">${section}<span class="cl-prog">${secDone}/${items.length}</span></div>`;
    html += items.map((t, i) => `
      <div class="cl-item">
        <input type="checkbox" id="cl_${section}_${i}" ${t.done ? 'checked' : ''} onchange="toggleCheck('${section.replace(/'/g,"\\'")}',${i},this.checked)">
        <label for="cl_${section}_${i}">${t.text}</label>
      </div>`).join('');
    html += '</div>';
  }
  document.getElementById('checklistOutput').innerHTML = html;
}
function toggleCheck(section, idx, done) {
  if (state.checklist[section] && state.checklist[section][idx] !== undefined) {
    state.checklist[section][idx].done = done;
    save();
    // update progress
    const allItems = Object.values(state.checklist).flat();
    const doneCount = allItems.filter(t => t.done).length;
    document.getElementById('checklistProgress').textContent = `${doneCount} of ${allItems.length} tasks complete`;
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }

// ── Image hover zoom ──────────────────────────────────────────────────────────
(function() {
  var zoom = document.getElementById('imgZoom');
  var zoomImg = document.getElementById('imgZoomImg');
  if (!zoom || !zoomImg) return;
  var active = false;

  function findThumbWrap(el) {
    return el.closest && (el.closest('.cat-thumb-wrap') || el.closest('.rental-thumb-wrap'));
  }
  function getThumbSrc(wrap) {
    var img = wrap.querySelector('.cat-thumb,.rental-thumb');
    return img ? img.src : '';
  }

  document.addEventListener('mouseover', function(e) {
    var wrap = findThumbWrap(e.target);
    if (!wrap) return;
    var src = getThumbSrc(wrap);
    if (!src) return;
    zoomImg.src = src;
    active = true;
    zoom.style.display = 'block';
  });

  document.addEventListener('mouseout', function(e) {
    var wrap = findThumbWrap(e.target);
    if (!wrap) return;
    if (!wrap.contains(e.relatedTarget)) {
      active = false;
      zoom.style.display = 'none';
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (!active) return;
    var w = zoom.offsetWidth || 380;
    var h = zoom.offsetHeight || 380;
    var x = e.clientX + 28;
    var y = e.clientY - Math.round(h / 2);
    if (x + w > window.innerWidth - 10) x = e.clientX - w - 28;
    if (y < 10) y = 10;
    if (y + h > window.innerHeight - 10) y = window.innerHeight - h - 10;
    zoom.style.left = x + 'px';
    zoom.style.top  = y + 'px';
  });
})();

// ══════════════════════════════════════════════════════════════════════════════
// FLOOR PLANS  ·  ROOMING LIST  ·  LAYOUT PLANNER  ·  PAY  ·  RSVP LINK
// (Wave: couple-portal additions — every feature guards on its injected global
//  so the Pat-Busch static fallback and dev mode keep working unchanged.)
// ══════════════════════════════════════════════════════════════════════════════

// ── Floor Plans tab (read-only image grid) ─────────────────────────────────
// Sources: venue floor-plan media (window.VENUE_FLOORPLANS, kind='floorplan'),
// any gallery items tagged floorplan/layout, plus per-room floorPlan images.
function renderFloorPlans() {
  const out = document.getElementById('floorplansOutput');
  if (!out) return;

  const cards = [];

  // 1) Dedicated venue floor-plan / layout media assets.
  (Array.isArray(window.VENUE_FLOORPLANS) ? window.VENUE_FLOORPLANS : []).forEach(function(fp) {
    if (!fp || !fp.src) return;
    cards.push({ src: fp.src, caption: fp.label || fp.category || 'Floor plan' });
  });

  // 2) Gallery images explicitly categorised as floorplan/layout (defensive —
  //    most floorplans arrive via VENUE_FLOORPLANS above, but a venue may have
  //    tagged a normal photo's category as "Floor plan" / "Layout").
  (Array.isArray(window.VENUE_GALLERY) ? window.VENUE_GALLERY : []).forEach(function(m) {
    if (!m || !m.src || m.kind === 'video') return;
    const cat = String(m.category || '').toLowerCase();
    if (cat.indexOf('floor') !== -1 || cat.indexOf('layout') !== -1) {
      cards.push({ src: m.src, caption: m.label || m.category || 'Layout' });
    }
  });

  // 3) Per-room floor plans (rooms already injected for Accommodation).
  (Array.isArray(ACCOMMODATION) ? ACCOMMODATION : []).forEach(function(room) {
    if (room && room.floorPlan) {
      cards.push({ src: room.floorPlan, caption: (room.name || 'Room') + ' — floor plan' });
    }
  });

  if (!cards.length) {
    out.innerHTML = '<div class="card" style="text-align:center;color:var(--text-light);font-style:italic;padding:30px">No floor plans have been shared yet. Your venue can upload layouts and room plans here — check back soon, or ask your coordinator.</div>';
    return;
  }

  out.innerHTML = '<div class="venue-gallery">' + cards.map(function(c) {
    return '<div class="gallery-slot" onclick="openFloorPlanZoom(' + escHtml(JSON.stringify(c.src)) + ')" style="cursor:zoom-in">' +
      '<img src="' + escHtml(c.src) + '" alt="' + escHtml(c.caption) + '">' +
      '<div style="position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 7px;border-radius:99px">' + escHtml(c.caption) + '</div>' +
    '</div>';
  }).join('') + '</div>';
}
function openFloorPlanZoom(src) {
  const zoom = document.getElementById('imgZoom');
  const zoomImg = document.getElementById('imgZoomImg');
  if (!zoom || !zoomImg || !src) return;
  zoomImg.src = src;
  zoom.style.display = 'block';
  zoom.style.left = '50%';
  zoom.style.top = '50%';
  zoom.style.transform = 'translate(-50%,-50%)';
  // Dismiss on next click anywhere.
  const dismiss = function() {
    zoom.style.display = 'none';
    zoom.style.transform = '';
    document.removeEventListener('click', dismiss, true);
  };
  setTimeout(function() { document.addEventListener('click', dismiss, true); }, 0);
}

// ── Rooming List tab (read-only summary of room assignments) ────────────────
function renderRooming() {
  const out = document.getElementById('roomingOutput');
  if (!out) return;

  const assignments = state.roomAssignments || {};
  const placed = new Set(Object.values(assignments).flat());
  const unassigned = (state.guests || []).filter(function(g) { return !placed.has(g); });

  // Stat strip mirrors the Guest List tab's look.
  const totalGuests = (state.guests || []).length;
  const totalCap = (Array.isArray(ACCOMMODATION) ? ACCOMMODATION : []).reduce(function(a, r) { return a + (r.sleeps || 0); }, 0);
  let html = '<div class="guest-stats">' + [
    { val: placed.size, lbl: 'Guests housed' },
    { val: unassigned.length, lbl: 'Not yet placed' },
    { val: totalGuests || '—', lbl: 'Total guests' },
    { val: totalCap || '—', lbl: 'Total capacity' }
  ].map(function(s) { return '<div class="guest-stat"><div class="guest-stat-val">' + s.val + '</div><div class="guest-stat-lbl">' + s.lbl + '</div></div>'; }).join('') + '</div>';

  // Only show rooms that actually have someone in them, but always show the grid.
  const occupiedRooms = (Array.isArray(ACCOMMODATION) ? ACCOMMODATION : []).filter(function(room) {
    return (assignments[room.id] || []).length > 0;
  });

  if (!occupiedRooms.length && !unassigned.length) {
    out.innerHTML = html + '<div class="card" style="text-align:center;color:var(--text-light);font-style:italic;padding:30px">No guests assigned to rooms yet. Add guests on the Guest List tab, then place them on the Accommodation tab — they\'ll appear here automatically.</div>';
    return;
  }

  if (occupiedRooms.length) {
    html += '<div class="accom-grid">' + occupiedRooms.map(function(room) {
      const guests = assignments[room.id] || [];
      return '<div class="accom-card">' +
        '<div class="accom-hd">' +
          '<div>' +
            '<div class="accom-name">' + escHtml(room.name) + '</div>' +
            '<div class="accom-meta"><span class="accom-meta-item">👥 ' + guests.length + ' / ' + room.sleeps + ' guests</span></div>' +
          '</div>' +
          '<span class="accom-type-tag">' + escHtml(room.type || 'Room') + '</span>' +
        '</div>' +
        '<div class="accom-body">' +
          '<div class="guest-chips">' + guests.map(function(g) {
            return '<div class="gchip" style="display:inline-flex;align-items:center;gap:3px">' + getDietaryDot(g) + '<span>' + escHtml(g) + '</span></div>';
          }).join('') + '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  // Unassigned guests block.
  if (unassigned.length) {
    html += '<div class="card" style="margin-top:18px">' +
      '<div class="info-label" style="margin-bottom:8px">Not yet placed (' + unassigned.length + ')</div>' +
      '<div class="guest-chips">' + unassigned.map(function(g) {
        return '<div class="gchip" style="display:inline-flex;align-items:center;gap:3px">' + getDietaryDot(g) + '<span>' + escHtml(g) + '</span></div>';
      }).join('') + '</div>' +
      '<div style="font-size:0.78rem;color:var(--text-light);margin-top:10px">Head to the <strong>Accommodation</strong> tab to assign these guests to a room.</div>' +
    '</div>';
  }

  out.innerHTML = html;
}

// ── Layout Planner tab (notes + simple table list, persisted in state.layout) ─
let _layoutNotesTimer = null;
function onLayoutNotesInput(el) {
  if (!state.layout) state.layout = { notes: '', tables: [] };
  state.layout.notes = el.value;
  // Debounce so every keystroke doesn't fire a server PUT.
  clearTimeout(_layoutNotesTimer);
  _layoutNotesTimer = setTimeout(function() { save(); }, 400);
}
function renderLayout() {
  if (!state.layout) state.layout = { notes: '', tables: [] };
  const notesEl = document.getElementById('layoutNotes');
  if (notesEl && notesEl.value !== state.layout.notes) notesEl.value = state.layout.notes || '';

  const out = document.getElementById('layoutTablesOutput');
  if (!out) return;

  const tables = Array.isArray(state.layout.tables) ? state.layout.tables : [];
  const totalSeats = tables.reduce(function(a, t) { return a + (parseInt(t.seats, 10) || 0); }, 0);

  let html = '';
  if (tables.length) {
    html += '<div class="guest-stats" style="margin-bottom:16px">' + [
      { val: tables.length, lbl: 'Tables' },
      { val: totalSeats || '—', lbl: 'Total seats' }
    ].map(function(s) { return '<div class="guest-stat"><div class="guest-stat-val">' + s.val + '</div><div class="guest-stat-lbl">' + s.lbl + '</div></div>'; }).join('') + '</div>';
  }

  if (!tables.length) {
    html += '<div class="card" style="text-align:center;color:var(--text-light);font-style:italic;padding:30px">No tables added yet. Click <strong>+ Add Table</strong> to start sketching your reception layout.</div>';
  } else {
    html += tables.map(function(t, i) {
      return '<div class="card" style="margin-bottom:12px;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">' +
        '<div style="flex:2;min-width:160px">' +
          '<div class="info-label" style="margin-bottom:4px">Table name</div>' +
          '<input type="text" value="' + escHtml(t.name || '') + '" placeholder="e.g. Sweetheart / Table 1" oninput="updateLayoutTable(' + i + ',\'name\',this.value)" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-family:\'Jost\',sans-serif;font-size:0.85rem;outline:none;box-sizing:border-box">' +
        '</div>' +
        '<div style="flex:1;min-width:90px">' +
          '<div class="info-label" style="margin-bottom:4px">Seats</div>' +
          '<input type="number" min="0" max="100" value="' + (t.seats != null ? escHtml(String(t.seats)) : '') + '" placeholder="8" oninput="updateLayoutTable(' + i + ',\'seats\',this.value)" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-family:\'Jost\',sans-serif;font-size:0.85rem;outline:none;box-sizing:border-box">' +
        '</div>' +
        '<div style="flex:3;min-width:200px">' +
          '<div class="info-label" style="margin-bottom:4px">Notes</div>' +
          '<input type="text" value="' + escHtml(t.note || '') + '" placeholder="e.g. near the dance floor, family side" oninput="updateLayoutTable(' + i + ',\'note\',this.value)" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-family:\'Jost\',sans-serif;font-size:0.85rem;outline:none;box-sizing:border-box">' +
        '</div>' +
        '<button class="btn btn-danger btn-sm" style="align-self:center;font-size:0.65rem;margin-top:18px" onclick="removeLayoutTable(' + i + ')">Remove</button>' +
      '</div>';
    }).join('');
  }
  out.innerHTML = html;
}
function addLayoutTable() {
  if (!state.layout) state.layout = { notes: '', tables: [] };
  if (!Array.isArray(state.layout.tables)) state.layout.tables = [];
  state.layout.tables.push({ name: 'Table ' + (state.layout.tables.length + 1), seats: 8, note: '' });
  save(); renderLayout();
}
function updateLayoutTable(i, field, value) {
  if (!state.layout || !Array.isArray(state.layout.tables) || !state.layout.tables[i]) return;
  if (field === 'seats') {
    const n = parseInt(value, 10);
    state.layout.tables[i].seats = isNaN(n) ? '' : Math.max(0, Math.min(100, n));
  } else {
    state.layout.tables[i][field] = value;
  }
  // Debounce — text inputs fire per keystroke.
  clearTimeout(_layoutNotesTimer);
  _layoutNotesTimer = setTimeout(function() { save(); }, 400);
}
function removeLayoutTable(i) {
  if (!state.layout || !Array.isArray(state.layout.tables)) return;
  state.layout.tables.splice(i, 1);
  save(); renderLayout();
}

// ── Pay deposit / balance (Paystack) ────────────────────────────────────────
// POSTs to /api/paystack/checkout with the wedding_id + slice; on success
// redirects to Paystack's authorization_url. Any "not configured" / error /
// network failure falls back to a friendly "ask your venue" message — never
// breaks the page.
const PAY_FALLBACK_MSG = "Online payments aren't set up for this portal yet — your venue will share their payment details with you directly.";
let _payInFlight = false;
function payVenue(slice) {
  if (_payInFlight) return;
  const which = (slice === 'balance') ? 'balance' : 'deposit';
  const noteEl = document.getElementById('payNote');
  // Without a linked wedding (static/dev mode) there's nothing to charge against.
  if (!window.WEDDING_USE_SERVER || !window.WEDDING_ID) {
    if (noteEl) noteEl.textContent = PAY_FALLBACK_MSG;
    else showToast(PAY_FALLBACK_MSG);
    return;
  }
  _payInFlight = true;
  if (noteEl) noteEl.textContent = 'Connecting to secure payment…';
  fetch('/api/paystack/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ wedding_id: window.WEDDING_ID, amount_type: which })
  })
    .then(function(r) { return r.json().catch(function() { return {}; }); })
    .then(function(data) {
      if (data && data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      // configured:false, or any structured error → friendly fallback.
      if (noteEl) noteEl.textContent = (data && data.configured === false) ? PAY_FALLBACK_MSG : (data && data.error ? data.error : PAY_FALLBACK_MSG);
      else showToast(PAY_FALLBACK_MSG);
    })
    .catch(function() {
      if (noteEl) noteEl.textContent = PAY_FALLBACK_MSG;
      else showToast(PAY_FALLBACK_MSG);
    })
    .finally(function() { _payInFlight = false; });
}
// Injects a "Pay your venue" card at the top of the Budget tab. Only rendered
// when this portal is linked to a live wedding (Paystack needs a wedding_id).
function renderPayPanel() {
  const host = document.getElementById('budgetSummary');
  if (!host) return;
  let panel = document.getElementById('payPanel');
  if (!window.WEDDING_USE_SERVER || !window.WEDDING_ID) {
    if (panel) panel.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'payPanel';
    panel.className = 'card';
    panel.style.cssText = 'margin-bottom:18px;display:flex;flex-wrap:wrap;align-items:center;gap:14px';
    host.parentNode.insertBefore(panel, host);
  }
  panel.innerHTML =
    '<div style="flex:1;min-width:200px">' +
      '<div class="info-label">Pay your venue</div>' +
      '<div style="font-size:0.82rem;color:var(--text-light);margin-top:4px">Securely pay your deposit or balance online.</div>' +
      '<div id="payNote" style="font-size:0.78rem;color:var(--sage);margin-top:6px;min-height:16px"></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-primary btn-sm" onclick="payVenue(\'deposit\')">Pay deposit</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="payVenue(\'balance\')">Pay balance</button>' +
    '</div>';
}

// ── Get RSVP link (Guest List tab) ──────────────────────────────────────────
// Reveals the public per-guest RSVP URL with Copy / WhatsApp / QR. The
// /[wedding]/rsvp public form already exists; we just build & share the link.
function rsvpUrl() {
  const slug = window.WEDDING_SLUG || '';
  if (!slug) return '';
  return window.location.origin + '/' + slug + '/rsvp';
}
function toggleRsvpLink() {
  const box = document.getElementById('rsvpLinkBox');
  if (!box) return;
  if (box.style.display === 'none' || !box.style.display) { box.style.display = 'block'; renderRsvpLink(); }
  else { box.style.display = 'none'; }
}
function renderRsvpLink() {
  const box = document.getElementById('rsvpLinkBox');
  if (!box) return;
  const url = rsvpUrl();
  if (!url) {
    box.innerHTML = '<div style="font-size:0.8rem;color:var(--text-light);font-style:italic">An RSVP link will appear here once your portal is fully set up by your venue.</div>';
    return;
  }
  const couple = (VENUE.couple.name1 || '') + (VENUE.couple.name2 ? ' & ' + VENUE.couple.name2 : '');
  const waText = encodeURIComponent("You're invited to " + couple + "'s wedding! Please RSVP here: " + url);
  const waLink = 'https://wa.me/?text=' + waText;
  const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(url);
  box.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">' +
      '<div style="flex:1;min-width:220px">' +
        '<div class="info-label" style="margin-bottom:6px">Share this RSVP link with your guests</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<input id="rsvpLinkInput" type="text" readonly value="' + escHtml(url) + '" onclick="this.select()" style="flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-family:\'Jost\',sans-serif;font-size:0.8rem;outline:none;background:var(--cream)">' +
          '<button class="btn btn-primary btn-sm" onclick="copyRsvpLink()">Copy</button>' +
          '<a class="btn btn-secondary btn-sm" href="' + waLink + '" target="_blank" rel="noopener" style="text-decoration:none">WhatsApp</a>' +
        '</div>' +
        '<div style="font-size:0.74rem;color:var(--text-light);margin-top:8px">Each guest fills in their own attendance, meal and song requests. Responses flow back to your venue.</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<img src="' + qrSrc + '" alt="RSVP QR code" width="160" height="160" style="border:1px solid var(--border);border-radius:8px;background:#fff;padding:4px">' +
        '<div style="font-size:0.68rem;color:var(--text-light);margin-top:4px">Scan to RSVP</div>' +
      '</div>' +
    '</div>';
}
function copyRsvpLink() {
  const url = rsvpUrl();
  if (!url) return;
  const done = function() { showToast('RSVP link copied ✦'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(function() {
      const inp = document.getElementById('rsvpLinkInput');
      if (inp) { inp.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
    });
  } else {
    const inp = document.getElementById('rsvpLinkInput');
    if (inp) { inp.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
(function init() {
  load();
  // Header
  document.getElementById('hVenueName').textContent = VENUE.name;
  document.getElementById('hName1').textContent = VENUE.couple.name1;
  document.getElementById('hName2').textContent = VENUE.couple.name2;
  document.getElementById('hDate').textContent = VENUE.couple.displayDate;
  document.title = `${VENUE.couple.name1} & ${VENUE.couple.name2} — ${VENUE.name}`;
  // Lock screen (server gate is authoritative; this just keeps the static
  // template neutral and branded to the real couple/venue/date).
  var _lockCouple = document.getElementById('lockCoupleName');
  if (_lockCouple) _lockCouple.textContent = VENUE.couple.name1 + ' & ' + VENUE.couple.name2;
  var _lockVenue = document.getElementById('lockVenueLine');
  if (_lockVenue) _lockVenue.textContent = VENUE.couple.displayDate + '  ·  Wedding Portal';
  var _lockLogoName = document.getElementById('lockLogoName');
  if (_lockLogoName) _lockLogoName.textContent = (VENUE.name || '').toUpperCase();
  var _lockHintEmail = document.getElementById('lockHintEmail');
  if (_lockHintEmail && VENUE.email) { _lockHintEmail.textContent = VENUE.email; _lockHintEmail.href = 'mailto:' + VENUE.email; }
  var _lockFooter = document.getElementById('lockFooter');
  if (_lockFooter) _lockFooter.textContent = VENUE.name;
  updateCountdown();
  setInterval(updateCountdown, 30000);
  // Initial renders
  renderDashboard();
  // renderCatalogue() intentionally not called here — lazy-loaded on tab click
  // to avoid blocking init with 45 embedded images
})();


// ── Portal Access Code ────────────────────────────────────────────
// Legacy in-browser lock REMOVED — server-side password gate at /[wedding]
// route.ts is now the single source of truth. Auto-dismiss any stale lock screen.
function tryUnlock() {
  const screen = document.getElementById('lockScreen');
  if (screen) screen.style.display = 'none';
}
(function() {
  const s = document.getElementById('lockScreen');
  if (s) s.style.display = 'none';
})();

// ── Mobile Nav ────────────────────────────────────────────────────
function toggleMobileNav(btn) {
  const nav = document.getElementById('mainNav');
  nav.classList.toggle('open');
  const spans = btn.querySelectorAll('span');
  if (nav.classList.contains('open')) {
    spans[0].style.transform = 'translateY(7px) rotate(45deg)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
  } else {
    spans.forEach(s => { s.style.transform=''; s.style.opacity=''; });
  }
}

// Close mobile nav when a tab is selected
const _origShowTab = showTab;
window.showTab = function(name, btn) {
  _origShowTab(name, btn);
  const nav = document.getElementById('mainNav');
  if (nav) nav.classList.remove('open');
  const hbSpans = document.querySelectorAll('.hamburger span');
  hbSpans.forEach(s => { s.style.transform=''; s.style.opacity=''; });
};

// ── Key Deadlines ─────────────────────────────────────────────────
function renderDeadlines() {
  const weddingDate = new Date(VENUE.couple.date + 'T00:00:00');
  const now = new Date();
  now.setHours(0,0,0,0);

  function daysAway(d) { return Math.round((d - now) / 86400000); }
  function fmtD(d) {
    return d.toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
  }
  function addMonths(d, m) { const r=new Date(d); r.setMonth(r.getMonth()-m); return r; }
  function addWeeks(d, w)  { const r=new Date(d); r.setDate(r.getDate()-(w*7)); return r; }

  const venueName = VENUE.name || 'your venue';
  const deadlines = [
    { label: 'Confirm catering & bar supplier with ' + venueName, date: addMonths(weddingDate,9) },
    { label: 'Send save-the-dates to guests',                     date: addMonths(weddingDate,9) },
    { label: 'Confirm all vendor bookings & deposits',            date: addMonths(weddingDate,6) },
    { label: 'Submit rental selections to ' + venueName,          date: addMonths(weddingDate,3), action: "openSubmitModal('rentals')" },
    { label: 'Submit catalogue day-selections to ' + venueName,   date: addMonths(weddingDate,3), action: "openSubmitModal('catalogue')" },
    { label: 'Book accommodation for all overnight guests',       date: addMonths(weddingDate,3) },
    { label: 'Pay balance of venue fee',                          date: addWeeks(weddingDate,2) },
    { label: 'Venue walkthrough with coordinator',                date: addWeeks(weddingDate,2) },
    { label: 'Confirm final headcount with caterer',              date: addWeeks(weddingDate,2) },
    { label: 'Receive access details from ' + venueName,          date: addWeeks(weddingDate,2) },
    { label: 'Brief bridal party & vendors on day-of timeline',   date: addWeeks(weddingDate,1) },
    { label: 'Pack & deliver décor items to venue',               date: addWeeks(weddingDate,1) },
  ];

  const rows = deadlines.map(dl => {
    const d = daysAway(dl.date);
    const past = d < 0;
    const soon = d >= 0 && d <= 60;
    const statusClass = past ? 'past' : soon ? 'soon' : 'ok';
    const dateLabel = past
      ? `<span class="deadline-date overdue">${fmtD(dl.date)} — done?</span>`
      : soon
        ? `<span class="deadline-date soon">${fmtD(dl.date)} · ${d}d</span>`
        : `<span class="deadline-date">${fmtD(dl.date)}</span>`;
    const actionBtn = dl.action ? `<button onclick="${dl.action}" style="font-size:0.68rem;padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--sage);margin-left:6px" class="btn btn-secondary">Send now</button>` : '';
    return `<div class="deadline-row">
      <div class="deadline-dot ${statusClass}"></div>
      <div class="deadline-label${past?' past':''}">${dl.label}${actionBtn}</div>
      ${dateLabel}
    </div>`;
  });

  const el = document.getElementById('dashDeadlines');
  if (!el) return;
  el.innerHTML = `<div class="deadlines-panel">
    <div class="deadlines-title">📅 Key Dates & Action Items</div>
    ${rows.join('')}
  </div>`;
}

// ── Contact / Coordinator Panel ───────────────────────────────────
function renderContactPanel() {
  const el = document.getElementById('dashContact');
  if (!el) return;
  const couple = VENUE.couple;
  const venueName = VENUE.name;
  const phoneDigits = (VENUE.phone || '').replace(/[^0-9]/g, '');
  const subject = encodeURIComponent('Wedding Enquiry — ' + couple.name1 + ' & ' + couple.name2 + ' · ' + couple.displayDate);
  const body = encodeURIComponent('Hi ' + venueName + ' team,\n\nI have a question regarding our wedding booking on ' + couple.displayDate + '.\n\n[Your question here]\n\nKind regards,\n' + couple.name1);
  const waMsg = encodeURIComponent('Hi, I have a question about my wedding at ' + venueName + ' on ' + couple.displayDate + ' (' + couple.name1 + ' & ' + couple.name2 + ')');
  const avatar = (venueName || 'V').trim().charAt(0).toUpperCase();
  el.innerHTML = `<div class="contact-panel" style="margin-bottom:18px">
    <div class="contact-panel-title">Your Venue Coordinator</div>
    <div class="contact-coordinator">
      <div class="contact-avatar">${escHtml(avatar)}</div>
      <div>
        <div class="contact-name">${escHtml(venueName)} Team</div>
        <div class="contact-role">Wedding Coordination</div>
      </div>
    </div>
    <div class="contact-actions">
      ${VENUE.email ? `<a href="mailto:${escHtml(VENUE.email)}?subject=${subject}&body=${body}" class="contact-btn contact-btn-primary">📧 Email Us</a>` : ''}
      ${phoneDigits ? `<a href="https://wa.me/${phoneDigits}?text=${waMsg}" target="_blank" class="contact-btn contact-btn-ghost">💬 WhatsApp</a>` : ''}
      ${VENUE.phone ? `<a href="tel:${escHtml((VENUE.phone||'').replace(/\s/g,''))}" class="contact-btn contact-btn-ghost">📞 Call</a>` : ''}
      ${VENUE.website ? `<a href="${escHtml(VENUE.website)}" target="_blank" class="contact-btn contact-btn-ghost">🌐 Website</a>` : ''}
    </div>
  </div>`;
}

// ── Submit to Pat Busch ───────────────────────────────────────────
let _submitModalText = '';

function openSubmitModal(type) {
  const couple = VENUE.couple;
  let bodyHtml = '';
  let subject = '';
  let plainText = 'Wedding: ' + couple.name1 + ' & ' + couple.name2 + ' · ' + couple.displayDate + '\n\n';

  if (type === 'rentals') {
    subject = 'Rental Order — ' + couple.name1 + ' & ' + couple.name2 + ' · ' + couple.displayDate;
    const selected = Object.entries(state.rentalSelections || {}).filter(([,s]) => s.sel);
    if (!selected.length) {
      bodyHtml = '<div class="submit-empty">No rental items selected yet. Go to the Rentals tab to tick items you need.</div>';
    } else {
      let totalCost = 0;
      const rows = selected.map(([code, s]) => {
        const item = (window.RENTAL_ITEMS_FLAT || []).find(r => r.code === code);
        if (!item) return '';
        const days = [s.mg?'M&G':'', s.wed?'Wed':'', s.fb?'FB':''].filter(Boolean);
        const qty = s.qty || 1;
        const rate = parseMoney(item.ratePerDay || '0');
        const cost = rate * days.length * qty;
        totalCost += cost;
        plainText += '• ' + item.name + ' (x' + qty + ') — Days: ' + (days.join(', ')||'none') + ' — R' + (cost||'TBC') + '\n';
        return `<div class="submit-item-row"><span>${item.name} <span style="color:var(--text-light)">(×${qty})</span></span><div style="text-align:right"><div>${days.length ? fmt(cost) : '—'}</div><div class="submit-item-days">${days.join(' · ')||'No days selected'}</div></div></div>`;
      }).filter(Boolean);
      bodyHtml = `<div class="submit-section"><div class="submit-section-title">Selected Rental Items</div>${rows.join('')}<div class="submit-total-row"><span>Estimated Total</span><span>${fmt(totalCost)}</span></div></div>`;
      plainText += '\nEstimated Total: ' + fmt(totalCost);
    }
    document.getElementById('submitModalTitle').textContent = '📧 Submit Rental Order';
  } else {
    subject = 'Catalogue Day Selections — ' + couple.name1 + ' & ' + couple.name2 + ' · ' + couple.displayDate;
    const selected = Object.entries(state.catalogueSelections || {}).filter(([,s]) => s.sel || s.mg || s.wed || s.fb);
    if (!selected.length) {
      bodyHtml = '<div class="submit-empty">No catalogue items ticked yet. Go to the Catalogue tab to tick items and choose which days you need them.</div>';
    } else {
      const rows = selected.map(([code, s]) => {
        const item = CATALOGUE_ITEMS.find(i => i.code === code);
        if (!item) return '';
        const days = [s.mg?'M&G':'', s.wed?'Wed':'', s.fb?'FB':''].filter(Boolean);
        plainText += '• ' + item.name + ' (' + code + ') — Days: ' + (days.join(', ')||'Wed') + '\n';
        return `<div class="submit-item-row"><span>${item.name} <span style="color:var(--text-light)">${code}</span></span><div class="submit-item-days">${days.join(' · ')||'Wedding day'}</div></div>`;
      }).filter(Boolean);
      bodyHtml = `<div class="submit-section"><div class="submit-section-title">Catalogue Items — Day Selections</div>${rows.join('')}</div>`;
    }
    document.getElementById('submitModalTitle').textContent = '📧 Send Catalogue Selections';
  }

  plainText += '\n\nPlease confirm receipt.\nThank you!\n' + couple.name1;
  _submitModalText = plainText;

  document.getElementById('submitModalBody').innerHTML = bodyHtml;
  const mailBody = encodeURIComponent(plainText);
  const mailtoBtn = document.getElementById('submitMailtoBtn');
  if (mailtoBtn) {
    mailtoBtn.href = (VENUE.email ? 'mailto:' + VENUE.email : 'mailto:') + '?subject=' + encodeURIComponent(subject) + '&body=' + mailBody;
  }
  document.getElementById('submitModal').classList.add('open');
}

function copySubmitText() {
  navigator.clipboard.writeText(_submitModalText).then(() => showToast('Copied to clipboard ✦'));
}

// Server-backed submit: posts the current state to the venue. Pass 2b.
let _submitKind = 'catalogue';
function openSubmitModalWithKind(type) {
  _submitKind = type;
  openSubmitModal(type);
}
async function sendSubmissionToVenue() {
  if (!window.WEDDING_SLUG) { showToast('Cannot submit — no wedding linked'); return; }
  const btn = document.getElementById('submitToVenueBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const totals = _computeSubmissionTotals(_submitKind);
    const res = await fetch('/api/wedding/' + encodeURIComponent(window.WEDDING_SLUG) + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ kind: _submitKind, state: state, totals: totals, message: null }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || ('HTTP ' + res.status));
    }
    showToast('Sent to your venue ✦');
    document.getElementById('submitModal').classList.remove('open');
  } catch(e) {
    showToast('Could not send: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send to venue'; }
  }
}
function _computeSubmissionTotals(kind) {
  if (kind === 'rentals') {
    const selected = Object.entries(state.rentalSelections || {}).filter(([,s]) => s.sel);
    let total = 0; let count = 0;
    selected.forEach(([code, s]) => {
      const item = RENTAL_ITEMS.find(r => r.code === code);
      if (!item) return;
      const days = [s.mg, s.wed, s.fb].filter(Boolean).length || 1;
      total += (Number(item.rate) || 0) * days * (s.qty || 1);
      count++;
    });
    return { count: count, totalZAR: total };
  }
  if (kind === 'catalogue') {
    const selected = Object.entries(state.catalogueSelections || {}).filter(([,s]) => s.sel || s.mg || s.wed || s.fb);
    return { count: selected.length };
  }
  return {};
}

// ── Patch renderDashboard to also render new panels ───────────────
const _origRenderDashboard = renderDashboard;
renderDashboard = function() {
  _origRenderDashboard();
  renderDeadlines();
  renderContactPanel();
};

// ── Add 'rules' to renders dispatch ──────────────────────────────
// (renderRules is a no-op — static HTML)
if (typeof renders !== 'undefined') {
  renders.rules = function(){};
}

// ── Call new panels immediately (runs after renderDashboard at init) ──
renderDeadlines();
renderContactPanel();

