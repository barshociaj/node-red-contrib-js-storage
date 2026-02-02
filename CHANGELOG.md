# node-red-contrib-js-storage Changelog

This changelog uses [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

# 1.0.5 (2 February 2026)

- Upgraded dependencies

# 1.0.4 (3 January 2024)

- Add `\r` character to line splitting to avoid repeated code indent of functions created on Windows

# 1.0.3 (18 December 2023)

- Moved node order to a separate file `_order.json` to minimize the number of file updates when nodes are added to flows
- Upgraded dependencies

# 1.0.2 (13 January 2023)

- Upgraded dependencies in lock file

# 1.0.1 (13 January 2023)

## Changed

- Switched settings.js config that disables updates to flows.json file - from `flowFile: false` to `flowFileReadOnly: true`
- Upgraded dependencies
- Set minimum Node-RED and NodeJS version and added license to package.json

# 1.0.0 (3 January 2023)

## Added

- JS storage module baseline
