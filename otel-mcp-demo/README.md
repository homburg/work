# OpenTelemetry MCP Server Demo

A minimal viable demo showcasing how AI agents can use trace-driven development with OpenTelemetry for iterative software implementation.

## What This Demonstrates

This demo shows the core concept of an **OpenTelemetry MCP (Model Context Protocol) Server** that enables AI agents to:

1. **Define Expected Traces** - Specify what a successful service interaction should look like
2. **Capture Actual Traces** - Run services and collect OpenTelemetry traces  
3. **Compare & Analyze** - Automatically identify gaps, performance issues, and missing functionality
4. **Iterate Based on Feedback** - Use actionable suggestions to improve implementation

## Demo Scenario: E-commerce Checkout

The demo simulates an AI agent implementing an e-commerce checkout flow with these expected operations:

- `checkout.validate_cart` (cart-service) - ≤100ms
- `payment.process` (payment-service) - ≤2000ms  
- `inventory.reserve` (inventory-service) - ≤500ms
- `order.create` (order-service) - ≤200ms

## Running the Demo

```bash
cd otel-mcp-demo
python demo.py
```

## What You'll See

### 1. Good Trace Analysis ✅
- All expected spans present
- Performance within limits
- Score: 1.0/1.0

### 2. Problematic Trace Analysis ❌
- Missing `inventory.reserve` span  
- `payment.process` too slow (5000ms > 2000ms limit)
- Clear suggestions for fixes
- Score: 0.6/1.0

### 3. AI Agent Workflow Simulation
Shows how an agent would:
- Detect issues automatically
- Receive actionable suggestions
- Iterate on implementation
- Re-run and validate

## Key Benefits

✅ **Automatic Validation** - No manual trace inspection needed  
✅ **Performance Monitoring** - Catch slow operations early  
✅ **Missing Functionality Detection** - Identify incomplete implementations  
✅ **Actionable Feedback** - AI-friendly suggestions for improvements  
✅ **Progress Tracking** - Quantified scores for iteration progress  

## Real-World Usage

In a production system, this MCP server would:

- Connect to actual OpenTelemetry backends (Jaeger, Zipkin, etc.)
- Provide MCP tools for AI agents to call
- Support complex distributed trace analysis
- Enable continuous validation during development

## Next Steps

To turn this into a full implementation:

1. **Real OpenTelemetry Integration** - Connect to actual backends
2. **MCP Protocol Implementation** - Full MCP server with stdio transport
3. **Advanced Analysis** - Distributed traces, error correlation, regression detection
4. **Development Workflow Tools** - Session management, automated test running

This demo proves the viability of trace-driven development for AI agents!