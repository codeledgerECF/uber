package handler

import (
	"github.com/uber/auth/internal/jwt"
	"github.com/uber/auth/internal/session"
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

type Handler struct {
	cfg  *config.Config
	jwt  *jwt.Service
	sess *session.Store
	obs  *observability.Client
}

func New(cfg *config.Config, sess *session.Store, obs *observability.Client) *Handler {
	return &Handler{cfg: cfg, jwt: jwt.New(cfg), sess: sess, obs: obs}
}

func (h *Handler) Serve()                          {}
func (h *Handler) HandleLogin(userID string) error { return nil }
func (h *Handler) HandleLogout(token string) error { return nil }
