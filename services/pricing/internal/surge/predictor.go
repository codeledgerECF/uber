package surge

import "github.com/uber/shared/config"

type Predictor struct{ cfg *config.Config }

func NewPredictor(cfg *config.Config) *Predictor { return &Predictor{cfg: cfg} }

func (p *Predictor) Predict(zone string, hour int) float64 { return 1.0 }
func (p *Predictor) Train(data []float64) error            { return nil }
