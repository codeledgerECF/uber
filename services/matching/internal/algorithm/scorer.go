package algorithm

import (
	"github.com/uber/matching/internal/geospatial"
	"github.com/uber/shared/config"
)

type Scorer struct{ cfg *config.Config }

func NewScorer(cfg *config.Config) *Scorer { return &Scorer{cfg: cfg} }

func (s *Scorer) Score(driver DriverPosition, riderLat, riderLon float64) float64 {
	dist := geospatial.Haversine(driver.Lat, driver.Lon, riderLat, riderLon)
	return 1.0 / (dist + 1.0)
}
