FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Create logs directory
RUN mkdir -p logs

# Non-root user
RUN addgroup -S earnhub && adduser -S earnhub -G earnhub
USER earnhub

EXPOSE 5001 5002 5003 5004

CMD ["node", "src/server.js"]
