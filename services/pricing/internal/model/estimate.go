package model

type EstimateBreakdown struct {
	BaseFare     float64
	SurgeFare    float64
	ServiceFee   float64
	Total        float64
}

func (e FareEstimate) Breakdown() EstimateBreakdown { return EstimateBreakdown{} }
