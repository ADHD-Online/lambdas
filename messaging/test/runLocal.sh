#!/usr/bin/env bash

GCP_CREDENTIALS="$HOME/gcp_credentials"
AWS_CREDENTIALS="$HOME/.aws"

COMMAND="index.${1:-default}"

docker run \
    -p 9000:8080 \
    -v "$GCP_CREDENTIALS:/root/gcp_credentials:ro" \
    -v "$AWS_CREDENTIALS:/root/.aws:ro" \
    messaging:latest \
    "$COMMAND"

