package container

import (
	"context"
	
	"vibe-tracker/repositories"
	"vibe-tracker/services"
)

// Context keys for dependency injection
type contextKey string

const (
	ContainerKey       contextKey = "container"
	UserRepositoryKey  contextKey = "user_repository"
	UserServiceKey     contextKey = "user_service"
	AuthServiceKey     contextKey = "auth_service"
	SessionServiceKey  contextKey = "session_service"
	LocationServiceKey contextKey = "location_service"
)

// ContainerInterface defines methods needed from the container
type ContainerInterface interface {
	GetRepositories() (repositories.UserRepository, repositories.SessionRepository, repositories.LocationRepository)
	GetServices() (*services.AuthService, *services.UserService, *services.SessionService, *services.LocationService, *services.HealthService)
}

// WithContainer adds the DI container to the context
func WithContainer(ctx context.Context, container ContainerInterface) context.Context {
	return context.WithValue(ctx, ContainerKey, container)
}

// GetContainer retrieves the DI container from the context
func GetContainer(ctx context.Context) ContainerInterface {
	if container, ok := ctx.Value(ContainerKey).(ContainerInterface); ok {
		return container
	}
	return nil
}

// WithUserRepository adds user repository to the context
func WithUserRepository(ctx context.Context, repo repositories.UserRepository) context.Context {
	return context.WithValue(ctx, UserRepositoryKey, repo)
}

// GetUserRepository retrieves user repository from the context
func GetUserRepository(ctx context.Context) repositories.UserRepository {
	if repo, ok := ctx.Value(UserRepositoryKey).(repositories.UserRepository); ok {
		return repo
	}
	return nil
}

// WithUserService adds user service to the context
func WithUserService(ctx context.Context, service *services.UserService) context.Context {
	return context.WithValue(ctx, UserServiceKey, service)
}

// GetUserService retrieves user service from the context
func GetUserService(ctx context.Context) *services.UserService {
	if service, ok := ctx.Value(UserServiceKey).(*services.UserService); ok {
		return service
	}
	return nil
}

// WithAuthService adds auth service to the context
func WithAuthService(ctx context.Context, service *services.AuthService) context.Context {
	return context.WithValue(ctx, AuthServiceKey, service)
}

// GetAuthService retrieves auth service from the context
func GetAuthService(ctx context.Context) *services.AuthService {
	if service, ok := ctx.Value(AuthServiceKey).(*services.AuthService); ok {
		return service
	}
	return nil
}

// WithSessionService adds session service to the context
func WithSessionService(ctx context.Context, service *services.SessionService) context.Context {
	return context.WithValue(ctx, SessionServiceKey, service)
}

// GetSessionService retrieves session service from the context
func GetSessionService(ctx context.Context) *services.SessionService {
	if service, ok := ctx.Value(SessionServiceKey).(*services.SessionService); ok {
		return service
	}
	return nil
}

// WithLocationService adds location service to the context
func WithLocationService(ctx context.Context, service *services.LocationService) context.Context {
	return context.WithValue(ctx, LocationServiceKey, service)
}

// GetLocationService retrieves location service from the context
func GetLocationService(ctx context.Context) *services.LocationService {
	if service, ok := ctx.Value(LocationServiceKey).(*services.LocationService); ok {
		return service
	}
	return nil
}

// InjectServices injects common services into the context for middleware/handlers that need them
func InjectServices(ctx context.Context, container ContainerInterface) context.Context {
	ctx = WithContainer(ctx, container)
	userRepo, _, _ := container.GetRepositories()
	authService, userService, sessionService, locationService, _ := container.GetServices()
	
	ctx = WithUserRepository(ctx, userRepo)
	ctx = WithUserService(ctx, userService)
	ctx = WithAuthService(ctx, authService)
	ctx = WithSessionService(ctx, sessionService)
	ctx = WithLocationService(ctx, locationService)
	return ctx
}