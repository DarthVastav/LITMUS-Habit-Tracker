#!/bin/bash
# Mirror the working tree to outputs (sans node_modules/dist/.env) and zip it.
set -e
DEST=/mnt/user-data/outputs/litmus
rm -rf "$DEST"
mkdir -p "$DEST"
tar cf - --exclude=node_modules --exclude=dist --exclude=.env --exclude=.git . | (cd "$DEST" && tar xf -)
cd /mnt/user-data/outputs
rm -f litmus.zip
cd litmus && zip -qr ../litmus.zip . && cd ..
N=$(find litmus -type f | wc -l)
S=$(du -h litmus.zip | cut -f1)
echo "synced $N files → $S zip"
