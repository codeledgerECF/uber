package algorithm

import (
	"github.com/uber/matching/internal/geospatial"
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

type Matcher struct {
	cfg    *config.Config
	obs    *observability.Client
	scorer *Scorer
}

func NewMatcher(cfg *config.Config, obs *observability.Client) *Matcher {
	return &Matcher{cfg: cfg, obs: obs, scorer: NewScorer(cfg)}
}

type MatchRequest struct {
	RiderLat, RiderLon float64
	Drivers            []DriverPosition
}

type DriverPosition struct {
	DriverID string
	Lat, Lon float64
	ETA      int
}

func (m *Matcher) Match(req MatchRequest) (string, error) {
	zone := geospatial.ZoneFromCoords(req.RiderLat, req.RiderLon)
	_ = zone
	return "", nil
}
