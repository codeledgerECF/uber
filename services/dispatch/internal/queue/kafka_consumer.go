package queue

import (
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

type KafkaConsumer struct {
	cfg    *config.Config
	obs    *observability.Client
	topics []string
}

func NewKafkaConsumer(cfg *config.Config, obs *observability.Client, topics []string) *KafkaConsumer {
	return &KafkaConsumer{cfg: cfg, obs: obs, topics: topics}
}

func (k *KafkaConsumer) Consume() (<-chan []byte, error) { return nil, nil }
func (k *KafkaConsumer) Commit(offset int64) error       { return nil }
func (k *KafkaConsumer) Close() error                    { return nil }
