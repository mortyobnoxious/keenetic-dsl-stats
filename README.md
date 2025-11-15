# Keenetic DSL Stats

A Tampermonkey script to inject DSL stats (CRC/FEC errors) and a reset button into the Keenetic router web interface.

## Preview
<img width="400" height="485" alt="Keenetic DSL Stats Preview" src="https://github.com/user-attachments/assets/0340d87d-cb8a-4b4e-ad0f-cb41acf1bd9a" />

## Features

* Shows hidden FEC and CRC error stats.
* Shows uptime on DSL Diagnostics page
* Adds stats to both the Dashboard and DSL Diagnostics pages.
* Auto-refreshes stats every 5 seconds.
* Adds a "Reset DSL" button to resync the line.

## Installation

1. **Install a Userscript Manager** (like [Tampermonkey](https://www.tampermonkey.net/)).
2. Click [Install](https://github.com/mortyobnoxious/keenetic-dsl-stats/raw/main/keenetic.user.js) or go to `keenetic-dsl-stats.user.js` in this repo, click "Raw", and then "Install" in your userscript manager.

## How to Use

1. Log in to your Keenetic router.
2. Go to the Dashboard or Diagnostics > DSL page.
3. The new stats and button will appear automatically.
