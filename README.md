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

