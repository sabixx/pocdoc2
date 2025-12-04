FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY ./pocdoc .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Environment variables with defaults
ENV PORT=3000 \
    NODE_ENV=production \
    SESSION_SECRET=change-me-in-production \
    PROSPECT=demo \
    PARTNER= \
    SAAS_NAME="Certificate Manager SaaS" \
    POC_OR_DEMO=demo \
    POC_INSIGHTS_URL= \
    USE_CASE_REPO_URL= \
    AUTH_ADMIN_USERNAME=admin \
    AUTH_ADMIN_PASSWORD=admin \
    AUTH_PROSPECT_PASSWORD=password \
    TLSPC_URL=https://ui.venafi.cloud \
    DEFAULT_PASSWORD=ChangeMe123!

# Start the application
CMD ["node", "server.js"]