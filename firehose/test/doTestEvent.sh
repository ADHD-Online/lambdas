#!/usr/bin/env bash

HERE="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

curl -XPOST \
    -d "@$HERE/sample-event.json" \
    "http://localhost:9000/2015-03-31/functions/function/invocations" \
    | jq .errorMessage | sed 's/\\"/"/g' | xargs -0 echo -e

