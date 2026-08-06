package geo

import "github.com/uber/shared/observability"

type Zone struct {
	ID       string
	Name     string
	CenterLat float64
	CenterLon float64
	RadiusKm  float64
}

type ZoneResolver struct{ obs *observability.Client }

func NewZoneResolver(obs *observability.Client) *ZoneResolver { return &ZoneResolver{obs: obs} }

func (r *ZoneResolver) Resolve(lat, lon float64) (Zone, error) { return Zone{}, nil }
func (r *ZoneResolver) NearbyZones(z Zone, radiusKm float64) []Zone { return nil }
