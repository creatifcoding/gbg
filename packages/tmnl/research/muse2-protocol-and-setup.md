# Research: Muse 2 connection/protocol facts

## Summary
Muse 2 is publicly documented and community-reverse-engineered as a **BLE/GATT** device, not a USB-data device. Setup is via the Muse app over Bluetooth (with location services enabled on mobile), while the official SDK is licensed for non-commercial/personal use unless you get a commercial agreement.

## Findings
1. **Muse 2 is BLE-first; I found no public USB data protocol for it** — Official setup docs tell users to turn the headset on and connect via Bluetooth, and the SDK page says Muse SDK “manages the Bluetooth connection.” Public libraries for Muse 2 all talk to the headset over BLE GATT. I did **not** find a public, vendor-supported USB streaming protocol for Muse 2. **Confidence: high for BLE-first, medium for “no public USB data path found.”** [Starter Guide](https://choosemuse.com/pages/starter-guide-muse-2), [Muse SDK](https://choosemuse.com/pages/developers), [muse-js README](https://github.com/urish/muse-js/blob/master/README.md)

2. **Pairing/setup requirements are lightweight: Bluetooth on, location services on (mobile), then app-level pairing; low-level BLE access may not require OS pairing/bonding** — The official starter guide says to enable Bluetooth and location services before pairing in the app. A community reverse-engineering note says Muse 2/Muse S “don’t need pairing” and exposes GATT characteristics directly; that’s useful for direct BLE tooling, but it’s community evidence, not vendor guidance. **Confidence: high for app setup; medium for no-OS-pairing claim.** [Starter Guide](https://choosemuse.com/pages/starter-guide-muse-2), [Protocol Advice #42](https://github.com/urish/muse-js/issues/42)

3. **Public GATT/service details are available and fairly stable for the classic Muse 2 protocol** — Community code identifies the main service as `0xFE8D` with classic characteristics: control `273e0001-4c4d-454d-96be-f03bac821358`, telemetry `...000b...`, gyro `...0009...`, accelerometer `...000a...`, and EEG `...0003`–`...0007`. `muse-rs` also documents classic PPG characteristics `...000f`–`...0011` for Muse 2, plus the usual start sequence and command flow. **Confidence: high.** [muse-js src/muse.ts](https://github.com/urish/muse-js/blob/06e83670a0558297feebe4540f6b11d203003aed/src/muse.ts), [muse-rs README](https://github.com/eugenehp/muse-rs)

4. **Vendor SDK exists, but it’s access-controlled/licensed rather than a fully open protocol spec** — Muse’s developer page says the SDK provides data access, Bluetooth management, `.muse` file tools, playback, and logs; it’s available on iOS, Android, Windows, and macOS, but only for testing/prototyping/art/personal exploration unless you obtain a commercial license. **Confidence: high.** [Muse SDK](https://choosemuse.com/pages/developers), [SDK Partners](https://choosemuse.com/pages/sdk-partners)

5. **Firmware/bootloader flashing looks unsupported publicly; treat any attempt as risky** — I found no public Muse 2 firmware flashing/bootloader unlock procedure from the vendor. The closest thing in public reverse-engineering notes is a speculative comment that one preset may enter a “different runstate, maybe bootloaderish,” but that is **not** a documented flashing path. Bottom line: for non-destructive hacking, stick to read-only BLE inspection and documented command writes; arbitrary firmware pokes could brick the device. **Confidence: low-to-medium.** [Protocol Advice #42](https://github.com/urish/muse-js/issues/42), [muse-rs README](https://github.com/eugenehp/muse-rs)

## Practical next steps
- Use a BLE scanner / `bluetoothctl` / `bleak` / `muse-js` to confirm the `0xFE8D` service before writing anything.
- Start read-only: subscribe to telemetry/EEG/IMU characteristics first.
- If you need app integration, request the official SDK license instead of trying to flash firmware.
- Avoid undocumented commands/presets unless you have a recovery plan.

## Sources
- Kept: [Starter Guide - Muse 2](https://choosemuse.com/pages/starter-guide-muse-2) — official pairing/setup flow.
- Kept: [Developers - Muse SDK](https://choosemuse.com/pages/developers) — official SDK scope/licensing.
- Kept: [SDK Partners](https://choosemuse.com/pages/sdk-partners) — official statement of data access and Bluetooth management.
- Kept: [muse-js README](https://github.com/urish/muse-js/blob/master/README.md) — open-source BLE client behavior and PPG support.
- Kept: [muse-js src/muse.ts](https://github.com/urish/muse-js/blob/06e83670a0558297feebe4540f6b11d203003aed/src/muse.ts) — concrete GATT UUIDs and command flow.
- Kept: [muse-rs README](https://github.com/eugenehp/muse-rs) — classic vs Athena protocol and Muse 2 classic sensor map.
- Kept: [Protocol Advice #42](https://github.com/urish/muse-js/issues/42) — community notes on no pairing and raw GATT access.
- Dropped: old Muse hardware/use-and-care notes — useful historical context, but not clearly Muse 2-specific.
- Dropped: support pages that rendered as 404/CSS-error — not reliable enough to cite.

## Gaps
- I could not confirm a vendor-documented USB data stream for Muse 2.
- I could not verify any public, supported firmware flashing path or recovery mode for Muse 2.
- I did not confirm whether current Muse 2 hardware revisions expose any hidden USB diagnostics beyond charging.
