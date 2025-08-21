package config

import (
	"os"
	"strconv"
	"strings"
	
	"vibe-tracker/constants"
)

// AppConfig holds all application configuration
type AppConfig struct {
	// Server configuration
	Port string
	Host string
	
	// Database configuration
	Automigrate bool
	
	// Pagination settings
	DefaultPage    int
	DefaultPerPage int
	MaxPerPage     int
}

// NewAppConfig creates a new configuration instance with values from environment variables
func NewAppConfig() *AppConfig {
	return &AppConfig{
		Port:           getEnvOrDefault(constants.EnvPort, constants.DefaultPort),
		Host:           getEnvOrDefault(constants.EnvHost, constants.DefaultHost),
		Automigrate:    getBoolEnvOrDefault(constants.EnvAutomigrate, true),
		DefaultPage:    constants.DefaultPage,
		DefaultPerPage: constants.DefaultPerPage,
		MaxPerPage:     constants.MaxPerPageLimit,
	}
}

// GetServerAddress returns the full server address
func (c *AppConfig) GetServerAddress() string {
	return c.Host + ":" + c.Port
}

// IsProductionMode returns true if running in production mode
func (c *AppConfig) IsProductionMode() bool {
	env := strings.ToLower(os.Getenv("GO_ENV"))
	return env == "production" || env == "prod"
}

// IsDevelopmentMode returns true if running in development mode
func (c *AppConfig) IsDevelopmentMode() bool {
	return !c.IsProductionMode()
}

// Helper functions

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getBoolEnvOrDefault returns boolean environment variable value or default if not set/invalid
func getBoolEnvOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		// PocketBase uses "false" to disable automigrate, anything else enables it
		if strings.ToLower(value) == "false" {
			return false
		}
		return true
	}
	return defaultValue
}

// getIntEnvOrDefault returns integer environment variable value or default if not set/invalid
func getIntEnvOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}