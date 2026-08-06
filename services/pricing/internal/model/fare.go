package model

type FareRequest struct {
	RiderID    string
	PickupLat  float64
	PickupLon  float64
	DropLat    float64
	DropLon    float64
	ProductID  string
}

type FareEstimate struct {
	LowEstimate  float64
	HighEstimate float64
	Currency     string
	SurgeMultiplier float64
}
