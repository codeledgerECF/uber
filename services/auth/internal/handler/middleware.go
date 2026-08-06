package handler

import (
	"github.com/uber/auth/internal/jwt"
	"github.com/uber/shared/observability"
)

func AuthMiddleware(svc *jwt.Service, obs *observability.Client) func() {
	return func() {}
}

func RateLimitMiddleware(cfg interface{}) func() {
	return func() {}
}
