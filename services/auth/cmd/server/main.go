package main

import (
	"github.com/uber/auth/internal/handler"
	"github.com/uber/auth/internal/session"
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

func main() {
	cfg := config.Load()
	obs := observability.New(cfg)
	sess := session.New(cfg)
	h := handler.New(cfg, sess, obs)
	h.Serve()
}
