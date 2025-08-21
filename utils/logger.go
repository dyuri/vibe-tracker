package utils

import (
	"io"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"vibe-tracker/config"
)

var Logger zerolog.Logger

// InitLogger initializes the global structured logger
func InitLogger(cfg *config.AppConfig) {
	// Configure output format
	var output io.Writer = os.Stdout
	
	// Pretty print for development
	if cfg.IsDevelopmentMode() {
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}
	}

	// Set global log level
	var level zerolog.Level
	if cfg.IsDevelopmentMode() {
		level = zerolog.DebugLevel
	} else {
		level = zerolog.InfoLevel
	}

	// Initialize logger
	Logger = zerolog.New(output).
		Level(level).
		With().
		Timestamp().
		Caller().
		Logger()

	// Set as global logger
	log.Logger = Logger

	// Log initialization
	Logger.Info().
		Str("level", level.String()).
		Bool("development", cfg.IsDevelopmentMode()).
		Msg("Logger initialized")
}

// GetLogger returns the global logger instance
func GetLogger() zerolog.Logger {
	return Logger
}

// LogError logs an error with context
func LogError(err error, msg string) *zerolog.Event {
	return Logger.Error().Err(err).Str("context", msg)
}

// LogInfo logs an info message
func LogInfo() *zerolog.Event {
	return Logger.Info()
}

// LogDebug logs a debug message
func LogDebug() *zerolog.Event {
	return Logger.Debug()
}

// LogWarn logs a warning message
func LogWarn() *zerolog.Event {
	return Logger.Warn()
}

// RequestLogger creates a logger for HTTP requests
func RequestLogger(method, path, userID string) *zerolog.Event {
	return Logger.Info().
		Str("method", method).
		Str("path", path).
		Str("user_id", userID)
}