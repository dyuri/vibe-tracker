package container

import (
	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	
	"vibe-tracker/config"
	"vibe-tracker/handlers"
	"vibe-tracker/middleware"
	"vibe-tracker/repositories"
	"vibe-tracker/services"
)

// Container holds all application dependencies
type Container struct {
	// Core components
	App    *pocketbase.PocketBase
	Config *config.AppConfig

	// Repositories
	UserRepository     repositories.UserRepository
	SessionRepository  repositories.SessionRepository
	LocationRepository repositories.LocationRepository

	// Services
	AuthService     *services.AuthService
	UserService     *services.UserService
	SessionService  *services.SessionService
	LocationService *services.LocationService

	// Handlers
	AuthHandler     *handlers.AuthHandler
	SessionHandler  *handlers.SessionHandler
	TrackingHandler *handlers.TrackingHandler
	PublicHandler   *handlers.PublicHandler
	DocsHandler     *handlers.DocsHandler

	// Middleware
	AuthMiddleware       *middleware.AuthMiddleware
	UserMiddleware       *middleware.UserMiddleware
	ErrorHandler         *middleware.ErrorHandler
	ValidationMiddleware *middleware.ValidationMiddleware
}

// NewContainer creates a new dependency injection container
func NewContainer(app *pocketbase.PocketBase, cfg *config.AppConfig) *Container {
	container := &Container{
		App:    app,
		Config: cfg,
	}

	// Initialize dependencies in proper order
	container.initRepositories()
	container.initServices()
	container.initHandlers()
	container.initMiddleware()

	return container
}

// initRepositories initializes all repository dependencies
func (c *Container) initRepositories() {
	c.UserRepository = repositories.NewUserRepository(c.App)
	c.SessionRepository = repositories.NewSessionRepository(c.App)
	c.LocationRepository = repositories.NewLocationRepository(c.App)
}

// initServices initializes all service dependencies
func (c *Container) initServices() {
	c.AuthService = services.NewAuthService(c.App, c.UserRepository)
	c.UserService = services.NewUserService(c.UserRepository)
	c.SessionService = services.NewSessionService(c.SessionRepository)
	c.LocationService = services.NewLocationService(
		c.LocationRepository,
		c.UserRepository,
		c.SessionRepository,
		c.SessionService,
	)
}

// initHandlers initializes all handler dependencies
func (c *Container) initHandlers() {
	c.AuthHandler = handlers.NewAuthHandler(c.App, c.AuthService)
	c.SessionHandler = handlers.NewSessionHandler(c.App, c.SessionService)
	c.TrackingHandler = handlers.NewTrackingHandler(c.App, c.LocationService)
	c.PublicHandler = handlers.NewPublicHandler(c.App, c.LocationService, c.UserService)
	c.DocsHandler = handlers.NewDocsHandler(c.App)
}

// initMiddleware initializes all middleware dependencies
func (c *Container) initMiddleware() {
	c.AuthMiddleware = middleware.NewAuthMiddleware(c.App)
	c.UserMiddleware = middleware.NewUserMiddleware(c.App)
	c.ErrorHandler = middleware.NewErrorHandler()
	c.ValidationMiddleware = middleware.NewValidationMiddleware()
}

// GetRepositories returns all repositories for testing purposes
func (c *Container) GetRepositories() (repositories.UserRepository, repositories.SessionRepository, repositories.LocationRepository) {
	return c.UserRepository, c.SessionRepository, c.LocationRepository
}

// GetServices returns all services for testing purposes
func (c *Container) GetServices() (*services.AuthService, *services.UserService, *services.SessionService, *services.LocationService) {
	return c.AuthService, c.UserService, c.SessionService, c.LocationService
}

// GetHandlers returns all handlers for testing purposes
func (c *Container) GetHandlers() (*handlers.AuthHandler, *handlers.SessionHandler, *handlers.TrackingHandler, *handlers.PublicHandler, *handlers.DocsHandler) {
	return c.AuthHandler, c.SessionHandler, c.TrackingHandler, c.PublicHandler, c.DocsHandler
}

// GetMiddleware returns all middleware for testing purposes
func (c *Container) GetMiddleware() (*middleware.AuthMiddleware, *middleware.UserMiddleware, *middleware.ErrorHandler, *middleware.ValidationMiddleware) {
	return c.AuthMiddleware, c.UserMiddleware, c.ErrorHandler, c.ValidationMiddleware
}

// InjectMiddleware returns middleware that injects the container into the Echo context
func (c *Container) InjectMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx echo.Context) error {
			// Inject container and services into the request context
			reqCtx := InjectServices(ctx.Request().Context(), c)
			ctx.SetRequest(ctx.Request().WithContext(reqCtx))
			return next(ctx)
		}
	}
}