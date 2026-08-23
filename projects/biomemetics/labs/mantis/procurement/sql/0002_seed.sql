-- Generated from terrarium/BOM.md plus CAD/EE search hits.
-- Candidate manufacturer_sku rows are not a selected SKU and not an order.
-- manufacturer_sku has no source_url, description, or lifecycle columns.
-- supplier_party has no URL column. Source URLs live in part.notes and quote.attrs.
-- Quotes are discovery UNVERIFIED printed pages. Not a buy.
-- purchase_order, cost_history, and lead_time stay empty.
-- Class tokens stay as parsed from BOM.md. None become orderable.
-- B42 TACH4ROW is not landed. B46 future-product vs LCSC stock both stay in notes.

INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B01$bom$, $bom$PETG/ASA corner block$bom$, $bom$8$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B02$bom$, $bom$250 mm edge member$bom$, $bom$16$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B03$bom$, $bom$250-to-500 splice/alignment block$bom$, $bom$4$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B04$bom$, $bom$cassette retainer/gasket carrier$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B05$bom$, $bom$3 mm cast-acrylic view cassette$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast). PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm. TAP Chemcast properties PDF values are typical for 0.118 in / 3.0 mm, not a spec. No selected cut-size SKU from TAP. Not a buy. TAP source: https://www.tapplastics.com/product/plastics/cut_to_size_plastic/acrylic_sheets_cast_clear/510 Sheet candidate Sheet Haus Acrycast A000AN03.0L0GPCTE 2440 x 1220 x 3 mm; tolerance not printed. TAP Chemcast family and Sheet Haus stay as other family/sheet candidates. Sheet Haus: https://sheethaus.com/product/acrycast-acrylic-clear-a000-2440x1220x3mm/ First sheet SKU from CAD: ePlastics ACRYCLR0.118CCM48X96, 0.118 in x 48 in x 96 in Clear Cast Acrylic Paper Masked Sheet. Cuts remain not catalog finished parts. No price landed from the ePlastics page. Not a buy. ePlastics: https://www.eplastics.com/ACRYCLR0-118PM48X96 Cassette cut remains REF. 3.00 mm LOCK vs nominal 3 mm UNVERIFIED. None selected.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B06$bom$, $bom$3 mm cast-acrylic front door$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast). PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm. TAP Chemcast properties PDF values are typical for 0.118 in / 3.0 mm, not a spec. No selected cut-size SKU from TAP. Not a buy. TAP source: https://www.tapplastics.com/product/plastics/cut_to_size_plastic/acrylic_sheets_cast_clear/510 Sheet candidate Sheet Haus Acrycast A000AN03.0L0GPCTE 2440 x 1220 x 3 mm; tolerance not printed. TAP Chemcast family and Sheet Haus stay as other family/sheet candidates. Sheet Haus: https://sheethaus.com/product/acrycast-acrylic-clear-a000-2440x1220x3mm/ First sheet SKU from CAD: ePlastics ACRYCLR0.118CCM48X96, 0.118 in x 48 in x 96 in Clear Cast Acrylic Paper Masked Sheet. Cuts remain not catalog finished parts. No price landed from the ePlastics page. Not a buy. ePlastics: https://www.eplastics.com/ACRYCLR0-118PM48X96 Door cut remains REF. 3.00 mm LOCK vs nominal 3 mm UNVERIFIED. None selected.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B07$bom$, $bom$printed door labyrinth surround$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B08$bom$, $bom$external polymer hinge set$bom$, $bom$2$bom$, $bom$REF$bom$, $bom$CAD miss this pass until a non-JS hinge page is opened. Southco timed out. McMaster JS. EE candidates none selected remain: McMaster 1588A714 / 1588A724 / 1588A733. 11565A11 is not a 3 mm acrylic fit claim. Design still REF. Do not file McMaster PNs from this CAD pass, including 9218T23 / 11195A11 / 7381K31.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B09$bom$, $bom$independent mechanical door latch$bom$, $bom$2$bom$, $bom$REF$bom$, $bom$LOCK count / REF design. Design still REF. Not a buy. No metal mesh. Extra latch candidate this hunt, not selected: Southco C2-32-15 lever compression, 1-5 mm panel (3.00 mm acrylic inside), 1-24 mm grip, zinc alloy black. Sits beside 1794A63 / V2-0025-52 / SCC-xx/SS. SCC-xx/SS remains a family placeholder; no SCC dash invented. 1794A63 and V2-0025-52 named as siblings, not newly filed this hunt. Southco: https://southco.com/en_us_int/c2-32-15$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B10$bom$, $bom$two-piece ceiling mesh frame$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss this pass. No catalog MPN. No metal mesh.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B11$bom$, $bom$<=0.8 mm plastic/fiberglass/polyester screen$bom$, $bom$set$bom$, $bom$LOCK$bom$, $bom$constraint. CAD miss: common 18x16 insect mesh is cited around 1.2 mm hole (PVC-coated fiberglass listing); that misses LOCK <=0.80 mm nonmetal aperture. McMaster insect screens printed no aperture in mm. None selected. UNVERIFIED stop until a finer nonmetal mesh page is opened. No metal mesh.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B12$bom$, $bom$low-intake vent cassette$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss this pass. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B13$bom$, $bom$high-exhaust vent cassette$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss this pass. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B14$bom$, $bom$perforated false bottom$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss this pass. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B15$bom$, $bom$20-30 mm drain tray$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss this pass. UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B16$bom$, $bom$drain plug plus insect baffle$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss this pass. UNVERIFIED. No catalog MPN. Do not file Exo Terra PT2683 as the combo.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B17$bom$, $bom$removable perch socket/cap$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$CAD miss this pass. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B18$bom$, $bom$external 38 mm hybrid rail channel$bom$, $bom$route set$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B19$bom$, $bom$P01-P08 continuous electrode flex plus V-dock pads$bom$, $bom$route set$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED stack-up. CAD miss remains. Assembly+stack UNVERIFIED STOP. Do not invent pads or a stack. EE this pass, pad-array candidate only: Mill-Max 319-10-108-00-001000, 8-pos gold mating target, THT, 2.54 mm. Snapshot $16.19 qty-1 / In-Stock 65 / 4 weeks is NOT a quote. Not a flex electrode strip. Pyralux AP grades AP8515R through AP9161R on https://www.dupont.com/electronics-industrial/pyralux-ap.html are materials only; no stack selected. 319-10-112-00-001000 rejected (contacts print 10 vs header 12). CAD B27 wet/animal hold still stands if this is a pogo mate. B20 holds. Class stays UNVERIFIED. Not a buy. Source: https://www.digikey.com/en/products/detail/mill-max-manufacturing-corp/319-10-108-00-001000/7743231$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B20$bom$, $bom$continuous structural rail wall / wet-side barrier$bom$, $bom$route set$bom$, $bom$REF$bom$, $bom$animal-volume boundary, not an insulating film over contacts$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B21$bom$, $bom$rail splice and corner electrical junction$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$carriage does not turn corner$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B22$bom$, $bom$carriage outer shell$bom$, $bom$1+$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B23$bom$, $bom$opposed pinch levers and cams$bom$, $bom$2/carriage$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B24$bom$, $bom$split floating contact carrier$bom$, $bom$1/carriage$bom$, $bom$REF$bom$, $bom$HSD cell vertically seats$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B25$bom$, $bom$normally locked carriage spring$bom$, $bom$1/carriage$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED rate/PN. CAD catalog candidate this pass, matches EE: Lee Spring LC032C08M, dry/external carriage, not animal-side. B20 holds. Printed: Standard Compression Series (inch); Music Wire ASTM A228; OD 0.24 in / 6.10 mm; free 0.750 in / 19.05 mm; solid 0.329 in / 8.36 mm; rate 22.00 lb/in / 3.85 N/mm; load at solid 10.00 lb / 44.48 N; squared and ground; zinc plate ASTM B633. Arithmetic vs 15-25 N / 5 mm TARGET is ours, not a vendor claim. Pocket / normally-locked path UNVERIFIED. Not a buy. No price landed from the Lee Spring page. Source: https://www.leespring.com/product/compression-spring-lc032c08m-music-wire$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B26$bom$, $bom$polymer roller and axle set$bom$, $bom$4/carriage$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED PN. CAD miss this pass. No matching roller+axle set printed. Stop.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B27$bom$, $bom$12-position spring contact array$bom$, $bom$1/carriage$bom$, NULL, $bom$power pins and HSD cell UNVERIFIED. Candidate Mill-Max 816-22-012-10-000101 CONN SPRING PISTON 12POS PCB, 0.100 in (2.54 mm), 12 contacts, 1 row, through hole, series 816. No current/stroke/HSD printed. Power vs HSD split UNVERIFIED. Pinout not invented. CAD hold: do not treat this as accepted against a wet/animal balloon. Do not file 812-22-012-30-000101. B20 holds. Not a buy. Source: https://www.digikey.com/en/products/detail/mill-max-manufacturing-corp/816-22-012-10-000101/7767160$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B28$bom$, $bom$universal latch shoe$bom$, $bom$1/carriage$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B29$bom$, $bom$camera SerDes binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss. Binder housing. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B30$bom$, $bom$temperature/RH binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss. Binder housing. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B31$bom$, $bom$LED-bar binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss. Binder housing. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B32$bom$, $bom$mist-nozzle binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss. Binder housing. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B33$bom$, $bom$blank/cap binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss. Binder housing. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B34$bom$, $bom$internal camera-to-serializer FPC clamp$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss. Internal camera-to-serializer FPC clamp. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B35$bom$, $bom$external Tachyon/M1 brick mount$bom$, $bom$1$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED geometry. CAD miss. No official brick-mount SKU. M1ENCLEA is B43, not B35. Stop.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B36$bom$, $bom$Particle-supported Sony IMX519 autofocus camera module$bom$, $bom$1$bom$, $bom$UNVERIFIED$bom$, $bom$Exact orderable module, revision, outline, connector orientation, and STEP `UNVERIFIED`; legacy B0371 is not a release selection. No module MPN printed on the Tachyon cameras page. Candidate family printed: Samsung S5K3P9SX and Sony IMX519 Autofocus Module. Connector printed 22-pin 0.5 mm pitch FPC, 4-lane CSI. No vendor/price/lead. Not a buy. Source: https://developer.particle.io/tachyon/device-details/cameras$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B37$bom$, $bom$internal camera FPC, exact assembly$bom$, $bom$1$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED length/orientation. CAD miss remains: no invented FPC PN from CAD. Exact assembly length/orientation UNVERIFIED. EE this pass, candidates 22-pin 0.5 mm, A-B, none selected: Adafruit 6034 50 mm; Adafruit 6035 100 mm; Adafruit 6036 200 mm; generic Molex 0150200231 76.20 mm not labeled CSI; Type A. Adafruit 6034 DigiKey snapshot $0.95 is NOT a quote. Adafruit 6034/6035/6036 stay the queued candidates. Extra this hunt, record only, not selected: welectron Arducam CB023 150 mm 22-to-22 0.5 mm. CB023: https://www.welectron.com/Arducam-CB023-150mm-22pin-to-22pin-camera-cable-05mm-Pitch-interface Rejected: official Pi 22-to-15 Standard-Mini. CSI pin map UNVERIFIED. Class stays UNVERIFIED. Not a buy. Sources: https://www.adafruit.com/product/6034 https://www.digikey.com/en/products/detail/adafruit-industries-llc/6034/25589367 https://www.adafruit.com/product/6035 https://www.adafruit.com/product/6036 https://www.digikey.com/en/products/detail/molex/0150200231/2972340$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B38$bom$, $bom$M3 fasteners and heat-set inserts$bom$, $bom$set$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED selected PN/pocket. Not a release selection. None selected. Pocket UNVERIFIED. CAD this pass confirms Adafruit 4255 as extra next to Adafruit 4256 and SPIROL 151284. Not selected. SPIROL 151284 (brass, M3 x 0.5, overknurl 4.75 mm, L 5.74 mm, headed); Adafruit 4256 M3-threaded inserts 3 mm long, 50-pack, brass heat-set; Adafruit 4255 M3 x 4 mm brass heat-set 50 pack OD 4.2 mm, hole dia not printed. EE McMaster insert candidates remain: 94180A331 and 94180A333 (M3 x 0.5 tapered); 94459A769 / 94459A130 / 94459A140 (straight). Do not drop already-queued McMaster/Adafruit inserts. Leftover EE catalog candidates, not buys: ruthex RX-M3x5.7 / GE-M3x57-001. 3DJake prints D1 4.6 / L 5.7 mm. Snapshot €8,99/100 and $8.76 are NOT quotes. Screw 91292A113 not confirmed on a McMaster URL. Do not file Adafruit 4685. Do not file McMaster PNs from the CAD miss pass. SPIROL: https://shop.spirol.com/viewitems/series-29-30-long-heat-ultrasonic-insert-metric/series-30-l-headed-heat-ultrasonic-insert-metric Adafruit 4256: https://www.adafruit.com/product/4256 ruthex: https://www.ruthex.de/en/products/ruthex-gewindeeinsatz-m3-100-stuck-rx-m3x5-7-messing-gewindebuchsen 3DJake: https://www.3djake.com/ruthex/threaded-insert-m3-100-pieces$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B39$bom$, $bom$optional captured alignment magnets$bom$, $bom$set$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED; never primary latch. Size still unselected. CAD miss this pass. Do not file McMaster PNs from this CAD pass. EE candidates none selected remain: McMaster 3506K21 / 3506K36 / 3506K35 / 5679K88 / 5679K89 / 5679K91. Leftover EE catalog candidate, not a buy: K&J D42 N42 6.35 x 3.17 mm. Snapshot $0.41 is NOT a quote. K&J: https://www.kjmagnetics.com/proddetail.asp?prod=D42$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B40$bom$, $bom$gasket stock$bom$, $bom$set$bom$, $bom$UNVERIFIED$bom$, $bom$UNVERIFIED material/compression. CAD miss this pass. No SKU+compression printed. Stop.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B41$bom$, $bom$M20 plugs/glands for M1 nonmoving cables$bom$, $bom$set$bom$, NULL, $bom$verified M1 feature; no moving CSI tether. M1ENCLEA kit includes 2x M20 cable glands with TE RJ45 feed-through and 2x M20 hole plugs as printed on the M1 enclosure datasheet. No standalone Particle gland SKU. B41 is kit contents of M1ENCLEA, not a selected gland PN. Catalog alternates none selected over the Particle kit. EE/LAPP already queued: LAPP SKINTOP 53111420 M 20 x 1.5 clamp 6-13 mm IP68, bulkhead fit UNVERIFIED. CAD this pass extra catalog gland, not selected over the kit: Sealcon CD20MA-BK / Hummel HSK-K 1.209.2001.50 M20 x 1.5 nylon, cable 6-12 mm, hole 20 mm; locking nut and O-ring sold separately. No price landed. No moving CSI tether. LAPP: https://e.lapp.com/in/p/plastic-cable-glands/skintop-st-m-20x1-5-ral-7035-lgy-53111420 Sealcon: https://www.sealconusa.com/product/cd20ma-bk/ M1 datasheet: https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B42$bom$, $bom$Particle Tachyon$bom$, $bom$1$bom$, NULL, $bom$Vendor-documented 85 x 56 x 18.5 mm; exact revision CAD still required. Candidate manufacturer SKUs from the datasheet ordering table, none selected: TACH4NA Tachyon 4GB RAM / 64GB Flash (NorAm); TACH8NA Tachyon 8GB RAM / 128GB Flash (NorAm); TACH8ROW Tachyon 8GB RAM / 128GB Flash (EMEA). Do not promote TACH4ROW. It is on the store/CE docs, not in the datasheet ordering table. 4GB Rest of World printed $399.00 with no SKU code. Store page default SKU TACH8NA is not a selected buy. Printed: TACH8NA $459.00 On backorder; TACH8ROW $459.00; 4GB North America $399.00 maps to TACH4NA. Discovery quote only. Not a buy. Sources: https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/ https://store.particle.io/products/tachyon-5g-single-board-computer$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B43$bom$, $bom$Particle M1 enclosure$bom$, $bom$0-1$bom$, NULL, $bom$M1ENCLEA; lifecycle GA as printed in the ordering table; vendor-documented 121 x 220 x 69 mm. Kit includes 2x M20 glands + 2x M20 plugs (B41 adjacent, not a selected standalone gland PN). Store prints $70 In stock. Discovery quote only. Not a buy. Sources: https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/ https://store.particle.io/products/m1-enclosure$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B44$bom$, $bom$fused rail power tap$bom$, $bom$1$bom$, NULL, $bom$2 A TARGET, final budget UNVERIFIED. Custom rail tap remains UNVERIFIED. CAD this pass is a fuse+holder catalog family (154/154T OMNI-BLOK), not the custom rail tap. No price landed from the CAD PDF. EE miss stands: rejected as a selection from the tscircuit DigiKey fuse dump. First page prints 1 A 0685T1000-01, 2.5 A 0685T2500-01, 3 A 0685T3000-01 Bel Fuse 1206 parts, not a 2 A rail fuse. Do not pick a neighbor. Cached prices on that page are snapshots, not a quote. Dump: https://digikeysearch.tscircuit.com/fuses/list EE-sourced candidate remains: Littelfuse 0154002.DR. Octopart $1.411 snapshot is NOT a quote. Related DRT/DRTL/DRL not selected. DigiKey 39512000440 was AC-only, not used. Do not claim CAD printed 0154002.DR. Do not land 0452002.MRL. Not 2.5 A. Not 0154010.DR. Leftover EE LCSC detail now opened, candidate not a buy: FUSE BRD MNT 2A 125VAC/VDC SMD, 2A, 125V DC, 50A IR, SMD 9.73 x 5.03 x 3.81 mm. Page prices 1+ $1.5396 and 1500+ $0.8542 and In-Stock 1420 are snapshots, NOT a quote. DigiKey/Mouser/LF HTML detail not opened. Holders 01550900M/DR named on LCSC, not the 2 A pick. CAD datasheet printed: catalog number 154002.0; ampere rating 2; amp code 2.0; fuse furnished 453002.0. Time-lag twin 154002.0 T / 454002.0. Example on the PDF is 1.5 A to 015401.5DR. Do not derive 0154002.DR from that. Do not file 154002.0 / 453002.0 / 454002.0 / 015401.5DR as the rail tap. This hunt: official 154 PDF still does not print the string 0154002.DR next to DC. LCSC C206910 DETAIL remains the queued 2 A page. No 2.5 A neighbor. Do not re-land the SKU. Octopart: https://octopart.com/search?q=0154002.DR LCSC: https://www.lcsc.com/product-detail/C206910.html CAD datasheet: https://www.littelfuse.com/assetdocs/littelfuse-fuse-154-series-data-sheet?assetguid=a8a8a462-7295-481b-a91b-d770dabf005b$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B45$bom$, $bom$Analog Devices MAX96717 camera serializer carrier$bom$, $bom$1$bom$, NULL, $bom$device verified; carrier design UNVERIFIED. Analog Devices MAX96717 (CSI-2 to GMSL2 serializer). Candidate family from datasheet ordering table, no package selected: MAX96717GTJ/VY+ and MAX96717GTJ/VY+T (32 TQFN-SW-EP, -40 to +105 C). LCSC C7528388 prints MAX96717GTJ/VY+T with 1+ $6.4526, 10+ $5.6393, 30+ $5.1428, 100+ $4.728, in-stock 2760, ships now. Same page alternative MAX96717GTJ/VY+ at $7.3912 / 57 avail. Package TQFN-32-EP(5x5), 6Gbps. Discovery quote only. Do not invent a carrier SKU. Not a buy. Sources: https://www.analog.com/en/products/max96717.html https://www.lcsc.com/product-detail/Serializers-Deserializers_Analog-Devices-Inc-Maxim-Integrated-MAX96717GTJ-VY-T_C7528388.html$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B46$bom$, $bom$Analog Devices MAX96724 quad deserializer carrier$bom$, $bom$1$bom$, NULL, $bom$device verified; Tachyon integration UNVERIFIED. Carrier / Tachyon integration UNVERIFIED. None selected. CAD this pass: device only. analog.com HTML timed out. Do not land GTN/VY+ suffixes from the Farnell PDF. Device name MAX96724/F/R Quad Tunneling GMSL2/1 to CSI-2 Deserializer. Farnell PDF is a device-name source, not a suffix pick: https://www.farnell.com/datasheets/4416323.pdf Candidate family from earlier CAD ADI dump and EE LCSC, none selected: MAX96724GTN/VY+ (datasheet **Future product); MAX96724FGTN/V+; MAX96724FGTN/VY+; MAX96724RGTN/V+ (datasheet **Future product); MAX96724GTN/VY+T. Tape-and-reel +T twins also listed on the earlier datasheet dump; codes not invented beyond named rows. 6 Gbps MAX96724 rows marked future-product. LCSC C27243025 prints MAX96724GTN/VY+T, 1+ $15.1147, 10+ $14.4884, 30+ $13.4064, 100+ $12.4604, in-stock 1466, ships now. Same page alternative MAX96724GTN/VY+ at $18.0866 / 25 avail. Package TQFN-56-EP(8x8), quad GMSL2/1 to CSI-2, 6Gbps. Pinout not in the fetched HTML. Honesty tension: CAD datasheet marked MAX96724GTN/VY+ as **Future product. LCSC prints stock on the +T reel. Both facts stand. Do not pick a buy. Sources: https://www.analog.com/en/products/max96724.html https://www.lcsc.com/product-detail/C27243025.html$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B47$bom$, $bom$four 100 ohm V-dock point-to-point flex/STP channels$bom$, $bom$1 set$bom$, NULL, $bom$SI stack and routing UNVERIFIED. Four-channel V-dock SI UNVERIFIED STOP. Class stays UNVERIFIED. Not a buy. EE this pass, one printed 100 ohm pair only: Samtec C28S-11.00-SPS8-SPS8, 100 Ohms, one twinax pair, 11.000 in. Snapshot $70.93 qty-1 / In-Stock 184 / 6 weeks is NOT a quote. Not a four-channel flex. Molex 0150210215 and 3M SL8801/12-111A5-00 not claimed (those pages did not print 100 ohm). Sources: https://www.digikey.com/en/products/detail/samtec-inc/C28S-11-00-SPS8-SPS8/10507305 https://www.samtec.com/products/c28s$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B48$bom$, $bom$local supervisor, normally-open S1 carriage-mate switch, normally-open S2 binder-mate switch, per-carriage Q1 current-limited load switch, discharge, and bus isolation$bom$, $bom$1/carriage$bom$, NULL, $bom$exact parts, mate order, timeout, polarity, and timing `UNVERIFIED`; P08 is not safety authority. Class stays UNVERIFIED. Not a buy. Do not replace S1/S2 D2FS-F-N or Q1 TPS259830LNRGER. S1/S2 logic detect only, one MPN not assigned S1 vs S2: D2FS-F-N Aratas (formerly Omron), SPST-NO, 100 mA DC, 6 V DC, Off-Mom. Not a 12 V interrupt. Fit UNVERIFIED. D2FS: https://www.digikey.com/en/products/detail/omron-electronics-inc-emc-div/D2FS-F-N/4753384 Q1 remains: TPS259830LNRGER TI, 2.7-26 V, programmable current limit, 18 A max, Auto Retry, OVP, 24-VQFN. Page does not print a 2 A factory limit. Enable from S1 AND S2 / discharge / isolation UNVERIFIED. TPS259830: https://www.digikey.com/en/products/detail/texas-instruments/TPS259830LNRGER/22106807 CAD miss remains on 3.3 V monitors (not used). Do not file TPS25221. TPS3840 opened (1.5-10 V) not used. Leftover EE supervisor candidate, not a buy: TPS37A010122DSKR, 2.7-65 V; page says can monitor 12 V / 24 V rails. Dash UV/OV setpoint UNVERIFIED. TPS37: https://www.ti.com/product/TPS37/part-details/TPS37A010122DSKR Supervisor alt opened, not selected: LTC2966IUD#TRPBF 3.5-100 V / 1.75-98 V. Snapshot 1+ $5.183 ref / Out of Stock is NOT a quote. LTC2966: https://www.lcsc.com/product-detail/C683885.html Leftover EE discharge, separate device not a Q1 replacement: TPS22810 family, no tape/reel suffix printed. QOD printed. 2.7-18 V. RON 79 mOhm typ @ 12 V. 2 A DBV / 3 A DRV. No bleeder ohm invented. TPS22810: https://www.ti.com/product/TPS22810 Discharge suffix extra this hunt, not a Q1 replacement: TPS22810DBVR SOT-23-6 T&R. Same QOD as queued TPS22810 family. QOD R unselected. TPS22810DBVR: https://www.ti.com/product/TPS22810/part-details/TPS22810DBVR Leftover EE isolation: LM74700-Q1 ideal-diode controller 3.2-65 V, printed 12-V bus. Reverse-current block, not galvanic isolation. External FET unselected. LM7480-Q1 sibling page not opened. Do not re-land the SKU. LM74700: https://www.ti.com/product/LM74700-Q1 Leftover EE AND: SN74LVC1G08 Y=A·B, VCC 1.65-5.5 V. Not a 12 V AND. If S1/S2 must switch 12 V, this page is not that job. AND: https://www.ti.com/product/SN74LVC1G08 AND extra this hunt: CD4081B 4-ch 2-input AND, 3-18 V. Timing UNVERIFIED. Better Vin cover than SN74LVC1G08 (5.5 V). CD4081B: https://www.ti.com/product/CD4081B Supervisor extra this hunt: TPS3700 1.8-18 V window detector. Thresholds via external resistors, values not invented. Suffix UNVERIFIED (TPS3700DDCR 404). Do not file TPS3700DDCR. TPS3700: https://www.ti.com/product/TPS3700 Signal switch extra this hunt: CD4066B 3-18 V analog switch, 12 V listed. Not galvanic VIN-A/VIN-B isolation. Power-bus isolation still open. CD4066B: https://www.ti.com/product/CD4066B Extra S1/S2 family not selected: C&K SDS001 / SDS004 N.O., 100 mA @ 12 VDC printed. SDS: https://www.tme.eu/Document/4ff5aea093e89b0a18f91c75e538e08c/SDS.pdf Extra Q1 family not selected, do not replace TPS259830LNRGER: TPS2595 2.7-18 V, ILIM 0.5-4 A. Rev.C addendum Active TPS259540DSGR / 541 / 570 / 571 / 573 / 535. Full dash codes not invented beyond TPS259540DSGR. QOD 19 ohm on x5. TPS2595: https://www.ti.com/product/TPS2595$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B49$bom$, $bom$optional TCA9548A I2C switch carrier$bom$, $bom$0-1$bom$, NULL, $bom$device documented; address, reset, hot-insertion behavior, carrier, and need remain `UNVERIFIED`. Texas Instruments TCA9548A. Packages printed TSSOP (PW) 24, VQFN (RGE) 24, VSSOP (DGS) 24; 1.65-5.5 V; reset; Supports hot insertion. Datasheet Rev. H package option addendum (8-Nov-2025) Active/Production rows: TCA9548ADGSR, TCA9548AMRGER, TCA9548APWR, TCA9548ARGER. Omit .B and G4 aliases. No suffix selected. No price/lead on the datasheet. Carrier / A2A1A0 strap / RESET wiring / whether we need it stay UNVERIFIED. Sources: https://www.ti.com/product/TCA9548A https://www.ti.com/lit/ds/symlink/tca9548a.pdf$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B50$bom$, $bom$separate keyed 12-net carriage-to-binder connector/contact system$bom$, $bom$1/carriage + 1/binder$bom$, NULL, $bom$`C01`-`C12` mirror required nets; series, pin geometry, controlled-impedance launch, mate order, current, hot-unplug behavior, and durability `UNVERIFIED`. Class stays UNVERIFIED. Not a buy. Leftover EE keyed 12-pos header candidate: TE 1-1827876-6. 12 positions; Keying X; Mating Alignment Type Keyed; 5 A; 250 VAC/VDC; 2.5 mm. Mate housing UNVERIFIED. C01-C12 / impedance / hot-unplug UNVERIFIED. TE: https://www.te.com/en/product-1-1827876-6.html datasheet reprint: https://www.part-elec.com/datasheet/te-connectivity/1-1827876-6.pdf Housing extra this hunt: TE 776437-1 AMPSEAL 16 plug, 12 Position, CODE A. Catalog PDF prints 4 keys for 8 and 12 pos, -1 = A key, keyed to mate identical colors. C01-C12 / mate cap UNVERIFIED. AMPSEAL: https://www.te.com/en/product-776437-1.html catalog: https://www.te.com/content/dam/te-com/documents/industrial-and-commercial-transportation/global/ict-ampseal-16-cat-a4-7-1773982-8-en-2010.pdf Alt opened, not selected: DTM13-12PB-R008 Keyed code B, 12 pos, 7.5 A, 12|24 V architecture, interface DTM04-12P. DTM: https://www.govolition.com/product/V51-DTM13-12PB-R008 CAD housing candidate remains, rejected as keyed: Molex 39-01-2120 stays polarized-only, series 5557 Mini-Fit Jr., aliases 0039012120 / 5557-12R. Receptacle housing, dual row, 12 circuits, nylon, 4.2 mm pitch, polarized to mate, 13 A, UL 94V-2, natural. Polarized only, not keyed. Do not re-admit 1053081212. Rejected as keyed: DF11-12DP-2DSA(08) Key field empty (Hirose); 1053081212 latch-only (prior). Pinout not invented. Do not file Harwin M80-5101242. Housing source: https://www.heilind.eu/mol39-01-2120.html$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B51$bom$, $bom$captive rail route end stop with deliberate M3 service removal$bom$, $bom$2/independent route$bom$, NULL, $bom$CAD miss. geometry, fastener retention, drop/handling protocol, and proof load `UNVERIFIED`. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B52$bom$, $bom$external rail access-slot guard / labyrinth wiper$bom$, $bom$route set$bom$, NULL, $bom$CAD miss. leaves ENIG lands contactable only inside captive external carriage envelope; environmental ingress rating `UNVERIFIED`, not hermetic. No catalog MPN this pass.$bom$) ON CONFLICT (balloon_id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B36-B0371$bom$,
  $bom$B36$bom$,
  $bom$B0371$bom$,
  $bom$rejected$bom$,
  NULL,
  NULL,
  $bom$Historical Release A only; not a release selection. No manufacturer part number.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B44-fuse-dump$bom$,
  $bom$B44$bom$,
  $bom$tscircuit DigiKey fuse dump$bom$,
  $bom$rejected$bom$,
  $bom$Bel Fuse$bom$,
  NULL,
  $bom$1 A 0685T1000-01, 2.5 A 0685T2500-01, 3 A 0685T3000-01 are not a 2 A rail fuse. Do not pick a neighbor. Cached prices are not a quote. Stop until a page prints a 2 A fuse.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B48-supervisor$bom$,
  $bom$B48$bom$,
  $bom$supervisor / discharge / bus isolation / AND timing$bom$,
  $bom$rejected$bom$,
  NULL,
  NULL,
  $bom$3.3 V monitors opened were not used. TPS3840 opened (1.5-10 V) not used. Leftover EE supervisor candidate TPS37A010122DSKR is not a buy. Dash UV/OV setpoint UNVERIFIED.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B50-molex-1053081212$bom$,
  $bom$B50$bom$,
  $bom$Molex 1053081212$bom$,
  $bom$rejected$bom$,
  $bom$Molex$bom$,
  $bom$1053081212$bom$,
  $bom$Nano-Fit 12-pos, latch lock, contacts sold separately, no keying word. Not a keyed 12-net C01-C12. Pinout not invented. No MPN selected.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B19-319-10-112$bom$,
  $bom$B19$bom$,
  $bom$Mill-Max 319-10-112-00-001000$bom$,
  $bom$rejected$bom$,
  $bom$Mill-Max$bom$,
  $bom$319-10-112-00-001000$bom$,
  $bom$Contacts print 10 vs header 12. Not a flex electrode strip.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B37-pi-22-15$bom$,
  $bom$B37$bom$,
  $bom$official Pi 22-to-15 Standard-Mini$bom$,
  $bom$rejected$bom$,
  NULL,
  NULL,
  $bom$CSI pin map UNVERIFIED. Not a selected camera FPC.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B48-tps3840$bom$,
  $bom$B48$bom$,
  $bom$TPS3840$bom$,
  $bom$rejected$bom$,
  $bom$Texas Instruments$bom$,
  $bom$TPS3840$bom$,
  $bom$Opened 1.5-10 V. Not used. Not a 12 V supervisor.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B50-39-01-2120-keyed$bom$,
  $bom$B50$bom$,
  $bom$Molex 39-01-2120 keyed$bom$,
  $bom$rejected$bom$,
  $bom$Molex$bom$,
  $bom$39-01-2120$bom$,
  $bom$Polarized only (Heilind). Rejected as keyed. Housing candidate remains, not a keyed 12-net C01-C12.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  $bom$alt-B50-df11-12dp$bom$,
  $bom$B50$bom$,
  $bom$Hirose DF11-12DP-2DSA(08)$bom$,
  $bom$rejected$bom$,
  $bom$Hirose$bom$,
  $bom$DF11-12DP-2DSA(08)$bom$,
  $bom$Key field empty. Rejected as keyed.$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_party (id, name) VALUES ($bom$particle$bom$, $bom$Particle$bom$) ON CONFLICT (id) DO NOTHING;
INSERT INTO supplier_party (id, name) VALUES ($bom$lcsc$bom$, $bom$LCSC$bom$) ON CONFLICT (id) DO NOTHING;
INSERT INTO supplier_party (id, name) VALUES ($bom$ti$bom$, $bom$Texas Instruments$bom$) ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturer_sku (id, part_id, manufacturer, mpn, revision) VALUES
  ($bom$B05:ACRYCLR0.118CCM48X96$bom$, $bom$B05$bom$, $bom$ePlastics$bom$, $bom$ACRYCLR0.118CCM48X96$bom$, NULL),
  ($bom$B05:A000AN03.0L0GPCTE$bom$, $bom$B05$bom$, $bom$Sheet Haus$bom$, $bom$A000AN03.0L0GPCTE$bom$, NULL),
  ($bom$B06:ACRYCLR0.118CCM48X96$bom$, $bom$B06$bom$, $bom$ePlastics$bom$, $bom$ACRYCLR0.118CCM48X96$bom$, NULL),
  ($bom$B06:A000AN03.0L0GPCTE$bom$, $bom$B06$bom$, $bom$Sheet Haus$bom$, $bom$A000AN03.0L0GPCTE$bom$, NULL),
  ($bom$C2-32-15$bom$, $bom$B09$bom$, $bom$Southco$bom$, $bom$C2-32-15$bom$, NULL),
  ($bom$1588A714$bom$, $bom$B08$bom$, $bom$McMaster-Carr$bom$, $bom$1588A714$bom$, NULL),
  ($bom$1588A724$bom$, $bom$B08$bom$, $bom$McMaster-Carr$bom$, $bom$1588A724$bom$, NULL),
  ($bom$1588A733$bom$, $bom$B08$bom$, $bom$McMaster-Carr$bom$, $bom$1588A733$bom$, NULL),
  ($bom$LC032C08M$bom$, $bom$B25$bom$, $bom$Lee Spring$bom$, $bom$LC032C08M$bom$, NULL),
  ($bom$816-22-012-10-000101$bom$, $bom$B27$bom$, $bom$Mill-Max$bom$, $bom$816-22-012-10-000101$bom$, NULL),
  ($bom$319-10-108-00-001000$bom$, $bom$B19$bom$, $bom$Mill-Max$bom$, $bom$319-10-108-00-001000$bom$, NULL),
  ($bom$6034$bom$, $bom$B37$bom$, $bom$Adafruit$bom$, $bom$6034$bom$, NULL),
  ($bom$6035$bom$, $bom$B37$bom$, $bom$Adafruit$bom$, $bom$6035$bom$, NULL),
  ($bom$6036$bom$, $bom$B37$bom$, $bom$Adafruit$bom$, $bom$6036$bom$, NULL),
  ($bom$0150200231$bom$, $bom$B37$bom$, $bom$Molex$bom$, $bom$0150200231$bom$, NULL),
  ($bom$CB023$bom$, $bom$B37$bom$, $bom$Arducam$bom$, $bom$CB023$bom$, NULL),
  ($bom$151284$bom$, $bom$B38$bom$, $bom$SPIROL$bom$, $bom$151284$bom$, NULL),
  ($bom$4255$bom$, $bom$B38$bom$, $bom$Adafruit$bom$, $bom$4255$bom$, NULL),
  ($bom$4256$bom$, $bom$B38$bom$, $bom$Adafruit$bom$, $bom$4256$bom$, NULL),
  ($bom$94180A331$bom$, $bom$B38$bom$, $bom$McMaster-Carr$bom$, $bom$94180A331$bom$, NULL),
  ($bom$94180A333$bom$, $bom$B38$bom$, $bom$McMaster-Carr$bom$, $bom$94180A333$bom$, NULL),
  ($bom$94459A769$bom$, $bom$B38$bom$, $bom$McMaster-Carr$bom$, $bom$94459A769$bom$, NULL),
  ($bom$94459A130$bom$, $bom$B38$bom$, $bom$McMaster-Carr$bom$, $bom$94459A130$bom$, NULL),
  ($bom$94459A140$bom$, $bom$B38$bom$, $bom$McMaster-Carr$bom$, $bom$94459A140$bom$, NULL),
  ($bom$RX-M3x5.7$bom$, $bom$B38$bom$, $bom$ruthex$bom$, $bom$RX-M3x5.7$bom$, NULL),
  ($bom$GE-M3x57-001$bom$, $bom$B38$bom$, $bom$ruthex$bom$, $bom$GE-M3x57-001$bom$, NULL),
  ($bom$3506K21$bom$, $bom$B39$bom$, $bom$McMaster-Carr$bom$, $bom$3506K21$bom$, NULL),
  ($bom$3506K36$bom$, $bom$B39$bom$, $bom$McMaster-Carr$bom$, $bom$3506K36$bom$, NULL),
  ($bom$3506K35$bom$, $bom$B39$bom$, $bom$McMaster-Carr$bom$, $bom$3506K35$bom$, NULL),
  ($bom$5679K88$bom$, $bom$B39$bom$, $bom$McMaster-Carr$bom$, $bom$5679K88$bom$, NULL),
  ($bom$5679K89$bom$, $bom$B39$bom$, $bom$McMaster-Carr$bom$, $bom$5679K89$bom$, NULL),
  ($bom$5679K91$bom$, $bom$B39$bom$, $bom$McMaster-Carr$bom$, $bom$5679K91$bom$, NULL),
  ($bom$D42$bom$, $bom$B39$bom$, $bom$K&J Magnetics$bom$, $bom$D42$bom$, NULL),
  ($bom$53111420$bom$, $bom$B41$bom$, $bom$LAPP$bom$, $bom$53111420$bom$, NULL),
  ($bom$CD20MA-BK$bom$, $bom$B41$bom$, $bom$Sealcon$bom$, $bom$CD20MA-BK$bom$, NULL),
  ($bom$TACH4NA$bom$, $bom$B42$bom$, $bom$Particle$bom$, $bom$TACH4NA$bom$, NULL),
  ($bom$TACH8NA$bom$, $bom$B42$bom$, $bom$Particle$bom$, $bom$TACH8NA$bom$, NULL),
  ($bom$TACH8ROW$bom$, $bom$B42$bom$, $bom$Particle$bom$, $bom$TACH8ROW$bom$, NULL),
  ($bom$M1ENCLEA$bom$, $bom$B43$bom$, $bom$Particle$bom$, $bom$M1ENCLEA$bom$, NULL),
  ($bom$0154002.DR$bom$, $bom$B44$bom$, $bom$Littelfuse$bom$, $bom$0154002.DR$bom$, NULL),
  ($bom$MAX96717GTJ/VY+$bom$, $bom$B45$bom$, $bom$Analog Devices$bom$, $bom$MAX96717GTJ/VY+$bom$, NULL),
  ($bom$MAX96717GTJ/VY+T$bom$, $bom$B45$bom$, $bom$Analog Devices$bom$, $bom$MAX96717GTJ/VY+T$bom$, NULL),
  ($bom$MAX96724GTN/VY+$bom$, $bom$B46$bom$, $bom$Analog Devices$bom$, $bom$MAX96724GTN/VY+$bom$, NULL),
  ($bom$MAX96724FGTN/V+$bom$, $bom$B46$bom$, $bom$Analog Devices$bom$, $bom$MAX96724FGTN/V+$bom$, NULL),
  ($bom$MAX96724FGTN/VY+$bom$, $bom$B46$bom$, $bom$Analog Devices$bom$, $bom$MAX96724FGTN/VY+$bom$, NULL),
  ($bom$MAX96724RGTN/V+$bom$, $bom$B46$bom$, $bom$Analog Devices$bom$, $bom$MAX96724RGTN/V+$bom$, NULL),
  ($bom$MAX96724GTN/VY+T$bom$, $bom$B46$bom$, $bom$Analog Devices$bom$, $bom$MAX96724GTN/VY+T$bom$, NULL),
  ($bom$C28S-11.00-SPS8-SPS8$bom$, $bom$B47$bom$, $bom$Samtec$bom$, $bom$C28S-11.00-SPS8-SPS8$bom$, NULL),
  ($bom$D2FS-F-N$bom$, $bom$B48$bom$, $bom$Aratas$bom$, $bom$D2FS-F-N$bom$, NULL),
  ($bom$TPS259830LNRGER$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$TPS259830LNRGER$bom$, NULL),
  ($bom$TPS37A010122DSKR$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$TPS37A010122DSKR$bom$, NULL),
  ($bom$LTC2966IUD#TRPBF$bom$, $bom$B48$bom$, $bom$Analog Devices$bom$, $bom$LTC2966IUD#TRPBF$bom$, NULL),
  ($bom$TPS22810$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$TPS22810$bom$, NULL),
  ($bom$TPS22810DBVR$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$TPS22810DBVR$bom$, NULL),
  ($bom$LM74700-Q1$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$LM74700-Q1$bom$, NULL),
  ($bom$SN74LVC1G08$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$SN74LVC1G08$bom$, NULL),
  ($bom$CD4081B$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$CD4081B$bom$, NULL),
  ($bom$TPS3700$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$TPS3700$bom$, NULL),
  ($bom$CD4066B$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$CD4066B$bom$, NULL),
  ($bom$SDS001$bom$, $bom$B48$bom$, $bom$C&K$bom$, $bom$SDS001$bom$, NULL),
  ($bom$SDS004$bom$, $bom$B48$bom$, $bom$C&K$bom$, $bom$SDS004$bom$, NULL),
  ($bom$TPS2595$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$TPS2595$bom$, NULL),
  ($bom$TPS259540DSGR$bom$, $bom$B48$bom$, $bom$Texas Instruments$bom$, $bom$TPS259540DSGR$bom$, NULL),
  ($bom$TCA9548ADGSR$bom$, $bom$B49$bom$, $bom$Texas Instruments$bom$, $bom$TCA9548ADGSR$bom$, NULL),
  ($bom$TCA9548AMRGER$bom$, $bom$B49$bom$, $bom$Texas Instruments$bom$, $bom$TCA9548AMRGER$bom$, NULL),
  ($bom$TCA9548APWR$bom$, $bom$B49$bom$, $bom$Texas Instruments$bom$, $bom$TCA9548APWR$bom$, NULL),
  ($bom$TCA9548ARGER$bom$, $bom$B49$bom$, $bom$Texas Instruments$bom$, $bom$TCA9548ARGER$bom$, NULL),
  ($bom$39-01-2120$bom$, $bom$B50$bom$, $bom$Molex$bom$, $bom$39-01-2120$bom$, NULL),
  ($bom$1-1827876-6$bom$, $bom$B50$bom$, $bom$TE Connectivity$bom$, $bom$1-1827876-6$bom$, NULL),
  ($bom$776437-1$bom$, $bom$B50$bom$, $bom$TE Connectivity$bom$, $bom$776437-1$bom$, NULL),
  ($bom$DTM13-12PB-R008$bom$, $bom$B50$bom$, $bom$DTM$bom$, $bom$DTM13-12PB-R008$bom$, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO quote (quote_id, supplier_party_id, attrs) VALUES ($bom$quote-particle-b42$bom$, $bom$particle$bom$, $bom${"discovery":true,"unverified":true,"part_id":"B42","source":"https://store.particle.io/products/tachyon-5g-single-board-computer","page_default_sku":"TACH8NA","page_default_is_not_selected":true,"printed":{"TACH8NA":{"amount":"459.00","currency":"USD","availability":"On backorder"},"TACH8ROW":{"amount":"459.00","currency":"USD"},"TACH4NA":{"amount":"399.00","currency":"USD","label":"4GB North America"},"4GB Rest of World":{"amount":"399.00","currency":"USD","mpn":null}},"note":"Discovery quote. Not a buy. TACH4ROW was not printed as a SKU code."}$bom$::jsonb) ON CONFLICT (quote_id) DO NOTHING;
INSERT INTO quote (quote_id, supplier_party_id, attrs) VALUES ($bom$quote-particle-b43$bom$, $bom$particle$bom$, $bom${"discovery":true,"unverified":true,"part_id":"B43","source":"https://store.particle.io/products/m1-enclosure","mpn":"M1ENCLEA","printed":{"amount":"70","currency":"USD","availability":"In stock"},"note":"Discovery quote. Not a buy."}$bom$::jsonb) ON CONFLICT (quote_id) DO NOTHING;
INSERT INTO quote (quote_id, supplier_party_id, attrs) VALUES ($bom$quote-lcsc-b45$bom$, $bom$lcsc$bom$, $bom${"discovery":true,"unverified":true,"part_id":"B45","source":"https://www.lcsc.com/product-detail/Serializers-Deserializers_Analog-Devices-Inc-Maxim-Integrated-MAX96717GTJ-VY-T_C7528388.html","vendor_sku":"C7528388","mpn":"MAX96717GTJ/VY+T","manufacturer":"Analog Devices / MAXIM","printed_breaks":[{"qty":1,"amount":"6.4526","currency":"USD"},{"qty":10,"amount":"5.6393","currency":"USD"},{"qty":30,"amount":"5.1428","currency":"USD"},{"qty":100,"amount":"4.728","currency":"USD"}],"in_stock":2760,"lead":"ships now","alternative":{"mpn":"MAX96717GTJ/VY+","amount":"7.3912","currency":"USD","avail":57},"package":"TQFN-32-EP(5x5)","note":"Candidate IC only. Carrier UNVERIFIED. Not a buy."}$bom$::jsonb) ON CONFLICT (quote_id) DO NOTHING;
INSERT INTO quote (quote_id, supplier_party_id, attrs) VALUES ($bom$quote-lcsc-b46$bom$, $bom$lcsc$bom$, $bom${"discovery":true,"unverified":true,"part_id":"B46","source":"https://www.lcsc.com/product-detail/C27243025.html","vendor_sku":"C27243025","mpn":"MAX96724GTN/VY+T","manufacturer":"Analog Devices / MAXIM","printed_breaks":[{"qty":1,"amount":"15.1147","currency":"USD"},{"qty":10,"amount":"14.4884","currency":"USD"},{"qty":30,"amount":"13.4064","currency":"USD"},{"qty":100,"amount":"12.4604","currency":"USD"}],"in_stock":1466,"lead":"ships now","alternative":{"mpn":"MAX96724GTN/VY+","amount":"18.0866","currency":"USD","avail":25},"package":"TQFN-56-EP(8x8)","future_product_tension":"Datasheet marked MAX96724GTN/VY+ as Future product. LCSC prints stock on the +T reel.","note":"Candidate IC only. Carrier / Tachyon integration UNVERIFIED. Not a buy."}$bom$::jsonb) ON CONFLICT (quote_id) DO NOTHING;

INSERT INTO where_used (parent_id, child_id, relation) VALUES
  ($bom$B35$bom$, $bom$B42$bom$, $bom$mounts$bom$),
  ($bom$B29$bom$, $bom$B36$bom$, $bom$sits-on$bom$)
ON CONFLICT (parent_id, child_id, relation) DO NOTHING;

INSERT INTO kit (kit_id, name, notes) VALUES (
  $bom$first-tower$bom$,
  $bom$First tower$bom$,
  $bom$Quantities are first-tower estimates copied from the balloon register. Qty stays text. Shop pack is DRAFT; do not order from it.$bom$
)
ON CONFLICT (kit_id) DO NOTHING;

INSERT INTO kit_line (kit_id, part_id, qty_text)
SELECT 'first-tower', balloon_id, qty_text
FROM part
ON CONFLICT (kit_id, part_id) DO NOTHING;
