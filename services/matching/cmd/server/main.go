package main

import (
	"github.com/uber/matching/internal/algorithm"
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

func main() {
	cfg := config.Load()
	obs := observability.New(cfg)
	matcher := algorithm.NewMatcher(cfg, obs)
	_ = matcher
}
