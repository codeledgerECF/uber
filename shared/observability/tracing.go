package observability

type Span struct {
	TraceID string
	SpanID  string
}

func (c *Client) StartSpan(op string) *Span { return &Span{} }
func (s *Span) Finish() {}
func (s *Span) SetTag(key, value string) {}
func (s *Span) SetError(err error) {}
