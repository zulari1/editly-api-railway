FROM node:lts-bookworm AS build

# === Build dependencies for gl + canvas (this fixes your exact error) ===
RUN apt-get update -y && apt-get -y install \
    build-essential \
    libcairo2-dev \
    libgif-dev \
    libgl1-mesa-dev \
    libglew-dev \
    libglu1-mesa-dev \
    libjpeg-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libxi-dev \
    pkg-config \
    python-is-python3

WORKDIR /app

COPY package*.json ./
RUN npm install --no-fund --no-audit

COPY . .

# Prune anything unnecessary
RUN npm prune --omit=dev

# Remove build tools to keep final image clean
RUN apt-get --purge autoremove -y \
    build-essential \
    libcairo2-dev \
    libgif-dev \
    libgl1-mesa-dev \
    libglew-dev \
    libglu1-mesa-dev \
    libjpeg-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libxi-dev \
    pkg-config \
    python-is-python3 && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# === Final runtime image ===
FROM node:lts-bookworm

# Runtime dependencies + headless display (xvfb prevents "gl returned null")
RUN apt-get update -y && apt-get -y install \
    ffmpeg \
    dumb-init \
    xvfb \
    libcairo2 \
    libpango1.0-0 \
    libgif7 \
    librsvg2-2 \
    libgl1-mesa-glx \
    libxi6 \
    libxrender1 \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

WORKDIR /app
COPY --from=build /app /app

EXPOSE 3000

# This wrapper is required for editly to work headless (official method)
ENTRYPOINT ["/usr/bin/dumb-init", "--", "xvfb-run", "--server-args", "-screen 0 1280x1024x24 -ac"]
CMD ["node", "index.js"]
