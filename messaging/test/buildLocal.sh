#!/usr/bin/env bash

TEST_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker build \
    -t firehose \
    --build-arg STAGE \
    --build-arg GCP_PROJECT_ID \
    --build-arg GCP_DATASET_ID \
    --build-arg GCP_KEYFILE_PATH \
    "$TEST_DIR/.."

