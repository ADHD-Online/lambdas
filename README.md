# lambdas

A monorepo-style place for lambdas to live

## Docker Image Environment Variables

These have to be passed in as build args, and as such each one should be added
to the `Dockerfile` like so:

```
...
ARG VARIABLE_NAME
ENV VARIABLE_NAME=$VARIABLE_NAME
...
```

Be careful not to pass in secrets this way, as anyone that can view the image
can extract them.

The `EcrCodePipeline` construct in `ADHD-Online/iac` automagically passes
any variables defined in the prop `additionalBuildEnv` as `docker build` args
this way, but to put them in the image's env you have to do the above in your
`Dockerfile`.

If you need a secret at runtime, fetch it when you need it using the AWS
Secrets Manager sdk.

## Expected Env

The following env variables are expected by the projects in here:

### Firehose

| Variable         | Description
| ---------------- | -----------
| `STAGE`          | Stage of deployment (such as edge, uat, or prod)
| `NPM_TOKEN`\*    | Token that can read the ADO npm package registry on Github
| `GCP_PROJECT_ID` | ID of the data lake project in gcp
| `GCP_DATASET_ID` | ID of the data lake dataset in gcp
| `GCP_TABLE_ID`   | ID of the data lake table in gcp

\* Denotes a build-time-only secret that should not end up in the final image

### Messaging

| Variable               | Description
| ---------------------- | -----------
| `STAGE`                | Stage of deployment (such as edge, uat, or prod)
| `NPM_TOKEN`\*          | Token that can read the ADO npm package registry on Github
| `AWS_DEFAULT_REGION`   | 'us-east-2' most likely
| `CONFIG_TABLE_NAME`    | The name of the dynamodb table that contains flow configs
| `EMAIL_SOURCE_ADDRESS` | Email address to use to send messages

\* Denotes a build-time-only secret that should not end up in the final image

