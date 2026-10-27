import {
  PublicPool,
  AdminPool,
  PoolLead,
  JoinPoolInput,
  JoinPoolResult,
  City,
  Category,
  PoolRequest,
  StandardProduct,
  PoolKitOffer,
  VendorPriceTier,
  PriceHistoryEntry,
  BlogPost,
} from '@/types';
import { STANDARD_PRODUCTS } from './products';

// Static ISO timestamps for stable prerendering
const addDays = (days: number) => {
  // Computed stably from fixed base timestamp 2026-10-26
  const baseMs = 1792929600000; // 2026-10-26T12:00:00.000Z
  return new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString();
};
const createdDate = '2026-10-24T12:00:00.000Z';

import { getAllSelectableCities } from './location-directory';

const ALL_DIRECTORY_CITIES = getAllSelectableCities();
const LAUNCH_OPERATIONAL_SLUGS = new Set([
  'bhopal',
  'indore',
  'pune',
  'delhi',
  'mumbai',
  'banda',
  'jaipur',
]);

export const INITIAL_MOCK_CITIES: City[] = ALL_DIRECTORY_CITIES.map((city) => {
  const isOperational = LAUNCH_OPERATIONAL_SLUGS.has(city.slug);
  return {
    ...city,
    isActive: isOperational,
    availabilityState: isOperational ? 'ACTIVE' : city.availabilityState,
  };
});

const INITIAL_MOCK_POOLS: PublicPool[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'tvs-iqube-electric-scooter-bulk-deal',
    name: 'TVS iQube Electric Scooter',
    shortDescription: 'Explore a possible city-level bulk-buy price for an electric scooter.',
    longDescription:
      'Illustrative demo estimate only. Final on-road price, variant, insurance, registration, subsidy eligibility, dealer stock and any discount must be confirmed in writing by an authorized dealer.',
    category: 'EV_SCOOTERS',
    city: 'Bhopal',
    citySlug: 'bhopal',
    productBrand: 'TVS',
    productModel: 'iQube',
    imageUrl: null,
    marketPrice: 145000,
    groupPrice: 130000,
    targetBuyers: 10,
    currentBuyers: 0,
    deadline: addDays(10),
    status: 'ACTIVE',
    priceIsVerified: false,
    priceVerifiedAt: null,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: '11111111-1111-4111-8111-indore000001',
    slug: 'tvs-iqube-electric-scooter-bulk-deal',
    name: 'TVS iQube Electric Scooter',
    shortDescription: 'Explore a possible city-level bulk-buy price for an electric scooter in Indore.',
    longDescription:
      'Illustrative demo estimate only. Final on-road price, variant, insurance, registration, subsidy eligibility, dealer stock and any discount must be confirmed in writing by an authorized Indore dealer.',
    category: 'EV_SCOOTERS',
    city: 'Indore',
    citySlug: 'indore',
    productBrand: 'TVS',
    productModel: 'iQube',
    imageUrl: null,
    marketPrice: 145000,
    groupPrice: 129000,
    targetBuyers: 12,
    currentBuyers: 0,
    deadline: addDays(11),
    status: 'ACTIVE',
    priceIsVerified: false,
    priceVerifiedAt: null,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'hyundai-exter-city-group-deal',
    name: 'Hyundai Exter — City Group Deal',
    shortDescription: 'Register interest in a city-level group quotation for a compact SUV.',
    longDescription:
      'Illustrative demo estimate only. Variant, fuel type, model year, registration, insurance, accessories and dealer terms determine the final quotation.',
    category: 'CARS',
    city: 'Indore',
    citySlug: 'indore',
    productBrand: 'Hyundai',
    productModel: 'Exter',
    imageUrl: null,
    marketPrice: 875000,
    groupPrice: 825000,
    targetBuyers: 15,
    currentBuyers: 0,
    deadline: addDays(12),
    status: 'ACTIVE',
    priceIsVerified: false,
    priceVerifiedAt: null,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    slug: '3kw-rooftop-solar-bulk-installation',
    name: '3 kW Rooftop Solar Complete Kit',
    shortDescription: 'Standardized 3 kW residential rooftop solar complete installation package in Bhopal.',
    longDescription:
      'Standardized product specification. Total pre-subsidy price shown separately from PM Surya Ghar Muft Bijli Yojana subsidy estimate (up to ₹78,000 for 3 kW). Package includes Tier-1 panels, grid-tied inverter, ACDB/DCDB, dual earthing & lightning arrester, hot-dip galvanized mounting structure, and DISCOM net-metering liaison in Bhopal.',
    category: 'ROOFTOP_SOLAR',
    city: 'Bhopal',
    citySlug: 'bhopal',
    productBrand: 'Tier-1 Mono PERC / TopCon',
    productModel: '3 kW Residential On-Grid',
    imageUrl: null,
    marketPrice: 210000,
    groupPrice: 185000,
    targetBuyers: 10,
    currentBuyers: 0,
    deadline: addDays(14),
    status: 'ACTIVE',
    priceIsVerified: true,
    priceVerifiedAt: '2026-10-25T10:00:00.000Z',
    createdAt: createdDate,
    updatedAt: createdDate,
    kitOffers: [
      {
        id: 'kit-bhopal-solar-3kw-std',
        poolId: '33333333-3333-4333-8333-333333333333',
        name: '3 kW Standard Mono-PERC Kit',
        sku: 'SOLAR-3KW-BPL-STD',
        brand: 'Tier-1 Mono PERC',
        model: '3 kW Grid-Tied System',
        inclusions: [
          '540Wp+ DCR Mono PERC Half-Cut Panels (3.2 kWp DC array)',
          '3 kW Single-Phase Grid-Tied Inverter (IP65, WiFi)',
          'Dual Chemical Copper-Bonded Earthing Pits & Lightning Arrester',
          'ACDB & DCDB with Type-II SPDs',
          'Hot-Dip Galvanized GI Mounting Structure (140 km/h wind rated)',
          'UV-Resistant DC/AC Solar Cabling in Conduit',
          'Bhopal MPMKVVCL Net-Metering Liaison & Inspection Assistance',
          'Standard Rooftop Installation & 5-Year Workmanship Warranty',
        ],
        exclusions: ['Elevated walkable structures', 'Utility DISCOM meter testing fees'],
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
        id: 'kit-bhopal-solar-3kw-topcon',
        poolId: '33333333-3333-4333-8333-333333333333',
        name: '3 kW Premium N-Type TopCon Bifacial Kit',
        sku: 'SOLAR-3KW-BPL-TOPCON',
        brand: 'Tier-1 TopCon Bifacial',
        model: '3.3 kWp High-Yield N-Type Package',
        inclusions: [
          '580Wp N-Type TopCon Bifacial Dual-Glass Panels',
          '3.3 kW Dual MPPT Inverter with WiFi',
          'Triple Chemical Earthing Pits with Heavy-Duty Compound',
          'Heavy-Duty Anodized Aluminium Mounting Structure',
          'Turnkey MPMKVVCL Net-Metering Application Assistance',
        ],
        exclusions: ['Custom high-rise scaffolding above 2 floors'],
        warranty: '30-yr dual-glass performance, 12-yr inverter replacement warranty',
        marketPrice: 245000,
        groupPrice: 215000,
        subsidyEstimate: 78000,
        subsidyDisclaimer: 'Estimated PM Surya Ghar DBT subsidy.',
        targetBuyers: 8,
        currentBuyers: 0,
        isAvailable: true,
        sortOrder: 2,
      },
    ],
    priceTiers: [
      {
        id: 'tier-bhopal-solar-3kw-1',
        poolId: '33333333-3333-4333-8333-333333333333',
        minQuantity: 5,
        maxQuantity: 9,
        pricePerUnit: 190000,
        vendorName: 'Madhya Bharat Solar EPC Pvt Ltd',
        validUntil: addDays(30),
        isApproved: true,
        notes: 'Pre-subsidy price tier confirmed for Bhopal municipal area.',
      },
      {
        id: 'tier-bhopal-solar-3kw-2',
        poolId: '33333333-3333-4333-8333-333333333333',
        minQuantity: 10,
        maxQuantity: null,
        pricePerUnit: 185000,
        vendorName: 'Madhya Bharat Solar EPC Pvt Ltd',
        validUntil: addDays(30),
        isApproved: true,
        notes: 'Full group rate unlocked when cohort reaches 10 verified buyers.',
      },
    ],
  },
  {
    id: '33333333-3333-4333-8333-indore000003',
    slug: '3kw-rooftop-solar-bulk-installation',
    name: '3 kW Rooftop Solar Complete Kit',
    shortDescription: 'Standardized 3 kW residential rooftop solar complete installation package in Indore.',
    longDescription:
      'Standardized product specification. Total pre-subsidy price shown separately from PM Surya Ghar Muft Bijli Yojana subsidy estimate (up to ₹78,000 for 3 kW). Inclusions: Tier-1 panels, 3 kW grid-tied inverter, dual earthing & lightning protection, and MPPKVVCL net-metering liaison.',
    category: 'ROOFTOP_SOLAR',
    city: 'Indore',
    citySlug: 'indore',
    productBrand: 'Tier-1 Mono PERC',
    productModel: '3 kW Residential On-Grid',
    imageUrl: null,
    marketPrice: 210000,
    groupPrice: 182000,
    targetBuyers: 8,
    currentBuyers: 0,
    deadline: addDays(16),
    status: 'ACTIVE',
    priceIsVerified: true,
    priceVerifiedAt: '2026-10-25T11:00:00.000Z',
    createdAt: createdDate,
    updatedAt: createdDate,
    kitOffers: [
      {
        id: 'kit-indore-solar-3kw-std',
        poolId: '33333333-3333-4333-8333-indore000003',
        name: '3 kW Standard Mono-PERC Kit',
        sku: 'SOLAR-3KW-IDR-STD',
        brand: 'Tier-1 Mono PERC',
        model: '3 kW Grid-Tied System',
        inclusions: [
          '540Wp+ DCR Mono PERC Half-Cut Panels (3.2 kWp DC array)',
          '3 kW Single-Phase Grid-Tied Inverter (IP65)',
          'Dual Earthing Pits & Class-A Lightning Protection',
          'Hot-Dip Galvanized GI Mounting Structure',
          'Indore MPPKVVCL Net-Metering Liaison & Commissioning',
        ],
        exclusions: ['Elevated gazebo structures'],
        warranty: '25-yr panel performance, 10-yr inverter warranty',
        marketPrice: 210000,
        groupPrice: 182000,
        subsidyEstimate: 78000,
        subsidyDisclaimer: 'Estimated PM Surya Ghar DBT subsidy.',
        targetBuyers: 8,
        currentBuyers: 0,
        isAvailable: true,
        sortOrder: 1,
      },
    ],
    priceTiers: [
      {
        id: 'tier-indore-solar-3kw-1',
        poolId: '33333333-3333-4333-8333-indore000003',
        minQuantity: 8,
        maxQuantity: null,
        pricePerUnit: 182000,
        vendorName: 'Malwa Green Energy Solutions LLP',
        validUntil: addDays(30),
        isApproved: true,
        notes: 'Pre-subsidy rate approved for Indore urban limits.',
      },
    ],
  },
  {
    id: '33333333-5kw-4333-8333-bhopal000005',
    slug: '5kw-rooftop-solar-bulk-installation',
    name: '5 kW Rooftop Solar Complete Kit',
    shortDescription: 'Complete 5 kW turnkey rooftop solar package for medium-to-large homes in Bhopal.',
    longDescription:
      'Standardized product specification. Total pre-subsidy price shown separately from PM Surya Ghar subsidy estimate (₹78,000 max central subsidy for 3 kW+). Package includes 5.4 kWp Tier-1 panels, 5 kW string inverter, dual-layer surge protection, certified earthing, and turnkey installation in Bhopal.',
    category: 'ROOFTOP_SOLAR',
    city: 'Bhopal',
    citySlug: 'bhopal',
    productBrand: 'Tier-1 High-Efficiency',
    productModel: '5 kW Residential Dual-MPPT Package',
    imageUrl: null,
    marketPrice: 325000,
    groupPrice: 285000,
    targetBuyers: 8,
    currentBuyers: 0,
    deadline: addDays(18),
    status: 'ACTIVE',
    priceIsVerified: true,
    priceVerifiedAt: '2026-10-25T12:00:00.000Z',
    createdAt: createdDate,
    updatedAt: createdDate,
    kitOffers: [
      {
        id: 'kit-bhopal-solar-5kw-std',
        poolId: '33333333-5kw-4333-8333-bhopal000005',
        name: '5 kW Turnkey Grid-Tied Kit',
        sku: 'SOLAR-5KW-BPL-STD',
        brand: 'Tier-1 TopCon Mono',
        model: '5 kW Dual MPPT System',
        inclusions: [
          '550Wp+ DCR TopCon Solar Panels (5.5 kWp DC capacity)',
          '5 kW 3-Phase / 1-Phase Grid-Tied Inverter with Mobile Monitoring',
          '3 Dedicated Chemical Earthing Pits & Lightning Arrester',
          'ACDB with 4-Pole MCB & DCDB with Surge Arresters',
          'Hot-Dip Galvanized Rooftop Structure',
          'Bhopal MPMKVVCL Net-Metering Documentation & Survey',
          'Full Professional Installation & System Testing',
        ],
        exclusions: ['Custom high-rise structural additions'],
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
    priceTiers: [
      {
        id: 'tier-bhopal-solar-5kw-1',
        poolId: '33333333-5kw-4333-8333-bhopal000005',
        minQuantity: 5,
        maxQuantity: 7,
        pricePerUnit: 295000,
        vendorName: 'Madhya Bharat Solar EPC Pvt Ltd',
        validUntil: addDays(30),
        isApproved: true,
        notes: 'Initial volume tier.',
      },
      {
        id: 'tier-bhopal-solar-5kw-2',
        poolId: '33333333-5kw-4333-8333-bhopal000005',
        minQuantity: 8,
        maxQuantity: null,
        pricePerUnit: 285000,
        vendorName: 'Madhya Bharat Solar EPC Pvt Ltd',
        validUntil: addDays(30),
        isApproved: true,
        notes: 'Target discount tier.',
      },
    ],
  },
  {
    id: '77777777-1111-4777-8777-bhopal000007',
    slug: 'home-power-backup-inverter-200ah-battery-combo',
    name: 'Home Power-Backup Combo (Inverter + 200 Ah Battery)',
    shortDescription: 'Heavy-duty residential inverter and 200 Ah tall-tubular battery combo with modular trolley in Bhopal.',
    longDescription:
      'Standardized package specification. High-efficiency pure sine wave inverter paired with a genuine 200 Ah heavy-duty tall-tubular battery for uninterrupted home power during grid outages. Includes heavy-duty caster-wheel trolley, copper interconnect cables, delivery, and standard residential installation in Bhopal.',
    category: 'ROOFTOP_SOLAR',
    city: 'Bhopal',
    citySlug: 'bhopal',
    productBrand: 'Pure Sine Wave Inverter + Tubular Battery',
    productModel: '1100VA Inverter + 200 Ah Battery + Modular Trolley',
    imageUrl: null,
    marketPrice: 28500,
    groupPrice: 24800,
    targetBuyers: 12,
    currentBuyers: 0,
    deadline: addDays(12),
    status: 'ACTIVE',
    priceIsVerified: true,
    priceVerifiedAt: '2026-10-25T14:00:00.000Z',
    createdAt: createdDate,
    updatedAt: createdDate,
    kitOffers: [
      {
        id: 'kit-bhopal-backup-200ah',
        poolId: '77777777-1111-4777-8777-bhopal000007',
        name: '1100VA Pure Sine Wave + 200 Ah Tubular Battery Combo',
        sku: 'BACKUP-1100VA-200AH-BPL',
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
    priceTiers: [
      {
        id: 'tier-bhopal-backup-1',
        poolId: '77777777-1111-4777-8777-bhopal000007',
        minQuantity: 6,
        maxQuantity: 11,
        pricePerUnit: 25500,
        vendorName: 'Bhopal Power Solutions & Distribution',
        validUntil: addDays(25),
        isApproved: true,
        notes: 'Volume tier 1 from regional battery distributor.',
      },
      {
        id: 'tier-bhopal-backup-2',
        poolId: '77777777-1111-4777-8777-bhopal000007',
        minQuantity: 12,
        maxQuantity: null,
        pricePerUnit: 24800,
        vendorName: 'Bhopal Power Solutions & Distribution',
        validUntil: addDays(25),
        isApproved: true,
        notes: 'Maximum group buy tier for 12+ verified orders.',
      },
    ],
  },
  {
    id: '88888888-1111-4888-8888-bhopal000008',
    slug: 'whole-house-water-softener-kit',
    name: 'Whole-House Water Softener Kit',
    shortDescription: 'Residential whole-house water softener kit with automatic metered regeneration valve in Bhopal.',
    longDescription:
      'Standardized home-use water treatment package designed to eliminate scale build-up and hardness from bathroom fittings, geysers, appliances, and overhead piping. Features high-exchange food-grade resin, metered digital automatic regeneration, multi-port bypass, and 20-inch jumbo pre-filter in Bhopal.',
    category: 'ROOFTOP_SOLAR',
    city: 'Bhopal',
    citySlug: 'bhopal',
    productBrand: 'Automatic Food-Grade Ion Exchange',
    productModel: 'Automatic 28L Resin Residential Softener',
    imageUrl: null,
    marketPrice: 42000,
    groupPrice: 36500,
    targetBuyers: 10,
    currentBuyers: 0,
    deadline: addDays(15),
    status: 'ACTIVE',
    priceIsVerified: true,
    priceVerifiedAt: '2026-10-25T15:00:00.000Z',
    createdAt: createdDate,
    updatedAt: createdDate,
    kitOffers: [
      {
        id: 'kit-bhopal-softener-28l',
        poolId: '88888888-1111-4888-8888-bhopal000008',
        name: 'Whole-House 28L Auto-Regeneration Softener Package',
        sku: 'SOFTENER-28L-AUTO-BPL',
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
    priceTiers: [
      {
        id: 'tier-bhopal-softener-1',
        poolId: '88888888-1111-4888-8888-bhopal000008',
        minQuantity: 5,
        maxQuantity: 9,
        pricePerUnit: 38000,
        vendorName: 'Central India PureWater Technologies',
        validUntil: addDays(25),
        isApproved: true,
        notes: 'Volume tier 1 for Bhopal installation.',
      },
      {
        id: 'tier-bhopal-softener-2',
        poolId: '88888888-1111-4888-8888-bhopal000008',
        minQuantity: 10,
        maxQuantity: null,
        pricePerUnit: 36500,
        vendorName: 'Central India PureWater Technologies',
        validUntil: addDays(25),
        isApproved: true,
        notes: 'Full group rate unlocked at 10 buyers.',
      },
    ],
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    slug: 'macbook-air-laptop-group-buy',
    name: 'MacBook Air — Laptop Group Buy',
    shortDescription: 'Collect purchase intent for a bulk laptop quotation.',
    longDescription:
      'Illustrative demo estimate only. Confirm exact model, chip, memory, storage, tax invoice, warranty and authorized reseller terms before relying on any price.',
    category: 'LAPTOPS',
    city: 'Pune',
    citySlug: 'pune',
    productBrand: 'Apple',
    productModel: 'MacBook Air',
    imageUrl: null,
    marketPrice: 104900,
    groupPrice: 96000,
    targetBuyers: 15,
    currentBuyers: 0,
    deadline: addDays(9),
    status: 'ACTIVE',
    priceIsVerified: false,
    priceVerifiedAt: null,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    slug: '55-inch-qled-smart-tv-group-deal',
    name: '55-inch QLED Smart TV',
    shortDescription: 'Gather local demand for a 55-inch QLED television group quotation.',
    longDescription:
      'Illustrative demo estimate only. Brand, model, refresh rate, panel specifications, installation and warranty vary; final dealer quotation is required.',
    category: 'SMART_TVS',
    city: 'Delhi',
    citySlug: 'delhi',
    productBrand: 'Multiple brands',
    productModel: '55-inch QLED',
    imageUrl: null,
    marketPrice: 72990,
    groupPrice: 64990,
    targetBuyers: 10,
    currentBuyers: 0,
    deadline: addDays(11),
    status: 'ACTIVE',
    priceIsVerified: false,
    priceVerifiedAt: null,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    slug: 'mahindra-tractor-commercial-group-buy',
    name: 'Mahindra 575 DI XP Plus Tractor',
    shortDescription: 'Explore bulk-buy demand for a farm tractor in the Banda region.',
    longDescription:
      'Illustrative demo estimate only. Horsepower class, variant, implements, delivery, taxes, finance and dealer stock can change the final price. Do not advertise this estimate as an authorized quote.',
    category: 'TRACTORS_COMMERCIAL',
    city: 'Banda',
    citySlug: 'banda',
    productBrand: 'Mahindra',
    productModel: '575 DI XP Plus',
    imageUrl: null,
    marketPrice: 840000,
    groupPrice: 790000,
    targetBuyers: 5,
    currentBuyers: 0,
    deadline: addDays(15),
    status: 'ACTIVE',
    priceIsVerified: false,
    priceVerifiedAt: null,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
];

export const INITIAL_MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat-ev-scooters',
    slug: 'ev-scooters',
    label: 'Electric Scooters',
    description: 'Bulk buying for top 2W electric vehicles and high-speed commuters.',
    isActive: true,
    sortOrder: 1,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: 'cat-cars',
    slug: 'cars',
    label: 'Cars & SUVs',
    description: 'City-level group quotations for personal and family passenger cars.',
    isActive: true,
    sortOrder: 2,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: 'cat-rooftop-solar',
    slug: 'rooftop-solar',
    label: 'Rooftop Solar',
    description: 'Residential rooftop solar installations with DISCOM subsidy guidance.',
    isActive: true,
    sortOrder: 3,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: 'cat-laptops',
    slug: 'laptops',
    label: 'Laptops & MacBooks',
    description: 'Direct corporate and student group deals on premium laptops.',
    isActive: true,
    sortOrder: 4,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: 'cat-smart-tvs',
    slug: 'smart-tvs',
    label: 'Smart TVs',
    description: 'Large-screen 4K and QLED television group purchases.',
    isActive: true,
    sortOrder: 5,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
  {
    id: 'cat-tractors-commercial',
    slug: 'tractors-commercial',
    label: 'Tractors & Commercial',
    description: 'Agricultural equipment and commercial vehicle pooling.',
    isActive: true,
    sortOrder: 6,
    createdAt: createdDate,
    updatedAt: createdDate,
  },
];

export const INITIAL_MOCK_REQUESTS: PoolRequest[] = [
  {
    id: 'req-ather-450x-bhopal-1',
    productName: 'Ather 450X Gen 3 Electric Scooter',
    category: 'EV_SCOOTERS',
    categoryName: null,
    brandPreference: 'Ather Energy',
    modelPreference: '450X Gen 3 (3.7 kWh)',
    city: 'Bhopal',
    fullName: 'Rahul Sharma',
    whatsappNumber: '9826011122',
    extraMessage: 'Looking to purchase next month with 3 colleagues in MP Nagar.',
    status: 'REQUESTED',
    adminNotes: '',
    resultingPoolId: null,
    conversionStatus: 'PENDING',
    createdAt: '2026-10-25T10:15:00.000Z',
    reviewedAt: null,
  },
  {
    id: 'req-ather-450x-bhopal-2',
    productName: 'Ather 450X Scooter',
    category: 'EV_SCOOTERS',
    categoryName: null,
    brandPreference: 'Ather',
    modelPreference: '450X',
    city: 'Bhopal',
    fullName: 'Ananya Gupta',
    whatsappNumber: '9826033344',
    extraMessage: 'Interested if group discount covers extended battery warranty.',
    status: 'REQUESTED',
    adminNotes: '',
    resultingPoolId: null,
    conversionStatus: 'PENDING',
    createdAt: '2026-10-25T14:30:00.000Z',
    reviewedAt: null,
  },
  {
    id: 'req-solar-indore-1',
    productName: '5 kW On-Grid Residential Rooftop Solar',
    category: 'ROOFTOP_SOLAR',
    categoryName: null,
    brandPreference: 'Tata Power / Waaree',
    modelPreference: '5 kW DCR Panels with Net Metering',
    city: 'Indore',
    fullName: 'Virendra Patel',
    whatsappNumber: '9425055566',
    extraMessage: 'For individual residential bungalow in Vijay Nagar Indore.',
    status: 'REVIEWING',
    adminNotes: 'Contacting authorized Indore EPC partners for viable tier-1 panel discount.',
    resultingPoolId: null,
    conversionStatus: 'PENDING',
    createdAt: '2026-10-24T16:00:00.000Z',
    reviewedAt: '2026-10-25T09:00:00.000Z',
  },
  {
    id: 'req-dji-drone-lucknow',
    productName: 'DJI Mini 4 Pro Fly More Combo',
    category: null,
    categoryName: 'Drones & Aerial Video',
    brandPreference: 'DJI',
    modelPreference: 'Mini 4 Pro',
    city: 'Lucknow',
    fullName: 'Deepak Verma',
    whatsappNumber: '9792077788',
    extraMessage: 'Interested in commercial drone kit for wedding photography team.',
    status: 'REQUESTED',
    adminNotes: 'Lucknow is currently non-operational; vendor coverage unverified.',
    resultingPoolId: null,
    conversionStatus: 'PENDING',
    createdAt: '2026-10-25T18:45:00.000Z',
    reviewedAt: null,
  },
];

interface GlobalMockStore {
  __poolbuy_mock_pools?: PublicPool[];
  __poolbuy_mock_admin_pools?: AdminPool[];
  __poolbuy_demo_leads?: PoolLead[];
  __poolbuy_cities?: City[];
  __poolbuy_categories?: Category[];
  __poolbuy_requests?: PoolRequest[];
  __poolbuy_standard_products?: StandardProduct[];
  __poolbuy_blog_posts?: BlogPost[];
}

const g = globalThis as unknown as GlobalMockStore;

if (!g.__poolbuy_cities) {
  g.__poolbuy_cities = INITIAL_MOCK_CITIES;
}
if (!g.__poolbuy_categories) {
  g.__poolbuy_categories = INITIAL_MOCK_CATEGORIES;
}
if (!g.__poolbuy_requests) {
  g.__poolbuy_requests = INITIAL_MOCK_REQUESTS;
}
if (!g.__poolbuy_standard_products) {
  g.__poolbuy_standard_products = [...STANDARD_PRODUCTS];
}
if (!g.__poolbuy_mock_pools) {
  g.__poolbuy_mock_pools = INITIAL_MOCK_POOLS;
}
if (!g.__poolbuy_mock_admin_pools) {
  g.__poolbuy_mock_admin_pools = INITIAL_MOCK_POOLS.map((pool) => ({
    ...pool,
    dealerName: null,
    tokenAmount: null,
    tokenPaymentUrl: null,
    dealerOfferUrl: null,
    dealerTerms: null,
  }));
}
if (!g.__poolbuy_demo_leads) {
  g.__poolbuy_demo_leads = [];
}

export const MOCK_POOLS: PublicPool[] = g.__poolbuy_mock_pools;
export const MOCK_ADMIN_POOLS: AdminPool[] = g.__poolbuy_mock_admin_pools;
export const DEMO_LEADS: PoolLead[] = g.__poolbuy_demo_leads;

export function getDemoCities(): City[] {
  return [...(g.__poolbuy_cities || INITIAL_MOCK_CITIES)];
}

export function addDemoCity(city: City): void {
  if (!g.__poolbuy_cities) {
    g.__poolbuy_cities = [...INITIAL_MOCK_CITIES];
  }
  g.__poolbuy_cities.push(city);
}

export function updateDemoCity(cityId: string, updates: Partial<City>): City | null {
  if (!g.__poolbuy_cities) {
    g.__poolbuy_cities = [...INITIAL_MOCK_CITIES];
  }
  const index = g.__poolbuy_cities.findIndex((c) => c.id === cityId);
  if (index === -1) return null;
  const updated: City = {
    ...g.__poolbuy_cities[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  g.__poolbuy_cities[index] = updated;
  return updated;
}

/**
 * Records a demo join atomically in demo mode.
 * Performs duplicate checking and updates MOCK_POOLS and MOCK_ADMIN_POOLS currentBuyers.
 */
export function recordDemoLead(poolId: string, input: JoinPoolInput): JoinPoolResult {
  const pool = MOCK_POOLS.find((p) => p.id === poolId);
  const adminPool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);

  if (!pool) {
    throw new Error('POOL_NOT_FOUND');
  }

  // Duplicate check
  const existing = DEMO_LEADS.find(
    (l) => l.poolId === poolId && l.whatsappNumber === input.whatsappNumber
  );

  if (existing) {
    return {
      leadId: existing.id,
      buyerNumber: existing.buyerNumber,
      currentBuyers: pool.currentBuyers,
      targetBuyers: pool.targetBuyers,
      remainingBuyers: Math.max(0, pool.targetBuyers - pool.currentBuyers),
      alreadyJoined: true,
      poolStatus: pool.status,
    };
  }

  // Increment counter on both public and admin in-memory representations
  const nextCount = pool.currentBuyers + 1;
  pool.currentBuyers = nextCount;
  pool.updatedAt = new Date().toISOString();
  if (adminPool) {
    adminPool.currentBuyers = nextCount;
    adminPool.updatedAt = pool.updatedAt;
  }

  // Kit-specific demand tracking
  let selectedKitName: string | null = null;
  let selectedKitCurrentBuyers: number | undefined;
  let selectedKitTargetBuyers: number | undefined;

  if (input.selectedKitOfferId) {
    const kitInPublic = pool.kitOffers?.find((k) => k.id === input.selectedKitOfferId);
    const kitInAdmin = adminPool?.kitOffers?.find((k) => k.id === input.selectedKitOfferId);
    if (kitInPublic) {
      kitInPublic.currentBuyers += 1;
      selectedKitName = kitInPublic.name;
      selectedKitCurrentBuyers = kitInPublic.currentBuyers;
      selectedKitTargetBuyers = kitInPublic.targetBuyers;
    }
    if (kitInAdmin && kitInAdmin !== kitInPublic) {
      kitInAdmin.currentBuyers += 1;
    }
  }

  const newLead: PoolLead = {
    id: `demo-lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    poolId: pool.id,
    poolSlug: pool.slug,
    poolName: pool.name,
    poolCategory: pool.category,
    buyerNumber: nextCount,
    fullName: input.fullName.trim(),
    whatsappNumber: input.whatsappNumber.trim(),
    city: input.city.trim(),
    buyingTimeline: input.buyingTimeline,
    hasExistingQuote: input.hasExistingQuote,
    existingQuoteAmount: input.existingQuoteAmount ?? null,
    extraMessage: input.extraMessage || '',
    selectedKitOfferId: input.selectedKitOfferId || null,
    selectedKitName,
    status: 'NEW',
    consentAt: new Date().toISOString(),
    privacyNoticeVersion: '2026-10-26-v1',
    createdAt: new Date().toISOString(),
  };

  DEMO_LEADS.unshift(newLead);

  return {
    leadId: newLead.id,
    buyerNumber: nextCount,
    currentBuyers: nextCount,
    targetBuyers: pool.targetBuyers,
    remainingBuyers: Math.max(0, pool.targetBuyers - nextCount),
    alreadyJoined: false,
    poolStatus: pool.status,
    selectedKitCurrentBuyers,
    selectedKitTargetBuyers,
  };
}

/**
 * Returns all recorded demo leads
 */
export function getDemoLeads(): PoolLead[] {
  return [...DEMO_LEADS];
}

/**
 * Adds a new pool to both MOCK_ADMIN_POOLS and MOCK_POOLS so public queries see it immediately.
 */
export function addDemoPool(adminPool: AdminPool): void {
  MOCK_ADMIN_POOLS.unshift(adminPool);

  const publicPool: PublicPool = {
    id: adminPool.id,
    slug: adminPool.slug,
    name: adminPool.name,
    shortDescription: adminPool.shortDescription,
    longDescription: adminPool.longDescription,
    category: adminPool.category,
    categorySlug: adminPool.categorySlug,
    city: adminPool.city,
    citySlug: adminPool.citySlug,
    productBrand: adminPool.productBrand,
    productModel: adminPool.productModel,
    imageUrl: adminPool.imageUrl,
    marketPrice: adminPool.marketPrice,
    groupPrice: adminPool.groupPrice,
    targetBuyers: adminPool.targetBuyers,
    currentBuyers: adminPool.currentBuyers,
    deadline: adminPool.deadline,
    status: adminPool.status,
    closureReason: adminPool.closureReason,
    closedAt: adminPool.closedAt,
    offerValidUntil: adminPool.offerValidUntil,
    isArchived: adminPool.isArchived,
    deletedAt: adminPool.deletedAt,
    priceIsVerified: adminPool.priceIsVerified,
    priceVerifiedAt: adminPool.priceVerifiedAt,
    kitOffers: adminPool.kitOffers,
    priceTiers: adminPool.priceTiers,
    createdAt: adminPool.createdAt,
    updatedAt: adminPool.updatedAt,
  };

  MOCK_POOLS.unshift(publicPool);
}

/**
 * Updates a pool in both MOCK_ADMIN_POOLS and MOCK_POOLS in demo mode.
 */
export function updateDemoPool(poolId: string, updates: Partial<AdminPool>): AdminPool | null {
  const adminIndex = MOCK_ADMIN_POOLS.findIndex((p) => p.id === poolId);
  const publicIndex = MOCK_POOLS.findIndex((p) => p.id === poolId);

  if (adminIndex === -1) return null;

  const currentAdmin = MOCK_ADMIN_POOLS[adminIndex];
  const updatedAdmin: AdminPool = {
    ...currentAdmin,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  MOCK_ADMIN_POOLS[adminIndex] = updatedAdmin;

  if (publicIndex !== -1) {
    const currentPublic = MOCK_POOLS[publicIndex];
    MOCK_POOLS[publicIndex] = {
      ...currentPublic,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.shortDescription !== undefined && { shortDescription: updates.shortDescription }),
      ...(updates.longDescription !== undefined && { longDescription: updates.longDescription }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.city !== undefined && { city: updates.city }),
      ...(updates.productBrand !== undefined && { productBrand: updates.productBrand }),
      ...(updates.productModel !== undefined && { productModel: updates.productModel }),
      ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
      ...(updates.marketPrice !== undefined && { marketPrice: updates.marketPrice }),
      ...(updates.groupPrice !== undefined && { groupPrice: updates.groupPrice }),
      ...(updates.targetBuyers !== undefined && { targetBuyers: updates.targetBuyers }),
      ...(updates.currentBuyers !== undefined && { currentBuyers: updates.currentBuyers }),
      ...(updates.deadline !== undefined && { deadline: updates.deadline }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.closureReason !== undefined && { closureReason: updates.closureReason }),
      ...(updates.closedAt !== undefined && { closedAt: updates.closedAt }),
      ...(updates.offerValidUntil !== undefined && { offerValidUntil: updates.offerValidUntil }),
      ...(updates.isArchived !== undefined && { isArchived: updates.isArchived }),
      ...(updates.deletedAt !== undefined && { deletedAt: updates.deletedAt }),
      ...(updates.priceIsVerified !== undefined && { priceIsVerified: updates.priceIsVerified }),
      ...(updates.priceVerifiedAt !== undefined && { priceVerifiedAt: updates.priceVerifiedAt }),
      ...(updates.kitOffers !== undefined && { kitOffers: updates.kitOffers }),
      ...(updates.priceTiers !== undefined && { priceTiers: updates.priceTiers }),
      updatedAt: updatedAdmin.updatedAt,
    };
  }

  return updatedAdmin;
}

/**
 * Deletes a pool in demo mode.
 * Enforces hard delete restriction when leads exist.
 * Defaults to soft-delete (deletedAt timestamp).
 */
export function deleteDemoPool(
  poolId: string,
  options?: { hardDelete?: boolean }
): { action: 'soft_deleted' | 'hard_deleted'; pool?: AdminPool } {
  const adminIndex = MOCK_ADMIN_POOLS.findIndex((p) => p.id === poolId);
  if (adminIndex === -1) {
    throw new Error('POOL_NOT_FOUND');
  }

  const leads = DEMO_LEADS.filter((l) => l.poolId === poolId);

  if (options?.hardDelete) {
    if (leads.length > 0) {
      throw new Error(
        `CANNOT_HARD_DELETE_POOL_WITH_LEADS: Pool has ${leads.length} recorded leads. Use soft-delete / archive instead.`
      );
    }
    // Hard delete: remove from both arrays
    MOCK_ADMIN_POOLS.splice(adminIndex, 1);
    const pubIndex = MOCK_POOLS.findIndex((p) => p.id === poolId);
    if (pubIndex !== -1) {
      MOCK_POOLS.splice(pubIndex, 1);
    }
    return { action: 'hard_deleted' };
  }

  // Soft delete (default)
  const now = new Date().toISOString();
  const current = MOCK_ADMIN_POOLS[adminIndex];
  const updatedAdmin: AdminPool = {
    ...current,
    status: 'CLOSED',
    closureReason: 'MANUAL_CLOSE',
    closedAt: current.closedAt || now,
    deletedAt: now,
    updatedAt: now,
  };
  MOCK_ADMIN_POOLS[adminIndex] = updatedAdmin;

  // Remove from public pools so public visitors cannot see it
  const pubIndex = MOCK_POOLS.findIndex((p) => p.id === poolId);
  if (pubIndex !== -1) {
    MOCK_POOLS.splice(pubIndex, 1);
  }

  return { action: 'soft_deleted', pool: updatedAdmin };
}

/**
 * Restores a soft-deleted or archived pool in demo mode.
 */
export function restoreDemoPool(poolId: string): AdminPool {
  const adminIndex = MOCK_ADMIN_POOLS.findIndex((p) => p.id === poolId);
  if (adminIndex === -1) {
    throw new Error('POOL_NOT_FOUND');
  }

  const now = new Date().toISOString();
  const current = MOCK_ADMIN_POOLS[adminIndex];
  const updatedAdmin: AdminPool = {
    ...current,
    status: 'ACTIVE',
    closureReason: null,
    closedAt: null,
    deletedAt: null,
    isArchived: false,
    updatedAt: now,
  };
  MOCK_ADMIN_POOLS[adminIndex] = updatedAdmin;

  // Add back or update in public pools
  const pubIndex = MOCK_POOLS.findIndex((p) => p.id === poolId);
  if (pubIndex !== -1) {
    MOCK_POOLS[pubIndex] = {
      ...MOCK_POOLS[pubIndex],
      status: 'ACTIVE',
      closureReason: null,
      closedAt: null,
      deletedAt: null,
      isArchived: false,
      updatedAt: now,
    };
  } else {
    // Re-insert into public pools
    const pubPool: PublicPool = {
      id: updatedAdmin.id,
      slug: updatedAdmin.slug,
      name: updatedAdmin.name,
      shortDescription: updatedAdmin.shortDescription,
      longDescription: updatedAdmin.longDescription,
      category: updatedAdmin.category,
      categorySlug: updatedAdmin.categorySlug,
      city: updatedAdmin.city,
      citySlug: updatedAdmin.citySlug,
      productBrand: updatedAdmin.productBrand,
      productModel: updatedAdmin.productModel,
      imageUrl: updatedAdmin.imageUrl,
      marketPrice: updatedAdmin.marketPrice,
      groupPrice: updatedAdmin.groupPrice,
      targetBuyers: updatedAdmin.targetBuyers,
      currentBuyers: updatedAdmin.currentBuyers,
      deadline: updatedAdmin.deadline,
      status: updatedAdmin.status,
      closureReason: null,
      closedAt: null,
      offerValidUntil: updatedAdmin.offerValidUntil,
      isArchived: false,
      deletedAt: null,
      priceIsVerified: updatedAdmin.priceIsVerified,
      priceVerifiedAt: updatedAdmin.priceVerifiedAt,
      kitOffers: updatedAdmin.kitOffers,
      priceTiers: updatedAdmin.priceTiers,
      createdAt: updatedAdmin.createdAt,
      updatedAt: now,
    };
    MOCK_POOLS.unshift(pubPool);
  }

  return updatedAdmin;
}

/**
 * Idempotently expires pools whose deadline or vendor offer valid until has passed.
 */
export function expireDemoPools(): {
  success: boolean;
  timestamp: string;
  expiredByDeadlineCount: number;
  expiredByOfferCount: number;
  totalClosedCount: number;
  expiredPoolIds: string[];
} {
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();
  let expiredByDeadlineCount = 0;
  let expiredByOfferCount = 0;
  const expiredPoolIds: string[] = [];

  for (let i = 0; i < MOCK_ADMIN_POOLS.length; i++) {
    const pool = MOCK_ADMIN_POOLS[i];
    if (pool.deletedAt) continue;

    if (pool.status === 'ACTIVE' && new Date(pool.deadline).getTime() < nowMs) {
      pool.status = 'CLOSED';
      pool.closureReason = 'AUTO_POOL_EXPIRED';
      pool.closedAt = pool.closedAt || nowIso;
      pool.updatedAt = nowIso;
      expiredByDeadlineCount++;
      expiredPoolIds.push(pool.id);

      // Update public pool
      const pubIndex = MOCK_POOLS.findIndex((p) => p.id === pool.id);
      if (pubIndex !== -1) {
        MOCK_POOLS[pubIndex].status = 'CLOSED';
        MOCK_POOLS[pubIndex].closureReason = 'AUTO_POOL_EXPIRED';
        MOCK_POOLS[pubIndex].closedAt = pool.closedAt;
        MOCK_POOLS[pubIndex].updatedAt = nowIso;
      }
    } else if (
      pool.status === 'ACTIVE' &&
      pool.offerValidUntil &&
      new Date(pool.offerValidUntil).getTime() < nowMs
    ) {
      pool.status = 'CLOSED';
      pool.closureReason = 'OFFER_EXPIRED';
      pool.closedAt = pool.closedAt || nowIso;
      pool.updatedAt = nowIso;
      expiredByOfferCount++;
      expiredPoolIds.push(pool.id);

      const pubIndex = MOCK_POOLS.findIndex((p) => p.id === pool.id);
      if (pubIndex !== -1) {
        MOCK_POOLS[pubIndex].status = 'CLOSED';
        MOCK_POOLS[pubIndex].closureReason = 'OFFER_EXPIRED';
        MOCK_POOLS[pubIndex].closedAt = pool.closedAt;
        MOCK_POOLS[pubIndex].updatedAt = nowIso;
      }
    }
  }

  return {
    success: true,
    timestamp: nowIso,
    expiredByDeadlineCount,
    expiredByOfferCount,
    totalClosedCount: expiredByDeadlineCount + expiredByOfferCount,
    expiredPoolIds,
  };
}

/**
 * Categories demo store accessors
 */
export function getDemoCategories(): Category[] {
  return [...(g.__poolbuy_categories || INITIAL_MOCK_CATEGORIES)];
}

export function addDemoCategory(category: Category): void {
  if (!g.__poolbuy_categories) {
    g.__poolbuy_categories = [...INITIAL_MOCK_CATEGORIES];
  }
  g.__poolbuy_categories.push(category);
}

export function updateDemoCategory(categoryId: string, updates: Partial<Category>): Category | null {
  if (!g.__poolbuy_categories) {
    g.__poolbuy_categories = [...INITIAL_MOCK_CATEGORIES];
  }
  const index = g.__poolbuy_categories.findIndex((c) => c.id === categoryId || c.slug === categoryId);
  if (index === -1) return null;
  const updated: Category = {
    ...g.__poolbuy_categories[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  g.__poolbuy_categories[index] = updated;
  return updated;
}

/**
 * Pool requests demo store accessors
 */
export function getDemoRequests(): PoolRequest[] {
  return [...(g.__poolbuy_requests || INITIAL_MOCK_REQUESTS)];
}

export function addDemoRequest(request: PoolRequest): void {
  if (!g.__poolbuy_requests) {
    g.__poolbuy_requests = [...INITIAL_MOCK_REQUESTS];
  }
  g.__poolbuy_requests.unshift(request);
}

export function updateDemoRequest(requestId: string, updates: Partial<PoolRequest>): PoolRequest | null {
  if (!g.__poolbuy_requests) {
    g.__poolbuy_requests = [...INITIAL_MOCK_REQUESTS];
  }
  const index = g.__poolbuy_requests.findIndex((r) => r.id === requestId);
  if (index === -1) return null;
  const current = g.__poolbuy_requests[index];
  const updated: PoolRequest = {
    ...current,
    ...updates,
    reviewedAt:
      updates.status && updates.status !== 'REQUESTED'
        ? new Date().toISOString()
        : current.reviewedAt,
  };
  g.__poolbuy_requests[index] = updated;
  return updated;
}

/**
 * Standard products demo store accessors
 */
export function getDemoStandardProducts(): StandardProduct[] {
  return [...(g.__poolbuy_standard_products || STANDARD_PRODUCTS)];
}

export function addDemoStandardProduct(product: StandardProduct): void {
  if (!g.__poolbuy_standard_products) {
    g.__poolbuy_standard_products = [...STANDARD_PRODUCTS];
  }
  g.__poolbuy_standard_products.unshift(product);
}

export function updateDemoStandardProduct(
  productId: string,
  updates: Partial<StandardProduct>
): StandardProduct | null {
  if (!g.__poolbuy_standard_products) {
    g.__poolbuy_standard_products = [...STANDARD_PRODUCTS];
  }
  const index = g.__poolbuy_standard_products.findIndex(
    (p) => p.id === productId || p.slug === productId
  );
  if (index === -1) return null;
  const current = g.__poolbuy_standard_products[index];
  const updated: StandardProduct = {
    ...current,
    ...updates,
  };
  g.__poolbuy_standard_products[index] = updated;
  return updated;
}

/**
 * Kit offers and price tiers demo store accessors
 */
export function getDemoPoolKitOffers(poolId: string): PoolKitOffer[] {
  const pool = MOCK_POOLS.find((p) => p.id === poolId);
  return pool?.kitOffers || [];
}

export function addDemoPoolKitOffer(poolId: string, offer: PoolKitOffer): PoolKitOffer {
  const pool = MOCK_POOLS.find((p) => p.id === poolId);
  const adminPool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
  if (!pool) throw new Error('POOL_NOT_FOUND');
  if (!pool.kitOffers) pool.kitOffers = [];
  pool.kitOffers.push(offer);
  if (adminPool) {
    if (!adminPool.kitOffers) adminPool.kitOffers = [];
    adminPool.kitOffers.push(offer);
  }
  return offer;
}

export function getDemoPoolPriceTiers(poolId: string): VendorPriceTier[] {
  const pool = MOCK_POOLS.find((p) => p.id === poolId);
  return pool?.priceTiers || [];
}

export function addDemoPoolPriceTier(poolId: string, tier: VendorPriceTier): VendorPriceTier {
  const pool = MOCK_POOLS.find((p) => p.id === poolId);
  const adminPool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
  if (!pool) throw new Error('POOL_NOT_FOUND');
  if (!pool.priceTiers) pool.priceTiers = [];
  pool.priceTiers.push(tier);
  if (adminPool) {
    if (!adminPool.priceTiers) adminPool.priceTiers = [];
    adminPool.priceTiers.push(tier);
  }
  return tier;
}

export function getDemoPoolPriceHistory(poolId: string): PriceHistoryEntry[] {
  const adminPool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
  return adminPool?.priceHistory || [];
}

export function addDemoPoolPriceHistory(poolId: string, entry: PriceHistoryEntry): PriceHistoryEntry {
  const adminPool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
  if (!adminPool) throw new Error('POOL_NOT_FOUND');
  if (!adminPool.priceHistory) adminPool.priceHistory = [];
  adminPool.priceHistory.unshift(entry);
  return entry;
}

/**
 * Initial Educational Blog Posts
 */
export const INITIAL_MOCK_BLOG_POSTS: BlogPost[] = [
  {
    id: 'post-1001-pm-surya-ghar-solar-guide',
    slug: 'pm-surya-ghar-muft-bijli-yojana-rooftop-solar-guide',
    title: 'PM Surya Ghar Muft Bijli Yojana: Complete 2026 Residential Rooftop Solar Guide',
    excerpt:
      'Comprehensive breakdown of central DBT subsidies up to ₹78,000, Tier-1 Mono PERC/TopCon kits, net-metering liaison with state DISCOMs, and genuine bulk group buying terms.',
    content: `# PM Surya Ghar Muft Bijli Yojana: Complete 2026 Residential Rooftop Solar Guide

The **PM Surya Ghar: Muft Bijli Yojana** is India's flagship central government initiative aimed at providing free electricity to 1 crore residential households by incentivizing grid-connected rooftop solar installations.

## 1. Central Subsidy Slabs Explained

Under the national portal, the central financial assistance (Direct Benefit Transfer - DBT) is directly deposited into the consumer's bank account following technical commissioning and net meter installation by the local distribution company (DISCOM):

| System Capacity | Central Subsidy (DBT) | Suitable Household Monthly Consumption |
| :--- | :--- | :--- |
| **1 kW** | ₹30,000 | 0 – 150 units |
| **2 kW** | ₹60,000 | 150 – 300 units |
| **3 kW** | ₹78,000 (Maximum Cap) | 300 – 450 units |
| **5 kW** | ₹78,000 (Flat Cap) | 450 – 750 units |

> **Note on Price Transparency:** Central subsidies are credited directly to the homeowner post-inspection. PoolBuy presents the **gross pre-subsidy installation price** upfront so buyers understand exact vendor equipment quotes without hidden deductions.

## 2. Essential Component Standards

A high-performing rooftop solar installation requires synchronized Tier-1 components designed for Indian climatic conditions:

- **Bifacial / Mono PERC / TopCon Panels:** Minimum 540Wp–585Wp modules with 25-year linear performance warranties (minimum 80% generation at year 25).
- **Grid-Tie Inverter:** Transformless pure sine-wave inverter with minimum 97.5% Euro-efficiency, built-in dual MPPT trackers, and integrated WiFi monitoring.
- **Hot-Dip Galvanized Mounting Structures:** Minimum 80-micron zinc coating designed to withstand sustained wind speeds of up to 150 km/h.
- **Safety Equipment:** Dual chemical earthing electrodes with copper bonded rods, Class-II SPD ACDB/DCDB boxes, and a dedicated lightning arrester.

## 3. The Power of City-Specific Group Buying

Rooftop solar costs are heavily influenced by local liaisoning, DISCOM meter testing fees, and installation crew transport. By grouping 10 to 15 residential homeowners in the same city, PoolBuy enables certified solar EPC partners to secure factory-direct panel lots and optimize installation schedules, yielding substantial institutional price advantages for homeowners.
`,
    author: 'Vikram Sengupta (Solar Energy Analyst)',
    topic: 'Solar Energy',
    tags: ['Rooftop Solar', 'PM Surya Ghar', 'Subsidies', 'Bhopal', 'Indore'],
    coverImageUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
    coverImageAlt: 'Modern residential rooftop solar panel installation',
    metaTitle: 'PM Surya Ghar Solar Scheme Guide 2026 | PoolBuy India',
    metaDescription: 'Complete homeowner guide to PM Surya Ghar central subsidies up to ₹78,000, 3 kW / 5 kW specifications, net-metering DISCOM liaison, and bulk buying.',
    status: 'PUBLISHED',
    publishedAt: '2026-10-20T10:00:00.000Z',
    createdAt: '2026-10-20T08:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    sources: ['Ministry of New and Renewable Energy (MNRE) Portal', 'PM Surya Ghar Official Gazette Notification'],
    editorialNotes: 'Verified against current MNRE central financial assistance benchmarks.',
  },
  {
    id: 'post-1002-inverter-battery-combo-guide',
    slug: 'how-to-choose-inverter-and-200ah-battery-combo-india',
    title: 'How to Choose the Right Pure Sine Wave Inverter & 200 Ah Tall Tubular Battery Combo',
    excerpt:
      'Why pure sine wave inverters are critical for modern home appliances and how 200 Ah C10 deep-cycle tall tubular batteries provide reliable backup during power cuts.',
    content: `# How to Choose the Right Pure Sine Wave Inverter & 200 Ah Tall Tubular Battery Combo

Power reliability remains a significant consideration for Indian residences and home offices. Selecting the correct inverter-battery pairing ensures that sensitive consumer electronics, refrigerators, and work setups remain uninterrupted without component degradation.

## 1. Pure Sine Wave vs Square / Modified Sine Wave

Modern consumer electronics (laptops, BLDC ceiling fans, LED TVs, and inverter refrigerators) rely on switch-mode power supplies (SMPS). 

- **Square / Modified Wave Inverters:** Produce heavy harmonic distortion, leading to buzzing noises in fans, premature capacitor failure in refrigerators, and unstable laptop charging.
- **Pure Sine Wave Inverters:** Replicate smooth utility grid electricity (Total Harmonic Distortion < 3%), ensuring silent operation, cool appliance running, and maximum operational life.

## 2. Deciphering Battery Ratings: The C10 vs C20 Distinction

A standard 12V 200 Ah battery stores approximately **2,400 Watt-hours (Wh)** of raw chemical energy:

- **C10 Rating (High Discharge / Solar Grade):** Designed to deliver its full rated capacity over a 10-hour discharge window. Ideal for frequent power outages and rapid recharge cycles.
- **C20 Rating (Standard Discharge):** Delivers rated capacity over a slower 20-hour window. Under heavy sudden discharge, actual usable capacity drops by 15–20%.

For heavy residential backups, always specify **C10-rated tall tubular deep-cycle batteries** with low-antimony alloy plates and high electrolyte volume.

## 3. Estimating Real-World Backup Duration

To calculate realistic backup time from a 12V 200 Ah battery:

$$\\text{Usable Wh} = 12\\text{V} \\times 200\\text{Ah} \\times 0.70 (\\text{Safe Depth of Discharge}) \\times 0.85 (\\text{Inverter Efficiency}) \\approx 1,428\\text{ Wh}$$

| Typical Household Load | Power Draw | Estimated Backup Time |
| :--- | :--- | :--- |
| **Basic:** 3 BLDC fans + 4 LED bulbs + WiFi router | ~130 Watts | ~11.0 Hours |
| **Work From Home:** 2 fans + 3 LEDs + 2 laptops + 27" monitor | ~240 Watts | ~5.9 Hours |
| **Heavy Load:** Basic load + 260L Inverter Refrigerator | ~380 Watts | ~3.7 Hours |
`,
    author: 'Pooja Sharma (Consumer Tech Specialist)',
    topic: 'Home Backup',
    tags: ['Inverters', 'Batteries', 'Power Backup', 'Home Tech'],
    coverImageUrl: 'https://images.unsplash.com/photo-1558441719-8b489c634a1b?auto=format&fit=crop&w=1200&q=80',
    coverImageAlt: 'Pure sine wave inverter and tall tubular battery installation',
    metaTitle: 'Choosing Pure Sine Wave Inverter & 200Ah Battery | PoolBuy India',
    metaDescription: 'Complete guide to pure sine wave inverters, C10 vs C20 tall tubular batteries, real-world backup calculations, and warranty terms.',
    status: 'PUBLISHED',
    publishedAt: '2026-10-22T11:30:00.000Z',
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-10-22T11:30:00.000Z',
    sources: ['Bureau of Indian Standards (BIS) Inverter Specifications', 'IEEE Energy Storage Guidelines'],
  },
  {
    id: 'post-1003-water-softeners-hard-water-guide',
    slug: 'whole-house-water-softeners-hard-water-guide-india',
    title: 'Hard Water Solutions in Indian Cities: Whole-House Automatic Ion-Exchange Softener Guide',
    excerpt:
      'Understanding water hardness (PPM/TDS), the science of food-grade ion exchange resin softening, protecting plumbing and appliances, and group procurement.',
    content: `# Hard Water Solutions in Indian Cities: Whole-House Automatic Ion-Exchange Softener Guide

In rapidly expanding residential corridors across Pune, Bhopal, Indore, and Bengaluru, groundwater borewells frequently exhibit calcium and magnesium hardness levels exceeding 400 to 800 PPM (mg/L).

## 1. Hardness vs TDS: Clearing Common Misconceptions

- **Total Dissolved Solids (TDS):** Measures all dissolved organic and inorganic substances (sodium, chlorides, sulfates, calcium, etc.). High TDS affects water taste and requires Reverse Osmosis (RO) for drinking water.
- **Hardness:** Specifically measures dissolved **Calcium ($Ca^{2+}$)** and **Magnesium ($Mg^{2+}$)** ions. High hardness precipitates as limescale, clogging geysers, ruining bathroom fittings, fading laundry, and irritating sensitive skin.

> A whole-house water softener is designed to remove **hardness**, not reduce overall TDS. It replaces scale-forming calcium and magnesium ions with harmless sodium ions via ion-exchange resin.

## 2. Core Components of an Automatic Softener

A reliable residential whole-house system comprises four integrated elements:

1. **FRP Composite Vessel:** Corrosion-free fiberglass vessel tested to withstand continuous water pressures up to 10 bar.
2. **Food-Grade Cation Exchange Resin:** High-capacity cross-linked polystyrene beads (minimum 25–40 liters for a 3–4 bedroom home).
3. **Automatic Digital Multi-Port Valve:** Automatically triggers backwash and brine regeneration based on water volume processed or elapsed days.
4. **Brine Tank with Safety Float:** Holds standard vacuum-dried sodium chloride crystals for periodic resin regeneration.

## 3. Routine Operating Costs

Modern automatic softeners require minimal maintenance:
- **Salt Consumption:** Approximately 5–8 kg of standard water softener salt per regeneration cycle (typically once every 7 to 10 days depending on borewell water hardness).
- **Monthly Running Cost:** Approximately ₹350 – ₹600 per month for salt replenishments, saving thousands in plumbing repairs and appliance replacements.
`,
    author: 'Dr. Anirudh Verma (Water Quality Engineer)',
    topic: 'Water Treatment',
    tags: ['Water Softener', 'Hard Water', 'Home Maintenance', 'Plumbing'],
    coverImageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
    coverImageAlt: 'Crystal clear softened water flowing in residential bathroom',
    metaTitle: 'Whole-House Water Softener Guide for Indian Cities | PoolBuy',
    metaDescription: 'Hard water solutions for Indian homes: ion-exchange resin, automatic regeneration valves, operating salt costs, and group procurement.',
    status: 'PUBLISHED',
    publishedAt: '2026-10-24T14:00:00.000Z',
    createdAt: '2026-10-24T11:00:00.000Z',
    updatedAt: '2026-10-24T14:00:00.000Z',
    sources: ['Central Ground Water Board (CGWB) Aquifer Water Quality Reports', 'WQA Ion-Exchange Softening Standards'],
  },
  {
    id: 'post-1004-draft-upcoming-ev-dynamics',
    slug: 'draft-upcoming-ev-two-wheeler-subsidy-updates',
    title: '2026-2027 EV Two-Wheeler Policy Outlook & Group Procurement Dynamics',
    excerpt:
      'Draft analysis of state-level EV incentives and community buying pools for electric scooters across Tier-2 cities.',
    content: `# 2026-2027 EV Two-Wheeler Policy Outlook

Draft editorial research notes exploring how group aggregation enables localized dealerships to offer institutional fleet pricing to individual buyers.

*This post is currently in editorial draft mode and is not visible to public visitors.*`,
    author: 'PoolBuy Research Desk',
    topic: 'Electric Mobility',
    tags: ['EV', 'Electric Scooters'],
    coverImageUrl: null,
    status: 'DRAFT',
    createdAt: '2026-10-25T16:00:00.000Z',
    updatedAt: '2026-10-25T16:00:00.000Z',
  },
];

/**
 * Blog CMS Demo Store Accessors
 */
export function getDemoBlogPosts(): BlogPost[] {
  return [...(g.__poolbuy_blog_posts || INITIAL_MOCK_BLOG_POSTS)];
}

export function addDemoBlogPost(post: BlogPost): BlogPost {
  if (!g.__poolbuy_blog_posts) {
    g.__poolbuy_blog_posts = [...INITIAL_MOCK_BLOG_POSTS];
  }
  g.__poolbuy_blog_posts.unshift(post);
  return post;
}

export function updateDemoBlogPost(id: string, updates: Partial<BlogPost>): BlogPost | null {
  if (!g.__poolbuy_blog_posts) {
    g.__poolbuy_blog_posts = [...INITIAL_MOCK_BLOG_POSTS];
  }
  const index = g.__poolbuy_blog_posts.findIndex((p) => p.id === id || p.slug === id);
  if (index === -1) return null;
  const current = g.__poolbuy_blog_posts[index];
  const updated: BlogPost = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  g.__poolbuy_blog_posts[index] = updated;
  return updated;
}

export function deleteDemoBlogPost(id: string): boolean {
  if (!g.__poolbuy_blog_posts) {
    g.__poolbuy_blog_posts = [...INITIAL_MOCK_BLOG_POSTS];
  }
  const index = g.__poolbuy_blog_posts.findIndex((p) => p.id === id || p.slug === id);
  if (index === -1) return false;
  g.__poolbuy_blog_posts.splice(index, 1);
  return true;
}

