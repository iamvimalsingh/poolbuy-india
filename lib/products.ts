import { StandardProduct } from '@/types';

/**
 * Standardized reusable product definitions.
 * The same product definition can be deployed across multiple cities as independent pools.
 */
export const STANDARD_PRODUCTS: StandardProduct[] = [
  {
    id: 'prod-tvs-iqube',
    name: 'TVS iQube Electric Scooter',
    slug: 'tvs-iqube-electric-scooter-bulk-deal',
    category: 'EV_SCOOTERS',
    brand: 'TVS',
    model: 'iQube',
    shortDescription: 'Explore a city-level bulk-buy price for an electric scooter with verified local dealerships.',
    longDescription:
      'Standardized product specification. Final on-road price, variant, insurance, registration, subsidy eligibility, dealer stock, and any bulk discount must be confirmed in writing by an authorized dealership in your city.',
    defaultMarketPrice: 145000,
    defaultGroupPrice: 130000,
    defaultTargetBuyers: 10,
  },
  {
    id: 'prod-ather-450x',
    name: 'Ather 450X Electric Scooter',
    slug: 'ather-450x-electric-scooter-bulk-buy',
    category: 'EV_SCOOTERS',
    brand: 'Ather',
    model: '450X Gen 3',
    shortDescription: 'Collective purchasing power for the performance electric scooter with local authorized experience centers.',
    longDescription:
      'Standardized product specification. 3.7 kWh battery pack, certified range, fast charging compatibility, subsidy processing, and registration handled directly at the authorized showroom.',
    defaultMarketPrice: 155000,
    defaultGroupPrice: 142000,
    defaultTargetBuyers: 8,
  },
  {
    id: 'prod-hyundai-exter',
    name: 'Hyundai Exter — City Group Deal',
    slug: 'hyundai-exter-city-group-deal',
    category: 'CARS',
    brand: 'Hyundai',
    model: 'Exter',
    shortDescription: 'Register interest in a city-level group quotation for a compact SUV.',
    longDescription:
      'Standardized product specification. Variant, fuel type, model year, registration, insurance, accessories, and local dealership terms determine the final quotation.',
    defaultMarketPrice: 875000,
    defaultGroupPrice: 825000,
    defaultTargetBuyers: 15,
  },
  {
    id: 'prod-rooftop-solar-3kw',
    name: '3 kW Rooftop Solar Complete Kit',
    slug: '3kw-rooftop-solar-bulk-installation',
    category: 'ROOFTOP_SOLAR',
    brand: 'Tier-1 Mono PERC / TopCon',
    model: '3 kW Residential On-Grid',
    shortDescription: 'Standardized 3 kW residential rooftop solar complete installation package.',
    longDescription:
      'Standardized product specification. Total pre-subsidy price shown separately from PM Surya Ghar Muft Bijli Yojana subsidy estimate (up to ₹78,000 for 3 kW). Subsidy is a direct government benefit subject to DISCOM commissioning and portal approval. Package includes TopCon / Mono-PERC modules, grid-tied inverter, ACDB/DCDB, earthing & lightning arresters, galvanized structure, and net-metering liaison.',
    defaultMarketPrice: 210000,
    defaultGroupPrice: 185000,
    defaultTargetBuyers: 10,
    defaultKits: [
      {
        id: 'kit-solar-3kw-standard',
        name: '3 kW Standard Mono-PERC Kit',
        sku: 'SOLAR-3KW-STD',
        brand: 'Tier-1 Mono PERC',
        model: '3 kW Grid-Tied System',
        inclusions: [
          '540Wp+ DCR Mono PERC Half-Cut Panels (3.2 kWp DC array)',
          '3 kW Single-Phase Grid-Tied Inverter (IP65, WiFi data logger)',
          'Dual Earthing Pits (Chemical Copper-Bonded) & Class-A Lightning Arrester',
          'ACDB & DCDB with Type-II Surge Protection Devices (SPD)',
          'Hot-Dip Galvanized (HDG) GI Mounting Structure (140 km/h wind tested)',
          'UV-Resistant DC/AC Solar Cabling in Conduit',
          'DISCOM Net-Metering Application Assistance & Commissioning Survey',
          'Standard Rooftop Installation & 5-Year Workmanship Warranty',
        ],
        exclusions: [
          'Elevated or walkable gazebo rooftop structures (available as surveyed add-on)',
          'DISCOM meter testing / processing fees payable directly to utility',
          'Heavy civil masonry reinforcement if roof requires waterproofing',
        ],
        warranty: '25-yr panel performance, 10-yr inverter warranty, 5-yr installation warranty',
        marketPrice: 210000,
        groupPrice: 185000,
        subsidyEstimate: 78000,
        subsidyDisclaimer: 'Estimated PM Surya Ghar DBT subsidy. Actual disbursement subject to DISCOM inspection and National Portal approval.',
        targetBuyers: 10,
        currentBuyers: 0,
        isAvailable: true,
        sortOrder: 1,
      },
      {
        id: 'kit-solar-3kw-topcon',
        name: '3 kW Premium N-Type TopCon Bifacial Kit',
        sku: 'SOLAR-3KW-TOPCON',
        brand: 'Tier-1 TopCon Bifacial',
        model: '3.3 kWp High-Yield N-Type Package',
        inclusions: [
          '580Wp N-Type TopCon Bifacial Dual-Glass Panels (up to 25% rear gain)',
          '3.3 kW High-Efficiency Dual MPPT Inverter with Rapid Shutdown Support',
          'Triple Earthing Pits with Heavy-Duty Earth Enhancing Compound',
          'Advanced AC/DC Disconnect Enclosure with Visual Trip Indicators',
          'Anodized Aluminium Elevated Mounting Structure with SS304 Fasteners',
          'Complete Net-Metering File Preparation and DISCOM Liaison',
        ],
        exclusions: ['Custom high-rise scaffolding beyond standard 2 storeys'],
        warranty: '30-yr dual-glass performance, 12-yr inverter replacement warranty',
        marketPrice: 245000,
        groupPrice: 215000,
        subsidyEstimate: 78000,
        subsidyDisclaimer: 'Estimated PM Surya Ghar DBT subsidy. Disbursed directly to buyer bank account by MNRE.',
        targetBuyers: 8,
        currentBuyers: 0,
        isAvailable: true,
        sortOrder: 2,
      },
    ],
  },
  {
    id: 'prod-rooftop-solar-5kw',
    name: '5 kW Rooftop Solar Complete Kit',
    slug: '5kw-rooftop-solar-bulk-installation',
    category: 'ROOFTOP_SOLAR',
    brand: 'Tier-1 High-Efficiency',
    model: '5 kW Residential Dual-MPPT Package',
    shortDescription: 'Complete 5 kW turnkey rooftop solar package for medium-to-large residential homes.',
    longDescription:
      'Standardized product specification. Total pre-subsidy price shown separately from PM Surya Ghar Muft Bijli Yojana subsidy estimate (₹78,000 max central subsidy for 3 kW+). Actual disbursement subject to MNRE portal verification and local DISCOM net-metering synchronization. Package includes 5.4 kWp Tier-1 panels, 5 kW string inverter, dual-layer surge protection, certified earthing, and turnkey installation.',
    defaultMarketPrice: 325000,
    defaultGroupPrice: 285000,
    defaultTargetBuyers: 8,
    defaultKits: [
      {
        id: 'kit-solar-5kw-standard',
        name: '5 kW Turnkey Grid-Tied Kit',
        sku: 'SOLAR-5KW-STD',
        brand: 'Tier-1 TopCon Mono',
        model: '5 kW Dual MPPT System',
        inclusions: [
          '550Wp+ DCR TopCon Solar Panels (5.5 kWp DC capacity)',
          '5 kW 3-Phase / 1-Phase Grid-Tied Inverter with Mobile App Monitoring',
          '3 Dedicated Earthing Pits (Inverter, DCDB, Lightning Arrester)',
          'ACDB with 4-Pole MCB & DCDB with High-Voltage Surge Arresters',
          'Pre-Engineered Hot-Dip Galvanized Rooftop Structure',
          'Turnkey Net-Metering Documentation & DISCOM Inspection Liaison',
          'Full Professional Installation & System Testing',
        ],
        exclusions: ['Site-specific high-rise elevated structure add-ons'],
        warranty: '25-yr linear power warranty, 10-yr inverter warranty, 5-yr workmanship warranty',
        marketPrice: 325000,
        groupPrice: 285000,
        subsidyEstimate: 78000,
        subsidyDisclaimer: 'PM Surya Ghar central DBT capped at ₹78,000 for systems 3 kW and above.',
        targetBuyers: 8,
        currentBuyers: 0,
        isAvailable: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: 'prod-power-backup-combo',
    name: 'Home Power-Backup Combo (Inverter + 200 Ah Battery)',
    slug: 'home-power-backup-inverter-200ah-battery-combo',
    category: 'ROOFTOP_SOLAR',
    brand: 'Pure Sine Wave Inverter + Tubular Battery',
    model: '1100VA Inverter + 200 Ah Battery + Modular Trolley',
    shortDescription: 'Heavy-duty residential inverter and 200 Ah tall-tubular battery combo with modular trolley.',
    longDescription:
      'Standardized package specification. High-efficiency pure sine wave inverter paired with a genuine 200 Ah heavy-duty tall-tubular battery for uninterrupted home power during grid outages. Includes heavy-duty caster-wheel trolley, copper interconnect cables, delivery, and standard residential installation.',
    defaultMarketPrice: 28500,
    defaultGroupPrice: 24800,
    defaultTargetBuyers: 12,
    defaultKits: [
      {
        id: 'kit-backup-200ah-standard',
        name: '1100VA Pure Sine Wave + 200 Ah Tubular Battery Combo',
        sku: 'BACKUP-1100VA-200AH',
        brand: 'Authorized OEM Certified',
        model: '1100VA / 12V + 200 Ah C20 Tall Tubular',
        inclusions: [
          '1100VA / 12V Pure Sine Wave Inverter (supports LED TV, refrigerator, fans, lights)',
          '200 Ah @ C20 Heavy-Duty Tall Tubular Battery (High Acid Volume)',
          'Heavy-Duty Modular Shockproof Battery Trolley with smooth swivel wheels',
          'High-Grade Pure Copper Interconnecting Battery Cables with Insulated Terminals',
          'Doorstep Unboxing, Battery Terminal Petroleum Jelly Coating & Installation',
          'Official GST Tax Invoice & Manufacturer Warranty Cards',
        ],
        exclusions: ['Dedicated internal home sub-distribution board rewiring beyond standard inverter connection'],
        warranty: '36-month inverter warranty, 60-month (36 free replacement + 24 pro-rata) battery warranty',
        marketPrice: 28500,
        groupPrice: 24800,
        targetBuyers: 12,
        currentBuyers: 0,
        isAvailable: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: 'prod-water-softener',
    name: 'Whole-House Water Softener Kit',
    slug: 'whole-house-water-softener-kit',
    category: 'ROOFTOP_SOLAR',
    brand: 'Automatic Food-Grade Ion Exchange',
    model: 'Automatic 28L Resin Residential Softener',
    shortDescription: 'Residential whole-house water softener kit with automatic metered regeneration valve.',
    longDescription:
      'Standardized home-use water treatment package designed to eliminate scale build-up and hardness from bathroom fittings, geysers, appliances, and overhead piping. Features high-exchange food-grade resin, metered digital automatic regeneration, multi-port bypass, and 20-inch jumbo pre-filter.',
    defaultMarketPrice: 42000,
    defaultGroupPrice: 36500,
    defaultTargetBuyers: 10,
    defaultKits: [
      {
        id: 'kit-softener-28l-auto',
        name: 'Whole-House 28L Auto-Regeneration Softener Package',
        sku: 'SOFTENER-28L-AUTO',
        brand: 'High-Exchange Food-Grade',
        model: '28-Litre Metered Auto-Valve Package',
        inclusions: [
          'Automatic Digital Metered Multi-Port Regeneration Control Valve',
          '28 Litres of Premium NSF/Food-Grade Strong Acid Cation Exchange Resin',
          '10x44 Reinforced FRP Mineral Vessel (corrosion-proof, 10 bar burst tested)',
          '70-Litre High-Density Brine Tank with Safety Brine Valve & Grid Plate',
          '20-Inch Jumbo Sediment Pre-Filter with Housing & 5-Micron Polypropylene Spun Candle',
          '3-Valve Bypass Assembly for easy maintenance without interrupting mains supply',
          'Standard Plumbing Connection to Overhead Tank Line & Initial Hardness Test Testing Kit',
          'Initial 25 kg High-Purity Tablet Salt Bag for Commissioning',
        ],
        exclusions: ['Electrical socket provision near overhead tank if missing', 'Major civil plumbing rerouting'],
        warranty: '2-Year Comprehensive on Multi-Port Valve, 5-Year on FRP Tank Vessel',
        marketPrice: 42000,
        groupPrice: 36500,
        targetBuyers: 10,
        currentBuyers: 0,
        isAvailable: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: 'prod-macbook-air',
    name: 'MacBook Air — Laptop Group Buy',
    slug: 'macbook-air-laptop-group-buy',
    category: 'LAPTOPS',
    brand: 'Apple',
    model: 'MacBook Air M3',
    shortDescription: 'Collect purchase intent for a bulk laptop quotation from authorized corporate resellers.',
    longDescription:
      'Standardized product specification. Confirm exact chip, unified memory, SSD storage, GST tax invoice, Apple warranty, and authorized reseller terms before relying on any quotation.',
    defaultMarketPrice: 104900,
    defaultGroupPrice: 96000,
    defaultTargetBuyers: 15,
  },
  {
    id: 'prod-55-qled-tv',
    name: '55-inch QLED Smart TV',
    slug: '55-inch-qled-smart-tv-group-deal',
    category: 'SMART_TVS',
    brand: 'Multiple brands',
    model: '55-inch QLED 4K',
    shortDescription: 'Gather local demand for a 55-inch QLED television group quotation with authorized regional electronics distributors.',
    longDescription:
      'Standardized product specification. Brand, model, panel specifications, installation, wall-mount, and warranty vary; final dealer invoice and authorized delivery is required.',
    defaultMarketPrice: 72990,
    defaultGroupPrice: 64990,
    defaultTargetBuyers: 10,
  },
  {
    id: 'prod-mahindra-tractor',
    name: 'Mahindra 575 DI XP Plus Tractor',
    slug: 'mahindra-tractor-commercial-group-buy',
    category: 'TRACTORS_COMMERCIAL',
    brand: 'Mahindra',
    model: '575 DI XP Plus',
    shortDescription: 'Explore bulk-buy demand for a farm tractor in regional agricultural hubs.',
    longDescription:
      'Standardized product specification. Horsepower class, implements, delivery, commercial taxes, agriculture financing, and dealership stock can change final on-road terms.',
    defaultMarketPrice: 840000,
    defaultGroupPrice: 790000,
    defaultTargetBuyers: 5,
  },
];

interface GlobalStoreWithProducts {
  __poolbuy_standard_products?: StandardProduct[];
}

export function getStandardProducts(): StandardProduct[] {
  const g = globalThis as unknown as GlobalStoreWithProducts;
  return [...(g.__poolbuy_standard_products || STANDARD_PRODUCTS)];
}

export function getStandardProductBySlug(slug: string): StandardProduct | null {
  const products = getStandardProducts();
  return products.find((p) => p.slug === slug) || null;
}

export function addStandardProduct(product: StandardProduct): void {
  const g = globalThis as unknown as GlobalStoreWithProducts;
  if (!g.__poolbuy_standard_products) {
    g.__poolbuy_standard_products = [...STANDARD_PRODUCTS];
  }
  g.__poolbuy_standard_products.unshift(product);
}

