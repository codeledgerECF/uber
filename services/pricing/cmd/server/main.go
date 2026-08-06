package main

import (
	"github.com/uber/pricing/internal/surge"
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

func main() {
	cfg := config.Load()
	obs := observability.New(cfg)
	calc := surge.NewCalculator(cfg, obs)
	_ = calc
}
