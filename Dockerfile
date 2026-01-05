FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

RUN pnpm prisma generate
RUN pnpm run build

CMD [ "pnpm", "start" ]