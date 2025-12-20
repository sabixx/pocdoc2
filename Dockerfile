FROM node:20-alpine

WORKDIR /app

# Copy package files from pocdoc folder
COPY ./pocdoc/package*.json ./

# Install dependencies
RUN npm install --omit=dev
RUN npm install js-yaml
RUN npm install @aws-sdk/client-s3

# Copy application files from pocdoc folder
COPY ./pocdoc .

# Create data directory
RUN mkdir -p /app/data /app/use-cases

# Expose port
EXPOSE 3000

# =============================================================================
# Environment variables with defaults
# =============================================================================

# Mode
ENV POC_OR_DEMO=demo

# Customer info
ENV PROSPECT=demo \
    PARTNER= \
    SAAS_NAME="Certificate Manager SaaS" \
    POC_START_DATE= \
    POC_END_DATE=

# SA info (for POC registration)
ENV SA_NAME= \
    SA_EMAIL=

# Backend API
ENV POC_INSIGHTS_URL= \
    API_SHARED_SECRET= \
    HEARTBEAT_INTERVAL_MINUTES=1440

# Use cases
ENV USE_CASE_REPO_URL= \
    USE_CASE_LOCAL_PATH=/app/use-cases \
    ACTIVE_USE_CASES=

# Auth
ENV AUTH_ADMIN_USERNAME=admin \
    AUTH_ADMIN_PASSWORD=admin \
    AUTH_PROSPECT_PASSWORD=password \
    SESSION_SECRET=change-me-in-production

# TLSPC (API key used to auto-detect regional endpoint)
ENV TLSPC_API_KEY=

# Application
ENV NODE_ENV=production \
    PORT=3000 \
    DEFAULT_PASSWORD=ChangeMe123!

# Start the application
CMD ["node", "server.js"]