package jwt

import "github.com/uber/shared/config"

type Claims struct {
	UserID   string
	RiderID  string
	DriverID string
}

type Service struct{ cfg *config.Config }

func New(cfg *config.Config) *Service { return &Service{cfg: cfg} }

func (s *Service) Sign(claims Claims) (string, error)   { return "", nil }
func (s *Service) Verify(token string) (*Claims, error) { return nil, nil }
func (s *Service) Refresh(token string) (string, error) { return "", nil }
