import { readFile, writeFile } from 'node:fs/promises';
import { BOM_MD, SEED_SQL } from './paths';
import { expectedBalloonIds, parseBomTable, type BalloonDraft } from './parse-bom';

const TACHYON_DATASHEET =
  'https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/';
const TACHYON_STORE =
  'https://store.particle.io/products/tachyon-5g-single-board-computer';
const M1_DATASHEET =
  'https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/';
const M1_STORE = 'https://store.particle.io/products/m1-enclosure';
const MAX96717_PAGE = 'https://www.analog.com/en/products/max96717.html';
const MAX96724_PAGE = 'https://www.analog.com/en/products/max96724.html';
const TAP_CAST_ACRYLIC =
  'https://www.tapplastics.com/product/plastics/cut_to_size_plastic/acrylic_sheets_cast_clear/510';
const SHEET_HAUS_ACRYCAST =
  'https://sheethaus.com/product/acrycast-acrylic-clear-a000-2440x1220x3mm/';
const EPLASTICS_SHEET = 'https://www.eplastics.com/ACRYCLR0-118PM48X96';
const TACHYON_CAMERAS =
  'https://developer.particle.io/tachyon/device-details/cameras';
const TCA9548A_PAGE = 'https://www.ti.com/product/TCA9548A';
const TCA9548A_DATASHEET = 'https://www.ti.com/lit/ds/symlink/tca9548a.pdf';
const LCSC_B45 =
  'https://www.lcsc.com/product-detail/Serializers-Deserializers_Analog-Devices-Inc-Maxim-Integrated-MAX96717GTJ-VY-T_C7528388.html';
const LCSC_B46 = 'https://www.lcsc.com/product-detail/C27243025.html';
const FARNELL_MAX96724 = 'https://www.farnell.com/datasheets/4416323.pdf';
const FUSE_DUMP = 'https://digikeysearch.tscircuit.com/fuses/list';
const OCTOPART_0154002 = 'https://octopart.com/search?q=0154002.DR';
const MILLMAX_816 =
  'https://www.digikey.com/en/products/detail/mill-max-manufacturing-corp/816-22-012-10-000101/7767160';
const D2FS =
  'https://www.digikey.com/en/products/detail/omron-electronics-inc-emc-div/D2FS-F-N/4753384';
const TPS259830 =
  'https://www.digikey.com/en/products/detail/texas-instruments/TPS259830LNRGER/22106807';
const LEE_LC032 = 'https://www.leespring.com/product/compression-spring-lc032c08m-music-wire';
const LAPP_M20 =
  'https://e.lapp.com/in/p/plastic-cable-glands/skintop-st-m-20x1-5-ral-7035-lgy-53111420';
const SEALCON_M20 = 'https://www.sealconusa.com/product/cd20ma-bk/';
const SPIROL_151284 =
  'https://shop.spirol.com/viewitems/series-29-30-long-heat-ultrasonic-insert-metric/series-30-l-headed-heat-ultrasonic-insert-metric';
const ADAFRUIT_4256 = 'https://www.adafruit.com/product/4256';

const dollar = (value: string): string => {
  let tag = 'bom';
  while (value.includes(`$${tag}$`)) {
    tag = `${tag}x`;
  }
  return `$${tag}$${value}$${tag}$`;
};

const sqlNull = (value: string | null): string =>
  value === null ? 'NULL' : dollar(value);

const FDM_MISS =
  'CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.';

const CAD_NOTES: Record<string, string> = {
  B01: FDM_MISS,
  B02: FDM_MISS,
  B03: FDM_MISS,
  B04: FDM_MISS,
  B05: [
    'Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast).',
    'PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm.',
    'TAP Chemcast properties PDF values are typical for 0.118 in / 3.0 mm, not a spec.',
    'No selected cut-size SKU from TAP. Not a buy.',
    `TAP source: ${TAP_CAST_ACRYLIC}`,
    'Sheet candidate Sheet Haus Acrycast A000AN03.0L0GPCTE 2440 x 1220 x 3 mm; tolerance not printed.',
    `Sheet Haus: ${SHEET_HAUS_ACRYCAST}`,
    'First sheet SKU from CAD: ePlastics ACRYCLR0.118CCM48X96, 0.118 in x 48 in x 96 in Clear Cast Acrylic Paper Masked Sheet. Cuts remain not catalog finished parts.',
    `ePlastics: ${EPLASTICS_SHEET}`,
    'Cassette cut remains REF. 3.00 mm LOCK vs nominal 3 mm UNVERIFIED. None selected.',
  ].join(' '),
  B06: [
    'Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast).',
    'PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm.',
    'TAP Chemcast properties PDF values are typical for 0.118 in / 3.0 mm, not a spec.',
    'No selected cut-size SKU from TAP. Not a buy.',
    `TAP source: ${TAP_CAST_ACRYLIC}`,
    'Sheet candidate Sheet Haus Acrycast A000AN03.0L0GPCTE 2440 x 1220 x 3 mm; tolerance not printed.',
    `Sheet Haus: ${SHEET_HAUS_ACRYCAST}`,
    'First sheet SKU from CAD: ePlastics ACRYCLR0.118CCM48X96, 0.118 in x 48 in x 96 in Clear Cast Acrylic Paper Masked Sheet. Cuts remain not catalog finished parts.',
    `ePlastics: ${EPLASTICS_SHEET}`,
    'Door cut remains REF. 3.00 mm LOCK vs nominal 3 mm UNVERIFIED. None selected.',
  ].join(' '),
  B07: FDM_MISS,
  B08: [
    'CAD miss until a non-JS hinge page is opened.',
    'EE candidates none selected: McMaster 1588A714 / 1588A724 / 1588A733.',
    '11565A11 is not a 3 mm acrylic fit claim. Design still REF.',
  ].join(' '),
  B11: [
    'constraint.',
    'CAD miss: common 18x16 insect mesh is cited around 1.2 mm hole (PVC-coated fiberglass listing); that misses LOCK <=0.80 mm nonmetal aperture.',
    'McMaster insect screens printed no aperture in mm. No selected PN. Stop until a finer nonmetal mesh page is opened.',
  ].join(' '),
  B15: 'CAD miss. UNVERIFIED. No catalog MPN this pass.',
  B16: 'CAD miss. UNVERIFIED. No catalog MPN this pass.',
  B18: FDM_MISS,
  B19: 'UNVERIFIED stack-up. CAD miss this pass. No catalog MPN.',
  B25: [
    'UNVERIFIED rate/PN.',
    'CAD miss remains. EE candidate Lee Spring LC032C08M music wire compression spring.',
    'Printed rate 3.85 N/mm, free 19.05 mm, solid 8.36 mm, solid load 44.48 N.',
    'Arithmetic vs 15-25 N / 5 mm TARGET is ours, not a vendor claim. Pocket UNVERIFIED. Not a buy.',
    `Source: ${LEE_LC032}`,
  ].join(' '),
  B26: 'UNVERIFIED PN. CAD miss. No matching roller+axle set printed. Stop.',
  B27: [
    'power pins and HSD cell UNVERIFIED.',
    'Candidate Mill-Max 816-22-012-10-000101 CONN SPRING PISTON 12POS PCB, 0.100 in (2.54 mm), 12 contacts, 1 row, through hole, series 816.',
    'No current/stroke/HSD printed. Power vs HSD split UNVERIFIED. Pinout not invented.',
    'CAD hold: do not treat this as accepted against a wet/animal balloon. Do not file 812-22-012-30-000101. B20 holds. Not a buy.',
    `Source: ${MILLMAX_816}`,
  ].join(' '),
  B29: 'CAD miss. Binder housing. No catalog MPN this pass.',
  B30: 'CAD miss. Binder housing. No catalog MPN this pass.',
  B31: 'CAD miss. Binder housing. No catalog MPN this pass.',
  B32: 'CAD miss. Binder housing. No catalog MPN this pass.',
  B33: 'CAD miss. Binder housing. No catalog MPN this pass.',
  B34: 'CAD miss. Internal camera-to-serializer FPC clamp. No catalog MPN this pass.',
  B35: [
    'UNVERIFIED geometry.',
    'CAD miss. No official brick-mount SKU. M1ENCLEA is B43, not B35. Stop.',
  ].join(' '),
  B36: [
    'Exact orderable module, revision, outline, connector orientation, and STEP `UNVERIFIED`; legacy B0371 is not a release selection.',
    'No module MPN printed on the Tachyon cameras page. Candidate family printed: Samsung S5K3P9SX and Sony IMX519 Autofocus Module.',
    'Connector printed 22-pin 0.5 mm pitch FPC, 4-lane CSI. No vendor/price/lead. Not a buy.',
    `Source: ${TACHYON_CAMERAS}`,
  ].join(' '),
  B37: 'UNVERIFIED length/orientation. CAD miss. No catalog FPC MPN this pass.',
  B38: [
    'UNVERIFIED selected PN/pocket.',
    'Candidates none selected, pocket UNVERIFIED: SPIROL 151284 (brass, M3 x 0.5, overknurl 4.75 mm, L 5.74 mm, headed);',
    'Adafruit 4255 M3 x 4 mm brass heat-set 50 pack OD 4.2 mm, hole dia not printed;',
    'Adafruit 4256 M3-threaded inserts 3 mm long, 50-pack, brass heat-set;',
    'McMaster 94180A331 and 94180A333 (M3 x 0.5 tapered); McMaster 94459A769 / 94459A130 / 94459A140 (straight).',
    'Screw 91292A113 not confirmed on a McMaster URL. Not a release selection.',
    `SPIROL: ${SPIROL_151284} Adafruit 4256: ${ADAFRUIT_4256}`,
  ].join(' '),
  B39: [
    'UNVERIFIED; never primary latch.',
    'Candidates none selected: McMaster 3506K21 / 3506K36 / 3506K35 / 5679K88 / 5679K89 / 5679K91.',
  ].join(' '),
  B40: 'UNVERIFIED material/compression. CAD miss. No SKU+compression printed. Stop.',
  B41: [
    'verified M1 feature; no moving CSI tether.',
    'M1ENCLEA kit includes 2x M20 cable glands with TE RJ45 feed-through and 2x M20 hole plugs as printed on the M1 enclosure datasheet.',
    'No standalone Particle gland SKU. B41 is kit contents of M1ENCLEA, not a selected gland PN.',
    'Catalog alternates none selected over the Particle kit: LAPP SKINTOP 53111420 M 20 x 1.5 clamp 6-13 mm IP68, bulkhead fit UNVERIFIED;',
    'Sealcon CD20MA-BK / Hummel HSK-K 1.209.2001.50 M20 x 1.5 nylon, cable 6-12 mm, hole 20 mm; locking nut and O-ring sold separately.',
    `LAPP: ${LAPP_M20} Sealcon: ${SEALCON_M20} M1 datasheet: ${M1_DATASHEET}`,
  ].join(' '),
  B42: [
    'Vendor-documented 85 x 56 x 18.5 mm; exact revision CAD still required.',
    'Candidate manufacturer SKUs from the datasheet ordering table, none selected: TACH4NA Tachyon 4GB RAM / 64GB Flash (NorAm); TACH8NA Tachyon 8GB RAM / 128GB Flash (NorAm); TACH8ROW Tachyon 8GB RAM / 128GB Flash (EMEA).',
    'Do not promote TACH4ROW. It is on the store/CE docs, not in the datasheet ordering table. 4GB Rest of World printed $399.00 with no SKU code.',
    'Store page default SKU TACH8NA is not a selected buy. Printed: TACH8NA $459.00 On backorder; TACH8ROW $459.00; 4GB North America $399.00 maps to TACH4NA.',
    'Discovery quote only. Not a buy.',
    `Sources: ${TACHYON_DATASHEET} ${TACHYON_STORE}`,
  ].join(' '),
  B43: [
    'M1ENCLEA; lifecycle GA as printed in the ordering table; vendor-documented 121 x 220 x 69 mm.',
    'Kit includes 2x M20 glands + 2x M20 plugs (B41 adjacent, not a selected standalone gland PN).',
    'Store prints $70 In stock. Discovery quote only. Not a buy.',
    `Sources: ${M1_DATASHEET} ${M1_STORE}`,
  ].join(' '),
  B44: [
    '2 A TARGET, final budget UNVERIFIED.',
    'Rejected as a selection from the tscircuit DigiKey fuse dump. First page prints 1 A 0685T1000-01, 2.5 A 0685T2500-01, 3 A 0685T3000-01 Bel Fuse 1206 parts, not a 2 A rail fuse. Do not pick a neighbor. Cached prices on that page are snapshots, not a quote.',
    `Dump: ${FUSE_DUMP}`,
    'Separate candidate Littelfuse 0154002.DR SMD fuse 9.73 x 5.03 mm, 2 A, FF, 125 V DC / 125 V AC, 50 A. Covers 12 V TARGET. Final budget UNVERIFIED.',
    '$1.411 snapshot is NOT a quote. Related DRT/DRTL/DRL not selected. DigiKey 39512000440 was AC-only, not used.',
    `Octopart: ${OCTOPART_0154002}`,
  ].join(' '),
  B45: [
    'device verified; carrier design UNVERIFIED.',
    'Analog Devices MAX96717 (CSI-2 to GMSL2 serializer). Candidate family from datasheet ordering table, no package selected: MAX96717GTJ/VY+ and MAX96717GTJ/VY+T (32 TQFN-SW-EP, -40 to +105 C).',
    'LCSC C7528388 prints MAX96717GTJ/VY+T with 1+ $6.4526, 10+ $5.6393, 30+ $5.1428, 100+ $4.728, in-stock 2760, ships now. Same page alternative MAX96717GTJ/VY+ at $7.3912 / 57 avail. Package TQFN-32-EP(5x5), 6Gbps.',
    'Discovery quote only. Do not invent a carrier SKU. Not a buy.',
    `Sources: ${MAX96717_PAGE} ${LCSC_B45}`,
  ].join(' '),
  B46: [
    'device verified; Tachyon integration UNVERIFIED.',
    'Device name MAX96724/F/R Quad Tunneling GMSL2/1 to CSI-2 Deserializer.',
    `Farnell PDF is a device-name source, not a suffix pick: ${FARNELL_MAX96724}`,
    'Candidate family, none selected, carrier UNVERIFIED: MAX96724GTN/VY+ (datasheet **Future product); MAX96724FGTN/V+; MAX96724FGTN/VY+; MAX96724RGTN/V+ (datasheet **Future product). Tape-and-reel +T twins also listed on the datasheet; codes not invented beyond named rows.',
    'LCSC C27243025 prints MAX96724GTN/VY+T, 1+ $15.1147, 10+ $14.4884, 30+ $13.4064, 100+ $12.4604, in-stock 1466, ships now. Same page alternative MAX96724GTN/VY+ at $18.0866 / 25 avail. Package TQFN-56-EP(8x8), quad GMSL2/1 to CSI-2, 6Gbps. Pinout not in the fetched HTML.',
    'Honesty tension: CAD datasheet marked MAX96724GTN/VY+ as **Future product. LCSC prints stock on the +T reel. Both facts stand. Do not pick a buy.',
    `Sources: ${MAX96724_PAGE} ${LCSC_B46}`,
  ].join(' '),
  B48: [
    'exact parts, mate order, timeout, polarity, and timing `UNVERIFIED`; P08 is not safety authority.',
    'CAD miss on supervisor / discharge / bus isolation / AND timing: rejected stop. No MPN. 3.3 V monitors opened were not used.',
    'Candidate S1/S2 logic detect only, one MPN not assigned S1 vs S2: D2FS-F-N Aratas (formerly Omron), SPST-NO, 100 mA DC, 6 V DC, Off-Mom. Not a 12 V interrupt. Fit UNVERIFIED.',
    `D2FS: ${D2FS}`,
    'Candidate Q1: TPS259830LNRGER TI, 2.7-26 V, programmable current limit, 18 A max, Auto Retry, OVP, 24-VQFN. Page does not print a 2 A factory limit. Enable from S1 AND S2 / discharge / isolation UNVERIFIED.',
    `TPS259830: ${TPS259830}`,
    'Not a buy.',
  ].join(' '),
  B49: [
    'device documented; address, reset, hot-insertion behavior, carrier, and need remain `UNVERIFIED`.',
    'Texas Instruments TCA9548A. Packages printed TSSOP (PW) 24, VQFN (RGE) 24, VSSOP (DGS) 24; 1.65-5.5 V; reset; Supports hot insertion.',
    'Datasheet Rev. H package option addendum Active/Production rows: TCA9548ADGSR, TCA9548AMRGER, TCA9548APWR, TCA9548ARGER. Omit .B and G4 aliases. No suffix selected. No price/lead on the datasheet.',
    `Sources: ${TCA9548A_PAGE} ${TCA9548A_DATASHEET}`,
  ].join(' '),
  B50: [
    '`C01`-`C12` mirror required nets; series, pin geometry, controlled-impedance launch, mate order, current, hot-unplug behavior, and durability `UNVERIFIED`.',
    'Rejected: opened Molex 1053081212 Nano-Fit 12-pos, latch lock, contacts sold separately, no keying word. Not a keyed 12-net C01-C12. No MPN selected. Pinout not invented. UNVERIFIED stop.',
  ].join(' '),
  B51: 'CAD miss. geometry, fastener retention, drop/handling protocol, and proof load `UNVERIFIED`. No catalog MPN this pass.',
  B52: 'CAD miss. leaves ENIG lands contactable only inside captive external carriage envelope; environmental ingress rating `UNVERIFIED`, not hermetic. No catalog MPN this pass.',
};

type SkuDraft = {
  id: string;
  partId: string;
  manufacturer: string;
  mpn: string;
};

const SKUS: SkuDraft[] = [
  { id: 'B05:ACRYCLR0.118CCM48X96', partId: 'B05', manufacturer: 'ePlastics', mpn: 'ACRYCLR0.118CCM48X96' },
  { id: 'B05:A000AN03.0L0GPCTE', partId: 'B05', manufacturer: 'Sheet Haus', mpn: 'A000AN03.0L0GPCTE' },
  { id: 'B06:ACRYCLR0.118CCM48X96', partId: 'B06', manufacturer: 'ePlastics', mpn: 'ACRYCLR0.118CCM48X96' },
  { id: 'B06:A000AN03.0L0GPCTE', partId: 'B06', manufacturer: 'Sheet Haus', mpn: 'A000AN03.0L0GPCTE' },
  { id: '1588A714', partId: 'B08', manufacturer: 'McMaster-Carr', mpn: '1588A714' },
  { id: '1588A724', partId: 'B08', manufacturer: 'McMaster-Carr', mpn: '1588A724' },
  { id: '1588A733', partId: 'B08', manufacturer: 'McMaster-Carr', mpn: '1588A733' },
  { id: 'LC032C08M', partId: 'B25', manufacturer: 'Lee Spring', mpn: 'LC032C08M' },
  { id: '816-22-012-10-000101', partId: 'B27', manufacturer: 'Mill-Max', mpn: '816-22-012-10-000101' },
  { id: '151284', partId: 'B38', manufacturer: 'SPIROL', mpn: '151284' },
  { id: '4255', partId: 'B38', manufacturer: 'Adafruit', mpn: '4255' },
  { id: '4256', partId: 'B38', manufacturer: 'Adafruit', mpn: '4256' },
  { id: '94180A331', partId: 'B38', manufacturer: 'McMaster-Carr', mpn: '94180A331' },
  { id: '94180A333', partId: 'B38', manufacturer: 'McMaster-Carr', mpn: '94180A333' },
  { id: '94459A769', partId: 'B38', manufacturer: 'McMaster-Carr', mpn: '94459A769' },
  { id: '94459A130', partId: 'B38', manufacturer: 'McMaster-Carr', mpn: '94459A130' },
  { id: '94459A140', partId: 'B38', manufacturer: 'McMaster-Carr', mpn: '94459A140' },
  { id: '3506K21', partId: 'B39', manufacturer: 'McMaster-Carr', mpn: '3506K21' },
  { id: '3506K36', partId: 'B39', manufacturer: 'McMaster-Carr', mpn: '3506K36' },
  { id: '3506K35', partId: 'B39', manufacturer: 'McMaster-Carr', mpn: '3506K35' },
  { id: '5679K88', partId: 'B39', manufacturer: 'McMaster-Carr', mpn: '5679K88' },
  { id: '5679K89', partId: 'B39', manufacturer: 'McMaster-Carr', mpn: '5679K89' },
  { id: '5679K91', partId: 'B39', manufacturer: 'McMaster-Carr', mpn: '5679K91' },
  { id: '53111420', partId: 'B41', manufacturer: 'LAPP', mpn: '53111420' },
  { id: 'CD20MA-BK', partId: 'B41', manufacturer: 'Sealcon', mpn: 'CD20MA-BK' },
  { id: 'TACH4NA', partId: 'B42', manufacturer: 'Particle', mpn: 'TACH4NA' },
  { id: 'TACH8NA', partId: 'B42', manufacturer: 'Particle', mpn: 'TACH8NA' },
  { id: 'TACH8ROW', partId: 'B42', manufacturer: 'Particle', mpn: 'TACH8ROW' },
  { id: 'M1ENCLEA', partId: 'B43', manufacturer: 'Particle', mpn: 'M1ENCLEA' },
  { id: '0154002.DR', partId: 'B44', manufacturer: 'Littelfuse', mpn: '0154002.DR' },
  { id: 'MAX96717GTJ/VY+', partId: 'B45', manufacturer: 'Analog Devices', mpn: 'MAX96717GTJ/VY+' },
  { id: 'MAX96717GTJ/VY+T', partId: 'B45', manufacturer: 'Analog Devices', mpn: 'MAX96717GTJ/VY+T' },
  { id: 'MAX96724GTN/VY+', partId: 'B46', manufacturer: 'Analog Devices', mpn: 'MAX96724GTN/VY+' },
  { id: 'MAX96724FGTN/V+', partId: 'B46', manufacturer: 'Analog Devices', mpn: 'MAX96724FGTN/V+' },
  { id: 'MAX96724FGTN/VY+', partId: 'B46', manufacturer: 'Analog Devices', mpn: 'MAX96724FGTN/VY+' },
  { id: 'MAX96724RGTN/V+', partId: 'B46', manufacturer: 'Analog Devices', mpn: 'MAX96724RGTN/V+' },
  { id: 'MAX96724GTN/VY+T', partId: 'B46', manufacturer: 'Analog Devices', mpn: 'MAX96724GTN/VY+T' },
  { id: 'D2FS-F-N', partId: 'B48', manufacturer: 'Aratas', mpn: 'D2FS-F-N' },
  { id: 'TPS259830LNRGER', partId: 'B48', manufacturer: 'Texas Instruments', mpn: 'TPS259830LNRGER' },
  { id: 'TCA9548ADGSR', partId: 'B49', manufacturer: 'Texas Instruments', mpn: 'TCA9548ADGSR' },
  { id: 'TCA9548AMRGER', partId: 'B49', manufacturer: 'Texas Instruments', mpn: 'TCA9548AMRGER' },
  { id: 'TCA9548APWR', partId: 'B49', manufacturer: 'Texas Instruments', mpn: 'TCA9548APWR' },
  { id: 'TCA9548ARGER', partId: 'B49', manufacturer: 'Texas Instruments', mpn: 'TCA9548ARGER' },
];

const SUPPLIERS: { id: string; name: string }[] = [
  { id: 'particle', name: 'Particle' },
  { id: 'lcsc', name: 'LCSC' },
  { id: 'ti', name: 'Texas Instruments' },
];

const QUOTES: { id: string; supplierId: string; attrs: unknown }[] = [
  {
    id: 'quote-particle-b42',
    supplierId: 'particle',
    attrs: {
      discovery: true,
      unverified: true,
      part_id: 'B42',
      source: TACHYON_STORE,
      page_default_sku: 'TACH8NA',
      page_default_is_not_selected: true,
      printed: {
        TACH8NA: { amount: '459.00', currency: 'USD', availability: 'On backorder' },
        TACH8ROW: { amount: '459.00', currency: 'USD' },
        TACH4NA: { amount: '399.00', currency: 'USD', label: '4GB North America' },
        '4GB Rest of World': { amount: '399.00', currency: 'USD', mpn: null },
      },
      note: 'Discovery quote. Not a buy. TACH4ROW was not printed as a SKU code.',
    },
  },
  {
    id: 'quote-particle-b43',
    supplierId: 'particle',
    attrs: {
      discovery: true,
      unverified: true,
      part_id: 'B43',
      source: M1_STORE,
      mpn: 'M1ENCLEA',
      printed: { amount: '70', currency: 'USD', availability: 'In stock' },
      note: 'Discovery quote. Not a buy.',
    },
  },
  {
    id: 'quote-lcsc-b45',
    supplierId: 'lcsc',
    attrs: {
      discovery: true,
      unverified: true,
      part_id: 'B45',
      source: LCSC_B45,
      vendor_sku: 'C7528388',
      mpn: 'MAX96717GTJ/VY+T',
      manufacturer: 'Analog Devices / MAXIM',
      printed_breaks: [
        { qty: 1, amount: '6.4526', currency: 'USD' },
        { qty: 10, amount: '5.6393', currency: 'USD' },
        { qty: 30, amount: '5.1428', currency: 'USD' },
        { qty: 100, amount: '4.728', currency: 'USD' },
      ],
      in_stock: 2760,
      lead: 'ships now',
      alternative: { mpn: 'MAX96717GTJ/VY+', amount: '7.3912', currency: 'USD', avail: 57 },
      package: 'TQFN-32-EP(5x5)',
      note: 'Candidate IC only. Carrier UNVERIFIED. Not a buy.',
    },
  },
  {
    id: 'quote-lcsc-b46',
    supplierId: 'lcsc',
    attrs: {
      discovery: true,
      unverified: true,
      part_id: 'B46',
      source: LCSC_B46,
      vendor_sku: 'C27243025',
      mpn: 'MAX96724GTN/VY+T',
      manufacturer: 'Analog Devices / MAXIM',
      printed_breaks: [
        { qty: 1, amount: '15.1147', currency: 'USD' },
        { qty: 10, amount: '14.4884', currency: 'USD' },
        { qty: 30, amount: '13.4064', currency: 'USD' },
        { qty: 100, amount: '12.4604', currency: 'USD' },
      ],
      in_stock: 1466,
      lead: 'ships now',
      alternative: { mpn: 'MAX96724GTN/VY+', amount: '18.0866', currency: 'USD', avail: 25 },
      package: 'TQFN-56-EP(8x8)',
      future_product_tension:
        'Datasheet marked MAX96724GTN/VY+ as Future product. LCSC prints stock on the +T reel.',
      note: 'Candidate IC only. Carrier / Tachyon integration UNVERIFIED. Not a buy.',
    },
  },
];

const applyCadSearchHits = (balloons: BalloonDraft[]): void => {
  for (const balloon of balloons) {
    const notes = CAD_NOTES[balloon.balloonId];
    if (notes !== undefined) {
      balloon.notes = notes;
    }
  }
};

const generate = async (): Promise<string> => {
  const markdown = await readFile(BOM_MD, 'utf8');
  const balloons = parseBomTable(markdown);
  applyCadSearchHits(balloons);
  const expected = expectedBalloonIds();
  if (balloons.length !== 52) {
    throw new Error(`expected 52 balloons, parsed ${balloons.length}`);
  }
  for (const id of expected) {
    if (!balloons.some((row) => row.balloonId === id)) {
      throw new Error(`missing ${id}`);
    }
  }

  const inserts = balloons.map(
    (row) =>
      `INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES (${dollar(row.balloonId)}, ${dollar(row.name)}, ${dollar(row.qtyText)}, ${sqlNull(row.class)}, ${dollar(row.notes)}) ON CONFLICT (balloon_id) DO NOTHING;`,
  );

  const supplierSql = SUPPLIERS.map(
    (row) =>
      `INSERT INTO supplier_party (id, name) VALUES (${dollar(row.id)}, ${dollar(row.name)}) ON CONFLICT (id) DO NOTHING;`,
  );

  const skuValues = SKUS.map((row, i) => {
    const comma = i === SKUS.length - 1 ? '' : ',';
    return `  (${dollar(row.id)}, ${dollar(row.partId)}, ${dollar(row.manufacturer)}, ${dollar(row.mpn)}, NULL)${comma}`;
  });

  const quoteSql = QUOTES.map(
    (row) =>
      `INSERT INTO quote (quote_id, supplier_party_id, attrs) VALUES (${dollar(row.id)}, ${dollar(row.supplierId)}, ${dollar(JSON.stringify(row.attrs))}::jsonb) ON CONFLICT (quote_id) DO NOTHING;`,
  );

  return `-- Generated from terrarium/BOM.md plus CAD/EE search hits.
-- Candidate manufacturer_sku rows are not a selected SKU and not an order.
-- manufacturer_sku has no source_url, description, or lifecycle columns.
-- supplier_party has no URL column. Source URLs live in part.notes and quote.attrs.
-- Quotes are discovery UNVERIFIED printed pages. Not a buy.
-- purchase_order, cost_history, and lead_time stay empty.
-- Class tokens stay as parsed from BOM.md. None become orderable.
-- B42 TACH4ROW is not landed. B46 future-product vs LCSC stock both stay in notes.

${inserts.join('\n')}

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  ${dollar('alt-B36-B0371')},
  ${dollar('B36')},
  ${dollar('B0371')},
  ${dollar('rejected')},
  NULL,
  NULL,
  ${dollar('Historical Release A only; not a release selection. No manufacturer part number.')}
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  ${dollar('alt-B44-fuse-dump')},
  ${dollar('B44')},
  ${dollar('tscircuit DigiKey fuse dump')},
  ${dollar('rejected')},
  ${dollar('Bel Fuse')},
  NULL,
  ${dollar('1 A 0685T1000-01, 2.5 A 0685T2500-01, 3 A 0685T3000-01 are not a 2 A rail fuse. Do not pick a neighbor. Cached prices are not a quote.')}
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  ${dollar('alt-B48-supervisor')},
  ${dollar('B48')},
  ${dollar('supervisor / discharge / bus isolation')},
  ${dollar('rejected')},
  NULL,
  NULL,
  ${dollar('Rejected stop. No MPN. 3.3 V monitors opened were not used.')}
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  ${dollar('alt-B50-molex-1053081212')},
  ${dollar('B50')},
  ${dollar('Molex 1053081212')},
  ${dollar('rejected')},
  ${dollar('Molex')},
  ${dollar('1053081212')},
  ${dollar('Nano-Fit 12-pos, latch lock, contacts sold separately, no keying word. Not a keyed 12-net C01-C12. No MPN selected.')}
)
ON CONFLICT (id) DO NOTHING;

${supplierSql.join('\n')}

INSERT INTO manufacturer_sku (id, part_id, manufacturer, mpn, revision) VALUES
${skuValues.join('\n')}
ON CONFLICT (id) DO NOTHING;

${quoteSql.join('\n')}

INSERT INTO where_used (parent_id, child_id, relation) VALUES
  (${dollar('B35')}, ${dollar('B42')}, ${dollar('mounts')}),
  (${dollar('B29')}, ${dollar('B36')}, ${dollar('sits-on')})
ON CONFLICT (parent_id, child_id, relation) DO NOTHING;

INSERT INTO kit (kit_id, name, notes) VALUES (
  ${dollar('first-tower')},
  ${dollar('First tower')},
  ${dollar('Quantities are first-tower estimates copied from the balloon register. Qty stays text. Shop pack is DRAFT; do not order from it.')}
)
ON CONFLICT (kit_id) DO NOTHING;

INSERT INTO kit_line (kit_id, part_id, qty_text)
SELECT 'first-tower', balloon_id, qty_text
FROM part
ON CONFLICT (kit_id, part_id) DO NOTHING;
`;
};

const sql = await generate();
await writeFile(SEED_SQL, sql);
