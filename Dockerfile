# =============================================================================
# Moss AI Agent Platform — Multi-Stage Docker Build
#
# Stage 1: Python data science environment
# Stage 2: CloudCLI (React + Node.js) build
# Stage 3: Final runtime image combining all components
# =============================================================================

# ==========================
# Stage 1: Python Environment
# ==========================
FROM python:3.11-slim-bookworm AS python-base

# Install system dependencies needed for scientific computing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    libgomp1 \
    libopenblas-dev \
    liblapack-dev \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Install Python data science packages
# Core data analysis
RUN pip install --no-cache-dir \
    pandas \
    numpy \
    openpyxl \
    xlsxwriter

# Visualization
RUN pip install --no-cache-dir \
    matplotlib \
    seaborn \
    plotly

# Machine learning & prediction
RUN pip install --no-cache-dir \
    scikit-learn \
    xgboost \
    lightgbm

# AutoGluon (large package, separate layer for caching)
RUN pip install --no-cache-dir \
    autogluon

# Statistics
RUN pip install --no-cache-dir \
    scipy \
    statsmodels \
    pingouin

# NLP (Chinese text processing)
RUN pip install --no-cache-dir \
    jieba \
    wordcloud

# Document processing
RUN pip install --no-cache-dir \
    pdfplumber \
    python-docx \
    python-pptx

# Additional utilities
RUN pip install --no-cache-dir \
    requests \
    beautifulsoup4 \
    yfinance \
    quantstats


# ==========================
# Stage 2: CloudCLI Build
# ==========================
FROM node:20-slim AS cloudcli-build

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Clone CloudCLI (siteboon/claudecodeui)
WORKDIR /build
RUN git clone --depth 1 https://github.com/siteboon/claudecodeui.git .

# Install dependencies and build
RUN npm install
# Build CloudCLI if build script exists; skip gracefully for repos without one
RUN if grep -q '"build"' package.json 2>/dev/null; then npm run build; fi


# ==========================
# Stage 3: Final Runtime Image
# ==========================
FROM python:3.11-slim-bookworm AS runtime

LABEL maintainer="Moss AI Agent Platform"
LABEL description="Enterprise AI Agent Platform — Claude Code + CloudCLI + Python Data Science"

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Chinese font support for matplotlib
    fonts-noto-cjk \
    # OpenBLAS for numpy/scipy
    libgomp1 \
    libopenblas0 \
    # Firewall
    iptables \
    # Process management
    tini \
    # Network utilities (for healthcheck)
    curl \
    # Git (needed by Claude Code)
    git \
    # Privilege drop utility
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x runtime (no build tools needed)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy Python packages from Stage 1
COPY --from=python-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-base /usr/local/bin /usr/local/bin

# Copy CloudCLI from Stage 2
COPY --from=cloudcli-build /build /app/cloudcli

# Copy application scripts and config
COPY scripts/ /app/scripts/
COPY config/ /app/config/

# Copy Moss plugins
COPY plugins/ /app/cloudcli/plugins/

# Install plugin dependencies
RUN cd /app/cloudcli/plugins/moss-toolbox && npm install --production 2>/dev/null || true
RUN cd /app/cloudcli/plugins/moss-admin && npm install --production 2>/dev/null || true

# Fix line endings (Windows CRLF → Unix LF) and make scripts executable
RUN sed -i 's/\r$//' /app/scripts/*.sh && chmod +x /app/scripts/*.sh

# Create non-root user
RUN groupadd -g 1000 agent \
    && useradd -u 1000 -g agent -m -d /home/agent -s /bin/bash agent

# Create directories that need to be writable
RUN mkdir -p /persistent /home/agent/.claude /home/agent/.npm \
    && chown -R agent:agent /home/agent /persistent

# Configure matplotlib font cache directory
ENV MPLCONFIGDIR=/tmp/matplotlib
ENV HOME=/home/agent

# CloudCLI environment
ENV SERVER_PORT=3001
ENV HOST=0.0.0.0
ENV CONTEXT_WINDOW=160000

# Expose CloudCLI port
EXPOSE 3001

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--", "/app/scripts/entrypoint.sh"]
