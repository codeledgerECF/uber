package tracker

import (
	"github.com/uber/dispatch/internal/queue"
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

type LocationTracker struct {
	consumer *queue.KafkaConsumer
	obs      *observability.Client
}

func NewLocationTracker(cfg *config.Config, obs *observability.Client) *LocationTracker {
	consumer := queue.NewKafkaConsumer(cfg, obs, []string{"driver-locations"})
	return &LocationTracker{consumer: consumer, obs: obs}
}

type Location struct {
	DriverID  string
	Lat, Lon  float64
	Timestamp int64
}

func (t *LocationTracker) Stream() (<-chan Location, error) { return nil, nil }
func (t *LocationTracker) GetLast(driverID string) (*Location, error) { return nil, nil }
