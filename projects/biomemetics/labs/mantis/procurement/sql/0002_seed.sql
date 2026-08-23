-- Generated from terrarium/BOM.md plus CAD search hits.
-- Do not invent prices, lead times, quotes, or purchase orders.
-- manufacturer_sku has no source_url, description, or lifecycle columns.
-- supplier_party has no URL column. Source URLs live in part.notes.
-- B42 class stays NULL. Three Tachyon SKUs are candidates, none selected.
-- B43 class stays NULL. M1ENCLEA is a SKU row, not an order.
-- B45 MAX96717 is device discovery. Package suffix UNVERIFIED.
-- B46 has no SKU. CAD did not open the product page.
-- B05/B06 are a TAP Chemcast family hit with no selected SKU.
-- Particle supplier_party is discovery, not a buy.

INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B01$bom$, $bom$PETG/ASA corner block$bom$, $bom$8$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B02$bom$, $bom$250 mm edge member$bom$, $bom$16$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B03$bom$, $bom$250-to-500 splice/alignment block$bom$, $bom$4$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B04$bom$, $bom$cassette retainer/gasket carrier$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B05$bom$, $bom$3 mm cast-acrylic view cassette$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast). PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm. No selected cut-size SKU. Not a buy. Source: https://www.tapplastics.com/product/plastics/cut_to_size_plastic/acrylic_sheets_cast_clear/510$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B06$bom$, $bom$3 mm cast-acrylic front door$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast). PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm. No selected cut-size SKU. Not a buy. Source: https://www.tapplastics.com/product/plastics/cut_to_size_plastic/acrylic_sheets_cast_clear/510$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B07$bom$, $bom$printed door labyrinth surround$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B08$bom$, $bom$external polymer hinge set$bom$, $bom$2$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B09$bom$, $bom$independent mechanical door latch$bom$, $bom$2$bom$, $bom$REF$bom$, $bom$LOCK count / REF design$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B10$bom$, $bom$two-piece ceiling mesh frame$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B11$bom$, $bom$<=0.8 mm plastic/fiberglass/polyester screen$bom$, $bom$set$bom$, $bom$LOCK$bom$, $bom$constraint. CAD miss: common 18x16 insect mesh is cited around 1.2 mm hole (PVC-coated fiberglass listing); that misses LOCK <=0.80 mm nonmetal aperture. No selected PN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B12$bom$, $bom$low-intake vent cassette$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B13$bom$, $bom$high-exhaust vent cassette$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B14$bom$, $bom$perforated false bottom$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B15$bom$, $bom$20-30 mm drain tray$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B16$bom$, $bom$drain plug plus insect baffle$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B17$bom$, $bom$removable perch socket/cap$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B18$bom$, $bom$external 38 mm hybrid rail channel$bom$, $bom$route set$bom$, $bom$REF$bom$, $bom$CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B19$bom$, $bom$P01-P08 continuous electrode flex plus V-dock pads$bom$, $bom$route set$bom$, $bom$UNVERIFIED$bom$, $bom$stack-up$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B20$bom$, $bom$continuous structural rail wall / wet-side barrier$bom$, $bom$route set$bom$, $bom$REF$bom$, $bom$animal-volume boundary, not an insulating film over contacts$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B21$bom$, $bom$rail splice and corner electrical junction$bom$, $bom$set$bom$, $bom$REF$bom$, $bom$carriage does not turn corner$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B22$bom$, $bom$carriage outer shell$bom$, $bom$1+$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B23$bom$, $bom$opposed pinch levers and cams$bom$, $bom$2/carriage$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B24$bom$, $bom$split floating contact carrier$bom$, $bom$1/carriage$bom$, $bom$REF$bom$, $bom$HSD cell vertically seats$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B25$bom$, $bom$normally locked carriage spring$bom$, $bom$1/carriage$bom$, $bom$UNVERIFIED$bom$, $bom$rate/PN$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B26$bom$, $bom$polymer roller and axle set$bom$, $bom$4/carriage$bom$, $bom$UNVERIFIED$bom$, $bom$PN$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B27$bom$, $bom$12-position spring contact array$bom$, $bom$1/carriage$bom$, NULL, $bom$power pins and HSD cell UNVERIFIED$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B28$bom$, $bom$universal latch shoe$bom$, $bom$1/carriage$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B29$bom$, $bom$camera SerDes binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B30$bom$, $bom$temperature/RH binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B31$bom$, $bom$LED-bar binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B32$bom$, $bom$mist-nozzle binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B33$bom$, $bom$blank/cap binder housing$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B34$bom$, $bom$internal camera-to-serializer FPC clamp$bom$, $bom$1$bom$, $bom$REF$bom$, $bom$$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B35$bom$, $bom$external Tachyon/M1 brick mount$bom$, $bom$1$bom$, $bom$UNVERIFIED$bom$, $bom$geometry$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B36$bom$, $bom$Particle-supported Sony IMX519 autofocus camera module$bom$, $bom$1$bom$, $bom$UNVERIFIED$bom$, $bom$Exact orderable module, revision, outline, connector orientation, and STEP `UNVERIFIED`; legacy B0371 is not a release selection$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B37$bom$, $bom$internal camera FPC, exact assembly$bom$, $bom$1$bom$, $bom$UNVERIFIED$bom$, $bom$length/orientation$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B38$bom$, $bom$M3 fasteners and heat-set inserts$bom$, $bom$set$bom$, $bom$UNVERIFIED$bom$, $bom$selected PN/pocket$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B39$bom$, $bom$optional captured alignment magnets$bom$, $bom$set$bom$, $bom$UNVERIFIED$bom$, $bom$never primary latch$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B40$bom$, $bom$gasket stock$bom$, $bom$set$bom$, $bom$UNVERIFIED$bom$, $bom$material/compression$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B41$bom$, $bom$M20 plugs/glands for M1 nonmoving cables$bom$, $bom$set$bom$, NULL, $bom$verified M1 feature; no moving CSI tether$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B42$bom$, $bom$Particle Tachyon$bom$, $bom$1$bom$, NULL, $bom$Vendor-documented 85 x 56 x 18.5 mm; exact revision CAD still required. Candidate manufacturer SKUs from the datasheet ordering table, none selected: TACH4NA Tachyon 4GB RAM / 64GB Flash (NorAm); TACH8NA Tachyon 8GB RAM / 128GB Flash (NorAm); TACH8ROW Tachyon 8GB RAM / 128GB Flash (EMEA). Sources: https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/ https://store.particle.io/products/tachyon-5g-single-board-computer$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B43$bom$, $bom$Particle M1 enclosure$bom$, $bom$0-1$bom$, NULL, $bom$M1ENCLEA; lifecycle GA as printed in the ordering table; vendor-documented 121 x 220 x 69 mm. Kit includes 2x M20 glands + 2x M20 plugs (B41 adjacent, not a selected standalone gland PN). Sources: https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/ https://store.particle.io/products/m1-enclosure$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B44$bom$, $bom$fused rail power tap$bom$, $bom$1$bom$, NULL, $bom$2 A TARGET, final budget UNVERIFIED$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B45$bom$, $bom$Analog Devices MAX96717 camera serializer carrier$bom$, $bom$1$bom$, NULL, $bom$device verified; carrier design UNVERIFIED. Analog Devices MAX96717 (CSI-2 to GMSL2 serializer). Package/tape suffix and carrier UNVERIFIED; no orderable suffix PN. Source: https://www.analog.com/en/products/max96717.html$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B46$bom$, $bom$Analog Devices MAX96724 quad deserializer carrier$bom$, $bom$1$bom$, NULL, $bom$device verified; Tachyon integration UNVERIFIED$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B47$bom$, $bom$four 100 ohm V-dock point-to-point flex/STP channels$bom$, $bom$1 set$bom$, NULL, $bom$SI stack and routing UNVERIFIED$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B48$bom$, $bom$local supervisor, normally-open S1 carriage-mate switch, normally-open S2 binder-mate switch, per-carriage Q1 current-limited load switch, discharge, and bus isolation$bom$, $bom$1/carriage$bom$, NULL, $bom$exact parts, mate order, timeout, polarity, and timing `UNVERIFIED`; P08 is not safety authority$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B49$bom$, $bom$optional TCA9548A I2C switch carrier$bom$, $bom$0-1$bom$, NULL, $bom$device documented; address, reset, hot-insertion behavior, carrier, and need remain `UNVERIFIED`$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B50$bom$, $bom$separate keyed 12-net carriage-to-binder connector/contact system$bom$, $bom$1/carriage + 1/binder$bom$, NULL, $bom$`C01`-`C12` mirror required nets; series, pin geometry, controlled-impedance launch, mate order, current, hot-unplug behavior, and durability `UNVERIFIED`$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B51$bom$, $bom$captive rail route end stop with deliberate M3 service removal$bom$, $bom$2/independent route$bom$, NULL, $bom$geometry, fastener retention, drop/handling protocol, and proof load `UNVERIFIED`$bom$) ON CONFLICT (balloon_id) DO NOTHING;
INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES ($bom$B52$bom$, $bom$external rail access-slot guard / labyrinth wiper$bom$, $bom$route set$bom$, NULL, $bom$leaves ENIG lands contactable only inside captive external carriage envelope; environmental ingress rating `UNVERIFIED`, not hermetic$bom$) ON CONFLICT (balloon_id) DO NOTHING;

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

INSERT INTO supplier_party (id, name) VALUES (
  $bom$particle$bom$,
  $bom$Particle$bom$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturer_sku (id, part_id, manufacturer, mpn, revision) VALUES
  ($bom$TACH4NA$bom$, $bom$B42$bom$, $bom$Particle$bom$, $bom$TACH4NA$bom$, NULL),
  ($bom$TACH8NA$bom$, $bom$B42$bom$, $bom$Particle$bom$, $bom$TACH8NA$bom$, NULL),
  ($bom$TACH8ROW$bom$, $bom$B42$bom$, $bom$Particle$bom$, $bom$TACH8ROW$bom$, NULL),
  ($bom$M1ENCLEA$bom$, $bom$B43$bom$, $bom$Particle$bom$, $bom$M1ENCLEA$bom$, NULL),
  ($bom$MAX96717$bom$, $bom$B45$bom$, $bom$Analog Devices$bom$, $bom$MAX96717$bom$, NULL)
ON CONFLICT (id) DO NOTHING;

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
