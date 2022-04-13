#!/usr/bin/env bash

CREDENTIALS="$HOME/gcp_credentials"

docker run \
    -p 9000:8080 \
    -v "$CREDENTIALS:/root/gcp_credentials:ro" \
    firehose:latest

