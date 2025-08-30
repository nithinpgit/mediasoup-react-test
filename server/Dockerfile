FROM node:22-alpine
ENV TZ=Asia/Kolkata
EXPOSE 4000
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache --update \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    python3-dev \
    gcc \
    musl-dev \
    linux-headers

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install required Python packages
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Clean up build dependencies
RUN apk del --purge \
    make \
    g++ \
    git \
    python3-dev \
    gcc \
    musl-dev \
    linux-headers \
    && rm -rf \
    /var/cache/apk/* \
    /tmp/* \
    /root/.npm \
    /root/.node-gyp \
    /root/.cache

# Copy the rest of the application
COPY . .

CMD ["sh", "-c", "npm run dev"]