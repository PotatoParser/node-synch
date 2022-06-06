FROM node:16-alpine

WORKDIR /usr/src/app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm i

COPY . .

RUN npm run lint

RUN npm test
