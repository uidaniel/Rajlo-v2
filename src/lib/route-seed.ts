/**
 * Auto-generated from the TA 2023 Route Taxi fare table PDF.
 *
 * Source: public/ROUTE TAXI FARE INCREASE 2023_updated.pdf
 * Generator: scripts/parse-ta-routes.mjs
 *
 * Do NOT hand-edit. Re-run the parser when TA publishes a new schedule.
 * Routes the parser couldn't extract cleanly (multi-line PDF rows) are
 * intentionally omitted — admin operators add those via the UI.
 */

export type SeedRoute = {
  origin: string;
  destination: string;
  parish: string | null;
  distanceKm: number;
  taFareJmd: number;
  slug: string;
};

export const TA_ROUTES_2023_SEED: SeedRoute[] = [
  {
    "origin": "Chisholm Avenue",
    "destination": "Downtown",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 6.4,
    "taFareJmd": 160,
    "slug": "chisholm-avenue-to-downtown"
  },
  {
    "origin": "Jones Town",
    "destination": "Downtown",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 4,
    "taFareJmd": 160,
    "slug": "jones-town-to-downtown"
  },
  {
    "origin": "Essex Hall",
    "destination": "Stony Hill",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 9,
    "taFareJmd": 180,
    "slug": "essex-hall-to-stony-hill"
  },
  {
    "origin": "Mount Salus",
    "destination": "Stony Hill",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 4.5,
    "taFareJmd": 140,
    "slug": "mount-salus-to-stony-hill"
  },
  {
    "origin": "Free Town",
    "destination": "Lawrence Tavern",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 10,
    "taFareJmd": 180,
    "slug": "free-town-to-lawrence-tavern"
  },
  {
    "origin": "Glengoffe",
    "destination": "Lawrence Tavern",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "glengoffe-to-lawrence-tavern"
  },
  {
    "origin": "Mount Industry",
    "destination": "Lawrence Tavern",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 14,
    "taFareJmd": 210,
    "slug": "mount-industry-to-lawrence-tavern"
  },
  {
    "origin": "Half Way Tree",
    "destination": "Maxfield Avenue",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 3,
    "taFareJmd": 130,
    "slug": "half-way-tree-to-maxfield-avenue"
  },
  {
    "origin": "Cane River",
    "destination": "Nine Miles",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 2.4,
    "taFareJmd": 150,
    "slug": "cane-river-to-nine-miles"
  },
  {
    "origin": "Tavern/ Kintyre",
    "destination": "Papine",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 5.5,
    "taFareJmd": 140,
    "slug": "tavern-kintyre-to-papine"
  },
  {
    "origin": "Mount James",
    "destination": "Golden Spring",
    "parish": "Kingston and St. Andrew",
    "distanceKm": 3.7,
    "taFareJmd": 130,
    "slug": "mount-james-to-golden-spring"
  },
  {
    "origin": "Above Rocks",
    "destination": "Bog Walk",
    "parish": "St. Catherine",
    "distanceKm": 25.7,
    "taFareJmd": 290,
    "slug": "above-rocks-to-bog-walk"
  },
  {
    "origin": "Gobay",
    "destination": "Bog Walk",
    "parish": "St. Catherine",
    "distanceKm": 16.1,
    "taFareJmd": 230,
    "slug": "gobay-to-bog-walk"
  },
  {
    "origin": "John Crow Spring",
    "destination": "Bog Walk",
    "parish": "St. Catherine",
    "distanceKm": 17,
    "taFareJmd": 230,
    "slug": "john-crow-spring-to-bog-walk"
  },
  {
    "origin": "Polly Ground",
    "destination": "Bog Walk",
    "parish": "St. Catherine",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "polly-ground-to-bog-walk"
  },
  {
    "origin": "Time And Patience",
    "destination": "Bog Walk",
    "parish": "St. Catherine",
    "distanceKm": 20,
    "taFareJmd": 250,
    "slug": "time-and-patience-to-bog-walk"
  },
  {
    "origin": "Troja",
    "destination": "Bog Walk",
    "parish": "St. Catherine",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "troja-to-bog-walk"
  },
  {
    "origin": "West Prospect",
    "destination": "Bog Walk",
    "parish": "St. Catherine",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "west-prospect-to-bog-walk"
  },
  {
    "origin": "Kellits",
    "destination": "Ewarton",
    "parish": "St. Catherine",
    "distanceKm": 12,
    "taFareJmd": 200,
    "slug": "kellits-to-ewarton"
  },
  {
    "origin": "Point Hill",
    "destination": "Ewarton",
    "parish": "St. Catherine",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "point-hill-to-ewarton"
  },
  {
    "origin": "Treadways",
    "destination": "Ewarton",
    "parish": "St. Catherine",
    "distanceKm": 12.9,
    "taFareJmd": 200,
    "slug": "treadways-to-ewarton"
  },
  {
    "origin": "Above Rocks",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 25.7,
    "taFareJmd": 290,
    "slug": "above-rocks-to-linstead"
  },
  {
    "origin": "Bermaddy",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "bermaddy-to-linstead"
  },
  {
    "origin": "Content",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 4,
    "taFareJmd": 140,
    "slug": "content-to-linstead"
  },
  {
    "origin": "Giblatore",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 3.5,
    "taFareJmd": 140,
    "slug": "giblatore-to-linstead"
  },
  {
    "origin": "Hampshire Dist.",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 32,
    "taFareJmd": 340,
    "slug": "hampshire-dist-to-linstead"
  },
  {
    "origin": "Jews Pen",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 13,
    "taFareJmd": 200,
    "slug": "jews-pen-to-linstead"
  },
  {
    "origin": "Knollis",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 20.5,
    "taFareJmd": 260,
    "slug": "knollis-to-linstead"
  },
  {
    "origin": "Mango Grove",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 7,
    "taFareJmd": 160,
    "slug": "mango-grove-to-linstead"
  },
  {
    "origin": "Mount Industry",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 8.7,
    "taFareJmd": 170,
    "slug": "mount-industry-to-linstead"
  },
  {
    "origin": "New Works",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 25.7,
    "taFareJmd": 290,
    "slug": "new-works-to-linstead"
  },
  {
    "origin": "Nutshell",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 7.6,
    "taFareJmd": 170,
    "slug": "nutshell-to-linstead"
  },
  {
    "origin": "Pollyground",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 9.7,
    "taFareJmd": 180,
    "slug": "pollyground-to-linstead"
  },
  {
    "origin": "Prospect",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 12.9,
    "taFareJmd": 200,
    "slug": "prospect-to-linstead"
  },
  {
    "origin": "Riversdale",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 7.6,
    "taFareJmd": 170,
    "slug": "riversdale-to-linstead"
  },
  {
    "origin": "Time And Patience",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 9.5,
    "taFareJmd": 180,
    "slug": "time-and-patience-to-linstead"
  },
  {
    "origin": "Victoria",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 8.7,
    "taFareJmd": 170,
    "slug": "victoria-to-linstead"
  },
  {
    "origin": "Wallens Housing",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "wallens-housing-to-linstead"
  },
  {
    "origin": "West Prospect",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "west-prospect-to-linstead"
  },
  {
    "origin": "York Street",
    "destination": "Linstead",
    "parish": "St. Catherine",
    "distanceKm": 6.4,
    "taFareJmd": 160,
    "slug": "york-street-to-linstead"
  },
  {
    "origin": "Bannister",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 7.3,
    "taFareJmd": 160,
    "slug": "bannister-to-old-harbour"
  },
  {
    "origin": "Bellas Gates",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 3.7,
    "taFareJmd": 140,
    "slug": "bellas-gates-to-old-harbour"
  },
  {
    "origin": "Browns Hall",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 4.5,
    "taFareJmd": 140,
    "slug": "browns-hall-to-old-harbour"
  },
  {
    "origin": "Ginger Ridge",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 7.7,
    "taFareJmd": 170,
    "slug": "ginger-ridge-to-old-harbour"
  },
  {
    "origin": "Longville Park",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 11.3,
    "taFareJmd": 190,
    "slug": "longville-park-to-old-harbour"
  },
  {
    "origin": "New Harbour Village",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 3,
    "taFareJmd": 130,
    "slug": "new-harbour-village-to-old-harbour"
  },
  {
    "origin": "Old Harbour Bay",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 3.8,
    "taFareJmd": 140,
    "slug": "old-harbour-bay-to-old-harbour"
  },
  {
    "origin": "Salt River",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 9.5,
    "taFareJmd": 180,
    "slug": "salt-river-to-old-harbour"
  },
  {
    "origin": "Spring Village",
    "destination": "Old Harbour",
    "parish": "St. Catherine",
    "distanceKm": 14,
    "taFareJmd": 210,
    "slug": "spring-village-to-old-harbour"
  },
  {
    "origin": "Spring Village",
    "destination": "Old Harbour Bay",
    "parish": "St. Catherine",
    "distanceKm": 8.1,
    "taFareJmd": 170,
    "slug": "spring-village-to-old-harbour-bay"
  },
  {
    "origin": "Gregory Park",
    "destination": "Portmore Mall",
    "parish": "St. Catherine",
    "distanceKm": 7,
    "taFareJmd": 160,
    "slug": "gregory-park-to-portmore-mall"
  },
  {
    "origin": "Waterford",
    "destination": "Portmore Mall",
    "parish": "St. Catherine",
    "distanceKm": 3,
    "taFareJmd": 130,
    "slug": "waterford-to-portmore-mall"
  },
  {
    "origin": "Westchester",
    "destination": "Portmore Mall",
    "parish": "St. Catherine",
    "distanceKm": 7.6,
    "taFareJmd": 170,
    "slug": "westchester-to-portmore-mall"
  },
  {
    "origin": "Avon Park",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 3.2,
    "taFareJmd": 140,
    "slug": "avon-park-to-spanish-town"
  },
  {
    "origin": "Bernard Lodge",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 4.4,
    "taFareJmd": 140,
    "slug": "bernard-lodge-to-spanish-town"
  },
  {
    "origin": "Crescent District",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 4.4,
    "taFareJmd": 140,
    "slug": "crescent-district-to-spanish-town"
  },
  {
    "origin": "Dam Head",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 3.2,
    "taFareJmd": 140,
    "slug": "dam-head-to-spanish-town"
  },
  {
    "origin": "Ebony Vale",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 6.4,
    "taFareJmd": 160,
    "slug": "ebony-vale-to-spanish-town"
  },
  {
    "origin": "Eltham View",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 2,
    "taFareJmd": 130,
    "slug": "eltham-view-to-spanish-town"
  },
  {
    "origin": "Ensom City",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 5.3,
    "taFareJmd": 150,
    "slug": "ensom-city-to-spanish-town"
  },
  {
    "origin": "Frazers Content",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "frazers-content-to-spanish-town"
  },
  {
    "origin": "Gordon Pen",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 6.3,
    "taFareJmd": 160,
    "slug": "gordon-pen-to-spanish-town"
  },
  {
    "origin": "Green Acres",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 4.2,
    "taFareJmd": 140,
    "slug": "green-acres-to-spanish-town"
  },
  {
    "origin": "Hellshire",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 3.2,
    "taFareJmd": 140,
    "slug": "hellshire-to-spanish-town"
  },
  {
    "origin": "Horizon Park",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 6.4,
    "taFareJmd": 160,
    "slug": "horizon-park-to-spanish-town"
  },
  {
    "origin": "Innswood Village",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "innswood-village-to-spanish-town"
  },
  {
    "origin": "Jobs Lane",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 5.1,
    "taFareJmd": 150,
    "slug": "jobs-lane-to-spanish-town"
  },
  {
    "origin": "Kensington District",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 4.8,
    "taFareJmd": 150,
    "slug": "kensington-district-to-spanish-town"
  },
  {
    "origin": "Keystone",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 9.7,
    "taFareJmd": 180,
    "slug": "keystone-to-spanish-town"
  },
  {
    "origin": "Lauriston",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 5.6,
    "taFareJmd": 150,
    "slug": "lauriston-to-spanish-town"
  },
  {
    "origin": "Linstead",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 9.7,
    "taFareJmd": 180,
    "slug": "linstead-to-spanish-town"
  },
  {
    "origin": "Macca Tree",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 25.5,
    "taFareJmd": 290,
    "slug": "macca-tree-to-spanish-town"
  },
  {
    "origin": "Magil Palms",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 5.8,
    "taFareJmd": 150,
    "slug": "magil-palms-to-spanish-town"
  },
  {
    "origin": "Mount Pleasant",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 26.5,
    "taFareJmd": 300,
    "slug": "mount-pleasant-to-spanish-town"
  },
  {
    "origin": "Naggo Head",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 8.1,
    "taFareJmd": 170,
    "slug": "naggo-head-to-spanish-town"
  },
  {
    "origin": "Old Harbour Bay",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 17.7,
    "taFareJmd": 240,
    "slug": "old-harbour-bay-to-spanish-town"
  },
  {
    "origin": "Sligoville",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "sligoville-to-spanish-town"
  },
  {
    "origin": "Sydenham Villa",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 7,
    "taFareJmd": 160,
    "slug": "sydenham-villa-to-spanish-town"
  },
  {
    "origin": "Tredegar Park",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 7,
    "taFareJmd": 160,
    "slug": "tredegar-park-to-spanish-town"
  },
  {
    "origin": "Victoria",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 17.7,
    "taFareJmd": 240,
    "slug": "victoria-to-spanish-town"
  },
  {
    "origin": "Waterloo Gardens",
    "destination": "Spanish Town",
    "parish": "St. Catherine",
    "distanceKm": 9,
    "taFareJmd": 180,
    "slug": "waterloo-gardens-to-spanish-town"
  },
  {
    "origin": "Coxswain",
    "destination": "Chapelton",
    "parish": "Clarendon",
    "distanceKm": 9,
    "taFareJmd": 180,
    "slug": "coxswain-to-chapelton"
  },
  {
    "origin": "Mullet Hall",
    "destination": "Chapelton",
    "parish": "Clarendon",
    "distanceKm": 4.2,
    "taFareJmd": 140,
    "slug": "mullet-hall-to-chapelton"
  },
  {
    "origin": "Crawle River",
    "destination": "Chapelton",
    "parish": "Clarendon",
    "distanceKm": 6.5,
    "taFareJmd": 160,
    "slug": "crawle-river-to-chapelton"
  },
  {
    "origin": "Rock River",
    "destination": "Chapelton",
    "parish": "Clarendon",
    "distanceKm": 14,
    "taFareJmd": 210,
    "slug": "rock-river-to-chapelton"
  },
  {
    "origin": "Thompson Town",
    "destination": "Chapelton",
    "parish": "Clarendon",
    "distanceKm": 16.6,
    "taFareJmd": 230,
    "slug": "thompson-town-to-chapelton"
  },
  {
    "origin": "Cave Valley",
    "destination": "Frankfield",
    "parish": "Clarendon",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "cave-valley-to-frankfield"
  },
  {
    "origin": "Crooked River",
    "destination": "Frankfield",
    "parish": "Clarendon",
    "distanceKm": 8.3,
    "taFareJmd": 170,
    "slug": "crooked-river-to-frankfield"
  },
  {
    "origin": "Long Look",
    "destination": "Frankfield",
    "parish": "Clarendon",
    "distanceKm": 7.1,
    "taFareJmd": 160,
    "slug": "long-look-to-frankfield"
  },
  {
    "origin": "Chapelton",
    "destination": "Kellits",
    "parish": "Clarendon",
    "distanceKm": 24.5,
    "taFareJmd": 280,
    "slug": "chapelton-to-kellits"
  },
  {
    "origin": "Crooked River",
    "destination": "Kellits",
    "parish": "Clarendon",
    "distanceKm": 16,
    "taFareJmd": 230,
    "slug": "crooked-river-to-kellits"
  },
  {
    "origin": "James Hill",
    "destination": "Kellits",
    "parish": "Clarendon",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "james-hill-to-kellits"
  },
  {
    "origin": "Longville Park",
    "destination": "Lionel Town",
    "parish": "Clarendon",
    "distanceKm": 21,
    "taFareJmd": 260,
    "slug": "longville-park-to-lionel-town"
  },
  {
    "origin": "Ashley",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 16,
    "taFareJmd": 230,
    "slug": "ashley-to-may-pen"
  },
  {
    "origin": "Banks",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 34,
    "taFareJmd": 350,
    "slug": "banks-to-may-pen"
  },
  {
    "origin": "Beckford Kraal",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 30.2,
    "taFareJmd": 320,
    "slug": "beckford-kraal-to-may-pen"
  },
  {
    "origin": "Blackwoods",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 27.5,
    "taFareJmd": 310,
    "slug": "blackwoods-to-may-pen"
  },
  {
    "origin": "Bucknor",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 3,
    "taFareJmd": 130,
    "slug": "bucknor-to-may-pen"
  },
  {
    "origin": "Bushy Park",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 8.3,
    "taFareJmd": 170,
    "slug": "bushy-park-to-may-pen"
  },
  {
    "origin": "Chapelton",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 19.3,
    "taFareJmd": 250,
    "slug": "chapelton-to-may-pen"
  },
  {
    "origin": "Chatteau",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "chatteau-to-may-pen"
  },
  {
    "origin": "Coates Pen",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "coates-pen-to-may-pen"
  },
  {
    "origin": "Ebony Park",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 13,
    "taFareJmd": 200,
    "slug": "ebony-park-to-may-pen"
  },
  {
    "origin": "Effortville",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 2.1,
    "taFareJmd": 130,
    "slug": "effortville-to-may-pen"
  },
  {
    "origin": "Four Paths",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 5.5,
    "taFareJmd": 150,
    "slug": "four-paths-to-may-pen"
  },
  {
    "origin": "Free Town",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 11.7,
    "taFareJmd": 190,
    "slug": "free-town-to-may-pen"
  },
  {
    "origin": "Gimme Mi Bit",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 20.5,
    "taFareJmd": 260,
    "slug": "gimme-mi-bit-to-may-pen"
  },
  {
    "origin": "Hayes",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 13.3,
    "taFareJmd": 210,
    "slug": "hayes-to-may-pen"
  },
  {
    "origin": "Kemps Hill",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 34,
    "taFareJmd": 350,
    "slug": "kemps-hill-to-may-pen"
  },
  {
    "origin": "Kennedy Grove",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 6.2,
    "taFareJmd": 160,
    "slug": "kennedy-grove-to-may-pen"
  },
  {
    "origin": "Lionel Town",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 22,
    "taFareJmd": 270,
    "slug": "lionel-town-to-may-pen"
  },
  {
    "origin": "Longsville",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 9.3,
    "taFareJmd": 180,
    "slug": "longsville-to-may-pen"
  },
  {
    "origin": "Longville Park",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 21.6,
    "taFareJmd": 260,
    "slug": "longville-park-to-may-pen"
  },
  {
    "origin": "Longwood",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 34,
    "taFareJmd": 350,
    "slug": "longwood-to-may-pen"
  },
  {
    "origin": "Milk River",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 22,
    "taFareJmd": 270,
    "slug": "milk-river-to-may-pen"
  },
  {
    "origin": "Mineral Heights",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "mineral-heights-to-may-pen"
  },
  {
    "origin": "Mitchell Town",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 29,
    "taFareJmd": 320,
    "slug": "mitchell-town-to-may-pen"
  },
  {
    "origin": "Mitchells Hill",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 26.7,
    "taFareJmd": 300,
    "slug": "mitchells-hill-to-may-pen"
  },
  {
    "origin": "Moores",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 16.8,
    "taFareJmd": 230,
    "slug": "moores-to-may-pen"
  },
  {
    "origin": "Mount Airy",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 14,
    "taFareJmd": 210,
    "slug": "mount-airy-to-may-pen"
  },
  {
    "origin": "Mount Providence",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 23.9,
    "taFareJmd": 280,
    "slug": "mount-providence-to-may-pen"
  },
  {
    "origin": "New Ground",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 20.7,
    "taFareJmd": 260,
    "slug": "new-ground-to-may-pen"
  },
  {
    "origin": "Old Harbour",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 24.3,
    "taFareJmd": 280,
    "slug": "old-harbour-to-may-pen"
  },
  {
    "origin": "Palmers Cross",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 18.4,
    "taFareJmd": 240,
    "slug": "palmers-cross-to-may-pen"
  },
  {
    "origin": "Pennants",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 3.3,
    "taFareJmd": 140,
    "slug": "pennants-to-may-pen"
  },
  {
    "origin": "Pleasant Valley",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 25,
    "taFareJmd": 290,
    "slug": "pleasant-valley-to-may-pen"
  },
  {
    "origin": "Portland Cottage",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 13,
    "taFareJmd": 200,
    "slug": "portland-cottage-to-may-pen"
  },
  {
    "origin": "Porus",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 29,
    "taFareJmd": 320,
    "slug": "porus-to-may-pen"
  },
  {
    "origin": "Pratville",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 21.6,
    "taFareJmd": 260,
    "slug": "pratville-to-may-pen"
  },
  {
    "origin": "Prospect",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 30.6,
    "taFareJmd": 330,
    "slug": "prospect-to-may-pen"
  },
  {
    "origin": "Race Course",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 29,
    "taFareJmd": 320,
    "slug": "race-course-to-may-pen"
  },
  {
    "origin": "Race Track",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 31,
    "taFareJmd": 330,
    "slug": "race-track-to-may-pen"
  },
  {
    "origin": "Richmond Park",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "richmond-park-to-may-pen"
  },
  {
    "origin": "Rock River",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 23.4,
    "taFareJmd": 280,
    "slug": "rock-river-to-may-pen"
  },
  {
    "origin": "Rocky Point",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 18.4,
    "taFareJmd": 240,
    "slug": "rocky-point-to-may-pen"
  },
  {
    "origin": "Rosewell",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 31,
    "taFareJmd": 330,
    "slug": "rosewell-to-may-pen"
  },
  {
    "origin": "Sandy Bay",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 12.8,
    "taFareJmd": 200,
    "slug": "sandy-bay-to-may-pen"
  },
  {
    "origin": "Scotts Pass",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 9.5,
    "taFareJmd": 180,
    "slug": "scotts-pass-to-may-pen"
  },
  {
    "origin": "Sedge Pond",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 18.3,
    "taFareJmd": 240,
    "slug": "sedge-pond-to-may-pen"
  },
  {
    "origin": "Sevens Heights",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 36,
    "taFareJmd": 370,
    "slug": "sevens-heights-to-may-pen"
  },
  {
    "origin": "Simon",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 6.5,
    "taFareJmd": 160,
    "slug": "simon-to-may-pen"
  },
  {
    "origin": "Smithville",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 28.7,
    "taFareJmd": 310,
    "slug": "smithville-to-may-pen"
  },
  {
    "origin": "Springfield",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 30.2,
    "taFareJmd": 320,
    "slug": "springfield-to-may-pen"
  },
  {
    "origin": "Stewarton",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 38,
    "taFareJmd": 380,
    "slug": "stewarton-to-may-pen"
  },
  {
    "origin": "Summerfield",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 19.3,
    "taFareJmd": 250,
    "slug": "summerfield-to-may-pen"
  },
  {
    "origin": "Toll Gate",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 4,
    "taFareJmd": 140,
    "slug": "toll-gate-to-may-pen"
  },
  {
    "origin": "Victoria Town",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 11.6,
    "taFareJmd": 190,
    "slug": "victoria-town-to-may-pen"
  },
  {
    "origin": "Woodhall",
    "destination": "May Pen",
    "parish": "Clarendon",
    "distanceKm": 26.8,
    "taFareJmd": 300,
    "slug": "woodhall-to-may-pen"
  },
  {
    "origin": "Allison",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 28.7,
    "taFareJmd": 310,
    "slug": "allison-to-spalding"
  },
  {
    "origin": "Aenon Town",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 27,
    "taFareJmd": 300,
    "slug": "aenon-town-to-spalding"
  },
  {
    "origin": "Bullocks",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 8.3,
    "taFareJmd": 170,
    "slug": "bullocks-to-spalding"
  },
  {
    "origin": "Cave Valley",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "cave-valley-to-spalding"
  },
  {
    "origin": "Coffee Piece",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 20,
    "taFareJmd": 250,
    "slug": "coffee-piece-to-spalding"
  },
  {
    "origin": "Coleyville",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 9,
    "taFareJmd": 180,
    "slug": "coleyville-to-spalding"
  },
  {
    "origin": "Cumberland",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "cumberland-to-spalding"
  },
  {
    "origin": "Devon",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 10.9,
    "taFareJmd": 190,
    "slug": "devon-to-spalding"
  },
  {
    "origin": "Frankfield",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "frankfield-to-spalding"
  },
  {
    "origin": "Grantham",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 17,
    "taFareJmd": 230,
    "slug": "grantham-to-spalding"
  },
  {
    "origin": "Leicesterfield",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 8.7,
    "taFareJmd": 170,
    "slug": "leicesterfield-to-spalding"
  },
  {
    "origin": "Malton",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 17,
    "taFareJmd": 230,
    "slug": "malton-to-spalding"
  },
  {
    "origin": "Mizpah",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "mizpah-to-spalding"
  },
  {
    "origin": "Ritchies",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "ritchies-to-spalding"
  },
  {
    "origin": "Sanguinetti",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 6.8,
    "taFareJmd": 160,
    "slug": "sanguinetti-to-spalding"
  },
  {
    "origin": "Silent Hill",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 4.4,
    "taFareJmd": 140,
    "slug": "silent-hill-to-spalding"
  },
  {
    "origin": "Spalding Hill",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 11.3,
    "taFareJmd": 190,
    "slug": "spalding-hill-to-spalding"
  },
  {
    "origin": "Sunberry",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 2,
    "taFareJmd": 130,
    "slug": "sunberry-to-spalding"
  },
  {
    "origin": "Tweedside",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 9.7,
    "taFareJmd": 180,
    "slug": "tweedside-to-spalding"
  },
  {
    "origin": "Victoria",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 8.8,
    "taFareJmd": 170,
    "slug": "victoria-to-spalding"
  },
  {
    "origin": "Wildcane",
    "destination": "Spalding",
    "parish": "Clarendon",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "wildcane-to-spalding"
  },
  {
    "origin": "Frankfield",
    "destination": "Spalding Hill",
    "parish": "Clarendon",
    "distanceKm": 14.2,
    "taFareJmd": 210,
    "slug": "frankfield-to-spalding-hill"
  },
  {
    "origin": "Sanguinetti",
    "destination": "Spalding Hill",
    "parish": "Clarendon",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "sanguinetti-to-spalding-hill"
  },
  {
    "origin": "Silent Hill",
    "destination": "Spalding Hill",
    "parish": "Clarendon",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "silent-hill-to-spalding-hill"
  },
  {
    "origin": "Allison",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 11,
    "taFareJmd": 180,
    "slug": "allison-to-christiana"
  },
  {
    "origin": "Cascade",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 9,
    "taFareJmd": 200,
    "slug": "cascade-to-christiana"
  },
  {
    "origin": "Chudleigh",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 4,
    "taFareJmd": 150,
    "slug": "chudleigh-to-christiana"
  },
  {
    "origin": "Craighead",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 11,
    "taFareJmd": 200,
    "slug": "craighead-to-christiana"
  },
  {
    "origin": "Harry Watch",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 14.5,
    "taFareJmd": 210,
    "slug": "harry-watch-to-christiana"
  },
  {
    "origin": "Hibernia",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 12,
    "taFareJmd": 210,
    "slug": "hibernia-to-christiana"
  },
  {
    "origin": "Litchfield",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 10,
    "taFareJmd": 200,
    "slug": "litchfield-to-christiana"
  },
  {
    "origin": "Lorrimers",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 10,
    "taFareJmd": 180,
    "slug": "lorrimers-to-christiana"
  },
  {
    "origin": "Malton",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 12.9,
    "taFareJmd": 180,
    "slug": "malton-to-christiana"
  },
  {
    "origin": "Over River",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 9.3,
    "taFareJmd": 160,
    "slug": "over-river-to-christiana"
  },
  {
    "origin": "Pike",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 12.6,
    "taFareJmd": 180,
    "slug": "pike-to-christiana"
  },
  {
    "origin": "Silent Hill",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 4.8,
    "taFareJmd": 140,
    "slug": "silent-hill-to-christiana"
  },
  {
    "origin": "Spalding",
    "destination": "Christiana",
    "parish": "Clarendon",
    "distanceKm": 8.1,
    "taFareJmd": 150,
    "slug": "spalding-to-christiana"
  },
  {
    "origin": "Alligator Pond",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 25.7,
    "taFareJmd": 310,
    "slug": "alligator-pond-to-mandeville"
  },
  {
    "origin": "Balaclava",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 30,
    "taFareJmd": 340,
    "slug": "balaclava-to-mandeville"
  },
  {
    "origin": "Banana Ground",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 13.4,
    "taFareJmd": 230,
    "slug": "banana-ground-to-mandeville"
  },
  {
    "origin": "Bath",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 12.1,
    "taFareJmd": 210,
    "slug": "bath-to-mandeville"
  },
  {
    "origin": "Bull Savannah",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 12,
    "taFareJmd": 200,
    "slug": "bull-savannah-to-mandeville"
  },
  {
    "origin": "Coleyville",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 19,
    "taFareJmd": 260,
    "slug": "coleyville-to-mandeville"
  },
  {
    "origin": "Ellen Streeet",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 6,
    "taFareJmd": 150,
    "slug": "ellen-streeet-to-mandeville"
  },
  {
    "origin": "Grey Ground",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 2.8,
    "taFareJmd": 140,
    "slug": "grey-ground-to-mandeville"
  },
  {
    "origin": "Heathfield",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 16.1,
    "taFareJmd": 230,
    "slug": "heathfield-to-mandeville"
  },
  {
    "origin": "Land Settlement",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 7.3,
    "taFareJmd": 180,
    "slug": "land-settlement-to-mandeville"
  },
  {
    "origin": "New Green",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 12.8,
    "taFareJmd": 210,
    "slug": "new-green-to-mandeville"
  },
  {
    "origin": "New Wales",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 7.1,
    "taFareJmd": 140,
    "slug": "new-wales-to-mandeville"
  },
  {
    "origin": "Richmond",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 25,
    "taFareJmd": 290,
    "slug": "richmond-to-mandeville"
  },
  {
    "origin": "Spalding",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 18.4,
    "taFareJmd": 250,
    "slug": "spalding-to-mandeville"
  },
  {
    "origin": "Spur Tree",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 17.6,
    "taFareJmd": 240,
    "slug": "spur-tree-to-mandeville"
  },
  {
    "origin": "Summerset",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "summerset-to-mandeville"
  },
  {
    "origin": "Swabys Hope",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 27,
    "taFareJmd": 300,
    "slug": "swabys-hope-to-mandeville"
  },
  {
    "origin": "Three Chain Road",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 11.6,
    "taFareJmd": 190,
    "slug": "three-chain-road-to-mandeville"
  },
  {
    "origin": "Toll Gate",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 9.8,
    "taFareJmd": 180,
    "slug": "toll-gate-to-mandeville"
  },
  {
    "origin": "Top Hill",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "top-hill-to-mandeville"
  },
  {
    "origin": "Waltham",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 29,
    "taFareJmd": 320,
    "slug": "waltham-to-mandeville"
  },
  {
    "origin": "Warwick",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 33,
    "taFareJmd": 340,
    "slug": "warwick-to-mandeville"
  },
  {
    "origin": "Williamsfield",
    "destination": "Mandeville",
    "parish": "Clarendon",
    "distanceKm": 4,
    "taFareJmd": 140,
    "slug": "williamsfield-to-mandeville"
  },
  {
    "origin": "Mile Gully",
    "destination": "Balaclava",
    "parish": "St. Elizabeth",
    "distanceKm": 19.5,
    "taFareJmd": 250,
    "slug": "mile-gully-to-balaclava"
  },
  {
    "origin": "Arlington",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 3,
    "taFareJmd": 130,
    "slug": "arlington-to-black-river"
  },
  {
    "origin": "Cotterwood",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 9.3,
    "taFareJmd": 180,
    "slug": "cotterwood-to-black-river"
  },
  {
    "origin": "Ginger Hill",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 9.6,
    "taFareJmd": 180,
    "slug": "ginger-hill-to-black-river"
  },
  {
    "origin": "Junction",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 12,
    "taFareJmd": 200,
    "slug": "junction-to-black-river"
  },
  {
    "origin": "Lower Works",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 10,
    "taFareJmd": 180,
    "slug": "lower-works-to-black-river"
  },
  {
    "origin": "Mountainside",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 29,
    "taFareJmd": 320,
    "slug": "mountainside-to-black-river"
  },
  {
    "origin": "Parottee",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "parottee-to-black-river"
  },
  {
    "origin": "Rock Hall",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 22,
    "taFareJmd": 270,
    "slug": "rock-hall-to-black-river"
  },
  {
    "origin": "Southfield",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 30.4,
    "taFareJmd": 330,
    "slug": "southfield-to-black-river"
  },
  {
    "origin": "Vineyards",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 29.3,
    "taFareJmd": 320,
    "slug": "vineyards-to-black-river"
  },
  {
    "origin": "Woodlands",
    "destination": "Black River",
    "parish": "St. Elizabeth",
    "distanceKm": 27.2,
    "taFareJmd": 300,
    "slug": "woodlands-to-black-river"
  },
  {
    "origin": "Alligator Pond",
    "destination": "Junction",
    "parish": "St. Elizabeth",
    "distanceKm": 12,
    "taFareJmd": 200,
    "slug": "alligator-pond-to-junction"
  },
  {
    "origin": "Bull Savannah",
    "destination": "Junction",
    "parish": "St. Elizabeth",
    "distanceKm": 18.6,
    "taFareJmd": 240,
    "slug": "bull-savannah-to-junction"
  },
  {
    "origin": "Morningside",
    "destination": "Junction",
    "parish": "St. Elizabeth",
    "distanceKm": 9.6,
    "taFareJmd": 180,
    "slug": "morningside-to-junction"
  },
  {
    "origin": "Pedro Cross",
    "destination": "Junction",
    "parish": "St. Elizabeth",
    "distanceKm": 16,
    "taFareJmd": 230,
    "slug": "pedro-cross-to-junction"
  },
  {
    "origin": "Southfield",
    "destination": "Junction",
    "parish": "St. Elizabeth",
    "distanceKm": 9.6,
    "taFareJmd": 180,
    "slug": "southfield-to-junction"
  },
  {
    "origin": "Top Hill",
    "destination": "Junction",
    "parish": "St. Elizabeth",
    "distanceKm": 5.6,
    "taFareJmd": 150,
    "slug": "top-hill-to-junction"
  },
  {
    "origin": "Tryall",
    "destination": "Junction",
    "parish": "St. Elizabeth",
    "distanceKm": 23,
    "taFareJmd": 270,
    "slug": "tryall-to-junction"
  },
  {
    "origin": "Balaclava",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 4.8,
    "taFareJmd": 150,
    "slug": "balaclava-to-santa-cruz"
  },
  {
    "origin": "Braes River",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 33.4,
    "taFareJmd": 350,
    "slug": "braes-river-to-santa-cruz"
  },
  {
    "origin": "Elim",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 8.4,
    "taFareJmd": 170,
    "slug": "elim-to-santa-cruz"
  },
  {
    "origin": "Leeds",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "leeds-to-santa-cruz"
  },
  {
    "origin": "Malvern",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 31,
    "taFareJmd": 330,
    "slug": "malvern-to-santa-cruz"
  },
  {
    "origin": "Mountainside",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 16.4,
    "taFareJmd": 230,
    "slug": "mountainside-to-santa-cruz"
  },
  {
    "origin": "Myersville",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 13.9,
    "taFareJmd": 210,
    "slug": "myersville-to-santa-cruz"
  },
  {
    "origin": "New Market",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 25.8,
    "taFareJmd": 290,
    "slug": "new-market-to-santa-cruz"
  },
  {
    "origin": "Northampton",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 29,
    "taFareJmd": 320,
    "slug": "northampton-to-santa-cruz"
  },
  {
    "origin": "Park Mountain",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "park-mountain-to-santa-cruz"
  },
  {
    "origin": "Quickstep",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 40.2,
    "taFareJmd": 390,
    "slug": "quickstep-to-santa-cruz"
  },
  {
    "origin": "Rocky Hill",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 14.4,
    "taFareJmd": 210,
    "slug": "rocky-hill-to-santa-cruz"
  },
  {
    "origin": "Siloah",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 4.8,
    "taFareJmd": 150,
    "slug": "siloah-to-santa-cruz"
  },
  {
    "origin": "Southfield",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 7,
    "taFareJmd": 160,
    "slug": "southfield-to-santa-cruz"
  },
  {
    "origin": "Y.s. Falls",
    "destination": "Santa Cruz",
    "parish": "St. Elizabeth",
    "distanceKm": 16,
    "taFareJmd": 230,
    "slug": "y-s-falls-to-santa-cruz"
  },
  {
    "origin": "New Market",
    "destination": "Darliston",
    "parish": "Westmoreland",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "new-market-to-darliston"
  },
  {
    "origin": "Petersfield",
    "destination": "Darliston",
    "parish": "Westmoreland",
    "distanceKm": 17.5,
    "taFareJmd": 220,
    "slug": "petersfield-to-darliston"
  },
  {
    "origin": "Orange Bay",
    "destination": "Negril",
    "parish": "Westmoreland",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "orange-bay-to-negril"
  },
  {
    "origin": "Orange Hill",
    "destination": "Negril",
    "parish": "Westmoreland",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "orange-hill-to-negril"
  },
  {
    "origin": "Revival",
    "destination": "Negril",
    "parish": "Westmoreland",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "revival-to-negril"
  },
  {
    "origin": "Sheffield",
    "destination": "Negril",
    "parish": "Westmoreland",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "sheffield-to-negril"
  },
  {
    "origin": "West End",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 7,
    "taFareJmd": 160,
    "slug": "west-end-to-savanna-la-mar"
  },
  {
    "origin": "Banbury",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "banbury-to-savanna-la-mar"
  },
  {
    "origin": "Bath",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 37,
    "taFareJmd": 370,
    "slug": "bath-to-savanna-la-mar"
  },
  {
    "origin": "Bethel Town",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 16,
    "taFareJmd": 230,
    "slug": "bethel-town-to-savanna-la-mar"
  },
  {
    "origin": "Bluefields",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "bluefields-to-savanna-la-mar"
  },
  {
    "origin": "Burnt Savannah",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 16.5,
    "taFareJmd": 230,
    "slug": "burnt-savannah-to-savanna-la-mar"
  },
  {
    "origin": "Chichester",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "chichester-to-savanna-la-mar"
  },
  {
    "origin": "Content",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 25.6,
    "taFareJmd": 290,
    "slug": "content-to-savanna-la-mar"
  },
  {
    "origin": "Mountain",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 22.4,
    "taFareJmd": 270,
    "slug": "mountain-to-savanna-la-mar"
  },
  {
    "origin": "Darliston",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 12.5,
    "taFareJmd": 200,
    "slug": "darliston-to-savanna-la-mar"
  },
  {
    "origin": "Friendship",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 12.5,
    "taFareJmd": 200,
    "slug": "friendship-to-savanna-la-mar"
  },
  {
    "origin": "Welcome",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 14.4,
    "taFareJmd": 230,
    "slug": "welcome-to-savanna-la-mar"
  },
  {
    "origin": "Whithorn",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 13.5,
    "taFareJmd": 210,
    "slug": "whithorn-to-savanna-la-mar"
  },
  {
    "origin": "Willamsfield",
    "destination": "Savanna La Mar",
    "parish": "Westmoreland",
    "distanceKm": 15.4,
    "taFareJmd": 210,
    "slug": "willamsfield-to-savanna-la-mar"
  },
  {
    "origin": "Cave Valley",
    "destination": "Green Island",
    "parish": "Westmoreland",
    "distanceKm": 8,
    "taFareJmd": 160,
    "slug": "cave-valley-to-green-island"
  },
  {
    "origin": "Bamboo",
    "destination": "Hopewell",
    "parish": "Westmoreland",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "bamboo-to-hopewell"
  },
  {
    "origin": "Cacoon Castle",
    "destination": "Hopewell",
    "parish": "Westmoreland",
    "distanceKm": 6.4,
    "taFareJmd": 170,
    "slug": "cacoon-castle-to-hopewell"
  },
  {
    "origin": "Sandy Bay",
    "destination": "Hopewell",
    "parish": "Westmoreland",
    "distanceKm": 5,
    "taFareJmd": 160,
    "slug": "sandy-bay-to-hopewell"
  },
  {
    "origin": "Bulls Bay",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 5.7,
    "taFareJmd": 150,
    "slug": "bulls-bay-to-lucea"
  },
  {
    "origin": "Cauldwell",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "cauldwell-to-lucea"
  },
  {
    "origin": "Claremont",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 6.3,
    "taFareJmd": 170,
    "slug": "claremont-to-lucea"
  },
  {
    "origin": "Dias",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 4,
    "taFareJmd": 160,
    "slug": "dias-to-lucea"
  },
  {
    "origin": "Elgin Town",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 4,
    "taFareJmd": 140,
    "slug": "elgin-town-to-lucea"
  },
  {
    "origin": "Grange Hill",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 18,
    "taFareJmd": 250,
    "slug": "grange-hill-to-lucea"
  },
  {
    "origin": "Jericho",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 9.5,
    "taFareJmd": 160,
    "slug": "jericho-to-lucea"
  },
  {
    "origin": "Kingsvale",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 6,
    "taFareJmd": 180,
    "slug": "kingsvale-to-lucea"
  },
  {
    "origin": "Lances Bay",
    "destination": "Lucea",
    "parish": "Westmoreland",
    "distanceKm": 10,
    "taFareJmd": 160,
    "slug": "lances-bay-to-lucea"
  },
  {
    "origin": "Adelphi",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 4,
    "taFareJmd": 140,
    "slug": "adelphi-to-montego-bay"
  },
  {
    "origin": "Airport",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 12,
    "taFareJmd": 200,
    "slug": "airport-to-montego-bay"
  },
  {
    "origin": "Anchovy",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "anchovy-to-montego-bay"
  },
  {
    "origin": "Barrett Town",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 27,
    "taFareJmd": 300,
    "slug": "barrett-town-to-montego-bay"
  },
  {
    "origin": "Bethel Town",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "bethel-town-to-montego-bay"
  },
  {
    "origin": "Bickersteth",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "bickersteth-to-montego-bay"
  },
  {
    "origin": "Bogue",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 22,
    "taFareJmd": 270,
    "slug": "bogue-to-montego-bay"
  },
  {
    "origin": "Cacoon Castle",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 26,
    "taFareJmd": 300,
    "slug": "cacoon-castle-to-montego-bay"
  },
  {
    "origin": "Cambridge",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 24,
    "taFareJmd": 280,
    "slug": "cambridge-to-montego-bay"
  },
  {
    "origin": "Cambridge Meadows",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 1.6,
    "taFareJmd": 120,
    "slug": "cambridge-meadows-to-montego-bay"
  },
  {
    "origin": "Catherine Hall",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 3,
    "taFareJmd": 130,
    "slug": "catherine-hall-to-montego-bay"
  },
  {
    "origin": "Catherine Mount",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 24,
    "taFareJmd": 280,
    "slug": "catherine-mount-to-montego-bay"
  },
  {
    "origin": "Chester Castle",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 1,
    "taFareJmd": 120,
    "slug": "chester-castle-to-montego-bay"
  },
  {
    "origin": "Clock",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "clock-to-montego-bay"
  },
  {
    "origin": "Content",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 18.2,
    "taFareJmd": 240,
    "slug": "content-to-montego-bay"
  },
  {
    "origin": "Copse",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "copse-to-montego-bay"
  },
  {
    "origin": "Coral Gardens",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "coral-gardens-to-montego-bay"
  },
  {
    "origin": "Cornwall",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "cornwall-to-montego-bay"
  },
  {
    "origin": "Cornwall Courts",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 22.4,
    "taFareJmd": 270,
    "slug": "cornwall-courts-to-montego-bay"
  },
  {
    "origin": "Dumfries",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 4,
    "taFareJmd": 140,
    "slug": "dumfries-to-montego-bay"
  },
  {
    "origin": "Fairfield",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "fairfield-to-montego-bay"
  },
  {
    "origin": "Farm Heights",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 6.5,
    "taFareJmd": 160,
    "slug": "farm-heights-to-montego-bay"
  },
  {
    "origin": "Flankers",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 12,
    "taFareJmd": 200,
    "slug": "flankers-to-montego-bay"
  },
  {
    "origin": "Flower Hill",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 4,
    "taFareJmd": 140,
    "slug": "flower-hill-to-montego-bay"
  },
  {
    "origin": "Freeport",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 3.2,
    "taFareJmd": 140,
    "slug": "freeport-to-montego-bay"
  },
  {
    "origin": "Glendevon",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 24,
    "taFareJmd": 280,
    "slug": "glendevon-to-montego-bay"
  },
  {
    "origin": "Goodwill",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "goodwill-to-montego-bay"
  },
  {
    "origin": "Granville",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 5.6,
    "taFareJmd": 150,
    "slug": "granville-to-montego-bay"
  },
  {
    "origin": "Green Pond",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 25.5,
    "taFareJmd": 290,
    "slug": "green-pond-to-montego-bay"
  },
  {
    "origin": "Greenwood",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "greenwood-to-montego-bay"
  },
  {
    "origin": "Gutters",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 16,
    "taFareJmd": 230,
    "slug": "gutters-to-montego-bay"
  },
  {
    "origin": "Hampton",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 3.7,
    "taFareJmd": 140,
    "slug": "hampton-to-montego-bay"
  },
  {
    "origin": "Hendon",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 4.7,
    "taFareJmd": 150,
    "slug": "hendon-to-montego-bay"
  },
  {
    "origin": "Hendon Norwood",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 14.2,
    "taFareJmd": 210,
    "slug": "hendon-norwood-to-montego-bay"
  },
  {
    "origin": "Hopewell",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "hopewell-to-montego-bay"
  },
  {
    "origin": "Johns Hall",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 11.5,
    "taFareJmd": 190,
    "slug": "johns-hall-to-montego-bay"
  },
  {
    "origin": "Mafoota",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 15.2,
    "taFareJmd": 240,
    "slug": "mafoota-to-montego-bay"
  },
  {
    "origin": "Maroon Town",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 23.5,
    "taFareJmd": 300,
    "slug": "maroon-town-to-montego-bay"
  },
  {
    "origin": "Moore Park",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 15,
    "taFareJmd": 200,
    "slug": "moore-park-to-montego-bay"
  },
  {
    "origin": "Mount Horeb",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 18.7,
    "taFareJmd": 250,
    "slug": "mount-horeb-to-montego-bay"
  },
  {
    "origin": "Rose Hall",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 17,
    "taFareJmd": 230,
    "slug": "rose-hall-to-montego-bay"
  },
  {
    "origin": "Sign",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 5.1,
    "taFareJmd": 170,
    "slug": "sign-to-montego-bay"
  },
  {
    "origin": "The Estuary (Lagoon",
    "destination": "Montego Bay",
    "parish": "Westmoreland",
    "distanceKm": 4.8,
    "taFareJmd": 150,
    "slug": "the-estuary-lagoon-to-montego-bay"
  },
  {
    "origin": "Duanvale",
    "destination": "Clarks Town",
    "parish": "Westmoreland",
    "distanceKm": 8.3,
    "taFareJmd": 170,
    "slug": "duanvale-to-clarks-town"
  },
  {
    "origin": "Discovery Bay",
    "destination": "Duncans",
    "parish": "Westmoreland",
    "distanceKm": 19.5,
    "taFareJmd": 250,
    "slug": "discovery-bay-to-duncans"
  },
  {
    "origin": "Silver Sands",
    "destination": "Duncans",
    "parish": "Westmoreland",
    "distanceKm": 2.2,
    "taFareJmd": 130,
    "slug": "silver-sands-to-duncans"
  },
  {
    "origin": "Albert Town",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 42,
    "taFareJmd": 410,
    "slug": "albert-town-to-falmouth"
  },
  {
    "origin": "Bounty Hall",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 9,
    "taFareJmd": 180,
    "slug": "bounty-hall-to-falmouth"
  },
  {
    "origin": "Bunkers Hill",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 13.6,
    "taFareJmd": 210,
    "slug": "bunkers-hill-to-falmouth"
  },
  {
    "origin": "Coral Spring Village",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 10.5,
    "taFareJmd": 190,
    "slug": "coral-spring-village-to-falmouth"
  },
  {
    "origin": "Clarks Town",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "clarks-town-to-falmouth"
  },
  {
    "origin": "Daniel Town",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 7.8,
    "taFareJmd": 170,
    "slug": "daniel-town-to-falmouth"
  },
  {
    "origin": "Davis Pen",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 10,
    "taFareJmd": 180,
    "slug": "davis-pen-to-falmouth"
  },
  {
    "origin": "Deeside",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 19.2,
    "taFareJmd": 250,
    "slug": "deeside-to-falmouth"
  },
  {
    "origin": "Discovery Bay",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 33,
    "taFareJmd": 340,
    "slug": "discovery-bay-to-falmouth"
  },
  {
    "origin": "Duanvale",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 14.7,
    "taFareJmd": 220,
    "slug": "duanvale-to-falmouth"
  },
  {
    "origin": "Duncans",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 14.4,
    "taFareJmd": 210,
    "slug": "duncans-to-falmouth"
  },
  {
    "origin": "Falmouth Garden",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 1.5,
    "taFareJmd": 120,
    "slug": "falmouth-garden-to-falmouth"
  },
  {
    "origin": "Friendship",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "friendship-to-falmouth"
  },
  {
    "origin": "Wakefield",
    "destination": "Falmouth",
    "parish": "Westmoreland",
    "distanceKm": 16,
    "taFareJmd": 210,
    "slug": "wakefield-to-falmouth"
  },
  {
    "origin": "Grants Bailey",
    "destination": "Alexandria",
    "parish": "St. Ann",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "grants-bailey-to-alexandria"
  },
  {
    "origin": "Higgins Land",
    "destination": "Alexandria",
    "parish": "St. Ann",
    "distanceKm": 9,
    "taFareJmd": 180,
    "slug": "higgins-land-to-alexandria"
  },
  {
    "origin": "Murray Mountain",
    "destination": "Alexandria",
    "parish": "St. Ann",
    "distanceKm": 14,
    "taFareJmd": 210,
    "slug": "murray-mountain-to-alexandria"
  },
  {
    "origin": "Nine Miles",
    "destination": "Alexandria",
    "parish": "St. Ann",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "nine-miles-to-alexandria"
  },
  {
    "origin": "Stepney",
    "destination": "Alexandria",
    "parish": "St. Ann",
    "distanceKm": 10,
    "taFareJmd": 180,
    "slug": "stepney-to-alexandria"
  },
  {
    "origin": "Discovery Bay",
    "destination": "Browns Town",
    "parish": "St. Ann",
    "distanceKm": 13,
    "taFareJmd": 200,
    "slug": "discovery-bay-to-browns-town"
  },
  {
    "origin": "Higgin Land",
    "destination": "Browns Town",
    "parish": "St. Ann",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "higgin-land-to-browns-town"
  },
  {
    "origin": "Keith",
    "destination": "Browns Town",
    "parish": "St. Ann",
    "distanceKm": 9.4,
    "taFareJmd": 180,
    "slug": "keith-to-browns-town"
  },
  {
    "origin": "Lower Buxton",
    "destination": "Browns Town",
    "parish": "St. Ann",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "lower-buxton-to-browns-town"
  },
  {
    "origin": "Orange Hill",
    "destination": "Browns Town",
    "parish": "St. Ann",
    "distanceKm": 2.6,
    "taFareJmd": 130,
    "slug": "orange-hill-to-browns-town"
  },
  {
    "origin": "Golden Grove",
    "destination": "Claremont",
    "parish": "St. Ann",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "golden-grove-to-claremont"
  },
  {
    "origin": "Irons Mountain",
    "destination": "Claremont",
    "parish": "St. Ann",
    "distanceKm": 5,
    "taFareJmd": 150,
    "slug": "irons-mountain-to-claremont"
  },
  {
    "origin": "Pedro River",
    "destination": "Claremont",
    "parish": "St. Ann",
    "distanceKm": 23.7,
    "taFareJmd": 280,
    "slug": "pedro-river-to-claremont"
  },
  {
    "origin": "Bensonton",
    "destination": "Claremont",
    "parish": "St. Ann",
    "distanceKm": 15.6,
    "taFareJmd": 220,
    "slug": "bensonton-to-claremont"
  },
  {
    "origin": "Clapham",
    "destination": "Moneague",
    "parish": "St. Ann",
    "distanceKm": 6.3,
    "taFareJmd": 160,
    "slug": "clapham-to-moneague"
  },
  {
    "origin": "Claremont",
    "destination": "Moneague",
    "parish": "St. Ann",
    "distanceKm": 12.5,
    "taFareJmd": 200,
    "slug": "claremont-to-moneague"
  },
  {
    "origin": "Bamboo",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 21,
    "taFareJmd": 260,
    "slug": "bamboo-to-ocho-rios"
  },
  {
    "origin": "Bamboo Walk",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 15.6,
    "taFareJmd": 220,
    "slug": "bamboo-walk-to-ocho-rios"
  },
  {
    "origin": "Beecher Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 6.2,
    "taFareJmd": 160,
    "slug": "beecher-town-to-ocho-rios"
  },
  {
    "origin": "Boscobel",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "boscobel-to-ocho-rios"
  },
  {
    "origin": "Breadnut Hill",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 4.9,
    "taFareJmd": 150,
    "slug": "breadnut-hill-to-ocho-rios"
  },
  {
    "origin": "Camperdown",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 30.9,
    "taFareJmd": 330,
    "slug": "camperdown-to-ocho-rios"
  },
  {
    "origin": "Chalky Hill",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 11,
    "taFareJmd": 190,
    "slug": "chalky-hill-to-ocho-rios"
  },
  {
    "origin": "Charles Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 10.2,
    "taFareJmd": 180,
    "slug": "charles-town-to-ocho-rios"
  },
  {
    "origin": "Chester",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 20.5,
    "taFareJmd": 260,
    "slug": "chester-to-ocho-rios"
  },
  {
    "origin": "Clapham",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 26,
    "taFareJmd": 300,
    "slug": "clapham-to-ocho-rios"
  },
  {
    "origin": "Claremont",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 19.2,
    "taFareJmd": 250,
    "slug": "claremont-to-ocho-rios"
  },
  {
    "origin": "Colegate",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 8,
    "taFareJmd": 170,
    "slug": "colegate-to-ocho-rios"
  },
  {
    "origin": "Content Gardens",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 3.7,
    "taFareJmd": 140,
    "slug": "content-gardens-to-ocho-rios"
  },
  {
    "origin": "Davis Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 16.8,
    "taFareJmd": 230,
    "slug": "davis-town-to-ocho-rios"
  },
  {
    "origin": "Days Mountain",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 24.3,
    "taFareJmd": 280,
    "slug": "days-mountain-to-ocho-rios"
  },
  {
    "origin": "Dressikie",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 27.4,
    "taFareJmd": 300,
    "slug": "dressikie-to-ocho-rios"
  },
  {
    "origin": "Dunnsville",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 13,
    "taFareJmd": 200,
    "slug": "dunnsville-to-ocho-rios"
  },
  {
    "origin": "Eltham",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 7.5,
    "taFareJmd": 170,
    "slug": "eltham-to-ocho-rios"
  },
  {
    "origin": "Exchange",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 7.8,
    "taFareJmd": 170,
    "slug": "exchange-to-ocho-rios"
  },
  {
    "origin": "Fellowship Hall",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 17,
    "taFareJmd": 230,
    "slug": "fellowship-hall-to-ocho-rios"
  },
  {
    "origin": "Free Hill",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 25.9,
    "taFareJmd": 290,
    "slug": "free-hill-to-ocho-rios"
  },
  {
    "origin": "Galina",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 27.6,
    "taFareJmd": 310,
    "slug": "galina-to-ocho-rios"
  },
  {
    "origin": "Geddes Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 28.4,
    "taFareJmd": 310,
    "slug": "geddes-town-to-ocho-rios"
  },
  {
    "origin": "Golden Grove",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 17.5,
    "taFareJmd": 240,
    "slug": "golden-grove-to-ocho-rios"
  },
  {
    "origin": "Grants Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 28,
    "taFareJmd": 310,
    "slug": "grants-town-to-ocho-rios"
  },
  {
    "origin": "Great Pond",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 9.6,
    "taFareJmd": 180,
    "slug": "great-pond-to-ocho-rios"
  },
  {
    "origin": "Higgins Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 21,
    "taFareJmd": 260,
    "slug": "higgins-town-to-ocho-rios"
  },
  {
    "origin": "Hinds Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 10,
    "taFareJmd": 180,
    "slug": "hinds-town-to-ocho-rios"
  },
  {
    "origin": "Jack's River",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 24.1,
    "taFareJmd": 280,
    "slug": "jack-s-river-to-ocho-rios"
  },
  {
    "origin": "Jeffery Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 29,
    "taFareJmd": 320,
    "slug": "jeffery-town-to-ocho-rios"
  },
  {
    "origin": "Lewis",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 17.9,
    "taFareJmd": 240,
    "slug": "lewis-to-ocho-rios"
  },
  {
    "origin": "Lime Hall",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 14,
    "taFareJmd": 210,
    "slug": "lime-hall-to-ocho-rios"
  },
  {
    "origin": "Lucky Hill",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 25.8,
    "taFareJmd": 290,
    "slug": "lucky-hill-to-ocho-rios"
  },
  {
    "origin": "Mango Valley",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 14.4,
    "taFareJmd": 210,
    "slug": "mango-valley-to-ocho-rios"
  },
  {
    "origin": "Mansfield Heights",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 4.1,
    "taFareJmd": 140,
    "slug": "mansfield-heights-to-ocho-rios"
  },
  {
    "origin": "Mile End",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 11.5,
    "taFareJmd": 190,
    "slug": "mile-end-to-ocho-rios"
  },
  {
    "origin": "Moneague",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 19.2,
    "taFareJmd": 250,
    "slug": "moneague-to-ocho-rios"
  },
  {
    "origin": "Mount Zion",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 22.1,
    "taFareJmd": 270,
    "slug": "mount-zion-to-ocho-rios"
  },
  {
    "origin": "Oracabessa",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 21,
    "taFareJmd": 260,
    "slug": "oracabessa-to-ocho-rios"
  },
  {
    "origin": "Parry Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 4.8,
    "taFareJmd": 150,
    "slug": "parry-town-to-ocho-rios"
  },
  {
    "origin": "Petersfield",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 12.4,
    "taFareJmd": 200,
    "slug": "petersfield-to-ocho-rios"
  },
  {
    "origin": "Pimento Walk",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 3.5,
    "taFareJmd": 140,
    "slug": "pimento-walk-to-ocho-rios"
  },
  {
    "origin": "Priory",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 13,
    "taFareJmd": 200,
    "slug": "priory-to-ocho-rios"
  },
  {
    "origin": "Race Course",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 21.6,
    "taFareJmd": 260,
    "slug": "race-course-to-ocho-rios"
  },
  {
    "origin": "Retirement",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 28.4,
    "taFareJmd": 310,
    "slug": "retirement-to-ocho-rios"
  },
  {
    "origin": "Retreat",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 13.7,
    "taFareJmd": 210,
    "slug": "retreat-to-ocho-rios"
  },
  {
    "origin": "Seville Heights",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 12.3,
    "taFareJmd": 200,
    "slug": "seville-heights-to-ocho-rios"
  },
  {
    "origin": "Snow Hill",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 3,
    "taFareJmd": 130,
    "slug": "snow-hill-to-ocho-rios"
  },
  {
    "origin": "Steer Town",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 9.6,
    "taFareJmd": 200,
    "slug": "steer-town-to-ocho-rios"
  },
  {
    "origin": "Three Hills",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 11.2,
    "taFareJmd": 180,
    "slug": "three-hills-to-ocho-rios"
  },
  {
    "origin": "Windsor Heights",
    "destination": "Ocho Rios",
    "parish": "St. Ann",
    "distanceKm": 14,
    "taFareJmd": 200,
    "slug": "windsor-heights-to-ocho-rios"
  },
  {
    "origin": "Higgin Town",
    "destination": "St.. Ann's Bay",
    "parish": "St. Ann",
    "distanceKm": 9,
    "taFareJmd": 190,
    "slug": "higgin-town-to-st-ann-s-bay"
  },
  {
    "origin": "Lime Hall",
    "destination": "St.. Ann's Bay",
    "parish": "St. Ann",
    "distanceKm": 6.3,
    "taFareJmd": 160,
    "slug": "lime-hall-to-st-ann-s-bay"
  },
  {
    "origin": "Mansfield Heights",
    "destination": "St.. Ann's Bay",
    "parish": "St. Ann",
    "distanceKm": 15.1,
    "taFareJmd": 200,
    "slug": "mansfield-heights-to-st-ann-s-bay"
  },
  {
    "origin": "Steer Town",
    "destination": "St.. Ann's Bay",
    "parish": "St. Ann",
    "distanceKm": 6.4,
    "taFareJmd": 140,
    "slug": "steer-town-to-st-ann-s-bay"
  },
  {
    "origin": "Buff Bay",
    "destination": "Annotto Bay",
    "parish": "St. Mary",
    "distanceKm": 28.6,
    "taFareJmd": 310,
    "slug": "buff-bay-to-annotto-bay"
  },
  {
    "origin": "Bybrook",
    "destination": "Annotto Bay",
    "parish": "St. Mary",
    "distanceKm": 16,
    "taFareJmd": 230,
    "slug": "bybrook-to-annotto-bay"
  },
  {
    "origin": "Enfield",
    "destination": "Annotto Bay",
    "parish": "St. Mary",
    "distanceKm": 28.3,
    "taFareJmd": 310,
    "slug": "enfield-to-annotto-bay"
  },
  {
    "origin": "Islington",
    "destination": "Annotto Bay",
    "parish": "St. Mary",
    "distanceKm": 20.8,
    "taFareJmd": 260,
    "slug": "islington-to-annotto-bay"
  },
  {
    "origin": "Port Maria",
    "destination": "Annotto Bay",
    "parish": "St. Mary",
    "distanceKm": 13,
    "taFareJmd": 200,
    "slug": "port-maria-to-annotto-bay"
  },
  {
    "origin": "Skibo",
    "destination": "Annotto Bay",
    "parish": "St. Mary",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "skibo-to-annotto-bay"
  },
  {
    "origin": "Tryall Heights",
    "destination": "Gayle",
    "parish": "St. Mary",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "tryall-heights-to-gayle"
  },
  {
    "origin": "Rose Hill",
    "destination": "Guys Hill",
    "parish": "St. Mary",
    "distanceKm": 21.2,
    "taFareJmd": 260,
    "slug": "rose-hill-to-guys-hill"
  },
  {
    "origin": "Zion Hill",
    "destination": "Guys Hill",
    "parish": "St. Mary",
    "distanceKm": 20,
    "taFareJmd": 250,
    "slug": "zion-hill-to-guys-hill"
  },
  {
    "origin": "Jacks River",
    "destination": "Highgate",
    "parish": "St. Mary",
    "distanceKm": 12.2,
    "taFareJmd": 200,
    "slug": "jacks-river-to-highgate"
  },
  {
    "origin": "Mountain",
    "destination": "Highgate",
    "parish": "St. Mary",
    "distanceKm": 7.6,
    "taFareJmd": 170,
    "slug": "mountain-to-highgate"
  },
  {
    "origin": "Bailey's Vale",
    "destination": "Port Maria",
    "parish": "St. Mary",
    "distanceKm": 6.7,
    "taFareJmd": 160,
    "slug": "bailey-s-vale-to-port-maria"
  },
  {
    "origin": "Free Hill",
    "destination": "Port Maria",
    "parish": "St. Mary",
    "distanceKm": 6,
    "taFareJmd": 160,
    "slug": "free-hill-to-port-maria"
  },
  {
    "origin": "Geddes Town",
    "destination": "Port Maria",
    "parish": "St. Mary",
    "distanceKm": 12.6,
    "taFareJmd": 200,
    "slug": "geddes-town-to-port-maria"
  },
  {
    "origin": "Heywood Hall",
    "destination": "Port Maria",
    "parish": "St. Mary",
    "distanceKm": 7.3,
    "taFareJmd": 160,
    "slug": "heywood-hall-to-port-maria"
  },
  {
    "origin": "Islington",
    "destination": "Port Maria",
    "parish": "St. Mary",
    "distanceKm": 21.5,
    "taFareJmd": 260,
    "slug": "islington-to-port-maria"
  },
  {
    "origin": "Oxford",
    "destination": "Port Maria",
    "parish": "St. Mary",
    "distanceKm": 9.7,
    "taFareJmd": 180,
    "slug": "oxford-to-port-maria"
  },
  {
    "origin": "Fellowship Hall",
    "destination": "Stewart",
    "parish": "St. Mary",
    "distanceKm": 9.8,
    "taFareJmd": 180,
    "slug": "fellowship-hall-to-stewart"
  },
  {
    "origin": "Fruitfull Vale",
    "destination": "Port Antonio",
    "parish": "St. Mary",
    "distanceKm": 25.9,
    "taFareJmd": 300,
    "slug": "fruitfull-vale-to-port-antonio"
  },
  {
    "origin": "Rio Grande Valley",
    "destination": "Port Antonio",
    "parish": "St. Mary",
    "distanceKm": 16,
    "taFareJmd": 220,
    "slug": "rio-grande-valley-to-port-antonio"
  },
  {
    "origin": "Shot Over",
    "destination": "Port Antonio",
    "parish": "St. Mary",
    "distanceKm": 4.5,
    "taFareJmd": 160,
    "slug": "shot-over-to-port-antonio"
  },
  {
    "origin": "Stony Hill",
    "destination": "Port Antonio",
    "parish": "St. Mary",
    "distanceKm": 3.5,
    "taFareJmd": 140,
    "slug": "stony-hill-to-port-antonio"
  },
  {
    "origin": "Swift River",
    "destination": "Port Antonio",
    "parish": "St. Mary",
    "distanceKm": 22.2,
    "taFareJmd": 280,
    "slug": "swift-river-to-port-antonio"
  },
  {
    "origin": "Bath",
    "destination": "Golden Grove",
    "parish": "St. Thomas",
    "distanceKm": 13.4,
    "taFareJmd": 210,
    "slug": "bath-to-golden-grove"
  },
  {
    "origin": "Rowlandsfield",
    "destination": "Golden Grove",
    "parish": "St. Thomas",
    "distanceKm": 16.5,
    "taFareJmd": 230,
    "slug": "rowlandsfield-to-golden-grove"
  },
  {
    "origin": "Wheelerfield",
    "destination": "Golden Grove",
    "parish": "St. Thomas",
    "distanceKm": 7.5,
    "taFareJmd": 170,
    "slug": "wheelerfield-to-golden-grove"
  },
  {
    "origin": "Albion",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 4.4,
    "taFareJmd": 140,
    "slug": "albion-to-morant-bay"
  },
  {
    "origin": "Arcadia",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 21,
    "taFareJmd": 260,
    "slug": "arcadia-to-morant-bay"
  },
  {
    "origin": "Bachelor's Hall",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 18.5,
    "taFareJmd": 240,
    "slug": "bachelor-s-hall-to-morant-bay"
  },
  {
    "origin": "Barking Lodge",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 32,
    "taFareJmd": 340,
    "slug": "barking-lodge-to-morant-bay"
  },
  {
    "origin": "Bath",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 30,
    "taFareJmd": 320,
    "slug": "bath-to-morant-bay"
  },
  {
    "origin": "Cedar Valley",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 24.1,
    "taFareJmd": 280,
    "slug": "cedar-valley-to-morant-bay"
  },
  {
    "origin": "Dalvey",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 27,
    "taFareJmd": 300,
    "slug": "dalvey-to-morant-bay"
  },
  {
    "origin": "Danvers Pen",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 24.1,
    "taFareJmd": 280,
    "slug": "danvers-pen-to-morant-bay"
  },
  {
    "origin": "Duhaney Pen",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 12.8,
    "taFareJmd": 200,
    "slug": "duhaney-pen-to-morant-bay"
  },
  {
    "origin": "Easington",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 2.8,
    "taFareJmd": 130,
    "slug": "easington-to-morant-bay"
  },
  {
    "origin": "Font Hill",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 30,
    "taFareJmd": 320,
    "slug": "font-hill-to-morant-bay"
  },
  {
    "origin": "Golden Grove",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 12,
    "taFareJmd": 200,
    "slug": "golden-grove-to-morant-bay"
  },
  {
    "origin": "Golden Valley",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 22.7,
    "taFareJmd": 270,
    "slug": "golden-valley-to-morant-bay"
  },
  {
    "origin": "Hillside",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 22.4,
    "taFareJmd": 270,
    "slug": "hillside-to-morant-bay"
  },
  {
    "origin": "Johns Town",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 15,
    "taFareJmd": 220,
    "slug": "johns-town-to-morant-bay"
  },
  {
    "origin": "Llandewey",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 5.6,
    "taFareJmd": 150,
    "slug": "llandewey-to-morant-bay"
  },
  {
    "origin": "Lloyds",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 34,
    "taFareJmd": 350,
    "slug": "lloyds-to-morant-bay"
  },
  {
    "origin": "Middleton",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 24.1,
    "taFareJmd": 280,
    "slug": "middleton-to-morant-bay"
  },
  {
    "origin": "New Pera",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 7,
    "taFareJmd": 170,
    "slug": "new-pera-to-morant-bay"
  },
  {
    "origin": "Port Morant",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 15.5,
    "taFareJmd": 200,
    "slug": "port-morant-to-morant-bay"
  },
  {
    "origin": "Prospect",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 12,
    "taFareJmd": 190,
    "slug": "prospect-to-morant-bay"
  },
  {
    "origin": "Ramble",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 11.5,
    "taFareJmd": 170,
    "slug": "ramble-to-morant-bay"
  },
  {
    "origin": "Sunning Hill",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 9,
    "taFareJmd": 160,
    "slug": "sunning-hill-to-morant-bay"
  },
  {
    "origin": "White Hall",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 30.4,
    "taFareJmd": 330,
    "slug": "white-hall-to-morant-bay"
  },
  {
    "origin": "White Horses",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 9.7,
    "taFareJmd": 180,
    "slug": "white-horses-to-morant-bay"
  },
  {
    "origin": "Wilmington",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 9,
    "taFareJmd": 180,
    "slug": "wilmington-to-morant-bay"
  },
  {
    "origin": "Winchester",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 8.5,
    "taFareJmd": 170,
    "slug": "winchester-to-morant-bay"
  },
  {
    "origin": "Yallahs",
    "destination": "Morant Bay",
    "parish": "St. Thomas",
    "distanceKm": 19.1,
    "taFareJmd": 250,
    "slug": "yallahs-to-morant-bay"
  },
  {
    "origin": "Aelous Valley",
    "destination": "Yallahs",
    "parish": "St. Thomas",
    "distanceKm": 19,
    "taFareJmd": 250,
    "slug": "aelous-valley-to-yallahs"
  },
  {
    "origin": "Llandewey",
    "destination": "Yallahs",
    "parish": "St. Thomas",
    "distanceKm": 8.4,
    "taFareJmd": 170,
    "slug": "llandewey-to-yallahs"
  },
  {
    "origin": "Lloyds",
    "destination": "Yallahs",
    "parish": "St. Thomas",
    "distanceKm": 11.3,
    "taFareJmd": 190,
    "slug": "lloyds-to-yallahs"
  },
  {
    "origin": "Norris",
    "destination": "Yallahs",
    "parish": "St. Thomas",
    "distanceKm": 4.5,
    "taFareJmd": 140,
    "slug": "norris-to-yallahs"
  },
  {
    "origin": "Ramble",
    "destination": "Yallahs",
    "parish": "St. Thomas",
    "distanceKm": 7,
    "taFareJmd": 160,
    "slug": "ramble-to-yallahs"
  },
  {
    "origin": "Swamp Road",
    "destination": "Yallahs",
    "parish": "St. Thomas",
    "distanceKm": 18,
    "taFareJmd": 240,
    "slug": "swamp-road-to-yallahs"
  }
];
