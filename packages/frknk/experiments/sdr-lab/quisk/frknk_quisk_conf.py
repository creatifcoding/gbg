# FRKNK local fake Hermes-Lite/OpenHPSDR Quisk config.
#
# Launch Quisk with:
#   python /path/to/quisk/quisk.py \
#     -c /path/to/packages/frknk/experiments/sdr-lab/quisk/frknk_quisk_conf.py
#
# Pair with:
#   uv run sdr-lab hermes-emulator --host 127.0.0.1 --port 1024

from hermes import quisk_hardware, quisk_widgets  # noqa: F401

# Hermes-Lite/OpenHPSDR receive path.
hardware_file_type = "Hermes"
use_rx_udp = 10
rx_udp_clock = 73_728_000
rx_udp_port = 1024

# Current Quisk uses udp_rx_ip as the known Hermes address. This makes discovery
# deterministic and local instead of relying on LAN broadcast routing.
udp_rx_ip = "127.0.0.1"

# Leave IP-change blank. It is for programming hardware after broadcast discovery;
# the fake radio should not pretend to reconfigure network identity.
rx_udp_ip = ""
rx_udp_ip_netmask = "255.255.255.255"

# The emulator identifies as Hermes-Lite board id 0x06. Keep version open because
# cycle-1 protocol compatibility is about packet grammar, not FPGA firmware lineage.
hermes_board_id = 0x06
hermes_code_version = -1

# Keep cycle 1 receive-only and boring.
sample_rate = 48_000
playback_rate = 48_000
name_of_sound_capt = ""
name_of_sound_play = ""
microphone_name = ""
use_sidetone = 0
add_fdx_button = 0
add_imd_button = 0

# Basic display defaults for seeing the synthetic carrier on the waterfall.
graph_y_scale = 100
graph_y_zero = 100
data_poll_usec = 10_000

# No external band switching in fake-radio mode.
Hermes_BandDict = {}
