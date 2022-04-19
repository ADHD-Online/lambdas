#!/usr/bin/env bash

TEST_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker build \
    -t messaging \
    --build-arg STAGE \
    --build-arg GCP_KEYFILE_PATH \
    --build-arg GCP_PROJECT_ID \
    --build-arg GCP_DATASET_ID \
    --build-arg DATA_TABLE_NAME \
    --build-arg CONFIG_TABLE_NAME \
    --build-arg SES_SOURCE_IDENTITY \
    --build-arg SES_CONFIG_SET \
    "$TEST_DIR/.."

