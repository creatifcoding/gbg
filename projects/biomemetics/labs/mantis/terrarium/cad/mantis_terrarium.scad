// Particle-base mantis terrarium - theoretical parametric source
// Units: mm. All non-locked geometry is REF and must be verified on first article.
include <generated/contracts.scad>

$fn = 48;

frame_d = frame_w;
cassette_clearance = 0.20; // TARGET each seat system
rail_offset = 5;         // REF external clearance
carriage_w = 60;         // REF
carriage_d = 42;         // REF
carriage_h = 28;         // REF
guard_t = 1.5;           // REF external service guard lip
contact_field_w = (strip_count-1)*pogo_pitch + contact_land_w;
contact_field_y = (rail_w-contact_field_w)/2;
contact_side_clearance = contact_field_y-rail_wall;

assert(contact_side_clearance >= 0,
  str("contact field intersects rail wall; clearance=", contact_side_clearance));
assert(video_dock_pitch*video_dock_count == span_mm,
  "video dock pitch/count must exactly cover the 500 mm span");

module edge_block(length=pitch_mm) {
  difference() {
    cube([length, frame_w, frame_d]);
    translate([4, 4, 4]) cube([length-8, frame_w-8, frame_d]);
    // cassette pocket: nominal 3.2 REF
    translate([0, 10, 8]) cube([length, panel_t + cassette_clearance, 10]);
  }
}

module corner_post(height=span_mm) {
  difference() {
    cube([frame_w, frame_d, height]);
    translate([8,8,0]) cube([frame_w,frame_d,height]);
    translate([4,10,0]) cube([panel_t+cassette_clearance,10,height]);
    translate([10,4,0]) cube([10,panel_t+cassette_clearance,height]);
  }
}

module rail(length=pitch_mm) {
  difference() {
    cube([length, rail_w, rail_h]);
    translate([0,rail_wall,4])
      cube([length, rail_w-2*rail_wall, rail_h-4+0.01]);
    translate([0,contact_field_y-1,0])
      cube([length, contact_field_w+2, 5]);
  }
}

module strip(length=pitch_mm) {
  // P01-P08 continuous power/control lands.
  for (i=[0:7])
    translate([0, contact_field_y+i*pogo_pitch, 0])
      cube([length,contact_land_w,0.2]);
  // P09-P12 are guarded high-speed cells at indexed V-docks. A 250 mm
  // member has two cells; a 500 mm member has four.
  dock_count = floor(length / video_dock_pitch);
  for (dock=[0:dock_count-1], i=[8:11])
    translate([video_dock_pitch/2 + dock*video_dock_pitch - 9,
      contact_field_y+i*pogo_pitch, 0])
      cube([18,contact_land_w,0.2]);
}

module rail_access_guard(length=pitch_mm) {
  // B52: two captive external guard lips leave a pogo access slot. There is
  // deliberately no insulating film over the ENIG lands.
  cube([length, contact_field_y-0.4, guard_t]);
  translate([0, contact_field_y+contact_field_w+0.4, 0])
    cube([length, rail_w-(contact_field_y+contact_field_w+0.4), guard_t]);
}

module rail_end_stop() {
  // B51: positively retained route end; M3 service removal is deliberate.
  difference() {
    cube([8,rail_w,rail_h+guard_t]);
    translate([4,rail_w/2,-0.1])
      cylinder(h=rail_h+guard_t+0.2,d=3.4);
  }
}

module rail_route(length=pitch_mm) {
  rail(length);
  translate([0,0,5]) strip(length);
  translate([0,0,rail_h]) rail_access_guard(length);
  translate([-8,0,0]) rail_end_stop();
  translate([length,0,0]) rail_end_stop();
}

module carriage() {
  difference() {
    hull() {
      cube([carriage_w,carriage_d,carriage_h-6]);
      translate([3,3,carriage_h-6]) cube([carriage_w-6,carriage_d-6,6]);
    }
    translate([6,6,0]) cube([carriage_w-12,carriage_d-12,carriage_h]);
    translate([carriage_w/2-10,0,4]) cube([20,carriage_d,8]);
  }
}

module terrarium_assembly(exploded=0) {
  // Four exterior posts
  for (x=[0,pitch_mm-frame_w], y=[0,pitch_mm-frame_d])
    translate([x,y,0]) corner_post();
  // Top and bottom edge members
  for (z=[0,span_mm-frame_d]) {
    translate([0,0,z]) edge_block();
    translate([0,pitch_mm-frame_w,z]) edge_block();
    translate([0,0,z]) rotate([0,0,90]) edge_block();
    translate([pitch_mm-frame_w,0,z]) rotate([0,0,90]) edge_block();
  }
  // External top-front rail
  translate([0,-rail_w-rail_offset,span_mm-rail_h+exploded]) rail_route();
  // External front-left vertical rail, modeled as one 500 mm route.
  translate([0,-rail_w-rail_offset,0]) rotate([0,-90,0]) rail_route(span_mm);
  translate([pitch_mm*0.25,-rail_w-rail_offset-4,span_mm+exploded*2]) carriage();
}

terrarium_assembly(0);
