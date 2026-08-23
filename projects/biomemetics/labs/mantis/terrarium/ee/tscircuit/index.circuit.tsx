import { STUDY_FOOTPRINT } from './src/balloons.ts';
import { COUPON_OUTLINE } from './src/board.ts';
import {
  BINDER_CONTACTS,
  headerConnections,
  headerPinLabels,
  RAIL_CONTACTS,
} from './src/nets.ts';

export default () => (
  <board
    name="indexed-coupon"
    title="indexed coupon"
    width={`${COUPON_OUTLINE.widthMm}mm`}
    height={`${COUPON_OUTLINE.heightMm}mm`}
  >
    <pinheader
      name="B27"
      pinCount={12}
      pitch="2.54mm"
      footprint={STUDY_FOOTPRINT.pinHeader}
      pinLabels={headerPinLabels(RAIL_CONTACTS)}
      connections={headerConnections(RAIL_CONTACTS)}
      manufacturerPartNumber=""
      pcbX="-20mm"
      pcbY="0mm"
    />
    <pinheader
      name="B50"
      pinCount={12}
      pitch="2.54mm"
      footprint={STUDY_FOOTPRINT.pinHeader}
      pinLabels={headerPinLabels(BINDER_CONTACTS)}
      connections={headerConnections(BINDER_CONTACTS)}
      manufacturerPartNumber=""
      pcbX="20mm"
      pcbY="0mm"
    />
    <fuse
      name="B44"
      currentRating="2A"
      footprint={STUDY_FOOTPRINT.fuse}
      connections={{ pin1: 'net.VIN_A' }}
      manufacturerPartNumber=""
      pcbX="0mm"
      pcbY="12mm"
    />
    <group name="B48">
      <switch
        name="S1"
        type="spst"
        isNormallyClosed={false}
        footprint={STUDY_FOOTPRINT.switch}
        manufacturerPartNumber=""
        pcbX="-10mm"
        pcbY="-12mm"
      />
      <switch
        name="S2"
        type="spst"
        isNormallyClosed={false}
        footprint={STUDY_FOOTPRINT.switch}
        manufacturerPartNumber=""
        pcbX="0mm"
        pcbY="-12mm"
      />
      <mosfet
        name="Q1"
        channelType="n"
        mosfetMode="enhancement"
        footprint={STUDY_FOOTPRINT.mosfet}
        manufacturerPartNumber=""
        pcbX="10mm"
        pcbY="-12mm"
      />
    </group>
  </board>
);
