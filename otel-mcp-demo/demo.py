#!/usr/bin/env python3
"""
OpenTelemetry MCP Demo - Standalone Version

Demonstrates the core concepts of trace-driven development with AI agents
without requiring external MCP libraries.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

@dataclass
class SpanSpec:
    """Specification for an expected span"""
    operation_name: str
    service_name: str
    min_duration_ms: Optional[int] = None
    max_duration_ms: Optional[int] = None
    required_tags: Optional[Dict[str, str]] = None
    
    def __post_init__(self):
        if self.required_tags is None:
            self.required_tags = {}

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

class OpenTelemetryMCPDemo:
    """Demo class that simulates the MCP server functionality"""
    
    def __init__(self):
        self.traces: Dict[str, MockTrace] = {}
        self.trace_specs: Dict[str, TraceSpec] = {}
        self._setup_demo_data()
    
    def _setup_demo_data(self):
        """Set up sample traces and specifications for demo"""
        print("🚀 Setting up OpenTelemetry MCP Demo...")
        
        # Create sample traces
        self._create_sample_traces()
        
        # Create sample specifications
        self._create_sample_specifications()
        
        print("✅ Demo data initialized!")
    
    def _create_sample_traces(self):
        """Create sample traces for demonstration"""
        
        # Good e-commerce checkout trace
        good_spans = [
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
            datetime.now(), 1700, good_spans
        )
        self.traces["trace-good-checkout"] = good_trace
        
        # Problematic e-commerce checkout trace
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
        
        print(f"📊 Created {len(self.traces)} sample traces")
    
    def _create_sample_specifications(self):
        """Create sample trace specifications"""
        
        # E-commerce checkout specification
        checkout_spans = [
            SpanSpec("checkout.validate_cart", "cart-service", max_duration_ms=100),
            SpanSpec("payment.process", "payment-service", max_duration_ms=2000),
            SpanSpec("inventory.reserve", "inventory-service", max_duration_ms=500),
            SpanSpec("order.create", "order-service", max_duration_ms=200)
        ]
        
        checkout_spec = TraceSpec(
            name="ecommerce_checkout",
            description="Complete e-commerce checkout process",
            expected_spans=checkout_spans,
            max_total_duration_ms=3000
        )
        
        self.trace_specs["ecommerce_checkout"] = checkout_spec
        
        print(f"📋 Created {len(self.trace_specs)} trace specifications")
    
    def get_trace_by_id(self, trace_id: str) -> Optional[MockTrace]:
        """Get a trace by ID"""
        return self.traces.get(trace_id)
    
    def list_traces(self) -> List[str]:
        """List all available trace IDs"""
        return list(self.traces.keys())
    
    def list_specs(self) -> List[str]:
        """List all available specification names"""
        return list(self.trace_specs.keys())
    
    def compare_trace_to_spec(self, trace_id: str, spec_name: str) -> ComparisonResult:
        """Compare a trace against a specification"""
        trace = self.traces.get(trace_id)
        spec = self.trace_specs.get(spec_name)
        
        if not trace:
            raise ValueError(f"Trace {trace_id} not found")
        if not spec:
            raise ValueError(f"Specification {spec_name} not found")
        
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
    
    def print_trace_details(self, trace_id: str):
        """Print detailed information about a trace"""
        trace = self.get_trace_by_id(trace_id)
        if not trace:
            print(f"❌ Trace {trace_id} not found")
            return
        
        print(f"\n📊 Trace Details: {trace_id}")
        print(f"Service: {trace.service_name}")
        print(f"Total Duration: {trace.total_duration_ms}ms")
        print(f"Start Time: {trace.start_time.strftime('%H:%M:%S')}")
        print(f"Spans: {len(trace.spans)}")
        
        for i, span in enumerate(trace.spans, 1):
            print(f"  {i}. {span.operation_name} ({span.service_name}) - {span.duration_ms}ms")
            if span.tags:
                print(f"     Tags: {span.tags}")
    
    def print_comparison_result(self, result: ComparisonResult):
        """Print a formatted comparison result"""
        print(f"\n🔍 Trace Analysis Result")
        print(f"Score: {result.score:.2f}/1.0")
        print(f"Matches Specification: {'✅ Yes' if result.matches_specification else '❌ No'}")
        
        if result.missing_spans:
            print(f"\n❌ Missing Spans: {', '.join(result.missing_spans)}")
        
        if result.unexpected_spans:
            print(f"\n⚠️  Unexpected Spans: {', '.join(result.unexpected_spans)}")
        
        if result.performance_issues:
            print(f"\n🐌 Performance Issues:")
            for issue in result.performance_issues:
                print(f"  - {issue}")
        
        if result.suggestions:
            print(f"\n💡 Suggestions:")
            for suggestion in result.suggestions:
                print(f"  - {suggestion}")
    
    def run_demo(self):
        """Run the complete demo workflow"""
        print("\n" + "="*60)
        print("🎯 OpenTelemetry MCP Server Demo")
        print("="*60)
        
        print("\n1️⃣ Available Traces:")
        for trace_id in self.list_traces():
            print(f"  - {trace_id}")
        
        print("\n2️⃣ Available Specifications:")
        for spec_name in self.list_specs():
            spec = self.trace_specs[spec_name]
            print(f"  - {spec_name}: {spec.description}")
        
        # Demo 1: Analyze good trace
        print(f"\n3️⃣ Demo 1: Analyzing Good Trace")
        self.print_trace_details("trace-good-checkout")
        
        result_good = self.compare_trace_to_spec("trace-good-checkout", "ecommerce_checkout")
        self.print_comparison_result(result_good)
        
        # Demo 2: Analyze problematic trace
        print(f"\n4️⃣ Demo 2: Analyzing Problematic Trace")
        self.print_trace_details("trace-problem-checkout")
        
        result_problem = self.compare_trace_to_spec("trace-problem-checkout", "ecommerce_checkout")
        self.print_comparison_result(result_problem)
        
        # Demo 3: AI Agent workflow simulation
        print(f"\n5️⃣ Demo 3: AI Agent Workflow Simulation")
        print("\n🤖 AI Agent: Starting checkout implementation...")
        print("🤖 AI Agent: Running service and capturing trace...")
        print("🤖 AI Agent: Analyzing trace against specification...")
        
        # Simulate agent analyzing the problematic trace
        if not result_problem.matches_specification:
            print("\n🤖 AI Agent: Issues detected! Implementing fixes:")
            for suggestion in result_problem.suggestions:
                print(f"    📝 {suggestion}")
            
            print("\n🤖 AI Agent: After implementing fixes, would run service again...")
            print("🤖 AI Agent: Expected result: trace matches specification ✅")
        
        print(f"\n6️⃣ Key Benefits Demonstrated:")
        print("  ✅ Automatic trace validation against specifications")
        print("  ✅ Performance issue detection")
        print("  ✅ Missing functionality identification") 
        print("  ✅ Actionable suggestions for AI agents")
        print("  ✅ Quantified progress tracking (scores)")
        
        print("\n🎉 Demo completed! This shows how AI agents can use")
        print("   trace-driven development to iteratively improve software.")

def main():
    """Main function to run the demo"""
    demo = OpenTelemetryMCPDemo()
    demo.run_demo()

if __name__ == "__main__":
    main()