package utils

import (
	"regexp"
	"strings"
	"unicode"
)

// GenerateSessionTitle converts a session name to a title case format
func GenerateSessionTitle(sessionName string) string {
	if sessionName == "" {
		return "Untitled Session"
	}

	// Replace underscores and hyphens with spaces
	title := strings.ReplaceAll(sessionName, "_", " ")
	title = strings.ReplaceAll(title, "-", " ")

	// Split into words and capitalize each word
	words := strings.Fields(title)
	for i, word := range words {
		if len(word) > 0 {
			// Convert to lower case first, then capitalize first letter
			word = strings.ToLower(word)
			runes := []rune(word)
			runes[0] = unicode.ToUpper(runes[0])
			words[i] = string(runes)
		}
	}

	return strings.Join(words, " ")
}

// ValidateSessionName validates that a session name is valid
func ValidateSessionName(name string) bool {
	if name == "" {
		return false
	}

	// Check for valid characters (alphanumeric, underscore, hyphen)
	validName := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	return validName.MatchString(name)
}

// SanitizeSessionName cleans up a session name for safe usage
func SanitizeSessionName(name string) string {
	// Remove invalid characters
	reg := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	cleaned := reg.ReplaceAllString(name, "_")

	// Remove multiple consecutive underscores
	multiUnderscore := regexp.MustCompile(`_{2,}`)
	cleaned = multiUnderscore.ReplaceAllString(cleaned, "_")

	// Trim leading/trailing underscores
	cleaned = strings.Trim(cleaned, "_")

	return cleaned
}
