package session

import "time"

type SessionData struct {
	UserID    string
	RiderID   string
	DriverID  string
	CreatedAt time.Time
	ExpiresAt time.Time
	Metadata  map[string]string
}
