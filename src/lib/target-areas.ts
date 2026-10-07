export type TargetArea = {
  name: string;
  postcodePrefixes: string[];
  searchTerms: string[];
};

export const TARGET_AREAS: TargetArea[] = [
  { name: "Reading", postcodePrefixes: ["RG1", "RG2", "RG3", "RG4", "RG5", "RG6", "RG7", "RG8"], searchTerms: ["Reading"] },
  { name: "Caversham", postcodePrefixes: ["RG4"], searchTerms: ["Caversham"] },
  { name: "Tilehurst", postcodePrefixes: ["RG4"], searchTerms: ["Tilehurst"] },
  { name: "Woodley", postcodePrefixes: ["RG5"], searchTerms: ["Woodley"] },
  { name: "Wokingham", postcodePrefixes: ["RG40", "RG41"], searchTerms: ["Wokingham"] },
  { name: "Winnersh", postcodePrefixes: ["RG41", "RG40"], searchTerms: ["Winnersh"] },
  { name: "Bracknell", postcodePrefixes: ["RG10", "RG12", "RG13", "RG14"], searchTerms: ["Bracknell"] },
  { name: "Theale", postcodePrefixes: ["RG7"], searchTerms: ["Theale"] },
  { name: "Thatcham", postcodePrefixes: ["RG18", "RG19"], searchTerms: ["Thatcham"] },
  { name: "Newbury", postcodePrefixes: ["RG14", "RG15", "RG16", "RG17", "RG18", "RG19", "RG20"], searchTerms: ["Newbury"] },
  { name: "Crowthorne", postcodePrefixes: ["RG6"], searchTerms: ["Crowthorne", "Wokingham"] },
  { name: "Finchampstead", postcodePrefixes: ["RG40", "RG41"], searchTerms: ["Finchampstead"] },
  { name: "Farnborough", postcodePrefixes: ["GU14", "GU15", "GU16", "GU17"], searchTerms: ["Farnborough"] },
  { name: "Camberley", postcodePrefixes: ["GU15", "GU16", "GU17"], searchTerms: ["Camberley"] },
  { name: "High Wycombe", postcodePrefixes: ["HP10", "HP11", "HP12", "HP13", "HP14", "HP15", "HP16", "HP7"], searchTerms: ["High Wycombe"] },
  { name: "Marlow", postcodePrefixes: ["SL7"], searchTerms: ["Marlow", "Bucks"] },
  { name: "Slough", postcodePrefixes: ["SL1", "SL2", "SL3"], searchTerms: ["Slough"] },
  { name: "Basingstoke", postcodePrefixes: ["RG21", "RG22", "RG23", "RG24", "RG25", "RG26", "RG27"], searchTerms: ["Basingstoke"] },
];

type SicRule = { codes: string[]; label: string; weight: number; angle: string };

const SELLING_SICS: SicRule[] = [
  { codes: ["55100", "55209", "55300", "55900"], label: "Hotels / accommodation", weight: 30, angle: "Guest arrivals, check-in courtesy runs, airport transfers for arriving guests, extended hotel contracts" },
  { codes: ["55900", "55209"], label: "Wedding / function venues", weight: 32, angle: "Wedding parties, guest shuttles between venue and hotels, late-night return legs" },
  { codes: ["90010", "90020", "90030", "90040"], label: "Events / conference / entertainment venues", weight: 30, angle: "Speakers, VIP movements, delegate transfers, event-day fleet on standby" },
  { codes: ["82300"], label: "Convention and events organisers", weight: 32, angle: "Full event-day transport management for organiser clients you resell to" },
  { codes: ["73110", "73120", "73200"], label: "Advertising / marketing agencies", weight: 20, angle: "Launch events, client entertainment moves, agency itself as a corporate account" },
  { codes: ["62011", "62012", "62020", "62030", "62090"], label: "IT / software / consultancy", weight: 24, angle: "Recruitment interviews, team offsites, client visits, daily executive commuting" },
  { codes: ["70100", "70201", "70202"], label: "Head offices / management consulting", weight: 24, angle: "Executive chauffeur accounts, multi-day booking patterns, airport runs" },
  { codes: ["86900"], label: "Healthcare / clinics", weight: 22, angle: "Discreet private patient transport, VIP patient appointments" },
  { codes: ["86210", "86220", "86230"], label: "Hospitals / medical", weight: 22, angle: "Patient and staff transport, confidential journeys" },
  { codes: ["69101", "69102"], label: "Solicitors", weight: 16, angle: "Partner meeting transport, client site visits" },
  { codes: ["69201", "69202", "69203"], label: "Accountants / tax advisers", weight: 14, angle: "Partner travel, client meeting transport" },
  { codes: ["94110", "94200"], label: "Trade associations / business memberships", weight: 26, angle: "Member events transport, association function chauffeur" },
  { codes: ["94990"], label: "Membership / professional clubs", weight: 24, angle: "Member and guest transport, function chauffeur" },
  { codes: ["82990"], label: "Business support / facilities management", weight: 22, angle: "Outsourced corporate transport contract" },
  { codes: ["77110", "77210"], label: "Car hire / leasing", weight: 18, angle: "Fleet subcontracting, overflow and event-day vehicle cover" },
  { codes: ["45100"], label: "Wholesale distribution", weight: 14, angle: "Multi-stop goods-in and chauffeur logistics for directors" },
  { codes: ["26510", "26520"], label: "Electronics / manufacturing", weight: 15, angle: "Executive travel, site visitor movements, multi-day contracts" },
  { codes: ["21410"], label: "Motor vehicle manufacturing", weight: 18, angle: "Executive and VIP travel, supplier site visits" },
  { codes: ["47710", "47721", "47722", "47741", "47782"], label: "Retail chains", weight: 18, angle: "Store visit travel, head office trips, event day fleet" },
  { codes: ["56101"], label: "Restaurants", weight: 14, angle: "Private dining guest transport, chef and staff shifts" },
  { codes: ["68310", "68320"], label: "Estate agents / property", weight: 15, angle: "Viewing appointments, contractor site visits, executive travel" },
  { codes: ["85000", "85410", "85420", "85500", "85600"], label: "Education / training", weight: 18, angle: "Speaker transport, visiting academic movements, school event days" },
  { codes: ["72110", "72190"], label: "R&D / scientific consulting", weight: 16, angle: "Collaborator site visits, conference transport" },
  { codes: ["29100", "29200", "29301", "29302"], label: "Motor vehicle manufacture & supply", weight: 18, angle: "Executive travel and press vehicle movements" },
  { codes: ["70221"], label: "PR / corporate communications", weight: 22, angle: "Press and influencer event transport, launch evenings" },
  { codes: ["60100", "60200", "61300"], label: "Broadcast / media", weight: 18, angle: "Crew and talent transport, outside broadcast support" },
  { codes: ["88990"], label: "Other household services", weight: 10, angle: "General corporate travel enquiry" },
  { codes: ["37000"], label: "Sewerage / waste", weight: 8, angle: "Contracted site transport" },
  { codes: ["98000"], label: "Residents property management", weight: 16, angle: "Landlord and executive relocations, viewings" },
  { codes: ["70100"], label: "Real estate agents", weight: 15, angle: "Executive and client viewing transport" },
  { codes: ["74300"], label: "Photographic / film", weight: 16, angle: "Crew transport, location moves" },
  { codes: ["91040"], label: "Libraries / cultural", weight: 18, angle: "Speaker and guest transport for cultural programmes" },
  { codes: ["91020"], label: "Museums / galleries", weight: 22, angle: "Private client tours, donor and guest movements, exhibition openings" },
  { codes: ["91030"], label: "Art galleries", weight: 22, angle: "Private view and collection transport, high-net-worth clients" },
  { codes: ["42991"], label: "Horological / luxury goods", weight: 14, angle: "High-value goods and client movements" },
  { codes: ["46390"], label: "Food / beverage wholesale", weight: 10, angle: "Director travel and tastings" },
  { codes: ["25610", "25620"], label: "Metal fabrication", weight: 10, angle: "Site and client transport" },
  { codes: ["30100"], label: "Ship building", weight: 12, angle: "Client and site visits" },
  { codes: ["36000"], label: "Water supply", weight: 8, angle: "Contract transport" },
  { codes: ["33110"], label: "Repair of vehicles", weight: 10, angle: "Subcontract vehicle cover" },
  { codes: ["16230"], label: "Joinery", weight: 12, angle: "Site visit transport" },
  { codes: ["33200"], label: "Installation of industrial machinery", weight: 12, angle: "Engineer and client site travel" },
  { codes: ["22290"], label: "Plastics products", weight: 10, angle: "Management travel" },
  { codes: ["20150"], label: "Rail equipment", weight: 12, angle: "Client and site travel" },
  { codes: ["20420"], label: "Pharmaceutical preparations", weight: 14, angle: "Executive and regulatory site travel" },
  { codes: ["21100"], label: "Basic pharmaceutical products", weight: 12, angle: "Executive travel" },
  { codes: ["32500"], label: "Medical and dental instruments", weight: 14, angle: "Distributor and hospital visit travel" },
  { codes: ["46690"], label: "Wholesale of other household goods", weight: 9, angle: "General business travel" },
  { codes: ["84110"], label: "General public administration", weight: 6, angle: "Public sector transport unlikely" },
  { codes: ["85100"], label: "Pre-primary education", weight: 12, angle: "Visitor and event transport" },
  { codes: ["85310"], label: "General secondary education", weight: 14, angle: "Visitor, speaker and event transport" },
  { codes: ["85320"], label: "Secondary education", weight: 14, angle: "Visitor and event transport" },
  { codes: ["85421"], label: "First aid training", weight: 18, angle: "Corporate training event transport" },
  { codes: ["85590"], label: "Other education", weight: 14, angle: "Course and speaker transport" },
  { codes: ["85600"], label: "Educational support activities", weight: 12, angle: "Recruitment and session transport" },
  { codes: ["90030"], label: "Artistic creation", weight: 20, angle: "Gallery and exhibition transport, artist movements" },
  { codes: ["60200"], label: "TV programming", weight: 18, angle: "Talent and crew transport" },
  { codes: ["58110", "58120"], label: "Publishing / magazines", weight: 14, angle: "Interviews, launches, contributor travel" },
  { codes: ["60200", "78110", "78120"], label: "Media activities", weight: 18, angle: "Production and talent movement" },
  { codes: ["47789"], label: "Other retail", weight: 10, angle: "General travel" },
  { codes: ["64209"], label: "Other holding companies", weight: 8, angle: "Group executive travel" },
  { codes: ["64309"], label: "Renting and leasing of own real estate", weight: 10, angle: "Landlord and tenant movements" },
  { codes: ["68100"], label: "Buying and selling of own real estate", weight: 12, angle: "Executive travel" },
  { codes: ["68201"], label: "Residential sales and lettings", weight: 14, angle: "Viewing and client transport" },
  { codes: ["68321"], label: "Industrial estate agents", weight: 12, angle: "Site visit transport" },
  { codes: ["74110"], label: "Industrial design", weight: 16, angle: "Design studio and client travel" },
  { codes: ["71200"], label: "Architecture / planning consultancy", weight: 16, angle: "Site visit and client meeting transport" },
  { codes: ["82990"], label: "Business support services", weight: 20, angle: "Outsourced corporate transport" },
  { codes: ["73200"], label: "Market research", weight: 14, angle: "Panel and client travel" },
  { codes: ["78320"], label: "Human resource management", weight: 12, angle: "Candidate interview transport" },
  { codes: ["94120"], label: "Professional membership organisations", weight: 26, angle: "Member and delegate event transport" },
  { codes: ["94920"], label: "Professional membership organisations n.e.c.", weight: 24, angle: "Member event transport" },
  { codes: ["93110"], label: "Operation of sports facilities", weight: 20, angle: "Team, spectator and officials transport" },
  { codes: ["93120"], label: "Activity centres", weight: 18, angle: "Group and event transport" },
  { codes: ["91040"], label: "Libraries", weight: 14, angle: "Visitor transport" },
];

const DEFAULT_SIC = {
  codes: ["46500", "96000", "36000", "37000", "35000", "11000", "61000", "62000", "63000", "33000", "31000", "29000", "28000", "24000", "22000", "23000", "21000", "20000", "19000", "18000", "17000", "16000", "15000", "14000", "13000", "12000", "11000"],
  label: "General business",
  weight: 6,
  angle: "General corporate and executive transport enquiry",
};

export function scoreForSics(sicCodes: string[]): { score: number; industry: string; angle: string } {
  let best = DEFAULT_SIC;
  let weight = DEFAULT_SIC.weight;
  for (const rule of SELLING_SICS) {
    const hit = rule.codes.some((code) => sicCodes.includes(code));
    if (hit && rule.weight > weight) {
      best = rule;
      weight = rule.weight;
    }
  }
  return { score: weight, industry: best.label, angle: best.angle };
}

export function priorityFor(score: number): "Very High" | "High" | "Medium" | "Low" {
  if (score >= 28) return "Very High";
  if (score >= 20) return "High";
  if (score >= 12) return "Medium";
  return "Low";
}

/**
 * Finer-grained "niche" label than the broad industry category. Two companies
 * both classed as Hotels / accommodation are not the same sale: a country house
 * hotel that hosts weddings buys a different service from a business airport
 * hotel, so the niche is what the outreach actually keys off.
 */
const NICHE_RULES: Array<{ codes: string[]; niche: string }> = [
  { codes: ["55209"], niche: "Weddings & banqueting venue" },
  { codes: ["55209", "55900"], niche: "Country house & events estate" },
  { codes: ["55100"], niche: "Business & city hotel" },
  { codes: ["55100", "55209"], niche: "Boutique hotel with event space" },
  { codes: ["55900"], niche: "Serviced apartments & guest accommodation" },
  { codes: ["55300"], niche: "Motorway & budget hotel" },
  { codes: ["82300"], niche: "Conference & events organiser" },
  { codes: ["82301"], niche: "Event production & AV hire" },
  { codes: ["90010"], niche: "Theatre & live performance venue" },
  { codes: ["90030", "90041"], niche: "Arts centre & gallery" },
  { codes: ["90040"], niche: "Sports club & stadium" },
  { codes: ["93110", "93120"], niche: "Leisure & activity centre" },
  { codes: ["70201"], niche: "Management consultancy" },
  { codes: ["70202"], niche: "PR & communications agency" },
  { codes: ["73110", "73120"], niche: "Marketing & advertising agency" },
  { codes: ["73200"], niche: "Market research agency" },
  { codes: ["62011", "62012"], niche: "Software house" },
  { codes: ["62020", "62030"], niche: "IT services & managed hosting" },
  { codes: ["62090"], niche: "Technology consultancy" },
  { codes: ["26510", "26520"], niche: "Electronics manufacturing" },
  { codes: ["21410"], niche: "Motor vehicle manufacturer" },
  { codes: ["29100", "29200", "29301"], niche: "Automotive supplier & distributor" },
  { codes: ["77110", "77210"], niche: "Vehicle rental & leasing" },
  { codes: ["33110"], niche: "Vehicle repair & servicing" },
  { codes: ["94110", "94120"], niche: "Business trade association" },
  { codes: ["94920", "94990"], niche: "Professional membership body" },
  { codes: ["86900"], niche: "Private clinic & aesthetic practice" },
  { codes: ["86210", "86220"], niche: "Hospital & medical centre" },
  { codes: ["86110"], niche: "General medical practice" },
  { codes: ["87300"], niche: "Residential care home" },
  { codes: ["88990"], niche: "Facilities management & services" },
  { codes: ["82990"], niche: "Business support & outsourcing" },
  { codes: ["69201", "69202", "69203"], niche: "Accountancy & tax advisory" },
  { codes: ["69101", "69102"], niche: "Solicitors & legal practice" },
  { codes: ["70100"], niche: "Estate agency & property sales" },
  { codes: ["68201"], niche: "Residential lettings" },
  { codes: ["68310"], niche: "Commercial property agency" },
  { codes: ["98000"], niche: "Property management & serviced lets" },
  { codes: ["56101"], niche: "Restaurant & private dining" },
  { codes: ["56302"], niche: "Events catering" },
  { codes: ["47410"], niche: "Retail chain head office" },
  { codes: ["47710", "47789"], niche: "Specialist retail" },
  { codes: ["85590", "85600"], niche: "Corporate training provider" },
  { codes: ["85310", "85320"], niche: "Independent school" },
  { codes: ["85100"], niche: "Nursery & early years" },
  { codes: ["60200", "78110"], niche: "Media, TV & production" },
  { codes: ["58110", "58120"], niche: "Publisher & editorial" },
  { codes: ["71200"], niche: "Architecture & planning consultancy" },
  { codes: ["74110", "74120"], niche: "Design studio" },
  { codes: ["32500"], niche: "Medical & dental equipment" },
  { codes: ["21100", "20420"], niche: "Pharmaceuticals" },
  { codes: ["78320"], niche: "Recruitment agency" },
  { codes: ["45100"], niche: "Wholesale distribution" },
  { codes: ["25610", "25620"], niche: "Metal fabrication" },
  { codes: ["33200"], niche: "Industrial installation & maintenance" },
  { codes: ["36000"], niche: "Water utility" },
  { codes: ["37000"], niche: "Waste management" },
];

export function deriveNiche(sicCodes: string[], companyName: string): string {
  for (const rule of NICHE_RULES) {
    if (rule.codes.some((code) => sicCodes.includes(code))) return rule.niche;
  }

  const name = companyName.toLowerCase();
  const keywords: Array<[RegExp, string]> = [
    [/\b(wedding|bridal|venue|banquet|events?)\b/, "Weddings & events"],
    [/\b(hotel|inn|lodge|guest ?house)\b/, "Hospitality"],
    [/\b(charter|chauffeur|minibus|coach|travel|tours?|transport)\b/, "Transport & tours"],
    [/\b(property|estate|realty|lettings)\b/, "Property"],
    [/\b(legal|solicitor|law)\b/, "Legal"],
    [/\b(account|tax|audit)\b/, "Accountancy"],
    [/\b(clinic|dental|medical|health|care)\b/, "Healthcare"],
    [/\b(construction|building|contractor|joinery)\b/, "Construction"],
    [/\b(consult|advisory|partners)\b/, "Consultancy"],
    [/\b(school|college|academy|education|training)\b/, "Education"],
    [/\b(recruit|resourcing|personnel)\b/, "Recruitment"],
    [/\b(media|production|studio|creative|design)\b/, "Media & creative"],
    [/\b(catering|restaurant|food|bakery)\b/, "Food & drink"],
    [/\b(security|guard|facilities|cleaning)\b/, "Facilities & security"],
    [/\b(technology|software|systems|digital|data|it)\b/, "Technology"],
    [/\b(motors?|automotive|car|vehicles|tyres?)\b/, "Automotive"],
  ];
  for (const [pattern, niche] of keywords) {
    if (pattern.test(name)) return niche;
  }
  return "General business";
}