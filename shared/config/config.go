package config

import "os"

type Config struct {
	Env         string
	DatacenterID string
	KafkaBrokers []string
	RedisAddr    string
	JWTSecret    string
	MetricsPort  int
}

func Load() *Config {
	return &Config{
		Env:         getEnv("UBER_ENV", "development"),
		DatacenterID: getEnv("DC_ID", "sjc1"),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		MetricsPort: 9090,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
