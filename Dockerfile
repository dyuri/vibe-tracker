# --- Frontend Build Stage ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files for better caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source files and build
COPY src/ ./src/
COPY public/ ./public/
COPY index.html tsconfig.json vite.config.ts vite-plugin-workbox.ts ./

# Build the frontend
RUN npm run build

# --- Go Build Stage ---
FROM golang:1.23-alpine AS go-builder

WORKDIR /app

# Copy go.mod and go.sum to download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/dist ./dist

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o vibe-tracker .

# --- Final Stage ---
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy the built binary from the go-builder stage
COPY --from=go-builder /app/vibe-tracker .

# Copy the built frontend (optimized assets)
COPY --from=go-builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 8090

VOLUME /app/pb_data

# Run the application
CMD ["./vibe-tracker", "serve", "--http=0.0.0.0:8090"]