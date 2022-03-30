FROM node:14 AS build-step
ARG NPM_TOKEN
RUN mkdir /build
WORKDIR /build
COPY package*.json ./
COPY .npmrc .npmrc
RUN npm ci
COPY . .
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:14
ARG NPM_TOKEN
# transform arguments to env
ARG STAGE
ENV STAGE=$STAGE
# proceed with deploy
WORKDIR ${LAMBDA_TASK_ROOT}
COPY package*.json ./
COPY .npmrc .npmrc
COPY --from=build-step /build/dist .
RUN npm ci --only=production
CMD [ "index.default" ]

