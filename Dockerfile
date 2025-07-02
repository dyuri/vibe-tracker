# --- Build Stage ---
FROM golang:1.23-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy go.mod and go.sum to download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o vibe-tracker .

# --- Final Stage ---
FROM alpine:latest

# Set the working directory
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /app/vibe-tracker .

# Copy the public and pb_data directories
COPY public ./public

# Expose the port the app runs on
EXPOSE 8090

# Run the application
CMD ["./vibe-tracker", "serve", "--http=0.0.0.0:8090"]
