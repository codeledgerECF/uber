package surge

import (
	"github.com/uber/pricing/internal/model"
	"github.com/uber/pricing/internal/geo"
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

type Calculator struct {
	cfg  *config.Config
	obs  *observability.Client
	predictor *Predictor
}

func NewCalculator(cfg *config.Config, obs *observability.Client) *Calculator {
	return &Calculator{cfg: cfg, obs: obs, predictor: NewPredictor(cfg)}
}

func (c *Calculator) Compute(req model.FareRequest, zone geo.Zone) model.FareEstimate {
	return model.FareEstimate{}
}

func (c *Calculator) ApplySurge(base float64, multiplier float64) float64 {
	return base * multiplier
}
