FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --global npm@12.2.0 && npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "run", "server"]
