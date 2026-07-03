"""TriARge Paramedic Client — AR smart-glasses simulation for macOS.

Implements the full field-client logic (marker detection, occlusion-robust
patient anchoring, voice protocoling, live sync with the hub) with a
lightweight CLI logger standing in for the AR display. Swapping the CLI
renderer for a real HMD renderer is the only change needed for actual
glasses hardware — everything else is display-agnostic.
"""

__version__ = "0.1.0"
