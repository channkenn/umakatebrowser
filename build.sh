#!/usr/bin/env bash

set -e

PROJECT=umakatebrowser

mkdir -p \
  ${PROJECT}/docs \
  ${PROJECT}/userscript \
  ${PROJECT}/assets/icons \
  ${PROJECT}/tools

touch \
  ${PROJECT}/README.md \
  ${PROJECT}/.gitignore \
  ${PROJECT}/docs/design.md \
  ${PROJECT}/docs/memo.md \
  ${PROJECT}/userscript/umakate.user.js \
  ${PROJECT}/userscript/metadata.js \
  ${PROJECT}/userscript/style.css \
  ${PROJECT}/userscript/util.js \
  ${PROJECT}/tools/dom-dump.js

echo "Project skeleton created: ${PROJECT}"

