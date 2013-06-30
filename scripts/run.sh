#!/usr/bin/env bash

BASE_DIR=$(cd $(dirname $0)/..; pwd)
OUTPUT_DIR="$BASE_DIR/output"

cd $OUTPUT_DIR
if [ "$?" != 0 ]; then
	echo "Output directory not found"
	exit 1
fi

# Clean up directories that are more than 7 days old
find . -mindepth 1 -maxdepth 1 -ctime 7 -type d | xargs rm -rf

DEST_DIR="$BASE_DIR/output/$(date +%Y-%m-%d_%H-%M)"
mkdir -p $DEST_DIR && cd $DEST_DIR

if [ "$?" != 0 ]; then
	echo "Could not create destination directory"
	exit 1
fi

# The maximum duration of 1 run about 45-60 seconds
# We plan to run this every 12 hours, so lets run it
# no more than (12 * 60) = 720 times
total=720
for (( i=1;  i<total; i++)); do
	echo "[loop] Run $i of $total..."
	# Number must be the last regular argument to `timeout`
	timeout --foreground 60 casperjs $BASE_DIR/test.js
done

touch 'done.txt'
