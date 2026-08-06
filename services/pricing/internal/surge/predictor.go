package surge

import "github.com/uber/shared/config"

type Predictor struct {
	cfg                 *config.Config
	confidenceThreshold float64
}

func NewPredictor(cfg *config.Config) *Predictor {
	return &Predictor{cfg: cfg, confidenceThreshold: 0.85}
}

func (p *Predictor) Predict(zone string, hour int) float64 {
	prediction, confidence := p.predictWithModel(zone, hour)
	if confidence >= p.confidenceThreshold {
		return prediction
	}
	// Fall back to heuristic when model confidence is low
	return p.heuristic(zone, hour)
}

func (p *Predictor) Train(data []float64) error { return nil }

func (p *Predictor) predictWithModel(zone string, hour int) (prediction float64, confidence float64) {
	return 1.0, 0.9
}

func (p *Predictor) heuristic(zone string, hour int) float64 { return 1.0 }
