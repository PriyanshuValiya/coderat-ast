FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY ast.js ./ast.js

EXPOSE 4000

CMD ["node", "ast.js"]