import { City, StateDirectory } from '@/types';

export interface SeedState {
  code: string;
  name: string;
  slug: string;
  type: 'STATE' | 'UNION_TERRITORY';
  cities: {
    name: string;
    slug: string;
    placeType: 'CITY' | 'TOWN' | 'ISLAND_CENTRE' | 'SERVICE_ZONE';
    availabilityState: 'ACTIVE' | 'DEMAND_COLLECTING' | 'NOT_YET_AVAILABLE';
  }[];
}

/**
 * Authoritative India Location Directory
 * Source: Government of India State/UT Directory (28 States + 8 UTs)
 * Section 18.5 Blueprint Compliance:
 * - 28 States: exactly 5 representative urban centres each
 * - 8 Union Territories: honest geographic coverage without fabricating fictional cities
 */
export const INDIA_LOCATION_DIRECTORY: SeedState[] = [
  // --- 28 STATES ---
  {
    code: 'AP',
    name: 'Andhra Pradesh',
    slug: 'andhra-pradesh',
    type: 'STATE',
    cities: [
      { name: 'Visakhapatnam', slug: 'visakhapatnam', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Vijayawada', slug: 'vijayawada', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Guntur', slug: 'guntur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Tirupati', slug: 'tirupati', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kurnool', slug: 'kurnool', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'AR',
    name: 'Arunachal Pradesh',
    slug: 'arunachal-pradesh',
    type: 'STATE',
    cities: [
      { name: 'Itanagar', slug: 'itanagar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Naharlagun', slug: 'naharlagun', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Pasighat', slug: 'pasighat', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Tawang', slug: 'tawang', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Ziro', slug: 'ziro', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'AS',
    name: 'Assam',
    slug: 'assam',
    type: 'STATE',
    cities: [
      { name: 'Guwahati', slug: 'guwahati', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Dibrugarh', slug: 'dibrugarh', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Silchar', slug: 'silchar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Jorhat', slug: 'jorhat', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Tezpur', slug: 'tezpur', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'BR',
    name: 'Bihar',
    slug: 'bihar',
    type: 'STATE',
    cities: [
      { name: 'Patna', slug: 'patna', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Gaya', slug: 'gaya', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Muzaffarpur', slug: 'muzaffarpur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Bhagalpur', slug: 'bhagalpur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Darbhanga', slug: 'darbhanga', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'CG',
    name: 'Chhattisgarh',
    slug: 'chhattisgarh',
    type: 'STATE',
    cities: [
      { name: 'Raipur', slug: 'raipur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Bhilai', slug: 'bhilai', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Bilaspur', slug: 'bilaspur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Korba', slug: 'korba', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Durg', slug: 'durg', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'GA',
    name: 'Goa',
    slug: 'goa',
    type: 'STATE',
    cities: [
      { name: 'Panaji', slug: 'panaji', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Margao', slug: 'margao', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Vasco da Gama', slug: 'vasco-da-gama', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mapusa', slug: 'mapusa', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Ponda', slug: 'ponda', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'GJ',
    name: 'Gujarat',
    slug: 'gujarat',
    type: 'STATE',
    cities: [
      { name: 'Ahmedabad', slug: 'ahmedabad', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Surat', slug: 'surat', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Vadodara', slug: 'vadodara', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Rajkot', slug: 'rajkot', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Gandhinagar', slug: 'gandhinagar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'HR',
    name: 'Haryana',
    slug: 'haryana',
    type: 'STATE',
    cities: [
      { name: 'Gurugram', slug: 'gurugram', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Faridabad', slug: 'faridabad', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Panipat', slug: 'panipat', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Hisar', slug: 'hisar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Ambala', slug: 'ambala', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'HP',
    name: 'Himachal Pradesh',
    slug: 'himachal-pradesh',
    type: 'STATE',
    cities: [
      { name: 'Shimla', slug: 'shimla', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Dharamshala', slug: 'dharamshala', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Solan', slug: 'solan', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mandi', slug: 'mandi', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Baddi', slug: 'baddi', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'JH',
    name: 'Jharkhand',
    slug: 'jharkhand',
    type: 'STATE',
    cities: [
      { name: 'Ranchi', slug: 'ranchi', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Jamshedpur', slug: 'jamshedpur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Dhanbad', slug: 'dhanbad', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Bokaro Steel City', slug: 'bokaro-steel-city', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Hazaribagh', slug: 'hazaribagh', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'KA',
    name: 'Karnataka',
    slug: 'karnataka',
    type: 'STATE',
    cities: [
      { name: 'Bengaluru', slug: 'bengaluru', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mysuru', slug: 'mysuru', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mangaluru', slug: 'mangaluru', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Hubballi-Dharwad', slug: 'hubballi-dharwad', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Belagavi', slug: 'belagavi', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'KL',
    name: 'Kerala',
    slug: 'kerala',
    type: 'STATE',
    cities: [
      { name: 'Thiruvananthapuram', slug: 'thiruvananthapuram', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kochi', slug: 'kochi', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kozhikode', slug: 'kozhikode', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Thrissur', slug: 'thrissur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kollam', slug: 'kollam', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'MP',
    name: 'Madhya Pradesh',
    slug: 'madhya-pradesh',
    type: 'STATE',
    cities: [
      { name: 'Bhopal', slug: 'bhopal', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Indore', slug: 'indore', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Jabalpur', slug: 'jabalpur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Gwalior', slug: 'gwalior', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Ujjain', slug: 'ujjain', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'MH',
    name: 'Maharashtra',
    slug: 'maharashtra',
    type: 'STATE',
    cities: [
      { name: 'Mumbai', slug: 'mumbai', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Pune', slug: 'pune', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Nagpur', slug: 'nagpur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Nashik', slug: 'nashik', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Chhatrapati Sambhajinagar', slug: 'chhatrapati-sambhajinagar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'MN',
    name: 'Manipur',
    slug: 'manipur',
    type: 'STATE',
    cities: [
      { name: 'Imphal', slug: 'imphal', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Thoubal', slug: 'thoubal', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Churachandpur', slug: 'churachandpur', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Bishnupur', slug: 'bishnupur', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kakching', slug: 'kakching', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'ML',
    name: 'Meghalaya',
    slug: 'meghalaya',
    type: 'STATE',
    cities: [
      { name: 'Shillong', slug: 'shillong', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Tura', slug: 'tura', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Jowai', slug: 'jowai', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Nongpoh', slug: 'nongpoh', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Williamnagar', slug: 'williamnagar', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'MZ',
    name: 'Mizoram',
    slug: 'mizoram',
    type: 'STATE',
    cities: [
      { name: 'Aizawl', slug: 'aizawl', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Lunglei', slug: 'lunglei', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Champhai', slug: 'champhai', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kolasib', slug: 'kolasib', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Serchhip', slug: 'serchhip', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'NL',
    name: 'Nagaland',
    slug: 'nagaland',
    type: 'STATE',
    cities: [
      { name: 'Dimapur', slug: 'dimapur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kohima', slug: 'kohima', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mokokchung', slug: 'mokokchung', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Tuensang', slug: 'tuensang', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Wokha', slug: 'wokha', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'OD',
    name: 'Odisha',
    slug: 'odisha',
    type: 'STATE',
    cities: [
      { name: 'Bhubaneswar', slug: 'bhubaneswar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Cuttack', slug: 'cuttack', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Rourkela', slug: 'rourkela', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Sambalpur', slug: 'sambalpur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Berhampur', slug: 'berhampur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'PB',
    name: 'Punjab',
    slug: 'punjab',
    type: 'STATE',
    cities: [
      { name: 'Ludhiana', slug: 'ludhiana', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Amritsar', slug: 'amritsar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Jalandhar', slug: 'jalandhar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Patiala', slug: 'patiala', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Bathinda', slug: 'bathinda', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'RJ',
    name: 'Rajasthan',
    slug: 'rajasthan',
    type: 'STATE',
    cities: [
      { name: 'Jaipur', slug: 'jaipur', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Jodhpur', slug: 'jodhpur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Udaipur', slug: 'udaipur-rajasthan', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kota', slug: 'kota', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Ajmer', slug: 'ajmer', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'SK',
    name: 'Sikkim',
    slug: 'sikkim',
    type: 'STATE',
    cities: [
      { name: 'Gangtok', slug: 'gangtok', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Namchi', slug: 'namchi', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Gyalshing', slug: 'gyalshing', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mangan', slug: 'mangan', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Singtam', slug: 'singtam', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'TN',
    name: 'Tamil Nadu',
    slug: 'tamil-nadu',
    type: 'STATE',
    cities: [
      { name: 'Chennai', slug: 'chennai', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Coimbatore', slug: 'coimbatore', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Madurai', slug: 'madurai', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Tiruchirappalli', slug: 'tiruchirappalli', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Salem', slug: 'salem', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'TG',
    name: 'Telangana',
    slug: 'telangana',
    type: 'STATE',
    cities: [
      { name: 'Hyderabad', slug: 'hyderabad', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Warangal', slug: 'warangal', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Karimnagar', slug: 'karimnagar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Nizamabad', slug: 'nizamabad', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Khammam', slug: 'khammam', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'TR',
    name: 'Tripura',
    slug: 'tripura',
    type: 'STATE',
    cities: [
      { name: 'Agartala', slug: 'agartala', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Udaipur', slug: 'udaipur-tripura', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Dharmanagar', slug: 'dharmanagar', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kailashahar', slug: 'kailashahar', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Belonia', slug: 'belonia', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'UP',
    name: 'Uttar Pradesh',
    slug: 'uttar-pradesh',
    type: 'STATE',
    cities: [
      { name: 'Noida', slug: 'noida', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Lucknow', slug: 'lucknow', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Kanpur', slug: 'kanpur', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Banda', slug: 'banda', placeType: 'TOWN', availabilityState: 'ACTIVE' },
      { name: 'Varanasi', slug: 'varanasi', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Agra', slug: 'agra', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'UK',
    name: 'Uttarakhand',
    slug: 'uttarakhand',
    type: 'STATE',
    cities: [
      { name: 'Dehradun', slug: 'dehradun', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Haridwar', slug: 'haridwar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Haldwani', slug: 'haldwani', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Roorkee', slug: 'roorkee', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Rudrapur', slug: 'rudrapur', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'WB',
    name: 'West Bengal',
    slug: 'west-bengal',
    type: 'STATE',
    cities: [
      { name: 'Kolkata', slug: 'kolkata', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Howrah', slug: 'howrah', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Durgapur', slug: 'durgapur', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Siliguri', slug: 'siliguri', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Asansol', slug: 'asansol', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },

  // --- 8 UNION TERRITORIES (Honest counts & place types) ---
  {
    code: 'AN',
    name: 'Andaman and Nicobar Islands',
    slug: 'andaman-and-nicobar-islands',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Sri Vijaya Puram', slug: 'sri-vijaya-puram', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Diglipur', slug: 'diglipur', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mayabunder', slug: 'mayabunder', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Rangat', slug: 'rangat', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Hut Bay', slug: 'hut-bay', placeType: 'ISLAND_CENTRE', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'CH',
    name: 'Chandigarh',
    slug: 'chandigarh',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Chandigarh', slug: 'chandigarh', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'DH',
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    slug: 'dadra-and-nagar-haveli-and-daman-and-diu',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Silvassa', slug: 'silvassa', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Daman', slug: 'daman', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Diu', slug: 'diu', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Dadra', slug: 'dadra', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Khanvel', slug: 'khanvel', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'DL',
    name: 'Delhi (NCT)',
    slug: 'delhi',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Delhi', slug: 'delhi', placeType: 'CITY', availabilityState: 'ACTIVE' },
      { name: 'Delhi NCR', slug: 'delhi-ncr', placeType: 'CITY', availabilityState: 'ACTIVE' },
    ],
  },
  {
    code: 'JK',
    name: 'Jammu and Kashmir',
    slug: 'jammu-and-kashmir',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Srinagar', slug: 'srinagar', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Jammu', slug: 'jammu', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Anantnag', slug: 'anantnag', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Baramulla', slug: 'baramulla', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Udhampur', slug: 'udhampur', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'LA',
    name: 'Ladakh',
    slug: 'ladakh',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Leh', slug: 'leh', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Kargil', slug: 'kargil', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Diskit', slug: 'diskit', placeType: 'SERVICE_ZONE', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Drass', slug: 'drass', placeType: 'SERVICE_ZONE', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Nyoma', slug: 'nyoma', placeType: 'SERVICE_ZONE', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'LD',
    name: 'Lakshadweep',
    slug: 'lakshadweep',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Kavaratti', slug: 'kavaratti', placeType: 'ISLAND_CENTRE', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Agatti', slug: 'agatti', placeType: 'ISLAND_CENTRE', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Andrott', slug: 'andrott', placeType: 'ISLAND_CENTRE', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Minicoy', slug: 'minicoy', placeType: 'ISLAND_CENTRE', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Amini', slug: 'amini', placeType: 'ISLAND_CENTRE', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
  {
    code: 'PY',
    name: 'Puducherry',
    slug: 'puducherry',
    type: 'UNION_TERRITORY',
    cities: [
      { name: 'Puducherry', slug: 'puducherry', placeType: 'CITY', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Karaikal', slug: 'karaikal', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Mahe', slug: 'mahe', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
      { name: 'Yanam', slug: 'yanam', placeType: 'TOWN', availabilityState: 'DEMAND_COLLECTING' },
    ],
  },
];

/**
 * Returns flat list of all selectable cities across India
 */
export function getAllSelectableCities(): City[] {
  const cities: City[] = [];
  const now = '2026-10-26T12:00:00.000Z';

  for (const state of INDIA_LOCATION_DIRECTORY) {
    for (const city of state.cities) {
      cities.push({
        id: `city-${city.slug}`,
        name: city.name,
        slug: city.slug,
        state: state.name,
        placeType: city.placeType,
        isActive: city.availabilityState === 'ACTIVE',
        isSelectable: true,
        availabilityState: city.availabilityState,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return cities;
}

/**
 * Returns state list with city counts
 */
export function getAllStatesSummary(): StateDirectory[] {
  return INDIA_LOCATION_DIRECTORY.map((s) => ({
    code: s.code,
    name: s.name,
    slug: s.slug,
    type: s.type,
    citiesCount: s.cities.length,
  }));
}
