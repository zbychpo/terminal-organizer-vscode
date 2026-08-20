## 1.0.3

Fixed a bug where the startup schema check matched the dead `cdn.statically.io` schema URL as "up to date" (both contained `/v11/`), so the config's `$schema` never got migrated to the bundled schema. The check now compares against the exact bundled schema URI.

## 1.0.2

Removed required "default" from schema

## 1.0.1

Fixed README.md

## 1.0.0

Initial version
