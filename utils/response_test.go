package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"vibe-tracker/models"
)

func TestBuildSuccess(t *testing.T) {
	data := map[string]string{"key": "value"}
	message := "Success message"
	resp := BuildSuccess(data, message)

	assert.Equal(t, "success", resp.Status)
	assert.Equal(t, message, resp.Message)
	assert.Equal(t, data, resp.Data)
}

func TestBuildError(t *testing.T) {
	code := http.StatusBadRequest
	message := "Error message"
	details := "Error details"
	resp := BuildError(code, message, details)

	assert.Equal(t, code, resp.Code)
	assert.Equal(t, message, resp.Message)
	assert.Equal(t, details, resp.Details)
}

func TestBuildPaginated(t *testing.T) {
	data := []string{"item1", "item2"}
	pagination := models.PaginationMeta{
		Page:       1,
		PerPage:    10,
		TotalItems: 2,
	}
	message := "Paginated message"
	resp := BuildPaginated(data, pagination, message)

	assert.Equal(t, "success", resp.Status)
	assert.Equal(t, message, resp.Message)

	paginatedData, ok := resp.Data.(models.PaginatedResponse)
	assert.True(t, ok)
	assert.Equal(t, data, paginatedData.Data)
	assert.Equal(t, pagination, paginatedData.Pagination)
}

func TestBuildGeoJSON(t *testing.T) {
	data := map[string]interface{}{
		"type": "FeatureCollection",
		"features": []interface{}{
			map[string]interface{}{
				"type": "Feature",
				"geometry": map[string]interface{}{
					"type":        "Point",
					"coordinates": []float64{10.0, 20.0},
				},
			},
		},
	}
	message := "GeoJSON message"
	resp := BuildGeoJSON(data, message)

	assert.Equal(t, "success", resp.Status)
	assert.Equal(t, message, resp.Message)
	assert.Equal(t, data, resp.Data)
}

func TestSendSuccess(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	data := map[string]string{"test": "data"}
	message := "Success"
	statusCode := http.StatusOK

	err := SendSuccess(c, statusCode, data, message)
	assert.NoError(t, err)
	assert.Equal(t, statusCode, rec.Code)

	expected := "{\"status\":\"success\",\"message\":\"Success\",\"data\":{\"test\":\"data\"}}"
	assert.Equal(t, expected+"\n", rec.Body.String())
}

func TestSendError(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	statusCode := http.StatusBadRequest
	message := "Bad Request"
	details := "Invalid input"

	err := SendError(c, statusCode, message, details)
	assert.NoError(t, err)
	assert.Equal(t, statusCode, rec.Code)

	expected := "{\"code\":400,\"message\":\"Bad Request\",\"details\":\"Invalid input\"}"
	assert.Equal(t, expected+"\n", rec.Body.String())
}

func TestSendPaginated(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	data := []string{"item1", "item2"}
	pagination := models.PaginationMeta{
		Page:       1,
		PerPage:    10,
		TotalItems: 2,
	}
	message := "Paginated data"
	statusCode := http.StatusOK

	err := SendPaginated(c, statusCode, data, pagination, message)
	assert.NoError(t, err)
	assert.Equal(t, statusCode, rec.Code)

	expected := "{\"status\":\"success\",\"message\":\"Paginated data\",\"data\":{\"data\":[\"item1\",\"item2\"],\"pagination\":{\"page\":1,\"perPage\":10,\"totalItems\":2,\"totalPages\":0}}}"
	assert.Equal(t, expected+"\n", rec.Body.String())
}

func TestSendGeoJSON(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	data := map[string]interface{}{
		"type": "FeatureCollection",
		"features": []interface{}{
			map[string]interface{}{
				"type": "Feature",
				"geometry": map[string]interface{}{
					"type":        "Point",
					"coordinates": []float64{10.0, 20.0},
				},
			},
		},
	}
	message := "GeoJSON response"
	statusCode := http.StatusOK

	err := SendGeoJSON(c, statusCode, data, message)
	assert.NoError(t, err)
	assert.Equal(t, statusCode, rec.Code)

	expected := "{\"status\":\"success\",\"message\":\"GeoJSON response\",\"data\":{\"features\":[{\"geometry\":{\"coordinates\":[10,20],\"type\":\"Point\"},\"type\":\"Feature\"}],\"type\":\"FeatureCollection\"}}"
	assert.Equal(t, expected+"\n", rec.Body.String())
}
