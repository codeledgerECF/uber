package observability

import "github.com/uber/shared/config"

type Client struct {
	cfg *config.Config
}

func New(cfg *config.Config) *Client { return &Client{cfg: cfg} }

func (c *Client) Counter(name string, tags map[string]string) {}
func (c *Client) Gauge(name string, value float64, tags map[string]string) {}
func (c *Client) Timing(name string, ms float64, tags map[string]string) {}
