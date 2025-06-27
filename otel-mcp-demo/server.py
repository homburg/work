#!/usr/bin/env python3
"""
OpenTelemetry MCP Server - Minimal Viable Demo

A Model Context Protocol server that integrates with OpenTelemetry backends 
to enable AI agents to implement software solutions through trace-driven development.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
import mcp.server.stdio
import mcp.types as types
from rich.console import Console
from rich.json import JSON

# Set up logging and console
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("otel-mcp")
console = Console()

# Data Models
@dataclass
class SpanSpec:
    """Specification for an expected span"""
    operation_name: str
    service_name: str
    min_duration_ms: Optional[int] = None
    max_duration_ms: Optional[int] = None
    required_tags: Dict[str, str] = None
    children: List['SpanSpec'] = None
    
    def __post_init__(self):
        if self.required_tags is None:
            self.required_tags = {}
        if self.children is None:
            self.children = []

@dataclass
class TraceSpec:
    """Specification for an expected trace"""
    name: str
    description: str
    expected_spans: List[SpanSpec]
    max_total_duration_ms: Optional[int] = None

@dataclass
class MockSpan:
    """Mock span for demo purposes"""
    span_id: str
    operation_name: str
    service_name: str
    start_time: datetime
    duration_ms: int
    tags: Dict[str, str]
    status: str = "ok"
    children: List['MockSpan'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []

@dataclass
class MockTrace:
    """Mock trace for demo purposes"""
    trace_id: str
    service_name: str
    start_time: datetime
    total_duration_ms: int
    spans: List[MockSpan]

@dataclass
class ComparisonResult:
    """Result of comparing a trace against a specification"""
    matches_specification: bool
    missing_spans: List[str]
    unexpected_spans: List[str]
    performance_issues: List[str]
    suggestions: List[str]
    score: float  # 0.0 to 1.0

class MockOpenTelemetryBackend:
    """Mock OpenTelemetry backend for demo purposes"""
    
    def __init__(self):
        self.traces: Dict[str, MockTrace] = {}
        self._generate_sample_traces()
    
    def _generate_sample_traces(self):
        """Generate some sample traces for demo"""
        
        # Sample 1: E-commerce checkout (good trace)
        checkout_spans = [
            MockSpan("span-1", "checkout.validate_cart", "cart-service", 
                    datetime.now(), 50, {"user_id": "123", "cart_items": "3"}),
            MockSpan("span-2", "payment.process", "payment-service", 
                    datetime.now(), 1200, {"amount": "99.99", "method": "credit_card"}),
            MockSpan("span-3", "inventory.reserve", "inventory-service", 
                    datetime.now(), 300, {"items": "widget-1,widget-2"}),
            MockSpan("span-4", "order.create", "order-service", 
                    datetime.now(), 150, {"order_id": "ord-456"})
        ]
        
        good_trace = MockTrace(
            "trace-good-checkout", "checkout-service", 
            datetime.now(), 1700, checkout_spans
        )
        self.traces["trace-good-checkout"] = good_trace
        
        # Sample 2: E-commerce checkout (problematic trace)
        problem_spans = [
            MockSpan("span-1", "checkout.validate_cart", "cart-service", 
                    datetime.now(), 200, {"user_id": "456"}),  # Slow validation
            MockSpan("span-2", "payment.process", "payment-service", 
                    datetime.now(), 5000, {"amount": "199.99", "method": "credit_card"}),  # Very slow payment
            # Missing inventory.reserve span!
            MockSpan("span-4", "order.create", "order-service", 
                    datetime.now(), 150, {"order_id": "ord-789"})
        ]
        
        problem_trace = MockTrace(
            "trace-problem-checkout", "checkout-service", 
            datetime.now(), 5350, problem_spans
        )
        self.traces["trace-problem-checkout"] = problem_trace
    
    def get_trace_by_id(self, trace_id: str) -> Optional[MockTrace]:
        """Get a trace by ID"""
        return self.traces.get(trace_id)
    
    def get_traces_by_service(self, service_name: str, hours: int = 1) -> List[MockTrace]:
        """Get traces for a service within the last N hours"""
        cutoff = datetime.now() - timedelta(hours=hours)
        return [
            trace for trace in self.traces.values() 
            if trace.service_name == service_name and trace.start_time >= cutoff
        ]

class TraceAnalyzer:
    """Analyzes traces against specifications"""
    
    def compare_trace_to_spec(self, trace: MockTrace, spec: TraceSpec) -> ComparisonResult:
        """Compare a trace against a specification"""
        missing_spans = []
        unexpected_spans = []
        performance_issues = []
        suggestions = []
        
        # Check for expected spans
        trace_operations = {span.operation_name for span in trace.spans}
        spec_operations = {span.operation_name for span in spec.expected_spans}
        
        missing_spans = list(spec_operations - trace_operations)
        unexpected_spans = list(trace_operations - spec_operations)
        
        # Check performance constraints
        if spec.max_total_duration_ms and trace.total_duration_ms > spec.max_total_duration_ms:
            performance_issues.append(
                f"Total duration {trace.total_duration_ms}ms exceeds maximum {spec.max_total_duration_ms}ms"
            )
        
        # Check individual span performance
        for spec_span in spec.expected_spans:
            matching_spans = [s for s in trace.spans if s.operation_name == spec_span.operation_name]
            if matching_spans:
                span = matching_spans[0]
                if spec_span.max_duration_ms and span.duration_ms > spec_span.max_duration_ms:
                    performance_issues.append(
                        f"Span '{span.operation_name}' duration {span.duration_ms}ms exceeds maximum {spec_span.max_duration_ms}ms"
                    )
        
        # Generate suggestions
        if missing_spans:
            suggestions.append(f"Implement missing operations: {', '.join(missing_spans)}")
        
        if performance_issues:
            suggestions.append("Optimize slow operations identified in performance issues")
        
        if unexpected_spans:
            suggestions.append(f"Review unexpected operations: {', '.join(unexpected_spans)}")
        
        # Calculate score
        total_checks = len(spec_operations) + (1 if spec.max_total_duration_ms else 0)
        passed_checks = len(spec_operations) - len(missing_spans)
        if spec.max_total_duration_ms and trace.total_duration_ms <= spec.max_total_duration_ms:
            passed_checks += 1
        
        score = passed_checks / total_checks if total_checks > 0 else 0.0
        
        matches_specification = len(missing_spans) == 0 and len(performance_issues) == 0
        
        return ComparisonResult(
            matches_specification=matches_specification,
            missing_spans=missing_spans,
            unexpected_spans=unexpected_spans,
            performance_issues=performance_issues,
            suggestions=suggestions,
            score=score
        )

# Global state
backend = MockOpenTelemetryBackend()
analyzer = TraceAnalyzer()
trace_specs: Dict[str, TraceSpec] = {}

# Initialize MCP server
server = Server("opentelemetry-mcp")

@server.list_tools()
async def handle_list_tools() -> List[types.Tool]:
    """List available tools for the MCP server"""
    return [
        types.Tool(
            name="get_traces",
            description="Retrieve traces from OpenTelemetry backend",
            inputSchema={
                "type": "object",
                "properties": {
                    "service_name": {
                        "type": "string",
                        "description": "Name of the service to get traces for"
                    },
                    "hours": {
                        "type": "integer",
                        "description": "Number of hours to look back (default: 1)",
                        "default": 1
                    }
                },
                "required": ["service_name"]
            }
        ),
        types.Tool(
            name="get_trace_by_id",
            description="Get a specific trace by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "trace_id": {
                        "type": "string",
                        "description": "The trace ID to retrieve"
                    }
                },
                "required": ["trace_id"]
            }
        ),
        types.Tool(
            name="define_trace_spec",
            description="Define expected trace specification",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name for this trace specification"
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what this trace represents"
                    },
                    "spec": {
                        "type": "object",
                        "description": "The trace specification object"
                    }
                },
                "required": ["name", "description", "spec"]
            }
        ),
        types.Tool(
            name="compare_trace_to_spec",
            description="Compare a trace against a specification",
            inputSchema={
                "type": "object",
                "properties": {
                    "trace_id": {
                        "type": "string",
                        "description": "The trace ID to analyze"
                    },
                    "spec_name": {
                        "type": "string",
                        "description": "Name of the specification to compare against"
                    }
                },
                "required": ["trace_id", "spec_name"]
            }
        ),
        types.Tool(
            name="list_trace_specs",
            description="List all defined trace specifications",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        types.Tool(
            name="analyze_trace",
            description="Perform detailed analysis of a trace",
            inputSchema={
                "type": "object",
                "properties": {
                    "trace_id": {
                        "type": "string",
                        "description": "The trace ID to analyze"
                    }
                },
                "required": ["trace_id"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> List[types.TextContent]:
    """Handle tool calls from the MCP client"""
    
    try:
        if name == "get_traces":
            service_name = arguments["service_name"]
            hours = arguments.get("hours", 1)
            
            traces = backend.get_traces_by_service(service_name, hours)
            
            result = {
                "traces": [
                    {
                        "trace_id": trace.trace_id,
                        "service_name": trace.service_name,
                        "start_time": trace.start_time.isoformat(),
                        "total_duration_ms": trace.total_duration_ms,
                        "span_count": len(trace.spans)
                    }
                    for trace in traces
                ]
            }
            
            return [types.TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "get_trace_by_id":
            trace_id = arguments["trace_id"]
            trace = backend.get_trace_by_id(trace_id)
            
            if not trace:
                return [types.TextContent(type="text", text=f"Trace {trace_id} not found")]
            
            result = {
                "trace_id": trace.trace_id,
                "service_name": trace.service_name,
                "start_time": trace.start_time.isoformat(),
                "total_duration_ms": trace.total_duration_ms,
                "spans": [
                    {
                        "span_id": span.span_id,
                        "operation_name": span.operation_name,
                        "service_name": span.service_name,
                        "duration_ms": span.duration_ms,
                        "tags": span.tags,
                        "status": span.status
                    }
                    for span in trace.spans
                ]
            }
            
            return [types.TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "define_trace_spec":
            spec_name = arguments["name"]
            description = arguments["description"]
            spec_data = arguments["spec"]
            
            # Parse the specification
            expected_spans = []
            for span_data in spec_data.get("expected_spans", []):
                span_spec = SpanSpec(
                    operation_name=span_data["operation_name"],
                    service_name=span_data["service_name"],
                    min_duration_ms=span_data.get("min_duration_ms"),
                    max_duration_ms=span_data.get("max_duration_ms"),
                    required_tags=span_data.get("required_tags", {})
                )
                expected_spans.append(span_spec)
            
            trace_spec = TraceSpec(
                name=spec_name,
                description=description,
                expected_spans=expected_spans,
                max_total_duration_ms=spec_data.get("max_total_duration_ms")
            )
            
            trace_specs[spec_name] = trace_spec
            
            return [types.TextContent(
                type="text", 
                text=f"Trace specification '{spec_name}' defined successfully"
            )]
        
        elif name == "compare_trace_to_spec":
            trace_id = arguments["trace_id"]
            spec_name = arguments["spec_name"]
            
            trace = backend.get_trace_by_id(trace_id)
            if not trace:
                return [types.TextContent(type="text", text=f"Trace {trace_id} not found")]
            
            spec = trace_specs.get(spec_name)
            if not spec:
                return [types.TextContent(type="text", text=f"Specification '{spec_name}' not found")]
            
            comparison = analyzer.compare_trace_to_spec(trace, spec)
            result = asdict(comparison)
            
            return [types.TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "list_trace_specs":
            specs = [
                {
                    "name": spec.name,
                    "description": spec.description,
                    "span_count": len(spec.expected_spans)
                }
                for spec in trace_specs.values()
            ]
            
            return [types.TextContent(type="text", text=json.dumps({"specifications": specs}, indent=2))]
        
        elif name == "analyze_trace":
            trace_id = arguments["trace_id"]
            trace = backend.get_trace_by_id(trace_id)
            
            if not trace:
                return [types.TextContent(type="text", text=f"Trace {trace_id} not found")]
            
            # Perform basic analysis
            analysis = {
                "trace_id": trace.trace_id,
                "total_duration_ms": trace.total_duration_ms,
                "span_count": len(trace.spans),
                "services": list(set(span.service_name for span in trace.spans)),
                "operations": [span.operation_name for span in trace.spans],
                "performance_summary": {
                    "slowest_span": max(trace.spans, key=lambda s: s.duration_ms).operation_name,
                    "fastest_span": min(trace.spans, key=lambda s: s.duration_ms).operation_name,
                    "avg_span_duration": sum(s.duration_ms for s in trace.spans) / len(trace.spans)
                }
            }
            
            return [types.TextContent(type="text", text=json.dumps(analysis, indent=2))]
        
        else:
            return [types.TextContent(type="text", text=f"Unknown tool: {name}")]
    
    except Exception as e:
        logger.error(f"Error handling tool call {name}: {e}")
        return [types.TextContent(type="text", text=f"Error: {str(e)}")]

async def main():
    """Main function to run the MCP server"""
    # Run the server using stdio transport
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="opentelemetry-mcp",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())