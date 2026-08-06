package jwt

type ClaimType string

const (
	ClaimRider  ClaimType = "rider"
	ClaimDriver ClaimType = "driver"
	ClaimAdmin  ClaimType = "admin"
)

func ValidateClaims(c *Claims) error { return nil }
