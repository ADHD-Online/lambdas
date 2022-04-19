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

| Variable             | Description
| --------             | -----------
| `STAGE`              | Stage of deployment (such as edge, uat, or prod)
| `GCP_KEYFILE_PATH`\* | Path to the keyfile INSIDE the docker container
| `GCP_PROJECT_ID`     | ID of the data lake project in gcp
| `GCP_DATASET_ID`     | ID of the data lake dataset in gcp

\* Denotes an optional variable that's given a reasonable default if left blank

### Messaging

| Variable               | Description
| --------               | -----------
| `STAGE`                | Stage of deployment (such as edge, uat, or prod)
| `GCP_KEYFILE_PATH`\*   | Path to the keyfile INSIDE the docker container
| `GCP_PROJECT_ID`       | ID of the data lake project in gcp
| `GCP_DATASET_ID`       | ID of the data lake dataset in gcp
| `DATA_TABLE_NAME`      | The name of the dynamodb table that contains api data
| `CONFIG_TABLE_NAME`    | The name of the dynamodb table that contains flow configs
| `SES_SOURCE_IDENTITY`  | "ADHDOnline &lt;info@mail.adhdonline.com&gt;"
| `SES_CONFIG_SET`       | ConfigSet to use

\* Denotes an optional variable that should be left blank when building for the cloud

## Messaging Flows

Flows are described in `index.ts` using the flow function, described below.

    flow({
      flowKey: string;
      source: async () => flow data;
    }) => lambda handler

`flowKey` is a string that uniquely identifies this flow. It must match the
export's name exactly; it must be given exactly to the cdk project's
`OneWayMessagingStack` in the `enabledFlows` array; there must be a view with
the exact same name; and the dynamodb config table must have a pk that's exactly
the key prefixed with `messaging#`. See the table below for an example.

| Flow Key  | Handler Name | CDK Argument | BigQuery View Name | Config Table pk
| --------  | -------------| ------------ | ------------------ | ---------------
| `"MyKey"` | `"MyKey"`    | `"MyKey"`    | `"MyKey"`          | `"messaging#MyKey"`

Hope that's clear enough.

`source` is a functin that fetches and prepares the flow's data. It expects at
a minimum to have a result like:

    {
      patientRecordKey: {
        pk: string;
        sk: string;
      };
      email?: string;
      phone?: string;
    }

...which represent the three side effects these flows are meant to cause.
`patientRecordKey` is how the lambda changes the `nextSteps` section of the user's
portal, `email` is the user's email, and `phone` is the user's phone number
(these two only need to be present if the user hasn't opted out of either mode
of contact). Any additional fields will be replaced-into the message/email
templates.

The function returns an appropriate-arguments lambda handler that will run the
view when triggered.

