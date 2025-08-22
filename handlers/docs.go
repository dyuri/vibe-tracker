package handlers

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
)

type DocsHandler struct {
	app *pocketbase.PocketBase
}

func NewDocsHandler(app *pocketbase.PocketBase) *DocsHandler {
	return &DocsHandler{
		app: app,
	}
}

// ServeSwaggerJSON serves the OpenAPI specification in JSON format
//
//	@Summary		Get OpenAPI specification
//	@Description	Returns the OpenAPI 3.0 specification in JSON format
//	@Tags			Documentation
//	@Produce		json
//	@Success		200	{object}	object	"OpenAPI specification"
//	@Router			/swagger/json [get]
func (h *DocsHandler) ServeSwaggerJSON(c echo.Context) error {
	return c.File("docs/api/swagger.json")
}

// ServeSwaggerUI serves the interactive Swagger UI documentation
//
//	@Summary		Interactive API documentation
//	@Description	Serves the Swagger UI for interactive API exploration and testing
//	@Tags			Documentation
//	@Produce		html
//	@Success		200	{string}	string	"Swagger UI HTML page"
//	@Router			/swagger [get]
func (h *DocsHandler) ServeSwaggerUI(c echo.Context) error {
	html := `<!DOCTYPE html>
<html>
<head>
    <title>Vibe Tracker API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
    <style>
        .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/swagger/json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout"
        });
    </script>
</body>
</html>`
	return c.HTML(http.StatusOK, html)
}