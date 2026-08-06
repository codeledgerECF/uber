package geospatial

import "math"

type Grid struct {
	CellSizeKm float64
	cells      map[string][]string
}

func NewGrid(cellSizeKm float64) *Grid {
	return &Grid{CellSizeKm: cellSizeKm, cells: make(map[string][]string)}
}

func (g *Grid) Insert(id string, lat, lon float64) { }
func (g *Grid) Nearby(lat, lon float64, radiusKm float64) []string { return nil }

func ZoneFromCoords(lat, lon float64) string {
	return fmt.Sprintf("%.1f,%.1f", math.Round(lat*10)/10, math.Round(lon*10)/10)
}
