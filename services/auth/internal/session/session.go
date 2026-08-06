package session

import (
	"github.com/uber/shared/config"
	"github.com/uber/shared/observability"
)

type Store struct {
	cfg *config.Config
	obs *observability.Client
}

func New(cfg *config.Config) *Store { return &Store{cfg: cfg} }

func (s *Store) Get(token string) (*SessionData, error)        { return nil, nil }
func (s *Store) Set(token string, data *SessionData) error     { return nil }
func (s *Store) Delete(token string) error                     { return nil }
func (s *Store) Extend(token string, ttlSecs int) error        { return nil }
