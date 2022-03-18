FROM node:14 AS build-step
RUN mkdir /build
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:14
WORKDIR ${LAMBDA_TASK_ROOT}
COPY package*.json ./
COPY --from=build-step /build/dist .
RUN npm ci --only=production
CMD [ "index.handler" ]

