/**
 * Curated catalog of vehicles a Rajlo driver can register. Used by:
 *   - Driver onboarding wizard
 *   - Driver vehicle-change request flow
 *   - Admin review screens
 *
 * The list is deliberately Jamaica-market-relevant — predominantly
 * Japanese imports (Toyota / Nissan / Honda / Mazda / Mitsubishi /
 * Suzuki) plus the Korean and German brands that show up on the
 * road. Every model entry below has been seen on a Jamaican PPV
 * red-plate vehicle.
 *
 * To add a model: drop it into the brand's array. To add a brand:
 * register it in BRAND_DEFINITIONS. The dropdowns are
 * data-driven, so no UI changes are needed.
 */

export const VEHICLE_TYPES = [
  "Sedan",
  "Hatchback",
  "Wagon",
  "SUV",
  "Crossover",
  "Coupe",
  "Pickup",
  "Van",
  "Minibus",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_COLORS = [
  "White",
  "Silver",
  "Grey",
  "Black",
  "Red",
  "Blue",
  "Green",
  "Gold",
  "Beige",
  "Brown",
  "Maroon",
  "Orange",
  "Yellow",
  "Navy",
] as const;
export type VehicleColor = (typeof VEHICLE_COLORS)[number];

/**
 * Year range — bounded at 1990 (anything older won't pass TA's
 * Certificate of Fitness inspection on JM PPV requirements) and
 * +1 from today (so a brand-new model-year vehicle entering at the
 * top of the year is registrable).
 */
export const MIN_VEHICLE_YEAR = 1990;
export function maxVehicleYear(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}
export function vehicleYearOptions(now: Date = new Date()): number[] {
  const max = maxVehicleYear(now);
  const years: number[] = [];
  for (let y = max; y >= MIN_VEHICLE_YEAR; y--) years.push(y);
  return years;
}

/**
 * Brand definition — the brand label plus the models registered
 * under it. Models stay flat (no nested trims) because TA-side
 * documentation only needs the model line.
 */
type BrandDefinition = {
  name: string;
  models: string[];
};

const BRAND_DEFINITIONS: BrandDefinition[] = [
  {
    name: "Toyota",
    models: [
      "Corolla",
      "Axio",
      "Fielder",
      "Camry",
      "Vitz",
      "Yaris",
      "Auris",
      "Allion",
      "Premio",
      "Avensis",
      "Wish",
      "Voxy",
      "Noah",
      "Hiace",
      "Coaster",
      "Probox",
      "Succeed",
      "Hilux",
      "RAV4",
      "Harrier",
      "Land Cruiser",
      "Land Cruiser Prado",
      "Fortuner",
      "Mark X",
      "Crown",
    ],
  },
  {
    name: "Honda",
    models: [
      "Civic",
      "Accord",
      "Fit",
      "Insight",
      "Stream",
      "Stepwgn",
      "Odyssey",
      "CR-V",
      "HR-V",
      "Pilot",
      "Vezel",
      "City",
      "Freed",
    ],
  },
  {
    name: "Nissan",
    models: [
      "AD Wagon",
      "AD Van",
      "Tiida",
      "Sunny",
      "Note",
      "Latio",
      "March",
      "Wingroad",
      "Bluebird Sylphy",
      "X-Trail",
      "Qashqai",
      "Juke",
      "Murano",
      "Pathfinder",
      "Caravan",
      "NV200",
      "Frontier",
      "Navara",
    ],
  },
  {
    name: "Mazda",
    models: [
      "Mazda2",
      "Mazda3",
      "Mazda6",
      "Demio",
      "Familia",
      "Axela",
      "Atenza",
      "CX-3",
      "CX-5",
      "CX-7",
      "MPV",
      "Premacy",
      "Bongo",
      "BT-50",
    ],
  },
  {
    name: "Mitsubishi",
    models: [
      "Mirage",
      "Lancer",
      "Galant",
      "Colt",
      "ASX",
      "Outlander",
      "Pajero",
      "Pajero Sport",
      "Triton",
      "L200",
      "Delica",
    ],
  },
  {
    name: "Suzuki",
    models: [
      "Alto",
      "Swift",
      "Wagon R",
      "Solio",
      "Baleno",
      "Vitara",
      "Grand Vitara",
      "Jimny",
      "APV",
      "Carry",
    ],
  },
  {
    name: "Subaru",
    models: [
      "Impreza",
      "Legacy",
      "Forester",
      "Outback",
      "XV",
      "Crosstrek",
      "Sambar",
    ],
  },
  {
    name: "Kia",
    models: [
      "Picanto",
      "Rio",
      "Cerato",
      "Forte",
      "K3",
      "Sportage",
      "Sorento",
      "Carnival",
      "Soul",
    ],
  },
  {
    name: "Hyundai",
    models: [
      "i10",
      "i20",
      "Accent",
      "Elantra",
      "Sonata",
      "Tucson",
      "Santa Fe",
      "Creta",
      "H1",
      "Starex",
    ],
  },
  {
    name: "Ford",
    models: ["Fiesta", "Focus", "Escape", "EcoSport", "Ranger", "Transit"],
  },
  {
    name: "Chevrolet",
    models: ["Spark", "Aveo", "Cruze", "Trax", "Captiva"],
  },
  {
    name: "Mercedes-Benz",
    models: [
      "A-Class",
      "C-Class",
      "E-Class",
      "S-Class",
      "GLA",
      "GLC",
      "GLE",
      "Sprinter",
      "Vito",
    ],
  },
  {
    name: "BMW",
    models: ["1 Series", "3 Series", "5 Series", "7 Series", "X1", "X3", "X5"],
  },
  {
    name: "Audi",
    models: ["A3", "A4", "A6", "Q3", "Q5", "Q7"],
  },
  {
    name: "Volkswagen",
    models: ["Polo", "Golf", "Jetta", "Passat", "Tiguan", "Touareg"],
  },
  {
    name: "Isuzu",
    models: ["D-Max", "MU-X"],
  },
];

/** Sorted brand name list — drives the brand dropdown. */
export const VEHICLE_BRANDS = BRAND_DEFINITIONS.map((b) => b.name).sort();

/** Map of brand → models (sorted within each brand). */
export const VEHICLE_MODELS_BY_BRAND: Record<string, readonly string[]> =
  Object.freeze(
    Object.fromEntries(
      BRAND_DEFINITIONS.map((b) => [b.name, [...b.models].sort()]),
    ),
  );

export function modelsForBrand(brand: string | null): readonly string[] {
  if (!brand) return [];
  return VEHICLE_MODELS_BY_BRAND[brand] ?? [];
}

/* ─────────── Validation helpers ─────────── */

/**
 * Type-guard a candidate vehicle spec against the catalog. Returns
 * null when it passes; an error string explaining the first failed
 * check otherwise. Used by both the driver-side submit and the
 * admin approve handler so an invalid combo never lands in the DB.
 */
export function validateVehicleSpec(spec: {
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
}): string | null {
  if (!spec.type || !VEHICLE_TYPES.includes(spec.type as VehicleType)) {
    return "Pick a vehicle type from the list.";
  }
  if (!spec.brand || !VEHICLE_BRANDS.includes(spec.brand)) {
    return "Pick a brand from the list.";
  }
  if (!spec.model || !modelsForBrand(spec.brand).includes(spec.model)) {
    return "Pick a model from the list for that brand.";
  }
  const max = maxVehicleYear();
  if (
    typeof spec.year !== "number" ||
    !Number.isInteger(spec.year) ||
    spec.year < MIN_VEHICLE_YEAR ||
    spec.year > max
  ) {
    return `Year must be between ${MIN_VEHICLE_YEAR} and ${max}.`;
  }
  if (!spec.color || !VEHICLE_COLORS.includes(spec.color as VehicleColor)) {
    return "Pick a colour from the list.";
  }
  return null;
}
