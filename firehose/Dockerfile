FROM node:14 AS build-step
RUN mkdir /build
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:14
# transform arguments to env
ARG STAGE
ENV STAGE=$STAGE
ARG GCP_PROJECT_ID
ENV GCP_PROJECT_ID=$GCP_PROJECT_ID
ARG GCP_DATASET_ID
ENV GCP_DATASET_ID=$GCP_DATASET_ID
ARG GCP_TABLE_ID
ENV GCP_TABLE_ID=$GCP_TABLE_ID
# proceed with deploy
WORKDIR ${LAMBDA_TASK_ROOT}
COPY package*.json ./
COPY --from=build-step /build/dist .
RUN npm ci --only=production
CMD [ "index.handler" ]

